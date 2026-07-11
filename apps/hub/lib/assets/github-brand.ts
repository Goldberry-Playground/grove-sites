/**
 * GitHub REST adapters for the `@grove/brand` ingest seam (GOL-290 / GOL-92).
 *
 * `@grove/brand`'s `createAssetBrand` is dependency-free: it needs a `BrandRepo`
 * (read the current registry file) and a `PullRequestOpener` (open a PR carrying
 * the registry edit). This module supplies both against the GitHub REST API
 * using plain `fetch` — no Octokit dependency, so nothing new is added to the
 * monorepo's install graph and the adapter stays trivially unit-testable with a
 * fake `fetch`.
 *
 * The registry lives in this very repo (`packages/grove-brand/registry/<brand>.json`),
 * so the PR is opened against grove-sites itself. Repo coordinates and the auth
 * token come from the environment (broker-injected per ADR-0001); the token is a
 * secret and is never committed.
 */
import type { BrandRepo, PullRequestOpener } from "@grove/brand/ingest";

const GITHUB_API = "https://api.github.com";
const API_VERSION = "2022-11-28";

/** Minimal `fetch` surface so tests can inject a fake without a network. */
export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<Response>;

export interface GithubBrandConfig {
  /** `owner/repo`, e.g. `Goldberry-Playground/grove-sites`. */
  owner: string;
  repo: string;
  /** Base branch PRs target and registries are read from. Default `main`. */
  base: string;
  /** GitHub token with `contents:write` + `pull_requests:write` on the repo. */
  token: string;
}

/** Read `owner`, `repo`, `base`, and `token` from the environment. */
export function githubBrandConfigFromEnv(env: NodeJS.ProcessEnv = process.env): GithubBrandConfig {
  const slug = env.GROVE_BRAND_REPO ?? "Goldberry-Playground/grove-sites";
  const [owner, repo] = slug.split("/");
  const token = env.GROVE_BRAND_PR_TOKEN ?? env.GITHUB_TOKEN ?? "";
  if (!owner || !repo) {
    throw new Error(`github-brand: invalid GROVE_BRAND_REPO "${slug}" — expected "owner/repo"`);
  }
  if (!token) {
    throw new Error(
      "github-brand: missing GROVE_BRAND_PR_TOKEN (broker-injected per ADR-0001) — cannot open brand PRs",
    );
  }
  return { owner, repo, base: env.GROVE_BRAND_BASE ?? "main", token };
}

interface GhResponse {
  status: number;
  body: unknown;
}

function b64encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64");
}

function b64decode(value: string): string {
  // GitHub returns base64 with embedded newlines; Buffer tolerates them.
  return Buffer.from(value, "base64").toString("utf8");
}

/**
 * Build the `BrandRepo` + `PullRequestOpener` pair `createAssetBrand` expects,
 * backed by the GitHub REST API. `fetchImpl` defaults to the global `fetch`.
 */
export function createGithubBrandAdapters(
  config: GithubBrandConfig,
  fetchImpl: FetchLike = fetch,
): { repo: BrandRepo; pr: PullRequestOpener } {
  const base = `${GITHUB_API}/repos/${config.owner}/${config.repo}`;

  async function gh(method: string, path: string, body?: unknown): Promise<GhResponse> {
    const res = await fetchImpl(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": API_VERSION,
        "User-Agent": "grove-sites-assets-ingest",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    let parsed: unknown = null;
    const text = await res.text();
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
    return { status: res.status, body: parsed };
  }

  function fail(action: string, res: GhResponse): never {
    const message =
      res.body && typeof res.body === "object" && "message" in res.body
        ? String((res.body as { message: unknown }).message)
        : JSON.stringify(res.body);
    throw new Error(`github-brand: ${action} failed (${res.status}): ${message}`);
  }

  /** Current file SHA at `path` on `ref`, or `null` if the file does not exist. */
  async function fileSha(path: string, ref: string): Promise<string | null> {
    const res = await gh("GET", `/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`);
    if (res.status === 404) return null;
    if (res.status !== 200) fail(`read file sha for ${path}`, res);
    const sha = (res.body as { sha?: unknown }).sha;
    return typeof sha === "string" ? sha : null;
  }

  const repo: BrandRepo = {
    async readRegistry(path: string): Promise<string | null> {
      const res = await gh(
        "GET",
        `/contents/${encodePath(path)}?ref=${encodeURIComponent(config.base)}`,
      );
      if (res.status === 404) return null;
      if (res.status !== 200) fail(`read registry ${path}`, res);
      const content = (res.body as { content?: unknown }).content;
      if (typeof content !== "string") {
        throw new Error(`github-brand: registry ${path} had no base64 content`);
      }
      return b64decode(content);
    },
  };

  const pr: PullRequestOpener = {
    async openPullRequest(input) {
      // 1. Resolve the base branch head SHA.
      const baseRef = await gh(
        "GET",
        `/git/ref/heads/${encodeURIComponent(config.base)}`,
      );
      if (baseRef.status !== 200) fail(`resolve base ref ${config.base}`, baseRef);
      const baseSha = (baseRef.body as { object?: { sha?: unknown } }).object?.sha;
      if (typeof baseSha !== "string") {
        throw new Error("github-brand: base ref response missing object.sha");
      }

      // 2. Create the head branch. A pre-existing branch (422) is fine — a retry
      //    of the same ingest just re-commits onto it.
      const createRef = await gh("POST", "/git/refs", {
        ref: `refs/heads/${input.branch}`,
        sha: baseSha,
      });
      if (createRef.status !== 201 && createRef.status !== 422) {
        fail(`create branch ${input.branch}`, createRef);
      }

      // 3. Write each file change onto the head branch.
      for (const change of input.changes) {
        const existingSha = await fileSha(change.path, input.branch);
        const put = await gh("PUT", `/contents/${encodePath(change.path)}`, {
          message: input.commitMessage,
          content: b64encode(change.content),
          branch: input.branch,
          ...(existingSha ? { sha: existingSha } : {}),
        });
        if (put.status !== 200 && put.status !== 201) {
          fail(`write ${change.path}`, put);
        }
      }

      // 4. Open the PR. If one already exists for this head, reuse it.
      const created = await gh("POST", "/pulls", {
        title: input.title,
        head: input.branch,
        base: config.base,
        body: input.body,
      });
      if (created.status === 201) {
        return { prUrl: htmlUrl(created.body) };
      }
      if (created.status === 422) {
        const existing = await gh(
          "GET",
          `/pulls?head=${encodeURIComponent(`${config.owner}:${input.branch}`)}&state=open`,
        );
        if (existing.status === 200 && Array.isArray(existing.body) && existing.body.length > 0) {
          return { prUrl: htmlUrl(existing.body[0]) };
        }
        fail(`open PR for ${input.branch}`, created);
      }
      return fail(`open PR for ${input.branch}`, created);
    },
  };

  return { repo, pr };
}

/** Encode a repo-relative path for a `/contents/` URL, preserving slashes. */
function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function htmlUrl(body: unknown): string {
  const url = (body as { html_url?: unknown } | null)?.html_url;
  if (typeof url !== "string") {
    throw new Error("github-brand: PR response missing html_url");
  }
  return url;
}
