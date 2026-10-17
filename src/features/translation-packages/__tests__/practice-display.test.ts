import data from "../../../../tests/fixtures/translation-packages/tr-learning-pilot.json";
import { learningDisplay } from "../display";
import { parseTranslationPackage } from "../resolver";
import { practiceAlternatives, practiceClue, practicePrompt, practiceSentence } from "../practice-display";

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
