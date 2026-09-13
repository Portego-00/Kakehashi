import SwiftUI

struct WatchForecastRow: View {
  let date: Date
  let count: Int
  let maximum: Int
  @ScaledMetric(relativeTo: .caption) private var labelWidth = 38
  @ScaledMetric(relativeTo: .caption) private var rowHeight = 18

  var body: some View {
    ViewThatFits(in: .horizontal) {
      HStack(spacing: WatchTheme.gap) {
        hour.frame(width: labelWidth, alignment: .leading)
        bar.frame(minWidth: 32)
        reviewCount
      }
      VStack(spacing: WatchTheme.smallGap) {
        HStack(spacing: WatchTheme.gap) {
          hour
          Spacer(minLength: 0)
          reviewCount
        }
        bar
      }
    }
    .watchFont(.caption)
    .frame(minHeight: rowHeight)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("\(date.formatted(.dateTime.hour())), \(count) reviews")
  }

  private var hour: some View {
    Text(date, format: .dateTime.hour())
      .foregroundStyle(WatchTheme.secondaryText)
      .fixedSize()
  }

  private var reviewCount: some View {
    Text(count, format: .number).monospacedDigit()
      .fixedSize()
      .frame(minWidth: 22, alignment: .trailing)
  }

  private var bar: some View {
    GeometryReader { geometry in
      ZStack(alignment: .leading) {
        Capsule().fill(WatchTheme.surface)
        Capsule().fill(WatchTheme.primary)
          .frame(width: geometry.size.width * CGFloat(count) / CGFloat(maximum))
      }
    }
    .frame(height: 4)
  }
}
