import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import BunproReviewableDetailsScreen from "../BunproReviewableDetailsScreen";
import { getBunproReviewableDetails } from "../../utils/bunproApi";

let mockKind = "grammar";
let mockTab: string | undefined;
let mockFocused = true;
const mockStop = jest.fn(async () => undefined);
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock("expo-router", () => ({ useRouter: () => ({ back: jest.fn() }), useLocalSearchParams: () => ({ kind: mockKind, slug: "test", tab: mockTab }) }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));
jest.mock("react-native-pager-view", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return { __esModule: true, default: React.forwardRef(function TestPager(props: any, ref: any) {
    const [page, setPage] = React.useState(props.initialPage);
    React.useImperativeHandle(ref, () => ({ setPage, setPageWithoutAnimation: setPage }));
    return React.createElement(jest.requireActual("react-native").View, null, React.Children.toArray(props.children)[page]);
  }) };
});
jest.mock("../../utils/store", () => ({ useAuthStore: () => ({ userData: { username: "Portego" } }) }));
jest.mock("../../utils/theme", () => ({ useTheme: () => ({ theme: { textColor: "black", textSecondary: "gray", headerText: "white", headerBackground: "black", backgroundColor: "white", cardBackground: "white", border: "gray" }, isDark: false }) }));
jest.mock("../../utils/bunproApi", () => ({ BunproApiError: class extends Error {}, getBunproReviewableDetails: jest.fn() }));
jest.mock("../../hooks/useBunproAudio", () => ({ useBunproAudio: () => ({ stop: mockStop, play: jest.fn(), playingKey: null, loadingKey: null, error: null }) }));
jest.mock("../../utils/navigation-focus", () => ({ useOptionalScreenIsFocused: () => mockFocused }));
jest.mock("../../components/bunpro/BunproContext", () => ({ BunproContext: ({ query }: { query: string }) => { const React = jest.requireActual("react"); return React.createElement(jest.requireActual("react-native").Text, null, `Context for ${query}`); } }));

beforeEach(() => {
  jest.clearAllMocks(); mockTab = undefined; mockFocused = true;
  jest.mocked(getBunproReviewableDetails).mockResolvedValue({ data: { id: "1", type: "grammar_point", attributes: { id: 1, slug: "test", title: "Test subject", meaning: "A test", casual_structure: "Standard structure", polite_structure: "Polite structure", nuance_translation: "A useful nuance", level: "JLPT5" } }, included: [{ id: "q1", type: "study_question", attributes: { id: 1, content: "Sentence ____.", answer: "です", translation: "Example translation" } }] });
});

it.each(["grammar", "vocab"])("restores the native %s information layout and tabs", async kind => {
  mockKind = kind;
  const view = render(<BunproReviewableDetailsScreen />);
  await waitFor(() => expect(view.getByText("Test subject")).toBeTruthy());
  expect(view.getByText("Standard structure")).toBeTruthy();
  fireEvent.press(view.getByText("Polite"));
  expect(view.getByText("Polite structure")).toBeTruthy();
  expect(view.getByText("A useful nuance")).toBeTruthy();
  fireEvent.press(view.getByText("Examples"));
  expect(view.getByText("Example translation")).toBeTruthy();
  if (kind === "vocab") { fireEvent.press(view.getByText("Context")); expect(view.getByText("Context for Test subject")).toBeTruthy(); }
  else expect(view.queryByText("Context")).toBeNull();
  fireEvent.press(view.getByText("Resources"));
  expect(view.queryByText("Standard structure")).toBeNull();
  expect(getBunproReviewableDetails).toHaveBeenCalledWith(expect.objectContaining({ kind, slug: "test" }));
});

it("opens requested vocabulary context and stops audio when leaving the details page", async () => {
  mockKind = "vocab"; mockTab = "Context";
  const view = render(<BunproReviewableDetailsScreen />);
  await waitFor(() => expect(view.getByText("Context for Test subject")).toBeTruthy());
  mockFocused = false;
  view.rerender(<BunproReviewableDetailsScreen />);
  expect(mockStop).toHaveBeenCalled();
  expect(view.queryByText("Context for Test subject")).toBeNull();
});

it("cancels a pending details request when the page is closed", async () => {
  mockKind = "grammar";
  jest.mocked(getBunproReviewableDetails).mockReturnValue(new Promise(() => {}));
  const view = render(<BunproReviewableDetailsScreen />);
  await waitFor(() => expect(getBunproReviewableDetails).toHaveBeenCalledTimes(1));
  const signal = jest.mocked(getBunproReviewableDetails).mock.calls[0][0].signal;
  view.unmount();
  expect(signal?.aborted).toBe(true);
});
