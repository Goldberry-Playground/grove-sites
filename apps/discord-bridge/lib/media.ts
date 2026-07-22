/**
 * Media-asset contract for Instagram content_suggestion drafts (GOL-718).
 *
 * Source of truth: GOL-716 (CMO, Sora) media-source contract —
 *  - source: Canva export (default) or manual-attach farm photo; Sora/AI rejected.
 *  - IG post type defaults to `post`; `reel` requires a video asset; `story` opt-in.
 *  - OPTIONAL per suggestion: when absent, IG stays a skipped-but-audited target
 *    (GOL-714) and Threads still drafts.
 *
 * IMPORTANT (GOL-716 impl note): `media.url` MUST already be a durable, publicly
 * fetchable https URL — Buffer pulls the asset by URL at schedule/publish time,
 * potentially long after drafting. Do NOT hand this a short-lived signed Canva
 * export URL (the ones carrying `X-Amz-Expires`); the suggestion producer must
 * re-host the export to our asset store first. {@link validateMediaAsset} rejects
 * obvious short-lived signed URLs so the failure is loud at suggestion time, not
 * silent at Buffer publish time.
 */

/** The media kinds Buffer/IG accept. `type` constrains the valid `igPostType`. */
export type MediaType = "image" | "video";
/** Provenance, for analytics/attribution (GOL-716 §1). */
export type MediaSource = "canva" | "manual";
/** Instagram post surface Buffer targets. */
export type IgPostType = "post" | "reel" | "story";

/** Per-suggestion media asset (GOL-716 §4). Optional on a content_suggestion. */
export interface MediaAsset {
  /** Durable, publicly-fetchable https URL (Buffer fetches by URL at publish). */
  url: string;
  /** Asset kind; constrains which `igPostType` values are valid. */
  type: MediaType;
  /** Where the asset came from. */
  source: MediaSource;
  /** IG surface; defaults to "post". "reel" requires `type:"video"`. */
  igPostType: IgPostType;
  /** Accessibility + brand alt text (recommended, not required). */
  altText?: string;
}

const MEDIA_TYPES: readonly MediaType[] = ["image", "video"];
const MEDIA_SOURCES: readonly MediaSource[] = ["canva", "manual"];
const IG_POST_TYPES: readonly IgPostType[] = ["post", "reel", "story"];

/** Reject query strings that mark a short-lived signed (e.g. Canva/S3) URL. */
const SHORT_LIVED_URL_MARKERS = ["X-Amz-Expires", "X-Amz-Signature", "Expires=", "Signature="];

class MediaContractError extends Error {
  constructor(message: string) {
    super(`content_suggestion.media: ${message}`);
    this.name = "MediaContractError";
  }
}

/**
 * Validate + normalise a raw media object against the GOL-716 contract.
 * Throws {@link MediaContractError} on any violation (fail loud in the CLI, not
 * later at Buffer). Returns a fully-defaulted {@link MediaAsset} (igPostType
 * defaulted to "post"). Pass `undefined`/`null` through as `undefined` — media
 * is optional and its absence is the text-only / IG-skip path, not an error.
 */
export function validateMediaAsset(raw: unknown): MediaAsset | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "object") throw new MediaContractError("must be an object when present");
  const o = raw as Record<string, unknown>;

  const url = typeof o.url === "string" ? o.url.trim() : "";
  if (!url) throw new MediaContractError("`url` is required and must be a non-empty string");
  if (!/^https:\/\//i.test(url)) throw new MediaContractError("`url` must be an https:// URL");
  if (SHORT_LIVED_URL_MARKERS.some((m) => url.includes(m))) {
    throw new MediaContractError(
      "`url` looks like a short-lived signed export URL (e.g. a raw Canva export); " +
        "re-host the asset to a durable public URL before attaching it — Buffer fetches by URL at publish time",
    );
  }

  const type = o.type;
  if (!MEDIA_TYPES.includes(type as MediaType)) {
    throw new MediaContractError(`\`type\` must be one of ${MEDIA_TYPES.join(", ")}`);
  }
  const source = o.source;
  if (!MEDIA_SOURCES.includes(source as MediaSource)) {
    throw new MediaContractError(`\`source\` must be one of ${MEDIA_SOURCES.join(", ")} (Sora/AI is not a source)`);
  }

  const igPostType: IgPostType =
    o.igPostType === undefined || o.igPostType === null ? "post" : (o.igPostType as IgPostType);
  if (!IG_POST_TYPES.includes(igPostType)) {
    throw new MediaContractError(`\`igPostType\` must be one of ${IG_POST_TYPES.join(", ")}`);
  }
  if (igPostType === "reel" && type !== "video") {
    throw new MediaContractError("`igPostType:\"reel\"` requires `type:\"video\"`");
  }

  const altText = typeof o.altText === "string" && o.altText.trim() ? o.altText.trim() : undefined;

  return { url, type: type as MediaType, source: source as MediaSource, igPostType, altText };
}

/**
 * Lenient decode for card round-trips: same rules as {@link validateMediaAsset}
 * but returns `undefined` on any problem instead of throwing. The suggestion CLI
 * already validated strictly at post time, so a mangled/absent media field on a
 * decoded card degrades gracefully to the IG-skip path — a decision must never
 * throw because a card field got garbled.
 */
export function readMediaAsset(raw: unknown): MediaAsset | undefined {
  try {
    return validateMediaAsset(raw);
  } catch {
    return undefined;
  }
}
