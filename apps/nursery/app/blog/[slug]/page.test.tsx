// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GhostError } from "@grove/ghost-client";

/**
 * GOL-2788 — /blog/[slug] did not exist, so every card on /blog was a 404.
 *
 * These render the REAL Server Components (awaiting one yields its element
 * tree), so the assertions are about what a visitor receives.
 *
 * The behaviour worth pinning is the three-way split. Collapsing it is the easy
 * mistake: catch-everything-and-notFound() answers "this post does not exist"
 * whenever Ghost is merely unreachable, which lies to the reader and tells
 * search engines to drop a live page.
 */

vi.mock("../../../lib/ghost", () => ({ ghost: { posts: { get: vi.fn() } } }));

const NOT_FOUND = "__next_not_found__";
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error(NOT_FOUND);
  },
}));

async function render(slug = "p1") {
  const { default: Page } = await import("./page");
  return renderToStaticMarkup(
    (await Page({ params: Promise.resolve({ slug }) })) as never,
  );
}

async function renderNotFound() {
  const { default: NotFound } = await import("./not-found");
  return renderToStaticMarkup(NotFound() as never);
}

async function getResolves(value: unknown) {
  const { ghost } = await import("../../../lib/ghost");
  (ghost.posts.get as ReturnType<typeof vi.fn>).mockResolvedValue(value);
}

async function getRejects(err: unknown) {
  const { ghost } = await import("../../../lib/ghost");
  (ghost.posts.get as ReturnType<typeof vi.fn>).mockRejectedValue(err);
}

const post = {
  id: "1",
  uuid: "u1",
  title: "Bare-root season opens in November",
  slug: "p1",
  html: "<p>We lift in dormancy, so the roots travel asleep.</p>",
  excerpt: "A custom standfirst an editor actually wrote.",
  featureImage: null,
  published_at: "2026-09-22T12:00:00.000Z",
  updated_at: "2026-09-22T12:00:00.000Z",
  authors: [
    { id: "a1", name: "Abigail George", slug: "ag", bio: null, profileImage: null, url: "#" },
  ],
  tags: [{ id: "t1", name: "Bare-root", slug: "br", description: null }],
  reading_time: 6,
};

beforeEach(() => vi.clearAllMocks());

describe("nursery /blog/[slug] (GOL-2788)", () => {
  it("renders the post when Ghost has it", async () => {
    await getResolves(post);
    const html = await render();
    expect(html).toContain("Bare-root season opens in November");
    expect(html).toContain("roots travel asleep");
    expect(html).toContain("Abigail George");
    expect(html).toContain("6 min read");
    expect(html).toContain("Bare-root"); // tag chip
    expect(html).not.toContain("journal-state");
  });

  it("404s when Ghost says there is no such post", async () => {
    await getRejects(new GhostError('Post with slug "nope" not found', 404));
    await expect(render("nope")).rejects.toThrow(NOT_FOUND);
  });

  it("404s when Ghost 200s with a body that has no post", async () => {
    await getResolves(undefined);
    await expect(render()).rejects.toThrow(NOT_FOUND);
  });

  it("shows the ERROR state — not a 404 — when Ghost is unreachable", async () => {
    // The distinction this route exists to keep: a reachability failure must
    // not be reported to the reader (or to Google) as "this post is gone".
    await getRejects(new TypeError("fetch failed"));
    const html = await render();
    expect(html).toContain("journal-error");
    expect(html).toContain('role="alert"');
    expect(html).not.toContain("journal-missing");
  });

  it("treats a Ghost 500 as an outage, not a missing post", async () => {
    await getRejects(new GhostError("Ghost API error: 500 Internal Server Error", 500));
    await expect(render()).resolves.toContain("journal-error");
  });

  it("sanitizes post HTML before injecting it", async () => {
    await getResolves({
      ...post,
      html: '<p>ok</p><script>alert(1)</script><a href="javascript:alert(1)">x</a>',
    });
    const html = await render();
    expect(html).toContain("ok");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("javascript:");
  });

  it("says so — rather than ending on a blank — when a post has no body", async () => {
    await getResolves({ ...post, html: "" });
    const html = await render();
    expect(html).toContain("journal-empty");
    expect(html).toContain('role="status"');
  });

  it("drops the lede when it only repeats the opening of the body", async () => {
    // Ghost auto-generates `excerpt` from the post body unless an author writes
    // one; printing it verbatim above the body repeats the first sentence at
    // two type sizes, which reads as a bug.
    await getResolves({
      ...post,
      excerpt: "We lift in dormancy, so the roots travel asleep.",
    });
    const html = await render();
    expect(html).not.toContain("journal-post__lede");

    await getResolves(post);
    expect(await render()).toContain("journal-post__lede");
  });

  it("survives a post with no author, tags or reading time", async () => {
    await getResolves({ ...post, authors: [], tags: [], reading_time: 0 });
    const html = await render();
    expect(html).toContain("Bare-root season opens in November");
    expect(html).not.toContain("journal-post__tags");
  });

  it("links back to the journal from every outcome", async () => {
    await getResolves(post);
    expect(await render()).toContain('href="/blog"');
    await getRejects(new TypeError("fetch failed"));
    expect(await render()).toContain('href="/blog"');
    expect(await renderNotFound()).toContain('href="/blog"');
  });

  it("gives the 404 its own state — distinguishable WITHOUT colour", async () => {
    const missing = await renderNotFound();
    await getRejects(new TypeError("fetch failed"));
    const error = await render();

    // Distinct state class (dotted vs solid border), distinct heading text,
    // distinct icon geometry — WCAG 1.4.1, and legible in grayscale.
    expect(missing).toContain("journal-missing");
    expect(error).toContain("journal-error");
    const heading = (html: string) =>
      html.match(/class="journal-state__title">([^<]+)</)?.[1] ?? "";
    expect(heading(missing)).not.toBe("");
    expect(heading(missing)).not.toBe(heading(error));
  });
});
