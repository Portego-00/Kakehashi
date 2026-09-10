import SwiftUI

struct WatchForecastStat: View {
  let title: String
  let value: Int
  var body: some View {
    VStack(alignment: .leading, spacing: WatchTheme.smallGap) {
      Text(title).watchFont(.caption).foregroundStyle(WatchTheme.secondaryText)
        .fixedSize(horizontal: false, vertical: true)
      Text(value, format: .number).watchFont(.title).monospacedDigit()
        .lineLimit(1).minimumScaleFactor(0.65)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .accessibilityElement(children: .combine)
  }
}
