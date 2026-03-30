/**
 * Shared Tailwind CSS v4 design tokens for the Grove ecosystem.
 *
 * In Tailwind v4 configuration is done via CSS, but we export
 * the token definitions here for programmatic access and as
 * the source of truth for the design system.
 */

export const groveColors = {
  /** Hub — gatheringatthegrove.com */
  hub: {
    50: "#f0fdf4",
    100: "#dcfce7",
    200: "#bbf7d0",
    300: "#86efac",
    400: "#4ade80",
    500: "#22c55e",
    600: "#16a34a",
    700: "#15803d",
    800: "#166534",
    900: "#14532d",
    950: "#052e16",
  },
  /** Goldberry — goldberrygrove.farm */
  goldberry: {
    50: "#fffbeb",
    100: "#fef3c7",
    200: "#fde68a",
    300: "#fcd34d",
    400: "#fbbf24",
    500: "#f59e0b",
    600: "#d97706",
    700: "#b45309",
    800: "#92400e",
    900: "#78350f",
    950: "#451a03",
  },
  /** GGG — Gathering Grove Gardens */
  ggg: {
    50: "#f0f9ff",
    100: "#e0f2fe",
    200: "#bae6fd",
    300: "#7dd3fc",
    400: "#38bdf8",
    500: "#0ea5e9",
    600: "#0284c7",
    700: "#0369a1",
    800: "#075985",
    900: "#0c4a6e",
    950: "#082f49",
  },
  /** Nursery — plant nursery storefront */
  nursery: {
    50: "#fdf2f8",
    100: "#fce7f3",
    200: "#fbcfe8",
    300: "#f9a8d4",
    400: "#f472b6",
    500: "#ec4899",
    600: "#db2777",
    700: "#be185d",
    800: "#9d174d",
    900: "#831843",
    950: "#500724",
  },
} as const;

export const groveFontFamily = {
  sans: ["Inter", "system-ui", "sans-serif"],
  display: ["Playfair Display", "Georgia", "serif"],
  mono: ["JetBrains Mono", "Fira Code", "monospace"],
} as const;

/**
 * CSS custom properties string that can be injected into a global stylesheet.
 * Use with Tailwind v4's @theme directive or a plain <style> tag.
 */
export function groveCSSTokens(tenant: "hub" | "goldberry" | "ggg" | "nursery"): string {
  const palette = groveColors[tenant];
  return Object.entries(palette)
    .map(([shade, hex]) => `  --grove-${tenant}-${shade}: ${hex};`)
    .join("\n");
}
