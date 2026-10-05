#!/usr/bin/env node
// Behavioral test for the `missing-checks` sweep's control-plane-drop
// classifier and its bounded self-heal, in
// .github/actions/ci-failure-router/action.yml (GOL-3031).
//
// What it protects:
//   The 2026-10-05 GitHub Actions incident did not FAIL our jobs — it never
//   gave them a runner. They sat `queued`, then GitHub's control plane marked
//   them `completed / cancelled` with `runner_name = ""`. Two of
//   grove-odoo-modules #310's five REQUIRED contexts landed there, the PR sat
//   `mergeable_state=blocked` for an afternoon, and the suite was never red
//   (`693 passed` running ci.yml's literal command at that SHA).
//
//   The old sweep was blind to it: it flagged a required context that is
//   ABSENT from the head SHA, and a terminally-`cancelled` check-run is very
//   much present. So the detector built for exactly this failure mode saw the
//   context, moved on, and minted nothing.
//
//   `cancelled` on its own is ambiguous — humans and `cancel-in-progress`
//   cancel jobs legitimately all day. The signal that makes it unambiguous is
//   `cancelled`/`stale` WITH AN EMPTY `runner_name`: the job never reached a
//   machine, so no test ran and no human could have stopped something that had
//   not started. This test pins all four arms of that classifier, plus the two
//   invariants that keep the self-heal from doing damage:
//
//     - an IN-FLIGHT run is never re-fired. Check-runs are cumulative per
//       commit, so a stale `cancelled` check stays the newest one for its name
//       until the new attempt reaches that job. With a fan-in job that only
//       starts after the lint jobs pass, a check-run-keyed detector sees
//       nothing pending mid-flight and re-fires — killing the very run it was
//       waiting for. (This is the bug v4 of GOL-2988's watcher had; v5 keys
//       every decision on the latest workflow RUN instead.)
//     - the re-fire is BOUNDED and escalates on exhaustion rather than looping.
//
//   Runs the real script out of the real action file (no copy of the logic
//   lives here) against stub `github`/`core`/`context`, so a refactor that
//   moves the classification shows up here and not in an outage.
//
// node builtins only — run by the `CI scripts` job (scripts/ci/*.test.mjs).

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const actionFile = join(
  repoRoot,
  ".github",
  "actions",
  "ci-failure-router",
  "action.yml",
);

// ── Extract the script straight out of the action (same contract as the other
// ci-failure-router tests: a 10-space-indented `script: |` block scalar running
// to EOF). Text extraction keeps this on node builtins and makes a re-indent
// fail loudly here. ────────────────────────────────────────────────────────
const SCRIPT_INDENT = 10;
const lines = readFileSync(actionFile, "utf8").split("\n");
const start = lines.findIndex((l) => l.trim() === "script: |");
if (start === -1) throw new Error("could not find `script: |` in action.yml");
const body = lines
  .slice(start + 1)
  .map((l) => {
    if (l.trim() === "") return "";
    if (!l.startsWith(" ".repeat(SCRIPT_INDENT))) {
      throw new Error(`script line is under-indented (expected ${SCRIPT_INDENT}): ${l}`);
    }
    return l.slice(SCRIPT_INDENT);
  })
  .join("\n");

const makeRunner = () =>
  new Function(
    "github",
    "context",
    "core",
    `return (async () => {\n${body}\n})();`,
  );

// ── Fixtures: grove-odoo-modules #310, the PR this came from ───────────────
const PR = 310;
const SHA = "a3571a838a56fd1725e3c7d37ca602f240156260";
const UNIT = "Pure-Python unit tests";
const ODOO = "Install + test module against Odoo 19";
const LINT = "Lint Python";
const REQUIRED = [LINT, UNIT, ODOO];
// Head must be older than the 20m grace window or the sweep skips it.
const HEAD_PUSHED = new Date(Date.now() - 200 * 60_000).toISOString();

const requiredChecksJson = Buffer.from(
  JSON.stringify({ branch: "main", required_contexts: REQUIRED }),
).toString("base64");

const BOT_USER = { login: "goldberry-agent[bot]", type: "Bot" };
const HUMAN_USER = { login: "EngineeringMoonBear", type: "User" };

/** A control-plane drop: terminal, and no machine ever took it. */
const droppedJob = (name) => ({ name, conclusion: "cancelled", runner_name: "" });
/** A cancellation of work that was genuinely running on a machine. */
const cancelledOnRunner = (name) => ({ name, conclusion: "cancelled", runner_name: "GitHub Actions 42" });
const failedJob = (name) => ({ name, conclusion: "failure", runner_name: "GitHub Actions 7" });
const okJob = (name) => ({ name, conclusion: "success", runner_name: "GitHub Actions 7" });

const run = (id, { status = "completed", conclusion = "failure", name = "CI", created_at = HEAD_PUSHED } = {}) => ({
  id, status, conclusion, name,
  workflow_id: 1,
  created_at,
  run_started_at: created_at,
  html_url: `https://github.com/o/r/actions/runs/${id}`,
});

/**
 * @param runs        workflow runs on the head SHA
 * @param jobsByRun   { [runId]: job[] }
 * @param checkRuns   check-run names present on the head SHA
 * @param openIssue   an already-open ci-failure issue body, or null
 * @param user        PR author
 * @param closeThrows status code the close/reopen should throw, or null
 * @param env         extra env overrides (self-heal / budget / gap)
 */
async function runSweep({
  runs = [],
  jobsByRun = {},
  checkRuns = REQUIRED,
  openIssue = null,
  user = BOT_USER,
  closeThrows = null,
  env = {},
} = {}) {
  const calls = {
    created: [], comments: [], updated: [], prUpdates: [],
    notices: [], warnings: [], infos: [], jobReads: [],
  };
  const github = {
    paginate: async (fn, args) => fn(args),
    request: async (route) => {
      if (route.includes("/rules/branches/")) {
        return {
          data: [{
            type: "required_status_checks",
            parameters: { required_status_checks: REQUIRED.map((context) => ({ context })) },
          }],
        };
      }
      throw new Error(`unstubbed request: ${route}`);
    },
    rest: {
      repos: {
        getContent: async () => ({ data: { content: requiredChecksJson } }),
        listCommitStatusesForRef: async () => [], // paginated → bare array
        getCommit: async () => ({ data: { commit: { committer: { date: HEAD_PUSHED } } } }),
      },
      pulls: {
        list: async () => [{ // paginated → bare array
          number: PR,
          draft: false,
          user,
          auto_merge: null,
          title: "feat(grove_headless): expose ships_all_green_states",
          html_url: `https://github.com/o/r/pull/${PR}`,
          head: { sha: SHA },
        }],
        update: async (a) => {
          calls.prUpdates.push(a);
          if (closeThrows) {
            const e = new Error("Resource not accessible by integration");
            e.status = closeThrows;
            throw e;
          }
        },
      },
      checks: {
        listForRef: async () => ({
          data: { check_runs: checkRuns.map((name) => ({ name })) },
        }),
      },
      actions: {
        listWorkflowRunsForRepo: async () => ({ data: { workflow_runs: runs } }),
        listJobsForWorkflowRun: async ({ run_id }) => {
          calls.jobReads.push(run_id);
          return { data: { jobs: jobsByRun[run_id] || [] } };
        },
      },
      issues: {
        listForRepo: async () => (openIssue ? [openIssue] : []), // paginated
        listEventsForTimeline: async () => [],
        create: async (a) => { calls.created.push(a); return { data: { number: 999 } }; },
        createComment: async (a) => calls.comments.push(a),
        update: async (a) => calls.updated.push(a),
        createLabel: async () => {},
      },
    },
  };
  const core = {
    info: (m) => calls.infos.push(m),
    notice: (m) => calls.notices.push(m),
    warning: (m) => calls.warnings.push(m),
    setFailed: (m) => { throw new Error(`setFailed: ${m}`); },
  };
  const context = { repo: { owner: "Goldberry-Playground", repo: "grove-odoo-modules" } };

  const vars = {
    MODE: "missing-checks",
    GRACE_MINUTES: "20",
    SELF_HEAL: "true",
    REFIRE_BUDGET: "3",
    REFIRE_GAP_MINUTES: "30",
    ...env,
  };
  const prev = {};
  for (const [k, v] of Object.entries(vars)) { prev[k] = process.env[k]; process.env[k] = v; }
  try {
    await makeRunner()(github, context, core);
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  }
  return calls;
}

/** An already-open ci-failure issue carrying a re-fire ledger. */
const issueWithLedger = ({ sha = SHA, refires = 0, lastRefireAt = null, escalated = false, number = 777 } = {}) => ({
  number,
  body: [
    `<!-- d3-missing-checks:PR${PR} -->`,
    `<!-- d3-missing-checks-data:${JSON.stringify({ sha, refires, lastRefireAt, escalated })} -->`,
    "previously reported",
  ].join("\n"),
});

// ── Assertions ─────────────────────────────────────────────────────────────
let failures = 0;
const check = (name, fn) => {
  try { fn(); console.log(`  ok  ${name}`); }
  catch (e) { failures += 1; console.error(`FAIL  ${name}\n      ${e.message}`); }
};
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const noIssue = (calls) =>
  assert(calls.created.length === 0, `expected no minted issue, got ${calls.created.length}: ${calls.created[0]?.title}`);
const onlyIssue = (calls) => {
  assert(calls.created.length === 1, `expected 1 minted issue, got ${calls.created.length}`);
  return calls.created[0];
};
const noPrMutation = (calls) =>
  assert(calls.prUpdates.length === 0, `expected no PR state change, got ${JSON.stringify(calls.prUpdates)}`);

console.log("missing-checks control-plane-drop classifier + self-heal (GOL-3031)");

// ── Case 1: `cancelled` + no runner → DROP ────────────────────────────────
{
  const calls = await runSweep({
    runs: [run(37366000001)],
    jobsByRun: { 37366000001: [okJob(LINT), droppedJob(UNIT), droppedJob(ODOO)] },
  });
  const issue = onlyIssue(calls);
  check("cancelled + no runner → detected (the old sweep minted nothing here)", () => {
    assert(
      issue.title.startsWith(`Control-plane drop (no runner) on PR #${PR}:`),
      `title was: ${issue.title}`,
    );
    assert(issue.body.includes(UNIT), "does not name the dropped unit-test context");
    assert(issue.body.includes(ODOO), "does not name the dropped Odoo context");
  });
  check("cancelled + no runner → classified as a control-plane drop, NOT a test failure", () => {
    assert(issue.body.includes("empty `runner_name`"), "does not cite the empty runner_name signal");
    assert(issue.body.includes("no test ever ran"), "does not say no test ran");
    assert(issue.body.includes("Do not triage this as a code defect"), "does not warn triage off a code defect");
    assert(!issue.body.includes("That is a dropped trigger"), "fell through to the dropped-trigger wording");
  });
  check("cancelled + no runner → self-heals by close+reopen on the unchanged SHA", () => {
    assert(
      calls.prUpdates.length === 2,
      `expected close+reopen (2 calls), got ${calls.prUpdates.length}`,
    );
    assert(calls.prUpdates[0].state === "closed", "first call is not a close");
    assert(calls.prUpdates[1].state === "open", "second call is not a reopen");
    assert(
      calls.prUpdates.every((c) => c.pull_number === PR),
      "mutated the wrong PR",
    );
    assert(
      !JSON.stringify(calls.prUpdates).includes("delete"),
      "something delete-shaped reached the PR update (GOL-1658: never --delete-branch here)",
    );
  });
  check("cancelled + no runner → records attempt 1/3 in the body ledger", () => {
    const m = issue.body.match(/<!-- d3-missing-checks-data:(\{.*?\}) -->/);
    assert(m, "no data marker in the minted body");
    const d = JSON.parse(m[1]);
    assert(d.sha === SHA, `ledger sha was ${d.sha}`);
    assert(d.refires === 1, `ledger refires was ${d.refires}, expected 1`);
    assert(typeof d.lastRefireAt === "string", "ledger did not stamp lastRefireAt");
  });
}

// ── Case 2: `cancelled` + a runner WAS assigned → NOT a drop ──────────────
{
  const calls = await runSweep({
    runs: [run(37366000002)],
    jobsByRun: { 37366000002: [okJob(LINT), cancelledOnRunner(UNIT), okJob(ODOO)] },
  });
  check("cancelled WITH a runner → not a drop (someone stopped real work)", () => {
    noIssue(calls);
    noPrMutation(calls);
  });
}

// ── Case 3: a real `failure` → never self-healed ──────────────────────────
{
  // One context dropped (so the sweep does flag the PR) while another job
  // failed on a runner. A re-fire here would only hide the red.
  const calls = await runSweep({
    runs: [run(37366000003)],
    jobsByRun: { 37366000003: [failedJob(LINT), droppedJob(UNIT), okJob(ODOO)] },
  });
  const issue = onlyIssue(calls);
  check("failure with a runner → re-fire withheld, red named", () => {
    noPrMutation(calls);
    assert(issue.body.includes("Self-heal held off"), "did not say the self-heal was held off");
    assert(issue.body.includes(LINT), `does not name the really-failing job: ${issue.body.slice(0, 400)}`);
  });
}

// ── Case 3b: a red ADVISORY job must not disable the self-heal ────────────
{
  // grove-sites' `claude-review` fails repo-wide and is deliberately
  // non-blocking (GOL-1254). It runs on every head, so a blanket
  // "any real failure wins" guard would switch the self-heal off forever in
  // that repo. Only a red REQUIRED context can make a re-fire wrong.
  const calls = await runSweep({
    runs: [run(37366000031)],
    jobsByRun: {
      37366000031: [okJob(LINT), droppedJob(UNIT), droppedJob(ODOO), failedJob("claude-review")],
    },
  });
  const issue = onlyIssue(calls);
  check("non-required job red → still re-fires, and says the red does not gate", () => {
    assert(calls.prUpdates.length === 2, `expected close+reopen, got ${calls.prUpdates.length}`);
    assert(issue.body.includes("claude-review"), "did not disclose the advisory red");
    assert(issue.body.includes("not required"), "did not say the advisory red does not gate");
  });
}

// ── Case 4: superseded-run cancellation → ignored ─────────────────────────
{
  // `concurrency: cancel-in-progress: true` leaves an older cancelled run on
  // the SHA. Only the NEWEST run per workflow is ever read, so it is invisible.
  const older = run(37366000004, {
    conclusion: "cancelled",
    created_at: new Date(Date.now() - 210 * 60_000).toISOString(),
  });
  const newer = run(37366000005, {
    conclusion: "success",
    created_at: new Date(Date.now() - 100 * 60_000).toISOString(),
  });
  const calls = await runSweep({
    runs: [older, newer],
    jobsByRun: {
      37366000004: [droppedJob(UNIT), droppedJob(ODOO)],
      37366000005: [okJob(LINT), okJob(UNIT), okJob(ODOO)],
    },
  });
  check("superseded cancelled run → ignored, newest run wins", () => {
    noIssue(calls);
    noPrMutation(calls);
    assert(
      !calls.jobReads.includes(37366000004),
      "read jobs of the superseded run — it should never be consulted",
    );
  });
}

// ── Case 5: an IN-FLIGHT run is never re-fired ───────────────────────────
{
  // The v4 bug. The stale `cancelled` check-run for the fan-in job is still
  // the newest check-run for its name (check-runs are cumulative per commit),
  // but the retry run has not completed. Re-firing here kills it.
  const calls = await runSweep({
    runs: [run(37367110446, { status: "in_progress", conclusion: null })],
    jobsByRun: { 37367110446: [okJob(LINT), droppedJob(UNIT), droppedJob(ODOO)] },
  });
  check("run still in flight → nothing classified, nothing re-fired", () => {
    noIssue(calls);
    noPrMutation(calls);
    assert(
      calls.jobReads.length === 0,
      "classified jobs of an in-flight run — the mid-flight guard is gone",
    );
  });
}

// ── Case 6: bounded — budget exhausted escalates instead of looping ───────
{
  const spent = { refires: 3, lastRefireAt: new Date(Date.now() - 120 * 60_000).toISOString() };
  const calls = await runSweep({
    runs: [run(37366000006)],
    jobsByRun: { 37366000006: [okJob(LINT), droppedJob(UNIT), droppedJob(ODOO)] },
    openIssue: issueWithLedger(spent),
  });
  check("budget exhausted → no re-fire, escalates to a human", () => {
    noPrMutation(calls);
    noIssue(calls); // reuses the open issue, never mints a second
    const said = calls.comments.map((c) => c.body).join("\n");
    assert(said.includes("budget exhausted"), "did not say the budget is exhausted");
    assert(said.includes("3/3"), `did not quote the spend: ${said.slice(0, 300)}`);
    assert(said.includes("Escalate"), "did not escalate to a human");
    assert(
      calls.warnings.some((w) => w.includes("budget exhausted")),
      "did not warn in the job log",
    );
  });
  check("budget exhausted → latches `escalated` so it cannot spend more", () => {
    assert(calls.updated.length === 1, `expected the ledger to be rewritten once, got ${calls.updated.length}`);
    const d = JSON.parse(calls.updated[0].body.match(/<!-- d3-missing-checks-data:(\{.*?\}) -->/)[1]);
    assert(d.escalated === true, "did not latch escalated");
    assert(d.refires === 3, `budget moved to ${d.refires} without a re-fire`);
  });

  // The sweep runs every 20 minutes. Re-escalating on each pass is the same
  // notification spam the dedup marker exists to prevent, so the SECOND tick
  // on an already-escalated head must be completely silent.
  const again = await runSweep({
    runs: [run(37366000006)],
    jobsByRun: { 37366000006: [okJob(LINT), droppedJob(UNIT), droppedJob(ODOO)] },
    openIssue: issueWithLedger({ ...spent, escalated: true }),
  });
  check("already escalated → silent on every later tick (no 20-minute spam)", () => {
    noPrMutation(again);
    noIssue(again);
    assert(again.comments.length === 0, `re-escalated: ${again.comments.map((c) => c.body.slice(0, 80))}`);
    assert(again.updated.length === 0, "rewrote the body with nothing to change");
  });
}

// ── Case 7: bounded — minimum gap between attempts ───────────────────────
{
  const calls = await runSweep({
    runs: [run(37366000007)],
    jobsByRun: { 37366000007: [okJob(LINT), droppedJob(UNIT), droppedJob(ODOO)] },
    openIssue: issueWithLedger({ refires: 1, lastRefireAt: new Date(Date.now() - 5 * 60_000).toISOString() }),
  });
  check("inside the minimum gap → held off quietly, budget not spent", () => {
    noPrMutation(calls);
    noIssue(calls);
    // Quiet: a routine "too soon" is a log line, not a comment on every tick.
    assert(calls.comments.length === 0, `commented on a routine hold-off: ${calls.comments.map((c) => c.body.slice(0, 80))}`);
    assert(calls.updated.length === 0, "spent or rewrote the ledger while merely waiting out the gap");
    assert(
      calls.infos.some((i) => i.includes("held off (gap)") && i.includes("minimum gap")),
      `did not log the gap reason: ${calls.infos.slice(-3).join(" | ")}`,
    );
  });
}

// ── Case 8: a human's PR is never closed for them ────────────────────────
{
  const calls = await runSweep({
    runs: [run(37366000008)],
    jobsByRun: { 37366000008: [okJob(LINT), droppedJob(UNIT), droppedJob(ODOO)] },
    user: HUMAN_USER,
  });
  const issue = onlyIssue(calls);
  check("human-authored PR → detected and reported, never auto-closed", () => {
    noPrMutation(calls);
    assert(issue.body.includes("Self-heal held off"), "did not say it held off");
    assert(issue.body.includes(HUMAN_USER.login), "did not name the human author");
    assert(issue.body.includes(`gh pr close ${PR}`), "lost the manual remedy for the human");
  });
}

// ── Case 9: self-heal disabled by the caller ─────────────────────────────
{
  const calls = await runSweep({
    runs: [run(37366000009)],
    jobsByRun: { 37366000009: [okJob(LINT), droppedJob(UNIT), droppedJob(ODOO)] },
    env: { SELF_HEAL: "false" },
  });
  const issue = onlyIssue(calls);
  check("self-heal: false → still detects + reports, never mutates the PR", () => {
    noPrMutation(calls);
    assert(issue.title.startsWith("Control-plane drop (no runner) on"), `title was: ${issue.title}`);
    assert(issue.body.includes("Self-heal held off"), "did not say it held off");
  });
}

// ── Case 10: read-only `pull-requests` permission degrades loudly ────────
{
  const calls = await runSweep({
    runs: [run(37366000010)],
    jobsByRun: { 37366000010: [okJob(LINT), droppedJob(UNIT), droppedJob(ODOO)] },
    closeThrows: 403,
  });
  onlyIssue(calls);
  check("403 on close → sweep survives and names the missing permission", () => {
    const said = calls.comments.map((c) => c.body).join("\n");
    assert(said.includes("pull-requests: write"), `did not name the permission: ${said.slice(0, 300)}`);
    assert(said.includes("FAILED"), "did not report the failure on the issue");
    assert(
      calls.warnings.some((w) => w.includes("pull-requests: write")),
      "did not warn in the job log",
    );
  });
}

// ── Case 11: absent contexts still work (GOL-1958 regression) ────────────
{
  const calls = await runSweep({ runs: [], checkRuns: [LINT] });
  const issue = onlyIssue(calls);
  check("no check-run at all → still the original dropped-trigger diagnosis", () => {
    noPrMutation(calls); // alert-only: an absence is not provably runner-less
    assert(issue.title.startsWith(`Missing required check on PR #${PR}:`), `title was: ${issue.title}`);
    assert(issue.body.includes("That is a dropped trigger"), "lost the GOL-1958 wording");
  });
}

console.log(failures === 0 ? "\nall ok" : `\n${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
