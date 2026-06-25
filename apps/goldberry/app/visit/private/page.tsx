import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Book a Private Event — Goldberry Grove",
  description:
    "Weddings, retreats, family reunions, and milestone gatherings on twenty acres of regenerative Appalachian farmland. The lower hollow with a long table and a fire pit seats forty.",
};

export default function PrivatePage() {
  return (
    <article className="visit-page">
      <section
        className="visit-hero"
        style={{
          ["--visit-hero-image" as string]:
            "url('/photos/farm-activities/activity-04.webp')",
        }}
      >
        <div className="visit-hero__inner">
          <div className="visit-hero__eyebrow">Book a Private Event</div>
          <h1>
            A hickory canopy, a long table, <em>no Wi-Fi.</em>
          </h1>
          <p className="visit-hero__lead">
            The lower hollow has a fire pit, a long table that seats forty,
            and the kind of quiet that only happens twenty miles from any
            major town. We host weddings, retreats, milestone birthdays, and
            small gatherings that want to be in a forest.
          </p>
        </div>
      </section>

      <div className="visit-body">
        <h2>The space</h2>
        <p>
          The lower hollow sits below the orchard, ringed by mature hardwood
          canopy and the year-round stream that runs the southern edge of the
          property. The long table seats forty under string lights; the fire
          pit can take another twenty around it. Bring lawn chairs and
          blankets if you want to spread out.
        </p>
        <p>
          On the farm: an outdoor kitchen with a propane range and a sink, a
          composting toilet, a hand-washing station. We can recommend
          caterers who already know the property if you'd rather not bring
          your own.
        </p>

        <h2>What works here</h2>
        <ul>
          <li>
            <strong>Weddings</strong>
            Up to ~80 ceremony, ~40 seated dinner. Outdoor ceremony in the
            orchard, dinner in the hollow, dancing under the canopy. We have
            rain dates and a small barn for emergencies.
          </li>
          <li>
            <strong>Retreats</strong>
            Day or weekend. Yoga on the lawn. Foraging walks with Abigail.
            Quiet rooms in the main house if you want lodging for 6–8 (book
            ahead).
          </li>
          <li>
            <strong>Family Reunions</strong>
            Bring three generations. There's room for kids to run, a creek
            for them to fall into, and enough land that the introverts can
            find a quiet spot.
          </li>
          <li>
            <strong>Milestone Gatherings</strong>
            Birthdays, anniversaries, life-events. The farm is good at
            holding the kind of evening that's mostly about being together
            outside.
          </li>
        </ul>

        <h2>Inquiry</h2>
        <p>
          Private events are quoted by the day and depend on guest count and
          season. Email{" "}
          <strong>sales@goldberrygrove.farm</strong>{" "}
          with the date you have in mind, expected headcount, and what kind
          of gathering it is. We'll send back availability and a quote within
          a few days.
        </p>

        <Link href="/visit" className="btn btn-gold visit-cta">
          ← Back to all visits
        </Link>
      </div>
    </article>
  );
}
