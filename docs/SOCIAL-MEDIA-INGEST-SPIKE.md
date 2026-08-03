# Spike — social media upload → caption/hashtag/schedule (GOL-472, Phase 4)

**Status:** spike / investigation complete. Recommendation + phased plan below.
**Scope of the original ask (GOL-261 → GOL-472):** Macy uploads raw media to
Discord/Drive → the bridge stores it to a durable asset store → caption + hashtag
assist → preview card → on approve, schedule via Buffer. Full video *editing* stays
in Canva/existing tooling (this is not a video editor — GOL-234 risk).

---

## TL;DR

**Most of this pipeline already ships.** The Phase-2/3 content-approval loop already
covers caption + hashtag assist, the preview card, approve/revise/reject, and Buffer
scheduling *with media*. The only unbuilt seam is the **front door**: turning a raw
file Macy drops (a Discord attachment or a Drive file) into a **durable, publicly
fetchable https URL** that satisfies the existing `MediaAsset` contract.

`apps/discord-bridge/lib/media.ts` states this boundary explicitly:

> `media.url` MUST already be a durable, publicly fetchable https URL … the
> suggestion producer must **re-host the export to our asset store first**.
> `validateMediaAsset` rejects obvious short-lived signed URLs …

So GOL-472 reduces to one component — **a media re-host/ingest step** — plus the glue
that feeds its output into the already-built `MediaAsset` → Buffer path. Everything
downstream is done and tested.

---

## What already exists (do not rebuild)

| Capability | Where | Issue |
| --- | --- | --- |
| Caption/hashtag assist (anchor `#TreeFacts`, per-platform caps, banned-tag strip) | `apps/discord-bridge/lib/hashtags.ts` | GOL-470 / GOL-233 |
| Preview / approval card (approve · revise · reject) | `apps/discord-bridge/lib/approval.ts`, `render.ts`, `decide.ts` | GOL-470 |
| Media asset contract + strict validation (rejects signed URLs) | `apps/discord-bridge/lib/media.ts` | GOL-716 / GOL-718 |
| Buffer scheduling **with media** (IG post/reel/story; Threads stays text) | `apps/discord-bridge/lib/buffer.ts` (`createDraft`, `toBufferMedia`) | GOL-718 |
| Media threaded through the stateless approval card → IG draft only | `decide.ts` (`executeDecision`) | GOL-718 |
| Suggestion intake CLI | `apps/discord-bridge/suggestion-cli.ts` | GOL-470 |

The one thing the contract deliberately does **not** do is produce the durable URL —
it assumes the producer already re-hosted. That producer is what this spike designs.

## What's missing (the actual Phase-4 work)

1. **Ingest**: accept a raw file from Macy. Two candidate front doors:
   - **Discord attachment** on a bridge command/message (bytes reachable via the
     Discord CDN URL, but that URL is *not* durable — it now carries expiring
     signature params, exactly the class `media.ts` rejects). The bridge must fetch
     the bytes and re-host.
   - **Google Drive file** (Drive MCP + `download_file_content` is available), for
     when Macy prefers Drive. Same re-host step.
2. **Normalize + de-risk** (reuse the product-photo recipe — see below): resize,
   re-encode, and **strip all EXIF/GPS metadata**.
3. **Store** to a durable, public https URL.
4. **Hand off**: build a `MediaAsset` from the stored URL and drop the operator into
   the existing suggestion flow (caption/hashtag assist → preview card → Buffer).

Only steps 1–3 are new. Step 4 is a thin call into code that already exists.

---

## Reuse: the product-photo ingest pattern (GATH-95)

`docs/PRODUCT-PHOTO-INGEST.md` + `scripts/upload-asset.ts` already solve a very
similar problem for storefront photos, and set precedents we should inherit:

- **Normalize before store**: resize to ≤1600px long edge, re-encode WebP.
- **Strip all EXIF metadata including GPS** — *load-bearing*: family phone photos
  are geotagged with the farm/home. A social post is *public*, so this is a
  privacy-safety requirement, not a nicety. Any social ingest that skips EXIF strip
  is a stop-ship bug.
- **Human-run, explicit, never automatic** (`docs/QA-AGENT-GUARDRAILS.md` §1):
  nothing uploads automatically, nothing writes at build time. The social ingest
  should stay operator-triggered (Macy acts; the bridge reacts), never a crawler.
- **Content-hash / idempotent** re-runs so a re-upload doesn't duplicate.

## Key open decision — where do the bytes land?

The original ask names **DigitalOcean Spaces**. But we already have an asset-store
ADR: **ADR-009 (`odoocker/docs/ADR/009-grove-asset-storage.md`)**, and the
product-photo path stores in the **Odoo filestore** served by `grove_headless`.

| | **A. Extend the Odoo-backed store (ADR-009)** | **B. New DigitalOcean Spaces bucket** |
| --- | --- | --- |
| Public URL for Buffer to fetch | Needs a public, token-free asset URL from Odoo/`grove_headless` — must confirm it can serve one Buffer can fetch unauthenticated | S3-compatible, trivially public-read, CDN-frontable — best fit for "Buffer pulls by URL later" |
| Normalization / EXIF-strip | Already implemented in `upload-asset.ts` | Must port the same recipe |
| ADR alignment | Aligned (single asset store) | New second source of truth; needs an ADR amendment |
| Infra to provision (Terra) | Likely none new (reuse filestore) | Bucket, keys, public base URL, lifecycle/retention, CDN |

**Recommendation:** prefer **A** *iff* the Odoo filestore can mint a durable,
unauthenticated public https URL that Buffer can fetch at publish time — it reuses
the EXIF-strip pipeline and stays ADR-aligned. Fall back to **B (DO Spaces)** only
if it cannot. This is an **infra + ADR decision owned by DevOps-Terra** (and worth a
one-line nod from the CEO since it touches the asset-storage ADR). Do not hard-code
DO Spaces before that call.

---

## Proposed component seam (de-risking artifact)

A single new module, storage-backend-agnostic, feeding the existing contract:

```ts
// apps/discord-bridge/lib/ingest.ts  (proposed)

export interface RawUpload {
  bytes: Uint8Array;
  filename: string;          // for extension/content-type inference only
  declaredType: MediaType;   // "image" | "video" (from media.ts)
  source: MediaSource;       // "manual" for a farm photo; "canva" for a re-host
}

export interface AssetStore {
  /** Store normalized bytes, return a durable public https URL. */
  put(key: string, bytes: Uint8Array, contentType: string): Promise<string>;
}

/**
 * Re-host a raw upload to a durable public URL and return a validated MediaAsset.
 * - enforces a content-type allowlist (image/jpeg|png|webp, video/mp4)
 * - enforces a max size (IG/Buffer limits; reject early, loud)
 * - resizes + re-encodes and STRIPS ALL EXIF/GPS (reuse upload-asset recipe)
 * - keys by content hash for idempotent re-uploads
 * - returns a MediaAsset whose url passes validateMediaAsset() by construction
 */
export async function rehostToMediaAsset(
  raw: RawUpload,
  store: AssetStore,
  opts: { igPostType?: IgPostType; altText?: string },
): Promise<MediaAsset>;
```

Why this shape:
- **`AssetStore` is an interface**, so the Odoo-vs-Spaces decision is a one-line
  wiring change, not a rewrite — the spike does not block on that call.
- Output is a `MediaAsset`, so it plugs straight into `buildApprovalCard` /
  `executeDecision` / `buffer.createDraft` with zero downstream change.
- Validation is guaranteed by construction: `rehostToMediaAsset` returns only URLs
  that already pass `validateMediaAsset` (no signed-URL markers, https, durable).

New config (mirrors the `BridgeConfig` + `MissingEnvError` pattern in `config.ts`;
provisioned via 1Password/Terra like GOL-263) — only if we choose **B**:
`GROVE_ASSET_STORE_ENDPOINT`, `_BUCKET`, `_KEY`, `_SECRET`, `_PUBLIC_BASE_URL`.

## Security / safety checklist (must-haves, not optional)

- [ ] **Strip EXIF/GPS** on every asset before it becomes a public URL (privacy).
- [ ] **Content-type allowlist** (`image/jpeg|png|webp`, `video/mp4`); reject others loud.
- [ ] **Max-size cap** aligned to IG/Buffer limits; reject early, before storing.
- [ ] **No AI-sourced media** — `MediaSource` already excludes Sora/AI by contract (GOL-716).
- [ ] **Only approvers upload** — reuse the existing `approverIds` allowlist (Macy always in).
- [ ] **No auto-post** — ingest only *proposes*; the existing approve card is the gate.
- [ ] Public URL must not leak the raw Discord/Drive signed URL (re-host, don't proxy).

---

## Blockers / dependencies

- **Storage decision (A vs B)** — DevOps-Terra (infra/ADR-009); CEO nod on the ADR.
- **Live Buffer media shape** — validated by Terra under GOL-712 (from GOL-718). The
  IG media mutation is not yet confirmed against live Buffer; ingest downstream
  inherits that unknown.
- **Intake-channel product call** — CMO-Sora / CEO: is the front door Discord
  attachments, Drive, or both? Affects only step 1 (the seam is common to both).
- Phase-2 bridge deploy (GOL-593/GOL-712) is the runtime this rides on.

## Phased implementation plan (for the follow-up issue)

1. **Decide storage backend** (A vs B) — Terra + CEO. *(blocker)*
2. Implement `lib/ingest.ts` (`rehostToMediaAsset` + one `AssetStore` impl) with the
   EXIF-strip/normalize recipe ported from `upload-asset.ts`; unit-test the
   validation/allowlist/size/hash logic (pure, no I/O) as the bridge already does.
3. Wire a Discord attachment (and/or Drive) front door → `rehostToMediaAsset` →
   existing `buildApprovalCard` flow.
4. Live-verify one real farm photo end-to-end: upload → durable URL → approve card →
   Buffer IG draft (coordinate the preview with Terra; depends on GOL-712).

**Estimate:** the new surface is one module + one thin front-door handler; downstream
is untouched. Small once the storage decision lands. The decision + the GOL-712 live
Buffer unknown are the real critical path, not the code.
