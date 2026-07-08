import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Grove Component QA",
  description: "Self-hosted component review for the Grove design system.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
