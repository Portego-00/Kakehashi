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
let kakehashiReviewNotificationCategoryIdentifier = "REVIEW_CATEGORY"
let kakehashiReviewNotificationThreadIdentifier = "kakehashi-reviews"
let kakehashiReviewNotificationMarkerKey = "kakehashiReviewNotification"
let kakehashiReviewAlertMarkerKey = "kakehashiReviewAlert"

struct KakehashiNativeAuthSessionSnapshot {
  let apiToken: String
  let generation: UInt64
}

final class KakehashiNativeAuthSession {
  static let shared = KakehashiNativeAuthSession()

  private let lock = NSLock()
  private var apiToken: String?
  private var generation: UInt64 = 0
  private var didLoadStoredToken = false

  private init() {}

  private func normalizedToken(_ value: String?) -> String? {
    let normalized = value?.trimmingCharacters(in: .whitespacesAndNewlines)
    return normalized?.isEmpty == false ? normalized : nil
  }

  private func loadStoredTokenIfNeeded() {
    guard !didLoadStoredToken else {
      return
    }
    apiToken = normalizedToken(
      UserDefaults.standard.string(forKey: kakehashiStoredAPITokenKey)
    )
    didLoadStoredToken = true
  }

  func update(apiToken value: String?) {
    lock.lock()
    defer { lock.unlock() }
    loadStoredTokenIfNeeded()

    let normalized = normalizedToken(value)
    if normalized != apiToken {
      generation &+= 1
      apiToken = normalized
    }
  }

  func snapshot() -> KakehashiNativeAuthSessionSnapshot? {
    lock.lock()
    defer { lock.unlock() }
    loadStoredTokenIfNeeded()

    guard let apiToken else {
      return nil
    }
    return KakehashiNativeAuthSessionSnapshot(
      apiToken: apiToken,
      generation: generation
    )
  }

  func isCurrent(_ snapshot: KakehashiNativeAuthSessionSnapshot) -> Bool {
    lock.lock()
    defer { lock.unlock() }
    loadStoredTokenIfNeeded()
    return snapshot.generation == generation && snapshot.apiToken == apiToken
  }
}

private let kakehashiLegacyReviewNotificationPrefixes = [
  "review-",
  "badge-update-",
]

func isKakehashiReviewNotification(_ request: UNNotificationRequest) -> Bool {
  if request.content.categoryIdentifier == kakehashiReviewNotificationCategoryIdentifier {
    return true
  }

  if request.content.userInfo[kakehashiReviewNotificationMarkerKey] as? Bool == true {
    return true
  }

  return kakehashiLegacyReviewNotificationPrefixes.contains { prefix in
    request.identifier.hasPrefix(prefix)
  }
}

func isKakehashiReviewAlertNotification(_ request: UNNotificationRequest) -> Bool {
  if let isAlert = request.content.userInfo[
    kakehashiReviewAlertMarkerKey
  ] as? Bool {
    return isAlert
  }

  if request.content.categoryIdentifier == kakehashiReviewNotificationCategoryIdentifier {
    return true
  }

  let hasVisibleContent =
    !request.content.title.isEmpty ||
    !request.content.body.isEmpty ||
    request.content.sound != nil

  if request.content.userInfo[kakehashiReviewNotificationMarkerKey] as? Bool == true {
    return hasVisibleContent
  }

  // Older native schedules used both review-* and badge-update-* for visible
  // alerts, so visible content distinguishes them from silent badge updates.
  return kakehashiLegacyReviewNotificationPrefixes.contains { prefix in
    request.identifier.hasPrefix(prefix)
  } && hasVisibleContent
}

private func kakehashiReviewNotificationInteger(_ value: Any?) -> Int? {
  if let value = value as? Int {
    return value
  }

  return (value as? NSNumber)?.intValue
}

private func preservedKakehashiReviewTrigger(
  _ trigger: UNNotificationTrigger?
) -> UNNotificationTrigger? {
  guard let trigger else {
    return nil
  }

  guard let intervalTrigger = trigger as? UNTimeIntervalNotificationTrigger,
        !intervalTrigger.repeats else {
    return trigger
  }

  guard let nextTriggerDate = intervalTrigger.nextTriggerDate() else {
    return nil
  }

  let remainingInterval = nextTriggerDate.timeIntervalSinceNow
  guard remainingInterval > 1 else {
    return nil
  }

  return UNTimeIntervalNotificationTrigger(
    timeInterval: remainingInterval,
    repeats: false
  )
}

private func transformedKakehashiReviewRequest(
  _ request: UNNotificationRequest,
  showAlert: Bool,
  updateBadge: Bool,
  playSound: Bool
) -> UNNotificationRequest? {
  guard let content = request.content.mutableCopy() as? UNMutableNotificationContent else {
    return nil
  }
  guard let trigger = preservedKakehashiReviewTrigger(request.trigger) else {
    return nil
  }

  var userInfo = content.userInfo
  let reviewCount = kakehashiReviewNotificationInteger(
    userInfo["reviewCount"]
  ) ?? content.badge?.intValue
  let newReviews = kakehashiReviewNotificationInteger(
    userInfo["newReviews"]
  )
  let hasVisibleContent =
    !content.title.isEmpty ||
    !content.body.isEmpty ||
    content.sound != nil
  let canShowAlert = showAlert && (hasVisibleContent || reviewCount != nil)

  if canShowAlert {
    if content.title.isEmpty {
      if let newReviews {
        let newlyAvailable = max(0, newReviews)
        content.title = "\(newlyAvailable) new review\(newlyAvailable == 1 ? "" : "s") available"
      } else {
        content.title = "Reviews available"
      }
    }
    if content.body.isEmpty, let reviewCount {
      content.body = "You have \(reviewCount) review\(reviewCount == 1 ? "" : "s") waiting"
    }
    content.categoryIdentifier = kakehashiReviewNotificationCategoryIdentifier
    content.threadIdentifier = kakehashiReviewNotificationThreadIdentifier
    content.sound = playSound ? UNNotificationSound.default : nil
  } else {
    content.title = ""
    content.subtitle = ""
    content.body = ""
    content.categoryIdentifier = ""
    content.threadIdentifier = ""
    content.sound = nil
  }

  if updateBadge {
    if let reviewCount {
      content.badge = NSNumber(value: max(0, reviewCount))
    }
  } else {
    content.badge = nil
  }

  let willUpdateBadge = updateBadge && content.badge != nil
  guard canShowAlert || willUpdateBadge else {
    return nil
  }

  userInfo[kakehashiReviewNotificationMarkerKey] = true
  userInfo[kakehashiReviewAlertMarkerKey] = canShowAlert
  content.userInfo = userInfo

  return UNNotificationRequest(
    identifier: request.identifier,
    content: content,
    trigger: trigger
  )
}

func removeDeliveredKakehashiReviewNotifications(
  from center: UNUserNotificationCenter = UNUserNotificationCenter.current()
) {
  center.getDeliveredNotifications { notifications in
    let identifiers = notifications
      .map(\.request)
      .filter(isKakehashiReviewNotification)
      .map(\.identifier)

    guard !identifiers.isEmpty else {
      return
    }

    center.removeDeliveredNotifications(withIdentifiers: identifiers)
    print("🗑️ Removed \(identifiers.count) delivered review notifications")
  }
}

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

  @objc func clearReviewAlerts(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    let center = UNUserNotificationCenter.current()
    center.getPendingNotificationRequests { pendingRequests in
      let pendingIdentifiers = pendingRequests
        .filter(isKakehashiReviewAlertNotification)
        .map(\.identifier)
      center.removePendingNotificationRequests(
        withIdentifiers: pendingIdentifiers
      )

      center.getDeliveredNotifications { deliveredNotifications in
        let deliveredIdentifiers = deliveredNotifications
          .map(\.request)
          .filter(isKakehashiReviewAlertNotification)
          .map(\.identifier)
        center.removeDeliveredNotifications(
          withIdentifiers: deliveredIdentifiers
        )

        DispatchQueue.main.async {
          resolve([
            "success": true,
            "pendingRemoved": pendingIdentifiers.count,
            "deliveredRemoved": deliveredIdentifiers.count,
          ])
        }
      }
    }
  }

  @objc func applyReviewNotificationSettings(
    _ notificationSettings: [String: Any],
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    let defaults = UserDefaults.standard
    if let badgeEnabled = notificationSettings["badgeEnabled"] as? Bool {
      defaults.set(badgeEnabled, forKey: "badge_notifications_enabled")
    }
    if let alertsEnabled = notificationSettings["alertsEnabled"] as? Bool {
      defaults.set(alertsEnabled, forKey: "review_notifications_enabled")
    }
    if let soundsEnabled = notificationSettings["soundsEnabled"] as? Bool {
      defaults.set(soundsEnabled, forKey: "notification_sounds_enabled")
    }

    let center = UNUserNotificationCenter.current()
    center.getNotificationSettings { systemSettings in
      center.getPendingNotificationRequests { pendingRequests in
        // Read the persisted values here so overlapping setting changes always
        // converge on the most recent preferences.
        let badgeEnabled = defaults.object(
          forKey: "badge_notifications_enabled"
        ) as? Bool ?? true
        let alertsEnabled = defaults.object(
          forKey: "review_notifications_enabled"
        ) as? Bool ?? false
        let soundsEnabled = defaults.object(
          forKey: "notification_sounds_enabled"
        ) as? Bool ?? true
        let shouldShowAlert =
          alertsEnabled && systemSettings.alertSetting == .enabled
        let shouldUpdateBadge =
          badgeEnabled && systemSettings.badgeSetting == .enabled
        let shouldPlaySound =
          shouldShowAlert &&
          soundsEnabled &&
          systemSettings.soundSetting == .enabled

        var identifiersToRemove: [String] = []
        var replacementRequests: [UNNotificationRequest] = []

        for request in pendingRequests where isKakehashiReviewNotification(request) {
          // Immediate Expo availability notifications are handled by the Expo
          // cleanup path. Re-adding a nil-trigger request would deliver it again.
          guard request.trigger != nil else {
            if !shouldShowAlert {
              identifiersToRemove.append(request.identifier)
            }
            continue
          }

          if let replacement = transformedKakehashiReviewRequest(
            request,
            showAlert: shouldShowAlert,
            updateBadge: shouldUpdateBadge,
            playSound: shouldPlaySound
          ) {
            replacementRequests.append(replacement)
          } else {
            identifiersToRemove.append(request.identifier)
          }
        }

        if !identifiersToRemove.isEmpty {
          center.removePendingNotificationRequests(
            withIdentifiers: identifiersToRemove
          )
        }

        let updateGroup = DispatchGroup()
        let resultQueue = DispatchQueue(
          label: "com.kakehashi.review-notification-settings-result"
        )
        var updateFailures = 0

        for request in replacementRequests {
          updateGroup.enter()
          center.add(request) { error in
            if error != nil {
              resultQueue.sync {
                updateFailures += 1
              }
            }
            updateGroup.leave()
          }
        }

        updateGroup.notify(queue: .main) {
          resolve([
            "success": updateFailures == 0,
            "pendingUpdated": replacementRequests.count - updateFailures,
            "pendingRemoved": identifiersToRemove.count,
            "updateFailures": updateFailures,
          ])
        }
      }
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
	    let widgetBackgroundRefreshEnabled = notificationSettings["widgetBackgroundRefreshEnabled"] ?? true
	    let upcomingReviewTimes = reviewData["upcomingReviewTimes"] as? [String: Int]
	    let isOnVacation = reviewData["isOnVacation"] as? Bool ?? false
	    let vacationStartedAt = reviewData["vacationStartedAt"] as? String
	    let effectiveCurrentReviews = isOnVacation ? 0 : currentReviews
	    let effectiveUpcomingReviews = isOnVacation
	      ? Array(repeating: 0, count: max(upcomingReviews.count, 24))
	      : upcomingReviews
	    let effectiveUpcomingReviewTimes: [String: Int]? = isOnVacation ? [:] : upcomingReviewTimes
    let defaults = UserDefaults.standard
    let authSessionSnapshot = KakehashiNativeAuthSession.shared.snapshot()

    // The bridge normally patches these defaults before invoking this method.
    // Seed only missing keys so an older in-flight payload cannot overwrite a
    // setting the user changed after the request started.
    if defaults.object(forKey: "badge_notifications_enabled") == nil {
      defaults.set(badgeEnabled, forKey: "badge_notifications_enabled")
    }
    if defaults.object(forKey: "review_notifications_enabled") == nil {
      defaults.set(alertsEnabled, forKey: "review_notifications_enabled")
    }
    if defaults.object(forKey: "notification_sounds_enabled") == nil {
      defaults.set(soundsEnabled, forKey: "notification_sounds_enabled")
    }
    if defaults.object(forKey: "widget_background_refresh_enabled") == nil {
      defaults.set(
        widgetBackgroundRefreshEnabled,
        forKey: "widget_background_refresh_enabled"
      )
    }

	    defaults.set(isOnVacation, forKey: kakehashiVacationModeKey)
	    if let vacationStartedAt {
	      defaults.set(vacationStartedAt, forKey: kakehashiVacationStartedAtKey)
	    } else {
	      defaults.removeObject(forKey: kakehashiVacationStartedAtKey)
	    }

	    UNUserNotificationCenter.current().getNotificationSettings { settings in
	      DispatchQueue.main.async {

        // Replace the pending review schedule. Delivered alerts remain available
        // until the user opens the app, and iOS groups them under one thread.
	        UNUserNotificationCenter.current().getPendingNotificationRequests { existingRequests in
	          guard let authSessionSnapshot,
	                KakehashiNativeAuthSession.shared.isCurrent(authSessionSnapshot) else {
	            resolve([
	              "success": true,
	              "currentReviews": 0,
	              "badgeSet": false,
	              "notificationsScheduled": false,
	              "cancelledForLogout": true,
	            ])
	            return
	          }

	          let reviewNotificationIds = existingRequests
            .filter(isKakehashiReviewNotification)
            .map { $0.identifier }

          UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: reviewNotificationIds)
          print("🗑️ Removed \(reviewNotificationIds.count) existing review/badge notifications")

	          // Small delay to ensure removal completes before scheduling new notifications
	          DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
	              guard KakehashiNativeAuthSession.shared.isCurrent(authSessionSnapshot) else {
	                resolve([
	                  "success": true,
	                  "currentReviews": 0,
	                  "badgeSet": false,
	                  "notificationsScheduled": false,
	                  "cancelledForLogout": true,
	                ])
	                return
	              }

	              // Re-read the native preferences at the final mutation point. A
              // settings toggle may have completed while this refresh waited on
              // notification-center callbacks.
              let latestBadgeEnabled = defaults.object(
                forKey: "badge_notifications_enabled"
              ) as? Bool ?? badgeEnabled
              let latestAlertsEnabled = defaults.object(
                forKey: "review_notifications_enabled"
              ) as? Bool ?? alertsEnabled
              let latestSoundsEnabled = defaults.object(
                forKey: "notification_sounds_enabled"
              ) as? Bool ?? soundsEnabled
              let latestWidgetBackgroundRefreshEnabled = defaults.object(
                forKey: "widget_background_refresh_enabled"
              ) as? Bool ?? widgetBackgroundRefreshEnabled
              let shouldShowAlert =
                settings.alertSetting == .enabled && latestAlertsEnabled
              let shouldUpdateBadge =
                settings.badgeSetting == .enabled && latestBadgeEnabled

              if shouldUpdateBadge {
                UIApplication.shared.applicationIconBadgeNumber = effectiveCurrentReviews
              } else {
                UIApplication.shared.applicationIconBadgeNumber = 0
              }

	            // Schedule new notifications if enabled
	            if !isOnVacation && (shouldShowAlert || shouldUpdateBadge) {

	              // Use exact timing if available, otherwise fall back to hourly
	              if let exactTimes = effectiveUpcomingReviewTimes {
	                self.scheduleExactNotifications(
	                  currentReviews: effectiveCurrentReviews,
	                  upcomingReviewTimes: exactTimes,
	                  settings: settings,
	                  alertsEnabled: latestAlertsEnabled,
	                  badgeEnabled: latestBadgeEnabled,
	                  soundsEnabled: latestSoundsEnabled
	                )
	              } else {
	                self.scheduleUpcomingNotifications(
	                  currentReviews: effectiveCurrentReviews,
	                  upcomingReviews: effectiveUpcomingReviews,
	                  settings: settings,
	                  alertsEnabled: latestAlertsEnabled,
	                  badgeEnabled: latestBadgeEnabled,
	                  soundsEnabled: latestSoundsEnabled
                )
              }
            }

	            // The shared snapshot also feeds the Apple Watch bridge, so keep
	            // it current even when automatic Home Widget reloads are disabled.
	            saveWidgetData(
	              currentReviews: effectiveCurrentReviews,
	              upcomingReviews: effectiveUpcomingReviews,
	              upcomingReviewTimes: effectiveUpcomingReviewTimes,
	              isOnVacation: isOnVacation,
	              vacationStartedAt: vacationStartedAt
	            )

	            if latestWidgetBackgroundRefreshEnabled {
	              WidgetCenter.shared.reloadAllTimelines()
	            }

	            resolve([
	              "success": true,
	              "currentReviews": effectiveCurrentReviews,
	              "badgeSet": shouldUpdateBadge,
	              "notificationsScheduled": !isOnVacation && shouldShowAlert,
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
      
      let shouldShowAlert =
        settings.alertSetting == .enabled &&
        alertsEnabled
      let shouldUpdateBadge = settings.badgeSetting == .enabled && badgeEnabled
      guard shouldShowAlert || shouldUpdateBadge else {
        continue
      }

      let identifier = shouldShowAlert
        ? "review-hourly-\(hour)"
        : "badge-update-hourly-\(hour)"
      let content = UNMutableNotificationContent()

      if shouldShowAlert {
        content.title = "\(reviews) new review\(reviews == 1 ? "" : "s") available"
        content.body = "You have \(cumulativeReviews) review\(cumulativeReviews == 1 ? "" : "s") waiting"
        content.categoryIdentifier = kakehashiReviewNotificationCategoryIdentifier
        content.threadIdentifier = kakehashiReviewNotificationThreadIdentifier
      }

      content.userInfo = [
        kakehashiReviewNotificationMarkerKey: true,
        kakehashiReviewAlertMarkerKey: shouldShowAlert,
        "reviewCount": cumulativeReviews,
        "newReviews": reviews,
      ]

      if shouldUpdateBadge {
        content.badge = NSNumber(value: cumulativeReviews)
      }

      if shouldShowAlert && settings.soundSetting == .enabled && soundsEnabled {
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
      
      let shouldShowAlert =
        settings.alertSetting == .enabled &&
        alertsEnabled
      let shouldUpdateBadge = settings.badgeSetting == .enabled && badgeEnabled
      guard shouldShowAlert || shouldUpdateBadge else {
        continue
      }

      let identifier = shouldShowAlert
        ? "review-exact-\(timeString)"
        : "badge-update-exact-\(timeString)"
      let content = UNMutableNotificationContent()

      if shouldShowAlert {
        content.title = "\(reviewCount) new review\(reviewCount == 1 ? "" : "s") available"
        content.body = "You now have \(cumulativeReviews) review\(cumulativeReviews == 1 ? "" : "s") waiting"
        content.categoryIdentifier = kakehashiReviewNotificationCategoryIdentifier
        content.threadIdentifier = kakehashiReviewNotificationThreadIdentifier
      }

      content.userInfo = [
        kakehashiReviewNotificationMarkerKey: true,
        kakehashiReviewAlertMarkerKey: shouldShowAlert,
        "reviewCount": cumulativeReviews,
        "newReviews": reviewCount,
        "exactTime": true,
      ]

      if shouldUpdateBadge {
        content.badge = NSNumber(value: cumulativeReviews)
      }

      if shouldShowAlert && settings.soundSetting == .enabled && soundsEnabled {
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
      identifier: kakehashiReviewNotificationCategoryIdentifier,
      actions: [reviewAction],
      intentIdentifiers: [],
      hiddenPreviewsBodyPlaceholder: "Review update",
      categorySummaryFormat: "%u review updates",
      options: []
    )

    let center = UNUserNotificationCenter.current()
    center.getNotificationCategories { existingCategories in
      var categories = Set(existingCategories.filter {
        $0.identifier != kakehashiReviewNotificationCategoryIdentifier
      })
      categories.insert(category)
      center.setNotificationCategories(categories)
    }
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
        
        // Set badge to 99 for testing
        UIApplication.shared.applicationIconBadgeNumber = 99
        
        // Create notification content
        let content = UNMutableNotificationContent()
        content.title = "WaniKani Test Notification"
        content.body = "This is a test! You have 42 new reviews available."
        content.badge = NSNumber(value: 142) // Will change badge to 142 when notification arrives
        content.sound = UNNotificationSound.default
        content.categoryIdentifier = kakehashiReviewNotificationCategoryIdentifier
        content.threadIdentifier = kakehashiReviewNotificationThreadIdentifier
        content.userInfo = [
          kakehashiReviewNotificationMarkerKey: true,
          kakehashiReviewAlertMarkerKey: true,
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
