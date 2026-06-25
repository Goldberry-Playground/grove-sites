import Link from "next/link";
import { HeroSlideshow } from "./hero-slideshow";

// GGG Woodworking homepage — port of wireframes/ggg/index.html structure.
// Sections in wireframe order: hero (split) → spec-strip → catalog →
// maker's note → wood library.

// Unsplash image IDs — verified woodworking / furniture / workshop photos.
// Replace with self-hosted product photography when available.
const img = {
  walnutTable:
    "https://images.unsplash.com/photo-1604074131665-7a4b13870ab3?w=900&auto=format&fit=crop&q=80",
  diningChair:
    "https://images.unsplash.com/photo-1503602642458-232111445657?w=900&auto=format&fit=crop&q=80",
  cuttingBoard:
    "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=900&auto=format&fit=crop&q=80",
  shelf:
    "https://images.unsplash.com/photo-1594026112284-02bb6f3352fe?w=900&auto=format&fit=crop&q=80",
  bench:
    "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=900&auto=format&fit=crop&q=80",
  stool:
    "https://images.unsplash.com/photo-1503602642458-232111445657?w=900&auto=format&fit=crop&q=80&crop=entropy",
  maker:
    "https://images.unsplash.com/photo-1542178243-bc20204b769f?w=1200&auto=format&fit=crop&q=80",
};

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <HeroSlideshow />
        <div className="hero-text">
          <span className="hero-eyebrow">
            Workshop № 04 · Appalachian WV
          </span>
          <h1>
            Furniture<br />
            from <span>the trees</span><br />
            of our land.
          </h1>
          <p className="hero-lead">
            Black walnut, cherry, and white oak, felled by hand from
            the lower orchard at Goldberry Grove, air-dried under
            cover, and bench-built in the shop one piece at a time.
          </p>
          <div className="hero-cta">
            <Link href="/shop" className="btn">
              Browse the Catalog
            </Link>
            <Link href="/about" className="btn btn-bone">
              Visit the Shop
            </Link>
          </div>
        </div>
      </section>

      {/* Spec strip — 4 trust signals */}
      <div className="spec-strip">
        <div>
          <div className="icon">01</div>
          <div>
            <strong>Land-sourced timber</strong>
            <span>Felled on-site from the Grove</span>
          </div>
        </div>
        <div>
          <div className="icon">02</div>
          <div>
            <strong>Air-dried, under cover</strong>
            <span>No kiln · no rushed wood</span>
          </div>
        </div>
        <div>
          <div className="icon">03</div>
          <div>
            <strong>Joinery before fasteners</strong>
            <span>Mortise &amp; tenon · dovetail</span>
          </div>
        </div>
        <div>
          <div className="icon">04</div>
          <div>
            <strong>Lifetime guarantee</strong>
            <span>Owner-replaceable refinishing</span>
          </div>
        </div>
      </div>

      {/* Catalog — current pieces (6 of 12 shown) */}
      <section className="catalog">
        <div className="cat-header">
          <h2>
            The Catalog —<br />
            <span>Spring &amp; Summer 2026</span>
          </h2>
          <div className="meta">
            Six of twelve pieces shown
            <br />
            Built one at a time
          </div>
        </div>
        <div className="cat-grid">
          <Link
            href="/shop/the-lower-hollow-walnut-table"
            className="cat-card"
          >
            <div className="cat-img">
              <span className="cat-num">№ 04-18</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.walnutTable} alt="Walnut slab table" />
            </div>
            <div className="cat-info">
              <div className="cat-spec">
                Dining · Walnut · One of one
              </div>
              <div className="cat-name">
                The Lower Hollow Table
              </div>
              <div className="cat-desc">
                Live-edge black walnut slab, 11ft × 38&quot;, trestle
                base in white oak. From a hundred-year-old tree the
                property already had, taken down by a hard storm and
                milled in the barn that week. Seats ten.
              </div>
              <div className="cat-foot">
                <span className="cat-price">$8,400</span>
                <span className="cat-meta">14 wk lead</span>
              </div>
            </div>
          </Link>

          <Link href="/shop/holler-dining-chair" className="cat-card">
            <div className="cat-img">
              <span className="cat-num">№ 03-22</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.diningChair} alt="Cherry dining chair" />
            </div>
            <div className="cat-info">
              <div className="cat-spec">
                Dining · Cherry · Edition of 6
              </div>
              <div className="cat-name">Holler Dining Chair</div>
              <div className="cat-desc">
                Steam-bent cherry back, hand-shaped seat in eastern
                white pine, mortise-and-tenon joinery. The seat is
                harder than it looks.
              </div>
              <div className="cat-foot">
                <span className="cat-price">$1,200</span>
                <span className="cat-meta">10 wk lead</span>
              </div>
            </div>
          </Link>

          <Link
            href="/shop/end-grain-cutting-board"
            className="cat-card"
          >
            <div className="cat-img">
              <span className="cat-num">№ 04-04</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.cuttingBoard} alt="Cutting board" />
            </div>
            <div className="cat-info">
              <div className="cat-spec">
                Kitchen · End-grain · Walnut
              </div>
              <div className="cat-name">End-grain Cutting Board</div>
              <div className="cat-desc">
                End-grain walnut, 16&quot; × 22&quot;, finished in
                beeswax and tung oil. Easy on knives. Heavier than
                expected — that&apos;s the point.
              </div>
              <div className="cat-foot">
                <span className="cat-price">$280</span>
                <span className="cat-meta">In stock</span>
              </div>
            </div>
          </Link>

          <Link
            href="/shop/mantle-shelf-cherry"
            className="cat-card"
          >
            <div className="cat-img">
              <span className="cat-num">№ 02-31</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.shelf} alt="Cherry mantle shelf" />
            </div>
            <div className="cat-info">
              <div className="cat-spec">
                Shelving · Cherry &amp; iron
              </div>
              <div className="cat-name">Mantle Shelf — Cherry</div>
              <div className="cat-desc">
                A single 8ft length of cherry, 8&quot; deep, hung on
                hand-forged iron brackets by a blacksmith two towns
                over.
              </div>
              <div className="cat-foot">
                <span className="cat-price">$640</span>
                <span className="cat-meta">8 wk lead</span>
              </div>
            </div>
          </Link>

          <Link href="/shop/the-ridge-bench" className="cat-card">
            <div className="cat-img">
              <span className="cat-num">№ 03-09</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.bench} alt="Oak entryway bench" />
            </div>
            <div className="cat-info">
              <div className="cat-spec">
                Seating · Oak · One of one
              </div>
              <div className="cat-name">The Ridge Bench</div>
              <div className="cat-desc">
                A 7ft entryway bench in quarter-sawn white oak, splayed
                legs through wedged tenons, no metal fasteners anywhere
                in the piece.
              </div>
              <div className="cat-foot">
                <span className="cat-price">$2,200</span>
                <span className="cat-meta">12 wk lead</span>
              </div>
            </div>
          </Link>

          <Link
            href="/shop/three-leg-workshop-stool"
            className="cat-card"
          >
            <div className="cat-img">
              <span className="cat-num">№ 04-22</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.stool} alt="Workshop stool" />
            </div>
            <div className="cat-info">
              <div className="cat-spec">
                Seating · Walnut · Edition of 12
              </div>
              <div className="cat-name">
                Three-Leg Workshop Stool
              </div>
              <div className="cat-desc">
                A study in less. Three legs, one seat, a turned spindle
                stretcher. Twenty-one inches tall. Stackable.
                Surprisingly comfortable.
              </div>
              <div className="cat-foot">
                <span className="cat-price">$420</span>
                <span className="cat-meta">In stock</span>
              </div>
            </div>
          </Link>
        </div>
        <div style={{ textAlign: "center", marginTop: "3rem" }}>
          <Link href="/shop" className="btn btn-outline">
            See all twelve pieces →
          </Link>
        </div>
      </section>

      {/* Maker's note — cinematic image + blockquote */}
      <section className="makers-note">
        <div
          className="mn-img"
          style={{
            backgroundImage: `url('${img.maker}')`,
          }}
        />
        <div className="mn-text">
          <div className="mn-eyebrow">— A Note from the Bench</div>
          <blockquote>
            &ldquo;I mill from <span>felled-on-site</span> timber
            because it&apos;s the only way to know what a tree was
            doing before it became a table.&rdquo;
          </blockquote>
          <p>
            The slab on the Lower Hollow Table came from a black
            walnut that was already a century old when Josh and Abigail
            bought this land in 2023. A hard winter storm took it down
            soon after. We milled it on a portable bandsaw in the barn
            that week and air-dried it under cover until the workshop
            opened in 2025.
          </p>
          <p>
            That&apos;s a hundred-year story attached to one piece of
            furniture, and I think you can feel it when you sit down at
            the table.
          </p>
          <div className="mn-sig">— George · The Workshop</div>
        </div>
      </section>

      {/* Wood library — current stock by species */}
      <section
        className="catalog"
        style={{
          background: "var(--parchment-soft)",
          maxWidth: "100%",
          margin: 0,
        }}
      >
        <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
          <div className="cat-header">
            <h2>
              The Wood Library —<br />
              <span>What&apos;s curing now.</span>
            </h2>
            <div className="meta">
              Four species · 8 lots
              <br />
              Updated monthly
            </div>
          </div>
          <div className="wood-grid">
            <div className="wood-card">
              <div className="wood-name">Black Walnut</div>
              <div className="wood-latin">Juglans nigra</div>
              <div className="wood-meta">
                3 slabs · Air-drying yr 2–3
              </div>
              <div className="wood-meta">
                Felled lower hollow, 2024
              </div>
            </div>
            <div className="wood-card cherry">
              <div className="wood-name">Black Cherry</div>
              <div className="wood-latin">Prunus serotina</div>
              <div className="wood-meta">
                6 boards · Air-drying yr 1–2
              </div>
              <div className="wood-meta">
                North windbreak, 2024
              </div>
            </div>
            <div className="wood-card amber">
              <div className="wood-name">White Oak</div>
              <div className="wood-latin">Quercus alba</div>
              <div className="wood-meta">
                12 boards · Quarter-sawn
              </div>
              <div className="wood-meta">
                Salvaged barn beam, 2025
              </div>
            </div>
            <div className="wood-card pine">
              <div className="wood-name">Eastern White Pine</div>
              <div className="wood-latin">Pinus strobus</div>
              <div className="wood-meta">
                Wide stock · Air-dried 1yr
              </div>
              <div className="wood-meta">
                Land-clearing, 2025
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
