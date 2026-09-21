import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BunproCoverage } from "./BunproCoverage";
import { bunpro } from "./client";
import { coverageItems, coverageStage } from "./coverage";
vi.mock("./client", () => ({ bunpro: vi.fn() }));
const vocabulary = [1, 2, 3].map(id => ({ id: `Vocab-${id}`, type: "reviewable_base_attribute_mixed", attributes: { id, title: `Word ${id}`, kana: "かな", meaning: `Meaning ${id}`, level: "N5", slug: `word-${id}` } }));
const reviews = [
  { id: "10", type: "review", attributes: { reviewable_type: "Vocab", reviewable_id: 1, complete: true, streak: 12 } },
  { id: "11", type: "review", attributes: { reviewable_type: "Vocab", reviewable_id: 2, complete: false, streak: 4 } },
  { id: "12", type: "review", attributes: { reviewable_type: "GrammarPoint", reviewable_id: 3, complete: true, streak: 12 } },
];
function setup() { render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><BunproCoverage vocabulary={vocabulary} /></QueryClientProvider>); }
beforeEach(() => {
  vi.mocked(bunpro).mockReset().mockResolvedValue({ data: reviews });
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(cleanup);
it("counts only completed vocabulary reviews and keeps grammar IDs separate", () => {
  expect(coverageItems(vocabulary, reviews).map(item => item.learned)).toEqual([true, false, false]);
  expect(coverageStage(7).name).toBe("Seasoned");
  expect(coverageStage(12).name).toBe("Master");
});
it("shows real coverage, grouped selection and a new-tab link for a selected word", async () => {
  setup(); await screen.findByText("You've covered 33% of this item's Vocab");
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
  fireEvent.click(screen.getByRole("button", { name: "Expand List" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Select all new to you" }));
  expect(screen.getByText("2 selected")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("checkbox", { name: "Select Word 2" }));
  expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute("target", "_blank");
  expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute("href", "https://bunpro.jp/vocabs/word-3");
  fireEvent.click(screen.getByRole("button", { name: "Stop Selecting" }));
  expect(screen.getByRole("checkbox", { name: "Select Word 3" })).not.toBeChecked();
});
it("saves only graded words after the knowledge check is explicitly saved", async () => {
  setup(); await screen.findByText("You've covered 33% of this item's Vocab");
  fireEvent.click(screen.getByRole("button", { name: "Knowledge Check" }));
  fireEvent.click(screen.getByRole("button", { name: "Show meaning" }));
  fireEvent.click(screen.getByRole("button", { name: "Master" }));
  fireEvent.click(screen.getByRole("button", { name: "Skip" }));
  expect(bunpro).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Save progress" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(bunpro).toHaveBeenCalledWith("", expect.objectContaining({ body: JSON.stringify({ action: "coverage-save", ids: [2], streak: 12 }) }));
});
it("does not pretend failed progress is zero coverage", async () => {
  vi.mocked(bunpro).mockRejectedValue(new Error("Unavailable")); setup();
  await screen.findByText("Couldn't load your vocabulary progress.");
  expect(screen.getByRole("button", { name: "Knowledge Check" })).toBeDisabled();
  expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
});
it("retries only unsaved groups after a partial knowledge-check failure", async () => {
  setup(); await screen.findByText("You've covered 33% of this item's Vocab");
  fireEvent.click(screen.getByRole("button", { name: "Knowledge Check" }));
  fireEvent.click(screen.getByRole("button", { name: "Show meaning" }));
  fireEvent.click(screen.getByRole("button", { name: "Beginner" }));
  fireEvent.click(screen.getByRole("button", { name: "Show meaning" }));
  fireEvent.click(screen.getByRole("button", { name: "Master" }));
  vi.mocked(bunpro).mockResolvedValueOnce({ data: [] }).mockRejectedValueOnce(new Error("Try again"));
  fireEvent.click(screen.getByRole("button", { name: "Save progress" }));
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Save progress" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  const saves = vi.mocked(bunpro).mock.calls.map(([, options]) => JSON.parse(String(options?.body))).filter(body => body.action === "coverage-save");
  expect(saves.map(body => body.streak)).toEqual([0, 12, 12]);
});
