import { execaCommand, execa } from "execa";

export async function openClaudeSession(
  worktreePath: string,
  initialPrompt?: string,
): Promise<void> {
  const args = ["claude"];
  if (initialPrompt) {
    args.push("--prompt", initialPrompt);
  }

  await execaCommand(args.join(" "), {
    cwd: worktreePath,
    stdio: "inherit",
  });
}

export async function isClaudeSessionActive(
  worktreePath: string,
): Promise<boolean> {
  try {
    const { stdout } = await execa("pgrep", ["-af", "claude"]);
    return stdout.split("\n").some((line) => line.includes(worktreePath));
  } catch {
    return false;
  }
}
