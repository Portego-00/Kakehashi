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
import CryptoKit
import UIKit
import SDWebImage
import SDWebImageSVGCoder

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

// Keep the Watch forecast and its totals in one pass over the same assignments.
// Exact timestamps survive time-zone changes; the Watch chooses local hour labels.
func makeKakehashiReviewPayloadFromAssignments(
  assignments: [[String: Any]],
  now: Date = Date(),
  hoursAhead: Int = 24,
  isOnVacation: Bool = false,
  vacationStartedAt: String? = nil
) -> [String: Any] {
  let horizonHours = max(1, min(64, hoursAhead))
  var upcoming = Array(repeating: 0, count: horizonHours)
  var exactTimes: [String: Int] = [:]
  var currentSubjects = ["radical": 0, "kanji": 0, "vocabulary": 0]
  var details: [String: [String: Any]] = [:]
  var currentReviews = 0
  let formatter = ISO8601DateFormatter()
  formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
  let fallback = ISO8601DateFormatter()
  let horizon = now.addingTimeInterval(Double(horizonHours) * 3600)

  if !isOnVacation {
    for assignment in assignments {
      guard let data = assignment["data"] as? [String: Any],
            data["hidden"] as? Bool != true,
            data["started_at"] as? String != nil,
            let stage = (data["srs_stage"] as? NSNumber)?.intValue,
            (1...8).contains(stage),
            let rawType = data["subject_type"] as? String,
            let dateString = data["available_at"] as? String,
            let availableAt = formatter.date(from: dateString) ?? fallback.date(from: dateString) else {
        continue
      }
      let subject = rawType == "kana_vocabulary" ? "vocabulary" : rawType
      guard currentSubjects[subject] != nil else { continue }
      if availableAt <= now {
        currentReviews += 1
        currentSubjects[subject, default: 0] += 1
        continue
      }
      guard availableAt < horizon else { continue }
      let hour = Int(availableAt.timeIntervalSince(now) / 3600)
      upcoming[hour] += 1
      let date = formatter.string(from: availableAt)
      exactTimes[date, default: 0] += 1
      var detail = details[date] ?? [
        "date": date, "count": 0, "radical": 0, "kanji": 0, "vocabulary": 0,
        "apprentice": 0, "guru": 0, "master": 0, "enlightened": 0,
      ]
      let srs = stage <= 4 ? "apprentice" : stage <= 6 ? "guru" : stage == 7 ? "master" : "enlightened"
      detail["count"] = (detail["count"] as? Int ?? 0) + 1
      detail[subject] = (detail[subject] as? Int ?? 0) + 1
      detail[srs] = (detail[srs] as? Int ?? 0) + 1
      details[date] = detail
    }
  }

  return makeKakehashiReviewPayload(
    currentReviews: currentReviews,
    upcomingReviews: upcoming,
    upcomingReviewTimes: exactTimes,
    lastUpdated: now.timeIntervalSince1970,
    isOnVacation: isOnVacation,
    vacationStartedAt: vacationStartedAt,
    currentSubjectCounts: currentSubjects,
    forecastBreakdown: details.keys.sorted().compactMap { details[$0] }
  )
}

func makeKakehashiReviewPayload(
  currentReviews: Int,
  upcomingReviews: [Int],
  upcomingReviewTimes: [String: Int]?,
  lastUpdated: TimeInterval = Date().timeIntervalSince1970,
  isOnVacation: Bool = false,
  vacationStartedAt: String? = nil,
  currentSubjectCounts: [String: Int]? = nil,
  forecastBreakdown: [[String: Any]]? = nil
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
  if isOnVacation {
    payload["currentSubjectCounts"] = ["radical": 0, "kanji": 0, "vocabulary": 0]
    payload["forecastBreakdown"] = [[String: Any]]()
  } else {
    if let currentSubjectCounts {
      payload["currentSubjectCounts"] = currentSubjectCounts
    }
    if let forecastBreakdown {
      payload["forecastBreakdown"] = forecastBreakdown
    }
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
  currentSubjectCounts: [String: Int]? = nil,
  forecastBreakdown: [[String: Any]]? = nil,
  logPrefix: String = "Kakehashi"
) -> Bool {
  let payload = makeKakehashiReviewPayload(
    currentReviews: currentReviews,
    upcomingReviews: upcomingReviews,
    upcomingReviewTimes: upcomingReviewTimes,
    isOnVacation: isOnVacation,
    vacationStartedAt: vacationStartedAt,
    currentSubjectCounts: currentSubjectCounts,
    forecastBreakdown: forecastBreakdown
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

  func update(with incomingPayload: [String: Any]) {
    KakehashiWatchReviewAPI.resolveSnapshot(incomingPayload) { [weak self] payload in
      guard let payload else { return }
      self?.sendSnapshot(payload)
    }
  }

  private func sendSnapshot(_ payload: [String: Any]) {
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

  private func publishSnapshot(_ payload: [String: Any]) {
    UserDefaults(suiteName: kakehashiAppGroupIdentifier)?.set(payload, forKey: kakehashiReviewDataKey)
    update(with: payload)
  }

  private func finishSubmission(_ result: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
    guard result["success"] as? Bool == true else { replyHandler(result); return }
    if let snapshot = result["snapshot"] as? [String: Any] {
      publishSnapshot(snapshot)
      replyHandler(result)
    } else {
      // After an iPhone relaunch, reconcile an acknowledged answer against fresh
      // assignments instead of decrementing an old count a second time.
      KakehashiWatchReviewAPI.refreshSnapshot { [weak self] payload in
        var reply = result
        if payload["error"] == nil {
          var snapshot = payload
          var identifiers = payload["acknowledgedSubmissionIds"] as? [String] ?? []
          if let id = result["submissionId"] as? String, !identifiers.contains(id) { identifiers.insert(id, at: 0) }
          snapshot["acknowledgedSubmissionIds"] = Array(identifiers.prefix(256))
          self?.publishSnapshot(snapshot)
          reply["snapshot"] = snapshot
        }
        replyHandler(reply)
      }
    }
  }

}

// Reuse Expo Image's existing SVG decoder on iPhone. Watch receives a compact
// transparent PNG with the card, so studying never needs a second image request.
private func renderKakehashiWatchRadicalImage(_ data: Data, isSVG: Bool) -> Data? {
  let side: CGFloat = 144
  let image = isSVG
    ? SDImageSVGCoder.shared.decodedImage(with: data, options: [
        .decodeThumbnailPixelSize: NSValue(cgSize: CGSize(width: side, height: side))
      ])
    : UIImage(data: data)
  guard let image, image.size.width > 0, image.size.height > 0 else { return nil }
  let format = UIGraphicsImageRendererFormat()
  format.scale = 1
  format.opaque = false
  let scale = min(side / image.size.width, side / image.size.height)
  let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
  let rect = CGRect(x: (side - size.width) / 2, y: (side - size.height) / 2,
                    width: size.width, height: size.height)
  let png = UIGraphicsImageRenderer(size: CGSize(width: side, height: side), format: format)
    .pngData { _ in image.draw(in: rect) }
  return png.count <= 16_000 ? png : nil
}

private enum KakehashiWatchReviewAPI {
  private struct WatchAssignment {
    let assignmentId: Int
    let subjectId: Int
    let srsStage: Int
    let availableAt: String?
  }

  private struct PreparedSession {
    let accountIdentifier: String
    let assignments: [WatchAssignment]
    let createdAt: Date
  }

  private struct SubmissionReceipt: Codable {
    let submissionId: String
    let assignmentId: Int
    let availableAt: String
    let reviewedAt: String
    let meaningIncorrect: Int
    let readingIncorrect: Int
    var completedAt: Date?
  }

  private static let workQueue = DispatchQueue(label: "com.kakehashi.watch.api")
  private static let receiptKey = "kakehashi.watch.submissionReceipts.v1"
  private static let subjectCacheKey = "kakehashi.watch.subjectCache.v2"
  private static var accountIdentifier: String?
  private static var receipts: [String: SubmissionReceipt] = [:]
  private static var inFlightSubmissions: [String: [([String: Any]) -> Void]] = [:]
  private static var sessions: [String: PreparedSession] = [:]
  private static var cachedAssignments: [[String: Any]]?
  private static var assignmentsUpdatedAt = Date.distantPast
  private static var assignmentWaiters: [String: [(Result<[[String: Any]], Error>) -> Void]] = [:]
  private static var assignmentMutations: [Int: (assignment: [String: Any], recordedAt: Date)] = [:]
  private static var subjectCache: [Int: [String: Any]] = [:]
  private static var subjectsUpdatedAt = Date.distantPast

  private static func accountScope(_ token: String) -> String {
    SHA256.hash(data: Data(token.utf8)).map { String(format: "%02x", $0) }.joined()
  }

  // Every mutable value below is accessed on workQueue. Account changes invalidate
  // prepared cards and receipts before any new request can use them.
  private static func prepareAccount(_ auth: KakehashiNativeAuthSessionSnapshot) {
    let scope = accountScope(auth.apiToken)
    guard accountIdentifier != scope else { return }
    accountIdentifier = scope
    cachedAssignments = nil
    assignmentsUpdatedAt = .distantPast
    sessions.removeAll()
    assignmentMutations.removeAll()
    receipts.removeAll()
    if let stored = UserDefaults.standard.dictionary(forKey: receiptKey),
       stored["accountIdentifier"] as? String == scope,
       let data = stored["receipts"] as? Data,
       let saved = try? JSONDecoder().decode([String: SubmissionReceipt].self, from: data) {
      receipts = saved
    }
    if subjectCache.isEmpty,
       let stored = UserDefaults.standard.dictionary(forKey: subjectCacheKey),
       let date = stored["updatedAt"] as? Date,
       Date().timeIntervalSince(date) < 86_400,
       let subjects = stored["subjects"] as? [[String: Any]] {
      for subject in subjects {
        if let id = intValue(subject["id"]) { subjectCache[id] = subject }
      }
      subjectsUpdatedAt = date
    }
  }

  // WatchConnectivity messages and contexts have a small payload limit. Keep
  // exact dates normally; unusually fragmented forecasts collapse to quarter-hour
  // ends. This also aligns with local hours in half/quarter-hour time zones.
  private static func boundedSnapshot(_ payload: [String: Any]) -> [String: Any] {
    guard let encoded = try? PropertyListSerialization.data(fromPropertyList: payload, format: .binary, options: 0),
          encoded.count > 45_000 else { return payload }
    let times = payload["upcomingReviewTimes"] as? [String: Int] ?? [:]
    let details = payload["forecastBreakdown"] as? [[String: Any]] ?? []
    let updatedAt = Date(timeIntervalSince1970: (payload["lastUpdated"] as? Double) ?? Date().timeIntervalSince1970)
    let horizon = updatedAt.addingTimeInterval(24 * 3600)
    var dates: [Int: Date] = [:]
    var counts: [Int: Int] = [:]
    var breakdown: [Int: [String: Any]] = [:]
    func bucket(_ value: String) -> Int? {
      guard let date = parseISODate(value), date <= horizon else { return nil }
      let hour = Int(ceil(date.timeIntervalSince1970 / 900))
      dates[hour] = min(Date(timeIntervalSince1970: Double(hour) * 900), horizon)
      return hour
    }
    for (date, count) in times {
      if let hour = bucket(date) { counts[hour, default: 0] += count }
    }
    let fields = ["count", "radical", "kanji", "vocabulary", "apprentice", "guru", "master", "enlightened"]
    for detail in details {
      guard let date = detail["date"] as? String, let hour = bucket(date) else { continue }
      var value = breakdown[hour] ?? [:]
      for field in fields { value[field] = (value[field] as? Int ?? 0) + (detail[field] as? Int ?? 0) }
      breakdown[hour] = value
    }
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    var result = payload
    result["upcomingReviewTimes"] = Dictionary(uniqueKeysWithValues: counts.map { (formatter.string(from: dates[$0.key]!), $0.value) })
    result["forecastPrecision"] = "quarterHour"
    result["forecastBreakdown"] = breakdown.keys.sorted().map { hour -> [String: Any] in
      var value = breakdown[hour]!
      value["date"] = formatter.string(from: dates[hour]!)
      return value
    }
    return result
  }

  static func decoratedSnapshot(_ payload: [String: Any]) -> [String: Any] {
    var result = boundedSnapshot(payload)
    if let auth = KakehashiNativeAuthSession.shared.snapshot() {
      result["accountIdentifier"] = accountScope(auth.apiToken)
    }
    return result
  }

  static func resolveSnapshot(_ payload: [String: Any], completion: @escaping ([String: Any]?) -> Void) {
    let enqueuedAuth = KakehashiNativeAuthSession.shared.snapshot()
    workQueue.async {
      guard let auth = enqueuedAuth else {
        completion(KakehashiNativeAuthSession.shared.snapshot() == nil ? payload : nil)
        return
      }
      guard KakehashiNativeAuthSession.shared.isCurrent(auth),
            (payload["accountIdentifier"] as? String).map({ $0 == accountScope(auth.apiToken) }) ?? true else {
        completion(nil)
        return
      }
      prepareAccount(auth)
      // Mobile aggregates can come from JS's cached assignments even when their
      // timestamp is new. Once native Watch answers exist, only assignment data
      // can prove that both counts and acknowledgements include those answers.
      if payload["acknowledgedSubmissionIds"] != nil || !receipts.values.contains(where: { $0.completedAt != nil }) {
        completion(decoratedSnapshot(payload))
        return
      }
      fetchAssignments(auth: auth, forceRefresh: false) { result in
        guard KakehashiNativeAuthSession.shared.isCurrent(auth) else { completion(nil); return }
        switch result {
        case .success(let assignments): completion(snapshotPayload(assignments: assignments))
        case .failure: completion(nil) // Preserve the last coherent snapshot until refresh succeeds.
        }
      }
    }
  }

  static func loadReviewSession(
    cursor: String? = nil,
    excludedAssignmentIds: [Int] = [],
    completion: @escaping ([String: Any]) -> Void
  ) {
    workQueue.async {
      guard let auth = KakehashiNativeAuthSession.shared.snapshot() else {
        completion(reviewSessionError("Open Kakehashi on iPhone once so the watch can sync your account."))
        return
      }
      prepareAccount(auth)
      guard !UserDefaults.standard.bool(forKey: kakehashiVacationModeKey) else {
        completion(["kind": "reviewSession", "cards": [], "isOnVacation": true, "error": "Vacation mode is on."])
        return
      }
      if let cursor {
        let parts = cursor.split(separator: ":")
        guard parts.count == 2, let offset = Int(parts[1]), offset >= 0,
              let session = sessions[String(parts[0])],
              session.accountIdentifier == accountIdentifier,
              Date().timeIntervalSince(session.createdAt) < 86_400 else {
          completion(reviewSessionError("Your review list expired. Open reviews again to continue."))
          return
        }
        deliverPage(session: session, sessionId: String(parts[0]), offset: offset, auth: auth, completion: completion)
        return
      }
      fetchAssignments(auth: auth, forceRefresh: false) { result in
        guard KakehashiNativeAuthSession.shared.isCurrent(auth) else {
          completion(reviewSessionError("Your iPhone account changed. Refresh to continue."))
          return
        }
        switch result {
        case .success(let rawAssignments):
          let now = Date()
          let excluded = Set(excludedAssignmentIds)
          let answeredCycles = Set(receipts.values.map { "\($0.assignmentId):\($0.availableAt)" })
          let assignments = rawAssignments.compactMap(parseAssignment).filter { assignment in
            guard !excluded.contains(assignment.assignmentId), let availableAt = assignment.availableAt,
                  let date = parseISODate(availableAt), date <= now else { return false }
            return !answeredCycles.contains("\(assignment.assignmentId):\(availableAt)")
          }.sorted { first, second in
            first.srsStage == second.srsStage ? first.assignmentId < second.assignmentId : first.srsStage < second.srsStage
          }
          let session = PreparedSession(accountIdentifier: accountScope(auth.apiToken), assignments: assignments, createdAt: now)
          let sessionId = UUID().uuidString
          sessions = sessions.filter { now.timeIntervalSince($0.value.createdAt) < 86_400 }
          sessions[sessionId] = session
          if sessions.count > 4 {
            let retained = Set(sessions.sorted { $0.value.createdAt > $1.value.createdAt }.prefix(4).map { $0.key })
            sessions = sessions.filter { retained.contains($0.key) }
          }
          deliverPage(session: session, sessionId: sessionId, offset: 0, auth: auth, completion: completion)
        case .failure(let error): completion(reviewSessionError(error.localizedDescription))
        }
      }
    }
  }

  private static func deliverPage(
    session: PreparedSession, sessionId: String, offset: Int,
    auth: KakehashiNativeAuthSessionSnapshot,
    completion: @escaping ([String: Any]) -> Void
  ) {
    let end = min(offset + 40, session.assignments.count)
    guard offset <= end else {
      completion(reviewSessionError("The review list could not be continued. Open reviews again."))
      return
    }
    let page = Array(session.assignments[offset..<end])
    fetchSubjects(apiToken: auth.apiToken, subjectIds: page.map { $0.subjectId }) { result in
      guard KakehashiNativeAuthSession.shared.isCurrent(auth) else {
        completion(reviewSessionError("Your iPhone account changed. Refresh to continue."))
        return
      }
      switch result {
      case .success(let subjects):
        let cards = buildCards(assignments: page, subjects: subjects)
        guard cards.count == page.count else {
          completion(reviewSessionError("Some review subjects could not be loaded. Try again."))
          return
        }
        var deliveredCards = cards
        var reply: [String: Any] = ["kind": "reviewSession", "cards": deliveredCards,
          "totalCount": session.assignments.count, "accountIdentifier": session.accountIdentifier]
        while deliveredCards.count > 1,
              (try? PropertyListSerialization.data(fromPropertyList: reply, format: .binary, options: 0).count) ?? 0 > 48_000 {
          deliveredCards.removeLast()
          reply["cards"] = deliveredCards
        }
        guard (try? PropertyListSerialization.data(fromPropertyList: reply, format: .binary, options: 0).count) ?? 0 <= 48_000 else {
          completion(reviewSessionError("This subject is too large to send to your watch. Continue this review on iPhone."))
          return
        }
        let nextOffset = offset + deliveredCards.count
        if nextOffset < session.assignments.count { reply["nextCursor"] = "\(sessionId):\(nextOffset)" }
        completion(reply)
      case .failure(let error): completion(reviewSessionError(error.localizedDescription))
      }
    }
  }

  static func refreshSnapshot(completion: @escaping ([String: Any]) -> Void) {
    workQueue.async {
      guard let auth = KakehashiNativeAuthSession.shared.snapshot() else {
        completion(["error": "Open Kakehashi on iPhone once so the watch can sync your account."])
        return
      }
      prepareAccount(auth)
      fetchAssignments(auth: auth, forceRefresh: true) { result in
        guard KakehashiNativeAuthSession.shared.isCurrent(auth) else {
          completion(["error": "Your iPhone account changed. Refresh to continue."])
          return
        }
        switch result {
        case .success(let assignments): completion(snapshotPayload(assignments: assignments))
        case .failure(let error): completion(["error": error.localizedDescription])
        }
      }
    }
  }

  private static func snapshotPayload(assignments: [[String: Any]]) -> [String: Any] {
    var payload = makeKakehashiReviewPayloadFromAssignments(
      assignments: assignments,
      isOnVacation: UserDefaults.standard.bool(forKey: kakehashiVacationModeKey),
      vacationStartedAt: UserDefaults.standard.string(forKey: kakehashiVacationStartedAtKey)
    )
    payload["acknowledgedSubmissionIds"] = acknowledgedSubmissionIds()
    payload["accountIdentifier"] = accountIdentifier
    return boundedSnapshot(payload)
  }

  private static func acknowledgedSubmissionIds() -> [String] {
    receipts.values.filter { $0.completedAt != nil }
      .sorted { $0.completedAt! > $1.completedAt! }.prefix(256).map { $0.submissionId }
  }

  static func submitReview(
    assignmentId: Int, submissionId: String, availableAt: String, reviewedAt: String,
    account: String?, meaningIncorrect: Int, readingIncorrect: Int,
    completion: @escaping ([String: Any]) -> Void
  ) {
    workQueue.async {
      guard let auth = KakehashiNativeAuthSession.shared.snapshot() else {
        completion(reviewSubmissionError("Open Kakehashi on iPhone once so the watch can sync your account.", submissionId: submissionId))
        return
      }
      prepareAccount(auth)
      guard account == nil || account == accountIdentifier else {
        completion(reviewSubmissionError("This answer belongs to a different iPhone account.", submissionId: submissionId, retryable: false))
        return
      }
      guard !submissionId.isEmpty, assignmentId > 0,
            let dueDate = parseISODate(availableAt), let answerDate = parseISODate(reviewedAt),
            answerDate >= dueDate, answerDate <= Date().addingTimeInterval(60) else {
        completion(reviewSubmissionError("This review is missing its original due time. Refresh reviews on your watch.", submissionId: submissionId, retryable: false))
        return
      }
      if let receipt = receipts[submissionId] {
        guard receipt.assignmentId == assignmentId, receipt.availableAt == availableAt,
              receipt.reviewedAt == reviewedAt, receipt.meaningIncorrect == meaningIncorrect,
              receipt.readingIncorrect == readingIncorrect else {
          completion(reviewSubmissionError("This saved answer does not match the original submission.", submissionId: submissionId, retryable: false))
          return
        }
        if receipt.completedAt != nil {
          completion(successReply(receipt: receipt, newlyAcknowledged: false))
          return
        }
      }
      if inFlightSubmissions[submissionId] != nil {
        inFlightSubmissions[submissionId]?.append(completion)
        return
      }
      let previousReceipt = receipts[submissionId]
      let receipt = previousReceipt ?? SubmissionReceipt(submissionId: submissionId,
        assignmentId: assignmentId, availableAt: availableAt, reviewedAt: reviewedAt,
        meaningIncorrect: max(0, meaningIncorrect), readingIncorrect: max(0, readingIncorrect), completedAt: nil)
      receipts[submissionId] = receipt
      persistReceipts()
      inFlightSubmissions[submissionId] = [completion]
      let cachedAssignment = cachedAssignments?.first { intValue($0["id"]) == assignmentId }
      let cachedDueAt = (cachedAssignment?["data"] as? [String: Any])?["available_at"] as? String
      let hasCurrentCycle = Date().timeIntervalSince(assignmentsUpdatedAt) < 60 &&
        cachedDueAt.flatMap(parseISODate) == dueDate
      if previousReceipt != nil || !hasCurrentCycle {
        reconcile(receipt: receipt, auth: auth, retryIfUnchanged: true)
      } else {
        postReview(receipt: receipt, auth: auth)
      }
    }
  }

  private static func postReview(receipt: SubmissionReceipt, auth: KakehashiNativeAuthSessionSnapshot) {
    guard let url = URL(string: "\(waniKaniAPIBaseURL)/reviews") else { return }
    var request = authorizedRequest(url: url, apiToken: auth.apiToken)
    request.httpMethod = "POST"
    request.httpBody = try? JSONSerialization.data(withJSONObject: ["review": [
      "assignment_id": receipt.assignmentId,
      "incorrect_meaning_answers": receipt.meaningIncorrect,
      "incorrect_reading_answers": receipt.readingIncorrect,
      // Binding the attempt to the original answer time also prevents a delayed
      // retry from accidentally grading the next SRS cycle.
      "created_at": receipt.reviewedAt,
    ]])
    URLSession.shared.dataTask(with: request) { data, response, error in
      workQueue.async {
        guard KakehashiNativeAuthSession.shared.isCurrent(auth) else {
          finishSubmission(receipt.submissionId, reply: reviewSubmissionError("Your iPhone account changed. Refresh to continue.", submissionId: receipt.submissionId, retryable: false))
          return
        }
        if let error {
          finishSubmission(receipt.submissionId, reply: reviewSubmissionError(error.localizedDescription, submissionId: receipt.submissionId))
          return
        }
        guard let http = response as? HTTPURLResponse else {
          finishSubmission(receipt.submissionId, reply: reviewSubmissionError("WaniKani did not return an HTTP response.", submissionId: receipt.submissionId))
          return
        }
        if (200..<300).contains(http.statusCode) {
          let json = data.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
          let assignment = (json?["resources_updated"] as? [String: Any])?["assignment"] as? [String: Any]
          completeReceipt(receipt, assignment: assignment)
        } else if http.statusCode == 422 {
          reconcile(receipt: receipt, auth: auth, retryIfUnchanged: false)
        } else {
          finishSubmission(receipt.submissionId, reply: reviewSubmissionError(
            apiErrorMessage(from: data) ?? "WaniKani returned HTTP \(http.statusCode).",
            submissionId: receipt.submissionId,
            retryable: http.statusCode == 408 || http.statusCode == 429 || http.statusCode >= 500))
        }
      }
    }.resume()
  }

  private static func reconcile(receipt: SubmissionReceipt, auth: KakehashiNativeAuthSessionSnapshot, retryIfUnchanged: Bool) {
    let url = URL(string: "\(waniKaniAPIBaseURL)/assignments/\(receipt.assignmentId)")!
    performJSONRequest(url: url, apiToken: auth.apiToken) { result in
      guard KakehashiNativeAuthSession.shared.isCurrent(auth) else {
        finishSubmission(receipt.submissionId, reply: reviewSubmissionError("Your iPhone account changed. Refresh to continue.", submissionId: receipt.submissionId, retryable: false))
        return
      }
      switch result {
      case .failure(let error):
        finishSubmission(receipt.submissionId, reply: reviewSubmissionError(error.localizedDescription, submissionId: receipt.submissionId))
      case .success(let assignment):
        let data = assignment["data"] as? [String: Any] ?? [:]
        let nextDate = (data["available_at"] as? String).flatMap(parseISODate)
        let originalDate = parseISODate(receipt.availableAt)!
        if (nextDate != nil && nextDate! > originalDate) || intValue(data["srs_stage"]) == 9 {
          completeReceipt(receipt, assignment: assignment)
        } else if nextDate == originalDate && retryIfUnchanged {
          postReview(receipt: receipt, auth: auth)
        } else {
          finishSubmission(receipt.submissionId, reply: reviewSubmissionError("This assignment changed or WaniKani rejected the answer. Refresh on iPhone before retrying.", submissionId: receipt.submissionId, retryable: false))
        }
      }
    }
  }

  private static func completeReceipt(_ receipt: SubmissionReceipt, assignment: [String: Any]?) {
    var completed = receipt
    completed.completedAt = Date()
    receipts[receipt.submissionId] = completed
    if let assignment {
      assignmentMutations[receipt.assignmentId] = (assignment, Date())
    }
    if let assignment, var assignments = cachedAssignments {
      if let index = assignments.firstIndex(where: { intValue($0["id"]) == receipt.assignmentId }) {
        assignments[index] = assignment
      }
      cachedAssignments = assignments
    } else {
      // A successful but incomplete response cannot safely become a fresh count.
      cachedAssignments = nil
      assignmentsUpdatedAt = .distantPast
    }
    persistReceipts()
    finishSubmission(receipt.submissionId, reply: successReply(receipt: completed, newlyAcknowledged: true))
  }

  private static func successReply(receipt: SubmissionReceipt, newlyAcknowledged: Bool) -> [String: Any] {
    var identifiers = acknowledgedSubmissionIds()
    if !identifiers.contains(receipt.submissionId) { identifiers.insert(receipt.submissionId, at: 0) }
    identifiers = Array(identifiers.prefix(256))
    var reply: [String: Any] = ["kind": "reviewSubmission", "success": true,
      "submissionId": receipt.submissionId, "assignmentId": receipt.assignmentId,
      "newlyAcknowledged": newlyAcknowledged, "acknowledgedSubmissionIds": identifiers]
    if let assignments = cachedAssignments {
      var snapshot = snapshotPayload(assignments: assignments)
      snapshot["acknowledgedSubmissionIds"] = identifiers
      reply["snapshot"] = snapshot
    }
    return reply
  }

  private static func finishSubmission(_ id: String, reply: [String: Any]) {
    let callbacks = inFlightSubmissions.removeValue(forKey: id) ?? []
    callbacks.forEach { $0(reply) }
  }

  private static func persistReceipts() {
    let cutoff = Date().addingTimeInterval(-30 * 86_400)
    receipts = receipts.filter { $0.value.completedAt == nil || $0.value.completedAt! >= cutoff }
    guard let accountIdentifier, let data = try? JSONEncoder().encode(receipts) else { return }
    UserDefaults.standard.set(["accountIdentifier": accountIdentifier, "receipts": data], forKey: receiptKey)
  }

  private static func fetchAssignments(
    auth: KakehashiNativeAuthSessionSnapshot, forceRefresh: Bool,
    completion: @escaping (Result<[[String: Any]], Error>) -> Void
  ) {
    if !forceRefresh, let cachedAssignments, Date().timeIntervalSince(assignmentsUpdatedAt) < 60 {
      completion(.success(cachedAssignments))
      return
    }
    let scope = accountScope(auth.apiToken)
    assignmentWaiters[scope, default: []].append(completion)
    guard assignmentWaiters[scope]?.count == 1 else { return }
    let requestStartedAt = Date()
    var components = URLComponents(string: "\(waniKaniAPIBaseURL)/assignments")!
    components.queryItems = [URLQueryItem(name: "hidden", value: "false"),
      URLQueryItem(name: "in_review", value: "true"),
      URLQueryItem(name: "available_before", value: ISO8601DateFormatter().string(from: Date().addingTimeInterval(25 * 3600)))]
    fetchCollection(url: components.url!, apiToken: auth.apiToken) { result in
      var resolved = result
      if KakehashiNativeAuthSession.shared.isCurrent(auth), case .success(let assignments) = result {
        // A refresh started before an answer must not overwrite that answer's
        // authoritative resources_updated.assignment when its GET finishes later.
        let merged = assignments.map { assignment -> [String: Any] in
          guard let id = intValue(assignment["id"]), let mutation = assignmentMutations[id],
                mutation.recordedAt >= requestStartedAt else { return assignment }
          return mutation.assignment
        }
        cachedAssignments = merged
        assignmentsUpdatedAt = Date()
        resolved = .success(merged)
        assignmentMutations = assignmentMutations.filter { $0.value.recordedAt >= requestStartedAt }
      }
      let callbacks = assignmentWaiters.removeValue(forKey: scope) ?? []
      callbacks.forEach { $0(resolved) }
    }
  }

  private static func fetchSubjects(apiToken: String, subjectIds: [Int], completion: @escaping (Result<[[String: Any]], Error>) -> Void) {
    if Date().timeIntervalSince(subjectsUpdatedAt) >= 86_400 {
      subjectCache.removeAll()
      subjectsUpdatedAt = Date()
    }
    let ids = Array(Set(subjectIds)).sorted()
    let missing = ids.filter { subjectCache[$0] == nil }
    func finish() {
      prepareCharacterImages(subjectIds: ids) { result in
        if case .success = result {
          UserDefaults.standard.set(["updatedAt": subjectsUpdatedAt, "subjects": Array(subjectCache.values)], forKey: subjectCacheKey)
        }
        completion(result.map { ids.compactMap { subjectCache[$0] } })
      }
    }
    func fetchChunk(_ offset: Int) {
      guard offset < missing.count else {
        finish()
        return
      }
      let end = min(offset + 100, missing.count)
      var components = URLComponents(string: "\(waniKaniAPIBaseURL)/subjects")!
      components.queryItems = [URLQueryItem(name: "ids", value: missing[offset..<end].map(String.init).joined(separator: ","))]
      fetchCollection(url: components.url!, apiToken: apiToken) { result in
        switch result {
        case .success(let subjects):
          for subject in subjects {
            if let id = intValue(subject["id"]), let data = subject["data"] as? [String: Any] {
              // Audio and context sentences are not used by Watch flashcards.
              let fields = ["characters", "meanings", "readings", "character_images"]
              subjectCache[id] = ["id": id, "object": subject["object"] as? String ?? "vocabulary",
                "data": data.filter { fields.contains($0.key) && !($0.value is NSNull) }]
            }
          }
          fetchChunk(end)
        case .failure(let error): completion(.failure(error))
        }
      }
    }
    guard !missing.isEmpty else { finish(); return }
    fetchChunk(0)
  }

  private static func prepareCharacterImages(
    subjectIds: [Int], completion: @escaping (Result<Void, Error>) -> Void
  ) {
    func prepare(_ index: Int) {
      guard index < subjectIds.count else { completion(.success(())); return }
      let id = subjectIds[index]
      guard var subject = subjectCache[id], var data = subject["data"] as? [String: Any] else {
        completion(.failure(apiError("A review subject could not be loaded. Try again.")))
        return
      }
      if let characters = data["characters"] as? String,
         !characters.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
        prepare(index + 1)
        return
      }
      if let encoded = data["watch_character_image"] as? String, !encoded.isEmpty {
        prepare(index + 1)
        return
      }
      let images = data["character_images"] as? [[String: Any]] ?? []
      let image = images.first { $0["content_type"] as? String == "image/svg+xml" }
        ?? images.first { $0["content_type"] as? String == "image/png" }
      guard let image, let address = image["url"] as? String,
            let url = URL(string: address), url.scheme == "https" else {
        completion(.failure(apiError("The radical image is unavailable. Refresh on iPhone and try again.")))
        return
      }
      // Public character images need no API Authorization header.
      var request = URLRequest(url: url)
      request.timeoutInterval = 20
      URLSession.shared.dataTask(with: request) { imageData, response, error in
        workQueue.async {
          guard error == nil, let http = response as? HTTPURLResponse,
                (200..<300).contains(http.statusCode), let imageData, imageData.count <= 1_000_000,
                let png = renderKakehashiWatchRadicalImage(imageData,
                  isSVG: image["content_type"] as? String == "image/svg+xml") else {
            completion(.failure(apiError("Couldn't load the radical image. Keep iPhone online and try again.")))
            return
          }
          data["watch_character_image"] = png.base64EncodedString()
          subject["data"] = data
          subjectCache[id] = subject
          prepare(index + 1)
        }
      }.resume()
    }
    prepare(0)
  }

  private static func fetchCollection(url: URL, apiToken: String, completion: @escaping (Result<[[String: Any]], Error>) -> Void) {
    var records: [[String: Any]] = []
    var visited = Set<URL>()
    func fetchPage(_ pageURL: URL) {
      guard pageURL.scheme == "https", pageURL.host == "api.wanikani.com", visited.insert(pageURL).inserted else {
        completion(.failure(apiError("WaniKani returned an invalid next page.")))
        return
      }
      performJSONRequest(url: pageURL, apiToken: apiToken) { result in
        switch result {
        case .success(let json):
          guard let page = json["data"] as? [[String: Any]] else {
            completion(.failure(apiError("WaniKani returned an unexpected review list.")))
            return
          }
          records.append(contentsOf: page)
          if let next = (json["pages"] as? [String: Any])?["next_url"] as? String,
             let nextURL = URL(string: next) { fetchPage(nextURL) }
          else { completion(.success(records)) }
        case .failure(let error): completion(.failure(error))
        }
      }
    }
    fetchPage(url)
  }

  private static func performJSONRequest(url: URL, apiToken: String, completion: @escaping (Result<[String: Any], Error>) -> Void) {
    URLSession.shared.dataTask(with: authorizedRequest(url: url, apiToken: apiToken)) { data, response, error in
      workQueue.async {
        if let error { completion(.failure(error)); return }
        guard let http = response as? HTTPURLResponse else {
          completion(.failure(apiError("WaniKani did not return an HTTP response."))); return
        }
        guard (200..<300).contains(http.statusCode) else {
          completion(.failure(apiError(apiErrorMessage(from: data) ?? "WaniKani returned HTTP \(http.statusCode)."))); return
        }
        guard let data, let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
          completion(.failure(apiError("WaniKani returned an unexpected response."))); return
        }
        completion(.success(json))
      }
    }.resume()
  }

  private static func authorizedRequest(url: URL, apiToken: String) -> URLRequest {
    var request = URLRequest(url: url)
    request.timeoutInterval = 25
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
    guard !hidden, srsStage > 0, srsStage < 9 else {
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
      let characters = displayCharacters ?? ""
      let imageData = subjectData["watch_character_image"] as? String
      guard !characters.isEmpty || imageData != nil else { return nil }
      var card: [String: Any] = [
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
      if let imageData { card["characterImageData"] = imageData }
      return card
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

  private static func reviewSubmissionError(_ message: String, submissionId: String, retryable: Bool = true) -> [String: Any] {
    [
      "kind": "reviewSubmission",
      "success": false,
      "submissionId": submissionId,
      "retryable": retryable,
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
      KakehashiWatchReviewAPI.refreshSnapshot { [weak self] payload in
        if payload["error"] == nil { self?.publishSnapshot(payload) }
        replyHandler(payload)
      }

    case "requestReviewSession":
      KakehashiWatchReviewAPI.loadReviewSession(
        cursor: message["cursor"] as? String,
        excludedAssignmentIds: message["excludedAssignmentIds"] as? [Int] ?? [],
        completion: replyHandler
      )

    case "submitWatchReview":
      guard let assignmentId = (message["assignmentId"] as? Int) ?? (message["assignmentId"] as? NSNumber)?.intValue,
            let submissionId = message["submissionId"] as? String,
            let availableAt = message["availableAt"] as? String,
            let reviewedAt = message["reviewedAt"] as? String else {
        replyHandler(["kind": "reviewSubmission", "success": false,
          "retryable": false, "error": "Update Kakehashi on your watch to sync saved answers."])
        return
      }
      KakehashiWatchReviewAPI.submitReview(
        assignmentId: assignmentId, submissionId: submissionId,
        availableAt: availableAt, reviewedAt: reviewedAt,
        account: message["accountIdentifier"] as? String,
        meaningIncorrect: (message["meaningIncorrect"] as? Int) ?? 0,
        readingIncorrect: (message["readingIncorrect"] as? Int) ?? 0
      ) { [weak self] reply in
        guard let self else { replyHandler(reply); return }
        self.finishSubmission(reply, replyHandler: replyHandler)
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
  vacationStartedAt: String? = nil,
  currentSubjectCounts: [String: Int]? = nil,
  forecastBreakdown: [[String: Any]]? = nil
) {
    _ = saveKakehashiReviewSnapshot(
      currentReviews: currentReviews,
      upcomingReviews: upcomingReviews,
      upcomingReviewTimes: upcomingReviewTimes,
      isOnVacation: isOnVacation,
      vacationStartedAt: vacationStartedAt,
      currentSubjectCounts: currentSubjectCounts,
      forecastBreakdown: forecastBreakdown,
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
        let currentSubjectCounts = reviewData["currentSubjectCounts"] as? [String: Int]
        let forecastBreakdown = reviewData["forecastBreakdown"] as? [[String: Any]]
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
	              vacationStartedAt: vacationStartedAt,
                  currentSubjectCounts: currentSubjectCounts,
                  forecastBreakdown: forecastBreakdown
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
