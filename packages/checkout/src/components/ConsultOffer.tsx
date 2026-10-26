"use client";

import { useId } from "react";
import { CONSULT_LABEL, CONSULT_NOTE } from "../consult";
import type { ConsultOfferState } from "../hooks/useConsultOffer";

/**
 * The free planting-consult checkbox under the totals (GOL-3384, spec D.2),
 * plus the one-line reason when a ticked consult was dropped. The whole label
 * is the hit area (44px floor); the native checkbox draws its own state, so
 * nothing is said by colour alone. Renders nothing when there is neither an
 * offer nor a reason to show. Styled in CheckoutShared.css.
 */
export function ConsultOffer({ offer }: { offer: ConsultOfferState }) {
  const id = useId();
  const titleId = `${id}-title`;
  const noteId = `${id}-note`;
  if (!offer.offered && offer.removedMessage === null) return null;
  return (
    <div className="grove-consult-offer" data-testid="consult-offer">
      {offer.offered ? (
        <label htmlFor={id} className="grove-consult-offer__label">
          <input
            id={id}
            type="checkbox"
            className="grove-consult-offer__input"
            checked={offer.checked}
            onChange={(e) => offer.setChecked(e.target.checked)}
            // The whole card is the label (hit area), but the control's NAME is
            // the one line, with the note as its description, so a screen
            // reader hears "Add a free 15-minute planting consult, checkbox".
            aria-labelledby={titleId}
            aria-describedby={noteId}
          />
          <span>
            <span id={titleId} className="grove-consult-offer__title">
              {CONSULT_LABEL}
            </span>
            <span id={noteId} className="grove-consult-offer__note">
              {CONSULT_NOTE}
            </span>
          </span>
        </label>
      ) : null}
      {offer.removedMessage ? (
        <p role="status" className="grove-consult-offer__removed" data-testid="consult-removed">
          {/* Drawn, not typed: an "i" in a ring, same reason as the tier nudge
              (an icon glyph would tofu on a client with no symbol font). */}
          <svg
            aria-hidden="true"
            focusable="false"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="grove-consult-offer__icon"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5" />
            <path d="M12 8h.01" />
          </svg>
          <span>{offer.removedMessage}</span>
        </p>
      ) : null}
    </div>
  );
}
