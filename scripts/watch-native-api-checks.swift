// Exercise the production phone API through URLProtocol: no real network or account.
final class WatchMockProtocol: URLProtocol {
  static let lock = NSLock()
  static var assignmentRequests = 0
  static var subjectRequests = 0
  static var imageRequests = 0
  static var imageHadAuthorization = false
  static var failFirstImage = true
  static var includeUnsupportedImage = false
  static var postRequests: [Int: Int] = [:]
  static var assignmentLookupRequests = 0
  static var loseNextPost: [Int: Bool] = [:]
  static var advanced = Set<Int>()
  static var capturedReviewDates: [Int: String] = [:]
  static var holdNextAssignments = false
  static var heldResponse: (() -> Void)?
  static let responseHeld = DispatchSemaphore(value: 0)
  static let dueAt = "2026-09-01T00:00:00Z"
  static let reviewedAt = "2026-09-02T00:00:00Z"
  static func assignment(_ id: Int) -> [String: Any] {
    ["id": id, "data": ["subject_id": id, "subject_type": "kanji", "srs_stage": advanced.contains(id) ? 2 : 1,
      "started_at": "2026-08-01T00:00:00Z", "hidden": false,
      "available_at": advanced.contains(id) ? "2026-12-01T00:00:00Z" : dueAt]]
  }
  static func subject(_ id: Int) -> [String: Any] {
    if id == 83 || id == 86 {
      return ["id": id, "object": "radical", "data": ["characters": NSNull(),
        "meanings": [["meaning": "Droplet", "primary": true]],
        "character_images": [["url": "https://cdn.wanikani.com/radical.svg",
          "content_type": id == 83 ? "image/svg+xml" : "image/jpeg"]]]]
    }
    return ["id": id, "object": "kanji", "data": ["characters": "日", "meanings": [["meaning": "sun", "primary": true]], "readings": [["reading": "にち", "primary": true]]]]
  }
  override class func canInit(with request: URLRequest) -> Bool { true }
  override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
  override func startLoading() {
    Self.lock.lock()
    defer { Self.lock.unlock() }
    let url = request.url!
    let components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
    let query = Dictionary(uniqueKeysWithValues: (components.queryItems ?? []).map { ($0.name, $0.value ?? "") })
    if url.host == "cdn.wanikani.com" {
      Self.imageRequests += 1
      Self.imageHadAuthorization = Self.imageHadAuthorization || request.value(forHTTPHeaderField: "Authorization") != nil
      if Self.failFirstImage {
        Self.failFirstImage = false
        client?.urlProtocol(self, didFailWithError: URLError(.networkConnectionLost))
      } else {
        client?.urlProtocol(self, didReceive: HTTPURLResponse(url: url, statusCode: 200, httpVersion: nil, headerFields: ["Content-Type": "image/svg+xml"])!, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data("mock-radical-svg".utf8))
        client?.urlProtocolDidFinishLoading(self)
      }
      return
    }
    var body: [String: Any]
    if request.httpMethod == "POST" {
      var requestData = request.httpBody
      if requestData == nil, let stream = request.httpBodyStream {
        stream.open(); defer { stream.close() }
        var bytes = [UInt8](repeating: 0, count: 4096); var data = Data()
        while stream.hasBytesAvailable { let n = stream.read(&bytes, maxLength: bytes.count); if n <= 0 { break }; data.append(bytes, count: n) }
        requestData = data
      }
      let json = try! JSONSerialization.jsonObject(with: requestData!) as! [String: Any]
      let review = json["review"] as! [String: Any]; let id = review["assignment_id"] as! Int
      Self.postRequests[id, default: 0] += 1
      Self.capturedReviewDates[id] = review["created_at"] as? String
      if let commit = Self.loseNextPost.removeValue(forKey: id) {
        if commit { Self.advanced.insert(id) }
        client?.urlProtocol(self, didFailWithError: URLError(.networkConnectionLost)); return
      }
      Self.advanced.insert(id)
      body = ["resources_updated": ["assignment": Self.assignment(id)]]
    } else if url.path.hasSuffix("/assignments") {
      Self.assignmentRequests += 1
      let second = query["page_after_id"] != nil
      let ids = second ? Array(51...(Self.includeUnsupportedImage ? 86 : 85)) : Array(1...50)
      body = ["data": ids.map(Self.assignment), "pages": ["next_url": second ? NSNull() : ("https://api.wanikani.com/v2/assignments?page_after_id=50" as Any)]]
    } else if url.path.contains("/assignments/") {
      Self.assignmentLookupRequests += 1
      body = Self.assignment(Int(url.lastPathComponent)!)
    } else if url.path.hasSuffix("/subjects") {
      Self.subjectRequests += 1
      let ids = query["ids"]!.split(separator: ",").compactMap { Int($0) }
      // Even subject ID requests can be paginated; keep the same filter on next_url.
      let next = query["subject_page"] == nil && ids.count > 20
      let returned = next ? Array(ids.prefix(20)) : query["subject_page"] == nil ? ids : Array(ids.dropFirst(20))
      body = ["data": returned.map(Self.subject), "pages": ["next_url": next ? (url.absoluteString + "&subject_page=2" as Any) : NSNull()]]
    } else { fatalError("Unexpected mock route: \(url.path)") }
    let data = try! JSONSerialization.data(withJSONObject: body)
    let respond = {
      self.client?.urlProtocol(self, didReceive: HTTPURLResponse(url: url, statusCode: 200, httpVersion: nil, headerFields: nil)!, cacheStoragePolicy: .notAllowed)
      self.client?.urlProtocol(self, didLoad: data)
      self.client?.urlProtocolDidFinishLoading(self)
    }
    if Self.holdNextAssignments && url.path.hasSuffix("/assignments") {
      Self.holdNextAssignments = false
      Self.heldResponse = respond
      Self.responseHeld.signal()
    } else { respond() }
  }
  override func stopLoading() {}
}
URLProtocol.registerClass(WatchMockProtocol.self)
UserDefaults.standard.set("mock-account", forKey: kakehashiStoredAPITokenKey)
defer { for key in UserDefaults.standard.dictionaryRepresentation().keys where key.hasPrefix(testDefaultsPrefix) { UserDefaults.standard.removeObject(forKey: key) } }
var checks = 0
func check(_ condition: @autoclosure () -> Bool, _ message: String) {
  guard condition() else { print("FAIL: \(message)"); exit(1) }
  checks += 1
}
func awaitReply(_ operation: (@escaping ([String: Any]) -> Void) -> Void) -> [String: Any] {
  let semaphore = DispatchSemaphore(value: 0); var reply: [String: Any] = [:]
  operation { reply = $0; semaphore.signal() }
  guard semaphore.wait(timeout: .now() + 10) == .success else { print("FAIL: request timed out"); exit(1) }
  return reply
}
let first = awaitReply { KakehashiWatchReviewAPI.loadReviewSession(completion: $0) }
check((first["cards"] as? [[String: Any]])?.count == 40, "first page delivers 40 cards")
check(first["totalCount"] as? Int == 85, "all 85 due assignments included, beyond original ten and first API page")
check(WatchMockProtocol.assignmentRequests == 2, "follows assignments next_url")
check(WatchMockProtocol.subjectRequests == 2, "follows subjects next_url; prepares first 40 only")
var cards = first["cards"] as! [[String: Any]]; var cursor = first["nextCursor"] as? String
while let next = cursor {
  var reply = awaitReply { KakehashiWatchReviewAPI.loadReviewSession(cursor: next, completion: $0) }
  if reply["error"] != nil {
    check((reply["error"] as? String)?.contains("radical image") == true, "image download failure explains how to retry")
    check((reply["cards"] as? [[String: Any]])?.isEmpty == true, "failed image preparation never sends an unanswerable card")
    reply = awaitReply { KakehashiWatchReviewAPI.loadReviewSession(cursor: next, completion: $0) }
  }
  cards += reply["cards"] as? [[String: Any]] ?? []; cursor = reply["nextCursor"] as? String
}
check(cards.count == 85, "all transport pages continue to 85")
check(Set(cards.compactMap { $0["assignmentId"] as? Int }).count == 85, "each assignment delivered exactly once")
let imageCard = cards.first { $0["assignmentId"] as? Int == 83 }!
check(imageCard["characters"] as? String == "", "image-only radical never reveals its English meaning as the question")
check(Data(base64Encoded: imageCard["characterImageData"] as! String) != nil, "SVG radical carries a cached raster image with its review card")
check(imageCard["hasReading"] as? Bool == false, "image-only radical remains meaning-only")
check(!WatchMockProtocol.imageHadAuthorization, "public image downloads never receive the API token")
let imageRequests = WatchMockProtocol.imageRequests

let assignmentRequests = WatchMockProtocol.assignmentRequests; let subjectRequests = WatchMockProtocol.subjectRequests
let repeated = awaitReply { KakehashiWatchReviewAPI.loadReviewSession(completion: $0) }
check(repeated["totalCount"] as? Int == 85, "cached preparation keeps whole queue")
check(WatchMockProtocol.assignmentRequests == assignmentRequests && WatchMockProtocol.subjectRequests == subjectRequests, "warm preparation performs no network requests")
let cachedImagePage = awaitReply { KakehashiWatchReviewAPI.loadReviewSession(excludedAssignmentIds: Array(1...82), completion: $0) }
check((cachedImagePage["cards"] as? [[String: Any]])?.first?["characterImageData"] as? String == imageCard["characterImageData"] as? String, "prepared radical image survives warm session reuse")
check(WatchMockProtocol.imageRequests == imageRequests, "cached radical does not download again")

let excluded = awaitReply { KakehashiWatchReviewAPI.loadReviewSession(excludedAssignmentIds: [1, 2, 3], completion: $0) }
check(excluded["totalCount"] as? Int == 82, "excludes already answered local items from total")
let refresh = awaitReply { KakehashiWatchReviewAPI.refreshSnapshot(completion: $0) }
check(WatchMockProtocol.assignmentRequests == assignmentRequests + 2, "explicit refresh fetches fresh pages")
check(refresh["currentReviews"] as? Int == 85, "fresh snapshot counts all due reviews")
let scope = first["accountIdentifier"] as! String
func submit(_ id: Int, submissionId: String, scopeOverride: String? = nil) -> [String: Any] {
  awaitReply { KakehashiWatchReviewAPI.submitReview(assignmentId: id, submissionId: submissionId,
    availableAt: WatchMockProtocol.dueAt, reviewedAt: WatchMockProtocol.reviewedAt,
    account: scopeOverride ?? scope, meaningIncorrect: 0, readingIncorrect: 0, completion: $0) }
}
let submitted = submit(1, submissionId: "test-1")
check(submitted["success"] as? Bool == true, "successful answer acknowledged")
check(WatchMockProtocol.capturedReviewDates[1] == WatchMockProtocol.reviewedAt, "POST preserves original answer time")
let snapshot = submitted["snapshot"] as? [String: Any]
check(snapshot?["currentReviews"] as? Int == 84, "ack snapshot already includes count mutation")
check((snapshot?["acknowledgedSubmissionIds"] as? [String])?.contains("test-1") == true, "snapshot identifies incorporated answer")
let duplicate = submit(1, submissionId: "test-1")
check(duplicate["success"] as? Bool == true && WatchMockProtocol.postRequests[1] == 1, "duplicate delivery never repeats POST")
check((duplicate["snapshot"] as? [String: Any])?["currentReviews"] as? Int == 84, "duplicate delivery never decrements twice")
WatchMockProtocol.loseNextPost[2] = true
check(submit(2, submissionId: "test-2")["success"] as? Bool == false, "uncertain POST retained as error")
check(submit(2, submissionId: "test-2")["success"] as? Bool == true, "uncertain committed answer reconciled")
check(WatchMockProtocol.postRequests[2] == 1, "lost success reply never duplicates review")
WatchMockProtocol.loseNextPost[3] = false
check(submit(3, submissionId: "test-3")["success"] as? Bool == false, "failed network attempt reports error")
check(submit(3, submissionId: "test-3")["success"] as? Bool == true, "unchanged assignment retries saved answer")
check(WatchMockProtocol.postRequests[3] == 2, "retry only posts after confirming same due cycle")
let wrongAccount = submit(4, submissionId: "test-4", scopeOverride: "different-account")
check(wrongAccount["success"] as? Bool == false && wrongAccount["retryable"] as? Bool == false, "old account answer rejected")
check(WatchMockProtocol.postRequests[4] == nil, "account mismatch never reaches server")
// Keep a stale GET in flight while an optimistic answer succeeds.
WatchMockProtocol.holdNextAssignments = true
let refreshDone = DispatchSemaphore(value: 0)
var delayedSnapshot: [String: Any] = [:]
KakehashiWatchReviewAPI.refreshSnapshot { delayedSnapshot = $0; refreshDone.signal() }
check(WatchMockProtocol.responseHeld.wait(timeout: .now() + 10) == .success, "refresh response held deterministically")
check(submit(5, submissionId: "test-5")["success"] as? Bool == true, "answer completes while older GET is in flight")
WatchMockProtocol.heldResponse?(); WatchMockProtocol.heldResponse = nil
check(refreshDone.wait(timeout: .now() + 10) == .success, "delayed refresh completes")
check(delayedSnapshot["currentReviews"] as? Int == 81, "older GET cannot undo an acknowledged answer")
check((delayedSnapshot["acknowledgedSubmissionIds"] as? [String])?.contains("test-5") == true, "race snapshot count and acknowledgement agree")

// A later timestamp on a stale mobile aggregate must not reintroduce an answer.
var mobileSnapshot = delayedSnapshot
mobileSnapshot.removeValue(forKey: "acknowledgedSubmissionIds")
mobileSnapshot["currentReviews"] = 85
mobileSnapshot["lastUpdated"] = Date().addingTimeInterval(1).timeIntervalSince1970
let coherentSnapshot = awaitReply { done in
  KakehashiWatchReviewAPI.resolveSnapshot(mobileSnapshot) { done($0 ?? [:]) }
}
check(coherentSnapshot["currentReviews"] as? Int == 81, "new timestamp cannot make stale JS assignments authoritative")
check((coherentSnapshot["acknowledgedSubmissionIds"] as? [String])?.contains("test-5") == true, "resolved mobile aggregate pairs real counts with receipts")

// Reload the actual persisted receipt ledger by changing scopes and coming back.
KakehashiNativeAuthSession.shared.update(apiToken: "other-mock-account")
_ = awaitReply { KakehashiWatchReviewAPI.loadReviewSession(completion: $0) }
KakehashiNativeAuthSession.shared.update(apiToken: "mock-account")
_ = awaitReply { KakehashiWatchReviewAPI.loadReviewSession(completion: $0) }
check(submit(1, submissionId: "test-1")["success"] as? Bool == true, "persisted receipt survives memory reset")
check(WatchMockProtocol.postRequests[1] == 1, "persisted receipt prevents duplicate POST after reload")

// A large forecast must fit WatchConnectivity without losing or mismatching bins.
let anchor = Date(timeIntervalSince1970: 1_789_337_345)
let formatter = ISO8601DateFormatter(); formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
var times: [String: Int] = [:]; var details: [[String: Any]] = []
for index in 1...2000 {
  let date = formatter.string(from: anchor.addingTimeInterval(Double(index) * 43))
  times[date] = 1
  details.append(["date": date, "count": 1, "radical": 0, "kanji": 1, "vocabulary": 0, "apprentice": 1, "guru": 0, "master": 0, "enlightened": 0])
}
let largePayload: [String: Any] = ["kind": "reviewSnapshot", "lastUpdated": anchor.timeIntervalSince1970,
  "currentReviews": 0, "upcomingReviewTimes": times, "upcomingReviews": Array(repeating: 0, count: 24), "forecastBreakdown": details]
let bounded = KakehashiWatchReviewAPI.decoratedSnapshot(largePayload)
let boundedTimes = bounded["upcomingReviewTimes"] as! [String: Int]
let boundedDetails = bounded["forecastBreakdown"] as! [[String: Any]]
let encoded = try! PropertyListSerialization.data(fromPropertyList: bounded, format: .binary, options: 0)
check(encoded.count < 48_000, "2000 fragmented forecast dates fit WatchConnectivity")
check(boundedTimes.count <= 97 && boundedTimes.values.reduce(0, +) == 2000, "forecast compaction keeps all 24-hour reviews")
check(boundedDetails.allSatisfy { boundedTimes[$0["date"] as! String] == $0["count"] as? Int }, "compacted breakdown keys and counts match exact forecast bins")
check(boundedDetails.reduce(0) { $0 + ($1["kanji"] as! Int) } == 2000, "compaction preserves subject breakdown")
check(boundedDetails.reduce(0) { $0 + ($1["apprentice"] as! Int) } == 2000, "compaction preserves SRS breakdown")
check(boundedTimes.keys.compactMap { formatter.date(from: $0) }.max() == anchor.addingTimeInterval(24 * 3600), "last partial hour clamps to 24-hour horizon")
// Resolve callbacks must not relabel an old account's counts after an account switch.
let queueHeld = DispatchSemaphore(value: 0)
let releaseQueue = DispatchSemaphore(value: 0)
KakehashiWatchReviewAPI.loadReviewSession { _ in queueHeld.signal(); _ = releaseQueue.wait(timeout: .now() + 10) }
check(queueHeld.wait(timeout: .now() + 10) == .success, "native work queue held deterministically")
let accountResolveDone = DispatchSemaphore(value: 0)
var staleAccountResult: [String: Any]?
KakehashiWatchReviewAPI.resolveSnapshot(delayedSnapshot) { staleAccountResult = $0; accountResolveDone.signal() }
KakehashiNativeAuthSession.shared.update(apiToken: "replacement-account")
releaseQueue.signal()
check(accountResolveDone.wait(timeout: .now() + 10) == .success, "queued old account snapshot resolves")
check(staleAccountResult == nil, "queued old account snapshot cannot be published under new account")
let relabeled = awaitReply { done in KakehashiWatchReviewAPI.resolveSnapshot(delayedSnapshot) { done($0 ?? [:]) } }
check(relabeled.isEmpty, "explicit old account scope is rejected instead of relabeled")
// In-flight assignment collections are coalesced only within the same account.
KakehashiNativeAuthSession.shared.update(apiToken: "first-fetch-account")
WatchMockProtocol.holdNextAssignments = true
let oldFetchDone = DispatchSemaphore(value: 0)
var oldFetch: [String: Any] = [:]
let fetchCountBeforeSwitch = WatchMockProtocol.assignmentRequests
KakehashiWatchReviewAPI.refreshSnapshot { oldFetch = $0; oldFetchDone.signal() }
check(WatchMockProtocol.responseHeld.wait(timeout: .now() + 10) == .success, "old account fetch held")
KakehashiNativeAuthSession.shared.update(apiToken: "second-fetch-account")
let newFetch = awaitReply { KakehashiWatchReviewAPI.refreshSnapshot(completion: $0) }
check(newFetch["currentReviews"] as? Int == 81, "new account fetch can finish before old account")
check(WatchMockProtocol.assignmentRequests == fetchCountBeforeSwitch + 3, "different account never joins old assignment request")
WatchMockProtocol.heldResponse?(); WatchMockProtocol.heldResponse = nil
check(oldFetchDone.wait(timeout: .now() + 10) == .success && oldFetch["error"] != nil, "old fetch rejected when its account changed")
// Unsupported image formats leave the page retryable, without silently skipping a radical.
WatchMockProtocol.includeUnsupportedImage = true
KakehashiNativeAuthSession.shared.update(apiToken: "unsupported-image-account")
var unsupported = awaitReply { KakehashiWatchReviewAPI.loadReviewSession(completion: $0) }
while let cursor = unsupported["nextCursor"] as? String {
  unsupported = awaitReply { KakehashiWatchReviewAPI.loadReviewSession(cursor: cursor, completion: $0) }
}
check((unsupported["error"] as? String)?.contains("radical image") == true, "missing supported image reports a clear preparation error")
check((unsupported["cards"] as? [[String: Any]])?.isEmpty == true, "unsupported image is not replaced with an English answer")
print("\(checks) native Watch API checks passed (mocked transport; no real reviews submitted).")
