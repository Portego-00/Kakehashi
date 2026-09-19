import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calculateAnalyticsInsights } from "../analytics-insights";
import { createDefaultPaceSettings, paceSettingsStorageKey, type AnalyticsPaceSettings } from "../analytics-pace-settings";
import { PaceWidget } from "../components/AnalyticsPlanning";

const props = {
  insights: calculateAnalyticsInsights({ assignments: [], subjects: [], statistics: [], progressions: [] }),
  assignments: [], subjects: [], statistics: [], progressions: [], level: 5, resetCount: 0, expanded: true,
  asOf: new Date("2026-09-10T12:00:00.000Z"),
};
const saved: AnalyticsPaceSettings = { version: 1, goalLevel: 30, paceOverride: 12.5, origin: "started", excludedLevels: [1, 2, 8], targetDate: "2027-09-10", clipOutliers: true };

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("persisted pace planning", () => {
  it("keeps compact secondary controls and assumptions behind disclosures without losing access", async () => {
    render(<PaceWidget {...props} expanded={false} accountKey="account-a" />);
    await screen.findByRole("combobox", { name: "Goal level" });
    expect(screen.getByRole("slider", { name: "Days per level" })).not.toBeVisible();
    expect(screen.getByText("Average")).not.toBeVisible();
    expect(screen.getByText(/Dates assume the selected pace/)).not.toBeVisible();
    expect(screen.queryByText("0 reset attempts omitted")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Adjust plan"));
    expect(screen.getByRole("slider", { name: "Days per level" })).toBeVisible();
    fireEvent.change(screen.getByRole("slider", { name: "Days per level" }), { target: { value: "8.5" } });
    expect(screen.getByText("Selected pace")).toBeVisible();
    expect(screen.getByRole("slider", { name: "Days per level" })).toBeVisible();
    fireEvent.click(screen.getByText("Level history"));
    expect(screen.getByText("Average")).toBeVisible();
    expect(screen.getByRole("button", { name: "Download chart PNG" })).toBeVisible();
    fireEvent.click(screen.getByText("About"));
    expect(screen.getByText(/Dates assume the selected pace/)).toBeVisible();
  });

  it("uses goal buttons for future milestones and actual links for reached summaries", async () => {
    render(<PaceWidget {...props} expanded={false} level={21} accountKey="account-a" />);
    await screen.findByRole("combobox", { name: "Goal level" });
    fireEvent.click(screen.getByText("Adjust plan"));
    expect(screen.getByRole("link", { name: "Level 10, reached. View level summary" })).toHaveAttribute("href", "/progress/wrapped/10");
    fireEvent.click(screen.getByRole("button", { name: "Set goal to level 30" }));
    expect(screen.getByRole("combobox", { name: "Goal level" })).toHaveValue("30");
    expect(screen.getByRole("button", { name: "Set goal to level 30" })).toHaveAttribute("aria-pressed", "true");
    expect(JSON.parse(localStorage.getItem(paceSettingsStorageKey("account-a"))!).goalLevel).toBe(30);
  });

  it("loads existing choices before displaying controls without writing defaults on mount", async () => {
    localStorage.setItem(paceSettingsStorageKey("account-a"), JSON.stringify(saved));
    const write = vi.spyOn(Storage.prototype, "setItem");
    render(<PaceWidget {...props} accountKey="account-a" />);
    expect(screen.queryByRole("combobox", { name: "Goal level" })).not.toBeInTheDocument();
    expect(await screen.findByRole("combobox", { name: "Goal level" })).toHaveValue("30");
    expect(screen.getByRole("slider", { name: "Days per level" })).toHaveValue("12.5");
    expect(screen.getByRole("button", { name: "From first lesson" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Target completion date")).toHaveValue("2027-09-10");
    expect(screen.getByRole("checkbox", { name: "Clip outliers at twice the median" })).toBeChecked();
    expect(write).not.toHaveBeenCalled();
  });

  it("persists goal, pace, origin, exclusion, target and clipping only after user changes", async () => {
    render(<PaceWidget {...props} accountKey="account-a" />);
    fireEvent.change(await screen.findByRole("combobox", { name: "Goal level" }), { target: { value: "40" } });
    fireEvent.change(screen.getByRole("slider", { name: "Days per level" }), { target: { value: "8.5" } });
    fireEvent.click(screen.getByRole("button", { name: "From first lesson" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Exclude levels 1–2" }));
    fireEvent.change(screen.getByLabelText("Target completion date"), { target: { value: "2028-01-01" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Clip outliers at twice the median" }));
    expect(JSON.parse(localStorage.getItem(paceSettingsStorageKey("account-a"))!)).toEqual({ version: 1, goalLevel: 40, paceOverride: 8.5, origin: "started", excludedLevels: [], targetDate: "2028-01-01", clipOutliers: true, scenario: "custom" });
    fireEvent.click(screen.getByRole("button", { name: "Use my median" }));
    expect(JSON.parse(localStorage.getItem(paceSettingsStorageKey("account-a"))!).paceOverride).toBeNull();
  });

  it("never renders or writes the previous account's settings during an account switch", async () => {
    localStorage.setItem(paceSettingsStorageKey("account-a"), JSON.stringify(saved));
    const { rerender } = render(<PaceWidget {...props} accountKey="account-a" />);
    expect(await screen.findByRole("combobox", { name: "Goal level" })).toHaveValue("30");
    rerender(<PaceWidget {...props} accountKey="account-b" />);
    expect(screen.queryByRole("combobox", { name: "Goal level" })).not.toBeInTheDocument();
    expect(await screen.findByRole("combobox", { name: "Goal level" })).toHaveValue("60");
    expect(localStorage.getItem(paceSettingsStorageKey("account-b"))).toBeNull();
    fireEvent.change(screen.getByRole("combobox", { name: "Goal level" }), { target: { value: "20" } });
    expect(JSON.parse(localStorage.getItem(paceSettingsStorageKey("account-a"))!)).toEqual(saved);
    expect(JSON.parse(localStorage.getItem(paceSettingsStorageKey("account-b"))!)).toEqual({ ...createDefaultPaceSettings(), goalLevel: 20 });
  });

  it("keeps the planner usable when browser storage cannot be read or written", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Storage blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage blocked"); });
    render(<PaceWidget {...props} accountKey="account-a" />);
    fireEvent.change(await screen.findByRole("combobox", { name: "Goal level" }), { target: { value: "25" } });
    expect(screen.getByRole("combobox", { name: "Goal level" })).toHaveValue("25");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Pace updated for this visit"));
  });

  it("offers a custom animated projection without history and persists its scenario", async () => {
    render(<PaceWidget {...props} expanded={false} accountKey="account-a" />);
    fireEvent.change(await screen.findByRole("combobox", { name: "Pace scenario" }), { target: { value: "custom" } });
    expect(screen.getByRole("slider", { name: "Days per level" })).toBeVisible();
    expect(screen.getByRole("group", { name: "Level projection scenarios" })).toHaveAttribute("data-chart-kind", "line");
    expect(screen.getByText("Projection dates")).toBeVisible();
    expect(JSON.parse(localStorage.getItem(paceSettingsStorageKey("account-a"))!)).toMatchObject({ scenario: "custom", paceOverride: 10 });
    fireEvent.change(screen.getByRole("combobox", { name: "Goal level" }), { target: { value: "5" } });
    expect(screen.getByText("Goal reached")).toBeVisible();
    expect(screen.queryByText("Projection dates")).not.toBeInTheDocument();
  });

  it("changes the estimate for historical scenarios and compares every projected level", async () => {
    const progressions = [
      { data: { level: 3, unlocked_at: "2026-08-18T12:00:00Z", started_at: "2026-08-18T12:00:00Z", passed_at: "2026-08-26T12:00:00Z", completed_at: null, abandoned_at: null } },
      { data: { level: 4, unlocked_at: "2026-08-26T12:00:00Z", started_at: "2026-08-26T12:00:00Z", passed_at: "2026-09-07T12:00:00Z", completed_at: null, abandoned_at: null } },
      { data: { level: 5, unlocked_at: "2026-09-07T12:00:00Z", started_at: "2026-09-07T12:00:00Z", passed_at: null, completed_at: null, abandoned_at: null } },
    ];
    const { container, unmount } = render(<PaceWidget {...props} progressions={progressions} accountKey="account-a" />);
    const selector = await screen.findByRole("combobox", { name: "Pace scenario" });
    const date = () => container.querySelector("strong time")!.getAttribute("dateTime")!;
    const typical = date();
    fireEvent.change(selector, { target: { value: "faster" } });
    expect(Date.parse(date())).toBeLessThan(Date.parse(typical));
    fireEvent.change(selector, { target: { value: "relaxed" } });
    expect(Date.parse(date())).toBeGreaterThan(Date.parse(typical));
    fireEvent.click(screen.getByText("Projection dates"));
    const table = screen.getByRole("region", { name: "Projection dates table" });
    expect(within(table).getAllByRole("row")).toHaveLength(56);
    expect(within(table).getAllByRole("columnheader")).toHaveLength(4);
    fireEvent.click(screen.getByRole("checkbox", { name: "Compare paces" }));
    expect(within(table).getAllByRole("columnheader")).toHaveLength(2);
    unmount();
    render(<PaceWidget {...props} progressions={progressions} accountKey="account-a" />);
    expect(await screen.findByRole("combobox", { name: "Pace scenario" })).toHaveValue("relaxed");
  });
});
