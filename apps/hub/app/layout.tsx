import type { Metadata } from "next";
import "./globals.css";
import { AnalyticsProvider } from "@grove/analytics";
import { GroveProviders } from "@grove/ui";

export const metadata: Metadata = {
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
        <AnalyticsProvider />
        {children}
        </GroveProviders>
      </body>
    </html>
  );
}
