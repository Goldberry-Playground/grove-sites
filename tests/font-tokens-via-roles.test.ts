// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Repo-wide invariant for GOL-3479 (follow-up to #1110, self-hosted next/font).
 *
 * next/font keeps the real family name, so a stylesheet that says
 * `font-family: "Fraunces"` still matches the self-hosted face. What it loses
 * is the metric-matched `"Fraunces Fallback"` face that only the
 * `--font-nf-*` variable carries. Layout then shifts on swap wherever that rule
 * applies, and the CLS fix is real only on the elements that read the token.
 *
 * So every storefront that self-hosts its faces must route fonts through the
 * `--grove-font-{display,body,mono}` roles:
 *   1. each `--grove-font-*` role reads a `var(--font-nf-*)` next/font variable;
 *   2. every Tailwind / app font token (`--font-sans`, `--font-display`,
 *      `--font-body`, `--font-mono`) reads a `--grove-font-*` role;
 *   3. no `font-family` declaration names a brand face literally;
 *   4. every `var(--font-xxx)` the app CSS reads is actually defined (ggg read
 *      `--font-body` for two rules without ever setting it).
 *
 * Discovers apps by the presence of the role definition, so an app that starts
 * self-hosting later is covered the day it does.
 */

const REPO = path.resolve(__dirname, "..");
const APPS = path.join(REPO, "apps");

const ROLES = ["--grove-font-display", "--grove-font-body", "--grove-font-mono"];
const APP_TOKENS = ["--font-sans", "--font-display", "--font-body", "--font-mono"];
const BRAND_FACES = [
  "Fraunces",
  "Newsreader",
  "IBM Plex Mono",
  "Libre Baskerville",
  "Cormorant Garamond",
  "Cardo",
];

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function cssFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    if (name === "node_modules" || name === ".next") return [];
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) return cssFiles(p);
    return name.endsWith(".css") ? [p] : [];
  });
}

type App = { name: string; globals: string; css: string; styles: { file: string; css: string }[] };

const apps: App[] = readdirSync(APPS, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => {
    const globals = path.join(APPS, d.name, "app", "globals.css");
    if (!existsSync(globals)) return null;
    const css = stripComments(readFileSync(globals, "utf8"));
    if (!css.includes("--grove-font-display:")) return null;
    const styles = cssFiles(path.join(APPS, d.name, "app")).map((file) => ({
      file: path.relative(REPO, file),
      css: stripComments(readFileSync(file, "utf8")),
    }));
    return { name: d.name, globals: path.relative(REPO, globals), css, styles };
  })
  .filter((a): a is App => a !== null);

function declarations(css: string, prop: string): string[] {
  const re = new RegExp(`(?:^|[\\s;{])${prop.replace(/[-]/g, "\\-")}\\s*:\\s*([^;}]+)`, "g");
  return [...css.matchAll(re)].map((m) => m[1].trim());
}

describe("storefront fonts go through the --grove-font-* roles", () => {
  it("finds the self-hosting storefronts", () => {
    expect(apps.map((a) => a.name).sort()).toEqual(["ggg", "goldberry", "hub", "nursery"]);
  });

  for (const app of apps) {
    describe(app.name, () => {
      it("each --grove-font-* role reads a next/font variable", () => {
        for (const role of ROLES) {
          const values = declarations(app.css, role);
          expect(values, `${app.globals} must define ${role}`).not.toHaveLength(0);
          for (const v of values) {
            expect(v, `${role} in ${app.globals}`).toMatch(/var\(--font-nf-[a-z-]+\)/);
          }
        }
      });

      it("every app font token reads a --grove-font-* role, not a family name", () => {
        const defined = APP_TOKENS.filter((t) => declarations(app.css, t).length > 0);
        expect(defined, `${app.globals} defines no font tokens`).not.toHaveLength(0);
        for (const token of defined) {
          for (const v of declarations(app.css, token)) {
            expect(v, `${token} in ${app.globals}`).toMatch(/^var\(--grove-font-(display|body|mono)\)$/);
          }
        }
      });

      it("no font-family declaration names a brand face literally", () => {
        for (const { file, css } of app.styles) {
          for (const v of declarations(css, "font-family")) {
            for (const face of BRAND_FACES) {
              expect(v, `${file}: font-family: ${v}`).not.toContain(face);
            }
          }
        }
      });

      it("every --font-* token the app CSS reads is defined", () => {
        const definedTokens = new Set(
          [...app.css.matchAll(/(?:^|[\s;{])(--font-[a-z-]+)\s*:/g)].map((m) => m[1]),
        );
        for (const { file, css } of app.styles) {
          const read = new Set(
            [...css.matchAll(/var\((--font-(?!nf-)[a-z-]+)\)/g)].map((m) => m[1]),
          );
          for (const token of read) {
            expect(definedTokens.has(token), `${file} reads ${token}, which ${app.globals} never defines`).toBe(true);
          }
        }
      });
    });
  }
});
