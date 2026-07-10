import { describe, it, expect, vi } from "vitest";
import { createMailerLiteProvider } from "./mailerlite";
import type { MailerLiteConfig } from "./config";
import type { OptInRequest } from "./types";

const config: MailerLiteConfig = {
  apiKey: "key_abc",
  baseUrl: "https://ml.test/api",
  doubleOptIn: true,
  groups: { "brand:nursery": "g-nursery", "interest:produce": "g-produce" },
};

const baseRequest: OptInRequest = {
  email: "sam@example.com",
  name: "Sam",
  brand: "nursery",
  interests: ["produce"],
  source: "newsletter-signup",
  consent: true,
};

function okResponse(id: number | string) {
  return new Response(JSON.stringify({ data: { id } }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}

describe("createMailerLiteProvider.subscribe", () => {
  it("POSTs email, resolved groups, name field, and bearer auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(555));
    const provider = createMailerLiteProvider(config, fetchMock as unknown as typeof fetch);

    const result = await provider.subscribe(baseRequest);

    expect(result).toEqual({ ok: true, id: "555" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://ml.test/api/subscribers");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer key_abc");
    const body = JSON.parse(init.body);
    expect(body.email).toBe("sam@example.com");
    expect(body.groups).toEqual(["g-nursery", "g-produce"]);
    expect(body.fields.name).toBe("Sam");
    // double opt-in on → unconfirmed
    expect(body.status).toBe("unconfirmed");
  });

  it("sends status=active when double opt-in is disabled", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(1));
    const provider = createMailerLiteProvider(
      { ...config, doubleOptIn: false },
      fetchMock as unknown as typeof fetch,
    );
    await provider.subscribe(baseRequest);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).status).toBe("active");
  });

  it("passes attribution through as custom fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(2));
    const provider = createMailerLiteProvider(config, fetchMock as unknown as typeof fetch);
    await provider.subscribe({
      ...baseRequest,
      attribution: { utm_source: "market", utm_campaign: "spring" },
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.fields.utm_source).toBe("market");
    expect(body.fields.utm_campaign).toBe("spring");
  });

  it("returns a failure outcome (not a throw) on a non-2xx response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("bad key", { status: 401, statusText: "Unauthorized" }));
    const provider = createMailerLiteProvider(config, fetchMock as unknown as typeof fetch);
    const result = await provider.subscribe(baseRequest);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("401");
  });

  it("returns a failure outcome when fetch itself throws", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const provider = createMailerLiteProvider(config, fetchMock as unknown as typeof fetch);
    const result = await provider.subscribe(baseRequest);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("ECONNREFUSED");
  });
});
