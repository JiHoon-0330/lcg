import Conf from "conf";
import { readFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
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

export function ensureGlobalConfig(): GlobalConfig {
  const config = getGlobalConfig();
  if (!config.linearApiKey) {
    throw new Error("Linear API key not configured. Run `lcg init` first.");
  }
  if (!config.linearUserId) {
    throw new Error("Linear user ID not configured. Run `lcg init` first.");
  }
  if (!config.repoPath) {
    throw new Error(
      "Git repository path not configured. Run `lcg init` first.",
    );
  }
  if (!config.defaultWorktreeDir) {
    throw new Error("Worktree directory not configured. Run `lcg init` first.");
  }
  return config;
}
