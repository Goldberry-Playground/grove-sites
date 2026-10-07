// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GhostError } from "@grove/ghost-client";

/**
 * GOL-2803 — the hub post route caught EVERY failure and answered `notFound()`:
 * a missing slug, a Ghost 500, a DNS failure, a timeout, a bad content key.
 *
 * So an outage told the reader — and, at `revalidate = 300`, every crawler —
 * that a live essay was permanently gone. A 404 is a promise about the
 * RESOURCE, not about our infrastructure. These pin the three-way split:
 * post / 404 / rethrow-to-error-boundary.
 */

const get = vi.fn();
vi.mock("../../../../lib/ghost", () => ({ ghost: () => ({ posts: { get } }) }));

const NOT_FOUND = "__next_not_found__";
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error(NOT_FOUND);
  },
}));

async function render(slug = "no-cut") {
  const { default: Page } = await import("./page");
  return renderToStaticMarkup(
    (await Page({ params: Promise.resolve({ slug }) })) as never,
  );
}

async function renderNotFound() {
  const { default: NotFound } = await import("./not-found");
  return renderToStaticMarkup(NotFound() as never);
}

const post = {
  id: "1",
  uuid: "u1",
  title: "Why the hub never takes a cut",
  slug: "no-cut",
  html: "<p>Every checkout goes to the maker who grew it.</p>",
  excerpt: "Every checkout goes to the maker.",
  featureImage: null,
  published_at: "2026-09-22T12:00:00.000Z",
  updated_at: "2026-09-22T12:00:00.000Z",
  authors: [],
  tags: [],
  reading_time: 4,
};

beforeEach(() => vi.clearAllMocks());

describe("hub /journal/[slug] (GOL-2803)", () => {
  it("renders the essay when Ghost has it", async () => {
    get.mockResolvedValue(post);
    const html = await render();
    expect(html).toContain("Why the hub never takes a cut");
    expect(html).toContain("goes to the maker who grew it");
    expect(html).not.toContain("journal-state");
  });

  it("404s when Ghost says there is no such post", async () => {
    get.mockRejectedValue(new GhostError('Post with slug "nope" not found', 404));
    await expect(render("nope")).rejects.toThrow(NOT_FOUND);
  });

  it("404s when Ghost 200s with a body that has no post", async () => {
    get.mockResolvedValue(undefined);
    await expect(render()).rejects.toThrow(NOT_FOUND);
  });

  it("RETHROWS an outage instead of answering 404", async () => {
    // The whole point of the ticket: a reachability failure must reach
    // error.tsx (HTTP 500), not be dressed up as "this essay is gone".
    const outage = new TypeError("fetch failed");
    get.mockRejectedValue(outage);
    await expect(render()).rejects.toThrow(outage);
    await expect(render()).rejects.not.toThrow(NOT_FOUND);
  });

  it("treats a Ghost 500 as an outage, not a missing post", async () => {
    const outage = new GhostError("Ghost API error: 500 Internal Server Error", 500);
    get.mockRejectedValue(outage);
    await expect(render()).rejects.toThrow(outage);
  });

  it("recognises the 404 by duck-type, not instanceof", async () => {
    // @grove/ghost-client is src-mapped into four Next apps; a duplicated
    // module instance would break `instanceof` and silently downgrade every
    // 404 into a 500. A plain object with the right shape must still 404.
    get.mockRejectedValue(
      Object.assign(new Error("not found"), { name: "GhostError", status: 404 }),
    );
    await expect(render()).rejects.toThrow(NOT_FOUND);
  });

  it("sanitizes post HTML before injecting it", async () => {
    get.mockResolvedValue({
      ...post,
      html: '<p>ok</p><script>alert(1)</script><a href="javascript:alert(1)">x</a>',
    });
    const html = await render();
    expect(html).toContain("ok");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("javascript:");
  });

  it("gives the 404 its own state, with a route back to the journal", async () => {
    const html = await renderNotFound();
    expect(html).toContain("journal-missing");
    expect(html).toContain('href="/journal"');
    expect(html).toContain('role="status"');
  });

  it("keeps missing and error distinguishable WITHOUT colour", async () => {
    const { default: JournalError } = await import("../error");
    const error = renderToStaticMarkup(
      createElement(JournalError, { error: new Error("boom"), reset: () => {} }),
    );
    const missing = await renderNotFound();

    // Distinct state class (dotted vs solid border), distinct heading text,
    // distinct icon geometry — WCAG 1.4.1, legible in grayscale.
    expect(missing).toContain("journal-missing");
    expect(error).toContain("journal-error");
    const heading = (html: string) =>
      html.match(/class="journal-state__title">([^<]+)</)?.[1] ?? "";
    expect(heading(missing)).not.toBe("");
    expect(heading(missing)).not.toBe(heading(error));
  });

  it("the error boundary offers a real retry and a way back", async () => {
    const { default: JournalError } = await import("../error");
    const html = renderToStaticMarkup(
      createElement(JournalError, { error: new Error("boom"), reset: () => {} }),
    );
    expect(html).toContain("Try again");
    expect(html).toContain('href="/journal"');
    expect(html).toContain('role="alert"');
  });
});
