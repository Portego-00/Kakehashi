import { learningDisplay } from "../display";
import { parsePackageText, packageSummary } from "../resolver";
import data from "../../../../tests/fixtures/translation-packages/tr-learning-pilot.json";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

const packet = parsePackageText(JSON.stringify(data));
const entry = packet.subjects["2761"];
const subject = {id: 2761, object: "vocabulary", data: {characters: entry.source.word,
  meanings: entry.source.meaningsEn.map((meaning, i) => ({meaning, primary: i === 0})),
  readings: entry.source.readingsJa.map(reading => ({reading}))}};
it("uses the same translation for API lesson records and flat reading examples", () => {
  const display = learningDisplay(packet, true);
  expect(display.meaning(subject)).toBe("Gölet");
  expect(display.meaning({id: subject.id, object: subject.object, characters: subject.data.characters,
    meanings: subject.data.meanings.map(m => m.meaning), readings: subject.data.readings})).toBe("Gölet");
  expect(display.sentence(subject, entry.examples[0].source)?.translation).toBe(entry.examples[0].translation);
});
it("keeps originals intact and uses English when disabled or sources change", () => {
  const before = JSON.stringify(subject);
  expect(learningDisplay(packet, false).meaning(subject)).toBe(subject.data.meanings[0].meaning);
  const changed = {...subject, data: {...subject.data, readings: [{reading: "changed"}]}};
  expect(learningDisplay(packet, true).meaning(changed)).toBe(subject.data.meanings[0].meaning);
  expect(learningDisplay(packet, true).sentence(subject, {...entry.examples[0].source, en: "changed"})).toBeNull();
  expect(JSON.stringify(subject)).toBe(before);
});
it("loads the small v3 example and matches every included meaning", () => {
  const combined = parsePackageText(readFileSync(resolve(process.cwd(), "translation-packages/example-tr-v3.json"), "utf8"));
  const summary = packageSummary(combined);
  expect(summary.kanji).toBe(1); expect(summary.vocabulary + summary.kana_vocabulary).toBe(2);
  expect(summary.sentences).toBeGreaterThan(0); expect(summary.levels).toContain(8);
  const display = learningDisplay(combined, true);
  for (const [id, record] of Object.entries(combined.subjects)) {
    expect(display.resolveMeaning({id: Number(id), object: record.source.type, characters: record.source.word,
      meanings: record.source.meaningsEn, readings: record.source.readingsJa})?.primary).toBe(record.meaning.primary);
  }
});

it.each([false, true])("preserves caller English fallbacks exactly when translation is unavailable (enabled=%s)", enabled => {
 const missing = {...subject, id: -1};
 const display = learningDisplay(packet, enabled);
 for (const fallback of ["first English meaning", "", "Loading...", "—"]) {
  expect(display.meaning(missing, fallback)).toBe(fallback);
  expect(learningDisplay(null, enabled).meaning(subject, fallback)).toBe(fallback);
 }
 expect(learningDisplay(packet, false).meaning(subject, "first, not primary")).toBe("first, not primary");
});
