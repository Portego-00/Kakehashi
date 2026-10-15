import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import React from "react";
import { getAvailableLessons, getSubjects } from "../../src/utils/api";
import { useSettingsStore } from "../../src/utils/store";
import LessonPickerScreen from "../(app)/lesson-picker";

jest.mock("expo-router", () => ({
  router: { replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({}),
}));

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

jest.mock("@shopify/flash-list", () => {
  const React = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  return {
    FlashList: ({ data, renderItem }: {
      data: unknown[];
      renderItem: (info: { item: unknown }) => React.ReactNode;
    }) => (
      <View>
        {data.map((item, index) => (
          <React.Fragment key={index}>{renderItem({ item })}</React.Fragment>
        ))}
      </View>
    ),
  };
});

jest.mock("expo-sqlite", () => ({}));
jest.mock("../../src/lib/supabase", () => ({ supabase: {} }));

jest.mock("../../src/utils/api", () => ({
  getAvailableLessons: jest.fn(),
  getSubjects: jest.fn(),
  getAssignmentsOptimized: jest.fn(),
}));

jest.mock("../../src/contexts/AuthContext", () => ({
  useSession: () => ({ isLoading: false }),
}));

jest.mock("../../src/utils/store", () => {
  const settings = {
    dailyLessonLimit: 0,
    excludeKanaVocabularyFromLessons: true,
    lessonPickerViewMode: "cards",
    showVocabularyFrequency: false,
    showLessonVocabularyUnlockCounts: false,
  };
  return {
    useAuthStore: () => ({ apiToken: "test-token" }),
    useSettingsStore: Object.assign(
      (selector: (state: typeof settings) => unknown) => selector(settings),
      { getState: () => settings },
    ),
  };
});

jest.mock("../../src/utils/theme", () => ({
  useTheme: () => ({
    theme: {
      primary: "#7c3aed",
      backgroundColor: "#ffffff",
      textColor: "#111111",
      textSecondary: "#666666",
      cardBackground: "#ffffff",
      border: "#dddddd",
    },
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getSubjects).mockReset();
  Object.assign(useSettingsStore.getState(), {
    lessonPickerViewMode: "cards",
    showLessonVocabularyUnlockCounts: false,
  });
});

it("starts the chosen assignments using stable IDs after excluded lessons are filtered out", async () => {
  jest.mocked(getAvailableLessons).mockResolvedValue({
    data: [
      { id: 5001, data: { subject_id: 101 } },
      { id: 5008, data: { subject_id: 102 } },
      { id: 5012, data: { subject_id: 103 } },
      { id: 5025, data: { subject_id: 104 } },
    ],
  } as Awaited<ReturnType<typeof getAvailableLessons>>);
  jest.mocked(getSubjects).mockResolvedValue({
    data: [
      {
        id: 101,
        object: "radical",
        data: { characters: "一", meanings: [{ meaning: "Ground" }], level: 1 },
      },
      {
        id: 102,
        object: "kana_vocabulary",
        data: { characters: "これ", meanings: [{ meaning: "This" }], level: 1 },
      },
      {
        id: 103,
        object: "radical",
        data: { characters: "二", meanings: [{ meaning: "Two" }], level: 1 },
      },
      {
        id: 104,
        object: "radical",
        data: { characters: "三", meanings: [{ meaning: "Three" }], level: 1 },
      },
    ],
  } as Awaited<ReturnType<typeof getSubjects>>);

  const screen = render(<LessonPickerScreen />);
  fireEvent.press(await screen.findByText("一"));
  fireEvent.press(screen.getByText("三"));
  expect(screen.queryByText("これ")).toBeNull();
  fireEvent.press(screen.getByText("Start 2 Lessons"));

  expect(router.replace).toHaveBeenCalledWith({
    pathname: "/lessons",
    params: { selectedLessonIds: "[5001,5025]" },
  });
  expect(getSubjects).toHaveBeenCalledTimes(1);
});

const unlockLessons = [
  { id: 101, object: "kanji", data: { characters: "川", meanings: [{ meaning: "River" }], level: 4 } },
  { id: 102, object: "kanji", data: { characters: "火", meanings: [{ meaning: "Fire" }], level: 4 } },
  { id: 103, object: "radical", data: { characters: "一", meanings: [{ meaning: "Ground" }], level: 4 } },
];
const unlockVocabulary = [
  { id: 201, object: "vocabulary", data: { level: 4, component_subject_ids: [101] } },
  { id: 202, object: "vocabulary", data: { level: 4, component_subject_ids: [101, 999] } },
  { id: 203, object: "vocabulary", data: { level: 5, component_subject_ids: [101] } },
];
function prepareUnlockLessons() {
  Object.assign(useSettingsStore.getState(), { showLessonVocabularyUnlockCounts: true });
  jest.mocked(getAvailableLessons).mockResolvedValue({
    data: unlockLessons.map((subject, index) => ({ id: 5001 + index, data: { subject_id: subject.id } })),
  } as Awaited<ReturnType<typeof getAvailableLessons>>);
  jest.mocked(getSubjects)
    .mockResolvedValueOnce({ data: unlockLessons } as Awaited<ReturnType<typeof getSubjects>>);
}

it.each(["cards", "list"])("shows same-level kanji vocabulary badges in %s mode and keeps stable selection IDs", async (mode) => {
  prepareUnlockLessons();
  Object.assign(useSettingsStore.getState(), { lessonPickerViewMode: mode });
  jest.mocked(getSubjects).mockResolvedValueOnce({ data: unlockVocabulary } as Awaited<ReturnType<typeof getSubjects>>);
  const screen = render(<LessonPickerScreen />);
  expect(await screen.findByText("2 vocab")).toBeTruthy();
  expect(screen.getByText("0 vocab")).toBeTruthy();
  expect(screen.getAllByLabelText(/same-level vocabulary/)).toHaveLength(2);
  expect(getSubjects).toHaveBeenLastCalledWith("test-token", { types: ["vocabulary"], levels: [4], hidden: false });
  fireEvent.press(screen.getByText("川"));
  fireEvent.press(screen.getByText("Start 1 Lesson"));
  expect(router.replace).toHaveBeenCalledWith({ pathname: "/lessons", params: { selectedLessonIds: "[5001]" } });
});

it("retries failed count lookups without blocking lesson selection", async () => {
  prepareUnlockLessons();
  const warning = jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.mocked(getSubjects)
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ data: unlockVocabulary } as Awaited<ReturnType<typeof getSubjects>>);
  try {
    const screen = render(<LessonPickerScreen />);
    expect(await screen.findByText("Vocabulary unlock counts could not load.")).toBeTruthy();
    fireEvent.press(screen.getByText("川"));
    expect(screen.getByText("Start 1 Lesson")).toBeTruthy();
    fireEvent.press(screen.getByText("Retry counts"));
    await waitFor(() => expect(screen.getByText("2 vocab")).toBeTruthy());
    fireEvent.press(screen.getByText("Start 1 Lesson"));
    expect(router.replace).toHaveBeenCalledWith({ pathname: "/lessons", params: { selectedLessonIds: "[5001]" } });
  } finally { warning.mockRestore(); }
});
