import { permanentStorage } from "../permanentStorage";
import { useSettingsStore } from "../store";

describe("kanji etymology setting", () => {
  afterEach(() => {
    useSettingsStore.setState({ showKanjiEtymology: false });
  });

  it("is disabled by default", () => {
    expect(useSettingsStore.getInitialState().showKanjiEtymology).toBe(false);
  });

  it("can be enabled and disabled", () => {
    useSettingsStore.getState().setShowKanjiEtymology(true);
    expect(useSettingsStore.getState().showKanjiEtymology).toBe(true);

    const persistedSettings = JSON.parse(
      permanentStorage.getString("wanikani-settings") ?? "{}"
    );
    expect(persistedSettings.state.showKanjiEtymology).toBe(true);

    useSettingsStore.getState().setShowKanjiEtymology(false);
    expect(useSettingsStore.getState().showKanjiEtymology).toBe(false);
  });
});
