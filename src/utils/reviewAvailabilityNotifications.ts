import * as Notifications from 'expo-notifications';

export const REVIEW_AVAILABILITY_NOTIFICATION_IDENTIFIER = 'review-available';
export const REVIEW_AVAILABILITY_NOTIFICATION_CATEGORY = 'reviews';
const REVIEW_AVAILABILITY_NOTIFICATION_MARKER =
  'kakehashiReviewAvailabilityNotification';
const NATIVE_REVIEW_NOTIFICATION_MARKER = 'kakehashiReviewNotification';

type NotificationRequest = Awaited<
  ReturnType<typeof Notifications.getAllScheduledNotificationsAsync>
>[number];

function notificationData(
  request: NotificationRequest
): Record<string, unknown> | null {
  const data = request.content?.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return null;
  }

  return data as Record<string, unknown>;
}

function isReviewAvailabilityNotification(
  request: NotificationRequest
): boolean {
  if (request.identifier === REVIEW_AVAILABILITY_NOTIFICATION_IDENTIFIER) {
    return true;
  }

  const data = notificationData(request);
  if (!data) {
    return false;
  }

  if (data[REVIEW_AVAILABILITY_NOTIFICATION_MARKER] === true) {
    return true;
  }

  // Native hourly alerts and silent badge updates share the system notification
  // center with Expo. They are cleaned up by the native manager, which can
  // distinguish visible alerts from badge-only requests and preserve the latter.
  if (data[NATIVE_REVIEW_NOTIFICATION_MARKER] === true) {
    return false;
  }

  // Recognize notifications created by older builds without matching daily
  // review or lesson reminders, which have their own explicit markers.
  return (
    typeof data.reviewCount === 'number' &&
    typeof data.newReviews === 'number' &&
    data.dailyReminder !== true &&
    data.dailyLessonReminder !== true &&
    data.kind !== 'issueActivity'
  );
}

async function dismissDeliveredReviewAvailabilityNotifications(): Promise<void> {
  try {
    const notifications = await Notifications.getPresentedNotificationsAsync();
    const identifiers = notifications
      .map((notification) => notification.request)
      .filter(isReviewAvailabilityNotification)
      .map((request) => request.identifier);

    await Promise.all(
      identifiers.map((identifier) =>
        Notifications.dismissNotificationAsync(identifier)
      )
    );
  } catch {
    // Reusing the stable identifier still coalesces new iOS notifications when
    // presented-notification lookup is unavailable.
  }
}

export async function presentCombinedReviewAvailabilityNotification({
  reviewCount,
  newReviews,
}: {
  reviewCount: number;
  newReviews: number;
}): Promise<void> {
  // A count-only background fallback must not replace the native pending
  // reminder: its badge belongs to a future review time. Both paths share the
  // delivered identity, so keep the native schedule until a full refresh can
  // rebuild it safely.
  try {
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    if (pending.some((request) =>
      request.identifier === REVIEW_AVAILABILITY_NOTIFICATION_IDENTIFIER &&
      notificationData(request)?.[NATIVE_REVIEW_NOTIFICATION_MARKER] === true
    )) {
      return;
    }
  } catch {
    // Preserve an existing native schedule when its status is unavailable.
    return;
  }

  await dismissDeliveredReviewAvailabilityNotifications();

  await Notifications.scheduleNotificationAsync({
    identifier: REVIEW_AVAILABILITY_NOTIFICATION_IDENTIFIER,
    content: {
      title: 'New Reviews Available! 📚',
      body: `You have ${reviewCount} review${reviewCount === 1 ? '' : 's'} waiting. Time to study!`,
      categoryIdentifier: REVIEW_AVAILABILITY_NOTIFICATION_CATEGORY,
      data: {
        [REVIEW_AVAILABILITY_NOTIFICATION_MARKER]: true,
        reviewCount,
        newReviews,
      },
    },
    trigger: null,
  });
}

export async function cancelReviewAvailabilityNotifications(): Promise<void> {
  try {
    const notifications =
      await Notifications.getAllScheduledNotificationsAsync();
    const identifiers = notifications
      .filter(isReviewAvailabilityNotification)
      .map((request) => request.identifier);

    await Promise.all(
      identifiers.map((identifier) =>
        Notifications.cancelScheduledNotificationAsync(identifier)
      )
    );
  } catch {
    // Delivered notifications are still cleared below.
  }

  await dismissDeliveredReviewAvailabilityNotifications();
}
