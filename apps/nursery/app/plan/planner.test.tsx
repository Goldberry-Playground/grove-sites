// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CartProvider, cartStorageKey } from "@grove/checkout";
import { FIXTURE_CATALOG } from "@grove/planner/fixtures";
import { Planner } from "./planner";
import { ResultCard, headlineFor, dropSpan, cartAcceptsGroup } from "./result-card";
import { plan } from "@grove/planner";

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
    expect(screen.getAllByTestId("plan-line").length).toBe(4);
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

describe("ResultCard: Build my order", () => {
  const input = { zone: 6, state: "WV", site: "open", track: "food", size: 20, timing: "mixed" } as const;

  it("adds every line to the cart store and opens the mini cart", async () => {
    const result = plan(input, FIXTURE_CATALOG);
    render(
      <CartProvider>
        <ResultCard
          result={result}
          input={input}
          eyebrow="ZIP 26501, zone 6, open ground"
          calendar={null}
          odooBase="http://odoo.test"
          contact={contact}
          onEdit={() => {}}
          onRetrySite={() => {}}
        />
      </CartProvider>,
    );
    // The fixture plan is all bareroot except nothing potted → a single button.
    const buttons = screen.getAllByRole("button", { name: /Build my/ });
    expect(buttons.length).toBe(1);
    await userEvent.click(buttons[0]);
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(cartStorageKey(process.env.NEXT_PUBLIC_TENANT_ID)) ?? "[]");
      expect(stored.map((i: { templateId: number; quantity: number; wave?: string }) => [i.templateId, i.quantity])).toEqual(
        result.lines.map((l) => [l.plant.id, l.qty]),
      );
      // Bareroot is always a wave pre-order: every line carries the first open wave.
      expect(stored.every((i: { wave?: string }) => i.wave === "fall" || i.wave === "spring")).toBe(true);
    });
    expect((await screen.findByRole("status")).textContent).toMatch(/Added 20 trees/);
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
