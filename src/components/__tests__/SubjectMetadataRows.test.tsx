import { act, render } from "@testing-library/react-native";
import React from "react";
import { useVocabularyFrequency } from "../../hooks/useVocabularyFrequency";
import { useSettingsStore } from "../../utils/store";
import SubjectMetadataRows from "../SubjectMetadataRows";

jest.mock("../../hooks/useVocabularyFrequency", () => ({
  useVocabularyFrequency: jest.fn(),
}));

jest.mock("../../utils/theme", () => ({
  useTheme: () => ({ theme: { textColor: "#111", textSecondary: "#666" } }),
}));

const vocabulary = {
  id: 1,
  object: "vocabulary",
  data: { characters: "開く", readings: [{ reading: "ひらく", accepted_answer: true }] },
};

beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.setState({ showJLPTLevel: false, showVocabularyFrequency: false });
  jest.mocked(useVocabularyFrequency).mockReturnValue({
    result: {
      provider: "jiten",
      frequencyRank: 194,
      wordId: 1,
      readingIndex: 0,
      matchedText: "開く",
      matchedReading: "ひらく",
      sourceUrl: "https://jiten.moe/search?query=開く",
      fetchedAt: 0,
      isStale: false,
    },
    isLoading: false,
    error: null,
  });
});

afterEach(() => {
  useSettingsStore.setState({ showJLPTLevel: false, showVocabularyFrequency: false });
});

it("keeps the rows and frequency lookup off until enabled independently", () => {
  const screen = render(<SubjectMetadataRows subject={vocabulary} />);
  expect(screen.toJSON()).toBeNull();
  expect(useVocabularyFrequency).not.toHaveBeenCalled();

  act(() => useSettingsStore.getState().setShowJLPTLevel(true));
  expect(screen.getByText("JLPT Level")).toBeTruthy();
  expect(screen.getByText("N4")).toBeTruthy();
  expect(screen.queryByText("Frequency")).toBeNull();
  expect(useVocabularyFrequency).not.toHaveBeenCalled();

  act(() => useSettingsStore.getState().setShowVocabularyFrequency(true));
  expect(screen.getByText("Frequency")).toBeTruthy();
  expect(screen.getByText("#194")).toBeTruthy();

  act(() => useSettingsStore.getState().setShowJLPTLevel(false));
  expect(screen.queryByText("JLPT Level")).toBeNull();
  expect(screen.getByText("Frequency")).toBeTruthy();

  act(() => useSettingsStore.getState().setShowVocabularyFrequency(false));
  expect(screen.toJSON()).toBeNull();
});

it.each([
  ["kanji", "語", "N5"],
  ["kana_vocabulary", "テレビ", "N5"],
  ["vocabulary", "未掲載の単語", "Not classified"],
])("classifies %s without inventing missing levels", (object, characters, expected) => {
  useSettingsStore.setState({ showJLPTLevel: true });
  const screen = render(<SubjectMetadataRows subject={{ id: 1, object, data: { characters } }} />);
  expect(screen.getByText("JLPT Level")).toBeTruthy();
  expect(screen.getByText(expected)).toBeTruthy();
});

it("does not show vocabulary frequency for kanji or either row for radicals", () => {
  useSettingsStore.setState({ showJLPTLevel: true, showVocabularyFrequency: true });
  const screen = render(<SubjectMetadataRows subject={{ id: 1, object: "kanji", data: { characters: "語" } }} />);
  expect(screen.getByText("N5")).toBeTruthy();
  expect(screen.queryByText("Frequency")).toBeNull();
  screen.rerender(<SubjectMetadataRows subject={{ id: 1, object: "radical", data: { characters: "語" } }} />);
  expect(screen.toJSON()).toBeNull();
  expect(useVocabularyFrequency).not.toHaveBeenCalled();
});
