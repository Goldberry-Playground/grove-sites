"use client";

import { useEffect, useState } from "react";
import { CONSULT_REMOVED_MESSAGE, consultOfferedBy } from "../consult";
import type { CartDepositQuote } from "./useCartDepositQuote";

/** What the consult checkbox renders from (GOL-3384). */
export interface ConsultOfferState {
  /** The current quote offers the consult: show the checkbox. */
  offered: boolean;
  /** The variant the checkbox adds; null when not offered. */
  variantId: number | null;
  /** The shopper's yes/no, persisted beside the cart. */
  checked: boolean;
  setChecked: (checked: boolean) => void;
  /** Why a ticked consult went away (quote flipped to ineligible), or null. */
  removedMessage: string | null;
}

/**
 * Keep the shopper's consult choice honest against the quote. The checkbox
 * shows while the quote offers the consult. When a quote for the CURRENT cart
 * lands without the offer and the box was ticked, the choice is dropped and the
 * page says why (spec D.2: "the storefront removes the line and says why"). A
 * quote in flight or a failed quote changes nothing: the last answer stands
 * until a definite one replaces it, so a flaky network can't silently strip
 * the consult. An emptied cart drops the choice silently (nothing to explain
 * on an empty cart).
 */
export function useConsultOffer(
  quote: CartDepositQuote | null,
  settled: boolean,
  requested: boolean,
  setRequested: (requested: boolean) => void,
): ConsultOfferState {
  const variantId = consultOfferedBy(quote);
  const offered = variantId !== null;
  const [removedMessage, setRemovedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!requested || !settled || offered) return;
    setRequested(false);
    // A settled null quote is an empty cart (or a brand with no quote route):
    // nothing was offered, so nothing is "removed".
    if (quote !== null) setRemovedMessage(CONSULT_REMOVED_MESSAGE);
  }, [requested, settled, offered, quote, setRequested]);

  // The offer came back (a tree was re-added): the notice has done its job.
  useEffect(() => {
    if (offered) setRemovedMessage(null);
  }, [offered]);

  return {
    offered,
    variantId,
    checked: offered && requested,
    setChecked: (checked) => {
      setRequested(checked);
      setRemovedMessage(null);
    },
    removedMessage,
  };
}
