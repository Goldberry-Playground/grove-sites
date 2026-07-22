import { describe, it, expect } from "vitest";
import {
  ANCHOR_TAG,
  buildHashtagPool,
  composePost,
  isBanned,
  normalizeTag,
  selectForPlatform,
} from "./hashtags";

describe("normalizeTag", () => {
  it("CamelCases multi-word phrases into a hashtag", () => {
    expect(normalizeTag("American chestnut")).toBe("#AmericanChestnut");
    expect(normalizeTag("forest farming")).toBe("#ForestFarming");
  });
  it("passes through an existing tag and strips punctuation", () => {
    expect(normalizeTag("#TreeFacts")).toBe("#TreeFacts");
    expect(normalizeTag("pawpaw!!")).toBe("#Pawpaw");
  });
  it("returns null for tags with no letters/digits", () => {
    expect(normalizeTag("   ")).toBeNull();
    expect(normalizeTag("#")).toBeNull();
  });
});

describe("buildHashtagPool", () => {
  it("puts the anchor first and orders species → places → practices", () => {
    const pool = buildHashtagPool({
      species: ["American chestnut"],
      places: ["Appalachia"],
      practices: ["forest farming"],
    });
    expect(pool[0]).toBe(ANCHOR_TAG);
    expect(pool).toEqual(["#TreeFacts", "#AmericanChestnut", "#Appalachia", "#ForestFarming"]);
  });

  it("dedupes case-insensitively and never double-adds the anchor", () => {
    const pool = buildHashtagPool({ species: ["TreeFacts", "Chestnut", "chestnut"], extra: ["#TREEFACTS"] });
    expect(pool).toEqual(["#TreeFacts", "#Chestnut"]);
  });

  it("bans #WoodWideWeb regardless of case/placement", () => {
    const pool = buildHashtagPool({ species: ["WoodWideWeb"], extra: ["#woodwideweb", "pawpaw"] });
    expect(pool.some((t) => isBanned(t))).toBe(false);
    expect(pool).toEqual(["#TreeFacts", "#Pawpaw"]);
  });
});

describe("selectForPlatform caps", () => {
  const pool = ["#TreeFacts", "#A", "#B", "#C", "#D", "#E", "#F"];
  it("Threads leans 1–3 (max 3, anchor retained)", () => {
    const t = selectForPlatform(pool, "threads");
    expect(t.length).toBe(3);
    expect(t[0]).toBe(ANCHOR_TAG);
  });
  it("Instagram allows 4–6 (max 6)", () => {
    expect(selectForPlatform(pool, "instagram").length).toBe(6);
  });
  it("never invents tags to reach the min", () => {
    expect(selectForPlatform(["#TreeFacts"], "instagram")).toEqual(["#TreeFacts"]);
  });
});

describe("composePost", () => {
  it("appends the platform-capped tags after a blank line", () => {
    const pool = ["#TreeFacts", "#Chestnut", "#Appalachia", "#ForestFarming"];
    const threads = composePost("Chestnuts feed the forest.", pool, "threads");
    expect(threads).toBe("Chestnuts feed the forest.\n\n#TreeFacts #Chestnut #Appalachia");
    const ig = composePost("Chestnuts feed the forest.", pool, "instagram");
    expect(ig.split("\n\n")[1].split(" ").length).toBe(4);
  });
  it("returns just the body when there are no tags", () => {
    expect(composePost("  hi  ", [], "threads")).toBe("hi");
  });
});
