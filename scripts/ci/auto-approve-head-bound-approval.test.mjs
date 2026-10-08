#!/usr/bin/env node
// Behavioral test for auto-approve.yml's duplicate-approval guard (GOL-3066).
//
// What it protects:
//   `main`'s ruleset sets `dismiss_stale_reviews_on_push: true`, so a head move
//   VOIDS the prior `github-actions[bot]` approval for branch protection. But
//   REST `/pulls/{n}/reviews` does not rewrite that row: it keeps reporting
//   `state: "APPROVED"` with its `commit_id` still on the OLD head (GitHub only
//   writes DISMISSED for an EXPLICIT dismissal). A guard that matches on `state`
//   alone therefore counts a voided review, logs "already approved" and skips
//   re-approving — and every later trigger takes the same branch, so NO run can
//   recover the PR. It sits at `REVIEW_REQUIRED` with every required check
//   green, ejected from the merge queue, with no red signal anywhere: nothing in
//   CI, the Actions tab or the PR says what is wrong. An empty commit does not
//   fix it either, because the stale row persists and the guard keeps matching.
//
//   Live twice: GOL-2134 on grove-odoo-modules (hand-patched) and GOL-3066 on
//   grove-sites PR #970, where the 23:27 run logged "already approved" and then
//   burned 30 merge attempts against OPEN:BLOCKED.
//
//   The invariant: the guard must mean what its comment says — "already
//   approved ON THIS HEAD". So it must be bound to the PR's current head SHA,
//   must still suppress genuine duplicate stacking, and must not be satisfied by
//   somebody else's approval.
//
//   The jq program is read out of the real workflow (no copy of it lives here)
//   and executed through the real `jq`, so a rewrite that drops the `commit_id`
//   comparison fails here rather than silently wedging the next agent PR.
//
// node builtins only — run by the `CI scripts` job (scripts/ci/*.test.mjs).

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const workflowFile = join(repoRoot, ".github", "workflows", "auto-approve.yml");
const workflow = readFileSync(workflowFile, "utf8");

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures++;
    console.log(`  FAIL ${name}\n       ${err && err.message}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// ── Extract the guard straight out of the workflow ─────────────────────────
// Shape (two lines, bash line-continuation):
//   ALREADY=$(gh api "repos/$REPO/pulls/$PR/reviews?per_page=100" \
//     -q "[.[] | select(...)] | length")
// Both `-q` quote styles are accepted on purpose: the PRE-FIX guard was
// single-quoted with no query string, so reverting the fix still MATCHES here
// and fails on the precise assertion below ("does not mention commit_id")
// rather than on a "could not find the guard" extractor miss.
const GUARD_RE =
  /ALREADY=\$\(gh api "repos\/\$REPO\/pulls\/\$PR\/reviews([^"]*)"\s*\\\s*\n\s*-q (?:"((?:[^"\\]|\\.)*)"|'([^']*)')\)/;
const guard = workflow.match(GUARD_RE);

if (!guard) {
  console.log(
    "FAIL could not find the duplicate-approval guard in .github/workflows/auto-approve.yml.\n" +
      "     Expected: ALREADY=$(gh api \"repos/$REPO/pulls/$PR/reviews...\" \\\\\\n       -q \"...\")\n" +
      "     If the guard moved or was reshaped, update this extractor — do not delete the test.",
  );
  process.exit(1);
}

const reviewsQuery = guard[1];
// Bash quoting semantics: inside double quotes `\"` -> `"`; a single-quoted
// argument is literal. Either way this is the jq program `gh` receives.
const jqProgramTemplate =
  guard[2] !== undefined ? guard[2].replace(/\\(.)/g, "$1") : guard[3];

const HEAD = "f877825f1ee4ba2a9e2c1df0f94de8db1b0b7a21";
const OLD = "7edb10240b4c9f0d9a2c4ba2bb4a20a0b1b0cafe";
const BOT = "github-actions[bot]";

// `$HEAD_SHA` is the only shell variable the program interpolates.
const jqProgram = jqProgramTemplate.split("$HEAD_SHA").join(HEAD);

function runGuard(reviews) {
  const res = spawnSync("jq", [jqProgram], {
    input: JSON.stringify(reviews),
    encoding: "utf8",
  });
  if (res.error && res.error.code === "ENOENT") {
    throw new Error(
      "`jq` not found on PATH. It is preinstalled on the GitHub-hosted runner " +
        "images this job uses; install jq to run this test locally.",
    );
  }
  if (res.status !== 0) {
    throw new Error(`jq exited ${res.status}: ${(res.stderr || "").trim()}`);
  }
  return Number(String(res.stdout).trim());
}

const review = (over) => ({
  id: 1,
  user: { login: BOT },
  state: "APPROVED",
  commit_id: HEAD,
  ...over,
});

console.log("auto-approve duplicate-approval guard (GOL-3066)");

// ── Structural guards: the shape of the read itself ────────────────────────
check("the reviews read is paginated to 100 (a busy PR can bury the current approval)", () => {
  assert(
    /(^|[?&])per_page=100($|&)/.test(reviewsQuery.replace(/^\?/, "?")),
    `reviews query is ${JSON.stringify(reviewsQuery)}, expected it to carry per_page=100`,
  );
});

check("the guard compares commit_id (NOT state alone — this is the whole fix)", () => {
  assert(
    jqProgram.includes("commit_id"),
    "the jq program does not mention `commit_id`, so it matches a stale approval " +
      "that branch protection has already voided — the GOL-3066 wedge",
  );
});

check("HEAD_SHA is default-expanded before the guard uses it (`set -u` safety)", () => {
  // The step runs under `set -euo pipefail`, and on the maintainer /
  // non-protected path nothing upstream assigns HEAD_SHA, so a bare `$HEAD_SHA`
  // would abort the step.
  const defaultExpansion = workflow.indexOf('HEAD_SHA="${HEAD_SHA:-');
  assert(defaultExpansion !== -1, 'no `HEAD_SHA="${HEAD_SHA:-...}"` default expansion found');
  const guardAt = workflow.indexOf(guard[0]);
  assert(
    defaultExpansion < guardAt,
    "the HEAD_SHA default expansion must come BEFORE the guard that interpolates it",
  );
});

// ── Behavior: run the real jq program over real review-list shapes ─────────
check("no reviews at all -> 0 (approve)", () => {
  assertEqual(runGuard([]), 0, "empty review list");
});

check("STALE bot approval on the OLD head -> 0 (RE-APPROVE: the GOL-3066 wedge)", () => {
  assertEqual(runGuard([review({ commit_id: OLD })]), 0, "stale-only review list");
});

check("bot approval ON the current head -> 1 (no duplicate stacking)", () => {
  assertEqual(runGuard([review()]), 1, "head-bound review list");
});

check("stale + head-bound -> 1 (the fresh one still suppresses)", () => {
  assertEqual(
    runGuard([review({ id: 1, commit_id: OLD }), review({ id: 2 })]),
    1,
    "mixed review list",
  );
});

check("somebody ELSE's approval on the head -> 0 (the bot's own review is required)", () => {
  assertEqual(
    runGuard([review({ user: { login: "EngineeringMoonBear" } })]),
    0,
    "human approval on the head",
  );
});

check("bot COMMENTED / CHANGES_REQUESTED on the head -> 0 (only APPROVED counts)", () => {
  assertEqual(runGuard([review({ state: "COMMENTED" })]), 0, "bot comment review");
  assertEqual(
    runGuard([review({ state: "CHANGES_REQUESTED" })]),
    0,
    "bot changes-requested review",
  );
});

check("bot approval explicitly DISMISSED on the head -> 0", () => {
  assertEqual(runGuard([review({ state: "DISMISSED" })]), 0, "dismissed review");
});

if (failures > 0) {
  console.log(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
