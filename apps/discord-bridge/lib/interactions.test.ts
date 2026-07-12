import { describe, it, expect } from "vitest";
import { routeInteraction, InteractionType, ResponseType } from "./interactions";

describe("routeInteraction", () => {
  it("answers PING with PONG", () => {
    const r = routeInteraction({ type: InteractionType.PING });
    expect(r.response.type).toBe(ResponseType.PONG);
    expect(r.followup).toBeUndefined();
  });

  it("defers /insights and carries the parsed period", () => {
    const r = routeInteraction({
      type: InteractionType.APPLICATION_COMMAND,
      data: { name: "insights", options: [{ name: "period", value: "last30d" }] },
    });
    expect(r.response.type).toBe(ResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE);
    expect(r.followup?.period).toBe("last30d");
  });

  it("defaults /insights to last7d when no period is given", () => {
    const r = routeInteraction({
      type: InteractionType.APPLICATION_COMMAND,
      data: { name: "insights" },
    });
    expect(r.followup?.period).toBe("last7d");
  });

  it("defers a period button and updates the message in place", () => {
    const r = routeInteraction({
      type: InteractionType.MESSAGE_COMPONENT,
      data: { custom_id: "insights:last90d" },
    });
    expect(r.response.type).toBe(ResponseType.DEFERRED_UPDATE_MESSAGE);
    expect(r.followup?.period).toBe("last90d");
  });

  it("replies ephemerally to unknown commands and actions", () => {
    const cmd = routeInteraction({
      type: InteractionType.APPLICATION_COMMAND,
      data: { name: "nope" },
    });
    expect(cmd.response.type).toBe(ResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    expect(cmd.response.data?.flags).toBe(64);
    expect(cmd.followup).toBeUndefined();

    const btn = routeInteraction({
      type: InteractionType.MESSAGE_COMPONENT,
      data: { custom_id: "somethingelse:x" },
    });
    expect(btn.response.data?.flags).toBe(64);
  });
});
