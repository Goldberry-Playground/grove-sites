# QA Deploy — Agent Guardrails (July 2026)

Operating rails for all agents (Claude Code sessions, Paperclip routines, the Dev Agent)
working on the end-of-July QA deploy (QA window 2026-07-28 → 31). Locked 2026-07-20.
These exist because **QA Odoo now holds real business data** — it is not a disposable sandbox.

## 1. QA Odoo is system-of-record — write gate

QA Odoo carries REAL orders and inventory (real data since 2026-07-09; it promotes to prod
at cutover). Agents NEVER write pricing, inventory, or orders, and never re-seed, without
explicit approval from Josh. Pattern: **Paperclip proposes, Josh gates.** Anything an agent
stages is a proposal until approved.

## 2. Prod Ghost — drafts only

The blogs droplet is production content shared by QA and prod frontends. Agents may create
**drafts only** (e.g. the ~19 species guides). Publishing is a human-only action.

## 3. Repo changes — PR off `origin/main`, always

- Every change lands via a PR branched off `origin/main`. Never trust a stale local branch —
  fetch and diff against `origin/main` first.
- No pushes to `main`.
- No edits to `.github/workflows/**` without Josh's review.

## 4. Secrets

- Never print secret values — check presence/length or redact.
- Reference 1Password items **by name**; never inline values in commands, code, or docs.
- Secrets reach apps only via Terraform — no hand-pasted env vars.
- Terraform split of duties: agents stage `terraform plan` output; **Josh runs `apply`**.

## 5. Cloudflare changes

The agent stages the exact rule/record configuration; **Josh clicks confirm**. No
agent-executed Cloudflare mutations.

## 6. Never run `qa-teardown-dns.sh`

It destroys the **live qa zone**. There is no circumstance in this sprint where an agent
runs it.

## 7. Scope locks this sprint

Do not build, wire, or provision:

- S3/S4 deposit + off-session balance capture (August)
- Shippo integration or a live rate-checker run (August)
- Preorder / batch-wave inventory system (next spec)
- Prod infra provisioning (Phase 6, late August)

EOM scope is S1+S2 full-payment Checkout, the oversell guard, provisional zone rates,
out-of-green-list blocking, and faceted filtering — nothing beyond. See the
"Decisions 2026-07-20" block in [`STOREFRONT-SPEC.md`](./STOREFRONT-SPEC.md).

## 8. Sandbox test orders — `qatest` convention

Every sandbox Stripe test order placed during QA must use the **`qatest` email convention**
so the cleanup script can find, cancel, and archive them before the prod freeze → promote.
Untagged test orders pollute real order history.

## 9. Teardown / redeploy contract

See the teardown runbook. Teardown removes **only** test data and disables Stripe test
webhook endpoints. It NEVER deletes QA Odoo real data, product photos, species guides, or
any Terraform-managed infra. Redeploy = `terraform apply` + re-enable the webhook —
everything needed lives in git, Terraform, and 1Password.
