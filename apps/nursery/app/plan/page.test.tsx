// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import PlanPage from "./page";
import { PLAN_HEADING } from "./copy";

/**
 * §F kill switch on /plan (GOL-3527): off, the route 404s like any unknown
 * path; on, the page renders. Both read `PLANNER_ENABLED` per request.
 */
const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({ notFound: () => notFound() }));
vi.mock("./planner", () => ({ Planner: () => <div data-testid="planner-stub" /> }));
vi.mock("../category-bar", () => ({ CategoryBar: () => <nav data-testid="category-bar-stub" /> }));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  notFound.mockClear();
});

describe("/plan page", () => {
  it("calls notFound while PLANNER_ENABLED is unset", () => {
    vi.stubEnv("PLANNER_ENABLED", "");
    vi.stubEnv("NEXT_PUBLIC_PLANNER", "");
    expect(() => render(<PlanPage />)).toThrow("NEXT_NOT_FOUND");
    // React retries a throwing render before giving up, so assert "called", not a count.
    expect(notFound).toHaveBeenCalled();
  });

  it("renders the quiz page when PLANNER_ENABLED=1", () => {
    vi.stubEnv("PLANNER_ENABLED", "1");
    render(<PlanPage />);
    expect(notFound).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(PLAN_HEADING.lead);
    expect(screen.getByTestId("planner-stub")).toBeTruthy();
  });
});
