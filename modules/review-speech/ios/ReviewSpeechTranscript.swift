import Foundation

/// Volatile revisions replace their audio range; independent ranges accumulate.
/// The session, not an individual range, decides when an answer is final.
struct ReviewSpeechTranscript {
  struct Part {
    let start: Double
    let end: Double
    let alternatives: [String]
  }
  private(set) var parts: [Part] = []

  mutating func replace(start: Double, end: Double, alternatives: [String]) {
    guard start.isFinite, end.isFinite, end >= start else { return }
    parts.removeAll { abs($0.start - start) < 0.001 || ($0.start < end && $0.end > start) }
    parts.append(Part(start: start, end: end, alternatives: alternatives))
    parts.sort { $0.start < $1.start }
  }

  func results(joiner: String) -> [[String: Any]] {
    guard let last = parts.last else { return [] }
    var seen = Set<String>()
    return last.alternatives.prefix(5).compactMap { alternative in
      let texts = parts.dropLast().map { $0.alternatives.first ?? "" } + [alternative]
      let text = texts.joined(separator: joiner).trimmingCharacters(in: .whitespacesAndNewlines)
      guard !text.isEmpty, seen.insert(text).inserted else { return nil }
      let segments = zip(parts, texts).map { part, text -> [String: Any] in
        ["segment": text, "startTimeMillis": part.start * 1000,
         "endTimeMillis": part.end * 1000, "confidence": -1]
      }
      return ["transcript": text, "confidence": -1, "segments": segments]
    }
  }
}
