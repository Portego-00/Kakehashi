import SwiftUI

struct ContentView: View {
  private enum Destination: Hashable { case forecast, review }
  @EnvironmentObject private var reviewStore: WatchReviewStore
  @State private var path: [Destination] = []
  @State private var didSetInitialRoute = false

  var body: some View {
    NavigationStack(path: $path) {
      WatchDashboardView(snapshot: reviewStore.snapshot, connectionState: reviewStore.connectionState,
        isRefreshing: reviewStore.isRefreshing, pendingCount: reviewStore.pendingSubmissionCount,
        syncError: reviewStore.submissionError, onReview: startReviews, onForecast: showForecast,
        onRefresh: reviewStore.refresh, onRetrySync: reviewStore.retryPendingSubmissions)
        .navigationTitle("Kakehashi")
        .toolbarTitleDisplayMode(.inline)
        .navigationDestination(for: Destination.self) { destination in
          switch destination {
          case .forecast:
            WatchForecastView(snapshot: reviewStore.snapshot, connectionState: reviewStore.connectionState,
              isRefreshing: reviewStore.isRefreshing, onRefresh: reviewStore.refresh)
              .navigationTitle("Forecast")
              .toolbarTitleDisplayMode(.inline)
          case .review:
            WatchReviewSessionView(state: reviewStore.reviewSession, onReveal: reviewStore.revealAnswer,
              onSubmit: reviewStore.submitCurrentCard, onClose: finishReviews,
              pendingCount: reviewStore.pendingSubmissionCount, syncError: reviewStore.submissionError,
              onRetrySync: reviewStore.retryPendingSubmissions, onRetryLoading: reviewStore.retryReviewLoading)
              .navigationTitle("")
              .toolbarTitleDisplayMode(.inline)
          }
        }
    }
    .tint(WatchTheme.primary)
    .preferredColorScheme(.dark)
    .onChange(of: path) { oldPath, newPath in
      if oldPath.contains(.review), !newPath.contains(.review) { reviewStore.closeReviewSession() }
    }
    .task {
      guard !didSetInitialRoute else { return }
      didSetInitialRoute = true
      if reviewStore.reviewSession.isActive { path = [.review] }
      #if DEBUG
      if WatchPreviewFixtures.launchScenario?.hasPrefix("forecast") == true { path = [.forecast] }
      #endif
    }
  }

  private func startReviews() {
    reviewStore.startReviewSession()
    path.append(.review)
  }
  private func showForecast() { path.append(.forecast) }
  private func finishReviews() {
    reviewStore.closeReviewSession()
    path.removeAll()
  }
}
