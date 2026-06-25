import Link from "next/link";
import { marketplace } from "../data/marketplace";

export const revalidate = 600;

// Hub homepage — port of wireframes/hub/index.html structure.
// Sections in wireframe order: hero → manifesto → portals → journal → almanac.
export default function HomePage() {
  const goldberry = marketplace.vendors.find((v) => v.slug === "goldberry")!;
  const nursery = marketplace.vendors.find((v) => v.slug === "nursery")!;
  const ggg = marketplace.vendors.find((v) => v.slug === "ggg")!;

  return (
    <>
      {/* Hero — NRG aerial backdrop; aerial drone footage will replace later. */}
      <section className="hero">
        <div className="hero-media">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1729624111264-4689d2cc8193?w=2000&auto=format&fit=crop&q=80"
            alt="New River Gorge aerial — placeholder for property aerial"
          />
        </div>
        <div className="hero-place">
          <strong>37.93° N · 81.03° W</strong>
          Lat / Lon · The grove · West Virginia
        </div>
        <div className="hero-content">
          <div className="hero-eyebrow">— The Grove · A village of three businesses —</div>
          <h1>
            Slow stewardship,<br />
            <em>shared land,</em><br />
            and a kitchen table<br />
            with room for everyone.
          </h1>
          <p className="hero-lead">
            Three sister businesses growing out of one twenty-acre Appalachian
            hillside in Nicholas County, West Virginia. A regenerative
            chestnut-anchored agroforestry farm, a cold-climate tree nursery,
            and a one-bench woodworking shop — held together by a shared
            belief that resilience is made, not bought.
          </p>
          <div className="hero-cta">
            <Link href="/marketplace" className="btn btn-paper">Visit the three shops</Link>
            <Link href="/journal" className="btn btn-solid">Read the journal</Link>
          </div>
        </div>
      </section>

      {/* Manifesto — drop-cap two-column intro. */}
      <section className="manifesto">
        <div className="manifesto-grid">
          <div>
            <div className="manifesto-eyebrow">— A note from the village —</div>
            <h2>
              “A grove<br />
              is a thing<br />
              <em>you tend</em>.”
            </h2>
          </div>
          <div className="manifesto-body">
            <p>
              The grove is a twenty-acre hillside in Nicholas County, West
              Virginia — about six-and-a-half cleared and nine-and-a-half
              wooded — with a farmhouse, a nursery, a small workshop, and a
              chestnut canopy we're building around what was already growing.
              Abigail and Josh bought the land in 2024. Two years later, it's
              still the same hillside, and it's a different place. That's
              the gist of what we mean by gathering.
            </p>
            <p>
              Three of us run businesses on the land. One sells the harvest —
              preserves, cut flowers, herbs, beeswax. One propagates the next
              generation of cold-hardy fruit trees. One builds furniture from
              what falls or has to come down. The businesses are independent.
              The land is the common ground.
            </p>
            <p>
              This page is the village square. The shops live a click away —
              and so does the longer-form writing that the three businesses
              share, because the work of stewarding a small piece of land
              turns out to be one continuous conversation.
            </p>
          </div>
        </div>
      </section>

      {/* Portals — three sub-brand photo cards. */}
      <section className="portals">
        <div className="portals-head">
          <div className="portals-num">— Section 02 / Three shops —</div>
          <div className="portals-title">The shops <em>of the grove.</em></div>
          <div className="portals-aside">Each runs independently. Each tells a piece of the longer story.</div>
        </div>
        <div className="portal-grid">
          <a href={goldberry.homepageUrl} className="portal-card plum">
            <div
              className="portal-img"
              style={{ backgroundImage: "url('https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=1000&auto=format&fit=crop&q=80')" }}
            />
            <div className="portal-content">
              <span className="portal-num">№ 01 — The Farm</span>
              <div className="portal-name"><em>Goldberry Grove</em><br />Farm.</div>
              <div className="portal-desc">
                Chestnut-anchored regenerative agroforestry on twenty acres
                in Nicholas County, WV. Korean-Appalachian roots, two years in.
              </div>
              <div className="portal-cta">Enter the farm shop →</div>
            </div>
          </a>

          <a href={nursery.homepageUrl} className="portal-card forest">
            <div
              className="portal-img"
              style={{ backgroundImage: "url('https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=1000&auto=format&fit=crop&q=80')" }}
            />
            <div className="portal-content">
              <span className="portal-num">№ 02 — The Nursery</span>
              <div className="portal-name"><em>At The Grove</em><br />Nursery.</div>
              <div className="portal-desc">
                Cold-climate fruit trees, berries &amp; edible perennials.
                Propagated on-site since 2024 · zone 3–7.
              </div>
              <div className="portal-cta">Enter the catalog →</div>
            </div>
          </a>

          <a href={ggg.homepageUrl} className="portal-card walnut">
            <div
              className="portal-img"
              style={{ backgroundImage: "url('https://images.unsplash.com/photo-1611068120813-eca5a8cbf793?w=1000&auto=format&fit=crop&q=80')" }}
            />
            <div className="portal-content">
              <span className="portal-num">№ 03 — The Workshop</span>
              <div className="portal-name"><em>GGG</em><br />Woodworking.</div>
              <div className="portal-desc">
                Furniture from the trees of the land. Walnut, cherry, white
                oak — felled on-site, air-dried four to six years, bench-built.
              </div>
              <div className="portal-cta">Enter the workshop →</div>
            </div>
          </a>
        </div>
      </section>

      {/* Journal — feature essay + 3-card grid (static placeholders until Ghost wires up). */}
      <section className="journal">
        <div className="journal-head">
          <h2><em>From the journal.</em></h2>
          <div className="meta">Section 03<br />Updated weekly</div>
        </div>

        <article className="journal-feature">
          <div className="img">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1100&auto=format&fit=crop&q=80"
              alt="Mist over the orchard"
            />
          </div>
          <div>
            <div className="journal-meta">The Land · May 14, 2026 · 11-min read</div>
            <h3>What two consecutive springs in the same place have taught us.</h3>
            <p>
              Two years on the same West Virginia hillside has taught us about
              three things: how slowly soil actually changes, how quickly
              weather doesn't, and how much of what we thought was
              "experience" was just one good year, repeated. A long essay on
              what stewardship looks like at year two — jointly written by
              the three of us.
            </p>
            <Link href="/journal" className="btn btn-ink">Read the essay →</Link>
          </div>
        </article>

        <div className="journal-grid">
          <Link href="/journal" className="journal-card">
            <div className="img">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=600&auto=format&fit=crop&q=80"
                alt=""
              />
            </div>
            <div className="journal-meta">From The Farm · May 8</div>
            <h4>The chestnut harvest journal, year two.</h4>
            <p>The first real crop off the maidens we planted in 2024. A good year, but for unexpected reasons. (Goldberry Grove)</p>
          </Link>

          <Link href="/journal" className="journal-card">
            <div className="img">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=600&auto=format&fit=crop&q=80"
                alt=""
              />
            </div>
            <div className="journal-meta">From The Nursery · May 1</div>
            <h4>Choosing a rootstock for your zone.</h4>
            <p>The variety on the catalog page is half the answer. The rootstock is the other half — and it's the half the catalog rarely talks about. (At The Grove Nursery)</p>
          </Link>

          <Link href="/journal" className="journal-card">
            <div className="img">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1611068120813-eca5a8cbf793?w=600&auto=format&fit=crop&q=80"
                alt=""
              />
            </div>
            <div className="journal-meta">From The Workshop · Apr 23</div>
            <h4>The drying schedule for a four-inch walnut slab.</h4>
            <p>The rule of thumb is one year per inch. For our slab it took closer to six. Why. (GGG Woodworking)</p>
          </Link>
        </div>
      </section>

      {/* Almanac — recurring rhythm of the land. */}
      <section className="almanac">
        <h3>“The grove keeps a calendar of its own. We mostly just take notes.”</h3>
        <div className="almanac-row">
          <div className="almanac-cell">
            <div className="month">Mar — Apr</div>
            <div className="what">Tap maples · graft scion wood · order seed</div>
          </div>
          <div className="almanac-cell">
            <div className="month">May — Jun</div>
            <div className="what">Line out trees · transplant · cut flowers begin</div>
          </div>
          <div className="almanac-cell">
            <div className="month">Jul — Aug</div>
            <div className="what">Plum &amp; berry harvest · preserves run</div>
          </div>
          <div className="almanac-cell">
            <div className="month">Sep — Oct</div>
            <div className="what">Apple harvest · cider · fall tree dig</div>
          </div>
          <div className="almanac-cell">
            <div className="month">Nov — Feb</div>
            <div className="what">Workshop season · timber drying · the writing happens</div>
          </div>
        </div>
      </section>
    </>
  );
}
