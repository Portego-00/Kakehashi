import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { StyleSheet } from "react-native";

import {
  FormattedNoteEditor,
  FormattedNoteText,
  type FormattedNoteEditorHandle,
} from "../formatted-note";
import type { NoteVisualEditorDOMProps } from "../note-visual-editor-types";

const mockPeekNoteSubjectType = jest.fn();
const mockRememberNoteSubjectType = jest.fn();
const mockResolveNoteSubjectType = jest.fn();

let mockLinkPickerProps: {
  initialQuery: string;
  onSelect: (subject: unknown) => void;
} | null = null;
let mockVisualEditorProps: NoteVisualEditorDOMProps | null = null;

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

jest.mock("../note-visual-editor-dom", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Text, View } =
    jest.requireActual<typeof import("react-native")>("react-native");

  return {
    __esModule: true,
    default: (props: NoteVisualEditorDOMProps) => {
      mockVisualEditorProps = props;
      return React.createElement(
        View,
        { accessibilityLabel: props.accessibilityLabel },
        React.createElement(Text, null, "Mock visual editor"),
      );
    },
  };
});

jest.mock("../../utils/note-subject-metadata", () => ({
  peekNoteSubjectType: (...args: unknown[]) => mockPeekNoteSubjectType(...args),
  rememberNoteSubjectType: (...args: unknown[]) =>
    mockRememberNoteSubjectType(...args),
  resolveNoteSubjectType: (...args: unknown[]) =>
    mockResolveNoteSubjectType(...args),
}));

jest.mock("../../utils/subjectColors", () => ({
  useSubjectColors: () => ({
    radical: "#3c9bff",
    kanji: "#fa1f62",
    vocabulary: "#9c38d9",
    getColorForType: (type: string) => {
      if (type === "radical") return "#3c9bff";
      if (type === "kanji") return "#fa1f62";
      return "#9c38d9";
    },
  }),
  withAlpha: (color: string) => color,
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
      textLight: "#999999",
      error: "#cc3333",
      isDark: false,
    },
  }),
}));

describe("FormattedNote", () => {
  beforeEach(() => {
    mockLinkPickerProps = null;
    mockVisualEditorProps = null;
    mockPeekNoteSubjectType.mockReset();
    mockRememberNoteSubjectType.mockReset();
    mockResolveNoteSubjectType.mockReset();
    mockPeekNoteSubjectType.mockImplementation((subjectId: number) =>
      subjectId === 440 ? "kanji" : null,
    );
    mockResolveNoteSubjectType.mockResolvedValue(null);
  });

  it("renders formatted note text without exposing its stored tags", () => {
    const screen = render(<FormattedNoteText text="Use <b>on-yomi</b> here" />);

    expect(screen.getByText("Use ")).toBeTruthy();
    expect(screen.getByText("on-yomi").props.style).toEqual([
      { fontWeight: "700" },
    ]);
    expect(screen.queryByText("<b>")).toBeNull();
  });

  it("formats the selected range from the editor toolbar", async () => {
    const onChangeText = jest.fn();
    const screen = render(
      <FormattedNoteEditor
        value="on-yomi"
        onChangeText={onChangeText}
        accessibilityLabel="Meaning note text"
      />,
    );

    fireEvent.press(screen.getByLabelText("Use source editor"));
    const sourceRequest = mockVisualEditorProps?.command;
    expect(sourceRequest).toMatchObject({ type: "prepare-source" });
    await act(async () => {
      await mockVisualEditorProps?.onSourceReady({
        requestNonce: sourceRequest!.nonce,
        runs: mockVisualEditorProps.runs,
      });
    });
    fireEvent(screen.getByLabelText("Meaning note text"), "selectionChange", {
      nativeEvent: { selection: { start: 0, end: 2 } },
    });
    fireEvent.press(screen.getByLabelText("Bold"));

    expect(onChangeText).toHaveBeenCalledWith("<b>on</b>-yomi");
  });

  it("uses the visual editor by default and sends formatting commands", async () => {
    const screen = render(
      <FormattedNoteEditor
        value="Use <b>on-yomi</b> here"
        onChangeText={jest.fn()}
        accessibilityLabel="Meaning note text"
      />,
    );

    expect(mockVisualEditorProps?.runs).toEqual([
      { text: "Use ", formats: [] },
      { text: "on-yomi", formats: ["bold"] },
      { text: " here", formats: [] },
    ]);
    expect(
      screen.getByLabelText("Use visual editor").props.accessibilityState,
    ).toEqual({ selected: true });

    await act(async () => {
      await mockVisualEditorProps?.onSelectionChange({
        text: "on-yomi",
        formats: ["bold"],
      });
    });
    fireEvent.press(screen.getByLabelText("Italic"));

    expect(mockVisualEditorProps?.command).toMatchObject({
      type: "toggle-format",
      format: "italic",
    });
  });

  it("renders an accessible, subject-colored link without web-link decoration", () => {
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
    expect(StyleSheet.flatten(link.props.style)).toEqual({
      color: "#fa1f62",
      fontWeight: "600",
    });

    fireEvent.press(link, { stopPropagation });

    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(onSubjectLinkPress).toHaveBeenCalledWith(440, "橋");
  });

  it("resolves an existing link type from the subject cache", async () => {
    mockPeekNoteSubjectType.mockReturnValue(null);
    mockResolveNoteSubjectType.mockResolvedValue("radical");
    const screen = render(
      <FormattedNoteText text={'See <a href="wk://subject/22">生</a>'} />,
    );

    const link = screen.getByRole("link", { name: "生" });
    expect(StyleSheet.flatten(link.props.style)).toEqual({
      color: "#111111",
      fontWeight: "600",
    });

    await waitFor(() => {
      expect(StyleSheet.flatten(link.props.style)).toEqual({
        color: "#3c9bff",
        fontWeight: "600",
      });
    });
    expect(mockResolveNoteSubjectType).toHaveBeenCalledWith(22);
  });

  it("exposes one link when its label contains mixed formatting", () => {
    const onSubjectLinkPress = jest.fn();
    const screen = render(
      <FormattedNoteText
        text={'<a href="wk://subject/440"><b>sound</b><i>alike</i></a>'}
        onSubjectLinkPress={onSubjectLinkPress}
      />,
    );

    const links = screen.getAllByRole("link", { name: "soundalike" });
    expect(links).toHaveLength(1);

    fireEvent.press(links[0], { stopPropagation: jest.fn() });
    expect(onSubjectLinkPress).toHaveBeenCalledWith(440, "soundalike");
  });

  it("opens the subject picker with the selected text and inserts its choice", async () => {
    const onChangeText = jest.fn();
    const screen = render(
      <FormattedNoteEditor
        value="Compare bridge closely"
        onChangeText={onChangeText}
        accessibilityLabel="Meaning note text"
      />,
    );

    fireEvent.press(screen.getByLabelText("Use source editor"));
    const sourceRequest = mockVisualEditorProps?.command;
    await act(async () => {
      await mockVisualEditorProps?.onSourceReady({
        requestNonce: sourceRequest!.nonce,
        runs: mockVisualEditorProps.runs,
      });
    });
    fireEvent(screen.getByLabelText("Meaning note text"), "selectionChange", {
      nativeEvent: { selection: { start: 8, end: 14 } },
    });
    fireEvent.press(screen.getByLabelText("Link to subject"));

    expect(mockLinkPickerProps?.initialQuery).toBe("bridge");
    fireEvent.press(screen.getByLabelText("Choose bridge subject"));

    expect(mockRememberNoteSubjectType).toHaveBeenCalledWith(440, "vocabulary");
    expect(onChangeText).toHaveBeenCalledWith(
      'Compare <a href="wk://subject/440">bridge</a> closely',
    );
  });

  it("creates a subject link from visual text without exposing markup", async () => {
    const onChangeText = jest.fn();
    const screen = render(
      <FormattedNoteEditor
        value="Compare bridge closely"
        onChangeText={onChangeText}
        accessibilityLabel="Meaning note text"
      />,
    );

    await act(async () => {
      await mockVisualEditorProps?.onSelectionChange({
        text: "previous selection",
        formats: [],
      });
    });
    fireEvent.press(screen.getByLabelText("Link to subject"));

    const selectionRequest = mockVisualEditorProps?.command;
    expect(selectionRequest).toMatchObject({ type: "capture-selection" });
    await act(async () => {
      await mockVisualEditorProps?.onSelectionChange({
        text: "bridge",
        formats: [],
        requestNonce: selectionRequest!.nonce,
      });
    });

    expect(mockLinkPickerProps?.initialQuery).toBe("bridge");
    fireEvent.press(screen.getByLabelText("Choose bridge subject"));
    expect(mockVisualEditorProps?.command).toMatchObject({
      type: "set-link",
      subjectId: 440,
      fallbackLabel: "橋",
    });

    await act(async () => {
      await mockVisualEditorProps?.onChange([
        { text: "Compare ", formats: [] },
        { text: "bridge", formats: [], subjectId: 440 },
        { text: " closely", formats: [] },
      ]);
    });
    expect(onChangeText).toHaveBeenCalledWith(
      'Compare <a href="wk://subject/440">bridge</a> closely',
    );
  });

  it("commits the latest visual snapshot before revealing source markup", async () => {
    function ControlledEditor() {
      const [value, setValue] = React.useState("old text");
      return (
        <FormattedNoteEditor
          value={value}
          onChangeText={setValue}
          accessibilityLabel="Meaning note text"
        />
      );
    }

    const screen = render(<ControlledEditor />);
    fireEvent.press(screen.getByLabelText("Use source editor"));
    const sourceRequest = mockVisualEditorProps?.command;

    await act(async () => {
      await mockVisualEditorProps?.onSourceReady({
        requestNonce: sourceRequest!.nonce,
        runs: [{ text: "日本語", formats: ["bold"] }],
      });
    });

    expect(screen.getByLabelText("Meaning note text").props.value).toBe(
      "<b>日本語</b>",
    );
  });

  it("flushes the latest visual value before a native save reads it", async () => {
    const editorRef = React.createRef<FormattedNoteEditorHandle>();
    const onChangeText = jest.fn();
    render(
      <FormattedNoteEditor
        ref={editorRef}
        value="old text"
        onChangeText={onChangeText}
        accessibilityLabel="Meaning note text"
      />,
    );

    let flushedValue: Promise<string> | undefined;
    act(() => {
      flushedValue = editorRef.current?.flush();
    });
    const valueRequest = mockVisualEditorProps?.command;
    expect(valueRequest).toMatchObject({ type: "capture-value" });

    await act(async () => {
      await mockVisualEditorProps?.onValueReady({
        requestNonce: valueRequest!.nonce,
        runs: [{ text: "最新の入力", formats: ["italic"] }],
      });
    });

    await expect(flushedValue).resolves.toBe("<i>最新の入力</i>");
    expect(onChangeText).toHaveBeenCalledWith("<i>最新の入力</i>");
  });

  it("offers direct change and remove actions for a selected visual link", async () => {
    const screen = render(
      <FormattedNoteEditor
        value={'Compare <a href="wk://subject/440">橋</a>'}
        onChangeText={jest.fn()}
        accessibilityLabel="Meaning note text"
      />,
    );

    await act(async () => {
      await mockVisualEditorProps?.onSelectionChange({
        text: "橋",
        formats: [],
        subjectId: 440,
      });
    });

    expect(screen.getByLabelText("Change subject link")).toBeTruthy();
    expect(screen.getByLabelText("Remove subject link")).toBeTruthy();

    fireEvent.press(screen.getByLabelText("Change subject link"));
    const selectionRequest = mockVisualEditorProps?.command;
    await act(async () => {
      await mockVisualEditorProps?.onSelectionChange({
        text: "橋",
        formats: [],
        subjectId: 440,
        requestNonce: selectionRequest!.nonce,
      });
    });
    expect(mockLinkPickerProps?.initialQuery).toBe("橋");
    fireEvent.press(screen.getByLabelText("Choose bridge subject"));

    await act(async () => {
      await mockVisualEditorProps?.onSelectionChange({
        text: "橋",
        formats: [],
        subjectId: 440,
      });
    });
    fireEvent.press(screen.getByLabelText("Remove subject link"));
    expect(mockVisualEditorProps?.command).toMatchObject({
      type: "remove-link",
    });
  });

  it("lets an outer Android modal consume Back by closing only the picker", async () => {
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
    const selectionRequest = mockVisualEditorProps?.command;
    await act(async () => {
      await mockVisualEditorProps?.onSelectionChange({
        text: "",
        formats: [],
        requestNonce: selectionRequest!.nonce,
      });
    });
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
