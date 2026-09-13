import { fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";
import React from "react";
import { getAvailableLessons, getSubjects } from "../../src/utils/api";
import LessonPickerScreen from "../(app)/lesson-picker";

jest.mock("expo-router", () => ({
  router: { replace: jest.fn(), back: jest.fn() },
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
});
