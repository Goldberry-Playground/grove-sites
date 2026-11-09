import { describe, expect, it } from "vitest";
import { groveImageDefaults } from "./images";

describe("groveImageDefaults", () => {
  it("serves WebP only", () => {
    expect(groveImageDefaults.formats).toEqual(["image/webp"]);
  });

  it("does not offer widths past the largest Odoo source", () => {
    expect(Math.max(...groveImageDefaults.deviceSizes)).toBe(1920);
  });

  it("allows the default and product-photo qualities", () => {
    expect(groveImageDefaults.qualities).toEqual(expect.arrayContaining([75, 82]));
  });
});
