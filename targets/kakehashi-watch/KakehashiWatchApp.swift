import SwiftUI

@main
struct KakehashiWatchApp: App {
  @StateObject private var reviewStore = WatchReviewStore()
  @Environment(\.scenePhase) private var scenePhase

  var body: some Scene {
    WindowGroup {
      ContentView()
        .environmentObject(reviewStore)
        .onChange(of: scenePhase) { _, newPhase in
          guard newPhase == .active else {
            return
          }

          reviewStore.refresh()
        }
    }
  }
}
