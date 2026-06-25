import type { Metadata } from "next";
import Link from "next/link";
import { tenantConfig } from "../tenant.config";
import { Providers } from "./providers";
import { CartNavLink } from "./cart-nav-link";
import { SiblingStrip } from "./sibling-strip";
import "./globals.css";

export const metadata: Metadata = {
  title: tenantConfig.name,
  description: tenantConfig.description,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Goldberry Brand Guideline (Feb 2026): Baskerville Classico, semibold.
            Baskerville Classico is a paid URW family — Libre Baskerville
            is the free Google Fonts substitute. IBM Plex Mono retained for
            small editorial labels (eyebrows, SKU tags) where mono reads
            better than serif italic. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Mono:wght@400&display=swap"
        />
      </head>
      <body
        className="min-h-screen bg-background text-foreground font-sans antialiased"
        data-tenant={tenantConfig.tenantId}
      >
        {/* Sibling strip — cross-village nav. Markup mirrors ggg, hub, and
            nursery so the four sites render the same size pill row across
            every viewport. Per-site brand color tokens live in globals.css. */}
        <SiblingStrip currentSiteName="Goldberry Grove Farm" />
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/photos/logo-wordmark.png" alt="Goldberry Grove" />
              </Link>
              <nav className="brand-header__nav" aria-label="Primary">
                <div className="nav-item has-dropdown">
                  <Link href="/visit" className="nav-item__link">Come See Us</Link>
                  <ul className="nav-dropdown" role="menu" aria-label="Come See Us">
                    <li role="none">
                      <Link href="/visit/upick" role="menuitem">
                        <span className="nav-dropdown__icon" aria-hidden>U</span>
                        <span>
                          <strong>U-Pick</strong>
                          <em>Chestnuts · pawpaws · berries, in season</em>
                        </span>
                      </Link>
                    </li>
                    <li role="none">
                      <Link href="/visit/events" role="menuitem">
                        <span className="nav-dropdown__icon" aria-hidden>E</span>
                        <span>
                          <strong>Public Events</strong>
                          <em>Farm-to-table, harvest weekends, JADAM workshops</em>
                        </span>
                      </Link>
                    </li>
                    <li role="none">
                      <Link href="/visit/seminars" role="menuitem">
                        <span className="nav-dropdown__icon" aria-hidden>S</span>
                        <span>
                          <strong>Educational Seminars</strong>
                          <em>Native plant ID · grafting · KNF deep-dives</em>
                        </span>
                      </Link>
                    </li>
                    <li role="none">
                      <Link href="/visit/private" role="menuitem">
                        <span className="nav-dropdown__icon" aria-hidden>P</span>
                        <span>
                          <strong>Book a Private Event</strong>
                          <em>Weddings · retreats · family gatherings</em>
                        </span>
                      </Link>
                    </li>
                  </ul>
                </div>
                <Link href="/shop" className="nav-item__link">Shop</Link>
                <Link href="/about" className="nav-item__link">Our Story</Link>
                <Link href="/blog" className="nav-item__link">Journal</Link>
                <span className="brand-header__cart"><CartNavLink /></span>
              </nav>
            </div>
          </header>
          <main>{children}</main>
          <footer className="brand-footer">
            <div className="brand-footer__inner">
              {/* Black-and-white Goldberry Grove logo per brand guide
                  "Logomark" / dark-background usage. The wordmark is
                  already inside this SVG so no separate text. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/photos/logo-bw.svg"
                alt="Goldberry Grove"
                className="brand-footer__logo"
              />
              <p className="brand-footer__small">
                &copy; {new Date().getFullYear()} {tenantConfig.name}. All rights reserved.
              </p>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
