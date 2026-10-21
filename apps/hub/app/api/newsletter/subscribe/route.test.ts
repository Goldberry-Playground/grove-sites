import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";

// The handler itself is covered in @grove/newsletter (route.test.ts). This
// pins what the HUB mounts: brand `grove` → Grove Digest primary, tenant
// `hub`, the hub's Origin allowlist, and the hub's GROVE_ODOO_URL env name.

const ORIGIN = "https://gatheringatthegrove.com";

function post(body: unknown, origin = ORIGIN): Request {
  return new Request("http://localhost/api/newsletter/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(body),
  });
}

const validBody = { email: "sam@example.com", label: "hub-digest", source: "footer", consent: true };

function clearEnv() {
  delete process.env.ODOO_URL;
  delete process.env.GROVE_ODOO_URL;
  delete process.env.ODOO_API_KEY;
  delete process.env.CAPTURE_ALERT_WEBHOOK_URL;
}

describe("hub POST /api/newsletter/subscribe", () => {
  beforeEach(clearEnv);
  afterEach(() => {
    vi.unstubAllGlobals();
    clearEnv();
  });

  it("returns 503 when Odoo is not provisioned for the hub", async () => {
    const res = await POST(post(validBody));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("newsletter_not_configured");
  });

  it("subscribes to the Grove Digest as tenant `hub` via GROVE_ODOO_URL, ignoring a body brand", async () => {
    process.env.GROVE_ODOO_URL = "https://odoo.test";
    process.env.ODOO_API_KEY = "key-123";
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ partner_id: 7, lists: ["digest"], welcomed: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(post({ ...validBody, brand: "nursery" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, lists: ["digest"], welcomed: true, subscriberId: "7" });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://odoo.test/grove/api/v1/newsletter/subscribe");
    expect((init!.headers as Record<string, string>)["X-Grove-Tenant"]).toBe("hub");
    expect(JSON.parse(String(init!.body))).toMatchObject({ brand: "grove", lists: ["digest"], multibrand: false });
  });

  it("expands the multibrand box to Digest + Nursery News + Farm News", async () => {
    process.env.GROVE_ODOO_URL = "https://odoo.test";
    process.env.ODOO_API_KEY = "key-123";
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ partner_id: 7, lists: ["digest", "nursery", "farm"] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await POST(post({ ...validBody, multibrand: true }));
    const init = fetchMock.mock.calls[0]![1]!;
    expect(JSON.parse(String(init.body)).lists).toEqual(["digest", "nursery", "farm"]);
  });

  it("refuses a foreign Origin", async () => {
    expect((await POST(post(validBody, "https://evil.example"))).status).toBe(403);
  });
});
