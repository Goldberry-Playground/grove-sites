import { NavLink } from "@grove/ui-kit";

// Authored preview cards (each export = one labeled card). Real JSX, real props.

export const Active = () => (
  <NavLink href="/shop" isActive>
    Shop
  </NavLink>
);

export const Idle = () => <NavLink href="/journal">Journal</NavLink>;

export const NavRow = () => (
  <nav style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
    <NavLink href="/" isActive>
      Home
    </NavLink>
    <NavLink href="/shop">Shop</NavLink>
    <NavLink href="/about">About</NavLink>
    <NavLink href="/journal">Journal</NavLink>
  </nav>
);
