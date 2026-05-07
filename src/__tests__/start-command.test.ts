import { describe, expect, it } from "vitest";
import {
  getStartCommandEnv,
  getStartCommandValues,
  requireStartCommand,
  renderStartCommand,
} from "../lib/start-command.js";

describe("start command helpers", () => {
  it("requires a configured command", () => {
    expect(() => requireStartCommand(undefined)).toThrow(
      "startCommand is required",
    );
    expect(() => requireStartCommand("   ")).toThrow(
      "startCommand is required",
    );
    expect(requireStartCommand(" claude ")).toBe("claude");
  });

  it("derives the worktree folder name from the worktree path", () => {
    expect(
      getStartCommandValues("ENG-123", "/Users/me/worktrees/ENG-123"),
    ).toEqual({
      issueId: "ENG-123",
      worktreePath: "/Users/me/worktrees/ENG-123",
      worktreeFolderName: "ENG-123",
    });
  });

  it("renders template variables in configured commands", () => {
    const values = getStartCommandValues("ENG-123", "/worktrees/ENG-123");

    expect(renderStartCommand("open {{worktreeFolderName}}", values)).toBe(
      "open ENG-123",
    );
    expect(renderStartCommand("code {{worktreePath}}", values)).toBe(
      "code /worktrees/ENG-123",
    );
  });

  it("exposes shell env variables for custom commands", () => {
    const values = getStartCommandValues("ENG-123", "/worktrees/ENG-123");

    expect(getStartCommandEnv(values)).toMatchObject({
      ISSUE_ID: "ENG-123",
      issue_id: "ENG-123",
      WORKTREE_PATH: "/worktrees/ENG-123",
      worktree_path: "/worktrees/ENG-123",
      WORKTREE_FOLDER_NAME: "ENG-123",
      worktree_folder_name: "ENG-123",
      worktree_fold_name: "ENG-123",
    });
  });
});
