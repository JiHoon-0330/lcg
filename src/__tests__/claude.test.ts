import { describe, it, expect } from "vitest";
import { buildDesignPrompt } from "../lib/claude.js";

describe("buildDesignPrompt", () => {
  it("should include issue title", () => {
    const result = buildDesignPrompt("Add user auth");
    expect(result).toContain('"Add user auth"');
  });

  it("should include description when provided", () => {
    const result = buildDesignPrompt("Add user auth", "Implement OAuth2 flow");
    expect(result).toContain("Implement OAuth2 flow");
  });

  it("should not include description block when omitted", () => {
    const result = buildDesignPrompt("Add user auth");
    expect(result).not.toContain("issue description:");
  });

  it("should always include design-related instructions", () => {
    const result = buildDesignPrompt("Fix bug");
    expect(result).toContain("design");
    expect(result).toContain("architecture");
  });

  it("should handle empty description same as undefined", () => {
    const withUndefined = buildDesignPrompt("Title", undefined);
    const withEmpty = buildDesignPrompt("Title", "");
    // empty string is falsy so same branch
    expect(withEmpty).toEqual(withUndefined);
  });
});
