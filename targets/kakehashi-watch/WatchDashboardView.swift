import SwiftUI

struct WatchDashboardView: View {
  let snapshot: ReviewSnapshot
  let connectionState: WatchConnectionState
  var isRefreshing = false
  var pendingCount = 0
  var syncError: String? = nil
  let onReview: () -> Void
  let onForecast: () -> Void
  let onRefresh: () -> Void
  var onRetrySync: () -> Void = {}
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize

  private var connectionError: String? {
    if case .error(let message) = connectionState { return message }
    return nil
  }

  var body: some View {
    TimelineView(.periodic(from: .now, by: 60)) { context in
      let presentation = WatchSnapshotPresentation(
        snapshot: snapshot, connectionState: connectionState, now: context.date)
      WatchRefreshScrollView(isRefreshing: isRefreshing, onRefresh: onRefresh) {
        VStack(alignment: .leading, spacing: WatchTheme.gap) {
          if !presentation.hasSnapshot {
            WatchStatusView(
              title: connectionError != nil ? "Sync unavailable" : "Sync with iPhone",
              message: connectionError ?? "Open Kakehashi on your iPhone to load your reviews.")
          } else if snapshot.isOnVacation {
            WatchStatusView(title: "Reviews paused", message: "Vacation mode is on.")
          } else {
            reviewCard(presentation: presentation)
            forecast(presentation: presentation)
          }
          WatchSubmissionStatus(pendingCount: pendingCount, error: syncError, onRetry: onRetrySync)
          VStack(alignment: .leading, spacing: WatchTheme.gap) {
            Text(isRefreshing ? "Refreshing…" : presentation.syncLabel)
              .watchFont(.caption).foregroundStyle(WatchTheme.secondaryText)
              .fixedSize(horizontal: false, vertical: true)
            if let connectionError {
              Text(connectionError).watchFont(.caption).foregroundStyle(WatchTheme.error)
                .fixedSize(horizontal: false, vertical: true)
            }
            Button(action: onRefresh) {
              HStack {
                if isRefreshing { ProgressView().controlSize(.mini) }
                Label(isRefreshing ? "Refreshing" : "Refresh", systemImage: "arrow.clockwise")
              }
            }
            .buttonStyle(WatchActionButtonStyle(kind: .secondary))
            .disabled(isRefreshing)
            .accessibilityLabel("Refresh review data")
            Text("Pull down to refresh")
              .watchFont(.caption).foregroundStyle(WatchTheme.secondaryText)
              .frame(maxWidth: .infinity)
          }
          .padding(.top, WatchTheme.sectionGap)
        }
        .foregroundStyle(WatchTheme.text)
        .padding(.horizontal, WatchTheme.pageInset)
        .padding(.bottom, WatchTheme.gap)
      }
      .containerBackground(WatchTheme.background, for: .navigation)
    }
  }

  private func reviewCard(presentation: WatchSnapshotPresentation) -> some View {
    Button(action: onReview) {
      VStack(alignment: .leading, spacing: WatchTheme.smallGap) {
        ViewThatFits(in: .horizontal) {
          HStack(alignment: .center, spacing: 0) {
            reviewCardLabels.fixedSize(horizontal: true, vertical: false)
            Spacer(minLength: 0)
            Image("ReviewCrab").resizable().scaledToFit().frame(width: 46, height: 46)
              .accessibilityHidden(true)
          }
          reviewCardLabels.fixedSize(horizontal: true, vertical: false)
          VStack(alignment: .leading, spacing: WatchTheme.smallGap) {
            Text("Reviews").watchFont(.action)
            reviewCardCount
            startLabel
          }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        if let counts = snapshot.currentSubjectCounts, snapshot.effectiveCurrentReviews > 0 {
          let layout = dynamicTypeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: WatchTheme.smallGap))
            : AnyLayout(HStackLayout(spacing: WatchTheme.gap))
          layout {
            subjectCount("radical", symbol: "幺", counts: counts)
            subjectCount("kanji", symbol: "字", counts: counts)
            subjectCount("vocabulary", symbol: "語", counts: counts)
          }
        } else if snapshot.effectiveCurrentReviews == 0 {
          Text(presentation.nextReviewLabel).watchFont(.caption)
            .fixedSize(horizontal: false, vertical: true)
        }
      }
      .padding(WatchTheme.gap)
      .foregroundStyle(.white)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(LinearGradient(colors: [WatchTheme.reviewCardStart, WatchTheme.reviewCardEnd],
        startPoint: .topLeading, endPoint: .bottomTrailing), in: RoundedRectangle(cornerRadius: WatchTheme.cornerRadius))
      .contentShape(.rect(cornerRadius: WatchTheme.cornerRadius))
    }
    .buttonStyle(.plain)
    .disabled(snapshot.effectiveCurrentReviews == 0)
    .accessibilityElement(children: .combine)
    .accessibilityHint("Start all available reviews in a self-graded session")
  }

  private var reviewCardLabels: some View {
    VStack(alignment: .leading, spacing: WatchTheme.smallGap) {
      HStack(alignment: .firstTextBaseline, spacing: WatchTheme.smallGap) {
        Text("Reviews").watchFont(.action).fixedSize()
        reviewCardCount
      }
      startLabel
    }
  }

  private var reviewCardCount: some View {
    Text(snapshot.effectiveCurrentReviews, format: .number)
      .watchFont(.cardCount).monospacedDigit().lineLimit(1).minimumScaleFactor(0.6)
  }

  private var startLabel: some View {
    Label(snapshot.effectiveCurrentReviews > 0 ? "Start reviews" : "All caught up",
      systemImage: snapshot.effectiveCurrentReviews > 0 ? "arrow.right" : "checkmark")
      .watchFont(.caption).fixedSize(horizontal: false, vertical: true)
  }

  private func subjectCount(_ type: String, symbol: String, counts: [String: Int]) -> some View {
    HStack(spacing: 3) {
      Text(symbol).foregroundStyle(WatchTheme.subjectColor(type))
      Text(counts[type, default: 0], format: .number).monospacedDigit()
        .lineLimit(1).minimumScaleFactor(0.65)
    }
    .watchFont(.caption)
    .frame(maxWidth: .infinity)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("\(counts[type, default: 0]) \(type) reviews")
  }

  private func forecast(presentation: WatchSnapshotPresentation) -> some View {
    Button(action: onForecast) {
      VStack(alignment: .leading, spacing: WatchTheme.smallGap) {
        ViewThatFits(in: .horizontal) {
          HStack {
            Text("Forecast").watchFont(.action).fixedSize()
            Spacer(minLength: 0)
            forecastSummary(presentation).fixedSize()
          }
          VStack(alignment: .leading, spacing: WatchTheme.smallGap) {
            Text("Forecast").watchFont(.action)
            forecastSummary(presentation)
          }
        }
        WatchForecastChart(buckets: Array(presentation.forecast.prefix(6)))
      }
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .accessibilityHint("View 24 hours by subject or SRS stage")
  }
  private func forecastSummary(_ presentation: WatchSnapshotPresentation) -> some View {
    HStack(spacing: WatchTheme.smallGap) {
      Text("\(presentation.upcomingTotal) in 24h").watchFont(.caption)
        .foregroundStyle(WatchTheme.secondaryText)
      Image(systemName: "chevron.right").watchFont(.caption)
    }
  }

}

struct WatchSubmissionStatus: View {
  let pendingCount: Int
  let error: String?
  let onRetry: () -> Void

  var body: some View {
    if pendingCount > 0 {
      VStack(alignment: .leading, spacing: WatchTheme.smallGap) {
        Text("\(pendingCount) \(pendingCount == 1 ? "answer" : "answers") awaiting sync")
          .watchFont(.caption).foregroundStyle(WatchTheme.secondaryText)
        if let error {
          Text(error).watchFont(.caption).foregroundStyle(WatchTheme.error)
            .fixedSize(horizontal: false, vertical: true)
          Button("Retry sync", systemImage: "arrow.clockwise", action: onRetry)
            .buttonStyle(WatchActionButtonStyle(kind: .secondary))
        }
      }
    }
  }
}
