import { ShopSubHeader } from "./shop-sub-header";

// Shop-section layout: wraps both the list (/shop) and the detail
// (/shop/[id]) routes so the editorial sub-header — section title and
// category nav — appears on every shop page beneath the main brand-header
// defined in app/layout.tsx.
export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ShopSubHeader />
      {children}
    </>
  );
}
