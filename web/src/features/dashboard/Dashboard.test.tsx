import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LevelTiming } from "@/features/progress/calculations";
import type { Assignment, Subject } from "@/types/wanikani";
import { Dashboard } from "./Dashboard";

const { dashboardTestState, levelProgressions } = vi.hoisted(() => ({
  dashboardTestState: {
    dashboardOrder: ["level-timing"],
    user: { id: 1, data: { username: "tester", level: 15, current_vacation_started_at: null as string | null } },
    assignments: [] as Assignment[],
    subjects: [] as Subject[],
  },
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
  useSession: () => ({ user: dashboardTestState.user }),
}));

vi.mock("@/features/settings/use-workspace-preferences", () => ({
  useWorkspacePreferences: () => ({
    dashboardOrder: dashboardTestState.dashboardOrder,
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

vi.mock("./CustomVocabularyWidget", () => ({
  CustomVocabularyWidget: ({ scope }: { scope: string | number }) => <section data-testid="custom-vocabulary-widget" data-scope={scope}><h2>Custom vocabulary</h2></section>,
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: (options: { queryKey?: unknown[] }) => {
      const isLevelProgressions = options.queryKey?.some((part) => String(part).includes("level-progressions"));
      const resource = options.queryKey?.[1];
      const assignmentScope = options.queryKey?.[2];
      const hiddenSubjectIds = new Set(dashboardTestState.subjects.filter((subject) => subject.data.hidden_at).map((subject) => subject.id));
      return {
        data: isLevelProgressions
          ? levelProgressions
          : resource === "assignments"
            ? assignmentScope === "available-review-count"
              ? dashboardTestState.assignments.filter((assignment) => !hiddenSubjectIds.has(assignment.data.subject_id)).length
              : dashboardTestState.assignments
            : resource === "subjects"
              ? dashboardTestState.subjects
              : undefined,
        error: null,
        isError: false,
        isLoading: false,
        refetch: vi.fn(),
      };
    },
  };
});

afterEach(() => {
  vi.useRealTimers();
  dashboardTestState.dashboardOrder = ["level-timing"];
  dashboardTestState.user.data.current_vacation_started_at = null;
  dashboardTestState.assignments = [];
  dashboardTestState.subjects = [];
});

describe("dashboard", () => {
  it("passes every level progression to the timing chart", () => {
    render(<Dashboard />);

    expect(screen.getByTestId("dashboard-level-timings")).toHaveTextContent(
      "1,2,3,4,5,6,7,8,9,10,11,12,13,14,15",
    );
  });

  it("mounts the custom vocabulary widget with the signed-in user scope", () => {
    dashboardTestState.dashboardOrder = ["custom-vocabulary"];

    render(<Dashboard />);

    expect(screen.getByRole("heading", { name: "Custom vocabulary" })).toBeInTheDocument();
    expect(screen.getByTestId("custom-vocabulary-widget")).toHaveAttribute("data-scope", "1");
  });

  it("renders Recent Mistakes as empty during Vacation Mode", () => {
    dashboardTestState.dashboardOrder = ["recent-mistakes"];
    dashboardTestState.user.data.current_vacation_started_at = "2026-08-20T12:00:00Z";

    render(<Dashboard />);

    expect(screen.getByRole("heading", { name: "Recent Mistakes" })).toBeInTheDocument();
    expect(screen.getByText("No mistakes in the past 24 hours")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Extra Study" })).toBeDisabled();
  });

  it("excludes assignments tied to hidden subjects from the available review count", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-28T12:00:00Z"));
    dashboardTestState.dashboardOrder = ["daily-study"];
    dashboardTestState.assignments = Array.from({ length: 222 }, (_, index) => ({
      id: index + 1,
      object: "assignment" as const,
      url: "",
      data_updated_at: "2026-08-28T10:00:00Z",
      data: {
        subject_id: index + 1,
        subject_type: "kanji" as const,
        srs_stage: 2,
        available_at: "2026-08-28T11:00:00Z",
        started_at: "2026-08-01T00:00:00Z",
        unlocked_at: "2026-08-01T00:00:00Z",
        passed_at: null,
        burned_at: null,
        resurrected_at: null,
        hidden: false,
        created_at: "2026-08-01T00:00:00Z",
      },
    }));
    dashboardTestState.subjects = Array.from({ length: 222 }, (_, index) => ({
      id: index + 1,
      object: "kanji" as const,
      url: "",
      data_updated_at: "2026-08-28T10:00:00Z",
      data: {
        level: 15,
        created_at: "2026-08-01T00:00:00Z",
        slug: `kanji-${index + 1}`,
        document_url: "",
        hidden_at: index < 8 ? "2026-08-28T10:30:00Z" : null,
        characters: `字${index + 1}`,
        meanings: [{ meaning: `Meaning ${index + 1}`, primary: true, accepted_answer: true }],
        auxiliary_meanings: [],
      },
    }));

    render(<Dashboard />);

    const reviews = screen.getByRole("article", { name: "Reviews study queue, coming soon" });
    expect(within(reviews).getByText("214")).toBeInTheDocument();
  });
});
