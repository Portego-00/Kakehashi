import {
  parseFormattedNote,
  selectionHasNoteFormat,
  toggleNoteFormat,
} from "../note-formatting";

describe("note formatting", () => {
  it("leaves existing plain-text notes unchanged", () => {
    expect(parseFormattedNote("Remember the tree radical")).toEqual([
      { text: "Remember the tree radical", formats: [] },
    ]);
  });

  it("parses nested bold, italic, and underline formatting", () => {
    expect(
      parseFormattedNote(
        "Use <b>on-yomi <i><u>しょう</u></i></b> here",
      ),
    ).toEqual([
      { text: "Use ", formats: [] },
      { text: "on-yomi ", formats: ["bold"] },
      { text: "しょう", formats: ["bold", "italic", "underline"] },
      { text: " here", formats: [] },
    ]);
  });

  it("keeps malformed formatting markup visible", () => {
    expect(parseFormattedNote("Try <b>this")).toEqual([
      { text: "Try <b>this", formats: [] },
    ]);
  });

  it("wraps selected text and keeps it selected", () => {
    expect(toggleNoteFormat("on-yomi", { start: 0, end: 2 }, "bold")).toEqual({
      text: "<b>on</b>-yomi",
      selection: { start: 3, end: 5 },
    });
  });

  it("inserts an empty formatted range at the caret", () => {
    expect(toggleNoteFormat("音", { start: 1, end: 1 }, "italic")).toEqual({
      text: "音<i></i>",
      selection: { start: 4, end: 4 },
    });
  });

  it("removes formatting surrounding a selection", () => {
    expect(
      toggleNoteFormat("<u>meaning</u>", { start: 3, end: 10 }, "underline"),
    ).toEqual({
      text: "meaning",
      selection: { start: 0, end: 7 },
    });
  });

  it("detects the active format around selected text", () => {
    expect(
      selectionHasNoteFormat("<b>meaning</b>", { start: 3, end: 10 }, "bold"),
    ).toBe(true);
    expect(
      selectionHasNoteFormat("<b>meaning</b>", { start: 3, end: 10 }, "italic"),
    ).toBe(false);
  });

  it("detects and removes an outer format from nested formatted text", () => {
    const note = "<b><i>on</i></b>";
    const selection = { start: 6, end: 8 };

    expect(selectionHasNoteFormat(note, selection, "bold")).toBe(true);
    expect(selectionHasNoteFormat(note, selection, "italic")).toBe(true);
    expect(toggleNoteFormat(note, selection, "bold")).toEqual({
      text: "<i>on</i>",
      selection: { start: 3, end: 5 },
    });
  });
});
