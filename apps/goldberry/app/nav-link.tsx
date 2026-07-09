"use client";

import { usePathname } from "next/navigation";
import { NavLink as UiNavLink } from "@grove/ui-kit";

export function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive =
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <UiNavLink href={href} isActive={isActive}>
      {children}
    </UiNavLink>
  );
}
