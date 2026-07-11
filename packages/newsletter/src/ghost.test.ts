import { describe, it, expect, vi } from "vitest";
import { createGhostNewsletterProvider } from "./ghost";
import type { GhostInstance } from "./config";
import type { OptInRequest } from "./types";

const instance: GhostInstance = { url: "https://blog.test" };

const baseRequest: OptInRequest = {
  email: "sam@example.com",
  name: "Sam",
  brand: "nursery",
  interests: ["produce"],
  source: "newsletter-signup",
  label: "nursery-footer",
  consent: true,
};

function created(bodyJson?: unknown) {
  return bodyJson === undefined
    ? new Response("Created.", { status: 201 })
    : new Response(JSON.stringify(bodyJson), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
}

describe("createGhostNewsletterProvider.subscribe", () => {
  it("POSTs to the Ghost send-magic-link endpoint with signup + labels", async () => {
    const fetchMock = vi.fn().mockResolvedValue(created());
    const provider = createGhostNewsletterProvider(
      instance,
      fetchMock as unknown as typeof fetch,
    );

    const result = await provider.subscribe(baseRequest);

    expect(result).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://blog.test/members/api/send-magic-link/");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body.email).toBe("sam@example.com");
    expect(body.emailType).toBe("signup");
    expect(body.name).toBe("Sam");
    expect(body.autoRedirect).toBe(false);
    expect(body.labels).toEqual(["nursery-footer", "interest-produce"]);
  });

  it("attaches explicit newsletter ids as {id} objects when configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue(created());
    const provider = createGhostNewsletterProvider(
      { url: "https://blog.test", newsletters: ["nl_1", "nl_2"] },
      fetchMock as unknown as typeof fetch,
    );
    await provider.subscribe(baseRequest);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.newsletters).toEqual([{ id: "nl_1" }, { id: "nl_2" }]);
  });

  it("surfaces a member id when the instance returns JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(created({ member: { id: "m_9" } }));
    const provider = createGhostNewsletterProvider(
      instance,
      fetchMock as unknown as typeof fetch,
    );
    expect(await provider.subscribe(baseRequest)).toEqual({ ok: true, id: "m_9" });
  });

  it("returns a failure outcome (not a throw) on a non-2xx response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response("too many", { status: 429, statusText: "Too Many Requests" }),
      );
    const provider = createGhostNewsletterProvider(
      instance,
      fetchMock as unknown as typeof fetch,
    );
    const result = await provider.subscribe(baseRequest);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("429");
  });

  it("returns a failure outcome when fetch itself throws", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const provider = createGhostNewsletterProvider(
      instance,
      fetchMock as unknown as typeof fetch,
    );
    const result = await provider.subscribe(baseRequest);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("ECONNREFUSED");
  });
});
