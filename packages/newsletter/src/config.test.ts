import { describe, it, expect } from "vitest";
import {
  resolveMailerLiteConfig,
  resolveGroupIds,
  brandGroupKey,
  interestGroupKey,
} from "./config";

describe("resolveMailerLiteConfig", () => {
  it("returns null when the API key is absent (feature off)", () => {
    expect(resolveMailerLiteConfig({})).toBeNull();
    expect(resolveMailerLiteConfig({ MAILERLITE_API_KEY: "  " })).toBeNull();
  });

  it("parses api key, groups map, and defaults", () => {
    const cfg = resolveMailerLiteConfig({
      MAILERLITE_API_KEY: "key_123",
      MAILERLITE_GROUPS: '{"brand:grove":"1","interest:produce":"2"}',
    });
    expect(cfg).not.toBeNull();
    expect(cfg!.apiKey).toBe("key_123");
    expect(cfg!.baseUrl).toContain("mailerlite");
    expect(cfg!.groups).toEqual({ "brand:grove": "1", "interest:produce": "2" });
    expect(cfg!.doubleOptIn).toBe(true);
  });

  it("honors NEWSLETTER_DOUBLE_OPTIN=0 and a base url override", () => {
    const cfg = resolveMailerLiteConfig({
      MAILERLITE_API_KEY: "k",
      NEWSLETTER_DOUBLE_OPTIN: "0",
      MAILERLITE_BASE_URL: "https://example.test/api",
    });
    expect(cfg!.doubleOptIn).toBe(false);
    expect(cfg!.baseUrl).toBe("https://example.test/api");
  });

  it("degrades to no groups on a malformed groups map instead of throwing", () => {
    const cfg = resolveMailerLiteConfig({
      MAILERLITE_API_KEY: "k",
      MAILERLITE_GROUPS: "{not json",
    });
    expect(cfg!.groups).toEqual({});
  });

  it("ignores non-string group values", () => {
    const cfg = resolveMailerLiteConfig({
      MAILERLITE_API_KEY: "k",
      MAILERLITE_GROUPS: '{"brand:grove":"1","interest:x":42}',
    });
    expect(cfg!.groups).toEqual({ "brand:grove": "1" });
  });
});

describe("group key + id resolution", () => {
  const cfg = {
    apiKey: "k",
    baseUrl: "https://x/api",
    doubleOptIn: true,
    groups: {
      "brand:grove": "g1",
      "brand:nursery": "g2",
      "interest:produce": "i1",
      "interest:events": "i2",
    },
  };

  it("maps ggg brand onto the grove sender (Digest ride-along)", () => {
    expect(brandGroupKey("ggg")).toBe("brand:grove");
    expect(brandGroupKey("goldberry")).toBe("brand:goldberry");
    expect(interestGroupKey("produce")).toBe("interest:produce");
  });

  it("resolves brand + interest group ids", () => {
    expect(resolveGroupIds(cfg, "nursery", ["produce", "events"])).toEqual([
      "g2",
      "i1",
      "i2",
    ]);
  });

  it("skips unmapped tags without failing", () => {
    expect(resolveGroupIds(cfg, "goldberry", ["woodworking"])).toEqual([]);
    expect(resolveGroupIds(cfg, "grove")).toEqual(["g1"]);
  });

  it("de-dupes when brand and interest resolve to the same group", () => {
    const dupCfg = { ...cfg, groups: { "brand:grove": "same", "interest:produce": "same" } };
    expect(resolveGroupIds(dupCfg, "grove", ["produce"])).toEqual(["same"]);
  });
});
