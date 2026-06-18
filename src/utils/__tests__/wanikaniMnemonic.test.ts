import {
  normalizeWaniKaniMnemonicMarkup,
  stripWaniKaniMnemonicMarkup,
  tokenizeWaniKaniMnemonic,
} from "../wanikaniMnemonic";

describe("wanikaniMnemonic", () => {
  it("tokenizes standard WaniKani mnemonic tags", () => {
    expect(
      tokenizeWaniKaniMnemonic(
        "Remember the <kanji>car</kanji> reading <reading>しゃ</reading>.",
      ),
    ).toEqual([
      { type: "text", text: "Remember the " },
      { type: "kanji", text: "car" },
      { type: "text", text: " reading " },
      { type: "reading", text: "しゃ" },
      { type: "text", text: "." },
    ]);
  });

  it("normalizes the malformed reading closing tag seen in mnemonic data", () => {
    expect(
      stripWaniKaniMnemonicMarkup("The reading is <reading>hah</erading> (は)."),
    ).toBe("The reading is hah (は).");

    expect(
      tokenizeWaniKaniMnemonic("The reading is <reading>hah</erading> (は)."),
    ).toEqual([
      { type: "text", text: "The reading is " },
      { type: "reading", text: "hah" },
      { type: "text", text: " (は)." },
    ]);
  });

  it("normalizes tag fragments that already lost their opening angle brackets", () => {
    expect(normalizeWaniKaniMnemonicMarkup("reading>hah/erading> (は)")).toBe(
      "<reading>hah</reading> (は)",
    );
    expect(stripWaniKaniMnemonicMarkup("reading>hah/erading> (は)")).toBe(
      "hah (は)",
    );
  });

  it("decodes escaped tags before stripping markup", () => {
    expect(
      tokenizeWaniKaniMnemonic(
        "Say &lt;reading&gt;は&lt;/reading&gt; &amp; continue.",
      ),
    ).toEqual([
      { type: "text", text: "Say " },
      { type: "reading", text: "は" },
      { type: "text", text: " & continue." },
    ]);
  });

  it("keeps Japanese tag contents as plain text", () => {
    expect(stripWaniKaniMnemonicMarkup("Read <ja>日本語</ja> aloud.")).toBe(
      "Read 日本語 aloud.",
    );
  });
});
