import Foundation

/// Exact availability times retain their meaning when the Watch crosses a time zone.
struct WatchForecastDetail: Codable, Equatable {
  let date: String
  let count: Int
  let radical: Int
  let kanji: Int
  let vocabulary: Int
  let apprentice: Int
  let guru: Int
  let master: Int
  let enlightened: Int

  static func decode(_ value: Any?) -> [Self]? {
    guard let value, JSONSerialization.isValidJSONObject(value),
      let data = try? JSONSerialization.data(withJSONObject: value) else { return nil }
    return try? JSONDecoder().decode([Self].self, from: data)
  }

  var subjects: [Int] { [radical, kanji, vocabulary].map { max(0, $0) } }
  var stages: [Int] { [apprentice, guru, master, enlightened].map { max(0, $0) } }
}

enum WatchForecastMode: String, CaseIterable {
  case subject, srs
  var title: String { self == .subject ? "Subject" : "SRS stage" }
  var labels: [String] {
    self == .subject ? ["Radicals", "Kanji", "Vocabulary"]
      : ["Apprentice", "Guru", "Master", "Enlightened"]
  }
}
