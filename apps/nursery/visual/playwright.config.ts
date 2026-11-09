import { defineConfig, devices } from "@playwright/test";

// Screenshot comparison for the parts of each site that should not change
// between deploys. Lives outside e2e/ so the nursery suites never collect it.
// Baselines are made on GitHub's Linux runners (visual-chrome.yml, update=true)
// because fonts and browser builds differ on a Mac.
export default defineConfig({
  testDir: ".",
  timeout: 60_000,
  retries: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "report" }]],
  outputDir: ".artifacts",
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: "disabled" } },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
});
