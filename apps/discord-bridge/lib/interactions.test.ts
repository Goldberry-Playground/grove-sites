import { describe, it, expect } from "vitest";
import { routeInteraction, InteractionType, ResponseType } from "./interactions";
import { buildApprovalCard, encodeAction, encodeModalId, REVISE_INPUT_ID } from "./approval";
import { MACY_DISCORD_ID } from "./allowlist";

const ctx = { approverIds: new Set([MACY_DISCORD_ID]) };
const macy = { member: { user: { id: MACY_DISCORD_ID } } };
const stranger = { member: { user: { id: "999999999999" } } };

const card = buildApprovalCard({
  id: "cs_1",
  content: "Chestnuts feed the forest.",
  targets: ["threads", "instagram"],
  species: ["American chestnut"],
});

describe("routeInteraction — Phase 1", () => {
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
    expect(r.followup).toMatchObject({ kind: "digest", period: "last30d" });
  });

  it("defaults /insights to last7d when no period is given", () => {
    const r = routeInteraction({
      type: InteractionType.APPLICATION_COMMAND,
      data: { name: "insights" },
    });
    expect(r.followup).toMatchObject({ kind: "digest", period: "last7d" });
  });

  it("defers a period button and updates the message in place", () => {
    const r = routeInteraction({
      type: InteractionType.MESSAGE_COMPONENT,
      data: { custom_id: "insights:last90d" },
    });
    expect(r.response.type).toBe(ResponseType.DEFERRED_UPDATE_MESSAGE);
    expect(r.followup).toMatchObject({ kind: "digest", period: "last90d" });
  });

  it("replies ephemerally to unknown commands and actions", () => {
    const cmd = routeInteraction({ type: InteractionType.APPLICATION_COMMAND, data: { name: "nope" } });
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

describe("routeInteraction — Phase 2 approval loop", () => {
  it("defers Approve for an allowlisted approver and carries card context", () => {
    const r = routeInteraction(
      { type: InteractionType.MESSAGE_COMPONENT, data: { custom_id: encodeAction("approve", "cs_1") }, message: card, ...macy },
      ctx,
    );
    expect(r.response.type).toBe(ResponseType.DEFERRED_UPDATE_MESSAGE);
    expect(r.followup).toMatchObject({ kind: "decision", decision: "approve", suggestionId: "cs_1", actor: MACY_DISCORD_ID });
  });

  it("denies a non-approver ephemerally with no followup", () => {
    const r = routeInteraction(
      { type: InteractionType.MESSAGE_COMPONENT, data: { custom_id: encodeAction("approve", "cs_1") }, message: card, ...stranger },
      ctx,
    );
    expect(r.response.type).toBe(ResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    expect(r.response.data?.flags).toBe(64);
    expect(r.followup).toBeUndefined();
  });

  it("opens a prefilled modal on Revise", () => {
    const r = routeInteraction(
      { type: InteractionType.MESSAGE_COMPONENT, data: { custom_id: encodeAction("revise", "cs_1") }, message: card, ...macy },
      ctx,
    );
    expect(r.response.type).toBe(ResponseType.MODAL);
    const input = (r.response.data as any).components[0].components[0];
    expect(input.custom_id).toBe(REVISE_INPUT_ID);
    expect(input.value).toContain("Chestnuts feed the forest.");
    expect(input.value).toContain("#TreeFacts");
    expect(r.followup).toBeUndefined();
  });

  it("defers Reject for an approver", () => {
    const r = routeInteraction(
      { type: InteractionType.MESSAGE_COMPONENT, data: { custom_id: encodeAction("reject", "cs_1") }, message: card, ...macy },
      ctx,
    );
    expect(r.followup).toMatchObject({ kind: "decision", decision: "reject", suggestionId: "cs_1" });
  });

  it("processes a modal submit into a revise followup with the typed text", () => {
    const r = routeInteraction(
      {
        type: InteractionType.MODAL_SUBMIT,
        data: {
          custom_id: encodeModalId("cs_1", ["threads"]),
          components: [{ type: 1, components: [{ type: 4, custom_id: REVISE_INPUT_ID, value: "Edited post #TreeFacts" }] }],
        },
        ...macy,
      },
      ctx,
    );
    expect(r.response.type).toBe(ResponseType.DEFERRED_UPDATE_MESSAGE);
    expect(r.followup).toMatchObject({ kind: "revise_submit", suggestionId: "cs_1", text: "Edited post #TreeFacts", targets: ["threads"] });
  });

  it("denies a modal submit from a non-approver", () => {
    const r = routeInteraction(
      {
        type: InteractionType.MODAL_SUBMIT,
        data: {
          custom_id: encodeModalId("cs_1", ["threads"]),
          components: [{ type: 1, components: [{ type: 4, custom_id: REVISE_INPUT_ID, value: "x" }] }],
        },
        ...stranger,
      },
      ctx,
    );
    expect(r.response.data?.flags).toBe(64);
    expect(r.followup).toBeUndefined();
  });
});
