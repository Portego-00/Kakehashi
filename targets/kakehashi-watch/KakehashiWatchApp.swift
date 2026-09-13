import SwiftUI

@main
struct KakehashiWatchApp: App {
  @StateObject private var reviewStore: WatchReviewStore
  @Environment(\.scenePhase) private var scenePhase

  init() {
    #if DEBUG
    if let scenario = WatchPreviewFixtures.launchScenario {
      _reviewStore = StateObject(wrappedValue: WatchPreviewFixtures.makeStore(scenario: scenario))
      return
    }
    #endif
    _reviewStore = StateObject(wrappedValue: WatchReviewStore())
  }

  var body: some Scene {
    WindowGroup {
      ContentView()
        .environmentObject(reviewStore)
        #if DEBUG
        .modifier(WatchPreviewEnvironment())
        #endif
        .onChange(of: scenePhase) { _, newPhase in
          guard newPhase == .active else {
            return
          }

          reviewStore.refresh()
        }
    }
  }
}
