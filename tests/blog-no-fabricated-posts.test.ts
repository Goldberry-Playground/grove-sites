// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * Repo-wide invariant for GOL-2756: no storefront may fabricate journal posts.
 *
 * The per-tenant suites next to each page prove today's three blog routes behave.
 * This one is the standing rule — it discovers every `apps/*\/app/blog/page.tsx`
 * on disk, so a tenant added later (or a fourth storefront growing a /blog) is
 * covered the day it lands rather than the day someone remembers this ticket.
 *
 * "Ratified requirement: production must render an empty state, never fabricated
 * posts." A seed fixture merely gated on NODE_ENV still ships invented copy in
 * the tree and leaves the empty state unexercised, so the rule here is the
 * stronger one: a blog route may not import a post fixture at all.
 */

const REPO = path.resolve(__dirname, "..");
const APPS = path.join(REPO, "apps");

const FIXTURE_WORDS = ["mock", "fixture", "seed", "sample", "demo", "placeholder"];

function routes(rel: string): { app: string; src: string }[] {
  return readdirSync(APPS, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => ({ app: d.name, file: path.join(APPS, d.name, rel) }))
    .filter((e) => existsSync(e.file))
    .map((e) => ({ app: e.app, src: readFileSync(e.file, "utf8") }));
}

const blogPages = () => routes("app/blog/page.tsx");
const blogPostPages = () => routes("app/blog/[slug]/page.tsx");
const blogNotFounds = () => routes("app/blog/[slug]/not-found.tsx");

/** Module specifiers this file imports from, e.g. `../../data/mock-posts`. */
function importSpecifiers(src: string): string[] {
  const out: string[] = [];
  for (const line of src.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("import ")) continue;
    const m = t.split(" from ")[1] ?? (t.startsWith("import \"") ? t.slice(7) : "");
    const spec = m.trim().replace(/^["']|["'];?$/g, "");
    if (spec) out.push(spec);
  }
  return out;
}

describe("no storefront /blog fabricates posts (GOL-2756)", () => {
  const pages = blogPages();

  it("finds the blog routes it is meant to be guarding", () => {
    // Guards the guard: if discovery returns nothing, every assertion is vacuous.
    expect(pages.map((p) => p.app).sort()).toEqual(["ggg", "goldberry", "nursery"]);
  });

  it.each(pages)("$app/blog imports no post fixture", ({ src }) => {
    const offenders = importSpecifiers(src).filter((spec) => {
      const s = spec.toLowerCase();
      return s.includes("post") && FIXTURE_WORDS.some((w) => s.includes(w));
    });
    expect(offenders).toEqual([]);
  });

  it.each(pages)("$app/blog guards an unexpected Ghost body before reading .length", ({ src }) => {
    // `ghostFetch` returns data["posts"], which is `undefined` for a 200 whose
    // body lacks that key — reading `.length` off it is a 500, not an empty state.
    expect(src).toContain("ghost.posts.list");
    expect(src).toContain("?? []");
  });

  it("the deleted goldberry mock-posts fixture has not come back", () => {
    expect(existsSync(path.join(APPS, "goldberry/data/mock-posts.ts"))).toBe(false);
  });
});

/**
 * Standing rule for GOL-2788: a journal index may not link into a void.
 *
 * Discovery-based for the same reason as above — a fourth storefront growing a
 * /blog gets this the day it lands, not the day someone remembers the ticket.
 */
describe("every storefront /blog has a detail route behind it (GOL-2788)", () => {
  const lists = blogPages();
  const details = blogPostPages();
  const notFounds = blogNotFounds();

  it("finds the routes it is meant to be guarding", () => {
    expect(lists.map((p) => p.app).sort()).toEqual(["ggg", "goldberry", "nursery"]);
  });

  it.each(lists)("$app/blog links each card at /blog/[slug]", ({ src }) => {
    expect(src).toContain("href={`/blog/${post.slug}`}");
  });

  it("every /blog has a /blog/[slug] page to land on", () => {
    expect(details.map((p) => p.app).sort()).toEqual(lists.map((p) => p.app).sort());
  });

  it("every /blog/[slug] has its own branded 404", () => {
    // Without a route-scoped not-found.tsx, `notFound()` falls through to
    // Next's default black-on-white page — off-brand, and a dead end.
    expect(notFounds.map((p) => p.app).sort()).toEqual(details.map((p) => p.app).sort());
  });

  it.each(details)("$app/blog/[slug] imports no post fixture", ({ src }) => {
    const offenders = importSpecifiers(src).filter((spec) => {
      const s = spec.toLowerCase();
      return s.includes("post") && FIXTURE_WORDS.some((w) => s.includes(w));
    });
    expect(offenders).toEqual([]);
  });

  it.each(details)(
    "$app/blog/[slug] separates 'no such post' from 'Ghost is down'",
    ({ src }) => {
      // Catching everything and calling notFound() reports an outage as a
      // permanent 404 — wrong for the reader and wrong for search engines.
      expect(src).toContain("isGhostNotFound");
      expect(src).toContain("notFound()");
      expect(src).toContain("journal-error");
    },
  );

  it.each(details)("$app/blog/[slug] sanitizes CMS HTML before injecting it", ({ src }) => {
    expect(src).toContain("dangerouslySetInnerHTML");
    expect(src).toContain("sanitizeGuideHtml");
  });
});
