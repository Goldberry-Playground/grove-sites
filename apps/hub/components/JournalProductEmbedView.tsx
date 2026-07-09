"use client";

import {
  JournalProductEmbed as UiJournalProductEmbed,
  type ProductCardData,
} from "@grove/ui-kit";
import { GroveNextProviders } from "./grove-adapters";

type Props = {
  product: ProductCardData;
  position: "inline" | "sidebar" | "footer";
  accentColor?: string;
};

/**
 * Client boundary for the ui-kit JournalProductEmbed (GOL-139). The parent
 * server component resolves the product (async Odoo fetch) and hands the
 * presentational data down; this wrapper supplies the Next Link/Image context
 * the embedded ProductCard reads from.
 */
export function JournalProductEmbedView({ product, position, accentColor }: Props) {
  return (
    <GroveNextProviders>
      <UiJournalProductEmbed
        product={product}
        position={position}
        accentColor={accentColor}
      />
    </GroveNextProviders>
  );
}
