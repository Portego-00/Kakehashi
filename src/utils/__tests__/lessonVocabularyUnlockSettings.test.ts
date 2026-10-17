import { permanentStorage } from "../permanentStorage";
import { useSettingsStore } from "../store";

afterEach(() => useSettingsStore.setState(useSettingsStore.getInitialState(), true));

it("keeps the vocabulary unlock setting off when hydrating older settings", async () => {
  expect(useSettingsStore.getInitialState().showLessonVocabularyUnlockCounts).toBe(false);
  useSettingsStore.setState({ showLessonVocabularyUnlockCounts: true });
  permanentStorage.set("wanikani-settings", JSON.stringify({ state: { lessonBatchSize: 10 }, version: 19 }));
  await useSettingsStore.persist.rehydrate();
  expect(useSettingsStore.getState().showLessonVocabularyUnlockCounts).toBe(false);
  expect(useSettingsStore.getState().lessonBatchSize).toBe(10);
});

it.each([true, false])("persists and restores the %s vocabulary unlock preference", async (enabled) => {
  useSettingsStore.getState().setShowLessonVocabularyUnlockCounts(enabled);
  const stored = permanentStorage.getString("wanikani-settings")!;
  expect(JSON.parse(stored).state.showLessonVocabularyUnlockCounts).toBe(enabled);
  useSettingsStore.setState({ showLessonVocabularyUnlockCounts: !enabled });
  permanentStorage.set("wanikani-settings", stored);
  await useSettingsStore.persist.rehydrate();
  expect(useSettingsStore.getState().showLessonVocabularyUnlockCounts).toBe(enabled);
});
