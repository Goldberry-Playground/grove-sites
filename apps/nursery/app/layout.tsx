import type { Metadata } from "next";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { siblingSitesForHost, GroveProviders, FooterContact } from "@grove/ui";
import { SiblingStrip, CaptureForm, CaptureSlot } from "@grove/ui-kit";
import { tenantConfig } from "../tenant.config";
import {
  SITE_URL,
  DEFAULT_OG_IMAGE,
  DEFAULT_OG_IMAGE_WIDTH,
  DEFAULT_OG_IMAGE_HEIGHT,
  DEFAULT_OG_IMAGE_ALT,
} from "../lib/site-metadata";
import { Providers } from "./providers";
import { CartNavLink } from "./cart-nav-link";
import { NavLink } from "./nav-link";
import { SupportChat } from "./support-chat";
import "./globals.css";

// Site-wide metadata defaults (GOL-2878 Phase 1).
//
// `metadataBase` was unset in every storefront, which is why `<link
// rel="canonical">` and `og:url` could not resolve: Next silently drops a
// relative URL in either field without it. Everything below is a DEFAULT —
// routes override `title`/`description`/`openGraph` per page.
//
// Deliberately NOT set here: `alternates.canonical` and `openGraph.url`. Both
// are inherited by any route that does not set its own, so a value in the root
// layout would point every page's canonical at the homepage — the classic
// self-inflicted duplicate-content bug. Each page supplies its own.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    // 22 chars of suffix against a ~60-char target leaves each page ~38. Every
    // staged PDP title fits inside that, so no route needs `title.absolute`.
    default: tenantConfig.name,
    template: `%s | ${tenantConfig.name}`,
  },
  description: tenantConfig.description,
  openGraph: {
    type: "website",
    siteName: tenantConfig.name,
    locale: "en_US",
    title: {
      default: tenantConfig.name,
      template: `%s | ${tenantConfig.name}`,
    },
    description: tenantConfig.description,
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: DEFAULT_OG_IMAGE_WIDTH,
        height: DEFAULT_OG_IMAGE_HEIGHT,
        alt: DEFAULT_OG_IMAGE_ALT,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: {
      default: tenantConfig.name,
      template: `%s | ${tenantConfig.name}`,
    },
    description: tenantConfig.description,
    images: [DEFAULT_OG_IMAGE],
  },
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
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..700&family=Newsreader:ital,opsz,wght@0,6..72,400..600;1,6..72,400..600&family=IBM+Plex+Mono:wght@400&display=swap"
        />
      </head>
      <body
        className="min-h-screen bg-background text-foreground font-sans antialiased"
        data-tenant={tenantConfig.tenantId}
      >
        <GroveProviders>
        <SiblingStrip currentSiteName="At The Grove Nursery" sites={sites} />
        <Providers>
          <header className="border-b border-primary/10 px-6 py-4">
            <nav className="mx-auto flex max-w-6xl items-center justify-between">
              <Link href="/" className="text-xl font-bold font-display text-primary">
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
          <footer className="mt-auto border-t border-primary/10 px-6 py-8 text-sm text-ink-soft">
            <div className="mx-auto flex max-w-6xl flex-col items-center gap-6">
              {/* Nursery logo, centered atop the footer like Goldberry's
                  brand-footer__logo; the header keeps the text name. */}
              <Image
                src="/brand/nursery-logo-horizontal.png"
                alt={tenantConfig.name}
                width={900}
                height={261}
                // The source is 900px so DPR 3 has real detail to draw on, but
                // without `sizes` next/image falls back to a 1x/2x density
                // srcset off the `width` prop and hands a 1x screen the whole
                // 900px file. Describing the clamp instead lets the optimizer
                // pick per rung: ~384px at 1x, 640 at DPR 2, 900 at DPR 3.
                // 26vw crosses the clamp floor at 846px and the cap at 1154px.
                sizes="(max-width: 846px) 220px, (min-width: 1154px) 300px, 26vw"
                className="h-auto w-[clamp(220px,26vw,300px)]"
              />
              {/* One-CTA-per-page (GOL-2178): the shared footer newsletter is the
                  lowest-priority capture tier, so it renders ONLY when the page
                  registers nothing higher-priority (a restock/state capture).
                  Homepage keeps it because nothing higher applies — GOL-931
                  superseded by generalisation, not reverted. */}
              <CaptureSlot priority="newsletter">
                <CaptureForm
                  brand="nursery"
                  source="footer"
                  label="nursery-general"
                  eyebrow="Newsletter"
                  heading="News from the nursery"
                  description="New tree stock, growing tips for Appalachian ground, and a note when something's ready to plant. A few emails a season, not a flood."
                  submitLabel="Sign up"
                  successMessage="Thanks — you'll hear from us when there's something worth sending."
                  consentText="Unsubscribe anytime."
                  layout="inline"
                  hubOptIn
                />
              </CaptureSlot>
              <FooterContact
                phone={tenantConfig.contact.phone}
                email={tenantConfig.contact.email}
                className="text-center"
              />
              <p className="text-center">
                &copy; {new Date().getFullYear()} {tenantConfig.legalName}. All rights reserved.
              </p>
            </div>
          </footer>
        </Providers>
        </GroveProviders>
        <SupportChat />
      </body>
    </html>
  );
}
