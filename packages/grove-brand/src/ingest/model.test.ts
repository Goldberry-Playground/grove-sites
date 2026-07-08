import { describe, expect, it } from "vitest";
import {
  emptyRegistry,
  parseRegistry,
  registryPath,
  renderRegistry,
  upsertBrandEntry,
  type BrandEntry,
} from "./model";

const T = "2026-07-08T00:00:00.000Z";

function entry(overrides: Partial<BrandEntry> = {}): BrandEntry {
  return {
    brand: "goldberry",
    assetClass: "logo",
    slug: "mark-on-cream",
    key: "goldberry/logo/mark-on-cream.abc123.webp",
    cdnUrl: "https://cdn.example/goldberry/logo/mark-on-cream.abc123.webp",
    caption: "goldberry, logo, mark on cream",
    updatedAt: T,
    ...overrides,
  };
}

describe("registryPath", () => {
  it("is repo-relative and brand-scoped", () => {
    expect(registryPath("ggg")).toBe("packages/grove-brand/registry/ggg.json");
  });
});

describe("upsertBrandEntry", () => {
  it("adds a new entry", () => {
    const { registry, kind } = upsertBrandEntry(emptyRegistry("goldberry"), entry());
    expect(kind).toBe("added");
    expect(registry.assets).toHaveLength(1);
  });

  it("does not mutate the input registry", () => {
    const base = emptyRegistry("goldberry");
    upsertBrandEntry(base, entry());
    expect(base.assets).toHaveLength(0);
  });

  it("updates an existing (class, slug) with new CDN fields", () => {
    const first = upsertBrandEntry(emptyRegistry("goldberry"), entry());
    const second = upsertBrandEntry(
      first.registry,
      entry({ key: "goldberry/logo/mark-on-cream.def456.webp", updatedAt: "2026-07-09T00:00:00.000Z" }),
    );
    expect(second.kind).toBe("updated");
    expect(second.registry.assets).toHaveLength(1);
    expect(second.registry.assets[0]!.key).toContain("def456");
  });

  it("reports unchanged when only updatedAt differs", () => {
    const first = upsertBrandEntry(emptyRegistry("goldberry"), entry());
    const again = upsertBrandEntry(first.registry, entry({ updatedAt: "2026-12-31T00:00:00.000Z" }));
    expect(again.kind).toBe("unchanged");
    expect(again.registry).toBe(first.registry);
  });

  it("keeps distinct slugs and sorts deterministically", () => {
    let reg = emptyRegistry("goldberry");
    reg = upsertBrandEntry(reg, entry({ slug: "wordmark" })).registry;
    reg = upsertBrandEntry(reg, entry({ slug: "mark-on-cream" })).registry;
    expect(reg.assets.map((a) => a.slug)).toEqual(["mark-on-cream", "wordmark"]);
  });

  it("rejects a brand mismatch", () => {
    expect(() => upsertBrandEntry(emptyRegistry("ggg"), entry())).toThrow(/does not match/);
  });
});

describe("render / parse round-trip", () => {
  it("renders canonical JSON with trailing newline", () => {
    const reg = upsertBrandEntry(emptyRegistry("goldberry"), entry()).registry;
    const text = renderRegistry(reg);
    expect(text.endsWith("\n")).toBe(true);
    expect(parseRegistry("goldberry", text)).toEqual(reg);
  });

  it("round-trips an entry with a blank caption", () => {
    // A logo can be ingested without a human caption; the empty string must
    // survive render → parse (regression: coerceEntry once rejected empty caption).
    const reg = upsertBrandEntry(emptyRegistry("goldberry"), entry({ caption: "" })).registry;
    const text = renderRegistry(reg);
    expect(parseRegistry("goldberry", text)).toEqual(reg);
  });

  it("still rejects a non-string caption", () => {
    const bad = JSON.stringify({
      brand: "goldberry",
      assets: [{ ...entry(), caption: 123 }],
    });
    expect(() => parseRegistry("goldberry", bad)).toThrow(/caption must be a string/);
  });

  it("is stable regardless of insertion order", () => {
    const a = upsertBrandEntry(
      upsertBrandEntry(emptyRegistry("goldberry"), entry({ slug: "b" })).registry,
      entry({ slug: "a" }),
    ).registry;
    const b = upsertBrandEntry(
      upsertBrandEntry(emptyRegistry("goldberry"), entry({ slug: "a" })).registry,
      entry({ slug: "b" }),
    ).registry;
    expect(renderRegistry(a)).toBe(renderRegistry(b));
  });

  it("rejects a wrong-brand file", () => {
    const text = renderRegistry(upsertBrandEntry(emptyRegistry("goldberry"), entry()).registry);
    expect(() => parseRegistry("ggg", text)).toThrow(/does not match/);
  });

  it("rejects an unknown asset class", () => {
    const bad = JSON.stringify({
      brand: "goldberry",
      assets: [{ ...entry(), assetClass: "sticker" }],
    });
    expect(() => parseRegistry("goldberry", bad)).toThrow(/unknown/);
  });

  it("rejects malformed JSON", () => {
    expect(() => parseRegistry("goldberry", "{not json")).toThrow(/invalid registry JSON/);
  });
});
