import chalk from "chalk";
import ora from "ora";
import { execaCommand } from "execa";
import { writeFile, mkdir, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import {
  ensureGlobalConfig,
  getProjectConfig,
  resolveIssueId,
} from "../lib/config.js";
import { initLinearClient, getIssue } from "../lib/linear.js";
import { createWorktree, getWorktreeDir, getGit } from "../lib/git.js";

export function renderClaudeMd(
  template: string,
  issue: {
    identifier: string;
    title: string;
    description?: string;
    comments: string[];
  },
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
    );
}

export async function setupCommand(issueId: string): Promise<void> {
  const globalConfig = ensureGlobalConfig();
  initLinearClient(globalConfig.linearApiKey);

  const projectConfig = await getProjectConfig(globalConfig.defaultWorktreeDir);
  if (!projectConfig) {
    console.log(chalk.red("Project not configured. Run `lcg init` first."));
    process.exit(1);
  }

  issueId = resolveIssueId(projectConfig, issueId);

  // 1. Fetch issue
  const spinner = ora(`Fetching issue ${issueId}...`).start();
  const issue = await getIssue(issueId);
  spinner.succeed(`Found: ${issue.identifier} - ${issue.title}`);

  // 2. Create worktree
  const worktreePath = getWorktreeDir(globalConfig.defaultWorktreeDir, issueId);
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

    // Push branch to set upstream tracking
    const wtGit = getGit(path);
    await wtGit.push(["-u", "origin", branchName]);
    console.log(chalk.green(`Upstream set to origin/${branchName}`));
  } catch (err) {
    createSpinner.fail("Failed to create worktree");
    console.error(chalk.red(String(err)));
    process.exit(1);
  }

  // 3. Run post-setup script
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

  // 4. Generate CLAUDE.local.md with issue context
  const claudeMd = renderClaudeMd(projectConfig.claudeMdTemplate, issue);
  await writeFile(join(worktreePath, "CLAUDE.local.md"), claudeMd, "utf-8");

  // Check if CLAUDE.md exists in the worktree (from base branch)
  const claudeMdPath = join(worktreePath, "CLAUDE.md");
  let hasClaudeMd = false;
  try {
    await access(claudeMdPath);
    hasClaudeMd = true;
  } catch {
    // CLAUDE.md does not exist
  }

  if (hasClaudeMd) {
    console.log(
      chalk.green(
        "CLAUDE.md found — CLAUDE.local.md에 이슈 컨텍스트를 추가했습니다",
      ),
    );
  } else {
    console.log(chalk.green("CLAUDE.local.md generated with issue context"));
    console.log(
      chalk.yellow(
        "CLAUDE.md가 없습니다. 프로젝트 규칙을 담은 CLAUDE.md를 추가하면 Claude가 프로젝트 컨벤션을 더 잘 따릅니다.",
      ),
    );
  }

  // 5. Start Claude session
  console.log(chalk.cyan(`\nStarting Claude in: ${worktreePath}\n`));
  await execaCommand("claude", {
    cwd: worktreePath,
    stdio: "inherit",
  });
}
