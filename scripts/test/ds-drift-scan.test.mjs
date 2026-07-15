// ds-drift-scan.mjs — the scheduled detector that turns a ds-guard exit into an
// issue (GOL-411). Exercised through the CLI, like ds-guard's own tests: the
// JSON report IS the contract (the routine agent branches on `shouldOpenIssue`
// and posts `issueBody` verbatim), so that is what needs defending.
//
// Run: node --test scripts/test/ds-drift-scan.test.mjs
//
// The bugs worth catching here are the ones that make the detector quiet for the
// wrong reason. A detector that reports "clean" when it never fetched anything,
// or when the guard itself errored, is worse than no detector: it reads as
// coverage while covering nothing. Most of these tests pin that distinction.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const SCAN = join(ROOT, "scripts", "ds-drift-scan.mjs");
const GUARD = join(ROOT, "scripts", "ds-guard.mjs");

const bundle = (primary) => `
:root {
  --grove-color-primary: #3d2810;
  --grove-color-accent: #617333;
}

:root,
[data-grove-theme="goldberry"] {
  --grove-color-primary: ${primary};
}
`;

// Both scripts resolve their paths from their own location, so they have to run
// from copies inside the fixture tree — same reason as the ds-guard tests.
function fixture(fn) {
  const dir = mkdtempSync(join(tmpdir(), "ds-drift-"));
  try {
    mkdirSync(join(dir, ".design-sync"), { recursive: true });
    mkdirSync(join(dir, "packages", "grove-ui"), { recursive: true });
    mkdirSync(join(dir, "scripts"), { recursive: true });
    writeFileSync(join(dir, "scripts", "ds-drift-scan.mjs"), readFileSync(SCAN, "utf8"));
    writeFileSync(join(dir, "scripts", "ds-guard.mjs"), readFileSync(GUARD, "utf8"));
    writeFileSync(join(dir, ".design-sync", "config.goldberry.json"), JSON.stringify({ projectId: "proj-test" }));
    writeFileSync(join(dir, "packages", "grove-ui", "ds-theme.goldberry.css"), bundle("#7f4f1d"));

    const publish = (brand, css) => {
      mkdirSync(join(dir, ".ds-sync", "published", brand), { recursive: true });
      writeFileSync(join(dir, ".ds-sync", "published", brand, "_ds_bundle.css"), css);
    };
    const baseline = (brand, css) => {
      publish(brand, css);
      execFileSync("node", [join(dir, "scripts", "ds-guard.mjs"), "--brand", brand, "--published", join(dir, ".ds-sync", "published", brand, "_ds_bundle.css"), "--adopt"], { stdio: "ignore" });
    };
    const scan = () => JSON.parse(execFileSync("node", [join(dir, "scripts", "ds-drift-scan.mjs")], { encoding: "utf8" }));

    fn({ dir, publish, baseline, scan });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("a brand whose published bundle still matches its baseline is clean and opens nothing", () => {
  fixture(({ baseline, scan }) => {
    baseline("goldberry", bundle("#7f4f1d"));
    const r = scan();
    assert.equal(r.shouldOpenIssue, false);
    assert.deepEqual(r.clean.map((c) => c.brand), ["goldberry"]);
    assert.equal(r.drifted.length, 0);
  });
});

test("an in-app retheme drifts, and the issue body names the divergent token and both values", () => {
  fixture(({ baseline, publish, scan }) => {
    baseline("goldberry", bundle("#7f4f1d"));
    publish("goldberry", bundle("#aa0000")); // brand owner rethemes the primary
    const r = scan();
    assert.equal(r.shouldOpenIssue, true);
    assert.deepEqual(r.drifted.map((d) => d.brand), ["goldberry"]);
    assert.match(r.issueTitle, /goldberry/);
    // The whole value of the issue is that a human can act on it without
    // re-running anything, so the token and both sides must survive into it.
    assert.match(r.issueBody, /--grove-color-primary/);
    assert.match(r.issueBody, /#7f4f1d/);
    assert.match(r.issueBody, /#aa0000/);
    // It must route to the brand owner, not to whoever is on call for CI.
    assert.match(r.issueBody, /Abigail/);
  });
});

test("a brand with no baseline is reported uncovered, NOT clean", () => {
  // The dangerous alternative: ds-guard falls back to diffing the repo artifact
  // when there is no baseline, which on a schedule fires forever and trains
  // everyone to ignore the issue. Uncovered must be its own bucket, and must be
  // stated in the issue body so nobody reads silence as coverage.
  fixture(({ publish, baseline, scan }) => {
    baseline("goldberry", bundle("#7f4f1d"));
    publish("ggg", bundle("#123456"));
    publish("goldberry", bundle("#aa0000"));
    const r = scan();
    assert.ok(r.uncovered.some((u) => u.brand === "ggg"));
    assert.ok(!r.clean.some((c) => c.brand === "ggg"));
    assert.ok(!r.drifted.some((d) => d.brand === "ggg"));
    assert.match(r.issueBody, /Not covered by this scan/);
    assert.match(r.issueBody, /ggg/);
  });
});

test("a baselined brand whose fetch never landed is notFetched, NOT clean", () => {
  // If the agent's DesignSync fetch silently fails, the published file is
  // absent. Counting that as clean would turn a broken fetch into a green
  // detector — absence of evidence becoming evidence of safety.
  fixture(({ baseline, scan, dir }) => {
    baseline("goldberry", bundle("#7f4f1d"));
    rmSync(join(dir, ".ds-sync", "published", "goldberry", "_ds_bundle.css"));
    const r = scan();
    assert.deepEqual(r.notFetched.map((n) => n.brand), ["goldberry"]);
    assert.equal(r.clean.length, 0);
  });
});

test("a guard that cannot form an opinion is surfaced as broken and still opens an issue", () => {
  // ds-guard exits 2 on a file that is not a published bundle. A scan that
  // swallowed that would be indistinguishable from a quiet one.
  fixture(({ baseline, publish, scan }) => {
    baseline("goldberry", bundle("#7f4f1d"));
    publish("goldberry", "/* no custom properties at all */");
    const r = scan();
    assert.equal(r.shouldOpenIssue, true);
    assert.deepEqual(r.broken.map((b) => b.brand), ["goldberry"]);
    assert.equal(r.clean.length, 0);
    assert.match(r.issueTitle, /broken/);
  });
});

test("the fingerprint keys on the drifted brand set, so an ongoing retheme does not reopen an issue per edit", () => {
  fixture(({ baseline, publish, scan }) => {
    baseline("goldberry", bundle("#7f4f1d"));
    publish("goldberry", bundle("#aa0000"));
    const first = scan().fingerprint;
    publish("goldberry", bundle("#bb0000")); // owner keeps tweaking while we wait
    assert.equal(scan().fingerprint, first);
    assert.equal(first, "ds-drift:goldberry");
  });
});

test("a clean scan has a null fingerprint", () => {
  fixture(({ baseline, scan }) => {
    baseline("goldberry", bundle("#7f4f1d"));
    assert.equal(scan().fingerprint, null);
  });
});
