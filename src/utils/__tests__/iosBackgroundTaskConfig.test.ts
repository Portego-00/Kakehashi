import fs from "node:fs";
import path from "node:path";

import appConfig from "../../../app.json";

describe("iOS background task configuration", () => {
  it("enables the Expo processing task in source and native configuration", () => {
    const infoPlist = appConfig.expo.ios.infoPlist;
    expect(infoPlist.UIBackgroundModes).toEqual(["processing"]);
    expect(infoPlist.BGTaskSchedulerPermittedIdentifiers).toContain(
      "com.expo.modules.backgroundtask.processing",
    );

    const nativeInfoPlist = fs.readFileSync(
      path.join(process.cwd(), "ios/wanikani/Info.plist"),
      "utf8",
    );
    expect(nativeInfoPlist).toContain("<string>processing</string>");
    expect(nativeInfoPlist).toContain(
      "<string>com.expo.modules.backgroundtask.processing</string>",
    );
  });

  it("uses matching app and Watch bundle identifiers in Debug builds", () => {
    const project = fs.readFileSync(
      path.join(process.cwd(), "ios/wanikani.xcodeproj/project.pbxproj"),
      "utf8",
    );

    expect(project).toContain(
      "INFOPLIST_KEY_WKCompanionAppBundleIdentifier = com.portego00.kakehashi.dev;",
    );
    expect(project).toContain(
      "PRODUCT_BUNDLE_IDENTIFIER = com.portego00.kakehashi.dev.watch;",
    );
    expect(project).toContain(
      "INFOPLIST_KEY_WKCompanionAppBundleIdentifier = com.portego00.kakehashi;",
    );
    expect(project).toContain(
      "PRODUCT_BUNDLE_IDENTIFIER = com.portego00.kakehashi.watch;",
    );
  });

  it("uses the Expo processing task and updates its widget timeline", () => {
    const appDelegate = fs.readFileSync(
      path.join(process.cwd(), "ios/wanikani/AppDelegate.swift"),
      "utf8",
    );
    const backgroundFetch = fs.readFileSync(
      path.join(process.cwd(), "ios/WaniKaniBackgroundFetch.swift"),
      "utf8",
    );

    expect(appDelegate).not.toContain("setMinimumBackgroundFetchInterval");
    expect(appDelegate).not.toContain("performFetchWithCompletionHandler");
    expect(appDelegate).not.toContain(
      "super.application(application, performFetchWithCompletionHandler:",
    );
    expect(appDelegate).not.toContain(
      "let backgroundFetch = WaniKaniBackgroundFetch()",
    );

    expect(backgroundFetch).toContain(
      'let timelineKey = "__expo_widgets_KakehashiHomeWidget_timeline"',
    );
    expect(backgroundFetch).toContain(
      "sharedDefaults.set(updatedTimeline, forKey: timelineKey)",
    );
    expect(backgroundFetch).toContain('entry.props["reviewIllustrationUris"]');
    expect(backgroundFetch).toContain(
      'props["timelineAnchor"] = futureTimestampsToRetain.contains(timestamp)',
    );
    expect(backgroundFetch).toContain(
      "upcomingReviews.prefix(maxWidgetReviewTimelineHours)",
    );
    expect(backgroundFetch).toContain(
      "WidgetCenter.shared.reloadTimelines(ofKind: kakehashiHomeWidgetKind)",
    );
    expect(backgroundFetch).toContain(
      '"widgetBackgroundRefreshEnabled": widgetRefreshEnabled',
    );
    expect(backgroundFetch).toContain(
      "Calendar.current.isDate(bucketDate, inSameDayAs: referenceDate)",
    );

    const reviewNotificationManager = fs.readFileSync(
      path.join(process.cwd(), "ios/ReviewNotificationManager.swift"),
      "utf8",
    );
    expect(reviewNotificationManager).toContain(
      'notificationSettings["widgetBackgroundRefreshEnabled"] ?? true',
    );
    expect(reviewNotificationManager).toContain(
      'forKey: "widget_background_refresh_enabled"',
    );
    expect(reviewNotificationManager).toContain(
      "if latestWidgetBackgroundRefreshEnabled {",
    );
  });

  it("removes the native background API token on logout", () => {
    const backgroundFetch = fs.readFileSync(
      path.join(process.cwd(), "ios/WaniKaniBackgroundFetch.swift"),
      "utf8",
    );

    expect(backgroundFetch).toContain("guard !normalizedApiToken.isEmpty else");
    expect(backgroundFetch).toContain(
      "guard let authSessionSnapshot = KakehashiNativeAuthSession.shared.snapshot() else",
    );
    expect(backgroundFetch).toContain(
      "KakehashiNativeAuthSession.shared.isCurrent(authSessionSnapshot)",
    );
    expect(backgroundFetch).toContain(
      "KakehashiNativeAuthSession.shared.update(apiToken: nil)",
    );
    expect(backgroundFetch).toContain('"hasApiToken": storedApiToken != nil');
    expect(backgroundFetch).toContain(
      'UserDefaults.standard.removeObject(forKey: "wanikani_api_token")',
    );
    expect(backgroundFetch).toContain(
      'UserDefaults(suiteName: "group.com.kakehashi.reviewdata")?\n' +
        '        .removeObject(forKey: "wanikani_api_token")',
    );
  });
});
