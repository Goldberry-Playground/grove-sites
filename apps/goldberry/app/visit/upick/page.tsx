import Link from "next/link";
import type { Metadata } from "next";
import { assetPath } from "@grove/ui";
import { CaptureForm } from "@grove/ui-kit";
import { OpeningNotice } from "../_components/OpeningNotice";

export const metadata: Metadata = {
  title: "U-Pick at Goldberry Grove — Opening Fall 2028",
  description:
    "Seven acres of u-pick coming to a regenerative Appalachian farm. We are finishing the planting this season and planning to open the gate around Fall 2028. Chestnuts, pawpaws, berries, and tree fruit in their seasons.",
};

export default function UPickPage() {
  return (
    <article className="visit-page">
      <section
        className="visit-hero"
        style={{
          ["--visit-hero-image" as string]:
            `url('${assetPath("goldberry", "photos/farm-activities/activity-09.webp")}')`,
        }}
      >
        <div className="visit-hero__inner">
          <div className="visit-hero__eyebrow">U-Pick · Opening Fall 2028</div>
          <h1>
            Pick what's <em>actually ripe.</em>
          </h1>
          <p className="visit-hero__lead">
            We are planting the last of seven acres this season. Young trees
            need a few years to bear, so we are aiming to open the gate for
            u-pick around Fall 2028. Here is what those rows are being grown to
            hold.
          </p>
        </div>
      </section>

      <div className="visit-body">
        <OpeningNotice when="Fall 2028">
          We are finishing the planting on all seven acres this fall and into
          early spring. The trees need a few seasons before they carry a crop,
          so we are planning to open u-pick around Fall 2028. Add your email
          below and we will send first word the season the gate opens.
        </OpeningNotice>

        <p>
          Goldberry Grove's u-pick is laid out across about seven acres of
          cleared hillside, planted in layered agroforestry: a chestnut,
          hazelnut, and walnut canopy with serviceberry, mulberry, elderberry,
          pawpaw, and persimmon below. Everything is grown without synthetic
          fertilizer or pesticide, on JADAM and Korean Natural Farming inputs
          only.
        </p>

        <h2>What each season will hold</h2>
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

        <h2>How it will work</h2>
        <p>
          When u-pick opens, it will run by appointment rather than drop-in.
          That lets us match the gate opening to what is actually ripe and keep
          the rows from getting trampled before they are ready. Dates and
          what's open will get posted to Instagram and the journal about seven
          days out. You'll pay by the pound on the way out, and we'll tare
          baskets at the table.
        </p>

        <p>
          The land is steep in places, so plan on closed-toe shoes. Our
          farmhand crew (<strong>George</strong> and <strong>Wesley</strong>)
          will be able to point you to the easiest rows if the trail looks
          rough. Children are very welcome. Most of the folks we expect are
          families.
        </p>

        <CaptureForm
          brand="goldberry"
          source="notify-me"
          label="upick-opening"
          interests={["upick"]}
          eyebrow="U-Pick opening"
          heading="Hear when the gate opens"
          description="We are aiming to open u-pick around Fall 2028. Add your email and you'll get first word the season the first rows are ready to pick."
          submitLabel="Notify me"
          successMessage="Done. You'll hear from us the season u-pick opens."
          consentText="U-pick opening news only. Unsubscribe anytime."
          hubOptIn
        />

        <Link href="/visit" className="btn btn-gold visit-cta">
          ← Back to all visits
        </Link>
      </div>
    </article>
  );
}
