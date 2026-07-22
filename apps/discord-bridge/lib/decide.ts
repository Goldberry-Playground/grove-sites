/**
 * Executes a content-approval decision (GOL-470): Approve / Revise create
 * draft-only Buffer posts on the suggestion's target channels; Reject creates
 * none. Every outcome writes an immutable `evt_` audit record (stdout sink +
 * best-effort Paperclip mirror) and returns the edited card to show in Discord.
 *
 * Kept separate from the HTTP server so the full decision flow is unit-testable
 * with a mocked Buffer client and fetch.
 */
import {
  buildAuditEvent,
  emitAuditEvent,
  mirrorAuditEvent,
  type AuditAction,
  type AuditEvent,
  type AuditMirrorConfig,
} from "./audit.ts";
import { decisionCard, parseCardContext, type MediaAsset, type Platform } from "./approval.ts";
import { composePost } from "./hashtags.ts";
import type { DiscordMessage } from "./render.ts";
import type { BufferChannel } from "./types.ts";

/** The minimal Buffer surface the decision flow needs (mockable in tests). */
export interface BufferLike {
  listChannels(): Promise<BufferChannel[]>;
  createDraft(text: string, channelId: string, media?: MediaAsset): Promise<{ id: string; status: string }>;
}

export interface DecideDeps {
  buffer: BufferLike;
  mirror: AuditMirrorConfig;
  /** ISO-8601 timestamp for the audit record (injected for determinism). */
  now: string;
  fetchImpl?: typeof fetch;
}

/** An approve/reject decision the server deferred to us. */
export interface DecisionInput {
  decision: "approve" | "reject";
  suggestionId: string;
  actor: string;
  message: unknown;
}

/** A revise-modal submission the server deferred to us. */
export interface ReviseInput {
  suggestionId: string;
  actor: string;
  targets: Platform[];
  /** Approver-authored final text (hashtags included as typed). */
  text: string;
  message: unknown;
}

/** Map each requested platform to its Buffer channel id (skips the unmatched). */
function resolveChannels(
  channels: BufferChannel[],
  targets: Platform[],
): Array<{ platform: Platform; channelId: string }> {
  const out: Array<{ platform: Platform; channelId: string }> = [];
  for (const platform of targets) {
    const ch = channels.find((c) => c.service.toLowerCase() === platform);
    if (ch) out.push({ platform, channelId: ch.id });
  }
  return out;
}

/** One platform's draft attempt (either an id on success or a short reason). */
interface DraftResult {
  successes: Array<{ platform: Platform; id: string }>;
  failures: Array<{ platform: Platform; reason: string }>;
}

/** Trim a thrown error to one compact, human-readable line for the card/audit. */
function shortReason(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  // Buffer surfaces multi-line business errors (e.g. IG media/type requirements)
  // and rate-limit dumps — keep the first line and cap it so cards stay tidy.
  return msg.split("\n")[0].trim().slice(0, 180);
}

/**
 * Draft each resolved channel independently: a per-platform failure (e.g. Buffer
 * rejecting a text-only Instagram draft for missing media, or a 429 rate limit)
 * is recorded and skipped — it never aborts the other platforms. This keeps one
 * bad target from leaving a partial draft with no audit line (GOL-714).
 *
 * `media` (GOL-718) is attached to the Instagram draft only, and only when the
 * suggestion carries it. Without media, Instagram is drafted exactly as before
 * (Buffer rejects the media-less IG draft → recorded as a skipped-but-audited
 * target). Threads is never given media.
 */
async function draftEach(
  resolved: Array<{ platform: Platform; channelId: string }>,
  textFor: (platform: Platform) => string,
  buffer: BufferLike,
  media?: MediaAsset,
): Promise<DraftResult> {
  const successes: DraftResult["successes"] = [];
  const failures: DraftResult["failures"] = [];
  for (const { platform, channelId } of resolved) {
    try {
      const mediaFor = platform === "instagram" ? media : undefined;
      const draft = await buffer.createDraft(textFor(platform), channelId, mediaFor);
      successes.push({ platform, id: draft.id });
    } catch (err) {
      failures.push({ platform, reason: shortReason(err) });
    }
  }
  return { successes, failures };
}

/** Human-readable card footer summarising what drafted and what didn't. */
function outcomeDetail(prefix: string, result: DraftResult): string {
  const parts: string[] = [];
  if (result.successes.length) {
    parts.push(
      `${result.successes.length} Buffer draft(s) on ${result.successes
        .map((s) => s.platform)
        .join(", ")} (draft-only)`,
    );
  }
  if (result.failures.length) {
    parts.push(
      `skipped ${result.failures.map((f) => `${f.platform} (${f.reason})`).join("; ")}`,
    );
  }
  if (!parts.length) return `${prefix}no matching Buffer channels — no drafts created.`;
  return `${prefix}${parts.join(" — ")}.`;
}

async function finish(
  event: AuditEvent,
  card: DiscordMessage,
  deps: DecideDeps,
): Promise<{ card: DiscordMessage; event: AuditEvent }> {
  emitAuditEvent(event);
  await mirrorAuditEvent(event, deps.mirror, deps.fetchImpl);
  return { card, event };
}

/** Approve (draft per-platform composition) or Reject (no drafts). */
export async function executeDecision(
  input: DecisionInput,
  deps: DecideDeps,
): Promise<{ card: DiscordMessage; event: AuditEvent }> {
  if (input.decision === "reject") {
    const event = buildAuditEvent({
      action: "content_rejected",
      actor: input.actor,
      ts: deps.now,
      suggestion_id: input.suggestionId,
    });
    const card = decisionCard(input.message, "reject", input.actor, "No drafts created.");
    return finish(event, card, deps);
  }

  const { body, pool, targets, media } = parseCardContext(input.message);
  const resolved = resolveChannels(await deps.buffer.listChannels(), targets);
  const result = await draftEach(
    resolved,
    (platform) => composePost(body, pool, platform),
    deps.buffer,
    media,
  );

  const event = buildAuditEvent({
    action: "content_approved" as AuditAction,
    actor: input.actor,
    ts: deps.now,
    suggestion_id: input.suggestionId,
    platforms: result.successes.map((s) => s.platform),
    buffer_draft_ids: result.successes.map((s) => s.id),
    failed_platforms: result.failures.map((f) => f.platform),
  });
  const card = decisionCard(input.message, "approve", input.actor, outcomeDetail("", result));
  return finish(event, card, deps);
}

/** Revise: draft the approver's edited text verbatim to every target channel. */
export async function executeRevise(
  input: ReviseInput,
  deps: DecideDeps,
): Promise<{ card: DiscordMessage; event: AuditEvent }> {
  const resolved = resolveChannels(await deps.buffer.listChannels(), input.targets);
  // Media rides the original card, not the revise modal — recover it so an IG
  // revise still carries the asset (else it would skip even with media present).
  const { media } = parseCardContext(input.message);
  const result = await draftEach(resolved, () => input.text, deps.buffer, media);

  const event = buildAuditEvent({
    action: "content_revised",
    actor: input.actor,
    ts: deps.now,
    suggestion_id: input.suggestionId,
    platforms: result.successes.map((s) => s.platform),
    buffer_draft_ids: result.successes.map((s) => s.id),
    failed_platforms: result.failures.map((f) => f.platform),
  });
  const card = decisionCard(input.message, "revise", input.actor, outcomeDetail("Revised — ", result));
  return finish(event, card, deps);
}
