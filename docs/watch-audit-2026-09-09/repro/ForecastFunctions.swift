import Foundation

func nextReviewDate(snapshot: ReviewSnapshot, now: Date) -> Date? {
  let formatter = ISO8601DateFormatter()
  formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

  let exactDates = snapshot.upcomingReviewTimes.compactMap { key, count -> Date? in
    guard count > 0, let date = formatter.date(from: key), date > now else {
      return nil
    }

    return date
  }

  if let exactDate = exactDates.sorted().first {
    return exactDate
  }

  let calendar = Calendar.current
  let start = calendar.nextDate(
    after: now,
    matching: DateComponents(minute: 0, second: 0),
    matchingPolicy: .nextTime
  ) ?? now.addingTimeInterval(3600)

  for (index, count) in snapshot.effectiveUpcomingReviews.enumerated() where count > 0 {
    return start.addingTimeInterval(TimeInterval(index) * 3600)
  }

  return nil
}

func syncAgeLabel(snapshot: ReviewSnapshot, now: Date) -> String {
  guard snapshot.lastUpdated > 0 else {
    return "--"
  }

  let minutes = max(0, Int(now.timeIntervalSince(snapshot.lastUpdatedDate) / 60))
  if minutes < 1 {
    return "now"
  }

  if minutes < 60 {
    return "\(minutes)m"
  }

  return "\(minutes / 60)h"
}

func hourLabel(for date: Date) -> String {
  let formatter = DateFormatter()
  formatter.dateFormat = "ha"
  return formatter.string(from: date).lowercased()
}

func forecast(snapshot: ReviewSnapshot, now: Date) -> [(label: String, count: Int)] {
    let calendar = Calendar.current
    let start = calendar.nextDate(
      after: now,
      matching: DateComponents(minute: 0, second: 0),
      matchingPolicy: .nextTime
    ) ?? now.addingTimeInterval(3600)

	    return Array(snapshot.effectiveUpcomingReviews.prefix(8).enumerated()).map { index, count in
      let date = start.addingTimeInterval(TimeInterval(index) * 3600)
      return (hourLabel(for: date), count)
    }
  }
