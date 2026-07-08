import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import {
  assetKey,
  cdnUrlFor,
  contentHash,
  createSpacesAssetPipeline,
  optimizeToVariants,
  pickPrimary,
  sanitizeSegment,
  spacesConfigFromEnv,
  targetWidths,
  uploadAsset,
  CACHE_CONTROL,
  type AssetVariant,
  type S3PutClient,
  type SpacesAssetConfig,
} from "./upload-asset";

const CONFIG: SpacesAssetConfig = {
  bucket: "grove-assets",
  region: "nyc3",
  endpoint: "https://nyc3.digitaloceanspaces.com",
  accessKeyId: "test-key",
  secretAccessKey: "test-secret",
  cdnBaseUrl: "https://assets.gatheringatthegrove.com",
};

/** Captures every PutObjectCommand input so tests can assert on the uploads. */
class FakeSpaces implements S3PutClient {
  readonly puts: Array<Record<string, unknown>> = [];
  async send(command: unknown): Promise<unknown> {
    if (command instanceof PutObjectCommand) {
      this.puts.push(command.input as unknown as Record<string, unknown>);
    }
    return {};
  }
}

/** A deterministic solid-color test image at a given width/height. */
async function makeImage(width: number, height: number, r = 20, g = 120, b = 40): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r, g, b } } })
    .png()
    .toBuffer();
}

describe("pure helpers", () => {
  it("sanitizeSegment lowercases, hyphenates, and never returns empty", () => {
    expect(sanitizeSegment("Orchard At Dusk")).toBe("orchard-at-dusk");
    expect(sanitizeSegment("  Hero!!  ")).toBe("hero");
    expect(sanitizeSegment("///")).toBe("asset");
  });

  it("contentHash is stable for identical bytes and differs otherwise", () => {
    const a = contentHash(Buffer.from("hello"));
    const b = contentHash(Buffer.from("hello"));
    const c = contentHash(Buffer.from("world"));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toHaveLength(12);
  });

  it("targetWidths caps at the source width and never upscales", () => {
    expect(targetWidths(1000)).toEqual([480, 768, 1000]);
    expect(targetWidths(300)).toEqual([300]);
    expect(targetWidths(6000)).toEqual([480, 768, 1200, 1920]);
    expect(targetWidths(768)).toEqual([480, 768]);
  });

  it("assetKey follows brand/class/slug-hash-widthw.format", () => {
    const key = assetKey({ brand: "Goldberry", assetClass: "Hero", slug: "orchard at dusk" }, 1200, "webp", "abc123def456");
    expect(key).toBe("goldberry/hero/orchard-at-dusk-abc123def456-1200w.webp");
  });

  it("cdnUrlFor joins base and key, tolerating a trailing slash", () => {
    expect(cdnUrlFor({ cdnBaseUrl: "https://cdn.example.com/" }, "a/b.webp")).toBe(
      "https://cdn.example.com/a/b.webp",
    );
  });

  it("pickPrimary chooses the widest WebP", () => {
    const variants: AssetVariant[] = [
      { key: "k1", cdnUrl: "u1", format: "avif", width: 1200, bytes: 1, contentType: "image/avif" },
      { key: "k2", cdnUrl: "u2", format: "webp", width: 480, bytes: 1, contentType: "image/webp" },
      { key: "k3", cdnUrl: "u3", format: "webp", width: 1200, bytes: 1, contentType: "image/webp" },
    ];
    expect(pickPrimary(variants).key).toBe("k3");
  });
});

describe("optimizeToVariants", () => {
  it("emits AVIF + WebP at each responsive width, never upscaling", async () => {
    const png = await makeImage(1000, 600);
    const variants = await optimizeToVariants(png);
    const widths = [...new Set(variants.map((v) => v.width))].sort((a, b) => a - b);
    expect(widths).toEqual([480, 768, 1000]);
    expect(variants.filter((v) => v.format === "webp")).toHaveLength(3);
    expect(variants.filter((v) => v.format === "avif")).toHaveLength(3);
    for (const v of variants) {
      expect(v.buffer.length).toBeGreaterThan(0);
      expect(v.contentType).toBe(`image/${v.format}`);
    }
  });
});

describe("uploadAsset", () => {
  const input = {
    filename: "orchard.png",
    brand: "goldberry",
    assetClass: "hero",
    slug: "orchard at dusk",
  };

  it("uploads every variant public-read with an immutable cache header", async () => {
    const png = await makeImage(1000, 600);
    const spaces = new FakeSpaces();
    const result = await uploadAsset(spaces, CONFIG, { ...input, bytes: png });

    // 3 widths x 2 formats = 6 objects.
    expect(spaces.puts).toHaveLength(6);
    expect(result.variants).toHaveLength(6);
    for (const put of spaces.puts) {
      expect(put.Bucket).toBe("grove-assets");
      expect(put.ACL).toBe("public-read");
      expect(put.CacheControl).toBe(CACHE_CONTROL);
      expect(String(put.ContentType)).toMatch(/^image\/(webp|avif)$/);
      expect(String(put.Key)).toMatch(
        /^goldberry\/hero\/orchard-at-dusk-[0-9a-f]{12}-\d+w\.(webp|avif)$/,
      );
    }
  });

  it("returns the largest WebP as the canonical CDN url + key", async () => {
    const png = await makeImage(1000, 600);
    const spaces = new FakeSpaces();
    const result = await uploadAsset(spaces, CONFIG, { ...input, bytes: png });
    expect(result.key).toBe(`goldberry/hero/orchard-at-dusk-${result.hash}-1000w.webp`);
    expect(result.cdnUrl).toBe(
      `https://assets.gatheringatthegrove.com/goldberry/hero/orchard-at-dusk-${result.hash}-1000w.webp`,
    );
  });

  it("is idempotent: identical bytes produce identical keys", async () => {
    const png = await makeImage(1000, 600);
    const a = await uploadAsset(new FakeSpaces(), CONFIG, { ...input, bytes: png });
    const b = await uploadAsset(new FakeSpaces(), CONFIG, { ...input, bytes: png });
    expect(a.hash).toBe(b.hash);
    expect(a.variants.map((v) => v.key)).toEqual(b.variants.map((v) => v.key));
  });

  it("different image bytes yield a different content hash / keys", async () => {
    const a = await uploadAsset(new FakeSpaces(), CONFIG, { ...input, bytes: await makeImage(1000, 600) });
    const b = await uploadAsset(new FakeSpaces(), CONFIG, { ...input, bytes: await makeImage(1000, 600, 200, 10, 10) });
    expect(a.hash).not.toBe(b.hash);
  });
});

describe("createSpacesAssetPipeline", () => {
  it("binds the injected client and satisfies the AssetPipeline seam", async () => {
    const spaces = new FakeSpaces();
    const pipeline = createSpacesAssetPipeline(CONFIG, spaces);
    const png = await makeImage(500, 500);
    const { cdnUrl, key } = await pipeline.optimizeAndUpload({
      bytes: png,
      filename: "logo.png",
      brand: "ggg",
      assetClass: "logo",
      slug: "mark",
    });
    expect(key.startsWith("ggg/logo/mark-")).toBe(true);
    expect(cdnUrl.endsWith(".webp")).toBe(true);
    expect(spaces.puts.length).toBeGreaterThan(0);
  });
});

describe("spacesConfigFromEnv", () => {
  it("throws a clear error when broker creds are missing", () => {
    expect(() => spacesConfigFromEnv({} as NodeJS.ProcessEnv)).toThrow(/GROVE_ASSETS_KEY/);
  });

  it("defaults the non-secret settings to grove-assets / the CDN host", () => {
    const cfg = spacesConfigFromEnv({
      GROVE_ASSETS_KEY: "k",
      GROVE_ASSETS_SECRET: "s",
    } as NodeJS.ProcessEnv);
    expect(cfg.bucket).toBe("grove-assets");
    expect(cfg.region).toBe("nyc3");
    expect(cfg.cdnBaseUrl).toBe("https://assets.gatheringatthegrove.com");
    expect(cfg.accessKeyId).toBe("k");
  });
});
