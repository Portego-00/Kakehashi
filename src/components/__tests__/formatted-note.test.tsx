import { act, fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { StyleSheet } from "react-native";

import {
  FormattedNoteEditor,
  FormattedNoteText,
  type FormattedNoteEditorHandle,
} from "../formatted-note";

let mockLinkPickerProps: {
  initialQuery: string;
  onSelect: (subject: unknown) => void;
} | null = null;

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("../note-subject-link-picker", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Pressable, Text } =
    jest.requireActual<typeof import("react-native")>("react-native");

  return {
    __esModule: true,
    default: (props: {
      initialQuery: string;
      onSelect: (subject: unknown) => void;
    }) => {
      mockLinkPickerProps = props;
      return React.createElement(
        Pressable,
        {
          accessibilityLabel: "Choose bridge subject",
          onPress: () =>
            props.onSelect({
              id: 440,
              object: "vocabulary",
              data: {
                characters: "橋",
                level: 5,
                meanings: [{ meaning: "Bridge", primary: true }],
                readings: [{ reading: "はし", primary: true }],
              },
            }),
        },
        React.createElement(Text, null, "Mock subject picker"),
      );
    },
  };
});

jest.mock("../note-subject-preview", () => ({
  __esModule: true,
  default: () => null,
}));

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
  beforeEach(() => {
    mockLinkPickerProps = null;
  });

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

  it("renders an accessible, differentiated subject link and stops its press from bubbling", () => {
    const onSubjectLinkPress = jest.fn();
    const stopPropagation = jest.fn();
    const screen = render(
      <FormattedNoteText
        text={'Compare <a href="wk://subject/440">橋</a>'}
        onSubjectLinkPress={onSubjectLinkPress}
      />,
    );

    const link = screen.getByRole("link", { name: "橋" });
    expect(link.props.accessibilityHint).toBe("Shows a quick subject preview");
    expect(StyleSheet.flatten(link.props.style)).toMatchObject({
      color: "#3366cc",
      fontWeight: "600",
      textDecorationColor: "#3366cc",
      textDecorationLine: "underline",
      textDecorationStyle: "dotted",
    });

    fireEvent.press(link, { stopPropagation });

    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(onSubjectLinkPress).toHaveBeenCalledWith(440, "橋");
  });

  it("exposes one link when its label contains mixed formatting", () => {
    const onSubjectLinkPress = jest.fn();
    const screen = render(
      <FormattedNoteText
        text={
          '<a href="wk://subject/440"><b>sound</b><i>alike</i></a>'
        }
        onSubjectLinkPress={onSubjectLinkPress}
      />,
    );

    const links = screen.getAllByRole("link", { name: "soundalike" });
    expect(links).toHaveLength(1);

    fireEvent.press(links[0], { stopPropagation: jest.fn() });
    expect(onSubjectLinkPress).toHaveBeenCalledWith(440, "soundalike");
  });

  it("opens the subject picker with the selected text and inserts its choice", () => {
    const onChangeText = jest.fn();
    const screen = render(
      <FormattedNoteEditor
        value="Compare bridge closely"
        onChangeText={onChangeText}
        accessibilityLabel="Meaning note text"
      />,
    );

    fireEvent(screen.getByLabelText("Meaning note text"), "selectionChange", {
      nativeEvent: { selection: { start: 8, end: 14 } },
    });
    fireEvent.press(screen.getByLabelText("Link to subject"));

    expect(mockLinkPickerProps?.initialQuery).toBe("bridge");
    fireEvent.press(screen.getByLabelText("Choose bridge subject"));

    expect(onChangeText).toHaveBeenCalledWith(
      'Compare <a href="wk://subject/440">bridge</a> closely',
    );
  });

  it("lets an outer Android modal consume Back by closing only the picker", () => {
    const editorRef = React.createRef<FormattedNoteEditorHandle>();
    const screen = render(
      <FormattedNoteEditor
        ref={editorRef}
        value="bridge"
        onChangeText={jest.fn()}
        accessibilityLabel="Meaning note text"
      />,
    );

    fireEvent.press(screen.getByLabelText("Link to subject"));
    expect(screen.getByText("Mock subject picker")).toBeTruthy();

    let handled = false;
    act(() => {
      handled = editorRef.current?.closeLinkPicker() ?? false;
    });

    expect(handled).toBe(true);
    expect(screen.getByLabelText("Meaning note text")).toBeTruthy();
    expect(editorRef.current?.closeLinkPicker()).toBe(false);
  });
});
