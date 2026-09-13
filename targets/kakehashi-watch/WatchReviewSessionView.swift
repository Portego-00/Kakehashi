import SwiftUI

struct WatchReviewSessionView: View {
  let state: WatchReviewSessionState
  let onReveal: () -> Void
  let onSubmit: (Bool) -> Void
  let onClose: () -> Void
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize

  private var reviewBackground: Color {
    state.currentCard.map { WatchTheme.subjectColor($0.subjectType) } ?? WatchTheme.background
  }

  private var reviewInk: Color {
    state.currentCard == nil ? WatchTheme.text : WatchTheme.subjectInk
  }

  private var questionKind: WatchQuestionLabel.Kind {
    state.currentCard?.hasReading == true ? .grouped : .meaning
  }

  private var answerBackground: Color {
    state.currentCard?.hasReading == true
      ? WatchTheme.readingLabelBackground : WatchTheme.meaningLabelBackground
  }

  private var footerBackground: Color {
    guard state.currentCard != nil else { return WatchTheme.background }
    return state.isAnswerRevealed ? answerBackground : questionKind.background
  }

  var body: some View {
    ScrollViewReader { proxy in
      ScrollView {
        VStack(alignment: .leading, spacing: 0) {
          reviewHeader
          if let card = state.currentCard, state.isAnswerRevealed {
            WatchAnswerView(card: card)
          }
          if dynamicTypeSize.isAccessibilitySize {
            reviewFooter
          }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .id("review-content")
      }
      .contentMargins(.horizontal, 0, for: .scrollContent)
      .background(state.currentCard != nil && state.isAnswerRevealed ? answerBackground : reviewBackground,
        ignoresSafeAreaEdges: [.horizontal, .bottom])
      .safeAreaInset(edge: .bottom, spacing: 0) {
        if !dynamicTypeSize.isAccessibilitySize { reviewFooter }
      }
      .ignoresSafeArea(.container, edges: .horizontal)
      .onChange(of: state.currentCard?.id) { proxy.scrollTo("review-content", anchor: .top) }
      .onChange(of: state.isAnswerRevealed) { proxy.scrollTo("review-content", anchor: .top) }
      .onChange(of: state.errorMessage) { proxy.scrollTo("review-content", anchor: .top) }
    }
    .foregroundStyle(reviewInk)
    .tint(reviewInk)
    .containerBackground(reviewBackground, for: .navigation)
  }

  private var reviewHeader: some View {
    VStack(alignment: .leading, spacing: WatchTheme.smallGap) {
      if state.isLoading {
        ProgressView().frame(maxWidth: .infinity).padding(.top, WatchTheme.sectionGap)
        WatchStatusView(title: "Loading reviews",
          message: "Getting your next cards from iPhone.")
      } else if state.isComplete {
        WatchStatusView(title: "Session complete",
          message: "\(state.completedCount) reviews submitted.")
      } else if let card = state.currentCard {
        WatchReviewPromptView(card: card,
          progress: "\(state.completedCount + 1) of \(max(state.totalCount, 1))",
          isRevealed: state.isAnswerRevealed)
        if let error = state.errorMessage {
          Text(error).watchFont(.body).foregroundStyle(WatchTheme.error)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityLabel("Submission error. \(error)")
            .padding(WatchTheme.smallGap)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(WatchTheme.background)
        }
      } else {
        WatchStatusView(title: "Couldn't load",
          message: state.errorMessage ?? "Open Kakehashi on iPhone, then try again.")
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(.horizontal, WatchTheme.reviewContentInset)
    .padding(.bottom, WatchTheme.smallGap)
    .background(reviewBackground)
  }

  private var reviewFooter: some View {
    VStack(spacing: 0) {
      if state.currentCard != nil, !state.isAnswerRevealed {
        WatchQuestionLabel(kind: questionKind, fillsWidth: true)
      }
      if state.currentCard != nil, !state.isAnswerRevealed {
        reviewActions
      } else {
        reviewActions
          .padding(.horizontal, WatchTheme.reviewContentInset)
          .padding(.vertical, WatchTheme.smallGap)
      }
    }
    .frame(maxWidth: .infinity)
    .background(footerBackground, ignoresSafeAreaEdges: [.horizontal, .bottom])
  }

  private var reviewActions: some View {
    WatchReviewActions(state: state, onReveal: onReveal, onSubmit: onSubmit, onClose: onClose)
  }
}
