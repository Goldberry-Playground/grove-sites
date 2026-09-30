// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * GOL-2756 companion guard for the woodworking tenant.
 *
 * ggg never had a mock-post fallback, but it shared the other half of the bug:
 * a 200 from Ghost whose body has no `posts` key resolved to `undefined` and
 * threw on `.length` (a 500 where the empty state was correct). Its "no posts"
 * and "load failed" outcomes were also a bare <p> and a raw Tailwind red box —
 * the latter encoding "something broke" in colour alone.
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
async function listRejects(err: unknown) {
  const { ghost } = await import("../../lib/ghost");
  (ghost.posts.list as ReturnType<typeof vi.fn>).mockRejectedValue(err);
}

const post = {
  id: "1", uuid: "u1", title: "Dovetails by hand, and when not to", slug: "p1",
  html: "", excerpt: "A joint worth the time.", featureImage: null,
  published_at: "2026-09-22T12:00:00.000Z", updated_at: "2026-09-22T12:00:00.000Z",
  authors: [{ id: "a1", name: "George", slug: "g", bio: null, profileImage: null, url: "#" }],
  tags: [], reading_time: 5,
};

beforeEach(() => vi.clearAllMocks());

describe("ggg /blog — honest empty + error states (GOL-2756)", () => {
  it("renders real posts when Ghost has them", async () => {
    await listResolves([post]);
    const html = await render();
    expect(html).toContain("Dovetails by hand, and when not to");
    expect(html).not.toContain("journal-state");
  });

  it("renders the empty state when Ghost returns no posts", async () => {
    await listResolves([]);
    const html = await render();
    expect(html).toContain("journal-empty");
    expect(html).not.toContain("journal-error");
  });

  it("renders the error state when Ghost throws", async () => {
    await listRejects(new Error("ECONNREFUSED"));
    const html = await render();
    expect(html).toContain("journal-error");
    expect(html).not.toContain("journal-empty");
  });

  it("degrades to the empty state when Ghost 200s with a body that has no `posts` key", async () => {
    await listResolves(undefined);
    await expect(render()).resolves.toContain("journal-empty");
  });

  it("never leaks a raw Ghost error message to the visitor", async () => {
    await listRejects(new Error("connect ECONNREFUSED 10.0.0.4:2369"));
    const html = await render();
    expect(html).not.toContain("ECONNREFUSED");
    expect(html).not.toContain("10.0.0.4");
  });

  it("distinguishes empty from error WITHOUT relying on colour (WCAG 1.4.1)", async () => {
    await listResolves([]);
    const empty = await render();
    await listRejects(new Error("x"));
    const error = await render();
    const heading = (html: string) =>
      html.match(/class="journal-state__title">([^<]+)</)?.[1] ?? "";
    expect(heading(empty)).not.toBe("");
    expect(heading(empty)).not.toBe(heading(error));
    expect(empty).toContain('role="status"');
    expect(error).toContain('role="alert"');
  });
});
