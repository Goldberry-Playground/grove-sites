#!/usr/bin/env node
// Behavioral test for lock-queued detection in
// .github/actions/ci-failure-router/action.yml, `missing-checks` mode (GOL-2838).
//
// What it protects:
//   A required context can be absent from a head SHA for three different
//   reasons that look IDENTICAL through check-runs + commit statuses:
//     (a) dropped trigger  — GitHub never created the run.
//     (b) approval gate    — the run is parked at `action_required` (GOL-2732).
//     (c) lock-queued      — the producing job EXISTS but is queued behind a
//                            held `concurrency` group, so it never gets a
//                            runner and an `if: always()` aggregate gate that
//                            `needs:` it never starts either (GOL-2838).
//
//   (a) and (b) share the close/reopen remedy. (c) does NOT: closing and
//   reopening cancels the queued run and files a fresh one that queues behind
//   the very same holder, so the only effect is churn. odoocker PR #808 sat
//   70m with `prod-plan-guard` absent while a `Promote storefronts to
//   production` run sat `waiting` on the `production` Environment approval —
//   a run does not have to be *executing* to hold its concurrency group. The
//   sweep filed the (a) wording and told a human to close/reopen, which would
//   not have helped.
//
//   So this test asserts all three directions: the remedy for (c) must be
//   "do NOT close and reopen" and must name the holder, while (a) and (b)
//   must keep offering close/reopen exactly as before.
//
//   It runs the real script out of the real action file (no copy of the logic
//   lives here) against stub `github`/`core`/`context` objects.
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

// ── Extract the script straight out of the action ──────────────────────────
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

// ── Fixtures ───────────────────────────────────────────────────────────────
const OWNER = "Goldberry-Playground";
const REPO = "odoocker-goldberrygrove";
const SHA = "d3523caf3f02b28f3e500c3a74547e1d0cbbe35c";
const REQUIRED = "prod-plan-guard";

// The head SHA must be older than the grace window or nothing is ever flagged.
const HEAD_DATE = new Date(Date.now() - 70 * 60_000).toISOString();

/** The guard run on our head: `detect` ran, the plan job never got a runner. */
const guardRun = (over = {}) => ({
  id: 36772646933,
  name: "Production Plan Guard",
  status: "pending",
  conclusion: null,
  head_sha: SHA,
  created_at: "2026-09-30T20:26:32Z",
  html_url: `https://github.com/${OWNER}/${REPO}/actions/runs/36772646933`,
  actor: { login: "EngineeringMoonBear" },
  triggering_actor: { login: "EngineeringMoonBear" },
  ...over,
});

const guardJobs = [
  {
    name: "detect prod TF changes",
    status: "completed",
    conclusion: "success",
    runner_name: "GitHub Actions 1000072440",
    steps: [{ name: "Set up job" }],
  },
  {
    // The tell: created, but never dispatched.
    name: "Prod plan must not destroy or replace a live resource",
    status: "pending",
    conclusion: null,
    runner_name: null,
    steps: [],
  },
];

/** A promote run parked on the `production` Environment — holds the group. */
const parkedHolder = {
  id: 36769784238,
  name: "Promote storefronts to production",
  status: "waiting",
  conclusion: null,
  head_sha: "a1f06a2a9a5ab1770045dff325ad4fb9d89484b7",
  created_at: "2026-09-30T20:02:06Z",
  html_url: `https://github.com/${OWNER}/${REPO}/actions/runs/36769784238`,
  actor: { login: "EngineeringMoonBear" },
  triggering_actor: { login: "EngineeringMoonBear" },
};

const PENDING_DEPLOYMENTS = {
  36769784238: [
    {
      environment: { name: "production" },
      reviewers: [{ type: "User", reviewer: { login: "EngineeringMoonBear" } }],
    },
  ],
};

/**
 * Drive `missing-checks` mode.
 * @param headRuns      workflow runs on the PR head SHA
 * @param runsByStatus  repo-wide live runs, keyed by the `status` filter
 * @param jobsByRun     job lists keyed by run id
 * @param pendingDeploymentsOk  false → simulate the 403 when `actions: read`
 *                              is not granted, proving graceful degradation
 */
const runSweep = async ({
  headRuns,
  runsByStatus = {},
  jobsByRun = {},
  pendingDeploymentsOk = true,
} = {}) => {
  const calls = { created: [], comments: [], updated: [] };
  const core = {
    info() {},
    warning() {},
    setFailed(m) { throw new Error(`setFailed: ${m}`); },
    getInput: () => "",
    summary: { addRaw() { return this; }, async write() {} },
  };
  const github = {
    paginate: async (fn, args) => {
      const r = await fn(args);
      return Array.isArray(r) ? r : r.data;
    },
    request: async (route) => {
      if (route.includes("/rules/branches/")) {
        return {
          data: [
            {
              type: "required_status_checks",
              parameters: { required_status_checks: [{ context: REQUIRED }] },
            },
          ],
        };
      }
      throw Object.assign(new Error(`unmocked ${route}`), { status: 404 });
    },
    rest: {
      repos: {
        getContent: async () => ({
          data: {
            content: Buffer.from(
              JSON.stringify({ branch: "main", required_contexts: [REQUIRED] }),
            ).toString("base64"),
          },
        }),
        getCommit: async () => ({
          data: { commit: { committer: { date: HEAD_DATE } } },
        }),
        listCommitStatusesForRef: async () => [],
      },
      pulls: {
        list: async () => [
          {
            number: 808,
            draft: false,
            title: "fix(prod): wire the guides publish webhook for nursery (hotfix)",
            html_url: `https://github.com/${OWNER}/${REPO}/pull/808`,
            head: { sha: SHA, ref: "hotfix/prod-publish-webhook-nursery" },
            base: { ref: "main" },
            user: { login: "EngineeringMoonBear" },
          },
        ],
      },
      // The required context is absent; an unrelated check-run is present so
      // the "absent" path is exercised rather than an empty-response path.
      checks: {
        listForRef: async () => ({
          data: {
            check_runs: [
              { name: "detect prod TF changes", status: "completed", conclusion: "success" },
            ],
          },
        }),
      },
      actions: {
        listWorkflowRunsForRepo: async (a) =>
          a.head_sha
            ? { data: { workflow_runs: headRuns } }
            : { data: { workflow_runs: runsByStatus[a.status] || [] } },
        listJobsForWorkflowRun: async (a) => ({
          data: { jobs: jobsByRun[a.run_id] || [] },
        }),
        getPendingDeploymentsForRun: async (a) => {
          if (!pendingDeploymentsOk) {
            throw Object.assign(new Error("Resource not accessible by integration"), { status: 403 });
          }
          return { data: PENDING_DEPLOYMENTS[a.run_id] || [] };
        },
      },
      issues: {
        listForRepo: async () => [],
        create: async (a) => { calls.created.push(a); return { data: { number: 9999 } }; },
        createComment: async (a) => { calls.comments.push(a); return { data: {} }; },
        update: async (a) => { calls.updated.push(a); return { data: {} }; },
        listLabelsForRepo: async () => [],
        getLabel: async () => ({ data: {} }),
        createLabel: async () => ({ data: {} }),
        addLabels: async () => ({ data: {} }),
      },
    },
  };
  const context = {
    repo: { owner: OWNER, repo: REPO },
    eventName: "schedule",
    payload: {},
  };
  Object.assign(process.env, {
    MODE: "missing-checks",
    GRACE_MINUTES: "20",
    RUN_ID: "",
    WF_NAME: "",
    HEAD_BRANCH: "",
    HEAD_SHA: "",
    RUN_URL: "",
    RUN_EVENT: "",
    RUN_ATTEMPT: "",
    RUN_STARTED_AT: "",
    GONE_BRANCH: "",
    TRIGGER: "",
    PR_MERGED: "",
  });
  await makeRunner()(github, context, core);
  return calls;
};

let failures = 0;
const check = (label, ok, detail = "") => {
  if (ok) { console.log(`ok   ${label}`); return; }
  failures += 1;
  console.log(`FAIL ${label}${detail ? ` — ${detail}` : ""}`);
};

// 1. Lock-queued: the producing job exists with no runner and a parked run can
//    hold the group → the remedy must be "do NOT close and reopen".
{
  const calls = await runSweep({
    headRuns: [guardRun()],
    jobsByRun: { 36772646933: guardJobs },
    runsByStatus: { waiting: [parkedHolder] },
  });
  check("lock-queued → mints one issue", calls.created.length === 1,
    `created ${calls.created.length}`);
  const body0 = calls.created[0]?.body ?? "";
  check("lock-queued → title says Lock-queued",
    (calls.created[0]?.title ?? "").startsWith("Lock-queued required check on PR #808"),
    calls.created[0]?.title);
  check("lock-queued → refuses close/reopen",
    body0.includes("do NOT close and reopen"));
  check("lock-queued → does NOT hand out a `gh pr close` command",
    !body0.includes("gh pr close"));
  check("lock-queued → names the queued job",
    body0.includes("Prod plan must not destroy or replace a live resource"));
  check("lock-queued → names the holding run and how to clear it",
    body0.includes("/actions/runs/36769784238") &&
      body0.includes("gh run cancel 36769784238"));
  check("lock-queued → names the Environment and its approver",
    body0.includes("`production`") && body0.includes("EngineeringMoonBear"));
  check("lock-queued → does not misreport a dropped trigger",
    !body0.includes("That is a dropped trigger"));
}

// 2. Same queued job, but nothing else is live repo-wide → no holder exists, so
//    this is the GOL-2310 scheduler drop. Still not a close/reopen, but the
//    wording must not invent a holder.
{
  const calls = await runSweep({
    headRuns: [guardRun()],
    jobsByRun: { 36772646933: guardJobs },
    runsByStatus: {},
  });
  const body0 = calls.created[0]?.body ?? "";
  check("no holder → says nothing appears to hold the group",
    body0.includes("nothing appears to hold a `concurrency` group"));
  check("no holder → points at the scheduler-drop escalation (GOL-2310)",
    body0.includes("GOL-2310"));
  check("no holder → still refuses close/reopen", body0.includes("do NOT close and reopen"));
}

// 3. `actions: read` not granted → pending_deployments 403s. The holder link
//    must survive; only the Environment/approver detail is lost.
{
  const calls = await runSweep({
    headRuns: [guardRun()],
    jobsByRun: { 36772646933: guardJobs },
    runsByStatus: { waiting: [parkedHolder] },
    pendingDeploymentsOk: false,
  });
  const body0 = calls.created[0]?.body ?? "";
  check("pending_deployments 403 → still mints and still names the holder",
    calls.created.length === 1 && body0.includes("/actions/runs/36769784238"));
  check("pending_deployments 403 → degrades without claiming an Environment",
    !body0.includes("parked on environment"));
}

// 4. Regression (a): no runs at all on the head → dropped trigger, and
//    close/reopen must still be the offered remedy.
{
  const calls = await runSweep({ headRuns: [] });
  const body0 = calls.created[0]?.body ?? "";
  check("dropped trigger → title unchanged",
    (calls.created[0]?.title ?? "").startsWith("Missing required check on PR #808"),
    calls.created[0]?.title);
  check("dropped trigger → still offers close/reopen",
    body0.includes("gh pr close 808") && body0.includes("gh pr reopen 808"));
  check("dropped trigger → keeps the dropped-trigger wording",
    body0.includes("That is a dropped trigger"));
  check("dropped trigger → not reported as lock-queued",
    !body0.includes("do NOT close and reopen"));
}

// 5. Regression (b): a run parked at `action_required` → approval gate, which
//    also still takes close/reopen. A completed run owns no queued job, so the
//    lock-queued branch must not steal this case.
{
  const calls = await runSweep({
    headRuns: [
      guardRun({
        status: "completed",
        conclusion: "action_required",
        triggering_actor: { login: "github-actions[bot]" },
      }),
    ],
  });
  const body0 = calls.created[0]?.body ?? "";
  check("approval gate → title unchanged",
    (calls.created[0]?.title ?? "").startsWith("Approval-gated required check on PR #808"),
    calls.created[0]?.title);
  check("approval gate → still offers close/reopen",
    body0.includes("gh pr close 808") && body0.includes("gh pr reopen 808"));
  check("approval gate → names the ambient GITHUB_TOKEN identity",
    body0.includes("github-actions[bot]"));
  check("approval gate → not reported as lock-queued",
    !body0.includes("do NOT close and reopen"));
}

// 6. Precedence: an `action_required` park AND a queued job on the same head.
//    The gate is upstream of the queue, so the gate must win.
{
  const calls = await runSweep({
    headRuns: [
      guardRun({ status: "completed", conclusion: "action_required" }),
      guardRun({ id: 1, status: "queued" }),
    ],
    jobsByRun: { 1: guardJobs },
    runsByStatus: { waiting: [parkedHolder] },
  });
  const body0 = calls.created[0]?.body ?? "";
  check("gate + queued job → reports the approval gate, not the queue",
    body0.includes("approval gate, not a dropped trigger") &&
      !body0.includes("do NOT close and reopen"));
}

console.log(failures === 0 ? "\nall assertions passed" : `\n${failures} assertion(s) failed`);
process.exit(failures === 0 ? 0 : 1);
