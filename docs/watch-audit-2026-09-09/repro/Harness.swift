import Foundation
import WatchConnectivity

@main
struct Harness {
  @MainActor static var passed = 0
  @MainActor static var failed = 0
  @MainActor static var observations = 0
  static let suite = "com.kakehashi.audit.20260909.logic"

  @MainActor static func check(_ condition: Bool, _ title: String, _ detail: String) {
    if condition { passed += 1 } else { failed += 1 }
    print("\(condition ? "PASS" : "FAIL") | \(title) | \(detail)")
  }
  @MainActor static func observation(_ title: String, _ detail: String) {
    observations += 1
    print("OBSERVED | \(title) | \(detail)")
  }
  static func drain() async {
    // Store transports callbacks through Task { @MainActor }. Yield to those tasks.
    for _ in 0..<12 { await Task.yield() }
  }
  static func card(_ id: Int, reading: Bool = true) -> [String: Any] {
    ["id": String(id), "assignmentId": id, "subjectId": id + 100, "subjectType": reading ? "kanji" : "radical", "characters": "日", "meanings": ["sun"], "readings": reading ? ["にち"] : [], "hasReading": reading, "srsStage": 1]
  }
  static func snapshotMessage(_ count: Int) -> [String: Any] {
    ["currentReviews": count, "upcomingReviews": Array(repeating: 0, count: 24), "upcomingReviewTimes": [String: Int](), "lastUpdated": Date().timeIntervalSince1970, "isOnVacation": false]
  }
  @MainActor static func makeStore(count: Int = 3) async -> WatchReviewStore {
    UserDefaults.standard.removePersistentDomain(forName: suite)
    WCSession.default.pending.removeAll()
    let store = WatchReviewStore()
    store.session(WCSession.default, didReceiveApplicationContext: snapshotMessage(count))
    await drain()
    return store
  }
  @MainActor static func startCards(_ store: WatchReviewStore, cards: [[String: Any]] = [card(1), card(2)]) async {
    store.startReviewSession()
    WCSession.default.pending.removeFirst().reply(["kind": "reviewSession", "cards": cards])
    await drain()
  }

  @MainActor static func main() async {
    setenv("TZ", "UTC", 1)
    print("Swift Watch logic audit: actual Store with fake WatchConnectivity, isolated cache, extracted actual forecast functions; UTC")
    do {
      let store = await makeStore()
      await startCards(store)
      store.revealAnswer()
      store.submitCurrentCard(correct: true)
      let sent = WCSession.default.pending.removeFirst()
      check(sent.message["meaningIncorrect"] as? Int == 0 && sent.message["readingIncorrect"] as? Int == 0, "Correct grade payload", "meaning=\(sent.message["meaningIncorrect"]!) reading=\(sent.message["readingIncorrect"]!)")
      sent.reply(["kind": "reviewSubmission", "success": true])
      await drain()
      check(store.reviewSession.currentCard?.assignmentId == 2 && store.reviewSession.completedCount == 1 && store.snapshot.currentReviews == 2, "Normal successful review advances exactly once", "current=\(store.reviewSession.currentCard?.assignmentId ?? -1) completed=\(store.reviewSession.completedCount) ready=\(store.snapshot.currentReviews)")
    }
    do {
      let store = await makeStore()
      await startCards(store)
      store.revealAnswer()
      store.submitCurrentCard(correct: true)
      WCSession.default.pending.removeFirst().reply(["kind": "reviewSubmission", "success": false, "error": "Temporary failure"])
      await drain()
      check(store.reviewSession.currentCard?.assignmentId == 1 && !store.reviewSession.isSubmitting && store.reviewSession.isAnswerRevealed, "Failed submission allows retry", "card=\(store.reviewSession.currentCard?.assignmentId ?? -1) error=\(store.reviewSession.errorMessage ?? "nil")")
      store.submitCurrentCard(correct: true)
      WCSession.default.pending.removeFirst().reply(["kind": "reviewSubmission", "success": true])
      await drain()
      check(store.reviewSession.errorMessage == nil, "Successful retry clears previous error", "next card=\(store.reviewSession.currentCard?.assignmentId ?? -1), error=\(store.reviewSession.errorMessage ?? "nil")")
    }
    do {
      let store = await makeStore()
      store.startReviewSession()
      let late = WCSession.default.pending.removeFirst()
      store.closeReviewSession()
      late.reply(["kind": "reviewSession", "cards": [card(1)]])
      await drain()
      check(!store.reviewSession.isActive, "Closing while loading ignores late session reply", "active=\(store.reviewSession.isActive) cards=\(store.reviewSession.cards.count)")
    }
    do {
      let store = await makeStore()
      await startCards(store)
      store.revealAnswer()
      store.submitCurrentCard(correct: true)
      let late = WCSession.default.pending.removeFirst()
      store.closeReviewSession()
      await startCards(store, cards: [card(11), card(12)])
      late.reply(["kind": "reviewSubmission", "success": true])
      await drain()
      check(store.reviewSession.currentCard?.assignmentId == 11 && store.reviewSession.completedCount == 0, "Old submission reply cannot skip a card in new session", "new session current=\(store.reviewSession.currentCard?.assignmentId ?? -1) completed=\(store.reviewSession.completedCount)")
    }
    do {
      let store = await makeStore()
      await startCards(store)
      store.revealAnswer()
      store.submitCurrentCard(correct: true)
      let late = WCSession.default.pending.removeFirst()
      store.closeReviewSession()
      late.error?(NSError(domain: "fake.connection", code: 1))
      await drain()
      check(!store.reviewSession.isActive, "Closing during submission ignores late transport error", "active=\(store.reviewSession.isActive) error=\(store.reviewSession.errorMessage ?? "nil")")
    }
    do {
      let store = await makeStore(count: 3)
      await startCards(store)
      store.revealAnswer()
      store.submitCurrentCard(correct: true)
      let pending = WCSession.default.pending.removeFirst()
      store.session(WCSession.default, didReceiveApplicationContext: snapshotMessage(2))
      await drain()
      pending.reply(["kind": "reviewSubmission", "success": true])
      await drain()
      check(store.snapshot.currentReviews == 2, "Phone snapshot before success reply cannot double-decrement", "started=3 phone authoritative=2 final watch=\(store.snapshot.currentReviews)")
    }
    do {
      let store = await makeStore()
      await startCards(store)
      store.revealAnswer()
      store.submitCurrentCard(correct: false)
      let sent = WCSession.default.pending.removeFirst()
      check(sent.message["meaningIncorrect"] as? Int == 1 && sent.message["readingIncorrect"] as? Int == 1, "Kanji Miss marks both meaning and reading incorrect", "meaning=\(sent.message["meaningIncorrect"]!) reading=\(sent.message["readingIncorrect"]!)")
      observation("No separate meaning/reading self grading", "Only Bool correct input is accepted: Miss produces (1,1), Got it produces (0,0); (1,0)/(0,1) cannot be represented for a reading card.")
    }
    do {
      let store = await makeStore()
      await startCards(store, cards: [card(1, reading: false)])
      store.revealAnswer()
      store.submitCurrentCard(correct: false)
      let sent = WCSession.default.pending.removeFirst()
      check(sent.message["readingIncorrect"] as? Int == 0, "Radical Miss does not invent a reading error", "meaning=\(sent.message["meaningIncorrect"]!) reading=\(sent.message["readingIncorrect"]!)")
    }
    do {
      let iso = ISO8601DateFormatter()
      let cachedAt = iso.date(from: "2026-09-09T10:15:00Z")!
      let later = iso.date(from: "2026-09-09T12:15:00Z")!
      let snapshot = ReviewSnapshot(currentReviews: 0, upcomingReviews: [5, 7, 0, 0, 0, 0, 0, 0], upcomingReviewTimes: ["2026-09-09T11:00:00.000Z": 5, "2026-09-09T12:00:00.000Z": 7], lastUpdated: cachedAt.timeIntervalSince1970, isOnVacation: false, vacationStartedAt: nil)
      let fresh = forecast(snapshot: snapshot, now: cachedAt)
      let aged = forecast(snapshot: snapshot, now: later)
      check(fresh.first?.label == "11am" && fresh.first?.count == 5, "Fresh forecast aligns next hour", "first=\(fresh[0])")
      check(aged.first?.count == 0, "Aged forecast does not move old counts into future hours", "cached 10:15 [11am=5,12pm=7]; at12:15 first=\(aged[0]) second=\(aged[1])")
      check(nextReviewDate(snapshot: snapshot, now: later) == nil, "Expired exact reviews do not become future fallback reviews", "at12:15 next=\(nextReviewDate(snapshot: snapshot, now: later).map(iso.string(from:)) ?? "nil")")
      check(syncAgeLabel(snapshot: snapshot, now: later) == "2h", "Snapshot age display reports elapsed time", "age=\(syncAgeLabel(snapshot: snapshot, now: later))")
      observation("Ready count remains stale", "All 12 forecast reviews are past due at 12:15 but effectiveCurrentReviews remains \(snapshot.effectiveCurrentReviews), so Review on Watch action stays hidden until a phone sync.")
    }
    UserDefaults.standard.removePersistentDomain(forName: suite)
    print("TOTAL | \(passed) passed | \(failed) failed | \(observations) observations")
    exit(failed == 0 ? 0 : 1)
  }
}
