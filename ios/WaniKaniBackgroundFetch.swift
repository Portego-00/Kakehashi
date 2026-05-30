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
  private var lastApiToken: String?
  private let reviewNotificationManager = ReviewNotificationManager()
  
  override init() {
    super.init()
    
    // Listen for review update triggers
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleReviewUpdateTrigger),
      name: Notification.Name("TriggerReviewUpdate"),
      object: nil
    )
  }
  
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
  
  @objc
	  func storeApiToken(_ apiToken: String) {
	    self.lastApiToken = apiToken
	    // Store API token for background fetch
	    UserDefaults.standard.set(apiToken, forKey: kakehashiStoredAPITokenKey)
	  }
  
  @objc
  func updateNotificationSettings(_ settings: [String: Any]) {
    // Store settings for background fetch
    UserDefaults.standard.set(settings["badgeEnabled"] as? Bool ?? true, forKey: "badge_notifications_enabled")
    UserDefaults.standard.set(settings["alertsEnabled"] as? Bool ?? false, forKey: "review_notifications_enabled")
    UserDefaults.standard.set(settings["soundsEnabled"] as? Bool ?? true, forKey: "notification_sounds_enabled")
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
    
    guard let apiToken = self.lastApiToken ?? UserDefaults.standard.string(forKey: kakehashiStoredAPITokenKey) else {
      print("❌ Background Fetch: No API token")
      completionHandler(.noData)
      return
    }

    if UserDefaults.standard.bool(forKey: kakehashiVacationModeKey) {
      print("🏖️ Background Fetch: Vacation mode is active; clearing review badge and watch snapshot")
      DispatchQueue.main.async {
        UIApplication.shared.applicationIconBadgeNumber = 0
        UNUserNotificationCenter.current().getPendingNotificationRequests { requests in
          let identifiersToRemove = requests
            .filter {
              $0.identifier.hasPrefix("badge-update-") ||
              $0.identifier.hasPrefix("review-")
            }
            .map { $0.identifier }
          UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: identifiersToRemove)
        }

        self.updateWidgetData(
          currentReviews: 0,
          upcomingReviews: Array(repeating: 0, count: 24),
          upcomingReviewTimes: nil,
          isOnVacation: true,
          vacationStartedAt: UserDefaults.standard.string(forKey: kakehashiVacationStartedAtKey)
        )
        completionHandler(.noData)
      }
      return
    }
    
    fetchReviewData(apiToken: apiToken) { [weak self] result in
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
        
        // Use ReviewNotificationManager to update badge and schedule notifications
        let reviewData: [String: Any] = [
          "currentReviews": data.reviewCount,
          "upcomingReviews": data.upcomingReviews,
          "settings": [
            "badgeEnabled": badgeEnabled,
            "alertsEnabled": alertsEnabled,
            "soundsEnabled": soundsEnabled
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
        
        if badgeEnabled && data.upcomingReviews.count > 0 {
          print("📅 Background Fetch: Starting to schedule badge updates...")
          self?.scheduleBadgeUpdatesForUpcomingReviews(
            currentReviews: data.reviewCount,
            upcomingReviews: data.upcomingReviews,
            alertsEnabled: alertsEnabled,
            soundsEnabled: soundsEnabled
          )
        } else {
          print("❌ Background Fetch: NOT scheduling - badgeEnabled: \(badgeEnabled), count: \(data.upcomingReviews.count)")
        }
        
        // Also try to schedule full notifications if alerts are enabled
        if alertsEnabled {
          DispatchQueue.main.async {
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
          // Update widget with new review data on main queue
          print("🔍 About to update widget with: currentReviews=\(data.reviewCount), upcomingReviews=\(data.upcomingReviews.reduce(0, +))")
          NSLog("🔍 About to update widget with: currentReviews=%d, upcomingReviews=%d", data.reviewCount, data.upcomingReviews.reduce(0, +))
          
          self?.updateWidgetData(
            currentReviews: data.reviewCount,
            upcomingReviews: data.upcomingReviews,
            upcomingReviewTimes: nil // Will be populated later if needed
          )
          
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
  
  @objc
  private func handleReviewUpdateTrigger() {
    guard let apiToken = self.lastApiToken ?? UserDefaults.standard.string(forKey: kakehashiStoredAPITokenKey) else {
      return
    }
    
    // Perform a background fetch when triggered
    performBackgroundFetch { _ in }
  }
  
  // Schedule badge-only updates for upcoming reviews
  private func scheduleBadgeUpdatesForUpcomingReviews(currentReviews: Int, upcomingReviews: [Int], alertsEnabled: Bool, soundsEnabled: Bool) {
    print("📅 [DEBUG] scheduleBadgeUpdatesForUpcomingReviews called with:")
    print("📅 [DEBUG] - currentReviews: \(currentReviews)")
    print("📅 [DEBUG] - upcomingReviews: \(upcomingReviews)")
    print("📅 [DEBUG] - upcomingReviews.count: \(upcomingReviews.count)")
    print("📅 [DEBUG] - alertsEnabled: \(alertsEnabled)")
    print("📅 [DEBUG] - soundsEnabled: \(soundsEnabled)")
    
    UNUserNotificationCenter.current().getNotificationSettings { settings in
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
          let badgeOnlyRequests = requests.filter {
            $0.identifier.hasPrefix("badge-update-") ||
            $0.identifier.hasPrefix("review-")
          }
          let identifiersToRemove = badgeOnlyRequests.map { $0.identifier }
          UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: identifiersToRemove)
          print("🗑️ [DEBUG] Removed \(identifiersToRemove.count) existing badge/review notifications")
        }
        
        // Schedule new badge updates
        let startDate = Calendar.current.nextDate(after: Date(),
                                                 matching: DateComponents(minute: 0, second: 0),
                                                 matchingPolicy: .nextTime)!
        let startInterval = startDate.timeIntervalSinceNow
        print("📅 [DEBUG] Start date: \(startDate), interval: \(startInterval)")
        
        var cumulativeReviews = currentReviews
        var notificationsScheduled = 0
        
        print("📅 [DEBUG] Starting to iterate through upcomingReviews array...")
        for (hour, reviews) in upcomingReviews.enumerated() {
          print("📅 [DEBUG] Hour \(hour): \(reviews) reviews")
          if reviews == 0 {
            print("📅 [DEBUG] Skipping hour \(hour) - 0 reviews")
            continue
          }
          cumulativeReviews += reviews
          print("📅 [DEBUG] Hour \(hour): cumulative reviews now \(cumulativeReviews)")
          
          let triggerTimeInterval = startInterval + (Double(hour + 1) * 60 * 60) // +1 because upcomingReviews[0] is for next hour
          print("📅 [DEBUG] Hour \(hour): triggerTimeInterval = \(triggerTimeInterval)")
          if triggerTimeInterval <= 0 {
            print("📅 [DEBUG] Skipping hour \(hour) - triggerTimeInterval <= 0")
            continue
          }
          
          let identifier = "badge-update-\(hour + 1)"
          let content = UNMutableNotificationContent()
          
          // Set badge count
          content.badge = NSNumber(value: cumulativeReviews)
          print("📅 [DEBUG] Hour \(hour): Creating notification with badge \(cumulativeReviews)")
          
          // Only add alert content if alerts are enabled
          if alertsEnabled && settings.alertSetting == .enabled {
            content.title = "New reviews available"
            content.body = "You have \(cumulativeReviews) new reviews available now"
            print("📅 [DEBUG] Hour \(hour): Added alert content")
            if soundsEnabled && settings.soundSetting == .enabled {
              content.sound = .default
              print("📅 [DEBUG] Hour \(hour): Added sound")
            }
          } else {
            print("📅 [DEBUG] Hour \(hour): No alert content - alertsEnabled: \(alertsEnabled), alertSetting: \(settings.alertSetting.rawValue)")
          }
          
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
      "hasApiToken": (lastApiToken ?? UserDefaults.standard.string(forKey: kakehashiStoredAPITokenKey)) != nil,
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
  
  // Update widget data using shared App Group
  private func updateWidgetData(
    currentReviews: Int,
    upcomingReviews: [Int],
    upcomingReviewTimes: [String: Int]?,
    isOnVacation: Bool = false,
    vacationStartedAt: String? = nil
  ) {
    let timestamp = DateFormatter.localizedString(from: Date(), dateStyle: .none, timeStyle: .medium)
    print("📱 updateWidgetData called at \(timestamp) with: currentReviews=\(currentReviews), upcoming=\(upcomingReviews.reduce(0, +))")
    NSLog("📱 updateWidgetData called at %@ with: currentReviews=%d, upcoming=%d", timestamp, currentReviews, upcomingReviews.reduce(0, +))
    
    let syncSuccess = saveKakehashiReviewSnapshot(
      currentReviews: currentReviews,
      upcomingReviews: upcomingReviews,
      upcomingReviewTimes: upcomingReviewTimes,
      isOnVacation: isOnVacation,
      vacationStartedAt: vacationStartedAt,
      logPrefix: "WaniKaniBackgroundFetch"
    )
    print("✅ Saved review data to App Group: \(currentReviews) reviews (sync: \(syncSuccess))")
    NSLog("✅ Saved review data to App Group: %d reviews (sync: %@)", currentReviews, syncSuccess ? "success" : "failed")
    
    // Tell WidgetKit to reload widgets with multiple strategies
    DispatchQueue.main.async {
      var backgroundTask: UIBackgroundTaskIdentifier = .invalid
      backgroundTask = UIApplication.shared.beginBackgroundTask {
        UIApplication.shared.endBackgroundTask(backgroundTask)
        backgroundTask = .invalid
      }
      
      // Immediate reload attempt
      print("🔄 Immediate widget reload attempt...")
      NSLog("🔄 Immediate widget reload attempt...")
      WidgetCenter.shared.reloadAllTimelines()
      
      // Delayed reload to ensure UserDefaults sync completes
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
        print("🔄 Requesting specific widget reload...")
        NSLog("🔄 Requesting specific widget reload...")
        
        WidgetCenter.shared.reloadTimelines(ofKind: kakehashiHomeWidgetKind)
        print("✅ WaniKani widgets reloaded with new review data")
        NSLog("✅ WaniKani widgets reloaded with new review data")
        
        // Another reload all as backup
        WidgetCenter.shared.reloadAllTimelines()
        print("✅ All widgets reload also triggered (second time)")
        NSLog("✅ All widgets reload also triggered (second time)")
        
        // Final reload after longer delay  
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
          WidgetCenter.shared.reloadAllTimelines()
          print("✅ Final widget reload triggered")
          NSLog("✅ Final widget reload triggered")
          
          // End background task
          if backgroundTask != .invalid {
            UIApplication.shared.endBackgroundTask(backgroundTask)
            backgroundTask = .invalid
          }
        }
      }
    }
  }
}
