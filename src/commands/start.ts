import { input, confirm } from "@inquirer/prompts";
import chalk from "chalk";
import ora from "ora";
import { execaCommand } from "execa";
import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import {
  ensureGlobalConfig,
  getProjectConfig,
  resolveIssueId,
} from "../lib/config.js";
import { initLinearClient, getIssue, updateIssueState } from "../lib/linear.js";
import { createWorktree, worktreeExists, getWorktreeDir } from "../lib/git.js";

export function renderClaudeMd(
  template: string,
  issue: {
    identifier: string;
    title: string;
    description?: string;
    comments: string[];
  },
  designNotes: string,
): string {
  return template
    .replace(/\{\{identifier\}\}/g, issue.identifier)
    .replace(/\{\{title\}\}/g, issue.title)
    .replace(
      /\{\{description\}\}/g,
      issue.description ?? "No description provided",
    )
    .replace(
      /\{\{comments\}\}/g,
      issue.comments.length > 0
        ? issue.comments.map((c, i) => `${i + 1}. ${c}`).join("\n")
        : "No comments",
    )
    .replace(
      /\{\{designNotes\}\}/g,
      designNotes || "No additional design notes",
    );
}

export async function startCommand(
  issueId: string,
  options: { skipDesign?: boolean },
): Promise<void> {
  const globalConfig = ensureGlobalConfig();
  initLinearClient(globalConfig.linearApiKey);

  const projectConfig = await getProjectConfig(globalConfig.defaultWorktreeDir);
  if (!projectConfig) {
    console.log(chalk.red("Project not configured. Run `lcg init` first."));
    process.exit(1);
  }

  const rawIssueId = issueId;
  issueId = resolveIssueId(projectConfig, issueId);

  // 1. Fetch issue
  const spinner = ora(`Fetching issue ${issueId}...`).start();
  const issue = await getIssue(issueId);
  spinner.succeed(`Found: ${issue.identifier} - ${issue.title}`);

  // 2. Display issue info
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

  // 3. Check if worktree already exists
  const worktreePath = getWorktreeDir(globalConfig.defaultWorktreeDir, issueId);
  if (await worktreeExists(worktreePath)) {
    console.log(chalk.yellow(`Worktree already exists at: ${worktreePath}`));
    console.log(chalk.yellow("Use `lcg work` to start working on it."));
    return;
  }

  // 4. Design notes (optional)
  let designNotes = "";
  if (!options.skipDesign) {
    const wantDesign = await confirm({
      message: "Would you like to add design notes?",
      default: false,
    });
    if (wantDesign) {
      designNotes = await input({
        message:
          "Enter design notes (implementation direction, tech stack, caveats, etc.):",
      });
    }
  }

  // 5. Create worktree
  const branchName = issue.branchName;
  const createSpinner = ora("Creating worktree...").start();
  try {
    await mkdir(dirname(worktreePath), { recursive: true });
    const path = await createWorktree(
      globalConfig.repoPath,
      globalConfig.defaultWorktreeDir,
      issueId,
      branchName,
      projectConfig.baseBranch,
    );
    createSpinner.succeed(`Worktree created at: ${path}`);
  } catch (err) {
    createSpinner.fail("Failed to create worktree");
    console.error(chalk.red(String(err)));
    process.exit(1);
  }

  // 6. Run post-setup script
  if (projectConfig.postSetup) {
    const setupSpinner = ora(
      `Running post-setup: ${projectConfig.postSetup}`,
    ).start();
    try {
      await execaCommand(projectConfig.postSetup, {
        cwd: worktreePath,
        stdio: "inherit",
        shell: true,
      });
      setupSpinner.succeed("Post-setup script completed");
    } catch (err) {
      setupSpinner.warn(
        `Post-setup script failed: ${String(err)}. Continuing...`,
      );
    }
  }

  // 7. Generate CLAUDE.md
  const claudeMd = renderClaudeMd(
    projectConfig.claudeMdTemplate,
    issue,
    designNotes,
  );
  await writeFile(join(worktreePath, "CLAUDE.md"), claudeMd, "utf-8");
  console.log(chalk.green("CLAUDE.md generated with issue context"));

  // 7. Update Linear issue state to "In Progress"
  try {
    await updateIssueState(issue.id, "In Progress", projectConfig.teamId);
    console.log(chalk.green('Linear issue status updated to "In Progress"'));
  } catch (err) {
    console.log(chalk.yellow(`Could not update issue state: ${String(err)}`));
  }

  console.log(
    chalk.bold(`\nReady! Run \`lcg work ${rawIssueId}\` to start coding.`),
  );
}
