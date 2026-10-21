#!/usr/bin/env node
// Behavioural test for scripts/prod-deploy-drift-check.py's handling of a
// truncated DigitalOcean response. Run:
//   node scripts/ci/prod-deploy-drift-incomplete-read.test.mjs
//
// WHY THIS EXISTS: on 2026-10-20 17:01Z DigitalOcean cut the chunked /v2/apps
// body mid-stream. urllib raised http.client.IncompleteRead, which is an
// HTTPException and NOT an OSError, so it slipped past main()'s except tuple,
// the script died with no drift report, and the workflow paged a MONITOR
// OUTAGE for a blip the next run did not see.
//
// Pinned here:
//   1. one truncated read, then a good one   -> _get retries, check runs, exit 0
//   2. truncated on both attempts            -> monitor_failure report, NOT a crash
//   3. an HTTP 401 (dead token)              -> no retry, monitor_failure report
//
// Same approach as prod-deploy-drift-rollout-aware.test.mjs: Node builtins
// only, the Python module driven in-process by a generated harness. This one
// stubs urllib.request.urlopen (one level below _get) so the retry itself is
// exercised. No credentials, no network.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const script = join(repoRoot, 'scripts', 'prod-deploy-drift-check.py');
const work = mkdtempSync(join(tmpdir(), 'drift-incomplete-'));

const DIG = 'sha256:0000000000000000000000000000000000000000000000000000000000000abc';

// sys.argv: script, report path, mode ("truncate:<n>" or "http401").
// "truncate:<n>" makes the first n reads of /v2/apps raise IncompleteRead.
const HARNESS = `
import importlib.util, io, json, sys, http.client, urllib.error

spec = importlib.util.spec_from_file_location("drift", sys.argv[1])
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

mode = sys.argv[3]
calls = {"apps": 0}
DIG = "${DIG}"
APPS = {"apps": [{
    "id": "app-1",
    "spec": {"name": "grove-nursery-prod",
             "services": [{"name": "nursery",
                           "image": {"registry_type": "GHCR", "registry": "goldberry-playground",
                                     "repository": "grove-nursery", "tag": "pinned"}}]},
    "active_deployment": {"phase": "ACTIVE",
                          "services": [{"name": "nursery", "source_image_digest": DIG}]},
}]}

class Resp:
    def __init__(self, body, truncate):
        self.body, self.truncate, self.headers = body, truncate, {}
    def read(self):
        if self.truncate:
            raise http.client.IncompleteRead(b"{", 100)
        return self.body
    def __enter__(self): return self
    def __exit__(self, *a): return False

def fake_urlopen(req, timeout=None):
    url = req.full_url
    if url.startswith("https://api.digitalocean.com/v2/apps") and "/deployments" not in url:
        calls["apps"] += 1
        if mode == "http401":
            raise urllib.error.HTTPError(url, 401, "Unauthorized", {}, io.BytesIO(b""))
        n = int(mode.split(":")[1])
        return Resp(json.dumps(APPS).encode(), calls["apps"] <= n)
    if "/deployments" in url:
        return Resp(json.dumps({"deployments": []}).encode(), False)
    raise AssertionError("unexpected URL: " + url)

mod.urllib.request.urlopen = fake_urlopen
mod.ghcr_digest = lambda owner, repo, ref, bearer: DIG

code = mod.main()
report = json.loads(open(sys.argv[2]).read())
print("@@RESULT@@" + json.dumps({"exit": code, "report": report, "apps_calls": calls["apps"]}))
`;
const harnessPath = join(work, 'harness.py');
writeFileSync(harnessPath, HARNESS);

let caseNum = 0;
function run(mode) {
  caseNum += 1;
  const reportPath = join(work, `report-${caseNum}.json`);
  const res = spawnSync('python3', [harnessPath, script, reportPath, mode], {
    encoding: 'utf8',
    env: {
      ...process.env,
      DIGITALOCEAN_TOKEN: 'stub-do-token',
      GHCR_TOKEN: 'stub-ghcr-token',
      APP_NAMES: 'grove-nursery-prod',
      DRIFT_REPORT_FILE: reportPath,
    },
  });
  assert.equal(res.status, 0, `harness crashed (an uncaught exception = no report = false MONITOR OUTAGE):\n${res.stdout}\n${res.stderr}`);
  const line = res.stdout.split('\n').find((l) => l.startsWith('@@RESULT@@'));
  assert.ok(line, `harness produced no result:\n${res.stdout}\n${res.stderr}`);
  return JSON.parse(line.slice('@@RESULT@@'.length));
}

// 1. A single truncated read is retried and the check proceeds normally.
{
  const r = run('truncate:1');
  assert.equal(r.apps_calls, 2, 'expected exactly one retry of /v2/apps');
  assert.equal(r.report.monitor_ok, true, `monitor should be healthy after a successful retry: ${JSON.stringify(r.report)}`);
  assert.equal(r.report.drift, false);
  assert.equal(r.exit, 0);
}

// 2. Truncated on both attempts: an honest monitor failure, never a crash.
{
  const r = run('truncate:2');
  assert.equal(r.apps_calls, 2, 'expected one retry, then give up');
  assert.equal(r.report.monitor_ok, false);
  assert.equal(r.report.drift, false, 'a truncated DO response is a monitor problem, not prod drift');
  assert.match(r.report.monitor_error, /Failed to list DigitalOcean apps/);
  assert.equal(r.exit, 1);
}

// 3. HTTP status errors are not retried: a dead token should fail on the first call.
{
  const r = run('http401');
  assert.equal(r.apps_calls, 1, 'a 401 must not be retried');
  assert.equal(r.report.monitor_ok, false);
  assert.equal(r.report.drift, false);
  assert.equal(r.exit, 1);
}

console.log('prod-deploy-drift-incomplete-read: 3 cases passed');
