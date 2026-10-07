#!/usr/bin/env node
// Behavioral test for the wedged-entry selector in scripts/ci/merge-queue-rescue.sh
// (GOL-2790).
//
// What it protects:
//   The rescue script DEQUEUES and re-enqueues live pull requests. A false
//   positive therefore ejects a healthy PR that may be seconds from merging and
//   sends it back to the end of the queue — so the selector's "stay quiet"
//   direction matters at least as much as its "fire" direction. And because the
//   thing it detects is itself silent (a dead merge group has no red check and
//   no notification), a selector that quietly stopped matching would be
//   invisible, exactly like the bug it rescues.
//
//   As with merge-queue-wedge-detector.test.mjs, the logic is extracted from the
//   real script rather than copied here, so the test cannot drift away from what
//   actually runs.
//
// node builtins only — run by the `CI scripts` job (scripts/ci/*.test.mjs).

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const script = join(repoRoot, "scripts", "ci", "merge-queue-rescue.sh");

// ── Extract the selector straight out of the script ────────────────────────
// It is the single `<<'PYEOF' ... PYEOF` heredoc. Pulling it by delimiter keeps
// this on node builtins and makes a broken heredoc surface as a python failure.
const src = readFileSync(script, "utf8").split("\n");
const start = src.findIndex((l) => l.includes("<<'PYEOF'"));
const end = src.findIndex((l, i) => i > start && l.trim() === "PYEOF");
if (start < 0 || end < 0) {
  console.error(`FAIL: could not locate the PYEOF selector block in ${script} (start=${start}, end=${end}).`);
  console.error("If the selector was rewritten or removed, update or delete this test deliberately.");
  process.exit(1);
}
const selector = src.slice(start + 1, end).join("\n");

// Ages are relative to real wall-clock time: the selector reads `now` from the
// clock, and giving it a test-only injection seam would mean the grace-window
// branch under test was not the one that runs in production.
const ago = (s) => new Date(Date.now() - s * 1000).toISOString().replace(".000Z", "Z");

// The exact shape the GraphQL query asks for.
const entry = (over = {}) => ({
  state: "AWAITING_CHECKS",
  enqueuedAt: ago(600),
  enqueuer: { login: "github-actions" },
  headCommit: { oid: "dead0000000000000000000000000000000000ee" },
  pullRequest: {
    number: 893,
    id: "PR_node",
    state: "OPEN",
    reviewDecision: "APPROVED",
    mergeStateStatus: "CLEAN",
    ...(over.pullRequest || {}),
  },
  ...Object.fromEntries(Object.entries(over).filter(([k]) => k !== "pullRequest")),
});

const run = (nodes) => {
  const r = spawnSync("python3", ["-c", selector], {
    encoding: "utf8",
    env: {
      ...process.env,
      GRACE: "180",
      DEAD: "github-actions",
      ENTRIES_JSON: JSON.stringify({ data: { repository: { mergeQueue: { entries: { nodes } } } } }),
    },
  });
  if (r.status !== 0) {
    console.error("FAIL: selector exited nonzero\n" + (r.stderr || ""));
    process.exit(1);
  }
  return r.stdout.trim();
};

let failures = 0;
const check = (name, actual, expected) => {
  if (actual === expected) {
    console.log(`  ok   ${name}`);
  } else {
    console.error(`  FAIL ${name}\n       expected: ${JSON.stringify(expected)}\n       actual:   ${JSON.stringify(actual)}`);
    failures += 1;
  }
};

console.log("merge-queue-rescue selector:");

// ── Fires on the real dead-group signature ─────────────────────────────────
// This is the GOL-2790 #893 shape, field for field.
check(
  "fires on a github-actions entry past the grace window",
  run([entry()]).split("\t").slice(0, 1).join(""),
  "893",
);

// A PR cut from a main with a red *non-required* gate reports UNSTABLE for as
// long as that red lasts (GOL-2826: #918 sat wedged at the head of the queue
// through the brace-expansion/undici CVE window, and the selector skipped it).
// That is the busiest queue window there is, so UNSTABLE must fire too.
check(
  "fires on an UNSTABLE entry (non-required gate red on main)",
  run([entry({ pullRequest: { number: 918, mergeStateStatus: "UNSTABLE" } })]).split("\t").slice(0, 1).join(""),
  "918",
);

// ── Stays quiet on every adjacent shape ────────────────────────────────────
// Each of these would, if matched, dequeue a PR that is not wedged.
check("quiet inside the grace window", run([entry({ enqueuedAt: ago(30) })]), "");
check("quiet when enqueued by the App already", run([entry({ enqueuer: { login: "agenticos-developer" } })]), "");
check("quiet when the entry is not AWAITING_CHECKS", run([entry({ state: "MERGEABLE" })]), "");
check("quiet before a group commit exists", run([entry({ headCommit: null })]), "");
check("quiet when review is not APPROVED", run([entry({ pullRequest: { reviewDecision: "REVIEW_REQUIRED" } })]), "");
check("quiet when review is CHANGES_REQUESTED", run([entry({ pullRequest: { reviewDecision: "CHANGES_REQUESTED" } })]), "");
check("quiet when the PR is not mergeable", run([entry({ pullRequest: { mergeStateStatus: "BLOCKED" } })]), "");
check("quiet on a conflicted PR", run([entry({ pullRequest: { mergeStateStatus: "DIRTY" } })]), "");
check("quiet when mergeability is not computed yet", run([entry({ pullRequest: { mergeStateStatus: "UNKNOWN" } })]), "");
check("quiet when the PR is already closed", run([entry({ pullRequest: { state: "MERGED" } })]), "");
check("quiet on an empty queue", run([]), "");

// ── Selects only the wedged entries out of a mixed queue ───────────────────
// The GOL-2790 case: healthy and dead entries sat in the same queue.
const mixed = run([
  entry({ pullRequest: { number: 897 } }),
  entry({ enqueuer: { login: "agenticos-developer" }, pullRequest: { number: 900 } }),
  entry({ enqueuedAt: ago(10), pullRequest: { number: 901 } }),
  entry({ pullRequest: { number: 899 } }),
]);
check(
  "picks only the wedged entries from a mixed queue",
  mixed.split("\n").map((l) => l.split("\t")[0]).join(","),
  "897,899",
);

if (failures > 0) {
  console.error(`\n${failures} selector assertion(s) failed.`);
  process.exit(1);
}
console.log("\nall selector assertions passed.");
