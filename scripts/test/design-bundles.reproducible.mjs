import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";

const BRANDS = ["goldberry", "ggg", "nursery", "hub"];
const COMPONENTS = [
  "Button", "SiblingStrip", "NavLink", "CartNavLink", "ProductCard",
  "VendorCard", "BuyAtVendorForm", "JournalProductEmbed",
  "HeroSlideshow", "ShopSubHeader", "CategoryBar",
];
const ROOT = join(import.meta.dirname, "..", "..");

test("build-design-bundles produced all 4 brand bundles with all components", () => {
  for (const brand of BRANDS) {
    const dir = join(ROOT, "dist-bundles", brand);
    assert.ok(existsSync(join(dir, "_ds_bundle.js")), `${brand}: _ds_bundle.js missing`);
    assert.ok(existsSync(join(dir, "styles.css")), `${brand}: styles.css missing`);
    for (const c of COMPONENTS) {
      const html = join(dir, "components", "general", c, `${c}.html`);
      assert.ok(existsSync(html), `${brand}: ${c}.html missing`);
    }
  }
});
