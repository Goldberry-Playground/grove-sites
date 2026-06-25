import Link from "next/link";
import { CategoryBar } from "./category-bar";

// At The Grove Nursery homepage — port of wireframes/nursery/index.html.
// Sections in wireframe order: cat-bar → pano-hero → qsearch → section grid →
// with-sidebar → split-band.
//
// The category bar is now a shared server component that fetches the live
// product list (Odoo or mock) and renders counts. Clicking a pill navigates
// to /shop?cat=<slug>, which filters the catalog. On the homepage no pill is
// "active" — the bar is purely a discovery surface.
export default async function HomePage() {
  return (
    <>
      <CategoryBar />

      <section
        className="pano-hero"
        // Verified content: a spring apple orchard in full white bloom over
        // dandelion-covered grass. Sourced from Wikimedia Commons
        // (Apple_orchard_Moscow_State_University_05.JPG, CC BY-SA 3.0),
        // compressed to webp @ 1800w.
        style={{ backgroundImage: "url('/hero/spring-orchard.webp')" }}
        role="img"
        aria-label="A spring apple orchard with rows of trees in full white bloom over grass dotted with yellow dandelions."
      >
        <div className="pano-content">
          <div>
            <div className="pano-eyebrow">Bare-root season · Through March 30</div>
            <h1>
              Fruit trees, berries &amp;<br />
              edible perennials —<br />
              <em>cold-climate, hard-grown,</em><br />
              shipped at the right week.
            </h1>
          </div>
          <div className="pano-stats">
            <div className="pano-stat">
              <div className="num">328</div>
              <div className="label">Varieties in catalog</div>
            </div>
            <div className="pano-stat">
              <div className="num">USDA 3–7</div>
              <div className="label">Cold-hardy range</div>
            </div>
            <div className="pano-stat">
              <div className="num">2 yrs</div>
              <div className="label">Propagation in-house</div>
            </div>
            <div className="pano-stat">
              <div className="num">7-day</div>
              <div className="label">Bare-root ship window</div>
            </div>
          </div>
        </div>
      </section>

      <section className="qsearch">
        <h3>Find your tree.</h3>
        <div>
          <label>USDA Zone</label>
          <select defaultValue="5">
            <option value="3">Zone 3</option>
            <option value="4">Zone 4</option>
            <option value="5">Zone 5 (the default)</option>
            <option value="6">Zone 6</option>
            <option value="7">Zone 7</option>
          </select>
        </div>
        <div>
          <label>Category</label>
          <select defaultValue="apple">
            <option value="apple">Apple</option>
            <option value="pear">Pear</option>
            <option value="stone">Plum &amp; Cherry</option>
            <option value="berries">Berries</option>
            <option value="nuts">Nuts</option>
          </select>
        </div>
        <div>
          <label>Pollination</label>
          <select defaultValue="self">
            <option value="self">Self-fertile</option>
            <option value="partner">Needs partner</option>
            <option value="either">Either</option>
          </select>
        </div>
        <div>
          <label>Rootstock</label>
          <select defaultValue="standard">
            <option value="standard">Standard</option>
            <option value="semi-dwarf">Semi-dwarf</option>
            <option value="dwarf">Dwarf</option>
            <option value="bush">Bush</option>
          </select>
        </div>
        <button type="submit">Search →</button>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>Featured for this <em>bare-root window.</em></h2>
          <span className="section-tag">— Ship March 7–31</span>
        </div>
        <div className="var-grid">
          <Link href="/shop/honeycrisp-apple" className="var-card is-anchor">
            <div className="var-img">
              <span className="var-badge">★ Editor's pick</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/products/honeycrisp-apple.webp"
                alt="A single ripe red-and-yellow Honeycrisp apple, stem intact, on a white studio background."
                loading="lazy"
              />
            </div>
            <div className="var-info">
              <div className="var-latin">Malus domestica</div>
              <div className="var-name">Honeycrisp Apple</div>
              <div className="var-specs">
                <div><strong>Zone</strong> 3-7</div>
                <div><strong>Bloom</strong> Mid</div>
                <div><strong>Harvest</strong> Late Sep</div>
                <div><strong>Rootstock</strong> M.111</div>
              </div>
              <div className="var-foot">
                <span className="var-price">$42</span>
                <span className="var-stock">● In stock · 64</span>
              </div>
            </div>
          </Link>

          <Link href="/shop/bartlett-pear" className="var-card">
            <div className="var-img">
              <span className="var-badge cold">Cold-hardy Z3</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/products/bartlett-pear.webp"
                alt="A close-packed pile of harvested green Bartlett pears, several with their brown stems still attached."
                loading="lazy"
              />
            </div>
            <div className="var-info">
              <div className="var-latin">Pyrus communis</div>
              <div className="var-name">Bartlett Pear</div>
              <div className="var-specs">
                <div><strong>Zone</strong> 3-8</div>
                <div><strong>Bloom</strong> Early</div>
                <div><strong>Harvest</strong> Aug</div>
                <div><strong>Rootstock</strong> OHxF 87</div>
              </div>
              <div className="var-foot">
                <span className="var-price">$38</span>
                <span className="var-stock">● In stock · 41</span>
              </div>
            </div>
          </Link>

          <Link href="/shop/montmorency-sour-cherry" className="var-card">
            <div className="var-img">
              <span className="var-badge">Heirloom</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/products/montmorency-sour-cherry.webp"
                alt="Two bright-red Montmorency sour cherries hanging from a slender stem against blurred green tree foliage."
                loading="lazy"
              />
            </div>
            <div className="var-info">
              <div className="var-latin">Prunus cerasus</div>
              <div className="var-name">Montmorency Sour Cherry</div>
              <div className="var-specs">
                <div><strong>Zone</strong> 4-7</div>
                <div><strong>Bloom</strong> Mid</div>
                <div><strong>Harvest</strong> Jul</div>
                <div><strong>Rootstock</strong> Mazzard</div>
              </div>
              <div className="var-foot">
                <span className="var-price">$46</span>
                <span className="var-stock">● Low · 8</span>
              </div>
            </div>
          </Link>

          <Link href="/shop/black-walnut-northern" className="var-card">
            <div className="var-img">
              <span className="var-badge cold">Native</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/products/black-walnut-northern.webp"
                alt="A mature Black Walnut tree in a park with thick furrowed bark and a wide spreading canopy of yellow-green compound leaves in early autumn."
                loading="lazy"
              />
            </div>
            <div className="var-info">
              <div className="var-latin">Juglans nigra</div>
              <div className="var-name">Black Walnut · Northern</div>
              <div className="var-specs">
                <div><strong>Zone</strong> 4-9</div>
                <div><strong>Mature</strong> 70 ft</div>
                <div><strong>Bears</strong> Year 8-10</div>
                <div><strong>Stock</strong> 2-yr seedling</div>
              </div>
              <div className="var-foot">
                <span className="var-price">$28</span>
                <span className="var-stock">● In stock · 112</span>
              </div>
            </div>
          </Link>

          <Link href="/shop/damson-plum-shropshire" className="var-card">
            <div className="var-img">
              <span className="var-badge">★ Editor's pick</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/products/damson-plum.webp"
                alt="A cluster of deep blue-purple Damson plums with a soft bloom, hanging on the branch among bright green leaves."
                loading="lazy"
              />
            </div>
            <div className="var-info">
              <div className="var-latin">Prunus insititia</div>
              <div className="var-name">Damson Plum · 'Shropshire'</div>
              <div className="var-specs">
                <div><strong>Zone</strong> 4-8</div>
                <div><strong>Bloom</strong> Mid</div>
                <div><strong>Harvest</strong> Sep</div>
                <div><strong>Self-fertile</strong> Yes</div>
              </div>
              <div className="var-foot">
                <span className="var-price">$44</span>
                <span className="var-stock">● In stock · 22</span>
              </div>
            </div>
          </Link>

          <Link href="/shop/concord-grape" className="var-card">
            <div className="var-img">
              <span className="var-badge cold">Cold-hardy Z3</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/products/concord-grape.webp"
                alt="Dusty-blue Concord grape clusters with morning dew on the vine, surrounded by autumn-yellow grape leaves."
                loading="lazy"
              />
            </div>
            <div className="var-info">
              <div className="var-latin">Vitis labrusca</div>
              <div className="var-name">Concord Grape</div>
              <div className="var-specs">
                <div><strong>Zone</strong> 4-8</div>
                <div><strong>Bloom</strong> Late</div>
                <div><strong>Harvest</strong> Sep-Oct</div>
                <div><strong>Stock</strong> 2-yr vine</div>
              </div>
              <div className="var-foot">
                <span className="var-price">$24</span>
                <span className="var-stock">● In stock · 56</span>
              </div>
            </div>
          </Link>
        </div>
        <div style={{ textAlign: "center", marginTop: "3rem" }}>
          <Link href="/shop" className="btn btn-forest">Browse all 82 varieties →</Link>
        </div>
      </section>

      <section className="with-sidebar">
        <div>
          <div className="section-header" style={{ marginBottom: "1.5rem" }}>
            <h2><em>How</em> we ship a fruit tree.</h2>
            <span className="section-tag">— A short field-guide</span>
          </div>
          <p style={{ fontSize: "1.05rem", marginBottom: "1.5rem", maxWidth: "60ch" }}>
            Every tree in our catalog is bare-root unless it says otherwise. We
            dig in late February when the wood is fully dormant, hold in a
            damp-sawdust cooler at 34°F, and ship in a seven-day window timed
            to your zone's last hard frost. The roots are wrapped in moist
            newspaper, the graft is sealed with horticultural wax, and a
            hand-written tag identifies the variety, rootstock, and the bed it
            was lifted from.
          </p>
          <p style={{ fontSize: "1.05rem", marginBottom: "1.5rem", maxWidth: "60ch" }}>
            Plant within ten days of arrival. Soak the roots in cool water for
            four hours before going in the ground. Don't fertilize the first
            year — let the tree spend its energy putting down roots, not
            pushing leaves it can't yet support.
          </p>
          <div style={{ display: "flex", gap: "1rem", marginTop: "2rem" }}>
            <Link href="/blog/planting-guide" className="btn btn-forest">Read the planting guide</Link>
            <Link href="/videos/bare-root" className="btn btn-outline">Watch the 4-min video</Link>
          </div>
        </div>

        <aside className="field-notes">
          <div className="field-notes-eyebrow">Field Notes — This Week</div>
          <h3>Bare-root shipping is open through March 30.</h3>
          <p>After March 30 we switch to potted stock. The same trees, just heavier to ship and less forgiving of late planting.</p>
          <ul>
            <li><span>Zone 3</span><strong>Ship Mar 22-27</strong></li>
            <li><span>Zone 4</span><strong>Ship Mar 14-20</strong></li>
            <li><span>Zone 5</span><strong>Ship Mar 7-13</strong></li>
            <li><span>Zone 6</span><strong>Now shipping</strong></li>
            <li><span>Zone 7</span><strong>Last call</strong></li>
          </ul>
        </aside>
      </section>

      <section className="split-band">
        <div
          className="split-img"
          // Verified content: honeybee perched on a pale-pink apple blossom in
          // direct sun. Sourced from Wikimedia Commons (Honey_bee_on_apple_
          // blossom_Sandy_Bedfordshire.jpg by Orangeaurochs, CC BY 2.0).
          style={{ backgroundImage: "url('/hero/pollination.webp')" }}
          role="img"
          aria-label="A honeybee resting in the center of a pale-pink apple blossom, with another open blossom in the foreground."
        />
        <div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "0.2em", color: "var(--orange)", textTransform: "uppercase" }}>
            A Note on Pollination
          </span>
          <h2>“Most fruit trees<br />are not single players.”</h2>
          <p>
            Roughly two-thirds of the catalog needs a second variety blooming
            within the same five-day window to set fruit. We tag every listing
            with its bloom period and a recommended partner from the same
            group. If you want one tree, plant a self-fertile.
          </p>
          <p>
            If the goal is a productive small orchard, we'll do the
            variety-matching for you — send us your zone, your space, and your
            harvest preferences, and we'll send back a three-tree plan and the
            partner-pollination calendar.
          </p>
          <Link href="/planting-plan" className="btn" style={{ marginTop: "1rem" }}>
            Request a planting plan →
          </Link>
        </div>
      </section>
    </>
  );
}
