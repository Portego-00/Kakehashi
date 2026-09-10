import SwiftUI

struct WatchAnswerView: View {
  let card: WatchReviewCard
  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      WatchAnswerSection(kind: .meaning, answers: card.meanings)
      if card.hasReading {
        WatchAnswerSection(kind: .reading, answers: card.readings)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}
