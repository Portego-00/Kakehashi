import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { BunproForecast } from "./BunproForecast";
import { bunpro } from "./client";
import { createReviewForecast, type ReviewForecastEntry } from "@/features/dashboard/review-forecast";
vi.mock("@/lib/session", () => ({ useSession: () => ({ user: { data: { username: "Learner" } }, isDemo: false }) }));
vi.mock("./client", () => ({ bunpro: vi.fn() }));
// Keep this test focused on source selection; the actual chart has its own tests.
vi.mock("@/features/dashboard/ReviewForecast", () => ({ ReviewForecast: ({ forecast, unavailable, loading }: { forecast: { dueNow: { count: number } }; unavailable?: React.ReactNode; loading?: boolean }) => <div>{loading ? "Loading" : unavailable ?? <span>{forecast.dueNow.count} due now</span>}</div> }));
afterEach(cleanup);
function setup() {
  const now = new Date("2026-09-19T15:00:00Z");
  const entries: ReviewForecastEntry[] = [{ id: "wk", availableAt: now.toISOString(), subjectType: "kanji", srsStage: 1, count: 5 }];
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><BunproForecast entries={entries} forecast={createReviewForecast(entries, now)} viewMode="chart" chartMode="hourly" breakdown="off" onViewModeChange={vi.fn()} onChartModeChange={vi.fn()} onBreakdownChange={vi.fn()} /></QueryClientProvider>);
}
it("offers connected users WaniKani, Bunpro, and combined totals", async () => {
  vi.mocked(bunpro).mockImplementation(async (query) => query === "action=connection" ? { connected: true } : { hourly: { grammar: {}, vocab: {} }, daily: { grammar: {}, vocab: {} }, due: { total_due_grammar: 10, total_due_vocab: 20 } });
  setup();
  expect(await screen.findByText("5 due now")).toBeVisible();
  fireEvent.click(await screen.findByRole("button", { name: "Bunpro" }));
  expect(await screen.findByText("30 due now")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Grammar only" }));
  expect(await screen.findByText("10 due now")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Vocabulary only" }));
  expect(await screen.findByText("20 due now")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Combined" }));
  expect(await screen.findByText("25 due now")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Grammar only" }));
  expect(await screen.findByText("15 due now")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: /^All$/ }));
  expect(await screen.findByText("35 due now")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "WaniKani" }));
  expect(await screen.findByText("5 due now")).toBeVisible();
});
it("keeps WaniKani forecasting available when there is no valid Bunpro key", async () => {
  vi.mocked(bunpro).mockResolvedValue({ connected: false });
  setup();
  expect(await screen.findByText("5 due now")).toBeVisible();
  expect(screen.queryByRole("group", { name: "Review forecast source" })).not.toBeInTheDocument();
});
