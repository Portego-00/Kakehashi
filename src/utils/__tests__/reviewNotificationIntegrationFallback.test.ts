import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

import ReviewNotificationManager from "../../modules/ReviewNotificationManager";
import WaniKaniBackgroundFetch from "../../modules/WaniKaniBackgroundFetch";
import {
  getCachedReviewCountIfAvailable,
  getStoredApiToken,
  getVisibleReviewData,
} from "../api";
import {
  applyNativeReviewNotificationSettings,
  clearNativeReviewAlerts,
  invalidateReviewNotificationSyncsForLogout,
  updateBadgeAndScheduleNotifications,
  updateNativeReviewNotificationSettings,
} from "../reviewNotificationIntegration";
import {
  resumeNotificationSession,
  suspendNotificationSessionForLogout,
} from "../notificationSession";

jest.mock("expo-notifications", () => ({
  setBadgeCountAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock("react-native", () => ({
  NativeModules: {},
  Platform: { OS: "ios" },
}));

jest.mock("../../modules/ReviewNotificationManager", () => ({
  __esModule: true,
  default: {
    applyReviewNotificationSettings: jest.fn(() => Promise.resolve({
      success: true,
      pendingUpdated: 2,
      pendingRemoved: 0,
      updateFailures: 0,
    })),
    clearReviewAlerts: jest.fn(() => Promise.resolve({
      success: true,
      pendingRemoved: 2,
      deliveredRemoved: 1,
    })),
    updateBadgeAndScheduleNotifications: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock("../../modules/WaniKaniBackgroundFetch", () => ({
  __esModule: true,
  default: {
    storeApiToken: jest.fn(),
    updateNotificationSettings: jest.fn(),
  },
}));

jest.mock("../api", () => ({
  getCachedReviewCountIfAvailable: jest.fn(),
  getStoredApiToken: jest.fn(),
  getVisibleReviewData: jest.fn(),
}));

jest.mock("../platformSupport", () => ({
  supportsBadgeAndReviewNotifications: jest.fn(() => true),
}));

const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockedGetCachedReviewCountIfAvailable = jest.mocked(
  getCachedReviewCountIfAvailable,
);
const mockedGetStoredApiToken = jest.mocked(getStoredApiToken);
const mockedGetVisibleReviewData = jest.mocked(getVisibleReviewData);
const mockedSetBadgeCountAsync = jest.mocked(Notifications.setBadgeCountAsync);
const mockedNativeUpdate = jest.mocked(
  ReviewNotificationManager.updateBadgeAndScheduleNotifications,
);
const mockedApplyReviewNotificationSettings = jest.mocked(
  ReviewNotificationManager.applyReviewNotificationSettings,
);
const mockedClearReviewAlerts = jest.mocked(
  ReviewNotificationManager.clearReviewAlerts,
);
const mockedUpdateNotificationSettings = jest.mocked(
  WaniKaniBackgroundFetch!.updateNotificationSettings,
);

describe("native review notification count-only fallback", () => {
  beforeEach(() => {
    resumeNotificationSession();
    jest.clearAllMocks();
    mockedAsyncStorage.getItem.mockResolvedValue(null);
    mockedGetStoredApiToken.mockResolvedValue("api-token");
    mockedGetVisibleReviewData.mockRejectedValue(new Error("offline"));
  });

  afterEach(() => {
    resumeNotificationSession();
  });

  it("passes the same forecast breakdown to Watch without another data request", async () => {
    const visibleReviewData = {
      currentReviews: 2,
      upcomingReviews: [1, ...new Array(23).fill(0)],
      upcomingReviewTimes: { "2026-09-13T13:00:00.000Z": 1 },
      currentSubjectCounts: { radical: 1, kanji: 1, vocabulary: 0 },
      forecastBreakdown: [{
        date: "2026-09-13T13:00:00.000Z", count: 1,
        radical: 0, kanji: 0, vocabulary: 1,
        apprentice: 0, guru: 1, master: 0, enlightened: 0,
      }],
    };
    await updateBadgeAndScheduleNotifications({ visibleReviewData });
    expect(mockedGetVisibleReviewData).not.toHaveBeenCalled();
    expect(mockedNativeUpdate).toHaveBeenCalledWith(expect.objectContaining(visibleReviewData));
  });

  it("updates only the badge when a trustworthy count remains available", async () => {
    mockedGetCachedReviewCountIfAvailable.mockResolvedValue(12);

    await updateBadgeAndScheduleNotifications();

    expect(mockedSetBadgeCountAsync).toHaveBeenCalledWith(12);
    expect(mockedNativeUpdate).not.toHaveBeenCalled();
  });

  it("preserves both badge and schedule when the count is unknown", async () => {
    mockedGetCachedReviewCountIfAvailable.mockResolvedValue(null);

    await updateBadgeAndScheduleNotifications();

    expect(mockedSetBadgeCountAsync).not.toHaveBeenCalled();
    expect(mockedNativeUpdate).not.toHaveBeenCalled();
  });

  it("does not restore alerts after they are disabled during an in-flight refresh", async () => {
    let resolveVisibleReviewData!: (value: {
      currentReviews: number;
      upcomingReviews: number[];
      upcomingReviewTimes: Record<string, number>;
    }) => void;
    mockedAsyncStorage.getItem.mockResolvedValue(
      JSON.stringify({
        state: {
          showBadgeNotifications: true,
          enableReviewNotifications: true,
          notificationSounds: true,
        },
      })
    );
    mockedGetVisibleReviewData.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveVisibleReviewData = resolve;
        })
    );

    const staleRefresh = updateBadgeAndScheduleNotifications();
    for (
      let attempt = 0;
      attempt < 10 && !mockedGetVisibleReviewData.mock.calls.length;
      attempt += 1
    ) {
      await Promise.resolve();
    }
    expect(mockedGetVisibleReviewData).toHaveBeenCalledTimes(1);

    await clearNativeReviewAlerts();
    resolveVisibleReviewData({
      currentReviews: 8,
      upcomingReviews: new Array(24).fill(0),
      upcomingReviewTimes: {},
    });
    await staleRefresh;

    expect(mockedClearReviewAlerts).toHaveBeenCalledTimes(1);
    expect(mockedNativeUpdate).not.toHaveBeenCalled();
  });

  it("invalidates and drains an account refresh before logout cleanup continues", async () => {
    let finishNativeUpdate!: () => void;
    mockedGetVisibleReviewData.mockResolvedValue({
      currentReviews: 8,
      upcomingReviews: new Array(24).fill(0),
      upcomingReviewTimes: {},
    });
    mockedNativeUpdate.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishNativeUpdate = () => resolve({
            success: true,
            currentReviews: 8,
            badgeSet: true,
            notificationsScheduled: true,
          });
        }),
    );

    const staleRefresh = updateBadgeAndScheduleNotifications();
    for (
      let attempt = 0;
      attempt < 10 && !mockedNativeUpdate.mock.calls.length;
      attempt += 1
    ) {
      await Promise.resolve();
    }
    expect(mockedNativeUpdate).toHaveBeenCalledTimes(1);

    let drainFinished = false;
    const drain = invalidateReviewNotificationSyncsForLogout().then(() => {
      drainFinished = true;
    });
    await Promise.resolve();
    expect(drainFinished).toBe(false);

    finishNativeUpdate();
    await Promise.all([staleRefresh, drain]);
    expect(drainFinished).toBe(true);
  });

  it("drops fetched account data after logout invalidates the sync", async () => {
    let resolveVisibleReviewData!: (value: {
      currentReviews: number;
      upcomingReviews: number[];
      upcomingReviewTimes: Record<string, number>;
    }) => void;
    mockedGetVisibleReviewData.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveVisibleReviewData = resolve;
        }),
    );

    const staleRefresh = updateBadgeAndScheduleNotifications();
    for (
      let attempt = 0;
      attempt < 10 && !mockedGetVisibleReviewData.mock.calls.length;
      attempt += 1
    ) {
      await Promise.resolve();
    }

    const drain = invalidateReviewNotificationSyncsForLogout();
    resolveVisibleReviewData({
      currentReviews: 12,
      upcomingReviews: [3],
      upcomingReviewTimes: { "2026-09-11T09:00:00.000Z": 3 },
    });
    await Promise.all([staleRefresh, drain]);

    expect(mockedNativeUpdate).not.toHaveBeenCalled();
  });

  it("does not admit a new native refresh while logout is suspended", async () => {
    suspendNotificationSessionForLogout();

    await updateBadgeAndScheduleNotifications();

    expect(mockedGetStoredApiToken).not.toHaveBeenCalled();
    expect(mockedNativeUpdate).not.toHaveBeenCalled();
  });

  it("clears native review alerts without requiring review data", async () => {
    await clearNativeReviewAlerts();

    expect(mockedUpdateNotificationSettings).toHaveBeenCalledWith({
      alertsEnabled: false,
    });
    expect(mockedClearReviewAlerts).toHaveBeenCalledTimes(1);
    expect(mockedGetVisibleReviewData).not.toHaveBeenCalled();
    expect(mockedGetCachedReviewCountIfAvailable).not.toHaveBeenCalled();
  });

  it("patches native background preferences without fetching review data", () => {
    updateNativeReviewNotificationSettings({ badgeEnabled: false });

    expect(mockedUpdateNotificationSettings).toHaveBeenCalledWith({
      badgeEnabled: false,
    });
    expect(mockedGetVisibleReviewData).not.toHaveBeenCalled();
    expect(mockedGetCachedReviewCountIfAvailable).not.toHaveBeenCalled();
  });

  it("rewrites pending native requests immediately without fetching review data", async () => {
    await applyNativeReviewNotificationSettings({
      alertsEnabled: false,
      badgeEnabled: true,
      soundsEnabled: false,
    });

    expect(mockedUpdateNotificationSettings).toHaveBeenCalledWith({
      alertsEnabled: false,
      badgeEnabled: true,
      soundsEnabled: false,
    });
    expect(mockedApplyReviewNotificationSettings).toHaveBeenCalledWith({
      alertsEnabled: false,
      badgeEnabled: true,
      soundsEnabled: false,
    });
    expect(mockedGetVisibleReviewData).not.toHaveBeenCalled();
    expect(mockedGetCachedReviewCountIfAvailable).not.toHaveBeenCalled();
  });

  it("passes the disabled widget refresh setting to the native manager", async () => {
    mockedAsyncStorage.getItem.mockResolvedValue(
      JSON.stringify({
        state: {
          showBadgeNotifications: true,
          enableReviewNotifications: true,
          notificationSounds: true,
          widgetBackgroundRefreshEnabled: false,
        },
      }),
    );
    mockedGetVisibleReviewData.mockResolvedValue({
      currentReviews: 4,
      upcomingReviews: [2],
      upcomingReviewTimes: { "2026-09-11T09:00:00.000Z": 2 },
    });

    await updateBadgeAndScheduleNotifications();

    expect(mockedNativeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({
          widgetBackgroundRefreshEnabled: false,
        }),
      }),
    );
  });
});
