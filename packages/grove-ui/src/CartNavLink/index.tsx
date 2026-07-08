import { useGroveLink } from "../link-context";

export type CartNavLinkProps = {
  /** Item count for the badge. Omit/0 hides the badge. The app reads the cart. */
  count?: number;
  /** Cart route. Defaults to "/cart". */
  href?: string;
};

/**
 * Cart link with an item-count badge. Lifted from apps/goldberry, where the
 * count came from a `useCart()` store; it's now a `count` prop the app passes,
 * so this component reads no store and imports no `next/*`. The Link is injected
 * via the Grove Link seam. Styled against `--grove-*` roles (see CartNavLink.css).
 */
export function CartNavLink({ count = 0, href = "/cart" }: CartNavLinkProps) {
  const Link = useGroveLink();
  return (
    <Link href={href} className="grove-cart-nav-link">
      Cart
      {count > 0 && (
        <span className="grove-cart-nav-link__badge">
          {count}
          <span className="sr-only"> items in cart</span>
        </span>
      )}
    </Link>
  );
}
