import { confirm } from "@inquirer/prompts";
import chalk from "chalk";
import ora from "ora";
import { resolveIssueId, resolveProjectContext } from "../lib/config.js";
import { getWorktreeDir, worktreeExists, removeWorktree } from "../lib/git.js";
import { killZellijSession } from "../lib/zellij.js";

export async function cleanCommand(issueId: string): Promise<void> {
  const { projectConfig, worktreeDir, repoPath } =
    await resolveProjectContext();

  issueId = resolveIssueId(projectConfig, issueId);

  const worktreePath = getWorktreeDir(worktreeDir, issueId);

  if (!(await worktreeExists(worktreePath))) {
    console.log(chalk.yellow(`No worktree found for ${issueId}.`));
    return;
  }

  console.log(chalk.bold(`\nWorktree: ${worktreePath}`));

  const proceed = await confirm({
    message: `Remove worktree, branch, and Zellij session for ${issueId}?`,
    default: true,
  });
  if (!proceed) {
    console.log(chalk.gray("Cancelled."));
    return;
  }

  // 1. Kill Zellij session
  const zellijKilled = killZellijSession(issueId);
  if (zellijKilled) {
    console.log(chalk.green(`Zellij session "${issueId}" killed`));
  }

  // 2. Remove worktree + branch
  const spinner = ora("Removing worktree and branch...").start();
  try {
    await removeWorktree(repoPath, worktreePath, true);
    spinner.succeed("Worktree and branch removed");
  } catch (err) {
    spinner.fail("Failed to remove worktree");
    console.error(chalk.red(String(err)));
    process.exit(1);
  }
}
