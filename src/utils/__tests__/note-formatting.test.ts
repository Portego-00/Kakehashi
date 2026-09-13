import {
  getNoteLinkSearchText,
  getNoteSubjectLinkAtSelection,
  mapSourceNoteSelectionToVisual,
  mapVisualNoteSelectionToSource,
  normalizeFormattedNoteSegments,
  parseFormattedNote,
  removeNoteSubjectLink,
  selectionHasNoteFormat,
  serializeFormattedNote,
  setNoteSubjectLink,
  toggleNoteFormat,
  toggleNoteSubjectLink,
} from "../note-formatting";

describe("note formatting", () => {
  it("leaves existing plain-text notes unchanged", () => {
    expect(parseFormattedNote("Remember the tree radical")).toEqual([
      { text: "Remember the tree radical", formats: [] },
    ]);
  });

  it("parses nested bold, italic, and underline formatting", () => {
    expect(
      parseFormattedNote("Use <b>on-yomi <i><u>しょう</u></i></b> here"),
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

  it("does not duplicate text when an unclosed tag follows matching formatting", () => {
    expect(parseFormattedNote("<b>first</b><b>unfinished")).toEqual([
      { text: "first", formats: ["bold"] },
      { text: "<b>unfinished", formats: [] },
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

  it("round-trips visual editor runs through the existing note format", () => {
    const runs = [
      { text: "Compare ", formats: [] },
      {
        text: "橋",
        formats: ["bold" as const],
        subjectId: 440,
      },
      {
        text: " and はし",
        formats: ["italic" as const, "underline" as const],
        subjectId: 440,
      },
      { text: "\n🧠", formats: [] },
    ];

    const stored = serializeFormattedNote(runs);
    expect(stored).toBe(
      'Compare <a href="wk://subject/440"><b>橋</b><i><u> and はし</u></i></a>\n🧠',
    );
    expect(parseFormattedNote(stored)).toEqual(runs);
  });

  it("round-trips text that looks like note markup without interpreting it", () => {
    const runs = [
      {
        text: "Literal <b>word</b>, </a>, malformed <i>, & entity",
        formats: [],
      },
      {
        text: " <u>linked text</u>",
        formats: ["underline" as const],
        subjectId: 440,
      },
    ];

    const stored = serializeFormattedNote(runs);
    expect(stored).toBe(
      'Literal &lt;b&gt;word&lt;/b&gt;, &lt;/a&gt;, malformed &lt;i&gt;, &amp; entity<a href="wk://subject/440"><u> &lt;u&gt;linked text&lt;/u&gt;</u></a>',
    );
    expect(parseFormattedNote(stored)).toEqual(runs);
  });

  it("validates and merges visual editor bridge runs", () => {
    expect(
      normalizeFormattedNoteSegments([
        { text: "日", formats: ["bold", "bold"], subjectId: 22 },
        { text: "本", formats: ["bold"], subjectId: 22 },
      ]),
    ).toEqual([{ text: "日本", formats: ["bold"], subjectId: 22 }]);

    expect(
      normalizeFormattedNoteSegments([
        { text: "unsafe", formats: ["script"], subjectId: 22 },
      ]),
    ).toBeNull();
    expect(
      normalizeFormattedNoteSegments([
        { text: "bad target", formats: [], subjectId: -1 },
      ]),
    ).toBeNull();
  });

  it.each([
    'Try <a href="wk://subject/440">橋',
    'Try <a href="https://example.com/440">橋</a>',
  ])("keeps malformed subject-link markup visible: %s", (note) => {
    expect(parseFormattedNote(note)).toEqual([{ text: note, formats: [] }]);
  });

  it("inserts a subject link around selected text", () => {
    expect(
      setNoteSubjectLink("See bridge here", { start: 4, end: 10 }, 42, "橋"),
    ).toEqual({
      text: 'See <a href="wk://subject/42">bridge</a> here',
      selection: { start: 36, end: 36 },
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
    expect(getNoteSubjectLinkAtSelection(note, { start: 30, end: 36 })).toEqual(
      { subjectId: 42, text: "bridge" },
    );
  });

  it("expands a selection crossing link markup instead of leaving broken tags", () => {
    const note = 'See <a href="wk://subject/42">bridge</a> today';
    const crossingSelection = { start: 0, end: 33 };

    expect(getNoteLinkSearchText(note, crossingSelection)).toBe("See bridge");
    expect(
      setNoteSubjectLink(note, crossingSelection, 99, "Different"),
    ).toEqual({
      text: '<a href="wk://subject/99">See bridge</a> today',
      selection: { start: 36, end: 36 },
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
      removeNoteSubjectLink('See <a href="wk://subject/42">bridge</a> here', {
        start: 30,
        end: 36,
      }),
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
      selection: { start: 36, end: 36 },
    });
  });

  it("adds subject characters to selected text and leaves the caret ready to continue the link", () => {
    const linked = setNoteSubjectLink("See bridge here", { start: 4, end: 10 }, 42, "橋", "橋");
    expect(linked.text).toBe('See <a href="wk://subject/42">bridge 橋</a> here');
    expect(linked.selection).toEqual({ start: 38, end: 38 });
    const typed = linked.text.slice(0, linked.selection.start) + "!" + linked.text.slice(linked.selection.end);
    expect(parseFormattedNote(typed)[1]).toEqual({ text: "bridge 橋!", formats: [], subjectId: 42 });
  });

  it("does not duplicate subject characters already ending the selected label", () => {
    const note = "<b>bridge 橋</b>";
    expect(setNoteSubjectLink(note, { start: 0, end: note.length }, 42, "橋", "橋").text)
      .toBe('<a href="wk://subject/42"><b>bridge 橋</b></a>');
  });

  it("appends characters in the final label format without doubling existing whitespace", () => {
    const note = "<i>the </i><b>bridge </b>";
    expect(setNoteSubjectLink(note, { start: 0, end: note.length }, 42, "橋", "橋").text)
      .toBe('<a href="wk://subject/42"><i>the </i><b>bridge 橋</b></a>');
  });

  it("preserves the caret on Change and optionally appends characters to its existing label", () => {
    const note = '<a href="wk://subject/42">bridge</a>';
    expect(setNoteSubjectLink(note, { start: 28, end: 28 }, 999, "川")).toEqual({
      text: '<a href="wk://subject/999">bridge</a>',
      selection: { start: 29, end: 29 },
    });
    const appended = setNoteSubjectLink(note, { start: 28, end: 28 }, 99, "川", "川");
    expect(appended.text).toBe('<a href="wk://subject/99">bridge 川</a>');
    expect(appended.selection).toEqual({ start: 34, end: 34 });
    expect(setNoteSubjectLink("See ", { start: 4, end: 4 }, 42, "橋", "橋").text)
      .toBe('See <a href="wk://subject/42">橋</a>');
  });

  it("stops linking at a caret without erasing either side of the existing link", () => {
    const note = 'See <a href="wk://subject/42">bridge</a> here';
    const result = toggleNoteSubjectLink(note, { start: 33, end: 33 });
    expect(result.text).toBe('See <a href="wk://subject/42">bri</a><a href="wk://subject/42">dge</a> here');
    expect(getNoteSubjectLinkAtSelection(result.text, result.selection)).toBeNull();
    const typed = result.text.slice(0, result.selection.start) + "new" + result.text.slice(result.selection.end);
    expect(parseFormattedNote(typed)).toEqual([
      { text: "See ", formats: [] },
      { text: "bri", formats: [], subjectId: 42 },
      { text: "new", formats: [] },
      { text: "dge", formats: [], subjectId: 42 },
      { text: " here", formats: [] },
    ]);
  });

  it.each(["start", "end"] as const)("moves a caret at the %s outside the link", (edge) => {
    const note = 'See <a href="wk://subject/42">bridge</a> here';
    const offset = edge === "start" ? note.indexOf("bridge") : note.indexOf("</a>");
    const result = toggleNoteSubjectLink(note, { start: offset, end: offset });
    expect(result.text).toBe(note);
    expect(result.selection).toEqual(edge === "start" ? { start: 4, end: 4 } : { start: 40, end: 40 });
  });

  it("removes linking only from the selected part, preserving its nested formatting", () => {
    const note = 'See <a href="wk://subject/42"><b>bri<i>d&amp;g</i>e</b></a> here';
    const result = toggleNoteSubjectLink(note, { start: note.indexOf("d&amp;g"), end: note.indexOf("d&amp;g") + "d&amp;g".length });
    expect(parseFormattedNote(result.text)).toEqual([
      { text: "See ", formats: [] },
      { text: "bri", formats: ["bold"], subjectId: 42 },
      { text: "d&g", formats: ["bold", "italic"] },
      { text: "e", formats: ["bold"], subjectId: 42 },
      { text: " here", formats: [] },
    ]);
    expect(mapSourceNoteSelectionToVisual(result.text, result.selection)).toEqual({ start: 7, end: 10 });
  });

  it("keeps other typing formats when stopping a link at a caret", () => {
    const note = '<a href="wk://subject/42"><b><u>bridge</u></b></a>';
    const offset = note.indexOf("bridge") + 3;
    const result = toggleNoteSubjectLink(note, { start: offset, end: offset });
    const typed = result.text.slice(0, result.selection.start) + "new" + result.text.slice(result.selection.end);
    expect(parseFormattedNote(typed)).toEqual([
      { text: "bri", formats: ["bold", "underline"], subjectId: 42 },
      { text: "new", formats: ["bold", "underline"] },
      { text: "dge", formats: ["bold", "underline"], subjectId: 42 },
    ]);
  });

  it.each([
    '<a href="wk://subject/42"><b>A&amp;B</b><i>橋</i></a>',
    '<u><a href="wk://subject/42">日本<b>語</b></a></u>',
  ])("unlinks every visible selection without changing other characters or formats in %s", (note) => {
    const original = parseFormattedNote(note).flatMap((segment) =>
      segment.text.split("").map((text) => ({ ...segment, text })),
    );
    for (let start = 0; start < original.length; start += 1) {
      for (let end = start + 1; end <= original.length; end += 1) {
        const result = toggleNoteSubjectLink(note, mapVisualNoteSelectionToSource(note, { start, end }));
        const actual = parseFormattedNote(result.text).flatMap((segment) =>
          segment.text.split("").map((text) => ({ ...segment, text })),
        );
        const expected = original.map((character, index) => {
          if (index < start || index >= end) return character;
          return { text: character.text, formats: character.formats };
        });
        expect(actual).toEqual(expected);
        expect(mapSourceNoteSelectionToVisual(result.text, result.selection)).toEqual({ start, end });
        expect(getNoteSubjectLinkAtSelection(result.text, result.selection)).toBeNull();
      }
    }
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

describe("note editor selection mapping", () => {
  it.each([
    "plain 日本語 🧠 text",
    "<b>A&amp;B</b> tail",
    'Before <a href="wk://subject/440"><b>橋</b><i>はし</i></a> after',
    "<b>outer <i>inner</i> end</b>",
    "<unknown>A&lt;B</unknown>",
    "<b>unclosed &amp; literal",
    "<b>first</b><b>unfinished",
    "<b>crossed<i>tags</b>",
    '<a href="wk://subject/440">outer <a href="wk://subject/441">inner</a>',
  ])("preserves every visible range through source for %s", (source) => {
    const visibleText = parseFormattedNote(source).map((run) => run.text).join("");
    for (let start = 0; start <= visibleText.length; start += 1) {
      for (let end = start; end <= visibleText.length; end += 1) {
        const selection = { start, end };
        const sourceSelection = mapVisualNoteSelectionToSource(source, selection);
        expect(mapSourceNoteSelectionToVisual(source, sourceSelection)).toEqual(selection);
      }
    }
  });

  it("selects the text inside nested tags and expands encoded character boundaries", () => {
    const source = '<a href="wk://subject/440"><b>A&amp;B</b></a>';
    const entityStart = source.indexOf("&amp;");
    expect(mapVisualNoteSelectionToSource(source, { start: 1, end: 2 })).toEqual({
      start: entityStart,
      end: entityStart + 5,
    });
    expect(mapSourceNoteSelectionToVisual(source, {
      start: entityStart + 1,
      end: entityStart + 3,
    })).toEqual({ start: 1, end: 2 });
    expect(mapSourceNoteSelectionToVisual(source, { start: 2, end: 2 }))
      .toEqual({ start: 0, end: 0 });
    expect(mapVisualNoteSelectionToSource(source, { start: 3, end: 3 }))
      .toEqual({ start: source.indexOf("</b>"), end: source.indexOf("</b>") });
  });

  it("clamps empty notes and stale selections to their visible text", () => {
    expect(mapVisualNoteSelectionToSource("<b></b>", { start: 3, end: 9 }))
      .toEqual({ start: 0, end: 0 });
    expect(mapSourceNoteSelectionToVisual("<b></b>", { start: 3, end: 9 }))
      .toEqual({ start: 0, end: 0 });
    expect(mapVisualNoteSelectionToSource("<b>Hi</b>", { start: -2, end: 90 }))
      .toEqual({ start: 3, end: 5 });
    expect(mapSourceNoteSelectionToVisual("<b>Hi</b>", { start: -2, end: 90 }))
      .toEqual({ start: 0, end: 2 });
  });
});
