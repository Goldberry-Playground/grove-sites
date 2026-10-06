#!/usr/bin/env node
// Behavioral test for the merge-queue dequeue-cascade suppression in
// .github/actions/ci-failure-router/action.yml, `route` mode (GOL-3050).
//
// What it protects:
//   When GitHub destroys a merge group — the group is re-formed, a member is
//   dequeued, or an earlier member merges first — it deletes the
//   `gh-readonly-queue/…` ref and cancels every run in flight on it. Those
//   runs arrive at the router as conclusion `failure` with ZERO failing jobs
//   and one or more cancelled jobs, on a branch that no longer exists.
//
//   odoocker PR #790 is the worked example: its group died at 19:21Z on
//   2026-10-05 (CI = 3 cancelled / 10 success / 1 skipped, zero failures) and
//   the PR merged green at 23:56Z the same day. Three ownerless ci-failure
//   issues had already been minted — one per watched workflow — each burning a
//   DevOps triage heartbeat on a branch that was already gone.
//
//   The suppression is worth exactly as much as its precision. A merge group
//   is the ONLY place a semantic conflict between two queued PRs can surface,
//   so a run with any real failing job must route exactly as before. This test
//   asserts both directions.
//
//   It runs the real script out of the real action file (no copy of the logic
//   lives here) against stub `github`/`core`/`context` objects, so a refactor
//   that moves or drops the check shows up here rather than in triage noise.
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
// `script: |` opens a YAML block scalar indented by 10 spaces that runs to the
// end of the file. Strip exactly that indent so the body is the JS that
// actions/github-script evaluates. Text extraction (not a YAML parser) keeps
// this on node builtins and makes a re-indent fail loudly here.
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

// ── Stubs ──────────────────────────────────────────────────────────────────
// The real odoocker queue branch from the GOL-3050 run.
const QUEUE_BRANCH =
  "gh-readonly-queue/main/pr-790-e302f4dfb65dabfa0e6fd6e2d4cf31023d09e509";

const job = (name, conclusion) => ({
  name,
  conclusion,
  html_url: `https://example.invalid/${encodeURIComponent(name)}`,
});

function runRoute({ headBranch, jobs, runEvent = "merge_group", openIssues = [] }) {
  const calls = { created: [], comments: [], updated: [], notices: [] };
  const github = {
    paginate: async (fn, args) => fn(args),
    rest: {
      actions: {
        listJobsForWorkflowRun: async () => jobs,
        listWorkflowRunsForRepo: async () => ({ data: { workflow_runs: [] } }),
      },
      pulls: { list: async () => ({ data: [] }) }, // merge_group: never an open PR head
      issues: {
        listForRepo: async () => openIssues,
        create: async (a) => {
          calls.created.push(a);
          return { data: { number: 999 } };
        },
        createComment: async (a) => {
          calls.comments.push(a);
        },
        update: async (a) => {
          calls.updated.push(a);
        },
        createLabel: async () => {},
      },
    },
  };
  const core = {
    info: () => {},
    notice: (m) => calls.notices.push(m),
    setFailed: (m) => {
      throw new Error(`core.setFailed: ${m}`);
    },
  };
  const context = {
    repo: { owner: "Goldberry-Playground", repo: "odoocker-goldberrygrove" },
  };

  Object.assign(process.env, {
    MODE: "route",
    RUN_ID: "37362871993",
    WF_NAME: "CI",
    HEAD_BRANCH: headBranch,
    HEAD_SHA: "739e16043b728ef2250400248177045abadc6d9b",
    RUN_URL: "https://example.invalid/run",
    RUN_EVENT: runEvent,
    RUN_ATTEMPT: "1",
    RUN_STARTED_AT: "2026-10-05T19:21:55Z",
    GONE_BRANCH: "",
    TRIGGER: "",
    PR_MERGED: "",
    GRACE_MINUTES: "20",
  });

  return makeRunner()(github, context, core).then(() => calls);
}

// The exact job shape of CI run 37362871993 (the GOL-3050 run).
const PR790_JOBS = [
  job("shellcheck (scripts/)", "success"),
  job("Reject tracked .env files", "success"),
  job("cloud-init ASCII guard", "success"),
  job("ssh payload render guard", "success"),
  job("Validate Nginx Config", "success"),
  job("Terraform fmt + validate", "success"),
  job("checkout Stripe secrets wired", "success"),
  job("Validate third-party addon branches", "success"),
  job("Validate Docker Compose (Grove)", "cancelled"),
  job("actionlint (all workflows)", "success"),
  job("CI scripts", "cancelled"),
  job("Promotion script tests", "success"),
  job("Lint Python (Odoo Modules)", "cancelled"),
  job("Backend stack smoke test", "skipped"),
];

// ── Assertions ─────────────────────────────────────────────────────────────
let failures = 0;
const check = (name, ok, detail = "") => {
  if (ok) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
};

console.log("merge-queue dequeue-cascade suppression (GOL-3050)");

// 1. The GOL-3050 shape itself: cancelled jobs, zero failures → route nothing.
{
  const calls = await runRoute({ headBranch: QUEUE_BRANCH, jobs: PR790_JOBS });
  check(
    "dequeued merge group → mints nothing",
    calls.created.length === 0,
    `created ${calls.created.length}`,
  );
  check(
    "dequeued merge group → comments nowhere",
    calls.comments.length === 0,
    `comments ${calls.comments.length}`,
  );
  check(
    "dequeued merge group → says why, and names the ticket",
    calls.notices.length === 1 &&
      calls.notices[0].includes("GOL-3050") &&
      calls.notices[0].includes("3 cancelled job(s)"),
    JSON.stringify(calls.notices),
  );
}

// 2. A real failing job in the group still routes — even with cancelled
//    siblings, which is the normal shape of a queue run that genuinely broke
//    (first failure cancels the rest). This is the direction that must never
//    be swallowed: a semantic conflict between two queued PRs is visible
//    ONLY in the merge group.
{
  const calls = await runRoute({
    headBranch: QUEUE_BRANCH,
    jobs: [
      job("Terraform fmt + validate", "failure"),
      job("CI scripts", "cancelled"),
      job("shellcheck (scripts/)", "success"),
    ],
  });
  check(
    "queue run with one real failure + cancelled siblings → still mints",
    calls.created.length === 1,
    `created ${calls.created.length}`,
  );
  check(
    "the minted issue is keyed to the queue branch",
    (calls.created[0]?.body ?? "").includes(
      `<!-- d3-ci-failure:CI:${QUEUE_BRANCH} -->`,
    ),
  );
}

// 3. No cancelled job at all: a run-level `failure` with no job detail is a
//    different animal (a startup failure, a dropped job) and must keep
//    minting — the suppression fails OPEN.
{
  const calls = await runRoute({
    headBranch: QUEUE_BRANCH,
    jobs: [job("shellcheck (scripts/)", "success")],
  });
  check(
    "queue run, no failing AND no cancelled jobs → still mints (fails open)",
    calls.created.length === 1,
    `created ${calls.created.length}`,
  );
}

// 4. Scope: a cancelled non-merge_group run (a human hitting cancel on a
//    `push` run on `main`) is outside this guard. `main` is a live branch
//    whose red state is worth an issue, so behaviour there is unchanged.
{
  const calls = await runRoute({
    headBranch: "main",
    runEvent: "push",
    jobs: [job("CI scripts", "cancelled"), job("shellcheck (scripts/)", "success")],
  });
  check(
    "non-queue branch, cancelled job → unchanged (still mints)",
    calls.created.length === 1,
    `created ${calls.created.length}`,
  );
}

// 5. Scope: `merge_group` event but a branch that is not a queue ref. Both
//    legs of the guard are required, so this routes as before.
{
  const calls = await runRoute({
    headBranch: "gh-readonly-queue/main/not-a-pr-branch",
    jobs: [job("CI scripts", "cancelled"), job("shellcheck (scripts/)", "success")],
  });
  check(
    "merge_group event on a non-queue ref → unchanged (still mints)",
    calls.created.length === 1,
    `created ${calls.created.length}`,
  );
}

// 6. Scope: a queue-shaped branch reported under a non-merge_group event
//    keeps its old routing — the guard reads the event, not just the name.
{
  const calls = await runRoute({
    headBranch: QUEUE_BRANCH,
    runEvent: "push",
    jobs: PR790_JOBS,
  });
  check(
    "queue branch under a non-merge_group event → unchanged (still mints)",
    calls.created.length === 1,
    `created ${calls.created.length}`,
  );
}

console.log(failures === 0 ? "\nall assertions passed" : `\n${failures} assertion(s) failed`);
process.exit(failures === 0 ? 0 : 1);
