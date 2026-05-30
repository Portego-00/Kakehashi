import SwiftUI

struct ContentView: View {
  @EnvironmentObject private var reviewStore: WatchReviewStore

  var body: some View {
	    TimelineView(.periodic(from: .now, by: 60)) { context in
	      ScrollView {
	        VStack(alignment: .leading, spacing: 10) {
	          HeaderView(connectionState: reviewStore.connectionState)
	          if reviewStore.reviewSession.isActive {
	            ReviewSessionView(
	              state: reviewStore.reviewSession,
	              onReveal: reviewStore.revealAnswer,
	              onSubmit: reviewStore.submitCurrentCard,
	              onClose: reviewStore.closeReviewSession
	            )
	          } else {
	            ReviewHero(
	              snapshot: reviewStore.snapshot,
	              now: context.date,
	              onStartReviews: reviewStore.startReviewSession
	            )
	            QuickStats(snapshot: reviewStore.snapshot, now: context.date)
	            ForecastView(snapshot: reviewStore.snapshot, now: context.date)
	          }
	        }
        .padding(.horizontal, 2)
        .padding(.bottom, 8)
      }
      .background(AppColors.background.ignoresSafeArea())
      .toolbar {
        ToolbarItem(placement: .topBarTrailing) {
          Button {
            reviewStore.refresh()
          } label: {
            Image(systemName: "arrow.clockwise")
          }
          .buttonStyle(.borderless)
          .accessibilityLabel("Refresh review data")
        }
      }
    }
  }
}

private struct HeaderView: View {
  let connectionState: WatchConnectionState

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      HStack(spacing: 6) {
        Image(systemName: "point.topleft.down.to.point.bottomright.curvepath")
          .font(.caption.weight(.semibold))
          .foregroundStyle(AppColors.teal)

        Text("Kakehashi")
          .font(.headline.weight(.semibold))
          .foregroundStyle(.white)
          .lineLimit(1)
      }

      Label(connectionState.label, systemImage: statusIcon)
        .font(.caption2)
        .foregroundStyle(statusColor)
        .lineLimit(1)
    }
  }

  private var statusIcon: String {
    switch connectionState {
    case .live:
      return "checkmark.circle.fill"
    case .activating:
      return "arrow.triangle.2.circlepath"
    case .inactive, .waitingForPhone, .stale:
      return "iphone"
    case .error:
      return "exclamationmark.triangle.fill"
    }
  }

  private var statusColor: Color {
    switch connectionState {
    case .live:
      return AppColors.teal
    case .error:
      return AppColors.sunrise
    default:
      return AppColors.mutedText
    }
  }
}

private struct ReviewHero: View {
  let snapshot: ReviewSnapshot
  let now: Date
  let onStartReviews: () -> Void

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      if snapshot.isOnVacation {
        VStack(alignment: .leading, spacing: 5) {
          Label("Vacation Mode", systemImage: "pause.circle.fill")
            .font(.caption.weight(.semibold))
            .foregroundStyle(.white)

          Text("Reviews paused")
            .font(.system(size: 30, weight: .bold, design: .rounded))
            .foregroundStyle(.white)
            .minimumScaleFactor(0.65)
            .lineLimit(1)
        }
      } else {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
          Text("\(snapshot.effectiveCurrentReviews)")
            .font(.system(size: 44, weight: .bold, design: .rounded))
            .monospacedDigit()
            .foregroundStyle(.white)
            .minimumScaleFactor(0.65)
            .lineLimit(1)

          VStack(alignment: .leading, spacing: 1) {
            Text(snapshot.effectiveCurrentReviews == 1 ? "review" : "reviews")
              .font(.caption.weight(.semibold))
              .foregroundStyle(.white)

            Text(snapshot.effectiveCurrentReviews > 0 ? "ready now" : "clear")
              .font(.caption2)
              .foregroundStyle(AppColors.softText)
          }
        }
      }

      HStack(spacing: 8) {
        Image(systemName: snapshot.effectiveCurrentReviews > 0 ? "bolt.fill" : "checkmark.seal.fill")
          .foregroundStyle(snapshot.effectiveCurrentReviews > 0 ? AppColors.sunrise : AppColors.teal)

        Text(nextReviewLabel(snapshot: snapshot, now: now))
          .font(.caption)
          .foregroundStyle(AppColors.softText)
          .lineLimit(2)
          .minimumScaleFactor(0.85)
      }

      if snapshot.effectiveCurrentReviews > 0 {
        Button(action: onStartReviews) {
          Label("Review on Watch", systemImage: "play.fill")
            .font(.caption.weight(.semibold))
            .frame(maxWidth: .infinity)
        }
        .tint(AppColors.teal)
      }
    }
    .padding(12)
    .background(
      LinearGradient(
        colors: AppColors.heroGradient(snapshot.effectiveCurrentReviews, isOnVacation: snapshot.isOnVacation),
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )
    )
    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
  }
}

private struct QuickStats: View {
  let snapshot: ReviewSnapshot
  let now: Date

	  var body: some View {
	    VStack(spacing: 7) {
	      StatTile(
	        title: "Next hr",
	        value: "\(snapshot.nextHourCount)",
        symbol: "clock.fill",
        color: AppColors.blue
      )

      StatTile(
        title: "24h",
        value: "\(snapshot.upcomingTotal)",
        symbol: "calendar",
        color: AppColors.teal
      )

      StatTile(
        title: "Sync",
        value: syncAgeLabel(snapshot: snapshot, now: now),
        symbol: "wave.3.right",
        color: AppColors.sunrise
      )
    }
  }
}

private struct StatTile: View {
  let title: String
  let value: String
  let symbol: String
  let color: Color

	  var body: some View {
	    HStack(spacing: 8) {
	      ZStack {
	        Circle()
	          .fill(color.opacity(0.16))
	          .frame(width: 24, height: 24)

	        Image(systemName: symbol)
	          .font(.caption2.weight(.semibold))
	          .foregroundStyle(color)
	      }

	      Text(title)
	        .font(.caption.weight(.medium))
	        .foregroundStyle(AppColors.softText)
	        .lineLimit(1)

	      Spacer(minLength: 4)

	      Text(value)
	        .font(.headline.weight(.semibold))
	        .monospacedDigit()
	        .foregroundStyle(.white)
	        .lineLimit(1)
	        .minimumScaleFactor(0.75)
	    }
	    .frame(maxWidth: .infinity, alignment: .leading)
	    .padding(8)
    .background(AppColors.card)
    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
	  }
}

private struct ReviewSessionView: View {
  let state: WatchReviewSessionState
  let onReveal: () -> Void
  let onSubmit: (Bool) -> Void
  let onClose: () -> Void

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack {
        Label("Reviews", systemImage: "sparkles")
          .font(.caption.weight(.semibold))
          .foregroundStyle(AppColors.softText)

        Spacer()

        Button(action: onClose) {
          Image(systemName: "xmark")
        }
        .buttonStyle(.borderless)
        .accessibilityLabel("Close review session")
      }

      if state.isLoading {
        ProgressView("Loading")
          .font(.caption)
          .frame(maxWidth: .infinity, minHeight: 92)
      } else if state.isComplete {
        ReviewCompleteView(completedCount: state.completedCount, onClose: onClose)
      } else if let card = state.currentCard {
        ReviewCardView(
          card: card,
          progressLabel: "\(state.completedCount + 1)/\(max(state.totalCount, 1))",
          isAnswerRevealed: state.isAnswerRevealed,
          isSubmitting: state.isSubmitting,
          errorMessage: state.errorMessage,
          onReveal: onReveal,
          onSubmit: onSubmit
        )
      } else {
        EmptyReviewSessionView(message: state.errorMessage ?? "No reviews ready.", onClose: onClose)
      }
    }
    .padding(10)
    .background(AppColors.card)
    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
  }
}

private struct ReviewCardView: View {
  let card: WatchReviewCard
  let progressLabel: String
  let isAnswerRevealed: Bool
  let isSubmitting: Bool
  let errorMessage: String?
  let onReveal: () -> Void
  let onSubmit: (Bool) -> Void

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      Button {
        if !isAnswerRevealed {
          onReveal()
        }
      } label: {
        VStack(alignment: .leading, spacing: 8) {
          HStack {
            Text(card.subjectLabel)
              .font(.caption2.weight(.semibold))
              .foregroundStyle(typeColor)

            Spacer()

            Text(progressLabel)
              .font(.caption2.monospacedDigit())
              .foregroundStyle(AppColors.mutedText)
          }

          Text(card.characters)
            .font(.system(size: 34, weight: .bold, design: .rounded))
            .foregroundStyle(.white)
            .minimumScaleFactor(0.5)
            .lineLimit(2)
            .frame(maxWidth: .infinity, alignment: .center)

          Text(isAnswerRevealed ? "Answer" : "Tap to reveal")
            .font(.caption2)
            .foregroundStyle(AppColors.mutedText)
            .frame(maxWidth: .infinity, alignment: .center)
        }
        .padding(10)
        .background(AppColors.innerCard)
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
      }
      .buttonStyle(.plain)

      if isAnswerRevealed {
        AnswerView(card: card)

        HStack(spacing: 8) {
          Button {
            onSubmit(false)
          } label: {
            Label("Miss", systemImage: "xmark")
              .font(.caption.weight(.semibold))
              .frame(maxWidth: .infinity)
          }
          .tint(AppColors.sunrise)
          .disabled(isSubmitting)

          Button {
            onSubmit(true)
          } label: {
            Label("Got it", systemImage: "checkmark")
              .font(.caption.weight(.semibold))
              .frame(maxWidth: .infinity)
          }
          .tint(AppColors.teal)
          .disabled(isSubmitting)
        }

        if isSubmitting {
          ProgressView()
            .frame(maxWidth: .infinity)
        }
      }

      if let errorMessage {
        Text(errorMessage)
          .font(.caption2)
          .foregroundStyle(AppColors.sunrise)
          .lineLimit(3)
      }
    }
  }

  private var typeColor: Color {
    switch card.subjectType {
    case "radical":
      return AppColors.blue
    case "kanji":
      return AppColors.sunrise
    default:
      return AppColors.teal
    }
  }
}

private struct AnswerView: View {
  let card: WatchReviewCard

  var body: some View {
    VStack(alignment: .leading, spacing: 7) {
      AnswerLine(title: "Meaning", value: card.meanings.prefix(2).joined(separator: ", "))

      if card.hasReading {
        AnswerLine(title: "Reading", value: card.readings.prefix(2).joined(separator: ", "))
      }
    }
    .padding(9)
    .background(AppColors.answerCard)
    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
  }
}

private struct AnswerLine: View {
  let title: String
  let value: String

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(title)
        .font(.caption2)
        .foregroundStyle(AppColors.mutedText)

      Text(value.isEmpty ? "--" : value)
        .font(.caption.weight(.semibold))
        .foregroundStyle(.white)
        .lineLimit(2)
        .minimumScaleFactor(0.8)
    }
  }
}

private struct ReviewCompleteView: View {
  let completedCount: Int
  let onClose: () -> Void

  var body: some View {
    VStack(spacing: 8) {
      Image(systemName: "checkmark.seal.fill")
        .font(.title2)
        .foregroundStyle(AppColors.teal)

      Text("Session done")
        .font(.headline.weight(.semibold))
        .foregroundStyle(.white)

      Text("\(completedCount) submitted")
        .font(.caption)
        .foregroundStyle(AppColors.softText)

      Button("Done", action: onClose)
        .tint(AppColors.teal)
    }
    .frame(maxWidth: .infinity, minHeight: 112)
  }
}

private struct EmptyReviewSessionView: View {
  let message: String
  let onClose: () -> Void

  var body: some View {
    VStack(spacing: 8) {
      Text(message)
        .font(.caption)
        .foregroundStyle(AppColors.softText)
        .multilineTextAlignment(.center)
        .lineLimit(4)

      Button("Done", action: onClose)
        .tint(AppColors.teal)
    }
    .frame(maxWidth: .infinity, minHeight: 104)
  }
}

private struct ForecastView: View {
  let snapshot: ReviewSnapshot
  let now: Date

  private var forecast: [(label: String, count: Int)] {
    let calendar = Calendar.current
    let start = calendar.nextDate(
      after: now,
      matching: DateComponents(minute: 0, second: 0),
      matchingPolicy: .nextTime
    ) ?? now.addingTimeInterval(3600)

	    return Array(snapshot.effectiveUpcomingReviews.prefix(8).enumerated()).map { index, count in
      let date = start.addingTimeInterval(TimeInterval(index) * 3600)
      return (hourLabel(for: date), count)
    }
  }

  private var maxCount: Int {
    max(forecast.map { $0.count }.max() ?? 0, 1)
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 7) {
      Text("Forecast")
        .font(.caption.weight(.semibold))
        .foregroundStyle(AppColors.softText)

      ForEach(forecast.indices, id: \.self) { index in
        let item = forecast[index]
        ForecastRow(label: item.label, count: item.count, maxCount: maxCount)
      }
    }
    .padding(10)
    .background(AppColors.card)
    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
  }
}

private struct ForecastRow: View {
  let label: String
  let count: Int
  let maxCount: Int

  var body: some View {
    HStack(spacing: 7) {
      Text(label)
        .font(.caption2)
        .foregroundStyle(AppColors.mutedText)
        .frame(width: 34, alignment: .leading)
        .lineLimit(1)

      GeometryReader { proxy in
        ZStack(alignment: .leading) {
          Capsule()
            .fill(AppColors.barTrack)

          Capsule()
            .fill(count > 0 ? AppColors.teal : AppColors.barIdle)
            .frame(width: max(4, proxy.size.width * CGFloat(count) / CGFloat(maxCount)))
        }
      }
      .frame(height: 6)

      Text("\(count)")
        .font(.caption2.weight(.semibold))
        .monospacedDigit()
        .foregroundStyle(.white)
        .frame(width: 22, alignment: .trailing)
    }
    .frame(height: 14)
  }
}

private enum AppColors {
	  static let background = Color(red: 0.02, green: 0.04, blue: 0.07)
	  static let card = Color.white.opacity(0.09)
	  static let innerCard = Color.white.opacity(0.08)
	  static let answerCard = Color.black.opacity(0.18)
	  static let blue = Color(red: 0.23, green: 0.51, blue: 0.97)
	  static let teal = Color(red: 0.08, green: 0.72, blue: 0.65)
	  static let sunrise = Color(red: 0.98, green: 0.45, blue: 0.11)
  static let softText = Color.white.opacity(0.82)
  static let mutedText = Color.white.opacity(0.58)
  static let barTrack = Color.white.opacity(0.12)
  static let barIdle = Color.white.opacity(0.2)

	  static func heroGradient(_ reviewCount: Int, isOnVacation: Bool) -> [Color] {
	    if isOnVacation {
	      return [Color(red: 0.20, green: 0.26, blue: 0.36), Color(red: 0.06, green: 0.09, blue: 0.14)]
	    }

	    if reviewCount == 0 {
	      return [Color(red: 0.05, green: 0.30, blue: 0.26), Color(red: 0.02, green: 0.08, blue: 0.11)]
	    }

    if reviewCount < 25 {
      return [Color(red: 0.04, green: 0.45, blue: 0.60), Color(red: 0.10, green: 0.22, blue: 0.58)]
    }

    if reviewCount < 75 {
      return [Color(red: 0.98, green: 0.58, blue: 0.12), Color(red: 0.78, green: 0.23, blue: 0.08)]
    }

    return [Color(red: 0.96, green: 0.31, blue: 0.43), Color(red: 0.55, green: 0.07, blue: 0.22)]
  }
}

private func nextReviewLabel(snapshot: ReviewSnapshot, now: Date) -> String {
  if snapshot.isOnVacation {
    return "No reviews while vacation mode is on"
  }

  if snapshot.effectiveCurrentReviews > 0 {
    return "Ready for Anki mode"
  }

  guard let nextDate = nextReviewDate(snapshot: snapshot, now: now) else {
    return "No upcoming reviews"
  }

  let relative = RelativeDateTimeFormatter()
  relative.unitsStyle = .short
  return "Next \(relative.localizedString(for: nextDate, relativeTo: now))"
}

private func nextReviewDate(snapshot: ReviewSnapshot, now: Date) -> Date? {
  let formatter = ISO8601DateFormatter()
  formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

  let exactDates = snapshot.upcomingReviewTimes.compactMap { key, count -> Date? in
    guard count > 0, let date = formatter.date(from: key), date > now else {
      return nil
    }

    return date
  }

  if let exactDate = exactDates.sorted().first {
    return exactDate
  }

  let calendar = Calendar.current
  let start = calendar.nextDate(
    after: now,
    matching: DateComponents(minute: 0, second: 0),
    matchingPolicy: .nextTime
  ) ?? now.addingTimeInterval(3600)

  for (index, count) in snapshot.effectiveUpcomingReviews.enumerated() where count > 0 {
    return start.addingTimeInterval(TimeInterval(index) * 3600)
  }

  return nil
}

private func syncAgeLabel(snapshot: ReviewSnapshot, now: Date) -> String {
  guard snapshot.lastUpdated > 0 else {
    return "--"
  }

  let minutes = max(0, Int(now.timeIntervalSince(snapshot.lastUpdatedDate) / 60))
  if minutes < 1 {
    return "now"
  }

  if minutes < 60 {
    return "\(minutes)m"
  }

  return "\(minutes / 60)h"
}

private func hourLabel(for date: Date) -> String {
  let formatter = DateFormatter()
  formatter.dateFormat = "ha"
  return formatter.string(from: date).lowercased()
}

#Preview {
  ContentView()
    .environmentObject(WatchReviewStore())
}
