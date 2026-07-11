import { describe, it, expect } from "vitest";
import { BufferClient } from "./buffer";

/** Build a fake `fetch` that returns queued JSON payloads and records requests. */
function fakeFetch(handler: (body: { query: string; variables: Record<string, unknown> }) => unknown) {
  const calls: Array<{ query: string; variables: Record<string, unknown> }> = [];
  const impl = (async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as {
      query: string;
      variables: Record<string, unknown>;
    };
    calls.push(body);
    const data = handler(body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ data }),
      text: async () => "",
    } as unknown as Response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("BufferClient", () => {
  it("lists channels for the configured org", async () => {
    const { impl, calls } = fakeFetch(() => ({
      channels: [{ id: "c1", service: "threads", name: "grove" }],
    }));
    const client = new BufferClient("tok", "org1", impl);
    const channels = await client.listChannels();
    expect(channels).toEqual([{ id: "c1", service: "threads", name: "grove" }]);
    expect(calls[0].variables).toMatchObject({ input: { organizationId: "org1" } });
  });

  it("passes window + channel to aggregatedPostMetrics and returns metrics", async () => {
    const { impl, calls } = fakeFetch(() => ({
      aggregatedPostMetrics: { metrics: [{ type: "views", value: 100 }] },
    }));
    const client = new BufferClient("tok", "org1", impl);
    const metrics = await client.aggregatedMetrics("c1", "2026-07-01T00:00:00.000Z", "2026-07-07T23:59:59.999Z");
    expect(metrics).toEqual([{ type: "views", value: 100 }]);
    expect(calls[0].variables).toMatchObject({
      input: { channelIds: ["c1"], startDateTime: "2026-07-01T00:00:00.000Z" },
    });
  });

  it("picks the highest-engagement post inside the window", async () => {
    const { impl } = fakeFetch(() => ({
      posts: {
        edges: [
          {
            node: {
              sentAt: "2026-07-03T10:00:00.000Z",
              text: "big one #TreeFacts",
              externalLink: "https://t/1",
              metrics: [{ type: "reactions", value: 500 }, { type: "views", value: 9000 }],
            },
          },
          {
            node: {
              sentAt: "2026-07-04T10:00:00.000Z",
              text: "small one",
              externalLink: "https://t/2",
              metrics: [{ type: "reactions", value: 5 }],
            },
          },
          {
            // outside the window — must be ignored
            node: {
              sentAt: "2026-06-01T10:00:00.000Z",
              text: "old huge",
              externalLink: "https://t/3",
              metrics: [{ type: "reactions", value: 99999 }],
            },
          },
        ],
      },
    }));
    const client = new BufferClient("tok", "org1", impl);
    const top = await client.topPost("c1", "2026-07-01T00:00:00.000Z", "2026-07-07T23:59:59.999Z");
    expect(top?.permalink).toBe("https://t/1");
    expect(top?.engagements).toBe(500);
    expect(top?.impressions).toBe(9000);
  });

  it("returns null top post on error instead of throwing", async () => {
    const impl = (async () => {
      throw new Error("network");
    }) as unknown as typeof fetch;
    const client = new BufferClient("tok", "org1", impl);
    expect(await client.topPost("c1", "2026-07-01T00:00:00.000Z", "2026-07-07T00:00:00.000Z")).toBeNull();
  });

  it("surfaces GraphQL errors", async () => {
    const impl = (async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({ errors: [{ message: "INSUFFICIENT_SCOPE" }] }),
        text: async () => "",
      }) as unknown as Response) as unknown as typeof fetch;
    const client = new BufferClient("tok", "org1", impl);
    await expect(client.listChannels()).rejects.toThrow(/INSUFFICIENT_SCOPE/);
  });
});
