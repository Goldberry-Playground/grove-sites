import Link from "next/link";
import type { Metadata } from "next";
import { assetPath } from "@grove/ui";
import { CaptureForm } from "@grove/ui-kit";
import { OpeningNotice } from "../_components/OpeningNotice";

export const metadata: Metadata = {
  title: "Educational Seminars — Goldberry Grove — Opening Spring 2027",
  description:
    "Mushroom inoculation, forest farming, foraging walks, JADAM and Korean Natural Farming deep-dives, and native plant ID coming to a working Appalachian agroforestry farm in spring 2027, with a full calendar and online registration.",
};

export default function SeminarsPage() {
  return (
    <article className="visit-page">
      <section
        className="visit-hero"
        style={{
          ["--visit-hero-image" as string]:
            `url('${assetPath("goldberry", "photos/farm-activities/activity-07.webp")}')`,
        }}
      >
        <div className="visit-hero__inner">
          <div className="visit-hero__eyebrow">Educational Seminars · Opening Spring 2027</div>
          <h1>
            Learn it <em>where it grows.</em>
          </h1>
          <p className="visit-hero__lead">
            Starting spring 2027, seminars at Goldberry will be small (8 to 20
            people), hands-on, and held on the working farm. You'll spend most
            of the day outside, with a tool in your hand and a question we'll
            actually try to answer.
          </p>
        </div>
      </section>

      <div className="visit-body">
        <OpeningNotice when="Spring 2027">
          Seminars open in spring 2027, with a full calendar and online
          registration right here on the site. Until then, add your email below
          and the newsletter list gets first pick of seats.
        </OpeningNotice>

        <p>
          We teach what we practice. Every seminar comes out of something we
          are actively running on the farm, so there are no theory-only
          sessions. Most will be a half-day to a weekend, and weekend sessions
          will include meals from the harvest.
        </p>

        <h2>The seminar rotation</h2>
        <ul>
          <li>
            <strong>Mushroom Inoculation</strong>
            Spring weekend. We drill, inoculate, and stack hardwood logs with
            shiitake, lion's mane, and oyster spawn. You leave with two logs
            of your own and a year's worth of confidence. The mushroom yard
            spans about nine acres of canopy — there's plenty to see.
          </li>
          <li>
            <strong>Forest Farming</strong>
            Two-day intensive on wild-simulated medicinal cultivation —
            ginseng, goldenseal, ramps, black cohosh. How to read site
            suitability, where to source seed and rootstock, and how to think
            about a 7–10 year crop.
          </li>
          <li>
            <strong>Foraging Walks</strong>
            Half-day seasonal walks. Spring (greens and ramps). Early summer
            (medicinals in flower). Late summer (berries and bark). Fall
            (mushrooms and nuts). Led by Josh, Abigail, and guest herbalists
            from the Appalachian-foraging community.
          </li>
          <li>
            <strong>JADAM & KNF Deep-Dive</strong>
            Annual two-day, with hands-on input-making: JMS, JLF, FPJ, LAB.
            Field-tour included so you can see where these inputs are
            actually used in our rotation.
          </li>
          <li>
            <strong>Grafting in Spring</strong>
            One-day workshop on whip-and-tongue, cleft, and bark grafting for
            chestnut, hazelnut, and apple. Bring rootstock or use ours.
          </li>
          <li>
            <strong>Native Plant ID</strong>
            Half-day walks focused on the trees, shrubs, and herbaceous flora
            you'd actually find on a West Virginia hillside. Good for new
            landowners and curious neighbors.
          </li>
        </ul>

        <h2>How registration will work</h2>
        <p>
          Each seminar will hold to 8 to 20 people so you actually get hands-on
          time. When the calendar goes live in spring 2027, dates and online
          registration will live right here, with priority going to the
          newsletter list. Until then, join the list below or email{" "}
          <strong>sales@goldberrygrove.farm</strong>.
        </p>

        <CaptureForm
          brand="goldberry"
          source="notify-me"
          label="seminars-opening"
          interests={["seminars"]}
          eyebrow="Seminars opening"
          heading="Get first pick of seats"
          description="Seminars open in spring 2027 with a full calendar. Add your email and the newsletter list hears first, before dates go public."
          submitLabel="Notify me"
          successMessage="Done. You'll hear first when the seminar calendar opens."
          consentText="Seminar announcements only. Unsubscribe anytime."
          hubOptIn
        />

        <Link href="/visit" className="btn btn-gold visit-cta">
          ← Back to all visits
        </Link>
      </div>
    </article>
  );
}
