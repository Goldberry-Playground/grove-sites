import { StickyAddToCartBar } from "@grove/ui-kit";
import { SAMPLE_PRODUCT_APPLE } from "./_sample-images";

// The bar is `position: fixed` + mobile-only (hidden ≥640px) in production. The
// wrapper below un-fixes it and forces it visible so it renders as a card here.
const Frame = ({ children }: { children: React.ReactNode }) => (
  <div style={{ position: "relative", width: 360, border: "1px solid #ddd" }}>
    <style>{`.ds-sticky .grove-sticky-atc{position:static;transform:none;display:block}`}</style>
    <div className="ds-sticky">{children}</div>
  </div>
);

export const Default = () => (
  <Frame>
    <StickyAddToCartBar
      name="Honeycrisp Apple Tree (3 gal)"
      price={38}
      imageUrl={SAMPLE_PRODUCT_APPLE}
      cartQuantity={2}
      onAdd={() => {}}
    />
  </Frame>
);

export const SoldOut = () => (
  <Frame>
    <StickyAddToCartBar
      name="Honeycrisp Apple Tree (3 gal)"
      price={38}
      imageUrl={SAMPLE_PRODUCT_APPLE}
      disabled
      onAdd={() => {}}
    />
  </Frame>
);
