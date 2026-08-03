import { describe, it, expect, vi } from "vitest";

import type { MediaType } from "./media";
import {
  assertAllowedContentType,
  assertWithinSizeCap,
  contentHashKey,
  IngestError,
  inferInputContentType,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  rehostToMediaAsset,
  type AssetStore,
  type IngestDeps,
  type MediaNormalizer,
  type NormalizedMedia,
  type RawUpload,
} from "./ingest";

const bytes = (n: number): Uint8Array => new Uint8Array(n).fill(1);

function rawImage(overrides: Partial<RawUpload> = {}): RawUpload {
  return { bytes: bytes(1024), filename: "farm.jpg", declaredType: "image", source: "manual", ...overrides };
}

/** A store that records the last put and returns a durable public URL. */
function fakeStore(url = "https://assets.gatheringatthegrove.com/social/abc.webp"): AssetStore & {
  puts: Array<{ key: string; contentType: string; size: number }>;
} {
  const puts: Array<{ key: string; contentType: string; size: number }> = [];
  return {
    puts,
    async put(key, b, contentType) {
      puts.push({ key, contentType, size: b.length });
      return url;
    },
  };
}

/** A normalizer that returns WebP image bytes (mimics the sharp EXIF-strip recipe). */
const imageNormalizer: MediaNormalizer = async (raw) => ({
  bytes: bytes(512),
  contentType: "image/webp",
  type: "image",
});

function deps(over: Partial<IngestDeps> = {}): IngestDeps {
  return { store: fakeStore(), normalize: imageNormalizer, ...over };
}

describe("inferInputContentType", () => {
  it.each([
    ["farm.jpg", "image", "image/jpeg"],
    ["farm.JPEG", "image", "image/jpeg"],
    ["farm.png", "image", "image/png"],
    ["farm.webp", "image", "image/webp"],
    ["reel.mp4", "video", "video/mp4"],
  ])("maps %s (%s) → %s", (filename, type, expected) => {
    expect(inferInputContentType(filename, type as MediaType)).toBe(expected);
  });

  it("rejects unknown extensions", () => {
    expect(() => inferInputContentType("art.gif", "image")).toThrow(IngestError);
    expect(() => inferInputContentType("noext", "image")).toThrow(/unsupported file extension/);
  });

  it("rejects a kind mismatch between extension and declaredType", () => {
    expect(() => inferInputContentType("clip.mp4", "image")).toThrow(/is a video but was declared as image/);
    expect(() => inferInputContentType("photo.png", "video")).toThrow(/is a image but was declared as video/);
  });
});

describe("assertAllowedContentType", () => {
  it("accepts allowlisted types and returns the kind", () => {
    expect(assertAllowedContentType("image/webp")).toBe("image");
    expect(assertAllowedContentType("video/mp4")).toBe("video");
  });
  it("rejects anything off the allowlist (incl. svg/gif/quicktime)", () => {
    for (const t of ["image/svg+xml", "image/gif", "video/quicktime", "text/html", ""]) {
      expect(() => assertAllowedContentType(t)).toThrow(IngestError);
    }
  });
});

describe("assertWithinSizeCap", () => {
  it("rejects empty files", () => {
    expect(() => assertWithinSizeCap(bytes(0), "image")).toThrow(/empty file/);
  });
  it("enforces the per-kind cap", () => {
    expect(() => assertWithinSizeCap(bytes(MAX_IMAGE_BYTES + 1), "image")).toThrow(/over the/);
    expect(() => assertWithinSizeCap(bytes(MAX_VIDEO_BYTES + 1), "video")).toThrow(/over the/);
    // an image over the image cap is fine as a (smaller) video cap check
    expect(() => assertWithinSizeCap(bytes(MAX_IMAGE_BYTES + 1), "video")).not.toThrow();
  });
});

describe("contentHashKey", () => {
  it("is deterministic for identical bytes and differs otherwise", () => {
    const a = contentHashKey(bytes(10), "image/webp");
    const b = contentHashKey(bytes(10), "image/webp");
    const c = contentHashKey(new Uint8Array([9, 9, 9]), "image/webp");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
  it("uses the content-type extension and prefix", () => {
    expect(contentHashKey(bytes(10), "video/mp4", "social")).toMatch(/^social\/[0-9a-f]{32}\.mp4$/);
    expect(contentHashKey(bytes(10), "image/webp", "cmo")).toMatch(/^cmo\/[0-9a-f]{32}\.webp$/);
  });
});

describe("rehostToMediaAsset", () => {
  it("re-hosts a farm photo end-to-end into a validated MediaAsset", async () => {
    const store = fakeStore();
    const asset = await rehostToMediaAsset(rawImage(), deps({ store }), { altText: "pawpaw in bloom" });
    expect(asset).toEqual({
      url: "https://assets.gatheringatthegrove.com/social/abc.webp",
      type: "image",
      source: "manual",
      igPostType: "post",
      altText: "pawpaw in bloom",
    });
    // stored the NORMALIZED bytes (512), not the raw input (1024), under a hash key.
    expect(store.puts).toHaveLength(1);
    expect(store.puts[0].size).toBe(512);
    expect(store.puts[0].contentType).toBe("image/webp");
    expect(store.puts[0].key).toMatch(/^social\/[0-9a-f]{32}\.webp$/);
  });

  it("always runs the normalizer (EXIF/GPS strip) before storing", async () => {
    const normalize = vi.fn(imageNormalizer);
    const store = fakeStore();
    await rehostToMediaAsset(rawImage(), deps({ store, normalize }));
    expect(normalize).toHaveBeenCalledOnce();
  });

  it("rejects a disallowed input before doing any work (no normalize, no store)", async () => {
    const normalize = vi.fn(imageNormalizer);
    const store = fakeStore();
    await expect(
      rehostToMediaAsset(rawImage({ filename: "art.gif" }), deps({ store, normalize })),
    ).rejects.toThrow(IngestError);
    expect(normalize).not.toHaveBeenCalled();
    expect(store.puts).toHaveLength(0);
  });

  it("rejects oversize input before normalizing", async () => {
    const normalize = vi.fn(imageNormalizer);
    const store = fakeStore();
    await expect(
      rehostToMediaAsset(rawImage({ bytes: bytes(MAX_IMAGE_BYTES + 1) }), deps({ store, normalize })),
    ).rejects.toThrow(/over the/);
    expect(normalize).not.toHaveBeenCalled();
    expect(store.puts).toHaveLength(0);
  });

  it("rejects a normalizer that changes the media kind (never stores it)", async () => {
    const badNormalize: MediaNormalizer = async () => ({ bytes: bytes(10), contentType: "video/mp4", type: "video" });
    const store = fakeStore();
    await expect(rehostToMediaAsset(rawImage(), deps({ store, normalize: badNormalize }))).rejects.toThrow(
      /changed the media kind/,
    );
    expect(store.puts).toHaveLength(0);
  });

  it("rejects a normalizer whose type disagrees with its content-type", async () => {
    const badNormalize: MediaNormalizer = async () => ({ bytes: bytes(10), contentType: "image/webp", type: "video" });
    await expect(rehostToMediaAsset(rawImage(), deps({ normalize: badNormalize }))).rejects.toThrow(/disagrees/);
  });

  it("rejects a normalizer output over the size cap", async () => {
    const bigNormalize: MediaNormalizer = async () => ({
      bytes: bytes(MAX_IMAGE_BYTES + 1),
      contentType: "image/webp",
      type: "image",
    });
    const store = fakeStore();
    await expect(rehostToMediaAsset(rawImage(), deps({ store, normalize: bigNormalize }))).rejects.toThrow(/over the/);
    expect(store.puts).toHaveLength(0);
  });

  it("rejects a store that returns a short-lived signed URL (re-host, don't proxy)", async () => {
    const leakyStore = fakeStore("https://cdn.discordapp.com/attachments/x.jpg?X-Amz-Expires=900&X-Amz-Signature=deadbeef");
    await expect(rehostToMediaAsset(rawImage(), deps({ store: leakyStore }))).rejects.toThrow(/short-lived signed/);
  });

  it("rejects a store that returns a non-https URL", async () => {
    const httpStore = fakeStore("http://assets.example.com/social/abc.webp");
    await expect(rehostToMediaAsset(rawImage(), deps({ store: httpStore }))).rejects.toThrow(/https/);
  });

  it("supports a video reel via an injected video normalizer", async () => {
    const videoNormalize: MediaNormalizer = async () => ({ bytes: bytes(2048), contentType: "video/mp4", type: "video" });
    const store = fakeStore("https://assets.gatheringatthegrove.com/social/def.mp4");
    const asset = await rehostToMediaAsset(
      rawImage({ filename: "reel.mp4", declaredType: "video", source: "canva" }),
      deps({ store, normalize: videoNormalize }),
      { igPostType: "reel" },
    );
    expect(asset.type).toBe("video");
    expect(asset.igPostType).toBe("reel");
    expect(asset.source).toBe("canva");
    expect(store.puts[0].key).toMatch(/\.mp4$/);
  });

  it("enforces the media contract (reel requires video) after re-host", async () => {
    // an image re-host tagged as a reel must be rejected by the contract
    await expect(rehostToMediaAsset(rawImage(), deps(), { igPostType: "reel" })).rejects.toThrow(/reel/);
  });
});
