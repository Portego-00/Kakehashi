import {
  DEFAULT_REVIEW_INPUT_FONT_SCALE,
  REVIEW_INPUT_FONT_SCALE_MAX,
  REVIEW_INPUT_FONT_SCALE_MIN,
  useSettingsStore,
} from "../store";

describe("review input font scale setting", () => {
  afterEach(() => {
    useSettingsStore.setState({
      reviewInputFontScale: DEFAULT_REVIEW_INPUT_FONT_SCALE,
    });
  });

  it("keeps the current input size by default", () => {
    expect(useSettingsStore.getInitialState().reviewInputFontScale).toBe(
      DEFAULT_REVIEW_INPUT_FONT_SCALE,
    );
  });

  it("normalizes a stepped input scale and clamps it to the supported range", () => {
    const { setReviewInputFontScale } = useSettingsStore.getState();

    setReviewInputFontScale(0.94);
    expect(useSettingsStore.getState().reviewInputFontScale).toBe(0.9);

    setReviewInputFontScale(REVIEW_INPUT_FONT_SCALE_MIN - 1);
    expect(useSettingsStore.getState().reviewInputFontScale).toBe(
      REVIEW_INPUT_FONT_SCALE_MIN,
    );

    setReviewInputFontScale(REVIEW_INPUT_FONT_SCALE_MAX + 1);
    expect(useSettingsStore.getState().reviewInputFontScale).toBe(
      REVIEW_INPUT_FONT_SCALE_MAX,
    );

    setReviewInputFontScale(Number.NaN);
    expect(useSettingsStore.getState().reviewInputFontScale).toBe(
      DEFAULT_REVIEW_INPUT_FONT_SCALE,
    );
  });
});
