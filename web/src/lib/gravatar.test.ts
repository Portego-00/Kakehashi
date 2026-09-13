import { describe, expect, it } from "vitest";
import { gravatarHash, gravatarUrl, gravatarUrlFromHash, normalizeGravatarEmail } from "./gravatar";

describe("Gravatar helpers", () => {
  it("normalizes and validates profile emails", () => {
    expect(normalizeGravatarEmail("  MyEmailAddress@example.com ")).toBe("myemailaddress@example.com");
    expect(normalizeGravatarEmail("not-an-email")).toBe("");
  });

  it("builds the same MD5-based avatar URL used by the mobile app", () => {
    expect(gravatarHash(" MyEmailAddress@example.com ")).toBe("0bc83cb571cd1c50ba6f3e8a78ef1346");
    expect(gravatarUrl("MyEmailAddress@example.com", 32, "test-session")).toBe(
      "https://www.gravatar.com/avatar/0bc83cb571cd1c50ba6f3e8a78ef1346?d=404&s=64&v=test-session",
    );
  });

  it("builds a URL from a public hash without needing the private email", () => {
    expect(gravatarUrlFromHash(" 0BC83CB571CD1C50BA6F3E8A78EF1346 ", 24)).toBe(
      "https://www.gravatar.com/avatar/0bc83cb571cd1c50ba6f3e8a78ef1346?d=404&s=48",
    );
    expect(gravatarHash("not-an-email")).toBeNull();
    expect(gravatarUrlFromHash("not-a-hash", 24)).toBeNull();
  });
});
