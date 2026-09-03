import type { NoteFormat } from "../utils/note-formatting";
import {
  getNoteVisualEditorText,
  normalizeNoteVisualEditorRuns,
} from "./note-visual-editor-model";
import type { NoteVisualEditorRun } from "./note-visual-editor-types";

const BLOCK_ELEMENTS = new Set([
  "ADDRESS",
  "ARTICLE",
  "ASIDE",
  "BLOCKQUOTE",
  "DIV",
  "FOOTER",
  "HEADER",
  "LI",
  "MAIN",
  "NAV",
  "P",
  "PRE",
  "SECTION",
]);

const OMITTED_ELEMENTS = new Set([
  "CANVAS",
  "IFRAME",
  "NOSCRIPT",
  "OBJECT",
  "SCRIPT",
  "STYLE",
  "SVG",
  "TEMPLATE",
]);

export function getNoteVisualEditorSubjectIdFromAnchor(
  anchor: HTMLAnchorElement,
): number | undefined {
  const dataSubjectId = Number(anchor.dataset.subjectId);
  if (Number.isInteger(dataSubjectId) && dataSubjectId > 0) {
    return dataSubjectId;
  }

  const href = anchor.getAttribute("href") ?? "";
  const match = /^wk:\/\/subject\/(\d+)$/.exec(href);
  if (!match) return undefined;

  const hrefSubjectId = Number(match[1]);
  return Number.isInteger(hrefSubjectId) && hrefSubjectId > 0
    ? hrefSubjectId
    : undefined;
}

function appendWalkedRun(
  runs: NoteVisualEditorRun[],
  text: string,
  formats: readonly NoteFormat[],
  subjectId?: number,
) {
  if (!text) return;
  const previous = runs[runs.length - 1];
  if (
    previous &&
    previous.subjectId === subjectId &&
    previous.formats.length === formats.length &&
    previous.formats.every((format, index) => format === formats[index])
  ) {
    previous.text += text;
    return;
  }

  runs.push({
    text,
    formats: [...formats],
    ...(subjectId ? { subjectId } : {}),
  });
}

export function getNoteVisualEditorFormatsForElement(
  element: HTMLElement,
  inheritedFormats: readonly NoteFormat[],
): NoteFormat[] {
  const selectedFormats = new Set(inheritedFormats);
  const tagName = element.tagName;
  if (tagName === "B" || tagName === "STRONG") selectedFormats.add("bold");
  if (tagName === "I" || tagName === "EM") selectedFormats.add("italic");
  if (tagName === "U") selectedFormats.add("underline");

  // Browsers sometimes express execCommand output as spans. Only the three
  // supported declarations are considered; every other style is ignored.
  const fontWeight = element.style.fontWeight.toLocaleLowerCase("en-US");
  if (
    fontWeight === "bold" ||
    (/^[6-9]00$/.test(fontWeight) && Number(fontWeight) >= 600)
  ) {
    selectedFormats.add("bold");
  }
  if (element.style.fontStyle.toLocaleLowerCase("en-US") === "italic") {
    selectedFormats.add("italic");
  }
  const textDecoration = `${element.style.textDecoration} ${element.style.textDecorationLine}`;
  if (/\bunderline\b/i.test(textDecoration)) {
    selectedFormats.add("underline");
  }

  return ["bold", "italic", "underline"].filter((format) =>
    selectedFormats.has(format as NoteFormat),
  ) as NoteFormat[];
}

export function readNoteVisualEditorRunsFromElement(
  editor: HTMLDivElement,
): NoteVisualEditorRun[] {
  const runs: NoteVisualEditorRun[] = [];

  const visit = (
    node: Node,
    inheritedFormats: readonly NoteFormat[],
    inheritedSubjectId?: number,
  ) => {
    if (node.nodeType === Node.TEXT_NODE) {
      appendWalkedRun(
        runs,
        node.textContent ?? "",
        inheritedFormats,
        inheritedSubjectId,
      );
      return;
    }

    if (!(node instanceof HTMLElement)) return;
    if (OMITTED_ELEMENTS.has(node.tagName)) return;
    if (node.tagName === "BR") {
      appendWalkedRun(runs, "\n", inheritedFormats, inheritedSubjectId);
      return;
    }

    const formats = getNoteVisualEditorFormatsForElement(
      node,
      inheritedFormats,
    );
    const subjectId =
      node instanceof HTMLAnchorElement
        ? (getNoteVisualEditorSubjectIdFromAnchor(node) ?? inheritedSubjectId)
        : inheritedSubjectId;
    const isBlock = BLOCK_ELEMENTS.has(node.tagName);
    const textBeforeBlock = getNoteVisualEditorText(runs);
    const insertedBlockSeparator = Boolean(
      isBlock && textBeforeBlock && !textBeforeBlock.endsWith("\n"),
    );
    if (insertedBlockSeparator) {
      appendWalkedRun(runs, "\n", inheritedFormats, inheritedSubjectId);
    }
    const textLengthBefore = getNoteVisualEditorText(runs).length;

    const childNodes = Array.from(node.childNodes);
    for (const child of childNodes) {
      if (
        insertedBlockSeparator &&
        childNodes.length === 1 &&
        child instanceof HTMLElement &&
        child.tagName === "BR"
      ) {
        continue;
      }
      visit(child, formats, subjectId);
    }

    const addedText = getNoteVisualEditorText(runs).length > textLengthBefore;
    const currentText = getNoteVisualEditorText(runs);
    if (
      isBlock &&
      addedText &&
      node.nextSibling &&
      !currentText.endsWith("\n")
    ) {
      appendWalkedRun(runs, "\n", inheritedFormats, inheritedSubjectId);
    }
  };

  for (const child of Array.from(editor.childNodes)) {
    visit(child, [], undefined);
  }

  return normalizeNoteVisualEditorRuns(runs);
}

export function getNoteVisualEditorBoundaryOffset(
  editor: HTMLDivElement,
  container: Node,
  offset: number,
): number {
  const range = editor.ownerDocument.createRange();
  range.selectNodeContents(editor);
  range.setEnd(container, offset);

  const rangeContents = editor.ownerDocument.createElement("div");
  rangeContents.appendChild(range.cloneContents());
  return getNoteVisualEditorText(
    readNoteVisualEditorRunsFromElement(rangeContents),
  ).length;
}

export function hasNoteVisualEditorStructuralBreaks(
  editor: HTMLDivElement,
): boolean {
  return Boolean(
    editor.querySelector(
      "address, article, aside, blockquote, br, div, footer, header, li, main, nav, p, pre, section",
    ),
  );
}
