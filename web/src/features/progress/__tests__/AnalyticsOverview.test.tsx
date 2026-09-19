import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Assignment } from "@/types/wanikani";
import { AnalyticsOverview, LevelTimingChart } from "../components/AnalyticsOverview";
import type { LevelTiming } from "../calculations";

const { progressData } = vi.hoisted(() => ({
  progressData: {
    assignments: [] as Assignment[],
    subjects: [],
    statistics: [],
    progressions: [] as Array<{ data: { level: number; unlocked_at: string | null; started_at: string | null; passed_at: string | null; completed_at: string | null; abandoned_at: string | null } }>,
    resets: [],
    isLoading: false,
    isError: false,
    retry: vi.fn(),
  },
}));

vi.mock("../data", () => ({ useProgressData: () => progressData }));
vi.mock("@/lib/session", () => ({ useSession: () => ({ user: { id: 1, data: { username: "learner", level: 3, started_at: "2026-01-01" } }, isDemo: false }) }));
vi.mock("../analytics-history", () => ({ useAnalyticsHistory: () => ({ reviews: [], systems: [], availability: "unavailable", isLoading: false, isError: false, retry: vi.fn() }) }));

function assignment(id: number, updatedAt: string, startedAt: string | null): Assignment {
  return {
    id,
    object: "assignment",
    url: "",
    data_updated_at: updatedAt,
    data: {
      subject_id: id,
      subject_type: "kanji",
      srs_stage: startedAt ? 2 : 0,
      available_at: null,
      started_at: startedAt,
      unlocked_at: startedAt,
      passed_at: null,
      burned_at: null,
      resurrected_at: null,
      hidden: false,
      created_at: "2026-08-01T00:00:00Z",
    },
  };
}

describe("analytics dashboard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-25T12:00:00Z"));
    progressData.assignments = [];
    progressData.statistics = [];
    progressData.progressions = [];
    window.localStorage.clear();
  });

  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("groups the overview controls and metrics while keeping sharing beside customization", () => {
    render(<AnalyticsOverview />);
    act(() => vi.advanceTimersByTime(32));

    const overview = screen.getByRole("region", { name: "Analytics overview" });
    expect(within(overview).getByRole("combobox", { name: "Dashboard preset" })).toBeVisible();
    expect(within(overview).getByText("Reviews due")).toBeVisible();
    const share = screen.getByRole("button", { name: "Share" });
    expect(share.parentElement).toContainElement(screen.getByRole("button", { name: "Customize" }));
    expect(overview).not.toContainElement(share);
  });

  it("uses genuine lesson dates without presenting assignment updates as reviews", () => {
    progressData.assignments = [assignment(1, "2026-08-24T12:00:00Z", "2026-08-20T12:00:00Z")];

    render(<AnalyticsOverview />);

    act(() => vi.advanceTimersByTime(32));

    expect(screen.getByRole("button", { name: "2026-08-20: 1 lessons" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2026-08-24: 0 lessons" })).toBeInTheDocument();
    expect(screen.getByText(/WaniKani no longer provides historical reviews/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "Analytics" })).not.toBeInTheDocument();
  });

  it("advances due counts while the dashboard stays open without claiming a data refresh", () => {
    progressData.assignments = [{ ...assignment(1, "2026-08-25T12:00:00Z", "2026-08-20T12:00:00Z"), data: { ...assignment(1, "", "2026-08-20T12:00:00Z").data, available_at: "2026-08-25T12:00:30Z" } }];
    render(<AnalyticsOverview />);
    const due = screen.getByText("Reviews due").parentElement!;
    expect(due).toHaveTextContent("Reviews due0");
    act(() => vi.advanceTimersByTime(60_000));
    expect(due).toHaveTextContent("Reviews due1");
    expect(screen.queryByText("Analytics refreshed.")).not.toBeInTheDocument();
  });

  it("reports a failed refresh and keeps the dashboard available", async () => {
    progressData.retry.mockRejectedValueOnce(new Error("Unavailable"));
    render(<AnalyticsOverview />);
    act(() => vi.advanceTimersByTime(32));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Refresh analytics" })); });
    expect(progressData.retry).toHaveBeenLastCalledWith({ throwOnError: true });
    expect(screen.getByText("Refresh failed. Your last loaded data is still available.")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Current level" })).toBeInTheDocument();
  });

  it("excludes a level from both the average and median when its bar is pressed", () => {
    progressData.progressions = [
      { data: { level: 1, unlocked_at: "2026-07-01T00:00:00Z", started_at: null, passed_at: "2026-07-11T00:00:00Z", completed_at: null, abandoned_at: null } },
      { data: { level: 2, unlocked_at: "2026-07-12T00:00:00Z", started_at: null, passed_at: "2026-08-01T00:00:00Z", completed_at: null, abandoned_at: null } },
      { data: { level: 3, unlocked_at: "2026-08-02T00:00:00Z", started_at: null, passed_at: "2026-09-01T00:00:00Z", completed_at: null, abandoned_at: null } },
    ];

    render(<AnalyticsOverview />);

    act(() => vi.advanceTimersByTime(32));
    expect(screen.getByTestId("timing-average")).toHaveTextContent("20 days");
    expect(screen.getByTestId("timing-median")).toHaveTextContent("20 days");

    fireEvent.click(screen.getByRole("button", { name: "Exclude level 3, 30 days" }));

    expect(screen.getByTestId("timing-average")).toHaveTextContent("15 days");
    expect(screen.getByTestId("timing-median")).toHaveTextContent("15 days");
    expect(screen.getByRole("button", { name: "Include level 3, 30 days" })).toHaveAttribute("aria-pressed", "true");
  });

  it("uses compact labels for the median and clipped level timing bars", () => {
    const timings: LevelTiming[] = [17.8, 8, 7.9, 7.4, 78.4, 49.6].map((days, index) => ({
      level: index + 10,
      startedAt: "2026-01-01",
      passedAt: "2026-01-02",
      completedAt: null,
      daysToPass: days,
      daysToComplete: null,
      activeDays: days,
    }));

    render(<LevelTimingChart timings={timings} resetCount={null} />);

    expect(screen.getByText("median 12.9d")).toBeInTheDocument();
    expect(screen.getByText("Quickest level")).toBeInTheDocument();
    expect(screen.getByText("Median or faster")).toBeInTheDocument();
    expect(screen.getByText("Slower than median")).toBeInTheDocument();
    expect(screen.getByText("Longest level")).toBeInTheDocument();
    expect(screen.getByText("Current level")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exclude level 14, 78.4 days" })).toHaveTextContent("78.4d");
    expect(screen.getByRole("button", { name: "Exclude level 15, 49.6 days" })).toHaveTextContent("49.6d");
  });

  it("uses denser spacing for high-level charts without omitting bars", () => {
    const timings: LevelTiming[] = Array.from({ length: 35 }, (_, index) => ({
      level: index + 1,
      startedAt: "2026-01-01",
      passedAt: "2026-01-02",
      completedAt: null,
      daysToPass: 7,
      daysToComplete: null,
      activeDays: 7,
    }));

    const { container } = render(<LevelTimingChart timings={timings} resetCount={null} />);

    expect(container.querySelector('[data-level-density="dense"]')).not.toBeNull();
    expect(screen.getAllByRole("button", { name: /level \d+/i })).toHaveLength(35);
  });

  it("opens on the latest levels and keeps the median outside the scrolling plot", () => {
    const scrollWidth = vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(1200);
    const scrollLeft = vi.spyOn(HTMLElement.prototype, "scrollLeft", "set");
    const timings: LevelTiming[] = Array.from({ length: 15 }, (_, index) => ({
      level: index + 1,
      startedAt: "2026-01-01",
      passedAt: "2026-01-02",
      completedAt: null,
      daysToPass: index + 4,
      daysToComplete: null,
      activeDays: index + 4,
    }));

    try {
      render(<LevelTimingChart timings={timings} resetCount={null} />);
      act(() => vi.advanceTimersByTime(32));

      const scrollingPlot = screen.getByTestId("timing-chart-scroll");
      const stickyMedian = screen.getByTestId("timing-median-sticky");
      expect(scrollLeft).toHaveBeenCalledWith(1200);
      expect(scrollingPlot).not.toContainElement(stickyMedian);
    } finally {
      scrollWidth.mockRestore();
      scrollLeft.mockRestore();
    }
  });
});
