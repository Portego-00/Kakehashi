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
  var currentSubjectCounts: [String: Int]? = nil
  var forecastBreakdown: [WatchForecastDetail]? = nil

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
      vacationStartedAt: vacationStartedAt,
      currentSubjectCounts: isOnVacation ? nil : (message["currentSubjectCounts"] as? [String: Int]),
      forecastBreakdown: isOnVacation ? nil : WatchForecastDetail.decode(message["forecastBreakdown"])
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

  func replacingCurrentReviews(_ count: Int) -> ReviewSnapshot {
    var updated = ReviewSnapshot(
      currentReviews: isOnVacation ? 0 : max(0, count),
      upcomingReviews: effectiveUpcomingReviews,
      upcomingReviewTimes: isOnVacation ? [:] : upcomingReviewTimes,
      lastUpdated: lastUpdated,
      isOnVacation: isOnVacation,
      vacationStartedAt: vacationStartedAt,
      currentSubjectCounts: currentSubjectCounts,
      forecastBreakdown: forecastBreakdown
    )
    // A pending answer changes the total before a refreshed subject split arrives.
    if currentSubjectCounts?.values.reduce(0, +) != updated.effectiveCurrentReviews {
      updated.currentSubjectCounts = nil
    }
    return updated
  }

  func afterSubmittingOneReview() -> ReviewSnapshot {
    replacingCurrentReviews(effectiveCurrentReviews - 1)
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
  var characterImageData: String? = nil

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
      availableAt: normalizedAvailableAt,
      characterImageData: dictionary["characterImageData"] as? String
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
  var expectedTotalCount: Int? = nil
  var isLoadingMore = false
  var hasMoreCards = false

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
    !cards.isEmpty && currentIndex >= cards.count && !hasMoreCards && !isLoadingMore
  }

  var totalCount: Int {
    max(cards.count, expectedTotalCount ?? 0)
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

private struct WatchCachedReviewSnapshot: Codable {
  let snapshot: ReviewSnapshot
  let acknowledgedSubmissionIds: [String]
  let accountIdentifier: String?
}

@MainActor
final class WatchReviewStore: NSObject, ObservableObject {
  @Published private(set) var snapshot: ReviewSnapshot = .empty
  @Published private(set) var connectionState: WatchConnectionState = .inactive
  @Published private(set) var reviewSession: WatchReviewSessionState = .idle
  @Published private(set) var isRefreshing = false
  @Published private(set) var pendingSubmissionCount = 0
  @Published private(set) var isSyncingSubmissions = false
  @Published private(set) var submissionError: String?

  private let cacheKey = "kakehashi.watch.reviewSnapshot"
  private let defaults: UserDefaults
  private let outboxStorage: WatchReviewOutboxStorage
  private var outbox = WatchReviewOutbox()
  private var outboxLoadFailed = false
  private var serverSnapshot: ReviewSnapshot = .empty
  private var acknowledgedSubmissionIds: Set<String> = []
  private var accountIdentifier: String?
  private var reviewAccountIdentifier: String?
  private var reviewGeneration = UUID()
  private var nextReviewCursor: String?
  private var requestedReviewCursors: Set<String> = []
  private var reviewPageBaseCount = 0
  private var reviewLoadTimeout: Task<Void, Never>?
  private var refreshGeneration: UUID?
  private var refreshTimeout: Task<Void, Never>?
  private var submissionAttempt: (id: String, generation: UUID)?
  private var submissionTimeout: Task<Void, Never>?
  private var submissionRetry: Task<Void, Never>?

  #if DEBUG
  private var previewCards: [WatchReviewCard]?

  init(
    previewSnapshot: ReviewSnapshot,
    connectionState: WatchConnectionState,
    reviewSession: WatchReviewSessionState = .idle,
    previewCards: [WatchReviewCard] = []
  ) {
    defaults = .standard
    outboxStorage = WatchReviewOutboxStorage(url: WatchReviewOutboxStorage.defaultURL)
    super.init()
    self.snapshot = previewSnapshot
    self.serverSnapshot = previewSnapshot
    self.connectionState = connectionState
    self.reviewSession = reviewSession
    self.previewCards = previewCards
  }
  #endif

  private var session: WCSession? {
    #if DEBUG
    if previewCards != nil { return nil }
    #endif
    return WCSession.isSupported() ? WCSession.default : nil
  }

  override convenience init() {
    self.init(defaults: .standard, outboxURL: WatchReviewOutboxStorage.defaultURL)
  }

  init(defaults: UserDefaults, outboxURL: URL) {
    self.defaults = defaults
    outboxStorage = WatchReviewOutboxStorage(url: outboxURL)
    super.init()
    do {
      outbox = try outboxStorage.load()
    } catch {
      // Never overwrite an unreadable outbox: it may contain unsynced answers.
      outboxLoadFailed = true
      submissionError = "Saved answers couldn't be opened. Restart Kakehashi to try again."
    }
    loadCachedSnapshot()
    publishOutbox()
    activate()
  }

  deinit {
    reviewLoadTimeout?.cancel()
    refreshTimeout?.cancel()
    submissionTimeout?.cancel()
    submissionRetry?.cancel()
  }

  func activate() {
    #if DEBUG
    if previewCards != nil { return }
    #endif
    guard let session else {
      connectionState = .error("WatchConnectivity unavailable")
      return
    }
    connectionState = .activating
    session.delegate = self
    session.activate()
  }

  func refresh() {
    #if DEBUG
    if previewCards != nil {
      guard !isRefreshing else { return }
      isRefreshing = true
      refreshTimeout = Task { [weak self] in
        do { try await Task.sleep(nanoseconds: 1_000_000_000) } catch { return }
        self?.isRefreshing = false
      }
      return
    }
    #endif
    guard !isRefreshing else { return }
    guard let session else {
      connectionState = .error("WatchConnectivity unavailable")
      return
    }
    guard session.activationState == .activated else {
      activate()
      return
    }

    let generation = UUID()
    refreshGeneration = generation
    isRefreshing = true
    refreshTimeout?.cancel()
    refreshTimeout = Task { [weak self] in
      do { try await Task.sleep(nanoseconds: 30_000_000_000) } catch { return }
      guard let self, self.refreshGeneration == generation else { return }
      self.finishRefresh(generation: generation, failed: true)
    }
    session.sendMessage(["command": "requestReviewData"]) { [weak self] reply in
      Task { @MainActor in
        guard let self, self.refreshGeneration == generation else { return }
        guard reply["error"] == nil, ReviewSnapshot.from(reply) != nil else {
          self.finishRefresh(generation: generation, failed: true)
          return
        }
        self.apply(message: reply)
        self.finishRefresh(generation: generation, failed: false)
      }
    } errorHandler: { [weak self] _ in
      Task { @MainActor in
        self?.finishRefresh(generation: generation, failed: true)
      }
    }
    retryPendingSubmissions()
  }

  private func finishRefresh(generation: UUID, failed: Bool) {
    guard refreshGeneration == generation else { return }
    refreshTimeout?.cancel()
    refreshGeneration = nil
    isRefreshing = false
    if failed {
      connectionState = snapshot.lastUpdated == 0 ? .waitingForPhone : .stale
    }
  }

  func startReviewSession() {
    reviewGeneration = UUID()
    reviewLoadTimeout?.cancel()
    nextReviewCursor = nil
    requestedReviewCursors = []
    reviewPageBaseCount = 0
    reviewAccountIdentifier = accountIdentifier
    guard !snapshot.isOnVacation else {
      reviewSession = WatchReviewSessionState(errorMessage: "Vacation mode is on.")
      return
    }
    guard snapshot.effectiveCurrentReviews > 0 else {
      reviewSession = WatchReviewSessionState(errorMessage: "No reviews ready.")
      return
    }
    #if DEBUG
    if let previewCards {
      reviewSession = previewCards.isEmpty
        ? WatchReviewSessionState(errorMessage: "No reviews ready.")
        : WatchReviewSessionState(cards: previewCards)
      return
    }
    #endif
    reviewSession = WatchReviewSessionState(isLoading: true)
    requestReviewPage(cursor: nil, generation: reviewGeneration)
  }

  /// A failed/expired transport page resumes with all loaded assignments excluded.
  /// Completed questions remain in the session and never need to be answered twice.
  func retryReviewLoading() {
    reviewGeneration = UUID()
    reviewLoadTimeout?.cancel()
    nextReviewCursor = nil
    requestedReviewCursors = []
    reviewPageBaseCount = reviewSession.cards.count
    reviewSession.errorMessage = nil
    requestReviewPage(cursor: nil, generation: reviewGeneration)
  }

  private func requestReviewPage(cursor: String?, generation: UUID) {
    if let cursor, !requestedReviewCursors.insert(cursor).inserted {
      failReviewLoading("The iPhone repeated a review page. Retry to load the remaining reviews.", generation: generation)
      return
    }
    guard let session else {
      failReviewLoading("WatchConnectivity unavailable.", generation: generation)
      return
    }
    guard session.activationState == .activated else {
      activate()
      failReviewLoading("Open Kakehashi on iPhone, then try again.", generation: generation)
      return
    }
    reviewSession.isLoading = reviewSession.currentCard == nil
    reviewSession.isLoadingMore = true
    reviewSession.hasMoreCards = true
    let excluded = Set(outbox.items.map(\.assignmentId) + reviewSession.cards.map(\.assignmentId))
    var message: [String: Any] = ["command": "requestReviewSession"]
    if let cursor {
      message["cursor"] = cursor
    } else {
      // Keep the request below WatchConnectivity's message-size limit even after
      // a very large offline session. Every arriving card is also filtered locally.
      message["excludedAssignmentIds"] = Array(excluded.sorted().prefix(1_000))
    }
    reviewLoadTimeout?.cancel()
    reviewLoadTimeout = Task { [weak self] in
      do { try await Task.sleep(nanoseconds: 45_000_000_000) } catch { return }
      self?.failReviewLoading("Preparing reviews took too long. Keep your iPhone nearby and retry.",
                              generation: generation)
    }
    session.sendMessage(message) { [weak self] reply in
      Task { @MainActor in
        self?.applyReviewSessionReply(reply, generation: generation)
      }
    } errorHandler: { [weak self] _ in
      Task { @MainActor in
        self?.failReviewLoading("Keep your iPhone nearby and open Kakehashi, then retry.", generation: generation)
      }
    }
  }

  private func failReviewLoading(_ message: String, generation: UUID) {
    guard reviewGeneration == generation else { return }
    reviewLoadTimeout?.cancel()
    // Invalidate callbacks even on timeout, before the user has pressed Retry.
    reviewGeneration = UUID()
    reviewSession.isLoading = false
    reviewSession.isLoadingMore = false
    reviewSession.hasMoreCards = true
    reviewSession.errorMessage = message
  }

  func revealAnswer() {
    guard reviewSession.currentCard != nil, !reviewSession.isSubmitting else { return }
    reviewSession.isAnswerRevealed = true
  }

  func submitCurrentCard(correct: Bool) {
    guard let card = reviewSession.currentCard,
          reviewSession.isAnswerRevealed,
          !reviewSession.isSubmitting else { return }
    #if DEBUG
    if previewCards != nil {
      serverSnapshot = serverSnapshot.afterSubmittingOneReview()
      snapshot = serverSnapshot
      advanceReview()
      return
    }
    #endif
    guard !outboxLoadFailed else {
      reviewSession.errorMessage = submissionError
      return
    }
    let review = WatchQueuedReview(
      id: UUID().uuidString, assignmentId: card.assignmentId,
      availableAt: card.availableAt, reviewedAt: ISO8601DateFormatter().string(from: Date()),
      accountIdentifier: reviewAccountIdentifier ?? accountIdentifier,
      subjectType: card.subjectType,
      meaningIncorrect: correct ? 0 : 1,
      readingIncorrect: correct || !card.hasReading ? 0 : 1
    )
    var updated = outbox
    updated.items.append(review)
    guard persist(updated) else {
      reviewSession.errorMessage = "Your answer couldn't be saved. Try again."
      return
    }
    // The network does not participate in moving through questions.
    advanceReview()
    sendNextPendingReview()
  }

  private func advanceReview() {
    reviewSession.isSubmitting = false
    reviewSession.isAnswerRevealed = false
    reviewSession.completedCount += 1
    reviewSession.currentIndex += 1
    if reviewSession.isLoadingMore && reviewSession.currentCard == nil {
      reviewSession.isLoading = true
    }
    if !reviewSession.hasMoreCards { reviewSession.errorMessage = nil }
  }

  func closeReviewSession() {
    reviewGeneration = UUID()
    reviewLoadTimeout?.cancel()
    nextReviewCursor = nil
    reviewSession = .idle
  }

  func retryPendingSubmissions() {
    guard !outboxLoadFailed else { return }
    submissionRetry?.cancel()
    var updated = outbox
    updated.prepareRetry()
    guard persist(updated) else { return }
    sendNextPendingReview()
  }

  private func sendNextPendingReview() {
    guard submissionAttempt == nil, !outboxLoadFailed,
          let session, session.activationState == .activated else { return }
    submissionRetry?.cancel()
    guard let review = outbox.nextReadyReview(at: Date(), accountIdentifier: accountIdentifier) else {
      scheduleSubmissionRetry()
      return
    }
    var updated = outbox
    guard let index = updated.items.firstIndex(where: { $0.id == review.id }) else { return }
    updated.items[index].attemptCount += 1
    updated.items[index].lastError = nil
    guard persist(updated) else { return }
    let generation = UUID()
    submissionAttempt = (review.id, generation)
    isSyncingSubmissions = true
    submissionTimeout?.cancel()
    submissionTimeout = Task { [weak self] in
      do { try await Task.sleep(nanoseconds: 30_000_000_000) } catch { return }
      self?.failSubmission(id: review.id, generation: generation,
        message: "Answers are saved on Watch. Open Kakehashi on iPhone to sync.", retryable: true)
    }
    session.sendMessage(review.message) { [weak self] reply in
      Task { @MainActor in
        self?.handleReviewSubmissionReply(reply, id: review.id, generation: generation)
      }
    } errorHandler: { [weak self] _ in
      Task { @MainActor in
        self?.failSubmission(id: review.id, generation: generation,
          message: "Answers are saved on Watch. Keep your iPhone nearby to sync.", retryable: true)
      }
    }
  }

  private func scheduleSubmissionRetry() {
    guard let date = outbox.nextAttemptDate(accountIdentifier: accountIdentifier) else { return }
    let delay = max(0.1, date.timeIntervalSinceNow)
    submissionRetry = Task { [weak self] in
      do { try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000)) } catch { return }
      self?.sendNextPendingReview()
    }
  }

  private func finishSubmissionAttempt(id: String) {
    guard submissionAttempt?.id == id else { return }
    submissionTimeout?.cancel()
    submissionAttempt = nil
    isSyncingSubmissions = false
  }

  private func failSubmission(id: String, generation: UUID, message: String, retryable: Bool) {
    guard submissionAttempt?.id == id, submissionAttempt?.generation == generation else { return }
    finishSubmissionAttempt(id: id)
    var updated = outbox
    if let index = updated.items.firstIndex(where: { $0.id == id && !$0.isConfirmed }) {
      updated.items[index].lastError = message
      updated.items[index].allowsAutomaticRetry = retryable
      updated.items[index].nextAttemptAt = Date().timeIntervalSince1970
        + (updated.items[index].attemptCount == 1 ? 2 : 8)
      _ = persist(updated)
    }
    sendNextPendingReview()
  }

  private func handleReviewSubmissionReply(_ reply: [String: Any], id: String, generation: UUID) {
    guard reply["kind"] as? String == "reviewSubmission",
          reply["submissionId"] as? String == id,
          reply["success"] as? Bool == true else {
      failSubmission(id: id, generation: generation,
        message: reply["error"] as? String ?? "Answers are saved on Watch. Couldn't confirm sync with iPhone.",
        retryable: reply["retryable"] as? Bool ?? true)
      return
    }
    // A late success is useful even after timeout. An old failure never changes a
    // newer attempt, and neither kind of callback touches question navigation.
    finishSubmissionAttempt(id: id)
    var updated = outbox
    if let index = updated.items.firstIndex(where: { $0.id == id }) {
      updated.items[index].isConfirmed = true
      updated.items[index].lastError = nil
      _ = persist(updated)
    }
    if let message = reply["snapshot"] as? [String: Any] {
      apply(message: message)
    }
    sendNextPendingReview()
  }

  @discardableResult
  private func persist(_ updated: WatchReviewOutbox) -> Bool {
    do {
      try outboxStorage.save(updated)
      outbox = updated
      publishOutbox()
      return true
    } catch {
      submissionError = "Answers couldn't be saved on Watch. Free some space and retry."
      return false
    }
  }

  private func publishOutbox() {
    pendingSubmissionCount = outbox.items.filter {
      !$0.isConfirmed && !acknowledgedSubmissionIds.contains($0.id)
    }.count
    if !outboxLoadFailed { submissionError = outbox.errorMessage }
    let relevantItems = outbox.items.filter {
      !acknowledgedSubmissionIds.contains($0.id)
        && ($0.accountIdentifier == nil || accountIdentifier == nil || $0.accountIdentifier == accountIdentifier)
    }
    var adjusted = serverSnapshot.replacingCurrentReviews(
      max(0, serverSnapshot.effectiveCurrentReviews - relevantItems.count)
    )
    if var subjectCounts = serverSnapshot.currentSubjectCounts,
      relevantItems.allSatisfy({ $0.subjectType != nil }), !serverSnapshot.isOnVacation {
      for item in relevantItems {
        guard let subjectType = item.subjectType else { continue }
        let type = subjectType == "kanji" || subjectType == "radical" ? subjectType : "vocabulary"
        subjectCounts[type] = max(0, (subjectCounts[type] ?? 0) - 1)
      }
      if subjectCounts.values.reduce(0, +) == adjusted.effectiveCurrentReviews {
        adjusted.currentSubjectCounts = subjectCounts
      }
    }
    snapshot = adjusted
  }

  private func loadCachedSnapshot() {
    guard let data = defaults.data(forKey: cacheKey) else { return }
    if let cached = try? JSONDecoder().decode(WatchCachedReviewSnapshot.self, from: data) {
      serverSnapshot = cached.snapshot
      acknowledgedSubmissionIds = Set(cached.acknowledgedSubmissionIds)
      accountIdentifier = cached.accountIdentifier
      outbox.acknowledge(acknowledgedSubmissionIds)
    } else if let cached = try? JSONDecoder().decode(ReviewSnapshot.self, from: data) {
      serverSnapshot = cached
    }
    snapshot = serverSnapshot
    connectionState = .stale
  }

  private func cacheServerSnapshot() {
    let cached = WatchCachedReviewSnapshot(snapshot: serverSnapshot,
      acknowledgedSubmissionIds: Array(acknowledgedSubmissionIds), accountIdentifier: accountIdentifier)
    if let data = try? JSONEncoder().encode(cached) { defaults.set(data, forKey: cacheKey) }
  }

  private func apply(message: [String: Any]) {
    guard let incoming = ReviewSnapshot.from(message) else {
      if snapshot.lastUpdated == 0 { connectionState = .waitingForPhone }
      return
    }
    let incomingAccount = message["accountIdentifier"] as? String
    let switchedAccount = incomingAccount != nil && incomingAccount != accountIdentifier
    guard incoming.lastUpdated >= serverSnapshot.lastUpdated else { return }
    serverSnapshot = incoming
    if let incomingAccount { accountIdentifier = incomingAccount }
    if switchedAccount, !reviewSession.cards.isEmpty,
       let previous = reviewAccountIdentifier, previous != incomingAccount {
      closeReviewSession()
      reviewSession.errorMessage = "The iPhone account changed. Start a new review session."
    }
    acknowledgedSubmissionIds = Set(message["acknowledgedSubmissionIds"] as? [String] ?? [])
    // Cache the raw count AND receipts together before dropping local adjustments.
    // A relaunch can then reconcile an interrupted outbox write without double counts.
    cacheServerSnapshot()
    var updated = outbox
    updated.acknowledge(acknowledgedSubmissionIds)
    if updated != outbox {
      _ = persist(updated)
      if let attempt = submissionAttempt, acknowledgedSubmissionIds.contains(attempt.id) {
        finishSubmissionAttempt(id: attempt.id)
      }
    }
    publishOutbox()
    isRefreshing = false
    connectionState = .live
    sendNextPendingReview()
  }

  private func applyReviewSessionReply(_ reply: [String: Any], generation: UUID) {
    guard reviewGeneration == generation else { return }
    reviewLoadTimeout?.cancel()
    guard reply["kind"] as? String == "reviewSession" else {
      failReviewLoading("The iPhone sent an unexpected response.", generation: generation)
      return
    }
    if let error = reply["error"] as? String {
      failReviewLoading(error, generation: generation)
      return
    }
    if reply["isOnVacation"] as? Bool == true {
      reviewSession = WatchReviewSessionState(errorMessage: "Vacation mode is on.")
      refresh()
      return
    }
    if let scope = reply["accountIdentifier"] as? String {
      if !reviewSession.cards.isEmpty, let previous = reviewAccountIdentifier, scope != previous {
        failReviewLoading("The iPhone account changed. Close this session and start again.", generation: generation)
        return
      }
      reviewAccountIdentifier = scope
    }
    let excluded = Set(outbox.items.map(\.assignmentId) + reviewSession.cards.map(\.assignmentId))
    var seen = excluded
    let cards = (reply["cards"] as? [[String: Any]] ?? []).compactMap(WatchReviewCard.from).filter {
      seen.insert($0.assignmentId).inserted
    }
    reviewSession.cards.append(contentsOf: cards)
    if let count = reply["totalCount"] as? Int {
      reviewSession.expectedTotalCount = max(reviewSession.cards.count, reviewPageBaseCount + count)
    }
    reviewSession.isLoading = false
    reviewSession.isLoadingMore = false
    reviewSession.errorMessage = nil
    nextReviewCursor = (reply["nextCursor"] as? String).flatMap { $0.isEmpty ? nil : $0 }
    reviewSession.hasMoreCards = nextReviewCursor != nil
    if let cursor = nextReviewCursor {
      requestReviewPage(cursor: cursor, generation: generation)
    } else {
      reviewSession.expectedTotalCount = reviewSession.cards.count
      if reviewSession.cards.isEmpty { reviewSession.errorMessage = "No reviews ready." }
    }
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
      sendNextPendingReview()
    }
  }

  #if os(iOS)
  nonisolated func sessionDidBecomeInactive(_ session: WCSession) {}
  nonisolated func sessionDidDeactivate(_ session: WCSession) { session.activate() }
  #endif

  nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
    Task { @MainActor in
      guard session.isReachable else {
        if snapshot.lastUpdated == 0 { connectionState = .waitingForPhone }
        return
      }
      refresh()
      retryPendingSubmissions()
    }
  }

  nonisolated func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    Task { @MainActor in apply(message: applicationContext) }
  }

  nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    Task { @MainActor in apply(message: message) }
  }
}
