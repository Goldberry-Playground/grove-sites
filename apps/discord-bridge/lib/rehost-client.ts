/**
 * rehost-client.ts — the bridge front door's client for the social-media
 * re-host (GOL-1122, parent GOL-1119).
 *
 * The re-host seam ({@link import("./ingest.ts").rehostToMediaAsset}) needs
 * native `sharp` (the EXIF/GPS strip) and Spaces credentials, neither of which
 * can run in the zero-dependency bridge. So the seam runs in the hub
 * (`apps/hub/app/api/assets/social`) and the bridge forwards the raw operator
 * drop over ONE bearer-authed multipart HTTP call and receives the finished,
 * validated {@link MediaAsset} back. This module is the only new bridge code the
 * drop → re-host → `content_suggestion.media` path needs, and it stays zero-dep
 * (global `fetch`/`FormData`/`Blob`).
 */
import type { IgPostType, MediaAsset, MediaSource, MediaType } from "./media.ts";
import { readMediaAsset } from "./media.ts";

/** A raw operator drop, before re-host. Mirrors the hub `/api/assets/social` body. */
export interface RawDrop {
  /** The raw file bytes (fetched from the Discord CDN / Drive by the caller). */
  bytes: Uint8Array;
  /** Original filename — the hub infers/validates the content-type from it. */
  filename: string;
  /** The media kind the operator declares. Cross-checked by the hub. */
  declaredType: MediaType;
  /** Provenance for analytics/attribution. */
  source: MediaSource;
  /** IG surface; defaults to "post" server-side. "reel" requires a video. */
  igPostType?: IgPostType;
  /** Accessibility + brand alt text (recommended). */
  altText?: string;
}

export interface RehostClientConfig {
  /** Hub base URL, e.g. `https://gatheringatthegrove.com` (no trailing slash needed). */
  hubBaseUrl: string;
  /** Shared bearer presented to the hub (same token as `/api/assets/optimize`). */
  token: string;
}

export class RehostClientError extends Error {
  constructor(message: string) {
    super(`social-rehost: ${message}`);
    this.name = "RehostClientError";
  }
}

/**
 * Read the re-host client config from the environment. The hub URL and the
 * shared bearer are injected into the bridge's deploy env (GOL-1124). The bearer
 * is the SAME token the AgenticOS `#assets` ingest presents to
 * `/api/assets/optimize` (`GROVE_ASSETS_OPTIMIZE_TOKEN`) — a shared-secret copy,
 * not a new credential (see GOL-1123).
 */
export function rehostClientConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): RehostClientConfig {
  const hubBaseUrl = (env.GROVE_ASSETS_HUB_URL ?? "").trim().replace(/\/+$/, "");
  const token = (env.GROVE_ASSETS_OPTIMIZE_TOKEN ?? "").trim();
  if (!hubBaseUrl) {
    throw new RehostClientError("missing required env GROVE_ASSETS_HUB_URL");
  }
  if (!token) {
    throw new RehostClientError("missing required env GROVE_ASSETS_OPTIMIZE_TOKEN");
  }
  return { hubBaseUrl, token };
}

/**
 * Re-host a raw operator drop to a durable public https URL via the hub and
 * return the validated {@link MediaAsset} — ready for `content_suggestion.media`.
 *
 * Throws {@link RehostClientError} on a transport/HTTP failure or if the hub
 * returns a body that does not validate as a {@link MediaAsset} (fail loud at
 * re-host time, never silently at Buffer publish time). Injectable `fetch` for
 * unit tests.
 */
export async function rehostViaHub(
  drop: RawDrop,
  config: RehostClientConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<MediaAsset> {
  const meta = {
    declaredType: drop.declaredType,
    source: drop.source,
    filename: drop.filename,
    ...(drop.igPostType ? { igPostType: drop.igPostType } : {}),
    ...(drop.altText ? { altText: drop.altText } : {}),
  };
  const form = new FormData();
  form.set("meta", JSON.stringify(meta));
  // Cast: BlobPart accepts Uint8Array at runtime; the DOM lib typing is narrow.
  form.set("file", new Blob([drop.bytes as BlobPart]), drop.filename);

  let res: Response;
  try {
    res = await fetchImpl(`${config.hubBaseUrl}/api/assets/social`, {
      method: "POST",
      headers: { authorization: `Bearer ${config.token}` },
      body: form,
    });
  } catch (err) {
    throw new RehostClientError(
      `hub request failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!res.ok) {
    let detail = "";
    try {
      detail = JSON.stringify(await res.json());
    } catch {
      /* body may be empty/non-JSON */
    }
    throw new RehostClientError(`hub returned ${res.status}${detail ? ` ${detail}` : ""}`);
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new RehostClientError("hub returned a non-JSON body");
  }
  const asset = readMediaAsset(body);
  if (!asset) {
    throw new RehostClientError("hub returned a body that is not a valid MediaAsset");
  }
  return asset;
}
