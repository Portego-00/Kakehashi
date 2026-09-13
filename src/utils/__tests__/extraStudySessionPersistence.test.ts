import {
  EXTRA_STUDY_SESSION_STORAGE_KEYS,
  getAccountScopedExtraStudySessionStorageKey,
} from "../extraStudySessionPersistence";

describe("account-scoped extra study session keys", () => {
  it("keeps context sentence sessions isolated by user", () => {
    const baseKey =
      EXTRA_STUDY_SESSION_STORAGE_KEYS.CONTEXT_SENTENCE_PRACTICE;

    expect(getAccountScopedExtraStudySessionStorageKey(baseKey, "user-a")).toBe(
      `${baseKey}:user:user-a`,
    );
    expect(getAccountScopedExtraStudySessionStorageKey(baseKey, "user-b")).not.toBe(
      getAccountScopedExtraStudySessionStorageKey(baseKey, "user-a"),
    );
  });

  it("encodes IDs before using them in storage keys", () => {
    expect(
      getAccountScopedExtraStudySessionStorageKey("session", " account/a "),
    ).toBe("session:user:account%2Fa");
  });

  it("rejects an empty account ID", () => {
    expect(() =>
      getAccountScopedExtraStudySessionStorageKey("session", "  "),
    ).toThrow("A user ID is required");
  });
});
