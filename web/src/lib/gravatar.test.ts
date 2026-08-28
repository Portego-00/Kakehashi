import { describe, expect, it } from "vitest";
import { gravatarUrl, normalizeGravatarEmail } from "./gravatar";

describe("Gravatar helpers", () => {
  it("normalizes and validates profile emails", () => {
    expect(normalizeGravatarEmail("  MyEmailAddress@example.com ")).toBe("myemailaddress@example.com");
    expect(normalizeGravatarEmail("not-an-email")).toBe("");
  });

  it("builds the same MD5-based avatar URL used by the mobile app", () => {
    expect(gravatarUrl("MyEmailAddress@example.com", 32, "test-session")).toBe(
      "https://www.gravatar.com/avatar/0bc83cb571cd1c50ba6f3e8a78ef1346?d=404&s=64&v=test-session",
    );
  });
});
