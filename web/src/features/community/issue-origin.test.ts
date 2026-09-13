import { describe, expect, it } from "vitest";
import { hasWebIssueOrigin, WEB_ISSUE_ORIGIN_LABEL, webIssueOriginLabels } from "./issue-origin";

describe("community issue origin", () => {
  it("creates a reserved label for issues submitted by the web app", () => {
    expect(webIssueOriginLabels()).toEqual([WEB_ISSUE_ORIGIN_LABEL]);
  });

  it("recognizes only the exact web-origin label", () => {
    expect(hasWebIssueOrigin(["bug", WEB_ISSUE_ORIGIN_LABEL])).toBe(true);
    expect(hasWebIssueOrigin(["web", "origin:mobile"])).toBe(false);
    expect(hasWebIssueOrigin(null)).toBe(false);
  });
});
