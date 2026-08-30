import Link from "next/link";
import type { Metadata } from "next";
import { assetPath } from "@grove/ui";
import { CaptureForm } from "@grove/ui-kit";
import { OpeningNotice } from "../_components/OpeningNotice";

export const metadata: Metadata = {
  title: "Book a Private Event — Goldberry Grove — Opening Spring 2028",
  description:
    "Weddings, retreats, family reunions, and milestone gatherings coming to twenty acres of regenerative Appalachian farmland in spring 2028. The lower hollow, with a long table and a fire pit, is being built to seat forty.",
};

export default function PrivatePage() {
  return (
    <article className="visit-page">
      <section
        className="visit-hero"
        style={{
          ["--visit-hero-image" as string]:
            `url('${assetPath("goldberry", "photos/farm-activities/activity-04.webp")}')`,
        }}
      >
        <div className="visit-hero__inner">
          <div className="visit-hero__eyebrow">Book a Private Event · Opening Spring 2028</div>
          <h1>
            A hickory canopy, a long table, <em>no Wi-Fi.</em>
          </h1>
          <p className="visit-hero__lead">
            The lower hollow will have a fire pit, a long table that seats
            forty, and the kind of quiet that only happens twenty miles from
            any major town. Starting spring 2028 we'll host weddings, retreats,
            milestone birthdays, and small gatherings that want to be in a
            forest.
          </p>
        </div>
      </section>

      <div className="visit-body">
        <OpeningNotice when="Spring 2028">
          Private bookings open in spring 2028, once the lower hollow is
          finished. If you're already thinking about a date, add it below and
          we'll reach out with availability and a quote as we get closer.
        </OpeningNotice>

        <h2>The space</h2>
        <p>
          The lower hollow sits below the orchard, ringed by mature hardwood
          canopy and the year-round stream that runs the southern edge of the
          property. The long table will seat forty under string lights, and the
          fire pit can take another twenty around it. Bring lawn chairs and
          blankets if you want to spread out.
        </p>
        <p>
          On the farm we're building an outdoor kitchen with a propane range and
          a sink, a composting toilet, and a hand-washing station. We'll be able
          to recommend caterers who already know the property if you'd rather
          not bring your own.
        </p>

        <h2>What will work here</h2>
        <ul>
          <li>
            <strong>Weddings</strong>
            Up to about 80 for the ceremony, about 40 for a seated dinner.
            Outdoor ceremony in the orchard, dinner in the hollow, dancing under
            the canopy. We'll hold rain dates and keep a small barn for
            emergencies.
          </li>
          <li>
            <strong>Retreats</strong>
            Day or weekend. Yoga on the lawn. Foraging walks with Abigail. Quiet
            rooms in the main house if you want lodging for 6 to 8 (book ahead).
          </li>
          <li>
            <strong>Family Reunions</strong>
            Bring three generations. There's room for kids to run, a creek for
            them to fall into, and enough land that the introverts can find a
            quiet spot.
          </li>
          <li>
            <strong>Milestone Gatherings</strong>
            Birthdays, anniversaries, life events. The farm is good at holding
            the kind of evening that's mostly about being together outside.
          </li>
        </ul>

        <h2>Reserve a date early</h2>
        <p>
          Private events will be quoted by the day and depend on guest count and
          season. Add your email below with the kind of gathering you have in
          mind, and we'll reach out with availability and a quote as spring 2028
          gets closer. You can also write{" "}
          <strong>sales@goldberrygrove.farm</strong> directly.
        </p>

        <CaptureForm
          brand="goldberry"
          source="notify-me"
          label="private-events-opening"
          interests={["private-events"]}
          eyebrow="Private bookings opening"
          heading="Get on the early-interest list"
          description="Private bookings open in spring 2028. Add your email now and we'll reach out with availability and a quote before dates fill up."
          submitLabel="Notify me"
          successMessage="Done. We'll be in touch as private bookings open for spring 2028."
          consentText="Private-event news only. Unsubscribe anytime."
          hubOptIn
        />

        <Link href="/visit" className="btn btn-gold visit-cta">
          ← Back to all visits
        </Link>
      </div>
    </article>
  );
}
