import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NotebookEditor from "./NotebookEditor";
import type { NotebookSentence } from "./model";

const orphan: NotebookSentence = { id: "orphan", japanese: "今日は晴れです。", kana: "", english: "It is sunny today.", subjectIds: [], revision: 2, createdAt: "2026-09-07T00:00:00.000Z", updatedAt: "2026-09-07T00:00:00.000Z" };
beforeEach(() => {
  vi.stubGlobal("matchMedia", vi.fn((media: string) => ({ media, matches: false, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() })));
  vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn(); });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function editorProps(onDeleteSentence: (id: string) => Promise<void>) {
  return { value: [], onChange: vi.fn(), sentences: [orphan], pages: [], subjects: [], onSaveSentence: vi.fn(), onOpenSubject: vi.fn(), onOpenPage: vi.fn(), onDeleteSentence };
}

describe("existing sentence library cleanup", () => {
  it("keeps the editor and shared sentences available while vocabulary examples are loading", async () => {
    const props = editorProps(vi.fn());
    const onRetrySubjects = vi.fn();
    const view = render(<NotebookEditor {...props} subjectsLoading onRetrySubjects={onRetrySubjects} />);
    expect(screen.getByLabelText("Notebook page content")).toHaveAttribute("contenteditable", "true");
    fireEvent.click(screen.getByRole("button", { name: "Sentence" }));
    expect(screen.getByText(orphan.japanese)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Search sentences" }), { target: { value: "Japan" } });
    expect(await screen.findByText("Loading vocabulary examples…")).toBeInTheDocument();
    expect(screen.queryByText("No sentences found.")).not.toBeInTheDocument();
    view.rerender(<NotebookEditor {...props} subjectsError="Offline" onRetrySubjects={onRetrySubjects} />);
    expect(screen.getByRole("textbox", { name: "Search sentences" })).toHaveValue("Japan");
    expect(screen.getByText("Vocabulary examples could not be loaded.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry subjects" }));
    expect(onRetrySubjects).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("tab", { name: "Write a sentence" }));
    expect(screen.getByLabelText("Japanese sentence")).toBeEnabled();
    expect(props.onChange).not.toHaveBeenCalled();
  });
  it("makes sentences without word associations deletable without inserting them", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const props = editorProps(onDelete);
    const view = render(<NotebookEditor {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Sentence" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Search sentences" }), { target: { value: "sunny" } });
    fireEvent.click(await screen.findByRole("button", { name: `Delete sentence: ${orphan.japanese}` }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(props.onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith("orphan"));
    view.rerender(<NotebookEditor {...props} sentences={[]} />);
    expect(await screen.findByText("Sentence deleted.")).toBeInTheDocument();
    expect(screen.queryByText(orphan.japanese)).not.toBeInTheDocument();
  });

  it("keeps the sentence visible when a notebook or Trash reference prevents deletion", async () => {
    const onDelete = vi.fn().mockRejectedValue(new Error("Remove this sentence from notebook pages, including trash, before deleting it."));
    render(<NotebookEditor {...editorProps(onDelete)} />);
    fireEvent.click(screen.getByRole("button", { name: "Sentence" }));
    fireEvent.click(screen.getByRole("button", { name: `Delete sentence: ${orphan.japanese}` }));
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("including trash");
    expect(screen.getByText(orphan.japanese)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete permanently" })).toBeEnabled();
  });
});
