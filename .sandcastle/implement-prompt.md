# Task

You are implementing a fix for a GitHub issue. The branch is already checked out — Sandcastle handles git ops for you. Make your changes, commit them on this branch, and signal completion when done.

## The issue

!`gh issue view {{ISSUE_NUMBER}} --repo Goldberry-Playground/grove-sites --json number,title,body --jq "\"# \" + .title + \"\n\n\" + .body"`

## Repo conventions

Read CLAUDE.md and apply its **Code Conventions** section.

**Important:** CLAUDE.md also has a "Development Workflow — Skill Chain" section that references local Claude Code skills like `/feature-dev`, `/code-review`, and `/simplify`. Those are host-side tools that are NOT installed in this sandbox container. **Ignore that section.** Your workflow is the one defined in this prompt under "Workflow" below.

!`cat CLAUDE.md`

## Hard rules

You are working on branch `{{SOURCE_BRANCH}}`. Target is `{{TARGET_BRANCH}}`.

- Sandcastle handles push/PR. Do NOT `git push` yourself.
- Package manager: `pnpm` (pinned to 9.15.0 via Corepack). Never use `npm` or `yarn`.
- Before claiming done, ALL of these must pass:

```
pnpm install --frozen-lockfile
pnpm lint
pnpm type-check
pnpm test
pnpm --filter @grove/goldberry build
```

- Never delete the `NEXT_PHASE === "phase-production-build"` guard in any `tenant.secrets.ts`. It is load-bearing for CI's `build` job — removing it makes `next build` require real secrets at build time, which CI does not have.
- Never commit a file matching `^\.env$` or `*.env` (the `no-tracked-env-files` CI job will block the PR).
- Stay strictly within the issue's scope. If the issue's body has an "Out of scope" section, honor it. Do not "while I'm here" any unrelated changes.

## Workflow

1. Read the issue body end-to-end. Understand the acceptance criteria.
2. Read every file the issue references in "Files to delete" / "Files to modify" / "Acceptance criteria".
3. Make the minimal change that closes the issue.
4. Run each gate listed under "Hard rules". Fix anything that fails.
5. Commit with a Conventional Commit message that references the issue:
   - `fix: <summary> (closes #{{ISSUE_NUMBER}})` for bug fixes
   - `chore: <summary> (refs #{{ISSUE_NUMBER}})` for cleanup
   - `feat: <summary> (closes #{{ISSUE_NUMBER}})` for new functionality
6. If the issue calls out multiple distinct changes, prefer multiple smaller commits over one large one — easier to review.

When every gate passes and the diff matches the issue's intent, emit on its own line:

<promise>COMPLETE</promise>
