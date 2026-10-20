// @vitest-environment node
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import HomePage from "./page";

/**
 * GOL-3478 link guard for the ggg home page.
 *
 * The home page used to carry six catalog-era piece cards linking to
 * `/shop/<slug>`. Every one 404'd on QA and prod: `shop/[id]` only accepts a
 * numeric Odoo id, and `/shop` is the deliberate static coming-soon page.
 * The hero's secondary CTA pointed at `/about`, a wireframe page that was
 * never built. This test crawls every internal href the page renders and
 * resolves it against the App Router tree, so a dead link cannot come back.
 */

const APP_DIR = __dirname;

function renderHome(): string {
  return renderToStaticMarkup(HomePage() as never);
}

/** Distinct internal hrefs (`/...`), with query and hash stripped. */
function internalHrefs(html: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/href="([^"]+)"/g)) {
    const href = m[1];
    if (href.startsWith("/") && !href.startsWith("//")) {
      out.add(href.split(/[?#]/)[0]);
    }
  }
  return [...out].sort();
}

/**
 * Walk an href through `apps/ggg/app`. A literal segment must exist as a
 * directory; otherwise a single `[param]` directory at that level matches.
 * The route exists when the final directory has a `page.tsx`.
 */
function routeExists(href: string): boolean {
  let dir = APP_DIR;
  for (const seg of href.split("/").filter(Boolean)) {
    const literal = path.join(dir, seg);
    if (existsSync(literal)) {
      dir = literal;
      continue;
    }
    const dynamic = readdirSync(dir).find((n) => /^\[.+\]$/.test(n));
    if (!dynamic) return false;
    dir = path.join(dir, dynamic);
  }
  return existsSync(path.join(dir, "page.tsx"));
}

describe("ggg home page links (GOL-3478)", () => {
  it("every internal href resolves to a route under apps/ggg/app", () => {
    const hrefs = internalHrefs(renderHome());
    expect(hrefs.length).toBeGreaterThan(0);
    const dead = hrefs.filter((h) => !routeExists(h));
    expect(dead, `dead internal links on ggg /: ${dead.join(", ")}`).toEqual([]);
  });

  it("never links into /shop/<anything>: the shop is coming-soon and product routes are numeric Odoo ids, not slugs", () => {
    const slugLinks = internalHrefs(renderHome()).filter((h) => /^\/shop\/./.test(h));
    expect(slugLinks).toEqual([]);
  });

  it("the piece cards land on the coming-soon /shop page and read as a preview, not stock", () => {
    const html = renderHome();
    const cardHrefs = [...html.matchAll(/<a[^>]*class="cat-card"[^>]*href="([^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(cardHrefs).toHaveLength(6);
    expect(new Set(cardHrefs)).toEqual(new Set(["/shop"]));
    expect(html).not.toMatch(/In stock/i);
  });

  it("the layout chrome (nav) only links to routes that exist", () => {
    const layout = readFileSync(path.join(APP_DIR, "layout.tsx"), "utf8");
    const hrefs = [...layout.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]);
    expect(hrefs.length).toBeGreaterThan(0);
    const dead = hrefs.filter((h) => !routeExists(h));
    expect(dead, `dead internal links in ggg layout: ${dead.join(", ")}`).toEqual([]);
  });
});
