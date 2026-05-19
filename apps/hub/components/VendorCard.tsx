import Link from "next/link";
import type { Vendor } from "../data/marketplace";

type Props = {
  vendor: Vendor;
};

export function VendorCard({ vendor }: Props) {
  return (
    <Link
      href={`/marketplace/vendor/${vendor.slug}`}
      className="vendor-card"
      style={{ borderTopColor: vendor.brandColor }}
    >
      <h3 className="vendor-card__name" style={{ color: vendor.brandColor }}>
        {vendor.name}
      </h3>
      <p className="vendor-card__tagline">{vendor.tagline}</p>
      <span className="vendor-card__cta">Visit the shop →</span>
    </Link>
  );
}
