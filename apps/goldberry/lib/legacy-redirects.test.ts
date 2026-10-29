import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LEGACY_POST_SLUGS, legacyRedirects } from "./legacy-redirects";

const redirects = legacyRedirects();
const bySource = (source: string) => redirects.find((r) => r.source === source);

// The old goldberrygrove.farm was a Ghost site whose posts lived at /<slug>/.
// Those URLs are in search results and old shares; they now 404 on the
// storefront. Every one must land on the same post under /blog.
describe("legacy Ghost redirects", () => {
  it("lists the 28 migrated posts (coming-soon was dropped)", () => {
    expect(LEGACY_POST_SLUGS).toHaveLength(28);
    expect(new Set(LEGACY_POST_SLUGS).size).toBe(28);
    expect(LEGACY_POST_SLUGS).not.toContain("coming-soon");
  });

  it("sends every legacy post slug to /blog/<slug> permanently", () => {
    for (const slug of LEGACY_POST_SLUGS) {
      expect(bySource(`/${slug}`)).toEqual({ source: `/${slug}`, destination: `/blog/${slug}`, permanent: true });
    }
  });

  it("never shadows a real storefront route", () => {
    const appDir = path.join(__dirname, "..", "app");
    const routes = readdirSync(appDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => `/${d.name}`);
    expect(routes).toContain("/about");
    for (const r of redirects) expect(routes).not.toContain(r.source);
  });

  it("has no catch-all that would turn every storefront 404 into a blog 404", () => {
    for (const r of redirects) expect(r.source).not.toMatch(/^\/:[a-z]+/);
  });

  it("sends Ghost archive URLs and the feed to /blog", () => {
    for (const source of ["/tag/:tag*", "/author/:author*", "/rss", "/coming-soon"]) {
      expect(bySource(source)).toMatchObject({ destination: "/blog", permanent: true });
    }
  });

  it("sends the old pages where Task 0 ruled", () => {
    expect(bySource("/education")).toMatchObject({ destination: "/visit/seminars", permanent: true });
    expect(bySource("/nursery")).toMatchObject({ destination: "https://atthegrovenursery.com/", permanent: true });
    // Interim home until the consult dashboard ships, so not cached forever.
    expect(bySource("/consulting")).toMatchObject({ destination: "https://atthegrovenursery.com/plan", permanent: false });
  });

  it("leaves /about to the storefront's own page", () => {
    expect(bySource("/about")).toBeUndefined();
  });
});
