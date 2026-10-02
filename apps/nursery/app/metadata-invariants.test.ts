import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Guards on the site-wide metadata contract introduced in GOL-2878 Phase 1.
 *
 * These are filesystem scans rather than render tests because the failure they
 * catch is a *source* mistake that typechecks cleanly and only shows up in the
 * served HTML. Adding `title.template` to the root layout silently turned six
 * existing titles into "Wholesale & Trade — At The Grove Nursery | At The Grove
 * Nursery"; nothing but reading the page caught it. The next route someone adds
 * will reach for the same `— At The Grove Nursery` habit.
 */

const APP_DIR = path.resolve(__dirname);
const LAYOUT = path.join(APP_DIR, "layout.tsx");

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...routeFiles(full));
    } else if (/^(page|layout)\.tsx$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Drop comments, so prose explaining a rule never trips the rule. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/**
 * Remove `images: [ ... ]` blocks. Entries inside one legitimately carry a
 * `url:`; what the layout must not have is `openGraph.url` itself.
 */
function stripImageArrays(source: string): string {
  let out = "";
  let i = 0;
  for (;;) {
    const start = source.indexOf("images: [", i);
    if (start === -1) return out + source.slice(i);
    out += source.slice(i, start);
    let depth = 0;
    let j = source.indexOf("[", start);
    for (; j < source.length; j += 1) {
      if (source[j] === "[") depth += 1;
      else if (source[j] === "]" && (depth -= 1) === 0) break;
    }
    i = j + 1;
  }
}

/** Just the `title:` values, so prose in a comment or on the page is ignored. */
function titleLiterals(source: string): string[] {
  return [...source.matchAll(/\btitle:\s*(["'`])((?:\\.|(?!\1).)*)\1/g)].map((m) => m[2]);
}

describe("nursery metadata invariants", () => {
  const files = routeFiles(APP_DIR);

  it("finds the routes it is supposed to be guarding", () => {
    expect(files.length).toBeGreaterThan(8);
  });

  it("sets the brand suffix in exactly one place", () => {
    // `title.template` lives in the root layout. A second template, or a route
    // repeating the brand by hand, renders it twice.
    for (const file of files) {
      const source = stripComments(readFileSync(file, "utf8"));
      if (file === LAYOUT) continue;
      expect(source, `${path.relative(APP_DIR, file)} sets its own title.template`).not.toMatch(
        /template:\s*[`"']/,
      );
      for (const title of titleLiterals(source)) {
        expect(
          title,
          `${path.relative(APP_DIR, file)} repeats the brand in a title`,
        ).not.toMatch(/Grove Nursery/i);
      }
    }
  });

  it("sets metadataBase once, in the root layout", () => {
    const owners = files.filter((f) => stripComments(readFileSync(f, "utf8")).includes("metadataBase"));
    expect(owners).toEqual([LAYOUT]);
  });

  it("never puts a canonical or og:url in the root layout", () => {
    // Both are inherited by every route that does not set its own, so a value
    // here points the whole site's canonical at the homepage.
    const layout = stripImageArrays(stripComments(readFileSync(LAYOUT, "utf8")));
    expect(layout).not.toMatch(/canonical\s*:/);
    expect(layout).not.toMatch(/\burl\s*:/);
  });
});
