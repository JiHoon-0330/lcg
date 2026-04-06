import chalk from "chalk";
import ora from "ora";
import { select, Separator } from "@inquirer/prompts";
import { ensureGlobalConfig, resolveProjectContext } from "../lib/config.js";
import { initLinearClient, getMyIssues } from "../lib/linear.js";
import { getWorktreeStatus, getWorktreeDir } from "../lib/git.js";
import { isClaudeSessionActive } from "../lib/claude.js";
import { startCommand } from "./start.js";
import { cleanCommand } from "./clean.js";
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

  const { projectConfig, worktreeDir, repoPath } =
    await resolveProjectContext();

  let teamId = options.team;
  if (!teamId && !options.all) {
    teamId = projectConfig.teamId;
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

  // Check active worktrees and claude sessions
  let activeWorktrees = new Set<string>();
  const claudeActive = new Set<string>();
  try {
    const statuses = await getWorktreeStatus(repoPath, worktreeDir);
    activeWorktrees = new Set(statuses.map((s) => s.issueId));
    const checks = await Promise.all(
      statuses.map(async (s) => {
        const dir = getWorktreeDir(worktreeDir, s.issueId);
        const active = await isClaudeSessionActive(dir);
        return { issueId: s.issueId, active };
      }),
    );
    for (const c of checks) {
      if (c.active) claudeActive.add(c.issueId);
    }
  } catch {
    // Ignore
  }

  // Group by state (exclude Canceled, Duplicated)
  const HIDDEN_STATES = new Set([
    "Canceled",
    "Cancelled",
    "Duplicate",
    "Duplicated",
  ]);
  const grouped = new Map<string, LcgIssue[]>();
  for (const issue of issues) {
    const stateName = issue.state.name;
    if (HIDDEN_STATES.has(stateName)) continue;
    if (!grouped.has(stateName)) grouped.set(stateName, []);
    grouped.get(stateName)!.push(issue);
  }

  // Interactive mode
  const EXIT_VALUE = "__exit__";
  const BACK_VALUE = "__back__";

  const issueChoices: Array<{ name: string; value: string } | Separator> = [];
  for (const [stateName, stateIssues] of grouped) {
    issueChoices.push(new Separator(`── ${stateName} ──`));
    for (const issue of stateIssues) {
      const priorityColor = PRIORITY_COLORS[issue.priorityLabel] ?? chalk.white;
      let indicator = "";
      if (claudeActive.has(issue.identifier)) {
        indicator = chalk.magenta(" ← claude active");
      } else if (activeWorktrees.has(issue.identifier)) {
        indicator = chalk.cyan(" ← worktree active");
      }
      issueChoices.push({
        name: `${priorityColor(issue.priorityLabel.padEnd(12))} ${chalk.cyan(issue.identifier.padEnd(10))} ${issue.title}${indicator}`,
        value: issue.identifier,
      });
    }
  }
  issueChoices.push(new Separator(`── Exit ──`));
  issueChoices.push({ name: "Exit", value: EXIT_VALUE });

  // Issue selection loop (allows "Back" from action select)
  while (true) {
    const selectedIssue = await select({
      message: "Select an issue",
      choices: issueChoices,
      pageSize: 14,
    });

    if (selectedIssue === EXIT_VALUE) return;

    const hasWorktree = activeWorktrees.has(selectedIssue);
    const actionChoices: Array<{ name: string; value: string }> = [];

    actionChoices.push({ name: "start", value: "start" });
    if (hasWorktree) {
      actionChoices.push({ name: "clean", value: "clean" });
    }
    actionChoices.push({ name: "Back", value: BACK_VALUE });

    const selectedAction = await select({
      message: `Action for ${chalk.cyan(selectedIssue)}`,
      choices: actionChoices,
    });

    if (selectedAction === BACK_VALUE) continue;

    switch (selectedAction) {
      case "start":
        await startCommand(selectedIssue, {});
        break;
      case "clean":
        await cleanCommand(selectedIssue);
        break;
    }
    return;
  }
}
