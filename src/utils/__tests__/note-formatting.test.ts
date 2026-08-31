import {
  getNoteLinkSearchText,
  getNoteSubjectLinkAtSelection,
  parseFormattedNote,
  removeNoteSubjectLink,
  selectionHasNoteFormat,
  setNoteSubjectLink,
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

  it("parses a valid subject link without exposing its stored markup", () => {
    expect(
      parseFormattedNote(
        'Compare <a href="wk://subject/440">橋</a> with this word',
      ),
    ).toEqual([
      { text: "Compare ", formats: [] },
      { text: "橋", formats: [], subjectId: 440 },
      { text: " with this word", formats: [] },
    ]);
  });

  it("preserves nested note formatting on subject links", () => {
    expect(
      parseFormattedNote(
        '<b>Remember <a href="wk://subject/440"><i>橋</i></a></b>',
      ),
    ).toEqual([
      { text: "Remember ", formats: ["bold"] },
      {
        text: "橋",
        formats: ["bold", "italic"],
        subjectId: 440,
      },
    ]);
  });

  it.each([
    'Try <a href="wk://subject/440">橋',
    'Try <a href="https://example.com/440">橋</a>',
  ])("keeps malformed subject-link markup visible: %s", (note) => {
    expect(parseFormattedNote(note)).toEqual([{ text: note, formats: [] }]);
  });

  it("inserts a subject link around selected text", () => {
    expect(
      setNoteSubjectLink(
        "See bridge here",
        { start: 4, end: 10 },
        42,
        "橋",
      ),
    ).toEqual({
      text: 'See <a href="wk://subject/42">bridge</a> here',
      selection: { start: 30, end: 36 },
    });
  });

  it("replaces an existing subject-link target while preserving its label", () => {
    const note = 'See <a href="wk://subject/42">bridge</a> here';

    expect(
      setNoteSubjectLink(note, { start: 30, end: 36 }, 99, "Different"),
    ).toEqual({
      text: 'See <a href="wk://subject/99">bridge</a> here',
      selection: { start: 30, end: 36 },
    });
    expect(
      getNoteSubjectLinkAtSelection(note, { start: 30, end: 36 }),
    ).toEqual({ subjectId: 42, text: "bridge" });
  });

  it("expands a selection crossing link markup instead of leaving broken tags", () => {
    const note = 'See <a href="wk://subject/42">bridge</a> today';
    const crossingSelection = { start: 0, end: 33 };

    expect(getNoteLinkSearchText(note, crossingSelection)).toBe("See bridge");
    expect(
      setNoteSubjectLink(note, crossingSelection, 99, "Different"),
    ).toEqual({
      text: '<a href="wk://subject/99">See bridge</a> today',
      selection: { start: 26, end: 36 },
    });
  });

  it("keeps subject links atomic when formatting crosses a link boundary", () => {
    const note = 'See <a href="wk://subject/42">bridge</a> here';
    const result = toggleNoteFormat(
      note,
      { start: 32, end: note.length },
      "underline",
    );

    expect(result.text).toBe(
      'See <u><a href="wk://subject/42">bridge</a> here</u>',
    );
    expect(parseFormattedNote(result.text)).toEqual([
      { text: "See ", formats: [] },
      { text: "bridge", formats: ["underline"], subjectId: 42 },
      { text: " here", formats: ["underline"] },
    ]);
  });

  it("expands across surrounding formats before combining multiple links", () => {
    const note =
      '<b><a href="wk://subject/1">one</a></b> and <i><a href="wk://subject/2">two</a></i>';
    const selection = {
      start: note.indexOf("one"),
      end: note.indexOf("two") + "two".length,
    };

    const linked = setNoteSubjectLink(note, selection, 99, "fallback");
    expect(linked.text).toBe(
      '<a href="wk://subject/99"><b>one</b> and <i>two</i></a>',
    );
    expect(parseFormattedNote(linked.text)).toEqual([
      { text: "one", formats: ["bold"], subjectId: 99 },
      { text: " and ", formats: [], subjectId: 99 },
      { text: "two", formats: ["italic"], subjectId: 99 },
    ]);

    const formatted = toggleNoteFormat(note, selection, "underline");
    expect(parseFormattedNote(formatted.text)).toEqual([
      { text: "one", formats: ["underline", "bold"], subjectId: 1 },
      { text: " and ", formats: ["underline"] },
      { text: "two", formats: ["underline", "italic"], subjectId: 2 },
    ]);
  });

  it("removes a subject link and keeps its label selected", () => {
    expect(
      removeNoteSubjectLink(
        'See <a href="wk://subject/42">bridge</a> here',
        { start: 30, end: 36 },
      ),
    ).toEqual({
      text: "See bridge here",
      selection: { start: 4, end: 10 },
    });
  });

  it("uses the selected subject label when linking from a caret", () => {
    expect(
      setNoteSubjectLink("Remember ", { start: 9, end: 9 }, 88, "橋"),
    ).toEqual({
      text: 'Remember <a href="wk://subject/88">橋</a>',
      selection: { start: 35, end: 36 },
    });
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
