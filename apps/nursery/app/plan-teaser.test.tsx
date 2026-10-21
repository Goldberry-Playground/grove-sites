// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PlanTeaser } from "./plan-teaser";
import { HOME_TEASER_HEADING } from "./plan/copy";

/**
 * §F kill switch on the home teaser (GOL-3527): the flag is a runtime env read,
 * so the same rendered component shows or hides per request.
 */
vi.mock("./plan/planner", () => ({ Planner: () => <div data-testid="planner-stub" /> }));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("PlanTeaser", () => {
  it("renders nothing while PLANNER_ENABLED is unset", () => {
    vi.stubEnv("PLANNER_ENABLED", "");
    vi.stubEnv("NEXT_PUBLIC_PLANNER", "");
    const { container } = render(<PlanTeaser />);
    expect(container.innerHTML).toBe("");
  });

  it("renders the section with the quiz when PLANNER_ENABLED=1", () => {
    vi.stubEnv("PLANNER_ENABLED", "1");
    render(<PlanTeaser />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toContain(HOME_TEASER_HEADING);
    expect(screen.getByTestId("planner-stub")).toBeTruthy();
  });
});
