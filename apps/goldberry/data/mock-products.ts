// Temporary product catalog for the storefront.
//
// REMOVE ONCE ODOO IS LIVE — these objects exist so the shop, cart, checkout,
// and success pages all render against real-looking data while the
// grove_headless Odoo backend is still being set up. The Product shape here
// matches @grove/odoo-client `Product`, so swapping back to Odoo is a
// straight `odoo.products.list()` call once the Odoo container is reachable.
//
// Catalog rebuild (2026-05-30): The site has been repositioned as an
// educational hub. We still sell value-added farm goods at /shop, so the
// lineup is now chestnut flour, freeze-dried Appalachian fruit, small-batch
// jams, an inoculation kit, and a trail-mix blend.
//
// Imagery strategy:
//   - On-farm photos where they directly fit (chestnut flour, trail mix use
//     the harvested-walnuts shot at /photos/farm-activities/activity-09.webp;
//     shiitake kit uses /photos/abigail-hazelnuts.webp as a generic harvest
//     visual since we don't have a dedicated log photo yet).
//   - Typographic SVG data URIs for the rest. These are editorial-card
//     placeholders: chestnut-reserve background, harvest-gold rule, IBM Plex
//     Mono eyebrow, Baskerville product name. Render correctly through
//     next/image with the `unoptimized` prop, and through a plain <img>
//     element. Swap out as we shoot real product photography.

import type { Product } from "@grove/odoo-client";

/**
 * Build an inline SVG data URI shaped like an editorial product card.
 * Used wherever we don't yet have a real product photograph. Returns a
 * URL-safe `data:image/svg+xml;utf8,...` string suitable for next/image
 * (with `unoptimized`) and for a plain <img>.
 */
function svgCard(opts: {
  eyebrow: string;
  title: string;
  bg?: string;
  ink?: string;
  accent?: string;
  rule?: string;
}): string {
  const bg = opts.bg ?? "#7F4F1D"; // chestnut-reserve
  const ink = opts.ink ?? "#FFF7E6"; // ivory-mist
  const accent = opts.accent ?? "#EDD682"; // harvest-gold
  const rule = opts.rule ?? accent;

  // Word-wrap the title onto up to two lines, sized to fit the 800×600 card.
  const words = opts.title.split(" ");
  const lines: string[] = [];
  if (words.length <= 2) {
    lines.push(opts.title);
  } else {
    const mid = Math.ceil(words.length / 2);
    lines.push(words.slice(0, mid).join(" "));
    lines.push(words.slice(mid).join(" "));
  }
  const titleFont = lines.some((l) => l.length > 18) ? 56 : 68;
  const lineHeight = titleFont * 1.05;
  const titleStartY = 320 - ((lines.length - 1) * lineHeight) / 2;

  const titleTspans = lines
    .map((line, i) => {
      const y = titleStartY + i * lineHeight;
      return `<tspan x='400' y='${y}'>${escapeXml(line)}</tspan>`;
    })
    .join("");

  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 600' preserveAspectRatio='xMidYMid slice'>
  <rect width='800' height='600' fill='${bg}'/>
  <rect x='40' y='40' width='720' height='520' fill='none' stroke='${accent}' stroke-opacity='0.35' stroke-width='1.5'/>
  <line x1='280' y1='200' x2='520' y2='200' stroke='${rule}' stroke-width='1.5'/>
  <text x='400' y='180' fill='${accent}' font-family='IBM Plex Mono, ui-monospace, monospace' font-size='13' letter-spacing='4' text-anchor='middle'>${escapeXml(opts.eyebrow.toUpperCase())}</text>
  <text fill='${ink}' font-family='Libre Baskerville, Baskerville, Georgia, serif' font-style='italic' font-size='${titleFont}' font-weight='600' text-anchor='middle'>${titleTspans}</text>
  <text x='400' y='500' fill='${accent}' font-family='IBM Plex Mono, ui-monospace, monospace' font-size='11' letter-spacing='6' text-anchor='middle' opacity='0.7'>GOLDBERRY GROVE · WV</text>
</svg>`;

  // Encode just enough to keep the data URI valid in CSS / src attrs.
  const encoded = svg
    .replace(/\n/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/#/g, "%23")
    .replace(/"/g, "'");
  return `data:image/svg+xml;utf8,${encoded}`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Helper: returns true if the URL is an inline data URI. The shop pages
 *  consult this to decide whether to render with next/image (HTTPS) or a
 *  plain <img> (data:). */
export function isDataUri(url: string | null | undefined): boolean {
  return !!url && url.startsWith("data:");
}

// Category IDs match the categoryName labels below; the shop layout reads
// these to drive the section nav. Keep in sync with shop/layout.tsx.
export const SHOP_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "flour", label: "Flour", categoryId: 10 },
  { id: "freeze-dried", label: "Freeze-Dried", categoryId: 11 },
  { id: "jams", label: "Jams", categoryId: 12 },
  { id: "mushrooms", label: "Mushrooms", categoryId: 13 },
] as const;

export const mockProducts: Product[] = [
  {
    id: 301,
    slug: "chestnut-flour-1lb",
    name: "Chestnut Flour",
    sku: "GG-FLR-301",
    description:
      "Stone-ground from our own chestnuts, naturally gluten-free, with a sweet nutty character and the dense crumb the Italians built whole pastry traditions on. One pound, kraft pouch. Keep refrigerated after opening.",
    seoDescription: "Gluten-free stone-ground chestnut flour, 1 lb.",
    price: 14,
    currency: "USD",
    imageUrl: "/photos/farm-activities/activity-09.webp",
    categoryId: 10,
    categoryName: "Flour",
    available: true,
    featured: true,
    variants: [
      { id: 3011, name: "1 lb pouch", sku: "GG-FLR-301-16", price: 14, available: true, imageUrl: "" },
    ],
  },
  {
    id: 302,
    slug: "freeze-dried-pawpaw",
    name: "Freeze-Dried Pawpaw",
    sku: "GG-FRT-302",
    description:
      "The native Appalachian custard fruit, picked at full ripeness and freeze-dried within hours. Tropical, banana-mango, faintly floral. Eat by the handful or rehydrate into smoothies and ice cream. Small pouch.",
    seoDescription: "Freeze-dried Appalachian pawpaw, no added sugar.",
    price: 8,
    currency: "USD",
    imageUrl: svgCard({ eyebrow: "Native Fruit · No. 02", title: "Freeze-Dried Pawpaw" }),
    categoryId: 11,
    categoryName: "Freeze-Dried",
    available: true,
    featured: true,
    variants: [
      { id: 3021, name: "0.7 oz pouch", sku: "GG-FRT-302-S", price: 8, available: true, imageUrl: "" },
    ],
  },
  {
    id: 303,
    slug: "freeze-dried-american-persimmon",
    name: "Freeze-Dried American Persimmon",
    sku: "GG-FRT-303",
    description:
      "Diospyros virginiana — the small, intensely sweet wild persimmon you only ever get to taste if you live where it grows. Picked after the first frost when the tannins have broken, freeze-dried whole. Honeyed, date-like, unlike anything in a grocery store.",
    seoDescription: "Freeze-dried American persimmon, post-frost wild harvest.",
    price: 8,
    currency: "USD",
    imageUrl: svgCard({ eyebrow: "Native Fruit · No. 03", title: "American Persimmon" }),
    categoryId: 11,
    categoryName: "Freeze-Dried",
    available: true,
    featured: false,
    variants: [
      { id: 3031, name: "0.7 oz pouch", sku: "GG-FRT-303-S", price: 8, available: true, imageUrl: "" },
    ],
  },
  {
    id: 304,
    slug: "freeze-dried-mulberries",
    name: "Freeze-Dried Mulberries",
    sku: "GG-FRT-304",
    description:
      "Black mulberries from the row along the lane — sweet, slightly winey, the berry that stains your fingers and the deck. Freeze-dried whole; the texture stays plump and the color stays inky.",
    seoDescription: "Freeze-dried black mulberries, on-farm harvest.",
    price: 7,
    currency: "USD",
    imageUrl: svgCard({ eyebrow: "Native Fruit · No. 04", title: "Freeze-Dried Mulberries" }),
    categoryId: 11,
    categoryName: "Freeze-Dried",
    available: true,
    featured: false,
    variants: [
      { id: 3041, name: "0.7 oz pouch", sku: "GG-FRT-304-S", price: 7, available: true, imageUrl: "" },
    ],
  },
  {
    id: 305,
    slug: "freeze-dried-serviceberries",
    name: "Freeze-Dried Serviceberries",
    sku: "GG-FRT-305",
    description:
      "Amelanchier, the June-bearing fruit that tastes like a blueberry crossed with an almond — the pit gives it a faint marzipan finish. A short two-week window each year. Small pouch, single-origin from our hedge row.",
    seoDescription: "Freeze-dried serviceberries (juneberries) from our hedgerow.",
    price: 9,
    currency: "USD",
    imageUrl: svgCard({ eyebrow: "Native Fruit · No. 05", title: "Freeze-Dried Serviceberries" }),
    categoryId: 11,
    categoryName: "Freeze-Dried",
    available: true,
    featured: false,
    variants: [
      { id: 3051, name: "0.7 oz pouch", sku: "GG-FRT-305-S", price: 9, available: true, imageUrl: "" },
    ],
  },
  {
    id: 306,
    slug: "freeze-dried-elderberries",
    name: "Freeze-Dried Elderberries",
    sku: "GG-FRT-306",
    description:
      "Sambucus canadensis from the wet end of the lower pasture, freeze-dried after a quick steam to soften the skins. Tart, deeply purple, traditionally infused for syrups and tonics through cold-and-flu season.",
    seoDescription: "Freeze-dried Appalachian elderberries.",
    price: 10,
    currency: "USD",
    imageUrl: svgCard({ eyebrow: "Native Fruit · No. 06", title: "Freeze-Dried Elderberries" }),
    categoryId: 11,
    categoryName: "Freeze-Dried",
    available: true,
    featured: false,
    variants: [
      { id: 3061, name: "0.7 oz pouch", sku: "GG-FRT-306-S", price: 10, available: true, imageUrl: "" },
    ],
  },
  {
    id: 307,
    slug: "appalachian-trail-mix",
    name: "Appalachian Trail Mix",
    sku: "GG-MIX-307",
    description:
      "Roasted chestnuts, freeze-dried pawpaw and mulberries, hand-cracked black walnut halves, a little flaky salt. A trail mix that tastes like our hillside — the keeping-foods of an Appalachian autumn in one pouch.",
    seoDescription: "Trail mix of chestnut, native fruit, and black walnut.",
    price: 12,
    currency: "USD",
    imageUrl: "/photos/farm-activities/activity-09.webp",
    categoryId: 11,
    categoryName: "Freeze-Dried",
    available: true,
    featured: true,
    variants: [
      { id: 3071, name: "6 oz pouch", sku: "GG-MIX-307-6", price: 12, available: true, imageUrl: "" },
    ],
  },
  {
    id: 308,
    slug: "chestnut-pawpaw-jam",
    name: "Chestnut & Pawpaw Jam",
    sku: "GG-JAM-308",
    description:
      "Our chestnut and pawpaw rendering — custardy, tropical, slightly savory from the roasted chestnut. Slow-cooked, low-sugar, no added pectin. 8 oz jar; once you open it, refrigerate and use within three weeks.",
    seoDescription: "Small-batch chestnut and pawpaw jam.",
    price: 11,
    currency: "USD",
    imageUrl: svgCard({ eyebrow: "Small-Batch · No. 08", title: "Chestnut & Pawpaw Jam" }),
    categoryId: 12,
    categoryName: "Jams",
    available: true,
    featured: false,
    variants: [
      { id: 3081, name: "8 oz jar", sku: "GG-JAM-308-8", price: 11, available: true, imageUrl: "" },
    ],
  },
  {
    id: 309,
    slug: "chestnut-mulberry-jam",
    name: "Chestnut & Mulberry Jam",
    sku: "GG-JAM-309",
    description:
      "Roasted chestnut puree married to black mulberries — deep, jammy, a little wine-dark. Spreads beautifully on toast, glazes a roast pork, finishes a cheese board. 8 oz jar, hand-labelled.",
    seoDescription: "Small-batch chestnut and black mulberry jam.",
    price: 11,
    currency: "USD",
    imageUrl: svgCard({ eyebrow: "Small-Batch · No. 09", title: "Chestnut & Mulberry Jam" }),
    categoryId: 12,
    categoryName: "Jams",
    available: true,
    featured: false,
    variants: [
      { id: 3091, name: "8 oz jar", sku: "GG-JAM-309-8", price: 11, available: true, imageUrl: "" },
    ],
  },
  {
    id: 310,
    slug: "shiitake-inoculation-kit",
    name: "Shiitake Inoculation Kit",
    sku: "GG-MSH-310",
    description:
      "Everything you need to grow shiitake mushrooms at home: a freshly cut hardwood log from our coppice thinnings, 100 plug-spawn dowels of our shiitake strain, food-grade wax for sealing, and a one-page guide. Drill, plug, wait nine months. Eat for the next four years.",
    seoDescription: "Home shiitake mushroom inoculation kit — log + spawn + wax.",
    price: 34,
    currency: "USD",
    imageUrl: svgCard({ eyebrow: "Home Cultivation · No. 10", title: "Shiitake Inoculation Kit" }),
    categoryId: 13,
    categoryName: "Mushrooms",
    available: true,
    featured: true,
    variants: [
      { id: 3101, name: "Log + 100 plugs + wax", sku: "GG-MSH-310-KIT", price: 34, available: true, imageUrl: "" },
    ],
  },
];

export function getMockProductById(id: number): Product | null {
  return mockProducts.find((p) => p.id === id) ?? null;
}

export function getMockProductBySlug(slug: string): Product | null {
  return mockProducts.find((p) => p.slug === slug) ?? null;
}
