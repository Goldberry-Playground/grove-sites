#!/usr/bin/env node
// Production storefront canary: opens each site's key pages on a phone and a
// desktop and fails when a shopper would see something broken. Routes come from
// mobile-matrix.config.json; prod hosts and timeouts from its `canary` block.
//
// Catches what the 2026-11-09 Cloudflare proxy switch showed: a page can return
// 200 and still bounce shoppers through redirects or a challenge. It checks the
// status, that the URL did not change, that no Cloudflare challenge was served,
// and that there were no page crashes, server errors or broken images.
//
// Read-only: page loads only, no cart and no checkout. The nursery checkout has
// its own canary (synthetic-nursery.yml).
//
// Usage: node scripts/storefront-canary.mjs [--brands nursery,hub] [--targets-json {...}] [--out file]
// Exit: 0 healthy, 1 a page failed twice, 2 the check itself could not run.

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { firstProductPath } from "./mobile-matrix.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const normalize = (url) => {
  const u = new URL(url);
  return `${u.host.replace(/^www\./, "")}${u.pathname.replace(/\/$/, "")}`;
};

// Pure so the rules can be tested without a browser.
export function classifyVisit(v) {
  const errors = [];
  if (v.status == null || v.status >= 400) errors.push(`HTTP ${v.status ?? "no response"}`);
  if (normalize(v.requestedUrl) !== normalize(v.finalUrl)) errors.push(`redirected to ${v.finalUrl}`);
  if (v.cfMitigated || /^just a moment/i.test(v.title ?? "")) errors.push("Cloudflare challenge shown to shopper");
  for (const e of v.pageErrors) errors.push(`page crash: ${e.slice(0, 160)}`);
  for (const r of v.serverErrors) errors.push(`server error: ${r.slice(0, 160)}`);
  if (v.brokenImages.length) errors.push(`${v.brokenImages.length} broken image(s): ${v.brokenImages.slice(0, 3).join(", ").slice(0, 200)}`);
  return errors;
}

async function visit(browser, url, viewport, cfg) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.deviceScaleFactor,
    isMobile: viewport.isMobile,
    hasTouch: viewport.hasTouch,
  });
  const page = await context.newPage();
  const pageErrors = [];
  const serverErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 500 && new URL(r.url()).host === new URL(url).host) serverErrors.push(`${r.status()} ${r.url()}`);
  });
  try {
    const res = await page.goto(url, { waitUntil: "load", timeout: cfg.pageTimeoutMs });
    await page.evaluate(async () => {
      const step = Math.max(window.innerHeight * 0.8, 200);
      const maxTop = Math.min(document.documentElement.scrollHeight, step * 15);
      for (let top = 0; top < maxTop; top += step) {
        window.scrollTo(0, top);
        await new Promise((done) => setTimeout(done, 100));
      }
    });
    await page.waitForLoadState("networkidle", { timeout: cfg.settleTimeoutMs }).catch(() => {});
    const brokenImages = await page.evaluate(() =>
      [...document.querySelectorAll("img")]
        .filter((i) => i.complete && i.naturalWidth === 0 && i.getBoundingClientRect().width > 0)
        .map((i) => i.alt || i.currentSrc || i.src),
    );
    return classifyVisit({
      requestedUrl: url,
      finalUrl: page.url(),
      status: res?.status() ?? null,
      cfMitigated: Boolean(res?.headers()["cf-mitigated"]),
      title: await page.title(),
      pageErrors,
      serverErrors,
      brokenImages,
    });
  } catch (err) {
    return [`did not finish loading: ${err.message.split("\n")[0]}`];
  } finally {
    await context.close();
  }
}

async function main() {
  const CONFIG = JSON.parse(readFileSync(join(ROOT, "mobile-matrix.config.json"), "utf8"));
  const cfg = CONFIG.canary;
  const argValue = (name) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? process.argv[i + 1] : undefined;
  };
  // Point at another deployment, e.g. a preview: --targets-json '{"nursery":"https://…"}'
  if (argValue("targets-json")) cfg.targets = JSON.parse(argValue("targets-json"));
  const brands = argValue("brands")?.split(",") ?? Object.keys(cfg.targets).filter((k) => !k.startsWith("$"));

  const require = createRequire(import.meta.url);
  let browser;
  try {
    browser = await require("playwright").chromium.launch();
  } catch (err) {
    console.error(`::error::storefront-canary: Chromium failed to launch: ${err.message}`);
    process.exit(2);
  }

  const failures = [];
  let visited = 0;
  for (const brand of brands) {
    const base = cfg.targets[brand];
    const routes = [...CONFIG.routes[brand]];
    const productSpec = CONFIG.productRoute[brand];
    if (productSpec) {
      const html = await fetch(base + productSpec.listing, { signal: AbortSignal.timeout(cfg.pageTimeoutMs) })
        .then((r) => r.text())
        .catch(() => "");
      const product = firstProductPath(html, productSpec.prefix, productSpec.marker);
      if (product) routes.push(product);
    }
    for (const route of routes) {
      for (const vpName of cfg.viewports) {
        visited++;
        const url = base + route;
        let errors = await visit(browser, url, CONFIG.viewports[vpName], cfg);
        // One retry: a real outage fails twice, a network blip does not page anyone.
        if (errors.length) {
          await new Promise((done) => setTimeout(done, cfg.retryDelayMs));
          errors = await visit(browser, url, CONFIG.viewports[vpName], cfg);
        }
        console.log(`${errors.length ? "FAIL" : "ok  "} ${brand} ${route} ${vpName}`);
        for (const e of errors) {
          console.log(`     ${e}`);
          failures.push(`${url} (${vpName}): ${e}`);
        }
      }
    }
  }
  await browser.close();

  const out = argValue("out");
  if (out) writeFileSync(out, failures.join("\n"));
  console.log(`\n${visited} page visits, ${failures.length} problem(s).`);
  if (visited === 0) process.exit(2);
  process.exit(failures.length ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
