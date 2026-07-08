import { CartNavLink } from "@grove/ui-kit";

// Authored preview cards (each export = one labeled card). Real JSX, real props.

export const Empty = () => <CartNavLink count={0} />;

export const WithItems = () => <CartNavLink count={3} />;

export const HighCount = () => <CartNavLink count={42} />;
