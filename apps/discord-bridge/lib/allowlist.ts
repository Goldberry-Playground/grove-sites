/**
 * Approver allowlist for the Phase 2 content-approval loop (GOL-470).
 *
 * Only Macy + Josh may approve/revise/reject. We authorise on the Discord user
 * id (`interaction.member.user.id` in a guild, `interaction.user.id` in a DM),
 * which is unforgeable — the payload is Ed25519-verified upstream in `verify.ts`
 * before it ever reaches routing. The id list is injected via env
 * (`DISCORD_APPROVER_IDS`, comma-separated snowflakes) so we never hardcode a
 * person; Macy's id is baked in as a sensible default.
 *
 * Pure/synchronous — no I/O.
 */

/** Macy's Discord user id (→ macykitty), confirmed live in GOL-263 / GOL-469. */
export const MACY_DISCORD_ID = "208085380262526976";

/** Parse a comma/space-separated snowflake list into a Set (Macy always included). */
export function parseApproverIds(csv: string | undefined): Set<string> {
  const ids = (csv ?? "")
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => /^\d{5,}$/.test(s));
  return new Set<string>([MACY_DISCORD_ID, ...ids]);
}

/** A Discord interaction carrying the invoking user (guild `member` or DM `user`). */
export interface ActorCarrier {
  member?: { user?: { id?: string } };
  user?: { id?: string };
}

/** Resolve the invoking Discord user id, or undefined when absent. */
export function actorId(interaction: ActorCarrier): string | undefined {
  return interaction.member?.user?.id ?? interaction.user?.id ?? undefined;
}

/** True only when the interaction's invoking user is on the allowlist. */
export function isApprover(interaction: ActorCarrier, allow: Set<string>): boolean {
  const id = actorId(interaction);
  return id !== undefined && allow.has(id);
}
