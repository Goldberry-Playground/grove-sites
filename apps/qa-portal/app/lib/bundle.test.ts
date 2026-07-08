import { afterAll, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listComponents, previewSrc } from "./bundle";

const base = mkdtempSync(join(tmpdir(), "qa-bundle-"));
const generalDir = join(base, "goldberry", "components", "general");
for (const name of ["SiblingStrip", "Button", "NavLink"]) {
  mkdirSync(join(generalDir, name), { recursive: true });
  writeFileSync(join(generalDir, name, `${name}.html`), "<!doctype html>");
}

afterAll(() => rmSync(base, { recursive: true, force: true }));

describe("bundle", () => {
  it("lists components from the bundle dir, sorted", () => {
    expect(listComponents("goldberry", base)).toEqual(["Button", "NavLink", "SiblingStrip"]);
  });

  it("builds the public preview src for a component", () => {
    expect(previewSrc("ggg", "Button")).toBe(
      "/bundles/ggg/components/general/Button/Button.html",
    );
  });
});
