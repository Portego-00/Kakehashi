package com.portego00.kakehashi

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class ReviewNotificationReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    val notification = AndroidReviewNotifications.notificationFromIntent(intent) ?: return

    if (notification.badgeEnabled) {
      AndroidReviewNotifications.setBadgeCount(context, notification.badge)
    } else {
      AndroidReviewNotifications.setBadgeCount(context, 0)
    }

    AndroidReviewNotifications.postNotificationIfEnabled(context, notification)
    AndroidReviewNotifications.removePendingNotification(context, notification.identifier)
  }
}
