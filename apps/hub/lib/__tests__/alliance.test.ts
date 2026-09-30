import { describe, expect, it } from "vitest";
import { siblingSitesForHost } from "@grove/ui";

import nextConfig from "../../next.config";
import {
  ALLIANCE_CANONICAL,
  SOCIAL_LINKS,
  allianceJsonLd,
  allianceMembers,
  allianceSections,
  normalizeSource,
  tipOptions,
  withUtm,
  type TipId,
} from "../alliance";

const allTips: Record<TipId, string> = {
  "5": "https://buy.stripe.com/test_5",
  "10": "https://buy.stripe.com/test_10",
  "25": "https://buy.stripe.com/test_25",
  custom: "https://buy.stripe.com/test_custom",
};

const prodMembers = () => allianceMembers(siblingSitesForHost("gatheringatthegrove.com"));

describe("allianceMembers", () => {
  it("resolves every member's URL, Grove sites on prod", () => {
    const hrefs = Object.fromEntries(prodMembers().map((m) => [m.key, m.href]));
    expect(hrefs).toEqual({
      hub: "https://gatheringatthegrove.com",
      nursery: "https://atthegrovenursery.com",
      goldberry: "https://goldberrygrove.farm",
      sweetpotomac: "https://sweetpotomacfarm.com/",
      coalridge: "https://www.facebook.com/coalridgehomestead/",
      ggg: "https://woodworkingeorge.com",
    });
  });

  it("keeps QA visitors on QA for the Grove sites; outside members keep their real URL", () => {
    const members = allianceMembers(siblingSitesForHost("hub.qa.gatheringatthegrove.com"));
    const grove = members.filter((m) => ["hub", "nursery", "goldberry", "ggg"].includes(m.key));
    expect(grove).toHaveLength(4);
    for (const m of grove) expect(new URL(m.href).hostname).toMatch(/\.qa\.gatheringatthegrove\.com$/);
    expect(members.find((m) => m.key === "coalridge")?.href).toBe("https://www.facebook.com/coalridgehomestead/");
  });

  it("drops a Grove member whose sibling site is missing instead of rendering a dead card", () => {
    const members = allianceMembers([{ name: "Gather at the Grove", href: "https://x.test" }]);
    // nursery, goldberry and ggg need their sibling site; outside members don't
    expect(members.map((m) => m.key)).toEqual(["hub", "sweetpotomac", "coalridge"]);
  });

  it("every logo is a site-relative static path, and members without one get a monogram", () => {
    for (const m of prodMembers()) {
      if (m.logo) expect(m.logo).toMatch(/^\/brand\//);
      else expect(m.monogram.length).toBeGreaterThan(0);
    }
  });
});

describe("allianceSections", () => {
  it("puts Gather at the Grove first with no heading (not a member), then Farms A→Z, then Value-Added Products A→Z", () => {
    const sections = allianceSections(prodMembers());
    expect(sections.map((s) => [s.heading, s.members.map((m) => m.title)])).toEqual([
      [null, ["Gather at the Grove"]],
      ["Farms", ["Coal Ridge Homestead", "Goldberry Grove", "Sweet Potomac Farm & Studio"]],
      ["Value-Added Products", ["At The Grove Nursery", "George George George Woodworking"]],
    ]);
  });

  it("slots a future member into its group alphabetically and skips empty groups", () => {
    const newcomer = { ...prodMembers()[0], key: "hub" as const, group: "farm" as const, title: "Birch Hollow Farm" };
    const farms = allianceSections([...prodMembers(), newcomer]).find((s) => s.key === "farm")!;
    expect(farms.members.map((m) => m.title)).toEqual([
      "Birch Hollow Farm",
      "Coal Ridge Homestead",
      "Goldberry Grove",
      "Sweet Potomac Farm & Studio",
    ]);
    const onlyFarms = allianceSections(prodMembers().filter((m) => m.group === "farm"));
    expect(onlyFarms.map((s) => s.key)).toEqual(["farm"]);
  });
});

describe("allianceJsonLd", () => {
  it("is a schema.org Organization listing the other businesses as members", () => {
    const ld = allianceJsonLd(prodMembers());
    expect(ld["@type"]).toBe("Organization");
    expect(ld.name).toBe("Gather at the Grove");
    expect(ld.member.map((m) => m.name)).toEqual([
      "At The Grove Nursery",
      "Goldberry Grove",
      "Sweet Potomac Farm & Studio",
      "Coal Ridge Homestead",
      "George George George Woodworking",
    ]);
  });
});

describe("/links → /alliance", () => {
  it("is a permanent redirect to the canonical page", async () => {
    const redirects = await nextConfig.redirects?.();
    expect(redirects).toContainEqual({ source: "/links", destination: "/alliance", permanent: true });
    expect(ALLIANCE_CANONICAL).toBe("https://gatheringatthegrove.com/alliance");
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

  it("ships with all four live Payment Links, so the tip jar renders", () => {
    const tips = tipOptions();
    expect(tips).not.toBeNull();
    for (const t of tips ?? []) expect(t.href).toMatch(/^https:\/\/buy\.stripe\.com\//);
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
