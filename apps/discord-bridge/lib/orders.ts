/**
 * Order-ops card + the `ord:` button codec + per-brand channel routing
 * (GOL-1980, parent GOL-1975 Phase 2).
 *
 * The Phase-1 new-order alert (grove_headless, GOL-1933) posts a content-only
 * message via a plain incoming webhook. An incoming webhook CANNOT carry a
 * `custom_id` button — only a bot-token channel post can — so the interactive
 * "Mark shipped" card is bot-posted here, to the brand's own order channel
 * (per-brand map keyed on `order.company_id`). Clicking the button routes back
 * to this app's Interactions endpoint (server.ts), which is what makes the
 * signal bidirectional.
 *
 * Pure/synchronous — no I/O. The server owns the bot POST, the Odoo call, and
 * the audit side effects.
 */
import type { DiscordEmbed, DiscordMessage } from "./render.ts";

/** Grove green (embed accent) — matches the digest / approval cards. */
const GROVE_GREEN = 0x3f7d4e;

/** custom_id namespace for order-ops components (distinct from `cs:` / `insights:`). */
export const ORD_PREFIX = "ord";

/** The only order action Phase 2 ships: mark packed & shipped. */
export type OrderAction = "shipped";

/** One order line as shown on the card. */
export interface OrderLine {
  name: string;
  qty: number;
}

/** Everything the order-ops card renders, pulled off the confirmed order once. */
export interface OrderAlert {
  /** Odoo sale.order id — the endpoint path segment the button calls back to. */
  orderId: number | string;
  /** Human order reference, e.g. "S00042". */
  orderRef: string;
  /** order.company_id — routes the card to the brand's order channel. */
  companyId: number | string;
  customer?: string;
  customerEmail?: string;
  /** "ship" | "pickup" (anything else falls back to Shipping wording). */
  fulfillment?: string;
  isDeposit?: boolean;
  lines: OrderLine[];
  total: number | string;
  currency?: string;
  /** Carrier/tracking, present only once a label has been bought (GOL-1906). */
  carrier?: string;
  tracking?: string;
}

const FULFILLMENT_LABEL: Record<string, string> = {
  ship: "Shipping",
  pickup: "Farm pickup",
};

/** Human label for a fulfilment value; unknown/absent → the safer "Shipping". */
export function fulfillmentLabel(fulfillment?: string): string {
  return (fulfillment && FULFILLMENT_LABEL[fulfillment]) || "Shipping";
}

/** `$1,234.50 USD` — thousands-separated, two decimals (mirrors order_alerts.py). */
export function formatMoney(amount: number | string, currency = "USD"): string {
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n)) return `${amount} ${currency}`;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function lineBullet(line: OrderLine): string {
  const q = Number.isFinite(line.qty) && Number.isInteger(line.qty) ? line.qty : line.qty;
  return `• ${q}× ${line.name}`;
}

/** Encode the Mark-Shipped button custom_id: `ord:shipped:<orderId>`. */
export function encodeOrderAction(action: OrderAction, orderId: number | string): string {
  return `${ORD_PREFIX}:${action}:${orderId}`;
}

/** Parse an order-ops button custom_id, or null when it is not one. */
export function parseOrderAction(customId: string): { action: OrderAction; orderId: string } | null {
  const parts = customId.split(":");
  if (parts.length < 3 || parts[0] !== ORD_PREFIX) return null;
  if (parts[1] !== "shipped") return null;
  const orderId = parts.slice(2).join(":");
  if (!orderId) return null;
  return { action: "shipped", orderId };
}

/**
 * Build the order-ops card for a new paid order: an embed summarising the order
 * plus a single "Mark shipped" button (`ord:shipped:<orderId>`). Fires for both
 * fulfilment types; a pickup order still gets the card (Josh) — the operator
 * marking it shipped is the "handed to the customer" signal there.
 */
export function buildOrderCard(alert: OrderAlert): DiscordMessage {
  const kind = alert.isDeposit ? "New preorder (deposit)" : "New order";
  const who = alert.customerEmail
    ? `${alert.customer || "Unknown customer"} <${alert.customerEmail}>`
    : alert.customer || "Unknown customer";

  const descLines = [`**Customer:** ${who}`, ...alert.lines.map(lineBullet)];
  const fields = [
    { name: "Total", value: formatMoney(alert.total, alert.currency || "USD"), inline: true },
    { name: "Fulfilment", value: fulfillmentLabel(alert.fulfillment), inline: true },
  ];
  if (alert.carrier || alert.tracking) {
    const bits: string[] = [];
    if (alert.carrier) bits.push(`Carrier: ${alert.carrier}`);
    if (alert.tracking) bits.push(`Tracking: ${alert.tracking}`);
    fields.push({ name: "Shipping", value: bits.join(" · "), inline: false });
  }

  const embed: DiscordEmbed = {
    title: `📦 ${kind} ${alert.orderRef} — ${fulfillmentLabel(alert.fulfillment)}`,
    description: descLines.join("\n"),
    color: GROVE_GREEN,
    footer: { text: `order:${alert.orderId}` },
    fields,
  };

  return {
    embeds: [embed],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 3, // SUCCESS (green)
            label: "Mark shipped",
            emoji: { name: "✅" },
            custom_id: encodeOrderAction("shipped", alert.orderId),
          },
        ],
      },
    ],
  };
}

/**
 * Edited card shown after a successful mark-shipped: drops the button (empty
 * component rows so it can't be re-clicked) and stamps who shipped it plus any
 * tracking returned by Odoo.
 */
export function shippedCard(original: unknown, operatorId: string, detail: string): DiscordMessage {
  const embed = { ...((original as { embeds?: DiscordEmbed[] })?.embeds?.[0] ?? emptyEmbed()) };
  embed.title = `✅ Shipped — <@${operatorId}>`;
  embed.footer = { text: detail };
  return { embeds: [embed], components: [] };
}

function emptyEmbed(): DiscordEmbed {
  return { title: "", description: "", color: GROVE_GREEN, footer: { text: "" } };
}

/**
 * Per-brand order-channel map keyed on the stringified `order.company_id`
 * (GOL-1980 item 4). Parsed from a JSON env value, e.g.
 * `{"1":"1527...","2":"1699..."}` (company id → channel snowflake). A malformed
 * value degrades to an empty map rather than throwing — a bad map must not crash
 * the interactions server, and resolveOrderChannel then simply finds no channel.
 */
export function parseOrderChannelMap(json: string | undefined): Record<string, string> {
  if (!json || !json.trim()) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof v === "string" && /^\d{5,}$/.test(v.trim())) out[String(k)] = v.trim();
  }
  return out;
}

/** Resolve the order channel for a company id, or undefined when unmapped. */
export function resolveOrderChannel(
  companyId: number | string,
  map: Record<string, string>,
): string | undefined {
  return map[String(companyId)];
}
