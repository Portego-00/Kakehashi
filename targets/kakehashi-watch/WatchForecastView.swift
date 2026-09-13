import SwiftUI

struct WatchForecastView: View {
  let snapshot: ReviewSnapshot
  let connectionState: WatchConnectionState
  let onRefresh: () -> Void

  var body: some View {
    TimelineView(.periodic(from: .now, by: 60)) { context in
      let presentation = WatchSnapshotPresentation(
        snapshot: snapshot, connectionState: connectionState, now: context.date)
      ScrollView {
        VStack(alignment: .leading, spacing: WatchTheme.sectionGap) {
          HStack(alignment: .top, spacing: WatchTheme.gap) {
            WatchForecastStat(title: "Next hour", value: presentation.nextHourCount)
            Spacer(minLength: 0)
            WatchForecastStat(title: "Next 24h", value: presentation.upcomingTotal)
          }
          Rectangle().fill(WatchTheme.separator).frame(height: 1).accessibilityHidden(true)
          VStack(spacing: WatchTheme.gap) {
            ForEach(presentation.forecast) { bucket in
              WatchForecastRow(date: bucket.date, count: bucket.count,
                maximum: max(1, presentation.forecast.map(\.count).max() ?? 1))
            }
          }
          .accessibilityLabel("Review forecast")
          Text(presentation.syncLabel).watchFont(.caption).foregroundStyle(WatchTheme.secondaryText)
            .fixedSize(horizontal: false, vertical: true)
          Button("Refresh", systemImage: "arrow.clockwise", action: onRefresh)
            .buttonStyle(WatchActionButtonStyle(kind: .secondary))
        }
        .padding(.horizontal, WatchTheme.pageInset)
        .padding(.bottom, WatchTheme.gap)
      }
      .foregroundStyle(WatchTheme.text)
      .containerBackground(WatchTheme.background, for: .navigation)
    }
  }
}
