import { describe, it, expect, vi, afterEach } from "vitest";
import { createOdooCrmSync, resolveOdooCrmConfig } from "./odoo";
import { validateOptIn } from "./capture";
import type { OptInRequest } from "./types";

const req: OptInRequest = validateOptIn({
  email: "Sam@Example.com ",
  name: " Sam ",
  brand: "nursery",
  interests: ["produce", "events"],
  source: "checkout",
  consent: true,
  attribution: { utm_source: "ig" },
});

const target = {
  odooUrl: "https://odoo.test",
  tenantId: "nursery",
  apiKey: "key-123",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("resolveOdooCrmConfig", () => {
  it("resolves a target from env + tenant, stripping the trailing slash", () => {
    const t = resolveOdooCrmConfig("nursery", {
      ODOO_URL: "https://odoo.test/",
      ODOO_API_KEY: "key-123",
    });
    expect(t).toEqual({
      odooUrl: "https://odoo.test",
      tenantId: "nursery",
      apiKey: "key-123",
    });
  });

  it("returns null when the URL or API key is missing", () => {
    expect(resolveOdooCrmConfig("nursery", { ODOO_URL: "https://odoo.test" })).toBeNull();
    expect(resolveOdooCrmConfig("nursery", { ODOO_API_KEY: "k" })).toBeNull();
    expect(resolveOdooCrmConfig("", { ODOO_URL: "u", ODOO_API_KEY: "k" })).toBeNull();
  });
});

// createOdooCrmSync now delegates the transport to `@grove/odoo-client`, whose
// shared `api()` helper uses the global `fetch`. So the tests stub the global
// rather than injecting a fetch impl — proving the adapter still shapes headers,
// body, and errors correctly through the real client.
describe("createOdooCrmSync", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs a consented opt-in with tenant + bearer headers and returns the partner id", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      void init;
      return jsonResponse({ partner_id: 42, created: true });
    });
    vi.stubGlobal("fetch", fetchMock);
    const sync = createOdooCrmSync(target);

    const outcome = await sync.subscribe(req);

    expect(outcome).toEqual({ ok: true, id: "42" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://odoo.test/grove/api/v1/newsletter/subscribe");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Grove-Tenant"]).toBe("nursery");
    expect(headers["Authorization"]).toBe("Bearer key-123");
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      email: "sam@example.com", // normalized by validateOptIn
      name: "Sam",
      brand: "nursery",
      interests: ["produce", "events"],
      source: "checkout",
      consent: true,
      attribution: { utm_source: "ig" },
    });
  });

  it("succeeds even when the response carries no partner id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ email: "sam@example.com", created: true })),
    );
    const sync = createOdooCrmSync(target);
    expect(await sync.subscribe(req)).toEqual({ ok: true });
  });

  it("reports a non-2xx as a best-effort failure without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "boom" }, 500)),
    );
    const sync = createOdooCrmSync(target);
    const outcome = await sync.subscribe(req);
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toContain("odoo 500");
  });

  it("reports a network error as a best-effort failure without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );
    const sync = createOdooCrmSync(target);
    const outcome = await sync.subscribe(req);
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toContain("ECONNREFUSED");
  });
});
