import { render } from "@testing-library/react-native";
import React from "react";

import { useVocabularyFrequency } from "../../hooks/useVocabularyFrequency";
import { useSettingsStore } from "../../utils/store";
import VocabularyFrequencyBadge from "../VocabularyFrequencyBadge";

jest.mock("../../hooks/useVocabularyFrequency", () => ({
  useVocabularyFrequency: jest.fn(),
}));

jest.mock("../../utils/store", () => ({
  useSettingsStore: jest.fn(),
}));

jest.mock("../../utils/theme", () => ({
  useTheme: () => ({
    theme: {
      textColor: "#111111",
      textSecondary: "#666666",
    },
  }),
}));

const subject = {
  id: 1,
  object: "vocabulary",
  data: {
    characters: "食べる",
    readings: [{ reading: "たべる", accepted_answer: true }],
  },
};

function mockSetting(settingEnabled: boolean) {
  (useSettingsStore as unknown as jest.Mock).mockImplementation(
    (selector: (state: { showVocabularyFrequency: boolean }) => unknown) =>
      selector({ showVocabularyFrequency: settingEnabled }),
  );
}

describe("VocabularyFrequencyBadge", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useVocabularyFrequency as jest.Mock).mockReturnValue({
      result: {
        provider: "jiten",
        frequencyRank: 194,
        sourceUrl: "https://jiten.moe/search?query=食べる",
        isStale: false,
      },
      isLoading: false,
      error: null,
    });
  });

  it("does not start a lookup while the setting is off", () => {
    mockSetting(false);

    const { toJSON } = render(<VocabularyFrequencyBadge subject={subject} />);

    expect(toJSON()).toBeNull();
    expect(useVocabularyFrequency).not.toHaveBeenCalled();
  });

  it("shows the rank when the setting is on", () => {
    mockSetting(true);

    const { getByText, queryByText } = render(
      <VocabularyFrequencyBadge subject={subject} />,
    );

    expect(getByText("#194")).toBeTruthy();
    expect(queryByText(/Jiten/)).toBeNull();
    expect(useVocabularyFrequency).toHaveBeenCalledWith(subject);
  });

  it("shows a placeholder while the rank is unavailable", () => {
    mockSetting(true);
    (useVocabularyFrequency as jest.Mock).mockReturnValue({
      result: null,
      isLoading: true,
      error: null,
    });

    const { getByLabelText, getByText } = render(
      <VocabularyFrequencyBadge subject={subject} />,
    );

    expect(getByText("#---")).toBeTruthy();
    expect(getByLabelText("Vocabulary frequency unavailable")).toBeTruthy();
  });
});
