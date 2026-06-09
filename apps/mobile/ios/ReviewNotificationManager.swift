//
//  ReviewNotificationManager.swift
//  wanikani
//
//  Created by Pedro Ortego on 8/3/25.
//

import Foundation
import UserNotifications
import React
import WidgetKit

// Simple widget data storage for notifications
private func saveWidgetData(currentReviews: Int, upcomingReviews: [Int], upcomingReviewTimes: [String: Int]?) {
    guard let sharedDefaults = UserDefaults(suiteName: "group.com.wanikani.reviewdata") else {
        print("❌ Failed to access App Group UserDefaults")
        return
    }
    
    let data: [String: Any] = [
        "currentReviews": currentReviews,
        "upcomingReviews": upcomingReviews,
        "upcomingReviewTimes": upcomingReviewTimes ?? [:],
        "lastUpdated": Date().timeIntervalSince1970
    ]
    
    sharedDefaults.set(data, forKey: "waniKaniReviewData")
    sharedDefaults.synchronize()
    print("✅ Saved review data to App Group: \(currentReviews) reviews")
}

@objc(ReviewNotificationManager)
class ReviewNotificationManager: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool {
    return true
  }

  @objc func updateBadgeAndScheduleNotifications(
    _ reviewData: [String: Any],
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      self.processReviewData(reviewData, resolve: resolve, reject: reject)
    }
  }
  
  private func processReviewData(
    _ reviewData: [String: Any],
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let currentReviews = reviewData["currentReviews"] as? Int,
          let upcomingReviews = reviewData["upcomingReviews"] as? [Int],
          let notificationSettings = reviewData["settings"] as? [String: Bool] else {
      reject("INVALID_DATA", "Invalid review data format", nil)
      return
    }
    
    let badgeEnabled = notificationSettings["badgeEnabled"] ?? false
    let alertsEnabled = notificationSettings["alertsEnabled"] ?? false
    let soundsEnabled = notificationSettings["soundsEnabled"] ?? false
    let upcomingReviewTimes = reviewData["upcomingReviewTimes"] as? [String: Int]
    
    UNUserNotificationCenter.current().getNotificationSettings { settings in
      DispatchQueue.main.async {
        // Update badge count
        if settings.badgeSetting == .enabled && badgeEnabled {
          UIApplication.shared.applicationIconBadgeNumber = currentReviews
        } else {
          UIApplication.shared.applicationIconBadgeNumber = 0
        }

        // Clear existing review notifications first, then schedule new ones
        // This prevents race conditions where old notifications fire alongside new ones
        UNUserNotificationCenter.current().getPendingNotificationRequests { existingRequests in
          let reviewNotificationIds = existingRequests
            .filter {
              $0.identifier.hasPrefix("review-") ||
              $0.identifier.hasPrefix("badge-update-")
            }
            .map { $0.identifier }

          UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: reviewNotificationIds)
          print("🗑️ Removed \(reviewNotificationIds.count) existing review/badge notifications")

          // Small delay to ensure removal completes before scheduling new notifications
          DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            // Schedule new notifications if enabled
            if (settings.alertSetting == .enabled && alertsEnabled) ||
               (settings.badgeSetting == .enabled && badgeEnabled) {

              // Use exact timing if available, otherwise fall back to hourly
              if let exactTimes = upcomingReviewTimes {
                self.scheduleExactNotifications(
                  currentReviews: currentReviews,
                  upcomingReviewTimes: exactTimes,
                  settings: settings,
                  alertsEnabled: alertsEnabled,
                  badgeEnabled: badgeEnabled,
                  soundsEnabled: soundsEnabled
                )
              } else {
                self.scheduleUpcomingNotifications(
                  currentReviews: currentReviews,
                  upcomingReviews: upcomingReviews,
                  settings: settings,
                  alertsEnabled: alertsEnabled,
                  badgeEnabled: badgeEnabled,
                  soundsEnabled: soundsEnabled
                )
              }
            }

            // Update widget with review data
            saveWidgetData(
              currentReviews: currentReviews,
              upcomingReviews: upcomingReviews,
              upcomingReviewTimes: upcomingReviewTimes
            )
            WidgetCenter.shared.reloadAllTimelines()

            resolve([
              "success": true,
              "currentReviews": currentReviews,
              "badgeSet": badgeEnabled,
              "notificationsScheduled": alertsEnabled
            ])
          }
        }
      }
    }
  }
  
  private func scheduleUpcomingNotifications(
    currentReviews: Int,
    upcomingReviews: [Int],
    settings: UNNotificationSettings,
    alertsEnabled: Bool,
    badgeEnabled: Bool,
    soundsEnabled: Bool
  ) {
    let nc = UNUserNotificationCenter.current()
    
    // Calculate the start of the next hour
    let startDate = Calendar.current.nextDate(
      after: Date(),
      matching: DateComponents(minute: 0, second: 0),
      matchingPolicy: .nextTime
    ) ?? Date().addingTimeInterval(3600)
    
    let startInterval = startDate.timeIntervalSinceNow
    var cumulativeReviews = currentReviews
    
    for hour in 0..<min(upcomingReviews.count, 64) { // Limit to 64 hours
      let reviews = upcomingReviews[hour]
      if reviews == 0 {
        continue
      }
      
      cumulativeReviews += reviews
      
      let triggerTimeInterval = startInterval + (Double(hour) * 60 * 60)
      if triggerTimeInterval <= 0 {
        continue
      }
      
      let identifier = "review-\(hour)"
      let content = UNMutableNotificationContent()
      
      if settings.alertSetting == .enabled && alertsEnabled {
        content.title = "\(reviews) new review\(reviews == 1 ? "" : "s") available"
        content.body = "You have \(cumulativeReviews) review\(cumulativeReviews == 1 ? "" : "s") waiting"
        content.categoryIdentifier = "REVIEW_CATEGORY"
        content.userInfo = [
          "reviewCount": cumulativeReviews,
          "newReviews": reviews
        ]
      }
      
      if settings.badgeSetting == .enabled && badgeEnabled {
        content.badge = NSNumber(value: cumulativeReviews)
      }
      
      if settings.soundSetting == .enabled && soundsEnabled {
        content.sound = UNNotificationSound.default
      }
      
      let trigger = UNTimeIntervalNotificationTrigger(
        timeInterval: triggerTimeInterval,
        repeats: false
      )
      
      let request = UNNotificationRequest(
        identifier: identifier,
        content: content,
        trigger: trigger
      )
      
      nc.add(request) { error in
        if let error = error {
          print("❌ Failed to schedule notification: \(error)")
        }
      }
    }
    
    // Set up notification actions
    setupNotificationActions()
  }
  
  private func scheduleExactNotifications(
    currentReviews: Int,
    upcomingReviewTimes: [String: Int],
    settings: UNNotificationSettings,
    alertsEnabled: Bool,
    badgeEnabled: Bool,
    soundsEnabled: Bool
  ) {
    print("🔔 Scheduling exact notifications for \(upcomingReviewTimes.count) time slots")
    let nc = UNUserNotificationCenter.current()
    let now = Date()
    var cumulativeReviews = currentReviews
    
    // Sort times chronologically
    let dateFormatter = ISO8601DateFormatter()
    dateFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    
    let sortedTimes = upcomingReviewTimes.sorted { (first, second) in
      let firstDate = dateFormatter.date(from: first.key) ?? Date.distantFuture
      let secondDate = dateFormatter.date(from: second.key) ?? Date.distantFuture
      return firstDate < secondDate
    }
    
    print("🔔 Sorted \(sortedTimes.count) time slots chronologically")
    
    for (timeString, reviewCount) in sortedTimes {
      guard let availableAt = dateFormatter.date(from: timeString) else {
        print("⚠️ Could not parse date: \(timeString)")
        continue
      }
      
      print("🕒 Processing time: \(availableAt), reviews: \(reviewCount)")
      
      // Skip past times
      if availableAt <= now {
        print("⏭️ Skipping past time: \(availableAt)")
        continue
      }
      
      // Skip times more than 64 hours away
      let timeInterval = availableAt.timeIntervalSinceNow
      if timeInterval > 64 * 60 * 60 {
        print("⏭️ Skipping time too far in future (>64 hours): \(availableAt)")
        continue
      }
      
      // Skip if no reviews
      if reviewCount == 0 {
        print("⏭️ Skipping time with 0 reviews: \(availableAt)")
        continue
      }
      
      print("✅ Will schedule notification for: \(availableAt) with \(reviewCount) reviews")
      cumulativeReviews += reviewCount
      
      let identifier = "review-exact-\(timeString)"
      let content = UNMutableNotificationContent()
      
      if settings.alertSetting == .enabled && alertsEnabled {
        content.title = "\(reviewCount) new review\(reviewCount == 1 ? "" : "s") available"
        content.body = "You now have \(cumulativeReviews) review\(cumulativeReviews == 1 ? "" : "s") waiting"
        content.categoryIdentifier = "REVIEW_CATEGORY"
        content.userInfo = [
          "reviewCount": cumulativeReviews,
          "newReviews": reviewCount,
          "exactTime": true
        ]
      }
      
      if settings.badgeSetting == .enabled && badgeEnabled {
        content.badge = NSNumber(value: cumulativeReviews)
      }
      
      if settings.soundSetting == .enabled && soundsEnabled {
        content.sound = UNNotificationSound.default
      }
      
      let trigger = UNTimeIntervalNotificationTrigger(
        timeInterval: timeInterval,
        repeats: false
      )
      
      let request = UNNotificationRequest(
        identifier: identifier,
        content: content,
        trigger: trigger
      )
      
      nc.add(request) { error in
        if let error = error {
          print("❌ Failed to schedule exact notification: \(error)")
        } else {
          print("✅ Scheduled exact notification for \(availableAt) with badge \(cumulativeReviews), identifier: \(identifier)")
        }
      }
    }
    
    // Set up notification actions
    setupNotificationActions()
  }
  
  private func setupNotificationActions() {
    let reviewAction = UNNotificationAction(
      identifier: "REVIEW_ACTION",
      title: "Study Now",
      options: [.foreground]
    )
    
    let category = UNNotificationCategory(
      identifier: "REVIEW_CATEGORY",
      actions: [reviewAction],
      intentIdentifiers: [],
      options: []
    )
    
    UNUserNotificationCenter.current().setNotificationCategories([category])
  }
  
  @objc func requestPermissions(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
      DispatchQueue.main.async {
        if let error = error {
          reject("PERMISSION_ERROR", error.localizedDescription, error)
        } else {
          resolve(["granted": granted])
        }
      }
    }
  }
  
  @objc func scheduleTestNotification(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    UNUserNotificationCenter.current().getNotificationSettings { settings in
      DispatchQueue.main.async {
        // Check if notifications are enabled
        guard settings.authorizationStatus == .authorized else {
          reject("PERMISSION_DENIED", "Notification permissions not granted", nil)
          return
        }
        
        // Clear existing notifications
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
        
        // Set badge to 99 for testing
        UIApplication.shared.applicationIconBadgeNumber = 99
        
        // Create notification content
        let content = UNMutableNotificationContent()
        content.title = "WaniKani Test Notification"
        content.body = "This is a test! You have 42 new reviews available."
        content.badge = NSNumber(value: 142) // Will change badge to 142 when notification arrives
        content.sound = UNNotificationSound.default
        content.categoryIdentifier = "REVIEW_CATEGORY"
        content.userInfo = [
          "reviewCount": 42,
          "isTest": true
        ]
        
        // Schedule for 60 seconds from now
        let trigger = UNTimeIntervalNotificationTrigger(
          timeInterval: 60,
          repeats: false
        )
        
        let request = UNNotificationRequest(
          identifier: "test-notification",
          content: content,
          trigger: trigger
        )
        
        UNUserNotificationCenter.current().add(request) { error in
          DispatchQueue.main.async {
            if let error = error {
              reject("SCHEDULE_ERROR", error.localizedDescription, error)
            } else {
              resolve([
                "success": true,
                "badgeSet": 99,
                "notificationScheduledFor": "60 seconds from now",
                "notificationBadgeWillBe": 142
              ])
            }
          }
        }
      }
    }
  }
  
  @objc func getNotificationSettings(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    UNUserNotificationCenter.current().getNotificationSettings { settings in
      DispatchQueue.main.async {
        resolve([
          "authorizationStatus": self.authorizationStatusString(settings.authorizationStatus),
          "alertSetting": self.notificationSettingString(settings.alertSetting),
          "badgeSetting": self.notificationSettingString(settings.badgeSetting),
          "soundSetting": self.notificationSettingString(settings.soundSetting)
        ])
      }
    }
  }
  
  @objc func getPendingNotifications(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    print("🔍 Getting pending notifications...")
    UNUserNotificationCenter.current().getPendingNotificationRequests { requests in
      print("🔍 Found \(requests.count) pending notification requests")
      DispatchQueue.main.async {
        let notifications = requests.map { request in
          var triggerInfo: [String: Any] = [:]
          
          if let timeIntervalTrigger = request.trigger as? UNTimeIntervalNotificationTrigger {
            let fireDate = Date().addingTimeInterval(timeIntervalTrigger.timeInterval)
            let dateFormatter = ISO8601DateFormatter()
            dateFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            triggerInfo = [
              "type": "timeInterval",
              "timeInterval": timeIntervalTrigger.timeInterval,
              "fireDate": dateFormatter.string(from: fireDate),
              "repeats": timeIntervalTrigger.repeats
            ]
          } else if let calendarTrigger = request.trigger as? UNCalendarNotificationTrigger {
            triggerInfo = [
              "type": "calendar",
              "repeats": calendarTrigger.repeats
            ]
          }
          
          return [
            "identifier": request.identifier,
            "title": request.content.title,
            "body": request.content.body,
            "badge": request.content.badge?.intValue ?? 0,
            "trigger": triggerInfo,
            "userInfo": request.content.userInfo
          ]
        }
        
        resolve([
          "count": notifications.count,
          "notifications": notifications
        ])
      }
    }
  }
  
  private func authorizationStatusString(_ status: UNAuthorizationStatus) -> String {
    switch status {
    case .notDetermined: return "notDetermined"
    case .denied: return "denied"
    case .authorized: return "authorized"
    case .provisional: return "provisional"
    case .ephemeral: return "ephemeral"
    @unknown default: return "unknown"
    }
  }
  
  private func notificationSettingString(_ setting: UNNotificationSetting) -> String {
    switch setting {
    case .enabled: return "enabled"
    case .disabled: return "disabled"
    case .notSupported: return "notSupported"
    @unknown default: return "unknown"
    }
  }
  
  // MARK: - Widget Scheduling Methods
  
  // Update widget data using shared App Group (similar to saveWidgetData in ReviewNotificationManager)
  private func updateWidgetData(currentReviews: Int, upcomingReviews: [Int], upcomingReviewTimes: [String: Int]?) {
    let timestamp = DateFormatter.localizedString(from: Date(), dateStyle: .none, timeStyle: .medium)
    print("📱 ReviewNotificationManager.updateWidgetData called at \(timestamp) with: currentReviews=\(currentReviews)")
    NSLog("📱 ReviewNotificationManager.updateWidgetData called at %@ with: currentReviews=%d", timestamp, currentReviews)
    
    guard let sharedDefaults = UserDefaults(suiteName: "group.com.wanikani.reviewdata") else {
      print("❌ Failed to access App Group UserDefaults")
      return
    }
    
    let data: [String: Any] = [
      "currentReviews": currentReviews,
      "upcomingReviews": upcomingReviews,
      "upcomingReviewTimes": upcomingReviewTimes ?? [:],
      "lastUpdated": Date().timeIntervalSince1970
    ]
    
    sharedDefaults.set(data, forKey: "waniKaniReviewData")
    let syncSuccess = sharedDefaults.synchronize()
    print("✅ ReviewNotificationManager: Saved widget data - \(currentReviews) reviews (sync: \(syncSuccess))")
    NSLog("✅ ReviewNotificationManager: Saved widget data - %d reviews (sync: %@)", currentReviews, syncSuccess ? "success" : "failed")
    
    // Tell WidgetKit to reload widgets
    DispatchQueue.main.async {
      WidgetCenter.shared.reloadAllTimelines()
      WidgetCenter.shared.reloadTimelines(ofKind: "WaniKaniWidget")
      print("🔄 ReviewNotificationManager: Widget reload requested")
      NSLog("🔄 ReviewNotificationManager: Widget reload requested")
    }
  }
  
  // Schedule widget updates using local notifications (similar to scheduleBadgeUpdatesForUpcomingReviews in WaniKaniBackgroundFetch)
  @objc func scheduleWidgetUpdates(
    _ reviewData: [String: Any],
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let currentReviews = reviewData["currentReviews"] as? Int,
          let upcomingReviews = reviewData["upcomingReviews"] as? [Int] else {
      reject("INVALID_DATA", "Invalid review data format", nil)
      return
    }
    
    let upcomingReviewTimes = reviewData["upcomingReviewTimes"] as? [String: Int]
    
    print("🔔 ReviewNotificationManager: Scheduling widget updates for \(upcomingReviews.reduce(0, +)) upcoming reviews")
    
    // Update widget data immediately
    updateWidgetData(
      currentReviews: currentReviews,
      upcomingReviews: upcomingReviews,
      upcomingReviewTimes: upcomingReviewTimes
    )
    
    // Clear existing widget-specific notifications
    UNUserNotificationCenter.current().getPendingNotificationRequests { requests in
      let widgetNotificationIds = requests.filter { $0.identifier.hasPrefix("widget-update-") }.map { $0.identifier }
      UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: widgetNotificationIds)
      print("🗑️ ReviewNotificationManager: Removed \(widgetNotificationIds.count) existing widget notifications")
    }
    
    // Schedule new widget updates
    let startDate = Calendar.current.nextDate(after: Date(),
                                             matching: DateComponents(minute: 0, second: 0),
                                             matchingPolicy: .nextTime)!
    let startInterval = startDate.timeIntervalSinceNow
    
    var cumulativeReviews = currentReviews
    var notificationsScheduled = 0
    
    for (hour, reviews) in upcomingReviews.enumerated() {
      if reviews == 0 { continue }
      cumulativeReviews += reviews
      
      let triggerTimeInterval = startInterval + (Double(hour + 1) * 60 * 60) // +1 because upcomingReviews[0] is for next hour
      if triggerTimeInterval <= 0 { continue }
      
      let identifier = "widget-update-\(hour + 1)"
      let content = UNMutableNotificationContent()
      
      // This is a silent notification just to trigger widget update
      content.badge = NSNumber(value: cumulativeReviews)
      content.userInfo = [
        "widgetUpdate": true,
        "currentReviews": cumulativeReviews,
        "upcomingReviews": upcomingReviews,
        "scheduledUpdate": true
      ]
      
      let trigger = UNTimeIntervalNotificationTrigger(timeInterval: triggerTimeInterval, repeats: false)
      let request = UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)
      
      UNUserNotificationCenter.current().add(request) { error in
        if let error = error {
          print("❌ ReviewNotificationManager: Failed to schedule widget update for hour \(hour): \(error)")
        } else {
          let futureTime = Date(timeIntervalSinceNow: triggerTimeInterval)
          print("✅ ReviewNotificationManager: Scheduled widget update for hour \(hour) at \(DateFormatter.localizedString(from: futureTime, dateStyle: .none, timeStyle: .short)) - Reviews: \(cumulativeReviews)")
        }
      }
      
      notificationsScheduled += 1
      if notificationsScheduled >= 64 { break } // iOS limit of 64 notifications
    }
    
    resolve([
      "success": true,
      "widgetUpdatesScheduled": notificationsScheduled,
      "currentReviews": currentReviews
    ])
  }
  
  // Schedule exact widget updates using specific times (similar to scheduleExactNotifications)
  @objc func scheduleExactWidgetUpdates(
    _ reviewData: [String: Any],
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let currentReviews = reviewData["currentReviews"] as? Int,
          let upcomingReviewTimes = reviewData["upcomingReviewTimes"] as? [String: Int] else {
      reject("INVALID_DATA", "Invalid review data format", nil)
      return
    }
    
    let upcomingReviews = reviewData["upcomingReviews"] as? [Int] ?? []
    
    print("🔔 ReviewNotificationManager: Scheduling exact widget updates for \(upcomingReviewTimes.count) time slots")
    
    // Update widget data immediately
    updateWidgetData(
      currentReviews: currentReviews,
      upcomingReviews: upcomingReviews,
      upcomingReviewTimes: upcomingReviewTimes
    )
    
    // Clear existing widget-specific notifications
    UNUserNotificationCenter.current().getPendingNotificationRequests { requests in
      let widgetNotificationIds = requests.filter { $0.identifier.hasPrefix("widget-exact-") }.map { $0.identifier }
      UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: widgetNotificationIds)
      print("🗑️ ReviewNotificationManager: Removed \(widgetNotificationIds.count) existing exact widget notifications")
    }
    
    let now = Date()
    var cumulativeReviews = currentReviews
    var notificationsScheduled = 0
    
    // Sort times chronologically
    let dateFormatter = ISO8601DateFormatter()
    dateFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    
    let sortedTimes = upcomingReviewTimes.sorted { (first, second) in
      let firstDate = dateFormatter.date(from: first.key) ?? Date.distantFuture
      let secondDate = dateFormatter.date(from: second.key) ?? Date.distantFuture
      return firstDate < secondDate
    }
    
    for (timeString, reviewCount) in sortedTimes {
      guard let availableAt = dateFormatter.date(from: timeString) else {
        print("⚠️ ReviewNotificationManager: Could not parse date: \(timeString)")
        continue
      }
      
      // Skip past times
      if availableAt <= now { continue }
      
      // Skip times more than 64 hours away
      let timeInterval = availableAt.timeIntervalSinceNow
      if timeInterval > 64 * 60 * 60 { continue }
      
      // Skip if no reviews
      if reviewCount == 0 { continue }
      
      cumulativeReviews += reviewCount
      
      let identifier = "widget-exact-\(timeString)"
      let content = UNMutableNotificationContent()
      
      // This is a silent notification just to trigger widget update
      content.badge = NSNumber(value: cumulativeReviews)
      content.userInfo = [
        "widgetUpdate": true,
        "currentReviews": cumulativeReviews,
        "exactTime": true,
        "scheduledUpdate": true,
        "timeString": timeString
      ]
      
      let trigger = UNTimeIntervalNotificationTrigger(timeInterval: timeInterval, repeats: false)
      let request = UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)
      
      UNUserNotificationCenter.current().add(request) { error in
        if let error = error {
          print("❌ ReviewNotificationManager: Failed to schedule exact widget update: \(error)")
        } else {
          print("✅ ReviewNotificationManager: Scheduled exact widget update for \(availableAt) with \(cumulativeReviews) reviews")
        }
      }
      
      notificationsScheduled += 1
      if notificationsScheduled >= 64 { break }
    }
    
    resolve([
      "success": true,
      "exactWidgetUpdatesScheduled": notificationsScheduled,
      "currentReviews": currentReviews
    ])
  }
  
  // Debug method to schedule test widget updates (add 1 review in 20s, remove it in 40s)
  @objc func scheduleTestWidgetUpdates(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    print("🧪 ReviewNotificationManager: Scheduling test widget updates")
    
    // Get current review data
    guard let sharedDefaults = UserDefaults(suiteName: "group.com.wanikani.reviewdata"),
          let currentData = sharedDefaults.object(forKey: "waniKaniReviewData") as? [String: Any],
          let currentReviews = currentData["currentReviews"] as? Int else {
      // Use default values if no current data
      scheduleTestUpdatesWithCurrentReviews(0, resolve: resolve, reject: reject)
      return
    }
    
    scheduleTestUpdatesWithCurrentReviews(currentReviews, resolve: resolve, reject: reject)
  }
  
  private func scheduleTestUpdatesWithCurrentReviews(
    _ currentReviews: Int,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    // Clear existing test widget notifications
    UNUserNotificationCenter.current().getPendingNotificationRequests { requests in
      let testWidgetIds = requests.filter { $0.identifier.hasPrefix("widget-test-") }.map { $0.identifier }
      UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: testWidgetIds)
      print("🗑️ ReviewNotificationManager: Removed \(testWidgetIds.count) existing test widget notifications")
    }
    
    // Schedule first update: add 1 review in 20 seconds
    let firstUpdate = UNMutableNotificationContent()
    firstUpdate.badge = NSNumber(value: currentReviews + 1)
    firstUpdate.userInfo = [
      "widgetUpdate": true,
      "currentReviews": currentReviews + 1,
      "testUpdate": true,
      "updateType": "add"
    ]
    
    let firstTrigger = UNTimeIntervalNotificationTrigger(timeInterval: 20, repeats: false)
    let firstRequest = UNNotificationRequest(identifier: "widget-test-add", content: firstUpdate, trigger: firstTrigger)
    
    // Schedule second update: remove 1 review in 40 seconds
    let secondUpdate = UNMutableNotificationContent()
    secondUpdate.badge = NSNumber(value: currentReviews)
    secondUpdate.userInfo = [
      "widgetUpdate": true,
      "currentReviews": currentReviews,
      "testUpdate": true,
      "updateType": "remove"
    ]
    
    let secondTrigger = UNTimeIntervalNotificationTrigger(timeInterval: 40, repeats: false)
    let secondRequest = UNNotificationRequest(identifier: "widget-test-remove", content: secondUpdate, trigger: secondTrigger)
    
    // Add both notifications
    let nc = UNUserNotificationCenter.current()
    nc.add(firstRequest) { error in
      if let error = error {
        reject("SCHEDULE_ERROR", "Failed to schedule first test update: \(error.localizedDescription)", error)
        return
      }
      
      nc.add(secondRequest) { error in
        if let error = error {
          reject("SCHEDULE_ERROR", "Failed to schedule second test update: \(error.localizedDescription)", error)
          return
        }
        
        print("✅ ReviewNotificationManager: Scheduled test widget updates - +1 in 20s, -1 in 40s")
        
        resolve([
          "success": true,
          "currentReviews": currentReviews,
          "firstUpdate": "Add 1 review in 20 seconds (total: \(currentReviews + 1))",
          "secondUpdate": "Remove 1 review in 40 seconds (total: \(currentReviews))",
          "scheduledAt": Date().description
        ])
      }
    }
  }
  
  // Get pending widget notifications for debugging
  @objc func getPendingWidgetNotifications(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    UNUserNotificationCenter.current().getPendingNotificationRequests { requests in
      DispatchQueue.main.async {
        // Filter to only widget-related notifications
        let widgetNotifications = requests.filter { request in
          request.identifier.hasPrefix("widget-") ||
          (request.content.userInfo["widgetUpdate"] as? Bool) == true
        }
        
        let notifications = widgetNotifications.map { request in
          var triggerInfo: [String: Any] = [:]
          
          if let timeIntervalTrigger = request.trigger as? UNTimeIntervalNotificationTrigger {
            let fireDate = Date().addingTimeInterval(timeIntervalTrigger.timeInterval)
            let dateFormatter = ISO8601DateFormatter()
            dateFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            triggerInfo = [
              "type": "timeInterval",
              "timeInterval": timeIntervalTrigger.timeInterval,
              "fireDate": dateFormatter.string(from: fireDate),
              "repeats": timeIntervalTrigger.repeats
            ]
          }
          
          return [
            "identifier": request.identifier,
            "badge": request.content.badge?.intValue ?? 0,
            "trigger": triggerInfo,
            "userInfo": request.content.userInfo,
            "isWidgetUpdate": (request.content.userInfo["widgetUpdate"] as? Bool) == true
          ]
        }
        
        resolve([
          "count": notifications.count,
          "widgetNotifications": notifications
        ])
      }
    }
  }
}
