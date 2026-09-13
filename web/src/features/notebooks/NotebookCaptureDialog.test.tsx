import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Subject } from "@/types/wanikani";
import { applyNotebookMutation, createNotebookState, type NotebookMutation, type NotebookState } from "./model";
import { NotebookCaptureButton, NotebookCaptureDialog } from "./NotebookCaptureDialog";
import { SubjectNotebookSection } from "./SubjectNotebookSection";

const mocks = vi.hoisted(() => ({ mutate: vi.fn(), mutateResult: vi.fn(), refresh: vi.fn(), hook: vi.fn(), session: vi.fn() }));
vi.mock("./use-notebooks", () => ({ useNotebooks: mocks.hook }));
vi.mock("@/lib/session", () => ({ useSession: mocks.session }));

const subject: Subject = {
  id: 88, object: "vocabulary", url: "https://api.wanikani.com/v2/subjects/88", data_updated_at: "2026-09-07T00:00:00.000Z",
  data: { level: 5, created_at: "2026-09-07T00:00:00.000Z", slug: "猫", document_url: "https://www.wanikani.com/vocabulary/猫", hidden_at: null, characters: "猫", meanings: [{ meaning: "Cat", primary: true, accepted_answer: true }], auxiliary_meanings: [], readings: [{ reading: "ねこ", primary: true, accepted_answer: true }] },
};
let state: NotebookState;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockReturnValue({ status: "authenticated", user: { data: { id: "123", username: "Portego" } }, isDemo: false });
  state = applyNotebookMutation(createNotebookState(), { action: "create_page", page: { id: "grammar", title: "Grammar", content: [{ id: "notes", type: "paragraph", content: [{ type: "text", text: "Existing notes" }] }] } }).state;
  mocks.hook.mockImplementation(() => ({ state, isLoading: false, available: true, error: "", mutate: mocks.mutate, mutateResult: mocks.mutateResult, refresh: mocks.refresh }));
  mocks.mutate.mockImplementation(async (action: NotebookMutation) => { state = applyNotebookMutation(state, action).state; return state; });
  mocks.mutateResult.mockImplementation(async (action: NotebookMutation) => { const result = applyNotebookMutation(state, action); state = result.state; return { ...result, available: true, revision: 1 }; });
});
afterEach(cleanup);

describe("notebook capture", () => {
  it("appends a vocabulary reference without replacing existing page content", async () => {
    render(<NotebookCaptureDialog subject={subject} open onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Add to page" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Saved in Grammar");
    expect(mocks.mutate).toHaveBeenCalledWith(expect.objectContaining({ action: "append_blocks", pageId: "grammar", blocks: [expect.objectContaining({ type: "vocabulary", props: { subjectId: 88, label: "猫" } })] }));
    expect(state.pages[0].content).toHaveLength(2);
    expect(state.pages[0].content[0].id).toBe("notes");
    expect(screen.getByRole("link", { name: "Open page" })).toHaveAttribute("href", "/notebooks/grammar");
  });

  it("creates a page with a reference to the deduplicated shared sentence", async () => {
    state = applyNotebookMutation(state, { action: "upsert_sentence", expectedRevision: -1, sentence: { id: "shared", japanese: "猫が好きです。", english: "I like cats.", kana: "", subjectIds: [88] } }).state;
    render(<NotebookCaptureDialog subject={subject} sentence={{ japanese: "猫が好きです。", english: "I like cats." }} open onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Page"), { target: { value: "new" } });
    fireEvent.change(screen.getByLabelText("Page title"), { target: { value: "My examples" } });
    fireEvent.click(screen.getByRole("button", { name: "Add to page" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Saved in My examples");
    expect(state.sentences).toHaveLength(1);
    expect(state.pages[1].content[0]).toMatchObject({ type: "sentence", props: { sentenceId: "shared" } });
  });

  it("retries a failed append using the same block and already saved sentence", async () => {
    mocks.mutate.mockRejectedValueOnce(new Error("Connection interrupted. Try again."));
    render(<NotebookCaptureDialog subject={subject} sentence={{ japanese: "猫が好きです。", english: "I like cats." }} open onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Add to page" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Connection interrupted");
    await waitFor(() => expect(screen.getByRole("button", { name: "Add to page" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Add to page" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Saved in Grammar");
    expect(mocks.mutateResult).toHaveBeenCalledTimes(1);
    expect(mocks.mutate.mock.calls[0][0]).toEqual(mocks.mutate.mock.calls[1][0]);
    expect(state.sentences).toHaveLength(1);
  });
});

describe("subject notebook connections", () => {
  beforeEach(() => {
    state = applyNotebookMutation(state, { action: "upsert_sentence", expectedRevision: -1, sentence: { id: "shared", japanese: "猫が好きです。", english: "I like cats.", kana: "", subjectIds: [88] } }).state;
    state = applyNotebookMutation(state, { action: "append_blocks", pageId: "grammar", blocks: [{ id: "example", type: "sentence", props: { sentenceId: "shared" } }] }).state;
  });

  it("shows backlinks and edits the same shared record used by notebook pages", async () => {
    const { rerender } = render(<SubjectNotebookSection subject={subject} />);
    expect(screen.getByRole("link", { name: "Grammar" })).toHaveAttribute("href", "/notebooks/grammar");
    fireEvent.click(screen.getByRole("button", { name: "Edit sentence: 猫が好きです。" }));
    fireEvent.change(screen.getByLabelText("Japanese sentence"), { target: { value: "私は猫が好きです。" } });
    fireEvent.click(screen.getByRole("button", { name: "Save sentence" }));
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledWith(expect.objectContaining({ action: "upsert_sentence", expectedRevision: 0, sentence: expect.objectContaining({ id: "shared", japanese: "私は猫が好きです。" }) })));
    rerender(<SubjectNotebookSection subject={subject} />);
    expect(await screen.findByText("私は猫が好きです。")).toBeInTheDocument();
    expect(state.pages[0].content[1].props?.sentenceId).toBe("shared");
    expect(state.sentences).toHaveLength(1);
  });

  it("retains a draft and original revision when another view edits the sentence", async () => {
    const { rerender } = render(<SubjectNotebookSection subject={subject} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit sentence: 猫が好きです。" }));
    fireEvent.change(screen.getByLabelText("Japanese sentence"), { target: { value: "Draft sentence" } });
    state = applyNotebookMutation(state, { action: "upsert_sentence", expectedRevision: 0, sentence: { id: "shared", japanese: "Remote change", kana: "", english: "Changed", subjectIds: [88] } }).state;
    rerender(<SubjectNotebookSection subject={subject} />);
    expect(screen.getByLabelText("Japanese sentence")).toHaveValue("Draft sentence");
    fireEvent.click(screen.getByRole("button", { name: "Save sentence" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByLabelText("Japanese sentence")).toHaveValue("Draft sentence");
    expect(state.sentences[0].japanese).toBe("Remote change");
  });

  it("deletes an orphaned sentence only after confirmation", async () => {
    state = applyNotebookMutation(state, { action: "update_page", pageId: "grammar", expectedRevision: state.pages[0].revision, patch: { content: state.pages[0].content.filter((block) => block.id !== "example") } }).state;
    const { rerender } = render(<SubjectNotebookSection subject={subject} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete sentence" }));
    expect(screen.getByRole("group", { name: "Delete sentence confirmation" })).toHaveTextContent("from all word cards");
    expect(mocks.mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mocks.mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete sentence" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete sentence permanently" }));
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledWith({ action: "delete_sentence", sentenceId: "shared", expectedRevision: 0 }));
    rerender(<SubjectNotebookSection subject={subject} />);
    expect(state.sentences).toHaveLength(0);
    expect(screen.queryByText("猫が好きです。")).not.toBeInTheDocument();
    expect(state.pages[0].content).toHaveLength(1);
  });

  it("explains reference conflicts and retains a sentence still linked from a trashed page", async () => {
    state = applyNotebookMutation(state, { action: "trash_page", pageId: "grammar", expectedRevision: state.pages[0].revision }).state;
    render(<SubjectNotebookSection subject={subject} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete sentence" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete sentence permanently" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("including trash");
    expect(state.sentences).toHaveLength(1);
    expect(screen.getByText("猫が好きです。")).toBeInTheDocument();
  });
});

describe("notebook capture access", () => {
  it.each([
    { status: "authenticated", username: "Learner", isDemo: false },
    { status: "authenticated", username: "PortegoFan", isDemo: false },
    { status: "authenticated", username: undefined, isDemo: false },
    { status: "authenticated", username: "Portego", isDemo: true },
    { status: "anonymous", username: "Portego", isDemo: false },
    { status: "loading", username: "Portego", isDemo: false },
    { status: "unavailable", username: "Portego", isDemo: false },
  ])("hides every capture entry point for $status / $username / demo $isDemo", ({ status, username, isDemo }) => {
    mocks.session.mockReturnValue({ status, user: { data: { username } }, isDemo });
    mocks.hook.mockReturnValue({ state, isLoading: true, available: true });
    const { container } = render(<><NotebookCaptureButton subject={subject} /><NotebookCaptureDialog subject={subject} open onClose={vi.fn()} /><SubjectNotebookSection subject={subject} /></>);
    expect(container).toBeEmptyDOMElement();
    expect(mocks.hook).not.toHaveBeenCalled();
  });

  it("removes open capture and subject content as soon as Portego access is removed", () => {
    const content = <><NotebookCaptureButton subject={subject} /><NotebookCaptureDialog subject={subject} open onClose={vi.fn()} /><SubjectNotebookSection subject={subject} /></>;
    const { container, rerender } = render(content);
    expect(screen.getByRole("dialog", { name: "Add to notebook" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Notebook" })).toBeInTheDocument();
    mocks.session.mockReturnValue({ status: "authenticated", user: { data: { username: "Learner" } }, isDemo: false });
    rerender(<><NotebookCaptureButton subject={subject} /><NotebookCaptureDialog subject={subject} open onClose={vi.fn()} /><SubjectNotebookSection subject={subject} /></>);
    expect(container).toBeEmptyDOMElement();
  });
});
