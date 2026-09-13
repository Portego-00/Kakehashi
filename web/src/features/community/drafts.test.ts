import { beforeEach, describe, expect, it } from "vitest";
import { clearCommunityDraft, communityDraftKey, confirmOperation, getOrCreateOperationId, readCommunityDraft, writeCommunityDraft } from "./drafts";

describe("account-scoped community drafts", () => {
  beforeEach(() => window.localStorage.clear());

  it("keeps drafts isolated by account and clears only explicitly", () => {
    const first = communityDraftKey("learner-a", "new-issue"); const second = communityDraftKey("learner-b", "new-issue");
    writeCommunityDraft(first, { title: "Lost response" });
    expect(readCommunityDraft(first, { title: "" }).title).toBe("Lost response");
    expect(readCommunityDraft(second, { title: "" }).title).toBe("");
    clearCommunityDraft(first); expect(readCommunityDraft(first, { title: "" }).title).toBe("");
  });

  it("persists a reply operation id with its draft for a lost-response retry", () => {
    const key = communityDraftKey("learner-a", "reply:issue-1");
    writeCommunityDraft(key, { content: "Useful reply", requestId: "4eb17c96-884c-40b6-96a6-a70ef34be3ca" });
    expect(readCommunityDraft(key, { content: "", requestId: "" })).toEqual({ content: "Useful reply", requestId: "4eb17c96-884c-40b6-96a6-a70ef34be3ca" });
  });

  it("retains an operation id across retries until confirmation", () => {
    const operations = new Map<string, string>(); let sequence = 0;
    const create = () => `operation-${++sequence}`;
    expect(getOrCreateOperationId(operations, "issue:1", create)).toBe("operation-1");
    expect(getOrCreateOperationId(operations, "issue:1", create)).toBe("operation-1");
    confirmOperation(operations, "issue:1");
    expect(getOrCreateOperationId(operations, "issue:1", create)).toBe("operation-2");
  });
});
