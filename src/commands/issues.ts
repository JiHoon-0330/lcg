import chalk from "chalk";
import ora from "ora";
import { ensureGlobalConfig, getProjectConfig } from "../lib/config.js";
import { initLinearClient, getMyIssues } from "../lib/linear.js";
import { getWorktreeStatus } from "../lib/git.js";
import type { LcgIssue } from "../types/index.js";

const PRIORITY_COLORS: Record<string, (s: string) => string> = {
  Urgent: chalk.red,
  High: chalk.yellow,
  Medium: chalk.blue,
  Low: chalk.gray,
  "No priority": chalk.gray,
};

export async function issuesCommand(options: {
  all?: boolean;
  status?: string;
  team?: string;
}): Promise<void> {
  const globalConfig = ensureGlobalConfig();
  initLinearClient(globalConfig.linearApiKey);

  let teamId = options.team;
  if (!teamId && !options.all) {
    const projectConfig = await getProjectConfig(
      globalConfig.defaultWorktreeDir,
    );
    if (projectConfig) teamId = projectConfig.teamId;
  }

  const spinner = ora("Fetching issues...").start();
  const issues = await getMyIssues(
    globalConfig.linearUserId,
    options.all ? undefined : teamId,
    options.status,
  );
  spinner.stop();

  if (issues.length === 0) {
    console.log(chalk.gray("No issues found."));
    return;
  }

  // Check active worktrees
  let activeWorktrees = new Set<string>();
  try {
    const statuses = await getWorktreeStatus(
      globalConfig.repoPath,
      globalConfig.defaultWorktreeDir,
    );
    activeWorktrees = new Set(statuses.map((s) => s.issueId));
  } catch {
    // Ignore
  }

  // Group by state
  const grouped = new Map<string, LcgIssue[]>();
  for (const issue of issues) {
    const stateName = issue.state.name;
    if (!grouped.has(stateName)) grouped.set(stateName, []);
    grouped.get(stateName)!.push(issue);
  }

  // Display
  for (const [stateName, stateIssues] of grouped) {
    console.log(chalk.bold(`\n${stateName}`));
    for (const issue of stateIssues) {
      const priorityColor = PRIORITY_COLORS[issue.priorityLabel] ?? chalk.white;
      const worktreeIndicator = activeWorktrees.has(issue.identifier)
        ? chalk.cyan(" ← worktree active")
        : "";
      console.log(
        `  ${chalk.cyan(issue.identifier.padEnd(10))} ${issue.title.padEnd(40)} ${priorityColor(issue.priorityLabel)}${worktreeIndicator}`,
      );
    }
  }
  console.log();
}
