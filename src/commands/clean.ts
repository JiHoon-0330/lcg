import { confirm } from "@inquirer/prompts";
import chalk from "chalk";
import ora from "ora";
import { ensureGlobalConfig } from "../lib/config.js";
import { getWorktreeDir, worktreeExists, removeWorktree } from "../lib/git.js";

export async function cleanCommand(issueId: string): Promise<void> {
  const globalConfig = ensureGlobalConfig();

  const worktreePath = getWorktreeDir(globalConfig.defaultWorktreeDir, issueId);

  if (!(await worktreeExists(worktreePath))) {
    console.log(chalk.yellow(`No worktree found for ${issueId}.`));
    return;
  }

  console.log(chalk.bold(`\nWorktree: ${worktreePath}`));

  const proceed = await confirm({
    message: `Remove worktree for ${issueId}?`,
    default: false,
  });
  if (!proceed) {
    console.log(chalk.gray("Cancelled."));
    return;
  }

  const deleteBranch = await confirm({
    message: "Also delete the local branch?",
    default: false,
  });

  const spinner = ora("Removing worktree...").start();
  try {
    await removeWorktree(globalConfig.repoPath, worktreePath, deleteBranch);
    spinner.succeed("Worktree removed");
    if (deleteBranch) {
      console.log(chalk.green("Local branch deleted"));
    }
  } catch (err) {
    spinner.fail("Failed to remove worktree");
    console.error(chalk.red(String(err)));
    process.exit(1);
  }
}
