import { describe, expect, it } from "vitest";
import robots from "../app/robots";
import { DEFAULT_OG_IMAGE, SITE_URL, pageMetadata } from "./site-metadata";

// GOL-3585: the regressions these guard are invisible to the typechecker — a
// page whose own `openGraph` silently drops the share image, or a robots.txt
// that stops pointing at the sitemap.
describe("site metadata (GOL-3585)", () => {
  it("SITE_URL is an absolute https origin with no trailing slash", () => {
    expect(SITE_URL).toMatch(/^https:\/\/[a-z0-9.-]+$/);
  });

  it("pageMetadata keeps the full share card and sets a self-canonical", () => {
    const m = pageMetadata({ path: "/x", title: "X", description: "d" });
    expect(m.alternates?.canonical).toBe("/x");
    expect(m.openGraph).toMatchObject({ url: "/x", description: "d", images: [DEFAULT_OG_IMAGE] });
    expect(m.twitter).toMatchObject({ card: "summary_large_image", images: [DEFAULT_OG_IMAGE.url] });
  });

  it("robots.txt points at this site's sitemap", () => {
    expect(robots().sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });
});
