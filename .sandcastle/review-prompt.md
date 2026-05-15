# Code review pass

You are reviewing changes made by a previous agent on this same branch. You share the same workspace as the implementer — their commits are already on `{{SOURCE_BRANCH}}`.

## The original issue

!`gh issue view {{ISSUE_NUMBER}} --repo Goldberry-Playground/grove-sites --json number,title,body --jq "\"# \" + .title + \"\n\n\" + .body"`

## What changed on this branch

!`git log {{TARGET_BRANCH}}..HEAD --oneline`

!`git diff {{TARGET_BRANCH}}..HEAD --stat`

## Repo conventions

Read CLAUDE.md and apply its **Code Conventions** section.

**Important:** CLAUDE.md also has a "Development Workflow — Skill Chain" section that references local Claude Code skills like `/feature-dev`, `/code-review`, and `/simplify`. Those are host-side tools that are NOT installed in this sandbox container. **Ignore that section.** Your workflow is the one defined in this prompt under "Your task" below.

!`cat CLAUDE.md`

## Your task

1. Read the issue body. Note every line in its "Acceptance criteria" and "Out of scope" sections.
2. Read every commit on this branch. Use `git show <sha>` if needed.
3. Check the diff for problems:
   - **Scope creep** — changes outside what the issue asked for
   - **Missed acceptance criteria** — items in the issue's checklist that aren't satisfied
   - **Out-of-scope violations** — things the issue explicitly said NOT to touch
   - **Code smells** — overly broad try/catch, silently swallowed errors, missing types, magic constants without explanatory comments, accidental any
   - **Convention violations** — anything that breaks the rules in `CLAUDE.md`
   - **Test quality** — if tests were added, do they actually exercise real logic or are they vacuous (`expect(true).toBe(true)` filler)?
4. If you find problems you can fix yourself, **fix them on this same branch**. Commit each fix as its own commit with a Conventional Commit prefix like `review:` so it's clear what came from review.
5. Re-run all the gates the implementer was supposed to pass:

```
pnpm install --frozen-lockfile
pnpm lint
pnpm type-check
pnpm test
pnpm --filter @grove/goldberry build
```

Fix anything that fails.

## Completion signals

If the implementation is now correct and complete (with your fixes if any), emit:

<promise>COMPLETE</promise>

If you find structural problems you cannot fix in this pass — for example, the implementer chose an approach that's fundamentally wrong for the issue and the right fix is to start over with a different design — write your notes to `.sandcastle/review-notes-{{ISSUE_NUMBER}}.md`, commit that file with message `review: needs human attention`, and emit:

<promise>NEEDS_HUMAN</promise>

The notes file should include:
- What the implementer did
- Why it's wrong / incomplete
- What approach you'd take instead
- Whether the existing commits should be kept or thrown away
