import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BunproLessons } from "./BunproLessons";
import { bunpro } from "./client";
vi.mock("./client", () => ({ bunpro: vi.fn() }));
vi.mock("./BunproReviews", () => ({ BunproReviews: ({ onContinueLessons }: { onContinueLessons: () => void }) => <button onClick={onContinueLessons}>Continue lessons</button> }));
const deck = { data: [{ id: "1", attributes: { deck_id: 1, daily_goal: 3, batch_size: 2 } }], included: [{ id: "1", attributes: { title: "N5 Grammar", grammar_count: 100 } }] };
const items = [1, 2, 3].map(id => ({ data: { id: String(id), type: "grammar_point", attributes: { id, title: `Grammar ${id}`, meaning: `Meaning ${id}`, casual_structure: "Noun + だ" } }, included: [] }));
function setup() { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><BunproLessons initialDeck={1} /></QueryClientProvider>); }
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
