import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { getAssignmentsOptimized, getReviewCount, getStoredApiToken } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supportsBadgeAndReviewNotifications } from './platformSupport';
import { shouldUseNativeReviewNotificationSystem } from './reviewNotificationIntegration';
import { getLessonsStartedToday } from './dailyLessonLimit';

const REVIEW_CHECK_TASK = 'check-new-reviews';
const LAST_REVIEW_COUNT_KEY = 'last-review-count';
const DAILY_REVIEW_REMINDER_NOTIFICATION_ID_KEY =
  'daily-review-reminder-notification-id';
const DAILY_LESSON_REMINDER_NOTIFICATION_ID_KEY =
  'daily-lesson-reminder-notification-id';
const DAILY_REVIEW_REMINDER_MESSAGE_DAY_KEY =
  'daily-review-reminder-message-day';
const DAILY_REVIEW_REMINDER_MESSAGE_INDEX_KEY =
  'daily-review-reminder-message-index';
const REVIEW_NOTIFICATION_RUNTIME_SUPPORTED = supportsBadgeAndReviewNotifications();
const USE_NATIVE_REVIEW_NOTIFICATION_SYSTEM =
  shouldUseNativeReviewNotificationSystem();
let lastReviewCountUpdateInFlight: Promise<void> | null = null;
type UpdateLastReviewCountOptions = {
  reviewCount?: number;
};
type SyncDailyReviewReminderOptions = {
  reviewCount?: number;
};
type LessonReminderProgress = {
  lessonsStartedToday: number;
  remainingLessons: number;
};
type SyncDailyLessonReminderOptions = {
  lessonProgress?: LessonReminderProgress;
};
type SyncDailyReminderNotificationsOptions = {
  reviewCount?: number;
  lessonProgress?: LessonReminderProgress;
};
const DAILY_REVIEW_REMINDER_MESSAGES: {
  title: string;
  body: string;
}[] = [
  {
    title: 'Review reminder',
    body: 'You still have reviews waiting. Time to study!',
  },
  {
    title: 'Keep your streak strong',
    body: 'A quick review session now will make tomorrow easier.',
  },
  {
    title: 'Small session, big progress',
    body: 'You have pending reviews ready whenever you are.',
  },
  {
    title: 'Review time',
    body: 'Knock out a few reviews and keep momentum going.',
  },
  {
    title: 'Your reviews are ready',
    body: 'Take a few minutes now and future you will thank you.',
  },
  {
    title: 'Study nudge',
    body: 'Pending reviews are waiting. Let’s clear some!',
  },
];

function clampDailyReminderHour(hour: unknown): number {
  if (typeof hour !== 'number') {
    return 20;
  }
  return Math.min(23, Math.max(0, Math.floor(hour)));
}

function clampDailyReminderMinute(minute: unknown): number {
  if (typeof minute !== 'number') {
    return 0;
  }
  return Math.min(59, Math.max(0, Math.floor(minute)));
}

function clampDailyLessonReminderMinimum(minimumLessons: unknown): number {
  if (typeof minimumLessons !== 'number') {
    return 5;
  }
  return Math.min(100, Math.max(5, Math.floor(minimumLessons)));
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
  } catch {
    return false;
  }
}

async function getDailyReviewReminderConfig(): Promise<{
  enabled: boolean;
  hour: number;
  minute: number;
}> {
  try {
    const settings = await AsyncStorage.getItem('wanikani-settings');
    if (settings) {
      const parsedSettings = JSON.parse(settings);
      const hour = clampDailyReminderHour(
        parsedSettings.state?.dailyReviewReminderHour
      );
      const minute = clampDailyReminderMinute(
        parsedSettings.state?.dailyReviewReminderMinute
      );

      return {
        enabled: parsedSettings.state?.dailyReviewReminderEnabled ?? false,
        hour,
        minute,
      };
    }
  } catch {
    // Fall back to defaults.
  }

  return {
    enabled: false,
    hour: 20,
    minute: 0,
  };
}

async function getDailyLessonReminderConfig(): Promise<{
  enabled: boolean;
  minimumLessons: number;
  hour: number;
  minute: number;
}> {
  try {
    const settings = await AsyncStorage.getItem('wanikani-settings');
    if (settings) {
      const parsedSettings = JSON.parse(settings);
      const hour = clampDailyReminderHour(
        parsedSettings.state?.dailyReviewReminderHour
      );
      const minute = clampDailyReminderMinute(
        parsedSettings.state?.dailyReviewReminderMinute
      );

      return {
        enabled: parsedSettings.state?.dailyLessonReminderEnabled ?? false,
        minimumLessons: clampDailyLessonReminderMinimum(
          parsedSettings.state?.dailyLessonReminderMinimum
        ),
        hour,
        minute,
      };
    }
  } catch {
    // Fall back to defaults.
  }

  return {
    enabled: false,
    minimumLessons: 5,
    hour: 20,
    minute: 0,
  };
}

function getDayKeyForDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getNextReminderDate(hour: number, minute: number): Date {
  const now = new Date();
  const nextReminderDate = new Date(now);
  nextReminderDate.setHours(hour, minute, 0, 0);

  if (nextReminderDate.getTime() <= now.getTime()) {
    nextReminderDate.setDate(nextReminderDate.getDate() + 1);
  }

  return nextReminderDate;
}

async function getReminderMessageForDay(
  targetDate: Date
): Promise<{ title: string; body: string }> {
  const dayKey = getDayKeyForDate(targetDate);

  try {
    const [storedDayKey, storedIndexRaw] = await Promise.all([
      AsyncStorage.getItem(DAILY_REVIEW_REMINDER_MESSAGE_DAY_KEY),
      AsyncStorage.getItem(DAILY_REVIEW_REMINDER_MESSAGE_INDEX_KEY),
    ]);

    const storedIndex = storedIndexRaw ? parseInt(storedIndexRaw, 10) : NaN;
    const hasValidStoredIndex =
      Number.isInteger(storedIndex) &&
      storedIndex >= 0 &&
      storedIndex < DAILY_REVIEW_REMINDER_MESSAGES.length;

    if (storedDayKey === dayKey && hasValidStoredIndex) {
      return DAILY_REVIEW_REMINDER_MESSAGES[storedIndex];
    }

    const previousIndex = hasValidStoredIndex ? storedIndex : -1;
    const randomIndex = Math.floor(
      Math.random() * DAILY_REVIEW_REMINDER_MESSAGES.length
    );
    const nextIndex =
      DAILY_REVIEW_REMINDER_MESSAGES.length > 1 && randomIndex === previousIndex
        ? (randomIndex + 1) % DAILY_REVIEW_REMINDER_MESSAGES.length
        : randomIndex;

    await Promise.all([
      AsyncStorage.setItem(DAILY_REVIEW_REMINDER_MESSAGE_DAY_KEY, dayKey),
      AsyncStorage.setItem(
        DAILY_REVIEW_REMINDER_MESSAGE_INDEX_KEY,
        String(nextIndex)
      ),
    ]);

    return DAILY_REVIEW_REMINDER_MESSAGES[nextIndex];
  } catch {
    const fallbackIndex = Math.floor(
      Math.random() * DAILY_REVIEW_REMINDER_MESSAGES.length
    );
    return DAILY_REVIEW_REMINDER_MESSAGES[fallbackIndex];
  }
}

export async function cancelDailyReviewReminderNotification(): Promise<void> {
  if (!REVIEW_NOTIFICATION_RUNTIME_SUPPORTED) {
    return;
  }

  try {
    const scheduledNotificationId = await AsyncStorage.getItem(
      DAILY_REVIEW_REMINDER_NOTIFICATION_ID_KEY
    );
    if (scheduledNotificationId) {
      await Notifications.cancelScheduledNotificationAsync(scheduledNotificationId);
    }
  } catch {
    // Silent failure
  } finally {
    try {
      await AsyncStorage.removeItem(DAILY_REVIEW_REMINDER_NOTIFICATION_ID_KEY);
    } catch {
      // Silent failure
    }
  }
}

export async function cancelDailyLessonReminderNotification(): Promise<void> {
  if (!REVIEW_NOTIFICATION_RUNTIME_SUPPORTED) {
    return;
  }

  try {
    const scheduledNotificationId = await AsyncStorage.getItem(
      DAILY_LESSON_REMINDER_NOTIFICATION_ID_KEY
    );
    if (scheduledNotificationId) {
      await Notifications.cancelScheduledNotificationAsync(scheduledNotificationId);
    }
  } catch {
    // Silent failure
  } finally {
    try {
      await AsyncStorage.removeItem(DAILY_LESSON_REMINDER_NOTIFICATION_ID_KEY);
    } catch {
      // Silent failure
    }
  }
}

export async function syncDailyReviewReminderNotification(
  options: SyncDailyReviewReminderOptions = {}
): Promise<void> {
  if (!REVIEW_NOTIFICATION_RUNTIME_SUPPORTED) {
    return;
  }

  try {
    await cancelDailyReviewReminderNotification();

    const reminderConfig = await getDailyReviewReminderConfig();
    if (!reminderConfig.enabled) {
      return;
    }

    const permissions = await Notifications.getPermissionsAsync();
    if (permissions.status !== 'granted') {
      return;
    }

    let reviewCount =
      typeof options.reviewCount === 'number'
        ? Math.max(0, options.reviewCount)
        : null;

    if (reviewCount === null) {
      const apiToken = await getStoredApiToken();
      if (!apiToken) {
        return;
      }
      reviewCount = await getReviewCount(apiToken);
    }

    if (reviewCount <= 0) {
      return;
    }

    const nextReminderDate = getNextReminderDate(
      reminderConfig.hour,
      reminderConfig.minute
    );
    const reminderMessage = await getReminderMessageForDay(nextReminderDate);

    const scheduledNotificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: reminderMessage.title,
        body: reminderMessage.body,
        data: {
          dailyReminder: true,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: reminderConfig.hour,
        minute: reminderConfig.minute,
      },
    });

    await AsyncStorage.setItem(
      DAILY_REVIEW_REMINDER_NOTIFICATION_ID_KEY,
      scheduledNotificationId
    );
  } catch {
    // Silent failure
  }
}

function normalizeLessonReminderProgress(
  progress: LessonReminderProgress | undefined
): LessonReminderProgress | null {
  if (!progress) {
    return null;
  }

  const lessonsStartedToday = Number.isFinite(progress.lessonsStartedToday)
    ? Math.max(0, Math.floor(progress.lessonsStartedToday))
    : null;
  const remainingLessons = Number.isFinite(progress.remainingLessons)
    ? Math.max(0, Math.floor(progress.remainingLessons))
    : null;

  if (lessonsStartedToday === null || remainingLessons === null) {
    return null;
  }

  return {
    lessonsStartedToday,
    remainingLessons,
  };
}

async function getLessonReminderProgress(
  options: SyncDailyLessonReminderOptions
): Promise<LessonReminderProgress | null> {
  const providedProgress = normalizeLessonReminderProgress(options.lessonProgress);
  if (providedProgress) {
    return providedProgress;
  }

  const apiToken = await getStoredApiToken();
  if (!apiToken) {
    return null;
  }

  const assignments = await getAssignmentsOptimized(
    apiToken,
    {},
    { forceFullRefresh: false }
  );
  const assignmentsData = Array.isArray(assignments?.data)
    ? assignments.data
    : [];
  const remainingLessons = assignmentsData.filter((assignment) => {
    const assignmentData = assignment?.data;
    return Boolean(
      assignmentData?.unlocked_at &&
        !assignmentData?.started_at &&
        !assignmentData?.hidden
    );
  }).length;
  const lessonsStartedToday = getLessonsStartedToday(assignmentsData);

  return {
    lessonsStartedToday,
    remainingLessons,
  };
}

export async function syncDailyLessonReminderNotification(
  options: SyncDailyLessonReminderOptions = {}
): Promise<void> {
  if (!REVIEW_NOTIFICATION_RUNTIME_SUPPORTED) {
    return;
  }

  try {
    await cancelDailyLessonReminderNotification();

    const reminderConfig = await getDailyLessonReminderConfig();
    if (!reminderConfig.enabled) {
      return;
    }

    const permissions = await Notifications.getPermissionsAsync();
    if (permissions.status !== 'granted') {
      return;
    }

    const lessonProgress = await getLessonReminderProgress(options);
    if (!lessonProgress) {
      return;
    }

    if (lessonProgress.remainingLessons <= 0) {
      return;
    }

    if (lessonProgress.lessonsStartedToday >= reminderConfig.minimumLessons) {
      return;
    }

    const minimumLessonsLabel =
      reminderConfig.minimumLessons === 1 ? 'lesson' : 'lessons';
    const scheduledNotificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Lesson reminder',
        body: `You are below your daily goal of ${reminderConfig.minimumLessons} ${minimumLessonsLabel}. Keep your lesson streak moving.`,
        data: {
          dailyLessonReminder: true,
          minimumDailyLessons: reminderConfig.minimumLessons,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: reminderConfig.hour,
        minute: reminderConfig.minute,
      },
    });

    await AsyncStorage.setItem(
      DAILY_LESSON_REMINDER_NOTIFICATION_ID_KEY,
      scheduledNotificationId
    );
  } catch {
    // Silent failure
  }
}

export async function syncDailyReminderNotifications(
  options: SyncDailyReminderNotificationsOptions = {}
): Promise<void> {
  await syncDailyReviewReminderNotification({ reviewCount: options.reviewCount });
  await syncDailyLessonReminderNotification({
    lessonProgress: options.lessonProgress,
  });
}

if (REVIEW_NOTIFICATION_RUNTIME_SUPPORTED) {
  // Background task to check for new reviews.
  // Guard against re-defining after OTA/JS reload to avoid runtime collisions.
  const isReviewCheckTaskAlreadyDefined =
    typeof TaskManager.isTaskDefined === 'function' &&
    TaskManager.isTaskDefined(REVIEW_CHECK_TASK);

  if (!isReviewCheckTaskAlreadyDefined) {
    TaskManager.defineTask(REVIEW_CHECK_TASK, async () => {
      try {
        // Check if review notifications are enabled
        const isEnabled = await isReviewNotificationsEnabled();
        if (!isEnabled) {
          return { backgroundFetchResult: 'noData' };
        }

        const apiToken = await getStoredApiToken();
        if (!apiToken) {
          return { backgroundFetchResult: 'failed' };
        }

        // Get current visible review count (hidden items excluded).
        const currentReviewCount = await getReviewCount(apiToken);

        // Get last known review count
        const lastCountStr = await AsyncStorage.getItem(LAST_REVIEW_COUNT_KEY);
        const lastReviewCount = lastCountStr ? parseInt(lastCountStr, 10) : 0;

        // If we have more reviews than before, send notification
        if (currentReviewCount > lastReviewCount && currentReviewCount > 0) {
          const newReviews = currentReviewCount - lastReviewCount;

          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'New Reviews Available! 📚',
              body: `You have ${newReviews} new review${newReviews > 1 ? 's' : ''} ready. Time to study!`,
              data: { reviewCount: currentReviewCount, newReviews },
            },
            trigger: null, // Send immediately
          });
        }

        // Update last review count
        await AsyncStorage.setItem(LAST_REVIEW_COUNT_KEY, currentReviewCount.toString());

        return { backgroundFetchResult: 'newData' };
      } catch {
        return { backgroundFetchResult: 'failed' };
      }
    });
  }
}

export async function initializeReviewNotifications(): Promise<void> {
  if (!REVIEW_NOTIFICATION_RUNTIME_SUPPORTED) {
    return;
  }

  try {
    // Check if feature is enabled
    const isEnabled = await isReviewNotificationsEnabled();
    if (!isEnabled) {
      return;
    }

    // Request notification permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      return;
    }

    // Set up notification categories
    await Notifications.setNotificationCategoryAsync('reviews', [
      {
        identifier: 'open_reviews',
        buttonTitle: 'Study Now',
        options: { opensAppToForeground: true },
      },
    ]);

    // Initialize the last review count for comparison
    await updateLastReviewCount();
  } catch {
    // Silent failure for notification initialization
  }
}

export async function updateLastReviewCount(
  options: UpdateLastReviewCountOptions = {}
): Promise<void> {
  if (!REVIEW_NOTIFICATION_RUNTIME_SUPPORTED) {
    return;
  }

  if (lastReviewCountUpdateInFlight) {
    return lastReviewCountUpdateInFlight;
  }

  lastReviewCountUpdateInFlight = (async () => {
    try {
      const apiToken = await getStoredApiToken();
      if (!apiToken) return;

      const currentReviewCount =
        typeof options.reviewCount === 'number'
          ? Math.max(0, options.reviewCount)
          : await getReviewCount(apiToken);

      await AsyncStorage.setItem(LAST_REVIEW_COUNT_KEY, currentReviewCount.toString());
    } catch {
      // Silent failure
    } finally {
      lastReviewCountUpdateInFlight = null;
    }
  })();

  return lastReviewCountUpdateInFlight;
}

export async function scheduleReviewChecks(): Promise<void> {
  if (!REVIEW_NOTIFICATION_RUNTIME_SUPPORTED) {
    return;
  }

  if (USE_NATIVE_REVIEW_NOTIFICATION_SYSTEM) {
    // Native iOS scheduler already owns review notification scheduling.
    return;
  }

  try {
    // Cancel any existing expo notifications
    await Notifications.cancelAllScheduledNotificationsAsync();
    await AsyncStorage.removeItem(DAILY_REVIEW_REMINDER_NOTIFICATION_ID_KEY);
    await AsyncStorage.removeItem(DAILY_LESSON_REMINDER_NOTIFICATION_ID_KEY);
    
    const isEnabled = await isReviewNotificationsEnabled();
    if (!isEnabled) {
      return;
    }

    // Use the native notification system for proper scheduling
  } catch {
    // Silent failure
  }
}

export async function cancelReviewNotifications(): Promise<void> {
  if (!REVIEW_NOTIFICATION_RUNTIME_SUPPORTED) {
    return;
  }

  try {
    // Cancel expo notifications
    await Notifications.cancelAllScheduledNotificationsAsync();
    await AsyncStorage.removeItem(DAILY_REVIEW_REMINDER_NOTIFICATION_ID_KEY);
    await AsyncStorage.removeItem(DAILY_LESSON_REMINDER_NOTIFICATION_ID_KEY);
    
    // Also cancel native notifications by clearing them
    try {
      const { updateBadgeAndScheduleNotifications } = await import('./reviewNotificationIntegration');
      await updateBadgeAndScheduleNotifications(); // This will clear existing and not schedule new ones if settings are disabled
    } catch {
      // Silent failure for clearing native notifications
    }
  } catch {
    // Silent failure
  }
}

// Function to manually trigger a review check (for testing or immediate updates)
export async function checkForNewReviews(): Promise<void> {
  if (!REVIEW_NOTIFICATION_RUNTIME_SUPPORTED) {
    return;
  }

  try {
    const isEnabled = await isReviewNotificationsEnabled();
    if (!isEnabled) return;

    // Execute the same logic as the background task manually
    const apiToken = await getStoredApiToken();
    if (!apiToken) {
      return;
    }

    // Get current visible review count (hidden items excluded).
    const currentReviewCount = await getReviewCount(apiToken);

    // Get last known review count
    const lastCountStr = await AsyncStorage.getItem(LAST_REVIEW_COUNT_KEY);
    const lastReviewCount = lastCountStr ? parseInt(lastCountStr, 10) : 0;

    // If we have more reviews than before, send notification
    if (currentReviewCount > lastReviewCount && currentReviewCount > 0) {
      const newReviews = currentReviewCount - lastReviewCount;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'New Reviews Available! 📚',
          body: `You have ${newReviews} new review${newReviews > 1 ? 's' : ''} ready. Time to study!`,
          data: { reviewCount: currentReviewCount, newReviews },
        },
        trigger: null, // Send immediately
      });
    }

    // Update last review count
    await AsyncStorage.setItem(LAST_REVIEW_COUNT_KEY, currentReviewCount.toString());
  } catch {
    // Silent failure
  }
}
