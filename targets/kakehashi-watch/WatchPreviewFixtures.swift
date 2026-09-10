#if DEBUG
import Foundation

@MainActor
enum WatchPreviewFixtures {
  static var launchScenario: String? {
    guard let value = ProcessInfo.processInfo.environment["KAKEHASHI_WATCH_PREVIEW"]?
      .trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
      return nil
    }
    return value
  }

  static func makeStore(scenario: String = "dashboard") -> WatchReviewStore {
    let now = Date()
    var snapshot = sampleSnapshot(now: now)
    var connectionState: WatchConnectionState = .live
    var session: WatchReviewSessionState = .idle
    var cards = sampleCards

    switch scenario.lowercased() {
    case "empty":
      snapshot = sampleSnapshot(now: now, currentReviews: 0, upcomingReviews: [])
    case "disconnected":
      snapshot = .empty
      connectionState = .waitingForPhone
    case "stale":
      snapshot = sampleSnapshot(now: now.addingTimeInterval(-2 * 60 * 60))
      connectionState = .stale
    case "vacation":
      snapshot = sampleSnapshot(now: now, currentReviews: 0, isOnVacation: true)
    case "review":
      session = WatchReviewSessionState(cards: cards)
    case "revealed":
      session = WatchReviewSessionState(cards: cards, isAnswerRevealed: true)
    case "submitting", "radical-submitting":
      if scenario.lowercased().hasPrefix("radical") {
        cards = sampleCards.filter { $0.subjectType == "radical" }
      }
      session = WatchReviewSessionState(cards: cards, isAnswerRevealed: true, isSubmitting: true)
    case "vocabulary", "vocabulary-revealed", "radical", "radical-revealed":
      let subjectType = scenario.lowercased().hasPrefix("radical") ? "radical" : "vocabulary"
      cards = sampleCards.filter { $0.subjectType == subjectType }
        + sampleCards.filter { $0.subjectType != subjectType }
      session = WatchReviewSessionState(
        cards: cards, isAnswerRevealed: scenario.lowercased().hasSuffix("-revealed"))
    case "long":
      cards = [longCard] + sampleCards
      session = WatchReviewSessionState(cards: cards, isAnswerRevealed: true)
    case "loading":
      session = WatchReviewSessionState(isLoading: true)
    case "error":
      session = WatchReviewSessionState(
        cards: cards,
        isAnswerRevealed: true,
        errorMessage: "Could not reach iPhone to submit. Keep Kakehashi open on your iPhone and try again."
      )
    case "session-error":
      session = WatchReviewSessionState(
        errorMessage: "Keep your iPhone nearby and open Kakehashi."
      )
    case "complete":
      session = WatchReviewSessionState(
        cards: cards,
        currentIndex: cards.count,
        completedCount: cards.count
      )
    case "many":
      snapshot = sampleSnapshot(
        now: now,
        currentReviews: 12_345,
        upcomingReviews: [1_234, 456, 0, 789, 123, 3_456, 78, 0]
      )
    default:
      break
    }

    return WatchReviewStore(
      previewSnapshot: snapshot,
      connectionState: connectionState,
      reviewSession: session,
      previewCards: cards
    )
  }

  private static func sampleSnapshot(
    now: Date,
    currentReviews: Int = 24,
    upcomingReviews: [Int] = [3, 0, 7, 4, 0, 11, 6, 0],
    isOnVacation: Bool = false
  ) -> ReviewSnapshot {
    let counts = isOnVacation ? [] : upcomingReviews
    let paddedCounts = counts + Array(repeating: 0, count: max(0, 24 - counts.count))
    let calendar = Calendar.current
    let nextHour = calendar.nextDate(
      after: now,
      matching: DateComponents(minute: 0, second: 0),
      matchingPolicy: .nextTime
    ) ?? now.addingTimeInterval(3_600)
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    let times = Dictionary<String, Int>(uniqueKeysWithValues: counts.enumerated().compactMap { index, count in
      guard count > 0 else { return nil }
      let date = nextHour.addingTimeInterval(TimeInterval(index) * 3_600)
      return (formatter.string(from: date), count)
    })

    return ReviewSnapshot(
      currentReviews: isOnVacation ? 0 : currentReviews,
      upcomingReviews: paddedCounts,
      upcomingReviewTimes: times,
      lastUpdated: now.timeIntervalSince1970,
      isOnVacation: isOnVacation,
      vacationStartedAt: isOnVacation ? formatter.string(from: now.addingTimeInterval(-86_400)) : nil
    )
  }

  private static let sampleCards = [
    WatchReviewCard(
      id: "preview-kanji",
      assignmentId: -1,
      subjectId: -1,
      subjectType: "kanji",
      characters: "橋",
      meanings: ["Bridge"],
      readings: ["きょう", "はし"],
      hasReading: true,
      srsStage: 2,
      availableAt: nil
    ),
    WatchReviewCard(
      id: "preview-vocabulary",
      assignmentId: -2,
      subjectId: -2,
      subjectType: "vocabulary",
      characters: "日本語",
      meanings: ["Japanese language", "Japanese"],
      readings: ["にほんご", "にっぽんご"],
      hasReading: true,
      srsStage: 3,
      availableAt: nil
    ),
    WatchReviewCard(
      id: "preview-radical",
      assignmentId: -3,
      subjectId: -3,
      subjectType: "radical",
      characters: "木",
      meanings: ["Tree"],
      readings: [],
      hasReading: false,
      srsStage: 1,
      availableAt: nil
    )
  ]

  private static let longCard = WatchReviewCard(
    id: "preview-long-vocabulary",
    assignmentId: -4,
    subjectId: -4,
    subjectType: "vocabulary",
    characters: "日本語の勉強を一生懸命頑張ります",
    meanings: [
      "I will do my very best at studying Japanese",
      "I will work as hard as I can on my Japanese studies",
      "I will put all my effort into learning Japanese"
    ],
    readings: [
      "にほんごのべんきょうをいっしょうけんめいがんばります",
      "にっぽんごのべんきょうをいっしょうけんめいがんばります"
    ],
    hasReading: true,
    srsStage: 4,
    availableAt: nil
  )
}
#endif
