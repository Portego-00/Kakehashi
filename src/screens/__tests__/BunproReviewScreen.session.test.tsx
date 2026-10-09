import React from "react";
import { Audio } from "../../utils/expoAvCompat";
import { StyleSheet } from "react-native";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import BunproReviewScreen from "../BunproReviewScreen";
import { getBunproReviewQuizIndex, updateBunproReview } from "../../utils/bunproApi";
import type { BunproReviewQueueItem } from "../../types/bunpro";
import { createBunproReviewSavePolicy } from "../../utils/bunproReviewSavePolicy";
import type { MixedReviewBridge } from "../../types/mixedReviews";

const mockReviewSettings = { autoSwitchKeyboard: false, disableAutoProgressOnCorrect: true, disableAutoProgressOnWrong: true, autoplayVocabularyAudio: false, vocabularyAudioVoice: "female", allowSkippingReviews: false, ankiCardMode: false, ankiCardModeScope: "both", ankiHideAnswerCompletely: false, ankiShowOtherAcceptedAnswersAndUserSynonyms: false, ankiShowReplayAudioButton: false, ankiButtonlessMode: false, ankiGroupQuestions: false, reviewSearchButtonEnabled: false, bunproHideFurigana: false, setBunproHideFurigana: jest.fn() };

jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);

jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return { __esModule: true, default: { View }, useReducedMotion: () => false, useSharedValue: (value: number) => React.useRef({ value }).current, useAnimatedStyle: (fn: () => object) => fn(), withTiming: (value: number) => value };
});
jest.mock("../../utils/haptics", () => ({ notificationAsync: jest.fn(), NotificationFeedbackType: { Success: "success", Error: "error" } }));
jest.mock("../../hooks/use-bunpro-voice-answer", () => ({ useBunproVoiceAnswer: () => ({ listening: false, error: "", start: jest.fn(), stop: jest.fn() }) }));
jest.mock("../../hooks/use-bunpro-jitai-font", () => ({ useBunproJitaiFont: () => undefined }));
jest.mock("../../components/bunpro/bunpro-review-shortcuts", () => ({ BunproReviewShortcuts: () => null }));
jest.mock("../../components/bunpro/bunpro-details-content", () => ({ BunproDetailsContent: () => null }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-router", () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }), useLocalSearchParams: () => ({}) }));
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));
jest.mock("../../utils/navigation-focus", () => ({ useOptionalScreenIsFocused: () => true }));
jest.mock("../../utils/store", () => ({
  useAuthStore: () => ({ userData: { username: "Portego" } }),
  useSettingsStore: (selector: (state: object) => unknown) => selector(mockReviewSettings),
}));
jest.mock("../../utils/theme", () => ({ useTheme: () => ({ theme: { textColor: "#000", textSecondary: "#666", backgroundColor: "#fff", border: "#ccc", error: "#a00" }, isDark: false }) }));
jest.mock("../../utils/bunproApi", () => ({
  BunproApiError: class extends Error {},
  getStoredBunproApiToken: jest.fn().mockResolvedValue("fixture-key"),
  getBunproReviewQuizIndex: jest.fn(),
  updateBunproReview: jest.fn(),
}));
jest.mock("../../utils/expoAvCompat", () => ({ Audio: { Sound: { createAsync: jest.fn() } } }));
jest.mock("../../components/TextToKanaInput", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { TextInput } = jest.requireActual<typeof import("react-native")>("react-native");
  return { __esModule: true, default: React.forwardRef(function TestKanaInput(props: any, ref: any) {
    const [value, setValue] = React.useState(props.initialValue ?? "");
    const valueRef = React.useRef(props.initialValue ?? "");
    React.useLayoutEffect(() => { valueRef.current = ""; setValue(""); }, [props.resetSignal]);
    React.useImperativeHandle(ref, () => ({
      flushKana: () => valueRef.current,
      clearInput: () => { valueRef.current = ""; setValue(""); },
      setInputText: (text: string) => { valueRef.current = text; setValue(text); },
      focus: jest.fn(),
    }));
    return React.createElement(TextInput, { ...props, value, testID: props.enableKanaConversion ? "kana-input" : "meaning-input", onChangeText: (text: string) => { valueRef.current = text; setValue(text); props.onKanaChange(text); } });
  }) };
});

function item(id: string, answer = "ねこ", kind = "Vocab"): BunproReviewQueueItem {
  return {
    data: { id, type: "review", attributes: { id: Number(id), ghost_count: 0, reviewable_id: Number(id), reviewable_type: kind }, relationships: { study_question: { data: { id: `q${id}`, type: "study_question" } }, reviewable: { data: { id, type: kind === "Vocab" ? "vocab" : "grammar_point" } } } },
    included: [
      { id: `q${id}`, type: "study_question", attributes: { content: `Question ${id} ____.`, answer, translation: `Translation ${id}` } },
      { id, type: kind === "Vocab" ? "vocab" : "grammar_point", attributes: { title: `Subject ${id}`, slug: `subject-${id}` } },
    ],
  };
}
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function bridge(active = true): MixedReviewBridge {
  return { active, report: jest.fn(), reportError: jest.fn(), reportProgress: jest.fn(), reportAccuracy: jest.fn(), onAnswer: jest.fn(), previous: null, progress: { completed: 0, total: 2 }, accuracy: { correct: 0, answered: 0 }, onExit: jest.fn(), onWrapUp: jest.fn() };
}

beforeEach(() => { mockReviewSettings.bunproHideFurigana = false; mockReviewSettings.setBunproHideFurigana.mockImplementation((hidden: boolean) => { mockReviewSettings.bunproHideFurigana = hidden; }); mockReviewSettings.ankiCardMode = false; mockReviewSettings.ankiCardModeScope = "both"; mockReviewSettings.ankiButtonlessMode = false;  mockReviewSettings.autoplayVocabularyAudio = false; mockReviewSettings.allowSkippingReviews = false; mockReviewSettings.vocabularyAudioVoice = "female"; mockReviewSettings.disableAutoProgressOnCorrect = true; mockReviewSettings.disableAutoProgressOnWrong = true; jest.clearAllMocks(); jest.mocked(updateBunproReview).mockResolvedValue({}); });

it("serializes saves, ignores repeated Next taps, and clears feedback and input for the next question", async () => {
  const saving = deferred<Record<string, unknown>>();
  jest.mocked(updateBunproReview).mockReturnValue(saving.promise);
  const queue = [item("1"), item("2", "いぬ")];
  const view = render(<BunproReviewScreen initialQueue={queue} initialReviewSessionId={42} />);
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "ねこ");
  fireEvent.press(view.getByLabelText("Check answer"));
  const next = view.getByLabelText("Next question");
  act(() => { fireEvent.press(next); fireEvent.press(next); });
  expect(updateBunproReview).toHaveBeenCalledTimes(1);
  expect(view.getByText("Question 1 ")).toBeTruthy();
  await act(async () => saving.resolve({}));
  expect(view.getByText("Question 2 ")).toBeTruthy();
  expect(view.getByLabelText("Bunpro answer").props.value).toBe("");
  expect(view.queryByText("Undo")).toBeNull();
  expect(view.getByLabelText("Check answer")).toBeTruthy();
});

it("keeps failed answers for explicit retry without retrying POST automatically", async () => {
  jest.mocked(updateBunproReview).mockRejectedValueOnce(new Error("Offline"));
  const view = render(<BunproReviewScreen initialQueue={[item("1"), item("2")]} initialReviewSessionId={42} />);
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "ねこ");
  fireEvent.press(view.getByLabelText("Check answer"));
  fireEvent.press(view.getByLabelText("Next question"));
  await waitFor(() => expect(view.getByText(/Your answer is kept/)).toBeTruthy());
  expect(updateBunproReview).toHaveBeenCalledTimes(1);
  expect(view.getByLabelText("Bunpro answer").props.value).toBe("ねこ");
  fireEvent.press(view.getByLabelText("Retry save"));
  await waitFor(() => expect(view.getByText("Question 2 ")).toBeTruthy());
  expect(updateBunproReview).toHaveBeenCalledTimes(2);
});

it("repeats a missed question with fresh state and saves the correct wrapup without counting it twice", async () => {
  const mixed = bridge();
  const view = render(<BunproReviewScreen initialQueue={[item("1")]} initialReviewSessionId={42} mixed={mixed} />);
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "いぬ");
  fireEvent.press(view.getByLabelText("Check answer"));
  fireEvent.press(view.getByText("Alternatives"));
  fireEvent.press(view.getByLabelText("Next question"));
  await waitFor(() => expect(view.getByLabelText("Check answer")).toBeTruthy());
  expect(view.getByLabelText("Bunpro answer").props.value).toBe("");
  expect(view.getByText(/Retry/)).toBeTruthy();
  expect(mixed.report).toHaveBeenLastCalledWith(expect.objectContaining({ id: "1:1:q1", remaining: 1 }));
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "ねこ");
  fireEvent.press(view.getByLabelText("Check answer"));
  fireEvent.press(view.getByLabelText("Next question"));
  await waitFor(() => expect(mixed.report).toHaveBeenLastCalledWith(null));
  expect(updateBunproReview).toHaveBeenCalledTimes(2);
  expect(updateBunproReview).toHaveBeenLastCalledWith(expect.objectContaining({ payload: expect.objectContaining({ correct: true }) }));
  expect(updateBunproReview).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({ correct: false }) }));
  expect(mixed.reportAccuracy).toHaveBeenLastCalledWith({ correct: 0, answered: 1 });
  expect(mixed.reportProgress).toHaveBeenLastCalledWith({ completed: 1, total: 1 });
});

it("uses English input and meaning grading for Bunpro translation vocabulary", async () => {
  const view = render(<BunproReviewScreen initialQueue={[item("1", "a cat")]} initialReviewSessionId={42} />);
  expect(view.getByTestId("meaning-input")).toBeTruthy();
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), " A   CAT! ");
  fireEvent.press(view.getByLabelText("Check answer"));
  fireEvent.press(view.getByLabelText("Next question"));
  await waitFor(() => expect(updateBunproReview).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({ correct: true }) })));
});

it("retains the active question across mixed provider switches", () => {
  const queue = [item("1"), item("2")];
  const mixed = bridge();
  const view = render(<BunproReviewScreen initialQueue={queue} initialReviewSessionId={42} mixed={mixed} />);
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "ね");
  view.rerender(<BunproReviewScreen initialQueue={queue} initialReviewSessionId={42} mixed={{ ...mixed, active: false }} />);
  expect(view.queryByLabelText("Bunpro answer")).toBeNull();
  view.rerender(<BunproReviewScreen initialQueue={queue} initialReviewSessionId={42} mixed={mixed} />);
  expect(view.getByText("Question 1 ")).toBeTruthy();
  expect(view.getByLabelText("Bunpro answer").props.value).toBe("ね");
  expect(updateBunproReview).not.toHaveBeenCalled();
});

it("recovers a next-page failure without submitting an already saved answer twice", async () => {
  jest.mocked(getBunproReviewQuizIndex)
    .mockResolvedValueOnce({ review_session_id: 42, pending_attempt: [item("1")], pending_wrapup: [], total_pending_attempt_count: 2, total_pending_wrapup_count: 0 })
    .mockRejectedValueOnce(new Error("Network error"))
    .mockResolvedValueOnce({ review_session_id: 43, pending_attempt: [item("2")], pending_wrapup: [], total_pending_attempt_count: 1, total_pending_wrapup_count: 0 });
  const view = render(<BunproReviewScreen />);
  await waitFor(() => expect(view.getByLabelText("Bunpro answer")).toBeTruthy());
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "ねこ");
  fireEvent.press(view.getByLabelText("Check answer"));
  fireEvent.press(view.getByLabelText("Next question"));
  await waitFor(() => expect(view.getByText(/Your answer is kept/)).toBeTruthy());
  expect(view.getByLabelText("Bunpro answer").props.editable).toBe(false);
  fireEvent.press(view.getByLabelText("Next question"));
  await waitFor(() => expect(view.getByText("Question 2 ")).toBeTruthy());
  expect(updateBunproReview).toHaveBeenCalledTimes(1);
  expect(getBunproReviewQuizIndex).toHaveBeenCalledTimes(3);
});

it("does not fetch review pages while submitting a lesson quiz", async () => {
  const view = render(<BunproReviewScreen initialQueue={[item("1")]} initialReviewSessionId={42} submissionContext="learn" />);
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "ねこ");
  fireEvent.press(view.getByLabelText("Check answer"));
  fireEvent.press(view.getByLabelText("Next question"));
  await waitFor(() => expect(updateBunproReview).toHaveBeenCalled());
  expect(updateBunproReview).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({ only_review: null, loaded_review_ids: null }) }));
  expect(getBunproReviewQuizIndex).not.toHaveBeenCalled();
});


it("applies a mixed wrap-up once and does not drop retained questions on later advances", async () => {
  const queue = [item("1"), item("2"), item("3")];
  const mixed = bridge();
  const view = render(<BunproReviewScreen initialQueue={queue} initialReviewSessionId={42} mixed={mixed} />);
  view.rerender(<BunproReviewScreen initialQueue={queue} initialReviewSessionId={42} mixed={{ ...mixed, wrapUpRequest: { id: 1, limit: 2 } }} />);
  for (const id of ["1", "2"]) {
    expect(view.getByText(`Question ${id} `)).toBeTruthy();
    fireEvent.changeText(view.getByLabelText("Bunpro answer"), "ねこ");
    fireEvent.press(view.getByLabelText("Check answer"));
    fireEvent.press(view.getByLabelText("Next question"));
    await waitFor(() => expect(mixed.report).toHaveBeenLastCalledWith(id === "1" ? expect.objectContaining({ id: "1:2:q2", remaining: 1 }) : null));
  }
  await waitFor(() => expect(mixed.report).toHaveBeenLastCalledWith(null));
  expect(mixed.reportProgress).toHaveBeenLastCalledWith({ completed: 2, total: 2 });
  expect(getBunproReviewQuizIndex).not.toHaveBeenCalled();
});


it("keeps global progress, accuracy, exit and wrap-up available on a Bunpro mixed turn", () => {
  const mixed = { ...bridge(), progress: { completed: 4, total: 20 }, accuracy: { answered: 5, correct: 4 } };
  const view = render(<BunproReviewScreen initialQueue={[item("1")]} initialReviewSessionId={42} mixed={mixed} />);
  expect(view.getByText("4/20")).toBeTruthy();
  expect(view.getByText("80%")).toBeTruthy();
  fireEvent.press(view.getByLabelText("Exit mixed reviews"));
  fireEvent.press(view.getByLabelText("Wrap up mixed reviews"));
  expect(mixed.onExit).toHaveBeenCalledTimes(1);
  expect(mixed.onWrapUp).toHaveBeenCalledTimes(1);
});

it("renders and grades a vocabulary study-question resource using its relationship type", async () => {
  const vocabularyItem = item("1", "a cat");
  vocabularyItem.data.relationships!.study_question!.data!.type = "vocab_study_question";
  vocabularyItem.included![0].type = "vocab_study_question";
  const view = render(<BunproReviewScreen initialQueue={[vocabularyItem]} initialReviewSessionId={42} />);
  expect(view.getByText("Question 1 ")).toBeTruthy();
  expect(view.queryByText("Translation 1")).toBeNull();
  expect(view.getByTestId("meaning-input")).toBeTruthy();
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "a cat");
  fireEvent.press(view.getByLabelText("Check answer"));
  fireEvent.press(view.getByLabelText("Next question"));
  await waitFor(() => expect(updateBunproReview).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({ correct: true }) })));
});


it("cannot submit an answer when Bunpro omitted the study question", () => {
  const incomplete = item("1");
  incomplete.included = incomplete.included!.slice(1);
  const view = render(<BunproReviewScreen initialQueue={[incomplete]} initialReviewSessionId={42} />);
  expect(view.getByText(/did not provide a complete question/)).toBeTruthy();
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "anything");
  fireEvent.press(view.getByLabelText("Check answer"));
  expect(updateBunproReview).not.toHaveBeenCalled();
  expect(view.queryByLabelText("Next question")).toBeNull();
});

it("holds a failed answer until explicitly continued and marks the unsaved result", async () => {
  jest.mocked(updateBunproReview).mockRejectedValueOnce(new Error("Bunpro request failed (500)."));
  const queue = [item("1"), item("2")];
  const view = render(<BunproReviewScreen initialQueue={queue} initialReviewSessionId={42} />);
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "ねこ");
  fireEvent.press(view.getByLabelText("Check answer"));
  fireEvent.press(view.getByLabelText("Next question"));
  await waitFor(() => expect(view.getByLabelText("Continue without saving")).toBeTruthy());
  expect(view.getByText("Bunpro request failed (500).")).toBeTruthy();
  expect(view.getByText("Question 1 ")).toBeTruthy();
  expect(view.queryByText("Question 2 ")).toBeNull();
  expect(view.getByLabelText("Bunpro answer").props.value).toBe("ねこ");
  fireEvent.press(view.getByLabelText("Continue without saving"));
  await waitFor(() => expect(view.getByText("Question 2 ")).toBeTruthy());
  expect(updateBunproReview).toHaveBeenCalledTimes(1);
  expect(view.getByText(/1 answer has an unconfirmed save/)).toBeTruthy();
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "ねこ");
  fireEvent.press(view.getByLabelText("Check answer"));
  fireEvent.press(view.getByLabelText("Next question"));
  await waitFor(() => expect(view.getByText("Bunpro Results")).toBeTruthy());
  expect(view.getByText(/1 Bunpro answer has an unconfirmed save/)).toBeTruthy();
  expect(view.getByText(/Save unconfirmed. Bunpro request failed/)).toBeTruthy();
  expect(updateBunproReview).toHaveBeenCalledTimes(2);
});

it.each([401, 403])("pauses authentication failure %i without allowing an unsaved advance", async (status) => {
  jest.mocked(updateBunproReview).mockRejectedValueOnce(Object.assign(new Error("Authentication rejected"), { status }));
  const view = render(<BunproReviewScreen initialQueue={[item("1"), item("2")]} initialReviewSessionId={42} />);
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "ねこ");
  fireEvent.press(view.getByLabelText("Check answer"));
  fireEvent.press(view.getByLabelText("Next question"));
  await waitFor(() => expect(view.getByLabelText("Retry save")).toBeTruthy());
  expect(view.getByText("Authentication rejected")).toBeTruthy();
  expect(view.getByText(/API key was rejected/)).toBeTruthy();
  expect(view.queryByLabelText("Continue without saving")).toBeNull();
  expect(view.getByText("Question 1 ")).toBeTruthy();
});

it("shares consecutive failures between Bunpro lanes and recovers after a saved retry", async () => {
  const policy = createBunproReviewSavePolicy();
  jest.mocked(updateBunproReview).mockRejectedValue(new Error("Offline"));
  const grammar = render(<BunproReviewScreen initialQueue={[item("1", "ねこ", "GrammarPoint")]} initialReviewSessionId={42} savePolicy={policy} />);
  fireEvent.changeText(grammar.getByLabelText("Bunpro answer"), "ねこ");
  fireEvent.press(grammar.getByLabelText("Check answer"));
  fireEvent.press(grammar.getByLabelText("Next question"));
  await waitFor(() => expect(grammar.getByLabelText("Continue without saving")).toBeTruthy());
  fireEvent.press(grammar.getByLabelText("Retry save"));
  await waitFor(() => expect(updateBunproReview).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(grammar.getByLabelText("Retry save").props.accessibilityState?.disabled).toBeFalsy());
  grammar.unmount();
  const vocab = render(<BunproReviewScreen initialQueue={[item("2"), item("3")]} initialReviewSessionId={42} savePolicy={policy} />);
  fireEvent.changeText(vocab.getByLabelText("Bunpro answer"), "ねこ");
  fireEvent.press(vocab.getByLabelText("Check answer"));
  fireEvent.press(vocab.getByLabelText("Next question"));
  await waitFor(() => expect(vocab.getByText(/3 consecutive save failures/)).toBeTruthy());
  expect(vocab.queryByLabelText("Continue without saving")).toBeNull();
  jest.mocked(updateBunproReview).mockResolvedValueOnce({});
  fireEvent.press(vocab.getByLabelText("Retry save"));
  await waitFor(() => expect(vocab.getByText("Question 3 ")).toBeTruthy());
  fireEvent.changeText(vocab.getByLabelText("Bunpro answer"), "ねこ");
  fireEvent.press(vocab.getByLabelText("Check answer"));
  fireEvent.press(vocab.getByLabelText("Next question"));
  await waitFor(() => expect(vocab.getByLabelText("Continue without saving")).toBeTruthy());
});

it("submits same-number normal and ghost reviews independently and labels the ghost stage", async () => {
  const normal = item("1");
  const ghost = item("1", "いぬ");
  ghost.data.type = "ghost_review";
  delete ghost.data.attributes.ghost_count;
  ghost.data.attributes.streak = 0;
  const view = render(<BunproReviewScreen initialQueue={[normal, ghost]} initialReviewSessionId={42} />);
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "ねこ");
  fireEvent.press(view.getByLabelText("Check answer"));
  fireEvent.press(view.getByLabelText("Next question"));
  await waitFor(() => expect(view.getByText(/Ghost review/)).toBeTruthy());
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "いぬ");
  fireEvent.press(view.getByLabelText("Check answer"));
  expect(view.getByText("Ghost 1")).toBeTruthy();
  fireEvent.press(view.getByLabelText("Next question"));
  await waitFor(() => expect(view.getByText("Bunpro Results")).toBeTruthy());
  expect(updateBunproReview).toHaveBeenNthCalledWith(1, expect.objectContaining({ reviewId: "1", reviewType: "review" }));
  expect(updateBunproReview).toHaveBeenNthCalledWith(2, expect.objectContaining({ reviewId: "1", reviewType: "ghost_review" }));
});

it("finishes paged reviews when Bunpro returns only an explicitly skipped item still due", async () => {
  jest.mocked(getBunproReviewQuizIndex)
    .mockResolvedValueOnce({ review_session_id: 42, pending_attempt: [item("1")], pending_wrapup: [], total_pending_attempt_count: 3, total_pending_wrapup_count: 0 })
    .mockResolvedValueOnce({ review_session_id: 43, pending_attempt: [item("1"), item("2")], pending_wrapup: [], total_pending_attempt_count: 3, total_pending_wrapup_count: 0 })
    .mockResolvedValueOnce({ review_session_id: 44, pending_attempt: [item("1")], pending_wrapup: [], total_pending_attempt_count: 1, total_pending_wrapup_count: 0 });
  jest.mocked(updateBunproReview).mockRejectedValueOnce(new Error("Offline"));
  const view = render(<BunproReviewScreen />);
  await waitFor(() => expect(view.getByLabelText("Bunpro answer")).toBeTruthy());
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "ねこ");
  fireEvent.press(view.getByLabelText("Check answer"));
  fireEvent.press(view.getByLabelText("Next question"));
  await waitFor(() => expect(view.getByLabelText("Continue without saving")).toBeTruthy());
  fireEvent.press(view.getByLabelText("Continue without saving"));
  await waitFor(() => expect(view.getByText("Question 2 ")).toBeTruthy());
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "ねこ");
  fireEvent.press(view.getByLabelText("Check answer"));
  fireEvent.press(view.getByLabelText("Next question"));
  await waitFor(() => expect(view.getByText("Bunpro Results")).toBeTruthy());
  expect(updateBunproReview).toHaveBeenCalledTimes(2);
  expect(getBunproReviewQuizIndex).toHaveBeenCalledTimes(3);
  expect(view.getByText(/1 Bunpro answer has an unconfirmed save/)).toBeTruthy();
});

it("uses only the custom question for a self-study review and refuses a missing custom resource", async () => {
  const custom = item("1");
  custom.data.type = "self_study_review";
  custom.data.attributes.user_study_question_id = "custom-1";
  custom.included!.push({ id: "custom-1", type: "user_study_question", attributes: { content: "Custom ____.", answer: "いぬ" } });
  const view = render(<BunproReviewScreen initialQueue={[custom]} initialReviewSessionId={42} />);
  expect(view.getByText("Custom ")).toBeTruthy();
  expect(view.queryByText("Question 1 ")).toBeNull();
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "いぬ");
  fireEvent.press(view.getByLabelText("Check answer"));
  fireEvent.press(view.getByLabelText("Next question"));
  await waitFor(() => expect(updateBunproReview).toHaveBeenCalledWith(expect.objectContaining({ reviewType: "self_study_review", payload: expect.objectContaining({ correct: true }) })));
  await waitFor(() => expect(view.getByText("Bunpro Results")).toBeTruthy());
  view.unmount();
  const missing = { ...custom, included: custom.included!.filter((resource) => resource.type !== "user_study_question") };
  const unavailable = render(<BunproReviewScreen initialQueue={[missing]} initialReviewSessionId={42} />);
  expect(unavailable.getByText(/did not provide a complete question/)).toBeTruthy();
  expect(unavailable.queryByText("Question 1 ")).toBeNull();
});

it("resets local save failures when a new external lesson batch starts", async () => {
  jest.mocked(updateBunproReview).mockRejectedValue(new Error("Offline"));
  const firstBatch = [item("1")];
  const view = render(<BunproReviewScreen initialQueue={firstBatch} initialReviewSessionId={42} submissionContext="learn" />);
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "ねこ");
  fireEvent.press(view.getByLabelText("Check answer"));
  fireEvent.press(view.getByLabelText("Next question"));
  await waitFor(() => expect(view.getByLabelText("Continue without saving")).toBeTruthy());
  await act(async () => { fireEvent.press(view.getByLabelText("Retry save")); });
  expect(updateBunproReview).toHaveBeenCalledTimes(2);
  view.rerender(<BunproReviewScreen initialQueue={[item("2")]} initialReviewSessionId={43} submissionContext="learn" />);
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "ねこ");
  fireEvent.press(view.getByLabelText("Check answer"));
  fireEvent.press(view.getByLabelText("Next question"));
  await waitFor(() => expect(view.getByLabelText("Continue without saving")).toBeTruthy());
  expect(view.queryByText(/3 consecutive save failures/)).toBeNull();
});


it("keeps the answer input mounted and editable throughout a successful save", async () => {
  const saving = deferred<Record<string, unknown>>();
  jest.mocked(updateBunproReview).mockReturnValue(saving.promise);
  const view = render(<BunproReviewScreen initialQueue={[item("1"), item("2")]} initialReviewSessionId={42} />);
  const input = view.getByLabelText("Bunpro answer");
  fireEvent.changeText(input, "ねこ");
  fireEvent.press(view.getByLabelText("Check answer"));
  fireEvent.press(view.getByLabelText("Next question"));
  expect(view.getByLabelText("Bunpro answer")).toBe(input);
  expect(input.props.editable).toBe(true);
  fireEvent.changeText(input, "いぬ");
  expect(input.props.value).toBe("ねこ");
  await act(async () => saving.resolve({}));
  expect(view.getByLabelText("Bunpro answer")).toBe(input);
});

it("advances on a correct answer when the pause setting is off", async () => {
  mockReviewSettings.disableAutoProgressOnCorrect = false;
  const view = render(<BunproReviewScreen initialQueue={[item("1"), item("2")]} initialReviewSessionId={42} />);
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "ねこ");
  fireEvent.press(view.getByLabelText("Check answer"));
  await waitFor(() => expect(view.getByText("Question 2 ")).toBeTruthy());
  expect(updateBunproReview).toHaveBeenCalledTimes(1);
});

it("uses the web semantic success color for a correct answer", () => {
  const view = render(<BunproReviewScreen initialQueue={[item("1")]} initialReviewSessionId={42} />);
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "ねこ");
  fireEvent.press(view.getByLabelText("Check answer"));
  expect(StyleSheet.flatten(view.getByTestId("bunpro-answer-row").props.style)).toMatchObject({ borderColor: "#017b37", backgroundColor: "#dcf2df" });
  expect(StyleSheet.flatten(view.getByLabelText("Bunpro answer").props.style).color).toBe("#000");
});


it("preserves the next draft while retrying a failed background save", async () => {
  mockReviewSettings.disableAutoProgressOnCorrect = false;
  const saving = deferred<Record<string, unknown>>();
  jest.mocked(updateBunproReview).mockReturnValueOnce(saving.promise);
  const view = render(<BunproReviewScreen initialQueue={[item("1"), item("2")]} initialReviewSessionId={42} />);
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "ねこ");
  fireEvent.press(view.getByLabelText("Check answer"));
  await waitFor(() => expect(view.getByText("Question 2 ")).toBeTruthy());
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "い");
  await act(async () => saving.reject(new Error("Offline")));
  expect(view.getByLabelText("Retry previous save")).toBeTruthy();
  expect(view.getByLabelText("Bunpro answer").props.value).toBe("い");
  expect(updateBunproReview).toHaveBeenCalledTimes(1);
  fireEvent.press(view.getByLabelText("Retry previous save"));
  await waitFor(() => expect(view.queryByLabelText("Retry previous save")).toBeNull());
  expect(updateBunproReview).toHaveBeenLastCalledWith(expect.objectContaining({ reviewId: "1" }));
  await waitFor(() => expect(view.getByText("Question 2 ")).toBeTruthy());
  expect(view.getByLabelText("Bunpro answer").props.value).toBe("い");
});


it("advances a wrong answer when its pause setting is off and retains it for retry", async () => {
  mockReviewSettings.disableAutoProgressOnWrong = false;
  const view = render(<BunproReviewScreen initialQueue={[item("1"), item("2")]} initialReviewSessionId={42} />);
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "いぬ");
  fireEvent.press(view.getByLabelText("Check answer"));
  await waitFor(() => expect(view.getByText("Question 2 ")).toBeTruthy());
  expect(updateBunproReview).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({ correct: false }) }));
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "ねこ");
  fireEvent.press(view.getByLabelText("Check answer"));
  fireEvent.press(view.getByLabelText("Next question"));
  await waitFor(() => expect(view.getByText("Question 1 ")).toBeTruthy());
});

it("shows and accepts the next answer before a slow Bunpro save finishes", async () => {
  mockReviewSettings.disableAutoProgressOnCorrect = false;
  const saving = deferred<Record<string, unknown>>();
  jest.mocked(updateBunproReview).mockReturnValueOnce(saving.promise);
  const view = render(<BunproReviewScreen initialQueue={[item("1"), item("2"), item("3")]} initialReviewSessionId={42} />);
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "ねこ");
  fireEvent.press(view.getByLabelText("Check answer"));
  await waitFor(() => expect(view.getByText("Question 2 ")).toBeTruthy());
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "ねこ");
  fireEvent.press(view.getByLabelText("Check answer"));
  await waitFor(() => expect(view.getByText("Question 3 ")).toBeTruthy());
  expect(updateBunproReview).toHaveBeenCalledTimes(1);
  await act(async () => saving.resolve({}));
  await waitFor(() => expect(updateBunproReview).toHaveBeenCalledTimes(2));
});

it("retains the native Bunpro input while handing focus to another mixed provider", () => {
  const queue = [item("1"), item("2")];
  const mixed = bridge();
  const view = render(<BunproReviewScreen initialQueue={queue} initialReviewSessionId={42} mixed={mixed} />);
  const input = view.getByLabelText("Bunpro answer");
  view.rerender(<BunproReviewScreen initialQueue={queue} initialReviewSessionId={42} mixed={{ ...mixed, active: false }} />);
  expect(view.getByLabelText("Bunpro answer", { includeHiddenElements: true })).toBe(input);
  expect(input.props.editable).toBe(true);
});

it("waits for earlier background saves before saving the last answer and showing results", async () => {
  mockReviewSettings.disableAutoProgressOnCorrect = false;
  const saving = deferred<Record<string, unknown>>();
  jest.mocked(updateBunproReview).mockReturnValueOnce(saving.promise);
  const mixed = { ...bridge(), reportSaving: jest.fn(), onSaveSettled: jest.fn() };
  const view = render(<BunproReviewScreen initialQueue={[item("1"), item("2")]} initialReviewSessionId={42} mixed={mixed} />);
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "ねこ");
  fireEvent.press(view.getByLabelText("Check answer"));
  await waitFor(() => expect(mixed.onAnswer).toHaveBeenCalledWith(expect.objectContaining({ saveStatus: "pending" })));
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "ねこ");
  fireEvent.press(view.getByLabelText("Check answer"));
  expect(updateBunproReview).toHaveBeenCalledTimes(1);
  expect(mixed.report).not.toHaveBeenLastCalledWith(null);
  expect(mixed.reportSaving).toHaveBeenLastCalledWith(true);
  await act(async () => saving.resolve({}));
  await waitFor(() => expect(updateBunproReview).toHaveBeenCalledTimes(2));
  expect(mixed.onSaveSettled).toHaveBeenCalledWith(expect.objectContaining({ saveStatus: "saved" }));
  expect(mixed.report).toHaveBeenLastCalledWith(null);
  expect(mixed.reportSaving).toHaveBeenLastCalledWith(false);
});


it("hands the last Bunpro turn to another provider while its save is still pending", async () => {
  mockReviewSettings.disableAutoProgressOnCorrect = false;
  const saving = deferred<Record<string, unknown>>();
  jest.mocked(updateBunproReview).mockReturnValueOnce(saving.promise);
  const mixed = bridge();
  const view = render(<BunproReviewScreen initialQueue={[item("1")]} initialReviewSessionId={42} mixed={mixed} />);
  const input = view.getByLabelText("Bunpro answer");
  fireEvent.changeText(input, "ねこ");
  fireEvent.press(view.getByLabelText("Check answer"));
  await waitFor(() => expect(mixed.onAnswer).toHaveBeenCalledWith(expect.objectContaining({ saveStatus: "pending" })));
  expect(mixed.report).toHaveBeenLastCalledWith({ id: expect.stringMatching(/^saving:/), ready: false });
  expect(view.getByLabelText("Bunpro answer")).toBe(input);
  await act(async () => saving.resolve({}));
  expect(mixed.report).toHaveBeenLastCalledWith(null);
});


it.each([false, true])("keeps a visible verdict for 350ms before advancing (mixed=%s)", async (isMixed) => {
  jest.useFakeTimers();
  try {
    mockReviewSettings.disableAutoProgressOnCorrect = false;
    const mixed = isMixed ? bridge() : undefined;
    const view = render(<BunproReviewScreen initialQueue={[item("1"), item("2")]} initialReviewSessionId={42} mixed={mixed} />);
    fireEvent.changeText(view.getByLabelText("Bunpro answer"), "ねこ");
    fireEvent.press(view.getByLabelText("Check answer"));
    expect(view.getByText("Correct")).toBeTruthy();
    expect(view.getByText("Question 1 ")).toBeTruthy();
    act(() => jest.advanceTimersByTime(349));
    expect(updateBunproReview).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(1));
    expect(view.getByText("Question 2 ")).toBeTruthy();
    if (mixed) expect(mixed.onAnswer).toHaveBeenCalledWith(expect.objectContaining({ correct: true }));
    else expect(view.getByLabelText("Previous Bunpro answer: Subject 1, correct")).toBeTruthy();
    view.unmount();
  } finally { jest.useRealTimers(); }
});

it("cycles the web grammar hint levels and resets them for the next question", async () => {
  const first = item("1", "ねこ", "GrammarPoint");
  Object.assign(first.included![0].attributes, { tense: "Past tense", word_prompt: "Verb prompt", extra_info: "Extra note" });
  Object.assign(first.included![1].attributes, { nuance: "日本語の説明", nuance_translation: "English nuance" });
  const view = render(<BunproReviewScreen initialQueue={[first, item("2", "ねこ", "GrammarPoint")]} initialReviewSessionId={42} />);
  expect(view.getByText("Past tense")).toBeTruthy();
  expect(view.getByText("Translation 1")).toBeTruthy();
  expect(view.queryByText("English nuance")).toBeNull();
  fireEvent.press(view.getByLabelText("Hint level 2 of 4"));
  expect(view.getByText("English nuance")).toBeTruthy();
  expect(view.getByText("Extra note")).toBeTruthy();
  expect(view.queryByText("日本語の説明")).toBeNull();
  fireEvent.press(view.getByLabelText("Hint level 3 of 4"));
  expect(view.getByText("日本語の説明")).toBeTruthy();
  fireEvent.press(view.getByLabelText("Hint level 4 of 4"));
  expect(view.queryByText("Past tense")).toBeNull();
  expect(view.queryByText("Translation 1")).toBeNull();
  fireEvent.press(view.getByLabelText("Hint level 0 of 4"));
  expect(view.getByText("Translation 1")).toBeTruthy();
  expect(view.queryByText("Past tense")).toBeNull();
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "ねこ");
  fireEvent.press(view.getByLabelText("Check answer"));
  expect(view.getByText("Past tense")).toBeTruthy();
  fireEvent.press(view.getByLabelText("Next question"));
  await waitFor(() => expect(view.getByText("Question 2 ")).toBeTruthy());
  expect(view.getByLabelText("Hint level 2 of 4")).toBeTruthy();
});

it("supports correcting a missed answer and skipping without saving", async () => {
  mockReviewSettings.allowSkippingReviews = true;
  const view = render(<BunproReviewScreen initialQueue={[item("1"), item("2")]} initialReviewSessionId={42} />);
  fireEvent.press(view.getByLabelText("Skip Bunpro question"));
  expect(view.getByText("Question 2 ")).toBeTruthy();
  expect(updateBunproReview).not.toHaveBeenCalled();
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "wrong");
  fireEvent.press(view.getByLabelText("Check answer"));
  expect(view.getByText("Incorrect")).toBeTruthy();
  fireEvent.press(view.getByLabelText("Mark correct"));
  await waitFor(() => expect(view.getByText("Question 1 ")).toBeTruthy());
  expect(updateBunproReview).toHaveBeenCalledWith(expect.objectContaining({ reviewId: "2", payload: expect.objectContaining({ correct: true }) }));
});

it("autoplays the selected voice and waits for playback before the verdict dwell", async () => {
  jest.useFakeTimers();
  try {
    mockReviewSettings.autoplayVocabularyAudio = true;
    mockReviewSettings.vocabularyAudioVoice = "male";
    mockReviewSettings.disableAutoProgressOnCorrect = false;
    const clip = { unloadAsync: jest.fn(async () => {}), playAsync: jest.fn(async () => {}), setOnPlaybackStatusUpdate: jest.fn() };
    jest.mocked(Audio.Sound.createAsync).mockResolvedValue({ sound: clip } as any);
    const first = item("1");
    Object.assign(first.included![0].attributes, { female_audio_url: "https://example.com/female.mp3", male_audio_url: "https://example.com/male.mp3" });
    const view = render(<BunproReviewScreen initialQueue={[first, item("2")]} initialReviewSessionId={42} />);
    fireEvent.changeText(view.getByLabelText("Bunpro answer"), "ねこ");
    await act(async () => fireEvent.press(view.getByLabelText("Check answer")));
    expect(Audio.Sound.createAsync).toHaveBeenCalledWith({ uri: "https://example.com/male.mp3" }, { shouldPlay: false });
    act(() => jest.advanceTimersByTime(1000));
    expect(view.getByText("Question 1 ")).toBeTruthy();
    await act(async () => clip.setOnPlaybackStatusUpdate.mock.calls[0][0]({ isLoaded: true, didJustFinish: true }));
    await act(async () => jest.advanceTimersByTime(350));
    expect(view.getByText("Question 2 ")).toBeTruthy();
    view.unmount();
  } finally { jest.useRealTimers(); }
});

it("replays the saved result's preferred voice and stops on demand", async () => {
  mockReviewSettings.vocabularyAudioVoice = "male";
  const clip = { unloadAsync: jest.fn(async () => {}), playAsync: jest.fn(async () => {}), setOnPlaybackStatusUpdate: jest.fn() };
  jest.mocked(Audio.Sound.createAsync).mockResolvedValue({ sound: clip } as any);
  const question = item("1");
  Object.assign(question.included![0].attributes, { female_audio_url: "https://example.com/female.mp3", male_audio_url: "https://example.com/male.mp3" });
  const view = render(<BunproReviewScreen initialQueue={[question]} initialReviewSessionId={42} />);
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "ねこ");
  fireEvent.press(view.getByLabelText("Check answer"));
  fireEvent.press(view.getByLabelText("Next question"));
  await waitFor(() => expect(view.getByText("Bunpro Results")).toBeTruthy());
  await act(async () => fireEvent.press(view.getByLabelText(/^Replay audio for/)));
  expect(Audio.Sound.createAsync).toHaveBeenCalledWith({ uri: "https://example.com/male.mp3" }, { shouldPlay: false });
  expect(clip.playAsync).toHaveBeenCalledTimes(1);
  await act(async () => fireEvent.press(view.getByLabelText(/^Stop audio for/)));
  expect(clip.unloadAsync).toHaveBeenCalledTimes(1);
  expect(view.getByLabelText(/^Replay audio for/)).toBeTruthy();
  view.unmount();
});


it("reveals and self-grades Bunpro in Anki mode, resetting the next card", async () => {
  mockReviewSettings.ankiCardMode = true;
  const view = render(<BunproReviewScreen initialQueue={[item("1"), item("2")]} initialReviewSessionId={42} />);
  expect(view.queryByLabelText("Bunpro answer")).toBeNull();
  expect(view.queryByLabelText("Mark Bunpro correct")).toBeNull();
  fireEvent.press(view.getByLabelText("Reveal Bunpro answer"));
  expect(updateBunproReview).not.toHaveBeenCalled();
  fireEvent.press(view.getByLabelText("Mark Bunpro correct"));
  await waitFor(() => expect(view.getByText("Question 2 ")).toBeTruthy());
  expect(updateBunproReview).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({ correct: true }) }));
  expect(view.getByLabelText("Reveal Bunpro answer")).toBeTruthy();
  expect(view.queryByLabelText("Mark Bunpro correct")).toBeNull();
});

it("keeps typed reading questions when Anki is restricted to meanings", () => {
  mockReviewSettings.ankiCardMode = true;
  mockReviewSettings.ankiCardModeScope = "meaning";
  const view = render(<BunproReviewScreen initialQueue={[item("1")]} initialReviewSessionId={42} />);
  expect(view.getByLabelText("Bunpro answer")).toBeTruthy();
  expect(view.queryByLabelText("Reveal Bunpro answer")).toBeNull();
});

it("keeps a failed Anki grade available for retry without losing the verdict", async () => {
  mockReviewSettings.ankiCardMode = true;
  jest.mocked(updateBunproReview).mockRejectedValueOnce(new Error("Save failed"));
  const view = render(<BunproReviewScreen initialQueue={[item("1")]} initialReviewSessionId={42} />);
  fireEvent.press(view.getByLabelText("Reveal Bunpro answer"));
  fireEvent.press(view.getByLabelText("Mark Bunpro incorrect"));
  await waitFor(() => expect(view.getByLabelText("Retry save")).toBeTruthy());
  fireEvent.press(view.getByLabelText("Retry save"));
  await waitFor(() => expect(updateBunproReview).toHaveBeenCalledTimes(2));
  expect(jest.mocked(updateBunproReview).mock.calls[1][0].payload.correct).toBe(false);
});


it("changes the furigana setting during a review, pins individual words and resets them for the next question", async () => {
  const queue = [item("1", "です", "GrammarPoint"), item("2", "です", "GrammarPoint")];
  for (const review of queue) review.included![0].attributes.content = "私(わたし)は学生(がくせい)____。";
  const view = render(<BunproReviewScreen initialQueue={queue} initialReviewSessionId={42} />);
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "です");
  fireEvent.press(view.getByLabelText("Bunpro review settings"));
  fireEvent(await view.findByLabelText("Hide Bunpro furigana"), "valueChange", true);
  expect(mockReviewSettings.setBunproHideFurigana).toHaveBeenCalledWith(true);
  fireEvent.press(view.getByLabelText("Done with Bunpro review settings"));
  const word = view.getByLabelText("Furigana for 私");
  expect(StyleSheet.flatten(view.getByText("わたし", { includeHiddenElements: true }).props.style).opacity).toBe(0);
  fireEvent(word, "hoverIn");
  expect(StyleSheet.flatten(view.getByText("わたし", { includeHiddenElements: true }).props.style).opacity ?? 1).toBe(1);
  fireEvent.press(word);
  fireEvent(word, "hoverOut");
  expect(view.getByLabelText("Furigana for 私").props.accessibilityState.selected).toBe(true);
  expect(StyleSheet.flatten(view.getByText("わたし", { includeHiddenElements: true }).props.style).opacity ?? 1).toBe(1);
  expect(StyleSheet.flatten(view.getByText("がくせい", { includeHiddenElements: true }).props.style).opacity).toBe(0);
  expect(view.getByLabelText("Bunpro answer").props.value).toBe("です");
  expect(updateBunproReview).not.toHaveBeenCalled();
  fireEvent.press(view.getByLabelText("Check answer"));
  fireEvent.press(view.getByLabelText("Next question"));
  await waitFor(() => expect(view.getByLabelText("Bunpro review progress").props.children).toBe("2/2"));
  expect(view.getByLabelText("Furigana for 私").props.accessibilityState.selected).toBe(false);
  expect(StyleSheet.flatten(view.getByText("わたし", { includeHiddenElements: true }).props.style).opacity).toBe(0);
});

it.each(["learn", "beginner-zero"])("keeps %s misses local until the first correct submission", async context => {
  const question = item("1", "ねこ", "GrammarPoint");
  if (context === "beginner-zero") question.data.attributes.streak = 0;
  const view = render(<BunproReviewScreen initialQueue={[question]} initialReviewSessionId={42} submissionContext={context === "learn" ? "learn" : "review"} />);
  for (const answer of ["いぬ", "いぬ", "ねこ"]) {
    fireEvent.changeText(view.getByLabelText("Bunpro answer"), answer);
    fireEvent.press(view.getByLabelText("Check answer"));
    fireEvent.press(view.getByLabelText("Next question"));
    if (answer !== "ねこ") { await waitFor(() => expect(view.getByLabelText("Check answer")).toBeTruthy()); expect(updateBunproReview).not.toHaveBeenCalled(); expect(view.getByLabelText("Bunpro review progress").props.children).toBe("1/1"); }
  }
  await waitFor(() => expect(updateBunproReview).toHaveBeenCalledTimes(1));
  expect(updateBunproReview).toHaveBeenLastCalledWith(expect.objectContaining({ payload: expect.objectContaining({ correct: true }) }));
});

it("holds a failed correct wrapup for retry and preserves the original accuracy", async () => {
  const mixed = bridge();
  const view = render(<BunproReviewScreen initialQueue={[item("1")]} initialReviewSessionId={42} mixed={mixed} />);
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "いぬ"); fireEvent.press(view.getByLabelText("Check answer")); fireEvent.press(view.getByLabelText("Next question"));
  await waitFor(() => expect(view.getByLabelText("Check answer")).toBeTruthy());
  jest.mocked(updateBunproReview).mockRejectedValueOnce(new Error("Wrapup failed"));
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "ねこ"); fireEvent.press(view.getByLabelText("Check answer")); fireEvent.press(view.getByLabelText("Next question"));
  await waitFor(() => expect(view.getByLabelText("Retry save")).toBeTruthy());
  expect(view.getByLabelText("Bunpro answer").props.value).toBe("ねこ");
  fireEvent.press(view.getByLabelText("Retry save"));
  await waitFor(() => expect(mixed.report).toHaveBeenLastCalledWith(null));
  expect(updateBunproReview).toHaveBeenCalledTimes(3);
  expect(mixed.reportAccuracy).toHaveBeenLastCalledWith({ correct: 0, answered: 1 });
});

it("wrap-up retains every missed Bunpro item even beyond the requested budget", async () => {
  const queue = Array.from({ length: 8 }, (_, i) => item(String(i + 1)));
  const mixed = bridge();
  const view = render(<BunproReviewScreen initialQueue={queue} initialReviewSessionId={42} mixed={mixed} />);
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "いぬ"); fireEvent.press(view.getByLabelText("Check answer")); fireEvent.press(view.getByLabelText("Next question"));
  await waitFor(() => expect(view.getByLabelText("Check answer")).toBeTruthy());
  view.rerender(<BunproReviewScreen initialQueue={queue} initialReviewSessionId={42} mixed={{ ...mixed, wrapUpRequest: { id: 1, limit: 1 } }} />);
  const head = jest.mocked(mixed.report).mock.calls.at(-1)?.[0];
  expect(head?.pending?.some(question => question.id === "1" && question.open)).toBe(true);
});

it("preserves typed drafts when the mixed scheduler promotes and restores pending questions", () => {
  const mixed = bridge();
  const view = render(<BunproReviewScreen initialQueue={[item("1"), item("2")]} initialReviewSessionId={42} mixed={mixed} />);
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "ね");
  act(() => jest.mocked(mixed.report).mock.calls.at(-1)?.[0]?.activate?.("2"));
  expect(view.getByText("Question 2 ")).toBeTruthy();
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "い");
  act(() => jest.mocked(mixed.report).mock.calls.at(-1)?.[0]?.activate?.("1"));
  expect(view.getByText("Question 1 ")).toBeTruthy();
  expect(view.getByLabelText("Bunpro answer").props.value).toBe("ね");
  expect(updateBunproReview).not.toHaveBeenCalled();
});

it("fills every Bunpro cloze blank and reveals the expected answer with the verdict", () => {
  const question = item("1", "です", "GrammarPoint");
  question.included![0].attributes.content = "First ____ and second ____ end.";
  const view = render(<BunproReviewScreen initialQueue={[question]} initialReviewSessionId={42} />);
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "違う"); fireEvent.press(view.getByLabelText("Check answer"));
  expect(view.getAllByText("です")).toHaveLength(2);
  expect(view.getByText("The answer is です.")).toBeTruthy();
  fireEvent.press(view.getByText("Alternatives"));
  expect(view.getByText("Accepted answers")).toBeTruthy();
});

it("refuses to grade a question whose accepted answer exists but sentence is missing", () => {
  const question = item("1"); question.included![0].attributes.content = "";
  const view = render(<BunproReviewScreen initialQueue={[question]} initialReviewSessionId={42} />);
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "ねこ"); fireEvent.press(view.getByLabelText("Check answer"));
  expect(view.getByText(/did not provide a complete question/)).toBeTruthy();
  expect(updateBunproReview).not.toHaveBeenCalled();
});

it("shows Bunpro close-answer feedback for English translation answers without grading them", () => {
  const question = item("1", "a cat"); question.included![0].attributes.alternate_answers = { cat: "Include the article." };
  const view = render(<BunproReviewScreen initialQueue={[question]} initialReviewSessionId={42} />);
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "cat"); fireEvent.press(view.getByLabelText("Check answer"));
  expect(view.getByText("Include the article.")).toBeTruthy();
  expect(view.queryByText("Incorrect")).toBeNull();
  expect(updateBunproReview).not.toHaveBeenCalled();
});
