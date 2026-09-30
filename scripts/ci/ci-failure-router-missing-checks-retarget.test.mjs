#!/usr/bin/env node
// Behavioral test for the `missing-checks` sweep's cause classification in
// .github/actions/ci-failure-router/action.yml (GOL-2850).
//
// What it protects:
//   A required context can be absent from a head SHA for three different
//   reasons that look byte-identical from check-runs + statuses alone:
//     (a) dropped trigger — GitHub never created the run;
//     (b) approval gate   — the run exists, parked at `action_required`
//                           (GOL-2732);
//     (c) retargeted base — the workflow is filtered `pull_request:
//                           branches: [main]`, the head was pushed while the
//                           PR was still stacked on a topic branch, and the
//                           automatic retarget when the parent merged fires
//                           neither `opened`, `synchronize` nor `reopened`
//                           (GOL-2850, first seen on grove-sites #917).
//
//   All three wedge the PR at "Expected — waiting for status" and all three
//   are cleared by close/reopen, so the REMEDY does not distinguish them —
//   but the DIAGNOSIS must. Calling (c) a "dropped trigger" sends triage
//   hunting a phantom GitHub fault when the real story is a stacked PR and
//   the real question is whether the base filter should be re-fired at all.
//
//   Runs the real script out of the real action file (no copy of the logic
//   lives here) against stub `github`/`core`/`context`, so a refactor that
//   moves the classification shows up here and not in triage noise.
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

// ── Extract the script straight out of the action (same contract as
// ci-failure-router-queue-dedupe.test.mjs: a 10-space-indented `script: |`
// block scalar running to EOF). Text extraction keeps this on node builtins
// and makes a re-indent fail loudly here. ──────────────────────────────────
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
const PR = 917;
const SHA = "c368355dc3a4d3673770c017dd2393856bdd633b";
const REQUIRED = ["Lint, Type Check & Test", "Route byte budget"];
// Head must be older than the 20m grace window or the sweep skips it.
const HEAD_PUSHED = new Date(Date.now() - 200 * 60_000).toISOString();
const AFTER_HEAD = new Date(Date.now() - 170 * 60_000).toISOString();
const BEFORE_HEAD = new Date(Date.now() - 230 * 60_000).toISOString();

const requiredChecksJson = Buffer.from(
  JSON.stringify({ branch: "main", required_contexts: REQUIRED }),
).toString("base64");

/**
 * @param timeline  events returned by the PR timeline, or "throw"
 * @param gatedRuns workflow runs on the head SHA
 */
async function runSweep({ timeline = [], gatedRuns = [] } = {}) {
  const calls = { created: [], comments: [], updated: [], timelineReads: 0 };
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
        // Paginated → bare array.
        listCommitStatusesForRef: async () => [],
        getCommit: async () => ({
          data: { commit: { committer: { date: HEAD_PUSHED } } },
        }),
      },
      // Paginated → bare array.
      pulls: {
        list: async () => [
          {
            number: PR,
            draft: false,
            title: "fix(hub): stop reporting Ghost outages as a 404",
            html_url: `https://github.com/o/r/pull/${PR}`,
            head: { sha: SHA },
          },
        ],
      },
      checks: { listForRef: async () => ({ data: { check_runs: [] } }) },
      actions: {
        listWorkflowRunsForRepo: async () => ({ data: { workflow_runs: gatedRuns } }),
      },
      issues: {
        // Paginated → bare array. No open ci-failure issues: first mint.
        listForRepo: async () => [],
        listEventsForTimeline: async () => {
          calls.timelineReads += 1;
          if (timeline === "throw") {
            const e = new Error("timeline unavailable");
            e.status = 403;
            throw e;
          }
          return timeline;
        },
        create: async (a) => {
          calls.created.push(a);
          return { data: { number: 936 } };
        },
        createComment: async (a) => calls.comments.push(a),
        update: async (a) => calls.updated.push(a),
        createLabel: async () => {},
      },
    },
  };
  const core = { info: () => {}, notice: () => {}, warning: () => {}, setFailed: (m) => { throw new Error(`setFailed: ${m}`); } };
  const context = { repo: { owner: "Goldberry-Playground", repo: "grove-sites" } };

  const prevMode = process.env.MODE;
  const prevGrace = process.env.GRACE_MINUTES;
  process.env.MODE = "missing-checks";
  process.env.GRACE_MINUTES = "20";
  try {
    await makeRunner()(github, context, core);
  } finally {
    if (prevMode === undefined) delete process.env.MODE;
    else process.env.MODE = prevMode;
    if (prevGrace === undefined) delete process.env.GRACE_MINUTES;
    else process.env.GRACE_MINUTES = prevGrace;
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

console.log("missing-checks cause classification (GOL-2850)");

{
  // (c) The GOL-2850 case: base retargeted AFTER the head commit.
  const calls = await runSweep({ timeline: [baseChange(AFTER_HEAD)] });
  const issue = onlyIssue(calls);
  check("retarget after head → title says Retarget-skipped", () => {
    assert(
      issue.title.startsWith("Retarget-skipped required check on PR #917:"),
      `title was: ${issue.title}`,
    );
  });
  check("retarget after head → names the retarget as the cause", () => {
    assert(issue.body.includes("base was retargeted at"), "no retarget sentence");
    assert(issue.body.includes(AFTER_HEAD), "retarget timestamp not quoted");
    assert(issue.body.includes(HEAD_PUSHED), "head commit date not quoted");
    assert(
      issue.body.includes("branches: [main]"),
      "does not name the base filter that skipped the workflows",
    );
  });
  check("retarget after head → does NOT blame a dropped trigger", () => {
    assert(
      !issue.body.includes("That is a dropped trigger"),
      "still calls a filtered trigger a dropped one",
    );
    assert(
      issue.body.includes("not a dropped one"),
      "does not say explicitly that nothing was dropped",
    );
  });
  check("retarget after head → still carries the close/reopen remedy", () => {
    assert(
      issue.body.includes(
        "gh pr close 917 --repo Goldberry-Playground/grove-sites && gh pr reopen 917",
      ),
      "close/reopen command missing",
    );
    assert(issue.body.includes("**Remediation**"), "no remediation section");
  });
}

{
  // A retarget that happened BEFORE the head was pushed explains nothing:
  // the push itself should have fired the (now-correct) base filter.
  const calls = await runSweep({ timeline: [baseChange(BEFORE_HEAD)] });
  const issue = onlyIssue(calls);
  check("retarget before head → genuine dropped trigger", () => {
    assert(
      issue.title.startsWith("Missing required check on PR #917:"),
      `title was: ${issue.title}`,
    );
    assert(issue.body.includes("That is a dropped trigger"), "lost the dropped-trigger wording");
    assert(!issue.body.includes("base was retargeted at"), "wrongly blamed the retarget");
  });
}

{
  const calls = await runSweep({ timeline: [] });
  const issue = onlyIssue(calls);
  check("no base change at all → genuine dropped trigger", () => {
    assert(issue.body.includes("That is a dropped trigger"), "lost the dropped-trigger wording");
    assert(!issue.body.includes("base was retargeted at"), "invented a retarget");
  });
}

{
  // A manual retarget (`base_ref_changed`) is the same class as the automatic
  // one — GitHub does not re-fire `pull_request` for either.
  const calls = await runSweep({
    timeline: [baseChange(AFTER_HEAD, "base_ref_changed")],
  });
  const issue = onlyIssue(calls);
  check("manual base_ref_changed after head → classified as retarget too", () => {
    assert(issue.body.includes("base was retargeted at"), "manual retarget not recognised");
  });
}

{
  // Precedence: an approval gate is a strictly more actionable finding (it
  // names an identity to fix), so it must win — and must not pay for a
  // timeline read it does not need.
  const calls = await runSweep({
    timeline: [baseChange(AFTER_HEAD)],
    gatedRuns: [
      {
        name: "CI",
        conclusion: "action_required",
        html_url: "https://example.invalid/run",
        triggering_actor: { login: "github-actions[bot]" },
      },
    ],
  });
  const issue = onlyIssue(calls);
  check("approval gate outranks retarget", () => {
    assert(
      issue.title.startsWith("Approval-gated required check on PR #917:"),
      `title was: ${issue.title}`,
    );
    assert(issue.body.includes("approval gate, not a dropped trigger"), "lost gate wording");
    assert(!issue.body.includes("base was retargeted at"), "mixed the two causes");
    assert(calls.timelineReads === 0, "read the timeline when the cause was already known");
  });
}

{
  // Fail-open: an unreadable timeline must degrade to the old wording, never
  // lose the issue.
  const calls = await runSweep({ timeline: "throw" });
  const issue = onlyIssue(calls);
  check("timeline read failure → falls back, still mints", () => {
    assert(issue.body.includes("That is a dropped trigger"), "lost the fallback wording");
    assert(issue.body.includes("**Missing required context(s):**"), "lost the summary");
  });
}

if (failures) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll checks passed.");
