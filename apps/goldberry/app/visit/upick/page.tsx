import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "U-Pick at Goldberry Grove",
  description:
    "Seven acres of u-pick on a regenerative Appalachian farm. Chestnuts in October, pawpaws in September, berries and tree fruit through summer.",
};

export default function UPickPage() {
  return (
    <article className="visit-page">
      <section
        className="visit-hero"
        style={{
          ["--visit-hero-image" as string]:
            "url('/photos/farm-activities/activity-09.webp')",
        }}
      >
        <div className="visit-hero__inner">
          <div className="visit-hero__eyebrow">U-Pick · ~7 acres</div>
          <h1>
            Pick what's <em>actually ripe.</em>
          </h1>
          <p className="visit-hero__lead">
            We open the gate by appointment when something is ready. Bring a
            basket and an afternoon. The rows are wide enough for a wagon, the
            walk is wooded, and the dog is friendly.
          </p>
        </div>
      </section>

      <div className="visit-body">
        <p>
          Goldberry Grove's u-pick is laid out across about seven acres of
          cleared hillside, planted in layered agroforestry: a chestnut–hazelnut–
          walnut canopy with serviceberry, mulberry, elderberry, pawpaw, and
          persimmon below. Everything is grown without synthetic fertilizer or
          pesticide — JADAM and Korean Natural Farming inputs only.
        </p>

        <h2>What's in season, roughly</h2>
        <ul>
          <li>
            <strong>June</strong>
            Mulberries, early serviceberries, the first elderflowers (for syrup,
            not eating).
          </li>
          <li>
            <strong>July</strong>
            Serviceberries finish, elderberries set, the first wild raspberries
            along the woodland edge.
          </li>
          <li>
            <strong>August</strong>
            Elderberries ripen. Late summer wild plums in the hedgerow if the
            birds don't beat us to them.
          </li>
          <li>
            <strong>September</strong>
            Pawpaws drop. Persimmons follow once the first hard frost hits the
            tannins. Hazelnuts start coming in.
          </li>
          <li>
            <strong>October</strong>
            <span>
              <em className="prose-anchor">Chestnuts.</em> The main event.
              Hazelnuts finish. Black walnuts drop and we'll show you how to
              hull them without staining everything you own.
            </span>
          </li>
        </ul>

        <h2>How it works</h2>
        <p>
          U-pick is by appointment, not drop-in — that lets us match the gate
          opening to what's actually ripe and keep the rows from getting
          trampled before they're ready. Dates and what's open get posted to
          Instagram and the journal seven days out. Pay by the pound on the
          way out; we tare baskets at the table.
        </p>

        <p>
          The land is steep in places. Wear closed-toe shoes. We have a
          farmhand crew (
          <strong>George</strong>{" "}
          and{" "}
          <strong>Wesley</strong>)
          who can point you to the easiest rows if the trail looks rough.
          Children very welcome — most of our u-pickers are families.
        </p>

        <Link href="/visit" className="btn btn-gold visit-cta">
          ← Back to all visits
        </Link>
      </div>
    </article>
  );
}
