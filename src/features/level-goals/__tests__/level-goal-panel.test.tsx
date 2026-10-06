import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react-native";
import { Modal } from "react-native";
import { router } from "expo-router";
import { LevelGoalPanel } from "../level-goal-panel";
import { createLevelGoal, EMPTY_GOAL_STATE, goalStorageKey } from "../model";
const mockData = new Map<string, string>();
const mockAuth = { userData: { id: 101, username: "Portego", level: 7 } };
const mockPush = jest.mocked(router.push);
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
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
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
  expect(screen.queryByText(/Past.*goals/)).toBeNull();
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
  expect(screen.queryByLabelText("Hide goal widget")).toBeNull();
  expect(screen.getByText("Edit goal")).toBeTruthy();
  expect(screen.getByRole("progressbar").props.accessibilityValue.now).toBe(8);
  expect(
    JSON.parse(mockData.get(goalStorageKey(String(mockAuth.userData.id)))!)
      .active.reachedAt,
  ).toBe(now.toISOString());
});

it("removes a saved goal only through editing, keeps history, and supports cancellation", () => {
  const key = goalStorageKey(String(mockAuth.userData.id));
  const goal = createLevelGoal({
    id: "remove",
    mode: "level",
    currentLevel: 7,
    targetLevel: 10,
  });
  mockData.set(key, JSON.stringify({ ...EMPTY_GOAL_STATE, active: goal }));
  const screen = render(<LevelGoalPanel currentLevel={7} progressions={[]} />);
  expect(screen.queryByLabelText("Hide goal widget")).toBeNull();
  expect(screen.queryByLabelText("Remove goal")).toBeNull();
  fireEvent.press(screen.getByText("Edit goal"));
  fireEvent.press(screen.getByLabelText("Remove goal"));
  fireEvent.press(screen.getByLabelText("Keep goal"));
  expect(JSON.parse(mockData.get(key)!).active.id).toBe("remove");
  fireEvent.press(screen.getByLabelText("Remove goal"));
  fireEvent.press(screen.getByLabelText("Remove goal"));
  const saved = JSON.parse(mockData.get(key)!);
  expect(saved.active).toBeNull();
  expect(saved.widgetHidden).toBe(true);
  expect(saved.history[0].goal.id).toBe("remove");
  expect(saved.history[0].outcome).toBe("ended");
  expect(screen.UNSAFE_queryByType(Modal)).toBeNull();
  fireEvent.press(screen.getByText("Show level goal"));
  expect(screen.getByLabelText("Hide goal widget")).toBeTruthy();
});

it("does not display archived goals or a removal action in the tracker", () => {
  const key = goalStorageKey(String(mockAuth.userData.id));
  const goal = createLevelGoal({
    id: "current",
    mode: "level",
    currentLevel: 7,
    targetLevel: 10,
  });
  mockData.set(
    key,
    JSON.stringify({
      ...EMPTY_GOAL_STATE,
      active: goal,
      history: [
        {
          goal: { ...goal, id: "previous" },
          outcome: "ended",
          archivedAt: new Date().toISOString(),
        },
      ],
    }),
  );
  const screen = render(<LevelGoalPanel currentLevel={7} progressions={[]} />);
  expect(screen.queryByText(/Past.*goals/)).toBeNull();
  fireEvent.press(screen.getByText("Track journey"));
  expect(screen.queryByText("End this goal")).toBeNull();
});

it("keeps the goal and editor when removal cannot be saved", () => {
  const key = goalStorageKey(String(mockAuth.userData.id));
  const goal = createLevelGoal({
    id: "retain",
    mode: "level",
    currentLevel: 7,
    targetLevel: 10,
  });
  mockData.set(key, JSON.stringify({ ...EMPTY_GOAL_STATE, active: goal }));
  const screen = render(<LevelGoalPanel currentLevel={7} progressions={[]} />);
  fireEvent.press(screen.getByText("Edit goal"));
  fireEvent.press(screen.getByLabelText("Remove goal"));
  const write = jest.spyOn(mockData, "set").mockImplementationOnce(() => {
    throw new Error("full");
  });
  fireEvent.press(screen.getByLabelText("Remove goal"));
  write.mockRestore();
  expect(JSON.parse(mockData.get(key)!).active.id).toBe("retain");
  expect(screen.UNSAFE_getByType(Modal)).toBeTruthy();
  expect(
    screen.getByText("Your goal could not be removed. Please try again."),
  ).toBeTruthy();
});
it("offers goal setup to other accounts", () => {
  mockAuth.userData.username = "SomeoneElse";
  const screen = render(<LevelGoalPanel currentLevel={7} progressions={[]} />);
  expect(screen.getByText("Level goal")).toBeTruthy();
  fireEvent.press(screen.getByText("Set a goal"));
  expect(screen.getByLabelText("Continue")).toBeTruthy();
  expect(mockPush).not.toHaveBeenCalled();
});

it("opens goal setup over the existing Level content without navigating away", () => {
  const screen = render(<LevelGoalPanel currentLevel={7} progressions={[]} />);
  fireEvent.press(screen.getByText("Set a goal"));
  expect(screen.UNSAFE_getByType(Modal).props.transparent).toBe(true);
  expect(screen.getByText("Pick your next milestone")).toBeTruthy();
  expect(mockPush).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText("Cancel"));
  expect(screen.UNSAFE_queryByType(Modal)).toBeNull();
  expect(screen.getByText("Pick your next milestone")).toBeTruthy();
});

it("saves from the overlay and cancels an edit without changing the goal", () => {
  const screen = render(<LevelGoalPanel currentLevel={7} progressions={[]} />);
  fireEvent.press(screen.getByText("Set a goal"));
  fireEvent.press(screen.getByLabelText("Continue"));
  fireEvent.press(screen.getByLabelText("Continue"));
  fireEvent.press(screen.getByLabelText("Create goal"));
  expect(screen.getByText("Level 10. Let’s get there.")).toBeTruthy();
  fireEvent.press(screen.getByLabelText("Keep going"));
  expect(screen.UNSAFE_queryByType(Modal)).toBeNull();
  const key = goalStorageKey(String(mockAuth.userData.id));
  const original = JSON.parse(mockData.get(key)!).active;
  expect(original.targetLevel).toBe(10);
  fireEvent.press(screen.getByText("Edit goal"));
  fireEvent.press(screen.getByLabelText("Continue"));
  fireEvent.press(screen.getByLabelText("Raise target level"));
  fireEvent.press(screen.getByLabelText("Back"));
  fireEvent.press(screen.getByLabelText("Cancel"));
  expect(JSON.parse(mockData.get(key)!).active).toEqual(original);
});
