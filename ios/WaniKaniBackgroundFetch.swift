//
//  WaniKaniBackgroundFetch.swift
//  wanikani
//
//  Created by Pedro Ortego on 8/8/25.
//

import Foundation
import React
import WidgetKit


@objc(WaniKaniBackgroundFetch)
class WaniKaniBackgroundFetch: NSObject {
  
  private var reviewCount: Int = 0
  private var upcomingReviews: [Int] = []
  private let reviewNotificationManager = ReviewNotificationManager()

  private var storedApiToken: String? {
    KakehashiNativeAuthSession.shared.snapshot()?.apiToken
  }

  private func shouldApplyBadgeOnlyUpdate(
    authSessionSnapshot: KakehashiNativeAuthSessionSnapshot
  ) -> Bool {
    guard KakehashiNativeAuthSession.shared.isCurrent(authSessionSnapshot) else {
      return false
    }

    let defaults = UserDefaults.standard
    let badgeEnabled = defaults.object(
      forKey: "badge_notifications_enabled"
    ) as? Bool ?? true
    let alertsEnabled = defaults.object(
      forKey: "review_notifications_enabled"
    ) as? Bool ?? false
    return badgeEnabled && !alertsEnabled
  }
  
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
  
  @objc
  func storeApiToken(_ apiToken: String) {
    let normalizedApiToken = apiToken.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !normalizedApiToken.isEmpty else {
      KakehashiNativeAuthSession.shared.update(apiToken: nil)
      UserDefaults.standard.removeObject(forKey: "wanikani_api_token")
      UserDefaults(suiteName: "group.com.kakehashi.reviewdata")?
        .removeObject(forKey: "wanikani_api_token")
      return
    }

    KakehashiNativeAuthSession.shared.update(apiToken: normalizedApiToken)
    // Store API token for background fetch.
    UserDefaults.standard.set(normalizedApiToken, forKey: "wanikani_api_token")
    if let sharedDefaults = UserDefaults(suiteName: "group.com.kakehashi.reviewdata") {
      sharedDefaults.set(normalizedApiToken, forKey: "wanikani_api_token")
    }
  }
  
  @objc
  func updateNotificationSettings(_ settings: [String: Any]) {
    // Treat this dictionary as a patch so a widget-only update cannot reset
    // unrelated notification preferences.
    if let badgeEnabled = settings["badgeEnabled"] as? Bool {
      UserDefaults.standard.set(badgeEnabled, forKey: "badge_notifications_enabled")
    }
    if let alertsEnabled = settings["alertsEnabled"] as? Bool {
      UserDefaults.standard.set(alertsEnabled, forKey: "review_notifications_enabled")
    }
    if let soundsEnabled = settings["soundsEnabled"] as? Bool {
      UserDefaults.standard.set(soundsEnabled, forKey: "notification_sounds_enabled")
    }
    if let widgetRefresh = settings["widgetBackgroundRefreshEnabled"] as? Bool {
      UserDefaults.standard.set(widgetRefresh, forKey: "widget_background_refresh_enabled")
    }
  }
  
  @objc
  func performBackgroundFetch(completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
    // Log when background fetch is triggered
    let timestamp = DateFormatter.localizedString(from: Date(), dateStyle: .short, timeStyle: .medium)
    print("🔄 Background Fetch triggered at \(timestamp)")
    NSLog("🔄 Background Fetch triggered at %@", timestamp)
    
    // Check notification permissions first
    UNUserNotificationCenter.current().getNotificationSettings { settings in
      print("📱 Background Fetch: Badge permission: \(settings.badgeSetting.rawValue)")
    }
    
    guard let authSessionSnapshot = KakehashiNativeAuthSession.shared.snapshot() else {
      print("❌ Background Fetch: No API token")
      completionHandler(.noData)
      return
    }
    let apiToken = authSessionSnapshot.apiToken
    
    fetchReviewData(apiToken: apiToken) { [weak self] result in
      guard KakehashiNativeAuthSession.shared.isCurrent(authSessionSnapshot) else {
        print("⏭️ Background Fetch: Account changed before fetch completed")
        completionHandler(.noData)
        return
      }

      switch result {
      case .success(let data):
        let oldCount = self?.reviewCount ?? 0
        self?.reviewCount = data.reviewCount
        self?.upcomingReviews = data.upcomingReviews
        
        print("✅ Background Fetch: Old count: \(oldCount), New count: \(data.reviewCount)")
        
        // Get notification settings from UserDefaults with appropriate defaults
        let badgeEnabled = UserDefaults.standard.object(forKey: "badge_notifications_enabled") as? Bool ?? true
        let alertsEnabled = UserDefaults.standard.object(forKey: "review_notifications_enabled") as? Bool ?? false
        let soundsEnabled = UserDefaults.standard.object(forKey: "notification_sounds_enabled") as? Bool ?? true
        let widgetRefreshEnabled = UserDefaults.standard.object(forKey: "widget_background_refresh_enabled") as? Bool ?? true
        
        // Use ReviewNotificationManager to update badge and schedule notifications
        let reviewData: [String: Any] = [
          "currentReviews": data.reviewCount,
          "upcomingReviews": data.upcomingReviews,
          "settings": [
            "badgeEnabled": badgeEnabled,
            "alertsEnabled": alertsEnabled,
            "soundsEnabled": soundsEnabled,
            "widgetBackgroundRefreshEnabled": widgetRefreshEnabled
          ]
        ]
        
        print("📱 Background Fetch: Badge enabled: \(badgeEnabled), current reviews: \(data.reviewCount)")
        
        // Update badge directly during background fetch
        if badgeEnabled {
          // Create a background task to ensure badge update completes
          var backgroundTask: UIBackgroundTaskIdentifier = .invalid
          backgroundTask = UIApplication.shared.beginBackgroundTask {
            UIApplication.shared.endBackgroundTask(backgroundTask)
            backgroundTask = .invalid
          }
          
          DispatchQueue.main.async {
            let latestBadgeEnabled = UserDefaults.standard.object(
              forKey: "badge_notifications_enabled"
            ) as? Bool ?? true
            guard latestBadgeEnabled,
                  KakehashiNativeAuthSession.shared.isCurrent(authSessionSnapshot) else {
              if backgroundTask != .invalid {
                UIApplication.shared.endBackgroundTask(backgroundTask)
                backgroundTask = .invalid
              }
              return
            }
            UIApplication.shared.applicationIconBadgeNumber = data.reviewCount
            print("✅ Background Fetch: Badge updated to \(data.reviewCount)")

            // End background task
            if backgroundTask != .invalid {
              UIApplication.shared.endBackgroundTask(backgroundTask)
              backgroundTask = .invalid
            }
          }
        }
        
        // Schedule badge updates for upcoming reviews
        print("📊 Background Fetch: upcomingReviews array: \(data.upcomingReviews)")
        print("📊 Background Fetch: upcomingReviews count: \(data.upcomingReviews.count)")
        print("📊 Background Fetch: badgeEnabled: \(badgeEnabled)")
        
        if badgeEnabled && !alertsEnabled && data.upcomingReviews.count > 0 {
          print("📅 Background Fetch: Starting to schedule badge updates...")
          self?.scheduleBadgeUpdatesForUpcomingReviews(
            currentReviews: data.reviewCount,
            upcomingReviews: data.upcomingReviews,
            authSessionSnapshot: authSessionSnapshot
          )
        } else {
          print("❌ Background Fetch: NOT scheduling - badgeEnabled: \(badgeEnabled), count: \(data.upcomingReviews.count)")
        }
        
        // Also try to schedule full notifications if alerts are enabled
        if alertsEnabled {
          DispatchQueue.main.async {
            guard KakehashiNativeAuthSession.shared.isCurrent(authSessionSnapshot) else {
              return
            }
            self?.reviewNotificationManager.updateBadgeAndScheduleNotifications(
              reviewData,
              resolver: { result in
                print("✅ Background Fetch: ReviewNotificationManager completed with result: \(result)")
              },
              rejecter: { code, message, error in
                print("❌ Background Fetch: ReviewNotificationManager failed: \(code ?? "unknown") - \(message ?? "no message")")
              }
            )
          }
        }
        
        // Store last fetch time
        UserDefaults.standard.set(Date(), forKey: "last_background_fetch_time")
        
        // Wait for badge update to complete, then update widget and finish
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
          guard KakehashiNativeAuthSession.shared.isCurrent(authSessionSnapshot) else {
            completionHandler(.noData)
            return
          }
          if widgetRefreshEnabled {
            // Update widget with new review data on main queue
            print("🔍 About to update widget with: currentReviews=\(data.reviewCount), upcomingReviews=\(data.upcomingReviews.reduce(0, +))")
            NSLog("🔍 About to update widget with: currentReviews=%d, upcomingReviews=%d", data.reviewCount, data.upcomingReviews.reduce(0, +))

            self?.updateWidgetData(
              currentReviews: data.reviewCount,
              upcomingReviews: data.upcomingReviews,
              upcomingReviewTimes: nil // Will be populated later if needed
            )
          } else {
            print("⏭️ Background Fetch: Widget refresh disabled by user setting")
          }
          
          // Wait a bit more for widget update to complete
          DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            let result: UIBackgroundFetchResult = oldCount != data.reviewCount ? .newData : .noData
            print("🏁 Background Fetch completed with result: \(result == .newData ? "newData" : "noData")")
            print("📱 Final badge value: \(UIApplication.shared.applicationIconBadgeNumber)")
            completionHandler(result)
          }
        }
      case .failure(let error):
        print("❌ Background Fetch failed: \(error.localizedDescription)")
        completionHandler(.failed)
      }
    }
  }
  
  private func fetchReviewData(apiToken: String, completion: @escaping (Result<(reviewCount: Int, upcomingReviews: [Int]), Error>) -> Void) {
    // Fetch all assignments with pagination (same as React Native app)
    fetchAllAssignments(apiToken: apiToken) { result in
      switch result {
      case .success(let allAssignments):
        print("📊 [DEBUG] Fetched total \(allAssignments.count) assignments from API (with pagination)")
        
        var reviewCount = 0
        var upcomingReviews: [Int] = Array(repeating: 0, count: 64)
        let now = Date()
        
        // Log current time for debugging
        let dateFormatter = ISO8601DateFormatter()
        dateFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let fallbackDateFormatter = ISO8601DateFormatter()
        fallbackDateFormatter.formatOptions = [.withInternetDateTime]
        print("📊 [DEBUG] Current time: \(dateFormatter.string(from: now))")
        
        // Process assignments like the React Native app does
        var totalProcessed = 0
        var startedCount = 0
        var reviewStageCount = 0
        var notHiddenCount = 0
        var hasAvailableAtCount = 0
        var dateParsedCount = 0
        var availableNowCount = 0
        var upcomingCount = 0
        
        for assignment in allAssignments {
          totalProcessed += 1
          guard let assignmentData = assignment["data"] as? [String: Any] else { continue }
          
          // Check if this assignment represents a review
          let startedAt = assignmentData["started_at"] as? String
          let availableAtString = assignmentData["available_at"] as? String
          let hidden = assignmentData["hidden"] as? Bool ?? false
          let srsStage = (assignmentData["srs_stage"] as? NSNumber)?.intValue
          
          // Log first few assignments for debugging
          if totalProcessed <= 3 {
            print("📊 [DEBUG] Assignment \(totalProcessed): started_at=\(startedAt ?? "nil"), srs_stage=\(srsStage.map(String.init) ?? "nil"), hidden=\(hidden), available_at=\(availableAtString ?? "nil")")
          }
          
          // Track filtering steps
          if startedAt != nil { startedCount += 1 }
          if !hidden { notHiddenCount += 1 }
          if srsStage == nil || srsStage! < 9 { reviewStageCount += 1 }
          if availableAtString != nil { hasAvailableAtCount += 1 }
          
          // Must be started, visible, in a reviewable SRS stage, and have available_at.
          // Note: burned_at can remain set after resurrection, so use current srs_stage.
          guard startedAt != nil && !hidden && (srsStage == nil || srsStage! < 9) && availableAtString != nil else { continue }
          
          guard let availableAt =
              dateFormatter.date(from: availableAtString!) ??
              fallbackDateFormatter.date(from: availableAtString!)
          else {
            print("📊 [DEBUG] Failed to parse date: \(availableAtString!)")
            continue 
          }
          dateParsedCount += 1
          
          // Check if the review is available now (current reviews)
          if availableAt <= now {
            reviewCount += 1
            availableNowCount += 1
            if availableNowCount <= 3 {
              print("📊 [DEBUG] Found available review \(availableNowCount): available_at=\(availableAtString!), parsed_date=\(availableAt)")
            }
          } else {
            // Calculate upcoming reviews for next 64 hours
            let hoursFromNow = Int(availableAt.timeIntervalSince(now) / 3600)
            if hoursFromNow >= 0 && hoursFromNow < 64 {
              upcomingReviews[hoursFromNow] += 1
              upcomingCount += 1
              if upcomingCount <= 3 {
                print("📊 [DEBUG] Found upcoming review \(upcomingCount): hours_from_now=\(hoursFromNow), available_at=\(availableAtString!)")
              }
            }
          }
        }
        
        print("📊 [DEBUG] Filtering results:")
        print("📊 [DEBUG] - Total assignments processed: \(totalProcessed)")
        print("📊 [DEBUG] - Has started_at: \(startedCount)")  
        print("📊 [DEBUG] - Not hidden: \(notHiddenCount)")
        print("📊 [DEBUG] - Review stage (srs_stage < 9): \(reviewStageCount)")
        print("📊 [DEBUG] - Has available_at: \(hasAvailableAtCount)")
        print("📊 [DEBUG] - Date parsed successfully: \(dateParsedCount)")
        print("📊 [DEBUG] - Available now: \(availableNowCount)")
        print("📊 [DEBUG] - Upcoming (next 64h): \(upcomingCount)")
        
        print("📊 [DEBUG] Processed assignments: \(reviewCount) current reviews")
        print("📊 [DEBUG] Calculated upcoming reviews by hour: \(upcomingReviews)")
        
        completion(.success((reviewCount: reviewCount, upcomingReviews: upcomingReviews)))
        
      case .failure(let error):
        completion(.failure(error))
      }
    }
  }
  
  // Helper method to fetch all assignments with pagination
  private func fetchAllAssignments(apiToken: String, completion: @escaping (Result<[[String: Any]], Error>) -> Void) {
    var allAssignments: [[String: Any]] = []
    
    func fetchPage(url: String) {
      guard let requestUrl = URL(string: url) else {
        completion(.failure(NSError(domain: "WaniKani", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid URL: \(url)"])))
        return
      }
      
      var request = URLRequest(url: requestUrl)
      request.setValue("Bearer \(apiToken)", forHTTPHeaderField: "Authorization")
      request.setValue("Wanikani-React-Native", forHTTPHeaderField: "User-Agent")
      
      URLSession.shared.dataTask(with: request) { data, response, error in
        if let error = error {
          completion(.failure(error))
          return
        }
        
        guard let data = data else {
          completion(.failure(NSError(domain: "WaniKani", code: 2, userInfo: [NSLocalizedDescriptionKey: "No data received"])))
          return
        }
        
        do {
          guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                let assignmentsData = json["data"] as? [[String: Any]] else {
            completion(.failure(NSError(domain: "WaniKani", code: 3, userInfo: [NSLocalizedDescriptionKey: "Invalid JSON structure"])))
            return
          }
          
          // Add this page's assignments to our collection
          allAssignments.append(contentsOf: assignmentsData)
          print("📊 [DEBUG] Fetched page with \(assignmentsData.count) assignments (total so far: \(allAssignments.count))")
          
          // Check if there's a next page
          if let pages = json["pages"] as? [String: Any],
             let nextUrl = pages["next_url"] as? String {
            // Fetch the next page
            fetchPage(url: nextUrl)
          } else {
            // No more pages, return all assignments
            print("📊 [DEBUG] Pagination complete: \(allAssignments.count) total assignments")
            completion(.success(allAssignments))
          }
          
        } catch {
          completion(.failure(error))
        }
      }.resume()
    }
    
    // Start with the first page
    fetchPage(url: "https://api.wanikani.com/v2/assignments")
  }
  
  // Schedule badge-only updates for upcoming reviews
  private func scheduleBadgeUpdatesForUpcomingReviews(
    currentReviews: Int,
    upcomingReviews: [Int],
    authSessionSnapshot: KakehashiNativeAuthSessionSnapshot
  ) {
    print("📅 [DEBUG] scheduleBadgeUpdatesForUpcomingReviews called with:")
    print("📅 [DEBUG] - currentReviews: \(currentReviews)")
    print("📅 [DEBUG] - upcomingReviews: \(upcomingReviews)")
    print("📅 [DEBUG] - upcomingReviews.count: \(upcomingReviews.count)")
    
    UNUserNotificationCenter.current().getNotificationSettings { settings in
      guard self.shouldApplyBadgeOnlyUpdate(
        authSessionSnapshot: authSessionSnapshot
      ) else {
        return
      }
      print("📅 [DEBUG] Got notification settings - badge: \(settings.badgeSetting.rawValue)")
      DispatchQueue.main.async {
        // Only proceed if badge permissions are granted
        guard settings.badgeSetting == .enabled else {
          print("❌ [DEBUG] Badge notifications not permitted - badgeSetting: \(settings.badgeSetting.rawValue)")
          return
        }
        
        print("✅ [DEBUG] Badge notifications permitted, proceeding...")
        
        // Clear existing badge/review notifications so stale badge values do not
        // override newly calculated counts while the app is backgrounded.
        UNUserNotificationCenter.current().getPendingNotificationRequests { requests in
          guard self.shouldApplyBadgeOnlyUpdate(
            authSessionSnapshot: authSessionSnapshot
          ) else {
            return
          }
          let badgeOnlyRequests = requests.filter {
            $0.identifier.hasPrefix("badge-update-") ||
            $0.identifier.hasPrefix("review-")
          }
          let identifiersToRemove = badgeOnlyRequests.map { $0.identifier }
          UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: identifiersToRemove)
          print("🗑️ [DEBUG] Removed \(identifiersToRemove.count) existing badge/review notifications")
          DispatchQueue.main.async {
            guard self.shouldApplyBadgeOnlyUpdate(
              authSessionSnapshot: authSessionSnapshot
            ) else {
              return
            }
            // Schedule the replacement requests only after removing the old IDs.
            let startDate = Calendar.current.nextDate(
              after: Date(),
              matching: DateComponents(minute: 0, second: 0),
              matchingPolicy: .nextTime
            ) ?? Date().addingTimeInterval(3600)
            let startInterval = startDate.timeIntervalSinceNow
            print("📅 [DEBUG] Start date: \(startDate), interval: \(startInterval)")

            var cumulativeReviews = currentReviews
            var notificationsScheduled = 0

            print("📅 [DEBUG] Starting to iterate through upcomingReviews array...")
            for (hour, reviews) in upcomingReviews.enumerated() {
              guard self.shouldApplyBadgeOnlyUpdate(
                authSessionSnapshot: authSessionSnapshot
              ) else {
                return
              }
              print("📅 [DEBUG] Hour \(hour): \(reviews) reviews")
              if reviews == 0 {
                print("📅 [DEBUG] Skipping hour \(hour) - 0 reviews")
                continue
              }
              cumulativeReviews += reviews
              print("📅 [DEBUG] Hour \(hour): cumulative reviews now \(cumulativeReviews)")

              let triggerTimeInterval = startInterval + (Double(hour) * 60 * 60)
              print("📅 [DEBUG] Hour \(hour): triggerTimeInterval = \(triggerTimeInterval)")
              if triggerTimeInterval <= 0 {
                print("📅 [DEBUG] Skipping hour \(hour) - triggerTimeInterval <= 0")
                continue
              }

              let identifier = "badge-update-\(hour)"
              let content = UNMutableNotificationContent()

              // These requests only advance the badge. ReviewNotificationManager
              // exclusively owns the visible, grouped review alerts.
              content.badge = NSNumber(value: cumulativeReviews)
              content.userInfo = [
                kakehashiReviewNotificationMarkerKey: true,
                kakehashiReviewAlertMarkerKey: false,
                "reviewCount": cumulativeReviews,
              ]
              print("📅 [DEBUG] Hour \(hour): Creating notification with badge \(cumulativeReviews)")

              let trigger = UNTimeIntervalNotificationTrigger(timeInterval: triggerTimeInterval, repeats: false)
              let request = UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)

              print("📅 [DEBUG] Hour \(hour): About to add notification request...")
              UNUserNotificationCenter.current().add(request) { error in
                if let error = error {
                  print("❌ [DEBUG] Failed to schedule badge update notification for hour \(hour): \(error)")
                } else {
                  let futureTime = Date(timeIntervalSinceNow: triggerTimeInterval)
                  print("✅ [DEBUG] Successfully scheduled badge update for hour \(hour) at \(DateFormatter.localizedString(from: futureTime, dateStyle: .none, timeStyle: .short)) - Badge: \(cumulativeReviews)")
                }
              }

              notificationsScheduled += 1
              print("📅 [DEBUG] Hour \(hour): notificationsScheduled now \(notificationsScheduled)")
              if notificationsScheduled >= 64 { // iOS limit of 64 notifications
                print("📅 [DEBUG] Reached limit of 64 notifications, breaking")
                break
              }
            }

            print("📅 [DEBUG] Final result: Scheduled \(notificationsScheduled) badge update notifications")
          }
        }
      }
    }
  }
  
  // Debug method to check background fetch status
  @objc
  func getBackgroundFetchStatus() -> [String: Any] {
    let lastFetchTime = UserDefaults.standard.object(forKey: "last_background_fetch_time") as? Date
    let timeSinceLastFetch: String
    
    if let lastFetch = lastFetchTime {
      let interval = Date().timeIntervalSince(lastFetch)
      let hours = Int(interval / 3600)
      let minutes = Int((interval.truncatingRemainder(dividingBy: 3600)) / 60)
      timeSinceLastFetch = "\(hours)h \(minutes)m ago"
    } else {
      timeSinceLastFetch = "Never"
    }
    
    return [
      "lastFetchTime": lastFetchTime?.description ?? "Never",
      "timeSinceLastFetch": timeSinceLastFetch,
      "currentReviewCount": reviewCount,
      "hasApiToken": storedApiToken != nil,
      "badgeEnabled": UserDefaults.standard.object(forKey: "badge_notifications_enabled") as? Bool ?? true
    ]
  }
  
  // Debug method to manually trigger background fetch
  @objc
  func triggerBackgroundFetchManually(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    print("🚀 Manually triggering background fetch...")
    performBackgroundFetch { result in
      let resultString = result == .newData ? "newData" : (result == .noData ? "noData" : "failed")
      resolver([
        "result": resultString,
        "reviewCount": self.reviewCount,
        "timestamp": Date().description
      ])
    }
  }

  private func integerValue(_ value: Any?) -> Int? {
    if let value = value as? Int {
      return value
    }
    return (value as? NSNumber)?.intValue
  }

  private func reviewIllustrationBucket(for reviewCount: Int) -> Int {
    if reviewCount <= 25 { return 0 }
    if reviewCount <= 100 { return 1 }
    if reviewCount <= 250 { return 2 }
    return 3
  }

  private func reviewIllustrationAspectRatio(for reviewCount: Int) -> Double {
    switch reviewIllustrationBucket(for: reviewCount) {
    case 0: return 680.0 / 453.0
    case 1: return 680.0 / 362.0
    case 2: return 680.0 / 456.0
    default: return 680.0 / 443.0
    }
  }

  private let reviewIllustrationKeys = ["low", "mid", "high", "veryHigh"]
  private let reviewIllustrationVersion = "v6"
  private let maxWidgetTimelineEntries = 60
  private let maxWidgetReviewTimelineHours = 24

  private func reviewIllustrationUrisFromSharedContainer() -> [Int: String] {
    guard let containerURL = FileManager.default.containerURL(
      forSecurityApplicationGroupIdentifier: kakehashiAppGroupIdentifier
    ) else {
      return [:]
    }

    let illustrationsDirectory = containerURL
      .appendingPathComponent("widgets", isDirectory: true)
      .appendingPathComponent("review-illustrations", isDirectory: true)
    var result: [Int: String] = [:]

    for (bucket, key) in reviewIllustrationKeys.enumerated() {
      let illustrationURL = illustrationsDirectory.appendingPathComponent(
        "\(key)-\(reviewIllustrationVersion).png",
        isDirectory: false
      )
      if FileManager.default.fileExists(atPath: illustrationURL.path) {
        result[bucket] = illustrationURL.absoluteString
      }
    }

    return result
  }

  private func defaultExpoWidgetProps() -> [String: Any] {
    return [
      "contentMode": "reviews",
      "timelineAnchor": false,
      "updatedAtLabel": "",
      "reviewsCountValue": 0,
      "reviewsPrimaryLabel": "0 available",
      "reviewsSecondaryLabel": "No upcoming reviews",
      "reviewsTertiaryLabel": "0 total today",
      "reviewsImageUri": "",
      "reviewIllustrationUris": [:],
      "reviewsImageAspectRatio": 680.0 / 453.0,
      "reviewsIconUri": "",
      "criticalPrimaryLabel": "0 critical items",
      "criticalSecondaryLabel": "No critical items right now",
      "criticalTertiaryLabel": "0 recent mistakes",
      "streakPrimaryLabel": "0",
      "streakSecondaryLabel": "Best 0",
      "streakTertiaryLabel": "Freeze in 7d",
      "streakGradientColors": ["#FF7A18", "#FF5A3D", "#FF3F6C"],
      "streakRecentDays": [],
      "streakIconUris": [:],
    ]
  }

  private func updateExpoWidgetTimeline(
    sharedDefaults: UserDefaults,
    currentReviews: Int,
    upcomingReviews: [Int]
  ) -> Bool {
    let timelineKey = "__expo_widgets_KakehashiHomeWidget_timeline"
    let now = Date()
    let nowTimestamp = Int(now.timeIntervalSince1970 * 1000)
    let existingTimeline = sharedDefaults.array(forKey: timelineKey) as? [[String: Any]] ?? []
    let existingEntries = existingTimeline.compactMap { entry -> (timestamp: Int, props: [String: Any])? in
      guard let timestamp = integerValue(entry["timestamp"]),
            let props = entry["props"] as? [String: Any] else {
        return nil
      }
      return (timestamp, props)
    }.sorted { $0.timestamp < $1.timestamp }

    let nextHour = Calendar.current.nextDate(
      after: now,
      matching: DateComponents(minute: 0, second: 0),
      matchingPolicy: .nextTime
    ) ?? now.addingTimeInterval(3600)
    let reviewBuckets = upcomingReviews.prefix(maxWidgetReviewTimelineHours).enumerated().compactMap { offset, rawCount -> (timestamp: Int, count: Int)? in
      let count = max(0, rawCount)
      guard count > 0 else { return nil }
      let date = nextHour.addingTimeInterval(Double(offset) * 3600)
      return (Int(date.timeIntervalSince1970 * 1000), count)
    }

    // New JS timelines mark midnight/theme entries. Keep those long-range
    // anchors before filling the remaining slots with fresh review buckets.
    // For a legacy timeline without markers, retain every future entry once.
    let hasTimelineAnchorMetadata = existingEntries.contains {
      $0.props["timelineAnchor"] != nil
    }
    let futureTimestampsToRetain = Set(
      existingEntries
        .filter {
          $0.timestamp > nowTimestamp &&
          (!hasTimelineAnchorMetadata || ($0.props["timelineAnchor"] as? Bool) == true)
        }
        .map(\.timestamp)
    )

    var timelineTimestamps = Set<Int>()
    timelineTimestamps.insert(nowTimestamp)
    for timestamp in futureTimestampsToRetain.sorted() {
      guard timelineTimestamps.count < maxWidgetTimelineEntries else { break }
      timelineTimestamps.insert(timestamp)
    }
    for bucket in reviewBuckets {
      if timelineTimestamps.contains(bucket.timestamp) {
        continue
      }
      guard timelineTimestamps.count < maxWidgetTimelineEntries else { break }
      timelineTimestamps.insert(bucket.timestamp)
    }

    var imageUrisByBucket = reviewIllustrationUrisFromSharedContainer()
    for entry in existingEntries {
      guard let storedUris = entry.props["reviewIllustrationUris"] as? [String: Any] else {
        continue
      }
      for (bucket, key) in reviewIllustrationKeys.enumerated() {
        if let uri = storedUris[key] as? String, !uri.isEmpty {
          imageUrisByBucket[bucket] = uri
        }
      }
    }
    existingEntries.forEach { entry in
      guard let count = integerValue(entry.props["reviewsCountValue"]),
            let uri = entry.props["reviewsImageUri"] as? String,
            !uri.isEmpty else {
        return
      }
      let bucket = reviewIllustrationBucket(for: count)
      if imageUrisByBucket[bucket] == nil {
        imageUrisByBucket[bucket] = uri
      }
    }

    var storedImageUris: [String: String] = [:]
    for (bucket, key) in reviewIllustrationKeys.enumerated() {
      if let uri = imageUrisByBucket[bucket] {
        storedImageUris[key] = uri
      }
    }

    let timeFormatter = DateFormatter()
    timeFormatter.locale = Locale(identifier: "en_US_POSIX")
    timeFormatter.dateFormat = "HH:mm"

    let updatedTimeline = timelineTimestamps.sorted().map { timestamp -> [String: Any] in
      let templateProps = existingEntries.last(where: { $0.timestamp <= timestamp })?.props
        ?? existingEntries.first?.props
        ?? defaultExpoWidgetProps()
      var props = templateProps
      let gainedReviews = reviewBuckets
        .filter { $0.timestamp <= timestamp }
        .reduce(0) { $0 + $1.count }
      let projectedReviewCount = max(0, currentReviews) + gainedReviews
      let nextReviewBucket = reviewBuckets.first(where: { $0.timestamp > timestamp })
      let referenceDate = Date(
        timeIntervalSince1970: Double(timestamp) / 1000
      )
      let scheduledForReferenceDay = reviewBuckets
        .filter { bucket in
          let bucketDate = Date(
            timeIntervalSince1970: Double(bucket.timestamp) / 1000
          )
          return Calendar.current.isDate(bucketDate, inSameDayAs: referenceDate)
        }
        .reduce(0) { $0 + $1.count }
      let projectedTodayTotal = max(
        projectedReviewCount,
        scheduledForReferenceDay
      )

      props["timelineAnchor"] = futureTimestampsToRetain.contains(timestamp)
      props["updatedAtLabel"] = timeFormatter.string(
        from: referenceDate
      )
      props["reviewsCountValue"] = projectedReviewCount
      props["reviewsPrimaryLabel"] = "\(projectedReviewCount) available"
      if let nextReviewBucket {
        let nextReviewDate = Date(
          timeIntervalSince1970: Double(nextReviewBucket.timestamp) / 1000
        )
        props["reviewsSecondaryLabel"] = "+\(nextReviewBucket.count) at \(timeFormatter.string(from: nextReviewDate))"
      } else {
        props["reviewsSecondaryLabel"] = "No upcoming reviews"
      }
      props["reviewsTertiaryLabel"] = "\(projectedTodayTotal) total today"
      props["reviewsImageAspectRatio"] = reviewIllustrationAspectRatio(
        for: projectedReviewCount
      )
      props["reviewIllustrationUris"] = storedImageUris
      if let matchingImageUri = imageUrisByBucket[
        reviewIllustrationBucket(for: projectedReviewCount)
      ] {
        props["reviewsImageUri"] = matchingImageUri
      }

      return [
        "timestamp": timestamp,
        "props": props,
      ]
    }

    sharedDefaults.set(updatedTimeline, forKey: timelineKey)
    return sharedDefaults.synchronize()
  }
  
  // Update widget data using shared App Group
  private func updateWidgetData(currentReviews: Int, upcomingReviews: [Int], upcomingReviewTimes: [String: Int]?) {
    let timestamp = DateFormatter.localizedString(from: Date(), dateStyle: .none, timeStyle: .medium)
    print("📱 updateWidgetData called at \(timestamp) with: currentReviews=\(currentReviews), upcoming=\(upcomingReviews.reduce(0, +))")
    NSLog("📱 updateWidgetData called at %@ with: currentReviews=%d, upcoming=%d", timestamp, currentReviews, upcomingReviews.reduce(0, +))
    
    _ = saveKakehashiReviewSnapshot(
      currentReviews: currentReviews,
      upcomingReviews: upcomingReviews,
      upcomingReviewTimes: upcomingReviewTimes,
      logPrefix: "Background Fetch"
    )

    guard let sharedDefaults = UserDefaults(suiteName: kakehashiAppGroupIdentifier) else {
      print("❌ Failed to access App Group UserDefaults")
      return
    }

    let timelineSyncSuccess = updateExpoWidgetTimeline(
      sharedDefaults: sharedDefaults,
      currentReviews: currentReviews,
      upcomingReviews: upcomingReviews
    )
    print("✅ Updated Expo widget timeline (sync: \(timelineSyncSuccess))")
    NSLog("✅ Updated Expo widget timeline (sync: %@)", timelineSyncSuccess ? "success" : "failed")

    // Reload the timeline that the Expo widget provider actually reads.
    DispatchQueue.main.async {
      WidgetCenter.shared.reloadTimelines(ofKind: kakehashiHomeWidgetKind)
      print("✅ Kakehashi widget timeline reloaded")
      NSLog("✅ Kakehashi widget timeline reloaded")
    }
  }
}
