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
      vocabularyTypes: [],
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

  it("round-trips multiple vocabulary types with the other search filters", () => {
    const state = searchStateFromParams({ q: "japan", vocab: " Proper Noun,verbal noun,proper noun, ", min: "2", pages: "3" });
    expect(state.vocabularyTypes).toEqual(["proper noun", "verbal noun"]);
    const href = searchHref(state);
    expect(href).toContain("vocab=proper+noun%2Cverbal+noun");
    expect(searchStateFromParams(Object.fromEntries(new URL(href, "https://example.com").searchParams))).toEqual(state);
  });
});
