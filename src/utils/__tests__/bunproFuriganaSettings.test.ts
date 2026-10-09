import { permanentStorage } from "../permanentStorage";
import { useSettingsStore } from "../store";

afterEach(() => useSettingsStore.setState(useSettingsStore.getInitialState(), true));

it("shows readings by default and persists the Bunpro-only hide preference across a restart", async () => {
  expect(useSettingsStore.getInitialState().bunproHideFurigana).toBe(false);
  useSettingsStore.getState().setBunproHideFurigana(true);
  const saved = permanentStorage.getString("wanikani-settings")!;
  expect(JSON.parse(saved).state.bunproHideFurigana).toBe(true);
  useSettingsStore.setState({ bunproHideFurigana: false });
  permanentStorage.set("wanikani-settings", saved);
  await useSettingsStore.persist.rehydrate();
  expect(useSettingsStore.getState().bunproHideFurigana).toBe(true);
});

it.each([undefined, "true"])("migrates an unsupported legacy value %s to the visible default", async value => {
  permanentStorage.set("wanikani-settings", JSON.stringify({ version: 22, state: { bunproHideFurigana: value, disableAutoProgressOnWrong: false } }));
  await useSettingsStore.persist.rehydrate();
  expect(useSettingsStore.getState().bunproHideFurigana).toBe(false);
  expect(useSettingsStore.getState().disableAutoProgressOnWrong).toBe(false);
});

it("persists Bunpro parity preferences and migrates older installs without losing pause choices", async () => {
  useSettingsStore.getState().setShowDetailsOnWrongAnswer(true);
  useSettingsStore.getState().setAnswerFeedbackSoundEnabled(true);
  useSettingsStore.getState().setReviewKeyboardShortcutsEnabled(false);
  const saved = permanentStorage.getString("wanikani-settings")!;
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  permanentStorage.set("wanikani-settings", saved);
  await useSettingsStore.persist.rehydrate();
  expect(useSettingsStore.getState()).toMatchObject({ showDetailsOnWrongAnswer: true, answerFeedbackSoundEnabled: true, reviewKeyboardShortcutsEnabled: false });
  permanentStorage.set("wanikani-settings", JSON.stringify({ version: 23, state: { disableAutoProgressOnWrong: false, showDetailsOnWrongAnswer: "bad", bunproStudyShortcuts: { hint: "r" } } }));
  await useSettingsStore.persist.rehydrate();
  expect(useSettingsStore.getState()).toMatchObject({ disableAutoProgressOnWrong: false, showDetailsOnWrongAnswer: false, answerFeedbackSoundEnabled: false, reviewKeyboardShortcutsEnabled: true });
  expect(useSettingsStore.getState().bunproStudyShortcuts.hint).toBe("h");
});
