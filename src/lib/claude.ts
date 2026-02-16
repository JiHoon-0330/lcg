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

export function buildDesignPrompt(
  issueTitle: string,
  issueDescription?: string,
): string {
  return [
    `I need help designing the implementation for: "${issueTitle}"`,
    issueDescription
      ? `\nHere's the issue description:\n${issueDescription}`
      : "",
    "\nPlease help me think through the design before we start coding.",
    "Consider: architecture, edge cases, testing strategy, and potential gotchas.",
    "Let's discuss before writing any code.",
  ]
    .filter(Boolean)
    .join("\n");
}
