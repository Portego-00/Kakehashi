import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { calculateAnalyticsInsights } from "../analytics-insights";
import { analyticsTestSystems as systems, testAssignment, testStatistic, testSubject } from "../analytics-test-fixtures";
import { ForecastWidget } from "../components/AnalyticsForecast";

vi.mock("../components/AnalyticsWidgets", () => ({ SubjectRows: ({ subjects }: { subjects: Array<{ id: number }> }) => <div>Scheduled items: {subjects.map((subject) => subject.id).join(", ")}</div> }));

function renderForecast(extra = {}) {
  const now = new Date();
  const assignments = [testAssignment(1, { available_at: now.toISOString(), started_at: now.toISOString(), srs_stage: 8 })];
  const subjects = [testSubject(1)];
  const statistics = [testStatistic(1)];
  const insights = calculateAnalyticsInsights({ assignments, subjects, statistics, progressions: [], systems, now });
  return render(<ForecastWidget insights={insights} assignments={assignments} subjects={subjects} statistics={statistics} systems={systems} level={3} {...extra} />);
}

describe("forecast controls", () => {
  it("changes horizon and grouping and reveals scheduled item details", () => {
    renderForecast();
    expect(screen.getByRole("group", { name: "Daily review forecast" })).toBeInTheDocument();
    const chart = screen.getByRole("group", { name: "Daily review forecast" });
    expect(chart).toHaveAttribute("data-chart-kind", "area");
    fireEvent.click(within(chart).getByText("Chart data"));
    fireEvent.click(within(chart).getAllByRole("button", { name: /^Select / })[0]);
    expect(screen.getByText("Scheduled items: 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "180 days" }));
    expect(screen.getByRole("group", { name: "Weekly review forecast" })).toBeInTheDocument();
    expect(screen.queryByText("Scheduled items: 1")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Daily" }));
    const daily = screen.getByRole("group", { name: "Daily review forecast" });
    if (!daily.querySelector("details")!.open) fireEvent.click(within(daily).getByText("Chart data"));
    expect(within(daily).getAllByRole("button", { name: /^Select / })).toHaveLength(180);
  });

  it("supports custom lesson pace, accuracy reset, and a zero-budget shortfall", () => {
    renderForecast({ expanded: true });
    fireEvent.change(screen.getByLabelText("Daily lesson plan"), { target: { value: "custom" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Daily lessons" }), { target: { value: "15" } });
    expect(screen.getByRole("spinbutton", { name: "Daily lessons" })).toHaveValue(15);
    expect(screen.getByRole("slider", { name: "Forecast answer accuracy" }).closest("details")).not.toHaveAttribute("open");
    fireEvent.click(screen.getByText("Accuracy and budget"));
    fireEvent.change(screen.getByRole("slider", { name: "Forecast answer accuracy" }), { target: { value: "85" } });
    expect(screen.getByRole("slider", { name: "Forecast answer accuracy" })).toHaveValue("85");
    fireEvent.click(screen.getByRole("button", { name: "Reset forecast accuracy" }));
    expect(screen.getByRole("slider", { name: "Forecast answer accuracy" })).toHaveValue("100");
    fireEvent.change(screen.getByRole("spinbutton", { name: "Daily review budget" }), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Calculate lesson pace" }));
    expect(screen.getByText("Existing reviews exceed this budget")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pause new lessons in forecast" }));
    expect(screen.getByLabelText("Daily lesson plan")).toHaveValue("0");
  });

  it("limits the final weekly drilldown to dates inside the forecast horizon", () => {
    const now = new Date(2026, 8, 10, 12);
    const dateAt = (offset: number) => { const date = new Date(now); date.setDate(date.getDate() + offset); return date.toISOString(); };
    const subjects = [testSubject(1), testSubject(2), testSubject(3)];
    const assignments = [
      testAssignment(1, { available_at: dateAt(29), srs_stage: 8 }),
      testAssignment(2, { available_at: dateAt(30), srs_stage: 8 }),
      testAssignment(3, { available_at: dateAt(32), srs_stage: 8 }),
    ];
    renderForecast({ subjects, assignments, asOf: now });
    fireEvent.click(screen.getByRole("button", { name: "Weekly" }));
    const chart = screen.getByRole("group", { name: "Weekly review forecast" });
    fireEvent.click(within(chart).getByText("Chart data"));
    const weeks = within(chart).getAllByRole("button", { name: /^Select / });
    expect(weeks).toHaveLength(5);
    fireEvent.click(weeks[4]);
    expect(screen.getByText("Scheduled items: 1")).toBeInTheDocument();
    expect(screen.queryByText(/Scheduled items: .*2|Scheduled items: .*3/)).not.toBeInTheDocument();
    expect(screen.getByText("Scheduled", { selector: "dt" }).parentElement).toHaveTextContent("1");
  });

  it("clears the chart highlight when closing forecast details and follows period selection", () => {
    renderForecast();
    const chart = screen.getByRole("group", { name: "Daily review forecast" });
    fireEvent.click(within(chart).getByText("Chart data"));
    const dates = within(chart).getAllByRole("button", { name: /^Select / });
    fireEvent.click(dates[0]);
    expect(dates[0]).toHaveAttribute("aria-pressed", "true");
    const period = screen.getByRole("combobox", { name: "Selected forecast period" });
    fireEvent.change(period, { target: { value: within(period).getAllByRole("option")[1].getAttribute("value") } });
    expect(dates[0]).toHaveAttribute("aria-pressed", "false");
    expect(dates[1]).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Close forecast detail" }));
    expect(dates[1]).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("combobox", { name: "Selected forecast period" })).not.toBeInTheDocument();
  });

  it("keeps the main estimate visible and detailed assumptions available on demand", () => {
    renderForecast();
    expect(screen.getByText("Estimated reviews / day").closest("div")).toHaveAttribute("data-primary", "true");
    expect(screen.getByText("Estimated reviews / day").closest("div")).toHaveTextContent("0");
    expect(screen.getByRole("group", { name: "Daily review forecast" })).toHaveAttribute("data-chart-kind", "area");
    expect(screen.getByText("Forecast assumptions").closest("details")).not.toHaveAttribute("open");
    fireEvent.click(screen.getByText("Forecast assumptions"));
    expect(screen.getByText(/Modeled reviews include estimated repeats and new lessons/)).toBeVisible();
  });
});
