import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { siblingSitesForHost, GroveProviders } from "@grove/ui";
import { SiblingStrip } from "@grove/ui-kit";
import { tenantConfig } from "../tenant.config";
import { Providers } from "./providers";
import { CartNavLink } from "./cart-nav-link";
import { NavLink } from "./nav-link";
import "./globals.css";

export const metadata: Metadata = {
  title: tenantConfig.name,
  description: tenantConfig.description,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const host = (await headers()).get("host");
  const sites = siblingSitesForHost(host);
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..700&family=Newsreader:ital,opsz,wght@0,6..72,400..600;1,6..72,400..600&family=IBM+Plex+Mono:wght@400&display=swap"
        />
      </head>
      <body
        className="min-h-screen bg-background text-foreground font-sans
          antialiased"
        data-tenant={tenantConfig.tenantId}
      >
        <GroveProviders>
        <SiblingStrip currentSiteName="GGG Woodworking" sites={sites} />
        <Providers>
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
            </div>
            <div className="footer-copy">
              <p>
                &copy; {new Date().getFullYear()}{" "}
                {tenantConfig.name}. All rights reserved.
              </p>
            </div>
          </footer>
        </Providers>
        </GroveProviders>
      </body>
    </html>
  );
}
