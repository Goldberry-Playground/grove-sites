// ds-guard.mjs — the pre-push guard that refuses to clobber an in-app retheme
// (GOL-402). Exercised through the CLI rather than by importing internals: the
// exit code IS the contract (ds-build.sh branches on it), so that is what needs
// defending. A refactor that kept extractTokens() perfect but broke the exit
// code would ship a guard that never guards.
//
// Run: node --test scripts/test/ds-guard.test.mjs
//
// The live-project demonstration is in the GOL-402 thread — these are the cheap
// checks that keep the behaviour pinned afterwards.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const GUARD = join(ROOT, "scripts", "ds-guard.mjs");

// A minimal stand-in for a published _ds_bundle.css: the two-block shape that
// matters (contract defaults under :root, brand theme under the wrapped
// multi-selector) plus the comment/whitespace noise the converter emits.
const bundle = (primary, { extra = "", accent = "#617333" } = {}) => `
/* Grove token contract — generated, do not hand-edit */
:root {
  --grove-color-primary: #3d2810;   /* dark anchor */
  --grove-color-accent: ${accent};
${extra}}

:root,
[data-grove-theme="goldberry"] {
  --grove-color-primary: ${primary};  /* Chestnut Reserve */
}
`;

function runGuard(cwd, args) {
  try {
    const stdout = execFileSync("node", [GUARD, ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, out: stdout };
  } catch (e) {
    return { code: e.status, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

// Each case gets its own throwaway tree so an --adopt in one can't leak a
// baseline into another and make a later assertion pass for the wrong reason.
function fixture(fn) {
  const dir = mkdtempSync(join(tmpdir(), "ds-guard-"));
  try {
    mkdirSync(join(dir, ".design-sync"), { recursive: true });
    mkdirSync(join(dir, "packages", "grove-ui"), { recursive: true });
    mkdirSync(join(dir, "scripts"), { recursive: true });
    // The guard resolves its paths from its own location, so it has to be run
    // from a copy inside the fixture tree.
    writeFileSync(join(dir, "scripts", "ds-guard.mjs"), execFileSync("cat", [GUARD], { encoding: "utf8" }));
    writeFileSync(join(dir, ".design-sync", "config.goldberry.json"), JSON.stringify({ projectId: "proj-test" }));
    writeFileSync(join(dir, "packages", "grove-ui", "ds-theme.goldberry.css"), bundle("#7f4f1d"));
    const guard = (args) => {
      try {
        const stdout = execFileSync("node", [join(dir, "scripts", "ds-guard.mjs"), ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
        return { code: 0, out: stdout };
      } catch (e) {
        return { code: e.status, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
      }
    };
    const publish = (css) => {
      const p = join(dir, "published.css");
      writeFileSync(p, css);
      return p;
    };
    fn({ dir, guard, publish });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("published matching the repo passes when there is no baseline", () => {
  fixture(({ guard, publish }) => {
    const r = guard(["--brand", "goldberry", "--published", publish(bundle("#7f4f1d"))]);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /0 divergent/);
  });
});

test("ABORTS and names the divergent token when published drifts from the baseline", () => {
  fixture(({ guard, publish }) => {
    assert.equal(guard(["--brand", "goldberry", "--published", publish(bundle("#7f4f1d")), "--adopt"]).code, 0);
    // Simulate the brand owner rethemeing the primary in-app.
    const r = guard(["--brand", "goldberry", "--published", publish(bundle("#8c2f39"))]);
    assert.equal(r.code, 1, "a diverged project must abort");
    assert.match(r.out, /DIVERGED/);
    assert.match(r.out, /--grove-color-primary/, "must name the divergent token");
    assert.match(r.out, /#7f4f1d/, "must show the anchor value");
    assert.match(r.out, /#8c2f39/, "must show the published value");
  });
});

test("hex case alone is not divergence", () => {
  // Our pipeline emits lowercase; the in-app editor re-emits uppercase. If this
  // regressed, ggg/nursery would fire on every push and everyone would learn to
  // reach for --force — which would defeat the whole guard.
  fixture(({ guard, publish }) => {
    assert.equal(guard(["--brand", "goldberry", "--published", publish(bundle("#7f4f1d")), "--adopt"]).code, 0);
    const r = guard(["--brand", "goldberry", "--published", publish(bundle("#7F4F1D"))]);
    assert.equal(r.code, 0, `uppercase hex must not read as a retheme:\n${r.out}`);
  });
});

test("same token under two selectors is tracked separately", () => {
  // --grove-color-primary exists under both :root (contract default) and the
  // brand theme block with DIFFERENT values. Keying on the bare property name
  // would collapse them and hide a retheme in whichever copy lost.
  fixture(({ guard, publish }) => {
    assert.equal(guard(["--brand", "goldberry", "--published", publish(bundle("#7f4f1d")), "--adopt"]).code, 0);
    // Retheme ONLY the :root contract default; the theme block is untouched.
    const rethemed = bundle("#7f4f1d").replace("--grove-color-primary: #3d2810;", "--grove-color-primary: #111111;");
    const r = guard(["--brand", "goldberry", "--published", publish(rethemed)]);
    assert.equal(r.code, 1, `a retheme of the :root copy must still abort:\n${r.out}`);
    assert.match(r.out, /#111111/);
  });
});

test("a token added in-app is reported, not ignored", () => {
  fixture(({ guard, publish }) => {
    assert.equal(guard(["--brand", "goldberry", "--published", publish(bundle("#7f4f1d")), "--adopt"]).code, 0);
    const r = guard(["--brand", "goldberry", "--published", publish(bundle("#7f4f1d", { extra: "  --grove-color-brand-new: #abcdef;\n" }))]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /ONLY IN PUBLISHED/);
    assert.match(r.out, /--grove-color-brand-new/);
  });
});

test("a token-free file is rejected rather than read as agreement", () => {
  // The dangerous failure: a truncated/wrong-path fetch parses to zero tokens,
  // trivially "matches", and waves the push through. Absence of evidence must
  // never become evidence of safety.
  fixture(({ guard, publish }) => {
    assert.equal(guard(["--brand", "goldberry", "--published", publish(bundle("#7f4f1d")), "--adopt"]).code, 0);
    const r = guard(["--brand", "goldberry", "--published", publish("/* empty */\n")]);
    assert.equal(r.code, 2, `an empty bundle must be a usage error, never a pass:\n${r.out}`);
  });
});

test("a baseline from another project refuses to vouch", () => {
  fixture(({ dir, guard, publish }) => {
    assert.equal(guard(["--brand", "goldberry", "--published", publish(bundle("#7f4f1d")), "--adopt"]).code, 0);
    writeFileSync(join(dir, ".design-sync", "config.goldberry.json"), JSON.stringify({ projectId: "a-different-project" }));
    const r = guard(["--brand", "goldberry", "--published", publish(bundle("#7f4f1d"))]);
    assert.equal(r.code, 2, `cross-project comparison must refuse:\n${r.out}`);
    assert.match(r.out, /Refusing to compare across projects/);
  });
});

test("an unknown brand is a usage error", () => {
  const r = runGuard(ROOT, ["--brand", "not-a-brand", "--published", "/dev/null"]);
  assert.equal(r.code, 2);
});
