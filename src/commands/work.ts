import chalk from "chalk";
import {
  ensureGlobalConfig,
  getProjectConfig,
  resolveIssueId,
} from "../lib/config.js";
import { getWorktreeDir, worktreeExists } from "../lib/git.js";
import { openClaudeSession } from "../lib/claude.js";

export async function workCommand(issueId: string): Promise<void> {
  const globalConfig = ensureGlobalConfig();

  const projectConfig = await getProjectConfig(globalConfig.defaultWorktreeDir);
  if (!projectConfig) {
    console.log(chalk.red("Project not configured. Run `lcg init` first."));
    process.exit(1);
  }

  issueId = resolveIssueId(projectConfig, issueId);

  const worktreePath = getWorktreeDir(globalConfig.defaultWorktreeDir, issueId);
  if (!(await worktreeExists(worktreePath))) {
    console.log(
      chalk.red(
        `No worktree found for ${issueId}. Run \`lcg start ${issueId}\` first.`,
      ),
    );
    process.exit(1);
  }

  console.log(chalk.cyan(`\nOpening Claude session in: ${worktreePath}\n`));
  await openClaudeSession(worktreePath);
}
