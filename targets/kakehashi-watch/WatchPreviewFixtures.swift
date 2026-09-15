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
      let featured = subjectType == "vocabulary" ? "学校" : "木"
      cards = sampleCards.filter { $0.subjectType == subjectType && $0.characters == featured }
        + sampleCards.filter { !($0.subjectType == subjectType && $0.characters == featured) }
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

    let details = times.sorted { $0.key < $1.key }.enumerated().map { index, entry in
      let radical = entry.value / 5
      let kanji = entry.value / 3
      let apprentice = entry.value / 2
      let guru = entry.value / 3
      let master = (entry.value - apprentice - guru) / 2
      return WatchForecastDetail(date: entry.key, count: entry.value,
        radical: radical, kanji: kanji, vocabulary: entry.value - radical - kanji,
        apprentice: apprentice, guru: guru, master: master,
        enlightened: entry.value - apprentice - guru - master)
    }
    return ReviewSnapshot(
      currentReviews: isOnVacation ? 0 : currentReviews,
      upcomingReviews: paddedCounts,
      upcomingReviewTimes: times,
      lastUpdated: now.timeIntervalSince1970,
      isOnVacation: isOnVacation,
      vacationStartedAt: isOnVacation ? formatter.string(from: now.addingTimeInterval(-86_400)) : nil,
      currentSubjectCounts: isOnVacation ? nil : (currentReviews == sampleCards.count
        ? Dictionary(grouping: sampleCards, by: \.subjectType).mapValues(\.count)
        : ["radical": currentReviews / 6, "kanji": currentReviews / 3,
           "vocabulary": currentReviews - currentReviews / 6 - currentReviews / 3]),
      forecastBreakdown: isOnVacation ? nil : details
    )
  }

  private static let sampleCards: [WatchReviewCard] = [
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
  ] + additionalCards

  private static let additionalCards: [WatchReviewCard] = {
    let words: [(String, String, String, String)] = [
      ("kanji", "学", "Study", "がく"), ("kanji", "日", "Sun", "にち"),
      ("kanji", "月", "Moon", "げつ"), ("kanji", "火", "Fire", "か"),
      ("kanji", "水", "Water", "すい"), ("kanji", "木", "Tree", "もく"),
      ("kanji", "金", "Gold", "きん"), ("kanji", "土", "Soil", "ど"),
      ("kanji", "山", "Mountain", "さん"), ("kanji", "川", "River", "かわ"),
      ("kanji", "人", "Person", "じん"),
      ("vocabulary", "学校", "School", "がっこう"),
      ("vocabulary", "先生", "Teacher", "せんせい"),
      ("vocabulary", "学生", "Student", "がくせい"),
      ("vocabulary", "大人", "Adult", "おとな"),
      ("vocabulary", "今日", "Today", "きょう"),
      ("vocabulary", "明日", "Tomorrow", "あした"),
      ("vocabulary", "時間", "Time", "じかん"),
      ("radical", "口", "Mouth", ""), ("radical", "一", "Ground", ""),
      ("radical", "川", "River", ""),
    ]
    return words.enumerated().map { index, word in
      WatchReviewCard(id: "preview-extra-\(index)", assignmentId: -100 - index,
        subjectId: -100 - index, subjectType: word.0, characters: word.1,
        meanings: [word.2], readings: word.3.isEmpty ? [] : [word.3],
        hasReading: !word.3.isEmpty, srsStage: 2, availableAt: nil)
    }
  }()

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
