import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { SessionResults } from "./SessionResults";
import type { SessionResult } from "./session-results";
const wanikaniResults: import("@/features/core-study/review-results").ReviewResultItem[] = [{ assignmentId: 2, meaningMistakes: 1, readingMistakes: 0, endingStage: 2, subject: { id: 2, object: "vocabulary", url: "", data_updated_at: "", data: { level: 1, created_at: "", slug: "学校", document_url: "", hidden_at: null, auxiliary_meanings: [], characters: "学校", meanings: [{ meaning: "School", primary: true, accepted_answer: true }], readings: [{ reading: "がっこう", primary: true, accepted_answer: true }] } } }];
const items: SessionResult[] = [
  { id: "bunpro:1", source: "bunpro", kind: "grammar", title: "です", meaning: "To be", correct: true, href: "/bunpro/grammar/desu", sentence: { before: "学生", answer: "です", after: "。" }, translation: "I am a student.", audioUrls: ["https://audio.test/desu.mp3"], previousStage: "Beginner 1", stage: "Beginner 2" },
  { id: "wanikani:2", source: "wanikani", kind: "vocabulary", title: "学校", meaning: "School", reading: "がっこう", correct: false, href: "/subjects/2", stage: "Apprentice 2" },
];
afterEach(cleanup);
it("places the standalone WaniKani results above Bunpro-only results", () => {
  render(<SessionResults title="Mixed reviews complete" mixed wanikaniResults={wanikaniResults} items={items} durationMs={65000} pendingCount={0} />);
  const wk = screen.getByRole("region", { name: "WaniKani results" });
  const bp = screen.getByRole("region", { name: "Bunpro results" });
  expect(wk.compareDocumentPosition(bp) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(within(wk).getByRole("img", { name: "Meaning accuracy: 0% (0 of 1)" })).toBeInTheDocument();
  expect(within(wk).getByRole("img", { name: "Reading accuracy: 100% (1 of 1)" })).toBeInTheDocument();
  expect(within(wk).getByRole("tab", { name: "Mistakes (1)" })).toBeInTheDocument();
  expect(within(wk).getByRole("link", { name: /Open 学校/ })).toHaveAttribute("target", "_blank");
  expect(within(bp).getByLabelText("Session summary")).toHaveTextContent("100%");
  expect(within(bp).getByRole("img", { name: "1 correct and 0 missed" })).toBeInTheDocument();
  expect(within(bp).getByText("1 subjects reviewed")).toBeInTheDocument();
  expect(within(bp).getByRole("button", { name: "Play audio for です" })).toBeInTheDocument();
  expect(within(bp).getByText("Beginner 1 → Beginner 2")).toBeInTheDocument();
  expect(within(bp).queryByText("School")).not.toBeInTheDocument();
});
it("filters Bunpro results without changing the WaniKani results", () => {
  render(<SessionResults title="Mixed reviews complete" mixed wanikaniResults={wanikaniResults} items={items} durationMs={0} pendingCount={0} />);
  fireEvent.click(screen.getByRole("button", { name: "Missed" }));
  expect(screen.queryByRole("link", { name: "Open です details" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Open 学校/ })).toBeInTheDocument();
  expect(screen.getByText("No missed subjects for this selection.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Correct" }));
  expect(screen.getByRole("link", { name: "Open です details" })).toBeInTheDocument();
});
it("keeps pending WaniKani submissions and errors visible in the combined summary", () => {
  render(<SessionResults title="Mixed reviews complete" mixed wanikaniResults={wanikaniResults} items={items} durationMs={0} pendingCount={2} error="Reconnect WaniKani" />);
  expect(screen.getByRole("status")).toHaveTextContent("2 completed reviews");
  expect(screen.getByRole("alert")).toHaveTextContent("Reconnect WaniKani");
});
it("does not invent accuracy for an empty session", () => {
  render(<SessionResults title="No Bunpro reviews waiting" items={[]} durationMs={0} pendingCount={0} />);
  expect(screen.queryByText("100%")).not.toBeInTheDocument();
  expect(screen.getByText("No reviews in this session.")).toBeInTheDocument();
});
