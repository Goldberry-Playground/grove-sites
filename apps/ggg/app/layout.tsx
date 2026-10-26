import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { siblingSitesForHost, GroveProviders, FooterContact } from "@grove/ui";
import { SiblingStrip } from "@grove/ui-kit";
import { tenantConfig } from "../tenant.config";
import { SITE_OPEN_GRAPH, SITE_TWITTER, SITE_URL } from "../lib/site-metadata";
import { Providers } from "./providers";
import { resolveAnalyticsConfig } from "@grove/analytics/server";
import { CartNavLink } from "./cart-nav-link";
import { NavLink } from "./nav-link";
import "./globals.css";
import { fontVariables } from "@grove/ui/fonts/editorial";

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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const host = (await headers()).get("host");
  // RUM/analytics config, resolved from the container runtime env per request
  // (NOT NEXT_PUBLIC_*, which bakes at image build) and handed to the client.
  const analyticsConfig = resolveAnalyticsConfig(process.env);
  const sites = siblingSitesForHost(host);
  return (
    // Fonts are self-hosted via next/font (@grove/ui/fonts/editorial); the old render-blocking
    // fonts.googleapis.com <link> cost ~850 ms before first paint on mobile.
    <html lang="en" className={fontVariables}>
      <body
        className="min-h-screen bg-background text-foreground font-sans
          antialiased"
        data-tenant={tenantConfig.tenantId}
      >
        <GroveProviders>
        <SiblingStrip currentSiteName="GGG Woodworking" sites={sites} />
        <Providers analyticsConfig={analyticsConfig}>
          <header className="border-b border-primary/10 px-6 py-4">
            <nav
              className="mx-auto flex max-w-6xl items-center
                justify-between"
            >
              <Link
                href="/"
                className="text-xl font-bold font-display text-primary"
              >
                {tenantConfig.name}
              </Link>
              <ul className="flex gap-6 text-sm font-medium">
                <li>
                  <NavLink href="/shop">Shop</NavLink>
                </li>
                <li>
                  <NavLink href="/blog">Blog</NavLink>
                </li>
                <li>
                  <CartNavLink />
                </li>
              </ul>
            </nav>
          </header>
          <main>{children}</main>
          <footer className="site-footer">
            <div className="footer-inner">
              <div className="footer-brand">
                <span className="footer-logo">
                  {tenantConfig.name}
                </span>
                <p className="footer-tagline">
                  Handcrafted hardwood furniture · Appalachian WV
                </p>
              </div>
              <div className="footer-col">
                <strong>Workshop</strong>
                <span>By appointment only</span>
                <span>Greenbrier Valley, WV</span>
              </div>
              <div className="footer-col">
                <strong>Materials</strong>
                <span>Black walnut · Cherry</span>
                <span>White oak · Ash</span>
              </div>
              <div className="footer-col">
                <strong>Lead times</strong>
                <span>Small pieces: 4–8 weeks</span>
                <span>Furniture: 10–16 weeks</span>
              </div>
              <div className="footer-col">
                <strong>Contact</strong>
                <FooterContact
                  phone={tenantConfig.contact.phone}
                  email={tenantConfig.contact.email}
                  className="footer-contact"
                />
              </div>
            </div>
            <div className="footer-copy">
              <p>
                &copy; {new Date().getFullYear()}{" "}
                {tenantConfig.legalName}. All rights reserved.
              </p>
            </div>
          </footer>
        </Providers>
        </GroveProviders>
      </body>
    </html>
  );
}
