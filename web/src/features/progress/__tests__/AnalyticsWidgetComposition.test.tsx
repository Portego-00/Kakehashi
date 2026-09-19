import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { calculateAnalyticsInsights } from "../analytics-insights";
import { analyticsTestNow, testAssignment, testStatistic, testSubject } from "../analytics-test-fixtures";
import { AccuracyWidget, ActivityWidget, BurnsWidget, CurrentLevelWidget, RetentionWidget, SrsWidget, WorkloadWidget, type AnalyticsWidgetProps } from "../components/AnalyticsWidgets";

function widgetProps(): AnalyticsWidgetProps {
  const subjects = [testSubject(1), testSubject(2), testSubject(3), testSubject(4)];
  const assignments = [
    testAssignment(1, { srs_stage: 2, passed_at: "2026-09-01T12:00:00Z" }),
    testAssignment(2, { srs_stage: 4 }),
    testAssignment(3, { srs_stage: 0, started_at: null }),
    testAssignment(4, { srs_stage: 0, started_at: null, unlocked_at: null }),
  ];
  const statistics = subjects.map((subject) => testStatistic(subject.id));
  const insights = calculateAnalyticsInsights({ subjects, assignments, statistics, progressions: [], currentLevel: 3, now: analyticsTestNow, days: 365 });
  return { subjects, assignments, statistics, insights, level: 3 };
}

describe("cohesive analytics widget composition", () => {
  it("shows actual current-level kanji and preserves permanent passed status", () => {
    render(<CurrentLevelWidget {...widgetProps()} />);
    const kanji = screen.getByRole("group", { name: "Level 3 kanji progress" });
    expect(within(kanji).getAllByRole("link")).toHaveLength(4);
    expect(within(kanji).getByRole("link", { name: "日: Sun, passed" })).toHaveAttribute("href", "/subjects/1");
    expect(within(kanji).getByRole("link", { name: "日: Sun, passed" })).toHaveAttribute("data-passed", "true");
    expect(within(kanji).getByRole("link", { name: "日: Sun, in progress" })).toHaveAttribute("data-passed", "false");
    expect(within(kanji).getByRole("link", { name: "日: Sun, lesson available" })).toHaveAttribute("href", "/subjects/3");
    expect(within(kanji).getByRole("link", { name: "日: Sun, locked" })).toHaveAttribute("href", "/subjects/4");
    expect(screen.getByRole("meter", { name: "Kanji needed to level up" })).toHaveAttribute("aria-valuenow", "1");
    expect(screen.getByRole("link", { name: "Level progress" })).toHaveAttribute("href", "/progress");
  });

  it("keeps the compact SRS legend and chart data selection synchronized", () => {
    render(<SrsWidget {...widgetProps()} />);
    const legendStage = screen.getByRole("button", { name: "Apprentice: 2 items" });
    fireEvent.click(legendStage);
    const chart = screen.getByRole("group", { name: "SRS distribution" });
    fireEvent.click(within(chart).getByText("Chart data"));
    expect(within(chart).getAllByRole("rowheader")).toHaveLength(5);
    expect(within(chart).getByRole("button", { name: "Select Apprentice" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(legendStage);
    expect(within(chart).getByRole("button", { name: "Select Apprentice" })).toHaveAttribute("aria-pressed", "false");
  });

  it("leads activity with its result and retains calendar, bars and hourly views", () => {
    render(<ActivityWidget {...widgetProps()} />);
    const result = screen.getByText("Lessons in period");
    const toolbar = screen.getByRole("group", { name: "Activity metric" });
    expect(result.compareDocumentPosition(toolbar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const view = screen.getByRole("combobox", { name: "Activity display" });
    expect(view).toHaveValue("calendar");
    fireEvent.change(view, { target: { value: "bars" } });
    expect(screen.getByRole("group", { name: "lessons per day" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Earlier lessons per day" })).toBeEnabled();
    fireEvent.change(view, { target: { value: "hourly" } });
    expect(screen.getByRole("group", { name: "lessons by local hour" })).toBeInTheDocument();
    fireEvent.click(within(toolbar).getByRole("button", { name: "Burns" }));
    expect(view).toHaveValue("calendar");
    expect(within(view).queryByRole("option", { name: "By hour" })).not.toBeInTheDocument();
  });

  it("keeps next-burn dates outside the headline number band", () => {
    render(<BurnsWidget {...widgetProps()} />);
    expect(screen.getByText("Burned items").closest("dl")).not.toContainElement(screen.getByText("Next possible burn"));
    expect(screen.getByText("Next possible burn").nextElementSibling).toHaveTextContent("Not yet available");
    fireEvent.click(screen.getByRole("button", { name: "Upcoming" }));
    expect(screen.getByText("Next possible burn")).toBeInTheDocument();
    expect(screen.getByText("Burn estimates")).toBeInTheDocument();
  });

  it("keeps the next review and queue navigation alongside explanatory details", () => {
    render(<WorkloadWidget {...widgetProps()} />);
    expect(screen.getByText("Next review").closest("dl")).toBeNull();
    expect(screen.getByRole("link", { name: "Review queue" })).toHaveAttribute("href", "/reviews");
    fireEvent.click(screen.getByText("Scheduled reviews only"));
    expect(screen.getByText(/chart filters do not change these totals/)).toBeVisible();
  });

  it("keeps compact accuracy comparisons and full level history available", () => {
    render(<AccuracyWidget {...widgetProps()} />);
    const chart = screen.getByRole("group", { name: "Accuracy by type" });
    expect(chart).toHaveAttribute("data-chart-kind", "horizontal-bar");
    expect(chart.querySelector("[data-chart-plot]")).toHaveStyle({ "--chart-min-height": "160px" });
    fireEvent.click(screen.getByRole("button", { name: "Level" }));
    expect(screen.getByRole("group", { name: "Accuracy by level" })).toHaveAttribute("data-chart-kind", "line");
    expect(screen.getByRole("group", { name: "Accuracy by level" }).querySelector("[data-chart-plot]")).toHaveStyle({ "--chart-min-height": "220px" });
  });

  it("uses a categorical comparison for accuracy by current SRS stage", () => {
    render(<RetentionWidget {...widgetProps()} />);
    expect(screen.getByRole("group", { name: "Lifetime accuracy by current stage" })).toHaveAttribute("data-chart-kind", "horizontal-bar");
    fireEvent.click(screen.getByText("Chart data"));
    expect(screen.getByRole("table", { name: "Lifetime accuracy by current stage data" })).toBeVisible();
  });
});
