import Foundation

func text(_ transcript: ReviewSpeechTranscript, joiner: String = "") -> String? {
  transcript.results(joiner: joiner).first?["transcript"] as? String
}

var transcript = ReviewSpeechTranscript()
transcript.replace(start: 0, end: 0.3, alternatives: ["し"])
transcript.replace(start: 0, end: 0.6, alternatives: ["しき", "式", "しき"])
precondition(text(transcript) == "しき", "A volatile revision must replace the prefix, not duplicate it")
precondition(transcript.results(joiner: "").count == 2, "Duplicate alternatives must not be repeated")

transcript.replace(start: 0.7, end: 1, alternatives: ["つ"])
precondition(text(transcript) == "しきつ", "Distinct audio ranges must accumulate")
transcript.replace(start: 0, end: 1, alternatives: ["しきつ"])
precondition(text(transcript) == "しきつ", "A wider revision must replace its earlier overlapping ranges")

var repeated = ReviewSpeechTranscript()
repeated.replace(start: 0, end: 0.3, alternatives: ["つ"])
repeated.replace(start: 0.3, end: 0.6, alternatives: ["つ"])
precondition(text(repeated) == "つつ", "Actual repeated kana must not be collapsed")
repeated.replace(start: 1.7, end: 2, alternatives: ["よ"])
let segments = repeated.results(joiner: "").first?["segments"] as? [[String: Any]]
precondition(segments?[2]["startTimeMillis"] as? Double == 1700,
  "Utterance timing must survive so the existing retry detector can separate attempts")

var english = ReviewSpeechTranscript()
english.replace(start: 0, end: 0.4, alternatives: ["black"])
english.replace(start: 0.4, end: 0.8, alternatives: ["cat"])
precondition(text(english, joiner: " ") == "black cat", "English ranges must retain word separation")
english.replace(start: .nan, end: 1, alternatives: ["invalid"])
precondition(text(english, joiner: " ") == "black cat", "Invalid native timestamps must be ignored")
print("8 native speech transcript checks passed")
