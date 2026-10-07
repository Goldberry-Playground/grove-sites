// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Regression guard for GOL-2756 — production must never fabricate journal posts.
 *
 * The bug: /blog fell back to a `mockPosts` fixture on BOTH the error path and
 * the empty path, so any time Ghost was down or had no posts, goldberrygrove.farm
 * served four invented entries under a Grove byline. A "Demo journal" disclaimer
 * was rendered, but the ratified Train #2 requirement is that production shows an
 * empty state and never invented posts at all.
 *
 * A second, quieter bug rode along: `ghostFetch` returns `data[resource]`, so a
 * 200 whose body has no `posts` key resolved to `undefined` and threw on
 * `.length` — a 500 where the empty state was the correct outcome.
 *
 * These render the REAL page component (an async Server Component — awaiting it
 * yields the element tree) so the assertions are about what a visitor receives,
 * not about how the source happens to be written.
 */

vi.mock("../../lib/ghost", () => ({ ghost: { posts: { list: vi.fn() } } }));

const FABRICATED = [
  "First Chestnuts of the Season",
  "Why We Ferment Our Own Fertilizer",
  "Pawpaw Season Is Two Weeks Long",
  "Planting a Chestnut",
];

async function render() {
  const { default: BlogPage } = await import("./page");
  return renderToStaticMarkup((await BlogPage()) as never);
}

async function listResolves(value: unknown) {
  const { ghost } = await import("../../lib/ghost");
  (ghost.posts.list as ReturnType<typeof vi.fn>).mockResolvedValue(value);
}

async function listRejects(err: unknown) {
  const { ghost } = await import("../../lib/ghost");
  (ghost.posts.list as ReturnType<typeof vi.fn>).mockRejectedValue(err);
}

const post = {
  id: "1", uuid: "u1", title: "Bare-root season opens in November", slug: "p1",
  html: "", excerpt: "Why we ship in dormancy.", featureImage: null,
  published_at: "2026-09-22T12:00:00.000Z", updated_at: "2026-09-22T12:00:00.000Z",
  authors: [{ id: "a1", name: "Abigail George", slug: "ag", bio: null, profileImage: null, url: "#" }],
  tags: [{ id: "t1", name: "Bare-root", slug: "br", description: null }],
  reading_time: 6,
};

beforeEach(() => vi.clearAllMocks());

describe("goldberry /blog — never fabricates posts (GOL-2756)", () => {
  it("renders real posts when Ghost has them", async () => {
    await listResolves([post]);
    const html = await render();
    expect(html).toContain("Bare-root season opens in November");
    expect(html).not.toContain("journal-state");
  });

  it("renders the empty state — not mock posts — when Ghost returns no posts", async () => {
    await listResolves([]);
    const html = await render();
    expect(html).toContain("journal-empty");
    expect(html).not.toContain("journal-error");
    for (const title of FABRICATED) expect(html).not.toContain(title);
  });

  it("renders the error state — not mock posts — when Ghost throws", async () => {
    await listRejects(new Error("ECONNREFUSED"));
    const html = await render();
    expect(html).toContain("journal-error");
    expect(html).not.toContain("journal-empty");
    for (const title of FABRICATED) expect(html).not.toContain(title);
  });

  it("degrades to the empty state when Ghost 200s with a body that has no `posts` key", async () => {
    // ghostFetch returns data["posts"] -> undefined. Pre-fix this threw on
    // `.length` and served a 500 instead of the empty state.
    await listResolves(undefined);
    await expect(render()).resolves.toContain("journal-empty");
  });

  it("never ships the demo-journal disclaimer in any state", async () => {
    for (const setup of [() => listResolves([]), () => listResolves(undefined), () => listRejects(new Error("x"))]) {
      await setup();
      const html = await render();
      expect(html).not.toMatch(/Demo journal|placeholders until Ghost/i);
    }
  });

  it("distinguishes empty from error WITHOUT relying on colour (WCAG 1.4.1)", async () => {
    await listResolves([]);
    const empty = await render();
    await listRejects(new Error("x"));
    const error = await render();

    // Distinct heading text...
    const heading = (html: string) =>
      html.match(/class="journal-state__title">([^<]+)</)?.[1] ?? "";
    expect(heading(empty)).not.toBe("");
    expect(heading(empty)).not.toBe(heading(error));

    // ...distinct icon geometry, and a semantic role a screen reader can use.
    expect(empty).not.toBe(error);
    expect(empty).toContain('role="status"');
    expect(error).toContain('role="alert"');
  });
});
