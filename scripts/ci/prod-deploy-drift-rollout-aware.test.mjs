#!/usr/bin/env node
// Behavioural test for scripts/prod-deploy-drift-check.py's rollout awareness
// (GOL-3135). Run: `node scripts/ci/prod-deploy-drift-rollout-aware.test.mjs`
//
// WHY THIS EXISTS: the drift check compares the digest prod is SERVING against
// the digest its pinned tag resolves to, and originally called any mismatch
// DRIFT -> red run + Discord ops alarm on Josh's phone. But "serving != pinned"
// is also the exact state of a perfectly healthy rollout: the tag moves first,
// and `active_deployment` keeps serving the old digest (phase ACTIVE) until the
// new deployment in `in_progress_deployment` finishes. So the check alarmed on
// any deploy it happened to poll mid-flight.
//
// That was survivable only by accident: GitHub throttles `schedule` to ~5
// firings/day whatever the cron says (GOL-3132), so a `*/30` check rarely
// landed inside a ~10-20 min rollout. The parent ticket's fix for the other two
// cron guards is an event trigger, and for THIS workflow an event trigger
// multiplies exactly this false alarm -- `workflow_run: [Docker — Frontends]`
// would fire at the one moment a rollout is guaranteed in flight. Hence: teach
// the check about rollouts FIRST, then the free event heartbeat is safe.
//
// The two properties that must both hold, forever, are in tension, and this
// file pins both so neither can be "fixed" into the other:
//   1. a healthy in-flight rollout is NOT drift          -> exit 0, no alarm
//   2. a rollout WEDGED in flight IS drift               -> exit 1, alarm
// (2) is the GOL-1607 failure mode wearing a disguise: prod served a stale
// build for hours because a moved tag never rolled out. A grace window with no
// upper bound would re-open that hole while looking like a bug fix.
//
// The untouched classifications (UNHEALTHY / UNKNOWN / OK / GHCR_ERROR) are
// asserted too, because the cheapest way to break this alarm is to refactor the
// mismatch branch and take an unrelated branch with it.
//
// Node builtins only (`scripts/` is not a workspace), and the Python module is
// driven in-process by a generated harness that stubs its two network calls --
// no DigitalOcean or GHCR credentials, no network.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const script = join(repoRoot, 'scripts', 'prod-deploy-drift-check.py');
const work = mkdtempSync(join(tmpdir(), 'drift-rollout-'));

const DIG_OLD = 'sha256:0000000000000000000000000000000000000000000000000000000000000old';
const DIG_NEW = 'sha256:1111111111111111111111111111111111111111111111111111111111111new';
const DIG_OTHER = 'sha256:2222222222222222222222222222222222222222222222222222222222222oth';

// A Python harness: import the checker, stub `_get` (DigitalOcean) and
// `ghcr_digest` (registry), run main(), report the exit code + JSON report.
// `created_at` is computed from a relative age so no clock has to be frozen.
const HARNESS = `
import importlib.util, json, sys, datetime

spec = importlib.util.spec_from_file_location("drift", sys.argv[1])
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

sc = json.loads(open(sys.argv[2]).read())
now = datetime.datetime.now(datetime.timezone.utc)

def stamp(age):
    if age is None:
        return None
    return (now - datetime.timedelta(minutes=age)).isoformat().replace("+00:00", "Z")

# Materialise relative ages into RFC-3339 created_at values.
for app in sc["apps"]:
    for key in ("in_progress_deployment", "active_deployment"):
        dep = app.get(key)
        if isinstance(dep, dict) and "age_minutes" in dep:
            age = dep.pop("age_minutes")
            if age is not None:
                dep["created_at"] = stamp(age)
for deps in (sc.get("deployments") or {}).values():
    for dep in deps:
        if "age_minutes" in dep:
            age = dep.pop("age_minutes")
            if age is not None:
                dep["created_at"] = stamp(age)

def fake_get(url, headers, want_header=None):
    if "/deployments" in url:
        app_id = url.split("/apps/")[1].split("/")[0]
        return {"deployments": (sc.get("deployments") or {}).get(app_id, [])}
    if url.startswith("https://api.digitalocean.com/v2/apps"):
        return {"apps": sc["apps"]}
    raise AssertionError("unexpected URL: " + url)

mod._get = fake_get

if sc.get("ghcr_error"):
    def boom(*a, **k):
        raise mod.urllib.error.URLError("stubbed GHCR outage")
    mod.ghcr_digest = boom
else:
    mod.ghcr_digest = lambda owner, repo, ref, bearer: sc["intended"]

code = mod.main()
report = json.loads(open(sys.argv[3]).read())
print("@@RESULT@@" + json.dumps({"exit": code, "report": report}))
`;
const harnessPath = join(work, 'harness.py');
writeFileSync(harnessPath, HARNESS);

let caseNum = 0;
/** Run the checker against one stubbed world; return {exit, report}. */
function run(scenario, env = {}) {
  caseNum += 1;
  const scPath = join(work, `sc-${caseNum}.json`);
  const reportPath = join(work, `report-${caseNum}.json`);
  writeFileSync(scPath, JSON.stringify(scenario));
  const res = spawnSync('python3', [harnessPath, script, scPath, reportPath], {
    encoding: 'utf8',
    env: {
      ...process.env,
      DIGITALOCEAN_TOKEN: 'stub-do-token',
      GHCR_TOKEN: 'stub-ghcr-token',
      APP_NAMES: scenario.apps.map((a) => a.spec.name).join(' '),
      DRIFT_REPORT_FILE: reportPath,
      ...env,
    },
  });
  assert.equal(res.status, 0, `harness crashed:\n${res.stdout}\n${res.stderr}`);
  const line = res.stdout.split('\n').find((l) => l.startsWith('@@RESULT@@'));
  assert.ok(line, `harness produced no result:\n${res.stdout}\n${res.stderr}`);
  return JSON.parse(line.slice('@@RESULT@@'.length));
}

/** One GHCR-sourced prod app, serving `serving`, with an optional rollout. */
function app({ name = 'grove-nursery-prod', serving = DIG_OLD, phase = 'ACTIVE',
               inProgress = undefined, omitInProgressKey = false } = {}) {
  const a = {
    id: `app-${name}`,
    spec: {
      name,
      services: [{
        image: {
          registry_type: 'GHCR', registry: 'goldberry-playground',
          repository: 'grove-nursery', tag: 'latest',
        },
      }],
    },
    active_deployment: {
      id: `dep-active-${name}`, phase,
      services: serving ? [{ source_image_digest: serving }] : [],
    },
  };
  if (!omitInProgressKey) a.in_progress_deployment = inProgress ?? null;
  return a;
}

/** A deployment that is rolling out `digest`, `age` minutes in. */
const rollout = (phase, age, digest) => ({
  id: 'dep-inflight', phase, age_minutes: age,
  services: digest ? [{ source_image_digest: digest }] : [],
});

const only = (r) => {
  assert.equal(r.report.apps.length, 1);
  return r.report.apps[0];
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. THE FIX: a healthy in-flight rollout is not drift.
//    Tag already moved to DIG_NEW; active_deployment still ACTIVE on DIG_OLD;
//    the new deployment is 3 min into DEPLOYING. Pre-GOL-3135 this was DRIFT.
// ─────────────────────────────────────────────────────────────────────────────
{
  const r = run({
    intended: DIG_NEW,
    apps: [app({ inProgress: rollout('DEPLOYING', 3, DIG_NEW) })],
  });
  const e = only(r);
  assert.equal(e.status, 'ROLLING_OUT', 'healthy mid-rollout must not be DRIFT');
  assert.equal(r.report.drift, false, 'a healthy rollout must not set drift');
  assert.equal(r.exit, 0, 'a healthy rollout must exit 0 — no red run, no Discord');
  assert.equal(e.rollout_phase, 'DEPLOYING');
  assert.equal(e.rollout_age_minutes, 3, 'age is reported so the real distribution is measurable');
}

// Every in-flight phase counts, not just DEPLOYING. These four are the SSOT set
// from scripts/lib/do-app-redeploy.sh; if the two files drift apart, this check
// alarms on a rollout that helper is deliberately waiting out.
for (const phase of ['PENDING_BUILD', 'BUILDING', 'PENDING_DEPLOY', 'DEPLOYING']) {
  const r = run({
    intended: DIG_NEW,
    apps: [app({ inProgress: rollout(phase, 1, DIG_NEW) })],
  });
  assert.equal(only(r).status, 'ROLLING_OUT', `${phase} must count as in flight`);
  assert.equal(r.exit, 0, `${phase} must exit 0`);
}

// Earliest phases have no source_image_digest yet. Demanding one here would
// re-create the false alarm for the first minutes of EVERY deploy.
{
  const r = run({
    intended: DIG_NEW,
    apps: [app({ inProgress: rollout('BUILDING', 1, null) })],
  });
  assert.equal(only(r).status, 'ROLLING_OUT',
    'an unresolved target digest early in a rollout is normal, not drift');
  assert.equal(r.exit, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. THE GUARD: a rollout wedged past the grace window still alarms.
//    This is GOL-1607 in disguise — prod serving stale while a deploy hangs.
// ─────────────────────────────────────────────────────────────────────────────
{
  const r = run({
    intended: DIG_NEW,
    apps: [app({ inProgress: rollout('DEPLOYING', 45, DIG_NEW) })],
  });
  const e = only(r);
  assert.equal(e.status, 'ROLLING_OUT_STALE', 'a wedged rollout must stay loud');
  assert.equal(r.report.drift, true);
  assert.equal(r.exit, 1, 'a wedged rollout must go red and alarm');
  assert.match(e.detail, /GOL-1607/, 'the alarm must name the failure mode it is');
}

// The boundary is the documented default, and it is an env knob — so the
// threshold can be retuned from evidence without a code change.
{
  assert.equal(only(run({
    intended: DIG_NEW,
    apps: [app({ inProgress: rollout('DEPLOYING', 19, DIG_NEW) })],
  })).status, 'ROLLING_OUT', '19 min must be inside the 20 min default');

  assert.equal(only(run({
    intended: DIG_NEW,
    apps: [app({ inProgress: rollout('DEPLOYING', 21, DIG_NEW) })],
  })).status, 'ROLLING_OUT_STALE', '21 min must be outside the 20 min default');

  const r = run({
    intended: DIG_NEW,
    apps: [app({ inProgress: rollout('DEPLOYING', 8, DIG_NEW) })],
  }, { ROLLOUT_GRACE_MINUTES: '5' });
  assert.equal(only(r).status, 'ROLLING_OUT_STALE', 'the grace window must be overridable');
  assert.equal(r.report.rollout_grace_minutes, 5,
    'the report must record the window actually applied');
}

// A garbage override must fall back to the default, not to "no bound at all".
{
  const r = run({
    intended: DIG_NEW,
    apps: [app({ inProgress: rollout('DEPLOYING', 45, DIG_NEW) })],
  }, { ROLLOUT_GRACE_MINUTES: 'twenty' });
  assert.equal(r.report.rollout_grace_minutes, 20);
  assert.equal(only(r).status, 'ROLLING_OUT_STALE', 'a bad override must not disable the bound');
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. UNCHANGED: a mismatch with nothing in flight is still plain DRIFT.
//    This is the original GOL-1600 alarm and the reason the file exists.
// ─────────────────────────────────────────────────────────────────────────────
{
  const r = run({ intended: DIG_NEW, apps: [app({ inProgress: null })] });
  const e = only(r);
  assert.equal(e.status, 'DRIFT', 'pin moved with no rollout behind it is DRIFT');
  assert.equal(r.exit, 1);
  assert.match(e.detail, /pin moved without a deploy/);
}

// A deployment in a TERMINAL phase is not "in flight" and must not excuse the
// mismatch — an ERRORed or SUPERSEDED rollout left prod stale, which is drift.
for (const phase of ['ERROR', 'CANCELED', 'SUPERSEDED', 'ACTIVE']) {
  const r = run({
    intended: DIG_NEW,
    apps: [app({ inProgress: rollout(phase, 2, DIG_NEW) })],
  });
  assert.equal(only(r).status, 'DRIFT', `a ${phase} deployment must not excuse drift`);
  assert.equal(r.exit, 1, `a ${phase} deployment must still alarm`);
}

// Something rolling out, but NOT what the pin now names: the pin moved after
// that rollout started, so it will land stale. Still drift.
{
  const r = run({
    intended: DIG_NEW,
    apps: [app({ inProgress: rollout('DEPLOYING', 2, DIG_OTHER) })],
  });
  const e = only(r);
  assert.equal(e.status, 'DRIFT');
  assert.equal(r.exit, 1);
  assert.match(e.detail, /targets/, 'the alarm must say it is rolling out the wrong digest');
}

// An in-flight rollout we cannot age must stay loud rather than be assumed
// healthy — an unbounded "rolling out" is indistinguishable from wedged.
{
  const r = run({
    intended: DIG_NEW,
    apps: [app({ inProgress: { id: 'd', phase: 'DEPLOYING', services: [] } })],
  });
  assert.equal(only(r).status, 'DRIFT', 'an unageable rollout must not be assumed healthy');
  assert.equal(r.exit, 1);
}

// Fallback: if the apps payload omits `in_progress_deployment` entirely, the fix
// must not silently evaporate. We probe the deployments endpoint instead, the
// same way do-app-redeploy.sh's Lesson-2 guard does.
{
  const r = run({
    intended: DIG_NEW,
    apps: [app({ omitInProgressKey: true })],
    deployments: {
      'app-grove-nursery-prod': [
        { id: 'old', phase: 'SUPERSEDED', age_minutes: 600, services: [] },
        { id: 'new', phase: 'BUILDING', age_minutes: 2,
          services: [{ source_image_digest: DIG_NEW }] },
      ],
    },
  });
  assert.equal(only(r).status, 'ROLLING_OUT',
    'with the field absent, the deployments endpoint must still find the rollout');
  assert.equal(r.exit, 0);
}

// ...and that fallback must not invent a rollout that is not there.
{
  const r = run({
    intended: DIG_NEW,
    apps: [app({ omitInProgressKey: true })],
    deployments: {
      'app-grove-nursery-prod': [
        { id: 'old', phase: 'ACTIVE', age_minutes: 600, services: [] },
      ],
    },
  });
  assert.equal(only(r).status, 'DRIFT', 'no in-flight deployment means DRIFT');
  assert.equal(r.exit, 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. REGRESSION FENCE: the branches GOL-3135 did not touch.
// ─────────────────────────────────────────────────────────────────────────────

// OK: serving exactly the pin. No rollout fields, no behaviour change.
{
  const r = run({ intended: DIG_OLD, apps: [app({ serving: DIG_OLD })] });
  const e = only(r);
  assert.equal(e.status, 'OK');
  assert.equal(r.exit, 0);
  assert.ok(!('rollout_phase' in e), 'OK must not grow rollout fields');
}

// UNHEALTHY is still evaluated BEFORE the rollout logic: an app whose ACTIVE
// deployment is broken is broken even while a replacement builds. A grace
// window that swallowed this would hide a failed prod rollout.
{
  const r = run({
    intended: DIG_NEW,
    apps: [app({ phase: 'ERROR', inProgress: rollout('DEPLOYING', 2, DIG_NEW) })],
  });
  assert.equal(only(r).status, 'UNHEALTHY',
    'a broken active deployment outranks an in-flight rollout');
  assert.equal(r.exit, 1);
}

// UNKNOWN: active deployment with no digest at all, unchanged.
{
  const r = run({
    intended: DIG_NEW,
    apps: [app({ serving: null, inProgress: rollout('DEPLOYING', 2, DIG_NEW) })],
  });
  assert.equal(only(r).status, 'UNKNOWN');
  assert.equal(r.exit, 1);
}

// GHCR_ERROR: registry unreachable is still a hard error, not a rollout.
{
  const r = run({
    intended: DIG_NEW, ghcr_error: true,
    apps: [app({ inProgress: rollout('DEPLOYING', 2, DIG_NEW) })],
  });
  assert.equal(only(r).status, 'GHCR_ERROR');
  assert.equal(r.exit, 1);
}

// SKIPPED: a non-GHCR app is still out of scope for a digest comparison.
{
  const a = app();
  a.spec.services[0].image.registry_type = 'DOCR';
  const r = run({ intended: DIG_NEW, apps: [a] });
  assert.equal(only(r).status, 'SKIPPED');
  assert.equal(r.exit, 0);
}

// MISSING: a named app absent from the account, still drift.
{
  const r = run({ intended: DIG_NEW, apps: [app()] },
    { APP_NAMES: 'grove-nonexistent-prod' });
  assert.equal(only(r).status, 'MISSING');
  assert.equal(r.exit, 1);
}

// A real sweep is mixed: one app mid-rollout and one genuinely drifted must
// produce exit 1 for the drifted one WITHOUT the rollout being counted as drift.
{
  const r = run({
    intended: DIG_NEW,
    apps: [
      app({ name: 'grove-nursery-prod', inProgress: rollout('DEPLOYING', 3, DIG_NEW) }),
      app({ name: 'grove-hub-prod', inProgress: null }),
    ],
  });
  const byName = Object.fromEntries(r.report.apps.map((a) => [a.app, a.status]));
  assert.deepEqual(byName, {
    'grove-nursery-prod': 'ROLLING_OUT',
    'grove-hub-prod': 'DRIFT',
  });
  assert.equal(r.exit, 1, 'one real drift still fails the run');
}

console.log(`prod-deploy-drift rollout awareness: ${caseNum} scenarios OK`);
