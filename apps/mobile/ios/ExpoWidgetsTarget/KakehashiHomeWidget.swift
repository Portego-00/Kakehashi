import WidgetKit
import SwiftUI
internal import ExpoWidgets

struct KakehashiHomeWidget: Widget {
  let name: String = "KakehashiHomeWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: name, provider: WidgetsTimelineProvider(name: name)) { entry in
      WidgetsEntryView(entry: entry)
    }
    .configurationDisplayName("Kakehashi")
    .description("Review, critical, and streak stats")
    .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    .contentMarginsDisabled()
  }
}
