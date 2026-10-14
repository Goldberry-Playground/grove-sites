import { describe, expect, it } from "vitest";
import { orderTypeLine } from "./order-type";

// GOL-3315: a Printify cart is printed when ordered, so the order line must
// not say "ships now" or mention pickup; every other cart keeps its wording.
describe("orderTypeLine — fulfillment route", () => {
  const base = { kind: "immediate" as const, wave: null, depositNow: false, pickup: false };

  it("words a Printify cart as printed to order", () => {
    expect(orderTypeLine({ ...base, route: "printify" })).toBe(
      "Printed to order · ships from our print partner · charged in full",
    );
  });

  it("keeps the in-house wording when the route is in_house, null or absent", () => {
    const expected = "Ships now or ready for pickup · charged in full";
    expect(orderTypeLine({ ...base, route: "in_house" })).toBe(expected);
    expect(orderTypeLine({ ...base, route: null })).toBe(expected);
    expect(orderTypeLine(base)).toBe(expected);
  });

  it("never overrides a deposit or pre-order line", () => {
    expect(orderTypeLine({ ...base, depositNow: true, route: "printify" })).toContain("$10 deposit today");
    expect(orderTypeLine({ ...base, kind: "preorder", wave: "fall", route: "printify" })).toContain("fall wave");
  });
});
