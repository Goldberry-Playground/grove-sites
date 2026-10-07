// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * GOL-2756 companion guard for the nursery tenant.
 *
 * Nursery already had honest empty/error states (GOL-1113), so the only change
 * here was the `?? []` guard: a 200 from Ghost whose body has no `posts` key
 * resolved to `undefined` and threw on `.length`, serving a 500 where the empty
 * state was the correct outcome.
 */

vi.mock("../../lib/ghost", () => ({ ghost: { posts: { list: vi.fn() } } }));

async function render() {
  const { default: BlogPage } = await import("./page");
  return renderToStaticMarkup((await BlogPage()) as never);
}
async function listResolves(value: unknown) {
  const { ghost } = await import("../../lib/ghost");
  (ghost.posts.list as ReturnType<typeof vi.fn>).mockResolvedValue(value);
}

beforeEach(() => vi.clearAllMocks());

describe("nursery /blog — unexpected Ghost body degrades, never 500s (GOL-2756)", () => {
  it("degrades to the empty state when Ghost 200s with a body that has no `posts` key", async () => {
    await listResolves(undefined);
    const html = await render();
    expect(html).toContain("journal-empty");
    expect(html).not.toContain("journal-error");
  });

  it("still renders the empty state for a genuinely empty journal", async () => {
    await listResolves([]);
    await expect(render()).resolves.toContain("journal-empty");
  });

  it("renders real posts when Ghost has them", async () => {
    await listResolves([{
      id: "1", uuid: "u1", title: "Potting up the fall liners", slug: "p1",
      html: "", excerpt: "What moves to a #3.", featureImage: null,
      published_at: "2026-09-22T12:00:00.000Z", updated_at: "2026-09-22T12:00:00.000Z",
      authors: [], tags: [], reading_time: 3,
    }]);
    const html = await render();
    expect(html).toContain("Potting up the fall liners");
    expect(html).not.toContain("journal-state");
  });
});
