/**
 * Minimal Buffer GraphQL client (insights read + Phase 2 draft create).
 *
 * Endpoint + schema verified live against `cmo_buffer_key` in 1P Grove Infra:
 *  - read (2026-07-11): `channels` / `aggregatedPostMetrics` / `posts`.
 *  - write (2026-07-20, GOL-590): the SAME token carries draft scope on the new
 *    GraphQL API — `createPost(... saveToDraft:true)` stages a draft and never
 *    publishes. No separate write token / OAuth app is needed. `createDraft`
 *    below is the ONLY mutation this client performs, and it is draft-only.
 * Uses the global `fetch` (Node 22+) — no external deps.
 */
import { BUFFER_GRAPHQL_URL } from "./config.ts";
import { engagements as sumEngagements, impressions as pickImpressions } from "./metrics.ts";
import type { BufferChannel, BufferMetric, TopPost } from "./types.ts";

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

/** How many recent sent posts to scan when picking a channel's top post. */
const TOP_POST_SCAN = 50;

export class BufferClient {
  private readonly token: string;
  private readonly orgId: string;
  private readonly fetchImpl: typeof fetch;

  // NOTE: explicit field assignment (not TS parameter properties) so the
  // entrypoints run under Node's strip-only TypeScript support, which rejects
  // parameter properties.
  constructor(token: string, orgId: string, fetchImpl: typeof fetch = fetch) {
    this.token = token;
    this.orgId = orgId;
    this.fetchImpl = fetchImpl;
  }

  private async query<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const res = await this.fetchImpl(BUFFER_GRAPHQL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) {
      throw new Error(`Buffer HTTP ${res.status}: ${await safeText(res)}`);
    }
    const json = (await res.json()) as GraphQLResponse<T>;
    if (json.errors?.length) {
      throw new Error(`Buffer GraphQL error: ${json.errors.map((e) => e.message).join("; ")}`);
    }
    if (!json.data) throw new Error("Buffer GraphQL: empty data");
    return json.data;
  }

  /**
   * Create a DRAFT post on a single Buffer channel (Phase 2 approval loop).
   *
   * Mutation shape validated live against `api.buffer.com` in GOL-590
   * (2026-07-20): `createPost` returns a union — `PostActionSuccess { post }`
   * on success, `MutationError { message }` on a business error. `saveToDraft`
   * pins it to draft-only; `schedulingType`/`mode` are the enum literals the
   * live test proved. Post text is passed as a `$text` variable so it can never
   * break out of the query; `channelId` comes from {@link listChannels} (a
   * trusted Buffer id) and is validated before interpolation.
   */
  async createDraft(text: string, channelId: string): Promise<{ id: string; status: string }> {
    if (!/^[A-Za-z0-9]+$/.test(channelId)) {
      throw new Error(`Buffer createDraft: unsafe channelId ${JSON.stringify(channelId)}`);
    }
    const data = await this.query<{
      createPost:
        | { __typename: "PostActionSuccess"; post: { id: string; status: string } }
        | { __typename: "MutationError"; message: string }
        | Record<string, unknown>;
    }>(
      `mutation CreateDraft($text: String!) {
        createPost(input: {
          text: $text,
          channelId: "${channelId}",
          schedulingType: automatic,
          mode: addToQueue,
          saveToDraft: true
        }) {
          __typename
          ... on PostActionSuccess { post { id status } }
          ... on MutationError { message }
        }
      }`,
      { text },
    );
    const result = data.createPost as {
      __typename?: string;
      post?: { id: string; status: string };
      message?: string;
    };
    if (result?.post?.id) return result.post;
    throw new Error(`Buffer createDraft failed: ${result?.message ?? "unexpected response"}`);
  }

  /** All connected channels for the org. */
  async listChannels(): Promise<BufferChannel[]> {
    const data = await this.query<{ channels: BufferChannel[] }>(
      `query($input: ChannelsInput!) { channels(input: $input) { id service name } }`,
      { input: { organizationId: this.orgId } },
    );
    return data.channels ?? [];
  }

  /** Aggregated metrics for one channel over [start, end] (ISO-8601 UTC). */
  async aggregatedMetrics(channelId: string, start: string, end: string): Promise<BufferMetric[]> {
    const data = await this.query<{ aggregatedPostMetrics: { metrics: BufferMetric[] } }>(
      `query($input: AggregatedPostMetricsInput!) {
        aggregatedPostMetrics(input: $input) { metrics { type name value unit } }
      }`,
      {
        input: {
          organizationId: this.orgId,
          startDateTime: start,
          endDateTime: end,
          channelIds: [channelId],
        },
      },
    );
    return data.aggregatedPostMetrics?.metrics ?? [];
  }

  /**
   * Best-performing sent post for a channel in [start, end], by engagement.
   * Best-effort: scans the most recent {@link TOP_POST_SCAN} sent posts and
   * filters by `sentAt`. For very high-volume 90-day windows this may not see
   * every post, so it can under-report the all-time top — acceptable for a
   * highlight. Returns null on any error so the digest never breaks.
   */
  async topPost(channelId: string, start: string, end: string): Promise<TopPost | null> {
    try {
      const startMs = Date.parse(start);
      const endMs = Date.parse(end);
      const data = await this.query<{
        posts: {
          edges: Array<{
            node: {
              sentAt: string | null;
              text: string | null;
              externalLink: string | null;
              metrics: BufferMetric[] | null;
            };
          }>;
        };
      }>(
        `query($input: PostsInput!, $first: Int) {
          posts(input: $input, first: $first) {
            edges { node { sentAt text externalLink metrics { type value } } }
          }
        }`,
        {
          input: {
            organizationId: this.orgId,
            filter: { channelIds: [channelId], status: ["sent"] },
          },
          first: TOP_POST_SCAN,
        },
      );

      let best: TopPost | null = null;
      let bestEng = -1;
      for (const { node } of data.posts?.edges ?? []) {
        if (!node.sentAt) continue;
        const t = Date.parse(node.sentAt);
        if (Number.isNaN(t) || t < startMs || t > endMs) continue;
        const metrics = node.metrics ?? [];
        const eng = sumEngagements(metrics);
        if (eng > bestEng) {
          bestEng = eng;
          best = {
            text_preview: truncate(node.text ?? "", 140),
            permalink: node.externalLink ?? "",
            published_at: node.sentAt,
            impressions: pickImpressions(metrics),
            engagements: eng,
          };
        }
      }
      return best;
    } catch {
      return null;
    }
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return "<no body>";
  }
}

function truncate(s: string, max: number): string {
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}
