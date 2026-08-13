import { describe, it, expect, vi } from "vitest";
import { postChannelMessage, editInteractionOriginal } from "./discord";
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
