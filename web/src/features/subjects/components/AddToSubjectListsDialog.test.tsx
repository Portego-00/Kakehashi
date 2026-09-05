import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createListRepository, type ListStorage } from "../lists";
import { AddToSubjectListsDialog, type SubjectListsState } from "./AddToSubjectListsDialog";

function setupRepository() {
  const values = new Map<string, string>();
  const storage: ListStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
  };
  let id = 0;
  const repository = createListRepository(
    storage,
    "Tester",
    () => new Date("2026-09-01T12:00:00.000Z"),
    () => `list-${++id}`,
  );
  return repository;
}

function dialogProps(
  repository: ReturnType<typeof setupRepository>,
  overrides: Partial<Omit<SubjectListsState, "repository">> = {},
) {
  return {
    open: true,
    subjectId: 42,
    subjectLabel: "日本",
    subjectType: "vocabulary",
    subjectLists: {
      repository,
      lists: repository.load(),
      syncing: false,
      syncError: "",
      ...overrides,
    },
    onClose: vi.fn(),
  };
}

describe("AddToSubjectListsDialog", () => {
  it("preselects existing memberships and reconciles additions and removals on Save", () => {
    const repository = setupRepository();
    const existing = repository.create("Already saved");
    const available = repository.create("Next reviews");
    repository.addSubject(existing.id, 42);
    const props = dialogProps(repository);

    render(<AddToSubjectListsDialog {...props} />);
    const dialog = screen.getByRole("dialog", { name: "Add to Lists" });
    const existingCheckbox = within(dialog).getByRole("checkbox", { name: /Already saved/ });
    const availableCheckbox = within(dialog).getByRole("checkbox", { name: /Next reviews/ });
    expect(existingCheckbox).toBeChecked();
    expect(availableCheckbox).not.toBeChecked();

    fireEvent.click(existingCheckbox);
    fireEvent.click(availableCheckbox);
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    const saved = repository.load();
    expect(saved.find((list) => list.id === existing.id)?.subjectIds).toEqual([]);
    expect(saved.find((list) => list.id === available.id)?.subjectIds).toEqual([42]);
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it("allows saving with no lists selected to remove every membership", () => {
    const repository = setupRepository();
    const first = repository.create("First");
    const second = repository.create("Second");
    repository.addSubject(first.id, 42);
    repository.addSubject(second.id, 42);
    const props = dialogProps(repository);

    render(<AddToSubjectListsDialog {...props} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /First/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Second/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(repository.load().every((list) => !list.subjectIds.includes(42))).toBe(true);
    expect(screen.queryByText("Select at least one list.")).not.toBeInTheDocument();
  });

  it("keeps checkbox changes local when Cancel is pressed", () => {
    const repository = setupRepository();
    const existing = repository.create("Already saved");
    const available = repository.create("Next reviews");
    repository.addSubject(existing.id, 42);
    const props = dialogProps(repository);

    render(<AddToSubjectListsDialog {...props} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Already saved/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Next reviews/ }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    const saved = repository.load();
    expect(saved.find((list) => list.id === existing.id)?.subjectIds).toEqual([42]);
    expect(saved.find((list) => list.id === available.id)?.subjectIds).toEqual([]);
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it("creates an empty selected list and adds the subject only after Save", () => {
    const repository = setupRepository();
    const props = dialogProps(repository);

    render(<AddToSubjectListsDialog {...props} />);
    fireEvent.change(screen.getByLabelText("New list"), { target: { value: "Leech rescue" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    const created = repository.load()[0];
    expect(created).toMatchObject({ name: "Leech rescue", subjectIds: [] });
    expect(screen.getByRole("checkbox", { name: /Leech rescue/ })).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(repository.load()[0].subjectIds).toEqual([42]);
  });

  it("leaves a newly created list empty when the dialog is cancelled", () => {
    const repository = setupRepository();
    const props = dialogProps(repository);

    render(<AddToSubjectListsDialog {...props} />);
    fireEvent.change(screen.getByLabelText("New list"), { target: { value: "Later" } });
    fireEvent.submit(screen.getByLabelText("New list").closest("form")!);
    expect(screen.getByRole("checkbox", { name: /Later/ })).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(repository.load()[0]).toMatchObject({ name: "Later", subjectIds: [] });
  });

  it("announces loading, empty, syncing, and sync-error states", () => {
    const repository = setupRepository();
    const props = dialogProps(repository, { syncing: true });
    const { rerender } = render(<AddToSubjectListsDialog {...props} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading lists…");

    rerender(<AddToSubjectListsDialog {...dialogProps(repository)} />);
    expect(screen.getByText("No lists yet. Create your first one above.")).toBeInTheDocument();

    const list = repository.create("Local list");
    rerender(<AddToSubjectListsDialog {...dialogProps(repository, { lists: [list], syncing: true })} />);
    expect(screen.getByRole("status")).toHaveTextContent("Syncing lists…");

    rerender(<AddToSubjectListsDialog {...dialogProps(repository, { lists: [list], syncError: "Cloud unavailable." })} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Cloud unavailable. Your browser copy is still available.");
    expect(screen.getByRole("button", { name: "Close add to lists" })).toBeInTheDocument();
  });
});
