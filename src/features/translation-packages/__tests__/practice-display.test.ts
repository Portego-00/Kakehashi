import data from "../../../../tests/fixtures/translation-packages/tr-learning-pilot.json";
import { learningDisplay } from "../display";
import { parseTranslationPackage } from "../resolver";
import { practiceAlternatives, practiceClue, practicePrompt, practiceSentence, practiceHintLabels, practiceReadingHints } from "../practice-display";
import { selectEnglishJapaneseQuestions } from "../../../utils/englishJapanesePractice";

const packet = parseTranslationPackage(data)!;
const entry = packet.subjects["2761"];
const subject = { id: 2761, object: entry.source.type, data: {
  characters: entry.source.word,
  meanings: entry.source.meaningsEn.map((meaning, index) => ({ meaning, primary: index === 0 })),
  readings: entry.source.readingsJa.map(reading => ({ reading })),
}};

it("translates practice sentences using both original source strings without changing question data", () => {
  const before = JSON.stringify(subject);
  const { ja, en } = entry.examples[0].source;
  expect(practiceSentence(learningDisplay(packet, true), subject, ja, en)).toBe(entry.examples[0].translation);
  expect(practiceSentence(learningDisplay(packet, false), subject, ja, en)).toBe(en);
  expect(practiceSentence(learningDisplay(null, true), subject, ja, en)).toBe(en);
  expect(practiceSentence(learningDisplay(packet, true), subject, ja + "変更", en)).toBe(en);
  expect(practiceSentence(learningDisplay(packet, true), subject, ja, en + " changed")).toBe(en + " changed");
  expect(JSON.stringify(subject)).toBe(before);
});

it("translates the primary reading prompt but preserves specialized/shared prompts", () => {
  const display = learningDisplay(packet, true);
  expect(practicePrompt(display, subject, entry.source.meaningsEn[0])).toBe("Gölet");
  expect(practicePrompt(display, subject, "A special shared prompt")).toBe("A special shared prompt");
  expect(practicePrompt(learningDisplay(packet, false), subject, entry.source.meaningsEn[0])).toBe(entry.source.meaningsEn[0]);
});

it("displays translations for primary, alternative and whitelisted reading groups without changing accepted answers", () => {
  const extended = parseTranslationPackage(JSON.parse(JSON.stringify(data)))!;
  extended.subjects["2761"].source.meaningsEn.push("Small-Pond", "Rejected sense");
  const current = { ...subject, data: { ...subject.data,
    meanings: [...subject.data.meanings,
      { meaning: "Small-Pond", primary: false, accepted_answer: true },
      { meaning: "Rejected sense", primary: false, accepted_answer: false }],
    auxiliary_meanings: [{ meaning: "A small pool", type: "whitelist" as const }, { meaning: "Bad pool", type: "blacklist" as const }],
  }};
  const display = learningDisplay(extended, true);
  const questions = selectEnglishJapaneseQuestions([current], 10, () => 0.5);
  const before = JSON.stringify(questions);
  for (const question of questions) {
    expect(practicePrompt(display, question.subject, question.promptMeaning)).not.toBe(question.promptMeaning);
    expect(question.acceptedAnswers.length).toBeGreaterThan(0);
  }
  expect(practicePrompt(display, current, "small pond")).toBe("Gölet");
  expect(practicePrompt(display, current, "Rejected sense")).toBe("Rejected sense");
  expect(practicePrompt(display, current, "Bad pool")).toBe("Bad pool");
  expect(practicePrompt(learningDisplay(extended, false), current, "Small-Pond")).toBe("Small-Pond");
  expect(JSON.stringify(questions)).toBe(before);
});

it("keeps one prompt meaning and puts alternatives only in context hints without losing sentences", () => {
  const extended = parseTranslationPackage(JSON.parse(JSON.stringify(data)))!;
  extended.subjects["2761"].meaning.alternatives = ["Su birikintisi", "Gölet"];
  const display = learningDisplay(extended, true);
  const hints = [{ en: "Sentence one" }, { en: "Sentence two" }, { en: "Sentence three" }];
  const before = JSON.stringify(hints);
  expect(practicePrompt(display, subject, "Pond")).toBe("Gölet");
  expect(practiceReadingHints(display, subject, hints)).toEqual([{ en: "Su Birikintisi" }, ...hints]);
  expect(practiceReadingHints(learningDisplay(extended, false), subject, hints)).toBe(hints);
  expect(practiceReadingHints(learningDisplay(null, true), subject, hints)).toBe(hints);
  expect(JSON.stringify(hints)).toBe(before);
});

it("translates saved kanji vocabulary hints from full cached sources and retains unavailable hints", () => {
  const originals = ["Pond", "Missing source"];
  const before = JSON.stringify(originals);
  expect(practiceHintLabels(learningDisplay(packet, true), originals, [undefined, subject])).toEqual(["Gölet", "Missing source"]);
  expect(practiceHintLabels(learningDisplay(packet, false), originals, [subject])).toEqual(originals);
  const changed = { ...subject, data: { ...subject.data, readings: [{ reading: "changed" }] } };
  expect(practiceHintLabels(learningDisplay(packet, true), originals, [changed])).toEqual(originals);
  expect(JSON.stringify(originals)).toBe(before);
});

it("localizes crossword clues while leaving Japanese clues, answers and unsupported sources intact", () => {
  const display = learningDisplay(packet, true);
  expect(practiceClue(display, subject, "Pond", "english", "池")).toBe("Gölet");
  expect(practiceClue(display, subject, "Pond", "english_kanji", "池")).toBe("Gölet • 池");
  expect(practiceClue(display, subject, "Pond", "kanji", "池")).toBe("池");
  expect(practiceClue(display, subject, "Pond", "kanji", null, "いけ")).toBe("いけ");
  expect(practiceClue(display, null, "Pond", "english", "池")).toBe("Pond");
  expect(practiceClue(learningDisplay(packet, false), subject, "Pond", "english_kanji", "池")).toBe("Pond • 池");
});

it("keeps English alternative hints when translations are off and uses package alternatives when matched", () => {
  const extra = { ...subject, data: { ...subject.data, meanings: [...subject.data.meanings, { meaning: "Small pond", primary: false }] } };
  expect(practiceAlternatives(learningDisplay(packet, false), extra, "Pond")).toEqual(["Small pond"]);
  expect(practiceAlternatives(learningDisplay(packet, true), extra, "Pond")).toEqual(["Small pond"]);
  const display = learningDisplay(packet, true);
  expect(practiceAlternatives(display, subject, "Pond")).toEqual(entry.meaning.alternatives.map(display.formatMeaning));
});
