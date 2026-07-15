import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * Load-order + single-token-system guards for the nursery storefront (GOL-380).
 *
 * Two things here are enforced by nothing but convention, and both fail silently
 * — the page still renders, just in the wrong brand's colours:
 *
 *  1. `@grove/ui-kit/styles.css` pulls in the token CONTRACT, whose defaults are
 *     the Goldberry-brown baseline (--grove-color-primary: #3d2810). The nursery
 *     theme reassigns those same :root roles, so it has equal specificity and
 *     wins only by being imported LAST. Flip the two @import lines and the
 *     nursery storefront quietly turns brown.
 *  2. The app used to declare its own @theme palette of raw hexes alongside the
 *     token theme — two systems, free to drift. Convergence only holds if a raw
 *     hex never comes back.
 *
 * Rather than assert on the text order (which a refactor could satisfy while
 * breaking the result), this walks the real @import graph and replays the
 * cascade, so it tests the value the browser would actually compute.
 */

const REPO = path.resolve(__dirname, "../../..");
const GLOBALS = path.join(__dirname, "globals.css");

const CONTRACT_DEFAULT_PRIMARY = "#3d2810"; // Goldberry-brown baseline
const NURSERY_PRIMARY = "#1f3f2b"; // forest

/** Map a CSS @import specifier to a file on disk, or null if it isn't ours. */
function resolveImport(spec: string, fromDir: string): string | null {
  if (spec === "tailwindcss" || spec.startsWith("http")) return null;
  if (spec.startsWith(".")) return path.resolve(fromDir, spec);
  // Workspace packages are consumed via their package.json "exports" subpaths.
  const pkgMap: Record<string, string> = {
    "@grove/ui-kit/styles.css": "packages/grove-ui/src/styles.css",
    "@grove/tokens/contract.css": "packages/grove-tokens/src/contract.css",
  };
  if (pkgMap[spec]) return path.join(REPO, pkgMap[spec]);
  const theme = spec.match(/^@grove\/tokens\/themes\/([\w-]+)\.css$/);
  if (theme) return path.join(REPO, `packages/grove-tokens/src/themes/${theme[1]}.css`);
  return null;
}

function importsOf(css: string): string[] {
  return [...css.matchAll(/@import\s+(?:url\()?["']([^"']+)["']\)?\s*;/g)].map((m) => m[1]);
}

/** Flatten globals.css's @import graph into the order the browser sees. */
function flatten(file: string, seen = new Set<string>()): string[] {
  if (!existsSync(file) || seen.has(file)) return [];
  seen.add(file);
  const css = readFileSync(file, "utf8");
  const out: string[] = [];
  for (const spec of importsOf(css)) {
    const target = resolveImport(spec, path.dirname(file));
    if (target) out.push(...flatten(target, seen));
  }
  out.push(css); // the importing file's own rules come after its @imports
  return out;
}

/** Last :root declaration of `name` wins — equal specificity, so order decides. */
function cascadeValue(chunks: string[], name: string): string | undefined {
  let winner: string | undefined;
  for (const css of chunks) {
    for (const m of css.matchAll(new RegExp(`${name}\\s*:\\s*([^;]+);`, "g"))) {
      winner = m[1].trim().toLowerCase();
    }
  }
  return winner;
}

/** The @theme block Tailwind reads to build utilities (bg-primary, …). */
function themeBlock(css: string): string {
  const m = css.match(/@theme[^{]*\{([\s\S]*?)\n\}/);
    return m ? m[1] : "";
}

describe("nursery globals.css — theme load order", () => {
  const chunks = flatten(GLOBALS);

  it("resolves the @import graph (guards the test itself against a silent no-op)", () => {
    expect(chunks.length).toBeGreaterThan(3);
    const all = chunks.join("\n");
    expect(all).toContain("--grove-color-primary");
  });

  it("the hazard is real: the contract's default primary differs from nursery's", () => {
    const contract = readFileSync(
      path.join(REPO, "packages/grove-tokens/src/contract.css"),
      "utf8",
    );
    expect(cascadeValue([contract], "--grove-color-primary")).toBe(CONTRACT_DEFAULT_PRIMARY);
    expect(CONTRACT_DEFAULT_PRIMARY).not.toBe(NURSERY_PRIMARY);
  });

  it("nursery's theme wins the cascade — the storefront is forest, not Goldberry brown", () => {
    // This is the assertion that fails if the two @import lines are ever swapped.
    expect(cascadeValue(chunks, "--grove-color-primary")).toBe(NURSERY_PRIMARY);
  });

  it("theme import comes after the ui-kit bundle that carries the contract", () => {
    const css = readFileSync(GLOBALS, "utf8");
    const specs = importsOf(css);
    const uiKit = specs.indexOf("@grove/ui-kit/styles.css");
    const theme = specs.indexOf("@grove/tokens/themes/nursery.css");
    expect(uiKit).toBeGreaterThanOrEqual(0);
    expect(theme).toBeGreaterThanOrEqual(0);
    expect(theme).toBeGreaterThan(uiKit);
  });
});

describe("nursery globals.css — one colour system (GOL-380)", () => {
  const css = readFileSync(GLOBALS, "utf8");

  it("@theme carries no raw hex — utilities derive from the --grove-* contract", () => {
    const hexes = themeBlock(css).match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    expect(hexes).toEqual([]);
  });

  it("@theme maps every role onto a --grove-* token", () => {
    const block = themeBlock(css);
    expect(block).toMatch(/--color-primary:\s*var\(--grove-color-primary\)/);
    expect(block).toMatch(/--color-accent:\s*var\(--grove-color-accent\)/);
    expect(block).toMatch(/--color-background:\s*var\(--grove-color-paper\)/);
    expect(block).toMatch(/--color-foreground:\s*var\(--grove-color-ink\)/);
    expect(block).toMatch(/--font-display:\s*var\(--grove-font-display\)/);
  });

  it("the brand palette aliases derive from tokens, not copied hexes", () => {
    // --orange-deep / --leaf-deep / --moss are deliberately still raw: no
    // --grove-* role covers them yet (promoting them touches all four brands).
    // Everything that HAS a role must use it.
    expect(css).toMatch(/--forest:\s*var\(--grove-color-primary\)/);
    expect(css).toMatch(/--orange:\s*var\(--grove-color-accent\)/);
    expect(css).toMatch(/--parch:\s*var\(--grove-color-paper\)/);
    expect(css).toMatch(/--ink:\s*var\(--grove-color-ink\)/);
  });
});
