import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * `packages/planner` is a pure function over the catalog feed (order-builder
 * spec §C.2 "Determinism"): same input and catalog give the same result. That
 * only holds if the package never reads the clock, the RNG, the network or
 * React/Odoo, so this guard scans the package source for all of them.
 */
const PLANNER_SRC = path.join(__dirname, "..", "packages", "planner", "src");

describe("packages/planner stays pure", () => {
  const files = fs
    .readdirSync(PLANNER_SRC)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

  it("has source files to scan", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("%s has no Date, random, fetch, React or Odoo import", (file) => {
    const src = fs.readFileSync(path.join(PLANNER_SRC, file), "utf8");
    expect(src).not.toMatch(/\bnew Date\b|Date\.now|Math\.random|\bfetch\(/);
    expect(src).not.toMatch(/from "react|from "@grove\/odoo-client|from "next/);
  });
});
