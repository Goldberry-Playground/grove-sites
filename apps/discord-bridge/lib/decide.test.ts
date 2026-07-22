import { describe, it, expect, vi } from "vitest";
import { executeDecision, executeRevise, type BufferLike, type DecideDeps } from "./decide";
import { buildApprovalCard } from "./approval";
import type { BufferChannel } from "./types";

const CHANNELS: BufferChannel[] = [
  { id: "chThreads", service: "threads", name: "Grove Threads" },
  { id: "chIg", service: "instagram", name: "Grove IG" },
  { id: "chFb", service: "facebook", name: "Grove FB" },
];

function mockBuffer(): BufferLike & { drafts: Array<{ text: string; channelId: string }> } {
  const drafts: Array<{ text: string; channelId: string }> = [];
  return {
    drafts,
    async listChannels() {
      return CHANNELS;
    },
    async createDraft(text, channelId) {
      drafts.push({ text, channelId });
      return { id: `draft_${drafts.length}`, status: "draft" };
    },
  };
}

const card = buildApprovalCard({
  id: "cs_1",
  content: "Chestnuts feed the forest.",
  targets: ["threads", "instagram"],
  species: ["American chestnut"],
  places: ["Appalachia"],
  practices: ["forest farming"],
});

function deps(buffer: BufferLike, extra?: Partial<DecideDeps>): DecideDeps {
  return { buffer, mirror: {}, now: "2026-07-22T20:00:00.000Z", ...extra };
}

describe("executeDecision — approve", () => {
  it("creates one draft per target with platform-capped hashtags", async () => {
    const buffer = mockBuffer();
    const { card: edited, event } = await executeDecision(
      { decision: "approve", suggestionId: "cs_1", actor: "u1", message: card },
      deps(buffer),
    );
    expect(buffer.drafts.map((d) => d.channelId)).toEqual(["chThreads", "chIg"]);
    // Threads capped at 3 tags, Instagram allows up to 6 (pool has 4).
    expect(buffer.drafts[0].text.split("\n\n")[1].split(" ")).toHaveLength(3);
    expect(buffer.drafts[1].text.split("\n\n")[1].split(" ")).toHaveLength(4);
    expect(event.action).toBe("content_approved");
    expect(event.buffer_draft_ids).toEqual(["draft_1", "draft_2"]);
    expect(event.platforms).toEqual(["threads", "instagram"]);
    expect(event.publish_mode).toBe("draft_only");
    expect(edited.components).toEqual([]);
  });
});

describe("executeDecision — resilient per-platform failure (GOL-714)", () => {
  // Buffer rejects a text-only Instagram draft (needs media + a post type). One
  // bad target must not abort the whole approve: Threads still drafts, the audit
  // still emits, and the failure is recorded — never a partial+audit-less state.
  function igRejectingBuffer(): BufferLike & { drafts: Array<{ text: string; channelId: string }> } {
    const drafts: Array<{ text: string; channelId: string }> = [];
    return {
      drafts,
      async listChannels() {
        return CHANNELS;
      },
      async createDraft(text, channelId) {
        if (channelId === "chIg") {
          throw new Error(
            "Buffer createDraft failed: Invalid post: Instagram posts require at least one image or video.,\nInstagram posts require a type (post, story, or reel).",
          );
        }
        drafts.push({ text, channelId });
        return { id: `draft_${drafts.length}`, status: "draft" };
      },
    };
  }

  it("drafts the platforms that succeed, records the failure, and still audits", async () => {
    const buffer = igRejectingBuffer();
    const { card: edited, event } = await executeDecision(
      { decision: "approve", suggestionId: "cs_1", actor: "u1", message: card },
      deps(buffer),
    );
    // Threads drafted; Instagram skipped — not thrown.
    expect(buffer.drafts.map((d) => d.channelId)).toEqual(["chThreads"]);
    expect(event.action).toBe("content_approved");
    expect(event.buffer_draft_ids).toEqual(["draft_1"]);
    expect(event.platforms).toEqual(["threads"]);
    expect(event.failed_platforms).toEqual(["instagram"]);
    expect(event.publish_mode).toBe("draft_only");
    // Card is still the terminal (buttons removed) card, footer notes the skip.
    expect(edited.components).toEqual([]);
    expect(edited.embeds?.[0].footer?.text).toContain("instagram");
  });

  it("all targets failing still emits an audit with no drafts (never throws)", async () => {
    const buffer: BufferLike = {
      async listChannels() {
        return CHANNELS;
      },
      async createDraft() {
        throw new Error("Buffer GraphQL error: RATE_LIMIT_EXCEEDED — retry after 24h");
      },
    };
    const { event } = await executeDecision(
      { decision: "approve", suggestionId: "cs_1", actor: "u1", message: card },
      deps(buffer),
    );
    expect(event.action).toBe("content_approved");
    expect(event.buffer_draft_ids).toEqual([]);
    expect(event.platforms).toEqual([]);
    expect(event.failed_platforms).toEqual(["threads", "instagram"]);
  });
});

describe("executeDecision — reject", () => {
  it("creates no drafts and audits the rejection", async () => {
    const buffer = mockBuffer();
    const { event } = await executeDecision(
      { decision: "reject", suggestionId: "cs_1", actor: "u1", message: card },
      deps(buffer),
    );
    expect(buffer.drafts).toHaveLength(0);
    expect(event.action).toBe("content_rejected");
  });
});

describe("executeRevise", () => {
  it("drafts the approver's verbatim text to each target channel", async () => {
    const buffer = mockBuffer();
    const { event } = await executeRevise(
      { suggestionId: "cs_1", actor: "u1", targets: ["threads"], text: "My edited post #TreeFacts", message: card },
      deps(buffer),
    );
    expect(buffer.drafts).toEqual([{ text: "My edited post #TreeFacts", channelId: "chThreads" }]);
    expect(event.action).toBe("content_revised");
  });
});

describe("audit mirror", () => {
  it("posts to Paperclip when configured, and never on missing config", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 201 })) as unknown as typeof fetch;

    const buffer = mockBuffer();
    await executeDecision(
      { decision: "reject", suggestionId: "cs_1", actor: "u1", message: card },
      deps(buffer, { mirror: {}, fetchImpl }),
    );
    expect(fetchImpl).not.toHaveBeenCalled();

    await executeDecision(
      { decision: "reject", suggestionId: "cs_1", actor: "u1", message: card },
      deps(buffer, {
        mirror: { bridgeKey: "k", auditIssueId: "GOL-999", apiBase: "http://localhost:3100" },
        fetchImpl,
      }),
    );
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("http://localhost:3100/api/issues/GOL-999/comments");
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer k" });
  });
});
