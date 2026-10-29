import type { Tag } from "@grove/ghost-client";

/**
 * The tags a reader should see. Ghost's Content API returns internal tags with
 * `include=tags`, and the legacy-site import left `#Import …` tags on most
 * posts, so cards printed them verbatim. Ghost marks a tag internal by the `#`
 * name prefix, so that rule stands even when `visibility` is absent.
 */
export function publicTags(tags: Tag[] | undefined): Tag[] {
  return (tags ?? []).filter((t) => t.visibility !== "internal" && !t.name.startsWith("#"));
}
