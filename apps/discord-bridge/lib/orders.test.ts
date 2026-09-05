import { describe, it, expect } from "vitest";
import {
  buildOrderCard,
  encodeOrderAction,
  formatMoney,
  fulfillmentLabel,
  parseOrderAction,
  parseOrderChannelMap,
  resolveOrderChannel,
  shippedCard,
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

describe("buildOrderCard", () => {
  it("carries the Mark-Shipped button with the order-id custom_id", () => {
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
});

describe("shippedCard", () => {
  it("drops the button and stamps the operator + detail", () => {
    const original = buildOrderCard(ALERT);
    const edited = shippedCard(original, "555", "S00042 — shipped · tracking: 1Z999");
    expect(edited.components).toEqual([]);
    expect(edited.embeds[0].title).toBe("✅ Shipped — <@555>");
    expect(edited.embeds[0].footer.text).toContain("1Z999");
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
