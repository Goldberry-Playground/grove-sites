import { describe, it, expect, vi } from "vitest";
import {
  IDEA_MODAL_ID,
  IDEA_HEADLINE_ID,
  IDEA_BODY_ID,
  IDEA_LINKS_ID,
  buildIdeaModal,
  newIdeaId,
  parseIdeaModal,
  renderIdeaIntake,
  fileIdeaIntake,
  type IdeaSubmission,
} from "./idea";

const TS = "2026-08-02T14:30:05.000Z";

/** Build a modal-submit `components` payload with the given field values. */
function modalComponents(vals: Record<string, string>): unknown {
  return Object.entries(vals).map(([custom_id, value]) => ({
    type: 1,
    components: [{ type: 4, custom_id, value }],
  }));
}

const submission: IdeaSubmission = {
  ideaId: "idea_20260802_pawpaw-guild",
  headline: "Pawpaw guild",
  body: "Why we interplant pawpaw with chestnut.",
  links: "https://example.com/pawpaw",
  actor: "208085380262526976",
  ts: TS,
};

describe("newIdeaId", () => {
  it("mints idea_<YYYYMMDD>_<slug> from ts + headline", () => {
    expect(newIdeaId(TS, "Pawpaw Guild!")).toBe("idea_20260802_pawpaw-guild");
  });

  it("collapses punctuation/spaces and trims edges", () => {
    expect(newIdeaId(TS, "  The @Chestnut — Story??  ")).toBe("idea_20260802_the-chestnut-story");
  });

  it("falls back to an HHMMSS suffix when the headline slugs to empty", () => {
    expect(newIdeaId(TS, "!!!")).toBe("idea_20260802_143005");
  });

  it("caps the slug length", () => {
    const long = "a".repeat(80);
    const id = newIdeaId(TS, long);
    expect(id).toBe(`idea_20260802_${"a".repeat(40)}`);
  });
});

describe("buildIdeaModal", () => {
  it("builds a 3-input modal with the load-bearing ids and required flags", () => {
    const modal = buildIdeaModal();
    expect(modal.custom_id).toBe(IDEA_MODAL_ID);
    const inputs = modal.components.map((r) => r.components[0] as Record<string, unknown>);
    expect(inputs.map((i) => i.custom_id)).toEqual([IDEA_HEADLINE_ID, IDEA_BODY_ID, IDEA_LINKS_ID]);
    expect(inputs[0]).toMatchObject({ style: 1, required: true });
    expect(inputs[1]).toMatchObject({ style: 2, required: true });
    expect(inputs[2]).toMatchObject({ style: 2, required: false });
  });
});

describe("parseIdeaModal", () => {
  it("extracts + trims all three fields regardless of row order", () => {
    const comps = modalComponents({
      [IDEA_LINKS_ID]: "  https://x  ",
      [IDEA_BODY_ID]: "  the idea  ",
      [IDEA_HEADLINE_ID]: "  Title  ",
    });
    expect(parseIdeaModal(comps)).toEqual({ headline: "Title", body: "the idea", links: "https://x" });
  });

  it("decodes a blank optional links field to undefined", () => {
    const comps = modalComponents({
      [IDEA_HEADLINE_ID]: "Title",
      [IDEA_BODY_ID]: "body",
      [IDEA_LINKS_ID]: "   ",
    });
    expect(parseIdeaModal(comps)).toEqual({ headline: "Title", body: "body", links: undefined });
  });

  it("returns null when a required field is missing", () => {
    expect(parseIdeaModal(modalComponents({ [IDEA_HEADLINE_ID]: "Title" }))).toBeNull();
    expect(parseIdeaModal(modalComponents({ [IDEA_BODY_ID]: "body" }))).toBeNull();
    expect(parseIdeaModal([])).toBeNull();
  });
});

describe("renderIdeaIntake", () => {
  it("threads the idea_id and hands off to Sora with the same id", () => {
    const md = renderIdeaIntake(submission);
    expect(md).toContain("`idea_20260802_pawpaw-guild`");
    expect(md).toContain("**Pawpaw guild**");
    expect(md).toContain("Why we interplant pawpaw with chestnut.");
    expect(md).toContain("**Sources / links:** https://example.com/pawpaw");
    expect(md).toContain("<@208085380262526976>");
    expect(md).toContain("CMO - Sora");
    expect(md).toContain('id: "idea_20260802_pawpaw-guild"');
  });

  it("omits the sources line when there are no links", () => {
    const md = renderIdeaIntake({ ...submission, links: undefined });
    expect(md).not.toContain("Sources / links");
  });
});

describe("fileIdeaIntake", () => {
  const cfg = {
    bridgeKey: "brg_key",
    intakeIssueId: "GOL-999",
    apiBase: "http://localhost:3100/",
  };

  it("skips (never fetches) when the intake path is unconfigured", async () => {
    const fetchImpl = vi.fn();
    const r = await fileIdeaIntake(submission, { apiBase: "http://x" }, fetchImpl as unknown as typeof fetch);
    expect(r).toEqual({ ok: false, skipped: true, reason: "intake not configured" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("POSTs the comment with the bridge key to the intake issue", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    const r = await fileIdeaIntake(submission, cfg, fetchImpl as unknown as typeof fetch);
    expect(r).toEqual({ ok: true, skipped: false });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("http://localhost:3100/api/issues/GOL-999/comments"); // trailing slash trimmed
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer brg_key");
    expect(JSON.parse(init.body).body).toContain("idea_20260802_pawpaw-guild");
  });

  it("reports failure on a non-ok response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 403 }));
    const r = await fileIdeaIntake(submission, cfg, fetchImpl as unknown as typeof fetch);
    expect(r).toMatchObject({ ok: false, skipped: false, reason: "HTTP 403" });
  });

  it("reports failure (never throws) when fetch rejects", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
    const r = await fileIdeaIntake(submission, cfg, fetchImpl as unknown as typeof fetch);
    expect(r).toMatchObject({ ok: false, skipped: false, reason: "network down" });
  });
});
