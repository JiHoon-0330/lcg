import chalk from "chalk";
import ora from "ora";
import { execaCommand } from "execa";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, access } from "node:fs/promises";

async function findLcgRoot(): Promise<string> {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 5; i++) {
    try {
      await access(join(dir, "package.json"));
      const pkg = JSON.parse(
        await readFile(join(dir, "package.json"), "utf-8"),
      );
      if (pkg.name === "lcg") return dir;
    } catch {
      // not found, go up
    }
    dir = dirname(dir);
  }
  throw new Error("Could not find LCG installation directory");
}

export async function updateCommand(): Promise<void> {
  let lcgRoot: string;
  try {
    lcgRoot = await findLcgRoot();
  } catch {
    console.log(chalk.red("LCG installation directory not found."));
    process.exit(1);
  }

  console.log(chalk.bold("\nUpdating LCG...\n"));
  console.log(chalk.gray(`Directory: ${lcgRoot}\n`));

  const spinner = ora("git pull...").start();
  try {
    const pull = await execaCommand("git pull", { cwd: lcgRoot });
    spinner.succeed(`git pull: ${pull.stdout.trim()}`);
  } catch (err) {
    spinner.fail("git pull failed");
    console.error(chalk.red(String(err)));
    process.exit(1);
  }

  const installSpinner = ora("pnpm install...").start();
  try {
    await execaCommand("pnpm install", { cwd: lcgRoot });
    installSpinner.succeed("Dependencies installed");
  } catch (err) {
    installSpinner.fail("pnpm install failed");
    console.error(chalk.red(String(err)));
    process.exit(1);
  }

  const buildSpinner = ora("pnpm build...").start();
  try {
    await execaCommand("pnpm build", { cwd: lcgRoot });
    buildSpinner.succeed("Build complete");
  } catch (err) {
    buildSpinner.fail("Build failed");
    console.error(chalk.red(String(err)));
    process.exit(1);
  }

  try {
    const pkg = JSON.parse(
      await readFile(join(lcgRoot, "package.json"), "utf-8"),
    );
    console.log(chalk.bold(`\nLCG updated to v${pkg.version}`));
  } catch {
    console.log(chalk.bold("\nLCG updated successfully"));
  }
}
