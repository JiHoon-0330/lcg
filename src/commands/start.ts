import chalk from "chalk";
import ora from "ora";
import {
  ensureGlobalConfig,
  resolveIssueId,
  resolveProjectContext,
} from "../lib/config.js";
import { initLinearClient, getIssue, updateIssueState } from "../lib/linear.js";
import { worktreeExists, getWorktreeDir } from "../lib/git.js";
import {
  startZellijWithClaude,
  attachZellijSession,
  zellijSessionExists,
  startZellijInWorktree,
} from "../lib/zellij.js";

export async function startCommand(
  issueId: string,
  options: { base?: string | true },
): Promise<void> {
  const globalConfig = ensureGlobalConfig();
  initLinearClient(globalConfig.linearApiKey);

  const { projectConfig, worktreeDir } = await resolveProjectContext();

  issueId = resolveIssueId(projectConfig, issueId);

  const worktreePath = getWorktreeDir(worktreeDir, issueId);
  const sessionExists = zellijSessionExists(issueId);
  const wtExists = await worktreeExists(worktreePath);

  // State B, C: session exists → attach
  if (sessionExists) {
    console.log(chalk.cyan(`\nAttaching to Zellij session: ${issueId}\n`));
    attachZellijSession(issueId);
    return;
  }

  // State D: worktree exists but no session → start zellij with claude
  if (wtExists) {
    console.log(
      chalk.cyan(
        `\nStarting Zellij session in existing worktree: ${issueId}\n`,
      ),
    );
    startZellijInWorktree(worktreePath, issueId);
    return;
  }

  // State A: neither exists → full setup
  const spinner = ora(`Fetching issue ${issueId}...`).start();
  const issue = await getIssue(issueId);
  spinner.succeed(`Found: ${issue.identifier} - ${issue.title}`);

  console.log(chalk.bold("\n--- Issue Details ---"));
  console.log(`${chalk.cyan("ID:")} ${issue.identifier}`);
  console.log(`${chalk.cyan("Title:")} ${issue.title}`);
  console.log(`${chalk.cyan("Priority:")} ${issue.priorityLabel}`);
  console.log(`${chalk.cyan("State:")} ${issue.state.name}`);
  console.log(`${chalk.cyan("Labels:")} ${issue.labels.join(", ") || "none"}`);
  console.log(`${chalk.cyan("Branch:")} ${issue.branchName}`);
  if (issue.description) {
    console.log(`${chalk.cyan("\nDescription:")}\n${issue.description}`);
  }
  if (issue.comments.length > 0) {
    console.log(chalk.cyan("\nComments:"));
    for (const comment of issue.comments) {
      console.log(
        `  - ${comment.slice(0, 200)}${comment.length > 200 ? "..." : ""}`,
      );
    }
  }
  console.log(chalk.bold("--- End Issue Details ---\n"));

  try {
    await updateIssueState(issue.id, "In Progress", projectConfig.teamId);
    console.log(chalk.green('Linear issue status updated to "In Progress"'));
  } catch (err) {
    console.log(chalk.yellow(`Could not update issue state: ${String(err)}`));
  }

  // Resolve base branch
  let baseBranch: string | undefined;
  if (typeof options.base === "string") {
    baseBranch = options.base;
  } else if (options.base === true) {
    // --base flag without value → interactive branch picker
    const { selectBranch } = await import("../lib/git.js");
    baseBranch = await selectBranch(worktreeDir, projectConfig.baseBranch);
  }

  console.log(chalk.cyan(`\nStarting Zellij session: ${issueId}\n`));
  startZellijWithClaude(issueId, issueId, worktreeDir, baseBranch);
}
