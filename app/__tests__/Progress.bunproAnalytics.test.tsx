import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import ProgressTab from "../(app)/(tabs)/progress";
import AnalyticsTab from "../(app)/(tabs)/analytics";

const mockAuth = { userData: { username: "Portego", level: 7 } };
const mockSettings = { customTabOrder: ["home", "progress", "news"], homeSrsBreakdownDisplayMode: "combined" };
jest.mock("../../src/utils/store", () => ({
  useAuthStore: (selector?: (state: typeof mockAuth) => unknown) => selector ? selector(mockAuth) : mockAuth,
  useSettingsStore: (selector?: (state: typeof mockSettings) => unknown) => selector ? selector(mockSettings) : mockSettings,
}));
jest.mock("../../src/utils/theme", () => ({ useTheme: () => ({ theme: { primary: "#a00", textColor: "#111", textSecondary: "#555", border: "#ddd", cardBackground: "#fff" } }) }));
jest.mock("../../src/utils/subjectColors", () => ({ useSubjectColors: () => ({ radical: "red", kanji: "green", vocabulary: "blue" }), withAlpha: (color: string) => color }));
jest.mock("../../src/utils/cache", () => ({ getAllSubjects: async () => [] }));
jest.mock("../../src/utils/nativeTabs", () => ({ supportsNativeTabs: () => false }));
jest.mock("../../src/hooks/useDashboardData", () => ({ useDashboardData: () => ({ dashboardData: { currentLevel: 7, levelTimeRemaining: { timeText: "Tomorrow" }, subjects: [], assignments: [] }, isLoading: false, refreshData: jest.fn() }) }));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  default: { View: jest.requireActual("react-native").View },
  useSharedValue: (value: number) => jest.requireActual("react").useRef({ value }).current,
  useAnimatedStyle: (callback: () => object) => callback(),
  withSpring: (value: number) => value,
  withTiming: (value: number, _options?: unknown, callback?: (finished: boolean) => void) => { callback?.(true); return value; },
  runOnJS: (callback: unknown) => callback,
}));
jest.mock("@react-native-segmented-control/segmented-control", () => {
  const React = jest.requireActual("react");
  const { Pressable, Text, View } = jest.requireActual("react-native");
  return function MockSegmentedControl({ values, onChange }: { values: string[]; onChange: (event: unknown) => void }) { return React.createElement(View, {}, values.map((value, index) => React.createElement(Pressable, { key: value, onPress: () => onChange({ nativeEvent: { selectedSegmentIndex: index } }) }, React.createElement(Text, {}, value)))); };
});
jest.mock("../../src/components/GlassButton", () => ({ GlassButton: () => null }));
jest.mock("../../src/components/IncompleteLevelsProgress", () => () => null);
jest.mock("../../src/components/LevelProgress", () => () => null);
jest.mock("../../src/components/LevelTimingChart", () => () => null);
jest.mock("../../src/components/LoadingProgressBar", () => () => null);
jest.mock("../../src/components/ReviewStatsTable", () => () => null);
jest.mock("../../src/components/SrsBreakdown", () => () => null);
jest.mock("../../src/components/StudyTimeCard", () => () => null);
jest.mock("../../src/components/UnlocksAndCritical", () => ({ BurnedItems: () => null, CriticalItems: () => null, RecentUnlocks: () => null }));
jest.mock("../../src/components/ReviewHeatmap", () => {
  const React = jest.requireActual("react");
  return function MockReviewHeatmap() { return React.createElement(jest.requireActual("react-native").Text, {}, "WaniKani review heatmap"); };
});
jest.mock("../../src/components/bunpro/BunproAnalytics", () => {
  const React = jest.requireActual("react");
  return function MockBunproAnalytics() { return React.createElement(jest.requireActual("react-native").Text, {}, "Bunpro analytics dashboard"); };
});

beforeEach(() => { mockAuth.userData.username = "Portego"; mockSettings.customTabOrder = ["home", "progress", "news"]; });

it("exposes Bunpro in the default Level > Analytics navigation and restores WaniKani", async () => {
  const screen = render(<ProgressTab />);
  await act(async () => {});
  expect(screen.queryByText("Bunpro")).toBeNull();
  fireEvent.press(screen.getByText("Analytics"));
  expect(screen.getByText("WaniKani review heatmap")).toBeTruthy();
  fireEvent.press(screen.getByText("Bunpro"));
  expect(screen.getByText("Bunpro analytics dashboard")).toBeTruthy();
  expect(screen.queryByText("WaniKani review heatmap")).toBeNull();
  fireEvent.press(screen.getByText("WaniKani"));
  expect(screen.getByText("WaniKani review heatmap")).toBeTruthy();
});

it("keeps the default analytics segment unchanged for accounts outside the rollout", async () => {
  mockAuth.userData.username = "SomeoneElse";
  const screen = render(<ProgressTab />);
  await act(async () => {});
  fireEvent.press(screen.getByText("Analytics"));
  expect(screen.queryByText("Bunpro")).toBeNull();
  expect(screen.queryByText("Bunpro analytics dashboard")).toBeNull();
  expect(screen.getByText("WaniKani review heatmap")).toBeTruthy();
});

it("removes Bunpro analytics immediately when the signed-in account changes", async () => {
  const screen = render(<ProgressTab />);
  await act(async () => {});
  fireEvent.press(screen.getByText("Analytics"));
  fireEvent.press(screen.getByText("Bunpro"));
  mockAuth.userData.username = "SomeoneElse";
  screen.rerender(<ProgressTab />);
  expect(screen.queryByText("Bunpro analytics dashboard")).toBeNull();
  expect(screen.getByText("WaniKani review heatmap")).toBeTruthy();
});

it.each(["SomeoneElse", ""])("keeps standalone analytics available without Bunpro access for %s", async (username) => {
  mockAuth.userData.username = username;
  const screen = render(<AnalyticsTab />);
  await act(async () => {});
  expect(screen.queryByText("Bunpro")).toBeNull();
  expect(screen.queryByText("Bunpro analytics dashboard")).toBeNull();
  expect(screen.getByText("WaniKani review heatmap")).toBeTruthy();
  expect(screen.getByText("SRS Breakdown")).toBeTruthy();
  expect(screen.getByText("Open Kanji Grid Heatmap")).toBeTruthy();
  fireEvent.press(screen.getByText("Jōyō"));
  expect(screen.getByText("WaniKani review heatmap")).toBeTruthy();
});

it("restores standalone WaniKani analytics when switching away from Portego", async () => {
  const screen = render(<AnalyticsTab />);
  await act(async () => {});
  fireEvent.press(screen.getByText("Bunpro"));
  expect(screen.getByText("Bunpro analytics dashboard")).toBeTruthy();
  mockAuth.userData.username = "SomeoneElse";
  screen.rerender(<AnalyticsTab />);
  await act(async () => {});
  expect(screen.queryByText("Bunpro")).toBeNull();
  expect(screen.queryByText("Bunpro analytics dashboard")).toBeNull();
  expect(screen.getByText("WaniKani review heatmap")).toBeTruthy();
});
