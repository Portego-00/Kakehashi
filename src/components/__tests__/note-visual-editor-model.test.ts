import {
  describeNoteVisualEditorSelection,
  getNoteVisualEditorRunsSignature,
  normalizeNoteVisualEditorRuns,
  normalizeNoteVisualEditorSubjectTypes,
  truncateNoteVisualEditorRuns,
} from "../note-visual-editor-model";

describe("note visual editor model", () => {
  it("accepts only restricted serializable runs and canonicalizes formats", () => {
    expect(
      normalizeNoteVisualEditorRuns([
        {
          text: "橋",
          formats: ["underline", "bold", "script", "bold"],
          subjectId: 440,
          html: "<script />",
        },
        { text: "です", formats: ["bold", "underline"], subjectId: 440 },
        { text: "", formats: [] },
        { text: 7, formats: [] },
      ]),
    ).toEqual([
      {
        text: "橋です",
        formats: ["bold", "underline"],
        subjectId: 440,
      },
    ]);
  });

  it("drops invalid subject type entries", () => {
    expect(
      normalizeNoteVisualEditorSubjectTypes({
        1: "radical",
        2: "kanji",
        3: "vocabulary",
        4: "kana_vocabulary",
        5: "grammar",
        nope: "kanji",
      }),
    ).toEqual({
      1: "radical",
      2: "kanji",
      3: "vocabulary",
      4: "kana_vocabulary",
    });
  });

  it("keeps tag-shaped user content as inert run text", () => {
    expect(
      normalizeNoteVisualEditorRuns([
        {
          text: '<script>alert("no")</script><b>literal</b>',
          formats: [],
        },
      ]),
    ).toEqual([
      {
        text: '<script>alert("no")</script><b>literal</b>',
        formats: [],
      },
    ]);
  });

  it("enforces a visual max length without losing run formatting", () => {
    expect(
      truncateNoteVisualEditorRuns(
        [
          { text: "abc", formats: ["bold"] },
          { text: "日本語", formats: ["italic"], subjectId: 42 },
        ],
        5,
      ),
    ).toEqual([
      { text: "abc", formats: ["bold"] },
      { text: "日本", formats: ["italic"], subjectId: 42 },
    ]);
  });

  it("describes a linked selection using the whole visible label", () => {
    const runs = [
      { text: "See ", formats: [] },
      { text: "sound", formats: ["bold"], subjectId: 42 },
      { text: "alike", formats: ["italic"], subjectId: 42 },
      { text: " here", formats: [] },
    ];

    expect(describeNoteVisualEditorSelection(runs, 5, 12)).toEqual({
      text: "soundalike",
      formats: [],
      subjectId: 42,
    });
    expect(describeNoteVisualEditorSelection(runs, 7, 7, ["bold"], 42)).toEqual(
      {
        text: "soundalike",
        formats: ["bold"],
        subjectId: 42,
      },
    );
  });

  it("does not identify a selection crossing a link boundary as linked", () => {
    const runs = [
      { text: "See ", formats: [] },
      { text: "橋", formats: ["bold"], subjectId: 42 },
      { text: " here", formats: [] },
    ];

    expect(describeNoteVisualEditorSelection(runs, 3, 6)).toEqual({
      text: " 橋 ",
      formats: [],
    });
  });

  it("keeps separate links to the same subject distinct", () => {
    const runs = [
      { text: "first", formats: [], subjectId: 42 },
      { text: " and ", formats: [] },
      { text: "second", formats: [], subjectId: 42 },
    ];

    expect(describeNoteVisualEditorSelection(runs, 12, 12, [], 42)).toEqual({
      text: "second",
      formats: [],
      subjectId: 42,
    });
  });

  it("uses a stable normalized signature", () => {
    expect(
      getNoteVisualEditorRunsSignature([
        { text: "a", formats: ["bold"] },
        { text: "b", formats: ["bold"] },
      ]),
    ).toBe('[{"text":"ab","formats":["bold"]}]');
  });
});
