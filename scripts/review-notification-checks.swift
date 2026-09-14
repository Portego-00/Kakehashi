// Run with: node scripts/run-review-notification-checks.mjs
// The runner inserts the real iOS scheduling methods above this harness.
let notificationCheckAnchor = Date(timeIntervalSince1970: 1_789_423_200)
var notificationCheckNow = notificationCheckAnchor

enum UNNotificationSetting {
  case enabled, disabled
}

struct UNNotificationSettings {
  var alertSetting: UNNotificationSetting = .enabled
  var badgeSetting: UNNotificationSetting = .enabled
  var soundSetting: UNNotificationSetting = .enabled
}

final class UNNotificationSound {
  static let `default` = UNNotificationSound()
}

final class UNMutableNotificationContent {
  var title = ""
  var subtitle = ""
  var body = ""
  var categoryIdentifier = ""
  var threadIdentifier = ""
  var userInfo: [AnyHashable: Any] = [:]
  var badge: NSNumber?
  var sound: UNNotificationSound?

  var isVisible: Bool { !title.isEmpty || !subtitle.isEmpty || !body.isEmpty }

  func mutableCopy() -> Any {
    let copy = UNMutableNotificationContent()
    copy.title = title
    copy.subtitle = subtitle
    copy.body = body
    copy.categoryIdentifier = categoryIdentifier
    copy.threadIdentifier = threadIdentifier
    copy.userInfo = userInfo
    copy.badge = badge
    copy.sound = sound
    return copy
  }
}

class UNNotificationTrigger {
  let repeats: Bool
  init(repeats: Bool) { self.repeats = repeats }
}

final class UNTimeIntervalNotificationTrigger: UNNotificationTrigger {
  let timeInterval: TimeInterval
  let scheduledAt: Date
  init(timeInterval: TimeInterval, repeats: Bool) {
    self.timeInterval = timeInterval
    scheduledAt = notificationCheckNow
    super.init(repeats: repeats)
  }
  func nextTriggerDate() -> Date? {
    scheduledAt.addingTimeInterval(timeInterval)
  }
}

final class UNCalendarNotificationTrigger: UNNotificationTrigger {
  let dateComponents: DateComponents
  init(dateMatching dateComponents: DateComponents, repeats: Bool) {
    self.dateComponents = dateComponents
    super.init(repeats: repeats)
  }
  func nextTriggerDate() -> Date? {
    // The checks use absolute one-shot dates rather than repeating calendars.
    Calendar.current.date(from: dateComponents)
  }
}

struct UNNotificationRequest {
  let identifier: String
  let content: UNMutableNotificationContent
  let trigger: UNNotificationTrigger?
}

struct UNNotification {
  let request: UNNotificationRequest
}

final class UNUserNotificationCenter {
  private static let shared = UNUserNotificationCenter()
  static func current() -> UNUserNotificationCenter { shared }

  private(set) var pending: [String: UNNotificationRequest] = [:]
  private(set) var delivered: [String: UNNotificationRequest] = [:]
  private(set) var badge = 0
  private(set) var deliveryHistory: [UNNotificationRequest] = []

  func reset(initialBadge: Int = 0) {
    pending = [:]
    delivered = [:]
    deliveryHistory = []
    badge = initialBadge
    notificationCheckNow = notificationCheckAnchor
  }

  // Apple's documented semantics: a request replaces a pending request with
  // the same ID; once triggered, it replaces a delivered notification with
  // that ID. threadIdentifier only groups cards and cannot replace them.
  // https://developer.apple.com/documentation/usernotifications/unnotificationrequest/init(identifier:content:trigger:)
  func add(_ request: UNNotificationRequest, withCompletionHandler completion: ((Error?) -> Void)? = nil) {
    pending[request.identifier] = request
    completion?(nil)
  }

  func getPendingNotificationRequests(completionHandler: ([UNNotificationRequest]) -> Void) {
    completionHandler(Array(pending.values))
  }

  func removePendingNotificationRequests(withIdentifiers identifiers: [String]) {
    for identifier in identifiers { pending.removeValue(forKey: identifier) }
  }

  func getDeliveredNotifications(completionHandler: ([UNNotification]) -> Void) {
    completionHandler(delivered.values.map { UNNotification(request: $0) })
  }

  func removeDeliveredNotifications(withIdentifiers identifiers: [String]) {
    for identifier in identifiers { delivered.removeValue(forKey: identifier) }
  }

  var pendingInDeliveryOrder: [UNNotificationRequest] {
    pending.values.sorted {
      (nextKakehashiReviewTriggerDate($0.trigger) ?? notificationCheckNow) <
        (nextKakehashiReviewTriggerDate($1.trigger) ?? notificationCheckNow)
    }
  }

  var visibleNotifications: [UNNotificationRequest] {
    delivered.values.filter { $0.content.isVisible }
  }

  func advance(to date: Date) {
    precondition(date >= notificationCheckNow)
    let due = pendingInDeliveryOrder.filter {
      (nextKakehashiReviewTriggerDate($0.trigger) ?? notificationCheckNow) <= date
    }
    notificationCheckNow = date
    for request in due {
      precondition(request.trigger?.repeats != true, "This harness models one-shot forecasts")
      pending.removeValue(forKey: request.identifier)
      deliveryHistory.append(request)
      if let newBadge = request.content.badge { badge = newBadge.intValue }
      // Badge-only requests update the icon without creating visible cards.
      if request.content.isVisible { delivered[request.identifier] = request }
    }
  }
}

enum ForecastTiming: String, CaseIterable {
  case hourly, exact
}

let slotCounts = [2, 3, 5]
let initialReviews = 7
let slotDates = (1...3).map {
  notificationCheckAnchor.addingTimeInterval(Double($0) * 3600)
}
let formatter = ISO8601DateFormatter()
formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

extension NativeReviewScheduler {
  func schedule(
    _ timing: ForecastTiming,
    settings: UNNotificationSettings = UNNotificationSettings(),
    alertsEnabled: Bool = true,
    badgeEnabled: Bool = true,
    soundsEnabled: Bool = true,
    currentReviews: Int = initialReviews,
    counts: [Int] = slotCounts,
    dates: [Date] = slotDates
  ) {
    switch timing {
    case .hourly:
      scheduleUpcomingNotifications(
        currentReviews: currentReviews,
        upcomingReviews: counts,
        settings: settings,
        alertsEnabled: alertsEnabled,
        badgeEnabled: badgeEnabled,
        soundsEnabled: soundsEnabled
      )
    case .exact:
      scheduleExactNotifications(
        currentReviews: currentReviews,
        upcomingReviewTimes: Dictionary(uniqueKeysWithValues: zip(dates, counts).map {
          (formatter.string(from: $0.0), $0.1)
        }),
        settings: settings,
        alertsEnabled: alertsEnabled,
        badgeEnabled: badgeEnabled,
        soundsEnabled: soundsEnabled
      )
    }
  }
}

var checks = 0
var failures: [String] = []
func check(_ condition: @autoclosure () -> Bool, _ message: String) {
  checks += 1
  if !condition() {
    failures.append(message)
    print("FAIL: \(message)")
  }
}

let center = UNUserNotificationCenter.current()
let scheduler = NativeReviewScheduler()

// Guard the test double itself against the tempting but incorrect solution:
// enqueuing every future alert under one stable ID keeps only the last date.
center.reset()
for (index, date) in slotDates.enumerated() {
  let content = UNMutableNotificationContent()
  content.body = "Mock slot \(index + 1)"
  center.add(UNNotificationRequest(
    identifier: "replacement-semantics-check",
    content: content,
    trigger: UNTimeIntervalNotificationTrigger(
      timeInterval: date.timeIntervalSince(notificationCheckNow), repeats: false
    )
  ))
}
check(center.pending.count == 1, "framework model replaces a pending request with the same ID")
center.advance(to: slotDates[0])
check(center.visibleNotifications.isEmpty, "naive stable-ID pre-scheduling loses the first review alert")
center.advance(to: slotDates[2])
let replacement = UNMutableNotificationContent()
replacement.body = "Updated reviews"
center.add(UNNotificationRequest(identifier: "replacement-semantics-check", content: replacement, trigger: nil))
center.advance(to: notificationCheckNow)
check(center.visibleNotifications.count == 1 && center.visibleNotifications.first?.content.body == "Updated reviews",
      "framework model replaces a delivered notification with the same ID")

for timing in ForecastTiming.allCases {
  center.reset(initialBadge: initialReviews)
  scheduler.schedule(timing)
  let firstDate = nextKakehashiReviewTriggerDate(center.pendingInDeliveryOrder.first?.trigger)
  check(firstDate == slotDates[0], "\(timing.rawValue): first review due time survives scheduling the whole forecast")
  for (index, date) in slotDates.enumerated() {
    center.advance(to: date)
    let total = initialReviews + slotCounts.prefix(index + 1).reduce(0, +)
    check(center.badge == total,
          "\(timing.rawValue): badge reaches \(total) at slot \(index + 1), got \(center.badge)")
    check(center.visibleNotifications.count == 1,
          "\(timing.rawValue): one visible notification after overnight slot \(index + 1), got \(center.visibleNotifications.count)")
  }
  check(center.pending.isEmpty, "\(timing.rawValue): full forecast has fired")

  center.reset(initialBadge: initialReviews)
  scheduler.schedule(timing, alertsEnabled: false)
  center.advance(to: slotDates[2])
  check(center.visibleNotifications.isEmpty, "\(timing.rawValue): alerts disabled stays silent")
  check(center.badge == 17, "\(timing.rawValue): alerts disabled preserves all future badge updates")
  check(center.deliveryHistory.allSatisfy { $0.content.sound == nil },
        "\(timing.rawValue): badge-only updates never play a sound")

  center.reset(initialBadge: initialReviews)
  scheduler.schedule(timing, badgeEnabled: false, soundsEnabled: false)
  center.advance(to: slotDates[0])
  check(center.visibleNotifications.count == 1,
        "\(timing.rawValue): alerts enabled without badges delivers a real notification at the first due time")
  center.advance(to: slotDates[2])
  check(center.visibleNotifications.count == 1,
        "\(timing.rawValue): alert-only forecast leaves one notification after all due times")
  check(center.badge == initialReviews, "\(timing.rawValue): badge disabled does not change the icon")
  check(center.deliveryHistory.allSatisfy { $0.content.sound == nil },
        "\(timing.rawValue): sound disabled applies to every scheduled request")

  center.reset()
  scheduler.schedule(timing, settings: UNNotificationSettings(alertSetting: .disabled, badgeSetting: .disabled))
  check(center.pending.isEmpty, "\(timing.rawValue): system denial prevents both alert and badge scheduling")

  // Native background refresh clears and rebuilds pending review requests.
  // Re-arming the next due reminder must replace the already delivered card
  // when that due time arrives, without posting an immediate request that the
  // future request would overwrite before delivery.
  center.reset(initialBadge: initialReviews)
  scheduler.schedule(timing)
  center.advance(to: slotDates[0])
  for nextSlot in 1..<slotDates.count {
    center.advance(to: slotDates[nextSlot - 1].addingTimeInterval(1800))
    center.removePendingNotificationRequests(withIdentifiers:
      center.pending.values.filter(isKakehashiReviewNotification).map(\.identifier)
    )
    let currentTotal = initialReviews + slotCounts.prefix(nextSlot).reduce(0, +)
    scheduler.schedule(
      timing,
      currentReviews: currentTotal,
      counts: Array(slotCounts.dropFirst(nextSlot)),
      dates: Array(slotDates.dropFirst(nextSlot))
    )
    check(center.pending.values.filter { $0.content.isVisible }.count == 1,
          "\(timing.rawValue): background refresh arms only the next visible reminder")
    check(center.visibleNotifications.count == 1,
          "\(timing.rawValue): refresh preserves the existing delivered reminder until the next due time")
    center.advance(to: slotDates[nextSlot])
    let expectedTotal = currentTotal + slotCounts[nextSlot]
    check(center.visibleNotifications.count == 1 &&
          center.visibleNotifications.first?.content.userInfo["reviewCount"] as? Int == expectedTotal,
          "\(timing.rawValue): background refresh replaces the existing notification with count \(expectedTotal)")
    check(center.badge == expectedTotal,
          "\(timing.rawValue): re-planning preserves badge total \(expectedTotal)")
  }
}

// Settings changes transform the real pending schedule without fetching new
// review data. Badge-only requests carry counts so alerts can be enabled again,
// but promoting all of them would recreate the original overnight stack.
for timing in ForecastTiming.allCases {
  center.reset(initialBadge: initialReviews)
  scheduler.schedule(timing, alertsEnabled: false)
  center.advance(to: notificationCheckAnchor.addingTimeInterval(600))

  let unrelatedContent = UNMutableNotificationContent()
  unrelatedContent.body = "Daily study reminder"
  unrelatedContent.userInfo = ["dailyReminder": true]
  let unrelated = UNNotificationRequest(
    identifier: "daily-reminder",
    content: unrelatedContent,
    trigger: UNTimeIntervalNotificationTrigger(timeInterval: 7200, repeats: false)
  )
  center.add(unrelated)

  for alertsEnabled in [true, false, true] {
    let before = Array(center.pending.values)
    let replacements = plannedKakehashiReviewSettingRequests(
      before, showAlert: alertsEnabled, updateBadge: true, playSound: false
    )
    let originalDates = before.filter(isKakehashiReviewNotification)
      .compactMap { nextKakehashiReviewTriggerDate($0.trigger) }.sorted()
    let replacementDates = replacements.compactMap { nextKakehashiReviewTriggerDate($0.trigger) }.sorted()
    check(replacementDates == originalDates,
          "\(timing.rawValue): settings preserve every existing due date when alerts are \(alertsEnabled)")
    check(replacements.filter { $0.content.isVisible }.count == (alertsEnabled ? 1 : 0),
          "\(timing.rawValue): settings select one visible reminder when alerts are \(alertsEnabled)")
    check(Set(replacements.map(\.identifier)).count == replacements.count,
          "\(timing.rawValue): settings never assign a shared ID to multiple pending requests")
    check(replacements.allSatisfy { $0.content.sound == nil },
          "\(timing.rawValue): disabling sounds applies to transformed requests")
    check(!replacements.contains { $0.identifier == unrelated.identifier },
          "\(timing.rawValue): settings leave daily reminders outside the review plan")
    center.removePendingNotificationRequests(withIdentifiers:
      before.filter(isKakehashiReviewNotification).map(\.identifier)
    )
    for replacement in replacements { center.add(replacement) }
    check(center.pending[unrelated.identifier] != nil,
          "\(timing.rawValue): applying review settings preserves unrelated notifications")
  }
  center.removePendingNotificationRequests(withIdentifiers: [unrelated.identifier])
  for (index, date) in slotDates.enumerated() {
    center.advance(to: date)
    check(center.visibleNotifications.count == 1,
          "\(timing.rawValue): settings toggles leave one delivered review card after slot \(index + 1)")
    check(center.badge == initialReviews + slotCounts.prefix(index + 1).reduce(0, +),
          "\(timing.rawValue): settings toggles preserve slot \(index + 1)'s badge total")
  }
}

// Migrate notifications left by a build that scheduled a separate visible card
// for every future slot. Framework request order is unspecified.
center.reset(initialBadge: initialReviews)
let legacyRequests = slotDates.enumerated().map { index, date in
  let content = UNMutableNotificationContent()
  content.title = "New reviews available"
  content.body = "Legacy visible review reminder"
  content.badge = NSNumber(value: initialReviews + slotCounts.prefix(index + 1).reduce(0, +))
  content.sound = UNNotificationSound.default
  return UNNotificationRequest(
    identifier: "review-hourly-\(index)",
    content: content,
    trigger: UNTimeIntervalNotificationTrigger(
      timeInterval: date.timeIntervalSince(notificationCheckNow), repeats: false
    )
  )
}
let migratedRequests = plannedKakehashiReviewSettingRequests(
  legacyRequests.reversed(), showAlert: true, updateBadge: true, playSound: true
)
check(migratedRequests.filter { $0.content.isVisible }.count == 1,
      "legacy migration retains exactly one visible reminder")
check(nextKakehashiReviewTriggerDate(migratedRequests.first { $0.content.isVisible }?.trigger) == slotDates[0],
      "legacy migration selects the earliest due slot regardless of request order")
check(migratedRequests.filter { $0.content.sound != nil }.count == 1,
      "legacy migration silences all later badge updates")
check(legacyRequests.allSatisfy { $0.content.isVisible && $0.content.sound != nil },
      "planning copies content without mutating the original request snapshot")
for request in migratedRequests { center.add(request) }
for (index, date) in slotDates.enumerated() {
  center.advance(to: date)
  check(center.visibleNotifications.count == 1,
        "legacy migration leaves one delivered notification after slot \(index + 1)")
  check(center.badge == initialReviews + slotCounts.prefix(index + 1).reduce(0, +),
        "legacy migration preserves the badge at slot \(index + 1)")
}

// Expo or older builds can leave calendar-based review requests alongside
// native interval requests. Compare concrete trigger types through the same
// helper as production, since the framework base class has no nextTriggerDate.
center.reset(initialBadge: initialReviews)
let calendarTrigger = UNCalendarNotificationTrigger(
  dateMatching: Calendar.current.dateComponents(
    [.year, .month, .day, .hour, .minute, .second], from: slotDates[0]
  ),
  repeats: false
)
let calendarContent = UNMutableNotificationContent()
calendarContent.badge = 9
calendarContent.userInfo = [kakehashiReviewNotificationMarkerKey: true, "reviewCount": 9]
let calendarRequest = UNNotificationRequest(
  identifier: "badge-update-calendar",
  content: calendarContent,
  trigger: calendarTrigger
)
let mixedRequests = plannedKakehashiReviewSettingRequests(
  [legacyRequests[1], calendarRequest], showAlert: true, updateBadge: true, playSound: false
)
let calendarReplacement = mixedRequests.first { $0.content.isVisible }
check(calendarReplacement?.trigger === calendarTrigger,
      "settings preserve the original calendar trigger when promoting its reminder")
check(nextKakehashiReviewTriggerDate(calendarReplacement?.trigger) == slotDates[0],
      "settings select the earliest calendar reminder ahead of a later interval reminder")
for request in mixedRequests { center.add(request) }
center.advance(to: slotDates[0])
check(center.visibleNotifications.count == 1 && center.badge == 9,
      "calendar reminder delivers a real notification at its original due time")
center.advance(to: slotDates[1])
check(center.visibleNotifications.count == 1 && center.badge == 12,
      "later interval reminder updates the badge without a second notification")

print("\(checks - failures.count)/\(checks) native review notification checks passed")
if !failures.isEmpty { exit(1) }
