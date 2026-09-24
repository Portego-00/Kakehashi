import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type { MixedReviewBridge } from "../../types/mixedReviews";
import type { BunproReviewSavePolicy } from "../../utils/bunproReviewSavePolicy";
import { MixedReviewSession } from "../../../app/(app)/mixed-reviews";
import { Alert } from "react-native";
import { router } from "expo-router";

const mockMounts: Record<string, number> = {};
const mockBridges: Record<string, MixedReviewBridge> = {};
const mockSavePolicies: Record<string, BunproReviewSavePolicy> = {};
jest.mock("expo-router", () => ({ router: { dismissAll: jest.fn(), replace: jest.fn(), back: jest.fn() }, useFocusEffect: jest.fn(), useLocalSearchParams: () => ({}) }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: jest.requireActual("react-native").View }));
jest.mock("../../hooks/useActivityTracking", () => ({ useActivityTracking: jest.fn() }));
jest.mock("../../utils/theme", () => ({ useTheme: () => ({ theme: { backgroundColor: "white", textColor: "black", textSecondary: "gray", primary: "blue", border: "gray" } }) }));
jest.mock("../../utils/store", () => ({ useSettingsStore: (selector: (value: object) => unknown) => selector({ reviewWrapUpTargetSubjects: 10 }), useAuthStore: (selector: (value: object) => unknown) => selector({ userData: { username: "Portego" } }) }));

function MockProvider({ lane, bridge }: { lane: string; bridge: MixedReviewBridge }) {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Text, TouchableOpacity, View } = jest.requireActual<typeof import("react-native")>("react-native");
  const [index, setIndex] = React.useState(0);
  const bridgeRef = React.useRef(bridge);
  bridgeRef.current = bridge;
  mockBridges[lane] = bridge;
  React.useEffect(() => { mockMounts[lane] = (mockMounts[lane] ?? 0) + 1; }, [lane]);
  React.useEffect(() => {
    bridgeRef.current.reportProgress({ completed: index, total: 2 });
    bridgeRef.current.reportAccuracy({ correct: index, answered: index });
    bridgeRef.current.report(index < 2 ? { id: `${lane}:${index}` } : null);
  }, [index, lane]);
  if (!bridge.active) return null;
  return <View><Text>{lane} question {index + 1}</Text><TouchableOpacity testID={`answer-${lane}`} onPress={() => {
    bridge.onAnswer({ id: `${lane}:${index}`, source: lane === "wanikani" ? "wanikani" : "bunpro", title: `${lane} ${index}`, correct: true });
    setIndex((value) => value + 1);
  }}><Text>Answer</Text></TouchableOpacity></View>;
}
jest.mock("../../../app/(app)/reviews", () => ({ __esModule: true, default: ({ mixed }: { mixed: MixedReviewBridge }) => <MockProvider lane="wanikani" bridge={mixed} /> }));
jest.mock("../BunproReviewScreen", () => ({ __esModule: true, default: ({ mixed, initialMode, savePolicy }: { mixed: MixedReviewBridge; initialMode: string; savePolicy: BunproReviewSavePolicy }) => {
  mockSavePolicies[initialMode] = savePolicy;
  return <MockProvider lane={initialMode} bridge={mixed} />;
} }));

describe("mounted mixed review providers", () => {
  beforeEach(() => {
    Object.keys(mockMounts).forEach((key) => delete mockMounts[key]);
    Object.keys(mockBridges).forEach((key) => delete mockBridges[key]);
    Object.keys(mockSavePolicies).forEach((key) => delete mockSavePolicies[key]);
    jest.spyOn(Math, "random").mockReturnValue(0);
  });
  afterEach(() => jest.restoreAllMocks());

  it("switches questions without remounting a provider or losing progress, then combines results", async () => {
    const screen = render(<MixedReviewSession mode="grammar" />);
    await waitFor(() => expect(screen.getByText("wanikani question 1")).toBeTruthy());
    fireEvent.press(screen.getByTestId("answer-wanikani"));
    await waitFor(() => expect(screen.getByText("grammar question 1")).toBeTruthy());
    expect(screen.queryByText("wanikani question 2")).toBeNull();
    expect(mockBridges.grammar.previous?.title).toBe("wanikani 0");
    fireEvent.press(screen.getByTestId("answer-grammar"));
    await waitFor(() => expect(screen.getByText("wanikani question 2")).toBeTruthy());
    expect(mockBridges.wanikani.progress).toEqual({ completed: 2, total: 4 });
    fireEvent.press(screen.getByTestId("answer-wanikani"));
    await waitFor(() => expect(screen.getByText("grammar question 2")).toBeTruthy());
    fireEvent.press(screen.getByTestId("answer-grammar"));
    await waitFor(() => expect(screen.getByText("Mixed reviews complete")).toBeTruthy());
    expect(screen.getByText("4 completed · 100% accuracy")).toBeTruthy();
    fireEvent.press(screen.getByText("Missed (0)"));
    expect(screen.getByText("No missed items.")).toBeTruthy();
    fireEvent.press(screen.getByText("Correct (4)"));
    expect(screen.getByText("wanikani 0")).toBeTruthy();
    expect(screen.getByText("grammar 1")).toBeTruthy();
    expect(mockMounts).toEqual({ wanikani: 1, grammar: 1 });
  });

  it("shows a failed lane instead of allowing the other provider to finish over the error", async () => {
    const screen = render(<MixedReviewSession mode="vocab" />);
    await waitFor(() => expect(screen.getByText("wanikani question 1")).toBeTruthy());
    act(() => mockBridges.vocab.reportError("Submission failed"));
    await waitFor(() => expect(mockBridges.vocab.active).toBe(true));
    act(() => mockBridges.wanikani.report(null));
    expect(screen.queryByText("Mixed reviews complete")).toBeNull();
    act(() => { mockBridges.vocab.reportError(null); mockBridges.vocab.report({ id: "vocab:0" }); });
    expect(mockBridges.vocab.active).toBe(true);
    expect(mockMounts).toEqual({ wanikani: 1, vocab: 1 });
  });

  it("waits for a provider save before leaving or trimming the shared queue", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    render(<MixedReviewSession mode="grammar" />);
    await waitFor(() => expect(mockBridges.wanikani.active).toBe(true));
    act(() => mockBridges.wanikani.reportSaving?.(true));
    act(() => mockBridges.wanikani.onExit());
    expect(alert).toHaveBeenCalledWith("Saving answer", expect.any(String));
    expect(router.replace).not.toHaveBeenCalled();
    act(() => mockBridges.wanikani.onWrapUp());
    expect(mockBridges.grammar.wrapUpRequest).toBeUndefined();
    act(() => mockBridges.wanikani.reportSaving?.(false));
    act(() => mockBridges.wanikani.onWrapUp());
    expect(mockBridges.grammar.wrapUpRequest).toEqual({ id: 1, limit: 2 });
  });

  it("counts Bunpro failures across grammar and vocabulary and resets after a confirmed save", async () => {
    render(<MixedReviewSession mode="all" />);
    await waitFor(() => expect(mockBridges.wanikani.active).toBe(true));
    const failure = new Error("Bunpro request failed (500).");
    expect(mockSavePolicies.grammar.failed(failure).pause).toBe(false);
    expect(mockSavePolicies.vocab.failed(failure).pause).toBe(false);
    expect(mockSavePolicies.grammar.failed(failure).pause).toBe(true);
    mockSavePolicies.vocab.succeeded();
    expect(mockSavePolicies.grammar.failed(failure).pause).toBe(false);
  });

  it("keeps an unconfirmed ghost answer separate and warns in the combined results", async () => {
    const screen = render(<MixedReviewSession mode="grammar" />);
    await waitFor(() => expect(mockBridges.wanikani.active).toBe(true));
    act(() => {
      mockBridges.grammar.onAnswer({ id: "bunpro:10", source: "bunpro", title: "Normal review", correct: true, saveStatus: "saved" });
      mockBridges.grammar.onAnswer({ id: "bunpro:ghost_review:10", source: "bunpro", title: "Ghost review", correct: false, saveStatus: "unconfirmed" });
      mockBridges.grammar.onAnswer({ id: "bunpro:ghost_review:10", source: "bunpro", title: "Ghost review", correct: true, saveStatus: "unconfirmed" });
      mockBridges.grammar.report(null);
      mockBridges.wanikani.report(null);
    });
    await waitFor(() => expect(screen.getByText("Mixed reviews complete")).toBeTruthy());
    expect(screen.getByText("1 Bunpro answer has an unconfirmed save and may still be due in Bunpro.")).toBeTruthy();
    expect(screen.getByText("Save unconfirmed")).toBeTruthy();
    expect(screen.getByText("Normal review")).toBeTruthy();
    fireEvent.press(screen.getByText("Missed (1)"));
    expect(screen.getByText("Ghost review")).toBeTruthy();
    expect(screen.queryByText("Normal review")).toBeNull();
  });
});
