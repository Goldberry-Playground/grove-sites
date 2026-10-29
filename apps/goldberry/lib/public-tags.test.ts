import { describe, expect, it } from "vitest";
import type { Tag } from "@grove/ghost-client";
import { publicTags } from "./public-tags";

const tag = (name: string, visibility?: Tag["visibility"]): Tag => ({
  id: name,
  name,
  slug: name.toLowerCase(),
  description: null,
  ...(visibility ? { visibility } : {}),
});

// The legacy Ghost import tagged 27 posts `#Import 2026-04-14 09:05`, and the
// importer adds another such tag on every run. Ghost's Content API returns
// internal tags with `include=tags`, so cards printed them verbatim.
describe("publicTags", () => {
  it("drops internal tags and keeps public ones", () => {
    const out = publicTags([tag("#Import 2026-04-14 09:05", "internal"), tag("Guide", "public")]);
    expect(out.map((t) => t.name)).toEqual(["Guide"]);
  });

  it("drops a #-prefixed tag even when visibility is missing", () => {
    expect(publicTags([tag("#x")])).toEqual([]);
  });

  it("treats undefined as no tags", () => {
    expect(publicTags(undefined)).toEqual([]);
  });
});
