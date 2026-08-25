import "@testing-library/jest-dom/vitest";
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createListRepository } from "../lists";
import { ListsWorkspace } from "./ListsWorkspace";

vi.mock("@/lib/session", () => ({
  useSession: () => ({ user: { id: "user-1", data: { username: "Tester", level: 1 } } }),
}));

vi.mock("../data", () => ({
  useSubjectCatalog: () => ({ subjects: [], assignments: [], statistics: [], isLoading: false, isError: false }),
}));

vi.mock("../useFirstSubjectReveal", () => ({ useFirstSubjectReveal: () => ({}) }));

describe("subject list workspace", () => {
  afterEach(() => window.localStorage.clear());

  it("reacts to list changes made by another mounted surface", () => {
    render(<ListsWorkspace />);
    expect(screen.getByRole("heading", { name: "Create your first list" })).toBeInTheDocument();

    act(() => {
      createListRepository(window.localStorage, "Tester", undefined, () => "external").create("From dashboard");
    });

    expect(screen.getAllByText("From dashboard")).not.toHaveLength(0);
  });
});
