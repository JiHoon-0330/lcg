import { input, select, search } from "@inquirer/prompts";
import chalk from "chalk";
import ora from "ora";
import { resolve, basename, join, dirname } from "node:path";
import { homedir } from "node:os";
import { mkdir, writeFile, readdir } from "node:fs/promises";
import { execaCommand } from "execa";
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

function expandTilde(p: string): string {
  return p.startsWith("~/") ? join(homedir(), p.slice(2)) : p;
}

async function listDirs(parentDir: string): Promise<string[]> {
  try {
    const entries = await readdir(parentDir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

async function inputPath(
  message: string,
  defaultValue: string,
): Promise<string> {
  return search({
    message,
    source: async (term) => {
      const raw = term ?? defaultValue;
      const expanded = expandTilde(raw);
      const resolved = resolve(expanded);

      // List subdirectories of the current input path
      const parent = expanded.endsWith("/") ? resolved : dirname(resolved);
      const prefix = expanded.endsWith("/") ? "" : basename(resolved);
      const dirs = await listDirs(parent);

      const filtered = dirs.filter((d) =>
        d.toLowerCase().startsWith(prefix.toLowerCase()),
      );

      const choices = filtered.map((d) => {
        const full = join(parent, d);
        // Show with ~ prefix for readability
        const display = full.startsWith(homedir())
          ? "~" + full.slice(homedir().length)
          : full;
        return { name: display, value: full };
      });

      // Always include the current input as-is at the top
      const currentResolved = resolve(expanded);
      const currentDisplay = currentResolved.startsWith(homedir())
        ? "~" + currentResolved.slice(homedir().length)
        : currentResolved;
      choices.unshift({ name: currentDisplay, value: currentResolved });

      return choices;
    },
  });
}

async function ensureZellij(): Promise<void> {
  try {
    await execaCommand("zellij --version");
  } catch {
    console.log(
      chalk.yellow("zellij가 설치되어 있지 않습니다. 설치를 시작합니다...\n"),
    );
    const spinner = ora("Installing zellij via Homebrew...").start();
    try {
      await execaCommand("brew install zellij", { stdio: "inherit" });
      spinner.succeed("zellij 설치 완료");
    } catch {
      spinner.fail("zellij 설치 실패");
      console.log(
        chalk.red(
          "Homebrew로 설치할 수 없습니다. 수동으로 설치해주세요: https://zellij.dev/documentation/installation",
        ),
      );
      process.exit(1);
    }
  }

  // Write lcg-specific zellij config
  const configDir = join(homedir(), ".config", "zellij");
  await mkdir(configDir, { recursive: true });
  const lcgConfigPath = join(configDir, "lcg.kdl");
  await writeFile(
    lcgConfigPath,
    ['tips "off"', "keybinds clear-defaults=true {", "}", ""].join("\n"),
    "utf-8",
  );
}

export async function initCommand(): Promise<void> {
  await ensureZellij();

  const existing = getGlobalConfig();
  const isReinit = !!existing.linearApiKey;

  console.log(chalk.bold("\n🔧 LCG Init - Configure your workspace\n"));
  if (isReinit) {
    console.log(
      chalk.gray("기존 설정이 감지되었습니다. Enter로 유지할 수 있습니다.\n"),
    );
  }

  // 1. Linear API Key
  const LINEAR_API_URL =
    "https://linear.app/developers/graphql#personal-api-keys";
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

  const selectedTeam = await select({
    message: "Select your Linear team:",
    choices: teams.map((t) => ({
      name: `${t.key} - ${t.name}`,
      value: t,
    })),
  });

  const teamId = selectedTeam.id;
  const teamKey = selectedTeam.key;

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
  const resolvedWorktreeDir = await inputPath(
    "Worktree root directory:",
    defaultDir,
  );
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
    teamKey,
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
        "## Instructions",
        "- 먼저 이슈 내용을 분석하고 사용자와 구현 계획을 논의한 뒤 작업을 시작하세요",
        "- Follow existing code patterns and conventions",
        "- Write tests for new functionality",
      ].join("\n"),
  };

  // 7. Post-setup script
  const postSetup = await input({
    message:
      "Post-setup script (워크트리 생성 후 실행할 명령어, e.g. pnpm install, npm ci):",
    default: existingProject?.postSetup ?? "",
  });
  projectConfig.postSetup = postSetup.trim();

  await saveProjectConfig(resolvedWorktreeDir, projectConfig);

  console.log(chalk.green(`\nGlobal config: ${getGlobalConfigPath()}`));
  console.log(chalk.green(`Project config: ${resolvedWorktreeDir}/.lcg.json`));
  console.log(chalk.green(`Worktree root: ${resolvedWorktreeDir}`));
  console.log(chalk.green(`Git repo: ${repoRoot}`));
  console.log(
    chalk.bold("\nSetup complete! Try `lcg issues` to see your issues."),
  );
}
