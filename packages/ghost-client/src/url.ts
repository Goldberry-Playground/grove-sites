// URL builder for Ghost Content API requests.
// Extracted from client.ts so it can be unit-tested without spinning up
// fetch mocks. The function is pure: same inputs → same string.

import type { GhostConfig } from "./types";

export function buildUrl(
  config: GhostConfig,
  resource: string,
  params: Record<string, string | number | undefined> = {},
): string {
  const base = `${config.ghostUrl}/ghost/api/content/${resource}`;
  const searchParams = new URLSearchParams();
  searchParams.set("key", config.contentKey);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  }

  return `${base}/?${searchParams.toString()}`;
}
