import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Subject } from "@/types/wanikani";
import { LessonPicker } from "./LessonPicker";

function subject(id: number, object: Subject["object"], characters: string, meaning: string, level: number): Subject {
  return { id, object, url: "", data_updated_at: "", data: { level, created_at: "", slug: characters, document_url: "", hidden_at: null, characters, meanings: [{ meaning, primary: true, accepted_answer: true }], auxiliary_meanings: [], readings: [{ reading: "いち", primary: true, accepted_answer: true }] } };
}
const subjects = [subject(1, "radical", "一", "Ground", 1), subject(2, "kanji", "一", "One", 1), subject(3, "vocabulary", "一つ", "One thing", 2)];

describe("lesson picker", () => {
  it("shows vocabulary counts only on kanji in either layout and retains lesson selection", () => {
    const start = vi.fn();
    const zeroKanji = subject(4, "kanji", "二", "Two", 1);
    const items = [...subjects, zeroKanji];
    const { rerender } = render(<LessonPicker subjects={items} limit={10} onStart={start} />);
    expect(screen.queryByText(/vocab$/)).not.toBeInTheDocument();
    const counts = new Map([[1, 9], [2, 3], [3, 8], [4, 0]]);
    rerender(<LessonPicker subjects={items} limit={10} onStart={start} vocabularyUnlockCounts={counts} />);
    expect(screen.getByText("3 vocab")).toBeInTheDocument();
    expect(screen.getByText("0 vocab")).toBeInTheDocument();
    expect(screen.queryByText("9 vocab")).not.toBeInTheDocument();
    expect(screen.queryByText("8 vocab")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "一: One" })).toHaveAccessibleDescription("3 same-level vocabulary words depend on this kanji reaching Guru");
    fireEvent.click(screen.getByRole("button", { name: "一: One" }));
    fireEvent.click(screen.getByRole("button", { name: "List view" }));
    expect(screen.getByText("3 vocab")).toBeInTheDocument();
    rerender(<LessonPicker subjects={items} limit={10} onStart={start} />);
    expect(screen.queryByText("3 vocab")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start 1 lesson" }));
    expect(start).toHaveBeenCalledWith([2]);
  });

  it("keeps lesson selection usable when counts fail and offers a retry", () => {
    const retry = vi.fn();
    const start = vi.fn();
    render(<LessonPicker subjects={subjects} limit={10} onStart={start} vocabularyUnlockStatus="error" onRetryVocabularyUnlockCounts={retry} />);
    expect(screen.getByRole("status")).toHaveTextContent("Vocabulary unlock counts could not load.");
    fireEvent.click(screen.getByRole("button", { name: "Retry counts" }));
    expect(retry).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "一: One" }));
    fireEvent.click(screen.getByRole("button", { name: "Start 1 lesson" }));
    expect(start).toHaveBeenCalledWith([2]);
  });

  it("keeps selections through search, type filters, and layout changes and starts only those lessons", () => {
    const start = vi.fn();
    render(<LessonPicker subjects={subjects} limit={10} onStart={start} />);
    expect(screen.getByRole("button", { name: /^Start/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "一: Ground" }));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "いち" } });
    fireEvent.change(screen.getByLabelText("Subject type"), { target: { value: "vocabulary" } });
    fireEvent.click(screen.getByRole("button", { name: "List view" }));
    expect(screen.queryByRole("button", { name: "一: Ground" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    fireEvent.click(screen.getByRole("button", { name: "Start 2 lessons" }));
    expect(start).toHaveBeenCalledWith([1, 3]);
  });

  it("caps bulk selection at the daily allowance and lets selected lessons be deselected", () => {
    const start = vi.fn();
    render(<LessonPicker subjects={subjects} limit={1} onStart={start} />);
    fireEvent.click(screen.getByRole("button", { name: "Select level 1" }));
    expect(screen.getByRole("button", { name: "一: Ground" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "一: One" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "一: Ground" }));
    fireEvent.click(screen.getByRole("button", { name: "一: One" }));
    fireEvent.click(screen.getByRole("button", { name: "Start 1 lesson" }));
    expect(start).toHaveBeenCalledWith([2]);
  });

  it("does not start a lesson that became unavailable while selecting", () => {
    const start = vi.fn();
    const { rerender } = render(<LessonPicker subjects={subjects} limit={10} onStart={start} />);
    fireEvent.click(screen.getByRole("button", { name: "一: Ground" }));
    rerender(<LessonPicker subjects={subjects.slice(1)} limit={10} onStart={start} />);
    expect(screen.getByRole("button", { name: /^Start/ })).toBeDisabled();
  });
});
