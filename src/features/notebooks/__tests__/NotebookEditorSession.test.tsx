import React from "react";
import { act, render } from "@testing-library/react-native";
import NotebookEditor from "../NotebookEditor.dom";
import { NotebookEditorSession } from "../NotebookEditorSession";
import type { NotebookEditorProps } from "../editor-contract";
import { sanitizeNotebookBlocks, type NotebookBlock, type NotebookPage } from "../model";

jest.mock("../NotebookEditor.dom", () => ({ __esModule: true, default: jest.fn(() => null) }));

const block = (text: string): NotebookBlock => ({ id: "paragraph", type: "paragraph", content: [{ type: "text", text }] });
const page: NotebookPage = { id: "page", title: "Notes", icon: "", parentId: null, content: [block("Original")], favorite: false, trashedAt: null, sortOrder: 0, createdAt: "2026-09-07T10:00:00Z", updatedAt: "2026-09-07T10:00:00Z", revision: 0 };
const props = { page, hasDraft: false, updatePageDraft: jest.fn(), pages: [], subjects: [], sentences: [], theme: "light" as const, onOpenPage: jest.fn(), onOpenSubject: jest.fn(), onSaveSentence: jest.fn() };
const currentEditor = (): NotebookEditorProps => jest.mocked(NotebookEditor).mock.calls[jest.mocked(NotebookEditor).mock.calls.length - 1][0];

describe("native notebook editor session", () => {
  beforeEach(() => jest.clearAllMocks());

  it("keeps the DOM document and vocabulary payload stable through local edits and autosave echoes", async () => {
    const screen = render(<NotebookEditorSession {...props} />);
    const initialRenderCount = jest.mocked(NotebookEditor).mock.calls.length;
    const edited = [block("Japanese 日本語")];
    await act(async () => currentEditor().onChange(edited));
    screen.rerender(<NotebookEditorSession {...props} page={{ ...page, content: edited }} hasDraft />);
    screen.rerender(<NotebookEditorSession {...props} page={{ ...page, content: edited, revision: 1 }} />);
    expect(props.updatePageDraft).toHaveBeenCalledWith("page", { blocks: edited });
    expect(jest.mocked(NotebookEditor).mock.calls).toHaveLength(initialRenderCount);
  });

  it("reloads a genuine cloud edit on a clean page", () => {
    const screen = render(<NotebookEditorSession {...props} />);
    const remote = [block("Changed on the web")];
    screen.rerender(<NotebookEditorSession {...props} page={{ ...page, content: remote, title: "Web title", revision: 1 }} />);
    expect(currentEditor().value).toEqual(remote);
    expect(currentEditor().title).toBe("Web title");
  });

  it("recognizes a sanitized server echo of BlockNote default props without remounting", async () => {
    const screen = render(<NotebookEditorSession {...props} />);
    const initialRenderCount = jest.mocked(NotebookEditor).mock.calls.length;
    const raw = [{ ...block("日本語を勉強しています"), props: { textColor: "default", backgroundColor: "default", textAlignment: "left" }, children: [] }];
    await act(async () => currentEditor().onChange(raw));
    const saved = sanitizeNotebookBlocks(raw);
    screen.rerender(<NotebookEditorSession {...props} page={{ ...page, content: saved }} hasDraft />);
    screen.rerender(<NotebookEditorSession {...props} page={{ ...page, content: saved, revision: 1 }} />);
    expect(jest.mocked(NotebookEditor).mock.calls).toHaveLength(initialRenderCount);
  });

  it("does not replace an editor with a pending local draft", async () => {
    const screen = render(<NotebookEditorSession {...props} />);
    await act(async () => currentEditor().onTitleChange?.("My draft"));
    const initialDocument = currentEditor().value;
    screen.rerender(<NotebookEditorSession {...props} page={{ ...page, title: "Web title", content: [block("Remote")] }} hasDraft />);
    expect(currentEditor().value).toBe(initialDocument);
    expect(currentEditor().title).toBe("Notes");
  });
});
