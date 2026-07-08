import { describe, expect, it, vi } from "vitest";
import { createAssetBrand, type BrandRepo, type PullRequestOpener } from "./asset-brand";
import { parseRegistry, registryPath } from "./model";

const NOW = "2026-07-08T12:00:00.000Z";

/** In-memory repo whose file map can be pre-seeded per test. */
function fakeRepo(files: Record<string, string> = {}): BrandRepo {
  return {
    readRegistry: vi.fn(async (path: string) => files[path] ?? null),
  };
}

/** PR opener that records the last call and returns a canned URL. */
function fakePr(): PullRequestOpener & { calls: Parameters<PullRequestOpener["openPullRequest"]>[0][] } {
  const calls: Parameters<PullRequestOpener["openPullRequest"]>[0][] = [];
  return {
    calls,
    openPullRequest: vi.fn(async (input) => {
      calls.push(input);
      return { prUrl: `https://github.com/Goldberry-Playground/grove-sites/pull/${calls.length + 100}` };
    }),
  };
}

const validInput = {
  brand: "goldberry",
  slug: "mark-on-cream",
  cdnUrl: "https://cdn.example/goldberry/logo/mark-on-cream.abc123.webp",
  key: "goldberry/logo/mark-on-cream.abc123.webp",
  caption: "goldberry, logo, mark on cream",
};

describe("createAssetBrand.proposeBrandEntry", () => {
  it("opens a PR that creates the registry file when none exists", async () => {
    const repo = fakeRepo();
    const pr = fakePr();
    const brand = createAssetBrand({ repo, pr, now: () => NOW });

    const { prUrl } = await brand.proposeBrandEntry(validInput);

    expect(prUrl).toMatch(/pull\/\d+$/);
    expect(pr.calls).toHaveLength(1);
    const call = pr.calls[0]!;
    expect(call.branch).toBe("brand/logo/goldberry-mark-on-cream");
    expect(call.changes).toHaveLength(1);
    expect(call.changes[0]!.path).toBe(registryPath("goldberry"));

    const written = parseRegistry("goldberry", call.changes[0]!.content);
    expect(written.assets).toHaveLength(1);
    expect(written.assets[0]).toMatchObject({
      brand: "goldberry",
      assetClass: "logo",
      slug: "mark-on-cream",
      key: validInput.key,
      cdnUrl: validInput.cdnUrl,
      updatedAt: NOW,
    });
    expect(call.title).toContain("Add logo entry mark-on-cream");
  });

  it("appends to an existing registry rather than clobbering it", async () => {
    const seed = JSON.stringify({
      brand: "goldberry",
      assets: [
        {
          brand: "goldberry",
          assetClass: "logo",
          slug: "wordmark",
          key: "goldberry/logo/wordmark.111.webp",
          cdnUrl: "https://cdn.example/goldberry/logo/wordmark.111.webp",
          caption: "goldberry, logo, wordmark",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    const repo = fakeRepo({ [registryPath("goldberry")]: seed });
    const pr = fakePr();
    const brand = createAssetBrand({ repo, pr, now: () => NOW });

    await brand.proposeBrandEntry(validInput);

    const written = parseRegistry("goldberry", pr.calls[0]!.changes[0]!.content);
    expect(written.assets.map((a) => a.slug).sort()).toEqual(["mark-on-cream", "wordmark"]);
  });

  it("titles the PR as an Update when the slug already exists", async () => {
    const repo = fakeRepo();
    const pr = fakePr();
    const brand = createAssetBrand({ repo, pr, now: () => NOW });

    // First call creates it; feed the written file back as the repo state.
    await brand.proposeBrandEntry(validInput);
    const repo2 = fakeRepo({ [registryPath("goldberry")]: pr.calls[0]!.changes[0]!.content });
    const pr2 = fakePr();
    const brand2 = createAssetBrand({ repo: repo2, pr: pr2, now: () => NOW });
    await brand2.proposeBrandEntry({ ...validInput, key: "goldberry/logo/mark-on-cream.zzz.webp" });

    expect(pr2.calls[0]!.title).toContain("Update logo entry mark-on-cream");
  });

  it("normalizes brand aliases via case/whitespace", async () => {
    const repo = fakeRepo();
    const pr = fakePr();
    const brand = createAssetBrand({ repo, pr, now: () => NOW });
    await brand.proposeBrandEntry({ ...validInput, brand: "  GGG " });
    expect(pr.calls[0]!.changes[0]!.path).toBe(registryPath("ggg"));
  });

  it("rejects an unknown brand without opening a PR", async () => {
    const repo = fakeRepo();
    const pr = fakePr();
    const brand = createAssetBrand({ repo, pr, now: () => NOW });
    await expect(brand.proposeBrandEntry({ ...validInput, brand: "acme" })).rejects.toThrow(/unknown brand/);
    expect(pr.calls).toHaveLength(0);
  });

  it("rejects a non-kebab slug", async () => {
    const repo = fakeRepo();
    const pr = fakePr();
    const brand = createAssetBrand({ repo, pr, now: () => NOW });
    await expect(brand.proposeBrandEntry({ ...validInput, slug: "Mark On Cream" })).rejects.toThrow(/invalid slug/);
    expect(pr.calls).toHaveLength(0);
  });

  it("rejects a missing CDN key", async () => {
    const repo = fakeRepo();
    const pr = fakePr();
    const brand = createAssetBrand({ repo, pr, now: () => NOW });
    await expect(brand.proposeBrandEntry({ ...validInput, key: "" })).rejects.toThrow(/missing "key"/);
  });

  it("honors a custom branch prefix", async () => {
    const repo = fakeRepo();
    const pr = fakePr();
    const brand = createAssetBrand({ repo, pr, now: () => NOW, branchPrefix: "assets" });
    await brand.proposeBrandEntry(validInput);
    expect(pr.calls[0]!.branch).toBe("assets/goldberry-mark-on-cream");
  });
});
