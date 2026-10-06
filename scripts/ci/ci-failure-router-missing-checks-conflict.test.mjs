#!/usr/bin/env node
// Behavioral test for the `missing-checks` sweep's CONFLICT branch in
// .github/actions/ci-failure-router/action.yml (GOL-3098).
//
// What it protects:
//   The sweep's three pre-existing causes — dropped trigger, approval gate
//   (GOL-2732), retargeted base (GOL-2850) — all share one remedy, close and
//   reopen the PR, so until now the remediation block was effectively
//   unconditional. A fourth cause breaks that: a **conflicted** (`dirty`) PR
//   has no `refs/pull/N/merge`, so GitHub creates no `pull_request` workflow
//   run for it at all. Close/reopen re-fires the event and nothing happens —
//   on AgenticOS #832 following the sweep's own prescription moved the
//   check-run count 4 → 6 and left all four required contexts absent, which
//   reads as a *failed fix* rather than a wrong instruction.
//
//   Where the base repo squash-merges this is the common case, not an edge
//   case: a squash lands a different SHA with the same content on the
//   protected branch while the parent's original commit stays on the child's
//   branch, so every stacked child goes `dirty` the instant its parent lands.
//   The retarget and the conflict arrive in the same instant, which is why the
//   GOL-2850 signature alone mis-prescribes here.
//
//   So this test pins two things the retarget test cannot:
//     - a `dirty` PR names the conflict and carries NO close/reopen command;
//     - a non-`dirty` PR keeps the close/reopen prescription verbatim.
//
//   Runs the real script out of the real action file (no copy of the logic
//   lives here), same extraction contract as
//   ci-failure-router-missing-checks-retarget.test.mjs.
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

// ── Extract the script straight out of the action (a 10-space-indented
// `script: |` block scalar running to EOF). ────────────────────────────────
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
// Modelled on the real failure: AgenticOS #832, stacked behind a squash-merged
// #814, retargeted onto `main` and conflicted in the same instant.
const OWNER = "Goldberry-Playground";
const REPO = "AgenticOS";
const PR = 832;
const SHA = "cd6a27d0f2b1aa44e4d1f5c0d9a7b3e8f6c21d90";
const REQUIRED = ["Lint", "Typecheck", "Unit tests", "Build"];
// Head must be older than the 20m grace window or the sweep skips it.
const HEAD_PUSHED = new Date(Date.now() - 200 * 60_000).toISOString();
const AFTER_HEAD = new Date(Date.now() - 170 * 60_000).toISOString();

const requiredChecksJson = Buffer.from(
  JSON.stringify({ branch: "main", required_contexts: REQUIRED }),
).toString("base64");

const run = (event, extra = {}) => ({
  name: "CI",
  event,
  conclusion: "success",
  html_url: "https://example.invalid/run",
  ...extra,
});

/**
 * @param mergeableStates sequence of `mergeable_state` values `pulls.get`
 *                        answers, last value repeating; or "throw"
 * @param timeline        PR timeline events
 * @param headRuns        workflow runs on the head SHA
 */
async function runSweep({
  mergeableStates = ["clean"],
  timeline = [],
  headRuns = [],
} = {}) {
  const calls = { created: [], comments: [], updated: [], pullGets: 0 };
  const github = {
    paginate: async (fn, args) => fn(args),
    request: async (route, args) => {
      if (route.includes("/rules/branches/")) {
        return {
          data: [
            {
              type: "required_status_checks",
              parameters: {
                required_status_checks: REQUIRED.map((context) => ({ context })),
              },
            },
          ],
        };
      }
      throw new Error(`unstubbed request: ${route} ${JSON.stringify(args)}`);
    },
    rest: {
      repos: {
        getContent: async () => ({ data: { content: requiredChecksJson } }),
        listCommitStatusesForRef: async () => [], // paginated → bare array
        getCommit: async () => ({
          data: { commit: { committer: { date: HEAD_PUSHED } } },
        }),
      },
      pulls: {
        // paginated → bare array
        list: async () => [
          {
            number: PR,
            draft: false,
            title: "fix(dashboard): give form fields their own boundary tokens",
            html_url: `https://github.com/${OWNER}/${REPO}/pull/${PR}`,
            head: { sha: SHA },
          },
        ],
        get: async () => {
          if (mergeableStates === "throw") {
            const e = new Error("mergeability unavailable");
            e.status = 502;
            throw e;
          }
          const i = Math.min(calls.pullGets, mergeableStates.length - 1);
          calls.pullGets += 1;
          return { data: { mergeable_state: mergeableStates[i] } };
        },
      },
      checks: { listForRef: async () => ({ data: { check_runs: [] } }) },
      actions: {
        listWorkflowRunsForRepo: async () => ({ data: { workflow_runs: headRuns } }),
      },
      issues: {
        listForRepo: async () => [], // paginated → bare array; first mint
        listEventsForTimeline: async () => timeline,
        create: async (a) => {
          calls.created.push(a);
          return { data: { number: 9001 } };
        },
        createComment: async (a) => calls.comments.push(a),
        update: async (a) => calls.updated.push(a),
        createLabel: async () => {},
      },
    },
  };
  const core = {
    info: () => {},
    notice: () => {},
    warning: () => {},
    setFailed: (m) => {
      throw new Error(`setFailed: ${m}`);
    },
  };
  const context = { repo: { owner: OWNER, repo: REPO } };

  const saved = {
    MODE: process.env.MODE,
    GRACE_MINUTES: process.env.GRACE_MINUTES,
    MERGEABLE_POLL_MS: process.env.MERGEABLE_POLL_MS,
  };
  process.env.MODE = "missing-checks";
  process.env.GRACE_MINUTES = "20";
  process.env.MERGEABLE_POLL_MS = "0"; // don't sleep in the test
  try {
    await makeRunner()(github, context, core);
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
  return calls;
}

const baseChange = (created_at, event = "automatic_base_change_succeeded") => ({
  event,
  created_at,
});

// ── Assertions ─────────────────────────────────────────────────────────────
let failures = 0;
const check = (name, fn) => {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (e) {
    failures += 1;
    console.error(`FAIL  ${name}\n      ${e.message}`);
  }
};
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};
const onlyIssue = (calls) => {
  assert(calls.created.length === 1, `expected 1 minted issue, got ${calls.created.length}`);
  return calls.created[0];
};
const CLOSE_REOPEN = `gh pr close ${PR} --repo ${OWNER}/${REPO} && gh pr reopen ${PR}`;

console.log("missing-checks conflict branch (GOL-3098)");

{
  // The real #832 shape: retargeted by a squash-merged parent, and conflicted
  // by the same squash. The retarget signature is present and must NOT win.
  const calls = await runSweep({
    mergeableStates: ["dirty"],
    timeline: [baseChange(AFTER_HEAD)],
  });
  const issue = onlyIssue(calls);
  check("dirty → title says Conflict-blocked, not Retarget-skipped", () => {
    assert(
      issue.title === `Conflict-blocked required check on PR #${PR}: ${REQUIRED.join(", ")}`,
      `title was: ${issue.title}`,
    );
  });
  check("dirty → names the conflict and the missing merge ref", () => {
    assert(issue.body.includes("conflicted with `main`"), "does not say the PR is conflicted");
    assert(issue.body.includes("mergeable_state: dirty"), "does not quote mergeable_state");
    assert(
      issue.body.includes(`refs/pull/${PR}/merge`),
      "does not explain that there is no merge ref to check out",
    );
    assert(
      issue.body.includes("no `pull_request` workflow run at all"),
      "does not say why no run is created",
    );
  });
  check("dirty → does NOT prescribe close/reopen", () => {
    assert(!issue.body.includes(CLOSE_REOPEN), "still ships the close/reopen command");
    assert(!issue.body.includes("gh pr reopen"), "still mentions `gh pr reopen` as a remedy");
    assert(
      issue.body.includes("Close/reopen cannot fix this"),
      "does not say outright that close/reopen cannot work",
    );
  });
  check("dirty → prescribes merging the base in", () => {
    assert(
      issue.body.includes("git fetch origin main && git merge origin/main"),
      "no base-merge command",
    );
    assert(issue.body.includes("**Remediation**"), "no remediation section");
    assert(
      issue.body.includes("rather than rebasing"),
      "does not prefer merge over rebase on a squash-merged parent",
    );
  });
  check("dirty + retarget → names the squash-merged parent as the likely cause", () => {
    assert(issue.body.includes("squash-merged parent"), "does not name the squash as the cause");
    assert(issue.body.includes(AFTER_HEAD), "drops the retarget timestamp it did detect");
  });
  check("dirty → diagnosis keeps its paragraph breaks", () => {
    // `.filter(Boolean)` over an array holding "" separators silently collapses
    // every paragraph into one markdown blob — the exact shape that makes the
    // "do not close/reopen" warning easy to skim past.
    assert(
      issue.body.includes("(`mergeable_state: dirty`).\n\nA conflicted PR has no"),
      "diagnosis paragraphs are smooshed onto consecutive lines",
    );
  });
  check("dirty → one mergeability read, no wasted polls", () => {
    assert(calls.pullGets === 1, `polled pulls.get ${calls.pullGets}x for a settled state`);
  });
}

{
  // Conflicted with no retarget in the timeline: still the conflict branch,
  // and the squash explanation is offered as a possibility rather than a fact.
  const calls = await runSweep({ mergeableStates: ["dirty"], timeline: [] });
  const issue = onlyIssue(calls);
  check("dirty without retarget → still conflict-blocked, still no close/reopen", () => {
    assert(issue.title.startsWith("Conflict-blocked"), `title was: ${issue.title}`);
    assert(!issue.body.includes(CLOSE_REOPEN), "still ships the close/reopen command");
    assert(
      issue.body.includes("If the base of this PR was squash-merged"),
      "does not offer the squash as a hypothesis",
    );
    assert(!issue.body.includes("base was retargeted at"), "invented a retarget");
  });
}

{
  // ACCEPTANCE: a CLEAN retarget-skipped PR is unchanged — this is the
  // regression that would make the whole change a net loss.
  const calls = await runSweep({
    mergeableStates: ["clean"],
    timeline: [baseChange(AFTER_HEAD)],
  });
  const issue = onlyIssue(calls);
  check("clean retarget → prescription unchanged", () => {
    assert(issue.title.startsWith("Retarget-skipped"), `title was: ${issue.title}`);
    assert(issue.body.includes(CLOSE_REOPEN), "lost the close/reopen command");
    assert(issue.body.includes("base was retargeted at"), "lost the retarget diagnosis");
    assert(
      issue.body.includes("not a dropped one"),
      "lost the 'nothing was dropped' wording",
    );
  });
  check("clean retarget → no conflict wording, no inconclusive caveat", () => {
    assert(!issue.body.includes("conflicted with `main`"), "invented a conflict");
    assert(!issue.body.includes("Close/reopen cannot fix this"), "contradicts its own remedy");
    assert(
      !issue.body.includes("the conflict check was inconclusive"),
      "warns about an inconclusive read it actually resolved",
    );
  });
}

{
  // A genuine dropped trigger on a clean PR: untouched too.
  const calls = await runSweep({ mergeableStates: ["clean"], timeline: [] });
  const issue = onlyIssue(calls);
  check("clean dropped trigger → prescription unchanged", () => {
    assert(issue.title.startsWith("Missing required check"), `title was: ${issue.title}`);
    assert(issue.body.includes("That is a dropped trigger"), "lost the dropped-trigger wording");
    assert(issue.body.includes(CLOSE_REOPEN), "lost the close/reopen command");
    assert(!issue.body.includes("Close/reopen cannot fix this"), "contradicts its own remedy");
  });
}

{
  // GitHub computes mergeability LAZILY: the first read answers `unknown` and
  // kicks the background job off. The sweep must poll rather than conclude.
  const calls = await runSweep({
    mergeableStates: ["unknown", "unknown", "dirty"],
    timeline: [baseChange(AFTER_HEAD)],
  });
  const issue = onlyIssue(calls);
  check("unknown → polls until mergeability settles, then classifies", () => {
    assert(calls.pullGets === 3, `expected 3 polls before dirty, got ${calls.pullGets}`);
    assert(issue.title.startsWith("Conflict-blocked"), `title was: ${issue.title}`);
    assert(!issue.body.includes(CLOSE_REOPEN), "concluded on the first `unknown`");
  });
}

{
  // Fail OPEN: a state that never settles must keep the old prescription plus
  // a caveat, never suppress the issue — losing dropped-trigger detection is
  // worse than an occasionally over-cautious remediation note.
  const calls = await runSweep({
    mergeableStates: ["unknown"],
    timeline: [],
  });
  const issue = onlyIssue(calls);
  check("never-settling unknown → fails open with a caveat, bounded polls", () => {
    assert(calls.pullGets === 4, `expected 4 bounded polls, got ${calls.pullGets}`);
    assert(issue.body.includes(CLOSE_REOPEN), "suppressed the remedy on an unknown state");
    assert(
      issue.body.includes("the conflict check was inconclusive"),
      "no caveat about the unresolved mergeability",
    );
    assert(
      issue.body.includes("close/reopen is a no-op on it"),
      "caveat does not say what to watch out for",
    );
  });
}

{
  // `pulls.get` unreadable (403/502) — same fail-open contract.
  const calls = await runSweep({ mergeableStates: "throw", timeline: [] });
  const issue = onlyIssue(calls);
  check("mergeability read failure → falls back, still mints", () => {
    assert(issue.body.includes("That is a dropped trigger"), "lost the fallback diagnosis");
    assert(issue.body.includes(CLOSE_REOPEN), "lost the fallback remedy");
    assert(
      issue.body.includes("`unreadable`"),
      "does not record that mergeable_state could not be read",
    );
  });
}

{
  // The cheap tell: `pull_request_target` runs against the BASE ref, so it
  // fires on a conflicted PR while `pull_request` cannot. Print the split.
  const calls = await runSweep({
    mergeableStates: ["dirty"],
    headRuns: [run("pull_request_target"), run("pull_request_target"), run("push")],
  });
  const issue = onlyIssue(calls);
  check("pull_request_target runs but zero pull_request → names the fingerprint", () => {
    assert(
      issue.body.includes("**Workflow runs on this head:** 0 `pull_request`, 2 `pull_request_target`, 3 total."),
      `fingerprint line missing or wrong:\n${issue.body}`,
    );
    assert(
      issue.body.includes("is the **conflict** fingerprint"),
      "does not call the split the conflict fingerprint",
    );
  });
}

{
  // With `pull_request` runs present the split is not the conflict tell, so
  // the claim must not be made.
  const calls = await runSweep({
    mergeableStates: ["clean"],
    headRuns: [run("pull_request"), run("pull_request_target")],
  });
  const issue = onlyIssue(calls);
  check("pull_request runs present → no conflict-fingerprint claim", () => {
    assert(
      issue.body.includes("**Workflow runs on this head:** 1 `pull_request`, 1 `pull_request_target`, 2 total."),
      "fingerprint counts missing",
    );
    assert(
      !issue.body.includes("is the **conflict** fingerprint"),
      "claimed the conflict fingerprint with pull_request runs present",
    );
  });
}

{
  // Precedence: the approval gate still owns the DIAGNOSIS (it names an
  // identity to fix), but a conflict owns the REMEDY — close/reopen is inert
  // either way while the PR is dirty.
  const calls = await runSweep({
    mergeableStates: ["dirty"],
    headRuns: [
      run("pull_request_target", {
        conclusion: "action_required",
        triggering_actor: { login: "github-actions[bot]" },
      }),
    ],
  });
  const issue = onlyIssue(calls);
  check("gate + conflict → gate diagnosis, conflict remedy", () => {
    assert(issue.title.startsWith("Approval-gated"), `title was: ${issue.title}`);
    assert(issue.body.includes("approval gate, not a dropped trigger"), "lost the gate diagnosis");
    assert(!issue.body.includes(CLOSE_REOPEN), "prescribed close/reopen on a dirty PR");
    assert(
      issue.body.includes("clear the conflict first"),
      "does not order the conflict ahead of the gate",
    );
  });
}

if (failures) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll checks passed.");
