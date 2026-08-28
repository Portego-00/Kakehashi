import { describe, expect, it } from "vitest";
import { COMMUNITY_ISSUE_READ_SELECT, publicCommunityIssue } from "./public-issue";

describe("public community issue model", () => {
  it("uses an explicit database projection", () => {
    expect(COMMUNITY_ISSUE_READ_SELECT).not.toContain("*");
    expect(COMMUNITY_ISSUE_READ_SELECT).not.toContain("user_api_key");
  });

  it("strips private and unknown database fields from browser responses", () => {
    expect(publicCommunityIssue({
      id: "issue-1",
      user_id: "wk-user-1",
      user_api_key: "must-not-leave-the-server",
      user_email: "private@example.com",
      user_username: "Learner",
      title: "Example issue",
      labels: ["origin:web"],
      status: "open",
    })).toEqual({
      id: "issue-1",
      user_username: "Learner",
      title: "Example issue",
      labels: ["origin:web"],
      status: "open",
    });
  });

  it("rejects non-record values", () => {
    expect(publicCommunityIssue(null)).toBeNull();
    expect(publicCommunityIssue([])).toBeNull();
  });
});
