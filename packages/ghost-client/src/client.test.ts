import { describe, it, expect, vi, afterEach } from "vitest";
import { createGhostClient } from "./client";

const client = createGhostClient({
  ghostUrl: "http://localhost:2368",
  contentKey: "584d6551fd15aa54011b3c7334",
});

// Shaped like a real Content API response: snake_case throughout, with the
// extra fields Ghost sends that our types don't declare.
const rawAuthor = {
  id: "a1",
  name: "Abigail George",
  slug: "abigail",
  bio: null,
  profile_image: "https://blog.goldberrygrove.farm/content/images/abigail.jpg",
  cover_image: null,
  url: "https://blog.goldberrygrove.farm/author/abigail/",
};

const rawPost = {
  id: "p1",
  uuid: "u1",
  title: "Why we ship in dormancy",
  slug: "why-we-ship-in-dormancy",
  html: "<p>Roots travel asleep.</p>",
  excerpt: "Roots travel asleep.",
  feature_image: "https://blog.goldberrygrove.farm/content/images/2026/10/dormant.jpg",
  feature_image_alt: null,
  published_at: "2026-10-29T12:00:00.000Z",
  updated_at: "2026-10-29T12:00:00.000Z",
  reading_time: 3,
  authors: [rawAuthor],
  primary_author: rawAuthor,
  tags: [{ id: "t1", name: "Nursery", slug: "nursery", description: null }],
};

const rawPage = {
  id: "pg1",
  uuid: "u2",
  title: "About",
  slug: "about",
  html: "<p>Hi.</p>",
  feature_image: "https://blog.goldberrygrove.farm/content/images/about.jpg",
  published_at: "2026-10-29T12:00:00.000Z",
  updated_at: "2026-10-29T12:00:00.000Z",
};

function mockGhost(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createGhostClient maps Ghost's snake_case image fields", () => {
  it("posts.list exposes feature_image as featureImage", async () => {
    mockGhost({ posts: [rawPost] });
    const [post] = await client.posts.list();
    expect(post.featureImage).toBe(rawPost.feature_image);
    expect(post).not.toHaveProperty("feature_image");
    // Fields typed as Ghost sends them pass through untouched.
    expect(post.published_at).toBe(rawPost.published_at);
    expect(post.reading_time).toBe(3);
    expect(post.tags).toEqual(rawPost.tags);
  });

  it("posts.get exposes featureImage and maps embedded authors' profile_image", async () => {
    mockGhost({ posts: [rawPost] });
    const post = await client.posts.get("why-we-ship-in-dormancy");
    expect(post.featureImage).toBe(rawPost.feature_image);
    expect(post.authors[0].profileImage).toBe(rawAuthor.profile_image);
    expect(post.authors[0]).not.toHaveProperty("profile_image");
  });

  it("normalizes a post without a feature image to null", async () => {
    const { feature_image: _omit, ...noImage } = rawPost;
    mockGhost({ posts: [{ ...noImage, authors: undefined }] });
    const [post] = await client.posts.list();
    expect(post.featureImage).toBeNull();
    expect(post.authors).toEqual([]);
  });

  it("pages.get exposes feature_image as featureImage", async () => {
    mockGhost({ pages: [rawPage] });
    const page = await client.pages.get("about");
    expect(page.featureImage).toBe(rawPage.feature_image);
  });

  it("authors.list exposes profile_image as profileImage", async () => {
    mockGhost({ authors: [rawAuthor, { ...rawAuthor, id: "a2", profile_image: null }] });
    const authors = await client.authors.list();
    expect(authors.map((a) => a.profileImage)).toEqual([rawAuthor.profile_image, null]);
  });

  it("still 404s an empty slug lookup", async () => {
    mockGhost({ posts: [] });
    await expect(client.posts.get("missing")).rejects.toMatchObject({ status: 404 });
  });
});
