import type { Metadata } from "next";
import "./globals.css";
import { fontVariables } from "@grove/ui/fonts/editorial";
import { AnalyticsProvider } from "@grove/analytics";
import { resolveAnalyticsConfig } from "@grove/analytics/server";
import { GroveProviders } from "@grove/ui";
import { SITE_OPEN_GRAPH, SITE_TWITTER, SITE_URL } from "../lib/site-metadata";

// Site-wide metadata defaults (GOL-3585). `metadataBase` makes relative
// canonicals / og:url / og:image resolve. No `alternates.canonical` or
// `openGraph.url` here — inherited, they would canonicalise every page to the
// homepage. Each indexable page sets its own via `pageMetadata()`.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  openGraph: SITE_OPEN_GRAPH,
  twitter: SITE_TWITTER,
  title: {
    template: "%s — Gather at the Grove",
    default: "Gather at the Grove — Appalachian agroforestry village",
  },
  description:
    "A federated marketplace for Appalachian agroforestry — three sister farms on one West Virginia hillside, plus the journal about why this matters.",
};

// Document shell only. The hub chrome (sibling strip, header, footer) lives in
// app/(site)/layout.tsx so a standalone page like /links (app/(bare)/links)
// can render without it. Route groups don't change any URL.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  // RUM/analytics config, resolved from the container runtime env (NOT
  // NEXT_PUBLIC_*, which bakes at image build). Ships inert until RUM_* is set.
  // NOTE: this layout is not currently dynamic, so switching hub on later also
  // needs it opted into per-request rendering (GOL-2330 switch-on step).
  const analyticsConfig = resolveAnalyticsConfig(process.env);
  return (
    // Fonts are self-hosted via next/font (@grove/ui/fonts/editorial); the old render-blocking
    // fonts.googleapis.com <link> cost ~850 ms before first paint on mobile.
    <html lang="en" className={fontVariables}>
      <body>
        <GroveProviders>
        <AnalyticsProvider config={analyticsConfig} />
        {children}
        </GroveProviders>
      </body>
    </html>
  );
}
