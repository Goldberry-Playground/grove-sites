#!/usr/bin/env node
// Behavioural test for scripts/prod-credential-expiry-warn.py (GOL-3140).
//
// The properties that matter, all drawn from the 2026-10-03 -> 2026-10-05
// incident where a dead DIGITALOCEAN_TOKEN left prod monitoring blind for
// 2.6 days before anyone noticed:
//
//   1. NEVER FAILS THE RUN. An approaching expiry is a chore. Red is reserved
//      for "prod is drifted" and "the drift check is blind" (GOL-3138); making
//      a calendar reminder red would re-create the alarm fatigue that let the
//      real 401 hide inside 14 identical Discord posts.
//   2. WARNS EARLY, ONCE PER TIER. T-14 and T-3 each speak once; an unchanged
//      tier does not re-post inside its re-notify window. This decouples
//      Discord volume from the firing rate, the same property that makes
//      GOL-3135's event heartbeat safe.
//   3. INERT, NOT BROKEN, WHILE UNRECORDED. The ops 1Password SA is read-only
//      on Grove Prod (GOL-2526), so the date can only arrive by hand. Until it
//      does, the script must post nothing and still exit 0.
//   4. NEVER GUESSES A DATE. An unreadable or implausible value must not
//      become an alarm in either direction. An epoch-unit mix-up resolving to
//      1970 must not announce a healthy token as expired.
//   5. DOES NOT CLOBBER THE DRIFT ALARM'S STATE. It shares the drift-report
//      artifact and runs after prod-drift-alarm.py has written its `alarm`
//      block; losing that block would make the drift alarm re-post every run.
//
// Node builtins only (scripts/ is not a workspace); shells out to python3,
// which the `CI scripts` job's ubuntu-latest runner always has.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), '..',
  'prod-credential-expiry-warn.py');
const NOW = '2026-10-06T12:00:00Z';
let failures = 0;

function test(name, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'cred-expiry-'));
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

// Runs the script with `expires` recorded as `expires`, optionally against a
// prior run's report. Returns { code, stdout, payload, state }.
function run(dir, expires, { prior = null, state = null, env = {} } = {}) {
  const stateFile = join(dir, 'drift-report.json');
  const payloadFile = join(dir, 'payload.json');
  writeFileSync(stateFile, JSON.stringify(state ?? { apps: [] }));
  if (existsSync(payloadFile)) rmSync(payloadFile);

  const childEnv = {
    ...process.env,
    CREDENTIAL_EXPIRES: expires,
    STATE_FILE: stateFile,
    DISCORD_PAYLOAD_FILE: payloadFile,
    RUN_URL: 'https://example.invalid/run/1',
    NOW_OVERRIDE: NOW,
    // No webhook: the payload file is the dry-run sink, so no network call.
    DISCORD_OPS_WEBHOOK_URL: '',
    ...env,
  };
  if (prior) {
    const priorFile = join(dir, 'prior.json');
    writeFileSync(priorFile, JSON.stringify(prior));
    childEnv.PRIOR_STATE_FILE = priorFile;
  }

  const res = spawnSync('python3', [SCRIPT], { env: childEnv, encoding: 'utf8' });
  assert.equal(res.error, undefined, `spawn failed: ${res.error}`);
  return {
    code: res.status,
    stdout: res.stdout,
    payload: existsSync(payloadFile) ? JSON.parse(readFileSync(payloadFile, 'utf8')) : null,
    state: JSON.parse(readFileSync(stateFile, 'utf8')).credential_expiry,
  };
}

// `days` out from NOW, as a date-only string the way 1Password would show it.
function plusDays(days) {
  const d = new Date(Date.parse(NOW) + days * 86400000);
  return d.toISOString().slice(0, 10);
}

// --- 1. never fails the run -------------------------------------------------

test('an expiring credential never fails the run', (dir) => {
  for (const d of [-30, 0, 1, 2, 10, 13, 400]) {
    const r = run(dir, plusDays(d));
    assert.equal(r.code, 0,
      `exit ${r.code} at T${d >= 0 ? '+' : ''}${d} — an expiry chore must never go red`);
  }
});

// --- 2. warns early, once per tier -----------------------------------------

test('T-14 produces a WARN before the credential dies', (dir) => {
  const r = run(dir, plusDays(10));
  assert.equal(r.state.tier, 'WARN');
  assert.ok(r.payload, 'a credential nearing expiry must warn BEFORE it dies');
  assert.match(r.payload.embeds[0].title, /warn/i);
});

test('T-3 escalates to URGENT', (dir) => {
  const r = run(dir, plusDays(2));
  assert.equal(r.state.tier, 'URGENT');
  assert.match(r.payload.embeds[0].title, /urgent/i);
});

test('a passed expiry is EXPIRED and names the blast radius', (dir) => {
  const r = run(dir, plusDays(-2));
  assert.equal(r.state.tier, 'EXPIRED');
  assert.match(r.payload.embeds[0].description, /BLIND|preview-droplet/,
    'an already-dead key must say what it broke');
});

test('a far-off expiry stays QUIET — no Discord, no state carried', (dir) => {
  const r = run(dir, plusDays(60));
  assert.equal(r.state.tier, 'QUIET');
  assert.equal(r.payload, null, 'a healthy credential must not be announced');
  assert.equal(r.state.last_posted_at, null,
    'a rotated credential must be able to warn again on its next approach');
});

test('every message echoes the resolved date, so a misparse is visible', (dir) => {
  const r = run(dir, plusDays(10));
  assert.ok(r.payload.embeds[0].description.includes(plusDays(10)),
    'the resolved date must appear verbatim — it is the only check on the parser');
});

test('an unchanged tier does not re-post inside its re-notify window', (dir) => {
  const prior = {
    credential_expiry: {
      tier: 'WARN',
      last_posted_at: '2026-10-06T06:00:00Z', // 6h ago, window is 168h
    },
  };
  const r = run(dir, plusDays(10), { prior });
  assert.equal(r.code, 0);
  assert.equal(r.payload, null, 'the same WARN must not repeat every firing');
  assert.equal(r.state.last_posted_at, '2026-10-06T06:00:00Z',
    'the suppressed run must carry the original post time forward');
});

test('a tier CHANGE always speaks, however recently we posted', (dir) => {
  const prior = {
    credential_expiry: { tier: 'WARN', last_posted_at: '2026-10-06T11:00:00Z' },
  };
  const r = run(dir, plusDays(2), { prior });
  assert.ok(r.payload, 'WARN -> URGENT is new information and must not be deduped');
  assert.equal(r.state.tier, 'URGENT');
});

test('an unchanged tier re-states itself once its window has elapsed', (dir) => {
  const prior = {
    credential_expiry: { tier: 'URGENT', last_posted_at: '2026-10-05T06:00:00Z' },
  };
  const r = run(dir, plusDays(2), { prior }); // 30h ago, URGENT window is 24h
  assert.ok(r.payload, 'a still-unrotated URGENT credential must nag again');
  assert.match(r.payload.embeds[0].footer.text, /unchanged for 30\.0h/);
});

test('no prior report (first run / expired artifact) fails OPEN and posts', (dir) => {
  const r = run(dir, plusDays(2), { env: { PRIOR_STATE_FILE: '/nonexistent/x.json' } });
  assert.ok(r.payload, 'missing dedupe state must never swallow a rotation warning');
});

// --- 3. inert while unrecorded ---------------------------------------------

test('an empty expires field is inert, not broken', (dir) => {
  const r = run(dir, '');
  assert.equal(r.code, 0);
  assert.equal(r.payload, null, 'an unrecorded expiry must not post anything');
  assert.equal(r.state.tier, 'UNRECORDED');
  assert.match(r.stdout, /::notice/, 'it must still say the date is missing');
  assert.match(r.stdout, /EngineeringMoonBear/, 'and name who can fix it');
});

test('whitespace-only expires is treated as empty, not as a bad date', (dir) => {
  const r = run(dir, '   ');
  assert.equal(r.state.tier, 'UNRECORDED');
});

// --- 4. never guesses a date -----------------------------------------------

test('the tolerated date renderings all resolve to the same day', (dir) => {
  // 1Password stores DATE fields as an epoch and renders per locale; the live
  // field is empty so the exact string could not be observed. Each of these is
  // 2026-10-16, i.e. T-10 from NOW -> WARN.
  for (const raw of ['2026-10-16', '2026/10/16', '10/16/2026', '16/10/2026',
                     '2026-10-16T23:59:59Z', 'October 16, 2026', 'Oct 16, 2026',
                     '16 October 2026']) {
    const r = run(dir, raw);
    assert.equal(r.state.tier, 'WARN', `${raw} should resolve to T-10 (WARN)`);
    assert.ok(r.state.expires_at.startsWith('2026-10-16'),
      `${raw} resolved to ${r.state.expires_at}`);
  }
});

test('an epoch is accepted in seconds and in millis', (dir) => {
  const secs = Math.floor(Date.parse('2026-10-16T23:59:59Z') / 1000);
  for (const raw of [String(secs), `${secs}.000`, String(secs * 1000)]) {
    const r = run(dir, raw);
    assert.ok(r.state.expires_at && r.state.expires_at.startsWith('2026-10-16'),
      `epoch ${raw} resolved to ${r.state.expires_at}`);
  }
});

test('a date-only expiry survives its whole last day', (dir) => {
  // Recorded as expiring today. Midnight-rounding would call it expired at
  // 00:00 and warn a day early; it is alive until the day is out.
  const r = run(dir, plusDays(0));
  assert.equal(r.state.tier, 'URGENT');
  assert.notEqual(r.state.tier, 'EXPIRED', 'the last day is not over yet');
});

test('an implausible date is refused, not believed', (dir) => {
  // The 1970 case: epoch millis mistakenly read as epoch seconds. Believing it
  // would announce a perfectly healthy token as long dead.
  for (const raw of ['1970-01-01', 'next tuesday', '2026-13-45', 'tomorrow', '12']) {
    const r = run(dir, raw);
    assert.equal(r.code, 0, `${raw} must not fail the run`);
    assert.equal(r.payload, null, `${raw} must not be alarmed on a guess`);
    assert.equal(r.state.tier, 'UNREADABLE', `${raw} should be UNREADABLE`);
  }
});

test('an unreadable date warns in the log and quotes what it got', (dir) => {
  const r = run(dir, 'next tuesday');
  assert.match(r.stdout, /::warning/);
  assert.match(r.stdout, /next tuesday/, 'quote the bad value so it can be fixed');
});

// --- 5. shares the artifact without clobbering it --------------------------

test('writing our block preserves the drift alarm dedupe state', (dir) => {
  const alarm = { key: 'abc123', posted: true, last_posted_at: '2026-10-06T09:00:00Z' };
  const stateFile = join(dir, 'drift-report.json');
  const r = run(dir, plusDays(2), { state: { apps: [{ app: 'x' }], alarm } });
  assert.equal(r.code, 0);
  const full = JSON.parse(readFileSync(stateFile, 'utf8'));
  assert.deepEqual(full.alarm, alarm,
    'clobbering `alarm` would make the drift alarm re-post on every firing');
  assert.equal(full.apps.length, 1, 'the drift rows must survive too');
  assert.ok(full.credential_expiry, 'and our own block must be there');
});

test('a missing/corrupt state file does not crash the step', (dir) => {
  const stateFile = join(dir, 'drift-report.json');
  writeFileSync(stateFile, 'not json at all');
  const res = spawnSync('python3', [SCRIPT], {
    env: {
      ...process.env,
      CREDENTIAL_EXPIRES: plusDays(2),
      STATE_FILE: stateFile,
      DISCORD_OPS_WEBHOOK_URL: '',
      NOW_OVERRIDE: NOW,
    },
    encoding: 'utf8',
  });
  assert.equal(res.status, 0, 'a bad report must not red the prod monitoring run');
  assert.ok(JSON.parse(readFileSync(stateFile, 'utf8')).credential_expiry);
});

test('custom WARN_DAYS / URGENT_DAYS thresholds are honoured', (dir) => {
  const r = run(dir, plusDays(20), { env: { WARN_DAYS: '30', URGENT_DAYS: '7' } });
  assert.equal(r.state.tier, 'WARN');
  const u = run(dir, plusDays(5), { env: { WARN_DAYS: '30', URGENT_DAYS: '7' } });
  assert.equal(u.state.tier, 'URGENT');
});

test('a garbage threshold falls back to the default instead of crashing', (dir) => {
  const r = run(dir, plusDays(10), { env: { WARN_DAYS: 'soon' } });
  assert.equal(r.code, 0);
  assert.equal(r.state.tier, 'WARN', 'default WARN_DAYS=14 still applies');
});

if (failures) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nall prod-credential-expiry-warn tests passed');
