import { execFileSync } from "node:child_process";
import { createSandbox, claudeCode } from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";

interface Issue {
  number: number;
  title: string;
  labels: Array<{ name: string }>;
}

async function main() {
  const issuesJson = execFileSync(
    "gh",
    [
      "issue",
      "list",
      "--label",
      "Sandcastle",
      "--state",
      "open",
      "--limit",
      "1",
      "--json",
      "number,title,labels",
    ],
    { encoding: "utf8" },
  );
  const issues: Issue[] = JSON.parse(issuesJson);
  if (issues.length === 0) {
    console.log("No open issues with the Sandcastle label. Nothing to do.");
    return;
  }

  const issue = issues[0];
  const branch = `agent/issue-${issue.number}`;

  console.log("\n=== Sandcastle run ===");
  console.log(`Issue:  #${issue.number} — ${issue.title}`);
  console.log(`Branch: ${branch}`);
  console.log("========================\n");

  await using sandbox = await createSandbox({
    branch,
    sandbox: docker({
      mounts: [
        {
          hostPath: "~/.local/share/pnpm/store",
          sandboxPath: "/home/agent/.local/share/pnpm/store",
        },
      ],
    }),
    hooks: {
      sandbox: {
        onSandboxReady: [
          { command: "pnpm install --frozen-lockfile", timeoutMs: 600_000 },
        ],
      },
    },
  });

  console.log("--- Implementer: claude-opus-4-7 ---");
  const implResult = await sandbox.run({
    agent: claudeCode("claude-opus-4-7"),
    promptFile: ".sandcastle/implement-prompt.md",
    promptArgs: { ISSUE_NUMBER: String(issue.number) },
    maxIterations: 3,
    name: `implement-${issue.number}`,
  });
  console.log(
    `  ${implResult.commits.length} commits, signal=${implResult.completionSignal ?? "<none>"}`,
  );

  console.log("\n--- Reviewer: claude-sonnet-4-6 ---");
  const reviewResult = await sandbox.run({
    agent: claudeCode("claude-sonnet-4-6"),
    promptFile: ".sandcastle/review-prompt.md",
    promptArgs: { ISSUE_NUMBER: String(issue.number) },
    maxIterations: 2,
    name: `review-${issue.number}`,
  });
  console.log(
    `  ${reviewResult.commits.length} commits, signal=${reviewResult.completionSignal ?? "<none>"}`,
  );

  const totalCommits = implResult.commits.length + reviewResult.commits.length;
  if (totalCommits === 0) {
    console.log("\nNo commits made — nothing to PR.");
    return;
  }

  console.log(`\n=== Done: ${totalCommits} commit(s) on branch ${branch} ===`);
  console.log("\nNext steps (on the host, in this repo):");
  console.log(`  git push origin ${branch}`);
  console.log(
    `  gh pr create --head ${branch} --title "fix: close #${issue.number}" --body "Closes #${issue.number}"`,
  );
}

main().catch((err) => {
  console.error("Sandcastle run failed:", err);
  process.exit(1);
});
