import type { Metadata } from "next";
import Link from "next/link";
import { CaptureForm } from "@grove/ui-kit";
import { CategoryBar } from "../category-bar";

// At The Grove Nursery — dedicated newsletter signup landing (GOL-336).
//
// This is the target route for the printed onsite QR code (v3): the QR points
// at `/notify?src=qr-onsite`, so a scan lands on a focused signup rather than
// having to hunt for the site-wide footer form. The runbook is GOL-250
// #build-spec §4–5; this page closes the gap that GOL-250 shipped only the
// inline footer form and never the dedicated landing route the QR retarget
// assumes.
//
// Copy is reused VERBATIM from the board-approved footer capture form in
// `layout.tsx` (heading, description, success message) so this introduces no
// new brand voice — same list of record (nursery Ghost), same `nursery-general`
// label. Attribution (`src=qr-onsite` and any `utm_*`) is captured client-side
// by CaptureForm's `collectAttribution()` at submit time; no route param
// plumbing is needed here.
//
// The page-level section-header (tag + h1) and lede carry the framing, so the
// CaptureForm here intentionally omits `eyebrow`/`heading` (they'd duplicate
// the header) and the lede avoids repeating the form's `description` sentence.

export const metadata: Metadata = {
  title: "News from the nursery — At The Grove Nursery",
  description:
    "Sign up for news from At the Grove Nursery: new tree stock, growing tips for Appalachian ground, and a note when something's ready to plant.",
};

export default function NotifyPage() {
  return (
    <>
      <CategoryBar />

      <section className="section">
        <div className="section-header">
          <div>
            <span className="section-tag">Newsletter</span>
            <h1>
              News <em>from the nursery</em>
            </h1>
          </div>
          <Link href="/shop" className="btn">
            Browse the catalog &rarr;
          </Link>
        </div>

        <p className="section-lede" style={{ maxWidth: "58ch" }}>
          Leave your address and we&apos;ll let you know when there&apos;s
          something worth planting.
        </p>

        <div
          className="mt-6 rounded-lg border border-primary/10 bg-secondary/10 p-6"
          style={{ maxWidth: "36rem" }}
        >
          <CaptureForm
            brand="nursery"
            source="newsletter-signup"
            label="nursery-general"
            description="New tree stock, growing tips for Appalachian ground, and a note when something's ready to plant. A few emails a season, not a flood."
            submitLabel="Sign up"
            successMessage="Thanks — you'll hear from us when there's something worth sending."
            consentText="We'll only email you what you signed up for. Unsubscribe anytime."
            hubOptIn
          />
        </div>
      </section>
    </>
  );
}
