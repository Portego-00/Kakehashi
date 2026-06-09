package com.portego00.kakehashi

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class ReviewNotificationBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    val action = intent?.action ?: return
    if (
      action != Intent.ACTION_BOOT_COMPLETED &&
      action != Intent.ACTION_MY_PACKAGE_REPLACED
    ) {
      return
    }

    val now = System.currentTimeMillis()
    val pending = AndroidReviewNotifications.loadPendingNotifications(context)
      .filter { it.triggerAtMillis > now }

    pending.forEach { AndroidReviewNotifications.scheduleNotification(context, it) }
    AndroidReviewNotifications.savePendingNotifications(context, pending)
  }
}
