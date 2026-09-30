#!/usr/bin/env node
// Behavioral test for docker.yml's QA-redeploy triage (GOL-2601).
// Run: `node scripts/ci/qa-redeploy-teardown-tolerance.test.mjs`
//
// WHAT BROKE: the release train (GOL-2324) DESTROYS the whole QA tier at each
// teardown and re-provisions it at the next bring-up, so between trains there
// is no `grove-*-qa` App Platform app at all. The redeploy step read that as
// "app not found" and hard-failed, reddening `Docker — Frontends` on `main` for
// every merge in the gap and filing an ownerless CI-failure issue each time
// (run 36629928455, 2026-09-29: all 4 legs red, build + smoke + push green).
//
// THE CONTRACT this test pins, by running the workflow's OWN shell against a
// stubbed `doctl` — not a copy of it, so the test cannot drift from the YAML:
//
//   window CLOSED (no grove-*-qa app exists)  -> warn, exit 0, NO deploy call
//   window OPEN   (the app exists)            -> create-deployment is called
//   DRIFT (this app gone, siblings up)        -> ::error:: + exit 1  [GOL-397]
//
// The drift leg is the one that must never soften: it is the whole reason
// GOL-397 added this step, and a silently stale QA cost days on GOL-92.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const workflow = readFileSync(join(repoRoot, '.github/workflows/docker.yml'), 'utf8');

// ── Extract the step's `run:` block straight out of the workflow ─────────────
// Anchored on the step name so a rename is a loud failure here rather than a
// silently-vacuous test.
const STEP = '- name: Redeploy ${{ matrix.qa_app }} onto the new image';
const stepAt = workflow.indexOf(STEP);
assert.notEqual(stepAt, -1, `step not found in docker.yml: ${STEP}`);

const lines = workflow.slice(stepAt).split('\n');
const runAt = lines.findIndex((l) => l.trim() === 'run: |');
assert.notEqual(runAt, -1, 'no `run: |` block under the redeploy step');
const runIndent = lines[runAt].length - lines[runAt].trimStart().length;

const body = [];
for (const line of lines.slice(runAt + 1)) {
  const indent = line.length - line.trimStart().length;
  if (line.trim() !== '' && indent <= runIndent) break; // dedent = end of block
  body.push(line.slice(runIndent + 2));
}
const script = body.join('\n');
assert.match(script, /doctl apps list/, 'extracted the wrong block');
assert.match(script, /create-deployment/, 'extracted the wrong block');

// ── Harness: a `doctl` stub that serves a fixed app list and logs its calls ──
const APP = 'grove-nursery-qa';

function runStep(appList) {
  const dir = mkdtempSync(join(tmpdir(), 'qa-redeploy-'));
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  writeFileSync(join(dir, 'apps.txt'), appList);
  const calls = join(dir, 'calls.txt');
  // `doctl apps <verb> ...` — only `list` returns the app table; the deploy
  // verbs just record that they were reached, so a skip is distinguishable
  // from a deploy even though both exit 0.
  writeFileSync(
    join(bin, 'doctl'),
    ['#!/bin/bash', `echo "$*" >> ${JSON.stringify(calls)}`, 'case "$2" in',
      `  list) cat ${JSON.stringify(join(dir, 'apps.txt'))} ;;`,
      '  list-deployments) echo "dep-1  ACTIVE  now" ;;',
      '  *) ;;', 'esac', 'exit 0', ''].join('\n')
  );
  chmodSync(join(bin, 'doctl'), 0o755);

  let status = 0;
  let output = '';
  try {
    output = execFileSync('bash', ['-c', script], {
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, QA_APP: APP },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    status = err.status ?? 1;
    output = `${err.stdout ?? ''}${err.stderr ?? ''}`;
  }
  let calledDeploy = false;
  try {
    calledDeploy = /create-deployment/.test(readFileSync(calls, 'utf8'));
  } catch { /* doctl never ran */ }
  return { status, output, calledDeploy };
}

const PROD_ONLY = [ // the real `doctl apps list` shape, verified 2026-09-29
  'd5fa7795-da75-40e7-93fb-983e71558279    grove-hub-prod',
  'b9e0d2a6-6495-4dc7-a069-015b653c87e9    grove-nursery-prod',
  '3da0b924-85f6-4531-859f-699e03c3cd74    grove-goldberry-prod',
  '30c2a739-97d2-43bf-a6f8-dfff4a318bd8    grove-ggg-prod',
  '84000d56-6d80-44cb-b826-c28f8f4074e2    grove-discord-bridge',
  '78e04863-4bdd-4b59-a223-178ca15a1833    agenticos-dashboard',
].join('\n') + '\n';

const QA_UP = [
  'd5fa7795  grove-hub-prod',
  'aaaa1111  grove-hub-qa',
  'bbbb2222  grove-nursery-qa',
  'cccc3333  grove-goldberry-qa',
  'dddd4444  grove-ggg-qa',
].join('\n') + '\n';

const QA_PARTIAL = QA_UP.split('\n').filter((l) => !l.includes(APP)).join('\n');

// ── (1) Window closed: prod apps only. Warn, green, and deploy NOTHING ───────
let r = runStep(PROD_ONLY);
assert.equal(r.status, 0, `teardown gap must not red the job:\n${r.output}`);
assert.match(r.output, /::warning title=QA redeploy skipped::/);
assert.equal(r.calledDeploy, false, 'must not attempt a deploy with no QA app');

// Degenerate variant: the account lists no apps at all.
r = runStep('');
assert.equal(r.status, 0, `empty app list must not red the job:\n${r.output}`);
assert.equal(r.calledDeploy, false);

// ── (2) Window open: the app exists -> it really deploys ─────────────────────
r = runStep(QA_UP);
assert.equal(r.status, 0, `a present QA app must deploy cleanly:\n${r.output}`);
assert.equal(r.calledDeploy, true, 'an existing QA app MUST be redeployed');
assert.match(r.output, /Redeploying grove-nursery-qa \(bbbb2222\)/);

// ── (3) Drift: siblings up, this one gone -> still hard-fails (GOL-397) ──────
r = runStep(QA_PARTIAL);
assert.equal(r.status, 1, `partial QA tier is drift and must fail:\n${r.output}`);
assert.match(r.output, /::error::/);
assert.match(r.output, /other QA apps ARE up/);
assert.equal(r.calledDeploy, false);

// A name that never existed is drift too, as long as the tier is up.
assert.equal(runStep(QA_UP.replace(APP, 'grove-typo-qa')).status, 1);

console.log('qa-redeploy-teardown-tolerance: all assertions passed');
