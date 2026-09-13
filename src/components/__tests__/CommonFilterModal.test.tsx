import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { CommonFilterModal } from "../CommonFilterModal";

jest.mock("@expo/vector-icons", () => {
  const React = jest.requireActual("react");
  const { Text } = jest.requireActual("react-native");
  return { Ionicons: ({ name }: { name: string }) => React.createElement(Text, null, name) };
});
jest.mock("expo-blur", () => ({ BlurView: jest.requireActual("react-native").View }));
jest.mock("../../utils/theme", () => ({
  useTheme: () => ({ theme: {
    isDark: false, primary: "#6d28d9", textColor: "#111", textSecondary: "#666",
    textLight: "#888", border: "#ddd", cardBackground: "#fff",
  } }),
}));

const subjects = [
  { object: "vocabulary", data: { parts_of_speech: ["noun", "verbal noun"] } },
  { object: "kana_vocabulary", data: { parts_of_speech: ["proper noun"] } },
];

describe("CommonFilterModal vocabulary types", () => {
  it("applies pending vocabulary selections together with existing filters", () => {
    const onApply = jest.fn();
    const screen = render(<CommonFilterModal visible onClose={jest.fn()} onApply={onApply}
      currentValues={{ frequency: "all", vocabularyTypes: [] }}
      sections={[{ id: "frequency", title: "Frequency", options: [{ id: "all", label: "Any frequency" }] }]}
      showVocabularyTypes subjects={subjects} />);

    fireEvent.press(screen.getByLabelText("Vocab type: All"));
    fireEvent.press(screen.getByLabelText("Verbal noun vocabulary type"));
    fireEvent.press(screen.getByLabelText("Proper noun vocabulary type"));
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText("Apply Filters"));
    expect(onApply).toHaveBeenCalledWith({ frequency: "all", vocabularyTypes: ["verbal noun", "proper noun"] });
  });

  it("discards pending changes after cancellation and allows clearing applied types", () => {
    const onApply = jest.fn();
    const currentValues = { vocabularyTypes: ["proper noun"] };
    const props = { onApply, onClose: jest.fn(), currentValues, sections: [], showVocabularyTypes: true, subjects };
    const screen = render(<CommonFilterModal {...props} visible />);
    fireEvent.press(screen.getByLabelText("Vocab type: Proper noun"));
    fireEvent.press(screen.getByLabelText("Verbal noun vocabulary type"));
    fireEvent.press(screen.getByText("Cancel"));
    expect(onApply).not.toHaveBeenCalled();

    screen.rerender(<CommonFilterModal {...props} visible={false} />);
    screen.rerender(<CommonFilterModal {...props} visible />);
    expect(screen.getByLabelText("Vocab type: Proper noun")).toBeTruthy();
    // A native Modal remount may collapse the selector when it reopens.
    if (!screen.queryByLabelText("Clear vocabulary types")) {
      fireEvent.press(screen.getByLabelText("Vocab type: Proper noun"));
    }
    fireEvent.press(screen.getByLabelText("Clear vocabulary types"));
    fireEvent.press(screen.getByText("Apply Filters"));
    expect(onApply).toHaveBeenCalledWith({ vocabularyTypes: [] });
  });
});
