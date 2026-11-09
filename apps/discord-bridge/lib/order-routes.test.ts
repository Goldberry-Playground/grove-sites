import { describe, it, expect, vi } from "vitest";
import { DiscordApiError } from "./discord";
import { orderAlertRoute, orderCardEditRoute, type OrderRouteDeps } from "./order-routes";

const CHANNELS = { "1": "111111111111" };
const BODY = { orderId: 42, orderRef: "S00042", companyId: 1, lines: [], total: 5, lane: "spring", zone: "6" };
const MESSAGE_ID = "1500000000000000001";

function deps(over: Partial<OrderRouteDeps> = {}): OrderRouteDeps {
  return {
    secret: "s3cret",
    channels: CHANNELS,
    post: vi.fn().mockResolvedValue(MESSAGE_ID),
    edit: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}
const read = (body: unknown) => async () => JSON.stringify(body);

describe("POST /orders/alert", () => {
  it("answers with the id of the message it posted", async () => {
    const d = deps();
    const reply = await orderAlertRoute("s3cret", read(BODY), d);
    expect(reply).toEqual({ status: 200, body: { ok: true, channel_id: "111111111111", message_id: MESSAGE_ID } });
    expect(d.post).toHaveBeenCalledOnce();
  });

  it.each([["wrong"], ["s3cret-and-more"], [undefined]])("refuses the secret %s and posts nothing", async (provided) => {
    const d = deps();
    const reply = await orderAlertRoute(provided, read(BODY), d);
    expect(reply.status).toBe(401);
    expect(d.post).not.toHaveBeenCalled();
  });

  it("is inert with no secret configured", async () => {
    expect((await orderAlertRoute("x", read(BODY), deps({ secret: undefined }))).status).toBe(503);
  });

  it("an unmapped company is 422", async () => {
    expect((await orderAlertRoute("s3cret", read({ ...BODY, companyId: 9 }), deps())).status).toBe(422);
  });

  it("a body without the ids is 400", async () => {
    expect((await orderAlertRoute("s3cret", read({ orderRef: "S1" }), deps())).status).toBe(400);
  });
});

describe("POST /orders/alert/edit", () => {
  const body = { ...BODY, tracking: "1Z111", carrier: "UPS", messageId: MESSAGE_ID };

  it("re-renders the card from the payload and edits that message", async () => {
    const d = deps();
    const reply = await orderCardEditRoute("s3cret", read(body), d);
    expect(reply).toEqual({ status: 200, body: { ok: true } });
    const [channelId, messageId, message] = (d.edit as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(channelId).toBe("111111111111");
    expect(messageId).toBe(MESSAGE_ID);
    const labels = message.components[0].components.map((b: { label: string }) => b.label);
    expect(labels).toEqual(["Mark shipped", "Hold", "Label refunded"]);
  });

  it("a shipped order's card comes back with no buttons", async () => {
    const d = deps();
    await orderCardEditRoute("s3cret", read({ ...body, shipped: true }), d);
    expect((d.edit as ReturnType<typeof vi.fn>).mock.calls[0][2].components).toEqual([]);
  });

  it.each([["wrong"], [undefined]])("refuses the secret %s and edits nothing", async (provided) => {
    const d = deps();
    expect((await orderCardEditRoute(provided, read(body), d)).status).toBe(401);
    expect(d.edit).not.toHaveBeenCalled();
  });

  it.each([[undefined], ["abc"], ["../../x"]])("refuses the message id %s", async (messageId) => {
    const d = deps();
    expect((await orderCardEditRoute("s3cret", read({ ...body, messageId }), d)).status).toBe(400);
    expect(d.edit).not.toHaveBeenCalled();
  });

  it("an unmapped company is 422", async () => {
    expect((await orderCardEditRoute("s3cret", read({ ...body, companyId: 9 }), deps())).status).toBe(422);
  });

  it("a message Discord no longer has is 410, so Odoo stops retrying", async () => {
    const d = deps({ edit: vi.fn().mockRejectedValue(new DiscordApiError("gone", 404)) });
    expect((await orderCardEditRoute("s3cret", read(body), d)).status).toBe(410);
  });

  it("any other Discord failure propagates, so Odoo retries", async () => {
    const d = deps({ edit: vi.fn().mockRejectedValue(new DiscordApiError("nope", 500)) });
    await expect(orderCardEditRoute("s3cret", read(body), d)).rejects.toThrow("nope");
  });
});
