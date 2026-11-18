import { permanentStorage } from "../permanentStorage";
import { buildReviewPausedUiStyles } from "../reviewPausedUiScale";
import {
  DEFAULT_REVIEW_PAUSED_UI_SCALE,
  REVIEW_PAUSED_UI_SCALE_MAX,
  REVIEW_PAUSED_UI_SCALE_MIN,
  useSettingsStore,
} from "../store";

jest.mock("../badgeNotifications", () => ({
  clearBadgeCount: jest.fn(),
  invalidateBadgeNotificationUpdatesForLogout: jest.fn(),
}));
jest.mock("expo-notifications", () => ({}));

afterEach(() =>
  useSettingsStore.setState(useSettingsStore.getInitialState(), true),
);

describe("review paused-answer settings", () => {
  it("keeps the existing review behavior by default", () => {
    expect(useSettingsStore.getInitialState()).toMatchObject({
      hideReviewWrapUpButton: false,
      reviewAnswerRevealScale: DEFAULT_REVIEW_PAUSED_UI_SCALE,
      reviewCorrectionButtonScale: DEFAULT_REVIEW_PAUSED_UI_SCALE,
      allowMarkingCorrectAnswersWrong: false,
    });
  });

  it("steps and clamps the reveal and button scales", () => {
    const { setReviewAnswerRevealScale, setReviewCorrectionButtonScale } =
      useSettingsStore.getState();

    setReviewAnswerRevealScale(1.3);
    expect(useSettingsStore.getState().reviewAnswerRevealScale).toBe(1.25);

    setReviewAnswerRevealScale(REVIEW_PAUSED_UI_SCALE_MAX + 1);
    expect(useSettingsStore.getState().reviewAnswerRevealScale).toBe(
      REVIEW_PAUSED_UI_SCALE_MAX,
    );

    setReviewCorrectionButtonScale(REVIEW_PAUSED_UI_SCALE_MIN - 1);
    expect(useSettingsStore.getState().reviewCorrectionButtonScale).toBe(
      REVIEW_PAUSED_UI_SCALE_MIN,
    );

    setReviewCorrectionButtonScale(Number.NaN);
    expect(useSettingsStore.getState().reviewCorrectionButtonScale).toBe(
      DEFAULT_REVIEW_PAUSED_UI_SCALE,
    );
  });

  it("restores defaults when hydrating settings saved before these options existed", async () => {
    useSettingsStore.setState({
      hideReviewWrapUpButton: true,
      allowMarkingCorrectAnswersWrong: true,
      reviewAnswerRevealScale: 2,
    });
    permanentStorage.set(
      "wanikani-settings",
      JSON.stringify({
        state: { reviewLeftHandedMode: true },
        version: useSettingsStore.persist.getOptions().version,
      }),
    );
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState()).toMatchObject({
      hideReviewWrapUpButton: false,
      allowMarkingCorrectAnswersWrong: false,
      reviewAnswerRevealScale: DEFAULT_REVIEW_PAUSED_UI_SCALE,
      reviewCorrectionButtonScale: DEFAULT_REVIEW_PAUSED_UI_SCALE,
    });
  });

  it("persists and restores the new preferences", async () => {
    const state = useSettingsStore.getState();
    state.setHideReviewWrapUpButton(true);
    state.setAllowMarkingCorrectAnswersWrong(true);
    state.setReviewAnswerRevealScale(1.5);
    state.setReviewCorrectionButtonScale(1.75);
    const stored = permanentStorage.getString("wanikani-settings")!;

    useSettingsStore.setState(useSettingsStore.getInitialState(), true);
    permanentStorage.set("wanikani-settings", stored);
    await useSettingsStore.persist.rehydrate();

    expect(useSettingsStore.getState()).toMatchObject({
      hideReviewWrapUpButton: true,
      allowMarkingCorrectAnswersWrong: true,
      reviewAnswerRevealScale: 1.5,
      reviewCorrectionButtonScale: 1.75,
    });
  });
});

describe("buildReviewPausedUiStyles", () => {
  it("matches the original sizes at 100%", () => {
    const styles = buildReviewPausedUiStyles(1, 1);
    expect(styles.reveal.answerText.fontSize).toBe(22);
    expect(styles.reveal.detailsBadgeLabel.fontSize).toBe(10);
    expect(styles.buttons.primaryText.fontSize).toBe(11);
    expect(styles.buttons.primaryIconSize).toBe(18);
    expect(styles.buttons.detailsButton.minHeight).toBe(34);
  });

  it("scales the reveal and buttons independently", () => {
    const styles = buildReviewPausedUiStyles(2, 1.5);
    expect(styles.reveal.answerText.fontSize).toBe(44);
    expect(styles.reveal.iconSize).toBe(48);
    expect(styles.reveal.detailsAnswerLines).toBe(3);
    expect(styles.buttons.primaryText.fontSize).toBe(17);
    expect(styles.buttons.primaryIconSize).toBe(27);
  });

  it("falls back to 100% for missing values", () => {
    expect(buildReviewPausedUiStyles(undefined, Number.NaN)).toEqual(
      buildReviewPausedUiStyles(1, 1),
    );
  });
});
