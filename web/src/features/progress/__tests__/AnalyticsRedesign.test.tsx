import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { calculateAnalyticsInsights } from "../analytics-insights";
import { analyticsTestNow, testAssignment, testStatistic, testSubject } from "../analytics-test-fixtures";
import { AccuracyWidget, ActivityWidget, CurrentLevelWidget, WorkloadWidget, type AnalyticsWidgetProps } from "../components/AnalyticsWidgets";
import { BarChart, PagedBarChart } from "../components/AnalyticsPrimitives";
import { CoverageWidget, ReadingCoverageWidget } from "../components/AnalyticsCoverage";

afterEach(cleanup);

function widgetProps(): AnalyticsWidgetProps {
  const subjects = Array.from({ length: 60 }, (_, index) => testSubject(index + 1, "kanji", { level: index + 1 }));
  const statistics = subjects.map((subject) => testStatistic(subject.id));
  const assignments = subjects.map((subject) => testAssignment(subject.id));
  const insights = calculateAnalyticsInsights({ subjects, statistics, assignments, progressions: [], currentLevel: 60, now: analyticsTestNow, days: 365 });
  return { subjects, statistics, assignments, insights, level: 60 };
}

describe("analytics card redesign", () => {
  it("keeps all 60 accuracy levels reachable without expanding the card", () => {
    const props = widgetProps();
    const { rerender } = render(<AccuracyWidget {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Level" }));
    fireEvent.click(screen.getByText("Chart data"));
    const chart = screen.getByRole("table", { name: "Accuracy by level data" });
    expect(within(chart).getAllByRole("rowheader")).toHaveLength(60);
    expect(screen.getByText("60 levels")).toBeVisible();
    fireEvent.change(screen.getByRole("combobox", { name: "Metric" }), { target: { value: "reading" } });
    expect(within(chart).getByRole("row", { name: /^Level 60 / })).toHaveTextContent("100%");
    expect(within(chart).getByRole("columnheader", { name: "Reading" })).toBeVisible();
    rerender(<AccuracyWidget {...props} expanded />);
    expect(within(chart).getAllByRole("rowheader")).toHaveLength(60);
    expect(screen.getByRole("combobox", { name: "Metric" })).toHaveValue("reading");
  });

  it("excludes hidden subjects and hidden review statistics from level accuracy", () => {
    const props = widgetProps();
    props.subjects[0].data.hidden_at = analyticsTestNow.toISOString();
    props.statistics[1].data.hidden = true;
    render(<AccuracyWidget {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Level" }));
    fireEvent.click(screen.getByText("Chart data"));
    const chart = screen.getByRole("table", { name: "Accuracy by level data" });
    expect(within(chart).getAllByRole("rowheader")).toHaveLength(58);
    expect(within(chart).queryByRole("rowheader", { name: /^Level 1$/ })).not.toBeInTheDocument();
    expect(within(chart).queryByRole("rowheader", { name: /^Level 2$/ })).not.toBeInTheDocument();
  });

  it("pages all historical bars including a partial earliest page", () => {
    const bars = Array.from({ length: 65 }, (_, index) => ({ key: String(index), label: `Day ${index + 1}`, value: index }));
    render(<PagedBarChart label="History" bars={bars} pageSize={30} interval="days" />);
    fireEvent.click(screen.getByText("Chart data"));
    const plot = screen.getByRole("table", { name: "History data" });
    expect(within(plot).getAllByRole("rowheader")).toHaveLength(30);
    expect(within(plot).getByRole("row", { name: "Day 65 64" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Earlier History" }));
    fireEvent.click(screen.getByRole("button", { name: "Earlier History" }));
    expect(within(plot).getAllByRole("rowheader")).toHaveLength(5);
    expect(within(plot).getByRole("row", { name: "Day 1 0" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Earlier History" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Later History" }));
    expect(within(plot).getAllByRole("rowheader")).toHaveLength(30);
  });

  it("shows nearest upcoming dates first and can reach the final partial page", () => {
    const bars = Array.from({ length: 13 }, (_, index) => ({ key: String(index), label: `Month ${index + 1}`, value: index }));
    render(<PagedBarChart label="Upcoming" bars={bars} pageSize={12} interval="months" anchor="start" />);
    fireEvent.click(screen.getByText("Chart data"));
    expect(screen.getByRole("row", { name: "Month 1 0" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Earlier Upcoming" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Later Upcoming" }));
    expect(screen.getByRole("row", { name: "Month 13 12" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Later Upcoming" })).toBeDisabled();
  });

  it("preserves the historical date anchor when expanding, refreshing, and shrinking", () => {
    const bars = Array.from({ length: 365 }, (_, index) => ({ key: String(index), label: `Day ${index + 1}`, value: index }));
    const { rerender } = render(<PagedBarChart label="History" bars={bars} pageSize={30} interval="days" />);
    fireEvent.click(screen.getByText("Chart data"));
    fireEvent.click(screen.getByRole("button", { name: "Earlier History" }));
    expect(screen.getByText("Day 306 – Day 335 · 365 days")).toBeVisible();
    rerender(<PagedBarChart label="History" bars={bars} pageSize={90} interval="days" />);
    expect(screen.getByText("Day 246 – Day 335 · 365 days")).toBeVisible();
    expect(screen.getByRole("row", { name: "Day 335 334" })).toBeVisible();
    const refreshed = [...bars, { key: "365", label: "Day 366", value: 365 }];
    rerender(<PagedBarChart label="History" bars={refreshed} pageSize={30} interval="days" />);
    expect(screen.getByText("Day 306 – Day 335 · 366 days")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Later History" }));
    fireEvent.click(screen.getByRole("button", { name: "Later History" }));
    expect(screen.getByText("Day 337 – Day 366 · 366 days")).toBeVisible();
    expect(screen.getByRole("button", { name: "Later History" })).toBeDisabled();
  });

  it("preserves the first upcoming date when changing page size", () => {
    const bars = Array.from({ length: 60 }, (_, index) => ({ key: String(index), label: `Month ${index + 1}`, value: index }));
    const { rerender } = render(<PagedBarChart label="Upcoming" bars={bars} pageSize={12} interval="months" anchor="start" />);
    fireEvent.click(screen.getByRole("button", { name: "Later Upcoming" }));
    expect(screen.getByText("Month 13 – Month 24 · 60 months")).toBeVisible();
    rerender(<PagedBarChart label="Upcoming" bars={bars} pageSize={36} interval="months" anchor="start" />);
    expect(screen.getByText("Month 13 – Month 48 · 60 months")).toBeVisible();
    rerender(<PagedBarChart label="Upcoming" bars={bars} pageSize={12} interval="months" anchor="start" />);
    expect(screen.getByText("Month 13 – Month 24 · 60 months")).toBeVisible();
  });

  it("keeps remaining dates reachable if an expanded page is larger than the dataset", () => {
    const bars = Array.from({ length: 65 }, (_, index) => ({ key: String(index), label: `Day ${index + 1}`, value: index }));
    const { rerender } = render(<PagedBarChart label="History" bars={bars} pageSize={30} interval="days" />);
    fireEvent.click(screen.getByRole("button", { name: "Earlier History" }));
    rerender(<PagedBarChart label="History" bars={bars} pageSize={90} interval="days" />);
    expect(screen.getByText("Day 1 – Day 35 · 65 days")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Later History" }));
    fireEvent.click(screen.getByText("Chart data"));
    expect(screen.getByRole("row", { name: "Day 65 64" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Later History" })).not.toBeInTheDocument();
  });

  it("keeps full date context in paginated history captions", () => {
    render(<PagedBarChart label="Past days" bars={[{ key: "old", label: "9/1", rangeLabel: "Sep 1, 2024", value: 1 }, { key: "new", label: "9/1", rangeLabel: "Sep 1, 2025", value: 2 }]} pageSize={1} interval="days" />);
    expect(screen.getByText(/Sep 1, 2025/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Earlier Past days" }));
    expect(screen.getByText(/Sep 1, 2024/)).toBeVisible();
  });

  it("makes unavailable values and accuracy details accessible without requiring a hover", () => {
    render(<BarChart label="Reviews" bars={[{ key: "missing", label: "Monday", value: null }, { key: "hour", label: "10:00", value: 8, detail: "87.5% accuracy" }]} />);
    fireEvent.click(screen.getByText("Chart data"));
    expect(screen.getByText("Not recorded")).toBeVisible();
    expect(screen.getByRole("row", { name: "Monday Not recorded" })).not.toHaveTextContent("0");
    expect(screen.getByText("87.5% accuracy")).toBeVisible();
  });

  it("labels preview coverage as passed instead of retaining an ineffective Burned control", () => {
    const props = widgetProps();
    render(<CoverageWidget {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Burned" }));
    fireEvent.click(screen.getByRole("button", { name: "At level" }));
    expect(screen.queryByRole("group", { name: "Known threshold" })).not.toBeInTheDocument();
    expect(screen.getByText("Passed through level 30")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Current" }));
    expect(screen.getByRole("button", { name: "Burned" })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps queue totals stable when changing chart filters and preserves options", () => {
    render(<WorkloadWidget {...widgetProps()} />);
    const due = screen.getByText("Due now").parentElement!;
    expect(due).toHaveAttribute("data-primary", "true");
    expect(due).toHaveTextContent("60");
    expect(screen.queryByRole("spinbutton", { name: "Seconds per item" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Review chart options" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Seconds per item" }), { target: { value: "24" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Scheduled SRS stage" }), { target: { value: "Guru" } });
    expect(due).toHaveTextContent("60");
    fireEvent.click(screen.getByRole("button", { name: "Review chart options" }));
    fireEvent.click(screen.getByRole("button", { name: "Review chart options" }));
    expect(screen.getByRole("spinbutton", { name: "Seconds per item" })).toHaveValue(24);
    expect(screen.getByRole("combobox", { name: "Scheduled SRS stage" })).toHaveValue("Guru");
  });

  it("changes the primary activity total with the selected metric", () => {
    render(<ActivityWidget {...widgetProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Lessons" }));
    expect(screen.getByText("Lessons in period").parentElement).toHaveTextContent("60");
    fireEvent.click(within(screen.getByRole("group", { name: "Activity metric" })).getByRole("button", { name: "Burns" }));
    expect(screen.getByText("Burns in period").parentElement).toHaveTextContent("0");
    expect(screen.queryByText("Lessons in period")).not.toBeInTheDocument();
  });

  it("counts every unpassed kanji on the final level, not only the 90% threshold", () => {
    const props = widgetProps();
    props.subjects = Array.from({ length: 10 }, (_, index) => testSubject(index + 1, "kanji", { level: 60 }));
    props.assignments = props.subjects.map((subject, index) => testAssignment(subject.id, { passed_at: index < 9 ? analyticsTestNow.toISOString() : null }));
    render(<CurrentLevelWidget {...props} />);
    expect(screen.getByText(/1 more kanji to complete/)).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "Final level kanji passed" })).toHaveAttribute("aria-valuemax", "10");
    expect(screen.queryByText("Earliest level-up")).not.toBeInTheDocument();
  });

  it("preserves edited text while switching between passage and highlighted results", () => {
    const props = widgetProps();
    render(<ReadingCoverageWidget subjects={props.subjects} assignments={props.assignments} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Japanese text" }), { target: { value: "日日月" } });
    fireEvent.click(screen.getByRole("button", { name: "Highlighted" }));
    expect(screen.queryByRole("textbox", { name: "Japanese text" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Passage" }));
    expect(screen.getByRole("textbox", { name: "Japanese text" })).toHaveValue("日日月");
    fireEvent.click(screen.getByRole("button", { name: "Clear reading text" }));
    expect(screen.getByRole("textbox", { name: "Japanese text" })).toHaveValue("");
  });
});
