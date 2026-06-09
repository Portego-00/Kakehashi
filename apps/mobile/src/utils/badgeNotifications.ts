import * as Notifications from 'expo-notifications';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { getReviewCount, getStoredApiToken, type VisibleReviewData } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  updateBadgeAndScheduleNotifications,
  initializeNotifications,
  shouldUseNativeReviewNotificationSystem,
} from './reviewNotificationIntegration';
import { syncDailyReminderNotifications } from './reviewNotifications';
import { supportsBadgeAndReviewNotifications } from './platformSupport';

const BACKGROUND_FETCH_TASK = 'background-fetch-reviews';
const LAST_REVIEW_COUNT_KEY = 'last-review-count';
const NOTIFICATION_RUNTIME_SUPPORTED = supportsBadgeAndReviewNotifications();
const USE_NATIVE_NOTIFICATION_SYSTEM = shouldUseNativeReviewNotificationSystem();
let badgeUpdateInFlight: Promise<void> | null = null;
type UpdateBadgeWithReviewCountOptions = {
  forceSummaryRefresh?: boolean;
  visibleReviewData?: VisibleReviewData;
};

// Helper function to check if badge notifications are enabled
async function isBadgeNotificationsEnabled(): Promise<boolean> {
  try {
    const settings = await AsyncStorage.getItem('wanikani-settings');
    if (settings) {
      const parsedSettings = JSON.parse(settings);
      return parsedSettings.state?.showBadgeNotifications ?? true; // Default to true
    }
    return true; // Default to true if no settings found
  } catch (error) {
    console.error('Error checking badge notification setting:', error);
    return true; // Default to true on error
  }
}

// Helper function to check if review notifications are enabled
async function isReviewNotificationsEnabled(): Promise<boolean> {
  try {
    const settings = await AsyncStorage.getItem('wanikani-settings');
    if (settings) {
      const parsedSettings = JSON.parse(settings);
      return parsedSettings.state?.enableReviewNotifications ?? false;
    }
    return false;
  } catch (error) {
    console.error('Error checking review notification setting:', error);
    return false;
  }
}

if (NOTIFICATION_RUNTIME_SUPPORTED) {
  const isBackgroundFetchTaskAlreadyDefined =
    typeof TaskManager.isTaskDefined === 'function' &&
    TaskManager.isTaskDefined(BACKGROUND_FETCH_TASK);

  // Configure notification behavior
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const shouldShowIssueActivity =
        notification.request.content.data?.kind === 'issueActivity';

      return {
        shouldShowAlert: shouldShowIssueActivity,
        shouldPlaySound: shouldShowIssueActivity,
        shouldSetBadge: true,
        shouldShowBanner: shouldShowIssueActivity,
        shouldShowList: shouldShowIssueActivity,
      };
    },
  });

  // Background task to update badge count and check for new reviews.
  // Guard against re-defining after OTA/JS reload to avoid runtime collisions.
  if (!isBackgroundFetchTaskAlreadyDefined) {
    TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
      try {
        const apiToken = await getStoredApiToken();
        if (!apiToken) {
          return BackgroundTask.BackgroundTaskResult.Success;
        }

        // Use native notification manager when available
        if (USE_NATIVE_NOTIFICATION_SYSTEM) {
          try {
            await updateBadgeAndScheduleNotifications();
            await syncDailyReminderNotifications();
            return BackgroundTask.BackgroundTaskResult.Success;
          } catch {
            // Fall back to Expo notifications below
          }
        }

        // Fallback implementation using Expo notifications
        // Check badge notifications setting
        const badgeEnabled = await isBadgeNotificationsEnabled();

        // Check review notifications setting
        const reviewNotificationsEnabled = await isReviewNotificationsEnabled();

        // Get current review count (we need this for both features)
        const reviewCount = await getReviewCount(apiToken);

        // Handle badge notifications
        if (badgeEnabled) {
          await setBadgeCount(reviewCount);
        } else {
          await setBadgeCount(0);
        }

        // Handle review notifications
        if (reviewNotificationsEnabled) {
          // Get last known review count
          const lastCountStr = await AsyncStorage.getItem(LAST_REVIEW_COUNT_KEY);
          const lastReviewCount = lastCountStr ? parseInt(lastCountStr, 10) : 0;

          // If we have more reviews than before, send notification
          if (reviewCount > lastReviewCount && reviewCount > 0) {
            const newReviews = reviewCount - lastReviewCount;

            await Notifications.scheduleNotificationAsync({
              content: {
                title: 'New Reviews Available! 📚',
                body: `You have ${newReviews} new review${newReviews > 1 ? 's' : ''} ready. Time to study!`,
                data: { reviewCount, newReviews },
              },
              trigger: null, // Send immediately
            });
          }

          // Update last review count
          await AsyncStorage.setItem(LAST_REVIEW_COUNT_KEY, reviewCount.toString());
        }

        await syncDailyReminderNotifications({ reviewCount });

        return BackgroundTask.BackgroundTaskResult.Success;
      } catch {
        return BackgroundTask.BackgroundTaskResult.Failed;
      }
    });
  }
}

export async function initializeBadgeNotifications(): Promise<void> {
  if (!NOTIFICATION_RUNTIME_SUPPORTED) {
    return;
  }

  try {
    if (USE_NATIVE_NOTIFICATION_SYSTEM) {
      await initializeNotifications();

      // Still register background fetch for periodic updates
      try {
        await BackgroundTask.registerTaskAsync(BACKGROUND_FETCH_TASK, {
          minimumInterval: 60, // 1 hour in minutes
        });
      } catch {
        // Background fetch registration failed - continue anyway
      }

      return;
    }

    // Fallback implementation using Expo notifications
    // Request notification permissions (needed for badge updates)
    await Notifications.requestPermissionsAsync();

    // Try to register background fetch task
    try {
      await BackgroundTask.registerTaskAsync(BACKGROUND_FETCH_TASK, {
        minimumInterval: 60, // 1 hour in minutes
      });
    } catch {
      // Background fetch registration failed - continue anyway
    }
  } catch {
    // Don't throw - let the app continue to work
  }
}

export async function setBadgeCount(count: number): Promise<void> {
  if (!NOTIFICATION_RUNTIME_SUPPORTED) {
    return;
  }

  try {
    await Notifications.setBadgeCountAsync(count);
  } catch {
    // Silent failure for badge count
  }
}

export async function updateBadgeWithReviewCount(
  options: UpdateBadgeWithReviewCountOptions = {}
): Promise<void> {
  if (!NOTIFICATION_RUNTIME_SUPPORTED) {
    return;
  }

  if (badgeUpdateInFlight) {
    return badgeUpdateInFlight;
  }

  badgeUpdateInFlight = (async () => {
    try {
      let reviewCountForReminder =
        typeof options.visibleReviewData?.currentReviews === 'number'
          ? Math.max(0, options.visibleReviewData.currentReviews)
          : null;

      if (USE_NATIVE_NOTIFICATION_SYSTEM) {
        await updateBadgeAndScheduleNotifications({
          forceSummaryRefresh: options.forceSummaryRefresh ?? false,
          visibleReviewData: options.visibleReviewData,
        });

        await syncDailyReminderNotifications({
          reviewCount: reviewCountForReminder ?? undefined,
        });
        return;
      }

      // Android/fallback implementation
      const apiToken = await getStoredApiToken();

      if (!apiToken) {
        await syncDailyReminderNotifications({ reviewCount: 0 });
        return;
      }

      if (reviewCountForReminder === null) {
        reviewCountForReminder = await getReviewCount(apiToken);
      }

      // Check if badge notifications are enabled
      const isEnabled = await isBadgeNotificationsEnabled();
      if (!isEnabled) {
        await setBadgeCount(0);
      } else {
        await setBadgeCount(reviewCountForReminder);
      }

      await syncDailyReminderNotifications({
        reviewCount: reviewCountForReminder,
      });
    } catch {
      // Silent failure for badge update
    } finally {
      badgeUpdateInFlight = null;
    }
  })();

  return badgeUpdateInFlight;
}

export async function clearBadgeCount(): Promise<void> {
  await setBadgeCount(0);
}

// Helper function to check if background fetch is available and registered
export async function getBackgroundFetchStatus(): Promise<{
  isAvailable: boolean;
  isRegistered: boolean;
  status?: BackgroundTask.BackgroundTaskStatus;
}> {
  if (!NOTIFICATION_RUNTIME_SUPPORTED) {
    return { isAvailable: false, isRegistered: false };
  }

  try {
    const status = await BackgroundTask.getStatusAsync();
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);

    return {
      isAvailable: status === BackgroundTask.BackgroundTaskStatus.Available,
      isRegistered,
      status: status || undefined,
    };
  } catch {
    return { isAvailable: false, isRegistered: false };
  }
}
