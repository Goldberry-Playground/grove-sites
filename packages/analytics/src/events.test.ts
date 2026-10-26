import { beforeEach, describe, expect, it, vi } from "vitest";

// Capture what reaches the dual-writer without standing up any sink.
const emit = vi.fn();
vi.mock("./sinks", () => ({ emit: (...args: unknown[]) => emit(...args) }));

// `events.ts` keeps a module-level dedupe Set, so each test re-imports it fresh.
async function freshEvents() {
  vi.resetModules();
  emit.mockClear();
  return import("./events");
}

describe("funnel event dedupe", () => {
  beforeEach(() => {
    emit.mockClear();
  });

  it("emits begin_checkout once even when the buyer submits twice", async () => {
    const { trackBeginCheckout } = await freshEvents();
    trackBeginCheckout({ itemCount: 2, subtotal: 40 });
    trackBeginCheckout({ itemCount: 2, subtotal: 40 });
    const starts = emit.mock.calls.filter(([name]) => name === "begin_checkout");
    expect(starts).toHaveLength(1);
    expect(starts[0][1]).toEqual({ item_count: 2, subtotal: 40 });
  });

  it("dedupes checkout_error per stage — same stage once, a new stage still records", async () => {
    const { trackCheckoutError } = await freshEvents();
    trackCheckoutError({ stage: "network" });
    trackCheckoutError({ stage: "network" }); // retry of the same failing step
    trackCheckoutError({ stage: "session" }); // a different failure still counts
    const errors = emit.mock.calls.filter(([name]) => name === "checkout_error");
    expect(errors).toHaveLength(2);
    expect(errors.map((c) => c[1].stage)).toEqual(["network", "session"]);
  });

  it("never ships the raw error message — only a low-cardinality stage/code", async () => {
    const { trackCheckoutError } = await freshEvents();
    trackCheckoutError({ stage: "session", code: "502" });
    const [, props] = emit.mock.calls.find(([name]) => name === "checkout_error")!;
    expect(props).toEqual({ stage: "session", code: "502" });
  });

  it("does not dedupe add_to_cart — each add is a real signal", async () => {
    const { trackAddToCart } = await freshEvents();
    trackAddToCart({ variantId: 10, price: 5, quantity: 1 });
    trackAddToCart({ variantId: 10, price: 5, quantity: 1 });
    expect(emit.mock.calls.filter(([name]) => name === "add_to_cart")).toHaveLength(2);
  });
});

describe("trackPurchase", () => {
  it("ships SHA-256(order_id_hash) and never the raw order name", async () => {
    const { trackPurchase } = await freshEvents();
    await trackPurchase({ orderName: "SO0042", itemCount: 3, total: 99 });
    const [, props] = emit.mock.calls.find(([name]) => name === "purchase")!;
    expect(props.order_id_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(props)).not.toContain("SO0042");
  });
});
