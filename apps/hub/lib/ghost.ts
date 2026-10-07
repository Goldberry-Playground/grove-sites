import { createGhostClient, type GhostClient } from "@grove/ghost-client";

/**
 * Server-side Ghost client for the village hub.
 *
 * V0: the hub journal pulls from one Ghost instance shared across the village.
 * The vendors' own blogs live on each sister site; this is the village-level
 * journal.
 *
 * Deliberately a factory rather than a module-level const (as the nursery's
 * `lib/ghost.ts` is): the two journal routes read `HUB_GHOST_*` at request
 * time, so a value injected after boot still lands. It also keeps both routes
 * on ONE copy of the config — they had diverged into two near-identical inline
 * `ghost()` helpers, which is how a URL fix lands on one route and not the
 * other (GOL-2803).
 *
 * Kept out of `clients.ts` so a page that only needs Ghost doesn't drag in the
 * Odoo client's import-time env validation.
 */
export function ghost(): GhostClient {
  return createGhostClient({
    ghostUrl: process.env.HUB_GHOST_URL ?? "http://localhost:2368",
    contentKey: process.env.HUB_GHOST_CONTENT_API_KEY ?? "",
  });
}
