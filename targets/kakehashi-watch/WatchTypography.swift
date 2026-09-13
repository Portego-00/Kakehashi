import SwiftUI

struct WatchTypography: ViewModifier {
  enum Style {
    case title, body, caption, action, count, subject, compactSubject
    var size: CGFloat {
      switch self {
      case .title: return 17
      case .body: return 15
      case .caption: return 12
      case .action: return 14
      case .count: return 32
      case .subject: return 30
      case .compactSubject: return 18
      }
    }
    var weight: Font.Weight {
      switch self {
      case .title, .action, .count: return .semibold
      default: return .regular
      }
    }
  }
  let style: Style
  @ScaledMetric(relativeTo: .body) private var scale = 1

  func body(content: Content) -> some View {
    content.font(.system(size: style.size * scale, weight: style.weight))
  }
}

extension View {
  func watchFont(_ style: WatchTypography.Style) -> some View {
    modifier(WatchTypography(style: style))
  }
}
