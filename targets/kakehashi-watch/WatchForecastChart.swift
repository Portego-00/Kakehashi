import SwiftUI

struct WatchForecastChart: View {
  let buckets: [WatchForecastBucket]
  var mode: WatchForecastMode = .subject

  var body: some View {
    let maximum = max(1, buckets.map(\.count).max() ?? 1)
    HStack(alignment: .bottom, spacing: WatchTheme.smallGap) {
      ForEach(buckets) { bucket in
        VStack(spacing: WatchTheme.smallGap) {
          Text(bucket.count, format: .number)
            .monospacedDigit().foregroundStyle(WatchTheme.secondaryText)
            .lineLimit(1).minimumScaleFactor(0.65)
          GeometryReader { geometry in
            VStack(spacing: 0) {
              Spacer(minLength: 0)
              let colors = WatchTheme.forecastColors(mode)
              if let values = bucket.values(for: mode) {
                ForEach(values.indices.reversed(), id: \.self) { index in
                  colors[index].frame(height: geometry.size.height * CGFloat(values[index]) / CGFloat(maximum))
                }
              } else {
                WatchTheme.primary.frame(height: geometry.size.height * CGFloat(bucket.count) / CGFloat(maximum))
              }
            }
            .frame(maxWidth: .infinity)
            .background(WatchTheme.surface)
            .clipShape(.rect(cornerRadius: 2))
          }
          .frame(height: 26)
          Text(bucket.date, format: .dateTime.hour(.defaultDigits(amPM: .omitted)))
            .monospacedDigit().foregroundStyle(WatchTheme.secondaryText)
            .lineLimit(1).minimumScaleFactor(0.65)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("By \(bucket.date.formatted(.dateTime.hour())), \(bucket.count) reviews")
      }
    }
    .watchFont(.caption)
  }
}

struct WatchForecastBar: View {
  let bucket: WatchForecastBucket
  let maximum: Int
  let mode: WatchForecastMode

  var body: some View {
    GeometryReader { geometry in
      HStack(spacing: 0) {
        let colors = WatchTheme.forecastColors(mode)
        if let values = bucket.values(for: mode) {
          ForEach(values.indices, id: \.self) { index in
            colors[index].frame(width: geometry.size.width * CGFloat(values[index]) / CGFloat(max(1, maximum)))
          }
        } else {
          WatchTheme.primary.frame(width: geometry.size.width * CGFloat(bucket.count) / CGFloat(max(1, maximum)))
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(WatchTheme.surface)
      .clipShape(Capsule())
    }
    .frame(height: 6)
    .accessibilityHidden(true)
  }
}
