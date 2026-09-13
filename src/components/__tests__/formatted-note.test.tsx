import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { StyleSheet, TextInput, View } from "react-native";

import {
  FormattedNoteEditor,
  FormattedNoteText,
  type FormattedNoteEditorHandle,
} from "../formatted-note";
import type { NoteVisualEditorDOMProps } from "../note-visual-editor-types";

const mockPeekNoteSubjectType = jest.fn();
const mockRememberNoteSubjectType = jest.fn();
const mockResolveNoteSubjectType = jest.fn();
let mockAdvancedNoteEditorEnabled = true;
let mockIncludeCharacters = false;

let mockLinkPickerProps: {
  initialQuery: string;
  onSelect: (subject: unknown) => void;
} | null = null;
let mockVisualEditorProps: NoteVisualEditorDOMProps | null = null;

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("../../utils/store", () => ({
  useSettingsStore: (
    selector: (state: { advancedNoteEditorEnabled: boolean; noteLinkIncludeCharacters: boolean; setNoteLinkIncludeCharacters: (enabled: boolean) => void }) => unknown,
  ) => selector({ advancedNoteEditorEnabled: mockAdvancedNoteEditorEnabled, noteLinkIncludeCharacters: mockIncludeCharacters, setNoteLinkIncludeCharacters: (enabled) => { mockIncludeCharacters = enabled; } }),
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
    mockAdvancedNoteEditorEnabled = true;
    mockIncludeCharacters = false;
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

  it("uses a native plain text field without editor controls when advanced editing is disabled", () => {
    mockAdvancedNoteEditorEnabled = false;
    const editorRef = React.createRef<FormattedNoteEditorHandle>();
    const screen = render(
      <FormattedNoteEditor
        ref={editorRef}
        value="A simple note"
        onChangeText={jest.fn()}
        accessibilityLabel="Meaning note text"
        containerStyle={{ flex: 1 }}
      />,
    );

    const input = screen.UNSAFE_getByType(TextInput);
    expect(input.props.value).toBe("A simple note");
    expect(input.props.multiline).toBe(true);
    expect(input.props.scrollEnabled).toBe(true);
    expect(StyleSheet.flatten(input.props.style).flex).toBe(1);
    expect(screen.queryByLabelText("Bold")).toBeNull();
    expect(screen.queryByLabelText("Link to subject")).toBeNull();
    expect(screen.queryByLabelText("Note editor mode")).toBeNull();
    expect(mockVisualEditorProps).toBeNull();
    expect(editorRef.current?.closeLinkPicker()).toBe(false);
  });

  it("keeps typed formatting and link markup literal throughout plain editing and reopening", () => {
    mockAdvancedNoteEditorEnabled = false;
    const literalText = '<b>bold</b> & <a href="wk://subject/440">bridge</a>';
    const storedText = '&lt;b&gt;bold&lt;/b&gt; &amp; &lt;a href="wk://subject/440"&gt;bridge&lt;/a&gt;';
    const onChangeText = jest.fn();
    function ControlledEditor() {
      const [value, setValue] = React.useState("");
      return (
        <FormattedNoteEditor
          value={value}
          onChangeText={(nextValue) => {
            onChangeText(nextValue);
            setValue(nextValue);
          }}
          accessibilityLabel="Meaning note text"
        />
      );
    }
    const screen = render(<ControlledEditor />);

    fireEvent.changeText(screen.getByLabelText("Meaning note text"), literalText);

    expect(onChangeText).toHaveBeenLastCalledWith(storedText);
    expect(screen.getByLabelText("Meaning note text").props.value).toBe(literalText);
    expect(mockVisualEditorProps).toBeNull();
    expect(screen.queryByLabelText("Bold")).toBeNull();

    screen.unmount();
    const reopened = render(
      <FormattedNoteEditor
        value={storedText}
        onChangeText={jest.fn()}
        accessibilityLabel="Reopened note text"
      />,
    );
    expect(reopened.UNSAFE_getByType(TextInput).props.value).toBe(literalText);
    expect(mockVisualEditorProps).toBeNull();
  });

  it("flushes the latest plain input immediately before the parent updates its value", async () => {
    mockAdvancedNoteEditorEnabled = false;
    const editorRef = React.createRef<FormattedNoteEditorHandle>();
    const onChangeText = jest.fn();
    const screen = render(
      <FormattedNoteEditor
        ref={editorRef}
        value="old text"
        onChangeText={onChangeText}
        accessibilityLabel="Meaning note text"
      />,
    );

    fireEvent.changeText(screen.getByLabelText("Meaning note text"), "最新 & <b>text</b>");

    expect(onChangeText).toHaveBeenLastCalledWith("最新 &amp; &lt;b&gt;text&lt;/b&gt;");
    await expect(editorRef.current?.flush()).resolves.toBe("最新 &amp; &lt;b&gt;text&lt;/b&gt;");
  });

  it.each([
    "Existing <b>bold</b> note",
    'Existing <a href="wk://subject/440">bridge</a> link',
  ])("retains the advanced editor for an existing formatted note with the setting disabled: %s", (value) => {
    mockAdvancedNoteEditorEnabled = false;
    const screen = render(
      <FormattedNoteEditor value={value} onChangeText={jest.fn()} />,
    );

    expect(mockVisualEditorProps).not.toBeNull();
    expect(screen.getByLabelText("Bold")).toBeTruthy();
    expect(screen.getByLabelText("Use source editor")).toBeTruthy();
  });

  it("enables the advanced editor for plain notes when the setting is on", () => {
    mockAdvancedNoteEditorEnabled = true;
    mockIncludeCharacters = false;
    const screen = render(
      <FormattedNoteEditor value="A simple note" onChangeText={jest.fn()} />,
    );

    expect(mockVisualEditorProps?.runs).toEqual([
      { text: "A simple note", formats: [] },
    ]);
    expect(screen.getByLabelText("Bold")).toBeTruthy();
    expect(screen.getByLabelText("Link to subject")).toBeTruthy();
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

  it("keeps long source notes in a bounded scrolling field", async () => {
    const screen = render(
      <FormattedNoteEditor
        value={"A long <b>reading note</b>\n".repeat(40)}
        onChangeText={jest.fn()}
        accessibilityLabel="Reading note text"
        style={{ minHeight: 120, padding: 12 }}
      />,
    );
    fireEvent.press(screen.getByLabelText("Use source editor"));
    const request = mockVisualEditorProps!.command!;
    await act(async () => {
      await mockVisualEditorProps!.onSourceReady({
        requestNonce: request.nonce,
        runs: mockVisualEditorProps!.runs,
      });
    });

    const input = screen.getByLabelText("Reading note text");
    const inputStyle = StyleSheet.flatten(input.props.style);
    expect(inputStyle.height).toBe(120);
    expect(inputStyle.flexShrink).toBe(1);
    expect(input.props.scrollEnabled).toBe(true);
  });

  it.each([120, 240])("gives the native visual WebView an explicit %d point height", (height) => {
    render(
      <FormattedNoteEditor
        value="Visible note text"
        onChangeText={jest.fn()}
        style={height === 120 ? { minHeight: height } : { height }}
      />,
    );

    expect(StyleSheet.flatten(mockVisualEditorProps?.dom?.style)).toEqual({
      width: "100%",
      height,
    });
    expect(mockVisualEditorProps?.dom?.hideKeyboardAccessoryView).toBe(true);
  });

  it("resizes the native WebView to the measured writing area when the keyboard changes available space", () => {
    const screen = render(
      <FormattedNoteEditor
        value="Visible note text"
        onChangeText={jest.fn()}
        style={{ minHeight: 120, borderWidth: 2 }}
        containerStyle={{ flex: 1 }}
      />,
    );
    const frame = screen.UNSAFE_getAllByType(View).find(
      (view) => typeof view.props.onLayout === "function",
    )!;

    fireEvent(frame, "layout", { nativeEvent: { layout: { height: 318 } } });
    expect(StyleSheet.flatten(mockVisualEditorProps?.dom?.style).height).toBe(314);
    expect(mockVisualEditorProps?.appearance.minHeight).toBe(314);

    fireEvent(frame, "layout", { nativeEvent: { layout: { height: 158 } } });
    expect(StyleSheet.flatten(mockVisualEditorProps?.dom?.style).height).toBe(154);
    expect(mockVisualEditorProps?.appearance.minHeight).toBe(154);

    fireEvent(frame, "layout", { nativeEvent: { layout: { height: 0 } } });
    expect(StyleSheet.flatten(mockVisualEditorProps?.dom?.style).height).toBe(154);
  });

  it("unlinks a visual selection from the toolbar and removes a whole link explicitly", async () => {
    const screen = render(
      <FormattedNoteEditor
        value={'<a href="wk://subject/440">a long bridge</a>'}
        onChangeText={jest.fn()}
      />,
    );
    await act(async () => {
      await mockVisualEditorProps!.onSelectionChange({
        text: "long",
        formats: [],
        subjectId: 440,
      });
    });

    fireEvent.press(screen.getByLabelText("Toggle subject link"));
    const request = mockVisualEditorProps!.command!;
    expect(request.type).toBe("capture-selection");
    await act(async () => {
      await mockVisualEditorProps!.onSelectionChange({
        text: "long",
        formats: [],
        subjectId: 440,
        requestNonce: request.nonce,
      });
    });
    expect(mockVisualEditorProps!.command).toMatchObject({
      type: "toggle-link",
    });
    expect(mockLinkPickerProps).toBeNull();

    fireEvent.press(screen.getByLabelText("Remove subject link"));
    expect(mockVisualEditorProps!.command).toMatchObject({
      type: "remove-link",
      scope: "link",
    });
  });

  it("uses the captured selection to choose link or unlink after a quick cursor move", async () => {
    const screen = render(
      <FormattedNoteEditor value="plain" onChangeText={jest.fn()} />,
    );
    // The native toolbar still shows Link, but the WebView caret has moved into a link.
    fireEvent.press(screen.getByLabelText("Link to subject"));
    let request = mockVisualEditorProps!.command!;
    await act(async () => {
      await mockVisualEditorProps!.onSelectionChange({
        text: "bridge",
        formats: [],
        subjectId: 440,
        requestNonce: request.nonce,
      });
    });
    expect(mockVisualEditorProps!.command).toMatchObject({
      type: "toggle-link",
    });
    expect(mockLinkPickerProps).toBeNull();

    // The opposite transition must open the picker for the newly selected plain text.
    fireEvent.press(screen.getByLabelText("Toggle subject link"));
    request = mockVisualEditorProps!.command!;
    await act(async () => {
      await mockVisualEditorProps!.onSelectionChange({
        text: "plain",
        formats: [],
        requestNonce: request.nonce,
      });
    });
    expect(mockLinkPickerProps?.initialQuery).toBe("plain");
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

  it("resumes linked typing at an inactive caret without opening the picker", async () => {
    const screen = render(<FormattedNoteEditor value='<a href="wk://subject/440">bridge</a>' onChangeText={jest.fn()} />);
    await act(async () => {
      await mockVisualEditorProps!.onSelectionChange({ text: "", formats: [], inactiveSubjectId: 440 });
    });
    fireEvent.press(screen.getByLabelText("Resume subject link"));
    const request = mockVisualEditorProps!.command!;
    const selection = { start: 3, end: 3 };
    await act(async () => {
      await mockVisualEditorProps!.onSelectionChange({ text: "", formats: [], inactiveSubjectId: 440, selection, requestNonce: request.nonce });
    });
    expect(mockLinkPickerProps).toBeNull();
    expect(mockVisualEditorProps!.command).toMatchObject({ type: "toggle-link", selection });
  });

  it("stops linked typing from a source caret while preserving both existing link halves", async () => {
    const editorRef = React.createRef<FormattedNoteEditorHandle>();
    function ControlledEditor() {
      const [value, setValue] = React.useState(
        'Compare <a href="wk://subject/440">bridge</a> closely',
      );
      return <FormattedNoteEditor ref={editorRef} value={value} onChangeText={setValue} accessibilityLabel="Meaning note text" />;
    }
    const screen = render(<ControlledEditor />);
    fireEvent.press(screen.getByLabelText("Use source editor"));
    const request = mockVisualEditorProps!.command!;
    await act(async () => {
      await mockVisualEditorProps!.onSourceReady({
        requestNonce: request.nonce,
        runs: mockVisualEditorProps!.runs,
        selection: { start: 11, end: 11 },
      });
    });

    fireEvent.press(screen.getByLabelText("Toggle subject link"));
    expect(mockLinkPickerProps).toBeNull();
    expect(screen.getByLabelText("Link to subject").props.accessibilityState.selected).toBe(false);
    const sourceInput = screen.UNSAFE_getByType(TextInput);
    const splitSource = 'Compare <a href="wk://subject/440">bri</a><a href="wk://subject/440">dge</a> closely';
    const caret = splitSource.indexOf("</a>") + "</a>".length;
    expect(sourceInput.props.value).toBe(splitSource);
    expect(sourceInput.props.selection).toEqual({ start: caret, end: caret });

    const typedSource = splitSource.slice(0, caret) + "new" + splitSource.slice(caret);
    fireEvent.changeText(sourceInput, typedSource);
    expect(mockVisualEditorProps!.runs).toEqual([
      { text: "Compare ", formats: [] },
      { text: "bri", formats: [], subjectId: 440 },
      { text: "new", formats: [] },
      { text: "dge", formats: [], subjectId: 440 },
      { text: " closely", formats: [] },
    ]);
    await expect(editorRef.current!.flush()).resolves.toBe(typedSource);
  });

  it.each([false, true])("applies the remembered Japanese-text choice (%s) in Source and preserves linked typing", async (include) => {
    mockIncludeCharacters = include;
    function ControlledEditor() {
      const [value, setValue] = React.useState("Compare bridge closely");
      return <FormattedNoteEditor value={value} onChangeText={setValue} accessibilityLabel="Meaning note text" />;
    }
    const screen = render(<ControlledEditor />);
    fireEvent.press(screen.getByLabelText("Use source editor"));
    const request = mockVisualEditorProps!.command!;
    await act(async () => {
      await mockVisualEditorProps!.onSourceReady({
        requestNonce: request.nonce,
        runs: mockVisualEditorProps!.runs,
        selection: { start: 8, end: 14 },
      });
    });
    fireEvent.press(screen.getByLabelText("Link to subject"));
    expect(mockLinkPickerProps?.initialQuery).toBe("bridge");
    fireEvent.press(screen.getByLabelText("Choose bridge subject"));

    const label = include ? "bridge 橋" : "bridge";
    const linkedSource = `Compare <a href="wk://subject/440">${label}</a> closely`;
    const caret = linkedSource.indexOf("</a>");
    const sourceInput = screen.UNSAFE_getByType(TextInput);
    expect(sourceInput.props.value).toBe(linkedSource);
    expect(sourceInput.props.selection).toEqual({ start: caret, end: caret });
    fireEvent.changeText(sourceInput, linkedSource.slice(0, caret) + "!" + linkedSource.slice(caret));
    expect(mockVisualEditorProps!.runs).toEqual([
      { text: "Compare ", formats: [] },
      { text: `${label}!`, formats: [], subjectId: 440 },
      { text: " closely", formats: [] },
    ]);
  });

  it.each([false, true])("applies the remembered Japanese-text choice (%s) when linking", async (include) => {
    mockIncludeCharacters = include;
    const screen = render(<FormattedNoteEditor value="bridge" onChangeText={jest.fn()} />);
    fireEvent.press(screen.getByLabelText("Link to subject"));
    const request = mockVisualEditorProps!.command!;
    await act(async () => {
      await mockVisualEditorProps!.onSelectionChange({ text: "bridge", formats: [], selection: { start: 0, end: 6 }, requestNonce: request.nonce });
    });
    fireEvent.press(screen.getByLabelText("Choose bridge subject"));
    expect(mockVisualEditorProps!.command).toMatchObject({ type: "set-link", appendCharacters: include ? "橋" : undefined });
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

  it("passes the captured visual range back when the picker applies a link", async () => {
    const screen = render(
      <FormattedNoteEditor
        value="before <b>middle</b> after"
        onChangeText={jest.fn()}
      />,
    );
    fireEvent.press(screen.getByLabelText("Link to subject"));
    const request = mockVisualEditorProps!.command!;
    const selection = { start: 7, end: 13 };
    await act(async () => {
      await mockVisualEditorProps!.onSelectionChange({
        text: "middle",
        formats: ["bold"],
        requestNonce: request.nonce,
        selection,
      });
      await mockVisualEditorProps!.onSelectionChange({ text: "", formats: [] });
    });

    fireEvent.press(screen.getByLabelText("Choose bridge subject"));

    expect(mockVisualEditorProps!.command).toMatchObject({
      type: "set-link",
      subjectId: 440,
      selection,
    });
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

  it("preserves the selected text when switching modes after a source edit", async () => {
    function ControlledEditor() {
      const [value, setValue] = React.useState("<b>A&amp;B</b> tail");
      return <FormattedNoteEditor value={value} onChangeText={setValue} accessibilityLabel="Meaning note text" />;
    }
    const screen = render(<ControlledEditor />);
    fireEvent.press(screen.getByLabelText("Use source editor"));
    const request = mockVisualEditorProps!.command!;
    await act(async () => {
      await mockVisualEditorProps!.onSourceReady({
        requestNonce: request.nonce,
        runs: [{ text: "A&B", formats: ["bold"] }, { text: " tail", formats: [] }],
        selection: { start: 1, end: 3 },
      });
    });
    const sourceInput = screen.UNSAFE_getByType(TextInput);
    expect(sourceInput.props.selection).toEqual({ start: 4, end: 10 });

    const updatedSource = "new <b>A&amp;B</b> tail";
    fireEvent.changeText(sourceInput, updatedSource);
    fireEvent(sourceInput, "selectionChange", {
      nativeEvent: { selection: { start: 8, end: 13 } },
    });
    fireEvent.press(screen.getByLabelText("Use visual editor"));
    expect(mockVisualEditorProps!.command).toMatchObject({
      type: "focus",
      selection: { start: 5, end: 6 },
    });
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
