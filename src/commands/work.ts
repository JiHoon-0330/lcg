import { select } from "@inquirer/prompts";
import chalk from "chalk";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  ensureGlobalConfig,
  getProjectConfig,
  resolveIssueId,
} from "../lib/config.js";
import { initLinearClient, getIssue } from "../lib/linear.js";
import { getWorktreeDir, worktreeExists } from "../lib/git.js";
import { openClaudeSession, buildDesignPrompt } from "../lib/claude.js";

export async function workCommand(issueId: string): Promise<void> {
  const globalConfig = ensureGlobalConfig();
  initLinearClient(globalConfig.linearApiKey);

  const projectConfig = await getProjectConfig(globalConfig.defaultWorktreeDir);
  if (!projectConfig) {
    console.log(chalk.red("Project not configured. Run `lcg init` first."));
    process.exit(1);
  }

  issueId = resolveIssueId(projectConfig, issueId);

  // 1. Check worktree exists
  const worktreePath = getWorktreeDir(globalConfig.defaultWorktreeDir, issueId);
  if (!(await worktreeExists(worktreePath))) {
    console.log(
      chalk.red(
        `No worktree found for ${issueId}. Run \`lcg start ${issueId}\` first.`,
      ),
    );
    process.exit(1);
  }

  // 2. Show CLAUDE.md summary
  const claudeMdPath = join(worktreePath, "CLAUDE.md");
  try {
    const content = await readFile(claudeMdPath, "utf-8");
    console.log(chalk.bold("\n--- CLAUDE.md Summary ---"));
    const lines = content.split("\n").slice(0, 20);
    console.log(chalk.gray(lines.join("\n")));
    if (content.split("\n").length > 20) {
      console.log(chalk.gray("  ..."));
    }
    console.log(chalk.bold("--- End Summary ---\n"));
  } catch {
    console.log(chalk.yellow("No CLAUDE.md found in worktree."));
  }

  // 3. Work mode selection
  const mode = await select({
    message: "Select work mode:",
    choices: [
      {
        name: "Start Implementation — Open Claude session and start coding",
        value: "implement",
      },
      {
        name: "Design Discussion — Open Claude session for design/planning first",
        value: "design",
      },
      {
        name: "Edit Design Notes — Modify CLAUDE.md design notes in $EDITOR",
        value: "edit",
      },
    ],
  });

  if (mode === "edit") {
    const editor = process.env.EDITOR ?? "vi";
    const { execaCommand } = await import("execa");
    await execaCommand(`${editor} ${claudeMdPath}`, { stdio: "inherit" });
    console.log(chalk.green("Design notes updated. Run `lcg work` again."));
    return;
  }

  // 4. Open Claude session
  const issue = await getIssue(issueId);
  let initialPrompt: string | undefined;

  if (mode === "design") {
    initialPrompt = buildDesignPrompt(issue.title, issue.description);
  }

  console.log(chalk.cyan(`\nOpening Claude session in: ${worktreePath}\n`));
  await openClaudeSession(worktreePath, initialPrompt);
}
