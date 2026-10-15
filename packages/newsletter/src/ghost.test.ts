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


/** Ghost 5.x+ requires an anti-spam integrity token on send-magic-link
 *  (fetched from GET /members/api/integrity-token/); without it the POST is a
 *  400 "The request could not be understood." This mock answers the token GET
 *  and hands every other call to `post`. */
function ghostFetch(post: Response | Promise<Response> | (() => Promise<Response>), token = "tok_123") {
  return vi.fn(async (url: string) => {
    if (url.endsWith("/members/api/integrity-token/")) return new Response(token, { status: 200 });
    return typeof post === "function" ? post() : post;
  });
}

function postCall(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.find(([url]) => String(url).endsWith("/send-magic-link/"))!;
}

describe("createGhostNewsletterProvider.subscribe", () => {
  it("POSTs to the Ghost send-magic-link endpoint with signup + labels", async () => {
    const fetchMock = ghostFetch(created());
    const provider = createGhostNewsletterProvider(
      instance,
      fetchMock as unknown as typeof fetch,
    );

    const result = await provider.subscribe(baseRequest);

    expect(result).toEqual({ ok: true });
    const [url, init] = postCall(fetchMock) as [string, RequestInit & { body: string }];
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
    const fetchMock = ghostFetch(created());
    const provider = createGhostNewsletterProvider(
      { url: "https://blog.test", newsletters: ["nl_1", "nl_2"] },
      fetchMock as unknown as typeof fetch,
    );
    await provider.subscribe(baseRequest);
    const body = JSON.parse((postCall(fetchMock)[1] as { body: string }).body);
    expect(body.newsletters).toEqual([{ id: "nl_1" }, { id: "nl_2" }]);
  });

  it("surfaces a member id when the instance returns JSON", async () => {
    const fetchMock = ghostFetch(created({ member: { id: "m_9" } }));
    const provider = createGhostNewsletterProvider(
      instance,
      fetchMock as unknown as typeof fetch,
    );
    expect(await provider.subscribe(baseRequest)).toEqual({ ok: true, id: "m_9" });
  });

  it("returns a failure outcome (not a throw) on a non-2xx response", async () => {
    const fetchMock = ghostFetch(new Response("too many", { status: 429, statusText: "Too Many Requests" }));
    const provider = createGhostNewsletterProvider(
      instance,
      fetchMock as unknown as typeof fetch,
    );
    const result = await provider.subscribe(baseRequest);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("429");
  });

  it("returns a failure outcome when fetch itself throws", async () => {
    const fetchMock = ghostFetch(() => Promise.reject(new Error("ECONNREFUSED")));
    const provider = createGhostNewsletterProvider(
      instance,
      fetchMock as unknown as typeof fetch,
    );
    const result = await provider.subscribe(baseRequest);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("ECONNREFUSED");
  });
  it("sends the integrity token Ghost requires", async () => {
    const fetchMock = ghostFetch(created(), "tok_abc");
    const provider = createGhostNewsletterProvider(instance, fetchMock as unknown as typeof fetch);
    expect(await provider.subscribe(baseRequest)).toEqual({ ok: true });
    expect(fetchMock.mock.calls[0][0]).toBe("https://blog.test/members/api/integrity-token/");
    const body = JSON.parse((postCall(fetchMock)[1] as { body: string }).body);
    expect(body.integrityToken).toBe("tok_abc");
  });

  it("still posts (without a token) when the token endpoint is unavailable", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith("/integrity-token/") ? new Response("nope", { status: 404 }) : created(),
    );
    const provider = createGhostNewsletterProvider(instance, fetchMock as unknown as typeof fetch);
    expect(await provider.subscribe(baseRequest)).toEqual({ ok: true });
    const body = JSON.parse((postCall(fetchMock)[1] as { body: string }).body);
    expect(body.integrityToken).toBeUndefined();
  });
});
