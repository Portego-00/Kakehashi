import Foundation
import Combine
import WatchConnectivity

struct ReviewSnapshot: Codable, Equatable {
  let currentReviews: Int
  let upcomingReviews: [Int]
  let upcomingReviewTimes: [String: Int]
  let lastUpdated: TimeInterval
  let isOnVacation: Bool
  let vacationStartedAt: String?

  var effectiveCurrentReviews: Int {
    isOnVacation ? 0 : currentReviews
  }

  var effectiveUpcomingReviews: [Int] {
    isOnVacation ? Array(repeating: 0, count: max(upcomingReviews.count, 24)) : upcomingReviews
  }

  var upcomingTotal: Int {
    effectiveUpcomingReviews.reduce(0, +)
  }

  var nextHourCount: Int {
    effectiveUpcomingReviews.first ?? 0
  }

  var lastUpdatedDate: Date {
    Date(timeIntervalSince1970: lastUpdated)
  }

  static let empty = ReviewSnapshot(
    currentReviews: 0,
    upcomingReviews: Array(repeating: 0, count: 24),
    upcomingReviewTimes: [:],
    lastUpdated: 0,
    isOnVacation: false,
    vacationStartedAt: nil
  )

  static func from(_ message: [String: Any]) -> ReviewSnapshot? {
    guard let currentReviews = intValue(message["currentReviews"]) else {
      return nil
    }

    let upcomingReviews = intArrayValue(message["upcomingReviews"])
    let upcomingReviewTimes = intDictionaryValue(message["upcomingReviewTimes"])
    let lastUpdated = doubleValue(message["lastUpdated"]) ?? Date().timeIntervalSince1970
    let isOnVacation = boolValue(message["isOnVacation"]) ?? false
    let vacationStartedAt = message["vacationStartedAt"] as? String

    return ReviewSnapshot(
      currentReviews: isOnVacation ? 0 : max(0, currentReviews),
      upcomingReviews: isOnVacation
        ? Array(repeating: 0, count: max(upcomingReviews.count, 24))
        : upcomingReviews.map { max(0, $0) },
      upcomingReviewTimes: isOnVacation ? [:] : upcomingReviewTimes,
      lastUpdated: lastUpdated,
      isOnVacation: isOnVacation,
      vacationStartedAt: vacationStartedAt
    )
  }

  private static func intArrayValue(_ value: Any?) -> [Int] {
    if let value = value as? [Int] {
      return value
    }

    if let value = value as? [NSNumber] {
      return value.map(\.intValue)
    }

    return []
  }

  private static func intDictionaryValue(_ value: Any?) -> [String: Int] {
    if let value = value as? [String: Int] {
      return value
    }

    if let value = value as? [String: NSNumber] {
      return value.mapValues(\.intValue)
    }

    return [:]
  }

  private static func boolValue(_ value: Any?) -> Bool? {
    if let value = value as? Bool {
      return value
    }

    if let value = value as? NSNumber {
      return value.boolValue
    }

    return nil
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

  private static func doubleValue(_ value: Any?) -> Double? {
    if let value = value as? Double {
      return value
    }

    if let value = value as? NSNumber {
      return value.doubleValue
    }

    if let value = value as? String {
      return Double(value)
    }

    return nil
  }

  func afterSubmittingOneReview() -> ReviewSnapshot {
    ReviewSnapshot(
      currentReviews: max(0, effectiveCurrentReviews - 1),
      upcomingReviews: effectiveUpcomingReviews,
      upcomingReviewTimes: isOnVacation ? [:] : upcomingReviewTimes,
      lastUpdated: Date().timeIntervalSince1970,
      isOnVacation: isOnVacation,
      vacationStartedAt: vacationStartedAt
    )
  }
}

struct WatchReviewCard: Codable, Equatable, Identifiable {
  let id: String
  let assignmentId: Int
  let subjectId: Int
  let subjectType: String
  let characters: String
  let meanings: [String]
  let readings: [String]
  let hasReading: Bool
  let srsStage: Int
  let availableAt: String?

  var subjectLabel: String {
    switch subjectType {
    case "radical":
      return "Radical"
    case "kanji":
      return "Kanji"
    default:
      return "Vocabulary"
    }
  }

  static func from(_ dictionary: [String: Any]) -> WatchReviewCard? {
    guard let assignmentId = intValue(dictionary["assignmentId"]),
          let subjectId = intValue(dictionary["subjectId"]),
          let subjectType = dictionary["subjectType"] as? String,
          let characters = dictionary["characters"] as? String else {
      return nil
    }

    let availableAt = dictionary["availableAt"] as? String
    let normalizedAvailableAt = availableAt.flatMap { $0.isEmpty ? nil : $0 }
    return WatchReviewCard(
      id: dictionary["id"] as? String ?? "\(assignmentId)",
      assignmentId: assignmentId,
      subjectId: subjectId,
      subjectType: subjectType,
      characters: characters,
      meanings: dictionary["meanings"] as? [String] ?? [],
      readings: dictionary["readings"] as? [String] ?? [],
      hasReading: boolValue(dictionary["hasReading"]) ?? false,
      srsStage: intValue(dictionary["srsStage"]) ?? 0,
      availableAt: normalizedAvailableAt
    )
  }

  private static func boolValue(_ value: Any?) -> Bool? {
    if let value = value as? Bool {
      return value
    }

    if let value = value as? NSNumber {
      return value.boolValue
    }

    return nil
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
}

struct WatchReviewSessionState: Equatable {
  var cards: [WatchReviewCard] = []
  var currentIndex = 0
  var completedCount = 0
  var isLoading = false
  var isAnswerRevealed = false
  var isSubmitting = false
  var errorMessage: String?

  var isActive: Bool {
    isLoading || !cards.isEmpty || errorMessage != nil
  }

  var currentCard: WatchReviewCard? {
    guard currentIndex >= 0, currentIndex < cards.count else {
      return nil
    }

    return cards[currentIndex]
  }

  var isComplete: Bool {
    !cards.isEmpty && currentIndex >= cards.count
  }

  var totalCount: Int {
    completedCount + max(0, cards.count - currentIndex)
  }

  static let idle = WatchReviewSessionState()
}

enum WatchConnectionState: Equatable {
  case inactive
  case activating
  case waitingForPhone
  case live
  case stale
  case error(String)

  var label: String {
    switch self {
    case .inactive:
      return "Not connected"
    case .activating:
      return "Connecting"
    case .waitingForPhone:
      return "Open Kakehashi on iPhone"
    case .live:
      return "Synced"
    case .stale:
      return "Needs refresh"
    case .error:
      return "Sync issue"
    }
  }
}

@MainActor
final class WatchReviewStore: NSObject, ObservableObject {
  @Published private(set) var snapshot: ReviewSnapshot = .empty
  @Published private(set) var connectionState: WatchConnectionState = .inactive
  @Published private(set) var reviewSession: WatchReviewSessionState = .idle

  private let cacheKey = "kakehashi.watch.reviewSnapshot"
  private var session: WCSession? {
    WCSession.isSupported() ? WCSession.default : nil
  }

  override init() {
    super.init()
    loadCachedSnapshot()
    activate()
  }

  func activate() {
    guard let session else {
      connectionState = .error("WatchConnectivity unavailable")
      return
    }

    connectionState = .activating
    session.delegate = self
    session.activate()
  }

  func refresh() {
    guard let session else {
      connectionState = .error("WatchConnectivity unavailable")
      return
    }

    if session.activationState != .activated {
      activate()
      return
    }

    let message: [String: Any] = ["command": "requestReviewData"]
    session.sendMessage(message) { [weak self] reply in
      Task { @MainActor in
        self?.apply(message: reply)
      }
    } errorHandler: { [weak self] _ in
      Task { @MainActor in
        self?.connectionState = self?.snapshot.lastUpdated == 0 ? .waitingForPhone : .stale
      }
    }
  }

  func startReviewSession() {
    guard !snapshot.isOnVacation else {
      reviewSession = WatchReviewSessionState(
        errorMessage: "Vacation mode is on."
      )
      return
    }

    guard snapshot.effectiveCurrentReviews > 0 else {
      reviewSession = WatchReviewSessionState(
        errorMessage: "No reviews ready."
      )
      return
    }

    guard let session else {
      reviewSession = WatchReviewSessionState(
        errorMessage: "WatchConnectivity unavailable."
      )
      return
    }

    if session.activationState != .activated {
      activate()
      reviewSession = WatchReviewSessionState(
        errorMessage: "Open Kakehashi on iPhone, then try again."
      )
      return
    }

    reviewSession = WatchReviewSessionState(isLoading: true)
    session.sendMessage(["command": "requestReviewSession", "limit": 10]) { [weak self] reply in
      Task { @MainActor in
        self?.applyReviewSessionReply(reply)
      }
    } errorHandler: { [weak self] _ in
      Task { @MainActor in
        self?.reviewSession = WatchReviewSessionState(
          errorMessage: "Keep your iPhone nearby and open Kakehashi."
        )
      }
    }
  }

  func revealAnswer() {
    guard reviewSession.currentCard != nil, !reviewSession.isSubmitting else {
      return
    }

    reviewSession.isAnswerRevealed = true
  }

  func submitCurrentCard(correct: Bool) {
    guard let card = reviewSession.currentCard,
          reviewSession.isAnswerRevealed,
          !reviewSession.isSubmitting,
          let session else {
      return
    }

    reviewSession.isSubmitting = true
    let meaningIncorrect = correct ? 0 : 1
    let readingIncorrect = correct ? 0 : (card.hasReading ? 1 : 0)
    let message: [String: Any] = [
      "command": "submitWatchReview",
      "assignmentId": card.assignmentId,
      "meaningIncorrect": meaningIncorrect,
      "readingIncorrect": readingIncorrect,
    ]

    session.sendMessage(message) { [weak self] reply in
      Task { @MainActor in
        self?.handleReviewSubmissionReply(reply)
      }
    } errorHandler: { [weak self] _ in
      Task { @MainActor in
        self?.reviewSession.isSubmitting = false
        self?.reviewSession.errorMessage = "Could not reach iPhone to submit."
      }
    }
  }

  func closeReviewSession() {
    reviewSession = .idle
  }

  private func loadCachedSnapshot() {
    guard let data = UserDefaults.standard.data(forKey: cacheKey),
          let cachedSnapshot = try? JSONDecoder().decode(ReviewSnapshot.self, from: data) else {
      return
    }

    snapshot = cachedSnapshot
    connectionState = .stale
  }

  private func cache(_ snapshot: ReviewSnapshot) {
    guard let data = try? JSONEncoder().encode(snapshot) else {
      return
    }

    UserDefaults.standard.set(data, forKey: cacheKey)
  }

  private func apply(message: [String: Any]) {
    guard let incomingSnapshot = ReviewSnapshot.from(message) else {
      if snapshot.lastUpdated == 0 {
        connectionState = .waitingForPhone
      }
      return
    }

    snapshot = incomingSnapshot
    cache(incomingSnapshot)
    connectionState = .live
  }

  private func applyReviewSessionReply(_ reply: [String: Any]) {
    guard reply["kind"] as? String == "reviewSession" else {
      reviewSession = WatchReviewSessionState(
        errorMessage: "The iPhone sent an unexpected response."
      )
      return
    }

    if reply["isOnVacation"] as? Bool == true {
      snapshot = ReviewSnapshot(
        currentReviews: 0,
        upcomingReviews: Array(repeating: 0, count: 24),
        upcomingReviewTimes: [:],
        lastUpdated: Date().timeIntervalSince1970,
        isOnVacation: true,
        vacationStartedAt: snapshot.vacationStartedAt
      )
      cache(snapshot)
    }

    let cards = (reply["cards"] as? [[String: Any]] ?? []).compactMap(WatchReviewCard.from)
    if cards.isEmpty {
      reviewSession = WatchReviewSessionState(
        errorMessage: reply["error"] as? String ?? "No reviews ready."
      )
      return
    }

    reviewSession = WatchReviewSessionState(cards: cards)
  }

  private func handleReviewSubmissionReply(_ reply: [String: Any]) {
    guard reply["kind"] as? String == "reviewSubmission",
          reply["success"] as? Bool == true else {
      reviewSession.isSubmitting = false
      reviewSession.errorMessage = reply["error"] as? String ?? "Review submission failed."
      return
    }

    reviewSession.isSubmitting = false
    reviewSession.isAnswerRevealed = false
    reviewSession.completedCount += 1
    reviewSession.currentIndex += 1

    snapshot = snapshot.afterSubmittingOneReview()
    cache(snapshot)
  }
}

extension WatchReviewStore: WCSessionDelegate {
  nonisolated func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    Task { @MainActor in
      if let error {
        connectionState = .error(error.localizedDescription)
        return
      }

      connectionState = activationState == .activated ? .waitingForPhone : .inactive
      refresh()
    }
  }

  #if os(iOS)
  nonisolated func sessionDidBecomeInactive(_ session: WCSession) {}

  nonisolated func sessionDidDeactivate(_ session: WCSession) {
    session.activate()
  }
  #endif

  nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
    Task { @MainActor in
      guard session.isReachable else {
        if snapshot.lastUpdated == 0 {
          connectionState = .waitingForPhone
        }
        return
      }

      refresh()
    }
  }

  nonisolated func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    Task { @MainActor in
      apply(message: applicationContext)
    }
  }

  nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    Task { @MainActor in
      apply(message: message)
    }
  }
}
