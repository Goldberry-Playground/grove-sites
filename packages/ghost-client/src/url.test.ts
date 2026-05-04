import { describe, it, expect } from "vitest";
import { buildUrl } from "./url";

const config = {
  ghostUrl: "http://localhost:2368",
  contentKey: "584d6551fd15aa54011b3c7334",
};

describe("buildUrl", () => {
  it("constructs a posts list URL with the content key", () => {
    const url = buildUrl(config, "posts");
    expect(url).toBe(
      "http://localhost:2368/ghost/api/content/posts/?key=584d6551fd15aa54011b3c7334",
    );
  });

  it("appends query params after the key", () => {
    const url = buildUrl(config, "posts", { limit: 10, page: 2 });
    expect(url).toContain("key=584d6551fd15aa54011b3c7334");
    expect(url).toContain("limit=10");
    expect(url).toContain("page=2");
  });

  it("skips undefined params (caller can pass optional fields)", () => {
    const url = buildUrl(config, "posts", { limit: 10, filter: undefined });
    expect(url).not.toContain("filter=");
    expect(url).toContain("limit=10");
  });

  it("URL-encodes filter values that include reserved characters", () => {
    const url = buildUrl(config, "posts", { filter: "tag:news+author:jane" });
    // URLSearchParams encodes + as %2B and : as %3A
    expect(url).toMatch(/filter=tag%3Anews%2Bauthor%3Ajane/);
  });

  it("constructs a slug-based detail URL when given a nested resource path", () => {
    const url = buildUrl(config, "posts/slug/coming-soon", { include: "tags,authors" });
    expect(url).toContain("/ghost/api/content/posts/slug/coming-soon/");
    expect(url).toContain("include=tags%2Cauthors");
  });

  it("does NOT silently drop the contentKey if empty (Ghost would 401 — surface the bug fast)", () => {
    const url = buildUrl({ ...config, contentKey: "" }, "posts");
    expect(url).toContain("key=");
    // Caller can grep for "key=&" and decide to fail loudly — buildUrl
    // itself stays a pure string builder.
  });

  it("converts numeric params to strings (URLSearchParams default behavior)", () => {
    const url = buildUrl(config, "posts", { limit: 50 });
    expect(url).toContain("limit=50");
  });
});
