// Hallmark · pre-emit critique: P4 H4 E4 S4 R5 V3
// Native study companion · restrained tone · Kakehashi blue · count → action; prompt → answer → grade.
import SwiftUI

/// Kakehashi dashboard surfaces and persistent mobile review subject colours.
/// Sources: src/utils/theme.tsx, src/utils/subjectColors.ts, src/components/ReviewQuestionScreen.tsx.
enum WatchTheme {
  static let background = Color.black
  static let surface = Color(hex: 0x1E1E1E)
  static let text = Color(hex: 0xF6F6F6)
  static let secondaryText = Color(hex: 0xB8B8B8)
  static let separator = Color(hex: 0x333333)
  static let primary = Color(hex: 0x3A86FF)
  static let primaryInk = Color.black
  static let error = Color(hex: 0xF28B82)
  static let correct = Color(hex: 0x7BDD89)
  static let missedSurface = Color(hex: 0x3D1F1F)
  static let correctSurface = Color(hex: 0x1F3D1F)
  static let radical = Color(hex: 0x3C9BFF)
  static let kanji = Color(hex: 0xFA1F62)
  static let vocabulary = Color(hex: 0x9C38D9)
  static let subjectInk = Color.white
  static let meaningLabelBackground = Color(hex: 0xB8B8B8)
  static let meaningLabelInk = Color(hex: 0x1F1F1F)
  static let readingLabelBackground = Color(hex: 0x2B2B2B)
  static let groupedLabelBackground = Color(hex: 0x333333)
  static let smallGap: CGFloat = 4
  static let gap: CGFloat = 8
  static let sectionGap: CGFloat = 12
  static let pageInset: CGFloat = 8
  static let reviewContentInset: CGFloat = 10
  static let cornerRadius: CGFloat = 10
  static let minimumTapHeight: CGFloat = 44

  static func subjectColor(_ type: String) -> Color {
    switch type {
    case "radical": return radical
    case "kanji": return kanji
    default: return vocabulary
    }
  }
}

private extension Color {
  init(hex: UInt32) {
    self.init(.sRGB, red: Double((hex >> 16) & 0xFF) / 255,
      green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255, opacity: 1)
  }
}
