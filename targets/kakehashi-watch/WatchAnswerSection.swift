import SwiftUI

struct WatchAnswerSection: View {
  let kind: WatchQuestionLabel.Kind
  let answers: [String]
  private var answer: String { answers.isEmpty ? "Not provided" : answers.joined(separator: ", ") }

  var body: some View {
    ViewThatFits(in: .horizontal) {
      HStack(alignment: .firstTextBaseline, spacing: WatchTheme.smallGap) {
        WatchQuestionLabel(kind: kind)
        Text(answer).watchFont(.body).foregroundStyle(kind.foreground)
      }
      .fixedSize(horizontal: true, vertical: false)
      VStack(alignment: .leading, spacing: WatchTheme.smallGap) {
        WatchQuestionLabel(kind: kind)
        Text(answer).watchFont(.body).foregroundStyle(kind.foreground)
          .fixedSize(horizontal: false, vertical: true)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(.horizontal, WatchTheme.reviewContentInset)
    .padding(.vertical, WatchTheme.smallGap / 2)
    .background(kind.background)
    .accessibilityElement(children: .combine)
  }
}
