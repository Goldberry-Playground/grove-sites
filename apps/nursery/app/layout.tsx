import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { siblingSitesForHost, GroveProviders } from "@grove/ui";
import { SiblingStrip, CaptureForm } from "@grove/ui-kit";
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
          <footer className="mt-auto border-t border-primary/10 px-6 py-8 text-sm text-foreground/60">
            <div className="mx-auto flex max-w-6xl flex-col items-center gap-6">
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
              <p className="text-center">
                &copy; {new Date().getFullYear()} {tenantConfig.name}. All rights reserved.
              </p>
            </div>
          </footer>
        </Providers>
        </GroveProviders>
      </body>
    </html>
  );
}
