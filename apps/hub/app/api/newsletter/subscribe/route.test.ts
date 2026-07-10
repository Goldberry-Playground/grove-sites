import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";

function post(body: unknown): Request {
  return new Request("http://localhost/api/newsletter/subscribe", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const validBody = {
  email: "sam@example.com",
  brand: "grove",
  interests: ["produce"],
  consent: true,
};

describe("POST /api/newsletter/subscribe", () => {
  beforeEach(() => {
    delete process.env.MAILERLITE_API_KEY;
    delete process.env.MAILERLITE_GROUPS;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.MAILERLITE_API_KEY;
    delete process.env.MAILERLITE_GROUPS;
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

  it("returns 503 when MailerLite is not provisioned", async () => {
    const res = await POST(post(validBody));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("newsletter_not_configured");
  });

  it("subscribes and reports crm health on the happy path", async () => {
    process.env.MAILERLITE_API_KEY = "key_test";
    process.env.MAILERLITE_GROUPS = '{"brand:grove":"g1","interest:produce":"p1"}';

    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/subscribers")) {
        return new Response(JSON.stringify({ data: { id: 99 } }), { status: 201 });
      }
      // Odoo CRM endpoint (not built yet) → 404, best-effort miss.
      return new Response("not found", { status: 404, statusText: "Not Found" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(post(validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true, subscriberId: "99", crmSynced: false });

    // MailerLite got the resolved groups.
    const mlCall = fetchMock.mock.calls.find((c) => String(c[0]).includes("/subscribers"));
    expect(JSON.parse(mlCall![1].body).groups).toEqual(["g1", "p1"]);
  });
});
