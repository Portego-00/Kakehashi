import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { ReviewForecast } from "./ReviewForecast";
import { createReviewForecast, type ReviewForecast as ReviewForecastData } from "./review-forecast";

const NOW = new Date(2026, 8, 6, 12, 30);
const ENTRIES = [
  { id: "due", availableAt: new Date(2026, 8, 6, 11).toISOString(), subjectType: "radical" as const, srsStage: 1, critical: true },
  { id: "soon", availableAt: new Date(2026, 8, 6, 12, 45).toISOString(), subjectType: "kana_vocabulary" as const, srsStage: 5 },
  { id: "tomorrow", availableAt: new Date(2026, 8, 7, 9).toISOString(), subjectType: "vocabulary" as const, srsStage: 7 },
  { id: "later", availableAt: new Date(2026, 8, 15, 9).toISOString(), subjectType: "kanji" as const, srsStage: 8 },
];

function ForecastHarness({ forecast = createReviewForecast(ENTRIES, NOW), loading = false, unavailable }: { forecast?: ReviewForecastData; loading?: boolean; unavailable?: string }) {
  const [viewMode, onViewModeChange] = useState<"chart" | "list">("chart");
  const [chartMode, onChartModeChange] = useState<"hourly" | "daily">("hourly");
  const [breakdown, onBreakdownChange] = useState<"off" | "subject" | "srs">("off");
  return <ReviewForecast {...{ forecast, viewMode, chartMode, breakdown, onViewModeChange, onChartModeChange, onBreakdownChange, loading, unavailable }} />;
}

describe("mobile-style review forecast", () => {
  it("switches ranges and cycles through both breakdowns without changing the schedule", () => {
    render(<ForecastHarness />);
    expect(screen.getByRole("button", { name: "Hourly" })).toHaveAttribute("aria-pressed", "true");
    expect(within(screen.getByRole("list", { name: "Hourly review forecast" })).getAllByRole("listitem")).toHaveLength(24);
    expect(screen.getByRole("listitem", { name: "Now: 1 total reviews, 0 new reviews" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Daily" }));
    const daily = screen.getByRole("list", { name: "Daily review forecast" });
    expect(within(daily).getAllByRole("listitem")).toHaveLength(7);
    expect(within(daily).getByRole("listitem", { name: "Today: 2 total reviews, 1 new reviews" })).toBeInTheDocument();
    expect(within(daily).getByRole("listitem", { name: "Tomorrow: 3 total reviews, 1 new reviews" })).toBeInTheDocument();
    expect(screen.getByText("1 more review is scheduled after these 7 days.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Breakdown: Off" }));
    expect(screen.getByLabelText("Subject type legend")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Breakdown: Type" }));
    expect(screen.getByLabelText("SRS stage legend")).toBeInTheDocument();
    expect(screen.queryByLabelText("Subject type legend")).not.toBeInTheDocument();
    expect(within(daily).getByRole("listitem", { name: "Today: 2 total reviews, 1 new reviews" })).toHaveAttribute("title", expect.stringContaining("Guru: 1"));
    fireEvent.click(screen.getByRole("button", { name: "Breakdown: SRS" }));
    expect(screen.getByRole("button", { name: "Breakdown: Off" })).toBeInTheDocument();
    expect(screen.queryByLabelText("SRS stage legend")).not.toBeInTheDocument();
  });

  it("keeps expanded days through schedule refreshes and retains chart range when returning from List", () => {
    const { rerender } = render(<ForecastHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Daily" }));
    fireEvent.click(screen.getByRole("button", { name: "List view" }));
    expect(screen.queryByRole("button", { name: "Hourly" })).not.toBeInTheDocument();
    const today = screen.getByRole("button", { name: /^Today:/ });
    const tomorrow = screen.getByRole("button", { name: /^Tomorrow:/ });
    expect(today).toHaveAttribute("aria-expanded", "true");
    expect(tomorrow).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("listitem", { name: "Now: 0 new reviews, 1 total reviews" })).toBeVisible();
    fireEvent.click(today);
    fireEvent.click(tomorrow);

    rerender(<ForecastHarness forecast={createReviewForecast(ENTRIES, new Date(2026, 8, 6, 12, 46))} />);
    expect(screen.getByRole("button", { name: /^Today:/ })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: /^Tomorrow:/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("listitem", { name: "9am: 1 new reviews, 3 total reviews" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Chart view" }));
    expect(screen.getByRole("button", { name: "Daily" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("list", { name: "Daily review forecast" })).toBeInTheDocument();
  });

  it("shows an honest empty day and no forecast counts while loading or unavailable", () => {
    const { rerender } = render(<ForecastHarness forecast={createReviewForecast([], NOW)} />);
    fireEvent.click(screen.getByRole("button", { name: "List view" }));
    const emptyDays = screen.getAllByText("No reviews scheduled for this day.");
    expect(emptyDays[0]).toBeVisible();
    emptyDays.slice(1).forEach((day) => expect(day).not.toBeVisible());
    expect(screen.getByRole("listitem", { name: "Now: 0 new reviews, 0 total reviews" })).toBeVisible();

    rerender(<ForecastHarness loading />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading review forecast");
    expect(screen.queryByRole("button", { name: "Chart view" })).not.toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();

    rerender(<ForecastHarness unavailable="Review schedule is unavailable." />);
    expect(screen.getByText("Review schedule is unavailable.")).toBeVisible();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });
});
