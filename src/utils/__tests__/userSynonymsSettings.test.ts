import { permanentStorage } from "../permanentStorage";
import { useSettingsStore } from "../store";

describe("user synonym answer preference", () => {
  afterEach(() => {
    useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  });

  it("accepts user synonyms by default", () => {
    expect(useSettingsStore.getInitialState().acceptUserSynonymsAsAnswers).toBe(true);
  });

  it.each([0, 20, 21])("enables synonyms for existing version %s settings", async (version) => {
    permanentStorage.set("wanikani-settings", JSON.stringify({
      state: { acceptUserSynonymsAsAnswers: false, lessonBatchSize: 10 },
      version,
    }));

    await useSettingsStore.persist.rehydrate();

    expect(useSettingsStore.getState().acceptUserSynonymsAsAnswers).toBe(true);
    expect(useSettingsStore.getState().lessonBatchSize).toBe(10);
    const stored = JSON.parse(permanentStorage.getString("wanikani-settings")!);
    expect(stored.version).toBe(22);
    expect(stored.state.acceptUserSynonymsAsAnswers).toBe(true);

    useSettingsStore.getState().setAcceptUserSynonymsAsAnswers(false);
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState().acceptUserSynonymsAsAnswers).toBe(false);
  });

  it.each([true, false])("restores the %s preference saved after migration", async (enabled) => {
    useSettingsStore.getState().setAcceptUserSynonymsAsAnswers(enabled);
    const stored = permanentStorage.getString("wanikani-settings")!;
    useSettingsStore.setState({ acceptUserSynonymsAsAnswers: !enabled });
    permanentStorage.set("wanikani-settings", stored);

    await useSettingsStore.persist.rehydrate();

    expect(useSettingsStore.getState().acceptUserSynonymsAsAnswers).toBe(enabled);
  });

  it("preserves an opt-out through future migrations", async () => {
    const migrate = useSettingsStore.persist.getOptions().migrate!;
    expect(await migrate({ acceptUserSynonymsAsAnswers: false }, 22))
      .toMatchObject({ acceptUserSynonymsAsAnswers: false });
  });
});
