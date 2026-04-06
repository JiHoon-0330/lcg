import chalk from "chalk";
import { execaCommand } from "execa";
import { join } from "node:path";
import { getGlobalConfigPath, findProjectRoot } from "../lib/config.js";

export async function configCommand(options: {
  global?: boolean;
  project?: boolean;
}): Promise<void> {
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

  // 둘 다 지정하지 않으면 둘 다 열기
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
