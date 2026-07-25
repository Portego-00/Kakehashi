import { useSettingsStore } from "../store";

describe("kanji vocabulary reading-group setting", () => {
  afterEach(() => {
    useSettingsStore.setState({
      groupKanjiVocabularyExamplesByReading: true,
    });
  });

  it("uses categorized examples by default", () => {
    expect(
      useSettingsStore.getInitialState()
        .groupKanjiVocabularyExamplesByReading,
    ).toBe(true);
  });

  it("can switch between grouped and ungrouped examples", () => {
    useSettingsStore
      .getState()
      .setGroupKanjiVocabularyExamplesByReading(false);
    expect(
      useSettingsStore.getState().groupKanjiVocabularyExamplesByReading,
    ).toBe(false);

    useSettingsStore
      .getState()
      .setGroupKanjiVocabularyExamplesByReading(true);
    expect(
      useSettingsStore.getState().groupKanjiVocabularyExamplesByReading,
    ).toBe(true);
  });
});
