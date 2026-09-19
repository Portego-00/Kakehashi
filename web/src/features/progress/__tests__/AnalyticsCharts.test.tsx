import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsCartesianChart, AnalyticsDonutChart, type AnalyticsChartKind } from "../components/AnalyticsCharts";

vi.mock("motion/react", () => ({ useReducedMotion: () => true }));

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const width = this.tagName === "SPAN" ? 32 : 640;
    const height = this.tagName === "SPAN" ? 12 : 300;
    return { width, height, x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, toJSON() { return {}; } };
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const series = [{ key: "value", label: "Reviews", color: "var(--color-accent)" }];
const data = [{ key: "first", label: "Monday", value: 8 }, { key: "second", label: "Tuesday", value: 0 }, { key: "missing", label: "Wednesday", value: null, detail: "Not recorded" }];

describe("library analytics charts", () => {
  it.each<AnalyticsChartKind>(["bar", "area", "line", "horizontal-bar"])("renders a real accessible SVG for %s", (kind) => {
    const { container } = render(<AnalyticsCartesianChart kind={kind} label="Weekly reviews" data={data} series={series} />);
    expect(screen.getByRole("group", { name: "Weekly reviews" })).toHaveAttribute("data-chart-kind", kind);
    expect(screen.getByRole("application", { name: "Weekly reviews" }).tagName.toLowerCase()).toBe("svg");
    expect(container.querySelector("[data-chart-plot] svg path")).not.toBeNull();
    expect(container.querySelector(".recharts-reference-line-line")).not.toBeNull();
  });

  it("keeps missing values distinct from zero and preserves row selection", () => {
    const onSelect = vi.fn();
    render(<AnalyticsCartesianChart kind="area" label="Recorded reviews" data={data} series={series} onSelect={onSelect} />);
    const table = screen.getByRole("table", { name: "Recorded reviews data", hidden: true });
    expect(table).not.toBeVisible();
    fireEvent.click(screen.getByText("Chart data"));
    expect(table).toBeVisible();
    const row = within(table).getByRole("row", { name: /^Tuesday/ });
    expect(within(row).getByRole("cell", { name: "0" })).toHaveTextContent("0");
    expect(within(table).getByRole("row", { name: /^Wednesday/ })).toHaveTextContent("Not recorded");
    fireEvent.click(within(table).getByRole("button", { name: "Select Monday" }));
    expect(onSelect).toHaveBeenCalledWith("first");
    expect(within(table).getByRole("button", { name: "Select Monday" })).toHaveAttribute("aria-pressed", "true");
  });

  it("uses the fixed percentage domain and per-row semantic bar colors", () => {
    const { container } = render(<AnalyticsCartesianChart kind="horizontal-bar" label="Accuracy" data={[{ key: "kanji", label: "Kanji", value: 72, color: "var(--color-kanji)" }]} series={series} domain={[0, 100]} valueFormat={(value) => `${value}%`} />);
    expect(container.querySelector("svg.recharts-surface")).toHaveTextContent("100%");
    expect(container.querySelector(".recharts-bar-rectangle path")).toHaveAttribute("fill", "var(--color-kanji)");
  });

  it("keeps controlled selection aligned with parent filters and clearing", () => {
    const onSelect = vi.fn();
    const props = { label: "Controlled reviews", data, series, onSelect, kind: "bar" as const };
    const { rerender } = render(<AnalyticsCartesianChart {...props} selectedKey="first" />);
    fireEvent.click(screen.getByText("Chart data"));
    expect(screen.getByRole("button", { name: "Select Monday" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Select Tuesday" }));
    expect(onSelect).toHaveBeenCalledWith("second");
    rerender(<AnalyticsCartesianChart {...props} selectedKey="second" />);
    expect(screen.getByRole("button", { name: "Select Tuesday" })).toHaveAttribute("aria-pressed", "true");
    rerender(<AnalyticsCartesianChart {...props} selectedKey={null} />);
    expect(screen.getByRole("button", { name: "Select Tuesday" })).toHaveAttribute("aria-pressed", "false");
    rerender(<AnalyticsDonutChart label="Controlled SRS" data={[{ key: "guru", label: "Guru", value: 70, color: "var(--color-success)" }]} onSelect={onSelect} selectedKey="guru" />);
    fireEvent.click(screen.getByText("Chart data"));
    expect(screen.getByRole("button", { name: "Select Guru" })).toHaveAttribute("aria-pressed", "true");
    rerender(<AnalyticsDonutChart label="Controlled SRS" data={[{ key: "guru", label: "Guru", value: 70, color: "var(--color-success)" }]} onSelect={onSelect} selectedKey={null} />);
    expect(screen.getByRole("button", { name: "Select Guru" })).toHaveAttribute("aria-pressed", "false");
  });

  it("navigates the plotted SVG with arrow keys and selects with Enter", async () => {
    const onSelect = vi.fn();
    render(<AnalyticsCartesianChart kind="bar" label="Selectable reviews" data={data} series={series} onSelect={onSelect} />);
    const plot = screen.getByRole("application", { name: "Selectable reviews" });
    fireEvent.focus(plot);
    fireEvent.keyDown(plot, { key: "ArrowRight" });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Tuesday"));
    fireEvent.keyDown(plot, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("second");
    fireEvent.keyDown(plot, { key: "ArrowRight" });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Not recorded"));
    fireEvent.keyDown(plot, { key: " " });
    expect(onSelect).toHaveBeenCalledWith("missing");
  });

  it("renders donut sectors, accurate totals and a selectable data table", () => {
    const onSelect = vi.fn();
    const { container } = render(<AnalyticsDonutChart label="SRS distribution" data={[{ key: "apprentice", label: "Apprentice", value: 30, color: "var(--color-accent)" }, { key: "guru", label: "Guru", value: 70, color: "var(--color-success)" }]} onSelect={onSelect} centerLabel="Learned" />);
    expect(screen.getByRole("application", { name: "SRS distribution" })).toBeInTheDocument();
    expect(container.querySelectorAll(".recharts-pie-sector path")).toHaveLength(2);
    expect(screen.getByText("100")).toBeVisible();
    fireEvent.click(screen.getByText("Chart data"));
    fireEvent.click(screen.getByRole("button", { name: "Select Guru" }));
    expect(onSelect).toHaveBeenCalledWith("guru");
  });

  it("does not fabricate chart values for empty or entirely unrecorded data", () => {
    const { rerender, container } = render(<AnalyticsCartesianChart kind="line" label="Empty" data={[]} series={series} />);
    expect(screen.getByText("Your chart will appear as data becomes available.")).toBeVisible();
    expect(container.querySelector("svg.recharts-surface")).toBeNull();
    rerender(<AnalyticsCartesianChart kind="line" label="Missing" data={[data[2]]} series={series} />);
    expect(screen.getByText("No recorded values in this period.")).toBeVisible();
    rerender(<AnalyticsDonutChart label="Empty SRS" data={[{ key: "guru", label: "Guru", value: 0, color: "var(--color-success)" }]} />);
    expect(screen.getByText("No items in this distribution yet.")).toBeVisible();
    expect(container.querySelector("svg.recharts-surface")).toBeNull();
  });

  it("renders multiple stacked series with a shared legend and exact data", () => {
    const { container } = render(<AnalyticsCartesianChart kind="area" label="SRS history" stacked data={[{ key: "day", label: "Monday", apprentice: 3, guru: 7 }, { key: "next", label: "Tuesday", apprentice: 5, guru: 9 }]} series={[{ key: "apprentice", label: "Apprentice", color: "var(--color-accent)" }, { key: "guru", label: "Guru", color: "var(--color-success)" }]} />);
    expect(container.querySelectorAll(".recharts-area")).toHaveLength(2);
    expect(container.querySelectorAll(".recharts-area path").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("list", { name: "SRS history series" })).toHaveTextContent("ApprenticeGuru");
    fireEvent.click(screen.getByText("Chart data"));
    const table = screen.getByRole("table", { name: "SRS history data" });
    expect(within(table).getByRole("cell", { name: "3" })).toBeVisible();
    expect(within(table).getByRole("cell", { name: "7" })).toBeVisible();
  });

  it("keeps zero bars on the baseline without a minimum fabricated height", () => {
    const { container } = render(<AnalyticsCartesianChart kind="bar" label="Zero reviews" data={[{ key: "zero", label: "Monday", value: 0 }]} series={series} />);
    expect(container.querySelector("svg.recharts-surface")).not.toBeNull();
    expect(container.querySelector(".recharts-bar-rectangle path")).toBeNull();
    expect(container.querySelector(".recharts-reference-line-line")).not.toBeNull();
  });

  it("supports donut keyboard selection through the actual SVG", async () => {
    const onSelect = vi.fn();
    render(<AnalyticsDonutChart label="Selectable SRS" data={[{ key: "apprentice", label: "Apprentice", value: 30, color: "var(--color-accent)" }, { key: "guru", label: "Guru", value: 70, color: "var(--color-success)" }]} onSelect={onSelect} />);
    const plot = screen.getByRole("application", { name: "Selectable SRS" });
    fireEvent.focus(plot);
    fireEvent.keyDown(plot, { key: "ArrowRight" });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Guru"));
    fireEvent.keyDown(plot, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("guru");
  });
});
