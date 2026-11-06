import { buildCrosswordInput, eraseCrosswordCell } from "../crosswordInput";

describe("crossword grid input", () => {
  const keys = ["0:0", "0:1", "0:2", "0:3"];

  it("counts the trailing crossing kana shown in the reported Size answer", () => {
    const entry = buildCrosswordInput(keys, { "0:3": "さ" }, "おおき");
    expect(entry.answer).toBe("おおきさ");
    expect(entry.values).toEqual({ "0:0": "お", "0:1": "お", "0:2": "き", "0:3": "さ" });
    expect(entry.overflow).toBe(false);
  });

  it("fills only the gaps around leading and middle crossing kana", () => {
    expect(buildCrosswordInput(keys, { "0:0": "お", "0:2": "き" }, "おさ").answer).toBe("おおきさ");
  });

  it("still accepts a full word when crossing kana are already filled", () => {
    expect(buildCrosswordInput(keys, { "0:0": "お", "0:2": "き" }, "おおきさ").answer).toBe("おおきさ");
  });

  it("keeps the displayed crossing kana as the source of truth", () => {
    expect(buildCrosswordInput(keys, { "0:3": "さ" }, "おおきし").answer).toBe("おおきさ");
  });

  it("requires every gap and rejects input beyond the grid", () => {
    expect(buildCrosswordInput(keys, { "0:3": "さ" }, "おお").answer).toBeNull();
    expect(buildCrosswordInput(keys, { "0:3": "さ" }, "おおきさあ").overflow).toBe(true);
  });

  it("can check a word filled entirely by crossings without typing it again", () => {
    expect(buildCrosswordInput(keys, { "0:0": "お", "0:1": "お", "0:2": "き", "0:3": "さ" }, "").answer).toBe("おおきさ");
  });

  it("edits a tapped middle square without replacing the other grid letters", () => {
    const entry = buildCrosswordInput(keys, {}, "き", { values: { "0:0": "お", "0:1": "お", "0:2": "く", "0:3": "さ" }, startIndex: 2 });
    expect(entry.answer).toBe("おおきさ");
    expect(entry.cursorKey).toBe("0:3");
  });

  it("keeps unfinished romaji in the active square without treating it as kana", () => {
    const entry = buildCrosswordInput(keys, {}, "おおk");
    expect(entry.values).toEqual({ "0:0": "お", "0:1": "お" });
    expect(entry.pending).toBe("k");
    expect(entry.cursorKey).toBe("0:2");
    expect(entry.answer).toBeNull();
  });

  it("clears a deleted buffered kana instead of restoring the overwritten letter", () => {
    const entry = buildCrosswordInput(keys, {}, "お", { values: { "0:0": "あ", "0:1": "い", "0:3": "さ" }, clearCount: 2 });
    expect(entry.values).toEqual({ "0:0": "お", "0:3": "さ" });
  });

  it("backspaces over a crossing without erasing its known kana", () => {
    const entry = eraseCrosswordCell(keys, { "0:1": "お" }, { "0:0": "お", "0:1": "お" }, "0:2");
    expect(entry.startIndex).toBe(0);
    expect(entry.values).toEqual({ "0:1": "お" });
  });
});
