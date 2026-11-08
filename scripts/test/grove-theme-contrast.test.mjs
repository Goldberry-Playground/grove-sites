// grove-theme-contrast.mjs — WCAG contrast over resolved brand tokens.
// Exercised through the CLI with GROVE_LINT_ROOT at a fixture tree carrying
// its own grove-theme-contrast.config.json.
//
// Run: node --test scripts/test/grove-theme-contrast.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

const HERE = import.meta.dirname;
const ROOT = join(HERE, "..", "..");
const SCRIPT = join(ROOT, "scripts", "grove-theme-contrast.mjs");

function run(fixtureRoot, args = []) {
  try {
    const stdout = execFileSync("node", [SCRIPT, ...args], {
      env: { ...process.env, GROVE_LINT_ROOT: fixtureRoot },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, stdout, stderr: "" };
  } catch (err) {
    return { code: err.status ?? 1, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
  }
}
function write(root, relPath, content) {
  const abs = join(root, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

const CONTRACT = `:root {
  --grove-color-primary: #3d2810;
  --grove-color-primary-foreground: #fff7e6;
  --grove-color-ink: #3d2810;
  --grove-color-paper: #fff7e6;
  --grove-color-paper-soft: #fbf4dd;
  --grove-color-line: color-mix(in srgb, var(--grove-color-primary) 10%, transparent);
}
`;
const CONFIG = (baseline = {}) =>
  JSON.stringify({
    contract: "packages/grove-tokens/src/contract.css",
    themesDir: "packages/grove-tokens/src/themes",
    pairs: {
      text: { fg: ["--grove-color-ink"], bg: ["--grove-color-paper", "--grove-color-paper-soft"], min: 4.5 },
      aaa: { fg: ["--grove-color-ink"], bg: ["--grove-color-paper"], min: 0, warnBelow: 7 },
      onPrimary: { fg: ["--grove-color-primary-foreground"], bg: ["--grove-color-primary"], min: 4.5 },
      line: { fg: ["--grove-color-line"], bg: ["--grove-color-paper"], min: 3 },
    },
    baseline,
  });

function fixture(themes, baseline) {
  const root = mkdtempSync(join(tmpdir(), "grove-contrast-"));
  write(root, "packages/grove-tokens/src/contract.css", CONTRACT);
  write(root, "grove-theme-contrast.config.json", CONFIG(baseline));
  for (const [brand, css] of Object.entries(themes)) {
    write(root, `packages/grove-tokens/src/themes/${brand}.css`, css);
  }
  return root;
}
const theme = (body) => `:root, [data-grove-theme="x"] {\n${body}\n}\n`;

test("a theme that keeps the contract defaults passes; color-mix pairs are unchecked, not failed", () => {
  const root = fixture({ alpha: theme(`  --grove-color-paper: #fff7e6;`) });
  const r = run(root, ["--json"]);
  rmSync(root, { recursive: true, force: true });
  assert.equal(r.code, 0, r.stderr);
  const rep = JSON.parse(r.stdout);
  const line = rep.brands[0].pairs.find((p) => p.fg === "--grove-color-line");
  assert.equal(line.status, "unchecked");
  assert.match(line.note, /color-mix/);
  assert.equal(rep.violations.length, 0);
});

test("a failing pair is exit 1 with the ratio in the message", () => {
  // light grey ink on cream paper ≈ 2:1
  const root = fixture({ pale: theme(`  --grove-color-ink: #a0a0a0;`) });
  const r = run(root, ["--json"]);
  rmSync(root, { recursive: true, force: true });
  assert.equal(r.code, 1);
  const rep = JSON.parse(r.stdout);
  const v = rep.violations.filter((x) => x.rule === "contrast");
  assert.equal(v.length, 2, JSON.stringify(v)); // on paper and on paper-soft
  assert.ok(v[0].ratio < 4.5);
  assert.match(v[0].message, /under the 4\.50:1 floor/);
  assert.match(r.stdout, /"brand": "pale"/);
});

test("var() alias chains resolve to the final color", () => {
  // ink → primary → a real hex. primary-foreground on primary must still compute.
  const root = fixture({
    chain: theme(`  --grove-color-primary: #1f3f2b;\n  --grove-color-ink: var(--grove-color-primary);`),
  });
  const r = run(root, ["--json"]);
  rmSync(root, { recursive: true, force: true });
  assert.equal(r.code, 0, r.stderr);
  const rep = JSON.parse(r.stdout);
  const ink = rep.brands[0].pairs.find((p) => p.fg === "--grove-color-ink" && p.bg === "--grove-color-paper");
  assert.equal(ink.status, "ok");
  assert.match(ink.fgValue, /#1f3f2b \(via --grove-color-primary\)/);
});

test("AAA is a warning, not a failure", () => {
  // #555 on cream is ~6.6:1 — clears 4.5, misses 7.
  const root = fixture({ mid: theme(`  --grove-color-ink: #555555;`) });
  const r = run(root, ["--json"]);
  rmSync(root, { recursive: true, force: true });
  assert.equal(r.code, 0, r.stderr);
  const rep = JSON.parse(r.stdout);
  assert.equal(rep.hasWarn, true);
  assert.match(rep.warnings[0].message, /AAA/);
});

test("a theme setting a role the contract never defines is the typo guard", () => {
  const root = fixture({ typo: theme(`  --grove-color-primray: #000000;`) });
  const r = run(root, ["--json"]);
  rmSync(root, { recursive: true, force: true });
  assert.equal(r.code, 1);
  const rep = JSON.parse(r.stdout);
  assert.equal(rep.violations[0].rule, "unknown-role");
  assert.match(rep.violations[0].message, /primray/);
});

test("baseline ratchet: a recorded failing pair passes as debt, but regressing fails", () => {
  const key = "pale --grove-color-ink on --grove-color-paper";
  const keySoft = "pale --grove-color-ink on --grove-color-paper-soft";
  // Record both failing pairs at their current ratio → clean run.
  let root = fixture({ pale: theme(`  --grove-color-ink: #a0a0a0;`) });
  let r = run(root, ["--json"]);
  const rep = JSON.parse(r.stdout);
  const recorded = Object.fromEntries(rep.violations.map((v) => [v.key, v.ratio]));
  rmSync(root, { recursive: true, force: true });

  root = fixture({ pale: theme(`  --grove-color-ink: #a0a0a0;`) }, { [key]: recorded[key], [keySoft]: recorded[keySoft] });
  r = run(root, ["--json"]);
  rmSync(root, { recursive: true, force: true });
  assert.equal(r.code, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).brands[0].pairs.find((p) => p.bg === "--grove-color-paper" && p.fg === "--grove-color-ink").status, "debt");

  // Make it worse than recorded → error.
  root = fixture({ pale: theme(`  --grove-color-ink: #c0c0c0;`) }, { [key]: recorded[key], [keySoft]: recorded[keySoft] });
  r = run(root, ["--json"]);
  rmSync(root, { recursive: true, force: true });
  assert.equal(r.code, 1);
  assert.match(JSON.parse(r.stdout).violations[0].message, /regressed below its recorded baseline/);
});

test("missing contract or themes is exit 2", () => {
  const root = mkdtempSync(join(tmpdir(), "grove-contrast-"));
  write(root, "grove-theme-contrast.config.json", CONFIG());
  const r = run(root);
  rmSync(root, { recursive: true, force: true });
  assert.equal(r.code, 2);
});

// Regression guard for the real repo, not a fixture. When the gate landed,
// --grove-color-warning-solid (#c77700, a cross-brand constant) sat under the
// 3:1 fill floor on ggg / hub / nursery paper and lived in config.baseline as
// shrink-only debt. The constant was darkened to #bb6f00 and the entries
// deleted; this pins both so the debt cannot quietly come back.
test("repo tokens: every status solid clears 3:1 on every brand paper, with an empty baseline", () => {
  const r = run(ROOT, ["--json"]);
  assert.equal(r.code, 0, r.stderr);
  const rep = JSON.parse(r.stdout);
  assert.ok(rep.brands.length >= 4, "expected the four brand themes");

  const repoConfig = JSON.parse(readFileSync(join(ROOT, "grove-theme-contrast.config.json"), "utf8"));
  const debtKeys = Object.keys(repoConfig.baseline ?? {}).filter((k) => !k.startsWith("$"));
  assert.deepEqual(debtKeys, [], `config.baseline still carries debt: ${debtKeys.join(", ")}`);

  for (const brand of rep.brands) {
    const debt = brand.pairs.filter((p) => p.status === "debt").map((p) => `${p.fg} on ${p.bg}`);
    assert.deepEqual(debt, [], `${brand.brand} still passes on baseline debt: ${debt.join(", ")}`);
    const warning = brand.pairs.find((p) => p.fg === "--grove-color-warning-solid" && p.bg === "--grove-color-paper");
    assert.ok(warning, `${brand.brand}: warning-solid on paper is not a checked pair`);
    assert.ok(warning.ratio >= 3, `${brand.brand}: warning-solid on paper is ${warning.ratio}:1, under the 3:1 floor`);
  }
});
