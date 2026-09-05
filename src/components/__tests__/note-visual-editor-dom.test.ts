/** @jest-environment jsdom */

import {
  getNoteVisualEditorBoundaryOffset,
  readNoteVisualEditorRunsFromElement,
} from "../note-visual-editor-dom-model";

function readEditorMarkup(markup: string) {
  const editor = document.createElement("div");
  editor.innerHTML = markup;
  return readNoteVisualEditorRunsFromElement(editor);
}

describe("note visual editor DOM serialization", () => {
  it.each([
    ["foo<div>x</div>", "foo\nx"],
    ["start a<div>b</div>", "start a\nb"],
    ["<div>first</div><div>second</div>", "first\nsecond"],
    ["foo<div><br></div>", "foo\n"],
  ])("preserves browser block line breaks in %s", (markup, text) => {
    expect(readEditorMarkup(markup)).toEqual([{ text, formats: [] }]);
  });

  it("preserves literal newline text nodes used by Enter and plain-text paste", () => {
    const editor = document.createElement("div");
    editor.textContent = "one\ntwo\nthree";

    expect(readNoteVisualEditorRunsFromElement(editor)).toEqual([
      { text: "one\ntwo\nthree", formats: [] },
    ]);
  });

  it("counts virtual block separators when mapping DOM selection offsets", () => {
    const editor = document.createElement("div");
    editor.innerHTML = "foo<div>x</div>";
    const firstLine = editor.firstChild!;
    const secondLine = editor.lastChild!;
    const secondLineText = secondLine.firstChild!;

    expect(getNoteVisualEditorBoundaryOffset(editor, firstLine, 3)).toBe(3);
    expect(getNoteVisualEditorBoundaryOffset(editor, secondLine, 0)).toBe(4);
    expect(getNoteVisualEditorBoundaryOffset(editor, secondLineText, 1)).toBe(
      5,
    );
  });
});
