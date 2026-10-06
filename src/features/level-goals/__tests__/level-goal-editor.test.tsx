import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { Line } from "react-native-svg";
import * as Haptics from "../../../utils/haptics";
import { createLevelGoal } from "../model";
import { LevelGoalEditor } from "../level-goal-editor";
import LevelGoalRoute from "../../../../app/(app)/level-goal";
const mockAuthState = { userData: { id: 1, username: "Portego", level: 7 } };
const mockSave = jest.fn(() => true);
const mockClose = jest.fn();
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
jest.mock("react-native-reanimated", () => {
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return { __esModule: true, default: { View }, useReducedMotion: () => true };
});
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("../../../utils/store", () => ({
  useAuthStore: (selector: (s: typeof mockAuthState) => unknown) =>
    selector(mockAuthState),
}));
jest.mock("../../../hooks/useDashboardData", () => ({
  useDashboardData: () => ({
    dashboardData: { currentLevel: 7, levelProgressions: [] },
  }),
}));
jest.mock("../use-level-goals", () => ({
  useLevelGoals: () => ({
    now: new Date("2026-09-30T12:00:00"),
    state: { active: null },
    update: mockSave,
  }),
}));
jest.mock("expo-router", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Text } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    Redirect: ({ href }: { href: string }) =>
      React.createElement(Text, { testID: "redirect" }, href),
    router: { back: jest.fn() },
    Stack: { Screen: () => null },
    useLocalSearchParams: () => ({}),
  };
});
beforeEach(() => {
  jest.mocked(Haptics.selectionAsync).mockClear();
  jest.mocked(Haptics.notificationAsync).mockClear();
  mockSave.mockReset().mockReturnValue(true);
  mockClose.mockClear();
  mockAuthState.userData.username = "Portego";
});
const mount = () =>
  render(
    <LevelGoalEditor
      currentLevel={7}
      progressions={[]}
      existing={null}
      now={new Date("2026-09-30T12:00:00")}
      onSave={mockSave}
      onClose={mockClose}
    />,
  );
it.each(["A level", "A timeframe", "A date"])(
  "creates a native goal starting with %s",
  (mode) => {
    const screen = mount();
    fireEvent.press(screen.getByText(mode));
    fireEvent.press(screen.getByLabelText("Continue"));
    if (mode === "A timeframe")
      fireEvent.press(screen.getByLabelText("2 weeks"));
    fireEvent.press(screen.getByLabelText("Raise target level"));
    fireEvent.press(screen.getByLabelText("Continue"));
    fireEvent.press(screen.getByLabelText("Create goal"));
    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({
        startLevel: 7,
        targetLevel: expect.any(Number),
        mode:
          mode === "A level"
            ? "level"
            : mode === "A timeframe"
              ? "duration"
              : "date",
      }),
    );
    fireEvent.press(screen.getByLabelText("Keep going"));
    expect(mockClose).toHaveBeenCalledTimes(1);
  },
);
it("keeps the form open when persistence fails", () => {
  mockSave.mockReturnValue(false);
  const screen = mount();
  fireEvent.press(screen.getByLabelText("Continue"));
  fireEvent.press(screen.getByLabelText("Continue"));
  fireEvent.press(screen.getByLabelText("Create goal"));
  expect(
    screen.getByText("Your goal could not be saved. Please try again."),
  ).toBeTruthy();
  expect(screen.queryByLabelText("Keep going")).toBeNull();
});
it("opens the native editor route for other accounts", () => {
  mockAuthState.userData.username = "SomeoneElse";
  const screen = render(<LevelGoalRoute />);
  expect(screen.queryByTestId("redirect")).toBeNull();
  expect(screen.getByLabelText("Continue")).toBeTruthy();
});

it("selects a future calendar day in the native date flow", () => {
  const screen = mount();
  fireEvent.press(screen.getByText("A date"));
  fireEvent.press(screen.getByLabelText("Continue"));
  fireEvent.press(screen.getByLabelText("Target date · Oct 30"));
  fireEvent.press(screen.getByLabelText("October 15, 2026"));
  fireEvent.press(screen.getByLabelText("Continue"));
  fireEvent.press(screen.getByLabelText("Create goal"));
  expect(mockSave).toHaveBeenCalledWith(
    expect.objectContaining({ deadline: "2026-10-15", mode: "date" }),
  );
});

it("spaces one radial tick per available level evenly in the native dial", () => {
  const now = new Date("2026-09-30T12:00:00");
  const screen = render(
    <LevelGoalEditor
      currentLevel={21}
      progressions={[]}
      existing={createLevelGoal(
        {
          id: "edit",
          currentLevel: 21,
          targetLevel: 25,
          mode: "duration",
          durationDays: 30,
        },
        now,
      )}
      now={now}
      onSave={mockSave}
      onClose={mockClose}
    />,
  );
  fireEvent.press(screen.getByLabelText("Continue"));
  const ticks = screen.UNSAFE_getAllByType(Line);
  expect(ticks).toHaveLength(39); // levels 22–60, with no duplicated or skipped levels
  expect(ticks.filter((tick) => tick.props.stroke === "#1764a1")).toHaveLength(
    4,
  );
  const angles = ticks.map((tick) => {
    const { x1, y1, x2, y2 } = tick.props;
    expect(Math.hypot(x2 - 120, y2 - 120)).toBeCloseTo(110, 6);
    expect((x1 - 120) * (y2 - 120) - (y1 - 120) * (x2 - 120)).toBeCloseTo(0, 6);
    return Math.atan2(y2 - 120, x2 - 120);
  });
  angles
    .slice(1)
    .forEach((angle, index) =>
      expect((angle - angles[index] + Math.PI * 2) % (Math.PI * 2)).toBeCloseTo(
        (1.5 * Math.PI) / 38,
        6,
      ),
    );
  fireEvent.press(screen.getByLabelText("Continue"));
  expect(screen.getByLabelText("Target level 25")).toBeTruthy();
});

it("allows a calendar date in the timeframe flow and saves the matching custom duration", () => {
  const screen = mount();
  fireEvent.press(screen.getByText("A timeframe"));
  fireEvent.press(screen.getByLabelText("Continue"));
  fireEvent.press(screen.getByLabelText("Pick a date · Oct 30"));
  fireEvent.press(screen.getByLabelText("October 15, 2026"));
  expect(screen.getByLabelText("Pick a date · Oct 15")).toBeTruthy();
  fireEvent.press(screen.getByLabelText("Continue"));
  fireEvent.press(screen.getByLabelText("Create goal"));
  expect(mockSave).toHaveBeenCalledWith(
    expect.objectContaining({
      deadline: "2026-10-15",
      mode: "duration",
      durationDays: 15,
    }),
  );
});

it("provides a selection haptic for each calendar interaction and success feedback on save", () => {
  const screen = mount();
  fireEvent.press(screen.getByText("A date"));
  fireEvent.press(screen.getByLabelText("Continue"));
  fireEvent.press(screen.getByLabelText("Target date · Oct 30"));
  jest.mocked(Haptics.selectionAsync).mockClear();
  fireEvent.press(screen.getByLabelText("Next month"));
  fireEvent.press(screen.getByLabelText("Previous month"));
  fireEvent.press(screen.getByLabelText("October 15, 2026"));
  expect(Haptics.selectionAsync).toHaveBeenCalledTimes(3);
  fireEvent.press(screen.getByLabelText("Level 25"));
  expect(Haptics.selectionAsync).toHaveBeenCalledTimes(4);
  fireEvent.press(screen.getByLabelText("Continue"));
  fireEvent.press(screen.getByLabelText("Create goal"));
  expect(Haptics.notificationAsync).toHaveBeenCalledWith(
    Haptics.NotificationFeedbackType.Success,
  );
});
