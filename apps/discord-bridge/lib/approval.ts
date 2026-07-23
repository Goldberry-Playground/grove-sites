/**
 * Phase 2 content-approval card + modal builders and the stateless card-context
 * codec (GOL-470 / GOL-233 §2).
 *
 * Design note — WHY we round-trip context through the card:
 * The interactions server is a small, restartable, stateless droplet process. A
 * button click can arrive minutes after the card was posted (possibly after a
 * restart), so we cannot rely on in-memory state keyed by suggestion id.
 * Instead the card itself is the source of truth: the body lives in the embed
 * `description`, the ordered hashtag pool and target platforms live in named
 * embed fields. On Approve/Reject/Revise we read them straight back off
 * `interaction.message` — no store, no DB. Fields are human-readable AND
 * machine-parseable, so nothing is hidden from the approver.
 *
 * Pure/synchronous — no I/O; the server performs the Buffer/audit side effects.
 */
import { ANCHOR_TAG, buildHashtagPool, type HashtagInput, type Platform } from "./hashtags.ts";
import { readMediaAsset, type MediaAsset } from "./media.ts";
import type { DiscordEmbed, DiscordMessage } from "./render.ts";

export type { Platform } from "./hashtags.ts";
export type { MediaAsset } from "./media.ts";

/** Grove green (embed accent) — matches the digest card. */
const GROVE_GREEN = 0x3f7d4e;

/** All platforms we know how to target, in canonical display order. */
export const PLATFORMS: Platform[] = ["threads", "instagram"];

const PLATFORM_LABEL: Record<Platform, string> = {
  threads: "Threads",
  instagram: "Instagram",
};

/** Embed field names — load-bearing: the codec parses context back by these. */
const FIELD_TARGETS = "Targets";
const FIELD_POOL = "Hashtag pool";
/**
 * Media field — carries the media asset as JSON so the stateless card is the
 * sole source of truth for the (possibly minutes-later) decision. The image is
 * ALSO surfaced via `embed.image` for a human preview, but the JSON here is what
 * the codec reads back — the preview URL alone loses type/source/igPostType.
 */
const FIELD_MEDIA = "Media";

/** custom_id namespace for content-suggestion components (distinct from `insights:`). */
export const CS_PREFIX = "cs";
export const CS_MODAL_PREFIX = "csmodal";
/** Text-input id inside the Revise modal. */
export const REVISE_INPUT_ID = "revised_text";

/** A content suggestion emitted by Sora (GOL-233 §2 `content_suggestion`). */
export interface ContentSuggestion {
  /** Short stable id, e.g. "cs_20260722_pawpaw". Threaded into the audit trail. */
  id: string;
  /** The post body (no hashtags — those are composed per-platform on approve). */
  content: string;
  /** Which platforms to draft to. */
  targets: Platform[];
  species?: string[];
  places?: string[];
  practices?: string[];
  /** Any additional pre-approved tags. */
  extraTags?: string[];
  /** Optional headline shown as the card title. */
  headline?: string;
  /**
   * Optional media asset (GOL-716/718). When present, Instagram drafts a real
   * post carrying this asset; when absent, IG stays a skipped-but-audited target
   * (GOL-714) and only Threads drafts. Never applied to Threads.
   */
  media?: MediaAsset;
}

/** The three terminal decisions an approver can take. */
export type Decision = "approve" | "revise" | "reject";

/** Parsed context recovered from a posted approval card. */
export interface CardContext {
  body: string;
  pool: string[];
  targets: Platform[];
  /** Media recovered from the card (undefined ⇒ text-only / IG-skip path). */
  media?: MediaAsset;
}

function hashtagInput(s: ContentSuggestion): HashtagInput {
  return { species: s.species, places: s.places, practices: s.practices, extra: s.extraTags };
}

/** Build the #cmo-approvals card for a suggestion: embed + Approve/Revise/Reject row. */
export function buildApprovalCard(suggestion: ContentSuggestion): DiscordMessage {
  const pool = buildHashtagPool(hashtagInput(suggestion));
  const targets = suggestion.targets.length ? suggestion.targets : PLATFORMS;

  const fields = [
    { name: FIELD_TARGETS, value: targets.map((t) => PLATFORM_LABEL[t]).join(" · "), inline: true },
    { name: FIELD_POOL, value: pool.join(" "), inline: false },
  ];
  if (suggestion.media) {
    // JSON is the machine-readable source of truth the codec reads back; the
    // preview image (below) is for the human approver only.
    fields.push({ name: FIELD_MEDIA, value: JSON.stringify(suggestion.media), inline: false });
  }

  const embed: DiscordEmbed = {
    title: suggestion.headline?.trim() || "🌱 Content suggestion — awaiting review",
    description: suggestion.content.trim(),
    color: GROVE_GREEN,
    footer: { text: `id:${suggestion.id}` },
    fields,
    ...(suggestion.media?.type === "image" ? { image: { url: suggestion.media.url } } : {}),
  };

  return {
    embeds: [embed],
    components: [
      {
        type: 1,
        components: [
          { type: 2, style: 3, label: "Approve", emoji: { name: "✅" }, custom_id: encodeAction("approve", suggestion.id) },
          { type: 2, style: 1, label: "Revise", emoji: { name: "✏️" }, custom_id: encodeAction("revise", suggestion.id) },
          { type: 2, style: 4, label: "Reject", emoji: { name: "🚫" }, custom_id: encodeAction("reject", suggestion.id) },
        ],
      },
    ],
  };
}

/** Encode a button custom_id: `cs:<decision>:<suggestionId>`. */
export function encodeAction(decision: Decision, suggestionId: string): string {
  return `${CS_PREFIX}:${decision}:${suggestionId}`;
}

/** Parse a content-suggestion button custom_id, or null when it is not one. */
export function parseAction(customId: string): { decision: Decision; suggestionId: string } | null {
  const parts = customId.split(":");
  if (parts.length < 3 || parts[0] !== CS_PREFIX) return null;
  const decision = parts[1];
  if (decision !== "approve" && decision !== "revise" && decision !== "reject") return null;
  return { decision, suggestionId: parts.slice(2).join(":") };
}

/**
 * Build the Revise modal (response data), prefilled with the current post body.
 * Targets are carried in the modal custom_id so the modal-submit handler is
 * self-contained (modal submits don't reliably echo the source message).
 */
export function buildReviseModal(suggestionId: string, prefill: string, targets: Platform[]): {
  custom_id: string;
  title: string;
  components: Array<{ type: 1; components: unknown[] }>;
} {
  return {
    custom_id: encodeModalId(suggestionId, targets),
    title: "Revise before drafting",
    components: [
      {
        type: 1,
        components: [
          {
            type: 4, // TEXT_INPUT
            custom_id: REVISE_INPUT_ID,
            style: 2, // PARAGRAPH
            label: "Post text (hashtags included as you want them)",
            value: prefill.slice(0, 4000),
            required: true,
            max_length: 4000,
          },
        ],
      },
    ],
  };
}

/** Encode the Revise-modal custom_id: `csmodal:<suggestionId>:<t1.t2>`. */
export function encodeModalId(suggestionId: string, targets: Platform[]): string {
  return `${CS_MODAL_PREFIX}:${suggestionId}:${targets.join(".")}`;
}

/** Parse a Revise-modal custom_id, or null when it is not one. */
export function parseModalId(customId: string): { suggestionId: string; targets: Platform[] } | null {
  const parts = customId.split(":");
  if (parts.length < 3 || parts[0] !== CS_MODAL_PREFIX) return null;
  const targets = parts[2]
    .split(".")
    .filter((t): t is Platform => (PLATFORMS as string[]).includes(t));
  return { suggestionId: parts[1], targets };
}

/** Read a modal-submit's revised text value, or "" when absent. */
export function readModalText(components: unknown): string {
  const rows = Array.isArray(components) ? components : [];
  for (const row of rows) {
    const comps = (row as { components?: Array<{ custom_id?: string; value?: string }> }).components ?? [];
    for (const c of comps) {
      if (c.custom_id === REVISE_INPUT_ID) return (c.value ?? "").trim();
    }
  }
  return "";
}

/**
 * Recover body + hashtag pool + targets from a posted card's message payload.
 * Inverse of {@link buildApprovalCard}. Robust to Discord's field ordering.
 */
export function parseCardContext(message: unknown): CardContext {
  const embed = (message as { embeds?: Array<Record<string, unknown>> })?.embeds?.[0] ?? {};
  const body = typeof embed.description === "string" ? embed.description : "";
  const fields = Array.isArray(embed.fields) ? (embed.fields as Array<{ name?: string; value?: string }>) : [];

  let poolStr = "";
  let targetsStr = "";
  let mediaStr = "";
  for (const f of fields) {
    if (f.name === FIELD_POOL) poolStr = f.value ?? "";
    else if (f.name === FIELD_TARGETS) targetsStr = f.value ?? "";
    else if (f.name === FIELD_MEDIA) mediaStr = f.value ?? "";
  }

  const pool = poolStr.split(/\s+/).filter((t) => t.startsWith("#"));
  if (!pool.some((t) => t.toLowerCase() === ANCHOR_TAG.toLowerCase())) pool.unshift(ANCHOR_TAG);

  const lower = targetsStr.toLowerCase();
  const targets = PLATFORMS.filter((p) => lower.includes(p));

  // Lenient decode: a garbled/absent media field degrades to the IG-skip path,
  // never throws — a decision must survive a mangled card.
  const media = mediaStr ? readMediaAsset(safeJson(mediaStr)) : undefined;

  return { body, pool, targets: targets.length ? targets : PLATFORMS, media };
}

/** Parse JSON without throwing (returns undefined on any error). */
function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

/**
 * Build the edited card shown after a terminal decision: disables the buttons
 * (empty component rows) and stamps who decided and the outcome.
 */
export function decisionCard(
  original: unknown,
  decision: Decision,
  approverId: string,
  detail: string,
): DiscordMessage {
  const embed = { ...((original as { embeds?: DiscordEmbed[] })?.embeds?.[0] ?? emptyEmbed()) };
  const badge =
    decision === "approve" ? "✅ Approved" : decision === "revise" ? "✏️ Revised & drafted" : "🚫 Rejected";
  embed.title = `${badge} — <@${approverId}>`;
  embed.footer = { text: detail };
  return { embeds: [embed], components: [] };
}

function emptyEmbed(): DiscordEmbed {
  return { title: "", description: "", color: GROVE_GREEN, footer: { text: "" } };
}
