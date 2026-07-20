import { describe, expect, it, vi, beforeEach } from "vitest";
import { createOdooClient } from "./client";

const config = { tenantId: "nursery", odooUrl: "http://localhost:8069" };

describe("client.zone (ZIP → USDA zone)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("calls /grove/api/v1/zone?zip=<zip> and returns the normalized result", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ zip: "26501", zone: 6 }), { status: 200 }),
    );

    const client = createOdooClient(config);
    const result = await client.zone("26501");

    expect(mockFetch.mock.calls[0][0]).toBe(
      "http://localhost:8069/grove/api/v1/zone?zip=26501",
    );
    expect(result).toEqual({ zip: "26501", zone: 6 });
  });

  it("returns null (no fetch) for a malformed ZIP", async () => {
    const mockFetch = vi.mocked(fetch);
    const client = createOdooClient(config);

    expect(await client.zone("")).toBeNull();
    expect(await client.zone("123")).toBeNull();
    expect(await client.zone("abcde")).toBeNull();
    expect(await client.zone("123456")).toBeNull();
    // Never round-trips a ZIP the API can't answer.
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("trims surrounding whitespace before validating and querying", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ zip: "90210", zone: 10 }), { status: 200 }),
    );

    const client = createOdooClient(config);
    const result = await client.zone("  90210  ");

    expect(mockFetch.mock.calls[0][0]).toBe(
      "http://localhost:8069/grove/api/v1/zone?zip=90210",
    );
    expect(result).toEqual({ zip: "90210", zone: 10 });
  });

  it("maps a 404 (ZIP outside the USDA matrix) to null, not an error", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "unknown zip" }), { status: 404 }),
    );

    const client = createOdooClient(config);
    await expect(client.zone("00000")).resolves.toBeNull();
  });

  it("re-throws non-404 failures (network/5xx are real errors)", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("boom", { status: 500, statusText: "Internal Server Error" }),
    );

    const client = createOdooClient(config);
    await expect(client.zone("26501")).rejects.toThrow(/500/);
  });
});

describe("products.list facet params (catalog API v1)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("forwards zone/layer/sun/tag_id as server-side filter params", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({ count: 0, limit: 40, offset: 0, results: [] }),
        { status: 200 },
      ),
    );

    const client = createOdooClient(config);
    await client.products.list({ zone: 6, layer: "canopy", sun: "full", tagId: 3 });

    const url = new URL(mockFetch.mock.calls[0][0] as string);
    expect(url.searchParams.get("zone")).toBe("6");
    expect(url.searchParams.get("layer")).toBe("canopy");
    expect(url.searchParams.get("sun")).toBe("full");
    expect(url.searchParams.get("tag_id")).toBe("3");
  });

  it("omits layer/sun from the query when not provided", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({ count: 0, limit: 40, offset: 0, results: [] }),
        { status: 200 },
      ),
    );

    const client = createOdooClient(config);
    await client.products.list({ zone: 6 });

    const url = new URL(mockFetch.mock.calls[0][0] as string);
    expect(url.searchParams.has("layer")).toBe(false);
    expect(url.searchParams.has("sun")).toBe(false);
  });
});
