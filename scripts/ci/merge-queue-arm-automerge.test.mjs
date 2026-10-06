#!/usr/bin/env node
// Behavioral test for the arming selector in scripts/ci/merge-queue-arm-automerge.sh
// (GOL-3118).
//
// What it protects:
//   Arming auto-merge hands a live pull request to GitHub with standing
//   instructions to merge it the moment its gates go green. A false positive
//   therefore merges something nobody decided to merge -- and it does so later,
//   asynchronously, with no run of this script anywhere near the event. So the
//   "stay quiet" direction is the safety-critical one and gets most of the
//   cases below.
//
//   Two skips are load-bearing beyond mere caution:
//     - `armed by <someone else>`: re-arming would mean disabling a human's
//       auto-merge first, silently taking a merge decision from its owner.
//     - `already in the merge queue`: the entry (and its identity) already
//       exists, so arming cannot fix a dead group. Only the rescue script can.
//       If this skip broke, a wedged PR would look handled and still be ejected.
//
//   As with merge-queue-rescue.test.mjs, the selector is extracted from the real
//   script rather than copied here, so the test cannot drift away from what runs.
//
// node builtins only -- run by the `CI scripts` job (scripts/ci/*.test.mjs).

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const script = join(repoRoot, "scripts", "ci", "merge-queue-arm-automerge.sh");

// ── Extract the selector straight out of the script ────────────────────────
const src = readFileSync(script, "utf8").split("\n");
const start = src.findIndex((l) => l.includes("<<'PYEOF'"));
const end = src.findIndex((l, i) => i > start && l.trim() === "PYEOF");
if (start < 0 || end < 0) {
  console.error(`FAIL: could not locate the PYEOF selector block in ${script} (start=${start}, end=${end}).`);
  console.error("If the selector was rewritten or removed, update or delete this test deliberately.");
  process.exit(1);
}
const selector = src.slice(start + 1, end).join("\n");

const APP = "agenticos-developer";

const pr = (over = {}) => ({
  number: 987,
  id: "PR_node",
  headRefOid: "db8b6c3a5f3bb75bdf8628900980a089907f7f0c",
  isDraft: false,
  state: "OPEN",
  reviewDecision: "APPROVED",
  mergeable: "MERGEABLE",
  author: { login: "agenticos-developer" },
  autoMergeRequest: null,
  ...over,
});

// Runs the real selector over a synthetic graph and returns its decisions.
function decide(prs, { queued = [], armUnapproved = false } = {}) {
  const graph = {
    data: {
      repository: {
        pullRequests: { nodes: prs },
        mergeQueue: { entries: { nodes: queued.map((n) => ({ pullRequest: { number: n } })) } },
      },
    },
  };
  const r = spawnSync("python3", ["-c", selector], {
    encoding: "utf8",
    env: {
      ...process.env,
      APP_LOGIN: APP,
      ARM_UNAPPROVED: armUnapproved ? "1" : "0",
      GRAPH_JSON: JSON.stringify(graph),
    },
  });
  if (r.status !== 0) {
    console.error("FAIL: selector exited non-zero\n", r.stderr || r.stdout);
    process.exit(1);
  }
  return r.stdout.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

let failures = 0;
function check(name, got, wantAction, reasonMatch) {
  const d = got[0];
  const okAction = d && d.action === wantAction;
  const okReason = !reasonMatch || (d && reasonMatch.test(d.reason));
  if (okAction && okReason) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.error(`  FAIL ${name}: got action=${d && d.action} reason=${JSON.stringify(d && d.reason)}; ` +
      `want action=${wantAction}${reasonMatch ? ` reason~${reasonMatch}` : ""}`);
  }
}

console.log("merge-queue-arm-automerge selector");

// ── Fires ──────────────────────────────────────────────────────────────────
// The real #987 on 2026-10-06: approved by auto-approve, clean, unqueued. This
// is the shape the whole mechanism exists for.
check("approved + mergeable + unqueued -> arm", decide([pr()]), "arm");

// mergeable=UNKNOWN is GitHub being lazy, not a problem. Most PRs read UNKNOWN
// on a cold query (17 of 17 open grove-sites PRs did on 2026-10-06), so
// treating it as ineligible would make the sweep a no-op in practice.
check("mergeable UNKNOWN -> arm", decide([pr({ mergeable: "UNKNOWN" })]), "arm", /UNKNOWN/);

// ARM_UNAPPROVED=1 is the steady state: arm before the gates are green and let
// GitHub do the waiting. #921 proved the identity survives a 20-minute wait.
check("unapproved + ARM_UNAPPROVED=1 -> arm",
  decide([pr({ reviewDecision: "REVIEW_REQUIRED" })], { armUnapproved: true }), "arm");

// ── Stays quiet ────────────────────────────────────────────────────────────
check("unapproved by default -> skip",
  decide([pr({ reviewDecision: "REVIEW_REQUIRED" })]), "skip", /not approved/);

check("review decision null -> skip",
  decide([pr({ reviewDecision: null })]), "skip", /not approved/);

// A draft is an explicit "not yet" from its author, and GitHub rejects the
// mutation anyway. grove-sites #989 was draft ON PURPOSE on 2026-10-06.
check("draft -> skip", decide([pr({ isDraft: true })]), "skip", /draft/);

check("closed -> skip", decide([pr({ state: "CLOSED" })]), "skip", /not open/);

check("conflicting -> skip",
  decide([pr({ mergeable: "CONFLICTING" })]), "skip", /conflict/);

// Even with ARM_UNAPPROVED=1, a conflict and a draft still stop it: the
// pre-approval switch must not become a blanket override.
check("draft still skipped with ARM_UNAPPROVED=1",
  decide([pr({ isDraft: true })], { armUnapproved: true }), "skip", /draft/);
check("conflicting still skipped with ARM_UNAPPROVED=1",
  decide([pr({ mergeable: "CONFLICTING" })], { armUnapproved: true }), "skip", /conflict/);

// Idempotency: a second sweep must not re-arm what it armed.
check("already armed by the App -> skip",
  decide([pr({ autoMergeRequest: { enabledBy: { login: APP } } })]), "skip", /already armed/);

// Never take a merge decision away from whoever made it.
check("armed by a human -> skip",
  decide([pr({ autoMergeRequest: { enabledBy: { login: "EngineeringMoonBear" } } })]),
  "skip", /EngineeringMoonBear/);

// The maintainer rule. auto-approve.yml approves maintainer PRs but never
// enqueues them, so the human keeps control over when their own PR merges.
// A dry run on 2026-10-06 would have armed grove-sites #941
// (EngineeringMoonBear's, APPROVED, checks pending) before this rule existed --
// this assertion is that bug, pinned.
check("human-authored PR -> skip even when approved",
  decide([pr({ number: 941, author: { login: "EngineeringMoonBear" } })]),
  "skip", /EngineeringMoonBear.*decides when it merges/);

// ARM_UNAPPROVED is about gate timing, never about whose PR it is.
check("human-authored PR still skipped with ARM_UNAPPROVED=1",
  decide([pr({ author: { login: "EngineeringMoonBear" } })], { armUnapproved: true }),
  "skip", /decides when it merges/);

check("dependabot PR -> skip",
  decide([pr({ number: 967, author: { login: "dependabot[bot]" } })]),
  "skip", /dependabot/);

// A deleted account reads author:null. Must not be treated as the App.
check("null author -> skip", decide([pr({ author: null })]), "skip", /not agenticos-developer/);

// The #990 case: already queued, so the identity is already fixed. Arming is
// not the tool; merge-queue-rescue.sh is, and the reason must say so.
check("already queued -> skip, pointing at the rescue script",
  decide([pr({ number: 990 })], { queued: [990] }), "skip", /rescue/);

// ── Multi-PR shape: the sweep must decide per PR, not bail on the first skip ──
{
  const got = decide(
    [pr({ number: 1 }), pr({ number: 2, isDraft: true }), pr({ number: 3 })],
    {},
  );
  const summary = got.map((d) => `${d.number}:${d.action}`).join(",");
  if (summary === "1:arm,2:skip,3:arm") {
    console.log("  ok   mixed batch decides per PR");
  } else {
    failures++;
    console.error(`  FAIL mixed batch decides per PR: got ${summary}; want 1:arm,2:skip,3:arm`);
  }
}

if (failures) {
  console.error(`\n${failures} assertion(s) failed`);
  process.exit(1);
}
console.log("\nall assertions passed");
