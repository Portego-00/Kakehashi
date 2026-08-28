import { describe, expect, it } from "vitest";
import { safeInternalPath } from "./navigation";

describe("safeInternalPath", () => {
  it("keeps internal paths with search and hash", () => {
    expect(safeInternalPath("/reviews?resume=1#answer")).toBe("/reviews?resume=1#answer");
  });

  it("rejects external and scheme-relative redirects", () => {
    expect(safeInternalPath("https://example.com/phish")).toBe("/dashboard");
    expect(safeInternalPath("//example.com/phish")).toBe("/dashboard");
    expect(safeInternalPath("/\\example.com/phish")).toBe("/dashboard");
  });
});
