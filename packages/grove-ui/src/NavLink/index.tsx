import type { ReactNode } from "react";
import { useGroveLink } from "../link-context";

export type NavLinkProps = {
  /** Destination href. */
  href: string;
  /** Whether this link points at the current route (the app computes this). */
  isActive?: boolean;
  children: ReactNode;
};

/**
 * Primary-nav link with an active state. Lifted from apps/ggg + apps/nursery
 * (identical copies). Active-ness used to come from `usePathname`; it's now an
 * `isActive` prop the app passes in, keeping this component free of `next/*`.
 * The Link itself is injected via the Grove Link seam. Styled against
 * `--grove-*` roles (see NavLink.css).
 */
export function NavLink({ href, isActive = false, children }: NavLinkProps) {
  const Link = useGroveLink();
  return (
    <Link
      href={href}
      className={`grove-nav-link ${isActive ? "is-active" : ""}`}
      aria-current={isActive ? "page" : undefined}
    >
      {children}
    </Link>
  );
}
