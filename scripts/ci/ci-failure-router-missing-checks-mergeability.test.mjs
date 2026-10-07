#!/usr/bin/env node
// Behavioral test for the mergeability gate on the `missing-checks` sweep's
// close/reopen remediation in .github/actions/ci-failure-router/action.yml
// (GOL-3151).
//
// What it protects:
//   The sweep's canned remedy is `gh pr close N && gh pr reopen N`, on the
//   rationale that close/reopen re-fires `pull_request` on the SAME head SHA
//   so nothing rebinds. That is true — but only when the PR has a merge ref.
//
//   A `pull_request` workflow checks out `refs/pull/N/merge`, and GitHub
//   publishes NO merge ref for a PR whose head conflicts with its base. So on
//   a CONFLICTING PR the remedy re-fires the event exactly as advertised and
//   every job then dies at the checkout step: N contexts that were merely
//   MISSING become N that are RED. Where `dismiss_stale_reviews_on_push` is
//   enabled, the head move also burns the `agent-review/*` sign-off.
//
//   The worked case is grove-odoo-modules #318 on 2026-10-06 (GOL-3149). #315
//   squash-merged at 02:25:35Z and the bot retargeted #318 onto `main` one
//   second later; the squash left the branch carrying the pre-squash commit, so
//   `main...head` read 2 ahead / 5 behind — diverged, conflicting on
//   `grove_headless/__manifest__.py`. The router's retarget DIAGNOSIS was
//   correct. Its remediation, followed literally, would have taken 5 missing
//   required contexts to 5 red. What actually fixed it was a `synchronize` push
//   that was also a conflict resolution (re-authored onto current `main`).
//
//   The same unguarded logic drives the AUTOMATIC re-fire, not just the advice
//   text. That path is dormant only because all four `missing-checks-sweep.yml`
//   callers grant `pull-requests: read`; the moment one is raised to `write` it
//   would manufacture reds on conflicting bot PRs, up to `refire-budget` times
//   per head. So the auto-refire arm is pinned here too — as a test, because a
//   guard satisfied by a comment is not a guard.
//
//   Runs the real script out of the real action file (no copy of the logic
//   lives here) against stub `github`/`core`/`context`, so a refactor that
//   drops the gate shows up here and not in an outage.
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

// ── Fixtures: grove-odoo-modules #318, the PR this came from ───────────────
const PR = 318;
const SHA = "ae8fcd58f4a6c1b0d2e3f4a5b6c7d8e9f0a1b2c3";
const LINT = "Lint Python";
const MANIFESTS = "Validate Module Manifests";
const SLUGS = "Validate Tenant Slug Map";
const UNIT = "Pure-Python unit tests";
const ODOO = "Install + test module against Odoo 19";
const REQUIRED = [LINT, MANIFESTS, SLUGS, UNIT, ODOO];
// Head must be older than the 20m grace window or the sweep skips it.
const HEAD_PUSHED = new Date(Date.now() - 200 * 60_000).toISOString();
const RETARGETED_AT = new Date(Date.now() - 170 * 60_000).toISOString();

const requiredChecksJson = Buffer.from(
  JSON.stringify({ branch: "main", required_contexts: REQUIRED }),
).toString("base64");

const BOT_USER = { login: "agenticos-developer[bot]", type: "Bot" };

// The three mergeability answers that matter.
const MERGEABLE = { mergeable: true, mergeable_state: "blocked" };
const CONFLICTING = { mergeable: false, mergeable_state: "dirty" };
const UNCOMPUTED = { mergeable: null, mergeable_state: "unknown" };

/** A control-plane drop: terminal, and no machine ever took it. */
const droppedJob = (name) => ({ name, conclusion: "cancelled", runner_name: "" });
const okJob = (name) => ({ name, conclusion: "success", runner_name: "GitHub Actions 7" });

const run = (id, { status = "completed", conclusion = "failure", name = "CI" } = {}) => ({
  id, status, conclusion, name,
  workflow_id: 1,
  created_at: HEAD_PUSHED,
  run_started_at: HEAD_PUSHED,
  html_url: `https://github.com/o/r/actions/runs/${id}`,
});

/**
 * @param mergeStates  `pulls.get` payloads, consumed one per read; the LAST
 *                     one repeats once exhausted. Lets a test drive the async
 *                     `mergeable: null` → settled transition.
 * @param getThrows    status code `pulls.get` should throw, or null
 * @param checkRuns    check-run names present on the head SHA
 * @param runs         workflow runs on the head SHA
 * @param jobsByRun    { [runId]: job[] }
 * @param timeline     PR timeline events (for the retarget cause)
 * @param env          extra env overrides
 */
async function runSweep({
  mergeStates = [MERGEABLE],
  getThrows = null,
  checkRuns = [],
  runs = [],
  jobsByRun = {},
  timeline = [],
  env = {},
} = {}) {
  const calls = {
    created: [], comments: [], updated: [], prUpdates: [],
    notices: [], warnings: [], infos: [], getReads: 0,
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
          user: BOT_USER,
          auto_merge: null,
          title: "feat(grove_headless): consultation-deferral feed",
          html_url: `https://github.com/o/r/pull/${PR}`,
          head: { sha: SHA },
        }],
        get: async () => {
          calls.getReads += 1;
          if (getThrows) {
            const e = new Error("Not Found");
            e.status = getThrows;
            throw e;
          }
          const i = Math.min(calls.getReads - 1, mergeStates.length - 1);
          return { data: mergeStates[i] };
        },
        update: async (a) => calls.prUpdates.push(a),
      },
      checks: {
        listForRef: async () => ({
          data: { check_runs: checkRuns.map((name) => ({ name })) },
        }),
      },
      actions: {
        listWorkflowRunsForRepo: async () => ({ data: { workflow_runs: runs } }),
        listJobsForWorkflowRun: async ({ run_id }) => ({ data: { jobs: jobsByRun[run_id] || [] } }),
      },
      issues: {
        listForRepo: async () => [], // paginated → bare array; always a fresh mint
        listEventsForTimeline: async () => timeline,
        create: async (a) => { calls.created.push(a); return { data: { number: 888 } }; },
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
    // Zero the backoff: the fixtures drive the transition explicitly, so a
    // real sleep would only make the suite slow.
    MERGEABILITY_POLL_MS: "0",
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

// The GOL-3149 shape: the base was retargeted after the head commit, so every
// required context is absent and the cause is (c) retarget.
const retargetScenario = (over = {}) => ({
  checkRuns: [],
  timeline: [{ event: "automatic_base_change_succeeded", created_at: RETARGETED_AT }],
  ...over,
});

// A control-plane drop, the one cause that arms the AUTOMATIC re-fire.
const dropScenario = (over = {}) => ({
  checkRuns: REQUIRED,
  runs: [run(37400000001)],
  jobsByRun: {
    37400000001: [okJob(LINT), okJob(MANIFESTS), okJob(SLUGS), droppedJob(UNIT), droppedJob(ODOO)],
  },
  ...over,
});

// ── Assertions ─────────────────────────────────────────────────────────────
let failures = 0;
const check = (name, fn) => {
  try { fn(); console.log(`  ok  ${name}`); }
  catch (e) { failures += 1; console.error(`FAIL  ${name}\n      ${e.message}`); }
};
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const onlyIssue = (calls) => {
  assert(calls.created.length === 1, `expected 1 minted issue, got ${calls.created.length}`);
  return calls.created[0];
};

console.log("missing-checks mergeability gate (GOL-3151)");

// ── 1. CONFLICTING → the close/reopen command is GONE ─────────────────────
{
  const calls = await runSweep(retargetScenario({ mergeStates: [CONFLICTING] }));
  const issue = onlyIssue(calls);
  check("conflicting → body carries NO `gh pr close` command at all", () => {
    assert(
      !issue.body.includes("gh pr close"),
      `still emits the close command:\n${issue.body}`,
    );
    assert(
      !issue.body.includes("gh pr reopen"),
      "still emits the reopen command",
    );
  });
  check("conflicting → says WHY close/reopen is wrong here (the merge ref)", () => {
    assert(
      issue.body.includes(`refs/pull/${PR}/merge`),
      "does not name the merge ref a `pull_request` workflow checks out",
    );
    assert(
      issue.body.includes("no merge ref for a conflicting PR"),
      "does not state that GitHub publishes no merge ref for a conflicting PR",
    );
    assert(
      issue.body.includes("fail at the checkout step"),
      "does not say the jobs would die at checkout",
    );
    assert(
      /\*missing\* required context\(s\) into 5 \*\*red\*\*/.test(issue.body),
      `does not quantify missing → red: ${issue.body.slice(0, 600)}`,
    );
    assert(
      issue.body.includes("dismiss_stale_reviews_on_push"),
      "does not warn that the head move burns the agent-review sign-off",
    );
  });
  check("conflicting → gives the rebase-or-re-author + push remedy instead", () => {
    assert(issue.body.includes("git rebase origin/main"), "no rebase step");
    assert(issue.body.includes("git push --force-with-lease"), "no push step");
    assert(issue.body.includes("re-author"), "does not offer the re-author path");
    assert(
      issue.body.includes("squash-merge of a parent PR"),
      "does not explain WHEN a rebase will not converge (base rewritten underneath)",
    );
    assert(
      issue.body.includes("`synchronize`"),
      "does not name the event a push produces",
    );
  });
  check("conflicting → mergeability is stated in the header, not just buried", () => {
    assert(
      issue.body.includes("**Mergeability:** `dirty`"),
      `no mergeability line in the summary: ${issue.body.slice(0, 900)}`,
    );
  });
  check("conflicting → warns in the job log too", () => {
    assert(
      calls.warnings.some((w) => w.includes("close/reopen SUPPRESSED")),
      `did not warn: ${calls.warnings.join(" | ")}`,
    );
  });
}

// ── 2. MERGEABLE → the existing advice is untouched ───────────────────────
// The contrast case. Without this, case 1 could pass by deleting the
// remediation outright.
{
  const calls = await runSweep(retargetScenario({ mergeStates: [MERGEABLE] }));
  const issue = onlyIssue(calls);
  check("mergeable → the close/reopen advice is unchanged", () => {
    assert(
      issue.body.includes(
        "gh pr close 318 --repo Goldberry-Playground/grove-odoo-modules && gh pr reopen 318",
      ),
      "lost the close/reopen command on a mergeable PR",
    );
    assert(issue.body.includes("**Remediation**"), "no remediation section");
    assert(
      issue.body.includes("same head SHA"),
      "lost the `nothing rebinds` rationale",
    );
  });
  check("mergeable → no conflict warning is invented", () => {
    assert(!issue.body.includes("Do NOT close/reopen"), "warned about a conflict that does not exist");
    assert(!issue.body.includes("**Mergeability:**"), "added a mergeability line for a clean PR");
    assert(!issue.body.includes("git push --force-with-lease"), "offered the conflict remedy anyway");
  });
  check("mergeable → cause analysis still says retarget (not replaced by this)", () => {
    assert(
      issue.title.startsWith(`Retarget-skipped required check on PR #${PR}:`),
      `title was: ${issue.title}`,
    );
    assert(issue.body.includes("base was retargeted at"), "lost the retarget diagnosis");
  });
}

// ── 3. the four-way cause analysis survives the new dimension ─────────────
// Mergeability is orthogonal to WHY the context is wedged. A conflicting PR
// must still be diagnosed by its cause; only the remedy changes.
{
  const calls = await runSweep(retargetScenario({ mergeStates: [CONFLICTING] }));
  const issue = onlyIssue(calls);
  check("conflicting + retarget → still titled and diagnosed as a retarget", () => {
    assert(
      issue.title.startsWith(`Retarget-skipped required check on PR #${PR}:`),
      `title was: ${issue.title}`,
    );
    assert(issue.body.includes("base was retargeted at"), "lost the retarget diagnosis");
    assert(issue.body.includes("not a dropped one"), "lost the filtered-vs-dropped distinction");
  });
}
{
  const calls = await runSweep(dropScenario({ mergeStates: [CONFLICTING] }));
  const issue = onlyIssue(calls);
  check("conflicting + control-plane drop → still titled and diagnosed as a drop", () => {
    assert(
      issue.title.startsWith(`Control-plane drop (no runner) on PR #${PR}:`),
      `title was: ${issue.title}`,
    );
    assert(issue.body.includes("empty `runner_name`"), "lost the drop evidence");
    assert(issue.body.includes("Do not triage this as a code defect"), "lost the triage warning");
  });
}

// ── 4. the AUTOMATIC re-fire is gated on the same condition ───────────────
// This is the arm that goes live the moment a caller is raised to
// `pull-requests: write`. A bot-authored PR, a positively-observed
// control-plane drop, budget and gap both clear — everything the self-heal
// needs — and it must still refuse, because the PR is `dirty`.
{
  const calls = await runSweep(dropScenario({ mergeStates: [CONFLICTING] }));
  const issue = onlyIssue(calls);
  check("conflicting → auto re-fire SKIPPED (no close/reopen executed)", () => {
    assert(
      calls.prUpdates.length === 0,
      `closed/reopened a conflicting PR: ${JSON.stringify(calls.prUpdates)}`,
    );
  });
  check("conflicting → held-off reason is reported as `conflicting`", () => {
    assert(
      issue.body.includes("**Self-heal REFUSED — the PR is `dirty`.**"),
      `did not name the refusal: ${issue.body.slice(-900)}`,
    );
    assert(
      calls.infos.some((i) => i.includes("self-heal held off (conflicting)")),
      `did not log the guard: ${calls.infos.join(" | ")}`,
    );
    // The generic hold-off note says "run the command above by hand" — which
    // would point at a command the conflicting arm deliberately removed.
    assert(
      !issue.body.includes("Run the command above by hand"),
      "pointed at a close/reopen command that is not in the body",
    );
  });
  check("conflicting → the budget ledger is NOT spent on a refused attempt", () => {
    const d = JSON.parse(issue.body.match(/<!-- d3-missing-checks-data:(\{.*?\}) -->/)[1]);
    assert(d.refires === 0, `spent a re-fire it never made: refires=${d.refires}`);
    assert(d.lastRefireAt === null, "stamped lastRefireAt without re-firing");
  });
}
{
  // The non-vacuity control: the identical scenario on a MERGEABLE PR does
  // re-fire. If this ever stops passing, case 4 proves nothing.
  const calls = await runSweep(dropScenario({ mergeStates: [MERGEABLE] }));
  check("mergeable twin → still re-fires (the guard is the only difference)", () => {
    assert(calls.prUpdates.length === 2, `expected close+reopen, got ${calls.prUpdates.length}`);
    assert(calls.prUpdates[0].state === "closed", "first call is not a close");
    assert(calls.prUpdates[1].state === "open", "second call is not a reopen");
  });
}

// ── 5. `mergeable: false` alone is enough ─────────────────────────────────
// Either signal on its own. GitHub reports the same fact twice and the gate
// must not depend on both arriving.
{
  const calls = await runSweep(
    dropScenario({ mergeStates: [{ mergeable: false, mergeable_state: null }] }),
  );
  const issue = onlyIssue(calls);
  check("`mergeable: false` with no `mergeable_state` → still conflicting", () => {
    assert(calls.prUpdates.length === 0, "re-fired on a PR reported unmergeable");
    assert(!issue.body.includes("gh pr close"), "still emitted the close command");
  });
}
{
  const calls = await runSweep(
    dropScenario({ mergeStates: [{ mergeable: true, mergeable_state: "dirty" }] }),
  );
  check("`mergeable_state: dirty` with `mergeable: true` → still conflicting", () => {
    assert(calls.prUpdates.length === 0, "trusted a stale `mergeable: true` over `dirty`");
  });
}

// ── 6. `mergeable: null` is UNKNOWN, not "fine" ───────────────────────────
{
  const calls = await runSweep(dropScenario({ mergeStates: [UNCOMPUTED] }));
  const issue = onlyIssue(calls);
  check("mergeable null after the poll → no auto re-fire", () => {
    assert(
      calls.prUpdates.length === 0,
      `re-fired on an unknown mergeability: ${JSON.stringify(calls.prUpdates)}`,
    );
    assert(
      issue.body.includes("**Self-heal held off** (mergeability-unknown)"),
      `did not name the guard: ${issue.body.slice(-900)}`,
    );
  });
  check("mergeable null → polls, bounded, rather than trusting one cold read", () => {
    assert(calls.getReads === 4, `expected 4 bounded reads, got ${calls.getReads}`);
  });
  check("mergeable null → advice path survives, with the conflict caveat", () => {
    assert(issue.body.includes("gh pr close"), "lost the advice entirely on an unknown");
    assert(
      issue.body.includes("Confirm this PR is not CONFLICTING before you run that"),
      `no caveat on the unknown advice path: ${issue.body.slice(-1200)}`,
    );
    assert(
      issue.body.includes("--json mergeable,mergeStateStatus"),
      "did not hand over the one-line check",
    );
  });
}
{
  // The poll exists because GitHub computes mergeability asynchronously and a
  // base move invalidates the cached answer — exactly the situation this sweep
  // lands in. A cold `null` that settles to `true` must be read as mergeable.
  const calls = await runSweep(
    dropScenario({ mergeStates: [UNCOMPUTED, UNCOMPUTED, MERGEABLE] }),
  );
  check("mergeable null then true → poll resolves it, re-fire proceeds", () => {
    assert(calls.getReads === 3, `stopped polling too early/late: ${calls.getReads} reads`);
    assert(calls.prUpdates.length === 2, `expected close+reopen, got ${calls.prUpdates.length}`);
  });
}
{
  const calls = await runSweep(
    dropScenario({ mergeStates: [UNCOMPUTED, CONFLICTING] }),
  );
  check("mergeable null then dirty → poll catches the conflict", () => {
    assert(calls.prUpdates.length === 0, "re-fired a PR the second read called dirty");
  });
}
{
  const calls = await runSweep(
    dropScenario({ mergeStates: [UNCOMPUTED], env: { MERGEABILITY_POLL_TRIES: "1" } }),
  );
  check("poll-tries honoured → one read, still refuses to re-fire", () => {
    assert(calls.getReads === 1, `expected 1 read, got ${calls.getReads}`);
    assert(calls.prUpdates.length === 0, "re-fired on a single uncomputed read");
  });
}

// ── 7. an unreadable mergeability fails closed for the self-heal, open for
// the report ──────────────────────────────────────────────────────────────
{
  const calls = await runSweep(dropScenario({ getThrows: 404 }));
  const issue = onlyIssue(calls);
  check("`pulls.get` throws → issue still minted (detection fails open)", () => {
    assert(
      issue.title.startsWith(`Control-plane drop (no runner) on PR #${PR}:`),
      `title was: ${issue.title}`,
    );
    assert(
      calls.infos.some((i) => i.includes("cannot read mergeability")),
      `did not log the degraded read: ${calls.infos.join(" | ")}`,
    );
  });
  check("`pulls.get` throws → self-heal fails closed (PR untouched)", () => {
    assert(
      calls.prUpdates.length === 0,
      `re-fired without ever confirming a merge ref: ${JSON.stringify(calls.prUpdates)}`,
    );
    assert(
      issue.body.includes("**Self-heal held off** (mergeability-unknown)"),
      "did not name the guard",
    );
  });
  check("`pulls.get` throws → does not retry a hard error in a loop", () => {
    assert(calls.getReads === 1, `retried a hard read failure ${calls.getReads} times`);
  });
}

// ── 8. the gate costs nothing on a PR the sweep does not report ───────────
// `pulls.get` is a per-PR API call in a 20-minute cron that walks every open
// PR. It must only be paid for a PR that is actually wedged.
{
  const calls = await runSweep({ checkRuns: REQUIRED, runs: [] });
  check("nothing wedged → no mergeability read at all", () => {
    assert(calls.created.length === 0, "minted an issue for a healthy PR");
    assert(calls.getReads === 0, `spent ${calls.getReads} mergeability read(s) on a healthy PR`);
  });
}

console.log(failures === 0 ? "\nall ok" : `\n${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
