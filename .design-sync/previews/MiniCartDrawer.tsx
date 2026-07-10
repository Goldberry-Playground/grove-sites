import { MiniCartDrawer, type GroveCartLineItem } from "@grove/ui-kit";
import { SAMPLE_PRODUCT_APPLE, SAMPLE_PRODUCT_GRAPE } from "./_sample-images";

const items: GroveCartLineItem[] = [
  { variantId: 2, templateId: 2, name: "Honeycrisp Apple Tree (3 gal)", price: 38, imageUrl: SAMPLE_PRODUCT_APPLE, quantity: 2 },
  { variantId: 5, templateId: 5, name: "Concord Grape Vine (1 gal)", price: 18.5, imageUrl: SAMPLE_PRODUCT_GRAPE, quantity: 1 },
];
const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
const totalQuantity = items.reduce((s, i) => s + i.quantity, 0);

// The drawer is a full-viewport overlay in production. Scope it to a relative
// frame so the card shows the panel rather than covering the whole preview.
const Frame = ({ children }: { children: React.ReactNode }) => (
  <div style={{ position: "relative", width: 420, height: 520, overflow: "hidden", border: "1px solid #ddd" }}>
    <style>{`.ds-drawer .grove-minicart{position:absolute}`}</style>
    <div className="ds-drawer" style={{ position: "absolute", inset: 0 }}>{children}</div>
  </div>
);

export const JustAdded = () => (
  <Frame>
    <MiniCartDrawer
      open
      items={items}
      subtotal={subtotal}
      totalQuantity={totalQuantity}
      lastAddedVariantId={2}
      onClose={() => {}}
    />
  </Frame>
);

export const Empty = () => (
  <Frame>
    <MiniCartDrawer open items={[]} subtotal={0} totalQuantity={0} onClose={() => {}} />
  </Frame>
);
