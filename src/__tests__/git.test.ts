import { describe, it, expect } from "vitest";
import { getWorktreeDir, parseWorktreePorcelain } from "../lib/git.js";

describe("getWorktreeDir", () => {
  it("should resolve worktree path from base dir and issue id", () => {
    const result = getWorktreeDir("/home/user/worktrees", "LIN-123");
    expect(result).toBe("/home/user/worktrees/LIN-123");
  });

  it("should handle trailing slash in base dir", () => {
    const result = getWorktreeDir("/tmp/worktrees/", "LIN-456");
    expect(result).toBe("/tmp/worktrees/LIN-456");
  });

  it("should handle issue id with various formats", () => {
    const result = getWorktreeDir("/worktrees", "PROJ-99");
    expect(result).toBe("/worktrees/PROJ-99");
  });
});

describe("parseWorktreePorcelain", () => {
  it("should parse a single worktree entry", () => {
    const input = [
      "worktree /home/user/repo",
      "HEAD abc123def456",
      "branch refs/heads/main",
      "",
    ].join("\n");

    const result = parseWorktreePorcelain(input);
    expect(result).toEqual([
      {
        path: "/home/user/repo",
        head: "abc123def456",
        branch: "main",
        bare: false,
        prunable: false,
      },
    ]);
  });

  it("should parse multiple worktree entries", () => {
    const input = [
      "worktree /home/user/worktrees/main",
      "HEAD abc123",
      "branch refs/heads/main",
      "",
      "worktree /home/user/worktrees/LIN-123",
      "HEAD def456",
      "branch refs/heads/feat/user-auth",
      "",
    ].join("\n");

    const result = parseWorktreePorcelain(input);
    expect(result).toHaveLength(2);
    expect(result[0].path).toBe("/home/user/worktrees/main");
    expect(result[0].branch).toBe("main");
    expect(result[1].path).toBe("/home/user/worktrees/LIN-123");
    expect(result[1].branch).toBe("feat/user-auth");
  });

  it("should handle bare worktree", () => {
    const input = [
      "worktree /home/user/repo.git",
      "HEAD abc123",
      "bare",
      "",
    ].join("\n");

    const result = parseWorktreePorcelain(input);
    expect(result).toEqual([
      {
        path: "/home/user/repo.git",
        head: "abc123",
        branch: null,
        bare: true,
        prunable: false,
      },
    ]);
  });

  it("should handle detached HEAD (no branch line)", () => {
    const input = ["worktree /home/user/repo", "HEAD abc123", ""].join("\n");

    const result = parseWorktreePorcelain(input);
    expect(result[0].branch).toBeNull();
  });

  it("should return empty array for empty input", () => {
    expect(parseWorktreePorcelain("")).toEqual([]);
  });

  it("should strip refs/heads/ prefix from branch names", () => {
    const input = [
      "worktree /repo",
      "HEAD abc",
      "branch refs/heads/feature/deep/nested/branch",
      "",
    ].join("\n");

    const result = parseWorktreePorcelain(input);
    expect(result[0].branch).toBe("feature/deep/nested/branch");
  });
});
