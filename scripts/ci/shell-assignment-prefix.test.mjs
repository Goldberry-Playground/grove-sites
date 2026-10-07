#!/usr/bin/env node
// shell-assignment-prefix.test.mjs — the two shell traps GOL-3160 found, as a
// guard that runs where the scripts are AUTHORED instead of one repo
// downstream.
//
// Background: scripts/ci/merge-queue-arm-automerge.sh is carried in three
// repos (here, grove-odoo-modules, odoocker-goldberrygrove). Only odoocker
// ShellCheck-lints its scripts/ tree, so the defects below were authored here,
// shipped green here, and then surfaced as a red CI run in a repo one port
// downstream (GOL-3150, odoocker #857 / #861). This test closes that gap with
// node builtins only -- no ShellCheck binary on the runner required.
//
// Trap 1 (SC2097/SC2098) -- an assignment PREFIX whose later assignment
// expands a name assigned EARLIER in the same prefix list:
//
//   DECISIONS="$(APP_LOGIN="$APP_LOGIN" APP_AUTHOR_LOGIN="${APP_AUTHOR_LOGIN:-$APP_LOGIN}" python3 ...
//                ^ assigned here                                         ^ read here, but the
//                                                                          prefix list never
//                                                                          sees it
//
// The expansion resolves against the OUTER value, which here is also the
// intent -- so the fix is `env VAR=... cmd`, which states "scope these to the
// forked process" instead of suppressing the warning. Note the rule is
// specifically a CROSS-read: `NUM="$NUM" python3` on its own is not SC2097 and
// is not flagged (verified against ShellCheck 0.11.0).
//
// Trap 2 (SC1073/SC1072) -- ShellCheck parses ANY comment matching
// `# shellcheck...` as a DIRECTIVE. An English sentence that merely begins
// with the tool's name becomes a parse error that swallows the entire file, so
// a comment is only allowed to open with it when it is a real directive.
//
// node builtins only -- run by the `CI scripts` job (scripts/ci/*.test.mjs).

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const scriptsDir = join(repoRoot, "scripts");

function shFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...shFiles(p));
    else if (name.endsWith(".sh")) out.push(p);
  }
  return out;
}

// ── Trap 1: SC2097/SC2098 scanner ──────────────────────────────────────────
// Returns the prefix-list cross-reads on one line, or [] when there are none.
//
// Tokenising shell properly is out of scope; the scanner only has to recognise
// a RUN of `NAME=VALUE` tokens separated by nothing but whitespace. Command
// substitution and pipe openers (`VAR="$(`, `|`) are blanked first so they do
// not glue the outer assignment onto the first prefix token, and so that
// anything before a `|` cannot join a run that starts after it.
export function prefixCrossReads(line) {
  const flat = line.replace(/"\$\(|\$\(|[|]/g, " ");
  const tok = /([A-Za-z_][A-Za-z0-9_]*)=("(?:[^"\\]|\\.)*"|'[^']*'|[^\s"';|&]*)/g;

  const matches = [];
  let m;
  while ((m = tok.exec(flat)) !== null) {
    matches.push({ name: m[1], value: m[2], start: m.index, end: m.index + m[0].length });
  }

  // Group into runs: adjacent tokens separated only by whitespace.
  const runs = [];
  for (const t of matches) {
    const last = runs.length ? runs[runs.length - 1] : null;
    const prev = last ? last[last.length - 1] : null;
    if (prev && /^[ \t]+$/.test(flat.slice(prev.end, t.start))) last.push(t);
    else runs.push([t]);
  }

  const findings = [];
  for (const run of runs) {
    if (run.length < 2) continue; // a lone `NAME="$NAME" cmd` is not SC2097
    for (let k = 1; k < run.length; k++) {
      for (let j = 0; j < k; j++) {
        const earlier = run[j].name;
        if (earlier === run[k].name) continue; // self-reference is fine
        const reads = new RegExp(`\\$\\{?${earlier}\\b`).test(run[k].value);
        if (reads) findings.push({ assigned: earlier, readBy: run[k].name });
      }
    }
  }
  return findings;
}

// ── Trap 2: comment that ShellCheck will mis-parse as a directive ──────────
// A real directive is `# shellcheck <key>=<value>`; anything else opening with
// the tool's name in lower case is a parse error, not a comment.
const DIRECTIVE = /^\s*#\s*shellcheck\s+(disable|enable|source|source-path|shell|external-sources)=/;
export function isFakeDirective(line) {
  // No `\b` after the name: ShellCheck matches the lower-case prefix, so
  // `# shellchecks scripts/ ...` parses as a directive too (verified against
  // ShellCheck 0.11.0). A capital `# ShellCheck ...` is not matched and is the
  // recommended way to write the tool name in prose.
  return /^\s*#\s*shellcheck/.test(line) && !DIRECTIVE.test(line);
}

// ── Run ────────────────────────────────────────────────────────────────────
let failures = 0;
const files = shFiles(scriptsDir);
if (files.length === 0) {
  console.error("FAIL: no scripts/**/*.sh found — the scanner would pass vacuously.");
  process.exit(1);
}

for (const file of files) {
  const rel = relative(repoRoot, file);
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    const n = i + 1;
    for (const f of prefixCrossReads(line)) {
      failures++;
      console.error(
        `FAIL ${rel}:${n}: assignment prefix sets ${f.assigned}= and a later ` +
          `assignment (${f.readBy}=) expands it — SC2097/SC2098.\n` +
          `  The prefix list never sees that assignment; the expansion resolves ` +
          `against the OUTER value.\n` +
          `  If that is the intent, hoist it to its own line and fork with ` +
          `\`env ${f.assigned}=... cmd\`.\n` +
          `  ${line.trim().slice(0, 160)}`,
      );
    }
    if (isFakeDirective(line)) {
      failures++;
      console.error(
        `FAIL ${rel}:${n}: comment opens with \`# shellcheck\` but is not a ` +
          `directive — ShellCheck parses it as one and SC1073s on the rest of ` +
          `the sentence, which swallows the whole file.\n` +
          `  Reword so the line does not start with the tool name in lower case.\n` +
          `  ${line.trim().slice(0, 160)}`,
      );
    }
  });
  console.log(`  ok   ${rel}`);
}

// ── Self-test: the scanner must still catch the shapes it was written for ──
const mustFlag = [
  `DECISIONS="$(APP_LOGIN="$APP_LOGIN" APP_AUTHOR_LOGIN="\${APP_AUTHOR_LOGIN:-$APP_LOGIN}" GRAPH_JSON="$GRAPH" python3 <<'PYEOF'`,
  `A="$A" B="$A" cmd`,
];
const mustNotFlag = [
  `DECISIONS="$(env APP_LOGIN="$APP_LOGIN" APP_AUTHOR_LOGIN="$APP_AUTHOR_LOGIN" python3 <<'PYEOF'`,
  `OID="$(printf '%s' "$FRESH" | NUM="$NUM" python3 -c 'pass')"`,
  `WEDGED="$(GRACE="$GRACE_SECONDS" DEAD="$DEAD_ENQUEUER" ENTRIES_JSON="$ENTRIES" python3 <<'PYEOF'`,
  `GRAPH_ERRORS="$(GRAPH_JSON="$GRAPH" python3 -c '`,
];
for (const line of mustFlag) {
  if (prefixCrossReads(line).length === 0) {
    failures++;
    console.error(`FAIL self-test: scanner missed a known SC2097 shape: ${line.slice(0, 120)}`);
  }
}
for (const line of mustNotFlag) {
  const f = prefixCrossReads(line);
  if (f.length !== 0) {
    failures++;
    console.error(`FAIL self-test: scanner false-positived on: ${line.slice(0, 120)} -> ${JSON.stringify(f)}`);
  }
}
if (!isFakeDirective("# shellchecks scripts/ (grove-sites does not), so this went red")) {
  failures++;
  console.error("FAIL self-test: the SC1073 comment shape was not recognised.");
}
if (isFakeDirective("# shellcheck disable=SC2016  # GraphQL variables, not shell")) {
  failures++;
  console.error("FAIL self-test: a real directive was flagged as a fake one.");
}
console.log(`  ok   scanner self-test (${mustFlag.length} must-flag, ${mustNotFlag.length} must-not-flag)`);

if (failures) {
  console.error(`\n${failures} shell-assignment-prefix failure(s).`);
  process.exit(1);
}
console.log(`\nall ${files.length} shell script(s) clean.`);
