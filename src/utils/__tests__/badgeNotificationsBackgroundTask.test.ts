import AsyncStorage from "@react-native-async-storage/async-storage";
import * as BackgroundTask from "expo-background-task";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";

import {
  getCachedReviewCountIfAvailable,
  getStoredApiToken,
  getVisibleReviewData,
} from "../api";
import {
  shouldUseNativeReviewNotificationSystem,
  updateBadgeAndScheduleNotifications,
} from "../reviewNotificationIntegration";
import { syncDailyReminderNotifications } from "../reviewNotifications";
import { syncHomeWidgetFromBackgroundReviewData } from "../../widgets/homeWidget";
import {
  invalidateBadgeNotificationUpdatesForLogout,
  updateBadgeWithReviewCount,
} from "../badgeNotifications";

jest.mock("expo-background-task", () => ({
  BackgroundTaskResult: {
    Success: "success",
    Failed: "failed",
  },
  BackgroundTaskStatus: {
    Available: "available",
  },
  registerTaskAsync: jest.fn(() => Promise.resolve()),
  getStatusAsync: jest.fn(() => Promise.resolve("available")),
}));

jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  setBadgeCountAsync: jest.fn(() => Promise.resolve()),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve("notification-id")),
  requestPermissionsAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock("expo-task-manager", () => ({
  defineTask: jest.fn(),
  isTaskDefined: jest.fn(() => false),
  isTaskRegisteredAsync: jest.fn(() => Promise.resolve(true)),
}));

jest.mock("../platformSupport", () => ({
  supportsBadgeAndReviewNotifications: jest.fn(() => true),
}));

jest.mock("../api", () => ({
  getReviewCount: jest.fn(),
  getCachedReviewCountIfAvailable: jest.fn(),
  getStoredApiToken: jest.fn(),
  getVisibleReviewData: jest.fn(),
}));

jest.mock("../reviewNotificationIntegration", () => ({
  initializeNotifications: jest.fn(() => Promise.resolve()),
  shouldUseNativeReviewNotificationSystem: jest.fn(() => true),
  updateBadgeAndScheduleNotifications: jest.fn(() => Promise.resolve()),
}));

jest.mock("../reviewNotifications", () => ({
  syncDailyReminderNotifications: jest.fn(() => Promise.resolve()),
}));

jest.mock("../../widgets/homeWidget", () => ({
  syncHomeWidgetFromBackgroundReviewData: jest.fn(() => Promise.resolve()),
}));

type BackgroundTaskExecutor =
  () => Promise<BackgroundTask.BackgroundTaskResult>;

const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockedGetCachedReviewCountIfAvailable = jest.mocked(
  getCachedReviewCountIfAvailable,
);
const mockedGetStoredApiToken = jest.mocked(getStoredApiToken);
const mockedGetVisibleReviewData = jest.mocked(getVisibleReviewData);
const mockedShouldUseNativeReviewNotificationSystem = jest.mocked(
  shouldUseNativeReviewNotificationSystem,
);
const mockedUpdateBadgeAndScheduleNotifications = jest.mocked(
  updateBadgeAndScheduleNotifications,
);
const mockedSyncDailyReminderNotifications = jest.mocked(
  syncDailyReminderNotifications,
);
const mockedSyncHomeWidgetFromBackgroundReviewData = jest.mocked(
  syncHomeWidgetFromBackgroundReviewData,
);
const mockedSetBadgeCountAsync = jest.mocked(Notifications.setBadgeCountAsync);

function getBackgroundTaskExecutor(): BackgroundTaskExecutor {
  const definition = jest
    .mocked(TaskManager.defineTask)
    .mock.calls.find(([name]) => name === "background-fetch-reviews");
  if (!definition) {
    throw new Error("Background review task was not defined");
  }
  return definition[1] as BackgroundTaskExecutor;
}

describe("badge notification background task", () => {
  const runBackgroundTask = getBackgroundTaskExecutor();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAsyncStorage.getItem.mockResolvedValue(null);
    mockedGetStoredApiToken.mockResolvedValue("api-token");
    mockedShouldUseNativeReviewNotificationSystem.mockReturnValue(true);
  });

  it("uses one count-only fallback when detailed widget data is unavailable", async () => {
    mockedGetVisibleReviewData.mockRejectedValue(
      new Error("upcoming schedule unavailable"),
    );
    mockedGetCachedReviewCountIfAvailable.mockResolvedValue(17);

    await expect(runBackgroundTask()).resolves.toBe(
      BackgroundTask.BackgroundTaskResult.Success,
    );

    expect(mockedGetVisibleReviewData).toHaveBeenCalledTimes(1);
    expect(mockedGetCachedReviewCountIfAvailable).toHaveBeenCalledTimes(1);
    expect(mockedSyncHomeWidgetFromBackgroundReviewData).toHaveBeenCalledWith({
      currentReviews: 17,
    });
    expect(mockedUpdateBadgeAndScheduleNotifications).not.toHaveBeenCalled();
    expect(mockedSetBadgeCountAsync).toHaveBeenCalledWith(17);
    expect(mockedSyncDailyReminderNotifications).toHaveBeenCalledWith({
      reviewCount: 17,
    });
  });

  it("reuses detailed review data for the widget and native notifications", async () => {
    const detailedReviewData = {
      currentReviews: 8,
      upcomingReviews: [2, 0, 3],
      upcomingReviewTimes: {
        "2026-09-10T09:00:00.000Z": 2,
        "2026-09-10T11:00:00.000Z": 3,
      },
    };
    mockedGetVisibleReviewData.mockResolvedValue(detailedReviewData);

    await expect(runBackgroundTask()).resolves.toBe(
      BackgroundTask.BackgroundTaskResult.Success,
    );

    expect(mockedGetCachedReviewCountIfAvailable).not.toHaveBeenCalled();
    expect(mockedSyncHomeWidgetFromBackgroundReviewData).toHaveBeenCalledWith(
      detailedReviewData,
    );
    expect(mockedUpdateBadgeAndScheduleNotifications).toHaveBeenCalledWith({
      visibleReviewData: detailedReviewData,
    });
    expect(mockedSyncDailyReminderNotifications).toHaveBeenCalledWith({
      reviewCount: 8,
    });
    expect(mockedSetBadgeCountAsync).not.toHaveBeenCalled();
  });

  it("skips the direct widget sync when background widget refresh is disabled", async () => {
    const detailedReviewData = {
      currentReviews: 8,
      upcomingReviews: [2],
      upcomingReviewTimes: {
        "2026-09-10T09:00:00.000Z": 2,
      },
    };
    mockedAsyncStorage.getItem.mockImplementation(async (key) =>
      key === "wanikani-settings"
        ? JSON.stringify({
            state: { widgetBackgroundRefreshEnabled: false },
          })
        : null,
    );
    mockedGetVisibleReviewData.mockResolvedValue(detailedReviewData);

    await expect(runBackgroundTask()).resolves.toBe(
      BackgroundTask.BackgroundTaskResult.Success,
    );

    expect(mockedSyncHomeWidgetFromBackgroundReviewData).not.toHaveBeenCalled();
    expect(mockedUpdateBadgeAndScheduleNotifications).toHaveBeenCalledWith({
      visibleReviewData: detailedReviewData,
    });
  });

  it("preserves existing state when neither live nor cached counts are available", async () => {
    mockedGetVisibleReviewData.mockRejectedValue(new Error("offline"));
    mockedGetCachedReviewCountIfAvailable.mockResolvedValue(null);

    await expect(runBackgroundTask()).resolves.toBe(
      BackgroundTask.BackgroundTaskResult.Failed,
    );

    expect(mockedSyncHomeWidgetFromBackgroundReviewData).not.toHaveBeenCalled();
    expect(mockedUpdateBadgeAndScheduleNotifications).not.toHaveBeenCalled();
    expect(mockedSetBadgeCountAsync).not.toHaveBeenCalled();
    expect(mockedSyncDailyReminderNotifications).not.toHaveBeenCalled();
    expect(mockedAsyncStorage.setItem).not.toHaveBeenCalledWith(
      "last-review-count",
      expect.any(String),
    );
  });

  it("runs a settings refresh queued behind an in-flight badge update", async () => {
    let finishInitialUpdate!: () => void;
    mockedUpdateBadgeAndScheduleNotifications
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishInitialUpdate = resolve;
          }),
      )
      .mockResolvedValue(undefined);

    const initialUpdate = updateBadgeWithReviewCount();
    await Promise.resolve();
    expect(mockedUpdateBadgeAndScheduleNotifications).toHaveBeenCalledTimes(1);

    const settingsUpdate = updateBadgeWithReviewCount({
      notificationSettings: { badgeEnabled: true },
    });
    expect(mockedUpdateBadgeAndScheduleNotifications).toHaveBeenCalledTimes(1);

    finishInitialUpdate();
    await Promise.all([initialUpdate, settingsUpdate]);

    expect(mockedUpdateBadgeAndScheduleNotifications).toHaveBeenCalledTimes(2);
    expect(mockedUpdateBadgeAndScheduleNotifications).toHaveBeenNthCalledWith(
      2,
      {
        forceSummaryRefresh: false,
        notificationSettings: { badgeEnabled: true },
        visibleReviewData: undefined,
      },
    );
  });

  it("drops queued badge work and drains the active update before logout", async () => {
    let finishInitialUpdate!: () => void;
    mockedUpdateBadgeAndScheduleNotifications.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishInitialUpdate = resolve;
        }),
    );

    const initialUpdate = updateBadgeWithReviewCount();
    await Promise.resolve();
    expect(mockedUpdateBadgeAndScheduleNotifications).toHaveBeenCalledTimes(1);

    const queuedUpdate = updateBadgeWithReviewCount({
      notificationSettings: { badgeEnabled: false },
    });
    const drain = invalidateBadgeNotificationUpdatesForLogout();

    finishInitialUpdate();
    await Promise.all([initialUpdate, queuedUpdate, drain]);

    expect(mockedUpdateBadgeAndScheduleNotifications).toHaveBeenCalledTimes(1);
    expect(mockedSyncDailyReminderNotifications).not.toHaveBeenCalled();
  });
});
