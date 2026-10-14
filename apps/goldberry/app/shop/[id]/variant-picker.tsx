"use client";

import { useState } from "react";
import type { Product, ProductVariant } from "@grove/odoo-client";
import { AddToCartButton } from "@grove/checkout";
import { colorOptions, matchVariant, sizeOptions } from "../../../lib/variant-axes";

/**
 * Color then Size picker for the farm PDP (GOL-3315, gom printify spec
 * Storefront §3). Pure option logic lives in `lib/variant-axes`; this owns the
 * selection state and hands the EXACT chosen variant to the cart-connected
 * AddToCartButton. Until both required axes are chosen the button stays off,
 * so a shopper can never add a shirt they did not pick.
 *
 * Accessibility: each axis is a `role="group"` labelled by its heading, each
 * option a toggle button with `aria-pressed` (selection is announced, not just
 * painted), and the selection summary is a polite live region. Options are
 * text pills, never colour swatches alone, so the chosen colour reads the same
 * for every kind of colour vision and in grayscale.
 */

function formatPrice(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function AxisGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string | null;
  onChange: (next: string) => void;
}) {
  if (options.length === 0) return null;
  const id = `shop-axis-${label.toLowerCase()}`;
  return (
    <div className="shop-axis">
      {/* Only the axis word labels the group, so its accessible name stays
          "Color" / "Size"; the chosen value is read from the live summary. */}
      <p className="shop-axis__label">
        <span id={id}>{label}</span>
        {value ? <span className="shop-axis__value">{value}</span> : null}
      </p>
      <div role="group" aria-labelledby={id} className="shop-axis__options">
        {options.map((option) => {
          const active = value === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              className={active ? "shop-axis__option is-active" : "shop-axis__option"}
              onClick={() => onChange(option)}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** "Natural, 2XL" from the chosen axes, for the cart line and the summary. */
function optionLabel(variant: ProductVariant): string {
  return [variant.color, variant.size].filter((part) => part && part !== "").join(", ");
}

export function VariantPicker({ product, imageUrl }: { product: Product; imageUrl: string }) {
  const variants = product.variants ?? [];
  // One variant (or none) means there is nothing to pick: the pickers hide and
  // add to cart uses that variant (or the template itself).
  const single = variants.length <= 1;
  const colors = colorOptions(variants);
  const [color, setColor] = useState<string | null>(colors.length === 1 ? colors[0] : null);
  const [size, setSize] = useState<string | null>(null);
  const sizes = sizeOptions(variants, color);
  // A size the current color does not carry is not a selection.
  const effectiveSize = size !== null && sizes.includes(size) ? size : null;
  const chosen = single ? (variants[0] ?? null) : matchVariant(variants, { color, size: effectiveSize });
  const options = chosen ? optionLabel(chosen) : "";
  const lineName = chosen && options ? `${product.name} (${options})` : product.name;

  return (
    <div className="shop-variant-picker">
      {!single && (
        <>
          <AxisGroup
            label="Color"
            options={colors}
            value={color}
            onChange={(next) => {
              setColor(next);
              // Keep the size only if the new color carries it.
              setSize((current) => (current && sizeOptions(variants, next).includes(current) ? current : null));
            }}
          />
          <AxisGroup label="Size" options={sizes} value={effectiveSize} onChange={setSize} />
          <p className="shop-size-note">Unisex sizing. If you&apos;re between sizes, size up.</p>
          <p className="shop-variant-picker__summary" aria-live="polite">
            {chosen
              ? `Selected: ${options}, ${formatPrice(chosen.price)}`
              : colors.length > 0 && !color
                ? "Choose a color to see sizes."
                : "Choose a size."}
          </p>
        </>
      )}
      {product.leadTime && (
        <p className="shop-lead-time">Printed to order, ships in {product.leadTime}.</p>
      )}
      <AddToCartButton
        variantId={chosen ? chosen.id : product.id}
        templateId={product.id}
        name={lineName}
        price={chosen?.price ?? product.price}
        imageUrl={imageUrl}
        disabled={!product.available || (!single && !chosen) || (chosen !== null && !chosen.available)}
      />
    </div>
  );
}
