import { describe, it, expect, vi, afterEach } from "vitest";
// @ts-expect-error: .mjs gate scripts, intentionally untyped
import { auditImages, firstProductPath } from "../scripts/mobile-matrix.mjs";
// @ts-expect-error: .mjs gate scripts, intentionally untyped
import { classifyVisit } from "../scripts/storefront-canary.mjs";

const CFG = {
  heroMinViewportFraction: 0.7,
  minBytesForWidthCheck: 30720,
  maxRequestedToDisplayedWidth: 1.5,
  cardImageBytes: 153600,
  heroImageBytes: 307200,
};
const url = (w: number) => `https://x.test/_next/image?url=a&w=${w}&q=75`;
const srcset = [384, 640, 750, 828, 1080].map((w) => `${url(w)} ${w}w`).join(", ");

function run(width: number, requested: number, bytes: number, extra: object = {}) {
  const src = url(requested);
  vi.stubGlobal("window", { devicePixelRatio: 2, innerWidth: 375, innerHeight: 812 });
  vi.stubGlobal("performance", { getEntriesByType: () => [{ name: src, encodedBodySize: bytes }] });
  vi.stubGlobal("document", {
    querySelectorAll: () => [
      {
        currentSrc: src,
        src,
        srcset,
        alt: "plant",
        complete: true,
        naturalWidth: 800,
        getBoundingClientRect: () => ({ width, height: 100, top: 0, bottom: 100 }),
        ...extra,
      },
    ],
  });
  return auditImages(CFG);
}

afterEach(() => vi.unstubAllGlobals());

describe("auditImages", () => {
  it("flags a request far wider than the display when a smaller rung fits", () => {
    const r = run(170, 1080, 90_000);
    expect(r.tooWide[0]).toMatchObject({ requested: 1080, ideal: 384, displayed: 340 });
  });
  it("accepts the smallest rung that covers the display", () => {
    expect(run(170, 384, 90_000).tooWide).toEqual([]);
  });
  it("ignores oversized requests for tiny files", () => {
    expect(run(170, 1080, 11_000).tooWide).toEqual([]);
  });
  it("uses the card limit for narrow images and the hero limit for wide ones", () => {
    expect(run(170, 384, 200_000).overBudget[0].kind).toBe("card");
    expect(run(340, 750, 200_000).overBudget).toEqual([]);
    expect(run(340, 750, 400_000).overBudget[0].kind).toBe("hero");
  });
  it("reports broken images", () => {
    expect(run(170, 384, 0, { naturalWidth: 0 }).broken).toEqual(["plant"]);
  });
});

describe("firstProductPath", () => {
  it("skips the listing link and query links", () => {
    const html = `<a href="/shop"></a><a href="/shop/?c=1"></a><a href="/shop/oak-tree"></a>`;
    expect(firstProductPath(html, "/shop/")).toBe("/shop/oak-tree");
  });
  it("uses the marker class to skip category links", () => {
    const html = `<a href="/shop/guilds"></a><a class="var-card__link" href="/shop/oak-tree"></a>`;
    expect(firstProductPath(html, "/shop/", "var-card__link")).toBe("/shop/oak-tree");
  });
  it("returns null with no products", () => {
    expect(firstProductPath(`<a href="/about"></a>`, "/shop/")).toBeNull();
  });
});

describe("classifyVisit", () => {
  const healthy = {
    requestedUrl: "https://a.test/shop",
    finalUrl: "https://a.test/shop/",
    status: 200,
    cfMitigated: false,
    title: "Shop",
    pageErrors: [],
    serverErrors: [],
    brokenImages: [],
  };
  it("passes a healthy page, ignoring a trailing slash", () => {
    expect(classifyVisit(healthy)).toEqual([]);
  });
  it("fails a 200 that landed on a different page", () => {
    expect(classifyVisit({ ...healthy, finalUrl: "https://a.test/" })[0]).toMatch(/redirected/);
  });
  it("fails a Cloudflare challenge served with a 200", () => {
    expect(classifyVisit({ ...healthy, title: "Just a moment..." })[0]).toMatch(/challenge/);
    expect(classifyVisit({ ...healthy, cfMitigated: true })[0]).toMatch(/challenge/);
  });
  it("fails server errors, crashes and broken images", () => {
    expect(classifyVisit({ ...healthy, status: 503, pageErrors: ["x"], serverErrors: ["500 /api"], brokenImages: ["a"] })).toHaveLength(4);
  });
});
