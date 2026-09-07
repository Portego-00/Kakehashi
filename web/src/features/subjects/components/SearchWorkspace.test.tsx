import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SearchWorkspace } from "./SearchWorkspace";
import { DEFAULT_SEARCH_STATE } from "../search-state";

vi.mock("../data", () => ({
  useSubjectCatalog: () => ({ subjects: [], assignments: [], statistics: [], isLoading: false, isError: false }),
}));

vi.mock("../useFirstSubjectReveal", () => ({ useFirstSubjectReveal: () => ({}) }));

describe("subject search workspace", () => {
  beforeEach(() => window.history.replaceState({}, "", "/search"));

  it("focuses the search bar as soon as the workspace opens", () => {
    render(<SearchWorkspace />);

    expect(screen.getByPlaceholderText("Try 日本, Japan, or nihon")).toHaveFocus();
  });

  it("starts with only the search controls and discloses the refined filters", () => {
    render(<SearchWorkspace />);

    expect(screen.queryByRole("heading", { name: "Subject search" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Search characters, meanings/)).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Try 日本, Japan, or nihon")).toBeInTheDocument();

    const filterButton = screen.getByRole("button", { name: "Filters" });
    expect(filterButton).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("group", { name: "Subject type" })).not.toBeInTheDocument();

    fireEvent.click(filterButton);

    expect(filterButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("group", { name: "Subject type" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "SRS stage" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "WaniKani level" })).toBeInTheDocument();
    expect(screen.queryByText("0 matches")).not.toBeInTheDocument();
  });

  it("reflects active filters in the disclosure button and can clear them", () => {
    render(<SearchWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.click(screen.getByLabelText("Radicals"));

    expect(screen.getByRole("button", { name: "Filters (1)" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByRole("button", { name: "Filters" })).toBeInTheDocument();
  });

  it("restores vocabulary types from the URL and resets pagination when they change", async () => {
    render(<SearchWorkspace initialState={{ ...DEFAULT_SEARCH_STATE, vocabularyTypes: ["proper noun"], visiblePages: 3 }} />);
    expect(screen.getByRole("button", { name: "Filters (1)" })).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("button", { name: "Vocab type, Proper noun" }));
    const dialog = screen.getByRole("dialog", { name: "Vocabulary type" });
    expect(within(dialog).getByRole("checkbox", { name: "Proper noun" })).toBeChecked();
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Find vocabulary types" }), { target: { value: "verbal" } });
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Verbal noun" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));

    expect(screen.getByRole("button", { name: "Filters (2)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vocab type, Proper noun, Verbal noun" })).toHaveFocus();
    await waitFor(() => expect(window.location.search).toBe("?vocab=proper+noun%2Cverbal+noun"));
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByRole("button", { name: "Vocab type" })).toBeInTheDocument();
    await waitFor(() => expect(window.location.search).toBe(""));
  });
});
