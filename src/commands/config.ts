import chalk from "chalk";
import { execaCommand } from "execa";
import { join } from "node:path";
import { getGlobalConfigPath, ensureGlobalConfig } from "../lib/config.js";

export async function configCommand(options: {
  global?: boolean;
  project?: boolean;
}): Promise<void> {
  const paths: string[] = [];

  if (options.global) {
    paths.push(getGlobalConfigPath());
  }

  if (options.project) {
    const globalConfig = ensureGlobalConfig();
    paths.push(join(globalConfig.defaultWorktreeDir, ".lcg.json"));
  }

  // 둘 다 지정하지 않으면 둘 다 열기
  if (!options.global && !options.project) {
    const globalConfig = ensureGlobalConfig();
    paths.push(getGlobalConfigPath());
    paths.push(join(globalConfig.defaultWorktreeDir, ".lcg.json"));
  }

  for (const p of paths) {
    console.log(chalk.gray(`Opening ${p}`));
  }

  await execaCommand(`open ${paths.map((p) => `"${p}"`).join(" ")}`, {
    shell: true,
  });
}
