import { describe, it, expect, vi, afterEach } from "vitest";
import {
  DiscordApiError,
  MAX_RATE_LIMIT_WAIT_MS,
  createInteractionFollowup,
  editChannelMessage,
  editInteractionOriginal,
  getChannelMessage,
  postChannelMessage,
} from "./discord";
import { DISCORD_API_BASE } from "./config";
import type { DiscordMessage } from "./render";

// A minimal ok Response + a fetch spy so we can assert the exact URL each helper
// builds. The security contract (GOL-1318 / CodeQL js/request-forgery alert 530)
// is that untrusted path segments — channel id, app id, interaction token — are
// percent-encoded at the sink, so a value like `../../channels/N/messages` can
// never re-point the request at a different Discord API endpoint.
function okFetch() {
  return vi.fn(async () => new Response("", { status: 200 })) as unknown as typeof fetch;
}

const MSG: DiscordMessage = { embeds: [], components: [] };

describe("discord REST helpers — URL-path encoding (request-forgery guard)", () => {
  it("postChannelMessage encodes the channel id", async () => {
    const fetchImpl = okFetch();
    await postChannelMessage("bot", "12345", MSG, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith(
      `${DISCORD_API_BASE}/channels/12345/messages`,
      expect.anything(),
    );
  });

  it("postChannelMessage neutralises a path-traversal channel id", async () => {
    const fetchImpl = okFetch();
    await postChannelMessage("bot", "../../channels/999", MSG, fetchImpl);
    const url = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    // The malicious segment stays inside the /channels/<seg>/messages slot.
    expect(url).toBe(`${DISCORD_API_BASE}/channels/${encodeURIComponent("../../channels/999")}/messages`);
    expect(url).not.toContain("/channels/../../channels/999/messages");
  });

  it("editInteractionOriginal encodes appId and interactionToken", async () => {
    const fetchImpl = okFetch();
    await editInteractionOriginal("app 1", "tok/../evil", MSG, fetchImpl);
    const url = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toBe(
      `${DISCORD_API_BASE}/webhooks/${encodeURIComponent("app 1")}/${encodeURIComponent("tok/../evil")}/messages/@original`,
    );
    expect(url).not.toContain("tok/../evil");
  });
});

describe("channel messages", () => {
  const replies = (...r: Response[]) => {
    const fn = vi.fn();
    for (const res of r) fn.mockResolvedValueOnce(res);
    return fn as unknown as typeof fetch;
  };
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

  it("postChannelMessage returns the new message's id", async () => {
    expect(await postChannelMessage("bot", "1", MSG, replies(json(200, { id: "555" })))).toBe("555");
  });

  it("postChannelMessage still succeeds when the reply has no id", async () => {
    expect(await postChannelMessage("bot", "1", MSG, replies(new Response("", { status: 200 })))).toBeUndefined();
  });

  it("editChannelMessage PATCHes that message with the bot token, encoding the path", async () => {
    const fetchImpl = replies(json(200, { id: "555" }));
    await editChannelMessage("bot", "1/2", "3/4", MSG, fetchImpl);
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(`${DISCORD_API_BASE}/channels/1%2F2/messages/3%2F4`);
    expect(init.method).toBe("PATCH");
    expect(init.headers.Authorization).toBe("Bot bot");
  });

  it("a failed edit throws with the HTTP status", async () => {
    const error = await editChannelMessage("bot", "1", "2", MSG, replies(json(404, { code: 10008 }))).catch((e) => e);
    expect(error).toBeInstanceOf(DiscordApiError);
    expect(error.status).toBe(404);
  });

  it("getChannelMessage reads the message", async () => {
    const fetchImpl = replies(json(200, { id: "2", embeds: [] }));
    expect(await getChannelMessage("bot", "1", "2", fetchImpl)).toEqual({ id: "2", embeds: [] });
    const [url] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(`${DISCORD_API_BASE}/channels/1/messages/2`);
  });
});

describe("Discord rate limits", () => {
  afterEach(() => vi.useRealTimers());
  const limited = (retryAfter: number) => new Response(JSON.stringify({ retry_after: retryAfter }), { status: 429 });
  const ok = () => new Response("{}", { status: 200 });
  const calls = (...r: Response[]) => {
    const fn = vi.fn();
    for (const res of r) fn.mockResolvedValueOnce(res);
    return fn;
  };
  const senders: Array<[string, (f: typeof fetch) => Promise<unknown>]> = [
    ["postChannelMessage", (f) => postChannelMessage("bot", "1", MSG, f)],
    ["editChannelMessage", (f) => editChannelMessage("bot", "1", "2", MSG, f)],
    ["editInteractionOriginal", (f) => editInteractionOriginal("app", "tok", MSG, f)],
    ["createInteractionFollowup", (f) => createInteractionFollowup("app", "tok", "hello", true, f)],
  ];

  it.each(senders)("%s waits for retry_after and retries once", async (_name, send) => {
    vi.useFakeTimers();
    const fetchImpl = calls(limited(2), ok());
    const pending = send(fetchImpl as unknown as typeof fetch);
    await vi.advanceTimersByTimeAsync(1999);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("caps the wait so a request cannot hang", async () => {
    vi.useFakeTimers();
    const fetchImpl = calls(limited(3600), ok());
    const pending = postChannelMessage("bot", "1", MSG, fetchImpl as unknown as typeof fetch);
    await vi.advanceTimersByTimeAsync(MAX_RATE_LIMIT_WAIT_MS);
    await pending;
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("gives up after the one retry", async () => {
    vi.useFakeTimers();
    const fetchImpl = calls(limited(0.01), limited(0.01));
    const pending = postChannelMessage("bot", "1", MSG, fetchImpl as unknown as typeof fetch).catch((e) => e);
    await vi.advanceTimersByTimeAsync(10);
    const error = await pending;
    expect(error).toBeInstanceOf(DiscordApiError);
    expect(error.status).toBe(429);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
