import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { assetPath, siblingSitesForHost, GroveProviders, FooterContact, SocialLinks, type SocialLink } from "@grove/ui";
import { SiblingStrip, CaptureForm, CaptureSlot } from "@grove/ui-kit";
import { tenantConfig } from "../tenant.config";
import { SITE_OPEN_GRAPH, SITE_TWITTER, SITE_URL } from "../lib/site-metadata";
import { FARM_OPT_IN_LINE, POSTAL_ADDRESS_LINE } from "../lib/newsletter-copy";
import { Providers } from "./providers";
import { CartNavLink } from "./cart-nav-link";
import { NavLink } from "./nav-link";
import "./globals.css";
import { fontVariables } from "./fonts";

// Site-wide metadata defaults (GOL-3585). `metadataBase` makes relative
// canonicals / og:url / og:image resolve; without it Next emitted the relative
// `/recipes` canonical as-is. No `alternates.canonical` or `openGraph.url`
// here — inherited, they would canonicalise every page to the homepage. Each
// indexable page sets its own via `pageMetadata()`.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: tenantConfig.name,
  description: tenantConfig.description,
  openGraph: SITE_OPEN_GRAPH,
  twitter: SITE_TWITTER,
};

// Goldberry Grove's own accounts (Josh, 2026-09-30) — the same set its card on
// the hub /alliance page links to. Clean profile URLs, no tracking params.
const GOLDBERRY_SOCIALS: SocialLink[] = [
  { kind: "facebook", href: "https://www.facebook.com/goldberrygrove/" },
  { kind: "instagram", href: "https://www.instagram.com/goldberrygrove/" },
  { kind: "threads", href: "https://www.threads.com/@goldberrygrove" },
  { kind: "youtube", href: "https://www.youtube.com/@GoldberryGrove" },
];

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // See packages/ui/src/sibling-sites.ts -- cross-tenant URLs follow the
  // request's hostname so prod, QA, and previews each link to their own envs.
  const host = (await headers()).get("host");
  const sites = siblingSitesForHost(host);
  return (
    // Fonts are self-hosted via next/font (./fonts.ts); the old render-blocking
    // fonts.googleapis.com <link> cost ~850 ms before first paint on mobile.
    <html lang="en" className={fontVariables}>
      <body
        className="min-h-screen bg-background text-foreground font-sans antialiased"
        data-tenant={tenantConfig.tenantId}
      >
        {/* Sibling strip — cross-village nav. Markup mirrors ggg, hub, and
            nursery so the four sites render the same size pill row across
            every viewport. Per-site brand color tokens live in globals.css. */}
        <GroveProviders>
        <SiblingStrip currentSiteName="Goldberry Grove Farm" sites={sites} />
        <Providers>
          {/* Persistent header — typographic wordmark (transparent PNG of
              just the GOLDBERRY Grove lettering) on the left, primary nav
              on the right. Wordmark serves as home link, visible across
              every route. The full wreath logo lives on the homepage hero
              corner; the header carries only the type lockup so the brand
              identity follows the visitor through /shop, /about, etc. */}
          <header className="brand-header">
            <div className="brand-header__inner brand-header__inner--wordmark">
              <Link href="/" className="brand-header__wordmark" aria-label="Goldberry Grove — home">
                {/* Intrinsic size (the PNG is 1472x464) so the browser reserves the
                    wordmark's box before it loads; without it the header
                    collapsed and the nav below jumped (CLS 0.30 on mobile,
                    Lighthouse goldberry.qa 2026-10-20). CSS still sets the
                    rendered width; height follows the aspect ratio. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={assetPath("goldberry", "photos/logo-wordmark.png")}
                  alt="Goldberry Grove"
                  width={1472}
                  height={464}
                  fetchPriority="high"
                />
              </Link>
              <nav className="brand-header__nav" aria-label="Primary">
                <div className="nav-item has-dropdown">
                  <Link href="/visit" className="nav-item__link">Come See Us</Link>
                  {/* Plain list of links, not an ARIA menu: role="menu" promises
                      arrow-key menu behaviour this hover/focus reveal never
                      had, and audits read its menuitems as unnamed (GOL-3583). */}
                  <ul className="nav-dropdown">
                    <li>
                      <Link href="/visit/upick">
                        <span className="nav-dropdown__icon" aria-hidden>U</span>
                        <span>
                          <strong>U-Pick</strong>
                          <em>Chestnuts · pawpaws · berries, in season</em>
                        </span>
                      </Link>
                    </li>
                    <li>
                      <Link href="/visit/events">
                        <span className="nav-dropdown__icon" aria-hidden>E</span>
                        <span>
                          <strong>Public Events</strong>
                          <em>Farm-to-table, harvest weekends, JADAM workshops</em>
                        </span>
                      </Link>
                    </li>
                    <li>
                      <Link href="/visit/seminars">
                        <span className="nav-dropdown__icon" aria-hidden>S</span>
                        <span>
                          <strong>Educational Seminars</strong>
                          <em>Native plant ID · grafting · KNF deep-dives</em>
                        </span>
                      </Link>
                    </li>
                    <li>
                      <Link href="/visit/private">
                        <span className="nav-dropdown__icon" aria-hidden>P</span>
                        <span>
                          <strong>Book a Private Event</strong>
                          <em>Weddings · retreats · family gatherings</em>
                        </span>
                      </Link>
                    </li>
                  </ul>
                </div>
                {/* Flat primary-nav links now use the shared @grove/ui-kit
                    <NavLink> (active state via aria-current + focus-visible
                    ring). Goldberry's signature header treatment — mono-caps
                    with the gold underline-slide — is preserved by the
                    app-local `.brand-header__nav > a` rules in globals.css,
                    which out-specify the shared component's base styles. The
                    "Come See Us" dropdown trigger stays app-local (ui-kit
                    NavLink has no dropdown affordance). — GOL-137 */}
                <NavLink href="/shop">Shop</NavLink>
                <NavLink href="/recipes">Recipes</NavLink>
                <NavLink href="/about">Our Story</NavLink>
                <NavLink href="/blog">Journal</NavLink>
                <span className="brand-header__cart"><CartNavLink /></span>
              </nav>
            </div>
          </header>
          <main>{children}</main>
          {/* Farm newsletter, site-wide (GOL-3456). Odoo "Farm News" is the list
              of record; the spec's farm primary line exists for exactly this
              form. A light band above the chestnut footer so the shared
              CaptureForm renders in brand tokens without re-theming. The
              newsletter tier yields to a page's own capture (blog TreeFacts,
              events) through the capture arbiter, so no page shows two
              newsletter forms. */}
          <CaptureSlot priority="newsletter">
            <section className="brand-newsletter" aria-labelledby="brand-newsletter-heading">
              <div className="brand-newsletter__inner">
                <CaptureForm
                  brand="goldberry"
                  source="footer"
                  label="goldberry-general"
                  eyebrow="Newsletter"
                  heading="News from the farm"
                  optInLine={FARM_OPT_IN_LINE}
                  submitLabel="Sign up"
                  layout="inline"
                  multibrandOptIn
                  className="brand-newsletter__form"
                />
              </div>
            </section>
          </CaptureSlot>
          <footer className="brand-footer">
            <div className="brand-footer__inner">
              {/* Black-and-white Goldberry Grove logo per brand guide
                  "Logomark" / dark-background usage. The wordmark is already
                  inside the mark so no separate text. A 400 px transparent PNG
                  (29 KB): the mark renders at ≤ 200 CSS px (see
                  .brand-footer__logo), so that is 2× for retina. It replaced a
                  1.3 MB "SVG" that was a Canva export wrapping a 3000 px
                  raster — no vector source exists (GOL-3479). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={assetPath("goldberry", "photos/logo-bw.png")}
                alt="Goldberry Grove"
                width={400}
                height={400}
                loading="lazy"
                decoding="async"
                className="brand-footer__logo"
              />
              <SocialLinks links={GOLDBERRY_SOCIALS} owner="Goldberry Grove" ringed className="brand-footer__social" />
              <FooterContact
                phone={tenantConfig.contact.phone}
                email={tenantConfig.contact.email}
                address={POSTAL_ADDRESS_LINE}
                privacyHref="/privacy"
                className="brand-footer__contact"
              />
              <p className="brand-footer__small">
                &copy; {new Date().getFullYear()} {tenantConfig.name}. All rights reserved.
              </p>
            </div>
          </footer>
        </Providers>
        </GroveProviders>
      </body>
    </html>
  );
}
