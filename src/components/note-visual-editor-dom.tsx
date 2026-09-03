"use dom";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { NoteFormat } from "../utils/note-formatting";
import {
  describeNoteVisualEditorSelection,
  getNoteVisualEditorRunsSignature,
  getNoteVisualEditorText,
  isNoteVisualEditorFormat,
  normalizeNoteVisualEditorRuns,
  normalizeNoteVisualEditorSubjectTypes,
  truncateNoteVisualEditorRuns,
} from "./note-visual-editor-model";
import {
  getNoteVisualEditorBoundaryOffset,
  getNoteVisualEditorFormatsForElement as formatsForElement,
  getNoteVisualEditorSubjectIdFromAnchor as getSubjectIdFromAnchor,
  hasNoteVisualEditorStructuralBreaks,
  readNoteVisualEditorRunsFromElement,
} from "./note-visual-editor-dom-model";
import type {
  NoteVisualEditorAppearance,
  NoteVisualEditorCommand,
  NoteVisualEditorDOMProps,
  NoteVisualEditorRun,
  NoteVisualEditorSelection,
  NoteVisualEditorSubjectTypes,
} from "./note-visual-editor-types";

type SelectionOffsets = {
  start: number;
  end: number;
};

type SelectionSnapshot = SelectionOffsets & {
  link?: {
    subjectId: number;
    start: number;
    end: number;
  };
};

type PendingExternalRuns = {
  runs: NoteVisualEditorRun[];
  signature: string;
};

type CallbackRefs = {
  onChange: NoteVisualEditorDOMProps["onChange"];
  onSelectionChange: NoteVisualEditorDOMProps["onSelectionChange"];
  onSourceReady: NoteVisualEditorDOMProps["onSourceReady"];
  onValueReady: NoteVisualEditorDOMProps["onValueReady"];
  onFocus?: NoteVisualEditorDOMProps["onFocus"];
  onBlur?: NoteVisualEditorDOMProps["onBlur"];
};

const ISOLATED_HOST_STYLES = `
  :root {
    background: transparent;
  }

  html,
  body,
  #root {
    width: 100%;
    min-height: 100%;
    margin: 0;
    padding: 0;
    background: transparent;
  }
`;

const EDITOR_STYLES = `

  .note-visual-editor-shell,
  .note-visual-editor-shell * {
    box-sizing: border-box;
  }

  .note-visual-editor-shell {
    width: 100%;
    min-height: 100%;
  }

  .note-visual-editor {
    width: 100%;
    min-height: 100%;
    border: 0;
    outline: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: normal;
    -webkit-user-select: text;
    user-select: text;
    -webkit-text-size-adjust: 100%;
  }

  .note-visual-editor:focus-visible {
    outline: 2px solid var(--note-caret-color);
    outline-offset: -2px;
  }

  .note-visual-editor[data-empty="true"]::before {
    content: attr(data-placeholder);
    color: var(--note-placeholder-color);
    pointer-events: none;
  }

  .note-visual-editor::selection,
  .note-visual-editor *::selection {
    background: var(--note-selection-color);
  }

  .note-visual-editor a[data-subject-id] {
    cursor: pointer;
    font-weight: 600;
    text-decoration: none !important;
  }
`;

function safeString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function finiteNumber(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

function normalizeAppearance(
  value: NoteVisualEditorAppearance,
): NoteVisualEditorAppearance {
  const subjectColors = value?.subjectColors;
  return {
    colorScheme: value?.colorScheme === "dark" ? "dark" : "light",
    isolatedHost: value?.isolatedHost === true,
    backgroundColor: safeString(value?.backgroundColor, "transparent"),
    textColor: safeString(value?.textColor, "#111111"),
    placeholderColor: safeString(value?.placeholderColor, "#777777"),
    caretColor: safeString(value?.caretColor, "#3b82f6"),
    selectionColor: safeString(
      value?.selectionColor,
      "rgba(59, 130, 246, 0.28)",
    ),
    subjectColors: {
      radical: safeString(subjectColors?.radical, "#3c9bff"),
      kanji: safeString(subjectColors?.kanji, "#fa1f62"),
      vocabulary: safeString(subjectColors?.vocabulary, "#9c38d9"),
    },
    fontFamily: safeString(
      value?.fontFamily,
      '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    ),
    fontSize: finiteNumber(value?.fontSize, 16, 10, 72),
    lineHeight: finiteNumber(value?.lineHeight, 22, 12, 96),
    minHeight: finiteNumber(value?.minHeight, 120, 44, 2_000),
    paddingHorizontal: finiteNumber(value?.paddingHorizontal, 12, 0, 80),
    paddingVertical: finiteNumber(value?.paddingVertical, 12, 0, 80),
  };
}

function invokeAsync<T>(
  callback: ((value: T) => Promise<void>) | undefined,
  value: T,
) {
  if (!callback) return;
  void callback(value).catch((error) => {
    console.warn("[NoteVisualEditor] Native callback failed", error);
  });
}

function invokeAsyncWithoutValue(callback: (() => Promise<void>) | undefined) {
  if (!callback) return;
  void callback().catch((error) => {
    console.warn("[NoteVisualEditor] Native callback failed", error);
  });
}

function getLinkColor(
  subjectId: number,
  appearance: NoteVisualEditorAppearance,
  subjectTypes: NoteVisualEditorSubjectTypes,
): string {
  const subjectType = subjectTypes[String(subjectId)];
  if (subjectType === "radical") return appearance.subjectColors.radical;
  if (subjectType === "kanji") return appearance.subjectColors.kanji;
  if (subjectType === "vocabulary" || subjectType === "kana_vocabulary") {
    return appearance.subjectColors.vocabulary;
  }
  return appearance.textColor;
}

function configureAnchor(
  anchor: HTMLAnchorElement,
  subjectId: number,
  appearance: NoteVisualEditorAppearance,
  subjectTypes: NoteVisualEditorSubjectTypes,
) {
  anchor.dataset.subjectId = String(subjectId);
  // The target lives in data-subject-id. Omitting href prevents WebView
  // navigation and long-press URL actions while retaining link semantics.
  anchor.removeAttribute("href");
  anchor.setAttribute("role", "link");
  anchor.setAttribute("draggable", "false");
  anchor.tabIndex = 0;
  anchor.style.color = getLinkColor(subjectId, appearance, subjectTypes);
  anchor.style.textDecoration = "none";
}

function createFormattedNode(run: NoteVisualEditorRun): Node {
  // createTextNode is intentional: note text never enters the DOM as HTML.
  let node: Node = document.createTextNode(run.text);
  for (let index = run.formats.length - 1; index >= 0; index -= 1) {
    const format = run.formats[index];
    const element = document.createElement(
      format === "bold" ? "b" : format === "italic" ? "i" : "u",
    );
    element.appendChild(node);
    node = element;
  }
  return node;
}

function writeRunsToEditor(
  editor: HTMLDivElement,
  value: unknown,
  appearance: NoteVisualEditorAppearance,
  subjectTypes: NoteVisualEditorSubjectTypes,
): NoteVisualEditorRun[] {
  const runs = normalizeNoteVisualEditorRuns(value);
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < runs.length;) {
    const run = runs[index];
    if (!run.subjectId) {
      fragment.appendChild(createFormattedNode(run));
      index += 1;
      continue;
    }

    const subjectId = run.subjectId;
    const anchor = document.createElement("a");
    configureAnchor(anchor, subjectId, appearance, subjectTypes);

    while (index < runs.length && runs[index].subjectId === subjectId) {
      anchor.appendChild(createFormattedNode(runs[index]));
      index += 1;
    }
    fragment.appendChild(anchor);
  }

  editor.replaceChildren(fragment);
  return runs;
}

const readRunsFromEditor = readNoteVisualEditorRunsFromElement;

function selectionBelongsToEditor(
  editor: HTMLDivElement,
  selection: Selection,
): boolean {
  if (selection.rangeCount === 0) return false;
  const range = selection.getRangeAt(0);
  const contains = (node: Node) => node === editor || editor.contains(node);
  return contains(range.startContainer) && contains(range.endContainer);
}

function rangeOffsets(editor: HTMLDivElement, range: Range): SelectionOffsets {
  const start = getNoteVisualEditorBoundaryOffset(
    editor,
    range.startContainer,
    range.startOffset,
  );
  const end = getNoteVisualEditorBoundaryOffset(
    editor,
    range.endContainer,
    range.endOffset,
  );
  return { start: Math.min(start, end), end: Math.max(start, end) };
}

function captureSelection(editor: HTMLDivElement): SelectionSnapshot | null {
  const selection = window.getSelection();
  if (!selection || !selectionBelongsToEditor(editor, selection)) return null;
  const range = selection.getRangeAt(0);
  const offsets = rangeOffsets(editor, range);
  const startAnchor = closestEditorAnchor(editor, range.startContainer);
  const endAnchor = closestEditorAnchor(editor, range.endContainer);
  if (!startAnchor || startAnchor !== endAnchor) return offsets;

  const subjectId = getSubjectIdFromAnchor(startAnchor);
  if (!subjectId) return offsets;
  const anchorRange = document.createRange();
  anchorRange.selectNodeContents(startAnchor);
  const anchorOffsets = rangeOffsets(editor, anchorRange);
  return {
    ...offsets,
    link: {
      subjectId,
      start: anchorOffsets.start,
      end: anchorOffsets.end,
    },
  };
}

function getTextBoundary(
  root: HTMLElement,
  rawOffset: number,
): { node: Node; offset: number } {
  const totalLength = root.textContent?.length ?? 0;
  const targetOffset = Math.max(0, Math.min(rawOffset, totalLength));
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let remaining = targetOffset;
  let lastTextNode: Text | null = null;
  let currentNode = walker.nextNode();

  while (currentNode) {
    const textNode = currentNode as Text;
    lastTextNode = textNode;
    if (remaining <= textNode.data.length) {
      return { node: textNode, offset: remaining };
    }
    remaining -= textNode.data.length;
    currentNode = walker.nextNode();
  }

  if (lastTextNode) {
    return { node: lastTextNode, offset: lastTextNode.data.length };
  }
  return { node: root, offset: 0 };
}

function restoreSelection(
  editor: HTMLDivElement,
  offsets: SelectionSnapshot,
): SelectionSnapshot {
  const textLength = editor.textContent?.length ?? 0;
  const normalizedOffsets = {
    start: Math.max(0, Math.min(offsets.start, textLength)),
    end: Math.max(0, Math.min(offsets.end, textLength)),
  };
  normalizedOffsets.end = Math.max(
    normalizedOffsets.start,
    normalizedOffsets.end,
  );

  let selectionRoot: HTMLElement = editor;
  let selectionStart = normalizedOffsets.start;
  let selectionEnd = normalizedOffsets.end;
  let restoredLink: SelectionSnapshot["link"];
  if (offsets.link) {
    for (const candidate of Array.from(editor.querySelectorAll("a"))) {
      if (!(candidate instanceof HTMLAnchorElement)) continue;
      if (getSubjectIdFromAnchor(candidate) !== offsets.link.subjectId)
        continue;

      const anchorRange = document.createRange();
      anchorRange.selectNodeContents(candidate);
      const anchorOffsets = rangeOffsets(editor, anchorRange);
      if (
        anchorOffsets.start !== offsets.link.start ||
        anchorOffsets.end !== offsets.link.end
      ) {
        continue;
      }

      selectionRoot = candidate;
      selectionStart = normalizedOffsets.start - anchorOffsets.start;
      selectionEnd = normalizedOffsets.end - anchorOffsets.start;
      restoredLink = {
        subjectId: offsets.link.subjectId,
        start: anchorOffsets.start,
        end: anchorOffsets.end,
      };
      break;
    }
  }

  const start = getTextBoundary(selectionRoot, selectionStart);
  const end = getTextBoundary(selectionRoot, selectionEnd);
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);

  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  return {
    ...normalizedOffsets,
    ...(restoredLink ? { link: restoredLink } : {}),
  };
}

function closestEditorAnchor(
  editor: HTMLDivElement,
  node: Node | null,
): HTMLAnchorElement | null {
  if (!node) return null;
  const element =
    node instanceof Element ? node : (node.parentElement ?? undefined);
  const anchor = element?.closest("a[data-subject-id]");
  return anchor instanceof HTMLAnchorElement && editor.contains(anchor)
    ? anchor
    : null;
}

function anchorForSelection(editor: HTMLDivElement): HTMLAnchorElement | null {
  const selection = window.getSelection();
  if (!selection || !selectionBelongsToEditor(editor, selection)) return null;

  const range = selection.getRangeAt(0);
  const startAnchor = closestEditorAnchor(editor, range.startContainer);
  const endAnchor = closestEditorAnchor(editor, range.endContainer);
  return startAnchor && startAnchor === endAnchor ? startAnchor : null;
}

function anchorForOffsets(
  editor: HTMLDivElement,
  offsets: SelectionOffsets,
): HTMLAnchorElement | null {
  for (const candidate of Array.from(editor.querySelectorAll("a"))) {
    if (!(candidate instanceof HTMLAnchorElement)) continue;
    if (!getSubjectIdFromAnchor(candidate)) continue;
    const range = document.createRange();
    range.selectNodeContents(candidate);
    const bounds = rangeOffsets(editor, range);
    const isCollapsedInsideLink =
      offsets.start === offsets.end &&
      offsets.start > bounds.start &&
      offsets.start < bounds.end;
    const selectedRangeIsInsideLink =
      offsets.start !== offsets.end &&
      offsets.start >= bounds.start &&
      offsets.end <= bounds.end;
    if (isCollapsedInsideLink || selectedRangeIsInsideLink) {
      return candidate;
    }
  }
  return null;
}

function selectAnchor(
  editor: HTMLDivElement,
  anchor: HTMLAnchorElement,
): SelectionSnapshot {
  const range = document.createRange();
  range.selectNodeContents(anchor);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  const offsets = rangeOffsets(editor, range);
  const subjectId = getSubjectIdFromAnchor(anchor);
  return {
    ...offsets,
    ...(subjectId
      ? {
          link: {
            subjectId,
            start: offsets.start,
            end: offsets.end,
          },
        }
      : {}),
  };
}

function activeCollapsedFormats(editor: HTMLDivElement): NoteFormat[] {
  const selectedFormats = new Set<NoteFormat>();
  const selection = window.getSelection();
  let selectionIsInLink = false;
  if (selection && selectionBelongsToEditor(editor, selection)) {
    const range = selection.getRangeAt(0);
    selectionIsInLink = Boolean(
      closestEditorAnchor(editor, range.startContainer),
    );
    let element: HTMLElement | null =
      range.startContainer instanceof HTMLElement
        ? range.startContainer
        : range.startContainer.parentElement;
    while (element && element !== editor) {
      for (const format of formatsForElement(element, [])) {
        selectedFormats.add(format);
      }
      element = element.parentElement;
    }
  }

  for (const format of ["bold", "italic", "underline"] as const) {
    // Links are semibold for affordance, but that presentation is not stored
    // as bold note formatting.
    if (
      format === "bold" &&
      selectionIsInLink &&
      !selectedFormats.has(format)
    ) {
      continue;
    }
    try {
      if (document.queryCommandState(format)) selectedFormats.add(format);
    } catch {
      // Some embedded browsers do not expose queryCommandState consistently.
    }
  }
  return (["bold", "italic", "underline"] as const).filter((format) =>
    selectedFormats.has(format),
  );
}

function describeEditorSelection(
  editor: HTMLDivElement,
  runs: readonly NoteVisualEditorRun[],
  offsets: SelectionOffsets,
): NoteVisualEditorSelection {
  const anchor =
    anchorForSelection(editor) ?? anchorForOffsets(editor, offsets);
  const subjectId = anchor ? getSubjectIdFromAnchor(anchor) : undefined;
  const collapsedFormats =
    offsets.start === offsets.end ? activeCollapsedFormats(editor) : [];
  const description = describeNoteVisualEditorSelection(
    runs,
    offsets.start,
    offsets.end,
    collapsedFormats,
    subjectId,
  );

  if (subjectId && anchor) {
    return {
      ...description,
      text: anchor.textContent ?? description.text,
      subjectId,
    };
  }
  return description;
}

function updateLinkAppearances(
  editor: HTMLDivElement,
  appearance: NoteVisualEditorAppearance,
  subjectTypes: NoteVisualEditorSubjectTypes,
) {
  for (const candidate of Array.from(editor.querySelectorAll("a"))) {
    if (!(candidate instanceof HTMLAnchorElement)) continue;
    const subjectId = getSubjectIdFromAnchor(candidate);
    if (subjectId) {
      configureAnchor(candidate, subjectId, appearance, subjectTypes);
    }
  }
}

function executeDocumentCommand(command: string, value?: string): boolean {
  try {
    return (
      typeof document.execCommand === "function" &&
      document.execCommand(command, false, value)
    );
  } catch {
    return false;
  }
}

function insertPlainText(text: string) {
  if (!text.includes("\n") && executeDocumentCommand("insertText", text)) {
    return;
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const textNode = document.createTextNode(text);
  range.insertNode(textNode);
  range.setStartAfter(textNode);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function unwrapAnchor(anchor: HTMLAnchorElement) {
  const fragment = document.createDocumentFragment();
  while (anchor.firstChild) fragment.appendChild(anchor.firstChild);
  anchor.replaceWith(fragment);
}

function applyLinkCommand(
  editor: HTMLDivElement,
  command: Extract<NoteVisualEditorCommand, { type: "set-link" }>,
  appearance: NoteVisualEditorAppearance,
  subjectTypes: NoteVisualEditorSubjectTypes,
): HTMLAnchorElement | null {
  let anchor = anchorForSelection(editor);
  if (anchor) {
    configureAnchor(anchor, command.subjectId, appearance, subjectTypes);
    selectAnchor(editor, anchor);
    return anchor;
  }

  const selection = window.getSelection();
  if (!selection || !selectionBelongsToEditor(editor, selection)) return null;
  const range = selection.getRangeAt(0);
  const selectedOffsets = rangeOffsets(editor, range);

  if (range.collapsed) {
    if (!command.fallbackLabel) return null;
    anchor = document.createElement("a");
    configureAnchor(anchor, command.subjectId, appearance, subjectTypes);
    anchor.appendChild(document.createTextNode(command.fallbackLabel));
    range.insertNode(anchor);
    selectAnchor(editor, anchor);
    return anchor;
  }

  const href = `wk://subject/${command.subjectId}`;
  executeDocumentCommand("createLink", href);
  anchor =
    anchorForSelection(editor) ?? anchorForOffsets(editor, selectedOffsets);
  if (!anchor) {
    restoreSelection(editor, selectedOffsets);
    const fallbackSelection = window.getSelection();
    if (!fallbackSelection || fallbackSelection.rangeCount === 0) return null;
    const fallbackRange = fallbackSelection.getRangeAt(0);
    const contents = fallbackRange.extractContents();
    for (const nestedAnchor of Array.from(contents.querySelectorAll("a"))) {
      if (nestedAnchor instanceof HTMLAnchorElement) unwrapAnchor(nestedAnchor);
    }
    anchor = document.createElement("a");
    configureAnchor(anchor, command.subjectId, appearance, subjectTypes);
    anchor.appendChild(contents);
    fallbackRange.insertNode(anchor);
  }

  if (!anchor) return null;
  configureAnchor(anchor, command.subjectId, appearance, subjectTypes);
  selectAnchor(editor, anchor);
  return anchor;
}

export default function NoteVisualEditorDOM({
  runs,
  appearance: rawAppearance,
  subjectTypes: rawSubjectTypes,
  command,
  placeholder = "",
  accessibilityLabel,
  accessibilityHint,
  autoFocus = false,
  autoCapitalize = "sentences",
  autoCorrect = true,
  editable = true,
  maxLength,
  spellCheck = true,
  onChange,
  onSelectionChange,
  onSourceReady,
  onValueReady,
  onFocus,
  onBlur,
}: NoteVisualEditorDOMProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const didAutoFocusRef = useRef(false);
  const isComposingRef = useRef(false);
  const savedSelectionRef = useRef<SelectionSnapshot>({ start: 0, end: 0 });
  const lastAppliedCommandNonceRef = useRef<number | null>(null);
  const lastAppliedPropSignatureRef = useRef<string | null>(null);
  const lastEmittedSignatureRef = useRef<string | null>(null);
  const pendingEmittedSignaturesRef = useRef<string[]>([]);
  const lastReportedRunsSignatureRef = useRef<string | null>(null);
  const lastSelectionSignatureRef = useRef<string | null>(null);
  const pendingExternalRunsRef = useRef<PendingExternalRuns | null>(null);
  const callbacksRef = useRef<CallbackRefs>({
    onChange,
    onSelectionChange,
    onSourceReady,
    onValueReady,
    onFocus,
    onBlur,
  });
  const [compositionRevision, setCompositionRevision] = useState(0);
  const [isEmpty, setIsEmpty] = useState(true);

  callbacksRef.current = {
    onChange,
    onSelectionChange,
    onSourceReady,
    onValueReady,
    onFocus,
    onBlur,
  };

  const appearance = useMemo(
    () => normalizeAppearance(rawAppearance),
    [rawAppearance],
  );
  const subjectTypes = useMemo(
    () => normalizeNoteVisualEditorSubjectTypes(rawSubjectTypes),
    [rawSubjectTypes],
  );
  const normalizedRuns = useMemo(
    () => normalizeNoteVisualEditorRuns(runs),
    [runs],
  );
  const incomingRunsSignature = useMemo(
    () => getNoteVisualEditorRunsSignature(normalizedRuns),
    [normalizedRuns],
  );
  const normalizedMaxLength =
    typeof maxLength === "number" &&
    Number.isFinite(maxLength) &&
    maxLength >= 0
      ? Math.floor(maxLength)
      : undefined;

  const reportSelection = useCallback(
    (
      editor: HTMLDivElement,
      preferredOffsets?: SelectionSnapshot,
      requestNonce?: number,
    ) => {
      const capturedOffsets = captureSelection(editor);
      const offsets =
        capturedOffsets ?? preferredOffsets ?? savedSelectionRef.current;
      savedSelectionRef.current = offsets;
      const currentRuns = readRunsFromEditor(editor);
      const description = describeEditorSelection(editor, currentRuns, offsets);
      const signature = JSON.stringify(description);
      if (
        requestNonce === undefined &&
        signature === lastSelectionSignatureRef.current
      ) {
        return;
      }

      lastSelectionSignatureRef.current = signature;
      invokeAsync(callbacksRef.current.onSelectionChange, {
        ...description,
        ...(requestNonce !== undefined ? { requestNonce } : {}),
      });
    },
    [],
  );

  const reportRuns = useCallback((value: unknown) => {
    const nextRuns = normalizeNoteVisualEditorRuns(value);
    const signature = getNoteVisualEditorRunsSignature(nextRuns);
    setIsEmpty(getNoteVisualEditorText(nextRuns).length === 0);
    lastEmittedSignatureRef.current = signature;
    if (signature === lastReportedRunsSignatureRef.current) return nextRuns;

    lastReportedRunsSignatureRef.current = signature;
    pendingEmittedSignaturesRef.current.push(signature);
    invokeAsync(callbacksRef.current.onChange, nextRuns);
    return nextRuns;
  }, []);

  const reportEditorMutation = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || isComposingRef.current) return;

    let offsets = captureSelection(editor) ?? savedSelectionRef.current;
    let currentRuns = readRunsFromEditor(editor);
    if (getNoteVisualEditorText(currentRuns).replace(/\n/g, "").length === 0) {
      currentRuns = [];
    }
    const limitedRuns = truncateNoteVisualEditorRuns(
      currentRuns,
      normalizedMaxLength,
    );
    if (
      getNoteVisualEditorRunsSignature(limitedRuns) !==
      getNoteVisualEditorRunsSignature(currentRuns)
    ) {
      currentRuns = limitedRuns;
      writeRunsToEditor(editor, currentRuns, appearance, subjectTypes);
      offsets = restoreSelection(editor, offsets);
    } else if (hasNoteVisualEditorStructuralBreaks(editor)) {
      // Some embedded engines still materialize Enter or IME input as block
      // elements. Canonicalize those blocks to literal newline text nodes so
      // later selection restoration uses the same offset model as storage.
      writeRunsToEditor(editor, currentRuns, appearance, subjectTypes);
      offsets = restoreSelection(editor, offsets);
    }
    const nextRuns = reportRuns(currentRuns);

    if (nextRuns.length === 0 && editor.childNodes.length > 0) {
      editor.replaceChildren();
      offsets = restoreSelection(editor, { start: 0, end: 0 });
    }
    savedSelectionRef.current = offsets;
    reportSelection(editor, offsets);
  }, [
    appearance,
    normalizedMaxLength,
    reportRuns,
    reportSelection,
    subjectTypes,
  ]);

  const writeExternalRuns = useCallback(
    (externalRuns: NoteVisualEditorRun[], signature: string) => {
      const editor = editorRef.current;
      if (!editor) return;

      const wasFocused = document.activeElement === editor;
      const offsets = captureSelection(editor) ?? savedSelectionRef.current;
      const writtenRuns = writeRunsToEditor(
        editor,
        externalRuns,
        appearance,
        subjectTypes,
      );
      savedSelectionRef.current = restoreSelection(editor, offsets);
      if (wasFocused) editor.focus({ preventScroll: true });
      setIsEmpty(getNoteVisualEditorText(writtenRuns).length === 0);
      lastReportedRunsSignatureRef.current = signature;
      reportSelection(editor, savedSelectionRef.current);
    },
    [appearance, reportSelection, subjectTypes],
  );

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    if (!initializedRef.current) {
      const writtenRuns = writeRunsToEditor(
        editor,
        normalizedRuns,
        appearance,
        subjectTypes,
      );
      const end = getNoteVisualEditorText(writtenRuns).length;
      savedSelectionRef.current = { start: end, end };
      setIsEmpty(end === 0);
      initializedRef.current = true;
      lastAppliedPropSignatureRef.current = incomingRunsSignature;
      lastReportedRunsSignatureRef.current = incomingRunsSignature;
      try {
        executeDocumentCommand("styleWithCSS", "false");
      } catch {
        // The editor walker also understands the allowed CSS equivalents.
      }

      if (autoFocus && !didAutoFocusRef.current) {
        didAutoFocusRef.current = true;
        window.setTimeout(() => {
          editor.focus({ preventScroll: true });
          restoreSelection(editor, savedSelectionRef.current);
          reportSelection(editor, savedSelectionRef.current);
        }, 0);
      }
      return;
    }

    if (incomingRunsSignature === lastAppliedPropSignatureRef.current) return;
    lastAppliedPropSignatureRef.current = incomingRunsSignature;

    // A controlled-value echo must not replace the live DOM or interrupt IME.
    const echoedSignatureIndex =
      pendingEmittedSignaturesRef.current.lastIndexOf(incomingRunsSignature);
    if (echoedSignatureIndex >= 0) {
      // React may batch native state updates and echo only the newest value.
      // Acknowledge every earlier emission as well, without imposing a cap
      // that could misclassify a delayed echo as an external overwrite.
      pendingEmittedSignaturesRef.current.splice(0, echoedSignatureIndex + 1);
      if (incomingRunsSignature === lastEmittedSignatureRef.current) {
        lastEmittedSignatureRef.current = null;
      }
      return;
    }
    if (isComposingRef.current) {
      pendingExternalRunsRef.current = {
        runs: normalizedRuns,
        signature: incomingRunsSignature,
      };
      return;
    }

    const currentSignature = getNoteVisualEditorRunsSignature(
      readRunsFromEditor(editor),
    );
    if (currentSignature === incomingRunsSignature) return;
    writeExternalRuns(normalizedRuns, incomingRunsSignature);
  }, [
    appearance,
    autoFocus,
    incomingRunsSignature,
    normalizedRuns,
    reportSelection,
    subjectTypes,
    writeExternalRuns,
  ]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !initializedRef.current) return;
    updateLinkAppearances(editor, appearance, subjectTypes);
  }, [appearance, subjectTypes]);

  useEffect(() => {
    const handleDocumentSelectionChange = () => {
      const editor = editorRef.current;
      if (!editor || isComposingRef.current) return;
      const offsets = captureSelection(editor);
      if (!offsets) return;
      savedSelectionRef.current = offsets;
      reportSelection(editor, offsets);
    };

    document.addEventListener("selectionchange", handleDocumentSelectionChange);
    return () => {
      document.removeEventListener(
        "selectionchange",
        handleDocumentSelectionChange,
      );
    };
  }, [reportSelection]);

  useEffect(() => {
    const editor = editorRef.current;
    if (
      !editor ||
      !initializedRef.current ||
      !command ||
      !Number.isFinite(command.nonce) ||
      command.nonce === lastAppliedCommandNonceRef.current
    ) {
      return;
    }
    if (isComposingRef.current) {
      editor.blur();
      return;
    }
    lastAppliedCommandNonceRef.current = command.nonce;

    if (command.type === "prepare-source" || command.type === "capture-value") {
      let currentRuns = readRunsFromEditor(editor);
      if (
        getNoteVisualEditorText(currentRuns).replace(/\n/g, "").length === 0
      ) {
        currentRuns = [];
      }
      const nextRuns = reportRuns(currentRuns);
      const snapshot = {
        requestNonce: command.nonce,
        runs: nextRuns,
      };
      invokeAsync(
        command.type === "prepare-source"
          ? callbacksRef.current.onSourceReady
          : callbacksRef.current.onValueReady,
        snapshot,
      );
      return;
    }

    editor.focus({ preventScroll: true });
    restoreSelection(editor, savedSelectionRef.current);

    if (command.type === "capture-selection") {
      reportSelection(editor, savedSelectionRef.current, command.nonce);
      return;
    }

    if (command.type === "focus") {
      reportSelection(editor, savedSelectionRef.current);
      return;
    }

    if (command.type === "toggle-format") {
      if (!isNoteVisualEditorFormat(command.format)) return;
      const before = captureSelection(editor) ?? savedSelectionRef.current;
      executeDocumentCommand(command.format);
      const after = captureSelection(editor) ?? before;
      savedSelectionRef.current = after;

      // Keep the browser's pending typing format for a collapsed caret. A
      // selected range can be canonicalized immediately without losing it.
      if (before.start !== before.end) {
        const nextRuns = readRunsFromEditor(editor);
        writeRunsToEditor(editor, nextRuns, appearance, subjectTypes);
        savedSelectionRef.current = restoreSelection(editor, after);
        reportRuns(nextRuns);
      }
      reportSelection(editor, savedSelectionRef.current);
      return;
    }

    if (command.type === "set-link") {
      if (!Number.isInteger(command.subjectId) || command.subjectId <= 0)
        return;
      const linkedAnchor = applyLinkCommand(
        editor,
        command,
        appearance,
        subjectTypes,
      );
      if (!linkedAnchor) return;

      const linkedOffsets = selectAnchor(editor, linkedAnchor);
      const nextRuns = truncateNoteVisualEditorRuns(
        readRunsFromEditor(editor),
        normalizedMaxLength,
      );
      writeRunsToEditor(editor, nextRuns, appearance, subjectTypes);
      savedSelectionRef.current = restoreSelection(editor, linkedOffsets);
      reportRuns(nextRuns);
      reportSelection(editor, savedSelectionRef.current);
      return;
    }

    const selectedAnchor =
      anchorForSelection(editor) ??
      anchorForOffsets(editor, savedSelectionRef.current);
    if (!selectedAnchor) return;
    const unlinkedOffsets = selectAnchor(editor, selectedAnchor);
    unwrapAnchor(selectedAnchor);
    const nextRuns = readRunsFromEditor(editor);
    writeRunsToEditor(editor, nextRuns, appearance, subjectTypes);
    savedSelectionRef.current = restoreSelection(editor, unlinkedOffsets);
    reportRuns(nextRuns);
    reportSelection(editor, savedSelectionRef.current);
  }, [
    command,
    appearance,
    compositionRevision,
    normalizedMaxLength,
    reportRuns,
    reportSelection,
    subjectTypes,
  ]);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const editor = editorRef.current;
      if (!editor) return;
      const anchor = closestEditorAnchor(editor, event.target as Node);
      if (!anchor) return;

      event.preventDefault();
      event.stopPropagation();
      editor.focus({ preventScroll: true });
      savedSelectionRef.current = selectAnchor(editor, anchor);
      reportSelection(editor, savedSelectionRef.current);
    },
    [reportSelection],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const editor = editorRef.current;
      if (!editor) return;
      const anchor = closestEditorAnchor(editor, event.target as Node);
      if (!anchor) return;

      event.preventDefault();
      savedSelectionRef.current = selectAnchor(editor, anchor);
      reportSelection(editor, savedSelectionRef.current);
    },
    [reportSelection],
  );

  const handleBeforeInput = useCallback(
    (event: React.FormEvent<HTMLDivElement>) => {
      const nativeEvent = event.nativeEvent as InputEvent;
      if (
        nativeEvent.inputType !== "insertParagraph" &&
        nativeEvent.inputType !== "insertLineBreak"
      ) {
        return;
      }

      event.preventDefault();
      insertPlainText("\n");
      queueMicrotask(reportEditorMutation);
    },
    [reportEditorMutation],
  );

  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      event.preventDefault();
      insertPlainText(event.clipboardData.getData("text/plain"));
      queueMicrotask(reportEditorMutation);
    },
    [reportEditorMutation],
  );

  const handleCompositionEnd = useCallback(() => {
    isComposingRef.current = false;
    window.requestAnimationFrame(() => {
      const pendingExternalRuns = pendingExternalRunsRef.current;
      pendingExternalRunsRef.current = null;
      if (pendingExternalRuns) {
        writeExternalRuns(
          pendingExternalRuns.runs,
          pendingExternalRuns.signature,
        );
      } else {
        reportEditorMutation();
      }

      // A toolbar command received while composing is deliberately left
      // unapplied. This revision reruns the command effect only after the IME
      // has committed and its content has crossed the bridge.
      setCompositionRevision((revision) => revision + 1);
    });
  }, [reportEditorMutation, writeExternalRuns]);

  const editorStyle = {
    "--note-caret-color": appearance.caretColor,
    "--note-placeholder-color": appearance.placeholderColor,
    "--note-selection-color": appearance.selectionColor,
    backgroundColor: appearance.backgroundColor,
    color: appearance.textColor,
    caretColor: appearance.caretColor,
    colorScheme: appearance.colorScheme,
    fontFamily: appearance.fontFamily,
    fontSize: `${appearance.fontSize}px`,
    lineHeight: `${appearance.lineHeight}px`,
    minHeight: `${appearance.minHeight}px`,
    padding: `${appearance.paddingVertical}px ${appearance.paddingHorizontal}px`,
  } as React.CSSProperties;

  return (
    <div
      className="note-visual-editor-shell"
      style={{
        backgroundColor: appearance.backgroundColor,
        colorScheme: appearance.colorScheme,
        minHeight: `${appearance.minHeight}px`,
      }}
    >
      {appearance.isolatedHost ? <style>{ISOLATED_HOST_STYLES}</style> : null}
      <style>{EDITOR_STYLES}</style>
      <div
        ref={editorRef}
        aria-label={accessibilityLabel}
        aria-multiline="true"
        aria-placeholder={placeholder}
        aria-readonly={!editable}
        {...(accessibilityHint
          ? { "aria-description": accessibilityHint }
          : {})}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect ? "on" : "off"}
        className="note-visual-editor"
        contentEditable={editable}
        data-empty={isEmpty ? "true" : "false"}
        data-placeholder={placeholder}
        role="textbox"
        spellCheck={spellCheck}
        style={editorStyle}
        suppressContentEditableWarning
        tabIndex={0}
        onAuxClick={(event) => event.preventDefault()}
        onBeforeInput={handleBeforeInput}
        onClick={handleClick}
        onCompositionEnd={handleCompositionEnd}
        onCompositionStart={() => {
          isComposingRef.current = true;
        }}
        onDragStart={(event) => {
          if (closestEditorAnchor(editorRef.current!, event.target as Node)) {
            event.preventDefault();
          }
        }}
        onDrop={(event) => event.preventDefault()}
        onFocus={() => {
          invokeAsyncWithoutValue(callbacksRef.current.onFocus);
          const editor = editorRef.current;
          if (editor) reportSelection(editor);
        }}
        onInput={reportEditorMutation}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          invokeAsyncWithoutValue(callbacksRef.current.onBlur);
        }}
        onPaste={handlePaste}
      />
    </div>
  );
}
