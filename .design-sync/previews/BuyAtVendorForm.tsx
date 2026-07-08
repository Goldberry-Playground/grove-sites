import { BuyAtVendorForm } from "@grove/ui-kit";

// Authored preview cards (each export = one labeled card). Real JSX, real props.

export const Default = () => (
  <BuyAtVendorForm
    productId={4821}
    vendorName="Goldberry Grove Farm"
    action="https://goldberrygrove.farm/shop/cart/update"
  />
);

export const WithAccent = () => (
  <BuyAtVendorForm
    productId={1190}
    vendorName="George George George Woodworking"
    action="https://woodworkingeorge.com/shop/cart/update"
    accentColor="#3A2418"
  />
);

export const CustomReferrer = () => (
  <BuyAtVendorForm
    productId={622}
    vendorName="At The Grove Nursery"
    action="https://atthegrovenursery.com/shop/cart/update"
    accentColor="#1F3F2B"
    referrer="grove-journal"
  />
);
