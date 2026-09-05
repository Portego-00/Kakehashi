import { renderHook } from "@testing-library/react-native";

import { useDashboardData } from "../useDashboardData";
import { useWrappedData } from "../useWrappedData";

jest.mock("../useDashboardData", () => ({
  useDashboardData: jest.fn(),
}));

jest.mock("../../utils/store", () => ({
  useAuthStore: jest.fn((selector) =>
    selector({ userData: { username: "reset-user" } }),
  ),
}));

const useDashboardDataMock = jest.mocked(useDashboardData);

describe("useWrappedData", () => {
  it("uses the current attempt when a completed level was repeated after a reset", () => {
    const oldAttempt = {
      data: {
        level: 3,
        unlocked_at: "2026-01-01T00:00:00.000Z",
        started_at: null,
        passed_at: "2026-02-07T00:00:00.000Z",
      },
    };
    const currentAttempt = {
      data: {
        level: 3,
        unlocked_at: "2026-03-05T00:00:00.000Z",
        started_at: null,
        passed_at: "2026-03-18T00:00:00.000Z",
      },
    };

    useDashboardDataMock.mockReturnValue({
      dashboardData: {
        subjects: [
          {
            id: 30,
            object: "kanji",
            data: {
              level: 3,
              hidden_at: null,
              characters: "三",
              meanings: [{ meaning: "Three", primary: true }],
              readings: [],
            },
          },
        ],
        assignments: [
          {
            data_updated_at: "2026-03-18T00:00:00.000Z",
            data: {
              subject_id: 30,
              started_at: "2026-03-05T00:00:00.000Z",
              unlocked_at: "2026-03-05T00:00:00.000Z",
              passed_at: "2026-03-18T00:00:00.000Z",
              burned_at: null,
              srs_stage: 5,
            },
          },
        ],
        reviewStatistics: [],
        levelProgressions: [oldAttempt, currentAttempt],
        resets: [
          {
            data: {
              target_level: 1,
              confirmed_at: "2026-03-01T00:00:00.000Z",
            },
          },
        ],
        currentLevel: 4,
      },
    } as unknown as ReturnType<typeof useDashboardData>);

    const { result } = renderHook(() => useWrappedData(3));

    expect(result.current.timeDays).toBe(13);
    expect(result.current.startedAt).toBe(currentAttempt.data.unlocked_at);
    expect(result.current.passedAt).toBe(currentAttempt.data.passed_at);
  });
});
