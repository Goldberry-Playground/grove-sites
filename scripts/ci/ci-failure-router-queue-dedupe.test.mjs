#!/usr/bin/env node
// Behavioral test for the merge-queue duplicate suppression in
// .github/actions/ci-failure-router/action.yml, `route` mode (GOL-2807).
//
// What it protects:
//   The router's dedup marker is keyed (workflow, branch). The merge queue
//   builds every merge on a throwaway branch — `gh-readonly-queue/main/pr-N-<sha>`
//   — so a gate that is red on the branch tip (a fresh CVE in `Dependency
//   audit`, say) is re-discovered under a brand-new name on every merge and
//   used to mint a brand-new ownerless issue: GOL-2806 and GOL-2807 were four
//   minutes apart, same two CVEs, same one-line fix, two triage heartbeats.
//
//   The suppression is worth exactly as much as its precision. Suppress too
//   eagerly and a queue-only break — a semantic conflict between two queued
//   PRs, which by construction never appears on the base branch — is swallowed
//   silently, and the queue is the ONLY place it can be seen. So this test
//   asserts both directions: identical failing-job set → no issue, recorded on
//   the base-branch issue instead; anything else → mint, exactly as before.
//
//   It runs the real script out of the real action file (no copy of the logic
//   lives here) against stub `github`/`core`/`context` objects, so a refactor
//   that moves the check or drops it shows up here rather than in production
//   triage noise.
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

// github-script wraps the body in an async function with these in scope.
const makeRunner = () =>
  new Function(
    "github",
    "context",
    "core",
    `return (async () => {\n${body}\n})();`,
  );

// ── Stubs ──────────────────────────────────────────────────────────────────
const QUEUE_BRANCH = "gh-readonly-queue/main/pr-900-4ff6d9956c1ee34c02ce8bf595b00b971f2f21f5";

/** The failing-job list the router writes into an issue body. */
const issueBodyFor = (wf, branch, jobNames) =>
  [
    `<!-- d3-ci-failure:${wf}:${branch} -->`,
    `<!-- d3-ci-fail-data:{"sha":"4ff6d9956c1ee34c02ce8bf595b00b971f2f21f5","started":"2026-09-30T19:08:07Z"} -->`,
    `Ownerless failure — no open PR for \`${branch}\`.`,
    "",
    `**Failed jobs:**`,
    ...jobNames.map((n) => `- [\`${n}\`](https://example.invalid/job)`),
  ].join("\n");

function runRoute({ headBranch, failedJobNames, openIssues }) {
  const calls = { created: [], comments: [], updated: [], notices: [] };
  const github = {
    paginate: async (fn, args) => fn(args),
    rest: {
      actions: {
        listJobsForWorkflowRun: async () => [
          // A real run has passing jobs too; only `failure` counts.
          { name: "Lint, Type Check & Test", conclusion: "success", html_url: "u" },
          ...failedJobNames.map((name) => ({
            name,
            conclusion: "failure",
            html_url: `https://example.invalid/${encodeURIComponent(name)}`,
          })),
        ],
        listWorkflowRunsForRepo: async () => ({ data: { workflow_runs: [] } }),
      },
      pulls: { list: async () => ({ data: [] }) }, // ownerless: no open PR
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
  const context = { repo: { owner: "Goldberry-Playground", repo: "grove-sites" } };

  Object.assign(process.env, {
    MODE: "route",
    RUN_ID: "36764062531",
    WF_NAME: "CI",
    HEAD_BRANCH: headBranch,
    HEAD_SHA: "ca7b98c591c072cd90cd3f18711bc9b0d4b9b920",
    RUN_URL: "https://example.invalid/run",
    RUN_EVENT: "merge_group",
    RUN_ATTEMPT: "1",
    RUN_STARTED_AT: "2026-09-30T19:12:38Z",
    GONE_BRANCH: "",
    TRIGGER: "",
    PR_MERGED: "",
    GRACE_MINUTES: "20",
  });

  return makeRunner()(github, context, core).then(() => calls);
}

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

const MAIN_ISSUE = {
  number: 913,
  body: issueBodyFor("CI", "main", ["Dependency audit"]),
};

console.log("merge-queue duplicate suppression (GOL-2807)");

// 1. The GOL-2806/2807 shape: same single failing gate as the open `main`
//    issue → nothing minted, the re-failure is recorded on #913.
{
  const calls = await runRoute({
    headBranch: QUEUE_BRANCH,
    failedJobNames: ["Dependency audit"],
    openIssues: [MAIN_ISSUE],
  });
  check("queue branch, same failing job → mints nothing", calls.created.length === 0,
    `created ${calls.created.length}`);
  check(
    "queue branch, same failing job → records on the base-branch issue",
    calls.comments.length === 1 && calls.comments[0].issue_number === 913,
    JSON.stringify(calls.comments.map((c) => c.issue_number)),
  );
  check(
    "the recorded comment carries the queue run for traceability",
    (calls.comments[0]?.body ?? "").includes("https://example.invalid/run"),
  );
  check(
    "the base-branch issue body is left alone (recency marker stays on an ancestor sha)",
    calls.updated.length === 0,
    `updated ${calls.updated.length}`,
  );
}

// 2. A queue-only break — extra failing job the base branch never showed — is
//    the one failure only the queue can see. It must still get an issue.
{
  const calls = await runRoute({
    headBranch: QUEUE_BRANCH,
    failedJobNames: ["Dependency audit", "hub — build + smoke test"],
    openIssues: [MAIN_ISSUE],
  });
  check("queue branch, different failing job set → mints its own issue", calls.created.length === 1,
    `created ${calls.created.length}`);
  check(
    "the minted issue is keyed to the queue branch",
    (calls.created[0]?.body ?? "").includes(`<!-- d3-ci-failure:CI:${QUEUE_BRANCH} -->`),
  );
}

// 3. No open issue for the base branch → there is nothing to dedupe onto.
{
  const calls = await runRoute({
    headBranch: QUEUE_BRANCH,
    failedJobNames: ["Dependency audit"],
    openIssues: [],
  });
  check("queue branch, no base-branch issue → mints", calls.created.length === 1,
    `created ${calls.created.length}`);
}

// 4. A run-level failure (no job-level detail) must not dedupe onto a
//    job-level issue — the job sets are not comparable.
{
  const calls = await runRoute({
    headBranch: QUEUE_BRANCH,
    failedJobNames: [],
    openIssues: [MAIN_ISSUE],
  });
  check("queue branch, no failing-job detail → mints", calls.created.length === 1,
    `created ${calls.created.length}`);
}

// 5. Unchanged behaviour on the base branch itself: `main` still mints, and a
//    repeat failure still updates its own issue in place.
{
  const calls = await runRoute({
    headBranch: "main",
    failedJobNames: ["Dependency audit"],
    openIssues: [],
  });
  check("base branch with no open issue → mints (unchanged)", calls.created.length === 1,
    `created ${calls.created.length}`);
}
{
  const calls = await runRoute({
    headBranch: "main",
    failedJobNames: ["Dependency audit"],
    openIssues: [MAIN_ISSUE],
  });
  check(
    "base branch repeat failure → comments on its own issue, mints nothing (unchanged)",
    calls.created.length === 0 && calls.comments.length === 1 &&
      calls.comments[0].issue_number === 913,
  );
  check(
    "base branch repeat failure → refreshes the recency marker (GOL-1317, unchanged)",
    calls.updated.length === 1 &&
      (calls.updated[0].body ?? "").includes("ca7b98c591c072cd90cd3f18711bc9b0d4b9b920"),
  );
}

// 6. A branch that merely looks queue-ish is not a queue branch.
{
  const calls = await runRoute({
    headBranch: "gh-readonly-queue/main/not-a-pr-branch",
    failedJobNames: ["Dependency audit"],
    openIssues: [MAIN_ISSUE],
  });
  check("non-queue branch under the queue prefix → mints its own issue", calls.created.length === 1,
    `created ${calls.created.length}`);
}

// 7. A base branch with a slash in its name still resolves correctly.
{
  const calls = await runRoute({
    headBranch: "gh-readonly-queue/release/1.4/pr-42-4ff6d9956c1ee34c02ce8bf595b00b971f2f21f5",
    failedJobNames: ["Dependency audit"],
    openIssues: [
      { number: 500, body: issueBodyFor("CI", "release/1.4", ["Dependency audit"]) },
    ],
  });
  check(
    "queue branch off a slashed base → dedupes onto that base's issue",
    calls.created.length === 0 && calls.comments[0]?.issue_number === 500,
  );
}

console.log(failures === 0 ? "\nall assertions passed" : `\n${failures} assertion(s) failed`);
process.exit(failures === 0 ? 0 : 1);
