import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SearchWorkspace } from "./SearchWorkspace";

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
});
