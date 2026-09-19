import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { calculateAnalyticsInsights } from "../analytics-insights";
import { testAssignment, testReview, testSubject } from "../analytics-test-fixtures";
import { ActivityWidget } from "../components/AnalyticsWidgets";

afterEach(cleanup);

describe("recorded activity", () => {
  it("distinguishes unavailable and partial dates and limits item drilldowns to their metric", () => {
    const now = new Date(2026, 8, 10, 12);
    const recordingStartedAt = new Date(2026, 8, 10, 9).toISOString();
    const subjects = [testSubject(1, "kanji", { characters: "日" }), testSubject(2, "kanji", { characters: "月" })];
    const assignments = [testAssignment(1, { started_at: new Date(2026, 8, 10, 8).toISOString() }), testAssignment(2, { started_at: new Date(2026, 8, 9).toISOString() })];
    const insights = calculateAnalyticsInsights({ subjects, assignments, statistics: [], progressions: [], currentLevel: 3, now, days: 2, reviews: [testReview(1, 2, { created_at: new Date(2026, 8, 10, 10).toISOString() })], reviewHistoryAvailable: true, reviewHistoryStartedAt: recordingStartedAt });
    render(<ActivityWidget insights={insights} subjects={subjects} assignments={assignments} statistics={[]} level={3} expanded />);
    fireEvent.click(within(screen.getByRole("group", { name: "Activity metric" })).getByRole("button", { name: "Reviews" }));
    expect(screen.getByRole("button", { name: "2026-09-09: reviews not recorded" })).toHaveAttribute("data-unavailable", "true");
    fireEvent.click(screen.getByRole("button", { name: "2026-09-10: 1 reviews (partial day)" }));
    expect(screen.getByRole("link", { name: "月" })).toHaveAttribute("href", "/subjects/2");
    expect(screen.queryByRole("link", { name: "日" })).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("group", { name: "Activity metric" })).getByRole("button", { name: "Lessons" }));
    expect(screen.getByRole("link", { name: "日" })).toHaveAttribute("href", "/subjects/1");
    expect(screen.queryByRole("link", { name: "月" })).not.toBeInTheDocument();
  });

  it("finds the best day across the full period even when the calendar shows only its latest year", () => {
    const now = new Date(2026, 8, 10, 12);
    const oldBestDay = new Date(2024, 8, 10, 8).toISOString();
    const subjects = [testSubject(1), testSubject(2), testSubject(3)];
    const assignments = [testAssignment(1, { started_at: oldBestDay }), testAssignment(2, { started_at: oldBestDay }), testAssignment(3, { started_at: now.toISOString() })];
    const insights = calculateAnalyticsInsights({ subjects, assignments, statistics: [], progressions: [], currentLevel: 3, now, days: "all" });
    expect(insights.activity.length).toBeGreaterThan(365);
    render(<ActivityWidget insights={insights} subjects={subjects} assignments={assignments} statistics={[]} level={3} expanded />);
    expect(screen.queryByRole("button", { name: "2024-09-10: 2 lessons" })).not.toBeInTheDocument();
    const bestDay = screen.getByText("Best day in period").parentElement!;
    expect(within(bestDay).getByText("2")).toBeVisible();
    fireEvent.change(screen.getByRole("combobox", { name: "Year" }), { target: { value: "2026" } });
    expect(within(bestDay).getByText("2")).toBeVisible();
  });
});
