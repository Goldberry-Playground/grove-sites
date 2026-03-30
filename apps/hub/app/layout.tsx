import type { Metadata } from "next";
import Link from "next/link";
import { tenantConfig } from "../tenant.config";
import "./globals.css";

export const metadata: Metadata = {
  title: tenantConfig.name,
  description: tenantConfig.description,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className="min-h-screen bg-background text-foreground font-sans antialiased"
        data-tenant={tenantConfig.tenantId}
      >
        <header className="border-b border-primary/10 px-6 py-4">
          <nav className="mx-auto flex max-w-6xl items-center justify-between">
            <Link href="/" className="text-xl font-bold font-display text-primary">
              {tenantConfig.name}
            </Link>
          </nav>
        </header>
        <main>{children}</main>
        <footer className="mt-auto border-t border-primary/10 px-6 py-8 text-center text-sm text-foreground/60">
          <p>&copy; {new Date().getFullYear()} {tenantConfig.name}. All rights reserved.</p>
        </footer>
      </body>
    </html>
  );
}
