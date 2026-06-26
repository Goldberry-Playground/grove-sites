import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import "./globals.css";
import { siblingSitesForHost, GroveProviders } from "@grove/ui";
import { SiblingStrip } from "@grove/ui-kit";

export const metadata: Metadata = {
  title: {
    template: "%s — Gather at the Grove",
    default: "Gather at the Grove — Appalachian agroforestry village",
  },
  description:
    "A federated marketplace for Appalachian agroforestry — three sister farms on one West Virginia hillside, plus the journal about why this matters.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Resolve cross-tenant URLs once at the server. Same image runs in prod,
  // QA, and previews -- the request's Host header decides which URL set to
  // use. See packages/ui/src/sibling-sites.ts for the resolution logic.
  const host = (await headers()).get("host");
  const sites = siblingSitesForHost(host);
  // Cross-tenant siblings for the footer: all 4 sites minus the hub itself
  // (the hub is implicit on this page; the footer's "Marketplace / Journal /
  // About" links above already cover navigation within the hub).
  const otherSites = sites.filter((s) => s.name !== "Gather at the Grove");
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..700&family=Newsreader:ital,opsz,wght@0,6..72,400..600;1,6..72,400..600&family=IBM+Plex+Mono:wght@400&display=swap"
        />
      </head>
      <body>
        <GroveProviders>
        <SiblingStrip currentSiteName="Gather at the Grove" sites={sites} />
        <header className="hub-header">
          <Link href="/" className="hub-header__brand">
            <em>Gather</em> at the Grove
          </Link>
          <nav className="hub-header__nav">
            <Link href="/marketplace">Marketplace</Link>
            <Link href="/journal">Journal</Link>
            <Link href="/about">About</Link>
          </nav>
        </header>

        {children}

        <footer className="hub-footer">
          <div>
            <strong>Gather at the Grove</strong>
            <p>A federated village of independent Appalachian agroforestry makers. The hub never takes a cut — every checkout goes to the maker who grew it, built it, or wrote it.</p>
          </div>
          <nav>
            <Link href="/marketplace">Marketplace</Link>
            <Link href="/journal">Journal</Link>
            <Link href="/about">About</Link>
            {otherSites.map((site) => (
              <a key={site.name} href={site.href}>{site.name}</a>
            ))}
          </nav>
          <p className="hub-footer__small">
            © 2026 Gather at the Grove · The hub never takes a cut.
          </p>
        </footer>
        </GroveProviders>
      </body>
    </html>
  );
}
