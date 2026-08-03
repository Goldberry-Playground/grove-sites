import { describe, it, expect, vi } from "vitest";

import type { MediaAsset } from "./media";
import {
  RehostClientError,
  rehostClientConfigFromEnv,
  rehostViaHub,
  type RawDrop,
} from "./rehost-client";

const CONFIG = { hubBaseUrl: "https://hub.example", token: "shhh" };

const drop = (over: Partial<RawDrop> = {}): RawDrop => ({
  bytes: new Uint8Array([1, 2, 3]),
  filename: "farm.jpg",
  declaredType: "image",
  source: "manual",
  ...over,
});

/** A fetch stub that captures the request and returns a canned Response. */
function fakeFetch(response: Response): { fn: typeof fetch; calls: Array<{ url: string; init: RequestInit }> } {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return response;
  }) as unknown as typeof fetch;
  return { fn, calls };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const VALID_ASSET: MediaAsset = {
  url: "https://assets.gatheringatthegrove.com/social/abc123.webp",
  type: "image",
  source: "manual",
  igPostType: "post",
};

describe("rehostClientConfigFromEnv", () => {
  it("reads the hub URL and the shared optimize bearer, trimming a trailing slash", () => {
    const cfg = rehostClientConfigFromEnv({
      GROVE_ASSETS_HUB_URL: "https://hub.example/",
      GROVE_ASSETS_OPTIMIZE_TOKEN: "tok",
    } as NodeJS.ProcessEnv);
    expect(cfg).toEqual({ hubBaseUrl: "https://hub.example", token: "tok" });
  });

  it("throws when the hub URL is missing", () => {
    expect(() =>
      rehostClientConfigFromEnv({ GROVE_ASSETS_OPTIMIZE_TOKEN: "tok" } as NodeJS.ProcessEnv),
    ).toThrow(/GROVE_ASSETS_HUB_URL/);
  });

  it("throws when the bearer token is missing", () => {
    expect(() =>
      rehostClientConfigFromEnv({ GROVE_ASSETS_HUB_URL: "https://hub.example" } as NodeJS.ProcessEnv),
    ).toThrow(/GROVE_ASSETS_OPTIMIZE_TOKEN/);
  });
});

describe("rehostViaHub", () => {
  it("POSTs a bearer-authed multipart body to the hub social endpoint", async () => {
    const { fn, calls } = fakeFetch(jsonResponse(VALID_ASSET));
    await rehostViaHub(drop({ igPostType: "post", altText: "Pawpaws" }), CONFIG, fn);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://hub.example/api/assets/social");
    expect(calls[0].init.method).toBe("POST");
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe("Bearer shhh");
    const body = calls[0].init.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    const meta = JSON.parse(body.get("meta") as string);
    expect(meta).toMatchObject({
      declaredType: "image",
      source: "manual",
      filename: "farm.jpg",
      igPostType: "post",
      altText: "Pawpaws",
    });
    expect(body.get("file")).toBeInstanceOf(Blob);
  });

  it("omits optional meta fields when absent", async () => {
    const { fn, calls } = fakeFetch(jsonResponse(VALID_ASSET));
    await rehostViaHub(drop(), CONFIG, fn);
    const meta = JSON.parse((calls[0].init.body as FormData).get("meta") as string);
    expect(meta).not.toHaveProperty("igPostType");
    expect(meta).not.toHaveProperty("altText");
  });

  it("returns the validated MediaAsset from the hub", async () => {
    const { fn } = fakeFetch(jsonResponse(VALID_ASSET));
    const asset = await rehostViaHub(drop(), CONFIG, fn);
    expect(asset).toEqual(VALID_ASSET);
  });

  it("throws RehostClientError on a non-2xx hub response, surfacing the detail", async () => {
    const { fn } = fakeFetch(jsonResponse({ error: "rehost_rejected", detail: "bad ext" }, 422));
    await expect(rehostViaHub(drop(), CONFIG, fn)).rejects.toThrow(RehostClientError);
    await expect(rehostViaHub(drop(), CONFIG, fn)).rejects.toThrow(/422/);
  });

  it("throws when the hub body is not a valid MediaAsset (e.g. a signed URL)", async () => {
    const { fn } = fakeFetch(
      jsonResponse({ url: "https://x/y?X-Amz-Signature=abc", type: "image", source: "manual" }),
    );
    await expect(rehostViaHub(drop(), CONFIG, fn)).rejects.toThrow(/not a valid MediaAsset/);
  });

  it("wraps a transport failure in RehostClientError", async () => {
    const fn = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    await expect(rehostViaHub(drop(), CONFIG, fn)).rejects.toThrow(/hub request failed: ECONNREFUSED/);
  });
});
