/**
 * Post a Sora `content_suggestion` card to #cmo-approvals (Phase 2, GOL-470).
 *
 * The bridge is the poster: Sora hands it a suggestion JSON, it builds the
 * Approve/Revise/Reject card and drops it in the approvals channel. Read the
 * suggestion from a file arg or from stdin:
 *   `pnpm --filter @grove/discord-bridge suggest -- ./suggestion.json`
 *   `echo '{...}' | pnpm --filter @grove/discord-bridge suggest`
 *
 * Suggestion shape (see ContentSuggestion): { id, content, targets:[...],
 * species?, places?, practices?, extraTags?, headline? }. Hashtags are composed
 * per-platform at approval time — the card only shows the pool.
 */
import { readFileSync } from "node:fs";
import { buildApprovalCard, PLATFORMS, type ContentSuggestion, type Platform } from "./lib/approval.ts";
import { loadConfig } from "./lib/config.ts";
import { postChannelMessage } from "./lib/discord.ts";

function readInput(): string {
  const fileArg = process.argv[2];
  if (fileArg) return readFileSync(fileArg, "utf8");
  return readFileSync(0, "utf8"); // stdin
}

function parseSuggestion(raw: string): ContentSuggestion {
  const obj = JSON.parse(raw) as Record<string, unknown>;
  const id = typeof obj.id === "string" && obj.id.trim() ? obj.id.trim() : undefined;
  const content = typeof obj.content === "string" ? obj.content : undefined;
  if (!id) throw new Error("content_suggestion: missing string `id`");
  if (!content) throw new Error("content_suggestion: missing string `content`");
  const targets = Array.isArray(obj.targets)
    ? (obj.targets.filter((t): t is Platform => (PLATFORMS as string[]).includes(t as string)))
    : [];
  const strList = (v: unknown): string[] | undefined =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : undefined;
  return {
    id,
    content,
    targets: targets.length ? targets : PLATFORMS,
    species: strList(obj.species),
    places: strList(obj.places),
    practices: strList(obj.practices),
    extraTags: strList(obj.extraTags),
    headline: typeof obj.headline === "string" ? obj.headline : undefined,
  };
}

async function main(): Promise<void> {
  const suggestion = parseSuggestion(readInput());
  const cfg = loadConfig();
  const card = buildApprovalCard(suggestion);
  await postChannelMessage(cfg.discordBotToken, cfg.approvalsChannelId, card);
  // eslint-disable-next-line no-console
  console.log(`discord-bridge: posted approval card for ${suggestion.id} to ${cfg.approvalsChannelId}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("discord-bridge: suggestion post failed:", err);
  process.exit(1);
});
