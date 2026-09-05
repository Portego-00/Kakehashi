import { describe, expect, it } from "vitest";
import {
  COMMUNITY_COMMENT_READ_SELECT,
  COMMUNITY_ISSUE_READ_SELECT,
  publicCommunityComment,
  publicCommunityIssue,
} from "./public-issue";

describe("public community author model", () => {
  it("uses explicit issue and comment database projections", () => {
    expect(COMMUNITY_ISSUE_READ_SELECT).not.toContain("*");
    expect(COMMUNITY_ISSUE_READ_SELECT).not.toContain("user_api_key");
    expect(COMMUNITY_COMMENT_READ_SELECT).not.toContain("*");
    expect(COMMUNITY_COMMENT_READ_SELECT).not.toContain("user_api_key");
    expect(COMMUNITY_COMMENT_READ_SELECT.split(",")).toEqual(expect.arrayContaining([
      "id",
      "issue_id",
      "user_email",
      "user_id",
      "reply_to_comment_id",
    ]));
  });

  it("converts private issue identity into a public hash and trusted badges", () => {
    expect(publicCommunityIssue({
      id: "issue-1",
      user_id: "wk-user-1",
      user_api_key: "must-not-leave-the-server",
      user_email: " PORTEGO2000@HOTMAIL.ES ",
      user_username: "Portego",
      title: "Example issue",
      labels: ["origin:web"],
      status: "open",
    }, new Set(["portego"]))).toEqual({
      id: "issue-1",
      user_username: "Portego",
      title: "Example issue",
      labels: ["origin:web"],
      status: "open",
      user_gravatar_hash: "a0404fec191efe5a1dc06003bc85f8a9",
      is_developer: true,
      is_patreon_supporter: true,
    });
  });

  it("strips private comment identity and matches supporters case-insensitively", () => {
    const comment = publicCommunityComment({
      id: "comment-1",
      issue_id: "issue-1",
      user_id: "wk-user-2",
      user_email: " MyEmailAddress@example.com ",
      user_username: " Learner ",
      content: "A reply",
      likes_count: 2,
      private_note: "must-not-leave-the-server",
    }, new Set(["learner"]));

    expect(comment).toEqual({
      id: "comment-1",
      issue_id: "issue-1",
      user_username: " Learner ",
      content: "A reply",
      likes_count: 2,
      user_gravatar_hash: "0bc83cb571cd1c50ba6f3e8a78ef1346",
      is_developer: false,
      is_patreon_supporter: true,
    });
    expect(comment).not.toHaveProperty("user_id");
    expect(comment).not.toHaveProperty("user_email");
    expect(comment).not.toHaveProperty("private_note");
  });

  it("requires the exact developer username and a normalized exact email", () => {
    expect(publicCommunityIssue({ user_username: "portego", user_email: "portego2000@hotmail.es" })).toMatchObject({ is_developer: false });
    expect(publicCommunityIssue({ user_username: "Portego", user_email: "another@example.com" })).toMatchObject({ is_developer: false });
  });

  it("does not request Gravatar for legacy web placeholder emails", () => {
    expect(publicCommunityIssue({
      user_username: "LegacyLearner",
      user_email: "LegacyLearner@users.noreply.local",
    })).toMatchObject({ user_gravatar_hash: null, is_developer: false });
  });

  it("rejects non-record values", () => {
    expect(publicCommunityIssue(null)).toBeNull();
    expect(publicCommunityIssue([])).toBeNull();
    expect(publicCommunityComment(null)).toBeNull();
    expect(publicCommunityComment([])).toBeNull();
  });
});
