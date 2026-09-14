import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

// Compile the production reducer without React or WatchConnectivity so these
// data-contract checks also run outside an iOS Simulator.
const nativeSource = readFileSync(new URL("../ios/ReviewNotificationManager.swift", import.meta.url), "utf8");
const start = nativeSource.indexOf("func makeKakehashiReviewPayloadFromAssignments(");
const end = nativeSource.indexOf("@discardableResult", start);
if (start < 0 || end < 0) throw new Error("Could not find production forecast reducer");
const directory = mkdtempSync(join(tmpdir(), "kakehashi-watch-forecast-"));
const sourcePath = join(directory, "main.swift");
const checks = String.raw`
var checks = 0
func check(_ condition: Bool, _ message: String) {
  precondition(condition, message)
  checks += 1
}
let now = ISO8601DateFormatter().date(from: "2026-09-13T12:15:00Z")!
func assignment(_ type: String = "kanji", _ stage: Int = 1, _ available: String = "2026-09-13T13:00:00Z", hidden: Bool = false, started: Bool = true) -> [String: Any] {
  var data: [String: Any] = ["subject_type": type, "srs_stage": stage, "available_at": available, "hidden": hidden]
  if started { data["started_at"] = "2026-01-01T00:00:00Z" }
  return ["data": data]
}
let payload = makeKakehashiReviewPayloadFromAssignments(assignments: [
  assignment("radical", 1), assignment("kanji", 4), assignment("vocabulary", 5),
  assignment("kana_vocabulary", 6), assignment("kanji", 7), assignment("radical", 8),
  assignment("kana_vocabulary", 2, "2026-09-13T12:15:00Z"),
], now: now)
check(payload["currentReviews"] as? Int == 1, "Due-now boundary counts as current")
check(payload["currentSubjectCounts"] as? [String: Int] == ["radical": 0, "kanji": 0, "vocabulary": 1], "Current kana vocabulary shares vocabulary category")
let details = payload["forecastBreakdown"] as! [[String: Any]]
check(details.count == 1, "Assignments at one instant share a forecast slot")
let detail = details[0]
check(detail["count"] as? Int == 6, "Forecast total")
for (key, expected) in ["radical": 2, "kanji": 2, "vocabulary": 2, "apprentice": 2, "guru": 2, "master": 1, "enlightened": 1] {
  check(detail[key] as? Int == expected, "Correct category: \(key)")
}
check((payload["upcomingReviews"] as! [Int]).reduce(0, +) == 6, "Hourly total matches breakdown")
check((payload["upcomingReviewTimes"] as! [String: Int]).values.reduce(0, +) == 6, "Exact total matches breakdown")
check(payload["lastUpdated"] as? Double == now.timeIntervalSince1970, "Forecast retains its measurement time")
let excluded = makeKakehashiReviewPayloadFromAssignments(assignments: [
  assignment(hidden: true), assignment(started: false), assignment("kanji", 0), assignment("kanji", 9),
  assignment("kanji", 1, "bad-date"), assignment("kanji", 1, "2026-09-14T12:15:00Z"),
], now: now)
check((excluded["forecastBreakdown"] as! [[String: Any]]).isEmpty, "Ineligible and outside-horizon subjects omitted")
check((excluded["upcomingReviews"] as! [Int]).reduce(0, +) == 0, "Exclusive horizon keeps totals aligned")
let timezone = makeKakehashiReviewPayloadFromAssignments(assignments: [
  assignment("kanji", 1, "2026-09-13T15:00:00+02:00"), assignment(),
], now: now)
check((timezone["forecastBreakdown"] as! [[String: Any]]).count == 1, "Equivalent timezone timestamps share one slot")
let vacation = makeKakehashiReviewPayloadFromAssignments(assignments: [assignment(), assignment("kanji", 1, "2026-01-01T00:00:00Z")], now: now, isOnVacation: true)
check(vacation["currentReviews"] as? Int == 0, "Vacation has no current reviews")
check((vacation["forecastBreakdown"] as! [[String: Any]]).isEmpty, "Vacation has no forecast")
check((vacation["currentSubjectCounts"] as! [String: Int]).values.reduce(0, +) == 0, "Vacation has no category counts")
let old = makeKakehashiReviewPayload(currentReviews: 8, upcomingReviews: [2], upcomingReviewTimes: nil)
check(old["currentSubjectCounts"] == nil && old["forecastBreakdown"] == nil, "Legacy count-only snapshots do not invent detail")
print("Passed \(checks) native Watch forecast checks")
`;
try {
  writeFileSync(sourcePath, `import Foundation\n${nativeSource.slice(start, end)}\n${checks}`);
  const result = spawnSync("swift", [sourcePath], { encoding: "utf8" });
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(directory, { recursive: true, force: true });
}
