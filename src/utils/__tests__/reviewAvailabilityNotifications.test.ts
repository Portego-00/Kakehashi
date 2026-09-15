import * as Notifications from 'expo-notifications';

import {
  cancelReviewAvailabilityNotifications,
  presentCombinedReviewAvailabilityNotification,
  REVIEW_AVAILABILITY_NOTIFICATION_IDENTIFIER,
} from '../reviewAvailabilityNotifications';

jest.mock('expo-notifications', () => ({
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  dismissNotificationAsync: jest.fn(() => Promise.resolve()),
  getAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve([])),
  getPresentedNotificationsAsync: jest.fn(() => Promise.resolve([])),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('review-available')),
}));

const mockedNotifications = Notifications as jest.Mocked<typeof Notifications>;

function notification(
  identifier: string,
  data: Record<string, unknown>
): Notifications.Notification {
  return {
    date: Date.now(),
    request: {
      identifier,
      content: {
        title: null,
        subtitle: null,
        body: null,
        data,
        categoryIdentifier: null,
        sound: null,
        launchImageName: null,
        badge: null,
        attachments: [],
        threadIdentifier: null,
      },
      trigger: null,
    },
  };
}

describe('combined review availability notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([]);
    mockedNotifications.getPresentedNotificationsAsync.mockResolvedValue([]);
    mockedNotifications.scheduleNotificationAsync.mockResolvedValue(
      REVIEW_AVAILABILITY_NOTIFICATION_IDENTIFIER
    );
  });

  it('dismisses an earlier review alert and sends its replacement with one stable identifier', async () => {
    mockedNotifications.getPresentedNotificationsAsync.mockResolvedValue([
      notification('legacy-review-alert', {
        reviewCount: 7,
        newReviews: 2,
      }),
      notification('daily-review-reminder', {
        dailyReminder: true,
      }),
    ]);

    await presentCombinedReviewAvailabilityNotification({
      reviewCount: 12,
      newReviews: 5,
    });

    expect(mockedNotifications.dismissNotificationAsync).toHaveBeenCalledTimes(
      1
    );
    expect(mockedNotifications.dismissNotificationAsync).toHaveBeenCalledWith(
      'legacy-review-alert'
    );
    expect(mockedNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: REVIEW_AVAILABILITY_NOTIFICATION_IDENTIFIER,
        content: expect.objectContaining({
          categoryIdentifier: 'reviews',
          data: expect.objectContaining({
            kakehashiReviewAvailabilityNotification: true,
            reviewCount: 12,
            newReviews: 5,
          }),
        }),
        trigger: null,
      })
    );
    expect(mockedNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          body: 'You have 12 reviews waiting. Time to study!',
        }),
      })
    );
  });

  it('cancels only availability alerts and preserves daily and issue notifications', async () => {
    mockedNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      notification(REVIEW_AVAILABILITY_NOTIFICATION_IDENTIFIER, {}).request,
      notification('legacy-review-alert', {
        reviewCount: 15,
        newReviews: 3,
      }).request,
      notification('daily-review-reminder', {
        dailyReminder: true,
      }).request,
      notification('issue-activity', {
        kind: 'issueActivity',
        reviewCount: 4,
        newReviews: 1,
      }).request,
      notification('review-hourly-1', {
        kakehashiReviewNotification: true,
        kakehashiReviewAlert: true,
        reviewCount: 18,
        newReviews: 3,
      }).request,
      notification('badge-update-hourly-2', {
        kakehashiReviewNotification: true,
        kakehashiReviewAlert: false,
        reviewCount: 20,
        newReviews: 2,
      }).request,
    ]);
    mockedNotifications.getPresentedNotificationsAsync.mockResolvedValue([
      notification('shown-review-alert', {
        kakehashiReviewAvailabilityNotification: true,
      }),
      notification('shown-native-review-alert', {
        kakehashiReviewNotification: true,
        kakehashiReviewAlert: true,
        reviewCount: 20,
        newReviews: 2,
      }),
      notification('shown-daily-reminder', {
        dailyLessonReminder: true,
      }),
    ]);

    await cancelReviewAvailabilityNotifications();

    expect(
      mockedNotifications.cancelScheduledNotificationAsync.mock.calls.map(
        ([identifier]) => identifier
      )
    ).toEqual([
      REVIEW_AVAILABILITY_NOTIFICATION_IDENTIFIER,
      'legacy-review-alert',
    ]);
    expect(mockedNotifications.dismissNotificationAsync).toHaveBeenCalledTimes(
      1
    );
    expect(mockedNotifications.dismissNotificationAsync).toHaveBeenCalledWith(
      'shown-review-alert'
    );
  });

  it('preserves a pending native reminder and its forecast badge when falling back to a current count', async () => {
    const pending = notification(REVIEW_AVAILABILITY_NOTIFICATION_IDENTIFIER, {
      kakehashiReviewNotification: true,
      kakehashiReviewAlert: true,
      reviewCount: 12,
      newReviews: 5,
    }).request;
    pending.trigger = { type: 'timeInterval', repeats: false, seconds: 3600 };
    mockedNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([pending]);
    mockedNotifications.getPresentedNotificationsAsync.mockResolvedValue([
      notification(REVIEW_AVAILABILITY_NOTIFICATION_IDENTIFIER, { reviewCount: 7 }),
    ]);

    await presentCombinedReviewAvailabilityNotification({ reviewCount: 8, newReviews: 1 });

    expect(mockedNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mockedNotifications.dismissNotificationAsync).not.toHaveBeenCalled();
    expect(mockedNotifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });
});
