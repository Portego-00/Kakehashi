import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Subject, SubjectType } from "@/types/wanikani";
import NotebookSubjectPicker from "./NotebookSubjectPicker";

function subject(id: number, object: SubjectType, characters: string | null, meaning: string): Subject {
  return { id, object, url: "", data_updated_at: "2026-09-07T00:00:00.000Z", data: {
    level: 1, created_at: "2026-09-07T00:00:00.000Z", slug: characters || meaning.toLocaleLowerCase(), document_url: "", hidden_at: null, characters,
    meanings: [{ meaning, primary: true, accepted_answer: true }], readings: object === "radical" ? [] : [{ reading: object === "kanji" ? "さん" : "やま", primary: true, accepted_answer: true }], auxiliary_meanings: [],
  } };
}
const subjects = [subject(1, "radical", "山", "Mountain"), subject(2, "kanji", "山", "Mountain"), subject(3, "vocabulary", "山", "Mountain"), subject(4, "kana_vocabulary", "こんにちは", "Hello")];
afterEach(cleanup);

describe("notebook subject picker", () => {
  it("keeps the search and filters while subjects load, then shows the matching results", () => {
    const props = { onSelect: vi.fn() };
    const view = render(<NotebookSubjectPicker {...props} subjects={[]} subjectsLoading />);
    fireEvent.change(screen.getByRole("textbox", { name: "Search subjects" }), { target: { value: "mountain" } });
    fireEvent.click(screen.getByRole("button", { name: "Kanji" }));
    expect(screen.getByRole("status")).toHaveTextContent("Loading subjects…");
    expect(screen.queryByText("No subjects found.")).not.toBeInTheDocument();
    expect(screen.queryByText("0 matches")).not.toBeInTheDocument();
    view.rerender(<NotebookSubjectPicker {...props} subjects={subjects} subjectsLoading={false} />);
    expect(screen.getByRole("textbox", { name: "Search subjects" })).toHaveValue("mountain");
    expect(screen.getByRole("button", { name: "Kanji" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Link kanji: 山, Mountain" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("1 match");
  });
  it("offers retry without replacing a failed load with an empty result or hiding cached subjects", () => {
    const onRetrySubjects = vi.fn();
    const onSelect = vi.fn();
    const view = render(<NotebookSubjectPicker subjects={[]} subjectsError="Network error" onRetrySubjects={onRetrySubjects} onSelect={onSelect} />);
    expect(screen.getByRole("status")).toHaveTextContent("Subjects could not be loaded.");
    expect(screen.queryByText("No subjects found.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry subjects" }));
    expect(onRetrySubjects).toHaveBeenCalledOnce();
    view.rerender(<NotebookSubjectPicker subjects={subjects} subjectsError="Network error" onRetrySubjects={onRetrySubjects} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Link radical: 山, Mountain" }));
    expect(onSelect).toHaveBeenCalledWith(subjects[0], false);
  });
  it("shows distinct subject types and returns the chosen subject using block insertion by default", () => {
    const onSelect = vi.fn();
    render(<NotebookSubjectPicker subjects={subjects} onSelect={onSelect} />);
    expect(screen.getByRole("status")).toHaveTextContent("4 matches");
    for (const item of subjects) expect(screen.getByRole("button", { name: new RegExp(`^Link ${item.object.replace("_", " ")}:`) })).toHaveAttribute("data-type", item.object);
    fireEvent.click(screen.getByRole("button", { name: "Link radical: 山, Mountain" }));
    expect(onSelect).toHaveBeenCalledWith(subjects[0], false);
  });
  it("filters radicals, kanji, and both vocabulary types and supports inline insertion", () => {
    const onSelect = vi.fn();
    render(<NotebookSubjectPicker subjects={subjects} initialInline onSelect={onSelect} />);
    fireEvent.click(within(screen.getByRole("group", { name: "Subject type" })).getByRole("button", { name: "Kanji" }));
    expect(screen.getByRole("status")).toHaveTextContent("1 match");
    expect(screen.queryByRole("button", { name: "Link radical: 山, Mountain" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Link kanji: 山, Mountain" }));
    expect(onSelect).toHaveBeenCalledWith(subjects[1], true);
    fireEvent.click(screen.getByRole("button", { name: "Kana vocabulary" }));
    expect(screen.getByRole("button", { name: "Link kana vocabulary: こんにちは, Hello" })).toBeInTheDocument();
  });
  it("provides empty-search recovery and preserves focus when clearing the query", () => {
    render(<NotebookSubjectPicker subjects={subjects} onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Radicals" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Search subjects" }), { target: { value: "hello" } });
    expect(screen.getByText("No subjects found.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Search all subject types" }));
    expect(screen.getByRole("button", { name: "Link kana vocabulary: こんにちは, Hello" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear subject search" }));
    expect(screen.getByRole("textbox", { name: "Search subjects" })).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("4 matches");
  });
  it("uses the shared image-radical renderer instead of treating missing characters as a word", () => {
    const gun = subject(5, "radical", null, "Gun");
    gun.data.character_images = [{ url: "https://example.com/gun.svg", content_type: "image/svg+xml" }];
    render(<NotebookSubjectPicker subjects={[gun]} onSelect={vi.fn()} />);
    const result = screen.getByRole("button", { name: "Link radical: Gun, Gun" });
    expect(result.querySelector('[data-has-character-image="true"]')).toBeInTheDocument();
    expect(result.querySelector("img")).toHaveAttribute("alt", "Gun radical");
  });
});
