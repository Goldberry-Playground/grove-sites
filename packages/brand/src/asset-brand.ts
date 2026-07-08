/**
 * The `AssetBrand` seam (ADR-009 Tier 4). This is the exact shape the AgenticOS
 * `#assets` ingest job injects (`packages/discord-plugin/src/assets/job.ts`).
 * When a logo-class asset is optimized+uploaded, the job hands us the resulting
 * CDN object and we open a PR that adds/updates the brand's typed entry.
 *
 * The two moving parts a runtime must provide — reading the current registry and
 * actually opening the PR — are injected (`BrandRepo`, `PullRequestOpener`) so
 * this package stays dependency-free and unit-testable with fakes (no Octokit,
 * no live GitHub). The runtime that wires the Discord plugin binds real
 * implementations; tests bind in-memory ones.
 */
import {
  emptyRegistry,
  parseRegistry,
  registryPath,
  renderRegistry,
  upsertBrandEntry,
  type BrandEntry,
  type UpsertKind,
} from "./model";
import { isKnownBrand, LOGO_CLASS, type Brand } from "./taxonomy";

/** Input to `proposeBrandEntry` — matches the injected seam in the ingest job. */
export interface ProposeBrandEntryInput {
  brand: string;
  slug: string;
  cdnUrl: string;
  key: string;
  caption: string;
}

/** The `@grove/brand` PR seam. Only invoked for logo-class assets (Tier 4). */
export interface AssetBrand {
  proposeBrandEntry(input: ProposeBrandEntryInput): Promise<{ prUrl: string }>;
}

/** Reads the current registry file for a brand (repo `main` HEAD). */
export interface BrandRepo {
  /** Return the file content at `path`, or `null` if it does not exist yet. */
  readRegistry(path: string): Promise<string | null>;
}

/** Opens a pull request carrying one or more file changes; returns its URL. */
export interface PullRequestOpener {
  openPullRequest(input: {
    branch: string;
    title: string;
    body: string;
    commitMessage: string;
    changes: { path: string; content: string }[];
  }): Promise<{ prUrl: string }>;
}

export interface CreateAssetBrandDeps {
  repo: BrandRepo;
  pr: PullRequestOpener;
  /** Injectable clock for `updatedAt`; defaults to wall-clock ISO time. */
  now?: () => string;
  /** Head-branch prefix for opened PRs. Default `brand/logo`. */
  branchPrefix?: string;
}

/**
 * Build an `AssetBrand` that records a logo entry in the brand's registry file
 * and opens a PR with the change. An identical re-entry is a no-op that still
 * returns a URL (the existing entry's — surfaced via the PR opener) so the
 * ingest job's reply is always meaningful; see `upsertBrandEntry`'s `unchanged`.
 */
export function createAssetBrand(deps: CreateAssetBrandDeps): AssetBrand {
  const now = deps.now ?? (() => new Date().toISOString());
  const branchPrefix = deps.branchPrefix ?? "brand/logo";

  return {
    async proposeBrandEntry(input) {
      const brand = normalizeBrand(input.brand);
      const slug = requireSlug(input.slug);

      const path = registryPath(brand);
      const current = await deps.repo.readRegistry(path);
      const registry = current ? parseRegistry(brand, current) : emptyRegistry(brand);

      const entry: BrandEntry = {
        brand,
        // The seam is only called on the logo lane; the class is fixed here.
        assetClass: LOGO_CLASS,
        slug,
        key: requireField("key", input.key),
        cdnUrl: requireField("cdnUrl", input.cdnUrl),
        caption: input.caption ?? "",
        updatedAt: now(),
      };

      const { registry: next, kind } = upsertBrandEntry(registry, entry);
      const content = renderRegistry(next);

      const { prUrl } = await deps.pr.openPullRequest({
        branch: `${branchPrefix}/${brand}-${slug}`,
        title: prTitle(brand, slug, kind),
        body: prBody(entry, kind),
        commitMessage: `${prTitle(brand, slug, kind)}\n\nCDN key: ${entry.key}`,
        changes: [{ path, content }],
      });

      return { prUrl };
    },
  };
}

function normalizeBrand(value: string): Brand {
  const brand = (value ?? "").trim().toLowerCase();
  if (!isKnownBrand(brand)) {
    throw new Error(`unknown brand "${value}" — expected one of the ADR-009 brand namespaces`);
  }
  return brand;
}

function requireSlug(value: string): string {
  const slug = (value ?? "").trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`invalid slug "${value}" — expected a non-empty kebab-case slug`);
  }
  return slug;
}

function requireField(field: string, value: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`missing "${field}" for brand entry`);
  }
  return value;
}

function prTitle(brand: Brand, slug: string, kind: UpsertKind): string {
  const verb = kind === "updated" || kind === "unchanged" ? "Update" : "Add";
  return `brand(${brand}): ${verb} logo entry ${slug}`;
}

function prBody(entry: BrandEntry, kind: UpsertKind): string {
  return [
    `Typed brand-entry (ADR-009 Tier 4) from the \`#assets\` lane.`,
    "",
    `- **Brand:** ${entry.brand}`,
    `- **Class:** ${entry.assetClass}`,
    `- **Slug:** ${entry.slug}`,
    `- **CDN URL:** ${entry.cdnUrl}`,
    `- **Key:** ${entry.key}`,
    `- **Caption:** ${entry.caption || "_(none)_"}`,
    `- **Change:** ${kind}`,
    "",
    `_Opened automatically by \`@grove/brand\` \`proposeBrandEntry\`._`,
  ].join("\n");
}
