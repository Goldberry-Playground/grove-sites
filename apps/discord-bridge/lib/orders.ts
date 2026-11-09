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
import type { OrderActionResult } from "./order-client.ts";
import type { DiscordActionRow, DiscordButton, DiscordEmbed, DiscordMessage } from "./render.ts";

/** Grove green (embed accent) — matches the digest / approval cards. */
const GROVE_GREEN = 0x3f7d4e;

/** custom_id namespace for order-ops components (distinct from `cs:` / `insights:`). */
export const ORD_PREFIX = "ord";

/** Every order action a card button can carry. `markall` is parsed but not routed to Odoo yet. */
export type OrderAction =
  | "shipped"
  | "hold"
  | "holddate"
  | "release"
  | "ready"
  | "snooze"
  | "spring"
  | "fall"
  | "refunded"
  | "markall";

const ORDER_ACTIONS: ReadonlySet<string> = new Set<OrderAction>([
  "shipped",
  "hold",
  "holddate",
  "release",
  "ready",
  "snooze",
  "spring",
  "fall",
  "refunded",
  "markall",
]);

/** Held-order data as the Odoo card payload sends it. */
export interface OrderHold {
  /** ISO date (yyyy-mm-dd). */
  until: string;
  reason: string;
  setBy: string;
}

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
  /** "spring" | "individual" | "none". Absent on a legacy alert (one Mark shipped button). */
  lane?: string | null;
  zone?: string | number | null;
  shipWave?: string | null;
  /** ISO date suggested for a hold, or null. */
  suggestedHold?: string | null;
  /** Label cost in dollars, or null when no label is on the order. */
  labelCost?: number | null;
  hold?: OrderHold | null;
  /** Set by the bridge (never by Odoo) once Mark shipped succeeds: who marked it. */
  shippedBy?: string;
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

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Encode a button custom_id: `ord:<action>:<orderId>`, plus `:<yyyy-mm-dd>` for
 * hold and holddate, which carry the date a modal prefills from.
 */
export function encodeOrderAction(action: OrderAction, orderId: number | string, date?: string | null): string {
  const base = `${ORD_PREFIX}:${action}:${orderId}`;
  return date ? `${base}:${date}` : base;
}

/** Parse an order-ops custom_id, or null when it is not one. */
export function parseOrderAction(
  customId: string,
): { action: OrderAction; orderId: string; date?: string } | null {
  const parts = customId.split(":");
  if (parts.length < 3 || parts.length > 4 || parts[0] !== ORD_PREFIX) return null;
  if (!ORDER_ACTIONS.has(parts[1])) return null;
  const orderId = parts[2];
  if (!orderId) return null;
  const action = parts[1] as OrderAction;
  if (parts.length === 3) return { action, orderId };
  if (!ISO_DATE.test(parts[3])) return null;
  return { action, orderId, date: parts[3] };
}

// Embed field names the card renders; readCardPrefill reads the same names back.
const F_LANE = "Lane";
const F_SHIPPING = "Shipping";
const F_COST = "Label cost";
const F_HOLD = "On hold";
const F_REASON = "Hold reason";
const F_HELD_BY = "Held by";
const F_SHIPPED_BY = "Marked shipped by";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `2026-10-15` → `Oct 15`; anything else is shown as given. */
function shortDate(iso: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const month = MONTHS[Number(m[1]) - 1];
  return month ? `${month} ${Number(m[2])}` : iso;
}

/** Discord caps an embed field value at 1024 characters. */
function clip(text: string, max = 1000): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function laneLabel(alert: OrderAlert): string | null {
  if (alert.lane === "spring") return alert.zone ? `Spring · Zone ${alert.zone}` : "Spring";
  if (alert.lane === "individual") return "Individual";
  return null;
}

function button(style: DiscordButton["style"], label: string, emoji: string, customId: string): DiscordButton {
  return { type: 2, style, label, emoji: { name: emoji }, custom_id: customId };
}

/** Buttons by order state. A lane-less (legacy) alert keeps the single Mark shipped button. */
function orderButtons(alert: OrderAlert): DiscordButton[] {
  const id = alert.orderId;
  const shipBtn = button(3, "Mark shipped", "✅", encodeOrderAction("shipped", id));
  if (alert.hold) {
    return [
      button(2, "Change date", "📅", encodeOrderAction("holddate", id, alert.hold.until)),
      button(2, "Release hold", "▶️", encodeOrderAction("release", id)),
    ];
  }
  if (!alert.lane || alert.lane === "none") return [shipBtn];

  const labelled = Boolean(alert.tracking);
  if (labelled) return [shipBtn, button(4, "Label refunded", "↩️", encodeOrderAction("refunded", id))];

  const holdBtn = button(2, "Hold", "⏸️", encodeOrderAction("hold", id, alert.suggestedHold));
  if (alert.lane === "spring") return [holdBtn, button(2, "Move to fall", "🍂", encodeOrderAction("fall", id))];
  return [shipBtn, holdBtn, button(2, "Move to spring", "🌱", encodeOrderAction("spring", id))];
}

/**
 * The one renderer for an order card: embed summarising the order, its lane,
 * hold, label, and the buttons its state allows. A shipped card (`shippedBy`)
 * keeps the facts and has no buttons, so it can't be clicked again.
 */
export function buildOrderCard(alert: OrderAlert): DiscordMessage {
  const shipped = Boolean(alert.shippedBy);
  const kind = alert.isDeposit ? "New preorder (deposit)" : "New order";
  const who = alert.customerEmail
    ? `${alert.customer || "Unknown customer"} <${alert.customerEmail}>`
    : alert.customer || "Unknown customer";

  const descLines = [`**Customer:** ${who}`, ...alert.lines.map(lineBullet)];
  const fields: Array<{ name: string; value: string; inline: boolean }> = [
    { name: "Total", value: formatMoney(alert.total, alert.currency || "USD"), inline: true },
    { name: "Fulfilment", value: fulfillmentLabel(alert.fulfillment), inline: true },
  ];
  const lane = laneLabel(alert);
  if (lane) fields.push({ name: F_LANE, value: lane, inline: true });
  if (alert.hold) {
    fields.push({ name: F_HOLD, value: `Until ${shortDate(alert.hold.until)}`, inline: true });
    if (alert.hold.reason) fields.push({ name: F_REASON, value: clip(alert.hold.reason), inline: false });
    if (alert.hold.setBy) fields.push({ name: F_HELD_BY, value: clip(alert.hold.setBy), inline: true });
  }
  if (alert.carrier || alert.tracking) {
    const bits: string[] = [];
    if (alert.carrier) bits.push(`Carrier: ${alert.carrier}`);
    if (alert.tracking) bits.push(`Tracking: ${alert.tracking}`);
    fields.push({ name: F_SHIPPING, value: clip(bits.join(" · ")), inline: false });
  }
  if (alert.labelCost != null && Number.isFinite(alert.labelCost)) {
    fields.push({ name: F_COST, value: formatMoney(alert.labelCost, alert.currency || "USD"), inline: true });
  }
  if (shipped) fields.push({ name: F_SHIPPED_BY, value: clip(alert.shippedBy as string), inline: true });

  const title = shipped
    ? `✅ Shipped ${alert.orderRef} — ${fulfillmentLabel(alert.fulfillment)}`
    : `📦 ${kind} ${alert.orderRef} — ${fulfillmentLabel(alert.fulfillment)}`;
  const embed: DiscordEmbed = {
    title,
    description: descLines.join("\n"),
    color: GROVE_GREEN,
    footer: { text: `order:${alert.orderId}` },
    fields,
  };

  const row: DiscordActionRow = { type: 1, components: shipped ? [] : orderButtons(alert) };
  return { embeds: [embed], components: row.components.length ? [row] : [] };
}

/** Values a modal prefills from, read back off the card the click came from. */
export interface CardPrefill {
  tracking?: string;
  cost?: string;
  reason?: string;
}

/**
 * Recover prefill values from a posted card (Discord only gives a click the
 * message it sits on). Tracking is the FIRST number only, since the Mark shipped
 * form takes one; cost is the plain number without `$`, commas or currency.
 */
export function readCardPrefill(message: unknown): CardPrefill {
  const embed = (message as { embeds?: Array<{ fields?: Array<{ name?: string; value?: string }> }> })?.embeds?.[0];
  const fields = Array.isArray(embed?.fields) ? embed.fields : [];
  const value = (name: string) => fields.find((f) => f.name === name)?.value ?? "";
  const out: CardPrefill = {};

  const tracking = /Tracking: (.*)$/.exec(value(F_SHIPPING))?.[1];
  const first = tracking?.split(/[\s,]+/).find(Boolean);
  if (first) out.tracking = first;

  const cost = /[\d,]+(?:\.\d+)?/.exec(value(F_COST))?.[0]?.replace(/,/g, "");
  if (cost) out.cost = cost;

  const reason = value(F_REASON);
  if (reason) out.reason = reason;
  return out;
}

/** Modal input ids. */
export const SHIP_TRACKING_ID = "tracking";
export const SHIP_COST_ID = "cost";
export const HOLD_UNTIL_ID = "until";
export const HOLD_REASON_ID = "reason";

type ModalInput = {
  type: 4;
  custom_id: string;
  style: 1 | 2;
  label: string;
  placeholder?: string;
  required: true;
  max_length: number;
  value?: string;
};

type OrderModal = {
  custom_id: string;
  title: string;
  components: Array<{ type: 1; components: ModalInput[] }>;
};

function inputRow(input: Omit<ModalInput, "type" | "required" | "value">, value?: string): OrderModal["components"][number] {
  return { type: 1, components: [{ type: 4, required: true, ...input, ...(value ? { value } : {}) }] };
}

/** Mark shipped: required Tracking number and Label cost, prefilled when the card has them. */
export function buildShippedModal(orderId: string, prefill: CardPrefill): OrderModal {
  return {
    custom_id: encodeOrderAction("shipped", orderId),
    title: "Mark shipped",
    components: [
      inputRow(
        { custom_id: SHIP_TRACKING_ID, style: 1, label: "Tracking number", placeholder: "One tracking number", max_length: 100 },
        prefill.tracking,
      ),
      inputRow(
        { custom_id: SHIP_COST_ID, style: 1, label: "Label cost", placeholder: "What the label cost, e.g. 12.40", max_length: 20 },
        prefill.cost,
      ),
    ],
  };
}

/** Hold (or change the date of a hold): Hold until, plus a required Why. */
export function buildHoldModal(
  action: "hold" | "holddate",
  orderId: string,
  prefill: { date?: string; reason?: string },
): OrderModal {
  return {
    custom_id: encodeOrderAction(action, orderId),
    title: action === "hold" ? "Hold this order" : "Change the hold date",
    components: [
      inputRow(
        { custom_id: HOLD_UNTIL_ID, style: 1, label: "Hold until", placeholder: "e.g. Oct 15", max_length: 40 },
        prefill.date,
      ),
      inputRow(
        { custom_id: HOLD_REASON_ID, style: 2, label: "Why", placeholder: "Who asked, and what for", max_length: 1000 },
        prefill.reason,
      ),
    ],
  };
}

/** Read a modal submit's text inputs into `{custom_id: trimmed value}`. */
export function readModalFields(components: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of Array.isArray(components) ? components : []) {
    const comps = (row as { components?: Array<{ custom_id?: string; value?: string }> }).components ?? [];
    for (const c of comps) {
      if (typeof c.custom_id === "string") out[c.custom_id] = (c.value ?? "").trim();
    }
  }
  return out;
}

/** The Odoo route (under `/orders/<id>/`) and body for an action, or null when none yet (`markall`). */
export function buildOrderRequest(
  action: OrderAction,
  inputs: Record<string, string>,
  actor: string,
): { path: string; body: Record<string, string> } | null {
  switch (action) {
    case "shipped":
      return { path: "mark-shipped", body: { actor, tracking: inputs[SHIP_TRACKING_ID] ?? "", cost: inputs[SHIP_COST_ID] ?? "" } };
    case "hold":
    case "holddate":
      return { path: "hold", body: { actor, until: inputs[HOLD_UNTIL_ID] ?? "", reason: inputs[HOLD_REASON_ID] ?? "" } };
    case "release":
    case "ready":
      return { path: "hold/release", body: { actor } };
    case "snooze":
      return { path: "hold/snooze", body: { actor } };
    case "spring":
    case "fall":
      return { path: "move", body: { actor, wave: action } };
    case "refunded":
      return { path: "label-refunded", body: { actor } };
    case "markall":
      return null;
  }
}

/**
 * What to show after an order action: edit the card (from the returned
 * payload), or an ephemeral note. A failure never edits the card. A success
 * whose `card` is null still succeeded: confirm plainly (and, for Mark shipped,
 * take the buttons off the existing card so it can't be clicked again).
 */
export function orderActionOutcome(
  res: OrderActionResult,
  action: OrderAction,
  actorName: string,
  original: unknown,
): { edit?: DiscordMessage; notice?: string } {
  if (!res.ok) return { notice: res.error ?? "Couldn't reach Odoo. Nothing changed; try again." };
  const shipped = action === "shipped";
  if (res.card) {
    return { edit: buildOrderCard({ ...(res.card as unknown as OrderAlert), ...(shipped ? { shippedBy: actorName } : {}) }) };
  }
  if (shipped) {
    const embeds = (original as { embeds?: DiscordEmbed[] } | undefined)?.embeds;
    return {
      ...(embeds?.length ? { edit: { embeds, components: [] } } : {}),
      notice: "Marked shipped. The card couldn't be refreshed, but the order is updated.",
    };
  }
  return { notice: "Done. The card couldn't be refreshed, but the order is updated." };
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
