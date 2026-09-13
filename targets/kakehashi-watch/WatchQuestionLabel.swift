import SwiftUI

/// Uses mobile's question-strip colors within the existing caption line height.
struct WatchQuestionLabel: View {
  enum Kind {
    case meaning, reading, grouped

    var title: String {
      switch self {
      case .meaning: return "Meaning"
      case .reading: return "Reading"
      case .grouped: return "Meaning + reading"
      }
    }

    var background: Color {
      switch self {
      case .meaning: return WatchTheme.meaningLabelBackground
      case .reading: return WatchTheme.readingLabelBackground
      case .grouped: return WatchTheme.groupedLabelBackground
      }
    }

    var foreground: Color {
      self == .meaning ? WatchTheme.meaningLabelInk : .white
    }
  }

  let kind: Kind
  var fillsWidth = false

  var body: some View {
    Text(kind.title)
      .watchFont(.caption)
      .foregroundStyle(kind.foreground)
      .padding(.horizontal, WatchTheme.smallGap / 2)
      .fixedSize(horizontal: false, vertical: true)
      .frame(maxWidth: fillsWidth ? .infinity : nil)
      .background(kind.background)
  }
}
