import { basename } from "node:path";
import { execaCommand } from "execa";

export interface StartCommandValues {
  issueId: string;
  worktreePath: string;
  worktreeFolderName: string;
}

export function requireStartCommand(command?: string): string {
  const startCommand = command?.trim();
  if (!startCommand) {
    throw new Error(
      [
        "startCommand is required.",
        'Set "startCommand" in <worktree-root>/.lcg.json or run `lcg init` again.',
        'Example: "startCommand": "claude"',
      ].join(" "),
    );
  }
  return startCommand;
}

export function getStartCommandValues(
  issueId: string,
  worktreePath: string,
): StartCommandValues {
  return {
    issueId,
    worktreePath,
    worktreeFolderName: basename(worktreePath),
  };
}

export function renderStartCommand(
  command: string,
  values: StartCommandValues,
): string {
  return command
    .replace(/\{\{issueId\}\}/g, values.issueId)
    .replace(/\{\{worktreePath\}\}/g, values.worktreePath)
    .replace(/\{\{worktreeFolderName\}\}/g, values.worktreeFolderName);
}

export function getStartCommandEnv(
  values: StartCommandValues,
): NodeJS.ProcessEnv {
  return {
    ISSUE_ID: values.issueId,
    issue_id: values.issueId,
    WORKTREE_PATH: values.worktreePath,
    worktree_path: values.worktreePath,
    WORKTREE_FOLDER_NAME: values.worktreeFolderName,
    worktree_folder_name: values.worktreeFolderName,
    worktree_fold_name: values.worktreeFolderName,
  };
}

export async function runStartCommand(
  command: string | undefined,
  issueId: string,
  worktreePath: string,
): Promise<void> {
  const startCommand = requireStartCommand(command);
  const values = getStartCommandValues(issueId, worktreePath);

  await execaCommand(renderStartCommand(startCommand, values), {
    cwd: worktreePath,
    env: getStartCommandEnv(values),
    stdio: "inherit",
    shell: true,
  });
}
