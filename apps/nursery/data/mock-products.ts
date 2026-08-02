// Temporary tree / plant catalog for the storefront.
//
// REMOVE ONCE ODOO IS LIVE — these objects exist so the shop, cart, checkout,
// and success pages all render against real-looking data while the
// grove_headless Odoo backend is still being set up. The Product shape here
// matches @grove/odoo-client `Product`, so swapping back to Odoo is a
// straight `odoo.products.list()` call once the Odoo container is reachable.
//
// Images: served from /public/products/*.webp (next/image accepts absolute
// paths without a remotePatterns entry). Each photo was visually verified to
// depict the labelled variety before being committed — the previous Unsplash
// IDs in this file rendered unrelated photos (bear, oranges, river) under
// product names, which broke screen-reader trust as well as visual matching.

import type { Product, ProductCategory } from "@grove/odoo-client";

const mockProductsBase: Product[] = [
  {
    id: 201,
    slug: "honeycrisp-apple",
    name: "Honeycrisp Apple",
    sku: "GN-APL-001",
    description:
      "The dessert apple that pretends to be a cooking apple. Crisp, juicy, sweet-tart, and shockingly cold-hardy. Grafted onto M.111 semi-dwarf rootstock — 12-15ft mature, bears in year 3-4, harvests in late September.",
    seoDescription: "Honeycrisp apple, bare-root, grafted on M.111.",
    // Guide-ready fixture: exercises the Odoo `website_description` guide path
    // (GOL-1024). `guideReady: true` opens the gate; the HTML mirrors what Odoo's
    // eCommerce Description editor emits so the rendered prose can be verified.
    guideReady: true,
    websiteDescription:
      "<h3>Planting your Honeycrisp</h3><p>Set the graft union 2-3 inches above the soil line and water deeply the day you plant. Bare-root whips establish fastest when they go in while still dormant, late fall through early spring.</p><ul><li><strong>Zones:</strong> 3-7, needs 800-1000 chill hours.</li><li><strong>Pollination:</strong> not self-fertile — pair with a Bartlett or a crabapple within 50 feet.</li><li><strong>Spacing:</strong> 12-15 feet on M.111 semi-dwarf rootstock.</li></ul><p>Expect the first real crop in year three or four. Thin fruit to one apple per cluster in June for larger, sweeter fruit.</p>",
    price: 42,
    currency: "USD",
    imageUrl: "/products/honeycrisp-apple.webp",
    categoryId: 11,
    categoryName: "Apple varieties",
    tags: ["apple", "bare-root"],
    available: true,
    featured: true,
    variants: [
      // Grafted on M.111 per this product's own copy — carries the rootstock
      // axis so the dev/preview fallback exercises the GOL-1112 metadata pill.
      { id: 2011, name: "Bare-root, 4-5ft whip", sku: "GN-APL-001-BR", price: 42, available: true, imageUrl: "", rootstock: "M.111" },
    ],
  },
  {
    id: 202,
    slug: "bartlett-pear",
    name: "Bartlett Pear",
    sku: "GN-PER-002",
    description:
      "The grocery-store standard for a reason — productive, disease-resistant, easy to grow. Zones 3-8, blooms early, harvests in August. Needs a pollination partner (we ship one with every order over $200, on request).",
    seoDescription: "Bartlett pear, cold-hardy bare-root on OHxF 87.",
    price: 38,
    currency: "USD",
    imageUrl: "/products/bartlett-pear.webp",
    categoryId: 12,
    categoryName: "Pears & quince",
    tags: ["pear", "bare-root"],
    available: true,
    featured: false,
    variants: [
      { id: 2021, name: "Bare-root, 4-5ft whip", sku: "GN-PER-002-BR", price: 38, available: true, imageUrl: "", rootstock: "OHxF 87" },
    ],
  },
  {
    id: 203,
    slug: "montmorency-sour-cherry",
    name: "Montmorency Sour Cherry",
    sku: "GN-CHR-003",
    description:
      "The pie cherry. Bright, tart, self-fertile (so one tree will fruit on its own). Mature 15-20ft on Mazzard rootstock, harvests in July. The honey-bees come from three farms over the week it blooms.",
    seoDescription: "Montmorency sour cherry, self-fertile.",
    price: 46,
    currency: "USD",
    imageUrl: "/products/montmorency-sour-cherry.webp",
    categoryId: 13,
    categoryName: "Stone fruit",
    tags: ["stone", "bare-root"],
    available: true,
    featured: true,
    variants: [
      { id: 2031, name: "Bare-root, 3-4ft branched", sku: "GN-CHR-003-BR", price: 46, available: true, imageUrl: "" },
    ],
  },
  {
    id: 204,
    slug: "black-walnut-northern",
    name: "Black Walnut · Northern",
    sku: "GN-NUT-004",
    description:
      "Eastern native, allelopathic — give it space and don't plant tomatoes underneath. Mature 70ft, bears nuts in year 8-10, lives a century. We sell a 2-year potted seedling. This is a hundred-year decision.",
    seoDescription: "Northern black walnut seedling, 2-year potted.",
    price: 28,
    currency: "USD",
    imageUrl: "/products/black-walnut-northern.webp",
    categoryId: 14,
    categoryName: "Nuts & hardwood",
    tags: ["nuts"],
    available: true,
    featured: false,
    variants: [
      { id: 2041, name: "2-year potted seedling", sku: "GN-NUT-004-P2", price: 28, available: true, imageUrl: "" },
    ],
  },
  {
    id: 205,
    slug: "damson-plum-shropshire",
    name: "Damson Plum · 'Shropshire'",
    sku: "GN-PLM-005",
    description:
      "A small, intensely-flavored European plum bred for jam and damson gin. Self-fertile, disease-resistant, hard-to-find at any nursery — and easy to love. Bears in year 3, harvests mid-September.",
    seoDescription: "Shropshire damson plum, heirloom European variety.",
    price: 44,
    currency: "USD",
    imageUrl: "/products/damson-plum.webp",
    categoryId: 13,
    categoryName: "Stone fruit",
    tags: ["stone", "bare-root"],
    available: true,
    featured: true,
    variants: [
      { id: 2051, name: "Bare-root, 3-4ft whip", sku: "GN-PLM-005-BR", price: 44, available: true, imageUrl: "" },
    ],
  },
  {
    id: 206,
    slug: "concord-grape",
    name: "Concord Grape",
    sku: "GN-VIN-006",
    description:
      "The Welch's grape, but with a serious second life as a fresh-eating variety. Cold-hardy to zone 4, vigorous, productive — one mature vine produces 15-20 pounds in a good year. 2-year vine, ready to plant on a trellis.",
    seoDescription: "Concord grape vine, 2-year, cold-hardy.",
    price: 24,
    currency: "USD",
    imageUrl: "/products/concord-grape.webp",
    categoryId: 15,
    categoryName: "Berries & vines",
    tags: ["berries"],
    available: true,
    featured: false,
    variants: [
      { id: 2061, name: "2-year vine", sku: "GN-VIN-006-V2", price: 24, available: true, imageUrl: "" },
    ],
  },
  {
    id: 207,
    slug: "m111-apple-rootstock",
    name: "M.111 Apple Rootstock",
    sku: "GN-RST-007",
    description:
      "Semi-dwarf apple rootstock — graft your own scion in spring. Cold-hardy, drought-tolerant, supports a 12-15ft mature tree. Ships bare-root in February-March. Sold in bundles of 5.",
    seoDescription: "M.111 apple rootstock bundle, bare-root for grafting.",
    price: 32,
    currency: "USD",
    imageUrl: "/products/honeycrisp-apple.webp",
    categoryId: 16,
    categoryName: "Rootstock",
    // M.111 is apple-family rootstock, ships bare-root. Tagging "apple" too so
    // it appears for users browsing the apple section who want to graft their own.
    tags: ["apple", "rootstock", "bare-root"],
    available: true,
    featured: false,
    variants: [
      { id: 2071, name: "Bundle of 5, bare-root", sku: "GN-RST-007-B5", price: 32, available: true, imageUrl: "" },
    ],
  },
  {
    id: 208,
    slug: "cold-stratified-walnut-seed",
    name: "Cold-Stratified Walnut Seed",
    sku: "GN-SED-008",
    description:
      "Eastern black walnut seed pre-treated with 90 days of cold stratification — sow immediately on receipt in late winter. 25-nut bag, 70-80% germination expected on properly-sited beds. Long-game tree planting.",
    seoDescription: "Cold-stratified Eastern black walnut seed, 25-nut bag.",
    price: 18,
    currency: "USD",
    imageUrl: "/products/black-walnut-northern.webp",
    categoryId: 17,
    categoryName: "Seed",
    tags: ["nuts", "cold-strat"],
    available: true,
    featured: false,
    variants: [
      { id: 2081, name: "25-nut bag", sku: "GN-SED-008-B25", price: 18, available: true, imageUrl: "" },
    ],
  },
];

// Website (public) categories — the browse taxonomy the real catalog carries on
// `Product.categories` (Josh's five use-type buckets, GOL-658; slugs are
// `slugify(name)`). The demo set predates that field, so we derive a category
// from each product's legacy plant-type tag: this keeps the /shop cat-bar counts
// honest when Odoo is unreachable and the page falls back to this data, instead
// of showing every pill at `· 0`. REMOVE with the rest of this file once Odoo is
// the only source.
const DEMO_CATEGORIES: Record<string, ProductCategory> = {
  "fruit-trees": { id: 1, name: "Fruit Trees", slug: "fruit-trees" },
  berries: { id: 2, name: "Berries", slug: "berries" },
  "fruiting-vines": { id: 3, name: "Fruiting Vines", slug: "fruiting-vines" },
  "nut-trees": { id: 4, name: "Nut Trees", slug: "nut-trees" },
};

const TAG_TO_CATEGORY: Record<string, keyof typeof DEMO_CATEGORIES> = {
  apple: "fruit-trees",
  pear: "fruit-trees",
  stone: "fruit-trees", // cherry, plum, persimmon
  rootstock: "fruit-trees", // fruit-tree rootstock
  nuts: "nut-trees",
  berries: "fruiting-vines", // the only "berries" item in the demo set is Concord Grape (a vine)
  // "bare-root" / "cold-strat" are product forms, not use-types — intentionally unmapped.
};

function deriveCategories(tags: string[] | undefined): ProductCategory[] {
  const keys = new Set<keyof typeof DEMO_CATEGORIES>();
  for (const tag of tags ?? []) {
    const key = TAG_TO_CATEGORY[tag];
    if (key) keys.add(key);
  }
  return [...keys].map((key) => DEMO_CATEGORIES[key]);
}

export const mockProducts: Product[] = mockProductsBase.map((product) => ({
  ...product,
  categories: product.categories ?? deriveCategories(product.tags),
}));

export function getMockProductById(id: number): Product | null {
  return mockProducts.find((p) => p.id === id) ?? null;
}

export function getMockProductBySlug(slug: string): Product | null {
  return mockProducts.find((p) => p.slug === slug) ?? null;
}
