import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NotebookEditorProps } from "./NotebookEditor";
import { applyNotebookMutation, createNotebookState, type NotebookState } from "./model";
import { NotebookWorkspace } from "./NotebookWorkspace";

const mocks = vi.hoisted(() => ({ store: vi.fn(), writing: vi.fn(), editor: vi.fn(), flush: vi.fn(), mutate: vi.fn(), discard: vi.fn(), refresh: vi.fn(), push: vi.fn() }));
vi.mock("./use-notebooks", () => ({ useNotebooks: mocks.store }));
vi.mock("./use-page-draft", () => ({ usePageDraft: mocks.writing }));
vi.mock("@/lib/theme", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: [] }) }));
vi.mock("@/lib/wanikani/queries", () => ({ subjectsQuery: () => ({}) }));
vi.mock("next/dynamic", () => ({ default: () => (props: NotebookEditorProps) => { mocks.editor(props); return null; } }));

let state: NotebookState;
let latest: NotebookState;
let status: string;
let message: string;
function editorProps() { return mocks.editor.mock.calls.at(-1)![0] as NotebookEditorProps; }

beforeEach(() => {
  vi.clearAllMocks();
  state = applyNotebookMutation(createNotebookState(), { action: "create_page", page: { id: "page", title: "Grammar" } }).state;
  state = applyNotebookMutation(state, { action: "upsert_sentence", expectedRevision: -1, sentence: { id: "orphan", japanese: "今日は晴れです。", english: "It is sunny today.", kana: "", subjectIds: [] } }).state;
  latest = state;
  status = "saved";
  message = "";
  mocks.flush.mockResolvedValue(true);
  mocks.refresh.mockImplementation(async () => ({ data: { state: latest }, error: null }));
  mocks.mutate.mockResolvedValue(state);
  mocks.store.mockImplementation(() => ({ state, scope: "101", available: true, isLoading: false, isDemo: false, error: "", mutate: mocks.mutate, getState: () => latest, refresh: mocks.refresh }));
  mocks.writing.mockImplementation(() => ({ draft: { title: "Unsaved page title", icon: "", content: [], baseRevision: 0 }, status, message, editorEpoch: 0, update: vi.fn(), setContent: vi.fn(), flush: mocks.flush, discard: mocks.discard }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("notebook cleanup from the editor", () => {
  it("flushes page changes before deleting and uses the latest sentence revision", async () => {
    mocks.flush.mockImplementation(async () => {
      latest = { ...state, sentences: state.sentences.map((sentence) => ({ ...sentence, revision: 4 })) };
      return true;
    });
    render(<NotebookWorkspace pageId="page" />);
    await act(async () => { await editorProps().onDeleteSentence!("orphan"); });
    expect(mocks.flush).toHaveBeenCalledOnce();
    expect(mocks.mutate).toHaveBeenCalledWith({ action: "delete_sentence", sentenceId: "orphan", expectedRevision: 4 });
    expect(mocks.flush.mock.invocationCallOrder[0]).toBeLessThan(mocks.mutate.mock.invocationCallOrder[0]);
  });

  it("does not delete when the draft cannot be saved", async () => {
    mocks.flush.mockResolvedValue(false);
    render(<NotebookWorkspace pageId="page" />);
    await act(async () => { await expect(editorProps().onDeleteSentence!("orphan")).rejects.toThrow("Save or resolve this page's draft"); });
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it("lets a quota error load the saved version only after explicit discard confirmation", async () => {
    status = "error";
    message = "Notebook storage limit reached.";
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<NotebookWorkspace pageId="page" />);
    fireEvent.click(screen.getByRole("button", { name: "Load saved version" }));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Discard your unsaved changes"));
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.discard).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Load saved version" }));
    await waitFor(() => expect(mocks.discard).toHaveBeenCalledWith(state.pages[0]));
  });

  it("retains the quota-blocked draft when loading the saved version fails", async () => {
    status = "error";
    message = "Notebook storage limit reached.";
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mocks.refresh.mockResolvedValue({ error: new Error("The saved page could not be reached."), data: { state } });
    render(<NotebookWorkspace pageId="page" />);
    fireEvent.click(screen.getByRole("button", { name: "Load saved version" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be reached");
    expect(mocks.discard).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Page title" })).toHaveValue("Unsaved page title");
  });
});

describe("notebook loading and creation", () => {
  it("waits for the notebook before declaring a page missing or the sidebar empty", () => {
    mocks.store.mockReturnValue({ state: createNotebookState(), scope: "101", available: false, isLoading: true, isDemo: false, error: "", mutate: mocks.mutate, getState: () => latest, refresh: mocks.refresh });
    render(<NotebookWorkspace pageId="page" />);
    expect(screen.getByRole("status", { name: "Loading notebook pages…" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Loading notebook…" })).toBeInTheDocument();
    expect(screen.queryByText("Your pages will appear here.")).not.toBeInTheDocument();
    expect(screen.queryByText("Page not found")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New page" })).toBeDisabled();
  });

  it("claims creation before a slow draft flush and keeps the editor mounted", async () => {
    let resolveFlush!: (value: boolean) => void;
    mocks.flush.mockReturnValue(new Promise<boolean>((resolve) => { resolveFlush = resolve; }));
    const { container } = render(<NotebookWorkspace pageId="page" />);
    const create = screen.getByRole("button", { name: "New page" });
    act(() => { fireEvent.click(create); fireEvent.click(create); });
    expect(mocks.flush).toHaveBeenCalledOnce();
    expect(mocks.mutate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Creating…" })).toBeDisabled();
    expect(screen.getByRole("status", { name: "Creating notebook…" })).toBeInTheDocument();
    expect(container.querySelector('textarea[aria-label="Page title"]')).toHaveValue("Unsaved page title");
    await act(async () => { resolveFlush(true); });
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledOnce());
    expect(mocks.mutate).toHaveBeenCalledWith(expect.objectContaining({ action: "create_page", page: expect.objectContaining({ icon: "📓" }) }));
    expect(mocks.push).toHaveBeenCalledOnce();
  });

  it("returns to the draft when saving it blocks creation", async () => {
    mocks.flush.mockResolvedValue(false);
    render(<NotebookWorkspace pageId="page" />);
    fireEvent.click(screen.getByRole("button", { name: "New page" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "New page" })).toBeEnabled());
    expect(mocks.mutate).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Page title" })).toHaveValue("Unsaved page title");
  });

  it("shows a creation failure without losing the previous page", async () => {
    mocks.mutate.mockRejectedValue(new Error("Your notebook storage is full."));
    render(<NotebookWorkspace pageId="page" />);
    fireEvent.click(screen.getByRole("button", { name: "New page" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your notebook storage is full.");
    expect(screen.getByRole("button", { name: "New page" })).toBeEnabled();
    expect(screen.getByRole("textbox", { name: "Page title" })).toHaveValue("Unsaved page title");
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
