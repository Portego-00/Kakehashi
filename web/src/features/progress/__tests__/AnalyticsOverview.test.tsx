import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Assignment } from "@/types/wanikani";
import { AnalyticsOverview } from "../components/AnalyticsOverview";

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

  afterEach(() => vi.useRealTimers());

  it("builds heatmap activity from the assignment signals used by mobile", () => {
    progressData.assignments = [assignment(1, "2026-08-24T12:00:00Z", "2026-08-20T12:00:00Z")];

    render(<AnalyticsOverview />);

    expect(screen.getAllByRole("button", { name: /1 activity signal on/ })).toHaveLength(2);
    expect(screen.queryByRole("heading", { level: 1, name: "Analytics" })).not.toBeInTheDocument();
  });

  it("excludes a level from both the average and median when its bar is pressed", () => {
    progressData.progressions = [
      { data: { level: 1, unlocked_at: "2026-07-01T00:00:00Z", started_at: null, passed_at: "2026-07-11T00:00:00Z", completed_at: null, abandoned_at: null } },
      { data: { level: 2, unlocked_at: "2026-07-12T00:00:00Z", started_at: null, passed_at: "2026-08-01T00:00:00Z", completed_at: null, abandoned_at: null } },
      { data: { level: 3, unlocked_at: "2026-08-02T00:00:00Z", started_at: null, passed_at: "2026-09-01T00:00:00Z", completed_at: null, abandoned_at: null } },
    ];

    render(<AnalyticsOverview />);

    expect(screen.getByTestId("timing-average")).toHaveTextContent("20 days");
    expect(screen.getByTestId("timing-median")).toHaveTextContent("20 days");

    fireEvent.click(screen.getByRole("button", { name: "Exclude level 3, 30 days" }));

    expect(screen.getByTestId("timing-average")).toHaveTextContent("15 days");
    expect(screen.getByTestId("timing-median")).toHaveTextContent("15 days");
    expect(screen.getByRole("button", { name: "Include level 3, 30 days" })).toHaveAttribute("aria-pressed", "true");
  });
});
