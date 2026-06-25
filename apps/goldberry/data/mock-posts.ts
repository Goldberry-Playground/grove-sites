// Temporary journal entries for the blog page.
//
// REMOVE ONCE GHOST IS LIVE — these objects exist so the journal renders
// against real-looking content while Ghost CMS is still being set up.
// The Post shape here matches @grove/ghost-client `Post`, so swapping back
// to Ghost is a straight `ghost.posts.list()` call.

import type { Post } from "@grove/ghost-client";

const author = {
  id: "a-1",
  name: "Josh Dunbar",
  slug: "josh",
  bio: null,
  profileImage: null,
  url: "https://goldberrygrove.farm/about",
};

export const mockPosts: Post[] = [
  {
    id: "p-1",
    uuid: "mock-uuid-1",
    title: "First Chestnuts of the Season",
    slug: "first-chestnuts-2026",
    html: "<p>The Colossal chestnuts started dropping Tuesday morning.</p>",
    excerpt:
      "The Colossal chestnuts started dropping Tuesday morning. We picked up four bushels before noon — the burrs split clean this year, which means the summer drought actually helped.",
    featureImage:
      "https://images.unsplash.com/photo-1508193638397-1c4234db14d8?w=1200&auto=format&fit=crop&q=80",
    published_at: "2026-10-14T08:00:00.000Z",
    updated_at: "2026-10-14T08:00:00.000Z",
    authors: [author],
    tags: [
      { id: "t-1", name: "Chestnuts", slug: "chestnuts", description: null },
      { id: "t-2", name: "Harvest", slug: "harvest", description: null },
    ],
    reading_time: 4,
  },
  {
    id: "p-2",
    uuid: "mock-uuid-2",
    title: "Why We Ferment Our Own Fertilizer",
    slug: "jadam-knf-inputs",
    html: "<p>JADAM and Korean Natural Farming changed everything.</p>",
    excerpt:
      "JADAM and Korean Natural Farming changed everything about how we feed the soil. Here's the setup — fermentation barrels, indigenous microorganisms, and the brown rice vinegar nobody tells you about.",
    featureImage:
      "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1200&auto=format&fit=crop&q=80",
    published_at: "2026-09-22T08:00:00.000Z",
    updated_at: "2026-09-22T08:00:00.000Z",
    authors: [author],
    tags: [
      { id: "t-3", name: "Soil", slug: "soil", description: null },
      { id: "t-4", name: "Methods", slug: "methods", description: null },
    ],
    reading_time: 7,
  },
  {
    id: "p-3",
    uuid: "mock-uuid-3",
    title: "Pawpaw Season Is Two Weeks Long",
    slug: "pawpaw-window",
    html: "<p>If you've never tasted a pawpaw, you have about fourteen days.</p>",
    excerpt:
      "If you've never tasted a pawpaw, you have about fourteen days to find one. They don't ship, they don't store, and they taste like banana custard crossed with a mango. Here's when to come.",
    featureImage:
      "https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?w=1200&auto=format&fit=crop&q=80",
    published_at: "2026-09-02T08:00:00.000Z",
    updated_at: "2026-09-02T08:00:00.000Z",
    authors: [author],
    tags: [
      { id: "t-5", name: "Pawpaw", slug: "pawpaw", description: null },
      { id: "t-2", name: "Harvest", slug: "harvest", description: null },
    ],
    reading_time: 3,
  },
  {
    id: "p-4",
    uuid: "mock-uuid-4",
    title: "Planting a Chestnut–Hazelnut Alley",
    slug: "chestnut-hazelnut-alley",
    html: "<p>The alley cropping layout we use.</p>",
    excerpt:
      "The alley cropping layout we use puts chestnuts 40 feet apart with hazelnuts filling the midstory. The chestnuts won't bear for eight years — the hazelnuts pay the bills in the meantime.",
    featureImage:
      "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=1200&auto=format&fit=crop&q=80",
    published_at: "2026-04-10T08:00:00.000Z",
    updated_at: "2026-04-10T08:00:00.000Z",
    authors: [author],
    tags: [
      { id: "t-1", name: "Chestnuts", slug: "chestnuts", description: null },
      { id: "t-6", name: "Agroforestry", slug: "agroforestry", description: null },
    ],
    reading_time: 6,
  },
];
