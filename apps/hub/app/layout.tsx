import type { Metadata } from "next";
import "./globals.css";
import { fontVariables } from "@grove/ui/fonts/editorial";
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
    // Fonts are self-hosted via next/font (@grove/ui/fonts/editorial); the old render-blocking
    // fonts.googleapis.com <link> cost ~850 ms before first paint on mobile.
    <html lang="en" className={fontVariables}>
      <body>
        <GroveProviders>
        <AnalyticsProvider />
        {children}
        </GroveProviders>
      </body>
    </html>
  );
}
