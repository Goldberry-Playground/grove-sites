import { describe, expect, it } from "vitest";
import {
  KNOWN_BRANDS,
  KNOWN_CLASSES,
  LOGO_CLASS,
  isKnownBrand,
  isKnownClass,
  isLogoClass,
} from "./taxonomy";

/**
 * Reconciliation contract with AgenticOS
 * `packages/discord-plugin/src/assets/caption.ts`. These literals are the values
 * that file's `KNOWN_BRANDS` / `KNOWN_CLASSES` / `LOGO_CLASS` mirror. If the
 * taxonomy changes, update BOTH repos and this pin — a silent drift would route
 * captions to a brand/class this package cannot record.
 */
const CAPTION_KNOWN_BRANDS = ["goldberry", "ggg", "nursery", "gather"] as const;
const CAPTION_KNOWN_CLASSES = [
  "hero",
  "about",
  "founders",
  "banner",
  "gallery",
  "background",
  "video",
  "logo",
] as const;

describe("taxonomy parity with AgenticOS caption.ts", () => {
  it("brand namespaces match the caption parser", () => {
    expect([...KNOWN_BRANDS]).toEqual([...CAPTION_KNOWN_BRANDS]);
  });

  it("asset classes match the caption parser", () => {
    expect([...KNOWN_CLASSES]).toEqual([...CAPTION_KNOWN_CLASSES]);
  });

  it("logo is the Tier 4 class", () => {
    expect(LOGO_CLASS).toBe("logo");
    expect(KNOWN_CLASSES).toContain(LOGO_CLASS);
  });
});

describe("guards", () => {
  it("isKnownBrand", () => {
    expect(isKnownBrand("goldberry")).toBe(true);
    expect(isKnownBrand("acme")).toBe(false);
  });

  it("isKnownClass", () => {
    expect(isKnownClass("hero")).toBe(true);
    expect(isKnownClass("sticker")).toBe(false);
  });

  it("isLogoClass only for logo", () => {
    expect(isLogoClass("logo")).toBe(true);
    expect(isLogoClass("hero")).toBe(false);
  });
});
