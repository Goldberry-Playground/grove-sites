import { describe, it, expect } from "vitest";
import { renderDigestMessage, renderTable } from "./render";
import type { WeeklyDigest } from "./types";

const digest: WeeklyDigest = {
  type: "weekly_digest",
  period: "2026-07-02..2026-07-08",
  generated_at: "2026-07-08T12:00:00.000Z",
  headline: "Threads did 94% of your engagement this week — 41,200 views across 9 posts.",
  channels: [
    {
      channel: "threads",
      rank: 1,
      posts: 9,
      impressions: 41200,
      engagements: 1830,
      engagement_rate: 0.0444,
      wow_delta_pct: 12.4,
      top_post: {
        text_preview: "This tree is 9,550 years old #TreeFacts",
        permalink: "https://www.threads.com/@goldberrygrove/post/abc",
        published_at: "2026-07-03T14:00:00.000Z",
        impressions: 12400,
        engagements: 640,
      },
    },
  ],
  best_content: {
    channel: "threads",
    permalink: "https://www.threads.com/@goldberrygrove/post/abc",
    why: "#TreeFacts — educational storytelling, our strongest pattern",
  },
  watch_item: "YouTube posted 0 this period.",
  notes: "No demographic data available via Buffer (age/gender need Coupler — GOL-227).",
};

describe("renderTable", () => {
  it("renders a monospace per-channel table with a header row", () => {
    const table = renderTable(digest);
    expect(table.startsWith("```")).toBe(true);
    expect(table).toContain("Channel");
    expect(table).toContain("Threads");
    expect(table).toContain("41,200");
    expect(table).toContain("+12%");
  });

  it("handles empty channels", () => {
    expect(renderTable({ ...digest, channels: [] })).toContain("no activity");
  });
});

describe("renderDigestMessage", () => {
  const msg = renderDigestMessage(digest, "last7d");

  it("uses the headline as the embed title", () => {
    expect(msg.embeds[0].title).toBe(digest.headline);
  });

  it("includes best-content link, watch item, and the demographic-free note", () => {
    const desc = msg.embeds[0].description;
    expect(desc).toContain("Best content");
    expect(desc).toContain(digest.best_content!.permalink);
    expect(desc).toContain("Watch");
    expect(desc).toContain("No demographic data");
  });

  it("offers the two non-current periods plus an Open-in-Buffer link button", () => {
    const buttons = msg.components[0].components;
    const labels = buttons.map((b) => b.label);
    expect(labels).toContain("Last 30d");
    expect(labels).toContain("Last 90d");
    expect(labels).not.toContain("Last 7d"); // current period is omitted
    const link = buttons.find((b) => b.style === 5);
    expect(link?.url).toContain("buffer.com");
    const custom = buttons.filter((b) => b.custom_id);
    expect(custom.map((b) => b.custom_id)).toEqual(["insights:last30d", "insights:last90d"]);
  });
});
