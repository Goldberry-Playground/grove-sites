#!/usr/bin/env node
// Behavioural test for scripts/prod-drift-alarm.py (GOL-3138).
//
// Two regressions are load-bearing here, both drawn from the 2026-10-03 ->
// 2026-10-05 incident, where a dead DigitalOcean token produced 14 consecutive
// Discord posts that claimed prod was serving the wrong build:
//
//   1. A MONITOR failure must NEVER be worded as prod drift.
//   2. An UNCHANGED bad state must not re-post inside the re-notify window —
//      that is the property that makes GOL-3135's event heartbeat safe, since
//      it decouples Discord volume from the firing rate.
//
// Node builtins only (scripts/ is not a workspace); shells out to python3,
// which the `CI scripts` job's ubuntu-latest runner always has.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'prod-drift-alarm.py');
let failures = 0;

function test(name, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'drift-alarm-'));
  try {
    fn(dir);
    console.log(`  ok  ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`  FAIL ${name}\n       ${err.message}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Runs the alarm script against `report`, optionally with a prior run's report.
// Returns { code, payload, report } — payload is null when nothing was posted.
function run(dir, report, { prior = null, env = {} } = {}) {
  const reportFile = join(dir, 'drift-report.json');
  const payloadFile = join(dir, 'payload.json');
  writeFileSync(reportFile, JSON.stringify(report));
  if (existsSync(payloadFile)) rmSync(payloadFile);

  const childEnv = {
    ...process.env,
    DRIFT_REPORT_FILE: reportFile,
    DISCORD_PAYLOAD_FILE: payloadFile,
    RUN_URL: 'https://example.invalid/run/1',
    // No DISCORD_OPS_WEBHOOK_URL: the payload file is the dry-run sink, so the
    // test never makes a network call.
    DISCORD_OPS_WEBHOOK_URL: '',
    ...env,
  };
  if (prior) {
    const priorFile = join(dir, 'prior.json');
    writeFileSync(priorFile, JSON.stringify(prior));
    childEnv.PRIOR_REPORT_FILE = priorFile;
  }

  const res = spawnSync('python3', [SCRIPT], { env: childEnv, encoding: 'utf8' });
  assert.equal(res.error, undefined, `spawn failed: ${res.error}`);
  return {
    code: res.status,
    stdout: res.stdout,
    payload: existsSync(payloadFile) ? JSON.parse(readFileSync(payloadFile, 'utf8')) : null,
    report: JSON.parse(readFileSync(reportFile, 'utf8')),
  };
}

const okReport = {
  drift: false,
  monitor_ok: true,
  apps: [
    { app: 'grove-hub-prod', status: 'OK', serving: 'sha256:aaa', intended: 'sha256:aaa' },
    { app: 'grove-ggg-prod', status: 'SKIPPED', detail: 'registry_type=DOCR' },
  ],
};

// The exact shape the 2026-10-03 streak would now produce.
const monitorReport = {
  drift: false,
  monitor_ok: false,
  monitor_error: 'Failed to list DigitalOcean apps: HTTP Error 401: Unauthorized',
  apps: ['grove-goldberry-prod', 'grove-ggg-prod', 'grove-nursery-prod', 'grove-hub-prod'].map(
    (app) => ({
      app,
      status: 'MONITOR_ERROR',
      detail: 'Failed to list DigitalOcean apps: HTTP Error 401: Unauthorized',
    }),
  ),
};

const driftReport = {
  drift: true,
  monitor_ok: true,
  apps: [
    { app: 'grove-hub-prod', status: 'OK', serving: 'sha256:aaa', intended: 'sha256:aaa' },
    {
      app: 'grove-nursery-prod',
      status: 'DRIFT',
      serving: 'sha256:old',
      intended: 'sha256:new',
      detail: 'serving sha256:old… but tag now points at sha256:new…',
    },
  ],
};

const hoursAgo = (h) =>
  new Date(Date.now() - h * 3600 * 1000).toISOString().replace(/\.\d+Z$/, 'Z');

console.log('prod-drift-alarm.py');

test('all-OK report: exit 0, nothing posted', (dir) => {
  const r = run(dir, okReport);
  assert.equal(r.code, 0);
  assert.equal(r.payload, null, 'must not post when nothing is wrong');
  assert.equal(r.report.alarm.key, null);
});

test('a healthy in-flight rollout (ROLLING_OUT) is benign', (dir) => {
  const r = run(dir, {
    drift: false,
    monitor_ok: true,
    apps: [{ app: 'grove-hub-prod', status: 'ROLLING_OUT', detail: 'rollout 2m old' }],
  });
  assert.equal(r.code, 0, 'GOL-3135: a fresh rollout must not alarm');
  assert.equal(r.payload, null);
});

test('monitor failure is NOT worded as prod drift', (dir) => {
  const r = run(dir, monitorReport);
  assert.equal(r.code, 1, 'a blind checker must still fail the run');
  assert.ok(r.payload, 'first sighting must post');
  const embed = r.payload.embeds[0];
  assert.match(embed.title, /BLIND|NOT being watched/,
    `monitor outage must say the check is blind, got: ${embed.title}`);
  assert.doesNotMatch(embed.title, /serving build != pinned build/,
    'the GOL-3138 regression: a dead DO token reported as prod drift');
  assert.doesNotMatch(embed.description, /Redeploy with/,
    'must not tell the operator to redeploy when prod is fine');
  assert.ok(/DIGITALOCEAN_TOKEN/.test(embed.description),
    'should name the credential that is usually at fault');
  assert.equal(r.report.alarm.kind, 'monitor');
  assert.equal(r.report.alarm.posted, true);
});

test('real drift keeps the original prod-drift wording and lists only bad apps', (dir) => {
  const r = run(dir, driftReport);
  assert.equal(r.code, 1);
  const embed = r.payload.embeds[0];
  assert.match(embed.title, /serving build != pinned build/);
  assert.equal(r.report.alarm.kind, 'prod');
  assert.deepEqual(embed.fields.map((f) => f.name), ['grove-nursery-prod'],
    'an OK app must not be listed next to a drifted one');
});

test('unchanged state inside the re-notify window does NOT re-post (run stays red)', (dir) => {
  const first = run(dir, monitorReport);
  const r = run(dir, monitorReport, {
    prior: first.report,
    env: { RENOTIFY_HOURS: '24' },
  });
  assert.equal(r.code, 1, 'suppression must silence Discord only, never CI');
  assert.equal(r.payload, null, 'same fingerprint within the window must be suppressed');
  assert.match(r.stdout, /suppressed/);
  assert.equal(r.report.alarm.key, first.report.alarm.key);
  assert.equal(r.report.alarm.last_posted_at, first.report.alarm.last_posted_at,
    'last_posted_at must carry forward or the next run re-alarms');
});

test('unchanged state re-posts once the re-notify window elapses', (dir) => {
  const prior = {
    ...monitorReport,
    alarm: {
      key: run(dir, monitorReport).report.alarm.key,
      posted: true,
      kind: 'monitor',
      last_posted_at: hoursAgo(30),
    },
  };
  const r = run(dir, monitorReport, { prior, env: { RENOTIFY_HOURS: '24' } });
  assert.equal(r.code, 1);
  assert.ok(r.payload, 'a stale unchanged outage must be re-notified');
  assert.match(r.payload.embeds[0].footer.text, /unchanged for 30\.0h/);
});

test('a CHANGED state posts immediately, even inside the window', (dir) => {
  const first = run(dir, monitorReport);
  const r = run(dir, driftReport, { prior: first.report, env: { RENOTIFY_HOURS: '24' } });
  assert.equal(r.code, 1);
  assert.ok(r.payload, 'a different problem is new information — never suppress it');
  assert.match(r.payload.embeds[0].title, /serving build != pinned build/);
});

test('no prior report (first run / expired artifact) fails OPEN and posts', (dir) => {
  const r = run(dir, monitorReport, { env: { PRIOR_REPORT_FILE: '/nonexistent/x.json' } });
  assert.equal(r.code, 1);
  assert.ok(r.payload, 'missing dedupe state must never swallow an alarm');
});

test('missing report + a failed checker is a monitor outage, not silence', (dir) => {
  const reportFile = join(dir, 'drift-report.json');
  const payloadFile = join(dir, 'payload.json');
  const res = spawnSync('python3', [SCRIPT], {
    env: {
      ...process.env,
      DRIFT_REPORT_FILE: reportFile,
      DISCORD_PAYLOAD_FILE: payloadFile,
      DISCORD_OPS_WEBHOOK_URL: '',
      CHECK_OUTCOME: 'failure',
    },
    encoding: 'utf8',
  });
  assert.equal(res.status, 1, 'a red checker with no report must not exit 0');
  const payload = JSON.parse(readFileSync(payloadFile, 'utf8'));
  assert.match(payload.embeds[0].title, /BLIND|NOT being watched/);
});

test('a drifted report whose rows vanish but exit is red still alarms', (dir) => {
  const r = run(dir, { drift: true, monitor_ok: true, apps: [] },
    { env: { CHECK_OUTCOME: 'failure' } });
  assert.equal(r.code, 1);
  assert.ok(r.payload);
  assert.match(r.payload.embeds[0].title, /BLIND|NOT being watched/,
    'an unexplained red is a monitor problem, not a fabricated prod incident');
});

if (failures) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nall prod-drift-alarm tests passed');
