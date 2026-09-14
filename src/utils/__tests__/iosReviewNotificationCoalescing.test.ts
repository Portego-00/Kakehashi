import fs from "node:fs";
import path from "node:path";
import { REVIEW_AVAILABILITY_NOTIFICATION_IDENTIFIER } from "../reviewAvailabilityNotifications";

const reviewNotificationManager = fs.readFileSync(
  path.join(process.cwd(), "ios/ReviewNotificationManager.swift"),
  "utf8",
);
const backgroundFetch = fs.readFileSync(
  path.join(process.cwd(), "ios/WaniKaniBackgroundFetch.swift"),
  "utf8",
);
const appDelegate = fs.readFileSync(
  path.join(process.cwd(), "ios/wanikani/AppDelegate.swift"),
  "utf8",
);
const objectiveCBridge = fs.readFileSync(
  path.join(process.cwd(), "ios/ReviewNotificationManager.m"),
  "utf8",
);
const settingsController = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/features/settings/useSettingsController.ts",
  ),
  "utf8",
);

describe("iOS review notification coalescing", () => {
  it("uses the shared review notification identity for native alerts", () => {
    expect(reviewNotificationManager).toContain(
      'let kakehashiReviewNotificationThreadIdentifier = "kakehashi-reviews"',
    );
    expect(
      reviewNotificationManager.match(
        /content\.threadIdentifier = kakehashiReviewNotificationThreadIdentifier/g,
      ),
    ).toHaveLength(4);
    expect(reviewNotificationManager).toContain(
      `let kakehashiReviewNotificationIdentifier = "${REVIEW_AVAILABILITY_NOTIFICATION_IDENTIFIER}"`,
    );
    expect(reviewNotificationManager).not.toContain("content.summaryArgument");
  });

  it("keeps the standalone badge updater silent and avoids a second alert scheduler", () => {
    expect(backgroundFetch).toContain(
      "if badgeEnabled && !alertsEnabled && data.upcomingReviews.count > 0",
    );
    expect(backgroundFetch).not.toContain(
      'content.title = "New reviews available"',
    );
    expect(backgroundFetch).toContain(
      "let triggerTimeInterval = startInterval + (Double(hour) * 60 * 60)",
    );
    expect(backgroundFetch).not.toContain("Double(hour + 1)");
    expect(backgroundFetch).toContain(
      "// Schedule the replacement requests only after removing the old IDs.",
    );
    expect(appDelegate).toContain(
      "userInfo[kakehashiReviewAlertMarkerKey] as? Bool != true",
    );
  });

  it("cleans up review alerts without clearing unrelated notifications", () => {
    expect(reviewNotificationManager).toContain(
      "func removeDeliveredKakehashiReviewNotifications(",
    );
    expect(appDelegate).toContain(
      "removeDeliveredKakehashiReviewNotifications()",
    );
    expect(reviewNotificationManager).toContain(
      "center.getNotificationCategories { existingCategories in",
    );
    expect(reviewNotificationManager).not.toContain(
      "removeAllPendingNotificationRequests()",
    );
    expect(reviewNotificationManager).toContain(
      "func isKakehashiReviewAlertNotification(",
    );
    expect(reviewNotificationManager).toContain(
      "@objc func clearReviewAlerts(",
    );
    expect(reviewNotificationManager).toContain(
      ".filter(isKakehashiReviewAlertNotification)",
    );
    expect(reviewNotificationManager).toContain(
      "kakehashiLegacyReviewNotificationPrefixes.contains { prefix in",
    );
  });

  it("applies alert, badge, and sound settings to pending requests without changing their triggers", () => {
    expect(reviewNotificationManager).toContain(
      "@objc func applyReviewNotificationSettings(",
    );
    expect(objectiveCBridge).toContain(
      "RCT_EXTERN_METHOD(applyReviewNotificationSettings:",
    );
    expect(reviewNotificationManager).toContain("plannedKakehashiReviewSettingRequests(");
    expect(reviewNotificationManager).toContain("content.title = \"\"");
    expect(reviewNotificationManager).toContain("content.body = \"\"");
    expect(reviewNotificationManager).toContain("content.threadIdentifier = \"\"");
    expect(reviewNotificationManager).toContain("content.badge = nil");
    expect(reviewNotificationManager).toContain(
      "content.sound = playSound ? UNNotificationSound.default : nil",
    );
    expect(reviewNotificationManager).toContain(
      "let nextTriggerDate = intervalTrigger.nextTriggerDate()",
    );
    expect(reviewNotificationManager).toContain(
      "let remainingInterval = nextTriggerDate.timeIntervalSinceNow",
    );
    expect(reviewNotificationManager).toContain("trigger: trigger");
    expect(settingsController.match(
      /await applyNativeReviewNotificationSettings\(/g,
    )).toHaveLength(3);
    expect(reviewNotificationManager).toContain(
      "let latestBadgeEnabled = defaults.object(",
    );
    expect(reviewNotificationManager).toContain(
      "let latestAlertsEnabled = defaults.object(",
    );
    expect(reviewNotificationManager).toContain(
      "let latestSoundsEnabled = defaults.object(",
    );
    expect(reviewNotificationManager).toContain(
      "if defaults.object(forKey: \"review_notifications_enabled\") == nil",
    );
    expect(reviewNotificationManager).toContain(
      "final class KakehashiNativeAuthSession",
    );
    expect(reviewNotificationManager).toContain(
      "KakehashiNativeAuthSession.shared.isCurrent(authSessionSnapshot)",
    );
    expect(backgroundFetch).toContain(
      "private func shouldApplyBadgeOnlyUpdate(",
    );
  });

  it("does not run the obsolete legacy fetch path from lifecycle callbacks", () => {
    expect(appDelegate).not.toContain("performFetchWithCompletionHandler");
    expect(appDelegate).not.toContain("setMinimumBackgroundFetchInterval");
    expect(appDelegate).not.toContain("TriggerReviewUpdate");
    expect(backgroundFetch).not.toContain("TriggerReviewUpdate");
    expect(appDelegate).not.toContain("private func updateAppBadgeCount()");
  });
});
