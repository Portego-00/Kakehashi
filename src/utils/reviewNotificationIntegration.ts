import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import ReviewNotificationManager, { ReviewData } from '../modules/ReviewNotificationManager';
import WaniKaniBackgroundFetch from '../modules/WaniKaniBackgroundFetch';
import {
  getCachedReviewCountIfAvailable,
  getStoredApiToken,
  getVisibleReviewData,
  type VisibleReviewData,
} from './api';
import { supportsBadgeAndReviewNotifications } from './platformSupport';
import { isNotificationSessionActive } from './notificationSession';

const SETTINGS_KEY = 'wanikani-settings';
const IS_SUPPORTED_PLATFORM =
  Platform.OS === 'ios' && supportsBadgeAndReviewNotifications();
let notificationSyncInFlight: Promise<void> | null = null;
let notificationSyncGeneration = 0;
const nativeNotificationMutations = new Set<Promise<unknown>>();

type NotificationSettings = {
  badgeEnabled: boolean;
  alertsEnabled: boolean;
  soundsEnabled: boolean;
  widgetBackgroundRefreshEnabled?: boolean;
};

let latestNotificationSettings: Partial<NotificationSettings> = {};
let notificationSettingsGeneration = 0;

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
async function getNotificationSettings(): Promise<NotificationSettings> {
  try {
    const settings = await AsyncStorage.getItem(SETTINGS_KEY);
    if (settings) {
      const parsedSettings = JSON.parse(settings);
      return {
        badgeEnabled: parsedSettings.state?.showBadgeNotifications ?? true,
        alertsEnabled: parsedSettings.state?.enableReviewNotifications ?? false,
        soundsEnabled: parsedSettings.state?.notificationSounds ?? true,
        widgetBackgroundRefreshEnabled:
          parsedSettings.state?.widgetBackgroundRefreshEnabled ?? true,
      };
    }
    return {
      badgeEnabled: true,
      alertsEnabled: false,
      soundsEnabled: true,
      widgetBackgroundRefreshEnabled: true,
    };
  } catch (error) {
    console.error('Error getting notification settings:', error);
    return {
      badgeEnabled: true,
      alertsEnabled: false,
      soundsEnabled: true,
      widgetBackgroundRefreshEnabled: true,
    };
  }
}

function convertVisibleReviewDataToReviewData(
  visibleReviewData: {
    currentReviews: number;
    upcomingReviews: number[];
    upcomingReviewTimes: { [key: string]: number };
  },
  settings: { badgeEnabled: boolean; alertsEnabled: boolean; soundsEnabled: boolean }
): ReviewData {
  return {
    currentReviews: visibleReviewData.currentReviews,
    upcomingReviews: visibleReviewData.upcomingReviews,
    upcomingReviewTimes: visibleReviewData.upcomingReviewTimes,
    settings,
  };
}

type UpdateBadgeAndScheduleOptions = {
  forceSummaryRefresh?: boolean; // Maintained for API compatibility.
  visibleReviewData?: VisibleReviewData;
  notificationSettings?: Partial<NotificationSettings>;
};

function sendNativeNotificationSettings(
  settings: Partial<NotificationSettings>
): void {
  if (
    !IS_SUPPORTED_PLATFORM ||
    !WaniKaniBackgroundFetch ||
    typeof WaniKaniBackgroundFetch.updateNotificationSettings !== 'function'
  ) {
    return;
  }

  try {
    WaniKaniBackgroundFetch.updateNotificationSettings(settings);
  } catch {
    // Best effort only. The foreground notification manager still receives
    // the same settings when review data is available.
  }
}

export function updateNativeReviewNotificationSettings(
  settings: NonNullable<
    UpdateBadgeAndScheduleOptions['notificationSettings']
  >
): void {
  const changed = Object.entries(settings).some(
    ([key, value]) =>
      latestNotificationSettings[key as keyof NotificationSettings] !== value
  );
  latestNotificationSettings = {
    ...latestNotificationSettings,
    ...settings,
  };
  if (changed) {
    notificationSettingsGeneration += 1;
  }

  sendNativeNotificationSettings(settings);
}

export async function applyNativeReviewNotificationSettings(
  settings: NonNullable<
    UpdateBadgeAndScheduleOptions['notificationSettings']
  >
): Promise<void> {
  if (!isNotificationSessionActive()) {
    return;
  }
  updateNativeReviewNotificationSettings(settings);

  if (
    !shouldUseNativeReviewNotificationSystem() ||
    typeof ReviewNotificationManager.applyReviewNotificationSettings !==
      'function'
  ) {
    return;
  }

  const nativeMutation = ReviewNotificationManager.applyReviewNotificationSettings(
    settings
  );
  nativeNotificationMutations.add(nativeMutation);
  try {
    await nativeMutation;
  } catch {
    // The preference patch has already reached the background fetch module.
    // A later data refresh can still rebuild the schedule with those settings.
  } finally {
    nativeNotificationMutations.delete(nativeMutation);
  }
}

async function runNotificationSync(
  options: UpdateBadgeAndScheduleOptions,
  requestedSettingsGeneration: number,
  requestedSyncGeneration: number
): Promise<void> {
  try {
    if (
      requestedSyncGeneration !== notificationSyncGeneration ||
      !isNotificationSessionActive()
    ) {
      return;
    }

    const apiToken = await getStoredApiToken();
    if (
      !apiToken ||
      requestedSyncGeneration !== notificationSyncGeneration ||
      !isNotificationSessionActive()
    ) {
      return;
    }

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

    const settings = {
      ...(await getNotificationSettings()),
      ...options.notificationSettings,
      ...latestNotificationSettings,
    };
    const syncSettingsGeneration = notificationSettingsGeneration;
    if (
      requestedSettingsGeneration !== syncSettingsGeneration ||
      requestedSyncGeneration !== notificationSyncGeneration ||
      !isNotificationSessionActive()
    ) {
      return;
    }

    // Retained for API compatibility with existing callers.
    void options.forceSummaryRefresh;
    sendNativeNotificationSettings(settings);

    let reviewData: ReviewData | null = null;
    try {
      const visibleReviewData =
        options.visibleReviewData ??
        (await getVisibleReviewData(apiToken, {
          hoursAhead: 24,
        }));
      reviewData = convertVisibleReviewDataToReviewData(
        visibleReviewData,
        settings
      );
    } catch (visibleDataError) {
      console.warn(
        'Failed to fetch hidden-filtered upcoming review data:',
        visibleDataError
      );
      const currentReviews = await getCachedReviewCountIfAvailable();
      if (
        currentReviews !== null &&
        syncSettingsGeneration === notificationSettingsGeneration &&
        requestedSyncGeneration === notificationSyncGeneration &&
        isNotificationSessionActive()
      ) {
        // A count-only result can safely refresh the icon badge, but it must
        // not replace the native upcoming schedule with an empty one.
        await Notifications.setBadgeCountAsync(
          settings.badgeEnabled ? currentReviews : 0
        );
      }
      return;
    }

    if (
      !reviewData ||
      syncSettingsGeneration !== notificationSettingsGeneration ||
      requestedSyncGeneration !== notificationSyncGeneration ||
      !isNotificationSessionActive()
    ) {
      return;
    }

    await ReviewNotificationManager.updateBadgeAndScheduleNotifications(
      reviewData
    );
  } catch {
    // Silent failure for notification updates
  }
}

async function scheduleNotificationSync(
  options: UpdateBadgeAndScheduleOptions,
  requestedSettingsGeneration: number,
  requestedSyncGeneration: number
): Promise<void> {
  if (notificationSyncInFlight) {
    const activeSync = notificationSyncInFlight;
    const needsFollowUp = Boolean(
      options.forceSummaryRefresh ||
        options.visibleReviewData ||
        options.notificationSettings
    );
    if (!needsFollowUp) {
      return activeSync;
    }

    await activeSync;
    if (
      requestedSettingsGeneration !== notificationSettingsGeneration ||
      requestedSyncGeneration !== notificationSyncGeneration ||
      !isNotificationSessionActive()
    ) {
      return;
    }
    return scheduleNotificationSync(
      options,
      requestedSettingsGeneration,
      requestedSyncGeneration
    );
  }

  const syncPromise = runNotificationSync(
    options,
    requestedSettingsGeneration,
    requestedSyncGeneration
  );
  notificationSyncInFlight = syncPromise;

  try {
    await syncPromise;
  } finally {
    if (notificationSyncInFlight === syncPromise) {
      notificationSyncInFlight = null;
    }
  }
}

// Main function to update badge and schedule notifications
export async function updateBadgeAndScheduleNotifications(
  options: UpdateBadgeAndScheduleOptions = {}
): Promise<void> {
  if (
    !isNotificationSessionActive() ||
    !shouldUseNativeReviewNotificationSystem()
  ) {
    return;
  }

  if (options.notificationSettings) {
    // Apply a settings change immediately. The generation also prevents an
    // older in-flight data request from restoring settings the user changed.
    updateNativeReviewNotificationSettings(options.notificationSettings);
  }

  const requestedSettingsGeneration = notificationSettingsGeneration;
  const requestedSyncGeneration = notificationSyncGeneration;
  await scheduleNotificationSync(
    options,
    requestedSettingsGeneration,
    requestedSyncGeneration
  );
}

/**
 * Stop stale account work and wait for any native scheduling call that already
 * crossed the bridge. Logout can then make its notification removal the final
 * notification-center mutation.
 */
export async function invalidateReviewNotificationSyncsForLogout(): Promise<void> {
  notificationSyncGeneration += 1;
  const activeWork = [
    ...(notificationSyncInFlight ? [notificationSyncInFlight] : []),
    ...nativeNotificationMutations,
  ];

  await Promise.allSettled(activeWork);
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

export async function clearNativeReviewAlerts(): Promise<void> {
  // Persist the toggle independently of network availability so a later
  // background fetch cannot recreate alerts that the user disabled.
  updateNativeReviewNotificationSettings({ alertsEnabled: false });

  if (
    !shouldUseNativeReviewNotificationSystem() ||
    typeof ReviewNotificationManager.clearReviewAlerts !== 'function'
  ) {
    return;
  }

  const nativeMutation = ReviewNotificationManager.clearReviewAlerts();
  nativeNotificationMutations.add(nativeMutation);
  try {
    await nativeMutation;
  } finally {
    nativeNotificationMutations.delete(nativeMutation);
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
