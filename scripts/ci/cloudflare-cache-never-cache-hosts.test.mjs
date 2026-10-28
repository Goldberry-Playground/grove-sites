#!/usr/bin/env node
// Regression test for the Tier-0 Cache Rules host bypass (grove-sites#1206).
//
// What it protects:
//   `grove-tier0-cache-rules` (infra/terraform/cloudflare) caches every anonymous
//   response on every PROXIED host in the zone. Its path bypass only knows the
//   storefront layout (/checkout|/account|/cart|/api/*), so the proxied Odoo host
//   fell into the cache-anonymous rule. On 2026-10-28 the first Odoo invoice with
//   Stripe (INV/2026/00001) was served from edge cache: a stale page with no
//   Stripe form, the old customer name, and an embedded session-bound CSRF token
//   that made Pay fail with "Session expired" for everyone else.
//
//   The invariant has two halves, and BOTH must hold:
//     1. the Odoo host is in the never-cache bypass (Rule 1), and
//     2. it is excluded from the anonymous cache rule (Rule 3).
//   Cache Rules do not stop at the first match — a later matching rule's
//   settings override an earlier one's — so a host that is bypassed in Rule 1
//   but still matched by Rule 3 is CACHED. Dropping either half regresses.
//
//   Static source checks only: there is no Terraform runtime in CI. The rendered
//   expressions are checked with `terraform console` during review.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "infra", "terraform", "cloudflare");
const read = (p) => readFileSync(join(root, p), "utf8");

const rootVars = read("variables.tf");
const zones = read("zones.tf");
const moduleVars = read("modules/zone-hardening/variables.tf");
const cacheRules = read("modules/zone-hardening/cache-rules.tf");

// Body of a `variable "<name>" { ... }` block up to the next top-level block.
function variableBlock(src, name) {
  const start = src.indexOf(`variable "${name}" {`);
  assert.notEqual(start, -1, `variable "${name}" must exist`);
  const next = src.indexOf("\nvariable ", start + 1);
  return src.slice(start, next === -1 ? undefined : next);
}

// Right-hand side of a single-line `name = value` local.
function local(src, name) {
  const m = src.match(new RegExp(`^\\s*${name}\\s*=\\s*(.+)$`, "m"));
  assert.ok(m, `local ${name} must exist`);
  return m[1];
}

test("root never_cache_hosts defaults to the prod Odoo host", () => {
  const block = variableBlock(rootVars, "never_cache_hosts");
  const def = block.match(/default\s*=\s*\[([^\]]*)\]/);
  assert.ok(def, "never_cache_hosts must have a list default");
  assert.match(def[1], /"odoo\.gatheringatthegrove\.com"/);
});

test("zones.tf passes never_cache_hosts into the zone-hardening module", () => {
  assert.match(zones, /never_cache_hosts\s*=\s*var\.never_cache_hosts/);
});

test("host matcher is an http.host set over the configured hosts", () => {
  const expr = local(moduleVars, "never_cache_host_expr");
  assert.match(expr, /http\.host in \{/);
  assert.match(expr, /var\.never_cache_hosts/);
});

test("never_cache_expr ORs the host matcher onto the path bypass", () => {
  const expr = local(moduleVars, "never_cache_expr");
  assert.match(expr, /local\.has_never_cache_hosts/);
  assert.match(expr, /local\.never_cache_path_expr\} or \$\{local\.never_cache_host_expr\}/);
});

test("Rule 1 (bypass) matches on never_cache_expr, not the bare path matcher", () => {
  const rule1 = cacheRules.slice(cacheRules.indexOf('ref         = "grove_cache_bypass_dynamic"'));
  assert.match(rule1.slice(0, 400), /expression\s*=\s*local\.never_cache_expr\b/);
});

test("Rule 3 (cache anonymous) excludes the never-cache hosts", () => {
  // Every branch of the bypass group must carry never_cache_expr, and the
  // anonymous rule must be the negation of that group.
  const group = local(moduleVars, "cache_bypass_group_expr");
  const branches = group.split(" : ");
  assert.equal(branches.length, 2, "group keeps its with/without-cookie branches");
  for (const b of branches) {
    assert.match(b, /\$\{local\.never_cache_expr\}/);
    assert.doesNotMatch(b, /\$\{local\.never_cache_path_expr\}/);
  }
  assert.match(local(moduleVars, "anonymous_cache_expr"), /not \(\$\{local\.cache_bypass_group_expr\}\)/);
  const rule3 = cacheRules.slice(cacheRules.indexOf('ref         = "grove_cache_anonymous"'));
  assert.match(rule3.slice(0, 400), /expression\s*=\s*local\.anonymous_cache_expr\b/);
});
