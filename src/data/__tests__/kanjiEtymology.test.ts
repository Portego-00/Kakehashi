import {
  getKanjiEtymology,
  hasKanjiEtymology,
} from "../kanjiEtymology";
import { KANJI_ETYMOLOGIES } from "../kanjiEtymology.generated";
import { WANI_KANI_KANJI } from "../wanikaniKanjiCatalog.generated";

const catalogSnapshot = require(
  "../../../scripts/data/wanikani-kanji-catalog.json"
) as {
  items: { character: string; level: number }[];
};

describe("bundled kanji etymology data", () => {
  const snapshotCharacters = catalogSnapshot.items.map(
    ({ character }) => character
  );
  const dataCharacters = Object.keys(KANJI_ETYMOLOGIES);

  it("exactly covers the committed 2,102-kanji WaniKani snapshot", () => {
    expect(snapshotCharacters).toHaveLength(2102);
    expect(new Set(snapshotCharacters).size).toBe(2102);
    expect(WANI_KANI_KANJI).toEqual(snapshotCharacters);
    expect([...dataCharacters].sort()).toEqual(
      [...snapshotCharacters].sort()
    );
  });

  it("contains only single Unicode-scalar keys with substantive sourced text", () => {
    for (const [character, entry] of Object.entries(KANJI_ETYMOLOGIES)) {
      expect(Array.from(character)).toHaveLength(1);
      expect(entry.explanation.length).toBeGreaterThanOrEqual(20);
      expect(entry.explanation).not.toMatch(/\{\{|\[\[|undefined/i);
      expect(entry.source.title.length).toBeGreaterThan(3);
      expect(new URL(entry.source.url).protocol).toBe("https:");
    }
  });

  it("returns formation data for representative native and simplified forms", () => {
    expect(getKanjiEtymology("休")?.explanation).toMatch(/person.*tree/i);
    expect(getKanjiEtymology("気")?.note).toMatch(/traditional form/i);
    expect(getKanjiEtymology("芸")?.note).toMatch(/traditional form 藝/i);
    expect(getKanjiEtymology("弁")?.explanation).toMatch(
      /simplified merger.*辨.*瓣.*辯/i
    );
    expect(getKanjiEtymology("働")?.note).toMatch(/Japanese-coined/i);
    expect(getKanjiEtymology("込")?.explanation).toMatch(/walk.*enter/i);
    expect(getKanjiEtymology("峠")?.explanation).toMatch(
      /mountain.*up.*down/i
    );
    expect(getKanjiEtymology("々")?.explanation).toMatch(/iteration mark/i);
  });

  it("does not treat vocabulary or empty input as kanji", () => {
    expect(getKanjiEtymology("地下鉄")).toBeNull();
    expect(getKanjiEtymology("日本")).toBeNull();
    expect(getKanjiEtymology("")).toBeNull();
    expect(getKanjiEtymology(null)).toBeNull();
    expect(getKanjiEtymology(undefined)).toBeNull();
    expect(hasKanjiEtymology("地下鉄")).toBe(false);
  });

  it("returns null for a single character outside the WaniKani snapshot", () => {
    expect(getKanjiEtymology("龘")).toBeNull();
    expect(hasKanjiEtymology("龘")).toBe(false);
  });
});
