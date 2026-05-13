import { describe, it, expect } from "vitest";
import { requireJsonContentType } from "./contentType";

function reqWithContentType(contentType: string | null): Request {
  const headers = new Headers();
  if (contentType !== null) headers.set("content-type", contentType);
  return new Request("https://example.test/api/checkout", {
    method: "POST",
    headers,
  });
}

describe("requireJsonContentType", () => {
  it("accepts application/json", () => {
    expect(requireJsonContentType(reqWithContentType("application/json"))).toBeNull();
  });

  it("accepts application/json; charset=utf-8 (param-stripping works)", () => {
    expect(
      requireJsonContentType(reqWithContentType("application/json; charset=utf-8")),
    ).toBeNull();
  });

  it("rejects application/x-www-form-urlencoded with 415", async () => {
    const response = requireJsonContentType(
      reqWithContentType("application/x-www-form-urlencoded"),
    );
    expect(response).not.toBeNull();
    expect(response!.status).toBe(415);
    const body = await response!.json();
    expect(body).toEqual({ error: "Content-Type must be application/json" });
  });

  it("rejects text/plain with 415", () => {
    const response = requireJsonContentType(reqWithContentType("text/plain"));
    expect(response).not.toBeNull();
    expect(response!.status).toBe(415);
  });

  it("rejects missing Content-Type with 415", () => {
    const response = requireJsonContentType(reqWithContentType(null));
    expect(response).not.toBeNull();
    expect(response!.status).toBe(415);
  });

  it("is case-insensitive (Application/JSON accepted)", () => {
    expect(requireJsonContentType(reqWithContentType("Application/JSON"))).toBeNull();
  });
});
