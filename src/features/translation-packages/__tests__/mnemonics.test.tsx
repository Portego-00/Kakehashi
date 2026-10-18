import React from "react";
import { Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, render, act } from "@testing-library/react-native";
import data from "../../../../translation-packages/example-tr-v3.json";
import { learningDisplay } from "../display";
import { TranslatedStudyText } from "../TranslatedStudyText";
import { createPackageManager, packageManager } from "../package-store";
import { useLearningContentStore } from "../store";
import { mnemonicFields, parseTranslationPackage, resolveSynonymAnswers, resolveTranslatedMnemonic } from "../resolver";
import { tokenizeWaniKaniMnemonic } from "../../../utils/wanikaniMnemonic";

jest.mock("../../../utils/theme", () => ({ useTheme: () => ({ theme: { primary: "#08f" } }) }));
const source = "Remember the <kanji>pond</kanji>.";
const translation = "<kanji>Gölet</kanji> sözcüğünü hatırla.";
function fixture() {
  const value = JSON.parse(JSON.stringify(data));
  value.schemaVersion = 4;
  value.subjects["440"].mnemonics = Object.fromEntries(mnemonicFields.map(field => [field, {
    source, sourceSha256: "0".repeat(64), translation, reviewStatus: "editorial-reviewed",
  }]));
  return value;
}
function subject(id = "440") {
  const s = data.subjects[id as keyof typeof data.subjects].source;
  return { id: Number(id), object: s.type, characters: s.word, meanings: s.meaningsEn.map(meaning => ({ meaning })), readings: s.readingsJa.map(reading => ({ reading })) };
}
beforeEach(() => {
  useLearningContentStore.setState({ enabled: true });
  packageManager.state.setState({ packet: parseTranslationPackage(fixture()), hydrated: true });
});
it.each(mnemonicFields)("matches %s by full subject and exact field source", field => {
  const packet = parseTranslationPackage(fixture())!;
  const before = JSON.stringify(packet);
  expect(resolveTranslatedMnemonic(packet, subject(), field, source)?.translation).toBe(translation);
  expect(resolveTranslatedMnemonic(packet, subject(), field, source + " ")).toBeNull();
  expect(resolveTranslatedMnemonic(packet, { ...subject(), id: -440 }, field, source)).toBeNull();
  expect(resolveTranslatedMnemonic(packet, { ...subject(), characters: "別" }, field, source)).toBeNull();
  expect(resolveTranslatedMnemonic(packet, { ...subject(), readings: [{ reading: "べつ" }] }, field, source)).toBeNull();
  expect(resolveTranslatedMnemonic(packet, { ...subject(), meanings: [{ meaning: "New meaning" }] }, field, source)).toBeNull();
  expect(JSON.stringify(packet)).toBe(before);
});
it("falls back per field and never displays a draft or an inferred translation", () => {
  const value = fixture();
  value.subjects["440"].mnemonics.meaningMnemonic.reviewStatus = "draft";
  delete value.subjects["440"].mnemonics.readingHint;
  const packet = parseTranslationPackage(value)!;
  expect(resolveTranslatedMnemonic(packet, subject(), "meaningMnemonic", source)).toBeNull();
  expect(resolveTranslatedMnemonic(packet, subject(), "readingHint", source)).toBeNull();
  expect(resolveTranslatedMnemonic(packet, subject(), "readingMnemonic", source)?.translation).toBe(translation);
  expect(learningDisplay(packet, false).mnemonic(subject(), "readingMnemonic", source)).toBeNull();
  expect(resolveTranslatedMnemonic(null, subject(), "readingMnemonic", source)).toBeNull();
  expect(resolveTranslatedMnemonic(packet, subject(), "readingMnemonic", "")).toBeNull();
});
it("retains legacy packages while requiring v4 and strict fields for mnemonics", () => {
  expect(parseTranslationPackage(data)).not.toBeNull();
  const value = fixture();
  value.schemaVersion = 3;
  expect(parseTranslationPackage(value)).toBeNull();
  value.schemaVersion = 4;
  value.subjects["440"].mnemonics.meaningMnemonic.unknown = true;
  expect(parseTranslationPackage(value)).toBeNull();
  delete value.subjects["440"].mnemonics.meaningMnemonic.unknown;
  value.subjects["440"].mnemonics = {};
  expect(parseTranslationPackage(value)).toBeNull();
});
it("allows radical and kana meaning mnemonics but rejects nonexistent reading fields", () => {
  for (const type of ["radical", "kana_vocabulary"]) {
    const value = fixture();
    const e = value.subjects["440"];
    e.source.type = type;
    e.source.readingsJa = [];
    e.examples = [];
    if (type === "radical") e.source.word = null;
    e.mnemonics = { meaningMnemonic: e.mnemonics.meaningMnemonic };
    expect(parseTranslationPackage(value)).not.toBeNull();
    e.mnemonics.readingHint = { ...e.mnemonics.meaningMnemonic };
    expect(parseTranslationPackage(value)).toBeNull();
  }
});
it("does not turn mnemonic text into accepted synonym answers", () => {
  const packet = parseTranslationPackage(fixture())!;
  expect(resolveSynonymAnswers(packet, subject())).toEqual(data.subjects["440"].synonymAnswers.values);
  const displayOnly = { ...packet, scope: "display-only" as const };
  expect(resolveSynonymAnswers(displayOnly, subject())).toBeNull();
});
it("uses the existing markup renderer and swaps original text in the same section", async () => {
  const renderText = (text: string) => <Text>{tokenizeWaniKaniMnemonic(text).map(t => t.text).join("")}</Text>;
  const s = render(<TranslatedStudyText subject={subject()} field="meaningMnemonic" original={source} render={renderText} />);
  expect(s.getByText("Gölet sözcüğünü hatırla.")).toBeTruthy();
  expect(tokenizeWaniKaniMnemonic(translation)[0]).toEqual({ type: "kanji", text: "Gölet" });
  fireEvent.press(s.getByText("Show original English"));
  expect(s.getByText("Remember the pond.")).toBeTruthy();
  expect(s.queryByText("Gölet sözcüğünü hatırla.")).toBeNull();
  fireEvent.press(s.getByText("Show translation"));
  expect(s.getByText("Gölet sözcüğünü hatırla.")).toBeTruthy();
  await act(async () => { useLearningContentStore.setState({ enabled: false }); });
  expect(s.getByText("Remember the pond.")).toBeTruthy();
  expect(s.queryByText("Show original English")).toBeNull();
});
it("resets the original toggle when content changes and hides controls on source mismatch", async () => {
  const renderText = (text: string) => <Text>{text}</Text>;
  const s = render(<TranslatedStudyText subject={subject()} field="meaningHint" original={source} render={renderText} />);
  fireEvent.press(s.getByText("Show original English"));
  const next = fixture();
  next.subjects["440"].mnemonics.meaningHint.translation = "Yeni ipucu";
  await act(async () => { packageManager.state.setState({ packet: parseTranslationPackage(next) }); });
  expect(s.getByText("Yeni ipucu")).toBeTruthy();
  s.rerender(<TranslatedStudyText subject={subject()} field="meaningHint" original="Changed source" render={renderText} />);
  expect(s.getByText("Changed source")).toBeTruthy();
  expect(s.queryByText("Show original English")).toBeNull();
});
it("persists and rehydrates the v4 fields without changing their source markup", async () => {
  const values = new Map<string, string>();
  const storage: typeof AsyncStorage = {
    ...AsyncStorage,
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => { values.set(key, value); },
    removeItem: async (key: string) => { values.delete(key); },
    multiGet: async keys => keys.map(key => [key, values.get(key) ?? null]),
    multiSet: async pairs => { for (const [key, value] of pairs) values.set(key, value); },
    multiRemove: async keys => { for (const key of keys) values.delete(key); },
  };
  const manager = createPackageManager(storage);
  const packet = parseTranslationPackage(fixture())!;
  await manager.activate(packet);
  const restarted = createPackageManager(storage);
  await restarted.hydrate();
  expect(resolveTranslatedMnemonic(restarted.state.getState().packet, subject(), "meaningMnemonic", source)?.translation).toBe(translation);
});
