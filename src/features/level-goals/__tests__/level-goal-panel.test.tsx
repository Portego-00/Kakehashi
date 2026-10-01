import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react-native";
import { LevelGoalPanel } from "../level-goal-panel";
import { createLevelGoal, EMPTY_GOAL_STATE, goalStorageKey } from "../model";
const mockData = new Map<string, string>();
const mockAuth = { userData: { id: 101, username: "Portego", level: 7 } };
const mockPush = jest.fn();
jest.mock("../../../utils/theme", () => ({
  useTheme: () => ({
    theme: {
      primary: "#1764a1",
      textColor: "#111",
      textSecondary: "#555",
      cardBackground: "#fff",
      border: "#ddd",
      backgroundColor: "#fff",
      error: "#b00",
    },
  }),
}));
jest.mock("../../../utils/haptics", () => ({
  selectionAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  NotificationFeedbackType: { Success: "success" },
}));
jest.mock("@react-navigation/native", () => ({ useIsFocused: () => true }));
jest.mock("react-native-reanimated", () => {
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    __esModule: true,
    default: { View },
    useReducedMotion: () => true,
    useSharedValue: (value: number) => React.useRef({ value }).current,
    useAnimatedStyle: (factory: () => unknown) => factory(),
    withTiming: (value: number) => value,
  };
});
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-router", () => ({ router: { push: mockPush } }));
jest.mock("../../../utils/permanentStorage", () => ({
  permanentStorage: {
    getString: (key: string) => mockData.get(key),
    set: (key: string, value: string) => mockData.set(key, value),
  },
}));
jest.mock("../../../utils/store", () => ({
  useAuthStore: (selector: (s: typeof mockAuth) => unknown) =>
    selector(mockAuth),
}));
beforeEach(() => {
  jest.useFakeTimers();
  mockAuth.userData.id++;
  mockAuth.userData.username = "Portego";
  mockPush.mockClear();
});
afterEach(() => {
  cleanup();
  jest.useRealTimers();
});
it("dismisses the Level widget and restores it in Level", () => {
  const screen = render(<LevelGoalPanel currentLevel={7} progressions={[]} />);
  fireEvent.press(screen.getByLabelText("Hide goal widget"));
  expect(screen.queryByText("Level goal")).toBeNull();
  expect(mockData.get(goalStorageKey(String(mockAuth.userData.id)))).toContain(
    '"widgetHidden":true',
  );
  fireEvent.press(screen.getByText("Show level goal"));
  expect(screen.getByLabelText("Hide goal widget")).toBeTruthy();
});

it("tracks a verified level arrival and keeps the completed goal", async () => {
  const now = new Date();
  const created = new Date(now.getTime() - 86400000);
  const goal = createLevelGoal(
    { id: "native-goal", mode: "level", currentLevel: 7, targetLevel: 8 },
    created,
  );
  mockData.set(
    goalStorageKey(String(mockAuth.userData.id)),
    JSON.stringify({ ...EMPTY_GOAL_STATE, active: goal }),
  );
  const screen = render(
    <LevelGoalPanel
      currentLevel={8}
      progressions={[{ data: { level: 8, unlocked_at: now.toISOString() } }]}
    />,
  );
  act(() => {
    jest.advanceTimersByTime(0);
  });
  await waitFor(() => expect(screen.getByText("Goal reached")).toBeTruthy());
  expect(screen.getByRole("progressbar").props.accessibilityValue.now).toBe(8);
  expect(
    JSON.parse(mockData.get(goalStorageKey(String(mockAuth.userData.id)))!)
      .active.reachedAt,
  ).toBe(now.toISOString());
});
it("does not render or allow a goal action for other accounts", () => {
  mockAuth.userData.username = "SomeoneElse";
  const screen = render(<LevelGoalPanel currentLevel={7} progressions={[]} />);
  expect(screen.queryByText("Level goal")).toBeNull();
  expect(mockPush).not.toHaveBeenCalled();
});
