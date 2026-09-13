import SwiftUI

struct WatchReviewActions: View {
  let state: WatchReviewSessionState
  let onReveal: () -> Void
  let onSubmit: (Bool) -> Void
  let onClose: () -> Void
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize

  private var submissionInk: Color {
    state.currentCard?.hasReading == false ? WatchTheme.meaningLabelInk : .white
  }

  var body: some View {
    if state.isComplete || (!state.isLoading && state.currentCard == nil) {
      Button("Done", action: onClose).buttonStyle(WatchActionButtonStyle())
    } else if state.isSubmitting {
      HStack(spacing: WatchTheme.gap) {
        ProgressView().frame(width: 16, height: 16)
        Text("Submitting").watchFont(.action).fixedSize()
      }
      .foregroundStyle(submissionInk)
      .tint(submissionInk)
      .frame(maxWidth: .infinity, minHeight: WatchTheme.minimumTapHeight)
      .accessibilityElement(children: .combine)
    } else if state.currentCard != nil, state.isAnswerRevealed {
      let layout = dynamicTypeSize.isAccessibilitySize
        ? AnyLayout(VStackLayout(spacing: WatchTheme.smallGap))
        : AnyLayout(HStackLayout(spacing: WatchTheme.gap))
      layout {
        Button("Miss", action: submitMiss)
          .buttonStyle(WatchActionButtonStyle(kind: .missed))
          .accessibilityHint("Submit this review as incorrect")
        Button("Got it", action: submitCorrect)
          .buttonStyle(WatchActionButtonStyle(kind: .correct))
          .accessibilityHint("Submit this review as correct")
      }
    } else if state.currentCard != nil {
      Button("Show answer", action: onReveal)
        .buttonStyle(WatchActionButtonStyle(kind: .secondary, fillsEdges: true))
    }
  }
  private func submitMiss() { onSubmit(false) }
  private func submitCorrect() { onSubmit(true) }
}
