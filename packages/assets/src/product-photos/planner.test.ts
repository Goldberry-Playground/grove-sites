import { describe, it, expect } from "vitest";
import type { MatchedFile } from "./matcher";
import {
  galleryName,
  parseGalleryName,
  planIngest,
  resolveVariantHint,
  type CatalogProduct,
} from "./planner";

const CATALOG: CatalogProduct[] = [
  {
    id: 11,
    slug: "pawpaw-mango",
    name: "Pawpaw 'Mango'",
    variants: [
      { id: 101, displayName: "Pawpaw 'Mango' (Potted)", format: "Potted", cultivar: "" },
      { id: 102, displayName: "Pawpaw 'Mango' (Bareroot)", format: "Bareroot", cultivar: "" },
    ],
  },
  { id: 22, slug: "american-persimmon", name: "American Persimmon" },
];

function m(file: string, slug: string, variantHint: string | null = null, sequence: number | null = null): MatchedFile {
  return { file, slug, variantHint, sequence };
}

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

describe("gallery name marker", () => {
  it("round-trips file + hash", () => {
    const name = galleryName("pawpaw-mango-2.jpg", HASH_A);
    expect(name).toBe(`pawpaw-mango-2.jpg [grove-ingest ${"a".repeat(12)}]`);
    expect(parseGalleryName(name)).toEqual({ file: "pawpaw-mango-2.jpg", hash: "a".repeat(12) });
  });

  it("returns null for names without a marker", () => {
    expect(parseGalleryName("hand-uploaded photo")).toBeNull();
  });
});

describe("resolveVariantHint", () => {
  const variants = CATALOG[0]!.variants!;

  it("matches by format", () => {
    expect(resolveVariantHint("potted", variants).variant?.id).toBe(101);
    expect(resolveVariantHint("bareroot", variants).variant?.id).toBe(102);
  });

  it("reports unknown hints with the known axes", () => {
    const { variant, error } = resolveVariantHint("gallon", variants);
    expect(variant).toBeUndefined();
    expect(error).toContain('"gallon"');
    expect(error).toContain("potted");
  });

  it("reports ambiguity instead of guessing", () => {
    const dup = [
      { id: 1, displayName: "A", format: "Potted", cultivar: "" },
      { id: 2, displayName: "B", format: "Potted", cultivar: "" },
    ];
    expect(resolveVariantHint("potted", dup).error).toContain("ambiguous");
  });
});

describe("planIngest — slot assignment (dry-run, no hashes)", () => {
  it("routes bare and -1 files to primary, >=2 to gallery, hints to variants", () => {
    const { planned, problems } = planIngest(
      [
        m("pawpaw-mango.jpg", "pawpaw-mango"),
        m("pawpaw-mango-2.jpg", "pawpaw-mango", null, 2),
        m("pawpaw-mango-potted.jpg", "pawpaw-mango", "potted"),
        m("american-persimmon-1.jpg", "american-persimmon", null, 1),
      ],
      CATALOG,
    );
    expect(problems).toEqual([]);
    const byFile = Object.fromEntries(planned.map((p) => [p.file, p]));
    expect(byFile["pawpaw-mango.jpg"]!.op.kind).toBe("set-primary");
    expect(byFile["american-persimmon-1.jpg"]!.op).toEqual({ kind: "set-primary", productId: 22 });
    expect(byFile["pawpaw-mango-2.jpg"]!.op.kind).toBe("add-gallery");
    expect(byFile["pawpaw-mango-potted.jpg"]!.op).toMatchObject({
      kind: "set-variant-image",
      variantId: 101,
    });
    // Without hashes nothing can be proven identical — everything is a write.
    expect(planned.every((p) => p.status === "write")).toBe(true);
  });

  it("flags two files claiming the same primary slot instead of picking one", () => {
    const { planned, problems } = planIngest(
      [m("pawpaw-mango.jpg", "pawpaw-mango"), m("pawpaw-mango-1.jpg", "pawpaw-mango", null, 1)],
      CATALOG,
    );
    expect(planned).toHaveLength(1);
    expect(problems).toHaveLength(1);
    expect(problems[0]!.reason).toContain("primary slot");
  });

  it("hinted gallery files (hint + seq>=2) go to the template gallery", () => {
    const { planned, problems } = planIngest(
      [m("pawpaw-mango-potted-2.jpg", "pawpaw-mango", "potted", 2)],
      CATALOG,
    );
    expect(problems).toEqual([]);
    expect(planned[0]!.op.kind).toBe("add-gallery");
  });

  it("reports unknown variant hints as problems", () => {
    const { planned, problems } = planIngest(
      [m("pawpaw-mango-gallon.jpg", "pawpaw-mango", "gallon")],
      CATALOG,
    );
    expect(planned).toEqual([]);
    expect(problems[0]!.reason).toContain("gallon");
  });

  it("reports slugs missing from the catalog", () => {
    const { problems } = planIngest([m("ghost.jpg", "ghost")], CATALOG);
    expect(problems[0]!.reason).toContain("not in fetched catalog");
  });
});

describe("planIngest — idempotency (apply mode, hashes + existing state)", () => {
  it("skips a primary whose current image hash matches the processed file", () => {
    const { planned } = planIngest(
      [m("pawpaw-mango.jpg", "pawpaw-mango")],
      CATALOG,
      { "pawpaw-mango.jpg": HASH_A },
      { primaryHashByProduct: { 11: HASH_A } },
    );
    expect(planned[0]!.status).toBe("skip");
    expect(planned[0]!.reason).toContain("up to date");
  });

  it("writes a primary when the current image differs (field overwrite, no dupes)", () => {
    const { planned } = planIngest(
      [m("pawpaw-mango.jpg", "pawpaw-mango")],
      CATALOG,
      { "pawpaw-mango.jpg": HASH_A },
      { primaryHashByProduct: { 11: HASH_B } },
    );
    expect(planned[0]!.status).toBe("write");
  });

  it("skips an unchanged gallery file by its name marker", () => {
    const { planned } = planIngest(
      [m("pawpaw-mango-2.jpg", "pawpaw-mango", null, 2)],
      CATALOG,
      { "pawpaw-mango-2.jpg": HASH_A },
      { galleryByProduct: { 11: [{ id: 900, name: galleryName("pawpaw-mango-2.jpg", HASH_A) }] } },
    );
    expect(planned[0]!.status).toBe("skip");
  });

  it("updates the existing gallery row in place when content changed (never duplicates)", () => {
    const { planned } = planIngest(
      [m("pawpaw-mango-2.jpg", "pawpaw-mango", null, 2)],
      CATALOG,
      { "pawpaw-mango-2.jpg": HASH_B },
      { galleryByProduct: { 11: [{ id: 900, name: galleryName("pawpaw-mango-2.jpg", HASH_A) }] } },
    );
    expect(planned[0]!.status).toBe("write");
    expect(planned[0]!.op).toMatchObject({ kind: "add-gallery", updateRowId: 900 });
  });

  it("creates a new gallery row when the file was never ingested", () => {
    const { planned } = planIngest(
      [m("pawpaw-mango-3.jpg", "pawpaw-mango", null, 3)],
      CATALOG,
      { "pawpaw-mango-3.jpg": HASH_A },
      { galleryByProduct: { 11: [{ id: 900, name: galleryName("pawpaw-mango-2.jpg", HASH_A) }] } },
    );
    expect(planned[0]!.status).toBe("write");
    expect(planned[0]!.op).not.toHaveProperty("updateRowId");
  });

  it("skips an up-to-date variant image", () => {
    const { planned } = planIngest(
      [m("pawpaw-mango-potted.jpg", "pawpaw-mango", "potted")],
      CATALOG,
      { "pawpaw-mango-potted.jpg": HASH_A },
      { variantHashByVariant: { 101: HASH_A } },
    );
    expect(planned[0]!.status).toBe("skip");
  });
});
