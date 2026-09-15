import SwiftUI

struct WatchForecastRow: View {
  let bucket: WatchForecastBucket
  let maximum: Int
  let mode: WatchForecastMode
  @ScaledMetric(relativeTo: .caption) private var labelWidth = 40

  var body: some View {
    VStack(alignment: .leading, spacing: WatchTheme.smallGap) {
      HStack(spacing: WatchTheme.gap) {
        Text(bucket.date, format: .dateTime.hour().minute())
          .foregroundStyle(WatchTheme.secondaryText)
          .frame(minWidth: labelWidth, alignment: .leading)
          .fixedSize()
        WatchForecastBar(bucket: bucket, maximum: maximum, mode: mode)
        Text(bucket.count, format: .number).monospacedDigit().fixedSize()
          .frame(minWidth: 20, alignment: .trailing)
      }
    }
    .watchFont(.caption)
    .frame(minHeight: 19)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(accessibilitySummary)
  }

  private var accessibilitySummary: String {
    let detail = bucket.values(for: mode).map { values in
      zip(mode.labels, values).map { "\($0.1) \($0.0)" }.joined(separator: ", ")
    } ?? ""
    return "By \(bucket.date.formatted(.dateTime.hour().minute())), \(bucket.count) reviews. \(detail)"
  }
}
