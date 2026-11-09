import { describe, it, expect } from "vitest";
import { routeInteraction, InteractionType, ResponseType } from "./interactions";
import { buildApprovalCard, encodeAction, encodeModalId, REVISE_INPUT_ID } from "./approval";
import { MACY_DISCORD_ID } from "./allowlist";
import { buildOrderCard } from "./orders";
import { IDEA_MODAL_ID, IDEA_HEADLINE_ID, IDEA_BODY_ID, IDEA_LINKS_ID } from "./idea";

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

describe("routeInteraction — Phase 3 /idea (GOL-471)", () => {
  const ideaModalSubmit = (vals: Record<string, string>, who: object) => ({
    type: InteractionType.MODAL_SUBMIT,
    data: {
      custom_id: IDEA_MODAL_ID,
      components: Object.entries(vals).map(([custom_id, value]) => ({
        type: 1,
        components: [{ type: 4, custom_id, value }],
      })),
    },
    ...who,
  });

  it("opens the modal when an approver runs /idea", () => {
    const r = routeInteraction(
      { type: InteractionType.APPLICATION_COMMAND, data: { name: "idea" }, ...macy },
      ctx,
    );
    expect(r.response.type).toBe(ResponseType.MODAL);
    expect((r.response.data as { custom_id?: string })?.custom_id).toBe(IDEA_MODAL_ID);
    expect(r.followup).toBeUndefined();
  });

  it("denies /idea from a non-approver (no modal)", () => {
    const r = routeInteraction(
      { type: InteractionType.APPLICATION_COMMAND, data: { name: "idea" }, ...stranger },
      ctx,
    );
    expect(r.response.type).toBe(ResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    expect(r.response.data?.flags).toBe(64);
    expect(r.followup).toBeUndefined();
  });

  it("defers an idea submit ephemerally and carries the parsed fields", () => {
    const r = routeInteraction(
      ideaModalSubmit(
        { [IDEA_HEADLINE_ID]: "Pawpaw guild", [IDEA_BODY_ID]: "the story", [IDEA_LINKS_ID]: "https://x" },
        macy,
      ),
      ctx,
    );
    expect(r.response.type).toBe(ResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE);
    expect(r.response.data?.flags).toBe(64);
    expect(r.followup).toMatchObject({
      kind: "idea_submit",
      headline: "Pawpaw guild",
      body: "the story",
      links: "https://x",
      actor: MACY_DISCORD_ID,
    });
  });

  it("rejects an idea submit missing required fields", () => {
    const r = routeInteraction(ideaModalSubmit({ [IDEA_HEADLINE_ID]: "only title" }, macy), ctx);
    expect(r.response.type).toBe(ResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    expect(r.response.data?.flags).toBe(64);
    expect(r.followup).toBeUndefined();
  });

  it("denies an idea submit from a non-approver", () => {
    const r = routeInteraction(
      ideaModalSubmit({ [IDEA_HEADLINE_ID]: "t", [IDEA_BODY_ID]: "b" }, stranger),
      ctx,
    );
    expect(r.response.data?.flags).toBe(64);
    expect(r.followup).toBeUndefined();
  });
});

describe("routeInteraction — order-ops buttons and modals", () => {
  const OPERATOR = "700000000000000000";
  const orderCtx = { approverIds: new Set([MACY_DISCORD_ID]), operatorIds: new Set([OPERATOR]) };
  const operator = { member: { nick: "Wesley", user: { id: OPERATOR, username: "wes" } } };

  const click = (custom_id: string, who: object = operator, message: unknown = {}) =>
    routeInteraction({ type: InteractionType.MESSAGE_COMPONENT, data: { custom_id }, message, ...who }, orderCtx);
  const submit = (custom_id: string, values: Record<string, string>, who: object = operator) =>
    routeInteraction(
      {
        type: InteractionType.MODAL_SUBMIT,
        data: {
          custom_id,
          components: Object.entries(values).map(([k, v]) => ({ type: 1, components: [{ custom_id: k, value: v }] })),
        },
        message: { id: "m1" },
        ...who,
      },
      orderCtx,
    );
  const inputs = (r: ReturnType<typeof click>) =>
    ((r.response.data as { components: Array<{ components: Array<Record<string, unknown>> }> }).components).map((row) => row.components[0]);

  it("Mark shipped opens a modal with required Tracking number and Label cost and calls nothing", () => {
    const r = click("ord:shipped:42");
    expect(r.response.type).toBe(ResponseType.MODAL);
    expect(r.followup).toBeUndefined();
    const [tracking, cost] = inputs(r);
    expect(tracking).toMatchObject({ label: "Tracking number", required: true });
    expect(cost).toMatchObject({ label: "Label cost", required: true });
    expect(tracking.value).toBeUndefined();
  });

  it("Mark shipped prefills from the card: first tracking number and the cost", () => {
    const message = buildOrderCard({
      orderId: 42, orderRef: "S1", companyId: 1, lines: [], total: 5,
      lane: "spring", zone: "6", carrier: "UPS", tracking: "1Z111, 1Z222", labelCost: 12.4,
    });
    const [tracking, cost] = inputs(click("ord:shipped:42", operator, message));
    expect(tracking.value).toBe("1Z111");
    expect(cost.value).toBe("12.40");
  });

  it("Hold opens a modal with Hold until prefilled from the custom_id and a required Why", () => {
    const r = click("ord:hold:42:2026-11-10");
    expect(r.response.type).toBe(ResponseType.MODAL);
    expect(r.followup).toBeUndefined();
    const [until, why] = inputs(r);
    expect(until).toMatchObject({ label: "Hold until", value: "2026-11-10" });
    expect(why).toMatchObject({ label: "Why", required: true });
  });

  it("Hold with no suggested date leaves Hold until empty", () => {
    const [until] = inputs(click("ord:hold:42"));
    expect(until.value).toBeUndefined();
  });

  it("Change date prefills date from custom_id and reason from the card", () => {
    const message = buildOrderCard({
      orderId: 42, orderRef: "S1", companyId: 1, lines: [], total: 5, lane: "individual",
      hold: { until: "2026-10-15", reason: "Dormancy first", setBy: "Wes" },
    });
    const r = click("ord:holddate:42:2026-10-15", operator, message);
    expect(r.response.type).toBe(ResponseType.MODAL);
    const [until, why] = inputs(r);
    expect(until.value).toBe("2026-10-15");
    expect(why.value).toBe("Dormancy first");
  });

  it.each([
    ["release", {}],
    ["ready", {}],
    ["snooze", {}],
    ["spring", {}],
    ["fall", {}],
    ["refunded", {}],
  ])("%s defers with an order_action followup", (action) => {
    const r = click(`ord:${action}:42`);
    expect(r.response.type).toBe(ResponseType.DEFERRED_UPDATE_MESSAGE);
    expect(r.followup).toMatchObject({ kind: "order_action", action, orderId: "42", actor: "Wesley", operatorId: OPERATOR });
  });

  it("markall defers and carries the batch id for the mark_all followup", () => {
    const message = { embeds: [{ title: "Zone 6 labels" }] };
    const r = click("ord:markall:42", operator, message);
    expect(r.response.type).toBe(ResponseType.DEFERRED_UPDATE_MESSAGE);
    expect(r.followup).toEqual({ kind: "mark_all", batchId: "42", actor: "Wesley", operatorId: OPERATOR, message });
  });

  it("markall is operator-only: a non-operator gets an ephemeral refusal and no followup", () => {
    const r = click("ord:markall:42", macy);
    expect(r.response.type).toBe(ResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    expect(r.response.data?.flags).toBe(64);
    expect(String(r.response.data?.content)).toMatch(/operator list/);
    expect(r.followup).toBeUndefined();
  });

  it("markall is refused as a modal submit", () => {
    const r = submit("ord:markall:42", {});
    expect(r.response.data?.flags).toBe(64);
    expect(r.followup).toBeUndefined();
  });

  it("modal submit defers with an order_action followup carrying the inputs", () => {
    const r = submit("ord:shipped:42", { tracking: "1Z999", cost: "12.40" });
    expect(r.response.type).toBe(ResponseType.DEFERRED_UPDATE_MESSAGE);
    expect(r.followup).toMatchObject({
      kind: "order_action",
      action: "shipped",
      orderId: "42",
      actor: "Wesley",
      inputs: { tracking: "1Z999", cost: "12.40" },
    });
  });

  it("hold and holddate submits both carry until and reason", () => {
    for (const id of ["ord:hold:42", "ord:holddate:42"]) {
      const r = submit(id, { until: "Oct 15", reason: "Dormancy" });
      expect(r.response.type).toBe(ResponseType.DEFERRED_UPDATE_MESSAGE);
      expect(r.followup).toMatchObject({ kind: "order_action", orderId: "42", inputs: { until: "Oct 15", reason: "Dormancy" } });
    }
  });

  it("a modal submit for an action without a modal is refused", () => {
    const r = submit("ord:release:42", {});
    expect(r.followup).toBeUndefined();
  });

  it("actor falls back to global name, username, then id", () => {
    const g = click("ord:release:42", { member: { user: { id: OPERATOR, global_name: "Wes G", username: "wes" } } });
    expect(g.followup).toMatchObject({ actor: "Wes G" });
    const u = click("ord:release:42", { member: { user: { id: OPERATOR, username: "wes" } } });
    expect(u.followup).toMatchObject({ actor: "wes" });
    const i = click("ord:release:42", { member: { user: { id: OPERATOR } } });
    expect(i.followup).toMatchObject({ actor: OPERATOR });
  });

  it.each(["shipped", "hold", "holddate", "release", "ready", "snooze", "spring", "fall", "refunded", "markall"])(
    "denies a non-operator on %s click, ephemerally with no followup",
    (action) => {
      const r = click(`ord:${action}:42`, macy);
      expect(r.response.type).toBe(ResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
      expect(r.response.data?.flags).toBe(64);
      expect(String(r.response.data?.content)).toMatch(/operator list/);
      expect(r.followup).toBeUndefined();
    },
  );

  it.each(["shipped", "hold", "holddate"])("denies a non-operator on a %s modal submit", (action) => {
    const r = submit(`ord:${action}:42`, { tracking: "1Z", cost: "1", until: "Oct 1", reason: "x" }, macy);
    expect(r.response.data?.flags).toBe(64);
    expect(String(r.response.data?.content)).toMatch(/operator list/);
    expect(r.followup).toBeUndefined();
  });

  it("denies everyone when no operator roster is configured", () => {
    const r = routeInteraction(
      { type: InteractionType.MESSAGE_COMPONENT, data: { custom_id: "ord:shipped:42" }, message: {}, ...operator },
      { approverIds: new Set([MACY_DISCORD_ID]) },
    );
    expect(r.response.data?.flags).toBe(64);
    expect(r.followup).toBeUndefined();
  });
});
