import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LevelTiming } from "@/features/progress/calculations";
import { Dashboard } from "./Dashboard";

const { levelProgressions } = vi.hoisted(() => ({
  levelProgressions: Array.from({ length: 15 }, (_, index) => ({
    data: {
      level: index + 1,
      unlocked_at: `2026-01-${String(index + 1).padStart(2, "0")}T00:00:00Z`,
      started_at: null,
      passed_at: `2026-01-${String(index + 2).padStart(2, "0")}T00:00:00Z`,
      completed_at: null,
      abandoned_at: null,
    },
  })),
}));

vi.mock("@/lib/session", () => ({
  useSession: () => ({ user: { id: 1, data: { username: "tester", level: 15 } } }),
}));

vi.mock("@/features/settings/use-workspace-preferences", () => ({
  useWorkspacePreferences: () => ({
    dashboardOrder: ["level-timing"],
    hiddenDashboard: [],
    dashboardWidths: {},
    dashboardRowStarts: [],
  }),
}));

vi.mock("@/features/progress/components/AnalyticsOverview", () => ({
  LevelTimingChart: ({ timings }: { timings: LevelTiming[] }) => (
    <div data-testid="dashboard-level-timings">
      {timings.map((timing) => timing.level).join(",")}
    </div>
  ),
}));

vi.mock("@/features/dashboard/useFirstDashboardReveal", () => ({
  useFirstDashboardReveal: () => ({}),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: (options: { queryKey?: unknown[] }) => {
      const isLevelProgressions = options.queryKey?.some((part) => String(part).includes("level-progressions"));
      return {
        data: isLevelProgressions ? levelProgressions : undefined,
        error: null,
        isError: false,
        isLoading: false,
        refetch: vi.fn(),
      };
    },
  };
});

describe("dashboard level timing", () => {
  it("passes every level progression to the timing chart", () => {
    render(<Dashboard />);

    expect(screen.getByTestId("dashboard-level-timings")).toHaveTextContent(
      "1,2,3,4,5,6,7,8,9,10,11,12,13,14,15",
    );
  });
});
