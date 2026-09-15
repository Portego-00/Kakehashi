import React, { useEffect } from "react";
import { act, render } from "@testing-library/react-native";
import { InteractionManager, Text } from "react-native";
import { DashboardProvider, useDashboardData } from "../useDashboardData";
import type { Assignment } from "../../utils/api";

const mockCachedDashboard = jest.fn();
const mockReconstructedDashboard = jest.fn();
const mockGetReviewCount = jest.fn();
const mockGetSummary = jest.fn();
const mockGetAssignments = jest.fn();
const mockGetStatistics = jest.fn();
const mockSaveDashboard = jest.fn(async (_data: unknown) => {});
const mockPendingIds = jest.fn();
const mockAuthState = {
  apiToken: "fixture-token",
  userData: { id: "fixture-user" },
  setUserData: jest.fn(),
  setLearnedKanjiCount: jest.fn(),
  lastWrappedLevel: 1,
  setLastWrappedLevel: jest.fn(),
};

jest.mock("../../utils/store", () => ({
  useAuthStore: Object.assign(
    (selector?: (state: typeof mockAuthState) => unknown) =>
      selector ? selector(mockAuthState) : mockAuthState,
    { getState: () => mockAuthState },
  ),
}));
jest.mock("../../utils/dashboardCache", () => ({
  getDashboardCache: () => mockCachedDashboard(),
  saveDashboardCache: (data: unknown) => mockSaveDashboard(data),
}));
jest.mock("../../utils/permanentStorage", () => ({
  getFullDashboardDataFromPermanentStorage: () => mockReconstructedDashboard(),
}));
jest.mock("../../utils/cache", () => ({ getSubjectById: async () => null }));
jest.mock("../../services/offlineStudyProgressService", () => ({
  getPendingProgressAssignmentIds: () => mockPendingIds(),
}));
jest.mock("../../utils/api", () => ({
  ...jest.requireActual("../../utils/api"),
  getLiveReviewCount: (...args: unknown[]) => mockGetReviewCount(...args),
  getSummary: () => mockGetSummary(),
  getAssignmentsOptimized: () => mockGetAssignments(),
  getUserData: async () => ({ data: { username: "fixture", level: 1 } }),
  getSubjects: async () => ({ data: [] }),
  getReviewStatisticsOptimized: () => mockGetStatistics(),
  getRecentReviewStatistics: async () => ({ data: [] }),
  getLevelProgressions: async () => ({ data: [] }),
  getResets: async () => ({ data: [] }),
}));
jest.mock("../../utils/levelTimingExclusions", () => ({
  loadLevelTimingExcludedLevels: async () => [],
  subscribeLevelTimingExcludedLevels: () => () => {},
  areLevelTimingExcludedLevelsEqual: () => true,
}));
jest.mock("../../utils/reviewNotifications", () => ({
  updateLastReviewCount: jest.fn(),
}));
jest.mock("../../utils/badgeNotifications", () => ({
  updateBadgeWithReviewCount: jest.fn(),
}));
jest.mock("../../utils/reviewNotificationIntegration", () => ({
  shouldUseNativeReviewNotificationSystem: () => false,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

function assignments(count: number): Assignment[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    object: "assignment",
    url: "",
    data_updated_at: "2026-09-14T09:00:00Z",
    data: {
      subject_id: index + 1,
      subject_type: "vocabulary",
      created_at: "2026-09-01T00:00:00Z",
      srs_stage: 1,
      unlocked_at: "2026-09-01T00:00:00Z",
      started_at: "2026-09-01T00:00:00Z",
      passed_at: null,
      burned_at: null,
      available_at: "2026-09-14T09:00:00Z",
      resurrected_at: null,
      hidden: false,
    },
  }));
}

let dashboard: ReturnType<typeof useDashboardData>;
let displayedCounts: number[];
function Count() {
  dashboard = useDashboardData();
  const count = dashboard.dashboardData.reviewCount;
  useEffect(() => { displayedCounts.push(count); }, [count]);
  return <Text testID="review-count">{count}</Text>;
}

describe("dashboard review count while refresh is pending", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date("2026-09-14T10:00:00Z") });
    jest.clearAllMocks();
    displayedCounts = [];
    mockPendingIds.mockResolvedValue({ lesson: new Set(), review: new Set() });
    mockGetReviewCount.mockReturnValue(deferred<number>().promise);
    mockGetSummary.mockReturnValue(deferred<unknown>().promise);
    mockGetAssignments.mockReturnValue(deferred<unknown>().promise);
    mockGetStatistics.mockResolvedValue({ data: [] });
    mockCachedDashboard.mockResolvedValue({
      reviewCount: 271,
      lessonCount: 0,
      assignments: [],
      subjects: [],
      currentLevel: 1,
      dataLoadingState: {},
    });
  });

  afterEach(() => { jest.useRealTimers(); });

  it("uses current local assignments at startup before the network responds", async () => {
    mockReconstructedDashboard.mockResolvedValue({
      reviewCount: 271,
      assignments: assignments(51),
      subjects: [],
      dataLoadingState: {},
    });

    render(<DashboardProvider><Count /></DashboardProvider>);
    await act(async () => {});

    expect(dashboard.dashboardData.reviewCount).toBe(51);
    expect(displayedCounts).not.toContain(271);
  });

  it("does not replace a corrected visible count with stale assignments after a batch", async () => {
    const rows = assignments(271);
    const visibleCount = deferred<number>();
    mockGetReviewCount.mockReturnValue(visibleCount.promise);
    mockReconstructedDashboard.mockImplementation(async () => ({
      reviewCount: 271,
      assignments: rows,
      subjects: [],
      dataLoadingState: {},
    }));
    render(<DashboardProvider><Count /></DashboardProvider>);
    await act(async () => {});
    await act(async () => { visibleCount.resolve(51); });
    expect(dashboard.dashboardData.reviewCount).toBe(51);

    for (const assignment of rows.slice(0, 20)) {
      assignment.data.available_at = "2026-09-14T14:00:00Z";
    }
    await act(async () => { await dashboard.refreshLessonsAndReviews(); });

    expect(dashboard.dashboardData.reviewCount).toBe(31);
    expect(displayedCounts.slice(displayedCounts.indexOf(51) + 1)).not.toContain(251);
  });

  it("keeps completed reviews removed when an older startup response arrives", async () => {
    mockCachedDashboard.mockResolvedValue({
      reviewCount: 51,
      reviewCountAssignmentBaseline: {
        dueAssignmentIds: Array.from({length: 271}, (_, i) => i + 1),
        capturedAt: "2026-09-14T10:00:00Z",
      },
      assignments: [],
      subjects: [],
      dataLoadingState: {},
    });
    let rows = assignments(271);
    const visibleCount = deferred<number>();
    mockGetReviewCount.mockReturnValue(visibleCount.promise);
    mockReconstructedDashboard.mockImplementation(async () => ({
      assignments: rows,
      subjects: [],
      dataLoadingState: {},
    }));
    render(<DashboardProvider><Count /></DashboardProvider>);
    await act(async () => {});
    expect(dashboard.dashboardData.reviewCount).toBe(51);

    rows = rows.map((row, index) => index < 20
      ? { ...row, data: { ...row.data, available_at: "2026-09-14T14:00:00Z" } }
      : row);
    await act(async () => { await dashboard.refreshLessonsAndReviews(); });
    expect(dashboard.dashboardData.reviewCount).toBe(31);
    await act(async () => { visibleCount.resolve(51); });
    expect(dashboard.dashboardData.reviewCount).toBe(31);
  });

  it.each(["hidden", "removed"])("does not treat repaired %s assignments as completed reviews", async (repair) => {
    const rows = assignments(271);
    mockCachedDashboard.mockResolvedValue({
      reviewCount: 51,
      reviewCountAssignmentBaseline: {
        dueAssignmentIds: rows.map(({ id }) => id),
        capturedAt: "2026-09-14T09:30:00Z",
      },
      subjects: [], assignments: [], dataLoadingState: {},
    });
    mockReconstructedDashboard.mockResolvedValue({
      assignments: repair === "removed" ? rows.slice(0, 51) : rows.map((row, index) =>
        index >= 51 ? { ...row, data: { ...row.data, hidden: true } } : row),
      subjects: [], dataLoadingState: {},
    });
    render(<DashboardProvider><Count /></DashboardProvider>);
    await act(async () => {});
    expect(dashboard.dashboardData.reviewCount).toBe(51);
  });

  it("adds newly due reviews to a corrected count without adding inaccessible old rows", async () => {
    const rows = assignments(271);
    mockCachedDashboard.mockResolvedValue({
      reviewCount: 51,
      reviewCountAssignmentBaseline: {
        dueAssignmentIds: rows.slice(0, 270).map(({ id }) => id),
        capturedAt: "2026-09-14T09:30:00Z",
      },
      subjects: [], assignments: [], dataLoadingState: {},
    });
    rows[270].data.available_at = "2026-09-14T09:45:00Z";
    mockReconstructedDashboard.mockResolvedValue({
      assignments: rows, subjects: [], dataLoadingState: {},
    });
    render(<DashboardProvider><Count /></DashboardProvider>);
    await act(async () => {});
    expect(dashboard.dashboardData.reviewCount).toBe(52);
  });

  it("preserves a server count when the local assignment cache is incomplete", async () => {
    const rows = assignments(21);
    mockCachedDashboard.mockResolvedValue({
      reviewCount: 51,
      reviewCountAssignmentBaseline: {
        dueAssignmentIds: rows.map(({ id }) => id),
        capturedAt: "2026-09-14T09:30:00Z",
      },
      subjects: [], assignments: [], dataLoadingState: {},
    });
    mockReconstructedDashboard.mockResolvedValue({
      assignments: rows, subjects: [], dataLoadingState: {},
    });
    render(<DashboardProvider><Count /></DashboardProvider>);
    await act(async () => {});
    expect(dashboard.dashboardData.reviewCount).toBe(51);
    await act(async () => { await dashboard.refreshLessonsAndReviews(); });
    expect(dashboard.dashboardData.reviewCount).toBe(51);
  });

  it("allows newly due reviews after a legacy cached zero while offline", async () => {
    mockCachedDashboard.mockResolvedValue({
      reviewCount: 0, subjects: [], assignments: [], dataLoadingState: {},
    });
    mockGetReviewCount.mockRejectedValue(new Error("offline"));
    mockReconstructedDashboard.mockResolvedValue({
      assignments: assignments(51), subjects: [], dataLoadingState: {},
    });
    render(<DashboardProvider><Count /></DashboardProvider>);
    await act(async () => {});
    expect(dashboard.dashboardData.reviewCount).toBe(51);
  });

  it("excludes pending IDs from the priority live count on startup", async () => {
    const pendingIds = new Set(Array.from({ length: 20 }, (_, index) => index + 1));
    mockPendingIds.mockResolvedValue({ lesson: new Set(), review: pendingIds });
    mockGetReviewCount.mockImplementation(async (_token, excludedIds) =>
      51 - [...pendingIds].filter((id) => excludedIds.has(id)).length);
    mockCachedDashboard.mockResolvedValue({
      reviewCount: 51,
      reviewCountAssignmentBaseline: {
        dueAssignmentIds: assignments(271).map(({ id }) => id),
        capturedAt: "2026-09-14T09:30:00Z",
      },
      subjects: [], assignments: [], dataLoadingState: {},
    });
    mockReconstructedDashboard.mockResolvedValue({
      assignments: assignments(271), subjects: [], dataLoadingState: {},
    });
    render(<DashboardProvider><Count /></DashboardProvider>);
    await act(async () => {});
    expect(dashboard.dashboardData.reviewCount).toBe(31);
    expect(mockGetReviewCount).toHaveBeenCalledWith("fixture-token", pendingIds);
  });

  it("keeps the baseline aligned when reviews become pending between count reads", async () => {
    const rows = assignments(71);
    const pendingReviews = new Set(Array.from({ length: 20 }, (_, index) => index + 1));
    let assignmentsRequested = false;
    let pendingReadAfterAssignments = false;
    mockPendingIds.mockImplementation(async () => {
      if (!assignmentsRequested) return { lesson: new Set(), review: new Set() };
      if (!pendingReadAfterAssignments) {
        pendingReadAfterAssignments = true;
        return { lesson: new Set(), review: new Set() };
      }
      return { lesson: new Set(), review: pendingReviews };
    });
    mockGetReviewCount.mockImplementation(async (_token, excludedIds) => 71 - excludedIds.size);
    mockGetSummary.mockResolvedValue({ data: { lessons: [], reviews: [] } });
    mockGetAssignments.mockImplementation(async () => {
      assignmentsRequested = true;
      return { data: rows };
    });
    mockReconstructedDashboard.mockResolvedValue({
      assignments: rows, subjects: [], dataLoadingState: {},
    });
    render(<DashboardProvider><Count /></DashboardProvider>);
    await act(async () => {});
    expect(dashboard.dashboardData.reviewCount).toBe(51);
    await act(async () => { await dashboard.refreshLessonsAndReviews(); });
    expect(dashboard.dashboardData.reviewCount).toBe(51);
  });

  it("does not reuse the startup count after reviews finish during summary loading", async () => {
    let rows = assignments(271);
    const staleRows = rows;
    const summary = deferred<unknown>();
    mockGetSummary.mockReturnValue(summary.promise);
    mockGetReviewCount.mockResolvedValue(51);
    mockGetAssignments.mockImplementation(async () => ({ data: rows }));
    mockReconstructedDashboard.mockImplementation(async () => ({
      assignments: rows, subjects: [], dataLoadingState: {},
    }));
    render(<DashboardProvider><Count /></DashboardProvider>);
    await act(async () => {});
    expect(dashboard.dashboardData.reviewCount).toBe(51);

    rows = rows.map((row, index) => index < 20
      ? { ...row, data: { ...row.data, available_at: "2026-09-14T14:00:00Z" } }
      : row);
    await act(async () => { await dashboard.refreshLessonsAndReviews(); });
    expect(dashboard.dashboardData.reviewCount).toBe(31);
    mockGetReviewCount.mockResolvedValue(31);
    mockGetAssignments.mockResolvedValueOnce({ data: staleRows });
    await act(async () => { summary.resolve({ data: { lessons: [], reviews: [] } }); });
    expect(dashboard.dashboardData.reviewCount).toBe(31);
    expect(displayedCounts.slice(displayedCounts.indexOf(31))).not.toContain(51);
  });

  it("does not save an old full dashboard over a batch completed during statistics loading", async () => {
    let rows = assignments(51);
    const statistics = deferred<unknown>();
    mockGetStatistics.mockReturnValue(statistics.promise);
    mockGetSummary.mockResolvedValue({ data: { lessons: [], reviews: [] } });
    mockGetReviewCount.mockResolvedValue(51);
    mockGetAssignments.mockImplementation(async () => ({ data: rows }));
    mockReconstructedDashboard.mockImplementation(async () => ({
      assignments: rows, subjects: [], dataLoadingState: {},
    }));
    const interactions = jest.spyOn(InteractionManager, "runAfterInteractions")
      .mockImplementation((task: any) => { task(); return { cancel: jest.fn(), then: jest.fn(), done: jest.fn() }; });
    render(<DashboardProvider><Count /></DashboardProvider>);
    await act(async () => { await jest.advanceTimersByTimeAsync(1500); });
    expect(mockGetStatistics).toHaveBeenCalled();

    rows = rows.map((row, index) => index < 20
      ? { ...row, data: { ...row.data, available_at: "2026-09-14T14:00:00Z" } }
      : row);
    await act(async () => { await dashboard.refreshLessonsAndReviews(); });
    expect(dashboard.dashboardData.reviewCount).toBe(31);
    const savedAfterBatch = mockSaveDashboard.mock.calls.length;
    mockGetReviewCount.mockResolvedValue(31);
    await act(async () => { statistics.resolve({ data: [] }); });
    expect(dashboard.dashboardData.reviewCount).toBe(31);
    expect(mockSaveDashboard.mock.calls.slice(savedAfterBatch)
      .some(([data]: any[]) => data.reviewCount === 51)).toBe(false);
    interactions.mockRestore();
  });

  it("retries a quick refresh when another batch finishes while its request is pending", async () => {
    let rows = assignments(51);
    mockGetSummary.mockResolvedValue({ data: { lessons: [], reviews: [] } });
    mockGetReviewCount.mockResolvedValue(51);
    mockGetAssignments.mockImplementation(async () => ({ data: rows }));
    mockReconstructedDashboard.mockImplementation(async () => ({
      assignments: rows, subjects: [], dataLoadingState: {},
    }));
    const interactions = jest.spyOn(InteractionManager, "runAfterInteractions")
      .mockImplementation((task: any) => { task(); return { cancel: jest.fn(), then: jest.fn(), done: jest.fn() }; });
    render(<DashboardProvider><Count /></DashboardProvider>);
    await act(async () => { await jest.advanceTimersByTimeAsync(1500); });
    const slowAssignments = deferred<unknown>();
    mockGetAssignments.mockReturnValueOnce(slowAssignments.promise);
    rows = rows.map((row, index) => index < 20
      ? { ...row, data: { ...row.data, available_at: "2026-09-14T14:00:00Z" } }
      : row);
    const firstBatchRows = rows;
    let firstRefresh!: Promise<void>;
    await act(async () => { firstRefresh = dashboard.refreshLessonsAndReviews(); });
    expect(dashboard.dashboardData.reviewCount).toBe(31);
    rows = rows.map((row, index) => index < 40
      ? { ...row, data: { ...row.data, available_at: "2026-09-14T14:00:00Z" } }
      : row);
    let secondRefresh!: Promise<void>;
    await act(async () => { secondRefresh = dashboard.refreshLessonsAndReviews(); });
    expect(dashboard.dashboardData.reviewCount).toBe(11);
    mockGetReviewCount.mockResolvedValueOnce(31).mockResolvedValue(11);
    await act(async () => {
      slowAssignments.resolve({ data: firstBatchRows });
      await Promise.all([firstRefresh, secondRefresh]);
    });
    expect(dashboard.dashboardData.reviewCount).toBe(11);
    expect(displayedCounts.slice(displayedCounts.indexOf(11))).not.toContain(31);
    interactions.mockRestore();
  });

  it("finishes the full dashboard when a concurrent local refresh has no queue changes", async () => {
    const rows = assignments(51);
    const statistics = deferred<unknown>();
    mockGetStatistics.mockReturnValue(statistics.promise);
    mockGetSummary.mockResolvedValue({ data: { lessons: [], reviews: [] } });
    mockGetReviewCount.mockResolvedValue(51);
    mockGetAssignments.mockResolvedValue({ data: rows });
    mockReconstructedDashboard.mockResolvedValue({
      assignments: rows, subjects: [], dataLoadingState: {},
    });
    const interactions = jest.spyOn(InteractionManager, "runAfterInteractions")
      .mockImplementation((task: any) => { task(); return { cancel: jest.fn(), then: jest.fn(), done: jest.fn() }; });
    render(<DashboardProvider><Count /></DashboardProvider>);
    await act(async () => { await jest.advanceTimersByTimeAsync(1500); });
    expect(mockGetStatistics).toHaveBeenCalled();
    await act(async () => { await dashboard.refreshLessonsAndReviews(); });
    await act(async () => { statistics.resolve({ data: [] }); });
    expect(dashboard.isFreshData).toBe(true);
    expect(mockSaveDashboard.mock.calls.some(([data]: any[]) =>
      data.dataLoadingState?.levelData === true)).toBe(true);
    interactions.mockRestore();
  });
});
