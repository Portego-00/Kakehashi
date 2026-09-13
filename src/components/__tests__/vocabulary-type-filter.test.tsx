import { fireEvent, render } from "@testing-library/react-native";
import React, { useState } from "react";
import { StyleSheet } from "react-native";

import { VocabularyTypeFilter } from "../vocabulary-type-filter";

jest.mock("@expo/vector-icons", () => {
  const React = jest.requireActual("react");
  const { Text } = jest.requireActual("react-native");
  return { Ionicons: ({ name }: { name: string }) => React.createElement(Text, null, name) };
});

jest.mock("../../utils/theme", () => ({
  useTheme: () => ({
    theme: {
      primary: "#6d28d9", textColor: "#111111", textSecondary: "#666666",
      textLight: "#888888", border: "#dddddd", cardBackground: "#ffffff",
    },
  }),
}));

const subjects = [
  { object: "vocabulary", data: { parts_of_speech: ["noun", "verbal noun"] } },
  { object: "kana_vocabulary", data: { parts_of_speech: ["proper noun"] } },
];

it("searches the catalog and preserves selected types while narrowing the choices", () => {
  function Filter() {
    const [selected, setSelected] = useState<string[]>([]);
    return <VocabularyTypeFilter subjects={subjects} selected={selected} onChange={setSelected} />;
  }
  const screen = render(<Filter />);
  fireEvent.press(screen.getByLabelText("Vocab type: All"));
  const verbalNoun = screen.getByLabelText("Verbal noun vocabulary type");
  expect(verbalNoun.props.accessibilityRole).toBe("checkbox");
  expect(StyleSheet.flatten(verbalNoun.props.style).minHeight).toBe(44);
  fireEvent.press(verbalNoun);

  fireEvent.changeText(screen.getByLabelText("Find a vocabulary type"), "PROPER");
  expect(screen.queryByLabelText("Verbal noun vocabulary type")).toBeNull();
  fireEvent.press(screen.getByLabelText("Proper noun vocabulary type"));
  expect(screen.getByLabelText("Vocab type: 2 selected")).toBeTruthy();

  fireEvent.changeText(screen.getByLabelText("Find a vocabulary type"), "");
  expect(screen.getByLabelText("Verbal noun vocabulary type").props.accessibilityState.checked).toBe(true);
  fireEvent.press(screen.getByLabelText("Clear vocabulary types"));
  expect(screen.getByLabelText("Vocab type: All")).toBeTruthy();
});

it("retains selected types absent from the current catalog so they can be removed", () => {
  const onChange = jest.fn();
  const screen = render(
    <VocabularyTypeFilter subjects={subjects} selected={["expression"]} onChange={onChange} initiallyExpanded />,
  );
  fireEvent.press(screen.getByLabelText("Expression vocabulary type"));
  expect(onChange).toHaveBeenCalledWith([]);
});
