// Run: node --test scripts/test/image-budget.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { checkNextConfig, checkSource, uncappedTerm } from "../image-budget.mjs";

const SCRIPT = join(import.meta.dirname, "..", "image-budget.mjs");
const GOOD_CONFIG = `export default { images: { ...groveImageDefaults, remotePatterns: [{ hostname: "a" }] } };`;

test("accepts a config that spreads the defaults", () => {
  assert.deepEqual(checkNextConfig(GOOD_CONFIG), []);
});

test("ignores apps with no images block", () => {
  assert.deepEqual(checkNextConfig("export default { output: 'standalone' };"), []);
});

test("rejects a config without the shared defaults", () => {
  assert.match(checkNextConfig(`const c = { images: { remotePatterns: [] } };`)[0], /groveImageDefaults/);
});

test("rejects a locally overridden format", () => {
  const out = checkNextConfig(`const c = { images: { ...groveImageDefaults, formats: ["image/avif"] } };`);
  assert.deepEqual(out, ["images.formats must come from groveImageDefaults"]);
});

test("ignores locked key names in comments", () => {
  const src = `const c = { images: {\n // formats: are shared\n ...groveImageDefaults } };`;
  assert.deepEqual(checkNextConfig(src), []);
});

test("flags a fill image with no sizes", () => {
  assert.equal(checkSource(`<Image src={a} alt="" fill />`).errors.length, 1);
});

test("allows a fixed-size image with no sizes", () => {
  assert.equal(checkSource(`<Image src={a} alt="" width={64} height={64} />`).errors.length, 0);
});

test("flags a ProductImage with no sizes", () => {
  assert.equal(checkSource(`<ProductImage src={a} alt="" />`).errors.length, 1);
});

test("accepts expression sizes and arrow-function props", () => {
  const src = `<Image fill onLoad={() => x > 1} sizes={cond ? A : B} alt="" src={a} />`;
  assert.deepEqual(checkSource(src), { errors: [], uncapped: 0 });
});

test("does not require sizes when a spread may carry it", () => {
  assert.equal(checkSource(`<Image fill {...props} />`).errors.length, 0);
});

test("detects only bare partial-viewport endings", () => {
  assert.equal(uncappedTerm("(max-width: 640px) 50vw, 33vw"), "33vw");
  assert.equal(uncappedTerm("(max-width: 640px) 50vw, min(33vw, 340px)"), null);
  assert.equal(uncappedTerm("(max-width: 720px) 100vw, 720px"), null);
  assert.equal(uncappedTerm("100vw"), null);
});

function fixture(tsx, baseline = {}) {
  const root = mkdtempSync(join(tmpdir(), "image-budget-"));
  const write = (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  write("perf-budget.config.json", JSON.stringify({ images: { uncappedSizesBaseline: baseline } }));
  write("apps/a/next.config.ts", GOOD_CONFIG);
  write("apps/a/page.tsx", tsx);
  return root;
}

function run(root) {
  return spawnSync(process.execPath, [SCRIPT], { env: { ...process.env, PERF_BUDGET_ROOT: root }, encoding: "utf8" }).status;
}

const UNCAPPED = `<Image fill alt="" src={a} sizes="(max-width: 640px) 50vw, 33vw" />`;

test("CLI passes clean code", () => {
  const root = fixture(`<Image fill alt="" src={a} sizes="min(33vw, 340px)" />`);
  assert.equal(run(root), 0);
  rmSync(root, { recursive: true });
});

test("CLI fails a new uncapped sizes value", () => {
  const root = fixture(UNCAPPED);
  assert.equal(run(root), 1);
  rmSync(root, { recursive: true });
});

test("CLI allows grandfathered uses but not more of them", () => {
  const ok = fixture(UNCAPPED, { "apps/a/page.tsx": 1 });
  assert.equal(run(ok), 0);
  rmSync(ok, { recursive: true });
  const grew = fixture(UNCAPPED + UNCAPPED, { "apps/a/page.tsx": 1 });
  assert.equal(run(grew), 1);
  rmSync(grew, { recursive: true });
});

test("CLI exits 2 when there is nothing to check", () => {
  const root = mkdtempSync(join(tmpdir(), "image-budget-"));
  writeFileSync(join(root, "perf-budget.config.json"), "{}");
  assert.equal(run(root), 2);
  rmSync(root, { recursive: true });
});
