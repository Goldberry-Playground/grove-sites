import Link from "next/link";
import { assetPath } from "@grove/ui";

// Goldberry Grove homepage. Corrected positioning per project owner (2026-05-29):
// the farm is an EDUCATIONAL HUB on native + regenerative agroforestry. NOT a
// genetic-stock nursery. ~7 acres u-pick (nuts, berries, fruit), ~9 acres mushroom
// production, medicinal forest farming, foraging education. American Chestnut
// is mission anchor (restoration story, Korean-Appalachian heritage) but not a
// product line. Family signal: Abigail+Josh+Quasar plus farmhands George & Wesley.
//
// Sections: hero → manifesto (with drone-footage background video) → what-grows-here
// → family-slideshow → about-vision → come-see-us preview → story-strip.

// Per-slide accessible labels for the family slideshow. Each entry corresponds
// to /photos/farm-activities/activity-NN.webp (1-indexed → padded to 2 digits).
// Screen readers announce each via role="img" + aria-label so the slideshow
// conveys actual photo content, not just a container label.
const familySlideDescriptions = [
  "Family gathering at the farmhouse",
  "Walking the farm road together on a spring planting day",
  "Farm-to-table dinner on the long table",
  "Working in the orchard during summer planting",
  "Open-gate day with visitors picking nuts",
  "Potting up seedlings by hand on a community planting day",
  "Sorting bare-root seedlings before they go in the ground",
  "Mushroom inoculation workshop",
  "Walnuts in a bucket after the autumn drop",
  "Wesley, one of the farmhands at Goldberry Grove",
];

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <h1 className="hero-title">
            Native trees, grown the way<br />
            <em>the forest</em> grows them.
          </h1>
          <p className="hero-lead">
            Goldberry Grove is twenty acres of regenerative agroforestry above
            Summersville, West Virginia — seven acres of u-pick nuts, berries,
            and tree fruit; nine acres of mushrooms on hardwood logs; a medicinal
            understory under the canopy; and an open gate for anyone learning
            to farm like a forest. Educational hub first. Working farm always.
            JADAM-fermented soil. No synthetic anything. A plan that thinks in
            decades. Two years in, still figuring it out.
          </p>
          <p className="hero-sig">— Josh and Abigail</p>
          <div className="hero-cta">
            <Link href="/visit" className="btn btn-gold">Come see us</Link>
            <Link href="/about" className="btn btn-ghost">Our Story</Link>
          </div>
        </div>
      </section>

      {/* Manifesto — what we mean by agroforestry. Background is a 20s drone-
          footage loop (G44Va_9r0JQ, re-encoded to ~2.5MB H.264 + VP9 at
          1280×720, muted, looping). Dark overlay sits between video and text
          so the editorial copy stays legible at any frame. */}
      <section className="manifesto manifesto--video">
        <div className="manifesto-video" aria-hidden>
          <video
            className="manifesto-video__el"
            autoPlay
            muted
            loop
            playsInline
            aria-hidden="true"
            poster={assetPath("goldberry", "video/drone-poster.webp")}
          >
            <source src={assetPath("goldberry", "video/drone-loop.webm")} type="video/webm" />
            <source src={assetPath("goldberry", "video/drone-loop.mp4")} type="video/mp4" />
          </video>
          <div className="manifesto-video__veil" />
        </div>
        <div className="manifesto-grid manifesto-grid--over-video">
          <h2>
            What we mean<br />
            when we say<br />
            “<em>agroforestry</em>.”
          </h2>
          <div className="manifesto-body">
            <p>
              We farm twenty acres in the Appalachian foothills above the New
              River Gorge — about seven cleared for u-pick, nine wooded for
              mushrooms and the medicinal understory, the rest house, drive,
              and seminar yard. The central word in that sentence is{" "}
              <em>forest</em>. Goldberry is an educational farm first — a
              place to learn what regenerative agroforestry actually looks like
              on a working hillside in Appalachia.
            </p>
            <p>
              The American Chestnut is our north star. Once the dominant tree of
              this forest, blighted to near-extinction a century ago, it carries
              the restoration story we're betting our soil on. Hybrid hazelnuts
              and black walnuts share that canopy. Underneath: pawpaw,
              persimmon, mulberry, serviceberry. Below that, the medicinal
              ginseng, goldenseal, ramps, black cohosh. And on hardwood logs
              in the woods, shiitake, lion's mane, oysters by the hundred.
              JADAM and Korean Natural Farming guide every input. The goal is
              a farm you can <em>walk through and learn from</em>.
            </p>
          </div>
        </div>
      </section>

      {/* What grows here — replaces the old "products" grid. Four facets of the
          farm visitors can touch: U-Pick, Mushrooms, Medicinal Forest, Foraging.
          Cards link to /visit/* for the details. */}
      <section className="grows-here">
        <div className="section-head">
          <h2 className="section-title">What grows here</h2>
          <span className="section-num">Four ways into the forest</span>
        </div>
        <div className="grows-grid">
          {/* Anchor card — U-Pick is the headliner, gets the photo + scale.
              The other three are typographic cream cards stacking to the right. */}
          <Link href="/visit/upick" className="grows-card grows-card--anchor">
            <span className="grows-card__kicker">The headliner · ~7 acres</span>
            <h3>U-Pick, the way the season opens it.</h3>
            <p>
              Chestnuts in October, pawpaws in September, berries and tree fruit
              through summer. Bring a basket and an afternoon — we'll post
              dates the week before the gate opens.
            </p>
            <span className="grows-card__cta">See the season →</span>
          </Link>
          <Link href="/visit/seminars" className="grows-card">
            <span className="grows-card__kicker">Mushrooms · ~9 acres</span>
            <h3>Shiitake, lion's mane, oysters.</h3>
            <p>
              Inoculated on hardwood logs under the canopy. Spring inoculation
              workshops. Wild-simulated medicinals along the woodland edge.
            </p>
            <span className="grows-card__cta">Inoculation workshop →</span>
          </Link>
          <Link href="/visit/seminars" className="grows-card">
            <span className="grows-card__kicker">Medicinal forest farming</span>
            <h3>Ginseng, goldenseal, ramps.</h3>
            <p>
              Wild-simulated in the wooded understory. Long horizons, slow
              returns, the way Appalachian herbalists worked these ridges.
            </p>
            <span className="grows-card__cta">Forest-farming walk →</span>
          </Link>
          <Link href="/visit/seminars" className="grows-card">
            <span className="grows-card__kicker">Foraging education</span>
            <h3>Native plant ID. Wild edibles.</h3>
            <p>
              Half-day seasonal walks led by Josh, Abigail, and guest
              herbalists from the Appalachian-foraging community.
            </p>
            <span className="grows-card__cta">Browse the walks →</span>
          </Link>
        </div>
      </section>

      {/* Family + farmhands — slideshow of activities the family has hosted on
          the farm, with George and Wesley signal. Pure-CSS crossfade between
          ten curated photos from Desktop/Photos/Farm Activities. */}
      <section className="family-show">
        <div className="family-show__copy">
          <span className="about-eyebrow">The people on the land</span>
          <h2>A family farm. A farmhand crew. An open gate.</h2>
          <p>
            Goldberry is Abigail and Josh Dunbar (and Quasar, the Samoyed).
            Day-to-day, the orchard, mushroom yard, and seminar prep run with
            our farmhands <strong>George</strong> and <strong>Wesley</strong> —
            the two reasons the gate can stay open when there are workshops to
            host and rows still to weed. Family events on the land, harvest
            weekends, and the WWOOFers who pass through round out who you'll
            meet when you visit.
          </p>
          <Link href="/about" className="btn btn-ghost">Read our story →</Link>
        </div>
        <div className="family-slideshow" aria-label="Photos from family events and farm work at Goldberry Grove">
          {familySlideDescriptions.map((label, i) => {
            const num = (i + 1).toString().padStart(2, "0");
            return (
              <div
                key={num}
                className="family-slide"
                style={{
                  backgroundImage: `url('${assetPath("goldberry", `photos/farm-activities/activity-${num}.webp`)}')`,
                  animationDelay: `${i * 5}s`,
                }}
                role="img"
                aria-label={label}
              />
            );
          })}
        </div>
      </section>

      {/* About Us · Vision — corrected to educational-hub framing. */}
      <section className="about-vision">
        <div className="about-vision-grid">
          <div>
            <span className="about-eyebrow">Our Vision</span>
            <h2>
              An educational hub<br />
              for the <em>next forest</em><br />
              of Appalachia.
            </h2>
          </div>
          <div>
            <p>
              We're building Goldberry as a place people come to learn what
              regenerative agroforestry actually looks like — not as theory,
              but as a working hillside you can walk. The American Chestnut
              restoration story anchors the mission; the u-pick, mushrooms,
              medicinal understory, and foraging walks are the curriculum.
            </p>
            <p>
              The farm runs on soil regeneration, wind and water management,
              and biodiversity before yield. Long-term we'll bring livestock
              into the rotation when the trees are tall enough to share. The
              goal isn't to be the biggest farm in West Virginia. It's to be
              the most generous teacher of how to start one.
            </p>
            <div className="about-vision-pillars">
              {[
                { t: "Soil regeneration", b: "JADAM amendments, no synthetic fertilizer, organic-matter-led." },
                { t: "Forest stewardship", b: "Mushroom yards and medicinal understory under existing canopy." },
                { t: "Open-gate education", b: "U-pick, seminars, foraging walks, and WWOOFers on the land." },
                { t: "Livestock — eventually", b: "When the trees are tall enough to share, the rotation expands." },
              ].map((p) => (
                <div className="about-vision-pillar" key={p.t}>
                  {/* Botanical leaf glyph — replaces the generic "Pillar 0X" mono
                      numbering. Reads as almanac chapter mark rather than SaaS feature. */}
                  <span className="about-vision-pillar__glyph" aria-hidden>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22c0-9 3-14 9-17-1 8-4 14-9 17z" />
                      <path d="M12 22c0-9-3-14-9-17 1 8 4 14 9 17z" />
                      <path d="M12 22V8" />
                    </svg>
                  </span>
                  <h3>{p.t}</h3>
                  <p>{p.b}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Come See Us — preview of the four programs. Full detail lives at
          /visit and its sub-pages. */}
      <section className="come-see-us">
        <div className="come-see-us__head">
          <span className="about-eyebrow">Come See Us</span>
          <h2>
            The farm is <em>a place</em> — not just a website.
          </h2>
          <p>
            We open the gate for u-pick weekends, seminars, foraging walks,
            and private gatherings. Most events run by appointment so we can
            actually walk the rows with you. Four ways in:
          </p>
        </div>
        <div className="come-see-us__grid">
          <Link href="/visit/upick" className="come-see-us__card upick">
            <div className="icon" aria-hidden>
              <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h22l-2.2 14a2 2 0 0 1-2 1.6h-13.6a2 2 0 0 1-2-1.6L5 12z" />
                <path d="M11 12 16 4l5 8" />
                <path d="M11 17v6M16 17v6M21 17v6" />
              </svg>
            </div>
            <h3>U-Pick, in season.</h3>
            <p>
              Chestnuts in October, pawpaws in September, berries and tree
              fruit through summer. The gate opens by appointment when
              something is actually ripe.
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
            <h3>Public events.</h3>
            <p>
              Seasonal farm-to-table dinners. Harvest weekends. JADAM
              fermentation workshops. We open the gate a few times a year for
              everyone — bring a friend and a flashlight.
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
            <h3>Educational seminars.</h3>
            <p>
              Mushroom inoculation. Foraging walks. Grafting in spring. KNF and
              JADAM deep-dives. Small groups, hands on the tools, on the land.
              Most run a half-day to a weekend.
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
            <h3>Book a private event.</h3>
            <p>
              The lower hollow with a fire pit and a long table seats forty.
              Weddings, retreats, family reunions — the kind of gathering that
              wants hickory canopy overhead and no Wi-Fi.
            </p>
            <span className="cta">Inquire →</span>
          </Link>
        </div>
        <div style={{ marginTop: "3rem", textAlign: "center" }}>
          <Link href="/visit" className="btn btn-gold">All ways to visit →</Link>
        </div>
      </section>

      <section className="story-strip">
        <article className="story-strip-card">
          <div
            className="story-img"
            style={{ backgroundImage: `url('${assetPath("goldberry", "photos/farm-hero.webp")}')` }}
          />
          <div className="story-body">
            <div className="story-strip-meta">
              <span>From the Journal</span>
              <span>October 12 · 5 min read</span>
            </div>
            <h3>“The first real chestnut crop came in three weeks early this year. The whole rotation moved with it.”</h3>
            <p>
              The advantage of working a small Appalachian farm is that we
              can change our minds in twenty-four hours. The disadvantage is
              that everything depends on whether we read the weather right.
              This year the chestnuts dropped by late September — three
              weeks ahead of last year — and the canopy-down rotation had
              to compress…
            </p>
            <Link href="/blog" className="continue">Continue reading →</Link>
          </div>
        </article>
      </section>
    </>
  );
}
