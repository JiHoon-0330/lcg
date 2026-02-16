import chalk from "chalk";
import ora from "ora";
import { execaCommand } from "execa";
import { ensureGlobalConfig, getProjectConfig } from "../lib/config.js";
import { initLinearClient, getIssue, updateIssueState } from "../lib/linear.js";
import {
  getWorktreeDir,
  worktreeExists,
  pushBranch,
  hasCommits,
} from "../lib/git.js";

export async function doneCommand(issueId: string): Promise<void> {
  const globalConfig = ensureGlobalConfig();
  initLinearClient(globalConfig.linearApiKey);

  const projectConfig = await getProjectConfig(globalConfig.defaultWorktreeDir);
  if (!projectConfig) {
    console.log(chalk.red("Project not configured. Run `lcg init` first."));
    process.exit(1);
  }

  // 1. Check worktree
  const worktreePath = getWorktreeDir(globalConfig.defaultWorktreeDir, issueId);
  if (!(await worktreeExists(worktreePath))) {
    console.log(chalk.red(`No worktree found for ${issueId}.`));
    process.exit(1);
  }

  // 2. Fetch issue info
  const spinner = ora(`Fetching issue ${issueId}...`).start();
  const issue = await getIssue(issueId);
  spinner.succeed(`Issue: ${issue.identifier} - ${issue.title}`);

  // 3. Check for commits
  const commits = await hasCommits(worktreePath, projectConfig.baseBranch);
  if (!commits) {
    console.log(
      chalk.yellow(
        "No new commits found on this branch. Make sure you've committed your changes.",
      ),
    );
    process.exit(1);
  }

  // 4. Push branch
  const pushSpinner = ora("Pushing branch...").start();
  try {
    await pushBranch(worktreePath, issue.branchName);
    pushSpinner.succeed("Branch pushed to remote");
  } catch (err) {
    pushSpinner.fail("Failed to push branch");
    console.error(chalk.red(String(err)));
    process.exit(1);
  }

  // 5. Create PR using gh CLI
  const prSpinner = ora("Creating pull request...").start();
  try {
    const prBody = [
      `## ${issue.identifier} - ${issue.title}`,
      "",
      issue.description ?? "",
      "",
      `Linear: ${issue.url}`,
    ].join("\n");

    const result = await execaCommand(
      `gh pr create --title "${issue.identifier} ${issue.title}" --body "${prBody.replace(/"/g, '\\"')}" --base ${projectConfig.baseBranch} --head ${issue.branchName}`,
      { cwd: worktreePath },
    );
    prSpinner.succeed("Pull request created");
    console.log(chalk.cyan(`  PR: ${result.stdout}`));
  } catch (err) {
    prSpinner.fail("Failed to create PR");
    console.error(chalk.red(String(err)));
    console.log(
      chalk.yellow("You can create the PR manually with `gh pr create`."),
    );
  }

  // 6. Update Linear status to "In Review"
  try {
    await updateIssueState(issue.id, "In Review", projectConfig.teamId);
    console.log(chalk.green('Linear issue status updated to "In Review"'));
  } catch (err) {
    console.log(chalk.yellow(`Could not update issue state: ${String(err)}`));
  }

  console.log(chalk.cyan(`  Linear: ${issue.url}`));
  console.log(chalk.bold("\nDone! Your PR is ready for review."));
}
