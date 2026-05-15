# Sandcastle — agent backlog runner

Picks the oldest open issue labelled `Sandcastle`, spins up a sandboxed Claude Code agent to implement it, runs a review pass on the same branch with a second agent, and leaves you a branch + commits ready to push and PR.

## Quick start

1. Install the orchestrator. Sandcastle ships as `@ai-hero/sandcastle` and is invoked via `tsx`:

   ```bash
   pnpm add -Dw @ai-hero/sandcastle tsx
   ```

2. Copy the env template and fill in your tokens:

   ```bash
   cp .sandcastle/.env.example .sandcastle/.env
   $EDITOR .sandcastle/.env
   ```

3. Build the agent's Docker image (one-time, re-run after Dockerfile edits):

   ```bash
   pnpm exec sandcastle docker build-image
   ```

4. Run against the next Sandcastle-labelled issue:

   ```bash
   pnpm exec tsx .sandcastle/run.ts
   ```

5. When the run finishes, the script prints the `git push` and `gh pr create` commands. Review the worktree under `.sandcastle/worktrees/`, push, and PR.

## Template

This is the **`sequential-reviewer`** pattern:

| Step | Agent | Model | Iter cap |
|---|---|---|---|
| Implement | `claudeCode` | `claude-opus-4-7` | 3 |
| Review | `claudeCode` | `claude-sonnet-4-6` | 2 |

Both run on the same branch in the same container. The reviewer can make its own fix commits if it finds problems.

## What stops a bad PR from landing

The agent's container can write to the branch, but the branch never reaches `main` without:

1. CI gates: `lint`, `type-check`, `vitest`, `build` are all blocking on PR.
2. The reviewer agent's pass on the same branch (this template's second step).
3. Squash-merge by a human via GitHub UI.

## Notes

- Commits made inside the sandbox are **unsigned** — 1Password's SSH signing socket doesn't reach Docker on macOS. The signed commit lands when GitHub creates the squash-merge commit on `main`.
- The `Sandcastle` label is what `run.ts` filters on. Unlabel an issue to take it out of the queue.
- Add `pnpm add -Dw @ai-hero/sandcastle tsx` to the root `package.json` if you want this PR-mergeable end-to-end — this scaffold deliberately leaves deps off so you can review the structure before committing to the dependency.
