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
  sliceNoteVisualEditorRuns,
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
  NoteVisualEditorSelectionRange,
  NoteVisualEditorSubjectTypes,
} from "./note-visual-editor-types";

type SelectionOffsets = {
  start: number;
  end: number;
};

type SelectionSnapshot = NoteVisualEditorSelectionRange;

type PendingLinkTyping = {
  subjectId: number;
  enabled: boolean;
  offset: number;
  text: string;
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

  .note-visual-editor-shell[data-isolated-host="false"] .note-visual-editor:focus-visible {
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
    text-decoration: none !important;
  }
`;

const NOTE_CLIPBOARD_TYPE = "application/x-kakehashi-note+json";

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
  // The editable label uses the editor's caret and keyboard interaction.
  anchor.removeAttribute("tabindex");
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

  let start = getTextBoundary(selectionRoot, selectionStart);
  let end = getTextBoundary(selectionRoot, selectionEnd);
  if (!restoredLink && normalizedOffsets.start === normalizedOffsets.end) {
    // Equal text offsets can describe either side of an anchor boundary.
    // An unlinked caret must stay outside the anchor after DOM rewrites.
    for (const candidate of Array.from(editor.querySelectorAll("a"))) {
      const anchorRange = document.createRange();
      anchorRange.selectNodeContents(candidate);
      const bounds = rangeOffsets(editor, anchorRange);
      if (
        normalizedOffsets.start !== bounds.start &&
        normalizedOffsets.start !== bounds.end
      ) {
        continue;
      }
      const parent = candidate.parentNode!;
      const childIndex = Array.from(parent.childNodes).indexOf(candidate);
      start = end = {
        node: parent,
        offset: childIndex + (normalizedOffsets.start === bounds.end ? 1 : 0),
      };
      break;
    }
  }
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

function revealSelectionAfterLayout(
  editor: HTMLDivElement,
  getNativeViewportHeight: () => number,
) {
  let active = true;
  let frame: number | undefined;
  let timeout: number | undefined;
  const visualViewport = window.visualViewport;
  const interactionEvents = ["pointerdown", "touchstart", "wheel", "keydown", "beforeinput"];
  const cancel = () => {
    active = false;
    if (frame !== undefined) window.cancelAnimationFrame(frame);
    if (timeout !== undefined) window.clearTimeout(timeout);
    window.removeEventListener("resize", schedule);
    visualViewport?.removeEventListener("resize", schedule);
    for (const event of interactionEvents) document.removeEventListener(event, cancel, true);
  };
  const reveal = () => {
    frame = undefined;
    if (!active) return;
    const selection = window.getSelection();
    if (!editor.isConnected || !selection?.rangeCount) return;
    const range = selection.getRangeAt(0).cloneRange();
    if (!editor.contains(range.commonAncestorContainer)) return;
    range.collapse(false);
    if (typeof range.getBoundingClientRect !== "function") return;
    const caret = range.getBoundingClientRect();
    if (caret.height === 0) return;

    const viewportTop = window.visualViewport?.offsetTop ?? 0;
    const viewportHeight = Math.min(
      window.visualViewport?.height ?? window.innerHeight,
      getNativeViewportHeight(),
    );
    const padding = 8;
    const delta = caret.top < viewportTop + padding
      ? caret.top - viewportTop - padding
      : caret.bottom > viewportTop + viewportHeight - padding
        ? caret.bottom - viewportTop - viewportHeight + padding
        : 0;
    // A recreated WebView starts at the top even though its range is restored.
    // Reveal that range without moving a selection which is already visible.
    if (delta !== 0) window.scrollBy({ top: delta, behavior: "instant" });
  };
  const schedule = () => {
    if (!active) return;
    if (frame !== undefined) window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(reveal);
  };
  window.addEventListener("resize", schedule);
  visualViewport?.addEventListener("resize", schedule);
  for (const event of interactionEvents) {
    document.addEventListener(event, cancel, { capture: true, passive: true });
  }
  // Keyboard and native modal resizing can finish after the first focus frame.
  // Stop promptly on user input so subsequent scrolling belongs to the user.
  timeout = window.setTimeout(cancel, 1_000);
  schedule();
  return { schedule, cancel };
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
  if (selection && selectionBelongsToEditor(editor, selection)) {
    const range = selection.getRangeAt(0);
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
    try {
      // The browser's pending typing style can override the caret's markup,
      // including turning a format off while still inside its element.
      if (document.queryCommandState(format)) selectedFormats.add(format);
      else selectedFormats.delete(format);
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

export default function NoteVisualEditorContent({
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
  const linkPickerSelectionRef = useRef<SelectionSnapshot | null>(null);
  const pendingLinkTypingRef = useRef<PendingLinkTyping | null>(null);
  const lastAppliedCommandNonceRef = useRef<number | null>(null);
  const lastAppliedPropSignatureRef = useRef<string | null>(null);
  const lastEmittedSignatureRef = useRef<string | null>(null);
  const pendingEmittedSignaturesRef = useRef<string[]>([]);
  const lastReportedRunsSignatureRef = useRef<string | null>(null);
  const lastSelectionSignatureRef = useRef<string | null>(null);
  const pendingExternalRunsRef = useRef<PendingExternalRuns | null>(null);
  const pendingSelectionRevealRef = useRef<
    ReturnType<typeof revealSelectionAfterLayout> | null
  >(null);
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
  const nativeViewportHeightRef = useRef(appearance.minHeight ?? 120);
  nativeViewportHeightRef.current = appearance.minHeight ?? 120;
  const revealNativeSelection = useCallback((editor: HTMLDivElement) => {
    pendingSelectionRevealRef.current?.cancel();
    pendingSelectionRevealRef.current = revealSelectionAfterLayout(
      editor,
      () => nativeViewportHeightRef.current,
    );
  }, []);
  useEffect(() => {
    pendingSelectionRevealRef.current?.schedule();
  }, [appearance.minHeight]);
  useEffect(() => () => pendingSelectionRevealRef.current?.cancel(), []);
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
      let description = describeEditorSelection(editor, currentRuns, offsets);
      let pendingLink = pendingLinkTypingRef.current;
      if (pendingLink && getNoteVisualEditorText(currentRuns) === pendingLink.text &&
          (offsets.start !== offsets.end || offsets.start !== pendingLink.offset)) {
        pendingLinkTypingRef.current = null;
        pendingLink = null;
      }
      if (pendingLink && offsets.start === offsets.end && offsets.start === pendingLink.offset) {
        description = {
          text: "",
          formats: description.formats,
          ...(pendingLink.enabled
            ? { subjectId: pendingLink.subjectId }
            : { inactiveSubjectId: pendingLink.subjectId }),
        };
      }
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
        ...(requestNonce !== undefined
          ? { requestNonce, selection: offsets }
          : {}),
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
    const pendingLink = pendingLinkTypingRef.current;
    const pendingFormats = pendingLink && offsets.start === offsets.end
      ? activeCollapsedFormats(editor)
      : null;
    let rewrotePendingLink = false;
    if (pendingLink) {
      const text = getNoteVisualEditorText(currentRuns);
      if (text !== pendingLink.text) {
        // WebKit inherits an anchor at a collapsed caret. Apply the user's
        // typing choice only to this edit, leaving all existing label text
        // linked. Waiting for composition end also keeps IME candidates intact.
        let start = 0;
        const prefixLimit = Math.min(pendingLink.offset, pendingLink.text.length, text.length);
        while (start < prefixLimit && pendingLink.text[start] === text[start]) start += 1;
        let suffix = 0;
        const suffixLimit = Math.min(pendingLink.text.length - pendingLink.offset, text.length - start);
        while (suffix < suffixLimit && pendingLink.text[pendingLink.text.length - suffix - 1] === text[text.length - suffix - 1]) suffix += 1;
        const end = text.length - suffix;
        if (end > start) {
          currentRuns = normalizeNoteVisualEditorRuns([
            ...sliceNoteVisualEditorRuns(currentRuns, 0, start),
            ...sliceNoteVisualEditorRuns(currentRuns, start, end).map(({ text: insertedText, formats }) => ({
              text: insertedText,
              formats,
              ...(pendingLink.enabled ? { subjectId: pendingLink.subjectId } : {}),
            })),
            ...sliceNoteVisualEditorRuns(currentRuns, end, text.length),
          ]);
          writeRunsToEditor(editor, currentRuns, appearance, subjectTypes);
          offsets = restoreSelection(editor, { start: offsets.start, end: offsets.end });
          rewrotePendingLink = true;
        }
        pendingLink.text = text;
        pendingLink.offset = offsets.end;
      }
    }
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
    if (pendingLink) {
      pendingLink.text = getNoteVisualEditorText(nextRuns);
      pendingLink.offset = offsets.end;
    }
    if (rewrotePendingLink && pendingFormats) {
      // Restoring a range between split anchors resets WebKit's typing styles.
      // Carry bold/italic/underline forward independently from the link choice.
      const restoredFormats = activeCollapsedFormats(editor);
      for (const format of ["bold", "italic", "underline"] as const) {
        if (restoredFormats.includes(format) !== pendingFormats.includes(format)) {
          executeDocumentCommand(format);
        }
      }
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

      pendingLinkTypingRef.current = null;
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
    pendingSelectionRevealRef.current?.cancel();

    if (command.type === "prepare-source" || command.type === "capture-value") {
      const selection = captureSelection(editor) ?? savedSelectionRef.current;
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
        ...(command.type === "prepare-source" ? { selection } : {}),
      };
      invokeAsync(
        command.type === "prepare-source"
          ? callbacksRef.current.onSourceReady
          : callbacksRef.current.onValueReady,
        snapshot,
      );
      return;
    }

    const isLinkPickerResult =
      command.type === "set-link" ||
      command.type === "remove-link" ||
      command.type === "focus";
    const liveSelection = captureSelection(editor);
    const commandSelection =
      command.selection ??
      (isLinkPickerResult ? linkPickerSelectionRef.current : null) ??
      liveSelection ??
      savedSelectionRef.current;
    if (document.activeElement !== editor) editor.focus({ preventScroll: true });
    const sameLiveSelection = liveSelection &&
      liveSelection.start === commandSelection.start &&
      liveSelection.end === commandSelection.end &&
      liveSelection.link?.subjectId === commandSelection.link?.subjectId &&
      liveSelection.link?.start === commandSelection.link?.start &&
      liveSelection.link?.end === commandSelection.link?.end;
    // Replacing a collapsed range clears the browser's pending typing styles.
    // Toolbar toggles should operate on the live caret so they can accumulate.
    savedSelectionRef.current =
      (command.type === "toggle-format" || command.type === "toggle-link" || command.type === "capture-selection") &&
      sameLiveSelection
        ? liveSelection
        : restoreSelection(editor, commandSelection);

    if (command.type === "capture-selection") {
      linkPickerSelectionRef.current = savedSelectionRef.current;
      reportSelection(editor, savedSelectionRef.current, command.nonce);
      return;
    }

    if (command.type === "focus") {
      linkPickerSelectionRef.current = null;
      reportSelection(editor, savedSelectionRef.current);
      if (appearance.isolatedHost) revealNativeSelection(editor);
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
      pendingLinkTypingRef.current = null;
      linkPickerSelectionRef.current = null;
      if (!Number.isInteger(command.subjectId) || command.subjectId <= 0)
        return;
      const originalSelection = captureSelection(editor) ?? savedSelectionRef.current;
      const existingAnchor = anchorForSelection(editor);
      const originalLabel = existingAnchor?.textContent ?? "";
      const linkedAnchor = applyLinkCommand(
        editor,
        command,
        appearance,
        subjectTypes,
      );
      if (!linkedAnchor) return;

      const suffix = command.appendCharacters?.trim();
      const label = linkedAnchor.textContent ?? "";
      const suffixText = suffix ? `${/\s$/.test(label) ? "" : " "}${suffix}` : "";
      const remainingCapacity = normalizedMaxLength === undefined
        ? Infinity
        : normalizedMaxLength - getNoteVisualEditorText(readRunsFromEditor(editor)).length;
      if (suffix && !label.trimEnd().endsWith(suffix) && suffixText.length <= remainingCapacity) {
        // Optional characters must never push existing note text over the limit.
        // Match the final label's formatting, including mixed-format labels.
        const lastText = getTextBoundary(linkedAnchor, label.length);
        const suffixNode = document.createTextNode(suffixText);
        if (lastText.node.nodeType === Node.TEXT_NODE) lastText.node.parentNode!.appendChild(suffixNode);
        else linkedAnchor.appendChild(suffixNode);
      }
      const linkedOffsets = selectAnchor(editor, linkedAnchor);
      const labelChanged = (linkedAnchor.textContent ?? "") !== originalLabel;
      const selectionAfterLink = existingAnchor && !labelChanged
        ? { ...originalSelection, link: linkedOffsets.link }
        : { start: linkedOffsets.end, end: linkedOffsets.end, link: linkedOffsets.link };
      const nextRuns = truncateNoteVisualEditorRuns(
        readRunsFromEditor(editor),
        normalizedMaxLength,
      );
      writeRunsToEditor(editor, nextRuns, appearance, subjectTypes);
      savedSelectionRef.current = restoreSelection(editor, selectionAfterLink);
      reportRuns(nextRuns);
      reportSelection(editor, savedSelectionRef.current);
      if (appearance.isolatedHost) revealNativeSelection(editor);
      return;
    }

    linkPickerSelectionRef.current = null;
    const selectedOffsets = captureSelection(editor) ?? savedSelectionRef.current;
    const selectedAnchor =
      anchorForSelection(editor) ??
      anchorForOffsets(editor, savedSelectionRef.current);
    if (selectedOffsets.start === selectedOffsets.end &&
        (command.type === "toggle-link" || command.scope !== "link")) {
      const pendingLink = pendingLinkTypingRef.current;
      const subjectId = pendingLink?.offset === selectedOffsets.start
        ? pendingLink.subjectId
        : selectedAnchor ? getSubjectIdFromAnchor(selectedAnchor) : undefined;
      if (!subjectId) return;
      pendingLinkTypingRef.current = {
        subjectId,
        enabled: command.type === "toggle-link" && pendingLink?.offset === selectedOffsets.start
          ? !pendingLink.enabled
          : false,
        offset: selectedOffsets.start,
        text: getNoteVisualEditorText(readRunsFromEditor(editor)),
      };
      reportSelection(editor, selectedOffsets);
      return;
    }
    pendingLinkTypingRef.current = null;
    const removeWholeLink = command.type === "remove-link" && command.scope === "link";
    if (removeWholeLink && !selectedAnchor) return;
    const unlinkedOffsets = removeWholeLink
      ? selectAnchor(editor, selectedAnchor!)
      : selectedOffsets;
    const currentRuns = readRunsFromEditor(editor);
    const nextRuns = normalizeNoteVisualEditorRuns([
      ...sliceNoteVisualEditorRuns(currentRuns, 0, unlinkedOffsets.start),
      ...sliceNoteVisualEditorRuns(
        currentRuns,
        unlinkedOffsets.start,
        unlinkedOffsets.end,
      ).map(({ text, formats }) => ({ text, formats })),
      ...sliceNoteVisualEditorRuns(
        currentRuns,
        unlinkedOffsets.end,
        getNoteVisualEditorText(currentRuns).length,
      ),
    ]);
    writeRunsToEditor(editor, nextRuns, appearance, subjectTypes);
    savedSelectionRef.current = restoreSelection(editor, unlinkedOffsets);
    reportRuns(nextRuns);
    reportSelection(editor, savedSelectionRef.current);
    if (appearance.isolatedHost) revealNativeSelection(editor);
  }, [
    command,
    appearance,
    compositionRevision,
    normalizedMaxLength,
    reportRuns,
    reportSelection,
    revealNativeSelection,
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
      const offsets = captureSelection(editor);
      if (offsets) savedSelectionRef.current = offsets;
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
      const editor = editorRef.current;
      if (!editor || !editable) return;
      event.preventDefault();
      const plainText = event.clipboardData.getData("text/plain");
      let pastedRuns: NoteVisualEditorRun[] = [];
      try {
        pastedRuns = normalizeNoteVisualEditorRuns(
          JSON.parse(event.clipboardData.getData(NOTE_CLIPBOARD_TYPE)),
        );
      } catch {
        // Other apps and some system clipboards omit custom MIME types.
      }
      if (pastedRuns.length === 0) {
        const html = event.clipboardData.getData("text/html");
        if (html) {
          // Template contents remain inert, including their resource elements.
          // Only approved text runs are rebuilt in the live editor.
          const clipboardTemplate = document.createElement("template");
          clipboardTemplate.innerHTML = html;
          pastedRuns = readNoteVisualEditorRunsFromElement(clipboardTemplate.content);
        }
      }
      const offsets = captureSelection(editor);
      if (pastedRuns.length > 0 && offsets) {
        const currentRuns = readRunsFromEditor(editor);
        const nextRuns = [
          ...sliceNoteVisualEditorRuns(currentRuns, 0, offsets.start),
          ...pastedRuns,
          ...sliceNoteVisualEditorRuns(
            currentRuns,
            offsets.end,
            getNoteVisualEditorText(currentRuns).length,
          ),
        ];
        writeRunsToEditor(editor, nextRuns, appearance, subjectTypes);
        const end = offsets.start + getNoteVisualEditorText(pastedRuns).length;
        savedSelectionRef.current = restoreSelection(editor, { start: end, end });
      } else {
        insertPlainText(plainText);
      }
      queueMicrotask(reportEditorMutation);
    },
    [appearance, editable, reportEditorMutation, subjectTypes],
  );

  const handleCopy = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      const editor = editorRef.current;
      if (!editor) return;
      const offsets = captureSelection(editor);
      if (!offsets || offsets.start === offsets.end) return;
      const selectedRuns = sliceNoteVisualEditorRuns(
        readRunsFromEditor(editor),
        offsets.start,
        offsets.end,
      );
      const clipboardContent = document.createElement("div");
      writeRunsToEditor(clipboardContent, selectedRuns, appearance, subjectTypes);
      for (const anchor of Array.from(clipboardContent.querySelectorAll("a"))) {
        const subjectId = getSubjectIdFromAnchor(anchor);
        if (subjectId) anchor.setAttribute("href", `wk://subject/${subjectId}`);
      }
      event.clipboardData.setData("text/plain", getNoteVisualEditorText(selectedRuns));
      event.clipboardData.setData("text/html", clipboardContent.innerHTML);
      try {
        event.clipboardData.setData(NOTE_CLIPBOARD_TYPE, JSON.stringify(selectedRuns));
      } catch {
        // Standard HTML still carries subject links on restricted clipboards.
      }
      event.preventDefault();
    },
    [appearance, subjectTypes],
  );

  const handleCut = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      if (!editable) return;
      handleCopy(event);
      if (!event.defaultPrevented) return;
      if (!executeDocumentCommand("delete")) {
        const selection = window.getSelection();
        selection?.getRangeAt(0).deleteContents();
      }
      queueMicrotask(reportEditorMutation);
    },
    [editable, handleCopy, reportEditorMutation],
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
      data-isolated-host={appearance.isolatedHost}
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
        onBlur={() => {
          const editor = editorRef.current;
          const offsets = editor ? captureSelection(editor) : null;
          if (offsets) savedSelectionRef.current = offsets;
          invokeAsyncWithoutValue(callbacksRef.current.onBlur);
        }}
        onCopy={handleCopy}
        onCut={handleCut}
        onPaste={handlePaste}
      />
    </div>
  );
}
