// Temporary woodworking catalog for the storefront.
//
// REMOVE ONCE ODOO IS LIVE — these objects exist so the shop, cart, checkout,
// and success pages all render against real-looking data while the
// grove_headless Odoo backend is still being set up. The Product shape here
// matches @grove/odoo-client `Product`, so swapping back to Odoo is a
// straight `odoo.products.list()` call once the Odoo container is reachable.

import type { Product } from "@grove/odoo-client";

export const mockProducts: Product[] = [
  {
    id: 301,
    slug: "walnut-dining-table",
    name: "Walnut Dining Table",
    sku: "GGG-TBL-001",
    description:
      "Eight-foot live-edge black walnut slab on hand-turned cherry trestle legs. Book-matched from a single trunk felled in Pocahontas County. Seats 8 comfortably, 10 if you pull the bench in. Finished with tung oil, not poly.",
    seoDescription: "Live-edge black walnut dining table, 8ft, seats 8.",
    price: 4200,
    currency: "USD",
    imageUrl: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=1200&auto=format&fit=crop&q=80",
    categoryId: 21,
    categoryName: "Tables",
    available: true,
    featured: true,
    variants: [
      { id: 3011, name: "8ft slab", sku: "GGG-TBL-001-8", price: 4200, available: true, imageUrl: "" },
    ],
  },
  {
    id: 302,
    slug: "cherry-rocking-chair",
    name: "Cherry Rocking Chair",
    sku: "GGG-CHR-002",
    description:
      "Steam-bent cherry rocker with hand-woven hickory bark seat. The design is a Greenbrier Valley pattern — George's grandmother had one on her porch since 1962. 12-week lead time, each one numbered.",
    seoDescription: "Steam-bent cherry rocking chair, hand-woven hickory seat.",
    price: 1850,
    currency: "USD",
    imageUrl: "https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=1200&auto=format&fit=crop&q=80",
    categoryId: 22,
    categoryName: "Seating",
    available: true,
    featured: true,
    variants: [
      { id: 3021, name: "Standard", sku: "GGG-CHR-002-S", price: 1850, available: true, imageUrl: "" },
    ],
  },
  {
    id: 303,
    slug: "white-oak-bookshelf",
    name: "White Oak Bookshelf",
    sku: "GGG-SHL-003",
    description:
      "Quarter-sawn white oak with through-tenon joinery — no fasteners, no glue on the frame. Five adjustable shelves. The ray fleck pattern on quarter-sawn oak is the whole point; each one looks different.",
    seoDescription: "Quarter-sawn white oak bookshelf, through-tenon joinery.",
    price: 2400,
    currency: "USD",
    imageUrl: "https://images.unsplash.com/photo-1594620302200-9a762244a156?w=1200&auto=format&fit=crop&q=80",
    categoryId: 23,
    categoryName: "Storage",
    available: true,
    featured: false,
    variants: [
      { id: 3031, name: "5-shelf", sku: "GGG-SHL-003-5", price: 2400, available: true, imageUrl: "" },
    ],
  },
  {
    id: 304,
    slug: "maple-cutting-board",
    name: "Maple End-Grain Cutting Board",
    sku: "GGG-KIT-004",
    description:
      "Hard maple end-grain board with cherry and walnut accent stripes. 18×14×2 inches. End-grain is self-healing — the knife pushes the fibers apart rather than cutting them. Oiled with food-grade mineral oil.",
    seoDescription: "Hard maple end-grain cutting board, 18x14 inches.",
    price: 185,
    currency: "USD",
    imageUrl: "https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?w=1200&auto=format&fit=crop&q=80",
    categoryId: 24,
    categoryName: "Kitchen",
    available: true,
    featured: false,
    variants: [
      { id: 3041, name: "18×14", sku: "GGG-KIT-004-L", price: 185, available: true, imageUrl: "" },
    ],
  },
  {
    id: 305,
    slug: "ash-workbench",
    name: "Ash Split-Top Workbench",
    sku: "GGG-BNC-005",
    description:
      "Roubo-style split-top bench in white ash with a maple wagon vise and leg vise. 7ft working surface, 34 inches high. This is the bench George uses in his own shop — we build yours to match your height.",
    seoDescription: "Roubo split-top workbench, white ash, custom height.",
    price: 3600,
    currency: "USD",
    imageUrl: "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=1200&auto=format&fit=crop&q=80",
    categoryId: 25,
    categoryName: "Workshop",
    available: true,
    featured: true,
    variants: [
      { id: 3051, name: "7ft, custom height", sku: "GGG-BNC-005-7", price: 3600, available: true, imageUrl: "" },
    ],
  },
  {
    id: 306,
    slug: "walnut-jewelry-box",
    name: "Walnut Jewelry Box",
    sku: "GGG-ACC-006",
    description:
      "Black walnut box with hand-cut dovetails and a figured maple lid panel. Flocked interior, brass quadrant hinges. Small enough for a dresser, large enough for a lifetime collection.",
    seoDescription: "Black walnut jewelry box, hand-cut dovetails.",
    price: 340,
    currency: "USD",
    imageUrl: "https://images.unsplash.com/photo-1513519245088-0e12902e35ca?w=1200&auto=format&fit=crop&q=80",
    categoryId: 26,
    categoryName: "Accessories",
    available: true,
    featured: false,
    variants: [
      { id: 3061, name: "Standard", sku: "GGG-ACC-006-S", price: 340, available: true, imageUrl: "" },
    ],
  },
];

export function getMockProductById(id: number): Product | null {
  return mockProducts.find((p) => p.id === id) ?? null;
}

export function getMockProductBySlug(slug: string): Product | null {
  return mockProducts.find((p) => p.slug === slug) ?? null;
}
