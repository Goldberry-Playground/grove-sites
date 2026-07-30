import Link from "next/link";

// GOL-967: single reusable link to the board-approved Shipping & Warranty
// policy page (/shipping-warranty). Rendered in the buy-box footer today so a
// working policy link appears on every product; kept as its own component so
// the same link can be dropped into the sticky add-to-cart bar and the cart
// summary later without re-deriving the copy or the href.
export function PolicyLink({ className }: { className?: string }) {
  return (
    <Link
      href="/shipping-warranty"
      className={
        className ??
        "font-semibold text-accent underline underline-offset-2 hover:no-underline"
      }
    >
      Shipping &amp; warranty
    </Link>
  );
}
