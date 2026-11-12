// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FIXTURE_CATALOG } from "@grove/planner/fixtures";
import { explain, plan, type PlanInput } from "@grove/planner";
import { TesterBench, factValue } from "./tester-bench";
import type { postDispute, postPropose } from "../../lib/planner-signals";
import * as copy from "./copy";

/** The tester bench (planner winter-beta spec §C.4, GOL-3551). */

const input: PlanInput = { zone: 6, state: "WV", site: "open", track: "food", size: 20, timing: "mixed" };
const result = plan(input, FIXTURE_CATALOG);

function mount() {
  const dispute = vi.fn<typeof postDispute>(async () => ({ ok: true as const, id: null }));
  const propose = vi.fn<typeof postPropose>(async () => ({ ok: true as const, id: null }));
  const utils = render(
    <TesterBench input={input} catalog={FIXTURE_CATALOG} lines={result.lines} dispute={dispute} propose={propose} />,
  );
  return { ...utils, dispute, propose };
}

function slider(key: string): HTMLInputElement {
  return within(screen.getByTestId(`plan-bench-rule-${key}`)).getByRole("slider") as HTMLInputElement;
}

let fetchSpy: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchSpy = vi.fn(async () => new Response("{}"));
  vi.stubGlobal("fetch", fetchSpy);
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("TesterBench: score breakdown", () => {
  it("shows every line's explain() terms and total", () => {
    mount();
    const rows = screen.getAllByTestId("plan-bench-line");
    expect(rows).toHaveLength(result.lines.length);
    for (const line of result.lines) {
      const row = rows.find((r) => r.dataset.plant === String(line.plant.id))!;
      const why = explain(input, FIXTURE_CATALOG, line);
      expect(within(row).getByTestId("plan-bench-total").textContent).toBe(String(Math.round(why.total * 100) / 100));
      for (const part of why.parts) expect(within(row).getAllByText(part.label).length).toBeGreaterThan(0);
    }
  });
});

describe("TesterBench: what-if sliders", () => {
  it("re-scores locally and never persists: no fetch, no storage, no cookie", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const cookieBefore = document.cookie;
    const { dispute, propose } = mount();
    const line = result.lines.find((l) => (l.plant.priority ?? 50) > 0)!;
    const row = screen.getAllByTestId("plan-bench-line").find((r) => r.dataset.plant === String(line.plant.id))!;
    const before = within(row).getByTestId("plan-bench-total").textContent;

    fireEvent.change(slider("priority_weight"), { target: { value: "0" } });

    const after = within(row).getByTestId("plan-bench-total").textContent;
    expect(after).not.toBe(before);
    expect(after).toBe(String(Math.round(explain(input, FIXTURE_CATALOG, line, { priority_weight: 0 }).total * 100) / 100));
    expect(within(row).getByText(copy.BENCH_WAS(before!), { exact: false })).toBeTruthy();
    // The what-if summary speaks up once a weight moved.
    expect(screen.getByTestId("plan-bench-whatif").textContent).not.toBe("");

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(document.cookie).toBe(cookieBefore);
    expect(dispute).not.toHaveBeenCalled();
    expect(propose).not.toHaveBeenCalled();
  });

  it("Reset all weights puts every slider back on the live value", async () => {
    mount();
    fireEvent.change(slider("years_weight"), { target: { value: "4" } });
    expect(slider("years_weight").value).toBe("4");
    await userEvent.click(screen.getByRole("button", { name: copy.BENCH_RESET_ALL }));
    expect(slider("years_weight").value).toBe("1.5");
    expect(screen.queryByRole("button", { name: copy.BENCH_RESET_ALL })).toBeNull();
  });

  it("names the pick a weight change would swap in", () => {
    mount();
    // With no priority or years pull and a huge marginal penalty, scores collapse
    // onto the same base; whatever changes, the summary must say it in words.
    fireEvent.change(slider("priority_weight"), { target: { value: "6" } });
    const box = screen.getByTestId("plan-bench-whatif");
    expect(box.textContent === copy.BENCH_SAME_PICKS || box.textContent!.startsWith(copy.BENCH_PICKS_HEADING)).toBe(true);
  });
});

describe("TesterBench: Propose this weight", () => {
  it("is offered only once a slider moved, and posts once per press", async () => {
    const { propose } = mount();
    const box = screen.getByTestId("plan-bench-rule-marginal_penalty");
    expect(within(box).queryByTestId("plan-bench-propose")).toBeNull();

    fireEvent.change(slider("marginal_penalty"), { target: { value: "60" } });
    const button = within(box).getByTestId("plan-bench-propose");
    await userEvent.click(button);
    await userEvent.click(button);
    await waitFor(() => expect(within(box).getByRole("status").textContent).toContain("60"));
    expect(propose).toHaveBeenCalledTimes(1);
    expect(propose).toHaveBeenCalledWith({ key: "marginal_penalty", value: 60 });
    // The same value cannot be proposed twice; a new value can.
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(slider("marginal_penalty"), { target: { value: "61" } });
    await userEvent.click(within(box).getByTestId("plan-bench-propose"));
    expect(propose).toHaveBeenCalledTimes(2);
  });

  it("says the link expired when the BFF answers forbidden", async () => {
    const { propose } = mount();
    propose.mockResolvedValueOnce({ ok: false, reason: "forbidden" });
    fireEvent.change(slider("season_bonus"), { target: { value: "8" } });
    await userEvent.click(within(screen.getByTestId("plan-bench-rule-season_bonus")).getByTestId("plan-bench-propose"));
    expect((await screen.findByRole("alert")).textContent).toContain(copy.BENCH_NOT_TESTER);
  });
});

describe("TesterBench: Dispute a fact", () => {
  it("lists the plant's facts with current values and asks for one before sending", async () => {
    const { dispute } = mount();
    const line = result.lines[0];
    const row = screen.getAllByTestId("plan-bench-line").find((r) => r.dataset.plant === String(line.plant.id))!;
    await userEvent.click(within(row).getByText(copy.BENCH_DISPUTE));
    const radios = within(row).getAllByRole("radio");
    expect(radios).toHaveLength(11);
    expect(within(row).getByLabelText(new RegExp(copy.BENCH_FACT_LABELS.zone_min)).closest("label")!.textContent).toContain(
      factValue(line.plant, "zone_min"),
    );

    await userEvent.click(within(row).getByTestId("plan-bench-dispute-send"));
    expect(dispute).not.toHaveBeenCalled();
    expect(within(row).getByText(copy.BENCH_DISPUTE_PICK)).toBeTruthy();
  });

  it("posts the fact, note and zone once per press", async () => {
    let release!: () => void;
    const { dispute } = mount();
    dispute.mockImplementationOnce(
      () => new Promise((resolve) => (release = () => resolve({ ok: true, id: null }))),
    );
    const line = result.lines[0];
    const row = screen.getAllByTestId("plan-bench-line").find((r) => r.dataset.plant === String(line.plant.id))!;
    await userEvent.click(within(row).getByText(copy.BENCH_DISPUTE));
    await userEvent.click(within(row).getByLabelText(new RegExp(copy.BENCH_FACT_LABELS.years_to_fruit)));
    await userEvent.type(within(row).getByLabelText(copy.BENCH_DISPUTE_NOTE), "Fruited in year two here");
    const send = within(row).getByTestId("plan-bench-dispute-send");
    await userEvent.click(send);
    await userEvent.click(send);
    release();
    await waitFor(() => expect(within(row).getByRole("status").textContent).toContain(copy.BENCH_FACT_LABELS.years_to_fruit.toLowerCase()));
    expect(dispute).toHaveBeenCalledTimes(1);
    expect(dispute).toHaveBeenCalledWith({ product_tmpl_id: line.plant.id, fact: "years_to_fruit", note: "Fruited in year two here", zone: 6 });
  });
});

describe("factValue", () => {
  it("reads facts as words", () => {
    const p = { ...FIXTURE_CATALOG.plants[0], tolerates: { wet: true, poor_soil: false, shade: false }, harvest_months: [9, 10], role: null };
    expect(factValue(p, "tolerates_wet")).toBe("yes");
    expect(factValue(p, "tolerates_shade")).toBe("no");
    expect(factValue(p, "harvest_months")).toBe("Sep, Oct");
    expect(factValue(p, "role")).toBe(copy.BENCH_UNSET);
  });
});
