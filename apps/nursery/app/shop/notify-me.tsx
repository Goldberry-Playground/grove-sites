"use client";

import { CaptureForm, CaptureSlot } from "@grove/ui-kit";
import { waitlistInterest } from "../../lib/departments";

export interface NotifyMeProps {
  /** Department slug — becomes the `waitlist:<slug>` interest tag in Odoo. */
  deptSlug: string;
  /** Department name, for the heading ("Tell me when Mycoforestry opens"). */
  deptName: string;
  /** Optional override for the supporting line above the field. */
  description?: string;
}

/**
 * Per-department waitlist capture (GOL-2745, spec § Notify-me).
 *
 * Thin composition over the shared `CaptureForm`, NOT a second form: the
 * capture already owns the honeypot, the attribution capture, the consent
 * proof, the submitting/success/error states and — as of GOL-2745 — inline
 * email validation. What this adds is the department's identity.
 *
 * It posts to the existing `/api/newsletter/subscribe` BFF with
 * `interests: ["waitlist:<dept>"]` and `source: "notify-me"`, which
 * `@grove/newsletter` turns into an Odoo contact tag (e.g.
 * "Waitlist: Mycoforestry") the launch email can filter on.
 *
 * Data minimization: email only. A waitlist needs an address to mail and
 * nothing else, so there is no name field and no pre-checked hub opt-in — the
 * cross-brand opt-in stays an explicit, separate decision elsewhere.
 *
 * Registered at the `restock` tier of the capture arbiter (GOL-2178), which
 * suppresses the shared footer newsletter for the whole page. Without that, a
 * teaser page — whose entire job is ONE ask — shipped two competing email
 * forms, and the newsletter is the weaker one here: a visitor who cares about
 * ginseng wants to hear about ginseng, not the season's mailing.
 */
export function NotifyMe({ deptSlug, deptName, description }: NotifyMeProps) {
  return (
    <CaptureSlot priority="restock">
    <CaptureForm
      brand="nursery"
      source="notify-me"
      // Per-form segmentation handle, so the CMO can slice one family's
      // waitlist out of the wider nursery list.
      label={`nursery-waitlist-${deptSlug}`}
      interests={[waitlistInterest(deptSlug)]}
      eyebrow="Waitlist"
      heading={`Tell me when ${deptName} opens`}
      description={
        description ??
        "One email when these are ready to order. No drip, no catalog blast."
      }
      submitLabel="Notify me"
      successMessage="You're on the list. We'll email once when these are ready to order."
      consentText="We'll only email you about this family. Unsubscribe anytime."
      invalidEmailMessage="Enter an email address like you@example.com"
      layout="stacked"
    />
    </CaptureSlot>
  );
}
