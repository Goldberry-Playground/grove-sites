import { describe, it, expect } from "vitest";
import {
  resolveGhostConfig,
  resolveBrandInstance,
  resolveHubInstance,
  labelsFor,
} from "./config";
import type { OptInRequest } from "./types";

const MAP = JSON.stringify({
  grove: { url: "https://blog.gatheringatthegrove.com/" },
  nursery: { url: "https://blog.atthegrovenursery.com", newsletters: ["nl_1"] },
  goldberry: { url: "https://blog.goldberrygrove.farm" },
});

describe("resolveGhostConfig", () => {
  it("returns null when nothing is configured (feature off)", () => {
    expect(resolveGhostConfig({})).toBeNull();
    expect(resolveGhostConfig({ GHOST_NEWSLETTER_INSTANCES: "  " })).toBeNull();
  });

  it("parses the instance map and strips trailing slashes", () => {
    const cfg = resolveGhostConfig({ GHOST_NEWSLETTER_INSTANCES: MAP });
    expect(cfg).not.toBeNull();
    expect(cfg!.instances.grove!.url).toBe(
      "https://blog.gatheringatthegrove.com",
    );
    expect(cfg!.instances.nursery!.url).toBe("https://blog.atthegrovenursery.com");
    expect(cfg!.instances.nursery!.newsletters).toEqual(["nl_1"]);
  });

  it("falls back to a bare GHOST_URL as the hub (grove) instance", () => {
    const cfg = resolveGhostConfig({ GHOST_URL: "http://localhost:2368/" });
    expect(cfg!.instances.grove!.url).toBe("http://localhost:2368");
    expect(cfg!.instances.nursery).toBeUndefined();
  });

  it("falls through to GHOST_URL on a malformed map instead of crashing", () => {
    const cfg = resolveGhostConfig({
      GHOST_NEWSLETTER_INSTANCES: "{not json",
      GHOST_URL: "http://localhost:2368",
    });
    expect(cfg!.instances.grove!.url).toBe("http://localhost:2368");
  });

  it("skips instance entries without a usable url", () => {
    const cfg = resolveGhostConfig({
      GHOST_NEWSLETTER_INSTANCES: JSON.stringify({
        grove: { url: "https://hub.test" },
        nursery: { url: "" },
        goldberry: {},
      }),
    });
    expect(cfg!.instances.grove!.url).toBe("https://hub.test");
    expect(cfg!.instances.nursery).toBeUndefined();
    expect(cfg!.instances.goldberry).toBeUndefined();
  });
});

describe("instance resolution", () => {
  const cfg = resolveGhostConfig({ GHOST_NEWSLETTER_INSTANCES: MAP })!;

  it("resolves a brand to its own instance (list of record)", () => {
    expect(resolveBrandInstance(cfg, "nursery")!.sender).toBe("nursery");
    expect(resolveBrandInstance(cfg, "nursery")!.instance.url).toContain(
      "atthegrovenursery",
    );
  });

  it("maps ggg onto the hub (grove) instance", () => {
    expect(resolveBrandInstance(cfg, "ggg")!.sender).toBe("grove");
  });

  it("returns a hub instance for a tenant brand to dual-write into", () => {
    expect(resolveHubInstance(cfg, "nursery")!.url).toContain(
      "gatheringatthegrove",
    );
  });

  it("returns no hub instance when the brand already IS the hub", () => {
    expect(resolveHubInstance(cfg, "grove")).toBeNull();
    expect(resolveHubInstance(cfg, "ggg")).toBeNull();
  });

  it("returns null for an unconfigured brand instance", () => {
    const partial = resolveGhostConfig({ GHOST_URL: "https://hub.test" })!;
    expect(resolveBrandInstance(partial, "nursery")).toBeNull();
  });
});

describe("labelsFor", () => {
  const base: OptInRequest = {
    email: "sam@example.com",
    brand: "nursery",
    source: "footer",
    consent: true,
  };

  it("uses the explicit per-form label plus interest labels", () => {
    expect(
      labelsFor({ ...base, label: "nursery-footer", interests: ["produce", "events"] }),
    ).toEqual(["nursery-footer", "interest-produce", "interest-events"]);
  });

  it("falls back to <brand>-<source> when no label is given", () => {
    expect(labelsFor(base)).toEqual(["nursery-footer"]);
  });

  it("de-dupes overlapping labels", () => {
    expect(
      labelsFor({ ...base, label: "interest-produce", interests: ["produce"] }),
    ).toEqual(["interest-produce"]);
  });
});
