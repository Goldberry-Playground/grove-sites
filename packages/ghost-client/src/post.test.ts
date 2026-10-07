import { describe, it, expect } from "vitest";
import { postLede } from "./post";
import { GhostError, isGhostNotFound } from "./errors";

describe("postLede (GOL-2788)", () => {
  const body = "<p>We lift in dormancy, so the roots travel asleep.</p><p>More.</p>";

  it("keeps a standfirst an editor actually wrote", () => {
    expect(postLede({ excerpt: "Why November is the month." }, body)).toBe(
      "Why November is the month.",
    );
  });

  it("drops Ghost's auto-excerpt, which just repeats the body opening", () => {
    expect(
      postLede({ excerpt: "We lift in dormancy, so the roots travel asleep." }, body),
    ).toBeNull();
  });

  it("drops it through the ellipsis Ghost truncates long auto-excerpts with", () => {
    expect(
      postLede({ excerpt: "We lift in dormancy, so the roots travel asleep…" }, body),
    ).toBeNull();
  });

  it("looks past entity and smart-quote differences", () => {
    expect(
      postLede(
        { excerpt: "We lift in dormancy, so the roots travel asleep." },
        "<p>We lift  in&nbsp;dormancy, so the roots travel asleep.</p>",
      ),
    ).toBeNull();
  });

  it("returns null for a missing or blank excerpt", () => {
    expect(postLede({ excerpt: null }, body)).toBeNull();
    expect(postLede({ excerpt: "   " }, body)).toBeNull();
  });
});

describe("isGhostNotFound (GOL-2788)", () => {
  it("is true only for a 404 from Ghost", () => {
    expect(isGhostNotFound(new GhostError('Post with slug "x" not found', 404))).toBe(true);
    expect(isGhostNotFound(new GhostError("Ghost API error: 500 ...", 500))).toBe(false);
    expect(isGhostNotFound(new TypeError("fetch failed"))).toBe(false);
    expect(isGhostNotFound(null)).toBe(false);
  });

  it("matches across duplicated module instances", () => {
    // Duck-typed on name+status on purpose: this package is source-mapped into
    // four Next apps, and an `instanceof` check would silently downgrade every
    // 404 into an error state if the module were ever loaded twice.
    expect(isGhostNotFound({ name: "GhostError", status: 404 })).toBe(true);
  });
});
