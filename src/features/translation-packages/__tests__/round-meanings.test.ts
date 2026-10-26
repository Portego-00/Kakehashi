import data from "../../../../tests/fixtures/translation-packages/tr-learning-pilot.json";
import { learningDisplay } from "../display";
import { parseTranslationPackage } from "../resolver";
import { roundMeaningLabels } from "../round-meanings";
import { buildKanjiMeaningMatchRounds } from "../../../utils/similarKanjiQuiz";

function fixture() {
  const packet = parseTranslationPackage(JSON.parse(JSON.stringify(data)))!;
  packet.subjects["441"] = {
    ...packet.subjects["440"],
    source: { ...packet.subjects["440"].source, word: "二", meaningsEn: ["Two"] },
    meaning: { ...packet.subjects["440"].meaning, primary: "iki" },
  };
  const subjects = [440, 441].map(id => {
    const source = packet.subjects[String(id)].source;
    return { id, object: "kanji" as const, data: {
      characters: source.word, meanings: source.meaningsEn.map(meaning => ({ meaning, primary: true, accepted_answer: true })),
      readings: source.readingsJa.map(reading => ({ reading, primary: true })), visually_similar_subject_ids: [],
    }};
  });
  const [round] = buildKanjiMeaningMatchRounds({ subjects, maxKanjiPerRound: 2, randomFn: () => 0.5 });
  return { packet, round };
}

it("translates labels by round item identity without mutating the saved round or shuffled choice IDs", () => {
  const { packet, round } = fixture();
  const before = JSON.stringify(round);
  const labels = roundMeaningLabels(round, learningDisplay(packet, true));
  for (const item of round.items) expect(labels.get(item.id)).toBe(item.subject.id === 440 ? "Bir" : "İki");
  for (const choice of [...round.meaningChoices].reverse()) expect(labels.get(choice.id)).toBe(choice.subjectId === 440 ? "Bir" : "İki");
  expect(JSON.stringify(round)).toBe(before);
});

it("uses originals when disabled, missing or source data no longer matches", () => {
  const { packet, round } = fixture();
  for (const display of [learningDisplay(packet, false), learningDisplay(null, true)]) {
    const labels = roundMeaningLabels(round, display);
    round.items.forEach(item => expect(labels.get(item.id)).toBe(item.meaning));
  }
  packet.subjects["440"].source.meaningsEn = ["Changed"];
  const labels = roundMeaningLabels(round, learningDisplay(packet, true));
  const item = round.items.find(item => item.subject.id === 440)!;
  expect(labels.get(item.id)).toBe("One");
});

it("keeps original labels for a round whose translations would make answers indistinguishable", () => {
  const { packet, round } = fixture();
  packet.subjects["441"].meaning.primary = "bir";
  const labels = roundMeaningLabels(round, learningDisplay(packet, true));
  round.items.forEach(item => expect(labels.get(item.id)).toBe(item.meaning));
});

it("handles the loading state before a round exists", () => {
  expect(roundMeaningLabels(undefined, learningDisplay(null, false)).size).toBe(0);
});
