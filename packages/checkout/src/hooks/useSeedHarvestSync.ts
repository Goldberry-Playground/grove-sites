"use client";

import { useEffect } from "react";
import { orderSeed, type CartItem, type OrderKind } from "../cart-reducer";
import type { CartDepositQuote } from "./useCartDepositQuote";

/**
 * The harvest year a settled BACKEND seed quote books this cart into when it
 * differs from the year stored on the cart lines, else null (GOL-3258, spec
 * §6). Only a confirmed seed quote counts: the route's display-only estimate
 * carries no year, and a quote still in flight is for inputs that may have
 * changed. Null for every non-seed cart.
 */
export function quotedSeedHarvestMove(
  kind: OrderKind,
  items: readonly CartItem[],
  quote: CartDepositQuote | null,
  settled: boolean,
): number | null {
  if (kind !== "seed" || !settled || quote === null) return null;
  if (quote.depositReason !== "seed" || quote.estimated === true) return null;
  const year = quote.seedHarvestYear;
  if (typeof year !== "number" || !Number.isInteger(year)) return null;
  const seed = orderSeed(items);
  return seed !== null && seed.year !== year ? year : null;
}

/**
 * Keep the cart's stored harvest year in step with the backend's quote. The
 * shopper adds chinquapin on Oct 30 for fall 2026 and checks out on Nov 2,
 * after order-by: the backend now books fall 2027 and takes the $1 for THAT
 * harvest. Without this, the cart and the order-type line keep saying 2026.
 * When the years differ, every seed line moves to the quoted year (marked
 * `movedFromYear`), so the page can show the change and hold checkout until
 * the shopper confirms (spec §6). Idempotent: once moved, the stored year
 * matches the quote and nothing fires again.
 */
export function useSeedHarvestSync(opts: {
  kind: OrderKind;
  items: readonly CartItem[];
  quote: CartDepositQuote | null;
  settled: boolean;
  onMove: (year: number) => void;
}): void {
  const year = quotedSeedHarvestMove(opts.kind, opts.items, opts.quote, opts.settled);
  const { onMove } = opts;
  useEffect(() => {
    if (year !== null) onMove(year);
  }, [year, onMove]);
}
