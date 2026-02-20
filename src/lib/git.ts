import simpleGit, { type SimpleGit } from "simple-git";
import { resolve, basename } from "node:path";
import { access } from "node:fs/promises";
import type { WorktreeInfo } from "../types/index.js";

export function getGit(cwd?: string): SimpleGit {
  return simpleGit(cwd);
}

export async function getRepoRoot(cwd?: string): Promise<string> {
  const git = getGit(cwd);
  const root = await git.revparse(["--show-toplevel"]);
  return root.trim();
}

export function getWorktreeDir(
  worktreeBaseDir: string,
  issueId: string,
): string {
  return resolve(worktreeBaseDir, issueId);
}

export async function createWorktree(
  repoPath: string,
  worktreeBaseDir: string,
  issueId: string,
  branchName: string,
  baseBranch: string,
): Promise<string> {
  const git = getGit(repoPath);
  const worktreePath = getWorktreeDir(worktreeBaseDir, issueId);

  // Fetch latest and update base branch
  await git.fetch();
  await git.raw([
    "update-ref",
    `refs/heads/${baseBranch}`,
    `origin/${baseBranch}`,
  ]);

  // Check if branch already exists locally
  const branches = await git.branchLocal();
  const branchExists = branches.all.includes(branchName);

  if (branchExists) {
    // Use existing branch
    await git.raw(["worktree", "add", worktreePath, branchName]);
  } else {
    // Create worktree with a new branch based on baseBranch
    await git.raw([
      "worktree",
      "add",
      worktreePath,
      "-b",
      branchName,
      `origin/${baseBranch}`,
    ]);
  }

  return worktreePath;
}

export async function removeWorktree(
  repoRoot: string,
  worktreePath: string,
  deleteBranch?: boolean,
): Promise<void> {
  const git = getGit(repoRoot);

  // Resolve branch name before removing the worktree
  let branchName: string | null = null;
  if (deleteBranch) {
    const worktrees = await listWorktrees(repoRoot);
    const wt = worktrees.find((w) => w.path === worktreePath);
    branchName = wt?.branch ?? null;
  }

  await git.raw(["worktree", "remove", worktreePath, "--force"]);

  if (branchName) {
    try {
      await git.deleteLocalBranch(branchName, true);
    } catch {
      // Branch may not exist anymore
    }
  }
}

export interface RawWorktree {
  path: string;
  branch: string | null;
  head: string;
  bare: boolean;
}

export function parseWorktreePorcelain(raw: string): RawWorktree[] {
  const worktrees: RawWorktree[] = [];
  let current: Partial<RawWorktree> = {};

  for (const line of raw.split("\n")) {
    if (line.startsWith("worktree ")) {
      if (current.path) worktrees.push(current as RawWorktree);
      current = { path: line.slice(9), branch: null, bare: false };
    } else if (line.startsWith("HEAD ")) {
      current.head = line.slice(5);
    } else if (line.startsWith("branch ")) {
      current.branch = line.slice(7).replace("refs/heads/", "");
    } else if (line === "bare") {
      current.bare = true;
    }
  }
  if (current.path) worktrees.push(current as RawWorktree);

  return worktrees;
}

export async function listWorktrees(repoRoot: string): Promise<RawWorktree[]> {
  const git = getGit(repoRoot);
  const raw = await git.raw(["worktree", "list", "--porcelain"]);
  return parseWorktreePorcelain(raw);
}

export async function getWorktreeStatus(
  repoPath: string,
  worktreeBaseDir: string,
): Promise<WorktreeInfo[]> {
  const worktrees = await listWorktrees(repoPath);
  const base = resolve(worktreeBaseDir);
  const results: WorktreeInfo[] = [];

  for (const wt of worktrees) {
    if (!wt.path.startsWith(base)) continue;

    const issueId = basename(wt.path);
    const wtGit = getGit(wt.path);

    let filesChanged = 0;
    let insertions = 0;
    let deletions = 0;

    try {
      const diffStat = await wtGit.diffSummary(["HEAD"]);
      filesChanged = diffStat.files.length;
      insertions = diffStat.insertions;
      deletions = diffStat.deletions;
    } catch {
      // Empty worktree or no commits
    }

    results.push({
      issueId,
      branch: wt.branch ?? "detached",
      path: wt.path,
      filesChanged,
      insertions,
      deletions,
    });
  }

  return results;
}

export async function pushBranch(
  worktreePath: string,
  branchName: string,
): Promise<void> {
  const git = getGit(worktreePath);
  await git.push(["-u", "origin", branchName]);
}

export async function hasCommits(
  worktreePath: string,
  baseBranch: string,
): Promise<boolean> {
  const git = getGit(worktreePath);
  try {
    const log = await git.log([`origin/${baseBranch}..HEAD`]);
    return log.total > 0;
  } catch {
    return false;
  }
}

export async function worktreeExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
