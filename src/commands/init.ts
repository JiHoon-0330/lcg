import { input, select } from "@inquirer/prompts";
import chalk from "chalk";
import ora from "ora";
import { resolve, basename } from "node:path";
import {
  getGlobalConfig,
  setGlobalConfig,
  getGlobalConfigPath,
  getProjectConfig,
  saveProjectConfig,
} from "../lib/config.js";
import {
  initLinearClient,
  validateApiKey,
  getTeams,
  getTeamMembers,
} from "../lib/linear.js";
import { getRepoRoot } from "../lib/git.js";
import type { ProjectConfig } from "../types/index.js";

export async function initCommand(): Promise<void> {
  const existing = getGlobalConfig();
  const isReinit = !!existing.linearApiKey;

  console.log(chalk.bold("\n🔧 LCG Init - Configure your workspace\n"));
  if (isReinit) {
    console.log(
      chalk.gray("기존 설정이 감지되었습니다. Enter로 유지할 수 있습니다.\n"),
    );
  }

  // 1. Linear API Key
  const LINEAR_API_URL = "https://linear.app/settings/account/security";
  console.log(chalk.gray(`API 키 발급: ${LINEAR_API_URL}\n`));
  const apiKey = await input({
    message: "Enter your Linear API key:",
    default: existing.linearApiKey || undefined,
    validate: (val) => (val.length > 0 ? true : "API key is required"),
  });

  if (apiKey !== existing.linearApiKey) {
    const spinner = ora("Validating API key...").start();
    const valid = await validateApiKey(apiKey);
    if (!valid) {
      spinner.fail("Invalid API key");
      process.exit(1);
    }
    spinner.succeed("API key validated");
  }

  setGlobalConfig({ linearApiKey: apiKey });
  initLinearClient(apiKey);

  // 2. Select team
  const teams = await getTeams();
  if (teams.length === 0) {
    console.log(chalk.red("No teams found in your Linear workspace."));
    process.exit(1);
  }

  const teamId = await select({
    message: "Select your Linear team:",
    choices: teams.map((t) => ({
      name: `${t.key} - ${t.name}`,
      value: t.id,
    })),
  });

  // 3. Select user from team members
  const members = await getTeamMembers(teamId);

  const existingMemberIndex = existing.linearUserId
    ? members.findIndex((m) => m.id === existing.linearUserId)
    : -1;
  const memberChoices = members.map((m) => ({
    name: `${m.name} (${m.email})`,
    value: m.id,
  }));

  const userId = await select({
    message: "Select your Linear account:",
    choices: memberChoices,
    default: existingMemberIndex >= 0 ? existing.linearUserId : undefined,
  });

  setGlobalConfig({ linearUserId: userId });

  // 4. Worktree root directory
  const defaultDir = existing.defaultWorktreeDir || process.cwd();
  const worktreeDir = await input({
    message: "Worktree root directory:",
    default: defaultDir,
  });
  const resolvedWorktreeDir = resolve(worktreeDir);
  setGlobalConfig({ defaultWorktreeDir: resolvedWorktreeDir });

  // 5. Base branch (= git repo folder name)
  const existingBranch = existing.repoPath
    ? basename(existing.repoPath)
    : "main";
  const baseBranch = await input({
    message: "Default branch name:",
    default: existingBranch,
  });

  const repoPath = resolve(resolvedWorktreeDir, baseBranch);
  let repoRoot: string;
  try {
    repoRoot = await getRepoRoot(repoPath);
  } catch {
    console.log(
      chalk.red(
        `${repoPath} is not a git repository.\n` +
          `"${resolvedWorktreeDir}/${baseBranch}" 경로에 ` +
          "git repo가 존재해야 합니다.",
      ),
    );
    process.exit(1);
  }
  setGlobalConfig({ repoPath: repoRoot });

  // 6. Project config (preserve existing template if re-init)
  const existingProject = await getProjectConfig(resolvedWorktreeDir);
  const projectConfig: ProjectConfig = {
    teamId,
    branchPrefix: existingProject?.branchPrefix ?? "",
    baseBranch,
    claudeMdTemplate:
      existingProject?.claudeMdTemplate ??
      [
        "# {{identifier}} - {{title}}",
        "",
        "## Issue Description",
        "{{description}}",
        "",
        "## Comments",
        "{{comments}}",
        "",
        "## Design Notes",
        "{{designNotes}}",
        "",
        "## Instructions",
        "- Read the issue description and design notes carefully",
        "- Implement the changes as described",
        "- Write tests for new functionality",
        "- Follow existing code patterns and conventions",
      ].join("\n"),
  };

  await saveProjectConfig(resolvedWorktreeDir, projectConfig);

  console.log(chalk.green(`\nGlobal config: ${getGlobalConfigPath()}`));
  console.log(chalk.green(`Project config: ${resolvedWorktreeDir}/.lcg.json`));
  console.log(chalk.green(`Worktree root: ${resolvedWorktreeDir}`));
  console.log(chalk.green(`Git repo: ${repoRoot}`));
  console.log(
    chalk.bold("\nSetup complete! Try `lcg issues` to see your issues."),
  );
}
