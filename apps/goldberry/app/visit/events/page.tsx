import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Public Events — Goldberry Grove",
  description:
    "Farm-to-table dinners, harvest weekends, JADAM workshops, and open-gate community days at Goldberry Grove.",
};

export default function EventsPage() {
  return (
    <article className="visit-page">
      <section
        className="visit-hero"
        style={{
          ["--visit-hero-image" as string]:
            "url('/photos/learning-from-locals.webp')",
        }}
      >
        <div className="visit-hero__inner">
          <div className="visit-hero__eyebrow">Public Events</div>
          <h1>
            Open the gate. <em>Bring a friend.</em>
          </h1>
          <p className="visit-hero__lead">
            A few times a year we open Goldberry to everyone — farm-to-table
            dinners under string lights, harvest weekends with bonfires, and
            community workshops on the soil-and-soul side of agroforestry.
          </p>
        </div>
      </section>

      <div className="visit-body">
        <h2>What runs publicly</h2>
        <ul>
          <li>
            <strong>Farm-to-Table</strong>
            Quarterly long-table dinners cooked from the harvest. Korean
            and Appalachian flavors, lit by string lights and the fire pit.
            Usually 30–40 seats; tickets go on sale six weeks out.
          </li>
          <li>
            <strong>Harvest Weekends</strong>
            Two-day open-gate events around peak chestnut drop (late September /
            early October) and pawpaw drop (early September). Music, food,
            kids' activities, the whole rotation.
          </li>
          <li>
            <strong>JADAM Intensive</strong>
            Annual two-day deep-dive into JADAM Microbial Solutions and Liquid
            Fertilizer. Open to the public; field-tour included. Run by Josh
            with guest speakers from the JADAM-KNF community.
          </li>
          <li>
            <strong>Solstice & Equinox Days</strong>
            Quiet open-gate days four times a year — walk the rows, see what's
            growing, share tea on the porch. No ticket, donation basis.
          </li>
        </ul>

        <h2>Where to find dates</h2>
        <p>
          We don't run a fixed calendar — the farm decides when. Dates get
          posted to{" "}
          <a
            href="https://instagram.com/thegoldberrygrove"
            style={{ color: "var(--harvest-gold)" }}
          >
            @thegoldberrygrove
          </a>{" "}
          and to{" "}
          <Link href="/blog" style={{ color: "var(--harvest-gold)" }}>
            the journal
          </Link>{" "}
          three to six weeks ahead. Ticketed events sell through Eventbrite;
          open-gate days are free.
        </p>

        <p>
          Want a heads-up by email? Drop us a note at{" "}
          <strong>sales@goldberrygrove.farm</strong>{" "}
          and we'll add you to the next-event list.
        </p>

        <Link href="/visit" className="btn btn-gold visit-cta">
          ← Back to all visits
        </Link>
      </div>
    </article>
  );
}
