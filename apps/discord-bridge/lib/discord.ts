/**
 * Thin Discord REST helpers (bot token + interaction webhooks). Uses global
 * `fetch` — no discord.js gateway dependency (Phase 1 is HTTP-interactions +
 * scheduled push only; no always-on socket needed).
 */
import { DISCORD_API_BASE } from "./config.ts";
import type { DiscordMessage } from "./render.ts";

/**
 * Percent-encode a value before it is interpolated into a Discord API URL PATH.
 *
 * Every path segment below comes from data we do not author: the interaction
 * token arrives in the webhook body, the channel id from config. Even though
 * `server.ts` Ed25519-verifies each interaction before we ever read its token,
 * an unencoded segment is a request-forgery primitive — a value containing
 * `../` or a query/fragment character re-points the request at a DIFFERENT
 * Discord API endpoint than intended (CodeQL js/request-forgery, alert 530).
 * Encoding removes the primitive at the sink, so the guarantee no longer rests
 * on upstream validation alone.
 */
function urlSegment(value: string): string {
  return encodeURIComponent(value);
}

/** A Discord API call that came back non-2xx, keeping the status for callers that care. */
export class DiscordApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "DiscordApiError";
    this.status = status;
  }
}

/** Longest a request will sit out a rate limit. Odoo's bridge calls time out at 10 to 15 seconds. */
export const MAX_RATE_LIMIT_WAIT_MS = 5_000;

/** How long Discord asked us to wait, from the JSON body, then the header, else one second. */
async function retryAfterMs(res: Response): Promise<number> {
  try {
    const body = (await res.clone().json()) as { retry_after?: unknown };
    if (typeof body.retry_after === "number" && body.retry_after >= 0) return body.retry_after * 1000;
  } catch {
    /* no JSON body; fall through to the header */
  }
  const header = Number(res.headers.get("retry-after"));
  return Number.isFinite(header) && header > 0 ? header * 1000 : 1000;
}

/**
 * Send a request, and on a 429 wait out `retry_after` (capped) and try once more.
 * A 429 means Discord did not act on the request, so repeating it is safe.
 */
async function sendRateLimited(fetchImpl: typeof fetch, url: string, init: RequestInit): Promise<Response> {
  const res = await fetchImpl(url, init);
  if (res.status !== 429) return res;
  const wait = Math.min(await retryAfterMs(res), MAX_RATE_LIMIT_WAIT_MS);
  await new Promise((resolve) => setTimeout(resolve, wait));
  return fetchImpl(url, init);
}

async function assertOk(res: Response, action: string): Promise<void> {
  if (!res.ok) {
    let body = "";
    try {
      body = (await res.text()).slice(0, 400);
    } catch {
      /* ignore */
    }
    throw new DiscordApiError(`Discord ${action} failed: HTTP ${res.status} ${body}`, res.status);
  }
}

/**
 * Post the digest (or any message) to a channel using the bot token. Resolves to
 * the new message's id, or undefined if the reply did not carry one (the post
 * still happened).
 */
export async function postChannelMessage(
  botToken: string,
  channelId: string,
  message: DiscordMessage,
  fetchImpl: typeof fetch = fetch,
): Promise<string | undefined> {
  const res = await sendRateLimited(fetchImpl, `${DISCORD_API_BASE}/channels/${urlSegment(channelId)}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });
  await assertOk(res, "postChannelMessage");
  try {
    const { id } = (await res.json()) as { id?: unknown };
    return typeof id === "string" ? id : undefined;
  } catch {
    return undefined;
  }
}

/** Edit a message the bot posted, by id. Throws `DiscordApiError` (404 when Discord no longer has it). */
export async function editChannelMessage(
  botToken: string,
  channelId: string,
  messageId: string,
  message: DiscordMessage,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const res = await sendRateLimited(
    fetchImpl,
    `${DISCORD_API_BASE}/channels/${urlSegment(channelId)}/messages/${urlSegment(messageId)}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(message),
    },
  );
  await assertOk(res, "editChannelMessage");
}

/** Read one message from a channel, for rewriting a notice from a click on another message. */
export async function getChannelMessage(
  botToken: string,
  channelId: string,
  messageId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const res = await sendRateLimited(
    fetchImpl,
    `${DISCORD_API_BASE}/channels/${urlSegment(channelId)}/messages/${urlSegment(messageId)}`,
    { method: "GET", headers: { Authorization: `Bot ${botToken}` } },
  );
  await assertOk(res, "getChannelMessage");
  return res.json();
}

/**
 * Edit the original response to a deferred interaction. The interaction token
 * authenticates the call (no bot token). Valid for 15 minutes after the
 * interaction.
 */
export async function editInteractionOriginal(
  appId: string,
  interactionToken: string,
  message: DiscordMessage | { content: string; components: [] },
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const res = await sendRateLimited(
    fetchImpl,
    `${DISCORD_API_BASE}/webhooks/${urlSegment(appId)}/${urlSegment(interactionToken)}/messages/@original`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    },
  );
  await assertOk(res, "editInteractionOriginal");
}

/**
 * Post a NEW followup message to a deferred interaction (as opposed to editing
 * the @original). With `ephemeral`, only the interacting user sees it — used to
 * surface a mark-shipped failure to the operator WITHOUT touching the public
 * order card, so the button stays clickable for a retry (GOL-1980). Valid for
 * 15 minutes after the interaction; the token authenticates the call.
 */
export async function createInteractionFollowup(
  appId: string,
  interactionToken: string,
  content: string,
  ephemeral = true,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const res = await sendRateLimited(
    fetchImpl,
    `${DISCORD_API_BASE}/webhooks/${urlSegment(appId)}/${urlSegment(interactionToken)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, ...(ephemeral ? { flags: 64 } : {}) }),
    },
  );
  await assertOk(res, "createInteractionFollowup");
}

/** The `/insights [period]` slash-command definition. */
export const INSIGHTS_COMMAND = {
  name: "insights",
  description: "Pull the Buffer social-analytics digest (Threads-led, read-only).",
  type: 1,
  options: [
    {
      name: "period",
      description: "Reporting window (default: last 7 days)",
      type: 3, // STRING
      required: false,
      choices: [
        { name: "Last 7 days", value: "last7d" },
        { name: "Last 30 days", value: "last30d" },
        { name: "Last 90 days", value: "last90d" },
      ],
    },
  ],
};

/**
 * The `/idea` slash-command definition (Phase 3, GOL-471). No options — it opens
 * a modal to collect the idea (headline + body + optional sources). Gated to the
 * CMO allowlist (Macy + Josh) in the interactions router.
 */
export const IDEA_COMMAND = {
  name: "idea",
  description: "File a content idea for the CMO (Sora enriches → approval card).",
  type: 1,
};

/** Register global application (slash) commands. Overwrites the full set. */
export async function registerGlobalCommands(
  botToken: string,
  appId: string,
  commands: unknown[],
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const res = await fetchImpl(`${DISCORD_API_BASE}/applications/${appId}/commands`, {
    method: "PUT",
    headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
  });
  await assertOk(res, "registerGlobalCommands");
}
