import { describe, expect, it } from "vitest";
import { identityFromUserPayload } from "./identity-model";

describe("community identity", () => {
  it("uses the stable WaniKani user id shared by the native community", () => {
    expect(identityFromUserPayload({ data: { id: "5a6a5234-a392-4a87-8f3f-33342afe8a42", username: "KakeLearner", level: 12 } })).toEqual({
      id: "5a6a5234-a392-4a87-8f3f-33342afe8a42",
      username: "KakeLearner",
      level: 12,
      email: "KakeLearner@users.noreply.local",
    });
  });

  it("keeps legacy/mocked sessions working when an id is absent", () => {
    expect(identityFromUserPayload({ data: { username: "KakeLearner", level: "not-a-level" } })).toMatchObject({ id: "kakelearner", username: "KakeLearner", level: 0 });
    expect(identityFromUserPayload({ data: { username: "   " } })).toBeNull();
  });

  it("uses a normalized valid Gravatar email when the browser supplies one", () => {
    const payload = { data: { id: "wk-user", username: "KakeLearner", level: 12 } };
    expect(identityFromUserPayload(payload, " MyEmailAddress@example.com ")?.email).toBe("myemailaddress@example.com");
    expect(identityFromUserPayload(payload, "not-an-email")?.email).toBe("KakeLearner@users.noreply.local");
  });
});
