import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

// Repo-wide invariant guard (GOL-1874 / GOL-1894).
//
// Every storefront resolves product photos from whatever host `ODOO_URL`
// points at (apps/*/app/shop/[id]/page.tsx → resolveOdooImageUrl(...,
// process.env.ODOO_URL)) and renders them through `next/image`. next/image
// only fetches from hosts listed in `images.remotePatterns`; an off-list host
// returns `400 "url" parameter is not allowed`, which trips next/image's
// onError and renders the branded "Photo coming soon" placeholder. So a real,
// uploaded photo looks un-uploaded.
//
// That is exactly how the prod launch broke: the prod Odoo host
// (odoo.gatheringatthegrove.com, the `ODOO_URL` value in infra/do/*.yaml) was
// in NO app's remotePatterns — only QA/localhost were. This test makes that
// class of drift a red build: for every app whose infra spec sets `ODOO_URL`,
// the host that URL resolves to MUST appear in that app's next.config
// remotePatterns.
//
// hub is intentionally out of scope: it sets GROVE_ODOO_URL (not ODOO_URL) and
// renders Odoo images with a plain lazy <img> (apps/hub/components/
// grove-adapters.tsx), which bypasses the next/image optimizer and its
// allowlist entirely. Keying this invariant on ODOO_URL keeps hub excluded on
// purpose — if a future change adds ODOO_URL + next/image to hub, the rule
// starts applying automatically.

const repoRoot = path.resolve(__dirname, "..");
const appsDir = path.join(repoRoot, "apps");
const infraDir = path.join(repoRoot, "infra", "do");

/** Pull the `ODOO_URL` value out of a DigitalOcean App Platform spec (YAML). */
function odooUrlFromSpec(specPath: string): string | null {
  const lines = readFileSync(specPath, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*-?\s*key:\s*ODOO_URL\s*$/.test(lines[i])) {
      // The `value:` belongs to the same env-var block; it is the next
      // `value:` line after the key.
      for (let j = i + 1; j < lines.length && j < i + 6; j++) {
        const m = lines[j].match(/^\s*value:\s*(\S+)\s*$/);
        if (m) return m[1];
        if (/^\s*-?\s*key:\s*/.test(lines[j])) break; // ran into the next var
      }
    }
  }
  return null;
}

/** Every string-literal `hostname: "..."` in a next.config file. */
function allowlistedHostnames(configPath: string): string[] {
  const src = readFileSync(configPath, "utf8");
  return [...src.matchAll(/hostname:\s*"([^"]+)"/g)].map((m) => m[1]);
}

// Discover apps that have both a next.config and a matching infra spec.
const apps = readdirSync(appsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((name) => {
    const cfg =
      existsSync(path.join(appsDir, name, "next.config.ts")) ||
      existsSync(path.join(appsDir, name, "next.config.js"));
    return cfg && existsSync(path.join(infraDir, `${name}.yaml`));
  });

describe("Odoo image host is allowlisted in next/image remotePatterns", () => {
  it("discovers the storefront apps", () => {
    // Guard against the discovery silently matching nothing (which would make
    // every assertion below vacuously pass).
    expect(apps).toEqual(expect.arrayContaining(["nursery", "ggg", "goldberry"]));
  });

  for (const app of apps) {
    const specPath = path.join(infraDir, `${app}.yaml`);
    const odooUrl = odooUrlFromSpec(specPath);
    if (!odooUrl) continue; // app doesn't fetch Odoo images via ODOO_URL (e.g. hub)

    it(`${app}: ODOO_URL host (${new URL(odooUrl).hostname}) is in remotePatterns`, () => {
      const configPath = existsSync(path.join(appsDir, app, "next.config.ts"))
        ? path.join(appsDir, app, "next.config.ts")
        : path.join(appsDir, app, "next.config.js");
      const host = new URL(odooUrl).hostname;
      expect(allowlistedHostnames(configPath)).toContain(host);
    });
  }
});
