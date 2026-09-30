import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Tap-target guard for the shared capture form (GOL-2753).
 *
 * `<Button>` sets its padding and font-size as INLINE styles, so the rendered
 * height of the capture submit was whatever the inherited line-height made it —
 * 38.8px (desktop) to 42.4px (mobile), under the Grove 44px floor (GOL-2440,
 * WCAG 2.5.8 AAA). Nothing in a component test measures layout, and the four
 * brands differ only by body line-height, so this asserts the CSS floor itself.
 */

const css = readFileSync(path.join(__dirname, "CaptureForm.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

/** Declarations for `selector`, merged in source order. */
function decls(selector: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [, sels, body] of css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
    if (!sels.split(",").some((s) => s.trim() === selector)) continue;
    for (const d of body.split(";")) {
      const i = d.indexOf(":");
      if (i > 0) out[d.slice(0, i).trim()] = d.slice(i + 1).trim();
    }
  }
  return out;
}

describe("CaptureForm.css tap targets (GOL-2753)", () => {
  it.each([".grove-capture .grove-btn", ".grove-capture__input"])(
    "%s clears the 44px floor",
    (sel) => {
      expect(decls(sel)["min-height"]).toBe("2.75rem");
    },
  );

  it("the submit centres its label inside the taller box", () => {
    const d = decls(".grove-capture .grove-btn");
    expect(d.display).toBe("inline-flex");
    expect(d["align-items"]).toBe("center");
    expect(d["justify-content"]).toBe("center");
  });
});
