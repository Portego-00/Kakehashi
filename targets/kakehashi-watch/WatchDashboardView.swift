import SwiftUI

struct WatchDashboardView: View {
  let snapshot: ReviewSnapshot
  let connectionState: WatchConnectionState
  let onReview: () -> Void
  let onForecast: () -> Void
  let onRefresh: () -> Void

  private var connectionError: String? {
    if case .error(let message) = connectionState { return message }
    return nil
  }

  var body: some View {
    TimelineView(.periodic(from: .now, by: 60)) { context in
      let presentation = WatchSnapshotPresentation(
        snapshot: snapshot, connectionState: connectionState, now: context.date)
      ScrollView {
        VStack(alignment: .leading, spacing: WatchTheme.sectionGap) {
          if presentation.hasSnapshot, connectionState != .live {
            Text(presentation.syncLabel)
              .watchFont(.caption)
              .foregroundStyle(WatchTheme.secondaryText)
              .fixedSize(horizontal: false, vertical: true)
          }
          if !presentation.hasSnapshot {
            WatchStatusView(
              title: connectionError != nil ? "Sync unavailable" : "Sync with iPhone",
              message: connectionError ?? "Open Kakehashi on your iPhone to load your reviews.")
            if connectionState == .activating {
              Text("Connecting to iPhone").watchFont(.caption).foregroundStyle(WatchTheme.secondaryText)
            }
          } else if snapshot.isOnVacation {
            WatchStatusView(title: "Reviews paused", message: "Vacation mode is on.")
          } else if snapshot.effectiveCurrentReviews > 0 {
            ViewThatFits(in: .horizontal) {
              HStack(alignment: .firstTextBaseline, spacing: WatchTheme.gap) {
                reviewCount.fixedSize()
                reviewCountLabel.fixedSize()
              }
              VStack(alignment: .leading, spacing: WatchTheme.smallGap) {
                reviewCount.lineLimit(1).minimumScaleFactor(0.65)
                reviewCountLabel.fixedSize(horizontal: false, vertical: true)
              }
            }
            .accessibilityElement(children: .combine)
            Button("Review", action: onReview)
              .buttonStyle(WatchActionButtonStyle())
              .accessibilityHint("Start a self-graded review session")
          } else {
            VStack(alignment: .leading, spacing: WatchTheme.smallGap) {
              Text(connectionState == .live ? "All caught up" : "No cached reviews").watchFont(.title)
              Text(presentation.nextReviewLabel)
                .watchFont(.body)
                .foregroundStyle(WatchTheme.secondaryText)
                .fixedSize(horizontal: false, vertical: true)
            }
          }
          if presentation.hasSnapshot, !snapshot.isOnVacation {
            Button(action: onForecast) {
              HStack(spacing: WatchTheme.gap) {
                VStack(alignment: .leading, spacing: WatchTheme.smallGap) {
                  Text("Forecast").watchFont(.action).foregroundStyle(WatchTheme.text)
                  Text("\(presentation.nextHourCount) in the next hour")
                    .watchFont(.caption).foregroundStyle(WatchTheme.secondaryText)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                  .watchFont(.caption).foregroundStyle(WatchTheme.secondaryText)
              }
              .frame(maxWidth: .infinity, minHeight: WatchTheme.minimumTapHeight, alignment: .leading)
              .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityElement(children: .combine)
            .accessibilityHint("Show the next eight hours")
          }
          VStack(alignment: .leading, spacing: WatchTheme.gap) {
            if presentation.hasSnapshot, connectionState == .live {
              Text(presentation.syncLabel)
                .watchFont(.caption).foregroundStyle(WatchTheme.secondaryText)
                .fixedSize(horizontal: false, vertical: true)
            }
            if presentation.hasSnapshot, let connectionError {
              Text(connectionError).watchFont(.caption).foregroundStyle(WatchTheme.error)
                .fixedSize(horizontal: false, vertical: true)
            }
            Button("Refresh", systemImage: "arrow.clockwise", action: onRefresh)
              .buttonStyle(WatchActionButtonStyle(kind: .secondary))
              .accessibilityLabel("Refresh review data")
          }
        }
        .foregroundStyle(WatchTheme.text)
        .padding(.horizontal, WatchTheme.pageInset)
        .padding(.bottom, WatchTheme.gap)
      }
      .containerBackground(WatchTheme.background, for: .navigation)
    }
  }

  private var reviewCount: some View {
    Text(snapshot.effectiveCurrentReviews, format: .number)
      .watchFont(.count)
      .monospacedDigit()
  }

  private var reviewCountLabel: some View {
    Text(snapshot.effectiveCurrentReviews == 1 ? "review ready" : "reviews ready")
      .watchFont(.caption)
      .foregroundStyle(WatchTheme.secondaryText)
  }
}
