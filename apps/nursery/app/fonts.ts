import { Fraunces, IBM_Plex_Mono, Newsreader } from "next/font/google";

/**
 * The storefront's three faces, self-hosted through next/font.
 *
 * They used to load from a render-blocking fonts.googleapis.com stylesheet in
 * the layout <head>: one cross-origin CSS request, then the woff2 files from a
 * second origin (fonts.gstatic.com), all before first paint. Lighthouse
 * (mobile, prod, 2026-10-20) put that chain at ~850 ms of render-blocking
 * time on every page. next/font downloads the same Google files at BUILD time,
 * serves them from this origin with immutable caching, inlines the @font-face
 * rules, and preloads only the display face (Fraunces, ~66 KB) that the
 * above-the-fold headings paint in.
 *
 * Axes and styles match the old URL: Fraunces roman with the opsz axis,
 * Newsreader roman + italic with opsz, IBM Plex Mono 400. Subset is latin only:
 * next/font preloads every listed subset, and latin-ext doubled the preloads
 * (6 woff2) for glyphs the English catalog never uses; latin already covers
 * accented names (é, ñ), curly quotes, dashes, € and U+2212. The CSS variables
 * feed the --grove-font-*
 * tokens in globals.css, so every existing `font-display` / `font-sans` /
 * `font-mono` user is unchanged.
 */
export const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
  variable: "--font-nf-fraunces",
});

// Body face: NOT preloaded. Roman + italic are ~270 KB of woff2, and on a
// throttled mobile link three preloaded faces (~340 KB) queued ahead of the
// hero image and cost ~2 s of LCP (Lighthouse A/B, 2026-10-20). Body copy
// paints at once in the metric-matched fallback and swaps when the face lands.
export const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  display: "swap",
  preload: false,
  variable: "--font-nf-newsreader",
});

// Mono is a small accent face (prices, codes), never the first paint, so it is
// not preloaded: preloading it would compete with the LCP image on slow links.
export const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  preload: false,
  variable: "--font-nf-plex-mono",
});

/** Classes that define the three --font-nf-* variables; set on <html>. */
export const fontVariables = `${fraunces.variable} ${newsreader.variable} ${plexMono.variable}`;
