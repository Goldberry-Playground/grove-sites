/**
 * HTTP Interactions endpoint for the Discord bridge (Phase 1).
 *
 * Discord POSTs every interaction here; we Ed25519-verify, then route. The
 * `/insights` command (and its period buttons) defers, then edits the original
 * message with the freshly-pulled Buffer digest. Also lays the groundwork for
 * Phase 2 buttons/modals. No always-on socket / privileged intents — a plain
 * node:http server, deployable as a small droplet service behind the registered
 * Interactions URL.
 *
 * Run: `pnpm --filter @grove/discord-bridge start`
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { BufferClient } from "./lib/buffer.ts";
import { loadConfig } from "./lib/config.ts";
import { generateDigest } from "./lib/insights.ts";
import {
  createInteractionFollowup,
  editChannelMessage,
  editInteractionOriginal,
  getChannelMessage,
  postChannelMessage,
} from "./lib/discord.ts";
import { routeInteraction, type DiscordInteraction } from "./lib/interactions.ts";
import { renderDigestMessage, type DiscordMessage } from "./lib/render.ts";
import { verifyDiscordRequest, ed25519PublicKey } from "./lib/verify.ts";
import { buildAuditEvent, emitAuditEvent, mirrorAuditEvent } from "./lib/audit.ts";
import { executeDecision, executeRevise, type DecideDeps } from "./lib/decide.ts";
import { fileIdeaIntake, newIdeaId, type IdeaSubmission } from "./lib/idea.ts";
import {
  buildNotice,
  buildOrderRequest,
  orderSecretMatches,
  markAllOutcome,
  orderActionOutcome,
  resolveOrderChannel,
} from "./lib/orders.ts";
import { markBatchShipped, orderAction } from "./lib/order-client.ts";
import { orderAlertRoute, orderCardEditRoute, type OrderRouteDeps } from "./lib/order-routes.ts";

const PORT = Number(process.env.PORT ?? 8787);
const BUFFER_ANALYTICS_URL = process.env.BUFFER_ANALYTICS_URL || "https://publish.buffer.com";

const cfg = loadConfig();
const publicKey = ed25519PublicKey(cfg.discordPublicKey);
const buffer = new BufferClient(cfg.bufferToken, cfg.bufferOrgId);

function readRawBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/** Grove green (matches the digest / approval cards). */
const GROVE_GREEN = 0x3f7d4e;
const AMBER = 0xd9822b;

/** Ephemeral confirmation shown to the submitter after `/idea` files (or fails). */
function ideaReplyCard(ok: boolean, ideaId: string, reason?: string): DiscordMessage {
  const embed = ok
    ? {
        title: "💡 Idea filed for CMO - Sora",
        description: `Sora will enrich + source it and post an approval card back to #cmo-approvals.`,
        color: GROVE_GREEN,
        footer: { text: `id:${ideaId}` },
      }
    : {
        title: "⚠️ Couldn't file your idea",
        description:
          "Your idea wasn't captured. Please re-run `/idea` shortly, or ping Josh if it keeps failing." +
          (reason ? `\n\n_(${reason})_` : ""),
        color: AMBER,
        footer: { text: `id:${ideaId}` },
      };
  return { embeds: [embed], components: [] };
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(payload);
}

/**
 * Show the outcome of an action that came through an ephemeral confirm: edit the
 * public card or notice by id (the click arrived on the prompt, not on it), then
 * replace the prompt with the note. A failed public edit must not hide the note.
 */
async function showConfirmedOutcome(
  token: string | undefined,
  channelId: string | undefined,
  messageId: string | undefined,
  outcome: { edit?: DiscordMessage; notice?: string },
): Promise<void> {
  if (outcome.edit && channelId && messageId) {
    try {
      await editChannelMessage(cfg.discordBotToken, channelId, messageId, outcome.edit);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("discord-bridge: confirmed outcome edit failed:", err);
    }
  }
  if (token) {
    await editInteractionOriginal(cfg.discordAppId, token, {
      content: outcome.notice ?? "Done. The message above is updated.",
      components: [],
    });
  }
}

async function handleInteractions(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const raw = await readRawBody(req);
  const sig = req.headers["x-signature-ed25519"] as string | undefined;
  const ts = req.headers["x-signature-timestamp"] as string | undefined;

  if (!verifyDiscordRequest(publicKey, sig, ts, raw)) {
    json(res, 401, { error: "invalid request signature" });
    return;
  }

  let interaction: DiscordInteraction;
  try {
    interaction = JSON.parse(raw) as DiscordInteraction;
  } catch {
    json(res, 400, { error: "invalid JSON" });
    return;
  }

  const result = routeInteraction(interaction, {
    approverIds: cfg.approverIds,
    operatorIds: cfg.orderOperatorIds,
  });
  // Reply immediately (PONG / deferred / modal / ephemeral error) — Discord's 3s budget.
  json(res, 200, result.response);

  if (!result.followup) return;

  // Deferred work: edit the original message once the (Buffer/audit) side
  // effects complete. Fire-and-forget; errors are logged, not surfaced to the
  // (already-answered) request.
  const followup = result.followup;
  const token = (interaction as { token?: string }).token;
  const actor =
    (interaction as { member?: { user?: { id?: string } }; user?: { id?: string } }).member?.user
      ?.id ??
    (interaction as { user?: { id?: string } }).user?.id ??
    "unknown";

  void (async () => {
    try {
      if (followup.kind === "digest") {
        const digest = await generateDigest(buffer, followup.period);
        const message = renderDigestMessage(digest, followup.period, BUFFER_ANALYTICS_URL);
        if (token) await editInteractionOriginal(cfg.discordAppId, token, message);
        emitAuditEvent(
          buildAuditEvent({
            action: "digest_pull",
            actor,
            ts: new Date().toISOString(),
            period: followup.period,
          }),
        );
        return;
      }

      if (followup.kind === "idea_submit") {
        const now = new Date().toISOString();
        const submission: IdeaSubmission = {
          ideaId: newIdeaId(now, followup.headline),
          headline: followup.headline,
          body: followup.body,
          links: followup.links,
          actor: followup.actor,
          ts: now,
        };
        const result = await fileIdeaIntake(submission, {
          bridgeKey: cfg.bridgeKey,
          intakeIssueId: cfg.ideaIntakeIssueId,
          apiBase: cfg.paperclipApiBase,
        });
        // Audit trail (GOL-233 §5b): record the intake regardless of the mirror
        // result; the stdout sink is the record of record, the CMO-issue comment
        // is the actionable hand-off to Sora.
        const event = buildAuditEvent({
          action: "idea_submitted",
          actor: submission.actor,
          ts: now,
          idea_id: submission.ideaId,
          reason: result.ok ? undefined : result.reason,
        });
        emitAuditEvent(event);
        void mirrorAuditEvent(event, {
          bridgeKey: cfg.bridgeKey,
          auditIssueId: cfg.auditIssueId,
          apiBase: cfg.paperclipApiBase,
        });
        if (token) {
          await editInteractionOriginal(cfg.discordAppId, token, ideaReplyCard(result.ok, submission.ideaId, result.reason));
        }
        return;
      }

      if (followup.kind === "mark_all") {
        const res = await markBatchShipped(
          { odooApiBase: cfg.odooApiBase ?? "", odooBridgeKey: cfg.odooBridgeKey ?? "" },
          followup.batchId,
          followup.actor,
        );
        // The click came from the ephemeral confirm, so read the public notice to
        // rewrite it. If that fails, markAllOutcome gives the counts as the note.
        const { noticeMessageId, channelId } = followup;
        const notice =
          noticeMessageId && channelId
            ? await getChannelMessage(cfg.discordBotToken, channelId, noticeMessageId).catch((err) => {
                // eslint-disable-next-line no-console
                console.error("discord-bridge: could not read the Mark all notice:", err);
                return undefined;
              })
            : undefined;
        // Success edits the notice; a refusal or failure leaves it (and its button) as it was.
        await showConfirmedOutcome(token, channelId, noticeMessageId, markAllOutcome(res, followup.actor, notice));
        const event = buildAuditEvent({
          action: res.ok ? "order_batch_shipped" : "order_batch_ship_failed",
          actor: followup.operatorId,
          ts: new Date().toISOString(),
          batch_id: followup.batchId,
          reason: res.ok ? `${res.shipped} shipped, ${res.already} already, ${res.skipped?.length ?? 0} skipped` : res.error,
        });
        emitAuditEvent(event);
        void mirrorAuditEvent(event, {
          bridgeKey: cfg.bridgeKey,
          auditIssueId: cfg.auditIssueId,
          apiBase: cfg.paperclipApiBase,
        });
        return;
      }

      if (followup.kind === "order_action") {
        const request = buildOrderRequest(followup.action, followup.inputs, followup.actor);
        if (!request) return; // markall has its own followup; this is only the order routes
        const now = new Date().toISOString();
        const res = await orderAction(
          { odooApiBase: cfg.odooApiBase ?? "", odooBridgeKey: cfg.odooBridgeKey ?? "" },
          followup.orderId,
          request.path,
          request.body,
        );
        const outcome = orderActionOutcome(res, followup.action, followup.actor, followup.message);
        if (followup.confirmed) {
          await showConfirmedOutcome(token, followup.channelId, followup.cardMessageId, outcome);
        } else if (token) {
          // Success edits the card; a failure or plain confirmation is an ephemeral
          // followup, and a failure leaves the card untouched.
          if (outcome.edit) await editInteractionOriginal(cfg.discordAppId, token, outcome.edit);
          if (outcome.notice) await createInteractionFollowup(cfg.discordAppId, token, outcome.notice);
        }
        if (followup.action === "shipped") {
          const mirror = {
            bridgeKey: cfg.bridgeKey,
            auditIssueId: cfg.auditIssueId,
            apiBase: cfg.paperclipApiBase,
          };
          const event = buildAuditEvent({
            action: res.ok ? "order_shipped" : "order_ship_failed",
            actor: followup.operatorId,
            ts: now,
            order_id: followup.orderId,
            reason: res.ok ? (res.alreadyShipped ? "already_shipped" : undefined) : res.error,
          });
          emitAuditEvent(event);
          void mirrorAuditEvent(event, mirror);
        }
        return;
      }

      const deps: DecideDeps = {
        buffer,
        mirror: {
          bridgeKey: cfg.bridgeKey,
          auditIssueId: cfg.auditIssueId,
          apiBase: cfg.paperclipApiBase,
        },
        now: new Date().toISOString(),
      };

      const { card } =
        followup.kind === "decision"
          ? await executeDecision(followup, deps)
          : await executeRevise(followup, deps);
      if (token) await editInteractionOriginal(cfg.discordAppId, token, card);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("discord-bridge: interaction follow-up failed:", err);
    }
  })();
}

/**
 * Inbound order alert (GOL-1980 items 1 & 4). The Phase-1 new-order hook
 * (grove_headless, GOL-1933) POSTs the order here so the BRIDGE bot-posts the
 * card WITH the Mark-Shipped button to the brand's own order channel — an
 * incoming webhook (the Phase-1 default) cannot carry a custom_id button, and
 * only this app can receive the resulting click. Authenticated by a shared
 * secret; inert (503) until the secret + channel map are provisioned.
 */
async function handleOrderAlert(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const reply = await orderAlertRoute(req.headers["x-order-alert-secret"], () => readRawBody(req), orderRouteDeps);
  json(res, reply.status, reply.body);
}

/** POST /orders/alert/edit: redraw an existing order card. Same secret and channel routing as /orders/alert. */
async function handleOrderCardEdit(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const reply = await orderCardEditRoute(req.headers["x-order-alert-secret"], () => readRawBody(req), orderRouteDeps);
  json(res, reply.status, reply.body);
}

/**
 * POST /orders/notice — Odoo posts a plain notice (title, lines, `ord:` buttons)
 * to the brand's order channel. Used for the daily hold nudge. Same secret and
 * channel resolution as /orders/alert.
 */
async function handleOrderNotice(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!cfg.orderAlertSecret) {
    json(res, 503, { error: "order alerts are not configured" });
    return;
  }
  if (!orderSecretMatches(req.headers["x-order-alert-secret"], cfg.orderAlertSecret)) {
    json(res, 401, { error: "invalid alert secret" });
    return;
  }
  let body: unknown;
  try {
    body = JSON.parse(await readRawBody(req));
  } catch {
    json(res, 400, { error: "invalid JSON" });
    return;
  }
  const notice = buildNotice(body);
  if (!notice.ok) {
    json(res, 400, { error: notice.error });
    return;
  }
  const channelId = resolveOrderChannel(notice.companyId, cfg.orderChannels);
  if (!channelId) {
    json(res, 422, { error: `no order channel mapped for company_id ${notice.companyId}` });
    return;
  }
  await postChannelMessage(cfg.discordBotToken, channelId, notice.message);
  json(res, 200, { ok: true, channel_id: channelId });
}

const orderRouteDeps: OrderRouteDeps = {
  secret: cfg.orderAlertSecret,
  channels: cfg.orderChannels,
  post: (channelId, message) => postChannelMessage(cfg.discordBotToken, channelId, message),
  edit: (channelId, messageId, message) => editChannelMessage(cfg.discordBotToken, channelId, messageId, message),
};

const server = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    json(res, 200, { ok: true, service: "discord-bridge" });
    return;
  }
  if (req.method === "POST" && req.url === "/orders/alert") {
    handleOrderAlert(req, res).catch((err) => {
      // eslint-disable-next-line no-console
      console.error("discord-bridge: order alert handler error:", err);
      if (!res.headersSent) json(res, 500, { error: "internal error" });
    });
    return;
  }
  if (req.method === "POST" && req.url === "/orders/alert/edit") {
    handleOrderCardEdit(req, res).catch((err) => {
      // eslint-disable-next-line no-console
      console.error("discord-bridge: order card edit handler error:", err);
      if (!res.headersSent) json(res, 500, { error: "internal error" });
    });
    return;
  }
  if (req.method === "POST" && req.url === "/orders/notice") {
    handleOrderNotice(req, res).catch((err) => {
      // eslint-disable-next-line no-console
      console.error("discord-bridge: order notice handler error:", err);
      if (!res.headersSent) json(res, 500, { error: "internal error" });
    });
    return;
  }
  if (req.method === "POST" && req.url === "/interactions") {
    handleInteractions(req, res).catch((err) => {
      // eslint-disable-next-line no-console
      console.error("discord-bridge: interaction handler error:", err);
      if (!res.headersSent) json(res, 500, { error: "internal error" });
    });
    return;
  }
  json(res, 404, { error: "not found" });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`discord-bridge interactions server listening on :${PORT}`);
});
