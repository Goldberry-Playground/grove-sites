"use client";

import { CheckoutPage } from "@grove/checkout";
import { ConsultCarveOutNotice } from "../consult-carveout-notice";
import { type ComplianceMap } from "../../lib/plant-compliance";

/**
 * Nursery checkout, with the consult-built carve-out disclosure wired in
 * (GOL-3028).
 *
 * Why a client wrapper: `shipStateNotice` is a render prop keyed on the state the
 * buyer picks inside the form, so it cannot cross the server boundary from
 * `page.tsx`. The server page still owns the fetch — it hands down the already
 * resolved `ComplianceMap` (plain data), so the notice reads the SAME live
 * `compliance.carve_outs` feed the checkout gate blocks with and the PDP notice
 * renders from, with no client round-trip and no second source of truth.
 */
export function NurseryCheckoutView({ compliance }: { compliance: ComplianceMap }) {
  return (
    <CheckoutPage
      brand="nursery"
      depositQuoteHref="/api/cart/quote"
      promoPreviewHref="/api/checkout/promo"
      tiersHref="/api/cart/tiers"
      // Disclose the destination constraint for a consult-built mix BEFORE the
      // deposit is charged (GOL-3019 §4). Keyed on the line flag stamped at add
      // time, never on an empty botanical: an undeclared ordinary product is a
      // different situation and checkout still refuses it outright.
      shipStateNotice={(state, items) =>
        items.some((item) => item.consultBuilt === true) ? (
          <ConsultCarveOutNotice
            state={state}
            compliance={compliance}
            surface="checkout"
          />
        ) : null
      }
    />
  );
}
