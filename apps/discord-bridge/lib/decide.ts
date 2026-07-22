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
import { decisionCard, parseCardContext, type Platform } from "./approval.ts";
import { composePost } from "./hashtags.ts";
import type { DiscordMessage } from "./render.ts";
import type { BufferChannel } from "./types.ts";

/** The minimal Buffer surface the decision flow needs (mockable in tests). */
export interface BufferLike {
  listChannels(): Promise<BufferChannel[]>;
  createDraft(text: string, channelId: string): Promise<{ id: string; status: string }>;
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

  const { body, pool, targets } = parseCardContext(input.message);
  const resolved = resolveChannels(await deps.buffer.listChannels(), targets);

  const draftIds: string[] = [];
  const donePlatforms: Platform[] = [];
  for (const { platform, channelId } of resolved) {
    const text = composePost(body, pool, platform);
    const draft = await deps.buffer.createDraft(text, channelId);
    draftIds.push(draft.id);
    donePlatforms.push(platform);
  }

  const event = buildAuditEvent({
    action: "content_approved" as AuditAction,
    actor: input.actor,
    ts: deps.now,
    suggestion_id: input.suggestionId,
    platforms: donePlatforms,
    buffer_draft_ids: draftIds,
  });
  const detail = draftIds.length
    ? `${draftIds.length} Buffer draft(s) on ${donePlatforms.join(", ")} (draft-only).`
    : "No matching Buffer channels — no drafts created.";
  const card = decisionCard(input.message, "approve", input.actor, detail);
  return finish(event, card, deps);
}

/** Revise: draft the approver's edited text verbatim to every target channel. */
export async function executeRevise(
  input: ReviseInput,
  deps: DecideDeps,
): Promise<{ card: DiscordMessage; event: AuditEvent }> {
  const resolved = resolveChannels(await deps.buffer.listChannels(), input.targets);

  const draftIds: string[] = [];
  const donePlatforms: Platform[] = [];
  for (const { platform, channelId } of resolved) {
    const draft = await deps.buffer.createDraft(input.text, channelId);
    draftIds.push(draft.id);
    donePlatforms.push(platform);
  }

  const event = buildAuditEvent({
    action: "content_revised",
    actor: input.actor,
    ts: deps.now,
    suggestion_id: input.suggestionId,
    platforms: donePlatforms,
    buffer_draft_ids: draftIds,
  });
  const detail = draftIds.length
    ? `Revised — ${draftIds.length} Buffer draft(s) on ${donePlatforms.join(", ")} (draft-only).`
    : "Revised — no matching Buffer channels, no drafts created.";
  const card = decisionCard(input.message, "revise", input.actor, detail);
  return finish(event, card, deps);
}
