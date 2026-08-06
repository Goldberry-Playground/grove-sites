import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";

function post(body: unknown): Request {
  return new Request("http://localhost/api/newsletter/subscribe", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const INSTANCES = JSON.stringify({
  grove: { url: "https://hub.test" },
  nursery: { url: "https://nursery.test" },
});

const validBody = {
  email: "sam@example.com",
  brand: "nursery",
  interests: ["produce"],
  label: "nursery-footer",
  consent: true,
};

function clearEnv() {
  delete process.env.GHOST_NEWSLETTER_INSTANCES;
  delete process.env.GHOST_URL;
  // Keep the Odoo CRM leg off unless a test opts in, so `crmSynced` is
  // deterministically null and the Ghost-only call count holds.
  delete process.env.ODOO_URL;
  delete process.env.ODOO_API_KEY;
}

describe("POST /api/newsletter/subscribe", () => {
  beforeEach(clearEnv);
  afterEach(() => {
    vi.unstubAllGlobals();
    clearEnv();
  });

  it("returns 400 on invalid JSON", async () => {
    const res = await POST(post("{not json"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_json");
  });

  it("returns 400 without consent", async () => {
    const res = await POST(post({ ...validBody, consent: false }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("validation_error");
    expect(json.field).toBe("consent");
  });

  it("returns 503 when Ghost is not provisioned", async () => {
    const res = await POST(post(validBody));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("newsletter_not_configured");
  });

  it("writes the brand member and reports no hub sync without opt-in", async () => {
    process.env.GHOST_NEWSLETTER_INSTANCES = INSTANCES;
    const fetchMock = vi.fn(
      async (_url: string, _init?: { body?: string }) =>
        new Response("Created.", { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(post(validBody));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      subscriberId: null,
      hubSynced: null,
      crmSynced: null,
    });

    // Exactly one Ghost write, to the nursery instance, with the form label.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://nursery.test/members/api/send-magic-link/");
    expect(JSON.parse(init!.body!).labels).toEqual(["nursery-footer", "interest-produce"]);
  });

  it("dual-writes to the hub on explicit hub opt-in", async () => {
    process.env.GHOST_NEWSLETTER_INSTANCES = INSTANCES;
    const fetchMock = vi.fn(
      async (_url: string) => new Response("Created.", { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(post({ ...validBody, hubOptIn: true }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      subscriberId: null,
      hubSynced: true,
      crmSynced: null,
    });

    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls).toContain("https://nursery.test/members/api/send-magic-link/");
    expect(urls).toContain("https://hub.test/members/api/send-magic-link/");
  });

  it("returns 200 (subscriber kept) when only the hub dual-write fails", async () => {
    process.env.GHOST_NEWSLETTER_INSTANCES = INSTANCES;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("https://hub.test")) {
        return new Response("boom", { status: 500, statusText: "Server Error" });
      }
      return new Response("Created.", { status: 201 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(post({ ...validBody, hubOptIn: true }));
    expect(res.status).toBe(200);
    expect((await res.json()).hubSynced).toBe(false);
  });

  it("syncs the opt-in to Odoo CRM and reports crmSynced when Odoo is wired", async () => {
    process.env.GHOST_NEWSLETTER_INSTANCES = INSTANCES;
    process.env.ODOO_URL = "https://odoo.test";
    process.env.ODOO_API_KEY = "key-123";
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      void init;
      if (url.includes("/grove/api/v1/newsletter/subscribe")) {
        return new Response(JSON.stringify({ partner_id: 7 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("Created.", { status: 201 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(post(validBody));
    expect(res.status).toBe(200);
    expect((await res.json()).crmSynced).toBe(true);

    const odooCall = fetchMock.mock.calls.find((c) =>
      String(c[0]).includes("/grove/api/v1/newsletter/subscribe"),
    );
    expect(odooCall).toBeDefined();
    const init = odooCall![1];
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Grove-Tenant"]).toBe("hub");
    expect(headers["Authorization"]).toBe("Bearer key-123");
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ brand: "nursery", consent: true });
  });

  it("returns 502 when the brand write fails", async () => {
    process.env.GHOST_NEWSLETTER_INSTANCES = INSTANCES;
    const fetchMock = vi.fn(
      async () => new Response("bad", { status: 500, statusText: "Server Error" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(post(validBody));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("subscribe_failed");
  });
});
