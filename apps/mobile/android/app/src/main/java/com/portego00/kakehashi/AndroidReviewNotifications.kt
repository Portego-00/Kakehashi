package com.portego00.kakehashi

import android.Manifest
import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import android.os.Build
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import expo.modules.notifications.badge.BadgeHelper
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

internal data class ScheduledReviewNotification(
  val identifier: String,
  val title: String,
  val body: String,
  val badge: Int,
  val triggerAtMillis: Long,
  val alertsEnabled: Boolean,
  val badgeEnabled: Boolean,
  val soundsEnabled: Boolean,
  val newReviews: Int,
  val reviewCount: Int,
  val exactTime: Boolean,
  val isTest: Boolean,
)

internal object AndroidReviewNotifications {
  private const val PREFS_NAME = "wanikani_review_notifications"
  private const val KEY_PENDING_NOTIFICATIONS = "pending_notifications"
  private const val KEY_PERMISSION_REQUESTED = "notification_permission_requested"
  private const val MAX_SCHEDULE_HOURS = 64L

  const val CHANNEL_ID = "wanikani_reviews"
  const val ACTION_TRIGGER_NOTIFICATION = "com.portego00.kakehashi.ACTION_TRIGGER_REVIEW_NOTIFICATION"

  private const val EXTRA_IDENTIFIER = "identifier"
  private const val EXTRA_TITLE = "title"
  private const val EXTRA_BODY = "body"
  private const val EXTRA_BADGE = "badge"
  private const val EXTRA_ALERTS_ENABLED = "alertsEnabled"
  private const val EXTRA_BADGE_ENABLED = "badgeEnabled"
  private const val EXTRA_SOUNDS_ENABLED = "soundsEnabled"
  private const val EXTRA_NEW_REVIEWS = "newReviews"
  private const val EXTRA_REVIEW_COUNT = "reviewCount"
  private const val EXTRA_EXACT_TIME = "exactTime"
  private const val EXTRA_IS_TEST = "isTest"

  fun buildDefaultTitle(newReviews: Int): String {
    return "$newReviews new review${if (newReviews == 1) "" else "s"} available"
  }

  fun buildDefaultBody(totalReviews: Int): String {
    return "You have $totalReviews review${if (totalReviews == 1) "" else "s"} waiting"
  }

  fun markPermissionRequested(context: Context) {
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putBoolean(KEY_PERMISSION_REQUESTED, true)
      .apply()
  }

  fun wasPermissionRequested(context: Context): Boolean {
    return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .getBoolean(KEY_PERMISSION_REQUESTED, false)
  }

  fun hasNotificationPermission(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
      return true
    }
    return ActivityCompat.checkSelfPermission(
      context,
      Manifest.permission.POST_NOTIFICATIONS
    ) == PackageManager.PERMISSION_GRANTED
  }

  fun areNotificationsEnabled(context: Context): Boolean {
    return NotificationManagerCompat.from(context).areNotificationsEnabled()
  }

  fun setBadgeCount(context: Context, count: Int): Boolean {
    return try {
      BadgeHelper.setBadgeCount(context.applicationContext, count.coerceAtLeast(0))
    } catch (_: Throwable) {
      false
    }
  }

  fun ensureNotificationChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }

    val manager = context.getSystemService(NotificationManager::class.java) ?: return
    if (manager.getNotificationChannel(CHANNEL_ID) != null) {
      return
    }

    val channel = NotificationChannel(
      CHANNEL_ID,
      "Review notifications",
      NotificationManager.IMPORTANCE_DEFAULT
    ).apply {
      description = "Notifications for new WaniKani reviews"
      setShowBadge(true)
      lockscreenVisibility = Notification.VISIBILITY_PRIVATE
    }

    manager.createNotificationChannel(channel)
  }

  fun loadPendingNotifications(context: Context): MutableList<ScheduledReviewNotification> {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val raw = prefs.getString(KEY_PENDING_NOTIFICATIONS, "[]") ?: "[]"
    val array = runCatching { JSONArray(raw) }.getOrNull() ?: JSONArray()
    val result = mutableListOf<ScheduledReviewNotification>()

    for (i in 0 until array.length()) {
      val obj = array.optJSONObject(i) ?: continue
      result.add(
        ScheduledReviewNotification(
          identifier = obj.optString(EXTRA_IDENTIFIER),
          title = obj.optString(EXTRA_TITLE),
          body = obj.optString(EXTRA_BODY),
          badge = obj.optInt(EXTRA_BADGE, 0),
          triggerAtMillis = obj.optLong("triggerAtMillis", 0L),
          alertsEnabled = obj.optBoolean(EXTRA_ALERTS_ENABLED, false),
          badgeEnabled = obj.optBoolean(EXTRA_BADGE_ENABLED, false),
          soundsEnabled = obj.optBoolean(EXTRA_SOUNDS_ENABLED, false),
          newReviews = obj.optInt(EXTRA_NEW_REVIEWS, 0),
          reviewCount = obj.optInt(EXTRA_REVIEW_COUNT, 0),
          exactTime = obj.optBoolean(EXTRA_EXACT_TIME, false),
          isTest = obj.optBoolean(EXTRA_IS_TEST, false),
        )
      )
    }

    return result
  }

  fun savePendingNotifications(
    context: Context,
    notifications: List<ScheduledReviewNotification>
  ) {
    val array = JSONArray()
    notifications.forEach { notification ->
      array.put(
        JSONObject()
          .put(EXTRA_IDENTIFIER, notification.identifier)
          .put(EXTRA_TITLE, notification.title)
          .put(EXTRA_BODY, notification.body)
          .put(EXTRA_BADGE, notification.badge)
          .put("triggerAtMillis", notification.triggerAtMillis)
          .put(EXTRA_ALERTS_ENABLED, notification.alertsEnabled)
          .put(EXTRA_BADGE_ENABLED, notification.badgeEnabled)
          .put(EXTRA_SOUNDS_ENABLED, notification.soundsEnabled)
          .put(EXTRA_NEW_REVIEWS, notification.newReviews)
          .put(EXTRA_REVIEW_COUNT, notification.reviewCount)
          .put(EXTRA_EXACT_TIME, notification.exactTime)
          .put(EXTRA_IS_TEST, notification.isTest)
      )
    }

    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY_PENDING_NOTIFICATIONS, array.toString())
      .apply()
  }

  fun clearPendingNotifications(context: Context): List<ScheduledReviewNotification> {
    val existing = loadPendingNotifications(context)
    savePendingNotifications(context, emptyList())
    return existing
  }

  fun removePendingNotification(context: Context, identifier: String) {
    val updated = loadPendingNotifications(context)
      .filterNot { it.identifier == identifier }
    savePendingNotifications(context, updated)
  }

  fun requestCodeFromIdentifier(identifier: String): Int {
    return identifier.hashCode()
  }

  fun buildPendingIntent(
    context: Context,
    notification: ScheduledReviewNotification,
    flags: Int
  ): PendingIntent? {
    val intent = Intent(context, ReviewNotificationReceiver::class.java).apply {
      action = ACTION_TRIGGER_NOTIFICATION
      putExtra(EXTRA_IDENTIFIER, notification.identifier)
      putExtra(EXTRA_TITLE, notification.title)
      putExtra(EXTRA_BODY, notification.body)
      putExtra(EXTRA_BADGE, notification.badge)
      putExtra(EXTRA_ALERTS_ENABLED, notification.alertsEnabled)
      putExtra(EXTRA_BADGE_ENABLED, notification.badgeEnabled)
      putExtra(EXTRA_SOUNDS_ENABLED, notification.soundsEnabled)
      putExtra(EXTRA_NEW_REVIEWS, notification.newReviews)
      putExtra(EXTRA_REVIEW_COUNT, notification.reviewCount)
      putExtra(EXTRA_EXACT_TIME, notification.exactTime)
      putExtra(EXTRA_IS_TEST, notification.isTest)
    }

    return PendingIntent.getBroadcast(
      context,
      requestCodeFromIdentifier(notification.identifier),
      intent,
      flags
    )
  }

  fun scheduleNotification(context: Context, notification: ScheduledReviewNotification) {
    ensureNotificationChannel(context)
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val pendingIntent = buildPendingIntent(
      context,
      notification,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    ) ?: return
    val triggerAt = notification.triggerAtMillis

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)
    } else {
      alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)
    }
  }

  fun cancelScheduledNotification(context: Context, notification: ScheduledReviewNotification) {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val pendingIntent = buildPendingIntent(
      context,
      notification,
      PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
    )
    if (pendingIntent != null) {
      alarmManager.cancel(pendingIntent)
      pendingIntent.cancel()
    }

    NotificationManagerCompat.from(context)
      .cancel(requestCodeFromIdentifier(notification.identifier))
  }

  fun notificationFromIntent(intent: Intent?): ScheduledReviewNotification? {
    if (intent?.action != ACTION_TRIGGER_NOTIFICATION) {
      return null
    }

    val identifier = intent.getStringExtra(EXTRA_IDENTIFIER) ?: return null
    return ScheduledReviewNotification(
      identifier = identifier,
      title = intent.getStringExtra(EXTRA_TITLE) ?: buildDefaultTitle(0),
      body = intent.getStringExtra(EXTRA_BODY) ?: buildDefaultBody(0),
      badge = intent.getIntExtra(EXTRA_BADGE, 0),
      triggerAtMillis = 0L,
      alertsEnabled = intent.getBooleanExtra(EXTRA_ALERTS_ENABLED, false),
      badgeEnabled = intent.getBooleanExtra(EXTRA_BADGE_ENABLED, false),
      soundsEnabled = intent.getBooleanExtra(EXTRA_SOUNDS_ENABLED, false),
      newReviews = intent.getIntExtra(EXTRA_NEW_REVIEWS, 0),
      reviewCount = intent.getIntExtra(EXTRA_REVIEW_COUNT, 0),
      exactTime = intent.getBooleanExtra(EXTRA_EXACT_TIME, false),
      isTest = intent.getBooleanExtra(EXTRA_IS_TEST, false),
    )
  }

  fun postNotificationIfEnabled(context: Context, notification: ScheduledReviewNotification) {
    if (!notification.alertsEnabled) {
      return
    }
    if (!hasNotificationPermission(context) || !areNotificationsEnabled(context)) {
      return
    }

    ensureNotificationChannel(context)

    val launchIntent = context.packageManager
      .getLaunchIntentForPackage(context.packageName)
      ?.apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP) }

    val contentIntent = launchIntent?.let {
      PendingIntent.getActivity(
        context,
        requestCodeFromIdentifier(notification.identifier),
        it,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
    }

    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.drawable.notification_icon)
      .setLargeIcon(BitmapFactory.decodeResource(context.resources, R.mipmap.icon))
      .setContentTitle(notification.title)
      .setContentText(notification.body)
      .setAutoCancel(true)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setCategory(NotificationCompat.CATEGORY_REMINDER)
      .setOnlyAlertOnce(true)
      .setNumber(notification.badge)
      .setBadgeIconType(NotificationCompat.BADGE_ICON_SMALL)

    if (!notification.soundsEnabled) {
      builder.setSilent(true)
    } else {
      builder.setDefaults(Notification.DEFAULT_SOUND)
    }

    if (contentIntent != null) {
      builder.setContentIntent(contentIntent)
    }

    if (
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
      ActivityCompat.checkSelfPermission(
        context,
        Manifest.permission.POST_NOTIFICATIONS
      ) != PackageManager.PERMISSION_GRANTED
    ) {
      return
    }

    NotificationManagerCompat.from(context)
      .notify(requestCodeFromIdentifier(notification.identifier), builder.build())
  }

  fun toIsoString(timestamp: Long): String {
    val formatter = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", Locale.US)
    formatter.timeZone = TimeZone.getTimeZone("UTC")
    return formatter.format(Date(timestamp))
  }

  fun parseIsoDate(value: String): Long? {
    val formats = listOf(
      "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
      "yyyy-MM-dd'T'HH:mm:ssXXX",
      "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
      "yyyy-MM-dd'T'HH:mm:ss'Z'"
    )

    for (pattern in formats) {
      val formatter = SimpleDateFormat(pattern, Locale.US)
      formatter.timeZone = TimeZone.getTimeZone("UTC")
      formatter.isLenient = false
      val parsed = runCatching { formatter.parse(value) }.getOrNull()
      if (parsed != null) {
        return parsed.time
      }
    }

    return null
  }

  fun buildFromHourlyData(
    currentReviews: Int,
    upcomingReviews: List<Int>,
    alertsEnabled: Boolean,
    badgeEnabled: Boolean,
    soundsEnabled: Boolean
  ): List<ScheduledReviewNotification> {
    val nextHour = Calendar.getInstance().apply {
      set(Calendar.MINUTE, 0)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
      add(Calendar.HOUR_OF_DAY, 1)
    }.timeInMillis

    var cumulativeReviews = currentReviews
    val notifications = mutableListOf<ScheduledReviewNotification>()

    for (hour in 0 until minOf(upcomingReviews.size, MAX_SCHEDULE_HOURS.toInt())) {
      val reviewsAtHour = upcomingReviews[hour]
      if (reviewsAtHour <= 0) {
        continue
      }

      val triggerAt = nextHour + (hour * 60L * 60L * 1000L)
      if (triggerAt <= System.currentTimeMillis()) {
        continue
      }

      cumulativeReviews += reviewsAtHour
      val identifier = "review-$hour-$triggerAt"
      notifications.add(
        ScheduledReviewNotification(
          identifier = identifier,
          title = buildDefaultTitle(reviewsAtHour),
          body = buildDefaultBody(cumulativeReviews),
          badge = cumulativeReviews,
          triggerAtMillis = triggerAt,
          alertsEnabled = alertsEnabled,
          badgeEnabled = badgeEnabled,
          soundsEnabled = soundsEnabled,
          newReviews = reviewsAtHour,
          reviewCount = cumulativeReviews,
          exactTime = false,
          isTest = false,
        )
      )
    }

    return notifications
  }

  fun buildFromExactData(
    currentReviews: Int,
    upcomingReviewTimes: List<Pair<Long, Int>>,
    alertsEnabled: Boolean,
    badgeEnabled: Boolean,
    soundsEnabled: Boolean
  ): List<ScheduledReviewNotification> {
    val now = System.currentTimeMillis()
    var cumulativeReviews = currentReviews

    return upcomingReviewTimes
      .sortedBy { it.first }
      .asSequence()
      .filter { (_, count) -> count > 0 }
      .filter { (time, _) -> time > now && (time - now) <= MAX_SCHEDULE_HOURS * 60L * 60L * 1000L }
      .take(MAX_SCHEDULE_HOURS.toInt())
      .map { (time, count) ->
        cumulativeReviews += count
        ScheduledReviewNotification(
          identifier = "review-exact-$time",
          title = buildDefaultTitle(count),
          body = "You now have $cumulativeReviews review${if (cumulativeReviews == 1) "" else "s"} waiting",
          badge = cumulativeReviews,
          triggerAtMillis = time,
          alertsEnabled = alertsEnabled,
          badgeEnabled = badgeEnabled,
          soundsEnabled = soundsEnabled,
          newReviews = count,
          reviewCount = cumulativeReviews,
          exactTime = true,
          isTest = false,
        )
      }
      .toList()
  }
}
