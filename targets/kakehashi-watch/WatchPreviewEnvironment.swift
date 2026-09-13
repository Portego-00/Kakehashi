#if DEBUG
import SwiftUI

/// Allows repeatable simulator layout checks without changing the user's Watch settings.
struct WatchPreviewEnvironment: ViewModifier {
  @Environment(\.dynamicTypeSize) private var currentSize

  func body(content: Content) -> some View {
    content.dynamicTypeSize(previewSize ?? currentSize)
  }

  private var previewSize: DynamicTypeSize? {
    guard WatchPreviewFixtures.launchScenario != nil else { return nil }
    switch ProcessInfo.processInfo.environment["KAKEHASHI_WATCH_TEXT_SIZE"] {
    case "large": return .xxxLarge
    case "accessibility": return .accessibility3
    default: return nil
    }
  }
}

#Preview("Dashboard") {
  ContentView().environmentObject(WatchPreviewFixtures.makeStore())
}

#Preview("Long answer") {
  ContentView().environmentObject(WatchPreviewFixtures.makeStore(scenario: "long"))
}

#Preview("Connect iPhone") {
  ContentView().environmentObject(WatchPreviewFixtures.makeStore(scenario: "disconnected"))
}
#endif
