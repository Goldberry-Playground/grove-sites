import { describe, expect, it } from "vitest";
import { siblingSitesForHost } from "@grove/ui";

import {
  SOCIAL_LINKS,
  farmLinks,
  normalizeSource,
  tipOptions,
  withUtm,
  type TipId,
} from "../links";

const allTips: Record<TipId, string> = {
  "5": "https://buy.stripe.com/test_5",
  "10": "https://buy.stripe.com/test_10",
  "25": "https://buy.stripe.com/test_25",
  custom: "https://buy.stripe.com/test_custom",
};

describe("farmLinks", () => {
  it("links the three farms to prod on the prod host", () => {
    const farms = farmLinks(siblingSitesForHost("gatheringatthegrove.com"));
    expect(farms.map((f) => f.key)).toEqual(["hub", "nursery", "goldberry"]);
    expect(farms.map((f) => f.href)).toEqual([
      "https://gatheringatthegrove.com",
      "https://atthegrovenursery.com",
      "https://goldberrygrove.farm",
    ]);
  });

  it("keeps QA visitors on QA", () => {
    const farms = farmLinks(siblingSitesForHost("hub.qa.gatheringatthegrove.com"));
    for (const farm of farms) expect(new URL(farm.href).hostname).toMatch(/\.qa\.gatheringatthegrove\.com$/);
  });

  it("drops a farm whose sibling site is missing instead of rendering a dead card", () => {
    expect(farmLinks([{ name: "Gather at the Grove", href: "https://x.test" }])).toHaveLength(1);
  });
});

describe("SOCIAL_LINKS", () => {
  it("are all https or mailto", () => {
    for (const s of SOCIAL_LINKS) expect(s.href).toMatch(/^(https:\/\/|mailto:)/);
  });
});

describe("tipOptions", () => {
  it("hides the tip jar until every Payment Link is set", () => {
    expect(tipOptions({ ...allTips, custom: "" })).toBeNull();
  });

  it("rejects a non-https link", () => {
    expect(tipOptions({ ...allTips, "5": "http://buy.stripe.com/x" })).toBeNull();
    expect(tipOptions({ ...allTips, "5": "not a url" })).toBeNull();
  });

  it("returns the four amounts in order when configured", () => {
    expect(tipOptions(allTips)?.map((t) => t.label)).toEqual(["$5", "$10", "$25", "Other"]);
  });
});

describe("normalizeSource", () => {
  it("defaults to linkinbio", () => {
    expect(normalizeSource(undefined)).toBe("linkinbio");
    expect(normalizeSource("")).toBe("linkinbio");
  });

  it("slugs and caps whatever the platform sent", () => {
    expect(normalizeSource("Threads")).toBe("threads");
    expect(normalizeSource(["instagram", "x"])).toBe("instagram");
    expect(normalizeSource('"><script>')).toBe("script");
    expect(normalizeSource("a".repeat(80))).toHaveLength(32);
  });
});

describe("withUtm", () => {
  it("tags https links", () => {
    const url = new URL(withUtm("https://atthegrovenursery.com", "threads"));
    expect(url.searchParams.get("utm_source")).toBe("threads");
    expect(url.searchParams.get("utm_medium")).toBe("link_in_bio");
  });

  it("leaves mailto links alone", () => {
    expect(withUtm("mailto:sales@goldberrygrove.farm", "threads")).toBe("mailto:sales@goldberrygrove.farm");
  });
});
