import { describe, it, expect } from "vitest";
import { parseIssueIdentifier } from "../lib/linear.js";

describe("parseIssueIdentifier", () => {
  it("should parse standard identifier", () => {
    const result = parseIssueIdentifier("LIN-123");
    expect(result).toEqual({ teamKey: "LIN", number: 123 });
  });

  it("should parse single-letter team key", () => {
    const result = parseIssueIdentifier("A-1");
    expect(result).toEqual({ teamKey: "A", number: 1 });
  });

  it("should parse long team key", () => {
    const result = parseIssueIdentifier("FRONTEND-9999");
    expect(result).toEqual({ teamKey: "FRONTEND", number: 9999 });
  });

  it("should throw on lowercase team key", () => {
    expect(() => parseIssueIdentifier("lin-123")).toThrow(
      "Invalid issue identifier format",
    );
  });

  it("should throw on missing number", () => {
    expect(() => parseIssueIdentifier("LIN-")).toThrow(
      "Invalid issue identifier format",
    );
  });

  it("should throw on missing team key", () => {
    expect(() => parseIssueIdentifier("-123")).toThrow(
      "Invalid issue identifier format",
    );
  });

  it("should throw on empty string", () => {
    expect(() => parseIssueIdentifier("")).toThrow(
      "Invalid issue identifier format",
    );
  });

  it("should throw on plain number", () => {
    expect(() => parseIssueIdentifier("123")).toThrow(
      "Invalid issue identifier format",
    );
  });

  it("should throw on mixed case", () => {
    expect(() => parseIssueIdentifier("Lin-123")).toThrow(
      "Invalid issue identifier format",
    );
  });

  it("should include the invalid input in error message", () => {
    expect(() => parseIssueIdentifier("bad")).toThrow("bad");
  });
});
