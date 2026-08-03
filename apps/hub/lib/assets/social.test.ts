import { describe, it, expect } from "vitest";

import { handleSocialRehost, type RehostDeps } from "./social";
import type {
  AssetStore,
  MediaNormalizer,
  NormalizedMedia,
} from "../../../discord-bridge/lib/ingest";

/** Build a multipart Request with a `meta` JSON part and optional `file` bytes. */
function form(meta: Record<string, unknown>, file?: Uint8Array | null): Request {
  const fd = new FormData();
  fd.set("meta", JSON.stringify(meta));
  if (file) fd.set("file", new Blob([file as BlobPart], { type: "image/jpeg" }), "farm.jpg");
  return new Request("http://localhost/api/assets/social", { method: "POST", body: fd });
}

const IMAGE_META = { declaredType: "image", source: "manual", filename: "farm.jpg" };

/** A normalizer that returns a fixed webp payload, recording its input. */
function fakeNormalizer(
  out: NormalizedMedia = { bytes: new Uint8Array([9, 9, 9]), contentType: "image/webp", type: "image" },
): { normalize: MediaNormalizer; calls: unknown[] } {
  const calls: unknown[] = [];
  const normalize: MediaNormalizer = async (raw) => {
    calls.push(raw);
    return out;
  };
  return { normalize, calls };
}

/** A store that returns a durable CDN URL for whatever key it is handed. */
function fakeStore(url = "https://assets.gatheringatthegrove.com/social/abc.webp"): {
  store: AssetStore;
  calls: Array<{ key: string; contentType: string }>;
} {
  const calls: Array<{ key: string; contentType: string }> = [];
  const store: AssetStore = {
    async put(key, _bytes, contentType) {
      calls.push({ key, contentType });
      return url;
    },
  };
  return { store, calls };
}

function deps(store: AssetStore, normalize: MediaNormalizer): RehostDeps {
  return { store, normalize };
}

describe("handleSocialRehost", () => {
  it("re-hosts an image drop and returns a validated MediaAsset (200)", async () => {
    const n = fakeNormalizer();
    const s = fakeStore();
    const res = await handleSocialRehost(
      form({ ...IMAGE_META, altText: "Pawpaw seedlings" }, new Uint8Array([1, 2, 3, 4])),
      deps(s.store, n.normalize),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      url: "https://assets.gatheringatthegrove.com/social/abc.webp",
      type: "image",
      source: "manual",
      igPostType: "post",
      altText: "Pawpaw seedlings",
    });
    // Normalizer ran before the store, and the store keyed off the webp content-type.
    expect(n.calls).toHaveLength(1);
    expect(s.calls).toHaveLength(1);
    expect(s.calls[0].contentType).toBe("image/webp");
    expect(s.calls[0].key).toMatch(/^social\/[0-9a-f]+\.webp$/);
  });

  it("400s when the file part is missing", async () => {
    const res = await handleSocialRehost(form(IMAGE_META, null), deps(fakeStore().store, fakeNormalizer().normalize));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "missing_file" });
  });

  it("400s when declaredType is invalid", async () => {
    const res = await handleSocialRehost(
      form({ declaredType: "gif", source: "manual", filename: "x.jpg" }, new Uint8Array([1])),
      deps(fakeStore().store, fakeNormalizer().normalize),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_field", field: "declaredType" });
  });

  it("422s a disallowed file extension (seam IngestError), without touching the store", async () => {
    const s = fakeStore();
    const res = await handleSocialRehost(
      form({ declaredType: "image", source: "manual", filename: "evil.svg" }, new Uint8Array([1, 2])),
      deps(s.store, fakeNormalizer().normalize),
    );
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: "rehost_rejected" });
    expect(s.calls).toHaveLength(0);
  });

  it("422s when the store hands back a short-lived signed URL (media contract)", async () => {
    const s = fakeStore("https://x.example/y?X-Amz-Signature=deadbeef");
    const res = await handleSocialRehost(
      form(IMAGE_META, new Uint8Array([1, 2, 3])),
      deps(s.store, fakeNormalizer().normalize),
    );
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: "rehost_rejected" });
  });

  it("502s when the store backend fails", async () => {
    const store: AssetStore = {
      async put() {
        throw new Error("spaces unreachable");
      },
    };
    const res = await handleSocialRehost(
      form(IMAGE_META, new Uint8Array([1, 2, 3])),
      deps(store, fakeNormalizer().normalize),
    );
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: "rehost_failed" });
  });
});
