import { useSettingsStore } from "../store";

it("defaults to typing and toggles multiple choice without changing Anki preferences", () => {
  const previous = useSettingsStore.getState();
  try {
    expect(useSettingsStore.getInitialState().reviewMultipleChoiceEnabled).toBe(
      false,
    );
    useSettingsStore.setState({
      ankiCardMode: true,
      ankiGroupQuestions: true,
      ankiCardModeScope: "reading",
    });
    useSettingsStore.getState().setReviewMultipleChoiceEnabled(true);
    expect(useSettingsStore.getState()).toMatchObject({
      reviewMultipleChoiceEnabled: true,
      ankiCardMode: true,
      ankiGroupQuestions: true,
      ankiCardModeScope: "reading",
    });
    useSettingsStore.getState().setReviewMultipleChoiceEnabled(false);
    expect(useSettingsStore.getState()).toMatchObject({
      reviewMultipleChoiceEnabled: false,
      ankiCardMode: true,
      ankiGroupQuestions: true,
      ankiCardModeScope: "reading",
    });
  } finally {
    useSettingsStore.setState(previous);
  }
});
