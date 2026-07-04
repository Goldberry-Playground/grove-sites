"use client";

import { trackPurchase } from "@grove/analytics";
import { useEffect, useRef } from "react";

/**
 * Fires the `purchase` funnel event once, client-side, from the server-rendered
 * order confirmation page. It lives in a client child because the event hashes
 * the order id (Web Crypto) and POSTs from the browser — neither of which can
 * run in the Server Component. Renders nothing.
 */
export function PurchaseTracker({
  orderName,
  itemCount,
  total,
}: {
  orderName: string;
  itemCount: number;
  total: number;
}): null {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    void trackPurchase({ orderName, itemCount, total });
  }, [orderName, itemCount, total]);

  return null;
}
