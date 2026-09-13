import SwiftUI

struct WatchActionButtonStyle: ButtonStyle {
  enum Kind { case primary, secondary, missed, correct }
  var kind: Kind = .primary
  var fillsEdges = false
  @Environment(\.isEnabled) private var isEnabled

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .watchFont(.action)
      .multilineTextAlignment(.center)
      .fixedSize(horizontal: false, vertical: true)
      .padding(.horizontal, WatchTheme.smallGap)
      .padding(.vertical, WatchTheme.smallGap)
      .frame(maxWidth: .infinity, minHeight: WatchTheme.minimumTapHeight)
      .foregroundStyle(foreground)
      .background {
        if fillsEdges {
          background.ignoresSafeArea(.container, edges: [.horizontal, .bottom])
        } else {
          RoundedRectangle(cornerRadius: WatchTheme.cornerRadius).fill(background)
        }
      }
      .contentShape(.rect(cornerRadius: fillsEdges ? 0 : WatchTheme.cornerRadius))
      .opacity(isEnabled ? (configuration.isPressed ? 0.65 : 1) : 0.45)
  }
  private var foreground: Color {
    switch kind {
    case .primary: return WatchTheme.primaryInk
    case .secondary: return WatchTheme.text
    case .missed: return WatchTheme.error
    case .correct: return WatchTheme.correct
    }
  }

  private var background: Color {
    switch kind {
    case .primary: return WatchTheme.primary
    case .secondary: return WatchTheme.surface
    case .missed: return WatchTheme.missedSurface
    case .correct: return WatchTheme.correctSurface
    }
  }
}
