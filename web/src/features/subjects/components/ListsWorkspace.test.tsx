import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createListRepository } from "../lists";
import { ListsWorkspace } from "./ListsWorkspace";

vi.mock("@/lib/session", () => ({
  useSession: () => ({ user: { data: { id: "user-1", username: "Tester", level: 1 } } }),
}));

vi.mock("../data", () => ({
  useSubjectCatalog: () => ({
    subjects: [{
      id: 440,
      object: "vocabulary",
      url: "https://api.wanikani.com/v2/subjects/440",
      data_updated_at: "2026-08-20T10:00:00.000Z",
      data: {
        level: 19,
        created_at: "2026-08-20T10:00:00.000Z",
        slug: "detailed",
        document_url: "https://www.wanikani.com/vocabulary/細かい",
        hidden_at: null,
        characters: "細かい",
        meanings: [{ meaning: "Detailed", primary: true, accepted_answer: true }],
        auxiliary_meanings: [],
        readings: [{ reading: "こまかい", primary: true, accepted_answer: true, type: "kunyomi" }],
      },
    }, {
      id: 441,
      object: "vocabulary",
      url: "https://api.wanikani.com/v2/subjects/441",
      data_updated_at: "2026-08-20T10:00:00.000Z",
      data: {
        level: 1,
        created_at: "2026-08-20T10:00:00.000Z",
        slug: "japan",
        document_url: "https://www.wanikani.com/vocabulary/日本",
        hidden_at: null,
        characters: "日本",
        meanings: [{ meaning: "Japan", primary: true, accepted_answer: true }],
        auxiliary_meanings: [],
        readings: [{ reading: "にほん", primary: true, accepted_answer: true, type: "kunyomi" }],
      },
    }],
    assignments: [],
    statistics: [],
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("../useFirstSubjectReveal", () => ({ useFirstSubjectReveal: () => ({}) }));

function dataTransfer() {
  const values = new Map<string, string>();
  return {
    dropEffect: "none",
    effectAllowed: "none",
    getData: (type: string) => values.get(type) ?? "",
    setData: (type: string, value: string) => { values.set(type, value); },
    setDragImage: vi.fn(),
  } as unknown as DataTransfer;
}

function rect(top: number, height: number): DOMRect {
  return { left: 0, top, right: 800, bottom: top + height, width: 800, height, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
}

function fireDrag(element: HTMLElement, type: "dragover" | "drop", clientY: number, transfer: DataTransfer) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, { clientY: { value: clientY }, dataTransfer: { value: transfer } });
  fireEvent(element, event);
}

describe("subject list workspace", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ lists: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })));
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("reacts to list changes made by another mounted surface", async () => {
    render(<ListsWorkspace />);
    expect(await screen.findByRole("heading", { name: "Create your first list" })).toBeInTheDocument();

    act(() => {
      createListRepository(window.localStorage, "Tester", undefined, () => "external").create("From dashboard");
    });

    expect(screen.getAllByText("From dashboard")).not.toHaveLength(0);
  });

  it("hydrates lists created by the mobile app from the shared account store", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      lists: [{
        id: "mobile-review",
        name: "Mobile review",
        subjectIds: [440, 441],
        createdAt: "2026-08-20T10:00:00.000Z",
        updatedAt: "2026-08-24T10:00:00.000Z",
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    render(<ListsWorkspace />);

    expect(await screen.findAllByText("Mobile review")).not.toHaveLength(0);
    expect(fetch).toHaveBeenCalledWith("/api/subjects/lists", expect.objectContaining({ cache: "no-store" }));
  });

  it("keeps long vocabulary characters on one stretching tile", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      lists: [{
        id: "mobile-review",
        name: "Mobile review",
        subjectIds: [440],
        createdAt: "2026-08-20T10:00:00.000Z",
        updatedAt: "2026-08-24T10:00:00.000Z",
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const { container } = render(<ListsWorkspace />);

    await screen.findAllByText("Detailed");
    expect(container.querySelector("ol span[data-character-count='3']")).toHaveTextContent("細かい");
  });

  it("adds subjects from the catalog search dialog", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      lists: [{
        id: "mobile-review",
        name: "Mobile review",
        subjectIds: [],
        createdAt: "2026-08-20T10:00:00.000Z",
        updatedAt: "2026-08-24T10:00:00.000Z",
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    render(<ListsWorkspace />);
    fireEvent.click(await screen.findByRole("button", { name: "Add subjects" }));

    const dialog = screen.getByRole("dialog", { name: "Add subjects" });
    const body = dialog.querySelector<HTMLElement>('[class*="addDialogBody"]');
    expect(body).not.toBeNull();
    expect(body?.querySelector('[class*="addDialogResults"]')).not.toBeNull();
    const search = within(dialog).getByPlaceholderText("Try 日本, Japan, or nihon");
    expect(search).toHaveFocus();
    fireEvent.change(search, { target: { value: "Detailed" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add" }));

    expect(within(dialog).getByRole("button", { name: "Added" })).toBeDisabled();
    expect(screen.getAllByText("細かい")).toHaveLength(2);
  });

  it("reorders subjects by dropping a row before or after another row", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      lists: [{
        id: "mobile-review",
        name: "Mobile review",
        subjectIds: [440, 441],
        createdAt: "2026-08-20T10:00:00.000Z",
        updatedAt: "2026-08-24T10:00:00.000Z",
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const { container } = render(<ListsWorkspace />);
    await screen.findByText("Japan");
    const sourceHandle = container.querySelector<HTMLElement>('[title="Drag Detailed to reorder"]')!;
    const targetRow = container.querySelector<HTMLElement>('[data-subject-id="441"]')!;
    vi.spyOn(targetRow, "getBoundingClientRect").mockReturnValue(rect(100, 64));
    const transfer = dataTransfer();

    fireEvent.dragStart(sourceHandle, { dataTransfer: transfer });
    fireDrag(targetRow, "dragover", 150, transfer);
    expect(targetRow).toHaveAttribute("data-drop-edge", "after");
    fireDrag(targetRow, "drop", 150, transfer);

    await waitFor(() => expect([...container.querySelectorAll<HTMLElement>("[data-subject-id]")].map((row) => Number(row.dataset.subjectId))).toEqual([441, 440]));
    expect(createListRepository(window.localStorage, "Tester").load()[0].subjectIds).toEqual([441, 440]);
    expect(screen.getByText("Detailed moved to position 2.")).toHaveClass("sr-only");
  });

  it("opens a study-mode picker and links straight into the selected list session", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      lists: [{
        id: "mobile-review",
        name: "Mobile review",
        subjectIds: [440, 441],
        createdAt: "2026-08-20T10:00:00.000Z",
        updatedAt: "2026-08-24T10:00:00.000Z",
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    render(<ListsWorkspace />);
    fireEvent.click(await screen.findByRole("button", { name: "Study this list" }));

    const dialog = screen.getByRole("dialog", { name: "Choose study mode" });
    expect(within(dialog).getByText("2 subjects in Mobile review")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: /Standard review/ })).toHaveAttribute(
      "href",
      "/study/custom-review?subjectIds=440,441&start=1",
    );
    expect(within(dialog).getByRole("link", { name: /Custom lessons/ })).toHaveAttribute(
      "href",
      "/study/custom-lessons?subjectIds=440,441&start=1",
    );
    expect(within(dialog).getByRole("link", { name: /Random test/ })).toHaveAttribute(
      "href",
      "/study/random-test?subjectIds=440,441&start=1",
    );
    expect(within(dialog).getByRole("button", { name: /Kanji match/ })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: /Kanji writing/ })).toBeDisabled();
    expect(within(dialog).getByText("Add at least 2 kanji to use this mode.")).toBeInTheDocument();
  });
});
