public import Expo
import React
import ReactAppDependencyProvider
import UserNotifications
import WidgetKit

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    // Setup notifications
    UNUserNotificationCenter.current().delegate = self
    
    // Enable background fetch with minimum interval
    application.setMinimumBackgroundFetchInterval(UIApplication.backgroundFetchIntervalMinimum)
    
    // Request notification permissions
    UNUserNotificationCenter.current().requestAuthorization(options: [.badge, .alert, .sound]) { _, _ in }
    KakehashiWatchBridge.shared.activate()

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
  
  // MARK: - App Lifecycle
  
  public override func applicationDidBecomeActive(_ application: UIApplication) {
    super.applicationDidBecomeActive(application)
    updateAppBadgeCount()
  }
  
  public override func applicationWillResignActive(_ application: UIApplication) {
    super.applicationWillResignActive(application)
    updateAppBadgeCount()
  }
  
  public override func application(
    _ application: UIApplication,
    performFetchWithCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
  ) {
    // Use the WaniKaniBackgroundFetch module to perform background fetch
    let backgroundFetch = WaniKaniBackgroundFetch()
    backgroundFetch.performBackgroundFetch(completionHandler: completionHandler)
  }
  
  // MARK: - Badge and Notification Management
  
  private func updateAppBadgeCount() {
    // Trigger notification update through our background fetch module
    DispatchQueue.main.async {
      NotificationCenter.default.post(
        name: Notification.Name("TriggerReviewUpdate"),
        object: nil
      )
    }
  }
  
  // Handle widget update notifications
  private func processWidgetUpdateNotification(_ userInfo: [AnyHashable: Any]) {
    let timestamp = DateFormatter.localizedString(from: Date(), dateStyle: .none, timeStyle: .medium)
    print("🔄 AppDelegate: Processing widget update notification at \(timestamp)")
    NSLog("🔄 AppDelegate: Processing widget update notification at %@", timestamp)
    
    guard let widgetUpdate = userInfo["widgetUpdate"] as? Bool, widgetUpdate == true else {
      return
    }
    
    guard let currentReviews = userInfo["currentReviews"] as? Int else {
      print("❌ AppDelegate: No currentReviews in widget update notification")
      return
    }
    
    // Get or use default upcoming reviews
    let upcomingReviews = userInfo["upcomingReviews"] as? [Int] ?? Array(repeating: 0, count: 24)
    let upcomingReviewTimes = userInfo["upcomingReviewTimes"] as? [String: Int]
    
    print("📱 AppDelegate: Updating widget with \(currentReviews) reviews from scheduled notification")
    
    // Update widget data in shared App Group
    let syncSuccess = saveKakehashiReviewSnapshot(
      currentReviews: currentReviews,
      upcomingReviews: upcomingReviews,
      upcomingReviewTimes: upcomingReviewTimes,
      logPrefix: "AppDelegate"
    )
    print("✅ AppDelegate: Saved widget data - \(currentReviews) reviews (sync: \(syncSuccess))")
    NSLog("✅ AppDelegate: Saved widget data - %d reviews (sync: %@)", currentReviews, syncSuccess ? "success" : "failed")
    
    // Reload widget timelines
    DispatchQueue.main.async {
      WidgetCenter.shared.reloadAllTimelines()
      WidgetCenter.shared.reloadTimelines(ofKind: kakehashiHomeWidgetKind)
      print("🔄 AppDelegate: Widget reload completed")
      NSLog("🔄 AppDelegate: Widget reload completed")
    }
  }
}

// MARK: - UNUserNotificationCenterDelegate

extension AppDelegate: UNUserNotificationCenterDelegate {
  public func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    let userInfo = notification.request.content.userInfo
    
    // Process widget update notifications even when app is in foreground
    processWidgetUpdateNotification(userInfo)
    
    // Check if this is a silent widget notification (should not show banner)
    if let widgetUpdate = userInfo["widgetUpdate"] as? Bool, widgetUpdate == true {
      // Silent widget notifications should only update badge, no banner or sound
      completionHandler([.badge])
    } else {
      // Show notification normally for regular notifications
      completionHandler([.banner, .sound, .badge])
    }
  }
  
  public func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    // Handle notification taps
    let userInfo = response.notification.request.content.userInfo
    
    // Process widget update notifications first
    processWidgetUpdateNotification(userInfo)
    
    // Handle regular review notifications (only if not a widget update notification)
    if let widgetUpdate = userInfo["widgetUpdate"] as? Bool, widgetUpdate == true {
      // For widget notifications, no additional action needed
      print("📱 AppDelegate: Widget notification processed, no navigation needed")
    } else if let reviewCount = userInfo["reviewCount"] as? Int, reviewCount > 0 {
      // Navigate to reviews screen for regular notifications
      DispatchQueue.main.async {
        // Post notification to React Native to navigate to reviews
        NotificationCenter.default.post(
          name: Notification.Name("NavigateToReviews"),
          object: nil,
          userInfo: userInfo
        )
      }
    }
    
    completionHandler()
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
