import Link from "next/link";
import type { Metadata } from "next";
import { assetPath } from "@grove/ui";

export const metadata: Metadata = {
  title: "Come See Us — Goldberry Grove",
  description:
    "Visit Goldberry Grove for u-pick, public events, educational seminars, foraging walks, and private bookings on twenty acres of regenerative agroforestry above Summersville, West Virginia.",
};

export default function VisitPage() {
  return (
    <article className="visit-page">
      <section
        className="visit-hero"
        style={{ ["--visit-hero-image" as string]: `url('${assetPath("goldberry", "photos/farm-hero.webp")}')` }}
      >
        <div className="visit-hero__inner">
          <div className="visit-hero__eyebrow">Come See Us</div>
          <h1>
            Twenty acres, an <em>open gate</em>, four ways in.
          </h1>
          <p className="visit-hero__lead">
            Goldberry is an educational farm. We host u-pick weekends, seminars
            on forest farming and mushroom cultivation, guided foraging walks,
            and private gatherings under hickory canopy. Most visits run by
            appointment so we can walk the rows with you.
          </p>
        </div>
      </section>

      <div className="visit-index__intro">
        <h2>Four programs, one farm.</h2>
        <p>
          The land is ~7 acres of u-pick, ~9 acres of mushroom production under
          the canopy, and a medicinal understory of ginseng, goldenseal, ramps,
          and black cohosh that we teach people to forage and steward. Pick
          the way you want to come in.
        </p>
      </div>

      <section className="come-see-us">
        <div className="come-see-us__grid">
          <Link href="/visit/upick" className="come-see-us__card upick">
            <div className="icon" aria-hidden>
              <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h22l-2.2 14a2 2 0 0 1-2 1.6h-13.6a2 2 0 0 1-2-1.6L5 12z" />
                <path d="M11 12 16 4l5 8" />
                <path d="M11 17v6M16 17v6M21 17v6" />
              </svg>
            </div>
            <h3>U-Pick · ~7 acres.</h3>
            <p>
              Chestnuts, hazelnuts, and black walnuts in fall. Pawpaw and
              persimmon in September. Mulberries, serviceberries, and
              elderberries through summer.
            </p>
            <span className="cta">See the season →</span>
          </Link>

          <Link href="/visit/events" className="come-see-us__card events">
            <div className="icon" aria-hidden>
              <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="7" width="22" height="22" rx="2" />
                <path d="M5 13h22" />
                <path d="M10 4v6M22 4v6" />
                <circle cx="11" cy="19" r="1.2" fill="currentColor" />
                <circle cx="16" cy="19" r="1.2" fill="currentColor" />
                <circle cx="21" cy="19" r="1.2" fill="currentColor" />
                <circle cx="11" cy="24" r="1.2" fill="currentColor" />
                <circle cx="16" cy="24" r="1.2" fill="currentColor" />
              </svg>
            </div>
            <h3>Public Events.</h3>
            <p>
              Farm-to-table dinners. Harvest weekends with bonfires. JADAM and
              Korean Natural Farming intensives. Open-gate days a few times a
              year.
            </p>
            <span className="cta">Upcoming events →</span>
          </Link>

          <Link href="/visit/seminars" className="come-see-us__card seminars">
            <div className="icon" aria-hidden>
              <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 7h10a3 3 0 0 1 3 3v17" />
                <path d="M28 7H18a3 3 0 0 0-3 3" />
                <path d="M4 7v18h10a3 3 0 0 1 3 2" />
                <path d="M28 7v18H18a3 3 0 0 0-3 2" />
                <path d="M8 13h6M8 17h6M21 13h4M21 17h4" />
              </svg>
            </div>
            <h3>Educational Seminars.</h3>
            <p>
              Mushroom log inoculation. Forest-farming and wild-simulated
              ginseng. Native plant ID. Grafting in spring. Foraging walks
              through every season.
            </p>
            <span className="cta">Browse seminars →</span>
          </Link>

          <Link href="/visit/private" className="come-see-us__card private">
            <div className="icon" aria-hidden>
              <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 4c0 5 5 6 5 12a5 5 0 0 1-10 0c0-3 2-4 2-6 0 4 3 4 3 2-1-2 0-6 0-8z" />
                <path d="M10 26h12" />
                <path d="M8 28h16" />
              </svg>
            </div>
            <h3>Private Events.</h3>
            <p>
              The lower hollow has a fire pit and a long table that seats
              forty. Weddings, retreats, milestone gatherings. We provide the
              land; you provide the people.
            </p>
            <span className="cta">Inquire →</span>
          </Link>
        </div>
      </section>

      <section className="visit-contact">
        <h2>Getting here</h2>
        <div className="visit-contact__row">
          <div>
            <strong>Where</strong>
            Goldberry Grove
            <br />
            Summersville, WV
            <br />
            Nicholas County, Appalachia
          </div>
          <div>
            <strong>Hours</strong>
            By appointment
            <br />
            Most weekends, April–November
            <br />
            Open-gate days announced 7+ days out
          </div>
          <div>
            <strong>Contact</strong>
            sales@goldberrygrove.farm
            <br />
            (304) 900-3351
            <br />
            @thegoldberrygrove on Instagram
          </div>
        </div>
      </section>
    </article>
  );
}
