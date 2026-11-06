import React from "react";
import { act, cleanupAsync, fireEvent, render } from "@testing-library/react-native";
import {
  StudyPacePlanner,
  StudyPacePlannerSetting,
} from "../study-pace-planner";
import { goalStorageKey, parseGoalState } from "../model";
import { router } from "expo-router";
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
const mockData = new Map<string, string>();
const mockAuth = { userData: { id: 500, username: "Portego" } };
const mockSettings = {
  dailyLessonLimit: 20,
  reviewBatchSize: 50,
  reviewBatchSizeEnabled: false,
  homeStudyPacePlannerEnabled: true,
  setHomeStudyPacePlannerEnabled: (enabled: boolean) => {
    mockSettings.homeStudyPacePlannerEnabled = enabled;
  },
};
const mockSaveSettings = jest.fn((patch: Partial<typeof mockSettings>) =>
  Object.assign(mockSettings, patch),
);
jest.mock("../../../utils/store", () => ({
  useAuthStore: (selector: (s: typeof mockAuth) => unknown) =>
    selector(mockAuth),
  useSettingsStore: Object.assign(
    (selector: (s: typeof mockSettings) => unknown) => selector(mockSettings),
    {
      setState: (patch: Partial<typeof mockSettings>) =>
        mockSaveSettings(patch),
    },
  ),
}));
jest.mock("../../../utils/permanentStorage", () => ({
  permanentStorage: {
    getString: (key: string) => mockData.get(key),
    set: (key: string, value: string) => mockData.set(key, value),
  },
}));
jest.mock("../../../utils/theme", () => ({
  useTheme: () => ({
    theme: {
      primary: "#1764a1",
      textColor: "#111",
      textSecondary: "#555",
      border: "#ddd",
      error: "#b00",
    },
  }),
}));
jest.mock("../../../utils/haptics", () => ({
  selectionAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  NotificationFeedbackType: { Success: "success" },
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("@react-native-community/slider", () => {
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return View;
});
jest.mock("react-native-reanimated", () => {
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return { __esModule: true, default: { View }, useReducedMotion: () => true };
});
const subjects = Array.from({ length: 140 }, (_, i) => ({
  id: i + 1,
  object: "kanji",
  data: { level: 7 },
}));
const props = { currentLevel: 7, subjects, assignments: [] };
beforeEach(() => {
  mockSettings.homeStudyPacePlannerEnabled = true;
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-10-04T12:00:00"));
  mockAuth.userData.id++;
  mockAuth.userData.username = "Portego";
  Object.assign(mockSettings, {
    dailyLessonLimit: 20,
    reviewBatchSize: 50,
    reviewBatchSizeEnabled: false,
  });
  mockSaveSettings.mockClear();
});
it("requires the Home customization toggle for every account", () => {
  mockSettings.homeStudyPacePlannerEnabled = false;
  const planner = render(<StudyPacePlanner {...props} />);
  expect(planner.queryByLabelText("Plan your pace")).toBeNull();
  const setting = render(<StudyPacePlannerSetting />);
  expect(setting.getByLabelText("Plan your pace").props.value).toBe(false);
  fireEvent(setting.getByLabelText("Plan your pace"), "valueChange", true);
  planner.rerender(<StudyPacePlanner {...props} />);
  expect(planner.getByLabelText("Plan your pace")).toBeTruthy();
  mockAuth.userData.username = "AnotherUser";
  setting.rerender(<StudyPacePlannerSetting />);
  planner.rerender(<StudyPacePlanner {...props} />);
  expect(setting.getByLabelText("Plan your pace")).toBeTruthy();
  expect(planner.getByLabelText("Plan your pace")).toBeTruthy();
});
afterEach(async () => {
  await cleanupAsync();
  jest.useRealTimers();
});
it("links pace and lessons, keeps workload independent of session size, and applies actual settings", () => {
  const screen = render(<StudyPacePlanner {...props} />);
  fireEvent.press(screen.getByLabelText("Plan your pace"));
  fireEvent.press(screen.getByText("Two weeks"));
  expect(screen.getByLabelText("Daily lessons").props.value).toBe(10);
  const before = screen.getByTestId("planner-workload").props.children[1];
  fireEvent(screen.getByLabelText("Reviews per session"), "valueChange", 5);
  expect(screen.getByTestId("planner-workload").props.children[1]).toBe(before);
  fireEvent.press(screen.getByText("Apply daily plan →"));
  expect(mockSaveSettings).toHaveBeenCalledWith({
    dailyLessonLimit: 10,
    reviewBatchSizeEnabled: true,
    reviewBatchSize: 5,
  });
  expect(
    JSON.parse(mockData.get(goalStorageKey(String(mockAuth.userData.id)))!)
      .studyPlan,
  ).toEqual({ daysPerLevel: 14, dailyLessons: 10, reviewBatch: 5 });
  fireEvent.press(screen.getByText("Use date for my goal"));
  const saved = JSON.parse(
    mockData.get(goalStorageKey(String(mockAuth.userData.id)))!,
  );
  expect(saved.active.mode).toBe("date");
  expect(saved.active.targetLevel).toBe(10);
  expect(saved.active.deadline).toBe("2026-11-15");
  fireEvent.press(screen.getByLabelText("Plan your pace"));
  fireEvent.press(screen.getByLabelText("Plan your pace"));
  expect(screen.getByLabelText("Daily lessons").props.value).toBe(10);
});
it("allows other accounts and pauses actions on vacation", () => {
  mockAuth.userData.username = "AnotherUser";
  const hidden = render(<StudyPacePlanner {...props} />);
  expect(hidden.getByLabelText("Plan your pace")).toBeTruthy();
  hidden.unmount();
  mockAuth.userData.username = "Portego";
  const screen = render(<StudyPacePlanner {...props} paused />);
  fireEvent.press(screen.getByLabelText("Plan your pace"));
  expect(screen.getByLabelText("Daily lessons").props.disabled).toBe(true);
  fireEvent.press(screen.getByText("Apply daily plan →"));
  expect(mockSaveSettings).not.toHaveBeenCalled();
  expect(
    screen.getByText("Planning is paused while you’re on vacation."),
  ).toBeTruthy();
});
it("waits for the catalog before initializing linked controls", () => {
  const screen = render(<StudyPacePlanner {...props} loading subjects={[]} />);
  fireEvent.press(screen.getByLabelText("Plan your pace"));
  expect(screen.queryByLabelText("Days per level")).toBeNull();
  screen.rerender(<StudyPacePlanner {...props} />);
  expect(screen.getByLabelText("Days per level").props.value).toBe(7);
});

it("keeps the applied plan and goal date after reopening four days later (#112)", () => {
  const screen = render(<StudyPacePlanner {...props} />);
  fireEvent.press(screen.getByLabelText("Plan your pace"));
  fireEvent.press(screen.getByText("Apply daily plan →"));
  fireEvent.press(screen.getByText("Use date for my goal"));
  const deadline = screen.getByText("Oct 25");
  expect(deadline).toBeTruthy();
  fireEvent.press(screen.getByLabelText("Plan your pace"));
  act(() => jest.setSystemTime(new Date("2026-10-08T12:00:00")));
  fireEvent.press(screen.getByLabelText("Plan your pace"));
  expect(screen.getByText("Oct 25")).toBeTruthy();
  expect(screen.getByText("Plan applied ✓")).toBeTruthy();
  expect(screen.getByText("Goal date updated")).toBeTruthy();
});

it("opens a custom level/date goal from the planner (#112)", () => {
  const screen = render(<StudyPacePlanner {...props} />);
  fireEvent.press(screen.getByLabelText("Plan your pace"));
  fireEvent.press(screen.getByText("Set a level goal"));
  expect(router.push).toHaveBeenCalledWith("/(app)/level-goal");
});

it("accounts for days already spent on the current level (#112)", () => {
  jest.setSystemTime(new Date("2026-10-09T12:00:00"));
  const screen = render(<StudyPacePlanner {...props} currentLevel={8}
    subjects={subjects.map(subject => ({ ...subject, data: { level: 8 } }))}
    progressions={[{ data: { level: 8, unlocked_at: "2026-10-03T12:00:00" } }]} />);
  fireEvent.press(screen.getByLabelText("Plan your pace"));
  fireEvent.press(screen.getByText("A week"));
  expect(screen.getByText("Oct 17")).toBeTruthy();
  fireEvent.press(screen.getByText("Apply daily plan →"));
  const saved = JSON.parse(mockData.get(goalStorageKey(String(mockAuth.userData.id)))!);
  expect(saved.studyPlanAnchor).toEqual({ level: 8, date: "2026-10-03" });
  expect(parseGoalState(JSON.stringify(saved)).studyPlanAnchor).toEqual(saved.studyPlanAnchor);
});

it("uses the level start when progression data arrives after opening (#112)", () => {
  jest.setSystemTime(new Date("2026-10-09T12:00:00"));
  const levelProps = { ...props, currentLevel: 8,
    subjects: subjects.map(subject => ({ ...subject, data: { level: 8 } })),
  };
  const screen = render(<StudyPacePlanner {...levelProps} />);
  fireEvent.press(screen.getByLabelText("Plan your pace"));
  screen.rerender(<StudyPacePlanner {...levelProps}
    progressions={[{ data: { level: 8, unlocked_at: "2026-10-03T12:00:00" } }]} />);
  expect(screen.getByText("Oct 17")).toBeTruthy();
});
