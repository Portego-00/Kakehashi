import { describe, expect, it } from "vitest";
import { DEFAULT_SEARCH_STATE, searchHref, searchStateFromParams } from "./search-state";

describe("subject search URL state", () => {
  it("parses and bounds supported search parameters", () => {
    expect(searchStateFromParams({
      q: "日本",
      types: "vocabulary,invalid,kanji",
      srs: "guru,unknown",
      min: "8",
      max: "200",
      pages: "3",
    })).toEqual({
      query: "日本",
      types: ["vocabulary", "kanji"],
      srs: ["guru"],
      minLevel: 8,
      maxLevel: 60,
      visiblePages: 3,
    });
  });

  it("omits default values from the canonical URL", () => {
    expect(searchHref(DEFAULT_SEARCH_STATE)).toBe("/search");
    expect(searchHref({ ...DEFAULT_SEARCH_STATE, query: "nihon", minLevel: 2 })).toBe("/search?q=nihon&min=2");
  });
});
