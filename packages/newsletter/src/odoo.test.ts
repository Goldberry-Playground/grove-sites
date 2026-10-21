import { describe, it, expect, vi, afterEach } from "vitest";
import { createOdooNewsletterProvider, resolveOdooNewsletterTarget } from "./odoo";
import { validateOptIn } from "./capture";
import type { OptInRequest } from "./types";

const req: OptInRequest = validateOptIn({
  email: "Sam@Example.com ",
  name: " Sam ",
  brand: "nursery",
  interests: ["produce", "events"],
  source: "footer",
  label: "nursery-general",
  multibrand: true,
  consent: true,
  attribution: { utm_source: "ig" },
});

const target = { odooUrl: "https://odoo.test", tenantId: "nursery", apiKey: "key-123" };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("resolveOdooNewsletterTarget", () => {
  it("resolves a target from env + tenant, stripping the trailing slash", () => {
    expect(
      resolveOdooNewsletterTarget("nursery", { ODOO_URL: "https://odoo.test/", ODOO_API_KEY: "key-123" }),
    ).toEqual(target);
  });

  it("accepts the hub's GROVE_ODOO_URL name", () => {
    expect(
      resolveOdooNewsletterTarget("hub", { GROVE_ODOO_URL: "https://odoo.test", ODOO_API_KEY: "k" }),
    ).toEqual({ odooUrl: "https://odoo.test", tenantId: "hub", apiKey: "k" });
  });

  it("returns null when the URL, the API key, or the tenant is missing", () => {
    expect(resolveOdooNewsletterTarget("nursery", { ODOO_URL: "https://odoo.test" })).toBeNull();
    expect(resolveOdooNewsletterTarget("nursery", { ODOO_API_KEY: "k" })).toBeNull();
    expect(resolveOdooNewsletterTarget("", { ODOO_URL: "u", ODOO_API_KEY: "k" })).toBeNull();
  });
});

// The provider delegates transport to `@grove/odoo-client`, whose shared `api()`
// helper uses the global `fetch`, so the tests stub the global and prove the
// adapter still shapes headers, body and errors through the real client.
describe("createOdooNewsletterProvider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("POSTs the opt-in with tenant + bearer headers, explicit lists, and the form label", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ partner_id: 42, created: true, lists: ["nursery", "farm", "digest"], welcomed: true }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const out = await createOdooNewsletterProvider(target).subscribe(req, ["nursery", "farm", "digest"]);
    expect(out).toEqual({ ok: true, partnerId: "42", lists: ["nursery", "farm", "digest"], welcomed: true });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://odoo.test/grove/api/v1/newsletter/subscribe");
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Grove-Tenant"]).toBe("nursery");
    expect(headers["Authorization"]).toBe("Bearer key-123");
    expect(JSON.parse(String(init.body))).toEqual({
      email: "sam@example.com",
      name: "Sam",
      brand: "nursery",
      interests: ["produce", "events"],
      source: "footer",
      consent: true,
      lists: ["nursery", "farm", "digest"],
      multibrand: true,
      attribution: { utm_source: "ig", form: "nursery-general" },
    });
  });

  it("drops unknown list keys Odoo might echo and treats a missing welcomed as false", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ partner_id: 1, lists: ["nursery", "zzz"] })));
    const out = await createOdooNewsletterProvider(target).subscribe(req, ["nursery"]);
    expect(out).toEqual({ ok: true, partnerId: "1", lists: ["nursery"], welcomed: false });
  });

  it("returns ok:false with the upstream status on a non-2xx instead of throwing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "unknown list key" }, 400)));
    const out = await createOdooNewsletterProvider(target).subscribe(req, ["nursery"]);
    expect(out.ok).toBe(false);
    expect(out.status).toBe(400);
    expect(out.error).toMatch(/^odoo 400/);
  });

  it("returns ok:false on a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNREFUSED"); }));
    const out = await createOdooNewsletterProvider(target).subscribe(req, ["nursery"]);
    expect(out.ok).toBe(false);
    expect(out.error).toContain("ECONNREFUSED");
  });
});
