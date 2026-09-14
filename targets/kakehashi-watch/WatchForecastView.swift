import SwiftUI

struct WatchForecastView: View {
  let snapshot: ReviewSnapshot
  let connectionState: WatchConnectionState
  var isRefreshing = false
  let onRefresh: () -> Void
  @AppStorage("kakehashi.watch.forecastMode") private var savedMode = WatchForecastMode.subject.rawValue

  private var mode: WatchForecastMode { WatchForecastMode(rawValue: savedMode) ?? .subject }

  var body: some View {
    TimelineView(.periodic(from: .now, by: 60)) { context in
      let presentation = WatchSnapshotPresentation(
        snapshot: snapshot, connectionState: connectionState, now: context.date)
      WatchRefreshScrollView(isRefreshing: isRefreshing, onRefresh: onRefresh) {
        VStack(alignment: .leading, spacing: WatchTheme.smallGap) {
          HStack(alignment: .top, spacing: WatchTheme.gap) {
            WatchForecastStat(title: "Next hour", value: presentation.nextHourCount)
            WatchForecastStat(title: "Next 24h", value: presentation.upcomingTotal)
          }
          modePicker
          if presentation.hasBreakdown {
            legend(presentation.forecast)
          } else {
            Text("Refresh with iPhone for the breakdown.")
              .watchFont(.caption).foregroundStyle(WatchTheme.secondaryText)
              .fixedSize(horizontal: false, vertical: true)
          }
          WatchForecastChart(buckets: Array(presentation.forecast.prefix(6)), mode: mode)
          Text("Hour by hour").watchFont(.action).padding(.top, WatchTheme.sectionGap)
          VStack(spacing: WatchTheme.gap) {
            ForEach(presentation.forecast) { bucket in
              WatchForecastRow(bucket: bucket,
                maximum: max(1, presentation.forecast.map(\.count).max() ?? 1), mode: mode)
            }
          }
          Text("Each hour shows newly available reviews.")
            .watchFont(.caption).foregroundStyle(WatchTheme.secondaryText)
            .fixedSize(horizontal: false, vertical: true)
          Text(isRefreshing ? "Refreshing…" : presentation.syncLabel)
            .watchFont(.caption).foregroundStyle(WatchTheme.secondaryText)
            .fixedSize(horizontal: false, vertical: true)
          Button("Refresh", systemImage: "arrow.clockwise", action: onRefresh)
            .buttonStyle(WatchActionButtonStyle(kind: .secondary)).disabled(isRefreshing)
        }
        .padding(.horizontal, WatchTheme.pageInset)
        .padding(.bottom, WatchTheme.gap)
      }
      .foregroundStyle(WatchTheme.text)
      .containerBackground(WatchTheme.background, for: .navigation)
    }
    #if DEBUG
    .task {
      if let scenario = WatchPreviewFixtures.launchScenario, scenario.hasPrefix("forecast") {
        savedMode = scenario == "forecast-srs" ? WatchForecastMode.srs.rawValue : WatchForecastMode.subject.rawValue
      }
    }
    #endif
  }

  private var modePicker: some View {
    HStack(spacing: 2) {
      ForEach(WatchForecastMode.allCases, id: \.self) { option in
        Button {
          savedMode = option.rawValue
        } label: {
          Text(option.title).watchFont(.caption)
            .frame(maxWidth: .infinity, minHeight: WatchTheme.minimumTapHeight)
            .foregroundStyle(mode == option ? WatchTheme.text : WatchTheme.secondaryText)
            .background(mode == option ? WatchTheme.separator : .clear,
              in: RoundedRectangle(cornerRadius: WatchTheme.cornerRadius))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Break down by \(option.title)")
        .accessibilityAddTraits(mode == option ? .isSelected : [])
      }
    }
    .background(WatchTheme.surface, in: RoundedRectangle(cornerRadius: WatchTheme.cornerRadius))
  }

  private func legend(_ buckets: [WatchForecastBucket]) -> some View {
    let colors = WatchTheme.forecastColors(mode)
    return LazyVGrid(columns: [GridItem(.adaptive(minimum: 78), alignment: .leading)],
      alignment: .leading, spacing: WatchTheme.smallGap) {
      ForEach(mode.labels.indices, id: \.self) { index in
        HStack(spacing: 3) {
          Circle().fill(colors[index]).frame(width: 5, height: 5).accessibilityHidden(true)
          Text(mode.labels[index]).fixedSize(horizontal: false, vertical: true)
          Spacer(minLength: 0)
          Text(buckets.reduce(0) { $0 + ($1.values(for: mode)?[index] ?? 0) }, format: .number)
            .monospacedDigit().fixedSize()
        }
        .watchFont(.caption)
        .accessibilityElement(children: .combine)
      }
    }
  }
}
