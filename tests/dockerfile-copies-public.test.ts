import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

// Repo-wide invariant guard (2026-09-30).
//
// Next's `output: "standalone"` bundle does NOT include an app's public/ dir;
// the Dockerfile has to copy it beside server.js. Local `next dev` serves
// public/ straight from disk, so a missing COPY is invisible until prod — which
// is how the hub /alliance page shipped with every logo 404ing and its hero
// photo failing in the image optimizer (the hub Dockerfile still said "the hub
// has no /public dir today"). For every app that has a non-empty public/ AND a
// Dockerfile, the Dockerfile must copy that public/ into the runtime image.

const repoRoot = path.resolve(__dirname, "..");
const appsDir = path.join(repoRoot, "apps");

function hasFiles(dir: string): boolean {
  if (!existsSync(dir)) return false;
  return readdirSync(dir).some((name) => {
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? hasFiles(p) : true;
  });
}

const apps = readdirSync(appsDir).filter((name) => {
  const dir = path.join(appsDir, name);
  return (
    statSync(dir).isDirectory() &&
    existsSync(path.join(dir, "Dockerfile")) &&
    hasFiles(path.join(dir, "public"))
  );
});

describe("Dockerfiles ship each app's public/ dir", () => {
  it("finds the storefront apps to check", () => {
    expect(apps).toEqual(expect.arrayContaining(["hub", "nursery", "goldberry", "ggg"]));
  });

  for (const app of apps) {
    it(`apps/${app}/Dockerfile copies apps/${app}/public into the runtime image`, () => {
      const dockerfile = readFileSync(path.join(appsDir, app, "Dockerfile"), "utf8");
      const copiesPublic = new RegExp(
        String.raw`^COPY\b[^\n]*\s/workspace/apps/${app}/public\s+\./apps/${app}/public\s*$`,
        "m",
      );
      expect(dockerfile).toMatch(copiesPublic);
    });
  }
});
