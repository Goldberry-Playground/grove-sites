import { describe, expect, it } from "vitest";
import { maxAgeSeconds, PRODUCT_MAX_AGE_SECONDS } from "./policy";

describe("maxAgeSeconds", () => {
  it("caps the catalog tag at 600s", () => {
    expect(PRODUCT_MAX_AGE_SECONDS).toBe(600);
    expect(maxAgeSeconds(["grove-catalog"])).toBe(600);
  });

  it("caps any per-product tag at 600s", () => {
    expect(maxAgeSeconds(["grove-product-42"])).toBe(600);
    expect(maxAgeSeconds(["_N_T_/shop", "grove-product-7"])).toBe(600);
  });

  it("returns null for entries with no product tag", () => {
    expect(maxAgeSeconds([])).toBeNull();
    expect(maxAgeSeconds(["_N_T_/shop", "_N_T_/layout"])).toBeNull();
    expect(maxAgeSeconds(["grove-catalogue", "grove-product"])).toBeNull();
  });
});
