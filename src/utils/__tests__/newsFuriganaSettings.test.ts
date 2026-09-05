import { permanentStorage } from "../permanentStorage";
import { useSettingsStore } from "../store";

describe("news furigana setting", () => {
  afterEach(() => {
    useSettingsStore.setState({ hideNewsFuriganaByDefault: false });
  });

  it("shows furigana by default", () => {
    expect(
      useSettingsStore.getInitialState().hideNewsFuriganaByDefault,
    ).toBe(false);
  });

  it("persists the hide-furigana preference", () => {
    useSettingsStore.getState().setHideNewsFuriganaByDefault(true);

    expect(useSettingsStore.getState().hideNewsFuriganaByDefault).toBe(true);

    const persistedSettings = JSON.parse(
      permanentStorage.getString("wanikani-settings") ?? "{}",
    );
    expect(persistedSettings.state.hideNewsFuriganaByDefault).toBe(true);
  });
});
