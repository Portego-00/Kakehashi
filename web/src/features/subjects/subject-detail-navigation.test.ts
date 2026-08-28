import { describe, expect, it } from "vitest";
import { resolveSubjectReturnPath, subjectReturnLabel } from "./subject-detail-navigation";

describe("subject detail return navigation", () => {
  it("preserves a bounded song route for hard-navigation fallback", () => {
    const path = resolveSubjectReturnPath("/music?song=song_123");

    expect(path).toBe("/music?song=song_123");
    expect(subjectReturnLabel(path)).toBe("Back to lyrics");
  });

  it("falls back to subject search for unsupported or external routes", () => {
    expect(resolveSubjectReturnPath("/settings")).toBe("/search");
    expect(resolveSubjectReturnPath("https://example.com/phish")).toBe("/search");
    expect(resolveSubjectReturnPath("//example.com/phish")).toBe("/search");
  });
});
