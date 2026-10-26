// @vitest-environment happy-dom
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CartProvider, cartStorageKey } from "@grove/checkout";
import { FIXTURE_CATALOG } from "@grove/planner/fixtures";
import { Planner } from "./planner";
import { ResultCard, headlineFor, dropSpan, cartAcceptsGroup, countLabel, type ResultCardProps } from "./result-card";
import { plan } from "@grove/planner";
import type { PlanInput } from "@grove/planner";
import type { postSave, postSignal } from "../../lib/planner-signals";

/**
 * Component tests for the order builder (order-builder spec §C.5): URL round
 * trip, the unknown-ZIP state fallback, the empty state, and Build my order
 * writing the cart. The planner engine itself is covered in packages/planner.
 */

const replace = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => "/plan",
  useSearchParams: () => new URLSearchParams(search),
}));

const contact = { phone: "4457875140", email: "orders@atthegrovenursery.com" };
const catalogPayload = { ...FIXTURE_CATALOG, calendar: null, source: "fixture" as const };

function mockFetch(zoneFor: (zip: string) => number | null) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.startsWith("/api/zone")) {
      const zip = new URL(url, "http://x").searchParams.get("zip") ?? "";
      const zone = zoneFor(zip);
      return zone == null
        ? new Response(JSON.stringify({ error: "unknown_zip" }), { status: 404 })
        : new Response(JSON.stringify({ zip, zone }), { status: 200 });
    }
    if (url === "/api/planner/catalog") {
      return new Response(JSON.stringify(catalogPayload), { status: 200 });
    }
    throw new Error(`unexpected fetch ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function mount(initialSearch = "") {
  search = initialSearch;
  return render(
    <CartProvider>
      <Planner mode="page" odooBase="http://odoo.test" contact={contact} />
    </CartProvider>,
  );
}

beforeEach(() => {
  replace.mockReset();
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Planner: URL state", () => {
  it("writes each answer to the URL as it is given (shareable result)", async () => {
    mockFetch(() => 6);
    mount();
    const zip = screen.getByLabelText("ZIP code");
    await userEvent.type(zip, "2650");
    // A half-typed ZIP is not an answer: nothing hits the URL until five digits.
    expect(replace).not.toHaveBeenCalled();
    await userEvent.type(zip, "1");
    expect(replace).toHaveBeenLastCalledWith("/plan?zip=26501", { scroll: false });

    // The page re-reads the URL on the next render; simulate the router applying it.
    search = "zip=26501";
    cleanup();
    mount("zip=26501");
    await screen.findByText(/ZIP 26501 is in USDA zone 6/);
    await userEvent.click(await screen.findByLabelText(/Open ground/));
    expect(replace).toHaveBeenLastCalledWith("/plan?zip=26501&site=open", { scroll: false });
  });

  it("renders the result straight from a complete URL and round-trips it", async () => {
    mockFetch(() => 6);
    mount("zip=26501&site=open&track=food&size=20&timing=mixed");
    const heading = await screen.findByRole("heading", { level: 2, name: /Your 20-tree food forest/ });
    expect(heading).toBeTruthy();
    expect(screen.getByText(/ZIP 26501, zone 6, open ground/i)).toBeTruthy();
    // Four tree layers plus the spawn line the winter beta adds.
    expect(screen.getAllByTestId("plan-line").length).toBe(5);
    // Edit reopens the questions with the same answers selected.
    await userEvent.click(screen.getByRole("button", { name: "Edit answers" }));
    expect((screen.getByLabelText(/Homestead/) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText(/^Mixed/) as HTMLInputElement).checked).toBe(true);
  });
});

describe("Planner: unknown ZIP falls back to the state band", () => {
  it("offers a state select, plans on the band, and ends the quiz for a state we cannot ship to", async () => {
    mockFetch(() => null);
    mount("zip=99999");
    await screen.findByText(/We could not place that ZIP/);
    const select = await screen.findByLabelText("State");
    await userEvent.selectOptions(select, "WV");
    expect(replace).toHaveBeenLastCalledWith("/plan?zip=99999&state=WV", { scroll: false });

    cleanup();
    mount("zip=99999&state=WV&site=open&track=food&size=20&timing=mixed");
    await screen.findByRole("heading", { level: 2, name: /Your 20-tree food forest/ });
    expect(screen.getByText(/WV, zones 5 to 7, open ground/i)).toBeTruthy();

    cleanup();
    mount("zip=99999&state=CA");
    await userEvent.selectOptions(await screen.findByLabelText("State"), "CA");
    const end = await screen.findByTestId("plan-state-unsupported");
    expect(within(end).getByText("We cannot ship there yet.")).toBeTruthy();
    expect(within(end).getByRole("link", { name: "Browse for farm pickup" })).toBeTruthy();
    expect(screen.queryByText("What is the spot like?")).toBeNull();
  });
});

describe("Planner: empty state", () => {
  it("says nothing fits, offers the drier-site retry and the consult", async () => {
    mockFetch(() => 1);
    mount("zip=99501&site=wet&track=food&size=20&timing=mixed");
    await screen.findByRole("heading", { level: 2, name: /Nothing we grow fits a low, wet spot in zone 1 yet/i });
    await userEvent.click(screen.getByRole("button", { name: "Try open ground instead" }));
    expect(replace).toHaveBeenLastCalledWith(
      "/plan?zip=99501&site=open&track=food&size=20&timing=mixed",
      { scroll: false },
    );
    expect(screen.getByTestId("plan-consult")).toBeTruthy();
  });

  it("shows an error with retry when the catalog cannot load", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.startsWith("/api/zone")
          ? new Response(JSON.stringify({ zip: "26501", zone: 6 }), { status: 200 })
          : new Response(JSON.stringify({ error: "catalog_unavailable" }), { status: 503 }),
      ),
    );
    mount("zip=26501&site=open&track=food&size=20&timing=mixed");
    const err = await screen.findByTestId("plan-error");
    expect(within(err).getByRole("button", { name: "Try again" })).toBeTruthy();
  });
});

const input: PlanInput = { zone: 6, state: "WV", site: "open", track: "food", size: 20, timing: "mixed" };

function mountCard(overrides: Partial<ResultCardProps> = {}) {
  const result = plan(input, FIXTURE_CATALOG);
  const signal = vi.fn<typeof postSignal>(async () => true);
  const save = vi.fn<typeof postSave>(async () => ({ ok: true as const, id: 9 }));
  const onManualChange = vi.fn();
  const utils = render(
    <CartProvider>
      <ResultCard
        result={result}
        input={input}
        catalog={FIXTURE_CATALOG}
        eyebrow="ZIP 26501, zone 6, open ground"
        calendar={null}
        odooBase="http://odoo.test"
        contact={contact}
        manualIds={[]}
        onManualChange={onManualChange}
        onEdit={() => {}}
        onRetrySite={() => {}}
        signal={signal}
        save={save}
        {...overrides}
      />
    </CartProvider>,
  );
  return { ...utils, result, signal, save, onManualChange };
}

describe("ResultCard: Build my order", () => {
  it("adds every line to the cart store, posts one built signal first, and opens the mini cart", async () => {
    const { result, signal } = mountCard();
    // Bareroot trees and the potted spawn are two orders: two buttons, potted first.
    const buttons = screen.getAllByRole("button", { name: /Build my/ });
    expect(buttons.length).toBe(2);
    expect(buttons[0].textContent).toMatch(/potted order \(1 spawn\)/);
    expect(buttons[1].textContent).toMatch(/bareroot order \(20 trees\)/);
    await userEvent.click(buttons[1]);
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(cartStorageKey(process.env.NEXT_PUBLIC_TENANT_ID)) ?? "[]");
      expect(stored.map((i: { templateId: number; quantity: number; wave?: string }) => [i.templateId, i.quantity])).toEqual(
        result.lines.filter((l) => l.plant.tier === "bareroot").map((l) => [l.plant.id, l.qty]),
      );
      // Bareroot is always a wave pre-order: every line carries the first open wave.
      expect(stored.every((i: { wave?: string }) => i.wave === "fall" || i.wave === "spring")).toBe(true);
    });
    expect((await screen.findByText(/Added 20 trees/)).textContent).toMatch(/Added 20 trees to your cart/);
    expect(signal).toHaveBeenCalledTimes(1);
    expect(signal.mock.calls[0][0]).toBe("built");
    expect(signal.mock.calls[0][2]).toBeUndefined();
    expect(countLabel([{ plant: FIXTURE_CATALOG.plants[0], qty: 1, slot: "canopy", zoneFit: "safe" }])).toBe("1 tree");
  });

  it("refuses to mix a pre-order into an immediate cart, with the cart's own message", () => {
    const immediate = [{ variantId: 1, templateId: 1, name: "x", price: 1, imageUrl: "", quantity: 1 }];
    expect(cartAcceptsGroup(immediate, "fall")).toMatchObject({ ok: false });
    expect(cartAcceptsGroup(immediate, undefined)).toEqual({ ok: true });
    const fall = [{ ...immediate[0], wave: "fall" as const }];
    expect(cartAcceptsGroup(fall, "spring")).toMatchObject({ ok: false, message: /fall pre-order/ });
    expect(cartAcceptsGroup(fall, "fall")).toEqual({ ok: true });
  });
});

describe("ResultCard: headline copy", () => {
  const base = { zone: 6, state: "WV", site: "open", track: "food", size: 20, timing: "mixed" } as const;
  it("names the first harvest, the partial fill, the deer drop span and the empty state", () => {
    const ok = plan(base, FIXTURE_CATALOG);
    expect(headlineFor(ok, base)).toBe("Your 20-tree food forest, first harvest in about 3 years.");
    const deer = { ...base, track: "deer", size: 16, timing: "all" } as const;
    expect(headlineFor(plan(deer, FIXTURE_CATALOG), deer)).toBe("Something dropping from Sep to Nov.");
    const empty = { ...base, zone: 1, site: "wet" } as const;
    expect(headlineFor(plan(empty, FIXTURE_CATALOG), empty)).toBe("Nothing we grow fits a low, wet spot in zone 1 yet.");
    expect(dropSpan([9, 10, 11, 12, 1])).toBe("Sep to Jan");
    expect(dropSpan([6, 7])).toBe("Jun to Jul");
  });
});

describe("ResultCard: winter beta (planner-winter-beta spec §C.1, §C.2, §C.3)", () => {
  it("shows the philosophy line, the badges in planting order, and the substrate line on spawn", () => {
    mountCard();
    expect(screen.getByTestId("plan-philosophy").textContent).toMatch(/Nothing here is planted alone/);
    const lines = screen.getAllByTestId("plan-line");
    const badges = lines.map((l) => within(l).getByTestId("plan-badge-stratum").textContent);
    expect(badges).toEqual([
      "Overstory anchor",
      "Understory anchor",
      "Understory companion",
      "Understory companion",
      "Mushroom anchor",
    ]);
    // Redbud fixes N; the wine cap says what it grows on.
    expect(within(lines[3]).getByText("fixes N")).toBeTruthy();
    expect(within(lines[4]).getByTestId("plan-substrate").textContent).toBe("Grows on wood chips or straw under your trees");
    expect(within(lines[0]).getByText("long-lived")).toBeTruthy();
    expect(screen.queryByText("Needs review")).toBeNull();
    // The mushroom row joins the layer strip once a spawn line sits in it.
    expect(within(screen.getByRole("list", { name: "Layers" })).getByText("Mushroom")).toBeTruthy();
  });

  it("Remove posts one removed signal; Swap takes the next candidate and posts one swapped signal", async () => {
    const { signal } = mountCard();
    await userEvent.click(screen.getByRole("button", { name: "Remove American Hazelnut" }));
    expect(screen.getByText("American Hazelnut").closest("li")?.textContent).toMatch(/removed/);
    expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
    expect(signal).toHaveBeenCalledTimes(1);
    expect(signal.mock.calls[0][0]).toBe("removed");
    expect(signal.mock.calls[0][2]).toBe(104);

    await userEvent.click(screen.getByRole("button", { name: "Swap American Chestnut (hybrid)" }));
    // Mulberry is the next best canopy pick; chestnut is gone from the card.
    expect(screen.getByRole("link", { name: "Red Mulberry" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "American Chestnut (hybrid)" })).toBeNull();
    expect(screen.getByTestId("plan-notice").textContent).toMatch(/Swapped American Chestnut \(hybrid\) for Red Mulberry/);
    expect(signal).toHaveBeenCalledTimes(2);
    expect(signal.mock.calls[1][0]).toBe("swapped");
    expect(signal.mock.calls[1][2]).toBe(101);
    // Swapping again moves on to the hickory, then runs out with a plain message.
    await userEvent.click(screen.getByRole("button", { name: "Swap Red Mulberry" }));
    expect(screen.getByRole("link", { name: "Shagbark Hickory" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Swap Shagbark Hickory" }));
    expect(screen.getByTestId("plan-notice").textContent).toMatch(/Nothing else we grow fits the canopy slot/);
    expect(signal).toHaveBeenCalledTimes(3);
  });

  it("Add from the suggested list appends a manual line, posts one added signal, and tells the parent", async () => {
    const { signal, onManualChange } = mountCard();
    const suggested = screen.getByTestId("plan-suggested");
    expect(within(suggested).getByTestId("plan-suggested-overstory")).toBeTruthy();
    expect(within(suggested).queryByTestId("plan-suggested-hidden")).toBeNull();
    await userEvent.click(within(suggested).getByRole("button", { name: "Add Shagbark Hickory" }));
    const lines = screen.getAllByTestId("plan-line");
    const added = lines[lines.length - 1];
    expect(added.getAttribute("data-manual")).toBe("true");
    expect(within(added).getByRole("link", { name: "Shagbark Hickory" })).toBeTruthy();
    expect(within(added).getByTestId("plan-badge-manual").textContent).toBe("your pick");
    expect(within(added).getByText("2")).toBeTruthy(); // pollination floor
    expect(onManualChange).toHaveBeenLastCalledWith([109]);
    expect(signal).toHaveBeenCalledTimes(1);
    expect(signal.mock.calls[0][0]).toBe("added");
    expect(signal.mock.calls[0][2]).toBe(109);
    // It left the suggested list.
    expect(within(suggested).queryByRole("button", { name: "Add Shagbark Hickory" })).toBeNull();
    expect(screen.getByTestId("plan-notice").textContent).toMatch(/Added Shagbark Hickory to your plan/);
  });

  it("a hand add keeps the Remove and Swap made before it (the parent's manual ids changing does not re-seed the card)", async () => {
    // A real parent: manual ids live in state, so Add re-renders the card with a new prop.
    const result = plan(input, FIXTURE_CATALOG);
    const signal = vi.fn<typeof postSignal>(async () => true);
    const save = vi.fn<typeof postSave>(async () => ({ ok: true as const, id: 9 }));
    function Parent() {
      const [manualIds, setManualIds] = useState<number[]>([]);
      return (
        <CartProvider>
          <ResultCard
            result={result}
            input={input}
            catalog={FIXTURE_CATALOG}
            eyebrow="ZIP 26501, zone 6, open ground"
            calendar={null}
            odooBase="http://odoo.test"
            contact={contact}
            manualIds={manualIds}
            onManualChange={setManualIds}
            onEdit={() => {}}
            onRetrySite={() => {}}
            signal={signal}
            save={save}
          />
        </CartProvider>
      );
    }
    render(<Parent />);
    await userEvent.click(screen.getByRole("button", { name: "Remove American Hazelnut" }));
    await userEvent.click(screen.getByRole("button", { name: "Swap American Chestnut (hybrid)" }));
    await userEvent.click(screen.getByRole("button", { name: "Add Shagbark Hickory" }));
    // Hazelnut is still removed, mulberry still stands in for the chestnut, hickory is the pick.
    expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "American Chestnut (hybrid)" })).toBeNull();
    expect(screen.getByRole("link", { name: "Red Mulberry" })).toBeTruthy();
    const active = screen.getAllByTestId("plan-line");
    expect(active.map((l) => l.getAttribute("data-plan-line"))).toEqual(["107", "102", "108", "117", "109"]);
    // And the save carries exactly those five.
    await userEvent.type(screen.getByLabelText("Plan name"), "Edited");
    await userEvent.click(screen.getByTestId("plan-save-button"));
    await screen.findByText(/Saved as "Edited"/);
    expect(save.mock.calls[0][0].lines.map((l) => l.product_tmpl_id)).toEqual([107, 102, 108, 117, 109]);
  });

  it("a manual id from the parent renders as a line; one the engine now places is handed back", () => {
    const { onManualChange } = mountCard({ manualIds: [109, 101] });
    const lines = screen.getAllByTestId("plan-line");
    expect(lines.some((l) => l.getAttribute("data-plan-line") === "109" && l.getAttribute("data-manual") === "true")).toBe(true);
    // 101 (chestnut) is the engine's own canopy pick, so it drops out of the manual set.
    expect(onManualChange).toHaveBeenCalledWith([109]);
  });

  it("Save this plan posts the named lines, then one saved signal", async () => {
    const { signal, save } = mountCard();
    await userEvent.click(screen.getByTestId("plan-save-button"));
    expect(screen.getByRole("alert").textContent).toMatch(/Give the plan a name first/);
    expect(save).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText("Plan name"), "The back field");
    await userEvent.click(screen.getByTestId("plan-save-button"));
    await screen.findByText(/Saved as "The back field"/);
    expect(save).toHaveBeenCalledTimes(1);
    const body = save.mock.calls[0][0];
    expect(body).toMatchObject({ name: "The back field", zone: 6, track: "food" });
    expect(body.lines).toEqual([
      { product_tmpl_id: 101, qty: 4, role: "anchor", stratum: "overstory" },
      { product_tmpl_id: 102, qty: 6, role: "anchor", stratum: "understory" },
      { product_tmpl_id: 104, qty: 8, role: "companion", stratum: "understory" },
      { product_tmpl_id: 108, qty: 2, role: "companion", stratum: "understory" },
      { product_tmpl_id: 117, qty: 1, role: "anchor", stratum: "mushroom" },
    ]);
    expect(signal).toHaveBeenCalledTimes(1);
    expect(signal.mock.calls[0][0]).toBe("saved");
  });

  it("a save the backend refuses keeps the plan and says so without a signal", async () => {
    const { signal } = mountCard({ save: vi.fn<typeof postSave>(async () => ({ ok: false as const, reason: "off" as const })) });
    await userEvent.type(screen.getByLabelText("Plan name"), "Field");
    await userEvent.click(screen.getByTestId("plan-save-button"));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Saving plans is paused/);
    expect(screen.getAllByTestId("plan-line").length).toBe(5);
    expect(signal).not.toHaveBeenCalled();
  });

  it("Suggest a plant validates the name inline, then sends and confirms where it goes", async () => {
    const send = vi.fn(async () => ({ ok: true as const, id: null }));
    const { SuggestForm } = await import("./suggest-form");
    render(<SuggestForm send={send} />);
    await userEvent.click(screen.getByTestId("plan-suggest-send"));
    expect(screen.getByText("Tell us the plant's name.")).toBeTruthy();
    expect(send).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText("Plant name"), "Che");
    await userEvent.selectOptions(screen.getByLabelText("Which layer"), "understory");
    await userEvent.type(screen.getByLabelText("Why it belongs"), "Fruits for me in zone 6.");
    await userEvent.click(screen.getByTestId("plan-suggest-send"));
    await screen.findByText(/goes to the nursery for review/);
    expect(send).toHaveBeenCalledWith({ name: "Che", stratum: "understory", note: "Fruits for me in zone 6.", company: "" });
  });
});

describe("Planner: manual lines survive Edit", () => {
  it("keeps a hand add through Edit and See my plan while it still passes the filter", async () => {
    mockFetch(() => 6);
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith("/api/zone")) return new Response(JSON.stringify({ zip: "26501", zone: 6 }), { status: 200 });
      if (url === "/api/planner/catalog") return new Response(JSON.stringify(catalogPayload), { status: 200 });
      if (url.startsWith("/api/planner/")) return new Response(JSON.stringify({ ok: true }), { status: 200, statusText: init?.method ?? "" });
      throw new Error(`unexpected fetch ${url}`);
    }));
    mount("zip=26501&site=open&track=food&size=20&timing=mixed");
    await screen.findByRole("heading", { level: 2, name: /Your 20-tree food forest/ });
    await userEvent.click(screen.getByRole("button", { name: "Add Shagbark Hickory" }));
    expect(screen.getAllByTestId("plan-line").length).toBe(6);
    await userEvent.click(screen.getByRole("button", { name: "Edit answers" }));
    await userEvent.click(screen.getByTestId("plan-see"));
    await screen.findByRole("heading", { level: 2, name: /Your 20-tree food forest/ });
    const lines = screen.getAllByTestId("plan-line");
    expect(lines.length).toBe(6);
    // On the remount the hand add sits in planting order (overstory, with the
    // other anchors) rather than at the end, still marked as the person's pick.
    const hickory = lines.find((l) => l.getAttribute("data-plan-line") === "109");
    expect(hickory?.getAttribute("data-manual")).toBe("true");
    expect(within(hickory!).getByTestId("plan-badge-manual").textContent).toBe("your pick");
  });
});
