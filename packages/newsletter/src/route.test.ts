import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createNewsletterSubscribeRoute } from "./route";
import { resetCaptureAlertThrottle } from "./alert";

const ORIGIN = "https://atthegrovenursery.com";

function post(body: unknown, origin: string | null = ORIGIN): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (origin) headers.origin = origin;
  return new Request(`${ORIGIN}/api/newsletter/subscribe`, {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const ENV = { ODOO_URL: "https://odoo.test", ODOO_API_KEY: "key-123" };

const validBody = {
  email: "sam@example.com",
  interests: ["produce"],
  label: "nursery-footer",
  source: "footer",
  consent: true,
};

function odooOk(lists: string[]) {
  return vi.fn<typeof fetch>(async () =>
    new Response(JSON.stringify({ partner_id: 7, created: true, lists, welcomed: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
}

describe("createNewsletterSubscribeRoute (GOL-3456)", () => {
  beforeEach(() => resetCaptureAlertThrottle());
  afterEach(() => vi.unstubAllGlobals());

  const route = (env: Record<string, string> = ENV) =>
    createNewsletterSubscribeRoute({
      brand: "nursery",
      tenantId: "nursery",
      allowedOrigins: [ORIGIN],
      env,
      fetchImpl: vi.fn() as unknown as typeof fetch,
    });

  it("returns 400 on invalid JSON and on missing consent", async () => {
    const { POST } = route();
    expect((await POST(post("{not json"))).status).toBe(400);
    const res = await POST(post({ ...validBody, consent: false }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "validation_error", field: "consent" });
  });

  it("refuses a missing or foreign Origin before touching Odoo", async () => {
    const fetchMock = odooOk(["nursery"]);
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = route();
    expect((await POST(post(validBody, null))).status).toBe(403);
    expect((await POST(post(validBody, "https://evil.example"))).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 503 + fires the alert when Odoo is not provisioned", async () => {
    const alertHook = vi.fn<typeof fetch>(async () => new Response("", { status: 204 }));
    const { POST } = createNewsletterSubscribeRoute({
      brand: "nursery",
      tenantId: "nursery",
      env: { CAPTURE_ALERT_WEBHOOK_URL: "https://hooks.test/x" },
      fetchImpl: alertHook,
    });
    const res = await POST(post(validBody));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("newsletter_not_configured");
    expect(alertHook).toHaveBeenCalledTimes(1);
    expect(String(alertHook.mock.calls[0]![0])).toBe("https://hooks.test/x");
  });

  it("pins the brand server-side and sends the brand's own list by default", async () => {
    const fetchMock = odooOk(["nursery"]);
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = route();
    // A body that tries to pick another brand is ignored.
    const res = await POST(post({ ...validBody, brand: "goldberry", hubOptIn: true }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, lists: ["nursery"], welcomed: true, subscriberId: "7" });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://odoo.test/grove/api/v1/newsletter/subscribe");
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Grove-Tenant"]).toBe("nursery");
    expect(headers["Authorization"]).toBe("Bearer key-123");
    expect(JSON.parse(String(init.body))).toMatchObject({
      brand: "nursery",
      lists: ["nursery"],
      multibrand: false,
      consent: true,
      source: "footer",
      attribution: { form: "nursery-footer" },
    });
  });

  it("expands the multibrand checkbox into every other list", async () => {
    const fetchMock = odooOk(["nursery", "farm", "digest"]);
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = route();
    const res = await POST(post({ ...validBody, multibrand: true }));
    expect((await res.json()).lists).toEqual(["nursery", "farm", "digest"]);
    const init = fetchMock.mock.calls[0]![1]!;
    expect(JSON.parse(String(init.body))).toMatchObject({
      lists: ["nursery", "farm", "digest"],
      multibrand: true,
    });
  });

  it("returns 502 + alerts when Odoo rejects or is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));
    const alertHook = vi.fn<typeof fetch>(async () => new Response("", { status: 204 }));
    const { POST } = createNewsletterSubscribeRoute({
      brand: "goldberry",
      tenantId: "goldberry",
      env: { ...ENV, CAPTURE_ALERT_WEBHOOK_URL: "https://hooks.test/x" },
      fetchImpl: alertHook,
    });
    const res = await POST(post(validBody));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("subscribe_failed");
    expect(alertHook).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(alertHook.mock.calls[0]![1]!.body));
    expect(body.content).toContain("ALERT goldberry /api/newsletter/subscribe -> 502");
  });
});
