import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { FlatList } from "react-native";

import SubjectSearchScreen from "../SubjectSearchScreen";

const mockRouter = { push: jest.fn() };
const mockDashboardData = { assignments: [] };
const mockSubjects = [
  ...Array.from({ length: 220 }, (_, index) => ({
    id: index + 1,
    object: "vocabulary",
    data: {
      level: 1,
      characters: "場所",
      meanings: [{ meaning: "Place", primary: true }],
      readings: [],
      parts_of_speech: ["noun"],
    },
  })),
  {
    id: 500,
    object: "vocabulary",
    data: {
      level: 10,
      characters: "日本",
      meanings: [{ meaning: "Place in Japan", primary: true }],
      readings: [],
      parts_of_speech: ["proper noun"],
    },
  },
];

jest.mock("expo-router", () => {
  const React = jest.requireActual("react");
  return {
    useRouter: () => mockRouter,
    useLocalSearchParams: () => ({}),
    useFocusEffect: (callback: () => void) => React.useEffect(callback, [callback]),
  };
});

jest.mock("../../hooks/useDashboardData", () => ({
  useDashboardData: () => ({ dashboardData: mockDashboardData }),
}));
jest.mock("../../utils/store", () => ({ useAuthStore: () => ({ apiToken: "token" }) }));
jest.mock("../../utils/cache", () => ({
  getAllSubjects: jest.fn(() => Promise.resolve(mockSubjects)),
  saveToCache: jest.fn(),
}));
jest.mock("../../utils/api", () => ({
  getAllAssignmentsCached: jest.fn(() => Promise.resolve({ data: [] })),
}));
jest.mock("../../utils/nativeTabs", () => ({ supportsNativeTabs: () => false }));
jest.mock("../../utils/fonts", () => ({ fontStyles: {} }));
jest.mock("../../utils/radicalSvg", () => ({
  pickBestImage: () => null,
  useRemoteSvg: () => null,
}));
jest.mock("expo-blur", () => {
  const { View } = jest.requireActual("react-native");
  return { BlurView: View };
});
jest.mock("@expo/vector-icons", () => {
  const React = jest.requireActual("react");
  const { Text } = jest.requireActual("react-native");
  return { Ionicons: ({ name }: { name: string }) => React.createElement(Text, null, name) };
});
jest.mock("../../components/GlassButton", () => {
  const React = jest.requireActual("react");
  const { TouchableOpacity } = jest.requireActual("react-native");
  return {
    GlassButton: ({ children, onPress }: { children: React.ReactNode; onPress: () => void }) =>
      React.createElement(TouchableOpacity, { onPress }, children),
  };
});
jest.mock("../../utils/subjectColors", () => ({
  getSubjectTypeColor: () => "#8800cc",
  useSubjectColors: () => ({ radical: "#0088cc", kanji: "#cc0088", vocabulary: "#8800cc" }),
}));
jest.mock("../../utils/theme", () => ({
  useTheme: () => ({
    theme: {
      isDark: false, primary: "#6d28d9", textColor: "#111111", textSecondary: "#666666",
      textLight: "#888888", border: "#dddddd", cardBackground: "#ffffff",
      backgroundColor: "#f5f5f5", error: "#dc2626",
    },
  }),
}));

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it("filters browsing and ranked search before result limits, and restores results when cleared", async () => {
  const screen = render(<SubjectSearchScreen />);
  await waitFor(() => expect(screen.UNSAFE_getByType(FlatList).props.data).toHaveLength(200));

  fireEvent.press(screen.getByLabelText("Search filters"));
  fireEvent.press(screen.getByLabelText("Vocab type: All"));
  fireEvent.press(screen.getByLabelText("Proper noun vocabulary type"));
  fireEvent.press(screen.getByRole("button", { name: "Apply Filters" }));

  await waitFor(() => {
    expect(screen.UNSAFE_getByType(FlatList).props.data.map((item: { id: number }) => item.id)).toEqual([500]);
  });
  expect(screen.getByLabelText("Search filters, 1 active")).toBeTruthy();

  fireEvent.changeText(screen.getByPlaceholderText("Search kanji, vocabulary, or meanings..."), "place");
  await act(async () => { jest.advanceTimersByTime(400); });
  await screen.findByText("Place in Japan");
  await waitFor(() => {
    expect(screen.UNSAFE_getByType(FlatList).props.data.map((item: { id: number }) => item.id)).toEqual([500]);
  });

  fireEvent.press(screen.getByLabelText("Search filters, 1 active"));
  const collapsedType = screen.getByLabelText("Vocab type: Proper noun");
  if (!collapsedType.props.accessibilityState.expanded) fireEvent.press(collapsedType);
  fireEvent.press(screen.getByLabelText("Clear vocabulary types"));
  fireEvent.press(screen.getByRole("button", { name: "Apply Filters" }));

  await waitFor(() => expect(screen.UNSAFE_getByType(FlatList).props.data.length).toBeGreaterThan(1));
  expect(screen.getByLabelText("Search filters")).toBeTruthy();
});
