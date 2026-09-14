import Foundation

struct WatchForecastBucket: Identifiable, Equatable {
  let date: Date
  let count: Int
  var subjects: [Int]? = nil
  var stages: [Int]? = nil

  func values(for mode: WatchForecastMode) -> [Int]? {
    mode == .subject ? subjects : stages
  }

  var id: Date { date }
}

struct WatchSnapshotPresentation {
  let hasSnapshot: Bool
  let syncLabel: String
  let nextReviewLabel: String
  let forecast: [WatchForecastBucket]
  let upcomingTotal: Int
  let nextHourCount: Int
  let hasBreakdown: Bool

  init(snapshot: ReviewSnapshot, connectionState: WatchConnectionState, now: Date) {
    let calendar = Calendar.current
    let hasSnapshot = snapshot.lastUpdated.isFinite && snapshot.lastUpdated > 0
    self.hasSnapshot = hasSnapshot
    syncLabel = Self.syncLabel(
      lastUpdated: hasSnapshot ? snapshot.lastUpdatedDate : nil,
      connectionState: connectionState,
      now: now
    )

    let firstHour = Self.nextHour(after: now, calendar: calendar)
    let nextDayEnd = now.addingTimeInterval(24 * 3600)
    var forecastDates = (0..<24).compactMap {
      calendar.date(byAdding: .hour, value: $0, to: firstHour)
    }
    // At 10:30 the last clock boundary is tomorrow at 10:00. Include the
    // remaining half-hour so the rows and "Next 24h" total describe one window.
    if forecastDates.last != nextDayEnd {
      forecastDates.append(nextDayEnd)
    }
    let exactTimes = Self.parseExactTimes(snapshot.upcomingReviewTimes)
    let scheduledReviews: [WatchForecastBucket]

    if !hasSnapshot || snapshot.isOnVacation {
      scheduledReviews = []
    } else if !exactTimes.isEmpty {
      // Valid elapsed timestamps still take precedence over the coarse array.
      // Falling back after they expire would bring old reviews back into view.
      scheduledReviews = exactTimes
    } else {
      let anchor = Self.nextHour(after: snapshot.lastUpdatedDate, calendar: calendar)
      scheduledReviews = snapshot.upcomingReviews.enumerated().compactMap { index, count in
        guard let date = calendar.date(byAdding: .hour, value: index, to: anchor) else {
          return nil
        }
        return WatchForecastBucket(date: date, count: max(0, count))
      }
    }

    let futureReviews = scheduledReviews
      .filter { $0.date > now && $0.count > 0 }
      .sorted { $0.date < $1.date }
    let nextHourEnd = now.addingTimeInterval(3600)
    nextHourCount = futureReviews
      .filter { $0.date <= nextHourEnd }
      .reduce(0) { $0 + $1.count }
    upcomingTotal = futureReviews
      .filter { $0.date <= nextDayEnd }
      .reduce(0) { $0 + $1.count }

    var countsByHour: [Date: Int] = [:]
    for review in futureReviews where review.date <= nextDayEnd {
      // Each displayed time is the end of its clock-hour interval. Reviews
      // exactly on that boundary belong there, not one hour later.
      let interval = calendar.dateInterval(of: .hour, for: review.date)
      let boundary = interval?.start == review.date ? review.date : interval?.end ?? review.date
      countsByHour[min(boundary, nextDayEnd), default: 0] += review.count
    }
    var detailsByHour: [Date: (subjects: [Int], stages: [Int])] = [:]
    var invalidSubjectHours = Set<Date>()
    var invalidStageHours = Set<Date>()
    let exactCounts = Dictionary(exactTimes.map { ($0.date, $0.count) }, uniquingKeysWith: +)
    if hasSnapshot && !snapshot.isOnVacation {
      for detail in snapshot.forecastBreakdown ?? [] {
        guard let date = Self.parseDate(detail.date), date > now, date <= nextDayEnd else { continue }
        let interval = calendar.dateInterval(of: .hour, for: date)
        let boundary = min(interval?.start == date ? date : interval?.end ?? date, nextDayEnd)
        var sums = detailsByHour[boundary] ?? (Array(repeating: 0, count: 3), Array(repeating: 0, count: 4))
        // Matching only the hourly sum could hide stale detail from a different
        // availability time. Validate the exact source slot and each dimension.
        let matchesSource = detail.count >= 0 && exactCounts[date] == detail.count
        if matchesSource && detail.subjects.reduce(0, +) == detail.count &&
          [detail.radical, detail.kanji, detail.vocabulary].allSatisfy({ $0 >= 0 }) {
          sums.subjects = zip(sums.subjects, detail.subjects).map(+)
        } else {
          invalidSubjectHours.insert(boundary)
        }
        if matchesSource && detail.stages.reduce(0, +) == detail.count &&
          [detail.apprentice, detail.guru, detail.master, detail.enlightened].allSatisfy({ $0 >= 0 }) {
          sums.stages = zip(sums.stages, detail.stages).map(+)
        } else {
          invalidStageHours.insert(boundary)
        }
        detailsByHour[boundary] = sums
      }
    }
    let buckets = forecastDates.map { date in
      let count = countsByHour[date, default: 0]
      let detail = detailsByHour[date]
      let subjects = !invalidSubjectHours.contains(date) && detail?.subjects.reduce(0, +) == count
        ? detail?.subjects : nil
      let stages = !invalidStageHours.contains(date) && detail?.stages.reduce(0, +) == count
        ? detail?.stages : nil
      return WatchForecastBucket(date: date, count: count, subjects: subjects, stages: stages)
    }
    forecast = buckets
    hasBreakdown = hasSnapshot && !snapshot.isOnVacation && snapshot.forecastBreakdown != nil &&
      buckets.filter { $0.count > 0 }.allSatisfy { $0.subjects != nil && $0.stages != nil }

    if !hasSnapshot {
      nextReviewLabel = "Waiting for iPhone"
    } else if snapshot.isOnVacation {
      nextReviewLabel = "Reviews paused"
    } else if let next = futureReviews.first {
      let formatter = RelativeDateTimeFormatter()
      formatter.unitsStyle = .abbreviated
      nextReviewLabel = "Next \(formatter.localizedString(for: next.date, relativeTo: now))"
    } else {
      nextReviewLabel = "No upcoming reviews"
    }
  }

  private static func nextHour(after date: Date, calendar: Calendar) -> Date {
    calendar.dateInterval(of: .hour, for: date)?.end ?? date.addingTimeInterval(3600)
  }

  private static func parseDate(_ value: String) -> Date? {
    let fractional = ISO8601DateFormatter()
    fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return fractional.date(from: value) ?? ISO8601DateFormatter().date(from: value)
  }

  private static func parseExactTimes(_ values: [String: Int]) -> [WatchForecastBucket] {
    let fractional = ISO8601DateFormatter()
    fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    let wholeSeconds = ISO8601DateFormatter()
    wholeSeconds.formatOptions = [.withInternetDateTime]

    return values.compactMap { timestamp, count in
      guard let date = fractional.date(from: timestamp) ?? wholeSeconds.date(from: timestamp) else {
        return nil
      }
      return WatchForecastBucket(date: date, count: max(0, count))
    }
  }

  private static func syncLabel(
    lastUpdated: Date?,
    connectionState: WatchConnectionState,
    now: Date
  ) -> String {
    guard let lastUpdated else {
      switch connectionState {
      case .activating:
        return "Connecting to iPhone"
      case .error:
        return "Sync failed"
      default:
        return "Waiting for iPhone"
      }
    }

    let minutes = max(0, Int(now.timeIntervalSince(lastUpdated) / 60))
    let age: String
    if minutes < 1 {
      age = "<1m"
    } else if minutes < 60 {
      age = "\(minutes)m"
    } else if minutes < 24 * 60 {
      age = "\(minutes / 60)h"
    } else {
      age = "\(minutes / (24 * 60))d"
    }

    switch connectionState {
    case .live:
      return minutes < 1 ? "Updated just now" : "Updated \(age) ago"
    case .stale:
      return "Needs refresh · \(age) old"
    case .waitingForPhone, .inactive:
      return "Open iPhone · \(age) old"
    case .error:
      return "Sync failed · \(age) old"
    case .activating:
      return "Connecting to iPhone"
    }
  }
}
