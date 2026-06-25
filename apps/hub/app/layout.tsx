import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { SiblingStrip } from "./sibling-strip";

export const metadata: Metadata = {
  title: {
    template: "%s — Gather at the Grove",
    default: "Gather at the Grove — Appalachian agroforestry village",
  },
  description:
    "A federated marketplace for Appalachian agroforestry — three sister farms on one West Virginia hillside, plus the journal about why this matters.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
        <SiblingStrip currentSiteName="Gather at the Grove" />
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
            <a href="https://goldberrygrove.farm">Goldberry Grove Farm</a>
            <a href="https://woodworkingeorge.com">GGG Woodworking</a>
            <a href="https://atthegrovenursery.com">At The Grove Nursery</a>
          </nav>
          <p className="hub-footer__small">
            © 2026 Gather at the Grove · The hub never takes a cut.
          </p>
        </footer>
      </body>
    </html>
  );
}
