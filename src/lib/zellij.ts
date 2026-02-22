import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir, homedir } from "node:os";

const LCG_CONFIG = [
  'tips "off"',
  "support_kitty_keyboard_protocol false",
  "keybinds clear-defaults=true {",
  "  shared {",
  '    bind "Ctrl q" { Detach; }',
  "  }",
  "}",
  "",
].join("\n");

function ensureLcgConfig(): string {
  const configDir = join(homedir(), ".config", "zellij");
  const configPath = join(configDir, "lcg.kdl");
  mkdirSync(configDir, { recursive: true });
  writeFileSync(configPath, LCG_CONFIG, "utf-8");
  return configPath;
}

export function startZellijWithClaude(
  sessionName: string,
  issueId: string,
): void {
  const layoutContent = `layout {
    pane command="lcg" {
        args "_setup" "${issueId}"
    }
}
`;
  const layoutPath = join(tmpdir(), `lcg-layout-${Date.now()}.kdl`);
  writeFileSync(layoutPath, layoutContent, "utf-8");

  try {
    const configPath = ensureLcgConfig();
    execFileSync(
      "zellij",
      [
        "-s",
        sessionName,
        "--config",
        configPath,
        "--new-session-with-layout",
        layoutPath,
      ],
      {
        stdio: "inherit",
      },
    );
  } finally {
    try {
      unlinkSync(layoutPath);
    } catch {
      // ignore cleanup errors
    }
  }
}

export function killZellijSession(sessionName: string): boolean {
  try {
    execFileSync("zellij", ["kill-session", sessionName], {
      stdio: "ignore",
    });
  } catch {
    // Session not running — ignore
  }
  try {
    execFileSync("zellij", ["delete-session", sessionName], {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

export function attachZellijSession(sessionName: string): void {
  execFileSync("zellij", ["attach", sessionName], {
    stdio: "inherit",
  });
}

export function zellijSessionExists(sessionName: string): boolean {
  try {
    const output = execFileSync("zellij", ["list-sessions"], {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    for (const line of output.split("\n")) {
      if (line.includes(sessionName) && !line.includes("EXITED")) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export function startZellijInWorktree(
  worktreePath: string,
  sessionName: string,
): void {
  const layoutContent = `layout {
    pane command="claude" {
    }
}
`;
  const layoutPath = join(tmpdir(), `lcg-layout-${Date.now()}.kdl`);
  writeFileSync(layoutPath, layoutContent, "utf-8");

  try {
    const configPath = ensureLcgConfig();
    execFileSync(
      "zellij",
      [
        "-s",
        sessionName,
        "--config",
        configPath,
        "--new-session-with-layout",
        layoutPath,
      ],
      { cwd: worktreePath, stdio: "inherit" },
    );
  } finally {
    try {
      unlinkSync(layoutPath);
    } catch {
      // ignore cleanup errors
    }
  }
}
