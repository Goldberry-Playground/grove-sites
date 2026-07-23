# @grove/discord-bridge

Discord bridge for the Grove CMO loop. **Phase 1 (GOL-262)** ships:

1. **Weekly Buffer digest** — auto-posted to `#cmo-approvals` every Monday
   08:00 ET (GitHub Actions cron → `digest-cli.ts`).
2. **`/insights [7d|30d|90d]`** slash command — the same digest on demand.
3. **HTTP Interactions endpoint** — Ed25519-verified, powers the slash command
   and lays groundwork for Phase 2 buttons/modals.

Implements the CMO payload contract frozen in
[GOL-233 §1](https://.../GOL-233) (Sora) against the architecture from
[GOL-234](https://.../GOL-234) (Alice). Board go/no-go accepted 2026-07-11.

## Phase 2 (GOL-470) — content-approval loop (draft-only)

1. **Approval cards** — `suggestion-cli.ts` posts a Sora `content_suggestion` to
   `#cmo-approvals` with **✅ Approve / ✏️ Revise / 🚫 Reject** buttons. The card
   carries the post body + the hashtag pool + target platforms, so a click works
   even after the (stateless) server restarts.
2. **Approver allowlist** — only Macy + Josh may act (`interaction.member.user.id`
   against `DISCORD_APPROVER_IDS`; Macy is baked in). Everyone else gets an
   ephemeral deny with no state change.
3. **Approve → Buffer drafts** — one **draft** (`saveToDraft:true`) per target
   platform via `createPost` on `api.buffer.com`, each with platform-appropriate
   hashtags. Never publishes. **Revise** opens a prefilled modal; the edited text
   is drafted verbatim. **Reject** creates nothing.
4. **Hashtags** — anchor `#TreeFacts` first, then species → place/practice;
   Threads leans 1–3, Instagram 4–6; `#WoodWideWeb` is banned everywhere.
5. **Audit** — every decision writes an immutable `evt_` record (draft-only) to
   stdout and best-effort mirrors it to Paperclip via the scoped bridge key.

The Buffer draft path uses the **same** `cmo_buffer_key` token as reads — it
carries draft scope on the new GraphQL API (validated in GOL-590); no separate
write token is needed.

## What it does NOT do (later phases)

- `/idea` intake → Phase 3 (GOL-471).
- Media upload / caption+schedule spike → Phase 4 (GOL-472).
- Auto-publish → off by design (`publish_mode: draft_only`), every phase.

## Design notes

- **Zero runtime dependencies.** Buffer + Discord are reached over `fetch`;
  Ed25519 verification uses Node's built-in `crypto`; the interactions server is
  `node:http`. This keeps the deploy tiny and the dependency-audit surface at
  zero.
- **Read-only.** Only the `buffer_api_token` insights token is used. The digest
  makes **zero demographic claims** (Buffer exposes none — GOL-227).
- **Threads-led.** Channels rank by engagement; Threads is ~97% of it (GOL-226).
- Source files use explicit `.ts` import extensions so the entrypoints run
  directly under Node's native type-stripping (`node --experimental-strip-types`)
  with no build step or bundler.

## Layout

```
lib/
  config.ts        env/secret resolution (+ 1P key mapping)
  period.ts        reporting-window math (current + prior window for WoW)
  metrics.ts       Buffer metric parsing (posts / impressions / engagements)
  buffer.ts        Buffer GraphQL client (read-only): channels, metrics, top post
  digest.ts        assembles the weekly_digest payload (GOL-233 §1c)
  render.ts        weekly_digest → Discord embed + period buttons
  verify.ts        Ed25519 request verification (node:crypto)
  interactions.ts  routes verified interactions (PING / /insights / approvals)
  discord.ts       Discord REST (post message, edit interaction, register cmds)
  insights.ts      orchestrator: pull Buffer → build digest
  audit.ts         immutable evt_ audit records + Paperclip mirror (GOL-233 §5b)
  hashtags.ts      Phase 2: hashtag pool + per-platform caps + ban list
  allowlist.ts     Phase 2: approver allowlist (Macy + Josh)
  approval.ts      Phase 2: card/modal builders + stateless card-context codec
  decide.ts        Phase 2: approve/revise/reject → Buffer drafts + audit
server.ts          HTTP interactions endpoint (deploy target)
digest-cli.ts      scheduled/weekly digest entrypoint (cron target)
suggestion-cli.ts  post a content_suggestion approval card (Phase 2)
register-commands.ts  one-time /insights registration
```

## Local / operational commands

```bash
# All env vars from 1P (see .env.example). Example with 1Password CLI:
export BUFFER_API_TOKEN=$(op read "op://Goldberry Grove - Admin/Grove Infra/buffer_api_token")

# One-time: register the /insights slash command with Discord. Registration is
# a pure REST call — it needs ONLY the two Discord app secrets, not Buffer /
# public-key / channel (loadRegisterConfig).
export DISCORD_BOT_TOKEN=$(op read "op://Goldberry Grove - Admin/Grove Infra/discord_bot_token")
export DISCORD_APP_ID=$(op read "op://Goldberry Grove - Admin/Grove Infra/discord_app_id")
pnpm --filter @grove/discord-bridge register-commands

# Post this week's digest now (used by the Monday cron).
pnpm --filter @grove/discord-bridge digest            # last7d
pnpm --filter @grove/discord-bridge digest -- last30d

# Run the interactions server (deploy behind the registered Interactions URL).
pnpm --filter @grove/discord-bridge start
```

## Deploy checklist (blocked on GOL-263 credential provisioning)

1. Josh creates the Discord app + bot, saves `discord_bot_token`,
   `discord_app_id` and `discord_public_key` to 1P `Grove Infra` (GOL-263).
   Per GOL-262 (Josh, 2026-07-22) the digest and the Phase 2 approval cards
   share one channel — `#cmo-approvals` (id `1527338819177938955`), where the
   bot is already a member. That id is a non-secret snowflake set inline in the
   digest workflow, so no `discord_*_channel_id` 1P field is required.
2. Deploy `server.ts` to a droplet; set the Discord **Interactions Endpoint URL**
   to `https://<host>/interactions` (Discord validates it with a PING —
   verification is already implemented).
3. Run `register-commands` once.
4. Enable the `discord-digest` GitHub Actions workflow (or a droplet cron).
5. Verify: `/insights` returns a digest; Monday cron posts to `#cmo-approvals`.
