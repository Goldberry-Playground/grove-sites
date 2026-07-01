import Link from "next/link";
import type { Metadata } from "next";
import { assetPath } from "@grove/ui";

export const metadata: Metadata = {
  title: "Our Story — Goldberry Grove",
  description:
    "Goldberry Grove is Abigail and Josh Dunbar (and Quasar). Twenty acres above Summersville, West Virginia. A regenerative agroforestry farm and educational hub rooted in the chestnut and the Korean-Appalachian story.",
};

export default function StoryPage() {
  return (
    <article className="story-page">
      <section className="story-hero">
        <div
          className="story-hero__img"
          style={{ backgroundImage: `url('${assetPath("goldberry", "photos/founders-family.webp")}')` }}
          aria-label="The Dunbar family at Goldberry Grove"
        />
        <div className="story-hero__copy">
          <div className="about-eyebrow">Our Story</div>
          <h1>
            The chestnut was<br />
            the <em>first seed.</em>
          </h1>
          <p>
            Goldberry Grove began in December 2024 when we — Abigail and Josh
            Dunbar — bought twenty acres above Summersville, West Virginia
            through the Ascend WV program. We came for two reasons: to be
            closer to family, and to plant a forest that would feed one.
          </p>
          <p className="sig">— Josh and Abigail (and Quasar, the Samoyed)</p>
        </div>
      </section>

      <article className="story-body">
        <h2>Where the name comes from</h2>
        <p>
          Goldberry is a name borrowed from Tolkien — the River-daughter of the
          Old Forest. We took it because it sounded like a place rather than a
          brand, and because it carries the same reverence for the natural
          world that we wanted the farm to carry. The chestnut is the star,
          but the whole forest is the cast.
        </p>

        <h2>The chestnut, and why it matters</h2>
        <p>
          Abigail is Korean American, and chestnuts were a constant of her
          Korean home — roasted in the fall, steamed in winter, ground into
          porridge. When we moved to West Virginia, we learned the
          <em> American Chestnut</em> had once been the dominant tree of these
          forests before the blight wiped it out in the early twentieth
          century. Restoration efforts are still underway. The chestnut at
          Goldberry is our way of joining that work: a Korean-Appalachian
          bridge, planted as a quiet act of restoration.
        </p>
        <p>
          We do not grow chestnuts for commercial sale of nursery stock. We
          grow them because the forest used to be full of them, and because
          they connect Abigail's family table to this land we now call home.
          The same is true of everything else we plant: it has to make sense
          in the long arc of an Appalachian forest, or it doesn't go in the
          ground.
        </p>

        <h2>An educational farm — not a nursery</h2>
        <p>
          We are sometimes asked if we sell seedlings. The honest answer is
          mostly no. Goldberry is an <em>educational farm</em>: we host
          mushroom-inoculation workshops, forest-farming seminars, foraging
          walks, JADAM and KNF intensives, u-pick weekends, and family events
          that put visitors on the land. The seven cleared acres of u-pick
          and the nine wooded acres of mushroom yard are the curriculum. The
          medicinal understory — ginseng, goldenseal, ramps, black cohosh —
          is the slow chapter we'll be teaching for the next decade.
        </p>

        <h2>What we believe about how to farm</h2>
        <p>
          We farm by JADAM and Korean Natural Farming principles — soil-led,
          microbe-led, no synthetic inputs, no shortcuts. The agroforestry
          design is syntropic: layered canopy, shrub line, herbaceous floor,
          mushroom logs in the woods. The goal is not maximum yield; it's a
          farm that gets <em>healthier every year</em>, that runs on
          biodiversity rather than fighting it, and that someone two
          generations from now can keep going.
        </p>

        <h2>Who's around when you visit</h2>
        <p>
          You'll usually meet at least one of us — Abigail or Josh — and
          almost always Quasar. On most weekends our farmhands{" "}
          <em>George</em> and <em>Wesley</em> are also on the land, running
          the rows, prepping for seminars, and keeping the mushroom yard
          honest. WWOOFers pass through in spring and fall; family events
          bring in our wider circle a few times a year. The farm is a small
          village, in the making.
        </p>
      </article>

      <section className="story-crew">
        <div className="story-crew__inner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={assetPath("goldberry", "photos/farm-activities/activity-10.webp")}
            alt="Wesley, one of the farmhands at Goldberry Grove"
          />
          <div>
            <h2>
              George &amp; Wesley<br />
              <em>keep the rows honest.</em>
            </h2>
            <p>
              Goldberry's day-to-day runs on two farmhands. <em>Wesley</em>{" "}
              has been with the farm since 2025 — mushroom yard, inoculation
              workshops, and the kind of careful attention that the medicinal
              understory needs. <em>George</em> handles orchard care, the
              u-pick season prep, and most of the seminar logistics.
            </p>
            <p>
              If you're at the farm for an event and we're behind on
              something, odds are good George or Wesley is the reason it's
              still on schedule.
            </p>
          </div>
        </div>
      </section>

      <article className="story-body">
        <h2>Where we're headed</h2>
        <p>
          The plan thinks in decades. The chestnuts in year one are barely
          knee-high; they'll fruit in five to seven, and the canopy they form
          will define the farm twenty years from now. The mushroom yard
          fills in faster — a log lasts five years and pays for itself in
          two. The medicinal understory is the slowest layer — ginseng wants
          a seven-to-ten-year horizon before harvest.
        </p>
        <p>
          We're a WWOOF host site, an ecovillage-in-the-making, and a farm
          built to welcome anyone learning to farm like a forest. If that
          sounds like your kind of place, the gate is open.
        </p>
        <Link href="/visit" className="btn btn-gold visit-cta">
          Come see us →
        </Link>
      </article>
    </article>
  );
}
