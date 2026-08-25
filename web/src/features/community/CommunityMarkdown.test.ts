import { describe, expect, it } from "vitest";
import { isCommunityVideoUrl, safeCommunityMediaUrl } from "./CommunityMarkdown";

describe("community markdown media", () => {
  it("allows web media while rejecting executable and local protocols", () => {
    expect(safeCommunityMediaUrl("https://cdn.example.com/image.png")).toBe("https://cdn.example.com/image.png");
    expect(safeCommunityMediaUrl("javascript:alert(1)")).toBeNull();
    expect(safeCommunityMediaUrl("file:///etc/passwd")).toBeNull();
  });

  it("recognizes native issue video markdown", () => {
    expect(isCommunityVideoUrl("https://cdn.example.com/upload.webm?download=1")).toBe(true);
    expect(isCommunityVideoUrl("https://cdn.example.com/opaque", "Video")).toBe(true);
    expect(isCommunityVideoUrl("https://cdn.example.com/photo.jpg", "Image")).toBe(false);
  });
});
