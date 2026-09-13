import { permanentStorage } from "../permanentStorage";
import { useSettingsStore } from "../store";

describe("note link character preference", () => {
  afterEach(() => {
    useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  });

  it("preserves selected text by default", () => {
    expect(useSettingsStore.getInitialState().noteLinkIncludeCharacters).toBe(
      false,
    );
  });

  it.each([undefined, "true"])(
    "defaults missing or invalid older preferences (%s) to false",
    async (preference) => {
      useSettingsStore.setState({ noteLinkIncludeCharacters: true });
      permanentStorage.set(
        "wanikani-settings",
        JSON.stringify({
          state: {
            advancedNoteEditorEnabled: true,
            noteLinkIncludeCharacters: preference,
          },
          version: 20,
        }),
      );

      await useSettingsStore.persist.rehydrate();

      expect(useSettingsStore.getState().noteLinkIncludeCharacters).toBe(false);
      expect(useSettingsStore.getState().advancedNoteEditorEnabled).toBe(true);
    },
  );

  it.each([true, false])("persists and restores the %s preference", async (enabled) => {
    useSettingsStore.getState().setNoteLinkIncludeCharacters(enabled);

    const stored = permanentStorage.getString("wanikani-settings")!;
    expect(JSON.parse(stored).state.noteLinkIncludeCharacters).toBe(enabled);

    useSettingsStore.setState({ noteLinkIncludeCharacters: !enabled });
    permanentStorage.set("wanikani-settings", stored);
    await useSettingsStore.persist.rehydrate();

    expect(useSettingsStore.getState().noteLinkIncludeCharacters).toBe(enabled);
  });
});
