// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import PlanPage from "./page";
import { PLAN_EXPERIMENTAL_NOTE, PLAN_EXPERIMENTAL_TAG, PLAN_HEADING } from "./copy";

/**
 * §F kill switch on /plan (GOL-3527): off, the route 404s like any unknown
 * path; on, the page renders. Both read `PLANNER_ENABLED` per request.
 */
const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({ notFound: () => notFound() }));
const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined) }),
}));
vi.mock("./planner", () => ({
  Planner: ({ tester }: { tester?: boolean }) => <div data-testid="planner-stub" data-tester={String(!!tester)} />,
}));
vi.mock("../category-bar", () => ({ CategoryBar: () => <nav data-testid="category-bar-stub" /> }));

afterEach(() => {
  cleanup();
  cookieJar.clear();
  vi.unstubAllEnvs();
  notFound.mockClear();
});

describe("/plan page", () => {
  it("calls notFound while PLANNER_ENABLED is unset", async () => {
    vi.stubEnv("PLANNER_ENABLED", "");
    vi.stubEnv("NEXT_PUBLIC_PLANNER", "");
    await expect(PlanPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });

  it("renders the quiz page when PLANNER_ENABLED=1", async () => {
    vi.stubEnv("PLANNER_ENABLED", "1");
    render(await PlanPage());
    expect(notFound).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(PLAN_HEADING.lead);
    expect(screen.getByTestId("plan-experimental").textContent).toBe(PLAN_EXPERIMENTAL_TAG);
    expect(screen.getByText(PLAN_EXPERIMENTAL_NOTE)).toBeTruthy();
    expect(screen.getByTestId("planner-stub")).toBeTruthy();
  });

  // Tester mode (winter-beta §C.4, GOL-3551): the bench is the planner's to
  // draw, but only when the page saw the HttpOnly tester cookie.
  it("tells the planner it is in tester mode only when the tester cookie is present", async () => {
    vi.stubEnv("PLANNER_ENABLED", "1");
    render(await PlanPage());
    expect(screen.getByTestId("planner-stub").dataset.tester).toBe("false");
    cleanup();
    cookieJar.set("grove_planner_tester", "tQ3x_9-AbCdEfGhIjKlMnOpQrStUvWx");
    render(await PlanPage());
    expect(screen.getByTestId("planner-stub").dataset.tester).toBe("true");
    cleanup();
    cookieJar.set("grove_planner_tester", "x");
    render(await PlanPage());
    expect(screen.getByTestId("planner-stub").dataset.tester).toBe("false");
  });
});
