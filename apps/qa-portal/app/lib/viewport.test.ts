import { describe, expect, it } from "vitest";
import { VIEWPORTS, VIEWPORT_WIDTHS, viewportWidth } from "./viewport";

describe("viewport", () => {
  it("orders viewports small → large", () => {
    expect([...VIEWPORTS]).toEqual(["mobile", "tablet", "desktop"]);
  });

  it("maps each viewport to its pixel width", () => {
    expect(viewportWidth("mobile")).toBe(375);
    expect(viewportWidth("tablet")).toBe(768);
    expect(viewportWidth("desktop")).toBe(1280);
  });

  it("widths strictly increase across the ordered viewports", () => {
    const widths = VIEWPORTS.map((v) => VIEWPORT_WIDTHS[v]);
    for (let i = 1; i < widths.length; i++) {
      expect(widths[i]).toBeGreaterThan(widths[i - 1]);
    }
  });
});
