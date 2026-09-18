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
