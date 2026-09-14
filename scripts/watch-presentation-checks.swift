// Run with: node scripts/run-watch-presentation-checks.mjs
// The runner supplies the production ReviewSnapshot, WatchConnectionState,
// and WatchSnapshotPresentation definitions. No copied model or live session.
import Foundation

func date(_ text: String) -> Date {
  let formatter = ISO8601DateFormatter()
  return formatter.date(from: text)!
}

let origin = date("2026-09-09T10:30:00Z")

func snapshot(_ times: [String: Int] = [:], counts: [Int] = [2,3,5,7], updated: Date = origin, vacation: Bool = false) -> ReviewSnapshot {
  ReviewSnapshot(currentReviews: 9, upcomingReviews: counts, upcomingReviewTimes: times, lastUpdated: updated.timeIntervalSince1970, isOnVacation: vacation, vacationStartedAt: nil)
}

var checks = 0
func check(_ condition: @autoclosure () -> Bool, _ message: String) {
  precondition(condition(), message)
  checks += 1
}

NSTimeZone.default = TimeZone(secondsFromGMT: 0)!

let empty = WatchSnapshotPresentation(snapshot: .empty, connectionState: .live, now: origin)
check(!empty.hasSnapshot && empty.syncLabel == "Waiting for iPhone", "Zero snapshot cannot be synced")
check(empty.forecast.count == 25 && empty.forecast.allSatisfy { $0.count == 0 }, "Empty forecast covers every clock hour and final partial hour")
check(empty.upcomingTotal == 0 && empty.nextHourCount == 0, "Empty totals")

let fresh = WatchSnapshotPresentation(snapshot: snapshot(), connectionState: .live, now: origin)
check(Array(fresh.forecast.prefix(8).map(\.count)) == [2,3,5,7,0,0,0,0], "Fresh fallback is hour anchored")
check(fresh.forecast[0].date == date("2026-09-09T11:00:00Z"), "First boundary is next clock hour")
check(fresh.syncLabel == "Updated just now", "Fresh age label")
check(fresh.nextHourCount == 2 && fresh.upcomingTotal == 17, "Fallback totals")

let aged = WatchSnapshotPresentation(snapshot: snapshot(), connectionState: .live, now: date("2026-09-09T12:30:00Z"))
check(Array(aged.forecast.prefix(8).map(\.count)) == [5,7,0,0,0,0,0,0], "Aged fallback discards expired hours")
check(aged.syncLabel == "Updated 2h ago", "Live transport doesn't freshen old timestamp")
check(aged.nextHourCount == 5 && aged.upcomingTotal == 12, "Aged fallback totals")

let boundary = WatchSnapshotPresentation(snapshot: snapshot(), connectionState: .stale, now: date("2026-09-09T11:00:00Z"))
check(boundary.forecast[0].date == date("2026-09-09T12:00:00Z") && boundary.forecast[0].count == 3, "Exact current boundary is expired")

let exact = ["2026-09-09T10:45:00Z": 2, "2026-09-09T11:00:00.000Z": 3, "2026-09-09T13:15:00+02:00": 5, "2026-09-09T11:30:00Z": 7, "2026-09-09T09:00:00Z": 100, "2026-09-11T00:00:00Z": 20]
let precise = WatchSnapshotPresentation(snapshot: snapshot(exact), connectionState: .live, now: origin)
check(precise.forecast[0].count == 5 && precise.forecast[1].count == 12, "ISO fractions, offsets, and exact boundary group correctly")
check(precise.nextHourCount == 17 && precise.upcomingTotal == 17, "Next hour is rolling sixty minutes, day excludes distant events")

let preciseBoundary = WatchSnapshotPresentation(snapshot: snapshot(exact), connectionState: .live, now: date("2026-09-09T11:00:00Z"))
check(preciseBoundary.forecast[0].count == 12, "Exact now events removed without shifting future events")

let elapsed = WatchSnapshotPresentation(snapshot: snapshot(["2026-09-09T10:30:00Z": 100]), connectionState: .stale, now: origin)
check(elapsed.upcomingTotal == 0 && elapsed.nextReviewLabel == "No upcoming reviews", "Elapsed exact data never resurrects coarse counts")

let invalid = WatchSnapshotPresentation(snapshot: snapshot(["not a date": 100]), connectionState: .live, now: origin)
check(invalid.forecast.map(\.count) == fresh.forecast.map(\.count), "Malformed exact data falls back")

let zero = WatchSnapshotPresentation(snapshot: snapshot(["2026-09-09T11:00:00Z": 0]), connectionState: .live, now: origin)
check(zero.upcomingTotal == 0, "Valid zero exact data stays authoritative")

let vacation = WatchSnapshotPresentation(snapshot: snapshot(exact, vacation: true), connectionState: .live, now: origin)
check(vacation.forecast.allSatisfy { $0.count == 0 } && vacation.nextReviewLabel == "Reviews paused", "Vacation presentation")

let horizon = WatchSnapshotPresentation(snapshot: snapshot(["2026-09-10T10:30:00Z": 6, "2026-09-10T10:30:00.001Z": 8]), connectionState: .live, now: origin)
check(horizon.upcomingTotal == 6, "24h cutoff includes boundary only")

NSTimeZone.default = TimeZone(identifier: "Europe/Madrid")!
let dstNow = date("2026-10-25T00:30:00Z")
let dst = WatchSnapshotPresentation(snapshot: snapshot(counts: [1,2,3], updated: dstNow), connectionState: .live, now: dstNow)
check(Set(dst.forecast.map(\.id)).count == dst.forecast.count, "DST repeated hour keeps unique identities")
check(zip(dst.forecast.dropLast(), dst.forecast.dropFirst().dropLast()).allSatisfy { $1.date.timeIntervalSince($0.date) == 3600 }, "DST buckets remain consecutive real hours")


NSTimeZone.default = TimeZone(secondsFromGMT: 0)!
let connectionCases: [(WatchConnectionState, String, String)] = [
  (.live, "Updated 2h ago", "Waiting for iPhone"),
  (.stale, "Needs refresh · 2h old", "Waiting for iPhone"),
  (.waitingForPhone, "Open iPhone · 2h old", "Waiting for iPhone"),
  (.inactive, "Open iPhone · 2h old", "Waiting for iPhone"),
  (.error("Could not reach phone"), "Sync failed · 2h old", "Sync failed"),
  (.activating, "Connecting to iPhone", "Connecting to iPhone")
]
for (state, cachedLabel, emptyLabel) in connectionCases {
  let cached = WatchSnapshotPresentation(snapshot: snapshot(), connectionState: state, now: date("2026-09-09T12:30:00Z"))
  check(cached.syncLabel == cachedLabel, "Cached connection state: \(state)")
  let missing = WatchSnapshotPresentation(snapshot: .empty, connectionState: state, now: origin)
  check(missing.syncLabel == emptyLabel, "Empty connection state: \(state)")
}

let justFailed = WatchSnapshotPresentation(snapshot: snapshot(), connectionState: .error("Timeout"), now: origin)
check(justFailed.syncLabel == "Sync failed · <1m old", "Recent snapshot must not hide a connection error")

let justStale = WatchSnapshotPresentation(snapshot: snapshot(), connectionState: .stale, now: origin)
check(justStale.syncLabel == "Needs refresh · <1m old", "Recent snapshot must not hide stale state")

let futureUpdate = WatchSnapshotPresentation(snapshot: snapshot(updated: origin.addingTimeInterval(60)), connectionState: .live, now: origin)
check(futureUpdate.syncLabel == "Updated just now", "Clock skew never creates negative age")

let daysOld = WatchSnapshotPresentation(snapshot: snapshot(), connectionState: .stale, now: origin.addingTimeInterval(2 * 24 * 3600))
check(daysOld.syncLabel == "Needs refresh · 2d old", "Old cache gets compact day age")

func detail(_ timestamp: String, count: Int = 2, radical: Int = 1, kanji: Int = 1, vocabulary: Int = 0, apprentice: Int = 1, guru: Int = 1, master: Int = 0, enlightened: Int = 0) -> WatchForecastDetail {
  WatchForecastDetail(date: timestamp, count: count, radical: radical, kanji: kanji, vocabulary: vocabulary, apprentice: apprentice, guru: guru, master: master, enlightened: enlightened)
}
func detailedSnapshot(_ times: [String: Int], details: [WatchForecastDetail]) -> ReviewSnapshot {
  var result = snapshot(times)
  result.forecastBreakdown = details
  return result
}
let detailSnapshot = detailedSnapshot([
  "2026-09-09T10:45:00Z": 2,
  "2026-09-09T11:00:00Z": 2,
  "2026-09-09T11:15:00Z": 2,
], details: [
  detail("2026-09-09T10:45:00Z"),
  detail("2026-09-09T13:00:00+02:00"),
  detail("2026-09-09T11:15:00.000Z"),
])
let detailed = WatchSnapshotPresentation(snapshot: detailSnapshot, connectionState: .live, now: origin)
check(detailed.hasBreakdown, "Complete exact subject and stage data is available")
check(detailed.forecast[0].subjects == [2,2,0], "Subject counts aggregate exact times within clock hour")
check(detailed.forecast[0].stages == [2,2,0,0], "SRS counts aggregate offsets and fractional dates")
check(detailed.forecast[1].values(for: .subject) == [1,1,0], "Subject toggle selects subject dimension")
check(detailed.forecast[1].values(for: .srs) == [1,1,0,0], "Stage toggle selects SRS dimension")
let rolled = WatchSnapshotPresentation(snapshot: detailSnapshot, connectionState: .live, now: date("2026-09-09T11:00:00Z"))
check(rolled.upcomingTotal == 2 && rolled.forecast[0].subjects == [1,1,0], "Expired forecast and its breakdown roll over together")
let mismatched = WatchSnapshotPresentation(snapshot: detailedSnapshot(["2026-09-09T11:00:00Z": 2], details: [detail("2026-09-09T11:00:00Z", radical: 4)]), connectionState: .live, now: origin)
check(!mismatched.hasBreakdown && mismatched.forecast[0].subjects == nil, "Mismatched subjects never fabricate a split or complete legend")
check(mismatched.forecast[0].stages == [1,1,0,0], "An independently valid stage dimension remains accurate")
let staleSlot = WatchSnapshotPresentation(snapshot: detailedSnapshot(["2026-09-09T11:00:00Z": 2], details: [detail("2026-09-09T10:45:00Z")]), connectionState: .live, now: origin)
check(staleSlot.forecast[0].subjects == nil && !staleSlot.hasBreakdown, "Equal hourly totals cannot disguise a different exact source slot")
let negative = WatchSnapshotPresentation(snapshot: detailedSnapshot(["2026-09-09T11:00:00Z": 2], details: [detail("2026-09-09T11:00:00Z", radical: -1, kanji: 2)]), connectionState: .live, now: origin)
check(negative.forecast[0].subjects == nil, "Negative category data is rejected rather than repaired into a plausible split")
let incomplete = WatchSnapshotPresentation(snapshot: detailedSnapshot(["2026-09-09T11:00:00Z": 2, "2026-09-09T12:00:00Z": 2], details: [detail("2026-09-09T11:00:00Z")]), connectionState: .live, now: origin)
check(!incomplete.hasBreakdown && incomplete.upcomingTotal == 4, "Incomplete legend never claims complete totals; schedule remains usable")
let lastPartial = WatchSnapshotPresentation(snapshot: detailedSnapshot(["2026-09-10T10:15:00Z": 2], details: [detail("2026-09-10T10:15:00Z")]), connectionState: .live, now: origin)
check(lastPartial.forecast.last?.date == date("2026-09-10T10:30:00Z"), "Final partial interval ends exactly24h from now")
check(lastPartial.forecast.last?.subjects == [1,1,0], "Final partial interval retains detailed counts")
check(lastPartial.forecast.reduce(0) { $0 + $1.count } == lastPartial.upcomingTotal, "Displayed rows and rolling24h total agree")
let beyond = WatchSnapshotPresentation(snapshot: detailedSnapshot(["2026-09-10T10:45:00Z": 2], details: [detail("2026-09-10T10:45:00Z")]), connectionState: .live, now: origin)
check(beyond.upcomingTotal == 0 && beyond.forecast.allSatisfy { $0.count == 0 }, "Events beyond rolling24h never leak into final partial bucket")
let oldCache = #"{"currentReviews":3,"upcomingReviews":[2],"upcomingReviewTimes":{},"lastUpdated":1788950000,"isOnVacation":false}"#.data(using: .utf8)!
let decodedOld = try JSONDecoder().decode(ReviewSnapshot.self, from: oldCache)
check(decodedOld.forecastBreakdown == nil && decodedOld.currentSubjectCounts == nil, "Previous version cache decodes with optional fields absent")
let encoded = try JSONEncoder().encode(detailSnapshot)
let decodedNew = try JSONDecoder().decode(ReviewSnapshot.self, from: encoded)
check(decodedNew == detailSnapshot, "Enriched snapshot survives durable cache round-trip")
let nativeMessage: [String: Any] = ["currentReviews": 3, "upcomingReviews": [2], "upcomingReviewTimes": ["2026-09-09T11:00:00Z": 2], "lastUpdated": origin.timeIntervalSince1970, "forecastBreakdown": [["date": "2026-09-09T11:00:00Z", "count": 2, "radical": 1, "kanji": 1, "vocabulary": 0, "apprentice": 1, "guru": 1, "master": 0, "enlightened": 0]]]
let parsedMessage = ReviewSnapshot.from(nativeMessage)!
check(parsedMessage.forecastBreakdown == [detail("2026-09-09T11:00:00Z")], "Actual phone dictionary decodes into Watch detail contract")
check(WatchForecastDetail.decode([["date": "bad", "count": 5]]) == nil, "Malformed optional breakdown cannot break snapshot parsing")
var vacationMessage = nativeMessage
vacationMessage["isOnVacation"] = true
let parsedVacation = ReviewSnapshot.from(vacationMessage)!
let detailedVacation = WatchSnapshotPresentation(snapshot: parsedVacation, connectionState: .live, now: origin)
check(!detailedVacation.hasBreakdown && detailedVacation.upcomingTotal == 0, "Vacation ignores stale detailed payload fields")

print("Passed \(checks) presentation checks (actual ReviewSnapshot and WatchConnectionState source).")
