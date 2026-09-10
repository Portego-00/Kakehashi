import SwiftUI

struct WatchReviewPromptView: View {
  let card: WatchReviewCard
  let progress: String
  let isRevealed: Bool

  var body: some View {
    Group {
      if isRevealed {
        ViewThatFits(in: .horizontal) {
          HStack(alignment: .firstTextBaseline, spacing: WatchTheme.gap) {
            compactSubject.fixedSize()
            Spacer(minLength: 0)
            progressLabel
          }
          VStack(alignment: .leading, spacing: WatchTheme.smallGap) {
            progressLabel
            compactSubject.fixedSize(horizontal: false, vertical: true)
          }
        }
      } else {
        VStack(alignment: .leading, spacing: WatchTheme.gap) {
          HStack(spacing: WatchTheme.smallGap) {
            Text(card.subjectLabel)
            Spacer(minLength: WatchTheme.smallGap)
            Text(progress).monospacedDigit()
          }
          .watchFont(.caption)
          Text(card.characters)
            .watchFont(.subject)
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity)
            .accessibilityLabel("Subject, \(card.characters)")
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .foregroundStyle(WatchTheme.subjectInk)
  }

  private var compactSubject: some View {
    Text(card.characters)
      .watchFont(.compactSubject)
      .accessibilityLabel("\(card.subjectLabel), \(card.characters)")
  }

  private var progressLabel: some View {
    Text(progress)
      .watchFont(.caption)
      .fixedSize()
  }
}
