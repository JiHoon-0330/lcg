import { describe, it, expect } from "vitest";
import { renderClaudeMd } from "../commands/start.js";

const DEFAULT_TEMPLATE = [
  "# {{identifier}} - {{title}}",
  "",
  "## Issue Description",
  "{{description}}",
  "",
  "## Comments",
  "{{comments}}",
  "",
  "## Instructions",
  "- Implement the changes as described",
].join("\n");

describe("renderClaudeMd", () => {
  it("should replace all template variables", () => {
    const result = renderClaudeMd(DEFAULT_TEMPLATE, {
      identifier: "LIN-123",
      title: "Add user auth",
      description: "Implement OAuth2 flow",
      comments: ["Looks good", "Need tests"],
    });

    expect(result).toContain("# LIN-123 - Add user auth");
    expect(result).toContain("Implement OAuth2 flow");
    expect(result).toContain("1. Looks good");
    expect(result).toContain("2. Need tests");
  });

  it("should use fallback when description is undefined", () => {
    const result = renderClaudeMd(DEFAULT_TEMPLATE, {
      identifier: "LIN-1",
      title: "Test",
      description: undefined,
      comments: [],
    });

    expect(result).toContain("No description provided");
  });

  it("should use fallback when comments are empty", () => {
    const result = renderClaudeMd(DEFAULT_TEMPLATE, {
      identifier: "LIN-1",
      title: "Test",
      comments: [],
    });

    expect(result).toContain("No comments");
  });

  it("should handle multiple occurrences of same placeholder", () => {
    const template = "{{title}} is {{title}}";
    const result = renderClaudeMd(template, {
      identifier: "X-1",
      title: "Hello",
      comments: [],
    });

    expect(result).toBe("Hello is Hello");
  });

  it("should number comments sequentially", () => {
    const result = renderClaudeMd("{{comments}}", {
      identifier: "X-1",
      title: "T",
      comments: ["First", "Second", "Third"],
    });

    expect(result).toBe("1. First\n2. Second\n3. Third");
  });
});
