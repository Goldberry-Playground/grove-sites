import { describe, it, expect } from "vitest";
import { validateMediaAsset, readMediaAsset } from "./media";

describe("validateMediaAsset (GOL-716 contract)", () => {
  it("accepts a well-formed Canva image and defaults igPostType to post", () => {
    const m = validateMediaAsset({
      url: "https://cdn.goldberrygrove.farm/a.jpg",
      type: "image",
      source: "canva",
      altText: "  a pear  ",
    });
    expect(m).toEqual({
      url: "https://cdn.goldberrygrove.farm/a.jpg",
      type: "image",
      source: "canva",
      igPostType: "post",
      altText: "a pear",
    });
  });

  it("treats absent media as optional (undefined, not an error)", () => {
    expect(validateMediaAsset(undefined)).toBeUndefined();
    expect(validateMediaAsset(null)).toBeUndefined();
  });

  it("allows a video reel", () => {
    const m = validateMediaAsset({
      url: "https://cdn.goldberrygrove.farm/clip.mp4",
      type: "video",
      source: "manual",
      igPostType: "reel",
    });
    expect(m?.igPostType).toBe("reel");
  });

  it("rejects reel on an image asset", () => {
    expect(() =>
      validateMediaAsset({ url: "https://x/a.jpg", type: "image", source: "canva", igPostType: "reel" }),
    ).toThrow(/reel.*requires.*video/i);
  });

  it("rejects a non-https url", () => {
    expect(() => validateMediaAsset({ url: "http://x/a.jpg", type: "image", source: "canva" })).toThrow(/https/i);
  });

  it("rejects a short-lived signed export URL (must re-host first)", () => {
    expect(() =>
      validateMediaAsset({
        url: "https://export-download.canva.com/a.png?X-Amz-Expires=3600&X-Amz-Signature=abc",
        type: "image",
        source: "canva",
      }),
    ).toThrow(/re-host/i);
  });

  it("rejects an unknown source (Sora/AI is not a source)", () => {
    expect(() => validateMediaAsset({ url: "https://x/a.jpg", type: "image", source: "sora" })).toThrow(/source/i);
  });

  it("rejects a missing url and a bad type", () => {
    expect(() => validateMediaAsset({ type: "image", source: "canva" })).toThrow(/url/i);
    expect(() => validateMediaAsset({ url: "https://x/a.jpg", type: "gif", source: "canva" })).toThrow(/type/i);
  });
});

describe("readMediaAsset (lenient card decode)", () => {
  it("returns undefined instead of throwing on a garbled asset", () => {
    expect(readMediaAsset({ url: "not-a-url", type: "image", source: "canva" })).toBeUndefined();
    expect(readMediaAsset("nonsense")).toBeUndefined();
    expect(readMediaAsset(undefined)).toBeUndefined();
  });

  it("still returns a valid asset unchanged", () => {
    expect(readMediaAsset({ url: "https://x/a.jpg", type: "image", source: "manual" })?.url).toBe("https://x/a.jpg");
  });
});
