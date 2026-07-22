import { describe, it, expect } from "vitest";
import {
  buildApprovalCard,
  buildReviseModal,
  decisionCard,
  encodeAction,
  encodeModalId,
  parseAction,
  parseCardContext,
  parseModalId,
  readModalText,
  REVISE_INPUT_ID,
  type ContentSuggestion,
} from "./approval";

const suggestion: ContentSuggestion = {
  id: "cs_pawpaw",
  content: "The pawpaw is Appalachia's forgotten fruit.",
  targets: ["threads", "instagram"],
  species: ["pawpaw"],
  places: ["Appalachia"],
  practices: ["forest farming"],
};

describe("buildApprovalCard", () => {
  const card = buildApprovalCard(suggestion);
  it("renders three buttons with encoded custom_ids", () => {
    const ids = card.components[0].components.map((b) => b.custom_id);
    expect(ids).toEqual([
      encodeAction("approve", "cs_pawpaw"),
      encodeAction("revise", "cs_pawpaw"),
      encodeAction("reject", "cs_pawpaw"),
    ]);
  });
  it("carries body, pool and targets that round-trip through parseCardContext", () => {
    const ctx = parseCardContext(card);
    expect(ctx.body).toBe(suggestion.content);
    expect(ctx.targets).toEqual(["threads", "instagram"]);
    expect(ctx.pool).toEqual(["#TreeFacts", "#Pawpaw", "#Appalachia", "#ForestFarming"]);
  });
});

describe("action + modal custom_id codecs", () => {
  it("parses valid button actions and rejects foreign ids", () => {
    expect(parseAction(encodeAction("approve", "x"))).toEqual({ decision: "approve", suggestionId: "x" });
    expect(parseAction("insights:last7d")).toBeNull();
    expect(parseAction("cs:bogus:x")).toBeNull();
  });
  it("round-trips modal id with targets", () => {
    expect(parseModalId(encodeModalId("cs_1", ["threads", "instagram"]))).toEqual({
      suggestionId: "cs_1",
      targets: ["threads", "instagram"],
    });
    expect(parseModalId("csmodal:cs_1:nonsense")).toEqual({ suggestionId: "cs_1", targets: [] });
    expect(parseModalId("cs:approve:x")).toBeNull();
  });
});

describe("buildReviseModal + readModalText", () => {
  it("prefills the input and reads the submitted value back", () => {
    const modal = buildReviseModal("cs_1", "prefill text", ["threads"]);
    expect(modal.custom_id).toBe(encodeModalId("cs_1", ["threads"]));
    const submitted = [
      { type: 1, components: [{ type: 4, custom_id: REVISE_INPUT_ID, value: "  new text  " }] },
    ];
    expect(readModalText(submitted)).toBe("new text");
    expect(readModalText([])).toBe("");
  });
});

describe("parseCardContext resilience", () => {
  it("re-inserts the anchor if a card is missing it and defaults targets", () => {
    const ctx = parseCardContext({
      embeds: [{ description: "body", fields: [{ name: "Hashtag pool", value: "#Pawpaw" }] }],
    });
    expect(ctx.pool[0]).toBe("#TreeFacts");
    expect(ctx.targets).toEqual(["threads", "instagram"]);
  });
});

describe("decisionCard", () => {
  it("stamps the decider, clears buttons, and sets the detail footer", () => {
    const card = buildApprovalCard(suggestion);
    const done = decisionCard(card, "approve", "12345", "1 draft");
    expect(done.components).toEqual([]);
    expect(done.embeds[0].title).toContain("Approved");
    expect(done.embeds[0].title).toContain("<@12345>");
    expect(done.embeds[0].footer.text).toBe("1 draft");
  });
});
