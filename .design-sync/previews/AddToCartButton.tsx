import { AddToCartButton } from "@grove/ui-kit";

// Authored preview cards (each export = one labeled card). Real JSX, real props.
// Cart state is decoupled: the only cart interaction is the onAddToCart callback.

export const Default = () => <AddToCartButton onAddToCart={() => {}} />;

export const SoldOut = () => <AddToCartButton disabled onAddToCart={() => {}} />;

export const StartsAtThree = () => (
  <AddToCartButton initialQuantity={3} onAddToCart={() => {}} />
);
