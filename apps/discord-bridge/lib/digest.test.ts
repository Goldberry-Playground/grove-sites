import { describe, it, expect } from "vitest";
import { buildWeeklyDigest, serviceLabel } from "./digest";
import { resolveWindow } from "./period";
import type { ChannelStats } from "./types";

const window = resolveWindow("last7d", new Date("2026-07-08T12:00:00.000Z"));
const generatedAt = new Date("2026-07-08T12:00:00.000Z");

function stats(over: Partial<ChannelStats> & { channel: string }): ChannelStats {
  return {
    posts: 0,
    impressions: 0,
    engagements: 0,
    prevEngagements: null,
    topPost: null,
    ...over,
  };
}

describe("buildWeeklyDigest", () => {
  const input: ChannelStats[] = [
    stats({
      channel: "facebook",
      posts: 3,
      impressions: 2000,
      engagements: 120,
      prevEngagements: 100,
    }),
    stats({
      channel: "threads",
      posts: 9,
      impressions: 41200,
      engagements: 1830,
      prevEngagements: 1628,
      topPost: {
        text_preview: "This tree is 9,550 years old #TreeFacts",
        permalink: "https://www.threads.com/@goldberrygrove/post/abc",
        published_at: "2026-07-03T14:00:00.000Z",
        impressions: 12400,
        engagements: 640,
      },
    }),
    stats({ channel: "youtube", posts: 0, impressions: 0, engagements: 0 }),
  ];

  const digest = buildWeeklyDigest(input, window, generatedAt);

  it("ranks channels descending by engagements and leads with Threads", () => {
    expect(digest.channels.map((c) => c.channel)).toEqual(["threads", "facebook"]);
    expect(digest.channels[0].rank).toBe(1);
    expect(digest.channels[1].rank).toBe(2);
  });

  it("headline names the dominant channel and its engagement share", () => {
    // threads 1830 of (1830+120)=1950 => 94%
    expect(digest.headline).toContain("Threads did 94% of your engagement this week");
    expect(digest.headline).toContain("41,200 views across 9 posts");
  });

  it("computes engagement_rate and wow_delta per channel", () => {
    const t = digest.channels[0];
    expect(t.engagement_rate).toBeCloseTo(1830 / 41200, 5);
    expect(t.wow_delta_pct).toBeCloseTo(((1830 - 1628) / 1628) * 100, 3);
  });

  it("selects the single best post across channels and infers a #TreeFacts theme", () => {
    expect(digest.best_content?.channel).toBe("threads");
    expect(digest.best_content?.permalink).toContain("threads.com");
    expect(digest.best_content?.why).toMatch(/#TreeFacts/i);
  });

  it("flags zero-post channels in the watch item", () => {
    expect(digest.watch_item).toContain("YouTube posted 0");
  });

  it("makes zero demographic claims", () => {
    // The notes field disclaims demographics ("age/gender need Coupler"); every
    // OTHER field must be demographic-free — Buffer exposes no such data (GOL-227).
    expect(digest.notes).toMatch(/No demographic data/i);
    expect(JSON.stringify({ ...digest, notes: "" })).not.toMatch(/gender|female|male/i);
  });

  it("flags a >20% WoW drop on the lead channel", () => {
    const dropped = buildWeeklyDigest(
      [stats({ channel: "threads", posts: 5, impressions: 1000, engagements: 50, prevEngagements: 100 })],
      window,
      generatedAt,
    );
    expect(dropped.watch_item).toContain("Threads engagement down 50% WoW");
  });

  it("handles an empty period without throwing", () => {
    const empty = buildWeeklyDigest([], window, generatedAt);
    expect(empty.channels).toHaveLength(0);
    expect(empty.headline).toContain("No posts published");
    expect(empty.best_content).toBeNull();
  });
});

describe("serviceLabel", () => {
  it("maps known services to display names", () => {
    expect(serviceLabel("threads")).toBe("Threads");
    expect(serviceLabel("googlebusiness")).toBe("Google Business");
    expect(serviceLabel("mastodon")).toBe("Mastodon");
  });
});
