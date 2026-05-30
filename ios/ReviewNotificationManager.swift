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
import WatchConnectivity

let kakehashiAppGroupIdentifier = "group.com.kakehashi.reviewdata"
let kakehashiReviewDataKey = "waniKaniReviewData"
let kakehashiHomeWidgetKind = "KakehashiHomeWidget"
let kakehashiStoredAPITokenKey = "wanikani_api_token"
let kakehashiVacationModeKey = "wanikani_is_on_vacation"
let kakehashiVacationStartedAtKey = "wanikani_vacation_started_at"

private let waniKaniAPIBaseURL = "https://api.wanikani.com/v2"
private let waniKaniAPIRevision = "20170710"

func makeKakehashiReviewPayload(
  currentReviews: Int,
  upcomingReviews: [Int],
  upcomingReviewTimes: [String: Int]?,
  lastUpdated: TimeInterval = Date().timeIntervalSince1970,
  isOnVacation: Bool = false,
  vacationStartedAt: String? = nil
) -> [String: Any] {
  let normalizedUpcomingReviews = upcomingReviews.map { max(0, $0) }
  let effectiveUpcomingReviews = isOnVacation
    ? Array(repeating: 0, count: max(normalizedUpcomingReviews.count, 24))
    : normalizedUpcomingReviews
  let effectiveUpcomingReviewTimes: [String: Int] = isOnVacation ? [:] : (upcomingReviewTimes ?? [:])

  var payload: [String: Any] = [
    "kind": "reviewSnapshot",
    "currentReviews": isOnVacation ? 0 : max(0, currentReviews),
    "upcomingReviews": effectiveUpcomingReviews,
    "upcomingReviewTimes": effectiveUpcomingReviewTimes,
    "lastUpdated": lastUpdated,
    "isOnVacation": isOnVacation,
  ]

  if let vacationStartedAt {
    payload["vacationStartedAt"] = vacationStartedAt
  }

  return payload
}

@discardableResult
func saveKakehashiReviewSnapshot(
  currentReviews: Int,
  upcomingReviews: [Int],
  upcomingReviewTimes: [String: Int]?,
  isOnVacation: Bool = false,
  vacationStartedAt: String? = nil,
  logPrefix: String = "Kakehashi"
) -> Bool {
  let payload = makeKakehashiReviewPayload(
    currentReviews: currentReviews,
    upcomingReviews: upcomingReviews,
    upcomingReviewTimes: upcomingReviewTimes,
    isOnVacation: isOnVacation,
    vacationStartedAt: vacationStartedAt
  )

  KakehashiWatchBridge.shared.update(with: payload)

  guard let sharedDefaults = UserDefaults(suiteName: kakehashiAppGroupIdentifier) else {
    print("❌ \(logPrefix): Failed to access App Group UserDefaults")
    return false
  }

  sharedDefaults.set(payload, forKey: kakehashiReviewDataKey)
  let syncSuccess = sharedDefaults.synchronize()
  print("✅ \(logPrefix): Saved review data - \(currentReviews) reviews (sync: \(syncSuccess))")
  return syncSuccess
}

final class KakehashiWatchBridge: NSObject {
  static let shared = KakehashiWatchBridge()

  private let payloadQueue = DispatchQueue(label: "com.kakehashi.watch.payload")
  private var cachedPayload: [String: Any] = [:]
  private var didConfigureSession = false

  private override init() {
    super.init()
  }

  func activate() {
    _ = configureSession()
    if let payload = latestPayload(), !payload.isEmpty {
      update(with: payload)
    }
  }

  func update(with payload: [String: Any]) {
    payloadQueue.async {
      self.cachedPayload = payload
    }

    guard let session = configureSession() else {
      return
    }

    guard session.activationState == .activated else {
      return
    }

    #if os(iOS)
    guard session.isPaired && session.isWatchAppInstalled else {
      return
    }
    #endif

    do {
      try session.updateApplicationContext(payload)
    } catch {
      print("⚠️ KakehashiWatchBridge: Unable to update watch context: \(error.localizedDescription)")
    }

    if session.isReachable {
      session.sendMessage(payload, replyHandler: nil) { error in
        print("⚠️ KakehashiWatchBridge: Unable to send live watch message: \(error.localizedDescription)")
      }
    }
  }

  private func configureSession() -> WCSession? {
    guard WCSession.isSupported() else {
      return nil
    }

    let session = WCSession.default
    if !didConfigureSession {
      didConfigureSession = true
      session.delegate = self
      session.activate()
    }

    return session
  }

  private func latestPayload() -> [String: Any]? {
    let memoryPayload = payloadQueue.sync { cachedPayload }
    if !memoryPayload.isEmpty {
      return memoryPayload
    }

    return UserDefaults(suiteName: kakehashiAppGroupIdentifier)?
      .dictionary(forKey: kakehashiReviewDataKey)
  }

  private func markSubmittedReviewInPayload() {
    guard let payload = latestPayload() else {
      return
    }

    let currentReviews = max(0, (payload["currentReviews"] as? Int ?? 0) - 1)
    let upcomingReviews = payload["upcomingReviews"] as? [Int] ?? Array(repeating: 0, count: 24)
    let upcomingReviewTimes = payload["upcomingReviewTimes"] as? [String: Int]
    let isOnVacation = payload["isOnVacation"] as? Bool ?? false
    let vacationStartedAt = payload["vacationStartedAt"] as? String

    _ = saveKakehashiReviewSnapshot(
      currentReviews: currentReviews,
      upcomingReviews: upcomingReviews,
      upcomingReviewTimes: upcomingReviewTimes,
      isOnVacation: isOnVacation,
      vacationStartedAt: vacationStartedAt,
      logPrefix: "KakehashiWatchBridge"
    )
  }
}

private enum KakehashiWatchReviewAPI {
  private struct WatchAssignment {
    let assignmentId: Int
    let subjectId: Int
    let srsStage: Int
    let availableAt: String?
  }

  static func loadReviewSession(limit: Int, completion: @escaping ([String: Any]) -> Void) {
    guard let apiToken = UserDefaults.standard.string(forKey: kakehashiStoredAPITokenKey),
          !apiToken.isEmpty else {
      completion([
        "kind": "reviewSession",
        "cards": [],
        "error": "Open Kakehashi on iPhone once so the watch can sync your account.",
      ])
      return
    }

    if UserDefaults.standard.bool(forKey: kakehashiVacationModeKey) {
      completion([
        "kind": "reviewSession",
        "cards": [],
        "isOnVacation": true,
        "error": "Vacation mode is on.",
      ])
      return
    }

    fetchAvailableAssignments(apiToken: apiToken) { assignmentResult in
      switch assignmentResult {
      case .success(let assignments):
        let boundedLimit = min(max(limit, 1), 20)
        let limitedAssignments = Array(assignments.prefix(boundedLimit))
        let subjectIds = Array(Set(limitedAssignments.map { $0.subjectId }))

        guard !limitedAssignments.isEmpty, !subjectIds.isEmpty else {
          completion([
            "kind": "reviewSession",
            "cards": [],
          ])
          return
        }

        fetchSubjects(apiToken: apiToken, subjectIds: subjectIds) { subjectResult in
          switch subjectResult {
          case .success(let subjects):
            completion([
              "kind": "reviewSession",
              "cards": buildCards(assignments: limitedAssignments, subjects: subjects),
            ])
          case .failure(let error):
            completion(reviewSessionError(error.localizedDescription))
          }
        }

      case .failure(let error):
        completion(reviewSessionError(error.localizedDescription))
      }
    }
  }

  static func submitReview(
    assignmentId: Int,
    meaningIncorrect: Int,
    readingIncorrect: Int,
    completion: @escaping ([String: Any]) -> Void
  ) {
    guard let apiToken = UserDefaults.standard.string(forKey: kakehashiStoredAPITokenKey),
          !apiToken.isEmpty else {
      completion([
        "kind": "reviewSubmission",
        "success": false,
        "error": "Open Kakehashi on iPhone once so the watch can sync your account.",
      ])
      return
    }

    guard let url = URL(string: "\(waniKaniAPIBaseURL)/reviews") else {
      completion(reviewSubmissionError("Could not build the review submission URL."))
      return
    }

    var request = authorizedRequest(url: url, apiToken: apiToken)
    request.httpMethod = "POST"
    request.httpBody = try? JSONSerialization.data(withJSONObject: [
      "review": [
        "assignment_id": assignmentId,
        "incorrect_meaning_answers": max(0, meaningIncorrect),
        "incorrect_reading_answers": max(0, readingIncorrect),
      ],
    ])

    URLSession.shared.dataTask(with: request) { data, response, error in
      if let error {
        completion(reviewSubmissionError(error.localizedDescription))
        return
      }

      guard let httpResponse = response as? HTTPURLResponse else {
        completion(reviewSubmissionError("WaniKani did not return an HTTP response."))
        return
      }

      guard (200..<300).contains(httpResponse.statusCode) else {
        completion(reviewSubmissionError(apiErrorMessage(from: data) ?? "WaniKani returned HTTP \(httpResponse.statusCode)."))
        return
      }

      completion([
        "kind": "reviewSubmission",
        "success": true,
        "assignmentId": assignmentId,
      ])
    }.resume()
  }

  private static func fetchAvailableAssignments(
    apiToken: String,
    completion: @escaping (Result<[WatchAssignment], Error>) -> Void
  ) {
    guard var components = URLComponents(string: "\(waniKaniAPIBaseURL)/assignments") else {
      completion(.failure(apiError("Could not build the assignments URL.")))
      return
    }

    components.queryItems = [
      URLQueryItem(name: "immediately_available_for_review", value: "true"),
      URLQueryItem(name: "hidden", value: "false"),
    ]

    guard let url = components.url else {
      completion(.failure(apiError("Could not build the assignments URL.")))
      return
    }

    performJSONRequest(url: url, apiToken: apiToken) { result in
      switch result {
      case .success(let json):
        let rawAssignments = json["data"] as? [[String: Any]] ?? []
        let now = Date()
        let assignments = rawAssignments.compactMap(parseAssignment)
          .filter { assignment in
            guard let availableAt = assignment.availableAt,
                  let date = parseISODate(availableAt) else {
              return true
            }

            return date <= now
          }
          .sorted { first, second in
            first.srsStage == second.srsStage
              ? first.assignmentId < second.assignmentId
              : first.srsStage < second.srsStage
          }

        completion(.success(assignments))

      case .failure(let error):
        completion(.failure(error))
      }
    }
  }

  private static func fetchSubjects(
    apiToken: String,
    subjectIds: [Int],
    completion: @escaping (Result<[[String: Any]], Error>) -> Void
  ) {
    guard var components = URLComponents(string: "\(waniKaniAPIBaseURL)/subjects") else {
      completion(.failure(apiError("Could not build the subjects URL.")))
      return
    }

    components.queryItems = [
      URLQueryItem(name: "ids", value: subjectIds.sorted().map(String.init).joined(separator: ",")),
    ]

    guard let url = components.url else {
      completion(.failure(apiError("Could not build the subjects URL.")))
      return
    }

    performJSONRequest(url: url, apiToken: apiToken) { result in
      switch result {
      case .success(let json):
        completion(.success(json["data"] as? [[String: Any]] ?? []))
      case .failure(let error):
        completion(.failure(error))
      }
    }
  }

  private static func performJSONRequest(
    url: URL,
    apiToken: String,
    completion: @escaping (Result<[String: Any], Error>) -> Void
  ) {
    let request = authorizedRequest(url: url, apiToken: apiToken)

    URLSession.shared.dataTask(with: request) { data, response, error in
      if let error {
        completion(.failure(error))
        return
      }

      guard let httpResponse = response as? HTTPURLResponse else {
        completion(.failure(apiError("WaniKani did not return an HTTP response.")))
        return
      }

      guard (200..<300).contains(httpResponse.statusCode) else {
        completion(.failure(apiError(apiErrorMessage(from: data) ?? "WaniKani returned HTTP \(httpResponse.statusCode).")))
        return
      }

      guard let data else {
        completion(.failure(apiError("WaniKani returned an empty response.")))
        return
      }

      do {
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
          completion(.failure(apiError("WaniKani returned an unexpected response.")))
          return
        }

        completion(.success(json))
      } catch {
        completion(.failure(error))
      }
    }.resume()
  }

  private static func authorizedRequest(url: URL, apiToken: String) -> URLRequest {
    var request = URLRequest(url: url)
    request.setValue("Bearer \(apiToken)", forHTTPHeaderField: "Authorization")
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue(waniKaniAPIRevision, forHTTPHeaderField: "Wanikani-Revision")
    request.setValue("Kakehashi-Watch", forHTTPHeaderField: "User-Agent")
    return request
  }

  private static func parseAssignment(_ rawAssignment: [String: Any]) -> WatchAssignment? {
    guard let assignmentId = intValue(rawAssignment["id"]),
          let assignmentData = rawAssignment["data"] as? [String: Any],
          let subjectId = intValue(assignmentData["subject_id"]) else {
      return nil
    }

    let hidden = assignmentData["hidden"] as? Bool ?? false
    let srsStage = intValue(assignmentData["srs_stage"]) ?? 0
    guard !hidden, srsStage < 9 else {
      return nil
    }

    return WatchAssignment(
      assignmentId: assignmentId,
      subjectId: subjectId,
      srsStage: srsStage,
      availableAt: assignmentData["available_at"] as? String
    )
  }

  private static func buildCards(
    assignments: [WatchAssignment],
    subjects: [[String: Any]]
  ) -> [[String: Any]] {
    let subjectsById = Dictionary(
      uniqueKeysWithValues: subjects.compactMap { subject -> (Int, [String: Any])? in
        guard let subjectId = intValue(subject["id"]) else {
          return nil
        }

        return (subjectId, subject)
      }
    )

    return assignments.compactMap { assignment in
      guard let subject = subjectsById[assignment.subjectId],
            let subjectData = subject["data"] as? [String: Any] else {
        return nil
      }

      let subjectType = subject["object"] as? String ?? "vocabulary"
      let meanings = answerStrings(from: subjectData["meanings"], field: "meaning")
      let allReadings = answerStrings(from: subjectData["readings"], field: "reading")
      let hasReading = subjectType != "radical" && subjectType != "kana_vocabulary" && !allReadings.isEmpty
      let displayCharacters = (subjectData["characters"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
      let characters: String
      if let displayCharacters, !displayCharacters.isEmpty {
        characters = displayCharacters
      } else {
        characters = meanings.first ?? "Review"
      }

      return [
        "id": "\(assignment.assignmentId)",
        "assignmentId": assignment.assignmentId,
        "subjectId": assignment.subjectId,
        "subjectType": subjectType,
        "characters": characters,
        "meanings": meanings,
        "readings": hasReading ? allReadings : [],
        "hasReading": hasReading,
        "srsStage": assignment.srsStage,
        "availableAt": assignment.availableAt ?? "",
      ]
    }
  }

  private static func answerStrings(from value: Any?, field: String) -> [String] {
    guard let answers = value as? [[String: Any]] else {
      return []
    }

    let sortedAnswers = answers.sorted { first, second in
      let firstPrimary = first["primary"] as? Bool ?? false
      let secondPrimary = second["primary"] as? Bool ?? false
      if firstPrimary != secondPrimary {
        return firstPrimary
      }

      let firstAccepted = first["accepted_answer"] as? Bool ?? true
      let secondAccepted = second["accepted_answer"] as? Bool ?? true
      if firstAccepted != secondAccepted {
        return firstAccepted
      }

      return (first[field] as? String ?? "") < (second[field] as? String ?? "")
    }

    let acceptedAnswers = sortedAnswers.filter { $0["accepted_answer"] as? Bool ?? true }
    let candidates = acceptedAnswers.isEmpty ? sortedAnswers : acceptedAnswers

    return candidates.compactMap { answer in
      guard let value = answer[field] as? String else {
        return nil
      }

      let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
      return trimmed.isEmpty ? nil : trimmed
    }
  }

  private static func intValue(_ value: Any?) -> Int? {
    if let value = value as? Int {
      return value
    }

    if let value = value as? NSNumber {
      return value.intValue
    }

    if let value = value as? String {
      return Int(value)
    }

    return nil
  }

  private static func parseISODate(_ string: String) -> Date? {
    let fractionalFormatter = ISO8601DateFormatter()
    fractionalFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = fractionalFormatter.date(from: string) {
      return date
    }

    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime]
    return formatter.date(from: string)
  }

  private static func apiErrorMessage(from data: Data?) -> String? {
    guard let data, !data.isEmpty else {
      return nil
    }

    if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
      return json["error"] as? String ??
        json["message"] as? String ??
        (json["error"] as? [String: Any])?["message"] as? String
    }

    return String(data: data, encoding: .utf8)
  }

  private static func apiError(_ message: String) -> NSError {
    NSError(domain: "KakehashiWatchReviewAPI", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
  }

  private static func reviewSessionError(_ message: String) -> [String: Any] {
    [
      "kind": "reviewSession",
      "cards": [],
      "error": message,
    ]
  }

  private static func reviewSubmissionError(_ message: String) -> [String: Any] {
    [
      "kind": "reviewSubmission",
      "success": false,
      "error": message,
    ]
  }
}

extension KakehashiWatchBridge: WCSessionDelegate {
  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    if let error {
      print("⚠️ KakehashiWatchBridge: Activation failed: \(error.localizedDescription)")
      return
    }

    if activationState == .activated, let payload = latestPayload(), !payload.isEmpty {
      update(with: payload)
    }
  }

  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    session.activate()
  }

  func session(
    _ session: WCSession,
    didReceiveMessage message: [String: Any],
    replyHandler: @escaping ([String: Any]) -> Void
  ) {
    guard let command = message["command"] as? String else {
      replyHandler([:])
      return
    }

    switch command {
    case "requestReviewData":
      replyHandler(
        latestPayload() ??
          makeKakehashiReviewPayload(
            currentReviews: 0,
            upcomingReviews: Array(repeating: 0, count: 24),
            upcomingReviewTimes: nil,
            lastUpdated: 0
          )
      )

    case "requestReviewSession":
      let limit = (message["limit"] as? Int) ?? (message["limit"] as? NSNumber)?.intValue ?? 10
      KakehashiWatchReviewAPI.loadReviewSession(limit: limit, completion: replyHandler)

    case "submitWatchReview":
      guard let assignmentId = (message["assignmentId"] as? Int) ?? (message["assignmentId"] as? NSNumber)?.intValue else {
        replyHandler([
          "kind": "reviewSubmission",
          "success": false,
          "error": "Missing review assignment.",
        ])
        return
      }

      KakehashiWatchReviewAPI.submitReview(
        assignmentId: assignmentId,
        meaningIncorrect: (message["meaningIncorrect"] as? Int) ?? (message["meaningIncorrect"] as? NSNumber)?.intValue ?? 0,
        readingIncorrect: (message["readingIncorrect"] as? Int) ?? (message["readingIncorrect"] as? NSNumber)?.intValue ?? 0
      ) { [weak self] reply in
        if reply["success"] as? Bool == true {
          self?.markSubmittedReviewInPayload()
        }

        replyHandler(reply)
      }

    default:
      replyHandler([:])
    }
  }
}

// Simple widget data storage for notifications
private func saveWidgetData(
  currentReviews: Int,
  upcomingReviews: [Int],
  upcomingReviewTimes: [String: Int]?,
  isOnVacation: Bool = false,
  vacationStartedAt: String? = nil
) {
    _ = saveKakehashiReviewSnapshot(
      currentReviews: currentReviews,
      upcomingReviews: upcomingReviews,
      upcomingReviewTimes: upcomingReviewTimes,
      isOnVacation: isOnVacation,
      vacationStartedAt: vacationStartedAt,
      logPrefix: "ReviewNotificationManager"
    )
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
	    let isOnVacation = reviewData["isOnVacation"] as? Bool ?? false
	    let vacationStartedAt = reviewData["vacationStartedAt"] as? String
	    let effectiveCurrentReviews = isOnVacation ? 0 : currentReviews
	    let effectiveUpcomingReviews = isOnVacation
	      ? Array(repeating: 0, count: max(upcomingReviews.count, 24))
	      : upcomingReviews
	    let effectiveUpcomingReviewTimes: [String: Int]? = isOnVacation ? [:] : upcomingReviewTimes

	    UserDefaults.standard.set(isOnVacation, forKey: kakehashiVacationModeKey)
	    if let vacationStartedAt {
	      UserDefaults.standard.set(vacationStartedAt, forKey: kakehashiVacationStartedAtKey)
	    } else {
	      UserDefaults.standard.removeObject(forKey: kakehashiVacationStartedAtKey)
	    }
	    
	    UNUserNotificationCenter.current().getNotificationSettings { settings in
	      DispatchQueue.main.async {
	        // Update badge count
	        if settings.badgeSetting == .enabled && badgeEnabled {
	          UIApplication.shared.applicationIconBadgeNumber = effectiveCurrentReviews
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
	            if !isOnVacation &&
	               ((settings.alertSetting == .enabled && alertsEnabled) ||
	                (settings.badgeSetting == .enabled && badgeEnabled)) {

	              // Use exact timing if available, otherwise fall back to hourly
	              if let exactTimes = effectiveUpcomingReviewTimes {
	                self.scheduleExactNotifications(
	                  currentReviews: effectiveCurrentReviews,
	                  upcomingReviewTimes: exactTimes,
	                  settings: settings,
	                  alertsEnabled: alertsEnabled,
                  badgeEnabled: badgeEnabled,
                  soundsEnabled: soundsEnabled
	                )
	              } else {
	                self.scheduleUpcomingNotifications(
	                  currentReviews: effectiveCurrentReviews,
	                  upcomingReviews: effectiveUpcomingReviews,
	                  settings: settings,
	                  alertsEnabled: alertsEnabled,
                  badgeEnabled: badgeEnabled,
                  soundsEnabled: soundsEnabled
                )
              }
            }

            // Update widget with review data
	            saveWidgetData(
	              currentReviews: effectiveCurrentReviews,
	              upcomingReviews: effectiveUpcomingReviews,
	              upcomingReviewTimes: effectiveUpcomingReviewTimes,
	              isOnVacation: isOnVacation,
	              vacationStartedAt: vacationStartedAt
	            )
	            WidgetCenter.shared.reloadAllTimelines()

	            resolve([
	              "success": true,
	              "currentReviews": effectiveCurrentReviews,
	              "badgeSet": badgeEnabled,
	              "notificationsScheduled": !isOnVacation && alertsEnabled,
	              "isOnVacation": isOnVacation
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
    
    let syncSuccess = saveKakehashiReviewSnapshot(
      currentReviews: currentReviews,
      upcomingReviews: upcomingReviews,
      upcomingReviewTimes: upcomingReviewTimes,
      logPrefix: "ReviewNotificationManager"
    )
    print("✅ ReviewNotificationManager: Saved widget data - \(currentReviews) reviews (sync: \(syncSuccess))")
    NSLog("✅ ReviewNotificationManager: Saved widget data - %d reviews (sync: %@)", currentReviews, syncSuccess ? "success" : "failed")
    
    // Tell WidgetKit to reload widgets
    DispatchQueue.main.async {
      WidgetCenter.shared.reloadAllTimelines()
      WidgetCenter.shared.reloadTimelines(ofKind: kakehashiHomeWidgetKind)
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
    guard let sharedDefaults = UserDefaults(suiteName: kakehashiAppGroupIdentifier),
          let currentData = sharedDefaults.object(forKey: kakehashiReviewDataKey) as? [String: Any],
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
