import chalk from "chalk";
import ora from "ora";
import { ensureGlobalConfig, resolveProjectContext } from "../lib/config.js";
import { initLinearClient, getIssue } from "../lib/linear.js";
import { getWorktreeStatus } from "../lib/git.js";

export async function statusCommand(): Promise<void> {
  const globalConfig = ensureGlobalConfig();
  initLinearClient(globalConfig.linearApiKey);

  const { repoPath, worktreeDir } = await resolveProjectContext();

  const spinner = ora("Checking worktree status...").start();
  const worktrees = await getWorktreeStatus(repoPath, worktreeDir);
  spinner.stop();

  if (worktrees.length === 0) {
    console.log(chalk.gray("No active worktrees."));
    return;
  }

  console.log(chalk.bold("\nActive Worktrees:"));
  for (const wt of worktrees) {
    let issueTitle: string;
    try {
      const issue = await getIssue(wt.issueId);
      issueTitle = issue.title;
    } catch {
      issueTitle = "(unknown issue)";
    }

    const diffStr =
      wt.filesChanged > 0
        ? chalk.green(`+${wt.insertions}`) +
          " " +
          chalk.red(`-${wt.deletions}`) +
          chalk.gray(` (${wt.filesChanged} files changed)`)
        : chalk.gray("(no changes)");

    console.log(
      `  ${chalk.cyan(wt.issueId.padEnd(12))} ${chalk.white(wt.branch.padEnd(30))} ${diffStr}`,
    );
    if (issueTitle) {
      console.log(`  ${" ".repeat(12)} ${chalk.gray(issueTitle)}`);
    }
  }
  console.log();
}
