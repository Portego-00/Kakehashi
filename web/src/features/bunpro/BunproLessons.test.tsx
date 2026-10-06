import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BunproLessons } from "./BunproLessons";
import { bunpro } from "./client";
vi.mock("./client", () => ({ bunpro: vi.fn() }));
vi.mock("./BunproReviews", () => ({ BunproReviews: ({ onContinueLessons }: { onContinueLessons: () => void }) => <button onClick={onContinueLessons}>Continue lessons</button> }));
const deck = { data: [{ id: "1", attributes: { deck_id: 1, daily_goal: 3, batch_size: 2 } }], included: [{ id: "1", attributes: { title: "N5 Grammar", grammar_count: 100 } }] };
const items = [1, 2, 3].map(id => ({ data: { id: String(id), type: "grammar_point", attributes: { id, title: `Grammar ${id}`, meaning: `Meaning ${id}`, casual_structure: "Noun + だ" } }, included: [] }));
function setup(initialDeck?: number) { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><BunproLessons initialDeck={initialDeck} /></QueryClientProvider>); }
function withProgress(learnedToday: number, completed = learnedToday) {
  return { ...deck, data: [{ ...deck.data[0], attributes: { ...deck.data[0].attributes, daily_goal_count_grammar: learnedToday, complete_grammar_count: completed } }] };
}
beforeEach(() => { vi.stubGlobal("scrollTo", vi.fn()); vi.mocked(bunpro).mockReset().mockImplementation(async query => query === "action=lesson-queue" ? deck : { content: items }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("limits the batch, supports previous and starts a quiz with only that batch", async () => {
  setup(); await screen.findByRole("heading", { name: "Grammar 1" });
  expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByRole("heading", { name: "Grammar 2" });
  fireEvent.click(screen.getByRole("button", { name: "Previous" }));
  await screen.findByRole("heading", { name: "Grammar 1" });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  vi.mocked(bunpro).mockResolvedValueOnce({ review_session_id: 1, pending_attempt: [{ data: { id: "10", type: "review", attributes: { ghost_count: 0 } } }] });
  fireEvent.click(screen.getByRole("button", { name: "Start Quiz" }));
  await screen.findByRole("button", { name: "Continue lessons" });
  expect(bunpro).toHaveBeenCalledWith("", expect.objectContaining({ body: JSON.stringify({ action: "lesson-quiz", deckId: 1, reviewables: [["GrammarPoint", 1], ["GrammarPoint", 2]] }) }));
  vi.mocked(bunpro).mockResolvedValueOnce({ data: [] });
  fireEvent.click(screen.getByRole("button", { name: "Continue lessons" }));
  await screen.findByRole("heading", { name: "Lessons complete" });
});
it("keeps the lesson batch available after a quiz request fails", async () => {
  setup(); await screen.findByRole("heading", { name: "Grammar 1" });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  vi.mocked(bunpro).mockRejectedValueOnce(new Error("Service unavailable"));
  fireEvent.click(screen.getByRole("button", { name: "Start Quiz" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Service unavailable");
  expect(screen.getByRole("heading", { name: "Grammar 2" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Start Quiz" })).toBeEnabled();
});
it("does not send quiz requests when the queue is empty", async () => {
  vi.mocked(bunpro).mockResolvedValue({ data: [] }); setup();
  await screen.findByRole("heading", { name: "Lessons complete" });
  expect(bunpro).toHaveBeenCalledTimes(1);
});
it.each([3, 5])("loads a configured batch after learning %i lessons against a daily goal of 3", async (learnedToday) => {
  vi.mocked(bunpro).mockImplementation(async query => query === "action=lesson-queue" ? withProgress(learnedToday) : { content: items });
  setup();
  await screen.findByRole("heading", { name: "Grammar 1" });
  expect(screen.getAllByRole("button", { name: /^Lesson \d:/ })).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByRole("heading", { name: "Grammar 2" });
  vi.mocked(bunpro).mockResolvedValueOnce({ review_session_id: 2, pending_attempt: [{ data: { id: "10", type: "review", attributes: { ghost_count: 0 } } }] });
  fireEvent.click(screen.getByRole("button", { name: "Start Quiz" }));
  await screen.findByRole("button", { name: "Continue lessons" });
  expect(bunpro).toHaveBeenCalledWith("", expect.objectContaining({ body: JSON.stringify({ action: "lesson-quiz", deckId: 1, reviewables: [["GrammarPoint", 1], ["GrammarPoint", 2]] }) }));
});
it("continues to a fresh batch after the quiz reaches the daily goal", async () => {
  setup();
  await screen.findByRole("heading", { name: "Grammar 1" });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  vi.mocked(bunpro).mockResolvedValueOnce({ review_session_id: 3, pending_attempt: [{ data: { id: "10", type: "review", attributes: { ghost_count: 0 } } }] });
  fireEvent.click(screen.getByRole("button", { name: "Start Quiz" }));
  await screen.findByRole("button", { name: "Continue lessons" });
  const nextItems = items.map(item => ({ ...item, data: { ...item.data, id: String(Number(item.data.id) + 3), attributes: { ...item.data.attributes, id: item.data.attributes.id + 3, title: `Grammar ${item.data.attributes.id + 3}` } } }));
  vi.mocked(bunpro).mockImplementation(async query => query === "action=lesson-queue" ? withProgress(3) : { content: nextItems });
  fireEvent.click(screen.getByRole("button", { name: "Continue lessons" }));
  await screen.findByRole("heading", { name: "Grammar 4" });
  expect(screen.getAllByRole("button", { name: /^Lesson \d:/ })).toHaveLength(2);
});
it("keeps the chosen deck after its goal is met even if another deck has lessons due", async () => {
  const queue = withProgress(3);
  vi.mocked(bunpro).mockImplementation(async query => query === "action=lesson-queue" ? {
    data: [...queue.data, { id: "2", attributes: { deck_id: 2, daily_goal: 3, batch_size: 1 } }],
    included: [...queue.included, { id: "2", attributes: { title: "N4 Grammar", grammar_count: 100 } }],
  } : { content: items });
  setup(1);
  await screen.findByRole("heading", { name: "Grammar 1" });
  expect(bunpro).toHaveBeenCalledWith("action=learn&deck=1", expect.anything());
  expect(screen.getAllByRole("button", { name: /^Lesson \d:/ })).toHaveLength(2);
});
it("uses the first unfinished deck when all goals are met and no deck is chosen", async () => {
  vi.mocked(bunpro).mockImplementation(async query => query === "action=lesson-queue" ? withProgress(3) : { content: items });
  setup();
  await screen.findByRole("heading", { name: "Grammar 1" });
  expect(bunpro).toHaveBeenCalledWith("action=learn&deck=1", expect.anything());
});
it.each([3, 100])("prioritizes unmet daily goals when the first deck has %i completed lessons", async (completed) => {
  const queue = withProgress(3, completed);
  vi.mocked(bunpro).mockImplementation(async query => query === "action=lesson-queue" ? {
    data: [...queue.data, { id: "2", attributes: { deck_id: 2, daily_goal: 3, batch_size: 1 } }],
    included: [...queue.included, { id: "2", attributes: { title: "N4 Grammar", grammar_count: 100 } }],
  } : { content: items });
  setup();
  await screen.findByRole("heading", { name: "Grammar 1" });
  expect(bunpro).toHaveBeenCalledWith("action=learn&deck=2", expect.anything());
  expect(screen.getAllByRole("button", { name: /^Lesson \d:/ })).toHaveLength(1);
});
it("limits extra batches to the remaining lessons in the deck", async () => {
  vi.mocked(bunpro).mockImplementation(async query => query === "action=lesson-queue" ? withProgress(3, 99) : { content: items.slice(0, 1) });
  setup();
  await screen.findByRole("heading", { name: "Grammar 1" });
  expect(screen.getAllByRole("button", { name: /^Lesson \d:/ })).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Start Quiz" })).toBeEnabled();
});
it("does not request lessons for a finished deck", async () => {
  vi.mocked(bunpro).mockResolvedValue(withProgress(3, 100));
  setup();
  await screen.findByRole("heading", { name: "Lessons complete" });
  expect(screen.getByText("No more lessons are available in your learn queue.")).toBeVisible();
  expect(bunpro).toHaveBeenCalledTimes(1);
});
