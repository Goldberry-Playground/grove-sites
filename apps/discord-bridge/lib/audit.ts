/**
 * Audit trail (GOL-233 §5b). Every digest pull / Phase 2 approve-revise-reject
 * writes an immutable `evt_` record. Phase 1 emitted `digest_pull`; Phase 2
 * (GOL-470) adds the content decisions and mirrors each `evt_` to Paperclip via
 * the scoped bridge key (GOL-592). The structured-stdout sink is always written
 * (captured in droplet logs); the Paperclip mirror is best-effort and degrades
 * to a no-op when the bridge key / audit issue are not yet configured.
 */

export type AuditAction =
  | "digest_pull"
  | "digest_scheduled"
  | "content_approved"
  | "content_revised"
  | "content_rejected"
  | "idea_submitted"
  // Phase 2 order-ops (GOL-1980).
  | "order_shipped"
  | "order_ship_failed";

export interface AuditEventInput {
  action: AuditAction;
  /** Discord user id, or "scheduler" for the cron-driven weekly digest. */
  actor: string;
  ts: string;
  period?: string;
  discord_message_link?: string;
  reason?: string;
  /** Phase 2: the content-suggestion id the decision applies to. */
  suggestion_id?: string;
  /** Phase 3 (GOL-471): the `/idea` intake id filed for Sora. */
  idea_id?: string;
  /** Phase 2 order-ops (GOL-1980): the Odoo sale.order id the action applies to. */
  order_id?: string;
  /** Phase 2: platforms drafted to (approve/revise). */
  platforms?: string[];
  /** Phase 2: Buffer draft ids created (approve/revise). */
  buffer_draft_ids?: string[];
  /** Phase 2: platforms whose draft was skipped on a per-platform failure (GOL-714). */
  failed_platforms?: string[];
}

export interface AuditEvent extends AuditEventInput {
  event_id: string;
  publish_mode: "draft_only";
}

/** Build an immutable audit record. `publish_mode` is pinned to draft_only. */
export function buildAuditEvent(input: AuditEventInput): AuditEvent {
  const stamp = input.ts.replace(/[^0-9]/g, "").slice(0, 14);
  return {
    event_id: `evt_${stamp}_${input.action}`,
    publish_mode: "draft_only",
    ...input,
  };
}

/** Emit an audit event to the structured-log sink. Always called. */
export function emitAuditEvent(event: AuditEvent): void {
  // eslint-disable-next-line no-console
  console.log(`AUDIT ${JSON.stringify(event)}`);
}

/** Config for the Paperclip `evt_` mirror (all optional — mirror is best-effort). */
export interface AuditMirrorConfig {
  /** Scoped Paperclip bridge service key (GOL-592). */
  bridgeKey?: string;
  /** Issue the `evt_` records are mirrored onto (a CMO audit issue). */
  auditIssueId?: string;
  /** Paperclip API base, e.g. http://localhost:3100. */
  apiBase?: string;
}

/** Render an audit event as a compact Markdown comment body for Paperclip. */
export function renderMirrorComment(event: AuditEvent): string {
  const parts = [
    `**\`${event.event_id}\`** — ${event.action} by <@${event.actor}> (${event.publish_mode})`,
  ];
  if (event.idea_id) parts.push(`idea: \`${event.idea_id}\``);
  if (event.order_id) parts.push(`order: \`${event.order_id}\``);
  if (event.suggestion_id) parts.push(`suggestion: \`${event.suggestion_id}\``);
  if (event.platforms?.length) parts.push(`platforms: ${event.platforms.join(", ")}`);
  if (event.buffer_draft_ids?.length) parts.push(`buffer drafts: ${event.buffer_draft_ids.join(", ")}`);
  if (event.failed_platforms?.length) parts.push(`skipped: ${event.failed_platforms.join(", ")}`);
  if (event.reason) parts.push(`reason: ${event.reason}`);
  if (event.discord_message_link) parts.push(event.discord_message_link);
  return parts.join(" · ");
}

/**
 * Best-effort mirror of an `evt_` record to Paperclip as a scoped comment.
 * Returns true when posted, false when skipped (unconfigured) or on error —
 * a failed mirror must never break the approval flow (the stdout sink is the
 * durable record of record).
 */
export async function mirrorAuditEvent(
  event: AuditEvent,
  cfg: AuditMirrorConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!cfg.bridgeKey || !cfg.auditIssueId || !cfg.apiBase) return false;
  try {
    const res = await fetchImpl(
      `${cfg.apiBase.replace(/\/$/, "")}/api/issues/${cfg.auditIssueId}/comments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.bridgeKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body: renderMirrorComment(event) }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}
