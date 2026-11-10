/**
 * The two order-card routes Odoo calls: post a new card, and edit an existing one
 * in place (after a label import, so a spring card gains Mark shipped and Label
 * refunded). Both are authenticated with the order secret. Separated from
 * server.ts so they can be tested without a listening server: Discord is reached
 * only through the injected `post` and `edit`.
 */
import { DiscordApiError } from "./discord.ts";
import { buildOrderCard, orderSecretMatches, resolveOrderChannel, type OrderAlert } from "./orders.ts";
import type { DiscordMessage } from "./render.ts";

export interface OrderRouteDeps {
  secret: string | undefined;
  channels: Record<string, string>;
  /** Posts a new message; resolves to its id when Discord returned one. */
  post: (channelId: string, message: DiscordMessage) => Promise<string | undefined>;
  edit: (channelId: string, messageId: string, message: DiscordMessage) => Promise<void>;
}

export interface RouteReply {
  status: number;
  body: Record<string, unknown>;
}

const SNOWFLAKE = /^\d{5,}$/;

/** The shared checks: configured, right secret, parseable, has the ids, company has a channel. */
async function readAlert(
  provided: unknown,
  readBody: () => Promise<string>,
  deps: OrderRouteDeps,
): Promise<{ reply: RouteReply } | { alert: OrderAlert & { messageId?: unknown }; channelId: string }> {
  if (!deps.secret) return { reply: { status: 503, body: { error: "order alerts are not configured" } } };
  if (!orderSecretMatches(provided, deps.secret)) return { reply: { status: 401, body: { error: "invalid alert secret" } } };
  let alert: OrderAlert & { messageId?: unknown };
  try {
    alert = JSON.parse(await readBody()) as OrderAlert & { messageId?: unknown };
  } catch {
    return { reply: { status: 400, body: { error: "invalid JSON" } } };
  }
  if (alert?.orderId === undefined || !alert?.orderRef || alert?.companyId === undefined) {
    return { reply: { status: 400, body: { error: "orderId, orderRef and companyId are required" } } };
  }
  const channelId = resolveOrderChannel(alert.companyId, deps.channels);
  if (!channelId) {
    // A brand with no mapped channel is a provisioning gap, not a client error
    // we should retry: surface it clearly (422) so it's visible in Odoo logs.
    return { reply: { status: 422, body: { error: `no order channel mapped for company_id ${alert.companyId}` } } };
  }
  return { alert, channelId };
}

/** POST /orders/alert: post the card and answer with its message id, which Odoo keeps. */
export async function orderAlertRoute(
  provided: unknown,
  readBody: () => Promise<string>,
  deps: OrderRouteDeps,
): Promise<RouteReply> {
  const read = await readAlert(provided, readBody, deps);
  if ("reply" in read) return read.reply;
  const messageId = await deps.post(read.channelId, buildOrderCard(read.alert));
  return { status: 200, body: { ok: true, channel_id: read.channelId, message_id: messageId } };
}

/**
 * POST /orders/alert/edit: redraw an existing card from the current payload plus
 * `messageId`. A message Discord no longer has answers 410, which Odoo treats as
 * done (a plain 404 could just be a bridge without this route). Any other Discord
 * failure rejects, so the server answers 500 and Odoo retries.
 */
export async function orderCardEditRoute(
  provided: unknown,
  readBody: () => Promise<string>,
  deps: OrderRouteDeps,
): Promise<RouteReply> {
  const read = await readAlert(provided, readBody, deps);
  if ("reply" in read) return read.reply;
  const { messageId } = read.alert;
  if (typeof messageId !== "string" || !SNOWFLAKE.test(messageId)) {
    return { status: 400, body: { error: "messageId must be a Discord message id" } };
  }
  try {
    await deps.edit(read.channelId, messageId, buildOrderCard(read.alert));
  } catch (err) {
    if (err instanceof DiscordApiError && err.status === 404) {
      return { status: 410, body: { error: "message not found" } };
    }
    throw err;
  }
  return { status: 200, body: { ok: true } };
}
