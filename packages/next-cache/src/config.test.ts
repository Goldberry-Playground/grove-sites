import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { groveCacheConfig } from "./config";

describe("groveCacheConfig", () => {
  it("points at an existing built handler", () => {
    const cfg = groveCacheConfig();
    expect(typeof cfg.cacheHandler).toBe("string");
    expect(existsSync(cfg.cacheHandler as string)).toBe(true);
  });

  it("leaves Next's memory cache size alone so env-unset mode behaves as before", () => {
    expect("cacheMaxMemorySize" in groveCacheConfig()).toBe(false);
  });
});
