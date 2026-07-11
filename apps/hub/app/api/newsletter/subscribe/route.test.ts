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
