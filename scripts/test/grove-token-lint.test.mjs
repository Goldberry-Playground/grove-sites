// grove-token-lint.mjs — the GroveKit token gate. Exercised through the CLI
// with GROVE_LINT_ROOT pointed at a throwaway fixture tree, because the contract
// that matters is the exit code CI branches on and the JSON report.
//
// Run: node --test scripts/test/grove-token-lint.test.mjs
//
// The bugs worth catching: a phantom --grove-* token slipping through because
// it carries a fallback (the CaptureForm case), a raw hex hiding inside a
// fallback, and a false positive on the component-local accent-prop pattern.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

const HERE = import.meta.dirname;
const ROOT = join(HERE, "..", "..");
const LINT = join(ROOT, "scripts", "grove-token-lint.mjs");

function run(fixtureRoot, args = []) {
  try {
    const stdout = execFileSync("node", [LINT, ...args], {
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
  --grove-color-primary: #3d2810; /* a hex here is fine — this file DEFINES them */
  --grove-color-ink: #3d2810;
  --grove-color-paper: #fff7e6;
  --grove-color-error-fg: #9e2b1e;
  --grove-color-line: color-mix(in srgb, var(--grove-color-primary) 10%, transparent);
}
@media (prefers-reduced-motion: no-preference) {
  :root { --grove-duration-fast: 120ms; }
}
`;

function fixture(components) {
  const root = mkdtempSync(join(tmpdir(), "grove-lint-"));
  write(root, "packages/grove-tokens/src/contract.css", CONTRACT);
  for (const [path, content] of Object.entries(components)) {
    write(root, `packages/grove-ui/src/${path}`, content);
  }
  return root;
}

test("clean component CSS passes", () => {
  const root = fixture({
    "Button/Button.css": `.grove-btn {
  color: var(--grove-color-ink);
  background: var(--grove-color-paper);
  border: 1px solid var(--grove-color-line);
  transition: opacity var(--grove-duration-fast);
}
`,
  });
  const r = run(root, ["--json"]);
  rmSync(root, { recursive: true, force: true });
  assert.equal(r.code, 0, r.stderr);
  const report = JSON.parse(r.stdout);
  assert.equal(report.hasError, false);
  assert.deepEqual(report.violations, []);
  assert.equal(report.filesChecked, 1);
});

test("raw hex, rgb() and hsl() in a declaration value fail", () => {
  const root = fixture({
    "Card/Card.css": `.card { color: #b4232a; }
.card:hover { background: rgba(0, 0, 0, 0.1); }
.card--alt { border-color: hsl(10 20% 30%); }
`,
  });
  const r = run(root, ["--json"]);
  rmSync(root, { recursive: true, force: true });
  assert.equal(r.code, 1);
  const report = JSON.parse(r.stdout);
  const rules = report.violations.map((v) => v.rule);
  assert.deepEqual(rules, ["raw-color", "raw-color", "raw-color"]);
  assert.deepEqual(
    report.violations.map((v) => v.line),
    [1, 2, 3],
  );
});

test("a hex hiding in a var() fallback is still a raw color", () => {
  const root = fixture({
    "Form/Form.css": `.input { background: var(--grove-color-paper, #fff); }\n`,
  });
  const r = run(root, ["--json"]);
  rmSync(root, { recursive: true, force: true });
  assert.equal(r.code, 1);
  assert.equal(JSON.parse(r.stdout).violations[0].rule, "raw-color");
});

test("phantom --grove-* token fails even with a fallback (the CaptureForm bug)", () => {
  const root = fixture({
    "Capture/Capture.css": `.err { color: var(--grove-color-danger, var(--grove-color-ink)); }\n`,
  });
  const r = run(root, ["--json"]);
  rmSync(root, { recursive: true, force: true });
  assert.equal(r.code, 1);
  const v = JSON.parse(r.stdout).violations;
  assert.equal(v.length, 1);
  assert.equal(v[0].rule, "phantom");
  assert.equal(v[0].token, "--grove-color-danger");
});

test("foreign var() fails unless the component declares it locally", () => {
  const root = fixture({
    // Foreign: a bespoke app token leaked into the kit.
    "Nav/Nav.css": `.nav { color: var(--walnut); }\n`,
    // Local via TSX style key — the VendorCard accent-prop pattern.
    "VendorCard/VendorCard.css": `.vc { border-top-color: var(--vendor-card-accent, var(--grove-color-primary)); }\n`,
    "VendorCard/index.tsx": `type AccentVars = CSSProperties & { "--vendor-card-accent"?: string };\n`,
    // Local via CSS declaration in the same folder.
    "Strip/Strip.css": `.strip { --strip-gap: var(--grove-duration-fast); gap: var(--strip-gap); }\n`,
  });
  const r = run(root, ["--json"]);
  rmSync(root, { recursive: true, force: true });
  assert.equal(r.code, 1);
  const v = JSON.parse(r.stdout).violations;
  assert.equal(v.length, 1, JSON.stringify(v));
  assert.equal(v[0].rule, "foreign-var");
  assert.equal(v[0].token, "--walnut");
  assert.match(v[0].file, /Nav\.css$/);
});

test("comments are ignored; the allow marker suppresses a line", () => {
  const root = fixture({
    "Hero/Hero.css": `/* legacy palette: #112233 and var(--moss) — documentation only */
.hero {
  /* color: #abcdef; */
  color: var(--grove-color-ink);
  background: #0f0f0f; /* grove-lint: allow — print-only stylesheet, brand-neutral by design */
}
`,
  });
  const r = run(root);
  rmSync(root, { recursive: true, force: true });
  assert.equal(r.code, 0, r.stderr);
});

test("an #id selector or url(#fragment) is not a color", () => {
  const root = fixture({
    "Icon/Icon.css": `#badge { color: var(--grove-color-ink); }
.icon { mask: url(#cafe00); fill: var(--grove-color-ink); }
`,
  });
  const r = run(root);
  rmSync(root, { recursive: true, force: true });
  assert.equal(r.code, 0, r.stderr);
});

test("missing contract or empty scope is exit 2, never a silent green", () => {
  const noContract = mkdtempSync(join(tmpdir(), "grove-lint-"));
  write(noContract, "packages/grove-ui/src/A/A.css", ".a{}");
  const r1 = run(noContract);
  rmSync(noContract, { recursive: true, force: true });
  assert.equal(r1.code, 2);

  const noCss = mkdtempSync(join(tmpdir(), "grove-lint-"));
  write(noCss, "packages/grove-tokens/src/contract.css", CONTRACT);
  mkdirSync(join(noCss, "packages/grove-ui/src"), { recursive: true });
  const r2 = run(noCss);
  rmSync(noCss, { recursive: true, force: true });
  assert.equal(r2.code, 2);
});

test("GitHub annotations carry file and line", () => {
  const root = fixture({
    "X/X.css": `.x { color: #123456; }\n`,
  });
  const r = run(root);
  rmSync(root, { recursive: true, force: true });
  assert.equal(r.code, 1);
  assert.match(r.stderr, /::error title=GroveKit token lint,file=packages\/grove-ui\/src\/X\/X\.css,line=1::/);
});
