import { describe, expect, it } from "vitest";
import { boundedIdChunks, boundedPage } from "./pagination";

describe("community read bounds", () => {
  it("bounds invalid and excessive page numbers", () => {
    expect(boundedPage("-4")).toBe(0);
    expect(boundedPage("999999")).toBe(100);
    expect(boundedPage("not-a-number")).toBe(0);
  });

  it("deduplicates, chunks, and hard-caps comment-like lookups", () => {
    const chunks = boundedIdChunks([...Array.from({ length: 80 }, (_, index) => `comment-${index}`), "comment-1"], 20, 50);
    expect(chunks).toHaveLength(3);
    expect(chunks.flat()).toHaveLength(50);
    expect(chunks.every((chunk) => chunk.length <= 20)).toBe(true);
  });
});
