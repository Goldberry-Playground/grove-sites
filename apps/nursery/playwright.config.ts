import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the nursery storefront E2E acceptance suite (GOL-1074).
 *
 * Target model: this suite runs against a *deployed* nursery instance, not a
 * dev server bundled by Playwright. In CI that is the per-PR preview droplet
 * provisioned by `.github/workflows/preview-up.yml` (the `nursery` entry of the
 * `preview_urls_json` terraform output). Point it anywhere with:
 *
 *   E2E_NURSERY_BASE_URL=https://nursery.pr-123.preview.grove... pnpm test:e2e
 *
 * The Stripe-test-mode + success/decline specs additionally require the QA Odoo
 * backend to have Stripe TEST keys wired (GOL-899). Without them the
 * `/api/checkout/session` route 503s and those specs are expected to fail —
 * see e2e/README.md for the run contract and current blockers.
 *
 * For a fully local run against `pnpm --filter @grove/nursery dev` set
 * E2E_LOCAL=1 (spins up next dev on :3003 and points baseURL at it).
 */

const LOCAL = process.env.E2E_LOCAL === "1";
const LOCAL_URL = "http://localhost:3003";

const baseURL =
  process.env.E2E_NURSERY_BASE_URL?.replace(/\/$/, "") ??
  (LOCAL ? LOCAL_URL : undefined);

if (!baseURL) {
  throw new Error(
    "E2E_NURSERY_BASE_URL is required (the deployed nursery URL to test against). " +
      "Set E2E_LOCAL=1 to run against a local `next dev` on :3003 instead.",
  );
}

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  // Deployed target + Stripe redirects are inherently a bit slow; give room.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // A shared preview is not isolated per worker; serialize in CI to keep the
  // itemized-review / cart-clear assertions deterministic. Locally, parallel.
  fullyParallel: !isCI,
  workers: isCI ? 1 : undefined,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI
    ? [["github"], ["list"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  outputDir: "./e2e/.artifacts",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Preview droplets set noindex + are unguessable but public; no auth needed.
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  ...(LOCAL
    ? {
        webServer: {
          command: "pnpm --filter @grove/nursery dev",
          url: LOCAL_URL,
          reuseExistingServer: true,
          timeout: 120_000,
        },
      }
    : {}),
});
