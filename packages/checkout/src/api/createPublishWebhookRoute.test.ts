import { describe, it, expect, vi } from "vitest";
import { createHmac } from "node:crypto";
import { createPublishWebhookRoute } from "./createPublishWebhookRoute";

const SECRET = "test-secret-goldberry";

function sign(rawBody: string, secret = SECRET): string {
  return "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
}

function makeRequest(
  rawBody: string,
  headers: Record<string, string> = {},
): Request {
  return new Request("https://goldberrygrove.farm/api/webhooks/publish", {
    method: "POST",
    body: rawBody,
    headers,
  });
}

const VALID_BODY = JSON.stringify({
  event: "guide.publish",
  delivery_id: "d-1",
  tenant: "goldberry",
  kind: "product",
  product: { id: 42, template_id: 42, slug: "american-persimmon", name: "American Persimmon" },
  guide_ready: true,
});

function makeRoute(overrides: Partial<Parameters<typeof createPublishWebhookRoute>[0]> = {}) {
  const revalidate = vi.fn();
  const POST = createPublishWebhookRoute({
    secret: SECRET,
    tenant: "goldberry",
    revalidate,
    ...overrides,
  });
  return { POST, revalidate };
}

describe("createPublishWebhookRoute", () => {
  it("revalidates the product page + listing on a valid signed request", async () => {
    const { POST, revalidate } = makeRoute();
    const res = await POST(
      makeRequest(VALID_BODY, {
        "x-grove-event": "guide.publish",
        "x-grove-delivery": "d-1",
        "x-grove-signature-256": sign(VALID_BODY),
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      tenant: "goldberry",
      revalidated: ["/shop/42", "/shop"],
    });
    expect(revalidate).toHaveBeenCalledWith("/shop/42");
    expect(revalidate).toHaveBeenCalledWith("/shop");
  });

  it("revalidates the same two paths on a product.availability event (GOL-1896)", async () => {
    const { POST, revalidate } = makeRoute();
    const body = JSON.stringify({
      event: "product.availability",
      delivery_id: "avail-1",
      tenant: "goldberry",
      kind: "product",
      product: { id: 7, template_id: 7, slug: "pawpaw", name: "Pawpaw" },
    });
    const res = await POST(
      makeRequest(body, {
        "x-grove-event": "product.availability",
        "x-grove-delivery": "avail-1",
        "x-grove-signature-256": sign(body),
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      tenant: "goldberry",
      revalidated: ["/shop/7", "/shop"],
    });
    expect(revalidate).toHaveBeenCalledWith("/shop/7");
    expect(revalidate).toHaveBeenCalledWith("/shop");
  });

  it("reads the event type from the body when the header is absent", async () => {
    const { POST, revalidate } = makeRoute();
    const body = JSON.stringify({
      event: "product.availability",
      product: { id: 7 },
    });
    const res = await POST(
      makeRequest(body, { "x-grove-signature-256": sign(body) }),
    );
    expect(res.status).toBe(200);
    expect(revalidate).toHaveBeenCalledWith("/shop/7");
  });

  it("401s a bad signature and does no work", async () => {
    const { POST, revalidate } = makeRoute();
    const res = await POST(
      makeRequest(VALID_BODY, {
        "x-grove-signature-256": sign(VALID_BODY, "wrong-secret"),
      }),
    );
    expect(res.status).toBe(401);
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("401s a tampered body (signature over original bytes)", async () => {
    const { POST, revalidate } = makeRoute();
    const goodSig = sign(VALID_BODY);
    const tampered = VALID_BODY.replace('"id":42', '"id":99');
    const res = await POST(
      makeRequest(tampered, { "x-grove-signature-256": goodSig }),
    );
    expect(res.status).toBe(401);
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("401s a missing signature header", async () => {
    const { POST } = makeRoute();
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("401s when the configured secret is empty (fail closed)", async () => {
    const { POST } = makeRoute({ secret: "" });
    const res = await POST(
      makeRequest(VALID_BODY, { "x-grove-signature-256": sign(VALID_BODY, "") }),
    );
    expect(res.status).toBe(401);
  });

  it("400s invalid JSON even with a valid signature", async () => {
    const { POST } = makeRoute();
    const raw = "not json";
    const res = await POST(
      makeRequest(raw, { "x-grove-signature-256": sign(raw) }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_json");
  });

  it("400s an unknown event type", async () => {
    const { POST } = makeRoute();
    const raw = JSON.stringify({ event: "something.else", product: { id: 1 } });
    const res = await POST(
      makeRequest(raw, {
        "x-grove-event": "something.else",
        "x-grove-signature-256": sign(raw),
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("unknown_event");
  });

  it("400s a body missing a valid product id", async () => {
    const { POST } = makeRoute();
    const raw = JSON.stringify({ event: "guide.publish", product: { id: 0 } });
    const res = await POST(
      makeRequest(raw, {
        "x-grove-event": "guide.publish",
        "x-grove-signature-256": sign(raw),
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("missing_product");
  });

  it("dedupes a repeated delivery id without re-revalidating", async () => {
    const { POST, revalidate } = makeRoute();
    const headers = {
      "x-grove-event": "guide.publish",
      "x-grove-delivery": "dupe-1",
      "x-grove-signature-256": sign(VALID_BODY),
    };
    const first = await POST(makeRequest(VALID_BODY, headers));
    expect(first.status).toBe(200);
    expect(revalidate).toHaveBeenCalledTimes(2);

    revalidate.mockClear();
    const second = await POST(makeRequest(VALID_BODY, headers));
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ ok: true, deduped: true });
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("evicts oldest delivery ids past the dedupe cap", async () => {
    const { POST } = makeRoute({ dedupeCap: 2 });
    const post = (delivery: string) =>
      POST(
        makeRequest(VALID_BODY, {
          "x-grove-event": "guide.publish",
          "x-grove-delivery": delivery,
          "x-grove-signature-256": sign(VALID_BODY),
        }),
      );
    await post("a"); // seen: {a}
    await post("b"); // seen: {a,b}
    await post("c"); // seen: {b,c} — a evicted
    const replayA = await post("a"); // a evicted → treated as fresh (200, not deduped)
    expect(replayA.status).toBe(200);
    expect((await replayA.json()).deduped).toBeUndefined();
  });
});
