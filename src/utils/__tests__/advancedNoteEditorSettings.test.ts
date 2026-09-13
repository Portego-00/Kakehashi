import { permanentStorage } from "../permanentStorage";
import { useSettingsStore } from "../store";

describe("advanced note editor setting", () => {
  afterEach(() => {
    useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  });

  it("starts disabled for plain note taking", () => {
    expect(useSettingsStore.getInitialState().advancedNoteEditorEnabled).toBe(
      false,
    );
  });

  it("hydrates older settings without opting users into the advanced editor", async () => {
    useSettingsStore.setState({ advancedNoteEditorEnabled: true });
    permanentStorage.set(
      "wanikani-settings",
      JSON.stringify({
        state: { lessonBatchSize: 10 },
        version: 19,
      }),
    );

    await useSettingsStore.persist.rehydrate();

    expect(useSettingsStore.getState().advancedNoteEditorEnabled).toBe(false);
    expect(useSettingsStore.getState().lessonBatchSize).toBe(10);
  });

  it.each([true, false])("persists and restores the %s preference", async (enabled) => {
    useSettingsStore.getState().setAdvancedNoteEditorEnabled(enabled);

    const stored = permanentStorage.getString("wanikani-settings")!;
    expect(JSON.parse(stored).state.advancedNoteEditorEnabled).toBe(enabled);

    useSettingsStore.setState({ advancedNoteEditorEnabled: !enabled });
    permanentStorage.set("wanikani-settings", stored);
    await useSettingsStore.persist.rehydrate();

    expect(useSettingsStore.getState().advancedNoteEditorEnabled).toBe(enabled);
  });
});
