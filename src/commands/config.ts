import chalk from "chalk";
import { execaCommand } from "execa";
import { join } from "node:path";
import {
  getGlobalConfig,
  getGlobalConfigPath,
  findProjectRoot,
  getProjectConfig,
} from "../lib/config.js";

function maskToken(token: string): string {
  if (token.length <= 8) return "****";
  return token.slice(0, 4) + "..." + token.slice(-4);
}

async function showConfig(): Promise<void> {
  const global = getGlobalConfig();

  console.log(chalk.bold("\nGlobal Config"));
  console.log(`  ${chalk.cyan("Path:")}       ${getGlobalConfigPath()}`);
  console.log(
    `  ${chalk.cyan("API Key:")}    ${global.linearApiKey ? maskToken(global.linearApiKey) : chalk.gray("(not set)")}`,
  );
  console.log(
    `  ${chalk.cyan("User ID:")}    ${global.linearUserId || chalk.gray("(not set)")}`,
  );

  const projectRoot = await findProjectRoot();
  if (!projectRoot) {
    console.log(chalk.gray("\nProject config not found in current directory."));
    console.log();
    return;
  }

  const project = await getProjectConfig(projectRoot);
  if (!project) {
    console.log(chalk.gray("\nProject config not found in current directory."));
    console.log();
    return;
  }

  console.log(chalk.bold("\nProject Config"));
  console.log(
    `  ${chalk.cyan("Path:")}         ${join(projectRoot, ".lcg.json")}`,
  );
  console.log(`  ${chalk.cyan("Worktree Dir:")} ${projectRoot}`);
  console.log(`  ${chalk.cyan("Base Branch:")}  ${project.baseBranch}`);
  console.log(
    `  ${chalk.cyan("Team:")}         ${project.teamKey} (${project.teamId})`,
  );
  if (project.branchPrefix) {
    console.log(`  ${chalk.cyan("Branch Prefix:")} ${project.branchPrefix}`);
  }
  if (project.postSetup) {
    console.log(`  ${chalk.cyan("Post-setup:")}   ${project.postSetup}`);
  }
  console.log();
}

export async function configCommand(options: {
  edit?: boolean;
  global?: boolean;
  project?: boolean;
}): Promise<void> {
  // No flags or only -g/-p without -e → show config
  if (!options.edit) {
    await showConfig();
    return;
  }

  // -e: open in editor
  const paths: string[] = [];

  if (options.global) {
    paths.push(getGlobalConfigPath());
  }

  if (options.project) {
    const projectRoot = await findProjectRoot();
    if (!projectRoot) {
      console.log(
        chalk.red(
          "프로젝트 설정을 찾을 수 없습니다. .lcg.json이 있는 디렉터리에서 실행하세요.",
        ),
      );
      process.exit(1);
    }
    paths.push(join(projectRoot, ".lcg.json"));
  }

  // -e without -g/-p → open both
  if (!options.global && !options.project) {
    paths.push(getGlobalConfigPath());
    const projectRoot = await findProjectRoot();
    if (projectRoot) {
      paths.push(join(projectRoot, ".lcg.json"));
    }
  }

  for (const p of paths) {
    console.log(chalk.gray(`Opening ${p}`));
  }

  await execaCommand(`open ${paths.map((p) => `"${p}"`).join(" ")}`, {
    shell: true,
  });
}
