import { Fraunces, IBM_Plex_Mono, Newsreader } from "next/font/google";

/**
 * The editorial trio — Fraunces (display), Newsreader (body), IBM Plex Mono
 * (labels) — self-hosted through next/font. ONE copy, shared by nursery, hub
 * and ggg (`import { fontVariables } from "@grove/ui/fonts/editorial"`); the
 * three apps used to carry byte-identical `app/fonts.ts` files (GOL-3479).
 * Goldberry has its own faces (Libre Baskerville) in `apps/goldberry/app/fonts.ts`.
 *
 * next/font is happy to be called from a workspace package as long as the app
 * lists it in `transpilePackages` (all four do for @grove/ui). The loader runs at
 * BUILD time: it downloads the woff2 files from Google once, serves them from
 * the app's own origin with immutable caching, inlines the @font-face rules
 * (including a metric-matched "<Face> Fallback" so the swap does not shift
 * layout), and preloads only the display face that above-the-fold headings
 * paint in. ⚠️ That download means `next build` — local, CI, and the Docker
 * image builds — needs egress to fonts.googleapis.com / fonts.gstatic.com; see
 * the Dockerfiles and README "Production Build".
 *
 * They used to load from a render-blocking fonts.googleapis.com stylesheet in
 * the layout <head>: one cross-origin CSS request, then the woff2 files from a
 * second origin (fonts.gstatic.com), all before first paint. Lighthouse
 * (mobile, prod, 2026-10-20) put that chain at ~850 ms of render-blocking
 * time on every page.
 *
 * Axes and styles match the old URL: Fraunces roman with the opsz axis,
 * Newsreader roman + italic with opsz, IBM Plex Mono 400. Subset is latin only:
 * next/font preloads every listed subset, and latin-ext doubled the preloads
 * (6 woff2) for glyphs the English catalog never uses; latin already covers
 * accented names (é, ñ), curly quotes, dashes, € and U+2212.
 *
 * Wiring: `fontVariables` goes on <html>; it defines --font-nf-fraunces /
 * --font-nf-newsreader / --font-nf-plex-mono. Each app's globals.css points
 * the --grove-font-display / -body / -mono roles at those variables, and every
 * other font token (Tailwind --font-*, the hub's --font-*) reads the role —
 * never the literal family name, which would skip the metric fallback face.
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
