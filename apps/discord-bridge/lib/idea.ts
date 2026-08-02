/**
 * Phase 3 `/idea` content-intake from Macy (GOL-471 / GOL-234).
 *
 * Flow: Macy runs `/idea` → the command opens a modal → on submit the bridge
 * files the idea into Paperclip as a comment on the CMO intake issue (which
 * CMO-Sora owns, so the comment wakes her). Sora enriches + sources it and
 * posts back an approvable `content_suggestion` card carrying the SAME
 * `idea_id`, which re-enters the Phase-2 approval loop (see `approval.ts` /
 * `decide.ts`). The `idea_id` is the thread that links intake → suggestion →
 * audit trail end to end.
 *
 * This module is the pure/testable core: modal build, id mint, modal parse, and
 * the intake-comment render + POST. Unlike the best-effort audit mirror
 * (`audit.ts`), filing the idea IS the whole point of `/idea`, so
 * {@link fileIdeaIntake} reports success/failure back to the server, which
 * surfaces it to Macy — a dropped idea must never look filed.
 */

/** Slash-command + modal names / input ids (load-bearing: parsed back by id). */
export const IDEA_COMMAND_NAME = "idea";
export const IDEA_MODAL_ID = "idea:submit";
export const IDEA_HEADLINE_ID = "idea_headline";
export const IDEA_BODY_ID = "idea_body";
export const IDEA_LINKS_ID = "idea_links";

/** A submitted idea, ready to file for Sora. */
export interface IdeaSubmission {
  /** Stable id threaded intake → suggestion → audit, e.g. "idea_20260802_pawpaw-guild". */
  ideaId: string;
  headline: string;
  body: string;
  /** Optional sources / reference links (free text). */
  links?: string;
  /** Discord user id of the submitter (Macy). */
  actor: string;
  /** ISO-8601 submission timestamp. */
  ts: string;
}

/** The fields recovered from an `/idea` modal submission. */
export interface IdeaModalFields {
  headline: string;
  body: string;
  links?: string;
}

/**
 * Mint a stable idea id: `idea_<YYYYMMDD>_<headline-slug>`. Deterministic from
 * the timestamp + headline (mirrors the `cs_20260722_pawpaw` suggestion ids), so
 * a human reading the audit trail can tie the pieces together. The slug is
 * derived from the headline; a blank headline falls back to a timestamp suffix.
 */
export function newIdeaId(ts: string, headline: string): string {
  const day = ts.replace(/[^0-9]/g, "").slice(0, 8); // YYYYMMDD
  const slug = headline
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const time = ts.replace(/[^0-9]/g, "").slice(8, 14); // HHMMSS fallback for uniqueness
  return `idea_${day}_${slug || time}`;
}

/**
 * Build the `/idea` modal (Discord MODAL response `data`). Three text inputs:
 * a short headline (required), the idea itself (required paragraph), and
 * optional sources/links. Lengths stay within Discord's per-input caps.
 */
export function buildIdeaModal(): {
  custom_id: string;
  title: string;
  components: Array<{ type: 1; components: unknown[] }>;
} {
  return {
    custom_id: IDEA_MODAL_ID,
    title: "Submit a content idea",
    components: [
      {
        type: 1,
        components: [
          {
            type: 4, // TEXT_INPUT
            custom_id: IDEA_HEADLINE_ID,
            style: 1, // SHORT
            label: "Headline / working title",
            placeholder: "e.g. Why we interplant pawpaw with the chestnut guild",
            required: true,
            max_length: 100,
          },
        ],
      },
      {
        type: 1,
        components: [
          {
            type: 4,
            custom_id: IDEA_BODY_ID,
            style: 2, // PARAGRAPH
            label: "The idea — what should we post about?",
            placeholder: "The angle, the story, who it's for. Sora will enrich + source it.",
            required: true,
            max_length: 2000,
          },
        ],
      },
      {
        type: 1,
        components: [
          {
            type: 4,
            custom_id: IDEA_LINKS_ID,
            style: 2, // PARAGRAPH
            label: "Sources / links (optional)",
            placeholder: "Photos, articles, prior posts, species pages…",
            required: false,
            max_length: 1000,
          },
        ],
      },
    ],
  };
}

/**
 * Read the three `/idea` inputs back off a modal-submit payload. Robust to
 * Discord's row ordering. Trims values; a missing/blank optional `links` decodes
 * to undefined. Returns null when the two required fields are absent — the
 * caller surfaces that as an ephemeral error rather than filing an empty idea.
 */
export function parseIdeaModal(components: unknown): IdeaModalFields | null {
  const byId = new Map<string, string>();
  const rows = Array.isArray(components) ? components : [];
  for (const row of rows) {
    const comps = (row as { components?: Array<{ custom_id?: string; value?: string }> }).components ?? [];
    for (const c of comps) {
      if (typeof c.custom_id === "string") byId.set(c.custom_id, (c.value ?? "").trim());
    }
  }
  const headline = byId.get(IDEA_HEADLINE_ID) ?? "";
  const body = byId.get(IDEA_BODY_ID) ?? "";
  const links = byId.get(IDEA_LINKS_ID) ?? "";
  if (!headline || !body) return null;
  return { headline, body, links: links || undefined };
}

/**
 * Render the intake comment posted to the CMO issue. Addressed to Sora with a
 * clear hand-off: enrich + source, then post a `content_suggestion` with this
 * exact `idea_id` back to #cmo-approvals so it re-enters the Phase-2 loop.
 */
export function renderIdeaIntake(sub: IdeaSubmission): string {
  const lines = [
    `💡 **New content idea** — \`${sub.ideaId}\``,
    `**${sub.headline}**`,
    "",
    sub.body,
  ];
  if (sub.links) {
    lines.push("", `**Sources / links:** ${sub.links}`);
  }
  lines.push(
    "",
    `_Submitted by <@${sub.actor}> · ${sub.ts}_`,
    "",
    `**CMO - Sora:** enrich + source this, then post a \`content_suggestion\` with ` +
      `\`id: "${sub.ideaId}"\` back to #cmo-approvals (the \`suggest\` CLI) so it enters ` +
      `the approval loop.`,
  );
  return lines.join("\n");
}

/** Config for filing the idea into Paperclip. */
export interface IdeaIntakeConfig {
  /** Scoped Paperclip bridge service key (GOL-592). */
  bridgeKey?: string;
  /** The CMO intake issue Sora owns; the idea comment wakes her. */
  intakeIssueId?: string;
  /** Paperclip API base, e.g. http://localhost:3100. */
  apiBase?: string;
}

/** Outcome of an intake attempt (surfaced to Macy by the server). */
export interface IdeaIntakeResult {
  /** True only when Paperclip accepted the comment. */
  ok: boolean;
  /** True when we didn't even try because the intake path is not configured. */
  skipped: boolean;
  /** Short reason on failure (for logs / the ephemeral reply). */
  reason?: string;
}

/**
 * File the idea into Paperclip as a comment on the CMO intake issue, using the
 * scoped bridge key (same auth/shape as the audit mirror). Returns a structured
 * result — the caller MUST tell the submitter when this fails, since the comment
 * is the only durable capture of the idea.
 */
export async function fileIdeaIntake(
  sub: IdeaSubmission,
  cfg: IdeaIntakeConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<IdeaIntakeResult> {
  if (!cfg.bridgeKey || !cfg.intakeIssueId || !cfg.apiBase) {
    return { ok: false, skipped: true, reason: "intake not configured" };
  }
  try {
    const res = await fetchImpl(
      `${cfg.apiBase.replace(/\/$/, "")}/api/issues/${cfg.intakeIssueId}/comments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.bridgeKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body: renderIdeaIntake(sub) }),
      },
    );
    if (!res.ok) return { ok: false, skipped: false, reason: `HTTP ${res.status}` };
    return { ok: true, skipped: false };
  } catch (err) {
    return { ok: false, skipped: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
