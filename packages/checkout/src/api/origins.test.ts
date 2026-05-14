import { describe, it, expect } from "vitest";
import { isOriginAllowed, rejectOrigin } from "./origins";

const ALLOWED = [
  "https://goldberrygrove.farm",
  "https://www.goldberrygrove.farm",
  "http://localhost:3001",
] as const;

function reqWithOrigin(origin: string | null): Request {
  const headers = new Headers();
  if (origin !== null) headers.set("origin", origin);
  return new Request("https://example.test/api/checkout", {
    method: "POST",
    headers,
  });
}

describe("isOriginAllowed", () => {
  it("accepts an exact match", () => {
    expect(isOriginAllowed(reqWithOrigin("https://goldberrygrove.farm"), ALLOWED)).toBe(true);
  });

  it("accepts the apex and the www variant independently", () => {
    expect(isOriginAllowed(reqWithOrigin("https://www.goldberrygrove.farm"), ALLOWED)).toBe(true);
  });

  it("accepts localhost dev origin", () => {
    expect(isOriginAllowed(reqWithOrigin("http://localhost:3001"), ALLOWED)).toBe(true);
  });

  it("rejects a different storefront's origin (cross-tenant safety)", () => {
    expect(isOriginAllowed(reqWithOrigin("https://atthegrovenursery.com"), ALLOWED)).toBe(false);
  });

  it("rejects an attacker substring (no prefix matching)", () => {
    expect(
      isOriginAllowed(reqWithOrigin("https://goldberrygrove.farm.evil.com"), ALLOWED),
    ).toBe(false);
  });

  it("rejects http when only https is allowed", () => {
    expect(isOriginAllowed(reqWithOrigin("http://goldberrygrove.farm"), ALLOWED)).toBe(false);
  });

  it("rejects a different port on localhost", () => {
    expect(isOriginAllowed(reqWithOrigin("http://localhost:3002"), ALLOWED)).toBe(false);
  });

  it("rejects when the Origin header is missing", () => {
    expect(isOriginAllowed(reqWithOrigin(null), ALLOWED)).toBe(false);
  });

  it("rejects an empty Origin header", () => {
    expect(isOriginAllowed(reqWithOrigin(""), ALLOWED)).toBe(false);
  });

  it("is case-sensitive in scheme/host (per RFC 6454)", () => {
    expect(isOriginAllowed(reqWithOrigin("HTTPS://goldberrygrove.farm"), ALLOWED)).toBe(false);
  });

  it("rejects the literal string 'null' that sandboxed iframes send", () => {
    expect(isOriginAllowed(reqWithOrigin("null"), ALLOWED)).toBe(false);
  });
});

describe("rejectOrigin", () => {
  it("returns 403 with a JSON body explaining the failure", async () => {
    const response = rejectOrigin();
    expect(response.status).toBe(403);
    expect(response.headers.get("content-type")).toMatch(/application\/json/);
    const body = await response.json();
    expect(body).toEqual({ error: "Origin not allowed" });
  });
});
