import { describe, it, expect, vi } from "vitest";
import {
  buildOrderCard,
  encodeOrderAction,
  formatMoney,
  fulfillmentLabel,
  parseOrderAction,
  parseOrderChannelMap,
  resolveOrderChannel,
  buildOrderRequest,
  buildShippedModal,
  buildHoldModal,
  readCardPrefill,
  readModalFields,
  buildNotice,
  orderSecretMatches,
  orderActionOutcome,
  markAllOutcome,
  buildConfirmPrompt,
  type OrderAction,
  type OrderAlert,
} from "./orders";

const ALERT: OrderAlert = {
  orderId: 42,
  orderRef: "S00042",
  companyId: 1,
  customer: "Jamie Farmer",
  customerEmail: "jamie@example.com",
  fulfillment: "ship",
  lines: [
    { name: "American Plum (Bareroot)", qty: 2 },
    { name: "Pawpaw 'Shenandoah'", qty: 1 },
  ],
  total: 1234.5,
  currency: "USD",
};

describe("order action codec", () => {
  it("round-trips ord:shipped:<id>", () => {
    expect(encodeOrderAction("shipped", 42)).toBe("ord:shipped:42");
    expect(parseOrderAction("ord:shipped:42")).toEqual({ action: "shipped", orderId: "42" });
  });
  it("round-trips every action", () => {
    const all: OrderAction[] = ["shipped", "hold", "holddate", "release", "ready", "snooze", "spring", "fall", "refunded", "markall", "markallgo", "refundedgo"];
    for (const a of all) {
      expect(parseOrderAction(encodeOrderAction(a, 42))).toEqual({ action: a, orderId: "42" });
    }
  });
  it("carries the suggested date on hold and holddate", () => {
    expect(encodeOrderAction("hold", 42, "2026-10-15")).toBe("ord:hold:42:2026-10-15");
    expect(parseOrderAction("ord:hold:42:2026-10-15")).toEqual({ action: "hold", orderId: "42", date: "2026-10-15" });
    expect(parseOrderAction("ord:holddate:42:2026-10-15")).toEqual({ action: "holddate", orderId: "42", date: "2026-10-15" });
    expect(encodeOrderAction("hold", 42, null)).toBe("ord:hold:42");
    expect(parseOrderAction("ord:hold:42:garbage")).toBeNull();
  });
  it("rejects non-order / malformed ids", () => {
    expect(parseOrderAction("cs:approve:x")).toBeNull();
    expect(parseOrderAction("ord:cancelled:1")).toBeNull();
    expect(parseOrderAction("ord:shipped:")).toBeNull();
    expect(parseOrderAction("ord:shipped")).toBeNull();
  });
});

describe("formatMoney / fulfillmentLabel", () => {
  it("thousands-separates with two decimals", () => {
    expect(formatMoney(1234.5)).toBe("$1,234.50 USD");
    expect(formatMoney(24.92, "USD")).toBe("$24.92 USD");
  });
  it("degrades on a bad amount instead of throwing", () => {
    expect(formatMoney("nope")).toBe("nope USD");
  });
  it("labels fulfilment, defaulting unknown/absent to Shipping", () => {
    expect(fulfillmentLabel("pickup")).toBe("Farm pickup");
    expect(fulfillmentLabel("ship")).toBe("Shipping");
    expect(fulfillmentLabel(undefined)).toBe("Shipping");
    expect(fulfillmentLabel("weird")).toBe("Shipping");
  });
});

function buttons(card: ReturnType<typeof buildOrderCard>) {
  return card.components.flatMap((r) => r.components);
}
const labels = (card: ReturnType<typeof buildOrderCard>) => buttons(card).map((b) => b.label);

describe("buildOrderCard", () => {
  it("keeps a lane-less alert at a single Mark shipped button", () => {
    const card = buildOrderCard(ALERT);
    const button = card.components[0].components[0];
    expect(button.custom_id).toBe("ord:shipped:42");
    expect(button.label).toBe("Mark shipped");
    expect(card.embeds[0].footer.text).toBe("order:42");
    expect(card.embeds[0].title).toContain("S00042");
    expect(card.embeds[0].description).toContain("Jamie Farmer");
    expect(card.embeds[0].description).toContain("• 2× American Plum (Bareroot)");
  });
  it("includes a Shipping field only once carrier/tracking are present", () => {
    const plain = buildOrderCard(ALERT);
    expect(plain.embeds[0].fields?.some((f) => f.name === "Shipping")).toBe(false);
    const shipped = buildOrderCard({ ...ALERT, carrier: "UPS", tracking: "1Z999" });
    const field = shipped.embeds[0].fields?.find((f) => f.name === "Shipping");
    expect(field?.value).toContain("UPS");
    expect(field?.value).toContain("1Z999");
  });
  it("unlabelled individual order: Mark shipped, Hold, Move to spring", () => {
    const card = buildOrderCard({ ...ALERT, lane: "individual", shipWave: "fall", zone: "6", suggestedHold: "2026-11-10" });
    expect(labels(card)).toEqual(["Mark shipped", "Hold", "Move to spring"]);
    expect(buttons(card).map((b) => b.custom_id)).toEqual([
      "ord:shipped:42",
      "ord:hold:42:2026-11-10",
      "ord:spring:42",
    ]);
    expect(card.embeds[0].fields?.find((f) => f.name === "Lane")?.value).toBe("Individual");
  });
  it("hold button has no date when nothing is suggested", () => {
    const card = buildOrderCard({ ...ALERT, lane: "individual", suggestedHold: null });
    expect(buttons(card).find((b) => b.label === "Hold")?.custom_id).toBe("ord:hold:42");
  });
  it("held order: Change date, Release hold, no Mark shipped", () => {
    const card = buildOrderCard({
      ...ALERT,
      lane: "individual",
      hold: { until: "2026-10-15", reason: "Wait for dormancy", setBy: "Wesley" },
    });
    expect(labels(card)).toEqual(["Change date", "Release hold"]);
    expect(buttons(card)[0].custom_id).toBe("ord:holddate:42:2026-10-15");
    expect(buttons(card)[1].custom_id).toBe("ord:release:42");
    const fields = card.embeds[0].fields ?? [];
    expect(fields.find((f) => f.name === "On hold")?.value).toBe("Until Oct 15");
    expect(fields.find((f) => f.name === "Hold reason")?.value).toBe("Wait for dormancy");
    expect(fields.find((f) => f.name === "Held by")?.value).toBe("Wesley");
  });
  it("spring order without a label: shows the zone, Hold, Move to fall, no Mark shipped", () => {
    const card = buildOrderCard({ ...ALERT, lane: "spring", shipWave: "spring", zone: "6" });
    expect(labels(card)).toEqual(["Hold", "Move to fall"]);
    expect(buttons(card)[1].custom_id).toBe("ord:fall:42");
    expect(card.embeds[0].fields?.find((f) => f.name === "Lane")?.value).toBe("Spring · Zone 6");
  });
  it("pickup order (lane none) shows no Mark shipped", () => {
    const card = buildOrderCard({ ...ALERT, fulfillment: "pickup", lane: "none" });
    expect(labels(card)).toEqual([]);
    expect(card.components).toEqual([]);
    expect(card.embeds[0].title).toContain("S00042");
  });
  it("spring order with a label keeps Mark shipped, Hold and Label refunded", () => {
    const card = buildOrderCard({ ...ALERT, lane: "spring", shipWave: "spring", zone: "6", carrier: "UPS", tracking: "1Z999", labelCost: 12.4 });
    expect(labels(card)).toEqual(["Mark shipped", "Hold", "Label refunded"]);
  });
  it("labelled individual order shows Label refunded and no Move", () => {
    const card = buildOrderCard({ ...ALERT, lane: "individual", carrier: "UPS", tracking: "1Z999", labelCost: 12.4 });
    expect(labels(card)).toEqual(["Mark shipped", "Hold", "Label refunded"]);
    expect(buttons(card)[2].custom_id).toBe("ord:refunded:42");
    expect(card.embeds[0].fields?.find((f) => f.name === "Label cost")?.value).toBe("$12.40 USD");
  });
  it("shipped card has no buttons and shows carrier, tracking, cost and who marked it", () => {
    const card = buildOrderCard({ ...ALERT, lane: "individual", carrier: "UPS", tracking: "1Z999", labelCost: 12.4, shippedBy: "Wesley" });
    expect(card.components).toEqual([]);
    const e = card.embeds[0];
    expect(e.title).toContain("Shipped");
    expect(e.title).toContain("S00042");
    const f = Object.fromEntries((e.fields ?? []).map((x) => [x.name, x.value]));
    expect(f.Shipping).toContain("UPS");
    expect(f.Shipping).toContain("1Z999");
    expect(f["Label cost"]).toBe("$12.40 USD");
    expect(f["Marked shipped by"]).toBe("Wesley");
  });
  it("never exceeds Discord's component limits", () => {
    const card = buildOrderCard({ ...ALERT, lane: "individual", suggestedHold: "2026-11-10" });
    expect(card.components.length).toBeLessThanOrEqual(5);
    for (const row of card.components) expect(row.components.length).toBeLessThanOrEqual(5);
  });
});

describe("card prefill + modals", () => {
  const msg = (a: Partial<OrderAlert>) => buildOrderCard({ ...ALERT, lane: "individual", ...a });

  it("reads the first tracking number and the cost off a card", () => {
    const p = readCardPrefill(msg({ carrier: "UPS", tracking: "1Z111, 1Z222 1Z333", labelCost: 1234.5 }));
    expect(p.tracking).toBe("1Z111");
    expect(p.cost).toBe("1234.50");
  });
  it("reads the hold reason off a held card", () => {
    const p = readCardPrefill(msg({ hold: { until: "2026-10-15", reason: "Dormancy", setBy: "Wes" } }));
    expect(p.reason).toBe("Dormancy");
  });
  const nudge = (reason: string) => ({
    embeds: [
      {
        title: "S00042: held order is due",
        description: `Customer: Jamie\nZone: Zone 6\nHeld for: ${reason}\nHeld until: 2026-10-15\nIs it ready to ship, or should the hold move?`,
      },
    ],
  });
  it("reads the hold reason off a hold nudge", () => {
    expect(readCardPrefill(nudge("Dormancy first (held by Wes)")).reason).toBe("Dormancy first");
    expect(readCardPrefill(nudge("Away until May")).reason).toBe("Away until May");
  });
  it("keeps a multi-line reason from a nudge whole", () => {
    expect(readCardPrefill(nudge("Away\nback in May (held by Wes)")).reason).toBe("Away\nback in May");
  });
  it("a nudge with no recorded reason prefills nothing", () => {
    expect(readCardPrefill(nudge("no reason recorded")).reason).toBeUndefined();
  });
  it("is empty for a plain card or junk", () => {
    expect(readCardPrefill(msg({}))).toEqual({});
    expect(readCardPrefill(undefined)).toEqual({});
  });

  it("shipped modal has required Tracking number and Label cost, prefilled", () => {
    const m = buildShippedModal("42", { tracking: "1Z111", cost: "12.40" });
    expect(m.custom_id).toBe("ord:shipped:42");
    const inputs = m.components.map((r) => r.components[0] as Record<string, unknown>);
    expect(inputs.map((i) => i.label)).toEqual(["Tracking number", "Label cost"]);
    expect(inputs.every((i) => i.required === true)).toBe(true);
    expect(inputs.map((i) => i.value)).toEqual(["1Z111", "12.40"]);
  });
  it("shipped modal leaves fields empty with no prefill", () => {
    const m = buildShippedModal("42", {});
    for (const r of m.components) expect((r.components[0] as Record<string, unknown>).value).toBeUndefined();
  });
  it("hold modal prefills Hold until and requires Why", () => {
    const m = buildHoldModal("hold", "42", { date: "2026-10-15" });
    expect(m.custom_id).toBe("ord:hold:42");
    const [until, why] = m.components.map((r) => r.components[0] as Record<string, unknown>);
    expect(until.label).toBe("Hold until");
    expect(until.value).toBe("2026-10-15");
    expect(why.label).toBe("Why");
    expect(why.required).toBe(true);
    expect(why.value).toBeUndefined();
  });
  it("change-date modal prefills date and reason and routes as holddate", () => {
    const m = buildHoldModal("holddate", "42", { date: "2026-10-15", reason: "Dormancy" });
    expect(m.custom_id).toBe("ord:holddate:42");
    const [until, why] = m.components.map((r) => r.components[0] as Record<string, unknown>);
    expect(until.value).toBe("2026-10-15");
    expect(why.value).toBe("Dormancy");
  });
  it("respects Discord length limits", () => {
    for (const m of [buildShippedModal("42", {}), buildHoldModal("hold", "42", {})]) {
      expect(m.custom_id.length).toBeLessThanOrEqual(100);
      expect(m.title.length).toBeLessThanOrEqual(45);
      for (const r of m.components) {
        expect(String((r.components[0] as Record<string, unknown>).label).length).toBeLessThanOrEqual(45);
      }
    }
  });
  it("reads modal submit fields by custom_id", () => {
    const f = readModalFields([
      { type: 1, components: [{ custom_id: "tracking", value: " 1Z1 " }] },
      { type: 1, components: [{ custom_id: "cost", value: "9" }] },
    ]);
    expect(f).toEqual({ tracking: "1Z1", cost: "9" });
    expect(readModalFields(undefined)).toEqual({});
  });
});

describe("buildOrderRequest", () => {
  it("routes each action to its Odoo path and body", () => {
    expect(buildOrderRequest("shipped", { tracking: "1Z", cost: "9" }, "Wes")).toEqual({
      path: "mark-shipped",
      body: { actor: "Wes", tracking: "1Z", cost: "9" },
    });
    for (const a of ["hold", "holddate"] as const) {
      expect(buildOrderRequest(a, { until: "Oct 15", reason: "why" }, "Wes")).toEqual({
        path: "hold",
        body: { actor: "Wes", until: "Oct 15", reason: "why" },
      });
    }
    for (const a of ["release", "ready"] as const) {
      expect(buildOrderRequest(a, {}, "Wes")).toEqual({ path: "hold/release", body: { actor: "Wes" } });
    }
    expect(buildOrderRequest("snooze", {}, "Wes")).toEqual({ path: "hold/snooze", body: { actor: "Wes" } });
    expect(buildOrderRequest("spring", {}, "Wes")).toEqual({ path: "move", body: { actor: "Wes", wave: "spring" } });
    expect(buildOrderRequest("fall", {}, "Wes")).toEqual({ path: "move", body: { actor: "Wes", wave: "fall" } });
    expect(buildOrderRequest("refunded", {}, "Wes")).toEqual({ path: "label-refunded", body: { actor: "Wes" } });
  });
  it("markall has no order route; it calls the batch route instead", () => {
    expect(buildOrderRequest("markall", {}, "Wes")).toBeNull();
  });
});

describe("orderActionOutcome", () => {
  const payload = { orderId: 42, orderRef: "S00042", companyId: 1, lines: [], total: 1, lane: "individual" } as unknown as OrderAlert;
  it("edits the card from the returned payload", () => {
    const o = orderActionOutcome({ ok: true, status: 200, card: payload }, "release", "Wes", undefined);
    expect(o.edit?.embeds[0].title).toContain("S00042");
    expect(o.notice).toBeUndefined();
  });
  it("marks the card shipped after a successful mark-shipped", () => {
    const o = orderActionOutcome({ ok: true, status: 200, card: payload }, "shipped", "Wes", undefined);
    expect(o.edit?.components).toEqual([]);
    expect(o.edit?.embeds[0].title).toContain("Shipped");
  });
  it("null card on success is a plain confirmation, not a failure", () => {
    const o = orderActionOutcome({ ok: true, status: 200, card: null }, "release", "Wes", undefined);
    expect(o.edit).toBeUndefined();
    expect(o.notice).toMatch(/done/i);
  });
  it("null card after mark-shipped still removes the buttons from the existing card", () => {
    const original = buildOrderCard({ ...ALERT, lane: "individual" });
    const o = orderActionOutcome({ ok: true, status: 200, card: null }, "shipped", "Wes", original);
    expect(o.edit?.components).toEqual([]);
    expect(o.notice).toMatch(/shipped/i);
  });
  it("a malformed card falls back to the plain confirmation and logs", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const bad = { orderId: 42, orderRef: "S1", lines: null, total: 1, lane: "individual" } as unknown as OrderAlert;
    const o = orderActionOutcome({ ok: true, status: 200, card: bad }, "release", "Wes", undefined);
    expect(o.edit).toBeUndefined();
    expect(o.notice).toMatch(/done/i);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
  it("failure posts Odoo's error and leaves the card alone", () => {
    const o = orderActionOutcome({ ok: false, status: 422, error: "Tracking number is required." }, "shipped", "Wes", undefined);
    expect(o.edit).toBeUndefined();
    expect(o.notice).toBe("Tracking number is required.");
  });
});

describe("parseOrderChannelMap / resolveOrderChannel", () => {
  it("parses a company_id → channel snowflake map", () => {
    const map = parseOrderChannelMap('{"1":"1600000000000000000","2":"1699999999999999999"}');
    expect(resolveOrderChannel(1, map)).toBe("1600000000000000000");
    expect(resolveOrderChannel("2", map)).toBe("1699999999999999999");
    expect(resolveOrderChannel(3, map)).toBeUndefined();
  });
  it("degrades to an empty map on malformed / non-snowflake input", () => {
    expect(parseOrderChannelMap(undefined)).toEqual({});
    expect(parseOrderChannelMap("not json")).toEqual({});
    expect(parseOrderChannelMap("[1,2]")).toEqual({});
    expect(parseOrderChannelMap('{"1":"abc","2":"123"}')).toEqual({});
  });
});

describe("buildNotice", () => {
  const body = {
    companyId: 3,
    title: "S00042 hold is due",
    lines: ["Customer: Jamie Farmer", "Held until 2026-11-09"],
    buttons: [
      { label: "Ready to ship", style: 3, customId: "ord:ready:42" },
      { label: "Snooze a week", style: 2, customId: "ord:snooze:42" },
      { label: "Change date", style: 2, customId: "ord:holddate:42:2026-11-09" },
    ],
  };

  it("renders an embed with the three nudge buttons", () => {
    const r = buildNotice(body);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.companyId).toBe(3);
    const embed = r.message.embeds![0];
    expect(embed.title).toBe("S00042 hold is due");
    expect(embed.description).toBe("Customer: Jamie Farmer\nHeld until 2026-11-09");
    const row = r.message.components![0] as { components: Array<{ label: string; custom_id: string; style: number }> };
    expect(row.components.map((c) => c.label)).toEqual(["Ready to ship", "Snooze a week", "Change date"]);
    expect(row.components.map((c) => c.custom_id)).toEqual(["ord:ready:42", "ord:snooze:42", "ord:holddate:42:2026-11-09"]);
    expect(row.components[0].style).toBe(3);
  });

  it("clips the title and description to Discord limits", () => {
    const r = buildNotice({ ...body, title: "t".repeat(500), lines: ["x".repeat(3000), "y".repeat(3000)] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.message.embeds![0].title!.length).toBeLessThanOrEqual(256);
    expect(r.message.embeds![0].description!.length).toBeLessThanOrEqual(4096);
  });

  it("rejects bad bodies", () => {
    expect(buildNotice(null).ok).toBe(false);
    expect(buildNotice({ ...body, companyId: undefined }).ok).toBe(false);
    expect(buildNotice({ ...body, title: "" }).ok).toBe(false);
    expect(buildNotice({ ...body, lines: "no" }).ok).toBe(false);
    expect(buildNotice({ ...body, lines: [1] }).ok).toBe(false);
    expect(buildNotice({ ...body, buttons: "no" }).ok).toBe(false);
  });

  it("requires companyId to be a positive integer", () => {
    for (const bad of ["__proto__", "constructor", "3", 0, -1, 1.5, NaN, null]) {
      expect(buildNotice({ ...body, companyId: bad }).ok).toBe(false);
    }
    expect(buildNotice({ ...body, companyId: 1 }).ok).toBe(true);
  });

  it("rejects buttons that are too many, too long, or not ord:", () => {
    const b = body.buttons[0];
    expect(buildNotice({ ...body, buttons: Array(6).fill(b) }).ok).toBe(false);
    expect(buildNotice({ ...body, buttons: [{ ...b, customId: "ord:ready:" + "9".repeat(100) }] }).ok).toBe(false);
    expect(buildNotice({ ...body, buttons: [{ ...b, customId: "cs:approve:1" }] }).ok).toBe(false);
    expect(buildNotice({ ...body, buttons: [{ ...b, label: "L".repeat(81) }] }).ok).toBe(false);
    expect(buildNotice({ ...body, buttons: [{ ...b, label: "" }] }).ok).toBe(false);
    expect(buildNotice({ ...body, buttons: [{ ...b, style: 9 }] }).ok).toBe(false);
  });
});

describe("orderSecretMatches", () => {
  it("accepts only the exact secret", () => {
    expect(orderSecretMatches("s3cret", "s3cret")).toBe(true);
    expect(orderSecretMatches("wrong", "s3cret")).toBe(false);
    expect(orderSecretMatches("s3cret-and-more", "s3cret")).toBe(false);
    expect(orderSecretMatches(undefined, "s3cret")).toBe(false);
    expect(orderSecretMatches("", "")).toBe(false);
  });
});

describe("shipped cards", () => {
  it("a card Odoo says has shipped offers no actions", () => {
    const card = buildOrderCard({ ...ALERT, lane: "spring", zone: "6", tracking: "1Z1", shipped: true });
    expect(card.components).toEqual([]);
    expect(card.embeds[0].title).toMatch(/Shipped S00042/);
    expect(card.embeds[0].fields?.map((f) => f.name)).not.toContain("Marked shipped by");
  });
  it("shipped false keeps the buttons", () => {
    const card = buildOrderCard({ ...ALERT, lane: "spring", zone: "6", tracking: "1Z1", shipped: false });
    expect(card.components).toHaveLength(1);
  });
});

describe("confirm prompts", () => {
  const notice = { id: "1500000000000000001", embeds: [{ title: "Zone 6 labels", description: "Zone 6: 14 labels recorded" }] };
  const button = (p: ReturnType<typeof buildConfirmPrompt>) => p.components[0].components[0];

  it("Mark all names what is on the notice and carries the notice's id", () => {
    const p = buildConfirmPrompt("markall", "7", notice);
    expect(p.flags).toBe(64);
    expect(p.content).toMatch(/14 labels recorded/);
    expect(button(p).custom_id).toBe("ord:markallgo:7:1500000000000000001");
  });
  it("Mark all falls back to plain wording", () => {
    expect(buildConfirmPrompt("markall", "7", { id: "1500000000000000001" }).content).toMatch(/Mark this batch shipped\?/);
  });
  it("Label refunded names the order and says what it clears", () => {
    const card = buildOrderCard({ ...ALERT, lane: "individual", tracking: "1Z1" });
    const p = buildConfirmPrompt("refunded", "42", { ...card, id: "1500000000000000002" });
    expect(p.content).toMatch(/S00042/);
    expect(p.content).toMatch(/every box/i);
    expect(button(p).custom_id).toBe("ord:refundedgo:42:1500000000000000002");
  });
  it("a confirm custom_id fits Discord's limit and round-trips", () => {
    const id = button(buildConfirmPrompt("refunded", "2147483647", { id: "15000000000000000001" })).custom_id as string;
    expect(id.length).toBeLessThanOrEqual(100);
    expect(parseOrderAction(id)).toEqual({ action: "refundedgo", orderId: "2147483647", messageId: "15000000000000000001" });
  });
  it("a confirm id with a junk message id is not an order action", () => {
    expect(parseOrderAction("ord:markallgo:7:2026-10-15")).toBeNull();
    expect(parseOrderAction("ord:hold:42:1500000000000000001")).toBeNull();
  });
  it("Label refunded's result says how many boxes were cleared", () => {
    const card = { ...ALERT, lane: "individual" } as unknown as object;
    expect(orderActionOutcome({ ok: true, status: 200, card, boxesCleared: 2 }, "refunded", "Wes", {}).notice).toMatch(/2 boxes/);
    expect(orderActionOutcome({ ok: true, status: 200, card, boxesCleared: 1 }, "refunded", "Wes", {}).notice).toMatch(/1 box\b/);
    expect(orderActionOutcome({ ok: true, status: 200, card: null, boxesCleared: 3 }, "refunded", "Wes", {}).notice).toMatch(/3 boxes/);
  });
  it("no other action picks up a boxes note", () => {
    const card = { ...ALERT, lane: "individual" } as unknown as object;
    expect(orderActionOutcome({ ok: true, status: 200, card }, "release", "Wes", {}).notice).toBeUndefined();
  });
});

describe("markAllOutcome", () => {
  const notice = {
    embeds: [{ title: "Zone 6 labels", description: "Zone 6: 14 labels recorded", color: 1, footer: { text: "Order notice" } }],
    components: [{ type: 1, components: [{ type: 2, style: 3, label: "Mark all shipped", custom_id: "ord:markall:7" }] }],
  };
  const done = { ok: true, status: 200, shipped: 12, already: 2, skipped: [{ order: "S00007", reason: "on hold until Apr 20" }] };

  it("edits the notice to the counts, lists skipped orders and keeps the button for them", () => {
    const o = markAllOutcome(done, "Wes", notice);
    const embed = o.edit?.embeds[0];
    expect(embed?.description).toBe(
      "Zone 6: 14 labels recorded\n\n12 shipped, 2 already shipped, 1 skipped\n• S00007: on hold until Apr 20",
    );
    expect(embed?.title).toBe("Zone 6 labels");
    expect(embed?.footer?.text).toContain("Wes");
    expect(o.edit?.components).toEqual(notice.components);
    expect(o.notice).toBeUndefined();
  });

  it("shows the counts with no skipped lines when nothing was skipped, and removes the button", () => {
    const o = markAllOutcome({ ...done, skipped: [] }, "Wes", notice);
    expect(o.edit?.embeds[0].description).toBe("Zone 6: 14 labels recorded\n\n12 shipped, 2 already shipped, 0 skipped");
    expect(o.edit?.components).toEqual([]);
  });

  it("a refusal posts Odoo's error and leaves the notice and button alone", () => {
    const msg = "Zone 6 spring shipping starts April 5, 2027. Today is April 1, 2027, so nothing was marked shipped.";
    const o = markAllOutcome({ ok: false, status: 409, refused: true, error: msg }, "Wes", notice);
    expect(o.edit).toBeUndefined();
    expect(o.notice).toBe(msg);
  });

  it("any other failure is a note too, with the notice and button untouched", () => {
    const o = markAllOutcome({ ok: false, status: 0, error: "Odoo may still be working, check the orders before retrying." }, "Wes", notice);
    expect(o.edit).toBeUndefined();
    expect(o.notice).toMatch(/may still be working/);
  });

  it("without the original embed the counts go out as the note", () => {
    const o = markAllOutcome(done, "Wes", undefined);
    expect(o.edit).toBeUndefined();
    expect(o.notice).toBe("12 shipped, 2 already shipped, 1 skipped\n• S00007: on hold until Apr 20");
  });

  it("clips a very long skipped list to Discord's description limit", () => {
    const skipped = Array.from({ length: 400 }, (_, i) => ({ order: `S${i}`, reason: "on hold until Apr 20 for the customer" }));
    const o = markAllOutcome({ ...done, skipped }, "Wes", notice);
    expect((o.edit?.embeds[0].description ?? "").length).toBeLessThanOrEqual(4096);
  });
});
