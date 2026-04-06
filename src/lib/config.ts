import Conf from "conf";
import { readFile, writeFile, access } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import type { GlobalConfig, ProjectConfig } from "../types/index.js";

const globalConf = new Conf<GlobalConfig>({
  projectName: "lcg",
  schema: {
    linearApiKey: { type: "string", default: "" },
    defaultWorktreeDir: { type: "string", default: "" },
    repoPath: { type: "string", default: "" },
    linearUserId: { type: "string", default: "" },
  },
});

export function getGlobalConfig(): GlobalConfig {
  return {
    linearApiKey: globalConf.get("linearApiKey"),
    defaultWorktreeDir: globalConf.get("defaultWorktreeDir"),
    repoPath: globalConf.get("repoPath"),
    linearUserId: globalConf.get("linearUserId"),
  };
}

export function setGlobalConfig(config: Partial<GlobalConfig>): void {
  for (const [key, value] of Object.entries(config)) {
    globalConf.set(key as keyof GlobalConfig, value as string);
  }
}

export function getGlobalConfigPath(): string {
  return globalConf.path;
}

const PROJECT_CONFIG_FILE = ".lcg.json";

export async function getProjectConfig(
  repoRoot: string,
): Promise<ProjectConfig | null> {
  const configPath = join(repoRoot, PROJECT_CONFIG_FILE);
  try {
    await access(configPath);
    const raw = await readFile(configPath, "utf-8");
    return JSON.parse(raw) as ProjectConfig;
  } catch {
    return null;
  }
}

export async function saveProjectConfig(
  repoRoot: string,
  config: ProjectConfig,
): Promise<void> {
  const configPath = join(repoRoot, PROJECT_CONFIG_FILE);
  await writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

export function resolveIssueId(
  projectConfig: ProjectConfig,
  issueId: string,
): string {
  if (/^\d+$/.test(issueId)) {
    return `${projectConfig.teamKey}-${issueId}`;
  }
  return issueId;
}

export function ensureGlobalConfig(): GlobalConfig {
  const config = getGlobalConfig();
  if (!config.linearApiKey) {
    throw new Error("Linear API key not configured. Run `lcg init` first.");
  }
  if (!config.linearUserId) {
    throw new Error("Linear user ID not configured. Run `lcg init` first.");
  }
  return config;
}

/**
 * Find the project root by searching up from startDir for .lcg.json
 */
export async function findProjectRoot(
  startDir?: string,
): Promise<string | null> {
  let dir = resolve(startDir ?? process.cwd());

  while (true) {
    const configPath = join(dir, PROJECT_CONFIG_FILE);
    try {
      await access(configPath);
      return dir;
    } catch {
      // not found, go up
    }
    const parent = dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }
  return null;
}

export interface ProjectContext {
  projectConfig: ProjectConfig;
  worktreeDir: string;
  repoPath: string;
}

/**
 * Resolve project context from cwd.
 * Finds .lcg.json by traversing up, derives worktreeDir and repoPath.
 */
export async function resolveProjectContext(
  startDir?: string,
): Promise<ProjectContext> {
  const projectRoot = await findProjectRoot(startDir);
  if (!projectRoot) {
    throw new Error(
      "프로젝트 설정을 찾을 수 없습니다. .lcg.json이 있는 디렉터리에서 실행하거나 `lcg init`을 먼저 실행하세요.",
    );
  }

  const projectConfig = await getProjectConfig(projectRoot);
  if (!projectConfig) {
    throw new Error(
      "프로젝트 설정을 읽을 수 없습니다. `lcg init`을 다시 실행하세요.",
    );
  }

  const worktreeDir = projectRoot;
  const repoPath = resolve(projectRoot, projectConfig.baseBranch);

  return { projectConfig, worktreeDir, repoPath };
}
