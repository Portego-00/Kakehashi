import Foundation

@main struct WatchReviewChecks {
  @MainActor static var checks = 0

  @MainActor static func main() async {
    await optimisticAndDurable()
    await submissionFailureAndRetry()
    await callbackIsolation()
    await acknowledgementsAndCounts()
    await wholeSessionAndPageRecovery()
    await refreshAndStaleSnapshots()
    await diskFailureAndCorruption()
    await scopeChanges()
    await subjectCountsAndWrongReceipts()
    queueBackoffAndCompatibility()
    await kanaSubjectCounts()
    print("PASS: \(checks) Watch review checks (actual store, mocked phone; no API requests)")
  }

  @MainActor static func optimisticAndDurable() async {
    let fixture = Fixture()
    defer { fixture.clean() }
    let store = fixture.makeStore()
    await fixture.deliverSnapshot(to: store, count: 12)
    store.startReviewSession()
    let request = fixture.take("requestReviewSession")
    check(request.value["limit"] == nil, "session request has no fixed limit")
    request.reply(["kind": "reviewSession", "cards": [card(1), card(2)], "accountIdentifier": "account-a"])
    await settle()
    store.revealAnswer()
    store.submitCurrentCard(correct: false)
    check(store.reviewSession.currentCard?.assignmentId == 2, "grading advances before the phone/API callback")
    check(!store.reviewSession.isSubmitting, "network never blocks the next question")
    check(store.reviewSession.completedCount == 1, "answer counted immediately")
    check(store.pendingSubmissionCount == 1, "answer visible as pending")
    check(store.snapshot.currentReviews == 11, "one optimistic count adjustment")
    let submitted = fixture.take("submitWatchReview")
    let persisted = try! WatchReviewOutboxStorage(url: fixture.url).load()
    check(persisted.pendingCount == 1, "answer persisted before callback")
    check(persisted.items[0].id == submitted.value["submissionId"] as? String, "durable request ID sent unchanged")
    check(submitted.value["availableAt"] as? String == "2026-09-13T10:00:00Z", "original assignment cycle travels with answer")
    check(submitted.value["reviewedAt"] is String, "answer time captured before network delay")
    check(submitted.value["accountIdentifier"] as? String == "account-a", "account scope travels with answer")
    check(submitted.value["meaningIncorrect"] as? Int == 1 && submitted.value["readingIncorrect"] as? Int == 1,
          "missed kanji keeps original grading semantics")
    store.submitCurrentCard(correct: true)
    check(store.reviewSession.completedCount == 1, "a second tap cannot grade the next unrevealed card")

    let restored = fixture.makeStore()
    check(restored.pendingSubmissionCount == 1, "pending answer restored after relaunch")
    check(restored.snapshot.currentReviews == 11, "restoring does not double the optimistic adjustment")
    restored.startReviewSession()
    let reload = fixture.take("requestReviewSession")
    check((reload.value["excludedAssignmentIds"] as? [Int]) == [1], "unsynced assignments excluded from a new session")
  }

  @MainActor static func submissionFailureAndRetry() async {
    let fixture = Fixture()
    defer { fixture.clean() }
    let store = fixture.makeStore()
    await fixture.load(store, cards: [card(11, hasReading: false), card(12)])
    store.revealAnswer()
    store.submitCurrentCard(correct: false)
    let failed = fixture.take("submitWatchReview")
    let id = failed.value["submissionId"] as! String
    check(failed.value["readingIncorrect"] as? Int == 0, "radical never submits a reading error")
    failed.reply(["kind": "reviewSubmission", "submissionId": id, "success": false,
                  "retryable": false, "error": "Sign in on your iPhone to sync."])
    await settle()
    check(store.pendingSubmissionCount == 1, "rejected answer remains durable")
    check(store.submissionError == "Sign in on your iPhone to sync.", "sync failure is surfaced separately")
    check(store.reviewSession.currentCard?.assignmentId == 12, "sync failure never rewinds a question")
    check(store.reviewSession.errorMessage == nil, "sync failure does not replace a newer question")
    store.retryPendingSubmissions()
    let retry = fixture.take("submitWatchReview")
    check(retry.value["submissionId"] as? String == id, "retry reuses idempotency receipt")
    check(retry.value["reviewedAt"] as? String == failed.value["reviewedAt"] as? String, "retry preserves answer time")
    check(store.submissionError == nil, "retry clears old error")
    retry.reply(["kind": "reviewSubmission", "submissionId": id, "success": true])
    await settle()
    check(store.pendingSubmissionCount == 0, "confirmed answer no longer pending")
    check(store.snapshot.currentReviews == 11, "success without a snapshot retains one local adjustment")
    check(store.reviewSession.completedCount == 1, "successful callback does not advance twice")
  }

  @MainActor static func callbackIsolation() async {
    let fixture = Fixture()
    defer { fixture.clean() }
    let store = fixture.makeStore()
    await fixture.load(store, cards: [card(21), card(22)])
    store.revealAnswer()
    store.submitCurrentCard(correct: true)
    let outstanding = fixture.take("submitWatchReview")
    store.closeReviewSession()
    outstanding.reply(["kind": "reviewSubmission", "submissionId": outstanding.value["submissionId"]!, "success": true])
    await settle()
    check(store.reviewSession == .idle, "late submission cannot reopen a closed session")
    store.startReviewSession()
    let oldLoad = fixture.take("requestReviewSession")
    store.startReviewSession()
    let newLoad = fixture.take("requestReviewSession")
    newLoad.reply(["kind": "reviewSession", "cards": [card(24)]])
    await settle()
    oldLoad.reply(["kind": "reviewSession", "cards": [card(23)]])
    await settle()
    check(store.reviewSession.currentCard?.assignmentId == 24, "old load cannot replace newer session")
    oldLoad.fail(NSError(domain: "mock", code: 1))
    await settle()
    check(store.reviewSession.errorMessage == nil, "old load failure cannot poison newer session")

    store.revealAnswer()
    store.submitCurrentCard(correct: true)
    let second = fixture.take("submitWatchReview")
    second.fail(NSError(domain: "mock", code: 1))
    await settle()
    store.retryPendingSubmissions()
    let retry = fixture.take("submitWatchReview")
    second.fail(NSError(domain: "mock", code: 2))
    await settle()
    check(store.isSyncingSubmissions && store.submissionError == nil, "old failure cannot cancel newer delivery attempt")
    retry.reply(["kind": "reviewSubmission", "submissionId": retry.value["submissionId"]!, "success": true])
    await settle()
  }

  @MainActor static func acknowledgementsAndCounts() async {
    let fixture = Fixture()
    defer { fixture.clean() }
    let store = fixture.makeStore()
    await fixture.load(store, cards: [card(31), card(32)])
    store.revealAnswer()
    store.submitCurrentCard(correct: true)
    let first = fixture.take("submitWatchReview")
    let id = first.value["submissionId"] as! String
    await fixture.deliverSnapshot(to: store, count: 11, time: 101, acknowledged: [id])
    check(store.pendingSubmissionCount == 0, "snapshot receipt can acknowledge a lost reply")
    check(store.snapshot.currentReviews == 11, "server decrement and local adjustment are never both applied")
    first.reply(["kind": "reviewSubmission", "submissionId": id, "success": true])
    await settle()
    check(store.snapshot.currentReviews == 11, "later duplicate acknowledgement keeps count unchanged")
    let restored = fixture.makeStore()
    check(restored.snapshot.currentReviews == 11 && restored.pendingSubmissionCount == 0,
          "receipt and authoritative count remain consistent on relaunch")

    store.revealAnswer()
    store.submitCurrentCard(correct: true)
    let second = fixture.take("submitWatchReview")
    let secondID = second.value["submissionId"] as! String
    second.reply(["kind": "reviewSubmission", "submissionId": secondID, "success": true,
                  "snapshot": snapshot(count: 10, time: 102, acknowledged: [id, secondID])])
    await settle()
    check(store.snapshot.currentReviews == 10, "nested submission snapshot reconciles atomically")
    check(store.reviewSession.isComplete && store.reviewSession.completedCount == 2,
          "all local answers complete independently of callback order")
  }

  @MainActor static func wholeSessionAndPageRecovery() async {
    let fixture = Fixture()
    defer { fixture.clean() }
    let store = fixture.makeStore()
    await fixture.deliverSnapshot(to: store, count: 83)
    store.startReviewSession()
    fixture.take("requestReviewSession").reply([
      "kind": "reviewSession", "cards": (1...40).map { card($0) }, "totalCount": 83, "nextCursor": "page-two",
    ])
    await settle()
    check(store.reviewSession.currentCard != nil && !store.reviewSession.isLoading,
          "first page is usable while later pages prepare")
    check(store.reviewSession.totalCount == 83 && store.reviewSession.isLoadingMore,
          "progress shows the whole queue while prefetch runs")
    let page = fixture.take("requestReviewSession")
    check(page.value["cursor"] as? String == "page-two", "prefetch uses phone transport cursor")
    for _ in 1...40 {
      store.revealAnswer()
      store.submitCurrentCard(correct: true)
    }
    check(store.reviewSession.isLoading && !store.reviewSession.isComplete,
          "reaching a transport boundary never marks session complete")
    page.reply(["kind": "reviewSession", "cards": (41...80).map { card($0) }, "totalCount": 83, "nextCursor": "page-three"])
    await settle()
    check(store.reviewSession.currentCard?.assignmentId == 41 && !store.reviewSession.isLoading,
          "next transport page resumes at the next unanswered card")
    fixture.take("requestReviewSession").reply(["kind": "reviewSession", "cards": (81...83).map { card($0) }, "totalCount": 83])
    await settle()
    for _ in 41...83 {
      store.revealAnswer()
      store.submitCurrentCard(correct: true)
    }
    check(store.reviewSession.isComplete && store.reviewSession.completedCount == 83,
          "all 83 reviews finish without a ten-review batch boundary")
    check(store.pendingSubmissionCount == 83, "every rapid answer persists while first API call is held")
    check(fixture.transport.messages.filter { $0.value["command"] as? String == "submitWatchReview" }.count == 1,
          "background delivery serializes API submissions")

    let recovery = Fixture()
    defer { recovery.clean() }
    let recovered = recovery.makeStore()
    await recovery.deliverSnapshot(to: recovered, count: 3)
    recovered.startReviewSession()
    recovery.take("requestReviewSession").reply(["kind": "reviewSession", "cards": [card(1)], "totalCount": 3, "nextCursor": "expired"])
    await settle()
    recovery.take("requestReviewSession").reply(["kind": "reviewSession", "error": "Page expired", "restartRequired": true])
    await settle()
    check(recovered.reviewSession.currentCard?.assignmentId == 1 && recovered.reviewSession.errorMessage != nil,
          "page failure preserves playable loaded cards")
    recovered.revealAnswer()
    recovered.submitCurrentCard(correct: true)
    check(!recovered.reviewSession.isComplete, "failed page never silently truncates session")
    recovered.retryReviewLoading()
    let retry = recovery.take("requestReviewSession")
    check(retry.value["cursor"] == nil && retry.value["excludedAssignmentIds"] as? [Int] == [1],
          "expired page retry requests only remaining assignments")
    retry.reply(["kind": "reviewSession", "cards": [card(2), card(3)], "totalCount": 2])
    await settle()
    check(recovered.reviewSession.currentCard?.assignmentId == 2 && recovered.reviewSession.totalCount == 3,
          "page retry preserves completed progress and restores full queue")
  }

  @MainActor static func refreshAndStaleSnapshots() async {
    let fixture = Fixture()
    defer { fixture.clean() }
    let store = fixture.makeStore()
    await fixture.deliverSnapshot(to: store, count: 12)
    store.refresh()
    store.refresh()
    check(store.isRefreshing, "refresh exposes loading feedback")
    check(fixture.transport.messages.filter { $0.value["command"] as? String == "requestReviewData" }.count == 1,
          "concurrent refresh gestures coalesce")
    fixture.take("requestReviewData").reply(snapshot(count: 14, time: 101))
    await settle()
    check(!store.isRefreshing && store.snapshot.currentReviews == 14, "fresh response updates count and ends refresh")
    await fixture.deliverSnapshot(to: store, count: 50, time: 90)
    check(store.snapshot.currentReviews == 14, "late older snapshot cannot revert count")
    store.refresh()
    fixture.take("requestReviewData").fail(NSError(domain: "mock", code: 1))
    await settle()
    check(!store.isRefreshing && store.connectionState == .stale, "refresh failure preserves cached content and ends spinner")
    store.refresh()
    fixture.take("requestReviewData").reply(["error": "WaniKani is unavailable"])
    await settle()
    check(!store.isRefreshing && store.connectionState == .stale,
          "phone API failure does not present cached data as freshly synced")
  }

  @MainActor static func diskFailureAndCorruption() async {
    let fixture = Fixture()
    defer { fixture.clean() }
    let store = fixture.makeStore()
    await fixture.load(store, cards: [card(1)])
    try! Data("not a directory".utf8).write(to: fixture.url.deletingLastPathComponent())
    store.revealAnswer()
    store.submitCurrentCard(correct: true)
    check(store.reviewSession.currentCard?.assignmentId == 1 && store.reviewSession.completedCount == 0,
          "disk-write failure keeps unsaved answer on screen")
    check(store.reviewSession.errorMessage != nil, "disk-write failure is visible")
    check(fixture.transport.messages.allSatisfy { $0.value["command"] as? String != "submitWatchReview" },
          "unsaved answer never goes to network")

    let corrupt = Fixture()
    defer { corrupt.clean() }
    try! FileManager.default.createDirectory(at: corrupt.url.deletingLastPathComponent(), withIntermediateDirectories: true)
    let original = Data("unreadable saved queue".utf8)
    try! original.write(to: corrupt.url)
    let blocked = corrupt.makeStore()
    await corrupt.load(blocked, cards: [card(1)])
    blocked.revealAnswer()
    blocked.submitCurrentCard(correct: true)
    check(blocked.reviewSession.completedCount == 0 && blocked.submissionError != nil,
          "unreadable saved queue blocks new writes with an explanation")
    check(try! Data(contentsOf: corrupt.url) == original, "unreadable saved answers are never overwritten")
  }

  @MainActor static func scopeChanges() async {
    let fixture = Fixture()
    defer { fixture.clean() }
    let store = fixture.makeStore()
    await fixture.load(store, cards: [card(1), card(2)])
    store.revealAnswer()
    store.submitCurrentCard(correct: true)
    await fixture.deliverSnapshot(to: store, count: 25, time: 102, account: "account-b")
    check(store.snapshot.currentReviews == 25, "old account pending answer never reduces new account count")
    check(store.reviewSession.cards.isEmpty, "account switch closes old account questions")
    await fixture.deliverSnapshot(to: store, count: 12, time: 101, account: "account-a")
    check(store.snapshot.currentReviews == 25, "late old-account snapshot cannot roll back the active account")
  }

  @MainActor static func subjectCountsAndWrongReceipts() async {
    let fixture = Fixture()
    defer { fixture.clean() }
    let store = fixture.makeStore()
    await fixture.load(store, cards: [card(1), card(2)])
    var breakdown = snapshot(count: 12, time: 101)
    breakdown["currentSubjectCounts"] = ["radical": 2, "kanji": 5, "vocabulary": 5]
    store.session(fixture.transport, didReceiveMessage: breakdown)
    await settle()
    store.revealAnswer()
    store.submitCurrentCard(correct: true)
    check(store.snapshot.currentSubjectCounts?["kanji"] == 4,
          "home subject breakdown follows the optimistic answer")
    check(store.snapshot.currentSubjectCounts?.values.reduce(0, +) == 11,
          "optimistic subject breakdown and total agree")
    let first = fixture.take("submitWatchReview")
    first.reply(["kind": "reviewSubmission", "submissionId": "wrong-id", "success": true])
    await settle()
    check(store.pendingSubmissionCount == 1, "mismatched receipt cannot acknowledge an answer")
    store.retryPendingSubmissions()
    let retry = fixture.take("submitWatchReview")
    let id = retry.value["submissionId"] as! String
    // Make later acknowledgement persistence fail. The paired cached snapshot
    // still proves this answer is included, so the display cannot decrement twice.
    try! FileManager.default.removeItem(at: fixture.url.deletingLastPathComponent())
    try! Data("blocked".utf8).write(to: fixture.url.deletingLastPathComponent())
    await fixture.deliverSnapshot(to: store, count: 11, time: 102, acknowledged: [id])
    check(store.snapshot.currentReviews == 11 && store.pendingSubmissionCount == 0,
          "an outbox write failure during acknowledgement never double-decrements")
  }

  @MainActor static func kanaSubjectCounts() async {
    let fixture = Fixture()
    defer { fixture.clean() }
    let store = fixture.makeStore()
    var kana = card(1, hasReading: false)
    kana["subjectType"] = "kana_vocabulary"
    await fixture.load(store, cards: [kana])
    var breakdown = snapshot(count: 12, time: 101)
    breakdown["currentSubjectCounts"] = ["radical": 2, "kanji": 5, "vocabulary": 5]
    store.session(fixture.transport, didReceiveMessage: breakdown)
    await settle()
    store.revealAnswer()
    store.submitCurrentCard(correct: true)
    check(store.snapshot.currentSubjectCounts?["vocabulary"] == 4,
          "kana vocabulary follows the vocabulary subject total")
  }

  @MainActor static func queueBackoffAndCompatibility() {
    var first = WatchQueuedReview(id: "one", assignmentId: 1, availableAt: nil,
      reviewedAt: "2026-09-13T10:00:00Z", accountIdentifier: "a", meaningIncorrect: 0, readingIncorrect: 0)
    let second = WatchQueuedReview(id: "two", assignmentId: 2, availableAt: nil,
      reviewedAt: "2026-09-13T10:00:00Z", accountIdentifier: "b", meaningIncorrect: 0, readingIncorrect: 0)
    first.attemptCount = 2
    first.nextAttemptAt = 100
    var outbox = WatchReviewOutbox(items: [first, second])
    check(outbox.nextReadyReview(at: Date(timeIntervalSince1970: 99), accountIdentifier: "a") == nil,
          "retry waits for backoff deadline")
    check(outbox.nextReadyReview(at: Date(timeIntervalSince1970: 100), accountIdentifier: "a")?.id == "one",
          "third automatic attempt becomes eligible after backoff")
    outbox.items[0].attemptCount = 3
    check(outbox.nextAttemptDate(accountIdentifier: "a") == nil, "automatic retry stops after three attempts")
    check(outbox.nextReadyReview(at: Date(), accountIdentifier: "b")?.id == "two",
          "another account's saved answer cannot block the current account")
    outbox.items[0].attemptCount = 0
    outbox.items[0].allowsAutomaticRetry = false
    check(outbox.nextReadyReview(at: Date(), accountIdentifier: "a") == nil,
          "permanent rejection requires explicit retry")
    outbox.prepareRetry()
    check(outbox.nextReadyReview(at: Date(), accountIdentifier: "a")?.id == "one",
          "manual retry re-enables preserved answers")
    var json = try! JSONSerialization.jsonObject(with: JSONEncoder().encode(outbox)) as! [String: Any]
    var items = json["items"] as! [[String: Any]]
    items[0].removeValue(forKey: "subjectType")
    json["items"] = items
    let restored = try! JSONDecoder().decode(WatchReviewOutbox.self, from: JSONSerialization.data(withJSONObject: json))
    check(restored.items[0].subjectType == nil && restored.items[0].id == "one",
          "older outbox records without a subject split remain readable")
  }

  @MainActor static func check(_ condition: @autoclosure () -> Bool, _ message: String) {
    checks += 1
    if !condition() { print("FAIL: \(message)"); exit(1) }
  }

  static func card(_ id: Int, hasReading: Bool = true) -> [String: Any] {
    ["id": "\(id)", "assignmentId": id, "subjectId": id, "subjectType": hasReading ? "kanji" : "radical",
     "characters": "山", "meanings": ["Mountain"], "readings": hasReading ? ["さん"] : [],
     "hasReading": hasReading, "srsStage": 4, "availableAt": "2026-09-13T10:00:00Z"]
  }

  static func snapshot(count: Int, time: Double = 100, acknowledged: [String] = [], account: String = "account-a") -> [String: Any] {
    ["currentReviews": count, "lastUpdated": time, "upcomingReviews": [0], "upcomingReviewTimes": [:],
     "isOnVacation": false, "acknowledgedSubmissionIds": acknowledged, "accountIdentifier": account]
  }

  static func settle() async { try? await Task.sleep(nanoseconds: 5_000_000) }

  @MainActor final class Fixture {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    let suite = "kakehashi.watch-tests.\(UUID().uuidString)"
    let transport = WCSession()
    var taken: Set<Int> = []
    var url: URL { directory.appendingPathComponent("queue/answers.json") }
    var defaults: UserDefaults { UserDefaults(suiteName: suite)! }

    init() {
      try! FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    }

    func makeStore() -> WatchReviewStore {
      WCSession.default = transport
      return WatchReviewStore(defaults: defaults, outboxURL: url)
    }

    func deliverSnapshot(to store: WatchReviewStore, count: Int, time: Double = 100,
                         acknowledged: [String] = [], account: String = "account-a") async {
      store.session(transport, didReceiveMessage: snapshot(count: count, time: time, acknowledged: acknowledged, account: account))
      await settle()
    }

    func load(_ store: WatchReviewStore, cards: [[String: Any]]) async {
      await deliverSnapshot(to: store, count: 12)
      store.startReviewSession()
      take("requestReviewSession").reply(["kind": "reviewSession", "cards": cards, "accountIdentifier": "account-a"])
      await settle()
    }

    func take(_ command: String) -> WCSession.Message {
      guard let index = transport.messages.indices.first(where: {
        !taken.contains($0) && transport.messages[$0].value["command"] as? String == command
      }) else {
        print("FAIL: expected \(command) message"); exit(1)
      }
      taken.insert(index)
      return transport.messages[index]
    }

    func clean() {
      defaults.removePersistentDomain(forName: suite)
      try? FileManager.default.removeItem(at: directory)
    }
  }
}
