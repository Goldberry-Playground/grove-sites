// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GhostError } from "@grove/ghost-client";

/**
 * GOL-2803 — the hub journal index swallowed every Ghost failure into
 * `posts = []` and printed "No posts yet. Check back soon."
 *
 * The behaviour these pin is the split that copy erased: an empty journal and
 * an unreachable one are different facts. Telling a reader to "check back soon"
 * when the truth is "we cannot look right now" is a lie, and the class of bug
 * the storefronts shed in GOL-2756 / GOL-2788.
 */

const list = vi.fn();
vi.mock("../../../lib/ghost", () => ({ ghost: () => ({ posts: { list } }) }));

async function render() {
  const { default: JournalIndexPage } = await import("./page");
  return renderToStaticMarkup((await JournalIndexPage()) as never);
}

const post = {
  id: "1",
  uuid: "u1",
  title: "Why the hub never takes a cut",
  slug: "no-cut",
  html: "",
  excerpt: "Every checkout goes to the maker.",
  featureImage: null,
  published_at: "2026-09-22T12:00:00.000Z",
  updated_at: "2026-09-22T12:00:00.000Z",
  authors: [],
  tags: [],
  reading_time: 4,
};

beforeEach(() => vi.clearAllMocks());

describe("hub /journal (GOL-2803)", () => {
  it("renders the posts Ghost returns, and no state block", async () => {
    list.mockResolvedValue([post]);
    const html = await render();
    expect(html).toContain("Why the hub never takes a cut");
    expect(html).toContain('href="/journal/no-cut"');
    expect(html).not.toContain("journal-state");
  });

  it("shows the EMPTY state when the journal genuinely has nothing published", async () => {
    list.mockResolvedValue([]);
    const html = await render();
    expect(html).toContain("journal-empty");
    expect(html).not.toContain("journal-error");
    expect(html).toContain('role="status"');
  });

  it("degrades to the empty state when Ghost 200s with a body that has no posts", async () => {
    list.mockResolvedValue(undefined);
    const html = await render();
    expect(html).toContain("journal-empty");
    expect(html).not.toContain("journal-error");
  });

  it("shows the ERROR state — never the empty one — when Ghost is unreachable", async () => {
    list.mockRejectedValue(new TypeError("fetch failed"));
    const html = await render();
    expect(html).toContain("journal-error");
    expect(html).toContain('role="alert"');
    expect(html).not.toContain("journal-empty");
    // The specific lie this ticket exists to remove.
    expect(html).not.toContain("No posts yet");
    expect(html).not.toContain("Check back soon");
  });

  it("treats a Ghost 5xx as an outage too", async () => {
    list.mockRejectedValue(new GhostError("Ghost API error: 503", 503));
    const html = await render();
    expect(html).toContain("journal-error");
    expect(html).not.toContain("journal-empty");
  });

  it("gives empty and error DIFFERENT headings, so neither rides on colour", async () => {
    const heading = (html: string) =>
      html.match(/class="journal-state__title">([^<]+)</)?.[1] ?? "";

    list.mockResolvedValue([]);
    const empty = heading(await render());
    list.mockRejectedValue(new TypeError("fetch failed"));
    const error = heading(await render());

    expect(empty).not.toBe("");
    expect(error).not.toBe("");
    expect(empty).not.toBe(error);
  });

  it("offers a way out of both dead-end states", async () => {
    list.mockResolvedValue([]);
    expect(await render()).toContain('href="/marketplace"');
    list.mockRejectedValue(new TypeError("fetch failed"));
    expect(await render()).toContain('href="/marketplace"');
  });
});
