import { describe, it, expect } from "vitest";
import {
  createGithubBrandAdapters,
  githubBrandConfigFromEnv,
  type FetchLike,
  type GithubBrandConfig,
} from "./github-brand";

const CONFIG: GithubBrandConfig = {
  owner: "Goldberry-Playground",
  repo: "grove-sites",
  base: "main",
  token: "gh-token",
};

interface Call {
  method: string;
  url: string;
  body: unknown;
}

/** A fake `fetch` that dispatches on `${method} ${pathname}` to canned responses. */
function fakeFetch(
  routes: Record<string, (call: Call) => { status: number; body?: unknown }>,
): { fetchImpl: FetchLike; calls: Call[] } {
  const calls: Call[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(init.body) : undefined;
    calls.push({ method, url, body });
    const pathname = new URL(url).pathname;
    const key = `${method} ${pathname}`;
    const handler = routes[key];
    if (!handler) throw new Error(`unexpected request: ${key}`);
    const { status, body: resBody } = handler(calls[calls.length - 1]);
    return new Response(resBody === undefined ? "" : JSON.stringify(resBody), { status });
  };
  return { fetchImpl, calls };
}

describe("githubBrandConfigFromEnv", () => {
  it("parses owner/repo and reads the token", () => {
    const cfg = githubBrandConfigFromEnv({
      GROVE_BRAND_REPO: "acme/site",
      GROVE_BRAND_PR_TOKEN: "tok",
    });
    expect(cfg).toEqual({ owner: "acme", repo: "site", base: "main", token: "tok" });
  });

  it("defaults the repo and honors GROVE_BRAND_BASE", () => {
    const cfg = githubBrandConfigFromEnv({ GITHUB_TOKEN: "tok", GROVE_BRAND_BASE: "trunk" });
    expect(cfg.owner).toBe("Goldberry-Playground");
    expect(cfg.repo).toBe("grove-sites");
    expect(cfg.base).toBe("trunk");
  });

  it("throws when no token is present", () => {
    expect(() => githubBrandConfigFromEnv({})).toThrow(/GROVE_BRAND_PR_TOKEN/);
  });
});

describe("BrandRepo.readRegistry", () => {
  it("decodes base64 content on 200", async () => {
    const payload = JSON.stringify({ brand: "goldberry", assets: [] });
    const { fetchImpl } = fakeFetch({
      "GET /repos/Goldberry-Playground/grove-sites/contents/packages/grove-brand/registry/goldberry.json":
        () => ({ status: 200, body: { content: Buffer.from(payload).toString("base64") } }),
    });
    const { repo } = createGithubBrandAdapters(CONFIG, fetchImpl);
    const out = await repo.readRegistry("packages/grove-brand/registry/goldberry.json");
    expect(out).toBe(payload);
  });

  it("returns null on 404", async () => {
    const { fetchImpl } = fakeFetch({
      "GET /repos/Goldberry-Playground/grove-sites/contents/packages/grove-brand/registry/nursery.json":
        () => ({ status: 404, body: { message: "Not Found" } }),
    });
    const { repo } = createGithubBrandAdapters(CONFIG, fetchImpl);
    expect(await repo.readRegistry("packages/grove-brand/registry/nursery.json")).toBeNull();
  });
});

describe("PullRequestOpener.openPullRequest", () => {
  it("creates the branch, writes files, and opens a PR", async () => {
    const { fetchImpl, calls } = fakeFetch({
      "GET /repos/Goldberry-Playground/grove-sites/git/ref/heads/main": () => ({
        status: 200,
        body: { object: { sha: "basesha" } },
      }),
      "POST /repos/Goldberry-Playground/grove-sites/git/refs": () => ({ status: 201, body: {} }),
      "GET /repos/Goldberry-Playground/grove-sites/contents/packages/grove-brand/registry/goldberry.json":
        () => ({ status: 404, body: {} }),
      "PUT /repos/Goldberry-Playground/grove-sites/contents/packages/grove-brand/registry/goldberry.json":
        () => ({ status: 201, body: {} }),
      "POST /repos/Goldberry-Playground/grove-sites/pulls": () => ({
        status: 201,
        body: { html_url: "https://github.com/Goldberry-Playground/grove-sites/pull/42" },
      }),
    });
    const { pr } = createGithubBrandAdapters(CONFIG, fetchImpl);
    const out = await pr.openPullRequest({
      branch: "brand/logo/goldberry-mark",
      title: "brand(goldberry): Add logo entry mark",
      body: "body",
      commitMessage: "brand(goldberry): Add logo entry mark",
      changes: [{ path: "packages/grove-brand/registry/goldberry.json", content: "{}\n" }],
    });
    expect(out.prUrl).toBe("https://github.com/Goldberry-Playground/grove-sites/pull/42");

    // Branch ref created off the base SHA.
    const refCall = calls.find((c) => c.url.endsWith("/git/refs"));
    expect(refCall?.body).toMatchObject({ ref: "refs/heads/brand/logo/goldberry-mark", sha: "basesha" });

    // File written with base64 content and no sha (new file).
    const putCall = calls.find((c) => c.method === "PUT");
    expect(putCall?.body).toMatchObject({ branch: "brand/logo/goldberry-mark" });
    expect((putCall?.body as { sha?: string }).sha).toBeUndefined();
    expect(Buffer.from((putCall?.body as { content: string }).content, "base64").toString()).toBe("{}\n");

    // PR targets the base branch.
    const prCall = calls.find((c) => c.url.endsWith("/pulls") && c.method === "POST");
    expect(prCall?.body).toMatchObject({ head: "brand/logo/goldberry-mark", base: "main" });
  });

  it("passes the existing file sha when updating a registry that already exists", async () => {
    const { fetchImpl, calls } = fakeFetch({
      "GET /repos/Goldberry-Playground/grove-sites/git/ref/heads/main": () => ({
        status: 200,
        body: { object: { sha: "basesha" } },
      }),
      "POST /repos/Goldberry-Playground/grove-sites/git/refs": () => ({
        status: 422,
        body: { message: "Reference already exists" },
      }),
      "GET /repos/Goldberry-Playground/grove-sites/contents/packages/grove-brand/registry/goldberry.json":
        () => ({ status: 200, body: { sha: "oldfilesha" } }),
      "PUT /repos/Goldberry-Playground/grove-sites/contents/packages/grove-brand/registry/goldberry.json":
        () => ({ status: 200, body: {} }),
      "POST /repos/Goldberry-Playground/grove-sites/pulls": () => ({
        status: 201,
        body: { html_url: "https://github.com/o/r/pull/9" },
      }),
    });
    const { pr } = createGithubBrandAdapters(CONFIG, fetchImpl);
    await pr.openPullRequest({
      branch: "brand/logo/goldberry-mark",
      title: "t",
      body: "b",
      commitMessage: "c",
      changes: [{ path: "packages/grove-brand/registry/goldberry.json", content: "{}\n" }],
    });
    const putCall = calls.find((c) => c.method === "PUT");
    expect((putCall?.body as { sha?: string }).sha).toBe("oldfilesha");
  });

  it("reuses the open PR when GitHub reports one already exists (422)", async () => {
    const { fetchImpl } = fakeFetch({
      "GET /repos/Goldberry-Playground/grove-sites/git/ref/heads/main": () => ({
        status: 200,
        body: { object: { sha: "basesha" } },
      }),
      "POST /repos/Goldberry-Playground/grove-sites/git/refs": () => ({ status: 422, body: {} }),
      "GET /repos/Goldberry-Playground/grove-sites/contents/packages/grove-brand/registry/goldberry.json":
        () => ({ status: 404, body: {} }),
      "PUT /repos/Goldberry-Playground/grove-sites/contents/packages/grove-brand/registry/goldberry.json":
        () => ({ status: 201, body: {} }),
      "POST /repos/Goldberry-Playground/grove-sites/pulls": () => ({
        status: 422,
        body: { message: "A pull request already exists" },
      }),
      "GET /repos/Goldberry-Playground/grove-sites/pulls": () => ({
        status: 200,
        body: [{ html_url: "https://github.com/o/r/pull/3" }],
      }),
    });
    const { pr } = createGithubBrandAdapters(CONFIG, fetchImpl);
    const out = await pr.openPullRequest({
      branch: "brand/logo/goldberry-mark",
      title: "t",
      body: "b",
      commitMessage: "c",
      changes: [{ path: "packages/grove-brand/registry/goldberry.json", content: "{}\n" }],
    });
    expect(out.prUrl).toBe("https://github.com/o/r/pull/3");
  });

  it("throws with a useful message on an unexpected error", async () => {
    const { fetchImpl } = fakeFetch({
      "GET /repos/Goldberry-Playground/grove-sites/git/ref/heads/main": () => ({
        status: 500,
        body: { message: "server error" },
      }),
    });
    const { pr } = createGithubBrandAdapters(CONFIG, fetchImpl);
    await expect(
      pr.openPullRequest({
        branch: "b",
        title: "t",
        body: "b",
        commitMessage: "c",
        changes: [],
      }),
    ).rejects.toThrow(/resolve base ref main failed \(500\): server error/);
  });
});