// @vitest-environment happy-dom
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCartDepositQuote } from "./useCartDepositQuote";

/**
 * Live Printify shipping on the farm checkout (GOL-3315). The hook sends the
 * ship-to state beside the ZIP once both are complete and exposes the backend's
 * `shippingAmount`; a relayed 409 / 503 surfaces as the shopper-facing `error`
 * exactly like a 400, so the checkout blocks submit with the backend's words.
 */

const items = [{ variantId: 1, templateId: 7, name: "Grove Tee", price: 28, imageUrl: "", quantity: 1 }];
const reply = (status: number, body: unknown) =>
  ({ ok: status < 400, status, json: async () => body }) as unknown as Response;
const unavailable = "Shipping is temporarily unavailable. Try again in a few minutes.";

afterEach(() => vi.restoreAllMocks());

describe("useCartDepositQuote — Printify state and shipping amount", () => {
  it("sends state and exposes shippingAmount and fulfillmentRoute", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      reply(200, { depositNow: false, depositReason: null, amountDueToday: null, shippingAmount: 4.75, fulfillmentRoute: "printify" }),
    );
    const { result } = renderHook(() =>
      useCartDepositQuote("/api/cart/quote", items as never, "ship", null, "90001", "ca"),
    );
    await waitFor(() => expect(result.current.quote?.shippingAmount).toBe(4.75));
    expect(result.current.quote?.fulfillmentRoute).toBe("printify");
    expect(result.current.settled).toBe(true);
    expect(JSON.parse(String((spy.mock.calls[0] as [string, RequestInit])[1].body))).toMatchObject({ zip: "90001", state: "CA" });
  });

  it.each([409, 503])("surfaces a relayed %i message as error and stays unsettled", async (status) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(reply(status, { error: unavailable }));
    const { result } = renderHook(() =>
      useCartDepositQuote("/api/cart/quote", items as never, "ship", null, "90001", "CA"),
    );
    await waitFor(() => expect(result.current.error).toBe(unavailable));
    expect(result.current.failed).toBe(false);
    expect(result.current.settled).toBe(false);
    expect(result.current.quote).toBeNull();
  });

  it("treats a 503 without a message as a plain failure (no invented copy)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(reply(503, {}));
    const { result } = renderHook(() =>
      useCartDepositQuote("/api/cart/quote", items as never, "ship", null, "90001", "CA"),
    );
    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.error).toBeNull();
  });

  it("does not send a partial or non-alphabetic state", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      reply(200, { depositNow: false, depositReason: null, amountDueToday: null }),
    );
    renderHook(() => useCartDepositQuote("/api/cart/quote", items as never, "ship", null, "90001", "C"));
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(JSON.parse(String((spy.mock.calls[0] as [string, RequestInit])[1].body)).state).toBeUndefined();
  });

  it("drops the state for a pickup quote", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      reply(200, { depositNow: false, depositReason: null, amountDueToday: null }),
    );
    renderHook(() => useCartDepositQuote("/api/cart/quote", items as never, "pickup", null, "90001", "CA"));
    await waitFor(() => expect(spy).toHaveBeenCalled());
    const body = JSON.parse(String((spy.mock.calls[0] as [string, RequestInit])[1].body));
    expect(body.state).toBeUndefined();
    expect(body.zip).toBeUndefined();
  });

  it("re-quotes when the state changes (the key includes it)", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      reply(200, { depositNow: false, depositReason: null, amountDueToday: null, shippingAmount: 4.75 }),
    );
    const { result, rerender } = renderHook(
      ({ state }: { state: string }) => useCartDepositQuote("/api/cart/quote", items as never, "ship", null, "90001", state),
      { initialProps: { state: "CA" } },
    );
    await waitFor(() => expect(result.current.settled).toBe(true));
    rerender({ state: "NY" });
    expect(result.current.settled).toBe(false);
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String((spy.mock.calls[1] as [string, RequestInit])[1].body)).state).toBe("NY");
  });
});
