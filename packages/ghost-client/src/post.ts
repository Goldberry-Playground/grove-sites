import type { Post } from "./types";

/** Collapse sanitized post HTML to comparable plain text. */
function toText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * The standfirst to show above a post body, or `null` when there isn't one.
 *
 * Ghost auto-generates `excerpt` from the opening of the post unless an author
 * writes a custom one. Printing it verbatim above the body then repeats the
 * first sentence twice at two different type sizes, which reads as a bug. So:
 * show the excerpt only when it is genuinely a different sentence from the
 * body's opening — i.e. when an author actually wrote one.
 *
 * Pure and exported so the three storefront detail routes share one rule
 * instead of three slightly different ones (GOL-2788).
 */
export function postLede(
  post: Pick<Post, "excerpt">,
  bodyHtml: string,
): string | null {
  const excerpt = post.excerpt?.trim();
  if (!excerpt) return null;

  // Ghost truncates auto-excerpts with an ellipsis; compare the stable head.
  const head = toText(excerpt).replace(/[.…]+$/, "").slice(0, 60);
  if (!head) return null;

  return toText(bodyHtml).startsWith(head) ? null : excerpt;
}
