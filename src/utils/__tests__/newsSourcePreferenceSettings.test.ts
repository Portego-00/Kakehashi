import { permanentStorage } from "../permanentStorage";
import { useSettingsStore } from "../store";

describe("news source preference", () => {
  afterEach(() => {
    useSettingsStore.setState({ newsSourcePreference: "easy" });
  });

  it("keeps Easy as the default for existing behavior", () => {
    expect(useSettingsStore.getInitialState().newsSourcePreference).toBe(
      "easy",
    );
  });

  it.each(["regular", "both"] as const)(
    "persists the %s opt-in",
    (preference) => {
      useSettingsStore.getState().setNewsSourcePreference(preference);

      expect(useSettingsStore.getState().newsSourcePreference).toBe(
        preference,
      );

      const persistedSettings = JSON.parse(
        permanentStorage.getString("wanikani-settings") ?? "{}",
      );
      expect(persistedSettings.state.newsSourcePreference).toBe(preference);
    },
  );

  it("falls back to Easy for an invalid restored preference", () => {
    useSettingsStore
      .getState()
      .setNewsSourcePreference("unsupported" as "easy");

    expect(useSettingsStore.getState().newsSourcePreference).toBe("easy");
  });
});
