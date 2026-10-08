# Merge-queue enqueue identity — operations runbook (GOL-2524)

## Symptom

A pull request is **approved, mergeable, and every required check is green** —
and it does not merge. It enters the merge queue, sits at `AWAITING_CHECKS`, and
roughly thirty minutes later is silently ejected, still open, with no red check,
no comment, and no notification. Nothing in the PR's own checks looks wrong,
because nothing about the PR *is* wrong.

The tell is the merge group, not the PR: the merge-group commit has **zero
workflow runs**.

```bash
REPO=Goldberry-Playground/grove-sites
# Who enqueued, and what is the merge-group commit?
gh api graphql -f query='{repository(owner:"Goldberry-Playground",name:"grove-sites"){
  mergeQueue(branch:"main"){entries(first:10){nodes{
    position state enqueuedAt enqueuer{login} headCommit{oid} pullRequest{number}}}}}}'
# Zero here on an AWAITING_CHECKS entry older than ~2 min == dead group.
gh api "repos/$REPO/actions/runs?head_sha=<GROUP_COMMIT_OID>" -q '.total_count'
```

### Second symptom — a stacked PR's merge re-gates its parent's checks (GOL-2999)

The same unprovisioned identity has a second, differently-shaped failure, and on
a stacked PR chain it is the one you will actually hit.

When the PR being merged targets a **topic branch** rather than `main`, there is
no merge queue on that branch, so `gh pr merge --squash` performs a **direct
merge**. With `ENQUEUE_TOKEN` empty that merge push is made by `GITHUB_TOKEN`,
and it moves the head of the **parent** PR (the one whose base is that topic
branch). GitHub then refuses to auto-run workflows for the resulting
`pull_request` event, so every workflow on the parent's new head is created in
`action_required` — parked for a maintainer's "Approve and run". The required
contexts publish **nothing at all**: no check-run, no commit status. Branch
protection reports them as `Expected`, and there is no red signal anywhere.

The tell is the merge actor, not the enqueuer:

```bash
REPO=Goldberry-Playground/grove-sites
# The head commit of the gated PR is the stacked child's squash merge...
gh pr view <CHILD_PR> --repo "$REPO" --json mergedBy,mergeCommit
#   mergedBy.login == "app/github-actions"  -> merged under GITHUB_TOKEN
# ...and every run on the parent's head is parked:
gh api "repos/$REPO/actions/runs?head_sha=<PARENT_HEAD_SHA>" \
  --jq '.workflow_runs[] | select(.conclusion=="action_required")
        | "\(.name)\t\(.triggering_actor.login)"'
```

Note the gate lives in the run's **`conclusion`**, not its `status`: a held run
reads `status=completed, conclusion=action_required`.

**Remediation (per occurrence, agent-safe on an agent-authored PR):**

```bash
gh pr close <PARENT_PR> --repo "$REPO" && gh pr reopen <PARENT_PR> --repo "$REPO"
```

Close/reopen re-fires the whole `pull_request` event on the **same head SHA** —
nothing rebinds — under the closing identity, so the runs are created ungated.
Check first that no auto-merge is armed (closing disarms it) and that no human is
mid-review. The previously-parked runs flip `action_required` -> `failure` as
superseded; that is expected bookkeeping, not new breakage.

> ⛔ **Precondition: the PR must not be CONFLICTING** (GOL-3151). A
> `pull_request` workflow checks out `refs/pull/N/merge`, and GitHub publishes no
> merge ref for a PR whose head conflicts with its base — so on a `dirty` PR
> close/reopen re-fires the event exactly as described above and then every job
> dies at the checkout step, turning *missing* contexts into **red** ones (and
> dismissing any `agent-review/*` sign-off with the head move where
> `dismiss_stale_reviews_on_push` is on). Confirm with
> `gh pr view <PR> --repo "$REPO" --json mergeable,mergeStateStatus` first; a
> `null` `mergeable` means GitHub has not finished computing it, so re-read
> rather than assuming it is fine. If it is conflicting, rebase — or re-author
> onto current `main` when the base was rewritten underneath, e.g. by a parent's
> squash-merge — and push. The push is a `synchronize` event *and* a conflict
> resolution, which is what the re-fire actually needs. The
> `missing-checks-sweep` enforces the same precondition automatically.

Approving the parked runs from the Actions tab is only a **half fix**: a re-run
keeps the run's `actor` as `github-actions[bot]` (only `triggering_actor` becomes
the approver), so every event chained off that run stays suppressed — including
the `workflow_run` trigger `auto-approve.yml` listens on.

Provisioning the App identity below fixes this symptom and the merge-queue wedge
at once: an App-identity merge push is not suppressed, so the parent's checks
simply run.

## Cause

GitHub never creates workflow runs for events triggered by the automatic
`GITHUB_TOKEN`. This is the documented anti-recursion rule — the same rule that
wedged the daily rate-check PR in GOL-2114 (see
`grove-odoo-modules`'s `scripts/rate_check/RUNBOOK.md`), applied to a different event class.

With a merge queue on `main`, `gh pr merge --squash [--auto]` against an
already-green PR does not merge it — it **enqueues** it. When `auto-approve.yml`
made that call with `GITHUB_TOKEN`, the resulting `merge_group` event was
suppressed: no workflow ran on the `gh-readonly-queue/...` commit, so no required
check ever reported, so the entry waited out GitHub's ~30-minute
`checkResponseTimeout` and was ejected.

The failure is worst exactly where it should be best. A PR only reaches the
enqueue because the full-CI gate in `auto-approve.yml` already passed, so **the
healthier the PR, the more likely it silently fails to merge**. And because the
enqueue is also the *last* step, nothing downstream ever notices.

**A dead entry stalls the whole queue, not just its own PR.** The merge queue is
sequential, so a dead entry at position 1 holds up every healthy entry behind it
for the full eviction timeout. Measured 2026-10-06: #990's dead group sat at
position 1 while #987 waited at position 2 with 7 green runs of its own. The
cost of one wedge is therefore every PR behind it — which is why a backlog of
agent PRs does not drain on its own.

**Evidence — every merge-queue entry across all three repos on 2026-09-23. Same
commits, same required checks; the only variable was the enqueuing identity
(`AddedToMergeQueueEvent.enqueuer` on each PR's timeline):**

| repo / PR | enqueued by | result |
| --- | --- | --- |
| grove-sites #821 | `github-actions[bot]` 22:01:17Z | 0 runs, stuck **30 min**, dequeued by hand |
| grove-sites #821 | `agenticos-developer[bot]` 22:31:27Z | merge_group runs 10 s later → **merged 22:34:36Z** |
| odoocker #729 | `github-actions[bot]` 22:05:24Z | 0 runs in ~5.7 min, dequeued by hand |
| odoocker #729 | `agenticos-developer[bot]` 22:11:21Z | **merged 22:11:58Z — 37 s** |
| grove-odoo-modules #275 | `github-actions[bot]` 21:49:50Z, retried 21:57:25Z | 0 runs both times, ~17 min lost |
| grove-odoo-modules #275 | `agenticos-developer[bot]` 22:07:20Z | **merged 22:12:41Z** |
| grove-odoo-modules #277 | `github-actions[bot]` 22:13:30Z | 0 runs in ~3.8 min, dequeued by hand |
| grove-odoo-modules #277 | `agenticos-developer[bot]` 22:17:19Z | **merged 22:22:33Z** |

Four entries enqueued by `github-actions[bot]`: zero merge-group workflow runs,
zero merges. Four re-enqueued by the App: all four merged, the fastest in 37
seconds. Nothing else changed between the pairs.

(This also corrects an earlier note on #275 that "dequeue + requeue does not
fix it" — the timeline shows that retry was made by `github-actions[bot]` too,
so it was the same token, not a failed refutation.)

## Fix

`auto-approve.yml` mints a GitHub App installation token and uses it for the
enqueue call **only** — App-triggered events do create workflow runs. Approval,
review-thread resolution, and every read stay on `GITHUB_TOKEN`: least
privilege, and the approving identity is deliberately unchanged
(`github-actions[bot]`, distinct from the PR author, is what satisfies the
review requirement).

The App identity is **optional**. When `vars.MERGE_QUEUE_APP_CLIENT_ID` is unset the
mint step is skipped and the enqueue falls back to `GITHUB_TOKEN` exactly as
before — same graceful-degradation shape as `RATE_CHECK_PR_TOKEN` in GOL-2114.
No regression, but the wedge persists until the identity is provisioned.

So that the fallback is never *silent*, the same step carries a **wedge
detector**: once a queue entry has been `AWAITING_CHECKS` past a 180 s grace
window and its merge-group commit still has zero workflow runs, the auto-approve
run prints a full diagnosis (including the rescue commands below) and **fails**.
A red run two minutes in beats a silent ejection thirty minutes in.

This workflow exited green the instant the enqueue call returned — exactly when a
dead group starts its silent countdown — so the detector runs inside a short
bounded watch (≤ 4 min) that stops as soon as the answer is known: the PR merged,
it was never queued, or the merge group has runs.

One interaction worth knowing: the GOL-768 `dispatch_post_merge_builds` call
exists **only** because a `GITHUB_TOKEN` merge push is suppressed. On the
direct-merge path (merge queue disabled) an App-identity push is *not*
suppressed, so `docker.yml` and `cdn-asset-sync.yml` fire on their own and the
explicit dispatch is skipped — otherwise `main` would build twice. The merge-queue
path is unchanged either way: the real merge push is made by
`github-merge-queue[bot]`, never by us. The detector
is conservative by design — any unreadable API, any other queue state, anything
inside the grace window, and it stays quiet, because a false positive would fail
a healthy PR's merge. `scripts/ci/merge-queue-wedge-detector.test.mjs` asserts
both directions against the real function extracted from the workflow.

## The fix that needs no provisioning: arm auto-merge under the App (GOL-3118)

**Auto-merge inherits the identity of whoever enabled it.** When auto-merge is
armed on a PR, GitHub performs the eventual enqueue attributed to the identity
that armed it — and that enqueue creates `merge_group` workflow runs normally.

So the enqueue identity does **not** have to come from inside the workflow. It
never did. Agents already hold a non-`GITHUB_TOKEN` identity: every agent PR is
authored by `agenticos-developer[bot]` using a broker-minted installation token
(`GH_TOKEN_BROKER_URL`). Arming auto-merge with that same token makes every
subsequent enqueue healthy — no Actions variable, no Actions secret, no App
private key anywhere.

**Evidence** (`AutoMergeEnabledEvent.actor` vs the resulting
`AddedToMergeQueueEvent.enqueuer`, grove-sites, 2026-09-30):

| PR | armed by | resulting enqueuer | enqueues needed |
| --- | --- | --- | --- |
| #921 | `agenticos-developer` 19:50:49Z | `agenticos-developer[bot]` 20:10:25Z | **1** → merged |
| #923 | `agenticos-developer` 20:12:22Z | `agenticos-developer[bot]` 20:15:45Z | **1** → merged |
| #933 | `agenticos-developer` 20:26:05Z | `agenticos-developer[bot]` 20:31:54Z | **1** → merged |
| #900 | `EngineeringMoonBear` 19:04:58Z | `EngineeringMoonBear` 19:12:20Z | **1** → merged |

#921's twenty-minute gap is the load-bearing detail: arming happened *before*
the checks were green, GitHub did the waiting, and the enqueue it made twenty
minutes later still carried the arming identity. Every other agent PR in that
window shows the `github-actions[bot]` → 0 runs → manual rescue pattern; these
are the only ones that enqueued once and merged.

Confirmed deliberately on 2026-10-06, both entries in the same queue 68 seconds
apart:

| PR | enqueued by | group commit | `merge_group` runs | outcome |
| --- | --- | --- | --- | --- |
| #990 | `github-actions` 02:05:51Z | `ba3e3f57` | **0** | dead; rescued 02:10:04Z → merged 02:13:15Z |
| #987 | `agenticos-developer` (armed) 02:06:59Z | `d16f97f1` | **7** | merged 02:13:15Z |
| #991 | `agenticos-developer` (armed at open) | `4882806b` | **7** | merged 02:31:43Z, no rescue |

#991 — the PR that added the arming script — is the end-to-end proof. Armed as
the App at open time, 02:18:09Z; `agent-review/ada` went green 02:27:23Z;
`auto-approve.yml` approved as `github-actions[bot]` 02:27:36Z; the **armed**
auto-merge enqueued as the App and the merge group had **7 runs by 02:28:15Z**
(~39 s); merged 02:31:43Z with `merged_by = agenticos-developer[bot]`. The
arming preceded the enqueue by 9 minutes and the identity survived it.

### Doing it

The steady state is to arm the PR in the same breath as opening it, with the
broker token already in hand. The sweep script is the backstop and the
backlog drain:

```bash
scripts/ci/merge-queue-arm-automerge.sh              # dry run, lists decisions
scripts/ci/merge-queue-arm-automerge.sh --apply      # arm already-APPROVED agent PRs
ARM_UNAPPROVED=1 scripts/ci/merge-queue-arm-automerge.sh --apply   # steady state
REPO=Goldberry-Playground/odoocker-goldberrygrove scripts/ci/merge-queue-arm-automerge.sh --apply
```

**The default (approved-only) mode cannot be the steady state.** By the time
`auto-approve.yml` has approved a PR it has *already* performed the enqueue on
`GITHUB_TOKEN` — which is the wedge. Arming only helps if it happens **before**
approval, so anything automated has to run `ARM_UNAPPROVED=1`. The
approved-only default is for draining a backlog by hand and for the case where
the enqueue has not happened yet.

Auto-merge is allowed on all three repos and all three have a merge queue on
`main` (re-measured 2026-10-06 — note REST `GET /repos/...` omits
`allow_auto_merge` for a token without admin read, which reads as "disabled";
GraphQL `autoMergeAllowed` is authoritative).

The script **bypasses no gate**: auto-merge still requires every required review
and every required status check, including the protected-paths human review that
`auto-approve.yml` withholds its approval for. Arming decides *who* enqueues,
not *whether* the PR may merge.

Two guardrails worth knowing, both in
`scripts/ci/merge-queue-arm-automerge.test.mjs`:

- **It never arms a PR it did not author.** `auto-approve.yml` approves
  maintainer PRs but deliberately does not enqueue them, so the human keeps
  control over when their own PR merges. A dry run on 2026-10-06 would have
  armed #941 (`EngineeringMoonBear`'s, approved, checks still pending) before
  that rule existed.
- **It never re-arms a PR someone else armed**, which would mean disabling their
  auto-merge first and silently taking a merge decision from its owner.

### Pre-approval arming and protected paths

`ARM_UNAPPROVED=1` is a semantic no-op for almost every agent PR:
`auto-approve.yml` was going to approve and enqueue it anyway, so pre-arming
changes only the enqueuing identity. There is exactly **one** class where it is
not a no-op — an agent PR that touches a **protected path**. There
`auto-approve.yml` hard-withholds its approval and a human reviews by hand, and
pre-arming would make that human's approval *be* the merge rather than a
reviewer approving and someone then deciding to enqueue.

So `ARM_UNAPPROVED=1` **skips unapproved protected-path PRs.** It evaluates them
against the **target repo's own** base-branch
`scripts/ci/protected-paths-carveout.mjs` — the same definition
`auto-approve.yml` withholds on, and read from the base branch so a PR cannot
edit the carve-out to un-protect itself (the property `auto-approve.yml`
preserves by checking out base-branch scripts). All three repos ship that file
at the same path with their own `PROTECTED_GLOBS`, so a cross-repo sweep gets
each repo's real list rather than this one's.

That is what makes `ARM_UNAPPROVED=1` **safe to automate with no board decision
attached.** `ARM_PROTECTED=1` is the separate, explicit override for the
protected class — do not set it without the board's sign-off.

It is **fail-closed**: a carve-out it cannot fetch, a `node` it cannot run, or a
truncated changed-file list all skip the unapproved PR. An already-APPROVED PR
is unaffected by any of it — its approval already happened, so there is no
approval-timing semantics left to change.

Live dry run, grove-sites, 2026-10-06 02:32Z (`ARM_UNAPPROVED=1`, 13 open PRs):
7 unapproved PRs withheld for protected paths (`packages/checkout/**` ×3,
`.github/workflows/**` ×4) — exactly the set `auto-approve.yml` withholds on —
3 drafts and 2 non-agent authors skipped, 2 eligible.

⚠️ The `files` connection caps `first` at **100**, and asking for more trips
`EXCESSIVE_PAGINATION` — which GitHub returns as a **200 with an `errors` array**
and a nulled field, so `curl -f` does not catch it and a partial response reads
like real data. The first live run asked for 300 and got a null changed-file list
on every PR. Fail-closed held (nothing was wrongly armed) but silently, so the
sweep now logs GraphQL `errors` and treats a missing `repository` as fatal.

## Provisioning the App identity in Actions (optional — not recommended)

> **Not required.** The section above fixes this with no credential at all.
> `vars.MERGE_QUEUE_APP_CLIENT_ID` being unset is now a supported resting state,
> not a pending chore. Kept here because `auto-approve.yml` still honours the
> variables if they ever appear, and because the reasoning should not have to be
> rediscovered.

Why we chose not to: ADR-0001 keeps the App private key in `gh-token-broker`
alone — *"`gh-token-broker` holds one long-lived secret (the GitHub App private
key) and mints short-lived, repo-scoped tokens on demand. Agents never see the
root key"* — and `.github/workflows/README-preview.md` commits CI to reading
credentials from 1Password at runtime rather than storing them (*"no static
Spaces/CF/DO tokens live in GitHub secrets"*). `MERGE_QUEUE_APP_PRIVATE_KEY`
would be the first long-lived root credential in Actions secrets, in three
repos, to buy a capability the broker already gives away for free.

`REQUIRED_CHECKS_ADMIN_TOKEN` (present in all three repos) would also work as an
enqueue identity, and is likewise rejected: it is an elevated admin PAT scoped
for ruleset reconciliation, so routine enqueues under it are a least-privilege
regression, and it expires silently.

If it is ever provisioned anyway, adding Actions secrets/variables needs
repo-admin rights the ops service account does not have — **Josh / CEO must run
this.**

> **Status 2026-10-05 (GOL-2999):** still unprovisioned. `gh variable list` is
> empty for `grove-sites`, `grove-odoo-modules` and `odoocker-goldberrygrove`,
> and `MERGE_QUEUE_APP_PRIVATE_KEY` is absent from each repo's secrets, so the
> mint step is skipped and every agent merge still runs on `GITHUB_TOKEN`. Each
> stacked-PR merge therefore keeps re-gating its parent (second symptom above) —
> GOL-2999 was the latest instance and needed a manual close/reopen.

Use the existing agent App, `agenticos-developer` (it already authors the agent
PRs, and it is the identity proven in the A/B above). From the App's settings
page take its **Client ID** and **generate a private key** (`.pem`).

Installation permissions required: **Contents: Read and write** and **Pull
requests: Read and write** — the App already has these in these repos.

```bash
REPO=Goldberry-Playground/grove-sites
gh variable set MERGE_QUEUE_APP_CLIENT_ID    --repo "$REPO" --body '<APP_CLIENT_ID>'
gh secret   set MERGE_QUEUE_APP_PRIVATE_KEY --repo "$REPO" < /path/to/app-key.pem
```

The client ID is a variable, not a secret — it is not sensitive, and keeping it
a variable is what lets the workflow's `if:` skip the mint step cleanly when the
identity is not provisioned. The minted token is scoped in-workflow to Contents
+ Pull requests write only, so it carries less than the App's full installation. Org-level (`--org Goldberry-Playground --visibility
selected`) covers `grove-sites`, `grove-odoo-modules` and
`odoocker-goldberrygrove` in one step; all three carry the same defect.

Prefer the App over a fine-grained PAT here: PATs expire (max 1 year) and this
code path degrades **silently** back into the bug when they do.

## Verifying after provisioning

1. Merge any agent PR normally and watch the auto-approve run: it should log
   `Enqueued PR #N into the merge queue`, then `Merge group for PR #N has
   workflow runs`, and no wedge diagnosis.
2. Confirm the enqueuer is the App, not `github-actions`:
   ```bash
   gh api graphql -f query='{repository(owner:"Goldberry-Playground",name:"grove-sites"){
     mergeQueue(branch:"main"){entries(first:5){nodes{enqueuer{login} headCommit{oid} state}}}}}'
   ```
3. Confirm the merge-group commit gets runs within ~60 s:
   ```bash
   gh api "repos/$REPO/actions/runs?head_sha=<GROUP_COMMIT_OID>" -q '.total_count'   # expect > 0
   ```

## Rescue procedure (works today, with or without the fix)

Re-enqueue the PR under a non-`GITHUB_TOKEN` identity. This **bypasses no gate**
— it makes the required checks actually run, which the dead group never did.

```bash
NODE_ID=$(gh pr view <PR> --repo "$REPO" --json id -q .id)
gh api graphql -f query="mutation{dequeuePullRequest(input:{id:\"$NODE_ID\"}){mergeQueueEntry{state}}}"
gh api graphql -f query="mutation{enqueuePullRequest(input:{pullRequestId:\"$NODE_ID\"}){mergeQueueEntry{position state enqueuer{login}}}}"
```

Run this with an App installation token or a PAT — **not** `GITHUB_TOKEN`, and
not from inside a workflow using the default token, or you simply build another
dead group. Confirm `enqueuer.login` is not `github-actions`, then check that the
new group commit has a non-zero run count within ~60 s.

## Agent-side rescue (no human needed) — GOL-2790

The rescue above says "run this with an App installation token or a PAT" without
saying where an agent gets one, which is why GOL-2790 was first escalated to a
human as a broker permission gap. It is not a permission gap. **The
`gh-token-broker` App token already carries what the rescue needs on all three
repos**, verified against the live API on 2026-09-30:

| call | result | `x-accepted-github-permissions` |
| --- | --- | --- |
| `enqueuePullRequest` (GraphQL) | **200**, `enqueuer: agenticos-developer` | — |
| `POST /issues/{n}/comments` | **201** | `issues=write; pull_requests=write` |
| `POST /pulls/{n}/reviews` | **422** (payload rejected, auth passed) | `pull_requests=write` |
| `PUT /pulls/{n}/merge` | 405 `Changes must be made through the merge queue` | `contents=write` |

The one thing that genuinely does not work is `PUT /pulls/{n}/merge`: with a
merge queue on `main` a ruleset rejects it outright, so **the enqueue must go
through the GraphQL `enqueuePullRequest` mutation**, not the REST merge endpoint.
A 403 on that mutation means a stale or wrong-repo token, not a missing scope —
broker tokens live one hour.

Mint the token and run the sweep:

```bash
TOKEN=$(curl -fsS -H "Authorization: Bearer $(cat "$GH_BROKER_API_KEY_FILE")" \
  "$GH_TOKEN_BROKER_URL/token?owner=Goldberry-Playground&repo=grove-sites" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')
```

`scripts/ci/merge-queue-rescue.sh` does the whole sweep — mint, detect, rescue,
verify — and is **dry-run by default**:

```bash
scripts/ci/merge-queue-rescue.sh            # report what is wedged
scripts/ci/merge-queue-rescue.sh --apply    # rescue it
REPO=Goldberry-Playground/odoocker-goldberrygrove scripts/ci/merge-queue-rescue.sh --apply
```

It only touches an entry that is `AWAITING_CHECKS`, enqueued by
`github-actions`, past a 180 s grace window, **and** whose group commit really
has zero runs — and only when the PR is still `OPEN`, `APPROVED` and mergeable.
"Mergeable" here means `mergeStateStatus` in `CLEAN`, `HAS_HOOKS` or
**`UNSTABLE`**. `UNSTABLE` has to be in that set (GOL-2826): a PR cut from a
`main` whose *non-required* gate is red — a fresh CVE in `Dependency audit`, say
— reports `UNSTABLE` for as long as that red lasts, which is exactly the window
where the queue churns hardest and wedges are most likely. `DIRTY`, `BLOCKED`
and `UNKNOWN` stay out: those entries should not merge as they stand.
It then waits and re-checks that the new group actually has runs, because a
re-enqueue that builds another dead group is not a rescue. The selector's fire
and stay-quiet directions are both asserted by
`scripts/ci/merge-queue-rescue.test.mjs`, extracted from the script itself.

Never run it from a GitHub Actions job on the default `GITHUB_TOKEN` — that is
the wedging identity, so it would just build another dead group.

**GOL-2790 worked example (2026-09-30).** #893 was ejected unmerged at 15:52:23Z.
Three more agent PRs — #897, #894, #899 — were then sitting in the same queue,
all enqueued by `github-actions`, all `AWAITING_CHECKS`, all with **0** runs on
their group commits: one wedge silently stalls the whole queue behind it, so a
rescue should always sweep the queue rather than a single PR. All four were
dequeued and re-enqueued under the App at 17:40Z; every new group commit had
**7 `merge_group` runs within 60 s** — the same 7 the human-enqueued #871/#880/#884
got that morning — and all four merged by 17:44:19Z. Elapsed: under four minutes
for a queue that had been dead for two hours.

This is a mitigation, not the fix. It has to be run by hand after each wedge.
The fix is still provisioning the App identity above, which makes the wedge stop
happening.

**GOL-2826 worked example (2026-09-30, 20:08–20:23Z).** #918 was enqueued by
`github-actions` at 20:08:10Z; its group commit `ce1af237` never got a single
workflow run. Two App-enqueued entries behind it — #921 (the CVE fix that would
turn the `Dependency audit` gate green again) and #923 — were both `MERGEABLE`
with all 7 `merge_group` runs green, and were ~15 minutes from being ejected
with it. The sweep reported **"no wedged entries"**: #918's `mergeStateStatus`
was `UNSTABLE`, not `CLEAN`, because `main` itself was red on the non-required
audit gate. So the tool was blind precisely in the window it was written for —
one dead entry at the head of the queue holding the fix for the red gate that
caused the blindness. With `UNSTABLE` accepted, the sweep rescued #918 in 5
seconds (fresh group `ba36ff2f`, 7 runs within 45 s) and the queue reordered to
#921 → #923 → #918, all App-enqueued.

Cost of the blindness, for scale: while the queue sat dead, the CI-failure
router minted **four** ownerless duplicate issues for the same one red job
(grove-sites #925–#928, GOL-2826–GOL-2829) — one per speculative queue build —
each one waking a DevOps triage run.
