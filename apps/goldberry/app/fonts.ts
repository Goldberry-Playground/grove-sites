import { IBM_Plex_Mono, Libre_Baskerville } from "next/font/google";

/**
 * Goldberry's faces, self-hosted through next/font.
 *
 * They used to load from a render-blocking fonts.googleapis.com stylesheet in
 * the layout <head>: a cross-origin CSS request, then the woff2 files from
 * fonts.gstatic.com, all before first paint (~850 ms of render-blocking time in
 * Lighthouse mobile on goldberry.qa, 2026-10-20). next/font downloads the same
 * files at BUILD time, serves them from this origin, inlines the @font-face
 * rules and preloads the faces that paint first.
 *
 * Libre Baskerville is the free substitute for the brand's licensed Baskerville
 * Classico (see the theme tokens). All four faces are real users, not just the
 * three the old Google URL named: 400 / 700 roman and 400 italic everywhere,
 * and 700 italic for the semibold-italic headings (`.about-family h2`,
 * `.about-vision h2`, the home page's `.story-strip-card h3` — all weight 600
 * italic, which resolves to the 700 italic face). Dropping it would make the
 * browser fake-bold the 400 italic on those headings. It also costs nothing:
 * Google now serves Libre Baskerville as two variable files (roman + italic,
 * wght 400–700), so 400 and 700 of a style share one woff2 (GOL-3479).
 * Latin only: next/font preloads every listed subset.
 *
 * The nursery / hub / ggg trio lives in @grove/ui/fonts/editorial; this file
 * stays app-local because no other tenant uses these faces.
 */
export const libreBaskerville = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-nf-libre-baskerville",
});

// Mono is a small accent face (eyebrows, SKU tags), never the first paint, so
// it is not preloaded: preloading it would compete with the LCP image.
export const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  preload: false,
  variable: "--font-nf-plex-mono",
});

/** Classes that define the --font-nf-* variables; set on <html>. */
export const fontVariables = `${libreBaskerville.variable} ${plexMono.variable}`;
