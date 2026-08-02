/**
 * Environment/config resolution for the Discord bridge.
 *
 * Secrets are provisioned by Josh into 1Password `Grove Infra` (tracked in
 * GOL-263) and injected as env vars at run time. Nothing is committed. The
 * 1P item key → env var mapping is documented in `.env.example`.
 */

import { parseApproverIds } from "./allowlist.ts";

/** Buffer organization id (Goldberry Grove). Stable, not a secret. */
export const BUFFER_ORG_ID_DEFAULT = "5a3295c5a73330590e63e1bb";

/** Buffer GraphQL endpoint (verified live 2026-07-11 — not graph.buffer.com). */
export const BUFFER_GRAPHQL_URL = "https://api.buffer.com/";

/** Discord API base. */
export const DISCORD_API_BASE = "https://discord.com/api/v10";

export interface BridgeConfig {
  bufferToken: string;
  bufferOrgId: string;
  discordBotToken: string;
  discordAppId: string;
  discordPublicKey: string;
  /** Channel the weekly digest is auto-posted to (#cmo-approvals — GOL-262). */
  weeklyInsightsChannelId: string;
  /**
   * Channel Phase 2 approval cards are posted to. Per GOL-262 this is the same
   * #cmo-approvals channel as the digest; kept as its own var so the two can be
   * split later without a code change. Defaults to {@link weeklyInsightsChannelId}.
   */
  approvalsChannelId: string;
  /** Discord user ids allowed to Approve/Revise/Reject (Macy always included). */
  approverIds: Set<string>;
  /** Scoped Paperclip bridge service key for the `evt_` audit mirror (GOL-592). */
  bridgeKey?: string;
  /** Issue the `evt_` audit records are mirrored onto. */
  auditIssueId?: string;
  /**
   * CMO intake issue the Phase-3 `/idea` command files onto (GOL-471). Owned by
   * CMO-Sora so the intake comment wakes her. When unset, `/idea` tells the
   * submitter it couldn't file (rather than silently dropping the idea).
   */
  ideaIntakeIssueId?: string;
  /** Paperclip API base for the audit mirror (e.g. http://localhost:3100). */
  paperclipApiBase?: string;
}

class MissingEnvError extends Error {
  constructor(names: string[]) {
    super(
      `discord-bridge: missing required env var(s): ${names.join(", ")}. ` +
        `See apps/discord-bridge/.env.example (provisioned via GOL-263 → 1P Grove Infra).`,
    );
    this.name = "MissingEnvError";
  }
}

function req(env: NodeJS.ProcessEnv, name: string, missing: string[]): string {
  const v = env[name];
  if (!v || v.trim() === "") {
    missing.push(name);
    return "";
  }
  return v.trim();
}

/**
 * Resolve full config for jobs that talk to both Buffer and Discord
 * (the scheduled digest, the interactions server). Throws listing every
 * missing var so operators fix them in one pass.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): BridgeConfig {
  const missing: string[] = [];
  const cfg: BridgeConfig = {
    bufferToken: req(env, "BUFFER_API_TOKEN", missing),
    bufferOrgId: (env.BUFFER_ORG_ID?.trim() || BUFFER_ORG_ID_DEFAULT),
    discordBotToken: req(env, "DISCORD_BOT_TOKEN", missing),
    discordAppId: req(env, "DISCORD_APP_ID", missing),
    discordPublicKey: req(env, "DISCORD_PUBLIC_KEY", missing),
    weeklyInsightsChannelId: req(env, "DISCORD_WEEKLY_INSIGHTS_CHANNEL_ID", missing),
    // Phase 2 (GOL-470). Optional/defaulted so the digest keeps loading without them.
    approvalsChannelId: "", // resolved below (defaults to the weekly channel)
    approverIds: parseApproverIds(env.DISCORD_APPROVER_IDS),
    bridgeKey: env.PAPERCLIP_BRIDGE_KEY?.trim() || undefined,
    auditIssueId: env.PAPERCLIP_AUDIT_ISSUE_ID?.trim() || undefined,
    ideaIntakeIssueId: env.PAPERCLIP_IDEA_INTAKE_ISSUE_ID?.trim() || undefined,
    paperclipApiBase: env.PAPERCLIP_API_BASE?.trim() || undefined,
  };
  cfg.approvalsChannelId = env.DISCORD_APPROVALS_CHANNEL_ID?.trim() || cfg.weeklyInsightsChannelId;
  if (missing.length) throw new MissingEnvError(missing);
  return cfg;
}

/**
 * Resolve just the Discord app credentials needed to register slash commands.
 * Command registration is a one-shot REST call that only needs the bot token
 * and app id (see `registerGlobalCommands`) — it never touches Buffer or the
 * Ed25519 public key. Requiring the full config here would force operators to
 * inject three unrelated secrets just to run `register-commands` (the GOL-473
 * handback command documents only `discord_bot_token` + `discord_app_id`).
 */
export function loadRegisterConfig(env: NodeJS.ProcessEnv = process.env): {
  discordBotToken: string;
  discordAppId: string;
} {
  const missing: string[] = [];
  const cfg = {
    discordBotToken: req(env, "DISCORD_BOT_TOKEN", missing),
    discordAppId: req(env, "DISCORD_APP_ID", missing),
  };
  if (missing.length) throw new MissingEnvError(missing);
  return cfg;
}

/**
 * Resolve just the Buffer credentials — used by the `/insights` read path and
 * tests that never touch Discord. Keeps the read-only insights token isolated
 * from the (future, Phase 2) write-scoped token.
 */
export function loadBufferConfig(env: NodeJS.ProcessEnv = process.env): {
  bufferToken: string;
  bufferOrgId: string;
} {
  const missing: string[] = [];
  const bufferToken = req(env, "BUFFER_API_TOKEN", missing);
  if (missing.length) throw new MissingEnvError(missing);
  return { bufferToken, bufferOrgId: env.BUFFER_ORG_ID?.trim() || BUFFER_ORG_ID_DEFAULT };
}
