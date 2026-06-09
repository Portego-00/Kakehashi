import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import {
  cancelDailyLessonReminderNotification,
  syncDailyLessonReminderNotification,
} from '../reviewNotifications';

jest.mock('expo-notifications', () => ({
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  getAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve([])),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('scheduled-id')),
  SchedulableTriggerInputTypes: {
    DAILY: 'daily',
  },
}));

jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
  isTaskDefined: jest.fn(() => false),
}));

jest.mock('../platformSupport', () => ({
  supportsBadgeAndReviewNotifications: jest.fn(() => true),
}));

jest.mock('../reviewNotificationIntegration', () => ({
  shouldUseNativeReviewNotificationSystem: jest.fn(() => false),
}));

jest.mock('../api', () => ({
  getAssignmentsOptimized: jest.fn(() => Promise.resolve({ data: [] })),
  getReviewCount: jest.fn(() => Promise.resolve(0)),
  getStoredApiToken: jest.fn(() => Promise.resolve('api-token')),
}));

jest.mock('../dailyLessonLimit', () => ({
  getLessonsStartedToday: jest.fn(() => 0),
}));

const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockedNotifications = Notifications as jest.Mocked<typeof Notifications>;

describe('reviewNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAsyncStorage.getItem.mockResolvedValue(null);
    mockedAsyncStorage.removeItem.mockResolvedValue();
    mockedNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([]);
    mockedNotifications.cancelScheduledNotificationAsync.mockResolvedValue();
    mockedNotifications.scheduleNotificationAsync.mockResolvedValue('scheduled-id');
  });

  it('cancels stale pending daily lesson reminders even without a stored notification id', async () => {
    mockedNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      {
        identifier: 'stale-lesson-reminder',
        content: {
          data: {
            dailyLessonReminder: true,
          },
        },
      },
      {
        identifier: 'daily-review-reminder',
        content: {
          data: {
            dailyReminder: true,
          },
        },
      },
    ] as unknown as Awaited<
      ReturnType<typeof Notifications.getAllScheduledNotificationsAsync>
    >);

    await cancelDailyLessonReminderNotification();

    expect(
      mockedNotifications.cancelScheduledNotificationAsync
    ).toHaveBeenCalledTimes(1);
    expect(
      mockedNotifications.cancelScheduledNotificationAsync
    ).toHaveBeenCalledWith('stale-lesson-reminder');
    expect(mockedAsyncStorage.removeItem).toHaveBeenCalledWith(
      'daily-lesson-reminder-notification-id'
    );
  });

  it('clears stale daily lesson reminders when syncing with the setting disabled', async () => {
    mockedAsyncStorage.getItem.mockImplementation((key) => {
      if (key === 'wanikani-settings') {
        return Promise.resolve(
          JSON.stringify({
            state: {
              dailyLessonReminderEnabled: false,
            },
          })
        );
      }

      return Promise.resolve(null);
    });
    mockedNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      {
        identifier: 'stale-lesson-reminder',
        content: {
          data: {
            dailyLessonReminder: true,
          },
        },
      },
    ] as unknown as Awaited<
      ReturnType<typeof Notifications.getAllScheduledNotificationsAsync>
    >);

    await syncDailyLessonReminderNotification();

    expect(
      mockedNotifications.cancelScheduledNotificationAsync
    ).toHaveBeenCalledWith('stale-lesson-reminder');
    expect(mockedNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('uses explicit daily lesson reminder overrides instead of stale stored settings', async () => {
    mockedAsyncStorage.getItem.mockImplementation((key) => {
      if (key === 'wanikani-settings') {
        return Promise.resolve(
          JSON.stringify({
            state: {
              dailyLessonReminderEnabled: true,
              dailyLessonReminderMinimum: 5,
            },
          })
        );
      }

      return Promise.resolve(null);
    });
    mockedNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      {
        identifier: 'stale-lesson-reminder',
        content: {
          data: {
            dailyLessonReminder: true,
          },
        },
      },
    ] as unknown as Awaited<
      ReturnType<typeof Notifications.getAllScheduledNotificationsAsync>
    >);

    await syncDailyLessonReminderNotification({
      lessonProgress: {
        lessonsStartedToday: 0,
        remainingLessons: 20,
      },
      reminderConfig: {
        enabled: false,
      },
    });

    expect(
      mockedNotifications.cancelScheduledNotificationAsync
    ).toHaveBeenCalledWith('stale-lesson-reminder');
    expect(mockedNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
