import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import BunproReviewScreen from "../BunproReviewScreen";
import { getBunproReviewQuizIndex, updateBunproReview } from "../../utils/bunproApi";
import type { BunproReviewQueueItem } from "../../types/bunpro";
import { createBunproReviewSavePolicy } from "../../utils/bunproReviewSavePolicy";
import type { MixedReviewBridge } from "../../types/mixedReviews";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-router", () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }), useLocalSearchParams: () => ({}) }));
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));
jest.mock("../../utils/navigation-focus", () => ({ useOptionalScreenIsFocused: () => true }));
jest.mock("../../utils/store", () => ({
  useAuthStore: () => ({ userData: { username: "Portego" } }),
  useSettingsStore: (selector: (state: object) => unknown) => selector({ autoSwitchKeyboard: false }),
}));
jest.mock("../../utils/theme", () => ({ useTheme: () => ({ theme: { textColor: "#000", textSecondary: "#666", backgroundColor: "#fff", border: "#ccc", error: "#a00" }, isDark: false }) }));
jest.mock("../../utils/bunproApi", () => ({
  BunproApiError: class extends Error {},
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

beforeEach(() => { jest.clearAllMocks(); jest.mocked(updateBunproReview).mockResolvedValue({}); });

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

it("repeats a missed question with fresh state and saves its result only once", async () => {
  const mixed = bridge();
  const view = render(<BunproReviewScreen initialQueue={[item("1")]} initialReviewSessionId={42} mixed={mixed} />);
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "いぬ");
  fireEvent.press(view.getByLabelText("Check answer"));
  fireEvent.press(view.getByText("Show Answer"));
  fireEvent.press(view.getByLabelText("Next question"));
  await waitFor(() => expect(view.getByLabelText("Check answer")).toBeTruthy());
  expect(view.getByLabelText("Bunpro answer").props.value).toBe("");
  expect(view.getByText(/Retry/)).toBeTruthy();
  expect(mixed.report).toHaveBeenLastCalledWith({ id: "1:1:q1" });
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "ねこ");
  fireEvent.press(view.getByLabelText("Check answer"));
  fireEvent.press(view.getByLabelText("Next question"));
  await waitFor(() => expect(mixed.report).toHaveBeenLastCalledWith(null));
  expect(updateBunproReview).toHaveBeenCalledTimes(1);
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
    await waitFor(() => expect(mixed.report).toHaveBeenLastCalledWith(id === "1" ? { id: "1:2:q2" } : null));
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
  expect(view.getByText("Translation 1")).toBeTruthy();
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
