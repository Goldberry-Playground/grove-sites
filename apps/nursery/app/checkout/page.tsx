import { resolveCompliance } from "../../lib/plant-compliance";
import { odoo } from "../../lib/clients";
import { NurseryCheckoutView } from "./checkout-view";

// Nursery storefront — brand-appropriate checkout trust copy (the arrive-alive
// promise is true for live plants). Wrapped in a no-prop Page so the default
// export satisfies Next's PageProps constraint (GOL-1090).
// `depositQuoteHref` lets the form's summary show the flat $10 reservation
// deposit when the cart takes one (GOL-2233), before the Stripe session exists.
// `promoPreviewHref` + `tiersHref` power the promo Apply button, the volume
// discount row and the "add 2 more trees" nudge (GOL-2432) — all wired in
// `NurseryCheckoutView`, the client half.
//
// The rate feed is fetched here (same cached endpoint the PDP hits, so Next
// dedupes it) purely for `compliance.carve_outs`: a consult-built mix in the cart
// must disclose which species its destination takes off the list before the
// deposit is charged (GOL-3028). Best-effort and drift-safe like every other
// feed read — a null feed falls back to the baked snapshot inside
// `resolveCompliance`, so the notice never silently disappears.
export default async function Page() {
  const shippingFeed = await odoo.shipping.rateFeed();
  return <NurseryCheckoutView compliance={resolveCompliance(shippingFeed)} />;
}
