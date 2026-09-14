import Foundation

/// A review stays here until a phone snapshot includes its receipt. A successful
/// reply marks delivery, while retaining the local count adjustment until then.
struct WatchQueuedReview: Codable, Equatable, Identifiable {
  let id: String
  let assignmentId: Int
  let availableAt: String?
  let reviewedAt: String
  let accountIdentifier: String?
  var subjectType: String? = nil
  let meaningIncorrect: Int
  let readingIncorrect: Int
  var isConfirmed = false
  var attemptCount = 0
  var nextAttemptAt: TimeInterval = 0
  var lastError: String?
  var allowsAutomaticRetry = true

  var message: [String: Any] {
    var message: [String: Any] = [
      "command": "submitWatchReview", "submissionId": id,
      "assignmentId": assignmentId, "reviewedAt": reviewedAt,
      "meaningIncorrect": meaningIncorrect, "readingIncorrect": readingIncorrect,
    ]
    if let availableAt { message["availableAt"] = availableAt }
    if let accountIdentifier { message["accountIdentifier"] = accountIdentifier }
    return message
  }
}

struct WatchReviewOutbox: Codable, Equatable {
  var items: [WatchQueuedReview] = []

  var pendingCount: Int { items.filter { !$0.isConfirmed }.count }
  var errorMessage: String? { items.first { !$0.isConfirmed && $0.lastError != nil }?.lastError }

  func nextAttemptDate(accountIdentifier: String?) -> Date? {
    guard let item = firstPending(accountIdentifier: accountIdentifier),
          item.allowsAutomaticRetry, item.attemptCount < 3 else { return nil }
    return Date(timeIntervalSince1970: item.nextAttemptAt)
  }

  func nextReadyReview(at now: Date, accountIdentifier: String?) -> WatchQueuedReview? {
    guard let item = firstPending(accountIdentifier: accountIdentifier),
          item.allowsAutomaticRetry, item.attemptCount < 3,
          item.nextAttemptAt <= now.timeIntervalSince1970 else { return nil }
    return item
  }

  private func firstPending(accountIdentifier: String?) -> WatchQueuedReview? {
    // Retrying in order honors server backoff instead of trying every later answer
    // after a rate limit or outage. Other-account answers wait for that account.
    items.first {
      !$0.isConfirmed && (accountIdentifier == nil || $0.accountIdentifier == nil
        || $0.accountIdentifier == accountIdentifier)
    }
  }

  mutating func acknowledge(_ ids: Set<String>) {
    items.removeAll { ids.contains($0.id) }
  }

  mutating func prepareRetry() {
    for index in items.indices where !items[index].isConfirmed {
      items[index].attemptCount = 0
      items[index].nextAttemptAt = 0
      items[index].lastError = nil
      items[index].allowsAutomaticRetry = true
    }
  }
}

/// File writes are atomic and complete before the question advances. Failure to
/// save leaves the answer on screen so the user can try again without losing it.
struct WatchReviewOutboxStorage {
  let url: URL

  static var defaultURL: URL {
    FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("Kakehashi", isDirectory: true)
      .appendingPathComponent("watch-review-outbox.json")
  }

  func load() throws -> WatchReviewOutbox {
    guard FileManager.default.fileExists(atPath: url.path) else { return WatchReviewOutbox() }
    return try JSONDecoder().decode(WatchReviewOutbox.self, from: Data(contentsOf: url))
  }

  func save(_ outbox: WatchReviewOutbox) throws {
    let directory = url.deletingLastPathComponent()
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    try JSONEncoder().encode(outbox).write(to: url, options: .atomic)
  }
}
