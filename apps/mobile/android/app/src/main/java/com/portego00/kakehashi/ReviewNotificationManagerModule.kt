package com.portego00.kakehashi

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.modules.core.PermissionListener

class ReviewNotificationManagerModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  companion object {
    private const val PERMISSION_REQUEST_CODE = 9327
  }

  private var pendingPermissionPromise: Promise? = null

  override fun getName(): String = "ReviewNotificationManager"

  @ReactMethod
  fun updateBadgeAndScheduleNotifications(reviewData: ReadableMap, promise: Promise) {
    try {
      val currentReviews = reviewData.getIntOrDefault("currentReviews", 0)
      val settings = reviewData.getMap("settings")
        ?: run {
          promise.reject("INVALID_DATA", "Missing notification settings")
          return
        }

      val badgeEnabled = settings.getBooleanOrDefault("badgeEnabled", false)
      val alertsEnabled = settings.getBooleanOrDefault("alertsEnabled", false)
      val soundsEnabled = settings.getBooleanOrDefault("soundsEnabled", false)

      val existing = AndroidReviewNotifications.clearPendingNotifications(reactContext)
      existing.forEach { AndroidReviewNotifications.cancelScheduledNotification(reactContext, it) }

      val badgeSet = AndroidReviewNotifications.setBadgeCount(
        reactContext,
        if (badgeEnabled) currentReviews else 0
      )

      val notifications = if (alertsEnabled || badgeEnabled) {
        val exactPairs = parseUpcomingReviewTimes(reviewData.getMap("upcomingReviewTimes"))
        if (exactPairs.isNotEmpty()) {
          AndroidReviewNotifications.buildFromExactData(
            currentReviews = currentReviews,
            upcomingReviewTimes = exactPairs,
            alertsEnabled = alertsEnabled,
            badgeEnabled = badgeEnabled,
            soundsEnabled = soundsEnabled
          )
        } else {
          val upcomingReviews = parseUpcomingReviews(reviewData.getArray("upcomingReviews"))
          AndroidReviewNotifications.buildFromHourlyData(
            currentReviews = currentReviews,
            upcomingReviews = upcomingReviews,
            alertsEnabled = alertsEnabled,
            badgeEnabled = badgeEnabled,
            soundsEnabled = soundsEnabled
          )
        }
      } else {
        emptyList()
      }

      notifications.forEach { AndroidReviewNotifications.scheduleNotification(reactContext, it) }
      AndroidReviewNotifications.savePendingNotifications(reactContext, notifications)

      val result = Arguments.createMap().apply {
        putBoolean("success", true)
        putInt("currentReviews", currentReviews)
        putBoolean("badgeSet", badgeEnabled && badgeSet)
        putBoolean("notificationsScheduled", notifications.isNotEmpty())
      }
      promise.resolve(result)
    } catch (error: Throwable) {
      promise.reject("UPDATE_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun requestPermissions(promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
      promise.resolve(Arguments.createMap().apply { putBoolean("granted", true) })
      return
    }

    if (
      reactContext.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) ==
      PackageManager.PERMISSION_GRANTED
    ) {
      promise.resolve(Arguments.createMap().apply { putBoolean("granted", true) })
      return
    }

    if (pendingPermissionPromise != null) {
      promise.reject("PERMISSION_PENDING", "Notification permission request already in progress")
      return
    }

    val activity = reactContext.currentActivity as? PermissionAwareActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "No active activity to request permissions")
      return
    }

    pendingPermissionPromise = promise
    AndroidReviewNotifications.markPermissionRequested(reactContext)

    val listener = PermissionListener { requestCode, _, grantResults ->
      if (requestCode != PERMISSION_REQUEST_CODE) {
        return@PermissionListener false
      }

      val granted =
        grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED
      pendingPermissionPromise?.resolve(
        Arguments.createMap().apply { putBoolean("granted", granted) }
      )
      pendingPermissionPromise = null
      true
    }

    try {
      activity.requestPermissions(
        arrayOf(Manifest.permission.POST_NOTIFICATIONS),
        PERMISSION_REQUEST_CODE,
        listener
      )
    } catch (error: Throwable) {
      pendingPermissionPromise = null
      promise.reject("PERMISSION_REQUEST_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun getNotificationSettings(promise: Promise) {
    try {
      val permissionGranted = AndroidReviewNotifications.hasNotificationPermission(reactContext)
      val appEnabled = AndroidReviewNotifications.areNotificationsEnabled(reactContext)
      val authorizationStatus = when {
        permissionGranted -> "authorized"
        AndroidReviewNotifications.wasPermissionRequested(reactContext) -> "denied"
        else -> "notDetermined"
      }
      val enabledSetting = if (permissionGranted && appEnabled) "enabled" else "disabled"

      val result = Arguments.createMap().apply {
        putString("authorizationStatus", authorizationStatus)
        putString("alertSetting", enabledSetting)
        putString("badgeSetting", enabledSetting)
        putString("soundSetting", enabledSetting)
      }
      promise.resolve(result)
    } catch (error: Throwable) {
      promise.reject("SETTINGS_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun scheduleTestNotification(promise: Promise) {
    if (!AndroidReviewNotifications.hasNotificationPermission(reactContext)) {
      promise.reject("PERMISSION_DENIED", "Notification permissions not granted")
      return
    }

    try {
      val existing = AndroidReviewNotifications.clearPendingNotifications(reactContext)
      existing.forEach { AndroidReviewNotifications.cancelScheduledNotification(reactContext, it) }

      AndroidReviewNotifications.setBadgeCount(reactContext, 99)
      val triggerAt = System.currentTimeMillis() + 60_000L
      val testNotification = ScheduledReviewNotification(
        identifier = "test-notification",
        title = "WaniKani Test Notification",
        body = "This is a test! You have 42 new reviews available.",
        badge = 142,
        triggerAtMillis = triggerAt,
        alertsEnabled = true,
        badgeEnabled = true,
        soundsEnabled = true,
        newReviews = 42,
        reviewCount = 142,
        exactTime = false,
        isTest = true
      )

      AndroidReviewNotifications.scheduleNotification(reactContext, testNotification)
      AndroidReviewNotifications.savePendingNotifications(reactContext, listOf(testNotification))

      val result = Arguments.createMap().apply {
        putBoolean("success", true)
        putInt("badgeSet", 99)
        putString("notificationScheduledFor", "60 seconds from now")
        putInt("notificationBadgeWillBe", 142)
      }
      promise.resolve(result)
    } catch (error: Throwable) {
      promise.reject("SCHEDULE_ERROR", error.message, error)
    }
  }

  @ReactMethod
  fun getPendingNotifications(promise: Promise) {
    try {
      val notifications = AndroidReviewNotifications.loadPendingNotifications(reactContext)
        .sortedBy { it.triggerAtMillis }
      val now = System.currentTimeMillis()
      val items = Arguments.createArray()

      notifications.forEach { notification ->
        val trigger = Arguments.createMap().apply {
          putString("type", "timeInterval")
          putDouble(
            "timeInterval",
            ((notification.triggerAtMillis - now).coerceAtLeast(0L) / 1000.0)
          )
          putString("fireDate", AndroidReviewNotifications.toIsoString(notification.triggerAtMillis))
          putBoolean("repeats", false)
        }

        val userInfo = Arguments.createMap().apply {
          putInt("reviewCount", notification.reviewCount)
          putInt("newReviews", notification.newReviews)
          putBoolean("exactTime", notification.exactTime)
          putBoolean("isTest", notification.isTest)
        }

        val item = Arguments.createMap().apply {
          putString("identifier", notification.identifier)
          putString("title", notification.title)
          putString("body", notification.body)
          putInt("badge", notification.badge)
          putMap("trigger", trigger)
          putMap("userInfo", userInfo)
        }
        items.pushMap(item)
      }

      val result = Arguments.createMap().apply {
        putInt("count", notifications.size)
        putArray("notifications", items)
      }
      promise.resolve(result)
    } catch (error: Throwable) {
      promise.reject("PENDING_FAILED", error.message, error)
    }
  }

  private fun parseUpcomingReviews(upcomingReviews: ReadableArray?): List<Int> {
    if (upcomingReviews == null) {
      return emptyList()
    }

    val result = mutableListOf<Int>()
    for (index in 0 until upcomingReviews.size()) {
      result.add(upcomingReviews.getIntOrDefault(index, 0))
    }
    return result
  }

  private fun parseUpcomingReviewTimes(upcomingReviewTimes: ReadableMap?): List<Pair<Long, Int>> {
    if (upcomingReviewTimes == null) {
      return emptyList()
    }

    val result = mutableListOf<Pair<Long, Int>>()
    val iterator = upcomingReviewTimes.keySetIterator()
    while (iterator.hasNextKey()) {
      val key = iterator.nextKey()
      val value = when (upcomingReviewTimes.getType(key)) {
        ReadableType.Number -> upcomingReviewTimes.getInt(key)
        else -> 0
      }
      if (value <= 0) {
        continue
      }

      val timestamp = AndroidReviewNotifications.parseIsoDate(key) ?: continue
      result.add(timestamp to value)
    }
    return result
  }

  private fun ReadableMap.getIntOrDefault(key: String, defaultValue: Int): Int {
    return if (hasKey(key) && getType(key) == ReadableType.Number) getInt(key) else defaultValue
  }

  private fun ReadableMap.getBooleanOrDefault(key: String, defaultValue: Boolean): Boolean {
    return if (hasKey(key) && getType(key) == ReadableType.Boolean) getBoolean(key) else defaultValue
  }

  private fun ReadableArray.getIntOrDefault(index: Int, defaultValue: Int): Int {
    return if (getType(index) == ReadableType.Number) getInt(index) else defaultValue
  }
}
