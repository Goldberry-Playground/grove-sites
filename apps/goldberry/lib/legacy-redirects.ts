import type { NextConfig } from "next";

type Redirect = Awaited<ReturnType<NonNullable<NextConfig["redirects"]>>>[number];

// The old goldberrygrove.farm was a Ghost site: posts at /<slug>/, pages at
// /consulting, /education, /nursery, archives at /tag/* and /author/*. Its
// content moved to blog.goldberrygrove.farm on 2026-10-29 and the storefront
// lists it under /blog. Plan: gather-at-the-grove
// docs/superpowers/plans/2026-10-22-legacy-ghost-farm-migration.md (Task 0
// rulings, Task 6).
//
// The slug list is explicit on purpose. A catch-all `/:slug` would turn every
// storefront 404 into a blog 404 and could shadow future routes. It is the
// migrated set exactly: 29 old posts minus `coming-soon`, which was dropped
// because its body was a "content being restored" placeholder.
export const LEGACY_POST_SLUGS = [
  "april-mutual-aid",
  "beyond-the-hose-engineering-resilient-irrigation",
  "cracking-the-code-of-community",
  "december-download-sawmills-software-hazelnuts",
  "goldberry-grove-end-of-the-dog-days-of-summer",
  "goldberry-grove-ides-of-march",
  "it-takes-a-village-to-raise-a-child",
  "january-frozen-ground-moving-plans",
  "layer-by-layer-designing-a-stacked-orchard",
  "mycoforestry-101-trees-fungi-and-the-art-of-growing-together",
  "navigating-appalachia-orchard-planning",
  "navigating-the-agroforestry-grant-process-a-first-generation-farmers-guide",
  "november-at-goldberry-grove",
  "october-settles-in-golden-leaves-and-chestnut-dreams",
  "planting-a-vision-at-goldberry-grove",
  "planting-the-seeds-of-progress-starting-a-farming-llc-and-growing-with-community-resources",
  "planting-without-a-mask-why-i-started-goldberry-grove",
  "pollarding-vs-coppicing-two-ancient-techniques-powering-modern-agroforestry",
  "rethinking-regenerative-a-permaculture-syntropic-hybrid",
  "soil-prep-mulch-and-planning",
  "solar-at-goldberry-grove-powering-resilience-not-just-panels",
  "summers-building-for-the-future",
  "the-boring-side-of-farming",
  "the-orchard-that-refuses-to-obey",
  "the-peoples-nut-that-fed-appalachia",
  "the-uncertainty-of-the-moment-agroforestry-and-the-long-road-ahead",
  "the-unexpected-education-of-a-first-time-korean-farmer",
  "tree-planting-tree-care",
] as const;

export function legacyRedirects(): Redirect[] {
  return [
    ...LEGACY_POST_SLUGS.map((slug) => ({ source: `/${slug}`, destination: `/blog/${slug}`, permanent: true })),
    { source: "/coming-soon", destination: "/blog", permanent: true },
    { source: "/tag/:tag*", destination: "/blog", permanent: true },
    { source: "/author/:author*", destination: "/blog", permanent: true },
    { source: "/rss", destination: "/blog", permanent: true },
    { source: "/education", destination: "/visit/seminars", permanent: true },
    { source: "/nursery", destination: "https://atthegrovenursery.com/", permanent: true },
    // Interim: the retail planner until the consult dashboard ships (Trains
    // 5-6). Temporary so browsers don't cache it past the repoint.
    { source: "/consulting", destination: "https://atthegrovenursery.com/plan", permanent: false },
  ];
}
