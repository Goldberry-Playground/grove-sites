import { expect, test, type Page, type Request } from "@playwright/test";

/**
 * Planner winter beta acceptance (planner-winter-beta spec §C.5, GOL-3550):
 * a West Virginia ZIP, open ground, food forest at 20 trees, mixed timing;
 * remove a line, add one from the suggested list, save the plan, and assert
 * the learning-loop calls the page makes to its own BFF.
 *
 * The BFF routes are intercepted here so the spec proves what the page sends
 * (kind, product, zone, lines) without writing signals into QA's Odoo on
 * every run. Same `PLANNER_ENABLED` skip as the order-builder spec.
 */

interface Captured {
  url: string;
  body: Record<string, unknown>;
}

function capture(page: Page, pattern: string, reply: Record<string, unknown>): Captured[] {
  const seen: Captured[] = [];
  void page.route(pattern, async (route) => {
    const req: Request = route.request();
    seen.push({ url: req.url(), body: (req.postDataJSON() as Record<string, unknown>) ?? {} });
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(reply) });
  });
  return seen;
}

test.describe("Planner winter beta", () => {
  test.beforeEach(async ({ page }) => {
    const res = await page.goto("/plan");
    test.skip(res?.status() === 404, "PLANNER_ENABLED is off on this target");
  });

  test("WV ZIP, open ground, food forest 20, mixed → remove, add, save → signal and save calls", async ({ page }) => {
    const signals = capture(page, "**/api/planner/signal", { ok: true });
    const saves = capture(page, "**/api/planner/save", { ok: true, id: 1 });

    await page.getByLabel("ZIP code").fill("26501");
    await expect(page.getByText(/ZIP 26501 is in USDA zone \d+/)).toBeVisible();
    await page.getByText("Open ground", { exact: true }).click();
    await page.getByText("Grow food for my family", { exact: true }).click();
    await page.getByText("Homestead", { exact: true }).click();
    await expect(page.getByLabel(/^Mixed/)).toBeChecked();
    await page.getByTestId("plan-see").click();

    await expect(page.getByRole("heading", { level: 2, name: /20-tree food forest/ })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("plan-philosophy")).toContainText(/Nothing here is planted alone/);

    const lines = page.getByTestId("plan-line");
    const before = await lines.count();
    expect(before).toBeGreaterThan(0);
    // Every line says where it sits and what it does.
    await expect(lines.first().getByTestId("plan-badge-stratum")).toBeVisible();

    // Remove the first line: one `removed` signal naming the product.
    const firstId = Number(await lines.first().getAttribute("data-plan-line"));
    await lines.first().getByTestId("plan-remove").click();
    await expect(page.getByText(/removed/).first()).toBeVisible();
    await expect.poll(() => signals.length).toBe(1);
    expect(signals[0].body).toMatchObject({ kind: "removed", product_tmpl_id: firstId, track: "food", site: "open", timing: "mixed" });
    expect(typeof signals[0].body.browser_id).toBe("string");
    expect(signals[0].body.plan_url).toContain("zip=26501");

    // Add the first suggestion: a manual line, one `added` signal, and the
    // list no longer offers it. A catalog that places everything it grows
    // has no suggestions; the spec says so rather than failing.
    const adds = page.getByTestId("plan-suggested-add");
    if ((await adds.count()) === 0) {
      test.info().annotations.push({ type: "note", description: "suggested list empty on this catalog; add step skipped" });
    } else {
      const addName = (await adds.first().getAttribute("aria-label"))?.replace(/^Add /, "") ?? "";
      await adds.first().click();
      const manual = page.locator("[data-testid='plan-line'][data-manual='true']");
      await expect(manual).toHaveCount(1);
      await expect(manual.getByTestId("plan-badge-manual")).toHaveText("your pick");
      const addedId = Number(await manual.getAttribute("data-plan-line"));
      await expect.poll(() => signals.length).toBe(2);
      expect(signals[1].body).toMatchObject({ kind: "added", product_tmpl_id: addedId });
      await expect(page.getByRole("button", { name: `Add ${addName}` })).toHaveCount(0);
    }

    // Save: the name, the remaining lines with role and stratum, then one `saved` signal.
    await page.getByLabel("Plan name").fill("The back field");
    await page.getByTestId("plan-save-button").click();
    await expect(page.getByText(/Saved as "The back field"/)).toBeVisible();
    expect(saves.length).toBe(1);
    const save = saves[0].body as { name: string; zone: number; track: string; lines: Record<string, unknown>[] };
    expect(save.name).toBe("The back field");
    expect(save.track).toBe("food");
    expect(typeof save.zone).toBe("number");
    expect(save.lines.length).toBeGreaterThan(0);
    expect(save.lines.some((l) => l.product_tmpl_id === firstId)).toBe(false);
    for (const line of save.lines) {
      expect(typeof line.product_tmpl_id).toBe("number");
      expect(line.qty as number).toBeGreaterThan(0);
      expect(["overstory", "understory", "mushroom", null]).toContain(line.stratum);
    }
    const kinds = signals.map((s) => s.body.kind);
    expect(kinds[kinds.length - 1]).toBe("saved");
  });

  test("Build my order posts a built signal before the cart writes", async ({ page }) => {
    const signals = capture(page, "**/api/planner/signal", { ok: true });
    await page.goto("/plan?zip=26501&site=open&track=food&size=20&timing=mixed");
    await expect(page.getByRole("heading", { level: 2, name: /20-tree food forest/ })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: /Build my/ }).first().click();
    await expect(page.getByRole("status").filter({ hasText: /Added \d+/ })).toBeVisible();
    await expect.poll(() => signals.length).toBe(1);
    expect(signals[0].body).toMatchObject({ kind: "built", product_tmpl_id: null });
  });

  test("phone: the result card with its badges and the suggested list fit the viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/plan?zip=26501&site=open&track=food&size=20&timing=mixed");
    await expect(page.getByRole("heading", { level: 2, name: /20-tree food forest/ })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("plan-suggested")).toBeVisible();
    await expect(page.getByTestId("plan-suggest")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
