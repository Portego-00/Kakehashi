/** @jest-environment jsdom */

import React, { act } from "react";

import NoteVisualEditorContent from "../note-visual-editor-content";
import { readNoteVisualEditorRunsFromElement } from "../note-visual-editor-dom-model";
import type {
  NoteVisualEditorCommand,
  NoteVisualEditorDOMProps,
  NoteVisualEditorRun,
} from "../note-visual-editor-types";

const { createRoot } = jest.requireActual<{
  createRoot: (container: HTMLElement) => {
    render: (children: React.ReactNode) => void;
    unmount: () => void;
  };
}>("react-dom/client");

let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;
let props: NoteVisualEditorDOMProps;
let nonce: number;

type CommandInput = NoteVisualEditorCommand extends infer Command
  ? Command extends { nonce: number }
    ? Omit<Command, "nonce">
    : never
  : never;

function renderEditor(runs: NoteVisualEditorRun[]) {
  props = {
    runs,
    appearance: {
      isolatedHost: false,
      colorScheme: "light",
      backgroundColor: "white",
      textColor: "black",
      placeholderColor: "gray",
      caretColor: "blue",
      selectionColor: "lightblue",
      subjectColors: { radical: "blue", kanji: "red", vocabulary: "purple" },
    },
    subjectTypes: {},
    accessibilityLabel: "Note text",
    onChange: jest.fn(async () => {}),
    onSelectionChange: jest.fn(async () => {}),
    onSourceReady: jest.fn(async () => {}),
    onValueReady: jest.fn(async () => {}),
  };
  act(() => root.render(<NoteVisualEditorContent {...props} />));
  return host.querySelector<HTMLDivElement>('[role="textbox"]')!;
}

function select(node: Node, start: number, end = start, report = true) {
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  window.getSelection()!.removeAllRanges();
  window.getSelection()!.addRange(range);
  if (report) {
    act(() => document.dispatchEvent(new Event("selectionchange")));
  }
}

function command(value: CommandInput) {
  props = { ...props, command: { ...value, nonce: ++nonce } };
  act(() => root.render(<NoteVisualEditorContent {...props} />));
}

function mockCollapsedTypingCommands() {
  const originalExecCommand = Object.getOwnPropertyDescriptor(document, "execCommand");
  const originalQueryCommandState = Object.getOwnPropertyDescriptor(document, "queryCommandState");
  const selection = window.getSelection()!;
  const addRange = selection.addRange.bind(selection);
  const pendingFormats = new Set<string>();
  const formatTags = { bold: "b,strong", italic: "i,em", underline: "u" };

  // Browsers keep caret typing styles separately from existing DOM markup.
  // Replacing the range derives those styles from the new caret's ancestors.
  const restoreRange = jest.spyOn(selection, "addRange").mockImplementation((range) => {
    addRange(range);
    pendingFormats.clear();
    const element = range.startContainer instanceof Element
      ? range.startContainer
      : range.startContainer.parentElement;
    for (const [format, tags] of Object.entries(formatTags)) {
      if (element?.closest(tags)) pendingFormats.add(format);
    }
  });
  Object.defineProperty(document, "execCommand", {
    configurable: true,
    value: jest.fn((format: string) => {
      if (!(format in formatTags)) return true;
      if (pendingFormats.has(format)) pendingFormats.delete(format);
      else pendingFormats.add(format);
      return true;
    }),
  });
  Object.defineProperty(document, "queryCommandState", {
    configurable: true,
    value: jest.fn((format: string) => pendingFormats.has(format)),
  });

  return () => {
    restoreRange.mockRestore();
    if (originalExecCommand) Object.defineProperty(document, "execCommand", originalExecCommand);
    else Reflect.deleteProperty(document, "execCommand");
    if (originalQueryCommandState) Object.defineProperty(document, "queryCommandState", originalQueryCommandState);
    else Reflect.deleteProperty(document, "queryCommandState");
  };
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  nonce = 0;
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  window.getSelection()!.removeAllRanges();
});

describe("note visual editor interactions", () => {
  it("combines pending caret formats before typing and lets either be disabled", () => {
    const restoreCommands = mockCollapsedTypingCommands();
    try {
      const editor = renderEditor([]);
      act(() => editor.focus());
      select(editor, 0);

      command({ type: "toggle-format", format: "bold" });
      expect(props.onSelectionChange).toHaveBeenLastCalledWith({ text: "", formats: ["bold"] });
      command({ type: "toggle-format", format: "underline" });
      expect(props.onSelectionChange).toHaveBeenLastCalledWith({ text: "", formats: ["bold", "underline"] });
      command({ type: "toggle-format", format: "bold" });
      expect(props.onSelectionChange).toHaveBeenLastCalledWith({ text: "", formats: ["underline"] });
      command({ type: "toggle-format", format: "underline" });
      expect(props.onSelectionChange).toHaveBeenLastCalledWith({ text: "", formats: [] });
      expect(readNoteVisualEditorRunsFromElement(editor)).toEqual([]);
    } finally {
      restoreCommands();
    }
  });

  it.each(["bold", "italic", "underline"] as const)("disables pending %s inside matching formatted text", (format) => {
    const restoreCommands = mockCollapsedTypingCommands();
    try {
      const editor = renderEditor([{ text: "existing", formats: [format] }]);
      act(() => editor.focus());
      select(editor.firstChild!.firstChild!, 4);
      expect(props.onSelectionChange).toHaveBeenLastCalledWith({ text: "", formats: [format] });

      command({ type: "toggle-format", format });

      expect(props.onSelectionChange).toHaveBeenLastCalledWith({ text: "", formats: [] });
      expect(readNoteVisualEditorRunsFromElement(editor)).toEqual([{ text: "existing", formats: [format] }]);
    } finally {
      restoreCommands();
    }
  });

  it("combines and disables caret formats inside a subject link without changing its label", () => {
    const restoreCommands = mockCollapsedTypingCommands();
    try {
      const runs = [{ text: "bridge", formats: [], subjectId: 440 }];
      const editor = renderEditor(runs);
      act(() => editor.focus());
      select(editor.querySelector("a")!.firstChild!, 3);

      command({ type: "toggle-format", format: "bold" });
      command({ type: "toggle-format", format: "underline" });
      expect(props.onSelectionChange).toHaveBeenLastCalledWith({
        text: "bridge",
        formats: ["bold", "underline"],
        subjectId: 440,
      });

      command({ type: "toggle-format", format: "bold" });
      expect(props.onSelectionChange).toHaveBeenLastCalledWith({
        text: "bridge",
        formats: ["underline"],
        subjectId: 440,
      });
      command({ type: "toggle-format", format: "underline" });
      expect(props.onSelectionChange).toHaveBeenLastCalledWith({
        text: "bridge",
        formats: [],
        subjectId: 440,
      });
      expect(readNoteVisualEditorRunsFromElement(editor)).toEqual(runs);
    } finally {
      restoreCommands();
    }
  });

  it.each([
    { top: 1_800, expectedScroll: 1_430 },
    { top: 40, expectedScroll: null },
  ])("reveals a restored native selection only when outside the viewport ($top)", ({ top, expectedScroll }) => {
    const originalBounds = Object.getOwnPropertyDescriptor(Range.prototype, "getBoundingClientRect");
    const originalHeight = Object.getOwnPropertyDescriptor(window, "innerHeight");
    const frame = jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    const scroll = jest.spyOn(window, "scrollBy").mockImplementation(() => {});
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 400 });
    Object.defineProperty(Range.prototype, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ top, bottom: top + 22, height: 22 }),
    });
    try {
      renderEditor([{ text: "first\nmiddle\nlast", formats: [] }]);
      props = { ...props, appearance: { ...props.appearance, isolatedHost: true, minHeight: 400 } };
      command({ type: "focus", selection: { start: 6, end: 12 } });
      expect(window.getSelection()!.toString()).toBe("middle");
      if (expectedScroll === null) {
        expect(scroll).not.toHaveBeenCalled();
      } else {
        expect(scroll).toHaveBeenCalledWith({ top: expectedScroll, behavior: "instant" });
      }
    } finally {
      frame.mockRestore();
      scroll.mockRestore();
      if (originalBounds) Object.defineProperty(Range.prototype, "getBoundingClientRect", originalBounds);
      else Reflect.deleteProperty(Range.prototype, "getBoundingClientRect");
      if (originalHeight) Object.defineProperty(window, "innerHeight", originalHeight);
    }
  });

  it.each(["viewport", "native layout"])("keeps a restored selection visible when %s shrinks after focus", (resizeSource) => {
    const originalBounds = Object.getOwnPropertyDescriptor(Range.prototype, "getBoundingClientRect");
    const originalHeight = Object.getOwnPropertyDescriptor(window, "innerHeight");
    const frame = jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    const scroll = jest.spyOn(window, "scrollBy").mockImplementation(() => {});
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 400 });
    Object.defineProperty(Range.prototype, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ top: 340, bottom: 362, height: 22 }),
    });
    try {
      const editor = renderEditor([{ text: "first\nmiddle\nlast", formats: [] }]);
      props = { ...props, appearance: { ...props.appearance, isolatedHost: true, minHeight: 400 } };
      command({ type: "focus", selection: { start: 6, end: 12 } });
      expect(scroll).not.toHaveBeenCalled();

      act(() => {
        if (resizeSource === "viewport") {
          Object.defineProperty(window, "innerHeight", { configurable: true, value: 263 });
          window.dispatchEvent(new Event("resize"));
        } else {
          props = { ...props, appearance: { ...props.appearance, minHeight: 263 } };
          root.render(<NoteVisualEditorContent {...props} />);
        }
      });
      expect(scroll).toHaveBeenLastCalledWith({ top: 107, behavior: "instant" });

      scroll.mockClear();
      editor.dispatchEvent(new Event("touchstart", { bubbles: true }));
      act(() => {
        Object.defineProperty(window, "innerHeight", { configurable: true, value: 150 });
        window.dispatchEvent(new Event("resize"));
        props = { ...props, appearance: { ...props.appearance, minHeight: 150 } };
        root.render(<NoteVisualEditorContent {...props} />);
      });
      expect(scroll).not.toHaveBeenCalled();
    } finally {
      frame.mockRestore();
      scroll.mockRestore();
      if (originalBounds) Object.defineProperty(Range.prototype, "getBoundingClientRect", originalBounds);
      else Reflect.deleteProperty(Range.prototype, "getBoundingClientRect");
      if (originalHeight) Object.defineProperty(window, "innerHeight", originalHeight);
    }
  });

  it("captures the latest visible range with the source snapshot", () => {
    const editor = renderEditor([
      { text: "A&B", formats: ["bold"] },
      { text: " tail", formats: [] },
    ]);
    act(() => editor.focus());
    select(editor.firstChild!.firstChild!, 1, 3, false);

    command({ type: "prepare-source" });

    expect(props.onSourceReady).toHaveBeenLastCalledWith({
      requestNonce: nonce,
      runs: props.runs,
      selection: { start: 1, end: 3 },
    });
  });

  it("captures a live selection before the browser delivers selectionchange", () => {
    const editor = renderEditor([{ text: "before middle after", formats: [] }]);
    act(() => editor.focus());
    select(editor.firstChild!, 7, 13, false);

    command({ type: "capture-selection" });

    expect(props.onSelectionChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ text: "middle", requestNonce: nonce }),
    );
  });

  it("keeps the selected link as the picker target even if focus moves selection", () => {
    const editor = renderEditor([
      { text: "first", formats: [], subjectId: 1 },
      { text: " and ", formats: [] },
      { text: "second", formats: [], subjectId: 2 },
    ]);
    const anchors = editor.querySelectorAll("a");
    select(anchors[0].firstChild!, 0, 5);
    command({ type: "capture-selection" });
    select(anchors[1].firstChild!, 0, 6);

    command({ type: "set-link", subjectId: 3, fallbackLabel: "third" });

    expect(readNoteVisualEditorRunsFromElement(editor)).toEqual([
      { text: "first", formats: [], subjectId: 3 },
      { text: " and ", formats: [] },
      { text: "second", formats: [], subjectId: 2 },
    ]);
  });

  it("inserts at the middle caret after the picker blurs and clears selection", () => {
    const editor = renderEditor([{ text: "before after", formats: [] }]);
    act(() => editor.focus());
    select(editor.firstChild!, 7, 7, false);
    command({ type: "capture-selection" });
    act(() => {
      editor.blur();
      window.getSelection()!.removeAllRanges();
      document.dispatchEvent(new Event("selectionchange"));
    });

    command({ type: "set-link", subjectId: 440, fallbackLabel: "橋" });

    expect(readNoteVisualEditorRunsFromElement(editor)).toEqual([
      { text: "before ", formats: [] },
      { text: "橋", formats: [], subjectId: 440 },
      { text: "after", formats: [] },
    ]);
  });

  it("links selected middle text after focus clears its browser range", () => {
    const editor = renderEditor([{ text: "before middle after", formats: [] }]);
    select(editor.firstChild!, 7, 13);
    command({ type: "capture-selection" });
    act(() => {
      editor.blur();
      window.getSelection()!.removeAllRanges();
    });

    command({ type: "set-link", subjectId: 440, fallbackLabel: "橋" });

    expect(readNoteVisualEditorRunsFromElement(editor)).toEqual([
      { text: "before ", formats: [] },
      { text: "middle", formats: [], subjectId: 440 },
      { text: " after", formats: [] },
    ]);
  });

  it("links the captured formatted word after the native picker recreates the WebView", () => {
    const editor = renderEditor([
      { text: "before ", formats: [] },
      { text: "middle", formats: ["bold"] },
      { text: " after", formats: [] },
    ]);
    select(editor.querySelector("b")!.firstChild!, 0, 6);
    command({ type: "capture-selection" });
    const captured = jest.mocked(props.onSelectionChange).mock.calls.at(-1)![0];
    act(() => root.render(null));
    props = {
      ...props,
      command: {
        type: "set-link",
        subjectId: 440,
        fallbackLabel: "橋",
        selection: captured.selection,
        nonce: ++nonce,
      },
    };

    act(() => root.render(<NoteVisualEditorContent {...props} />));

    expect(readNoteVisualEditorRunsFromElement(host.querySelector<HTMLDivElement>('[role="textbox"]')!)).toEqual([
      { text: "before ", formats: [] },
      { text: "middle", formats: ["bold"], subjectId: 440 },
      { text: " after", formats: [] },
    ]);
  });

  it.each(["set-link", "remove-link", "focus"] as const)(
    "restores the captured existing link for %s after a WebView recreation",
    (type) => {
      const editor = renderEditor([
        { text: "first", formats: ["italic"], subjectId: 1 },
        { text: " and ", formats: [] },
        { text: "second", formats: [], subjectId: 2 },
      ]);
      select(editor.querySelector("i")!.firstChild!, 1);
      command({ type: "capture-selection" });
      const captured = jest.mocked(props.onSelectionChange).mock.calls.at(-1)![0];
      act(() => root.render(null));
      const nextCommand: NoteVisualEditorCommand = type === "set-link"
        ? { type, subjectId: 3, fallbackLabel: "third", nonce: ++nonce, selection: captured.selection }
        : { type, nonce: ++nonce, selection: captured.selection };
      props = { ...props, command: nextCommand };

      act(() => root.render(<NoteVisualEditorContent {...props} />));

      expect(readNoteVisualEditorRunsFromElement(host.querySelector<HTMLDivElement>('[role="textbox"]')!)).toEqual([
        { text: "first", formats: ["italic"], ...(type === "remove-link" ? {} : { subjectId: type === "set-link" ? 3 : 1 }) },
        { text: " and ", formats: [] },
        { text: "second", formats: [], subjectId: 2 },
      ]);
      if (type === "focus") {
        expect(window.getSelection()!.anchorOffset).toBe(1);
        expect(window.getSelection()!.isCollapsed).toBe(true);
      }
    },
  );

  it("cancels a picker by restoring its caret and releasing its link target", () => {
    const editor = renderEditor([{ text: "first second", formats: [] }]);
    select(editor.firstChild!, 3);
    command({ type: "capture-selection" });
    select(editor.firstChild!, 8);

    command({ type: "focus" });
    expect(window.getSelection()!.anchorOffset).toBe(3);
    select(editor.firstChild!, 6, 12);
    command({ type: "capture-selection" });
    command({ type: "set-link", subjectId: 2, fallbackLabel: "second" });

    expect(readNoteVisualEditorRunsFromElement(editor)).toEqual([
      { text: "first ", formats: [] },
      { text: "second", formats: [], subjectId: 2 },
    ]);
  });

  it("removes only the selected part of a link, preserving formatting", () => {
    const editor = renderEditor([
      { text: "linked", formats: ["italic"], subjectId: 1 },
    ]);
    select(editor.querySelector("i")!.firstChild!, 1, 4);

    command({ type: "remove-link" });

    expect(readNoteVisualEditorRunsFromElement(editor)).toEqual([
      { text: "l", formats: ["italic"], subjectId: 1 },
      { text: "ink", formats: ["italic"] },
      { text: "ed", formats: ["italic"], subjectId: 1 },
    ]);
  });

  it("lets a tap keep the caret inside a linked label", () => {
    const editor = renderEditor([{ text: "linked", formats: [], subjectId: 1 }]);
    const anchor = editor.querySelector("a")!;
    select(anchor.firstChild!, 2);

    act(() => anchor.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    expect(window.getSelection()!.isCollapsed).toBe(true);
    expect(window.getSelection()!.anchorOffset).toBe(2);
  });

  it.each(["caret", "whole-link action"])(
    "removes the complete link for a %s",
    (action) => {
      const editor = renderEditor([
        { text: "linked", formats: ["italic"], subjectId: 1 },
      ]);
      select(editor.querySelector("i")!.firstChild!, 1, action === "caret" ? 1 : 4);

      command({
        type: "remove-link",
        ...(action === "whole-link action" ? { scope: "link" } : {}),
      });

      expect(readNoteVisualEditorRunsFromElement(editor)).toEqual([
        { text: "linked", formats: ["italic"] },
      ]);
    },
  );

  it.each(["custom", "html", "html without custom attributes"])("preserves linked formatting through the %s clipboard", async (clipboard) => {
    const editor = renderEditor([
      { text: "bridge", formats: ["bold"], subjectId: 440 },
      { text: " ", formats: [] },
    ]);
    select(editor.querySelector("b")!.firstChild!, 0, 6);
    const data = new Map<string, string>([["text/plain", "bridge"]]);
    const clipboardData = {
      getData: (type: string) => data.get(type) ?? "",
      setData: (type: string, value: string) => data.set(type, value),
    };
    const copy = new Event("copy", { bubbles: true, cancelable: true });
    Object.defineProperty(copy, "clipboardData", { value: clipboardData });
    act(() => editor.dispatchEvent(copy));
    if (clipboard !== "custom") data.delete("application/x-kakehashi-note+json");
    if (clipboard === "html without custom attributes") {
      data.set("text/html", data.get("text/html")!.replace(/ data-subject-id="\d+"/g, ""));
    }
    select(editor.lastChild!, 1);
    const paste = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(paste, "clipboardData", { value: clipboardData });

    await act(async () => {
      editor.dispatchEvent(paste);
    });

    expect(readNoteVisualEditorRunsFromElement(editor)).toEqual([
      { text: "bridge", formats: ["bold"], subjectId: 440 },
      { text: " ", formats: [] },
      { text: "bridge", formats: ["bold"], subjectId: 440 },
    ]);
    command({ type: "capture-selection" });
    expect(props.onSelectionChange).toHaveBeenLastCalledWith({
      text: "",
      formats: [],
      requestNonce: nonce,
      selection: { start: 13, end: 13 },
    });
  });

  it("rebuilds clipboard HTML as supported note text and links only", async () => {
    const editor = renderEditor([]);
    select(editor, 0);
    const paste = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(paste, "clipboardData", {
      value: {
        getData: (type: string) => type === "text/html"
          ? '<b>safe</b><script>bad()</script><img src="bad" onerror="bad()"><a href="https://example.com"> external</a><a data-subject-id="440" onclick="bad()"><i>橋</i></a>'
          : "",
      },
    });

    await act(async () => {
      editor.dispatchEvent(paste);
    });

    expect(readNoteVisualEditorRunsFromElement(editor)).toEqual([
      { text: "safe", formats: ["bold"] },
      { text: " external", formats: [] },
      { text: "橋", formats: ["italic"], subjectId: 440 },
    ]);
    expect(editor.querySelector("script, img, [onclick], [onerror], [href]")).toBeNull();
  });

  it("cuts linked text with rich clipboard data and preserves surrounding text", async () => {
    const editor = renderEditor([
      { text: "before ", formats: [] },
      { text: "橋", formats: ["underline"], subjectId: 440 },
      { text: " after", formats: [] },
    ]);
    select(editor.querySelector("u")!.firstChild!, 0, 1);
    const clipboardData = { setData: jest.fn() };
    const cut = new Event("cut", { bubbles: true, cancelable: true });
    Object.defineProperty(cut, "clipboardData", { value: clipboardData });

    await act(async () => {
      editor.dispatchEvent(cut);
    });

    expect(readNoteVisualEditorRunsFromElement(editor)).toEqual([
      { text: "before  after", formats: [] },
    ]);
    expect(clipboardData.setData).toHaveBeenCalledWith("text/plain", "橋");
    expect(clipboardData.setData).toHaveBeenCalledWith(
      "text/html",
      expect.stringContaining('href="wk://subject/440"'),
    );
  });
});
