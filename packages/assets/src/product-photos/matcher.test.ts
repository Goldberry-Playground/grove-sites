import { describe, it, expect } from "vitest";
import { kebab, matchFiles, parseFilename, type MatchedFile } from "./matcher";

const SLUGS = [
  "pawpaw-mango",
  "pawpaw",
  "honeycrisp-apple-tree",
  "american-persimmon",
];

function matched(result: ReturnType<typeof parseFilename>): MatchedFile {
  if ("reason" in result) throw new Error(`expected match, got: ${result.reason}`);
  return result;
}

describe("kebab", () => {
  it("lowercases and hyphenates", () => {
    expect(kebab("Pawpaw Mango")).toBe("pawpaw-mango");
    expect(kebab("  Bare Root!! ")).toBe("bare-root");
  });
});

describe("parseFilename", () => {
  it("matches a bare slug as the primary photo", () => {
    const m = matched(parseFilename("pawpaw-mango.jpg", SLUGS));
    expect(m).toMatchObject({ slug: "pawpaw-mango", variantHint: null, sequence: null });
  });

  it("prefers the LONGEST slug prefix (pawpaw-mango over pawpaw)", () => {
    const m = matched(parseFilename("pawpaw-mango-2.jpg", SLUGS));
    expect(m.slug).toBe("pawpaw-mango");
    expect(m.sequence).toBe(2);
  });

  it("falls back to the shorter slug when the longer one does not prefix", () => {
    const m = matched(parseFilename("pawpaw-3.png", SLUGS));
    expect(m).toMatchObject({ slug: "pawpaw", variantHint: null, sequence: 3 });
  });

  it("parses a variant hint between slug and sequence", () => {
    const m = matched(parseFilename("pawpaw-mango-potted-1.jpg", SLUGS));
    expect(m).toMatchObject({ slug: "pawpaw-mango", variantHint: "potted", sequence: 1 });
  });

  it("parses a variant hint without a sequence", () => {
    const m = matched(parseFilename("honeycrisp-apple-tree-bare-root.webp", SLUGS));
    expect(m).toMatchObject({
      slug: "honeycrisp-apple-tree",
      variantHint: "bare-root",
      sequence: null,
    });
  });

  it("is case-insensitive and tolerant of spaces (phone camera names)", () => {
    const m = matched(parseFilename("American Persimmon 2.JPG", SLUGS));
    expect(m).toMatchObject({ slug: "american-persimmon", sequence: 2, variantHint: null });
  });

  it("accepts jpg/jpeg/png/webp only", () => {
    expect(parseFilename("pawpaw.heic", SLUGS)).toHaveProperty("reason");
    expect(parseFilename("pawpaw.mov", SLUGS)).toHaveProperty("reason");
    expect(matched(parseFilename("pawpaw.jpeg", SLUGS)).slug).toBe("pawpaw");
  });

  it("never guesses: unknown names come back unmatched with a reason", () => {
    const r = parseFilename("mystery-tree.jpg", SLUGS);
    expect(r).toHaveProperty("reason");
    if ("reason" in r) expect(r.reason).toContain("no product slug matches");
  });

  it("does not match a partial token (pawpaw-man is not pawpaw-mango)", () => {
    // "pawpaw-man" starts with slug "pawpaw" on a token boundary, so it matches
    // pawpaw with hint "man" — but never pawpaw-mango.
    const m = matched(parseFilename("pawpaw-man.jpg", SLUGS));
    expect(m.slug).toBe("pawpaw");
    expect(m.variantHint).toBe("man");
  });

  it("rejects sequence 0", () => {
    expect(parseFilename("pawpaw-0.jpg", SLUGS)).toHaveProperty("reason");
  });
});

describe("matchFiles", () => {
  it("splits into sorted matched/unmatched", () => {
    const { matched: ok, unmatched } = matchFiles(
      ["zzz.jpg", "pawpaw-mango.jpg", "pawpaw-mango-2.jpg", "notes.txt"],
      SLUGS,
    );
    expect(ok.map((m) => m.file)).toEqual(["pawpaw-mango-2.jpg", "pawpaw-mango.jpg"]);
    expect(unmatched.map((u) => u.file)).toEqual(["notes.txt", "zzz.jpg"]);
  });
});
