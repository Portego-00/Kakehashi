import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { SessionResults } from "./SessionResults";
import type { SessionResult } from "./session-results";
const items: SessionResult[] = [
  { id: "bunpro:1", source: "bunpro", kind: "grammar", title: "です", meaning: "To be", correct: true, href: "/bunpro/grammar/desu", sentence: { parts: ["学生", "。"], answer: "です" }, translation: "I am a student.", audioUrls: ["https://audio.test/desu.mp3"], previousStage: "Beginner 1", stage: "Beginner 2" },
  { id: "wanikani:2", source: "wanikani", kind: "vocabulary", title: "学校", meaning: "School", reading: "がっこう", correct: false, href: "/subjects/2", stage: "Apprentice 2" },
];
afterEach(cleanup);
it("combines both sources with first-try accuracy and new-tab detail links", () => {
  render(<SessionResults title="Mixed reviews complete" mixed items={items} durationMs={65000} pendingCount={0} />);
  expect(screen.getByText("50%")).toBeInTheDocument();
  expect(screen.getByText("2 subjects reviewed · 1m 5s")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Open です details" })).toHaveAttribute("href", "/bunpro/grammar/desu");
  expect(screen.getByRole("link", { name: "Open 学校 details" })).toHaveAttribute("target", "_blank");
  expect(screen.getByRole("button", { name: "Play audio for です" })).toBeInTheDocument();
  expect(screen.getByText("Beginner 1 → Beginner 2")).toBeInTheDocument();
});
it("filters correct and missed subjects and can narrow mixed results by source", () => {
  render(<SessionResults title="Mixed reviews complete" mixed items={items} durationMs={0} pendingCount={0} />);
  fireEvent.click(screen.getByRole("button", { name: "Missed" }));
  expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(1);
  expect(screen.queryByRole("link", { name: "Open です details" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox", { name: "Source" }), { target: { value: "bunpro" } });
  expect(screen.getByText("No missed subjects for this selection.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Correct" }));
  expect(screen.getByRole("link", { name: "Open です details" })).toBeInTheDocument();
});
it("keeps pending WaniKani submissions and errors visible in the combined summary", () => {
  render(<SessionResults title="Mixed reviews complete" mixed items={items} durationMs={0} pendingCount={2} error="Reconnect WaniKani" />);
  expect(screen.getByRole("status")).toHaveTextContent("2 WaniKani submissions");
  expect(screen.getByRole("alert")).toHaveTextContent("Reconnect WaniKani");
});
it("does not invent accuracy for an empty session", () => {
  render(<SessionResults title="No Bunpro reviews waiting" items={[]} durationMs={0} pendingCount={0} />);
  expect(screen.queryByText("100%")).not.toBeInTheDocument();
  expect(screen.getByText("No reviews in this session.")).toBeInTheDocument();
});
