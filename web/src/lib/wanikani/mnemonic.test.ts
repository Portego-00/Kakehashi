import { describe, expect, it } from "vitest";
import { normalizeMnemonicMarkup, stripMnemonicMarkup, tokenizeMnemonic } from "./mnemonic";

describe("WaniKani mnemonic markup", () => {
  it("tokenizes every semantic tag and preserves Japanese language metadata", () => {
    expect(tokenizeMnemonic("A <radical>woman</radical> <kanji>child</kanji> is a <vocabulary>girl</vocabulary> with <meaning>meaning</meaning>; <ja><reading>じょし</reading></ja> is <em>formal</em> and <i>classified</i>."))
      .toEqual([
        { type: "text", text: "A " },
        { type: "radical", text: "woman" },
        { type: "text", text: " " },
        { type: "kanji", text: "child" },
        { type: "text", text: " is a " },
        { type: "vocabulary", text: "girl" },
        { type: "text", text: " with " },
        { type: "meaning", text: "meaning" },
        { type: "text", text: "; " },
        { type: "reading", text: "じょし", language: "ja" },
        { type: "text", text: " is " },
        { type: "em", text: "formal" },
        { type: "text", text: " and " },
        { type: "em", text: "classified" },
        { type: "text", text: "." },
      ]);
  });

  it("decodes numeric entities and escaped tags", () => {
    expect(stripMnemonicMarkup("&#x41;&#x20;&lt;kanji&gt;woman&lt;/kanji&gt; &amp; child")).toBe("A woman & child");
  });

  it("normalizes malformed reading tags present in WaniKani data", () => {
    expect(normalizeMnemonicMarkup("reading>hah/erading> (は)")).toBe("<reading>hah</reading> (は)");
    expect(tokenizeMnemonic("The reading is <reading>hah</erading>."))
      .toEqual([
        { type: "text", text: "The reading is " },
        { type: "reading", text: "hah" },
        { type: "text", text: "." },
      ]);
  });

  it("keeps only safe HTTP links and drops unknown elements without losing their text", () => {
    expect(tokenizeMnemonic('<a href="https://www.wanikani.com/vocabulary/女子" onclick="steal()">safe</a> <a href="javascript:alert(1)">unsafe</a> <future-tag>future text</future-tag>'))
      .toEqual([
        { type: "text", text: "safe", href: "https://www.wanikani.com/vocabulary/女子" },
        { type: "text", text: " unsafe future text" },
      ]);
  });

  it("preserves live entities, Unicode whitespace, and paragraph boundaries as text", () => {
    expect(stripMnemonicMarkup("A &amp; B &gt; C\n\nKeep\u00a0this space.")).toBe("A & B > C\n\nKeep\u00a0this space.");
  });
});
