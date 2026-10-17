import React from "react";
import { act, render } from "@testing-library/react-native";
import { Text } from "react-native";
import { useLearningPageDashboardData } from "../useLearningPageDashboardData";
import { normalizeLearningPageFilter, type LearningPage } from "../../utils/learningPages";

const mockLiveReviews = jest.fn();
const mockPendingIds = jest.fn();
const mockReadCache = jest.fn();
const mockSaveCache = jest.fn();
jest.mock("expo-router", () => ({
  useFocusEffect: (callback: () => (() => void) | undefined) =>
    jest.requireActual("react").useEffect(callback, [callback]),
}));
jest.mock("../../utils/api", () => ({
  ...jest.requireActual("../../utils/api"),
  getLiveAvailableReviews: (...args: unknown[]) => mockLiveReviews(...args),
}));
jest.mock("../../services/offlineStudyProgressService", () => ({
  getPendingProgressAssignmentIds: (...args: unknown[]) => mockPendingIds(...args),
}));
jest.mock("../../utils/permanentStorage", () => ({
  getFromPermanentStorage: (...args: unknown[]) => mockReadCache(...args),
  saveToPermanentStorage: (...args: unknown[]) => mockSaveCache(...args),
}));

const now = new Date("2026-10-17T10:00:00Z");
const subjects = ["kanji", "vocabulary"].map((object, index) => ({
  id: index + 1,
  object,
  data: { characters: "日", meanings: [{ meaning: "Sun" }] },
}));
const assignments = subjects.map((subject) => ({
  id: subject.id,
  data: { subject_id: subject.id, srs_stage: 2, unlocked_at: "2026-10-01T00:00:00Z", started_at: "2026-10-01T00:00:00Z", available_at: "2026-10-17T09:00:00Z" },
}));
const source = {
  lessonCount: 0, reviewCount: 1, forecast: [], recentMistakes: [], criticalItems: [],
  recentUnlocks: [], burnedItems: [], reviewStatistics: [], nextReviewDate: null,
  recentLessonCount: 0, subjects, assignments,
  dataLoadingState: { assignments: true, subjects: true },
};
const kanjiPage: LearningPage = { id: "kanji", name: "Kanji", filter: normalizeLearningPageFilter({ subjectTypes: ["kanji"] }) };
let result: ReturnType<typeof useLearningPageDashboardData<typeof source>>;
function Harness({ page = kanjiPage, accountId = 1, data = source }: {
  page?: LearningPage | null; accountId?: number; data?: typeof source;
}) {
  result = useLearningPageDashboardData(data, page, `fixture-token-${accountId}`, accountId);
  return <Text>{result.reviewCount}</Text>;
}

describe("Learning Page queue loading", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now });
    jest.clearAllMocks();
    mockLiveReviews.mockResolvedValue({ data: [assignments[1]] });
    mockPendingIds.mockResolvedValue({ lesson: new Set(), review: new Set() });
    mockReadCache.mockResolvedValue(null);
    mockSaveCache.mockResolvedValue(undefined);
  });
  afterEach(() => jest.useRealTimers());

  it("does no page-specific I/O and returns the original data on All", async () => {
    render(<Harness page={null} />);
    await act(async () => {});
    expect(result).toBe(source);
    expect(mockLiveReviews).not.toHaveBeenCalled();
    expect(mockPendingIds).not.toHaveBeenCalled();
    expect(mockReadCache).not.toHaveBeenCalled();
    expect(mockSaveCache).not.toHaveBeenCalled();
  });

  it("replaces stale page counts using the actual server-visible queue", async () => {
    render(<Harness />);
    await act(async () => {});
    expect(result.reviewCount).toBe(0);
    expect(mockLiveReviews).toHaveBeenCalledWith("fixture-token-1");
    expect(mockSaveCache).toHaveBeenCalledWith("learning_page_review_queue:1", expect.objectContaining({ capturedAt: now.toISOString() }), now.toISOString());
  });

  it("keeps cached visibility and pending completions when the live request fails", async () => {
    mockReadCache.mockResolvedValue({ data: { assignments: [assignments[0]], capturedAt: now.toISOString() } });
    mockPendingIds.mockResolvedValue({ lesson: new Set(), review: new Set([1]) });
    mockLiveReviews.mockRejectedValue(new Error("offline"));
    render(<Harness />);
    await act(async () => {});
    expect(result.reviewCount).toBe(0);
    expect(mockSaveCache).not.toHaveBeenCalled();
  });

  it("does not apply a response from a previous account", async () => {
    let resolveOld!: (value: unknown) => void;
    mockLiveReviews.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    const screen = render(<Harness />);
    await act(async () => {});
    screen.rerender(<Harness accountId={2} />);
    await act(async () => {});
    expect(result.reviewCount).toBe(0);
    await act(async () => { resolveOld({ data: [assignments[0]] }); });
    expect(result.reviewCount).toBe(0);
    expect(mockSaveCache).not.toHaveBeenCalledWith("learning_page_review_queue:1", expect.anything(), expect.anything());
  });

  it("discards a live response after a local completion changes the dashboard", async () => {
    let resolveOld!: (value: unknown) => void;
    mockLiveReviews.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    const screen = render(<Harness />);
    await act(async () => {});
    const completed = { ...source, assignments: assignments.map((assignment) => ({ ...assignment, data: { ...assignment.data, available_at: "2026-10-18T09:00:00Z" } })), reviewCount: 0 };
    screen.rerender(<Harness data={completed} />);
    await act(async () => {});
    await act(async () => { resolveOld({ data: [assignments[0]] }); });
    expect(result.reviewCount).toBe(0);
  });
});
