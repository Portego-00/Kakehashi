import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import ReviewNotificationManager, { ReviewData } from '../modules/ReviewNotificationManager';
import WaniKaniBackgroundFetch from '../modules/WaniKaniBackgroundFetch';
import {
  getReviewCount,
  getStoredApiToken,
  getVisibleReviewData,
  type VisibleReviewData,
} from './api';
import { supportsBadgeAndReviewNotifications } from './platformSupport';
import { useAuthStore } from './store';

const SETTINGS_KEY = 'wanikani-settings';
const IS_SUPPORTED_PLATFORM =
  Platform.OS === 'ios' && supportsBadgeAndReviewNotifications();
let notificationSyncInFlight: Promise<void> | null = null;

function hasNativeNotificationManager(): boolean {
  return (
    !!ReviewNotificationManager &&
    typeof ReviewNotificationManager.updateBadgeAndScheduleNotifications === 'function'
  );
}

export function shouldUseNativeReviewNotificationSystem(): boolean {
  return IS_SUPPORTED_PLATFORM && hasNativeNotificationManager();
}

// Helper function to get notification settings from AsyncStorage
async function getNotificationSettings(): Promise<{
  badgeEnabled: boolean;
  alertsEnabled: boolean;
  soundsEnabled: boolean;
}> {
  try {
    const settings = await AsyncStorage.getItem(SETTINGS_KEY);
    if (settings) {
      const parsedSettings = JSON.parse(settings);
      return {
        badgeEnabled: parsedSettings.state?.showBadgeNotifications ?? true,
        alertsEnabled: parsedSettings.state?.enableReviewNotifications ?? false,
        soundsEnabled: parsedSettings.state?.notificationSounds ?? true,
      };
    }
    return {
      badgeEnabled: true,
      alertsEnabled: false,
      soundsEnabled: true,
    };
  } catch (error) {
    console.error('Error getting notification settings:', error);
    return {
      badgeEnabled: true,
      alertsEnabled: false,
      soundsEnabled: true,
    };
  }
}

function convertVisibleReviewDataToReviewData(
  visibleReviewData: {
    currentReviews: number;
    upcomingReviews: number[];
    upcomingReviewTimes: { [key: string]: number };
  },
  settings: { badgeEnabled: boolean; alertsEnabled: boolean; soundsEnabled: boolean },
  vacation: { isOnVacation: boolean; vacationStartedAt: string | null }
): ReviewData {
  if (vacation.isOnVacation) {
    return {
      currentReviews: 0,
      upcomingReviews: new Array(
        Math.max(visibleReviewData.upcomingReviews.length, 24)
      ).fill(0),
      upcomingReviewTimes: {},
      isOnVacation: true,
      vacationStartedAt: vacation.vacationStartedAt,
      settings,
    };
  }

  return {
    currentReviews: visibleReviewData.currentReviews,
    upcomingReviews: visibleReviewData.upcomingReviews,
    upcomingReviewTimes: visibleReviewData.upcomingReviewTimes,
    isOnVacation: false,
    vacationStartedAt: null,
    settings,
  };
}

type UpdateBadgeAndScheduleOptions = {
  forceSummaryRefresh?: boolean; // Maintained for API compatibility.
  visibleReviewData?: VisibleReviewData;
};

// Main function to update badge and schedule notifications
export async function updateBadgeAndScheduleNotifications(
  options: UpdateBadgeAndScheduleOptions = {}
): Promise<void> {
  if (!shouldUseNativeReviewNotificationSystem()) {
    return;
  }

  if (notificationSyncInFlight) {
    return notificationSyncInFlight;
  }

  notificationSyncInFlight = (async () => {
    try {
      // Get API token
      const apiToken = await getStoredApiToken();
      if (!apiToken) {
        return;
      }

      // Store API token in iOS native module for background fetch
      if (
        Platform.OS === 'ios' &&
        WaniKaniBackgroundFetch &&
        typeof WaniKaniBackgroundFetch.storeApiToken === 'function'
      ) {
        try {
          WaniKaniBackgroundFetch.storeApiToken(apiToken);
        } catch {
          // Best effort only.
        }
      }

      // Get notification settings
      const settings = await getNotificationSettings();
      const vacationStartedAt =
        useAuthStore.getState().userData?.current_vacation_started_at ?? null;
      const vacation = {
        isOnVacation: Boolean(vacationStartedAt),
        vacationStartedAt,
      };
      // Retained for API compatibility with existing callers.
      void options.forceSummaryRefresh;
      
      // Update settings in iOS native module for background fetch
      if (
        Platform.OS === 'ios' &&
        WaniKaniBackgroundFetch &&
        typeof WaniKaniBackgroundFetch.updateNotificationSettings === 'function'
      ) {
        try {
          WaniKaniBackgroundFetch.updateNotificationSettings(settings);
        } catch {
          // Best effort only.
        }
      }

      let reviewData: ReviewData | null = null;
      try {
        const visibleReviewData =
          options.visibleReviewData ??
          (await getVisibleReviewData(apiToken, {
            hoursAhead: 24,
          }));
        reviewData = convertVisibleReviewDataToReviewData(
          visibleReviewData,
          settings,
          vacation
        );
      } catch (visibleDataError) {
        console.warn(
          "Failed to fetch hidden-filtered upcoming review data:",
          visibleDataError
        );
        const currentReviews = await getReviewCount(apiToken);
        reviewData = {
          currentReviews: vacation.isOnVacation ? 0 : currentReviews,
          upcomingReviews: new Array(24).fill(0),
          upcomingReviewTimes: {},
          isOnVacation: vacation.isOnVacation,
          vacationStartedAt: vacation.vacationStartedAt,
          settings,
        };
      }

      if (!reviewData) {
        return;
      }

      // Call native module to update badge and schedule notifications
      await ReviewNotificationManager.updateBadgeAndScheduleNotifications(reviewData);
    } catch {
      // Silent failure for notification updates
    } finally {
      notificationSyncInFlight = null;
    }
  })();

  return notificationSyncInFlight;
}

// Request notification permissions
export async function requestNotificationPermissions(): Promise<boolean> {
  if (!shouldUseNativeReviewNotificationSystem()) {
    return false;
  }

  try {
    const result = await ReviewNotificationManager.requestPermissions();
    return result.granted;
  } catch (error) {
    console.error('❌ Failed to request notification permissions:', error);
    return false;
  }
}

// Get current notification settings from system
export async function getSystemNotificationSettings() {
  if (!shouldUseNativeReviewNotificationSystem()) {
    return null;
  }

  try {
    return await ReviewNotificationManager.getNotificationSettings();
  } catch (error) {
    console.error('❌ Failed to get notification settings:', error);
    return null;
  }
}

// Initialize notifications on app startup
export async function initializeNotifications(): Promise<void> {
  if (!shouldUseNativeReviewNotificationSystem()) {
    return;
  }

  try {
    // Only initialize if permissions are already granted
    // Don't request permissions automatically - let users enable in settings
    const settings = await getSystemNotificationSettings();
    if (settings?.authorizationStatus === 'authorized') {
      await updateBadgeAndScheduleNotifications();
    }
  } catch {
    // Silent failure for notification initialization
  }
}

// Test function to trigger notifications manually
export async function testNotifications(): Promise<void> {
  try {
    await updateBadgeAndScheduleNotifications();
  } catch {
    // Silent failure
  }
}

// Test function to schedule a notification in 1 minute (for debugging purposes)
export async function scheduleTestNotification(): Promise<void> {
  if (!shouldUseNativeReviewNotificationSystem()) {
    return;
  }

  try {
    // Request permissions first
    const permissionResult = await ReviewNotificationManager.requestPermissions();
    if (!permissionResult.granted) {
      alert('Please enable notifications in Settings to test this feature');
      return;
    }

    // Schedule test notification using native method
    const result = await ReviewNotificationManager.scheduleTestNotification();

    alert(`Test notification scheduled!\n\nBadge: ${result.badgeSet} → ${result.notificationBadgeWillBe}\nNotification in: ${result.notificationScheduledFor}`);

  } catch {
    alert('Failed to schedule test notification.');
  }
}

// Function to reset badge to actual count
export async function resetBadgeToActualCount(): Promise<void> {
  try {
    await updateBadgeAndScheduleNotifications();
  } catch {
    // Silent failure
  }
}
