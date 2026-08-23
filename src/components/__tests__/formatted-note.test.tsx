import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { FormattedNoteEditor, FormattedNoteText } from "../formatted-note";

jest.mock("../../utils/theme", () => ({
  useTheme: () => ({
    theme: {
      cardBackground: "#ffffff",
      border: "#dddddd",
      headerSurface: "#eeeeee",
      primary: "#3366cc",
      textColor: "#111111",
      textSecondary: "#666666",
    },
  }),
}));

describe("FormattedNote", () => {
  it("renders formatted note text without exposing its stored tags", () => {
    const screen = render(
      <FormattedNoteText text="Use <b>on-yomi</b> here" />,
    );

    expect(screen.getByText("Use ")).toBeTruthy();
    expect(screen.getByText("on-yomi").props.style).toEqual([
      { fontWeight: "700" },
    ]);
    expect(screen.queryByText("<b>")).toBeNull();
  });

  it("formats the selected range from the editor toolbar", () => {
    const onChangeText = jest.fn();
    const screen = render(
      <FormattedNoteEditor
        value="on-yomi"
        onChangeText={onChangeText}
        accessibilityLabel="Meaning note text"
      />,
    );

    fireEvent(screen.getByLabelText("Meaning note text"), "selectionChange", {
      nativeEvent: { selection: { start: 0, end: 2 } },
    });
    fireEvent.press(screen.getByLabelText("Bold"));

    expect(onChangeText).toHaveBeenCalledWith("<b>on</b>-yomi");
  });
});
