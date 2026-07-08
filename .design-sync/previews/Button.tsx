import { Button } from "@grove/ui-kit";

// Authored preview cards (each export = one labeled card). Real JSX, real props.
export const Primary = () => <Button variant="primary">Shop the harvest</Button>;
export const Secondary = () => <Button variant="secondary">Learn more</Button>;
export const Ghost = () => <Button variant="ghost">Read the journal</Button>;

export const Sizes = () => (
  <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
    <Button size="sm">Small</Button>
    <Button size="md">Medium</Button>
    <Button size="lg">Large</Button>
  </div>
);

export const Disabled = () => <Button disabled>Sold out</Button>;
