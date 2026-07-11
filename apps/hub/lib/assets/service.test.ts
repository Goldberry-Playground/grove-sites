import { describe, it, expect, vi } from "vitest";
import {
  checkAuth,
  handleOptimize,
  handleBrandEntry,
  type OptimizeDeps,
  type BrandEntryDeps,
} from "./service";
import type { AssetPipeline, AssetUploadResult } from "@grove/assets";

/** Build a multipart Request with a `meta` JSON part and optional `file` bytes. */
function form(meta: Record<string, unknown>, file?: Uint8Array | null): Request {
  const fd = new FormData();
  fd.set("meta", JSON.stringify(meta));
  if (file) fd.set("file", new Blob([file as BlobPart], { type: "image/png" }), "logo.png");
  return new Request("http://localhost/api/assets/optimize", { method: "POST", body: fd });
}

function fakePipeline(result?: Partial<AssetUploadResult>): {
  pipeline: AssetPipeline;
  calls: unknown[];
} {
  const calls: unknown[] = [];
  const full: AssetUploadResult = {
    cdnUrl: "https://assets.gatheringatthegrove.com/goldberry/logo/mark-abc123-1920w.webp",
    key: "goldberry/logo/mark-abc123-1920w.webp",
    variants: [],
    hash: "abc123",
    ...result,
  };
  return {
    calls,
    pipeline: {
      optimizeAndUpload: async (input) => {
        calls.push(input);
        return full;
      },
    },
  };
}

const BYTES = new Uint8Array([1, 2, 3, 4]);

describe("checkAuth", () => {
  const req = (auth?: string) =>
    new Request("http://localhost/api/assets/optimize", {
      method: "POST",
      headers: auth ? { authorization: auth } : {},
    });

  it("returns 503 when the server token is unset", () => {
    const res = checkAuth(req("Bearer x"), {});
    expect(res?.status).toBe(503);
  });

  it("returns 401 without a bearer header", () => {
    const res = checkAuth(req(), { GROVE_ASSETS_OPTIMIZE_TOKEN: "secret" });
    expect(res?.status).toBe(401);
  });

  it("returns 401 on token mismatch", () => {
    const res = checkAuth(req("Bearer nope"), { GROVE_ASSETS_OPTIMIZE_TOKEN: "secret" });
    expect(res?.status).toBe(401);
  });

  it("passes (null) on a matching bearer token", () => {
    const res = checkAuth(req("Bearer secret"), { GROVE_ASSETS_OPTIMIZE_TOKEN: "secret" });
    expect(res).toBeNull();
  });
});

describe("handleOptimize", () => {
  it("optimizes and returns { cdnUrl, key }", async () => {
    const { pipeline, calls } = fakePipeline();
    const res = await handleOptimize(
      form({ brand: "goldberry", assetClass: "hero", slug: "orchard-dawn", filename: "a.png" }, BYTES),
      { pipeline } satisfies OptimizeDeps,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      cdnUrl: "https://assets.gatheringatthegrove.com/goldberry/logo/mark-abc123-1920w.webp",
      key: "goldberry/logo/mark-abc123-1920w.webp",
    });
    expect(calls).toHaveLength(1);
    expect((calls[0] as { brand: string }).brand).toBe("goldberry");
  });

  it("400s when the file part is missing", async () => {
    const { pipeline } = fakePipeline();
    const res = await handleOptimize(
      form({ brand: "goldberry", assetClass: "hero", slug: "x" }, null),
      { pipeline },
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("missing_file");
  });

  it("400s when a required meta field is missing", async () => {
    const { pipeline } = fakePipeline();
    const res = await handleOptimize(form({ assetClass: "hero", slug: "x" }, BYTES), { pipeline });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("missing_field");
    expect(body.field).toBe("brand");
  });

  it("400s on invalid meta JSON", async () => {
    const fd = new FormData();
    fd.set("meta", "{not json");
    fd.set("file", new Blob([BYTES]), "a.png");
    const req = new Request("http://localhost", { method: "POST", body: fd });
    const { pipeline } = fakePipeline();
    const res = await handleOptimize(req, { pipeline });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_meta_json");
  });

  it("502s when the pipeline throws", async () => {
    const pipeline: AssetPipeline = {
      optimizeAndUpload: async () => {
        throw new Error("spaces down");
      },
    };
    const res = await handleOptimize(
      form({ brand: "goldberry", assetClass: "hero", slug: "x" }, BYTES),
      { pipeline },
    );
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("optimize_failed");
  });
});

describe("handleBrandEntry", () => {
  const assetBrand = (prUrl = "https://github.com/o/r/pull/7") => {
    const propose = vi.fn(async () => ({ prUrl }));
    return { propose, assetBrand: { proposeBrandEntry: propose } };
  };

  it("optimizes the logo then opens the PR", async () => {
    const { pipeline, calls } = fakePipeline({
      cdnUrl: "https://cdn/goldberry/logo/mark-abc-1920w.webp",
      key: "goldberry/logo/mark-abc-1920w.webp",
    });
    const { propose, assetBrand: ab } = assetBrand();
    const res = await handleBrandEntry(
      form(
        { brand: "goldberry", slug: "mark-on-cream", caption: "goldberry, logo, mark on cream" },
        BYTES,
      ),
      { pipeline, assetBrand: ab } satisfies BrandEntryDeps,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      prUrl: "https://github.com/o/r/pull/7",
      cdnUrl: "https://cdn/goldberry/logo/mark-abc-1920w.webp",
      key: "goldberry/logo/mark-abc-1920w.webp",
    });
    // Optimize forced the logo class even though meta omitted assetClass.
    expect((calls[0] as { assetClass: string }).assetClass).toBe("logo");
    expect(propose).toHaveBeenCalledWith({
      brand: "goldberry",
      slug: "mark-on-cream",
      cdnUrl: "https://cdn/goldberry/logo/mark-abc-1920w.webp",
      key: "goldberry/logo/mark-abc-1920w.webp",
      caption: "goldberry, logo, mark on cream",
    });
  });

  it("skips optimize when the caller already supplied cdnUrl+key", async () => {
    const { pipeline, calls } = fakePipeline();
    const { propose, assetBrand: ab } = assetBrand();
    const res = await handleBrandEntry(
      form({
        brand: "ggg",
        slug: "workshop-mark",
        caption: "",
        cdnUrl: "https://cdn/ggg/logo/workshop-mark-def-1920w.webp",
        key: "ggg/logo/workshop-mark-def-1920w.webp",
      }),
      { pipeline, assetBrand: ab },
    );
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(0); // no re-optimize
    expect(propose).toHaveBeenCalledWith({
      brand: "ggg",
      slug: "workshop-mark",
      cdnUrl: "https://cdn/ggg/logo/workshop-mark-def-1920w.webp",
      key: "ggg/logo/workshop-mark-def-1920w.webp",
      caption: "",
    });
  });

  it("400s when neither a file nor cdnUrl+key is provided", async () => {
    const { pipeline } = fakePipeline();
    const { assetBrand: ab } = assetBrand();
    const res = await handleBrandEntry(
      form({ brand: "goldberry", slug: "mark" }, null),
      { pipeline, assetBrand: ab },
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("missing_file");
  });

  it("502s when proposeBrandEntry throws", async () => {
    const { pipeline } = fakePipeline();
    const ab = {
      proposeBrandEntry: async () => {
        throw new Error("unknown brand");
      },
    };
    const res = await handleBrandEntry(
      form({
        brand: "goldberry",
        slug: "mark",
        cdnUrl: "https://cdn/x.webp",
        key: "x.webp",
      }),
      { pipeline, assetBrand: ab },
    );
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("brand_entry_failed");
  });
});
