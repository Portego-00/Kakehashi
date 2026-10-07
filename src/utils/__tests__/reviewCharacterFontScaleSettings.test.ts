import { permanentStorage } from "../permanentStorage";
import {
  DEFAULT_REVIEW_CHARACTER_FONT_SCALE,
  REVIEW_CHARACTER_FONT_SCALE_MAX,
  useSettingsStore,
} from "../store";

describe("review character size", () => {
  afterEach(() => useSettingsStore.setState(useSettingsStore.getInitialState(), true));

  it("keeps the existing prompt size by default", () => {
    expect(useSettingsStore.getInitialState().reviewCharacterFontScale).toBe(1);
  });

  it.each([0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2])("persists and restores a %s scale independently of other text", async (scale) => {
    useSettingsStore.setState({ appTextSizeScale: 1.15, reviewInputFontScale: 1.1 });
    useSettingsStore.getState().setReviewCharacterFontScale(scale);
    const persisted = JSON.parse(permanentStorage.getString("wanikani-settings")!);
    expect(persisted.state.reviewCharacterFontScale).toBe(scale);
    // Restore the saved payload after resetting memory to simulate a fresh launch.
    useSettingsStore.setState({ reviewCharacterFontScale: 1 });
    permanentStorage.set("wanikani-settings", JSON.stringify(persisted));
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState()).toMatchObject({
      reviewCharacterFontScale: scale,
      appTextSizeScale: 1.15,
      reviewInputFontScale: 1.1,
    });
  });

  it("bounds and rounds the prompt size, with a safe default for invalid values", () => {
    const { setReviewCharacterFontScale } = useSettingsStore.getState();
    setReviewCharacterFontScale(0.44);
    expect(useSettingsStore.getState().reviewCharacterFontScale).toBe(0.4);
    setReviewCharacterFontScale(0);
    expect(useSettingsStore.getState().reviewCharacterFontScale).toBe(0.3);
    setReviewCharacterFontScale(10);
    expect(useSettingsStore.getState().reviewCharacterFontScale).toBe(REVIEW_CHARACTER_FONT_SCALE_MAX);
    setReviewCharacterFontScale(Number.NaN);
    expect(useSettingsStore.getState().reviewCharacterFontScale).toBe(DEFAULT_REVIEW_CHARACTER_FONT_SCALE);
  });
});
