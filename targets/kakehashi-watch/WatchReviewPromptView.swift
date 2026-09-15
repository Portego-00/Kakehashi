import SwiftUI
import UIKit

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
          subject(compact: false)
            .frame(maxWidth: .infinity)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .foregroundStyle(WatchTheme.subjectInk)
  }

  private var compactSubject: some View {
    subject(compact: true)
  }

  @ViewBuilder
  private func subject(compact: Bool) -> some View {
    if !card.characters.isEmpty {
      Text(card.characters)
        .watchFont(compact ? .compactSubject : .subject)
        .multilineTextAlignment(.center)
        .fixedSize(horizontal: false, vertical: true)
        .accessibilityLabel("\(card.subjectLabel), \(card.characters)")
    } else if let encoded = card.characterImageData,
              let data = Data(base64Encoded: encoded), let image = UIImage(data: data) {
      Image(uiImage: image)
        .renderingMode(.template)
        .resizable()
        .scaledToFit()
        .frame(width: compact ? 30 : 64, height: compact ? 30 : 64)
        .accessibilityLabel("Radical image")
    } else {
      Text("Radical image unavailable")
        .watchFont(.caption)
        .fixedSize(horizontal: false, vertical: true)
    }
  }

  private var progressLabel: some View {
    Text(progress)
      .watchFont(.caption)
      .fixedSize()
  }
}
