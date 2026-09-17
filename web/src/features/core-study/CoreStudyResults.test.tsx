import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Subject } from "@/types/wanikani";
import { CoreStudyResults } from "./CoreStudyResults";
import { resultPercentage, reviewResultsSummary, type ReviewResultItem } from "./review-results";

function item(id: number, object: Subject["object"], meaningMistakes = 0, readingMistakes = 0): ReviewResultItem {
  return { assignmentId: id + 100, meaningMistakes, readingMistakes, endingStage: 5, subject: {
    id, object, url: "", data_updated_at: "", data: { level: 2, created_at: "", slug: `item-${id}`, document_url: "", hidden_at: null, auxiliary_meanings: [], characters: object === "radical" ? null : "川", meanings: [{ meaning: `Meaning ${id}`, primary: true, accepted_answer: true }], readings: object === "radical" || object === "kana_vocabulary" ? undefined : [{ reading: "かわ", primary: true, accepted_answer: true }] },
  } };
}

describe("review results", () => {
  it("counts meaningful questions only and separates mistakes by subject type", () => {
    const summary = reviewResultsSummary([item(1, "radical"), item(2, "kanji", 1), item(3, "vocabulary", 0, 1), item(4, "kana_vocabulary")]);
    expect(summary.meanings).toEqual({ correct: 3, total: 4 });
    expect(summary.readings).toEqual({ correct: 1, total: 2 });
    expect(summary.overall).toEqual({ correct: 4, total: 6 });
    expect(summary.categories).toEqual([{ type: "radical", correct: 1, total: 1 }, { type: "kanji", correct: 0, total: 1 }, { type: "vocabulary", correct: 1, total: 2 }]);
    expect(resultPercentage(4, 6)).toBe(67);
    expect(resultPercentage(0, 0)).toBeNull();
  });
  it("starts with mistakes and keeps every completed subject accessible", () => {
    render(<CoreStudyResults mode="reviews" durationMs={92000} items={[item(1, "radical"), item(2, "kanji", 1)]} />);
    expect(screen.getByRole("tab", { name: "Mistakes (1)" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Meaning missed")).toBeVisible();
    expect(screen.getByRole("link", { name: /Meaning 2.*subject details/ })).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: "Practice mistakes" })).toHaveAttribute("href", "/study/custom-review?subjectIds=2&start=1");
    fireEvent.click(screen.getByRole("tab", { name: "All subjects (2)" }));
    expect(screen.getAllByRole("link", { name: /subject details/ })).toHaveLength(2);
    expect(screen.getByText("No reading question")).toBeVisible();
    expect(screen.getByText("1m 32s", { exact: false })).toBeVisible();
  });
  it("shows all subjects for a perfect session, N/A readings, and pending sync honestly", () => {
    render(<CoreStudyResults mode="reviews" durationMs={5000} items={[item(1, "radical")]} pendingCount={1} />);
    expect(screen.getByRole("tab", { name: "All subjects (1)" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("img", { name: "Reading accuracy: not applicable" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("waiting to sync");
    fireEvent.click(screen.getByRole("tab", { name: "Mistakes (0)" }));
    expect(screen.getByText("No mistakes in this session.")).toBeVisible();
  });
});
