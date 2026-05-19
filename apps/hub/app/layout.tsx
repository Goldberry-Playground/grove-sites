import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

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
      <body>
        <header className="hub-header">
          <Link href="/" className="hub-header__brand">
            Gather at the Grove
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
            <p>A federated village of independent Appalachian agroforestry makers.</p>
          </div>
          <nav>
            <Link href="/marketplace">Marketplace</Link>
            <Link href="/journal">Journal</Link>
            <Link href="/about">About</Link>
          </nav>
          <p className="hub-footer__small">
            © 2026 Gather at the Grove · The hub never takes a cut.
          </p>
        </footer>
      </body>
    </html>
  );
}
