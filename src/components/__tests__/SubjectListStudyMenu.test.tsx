import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { Platform, StyleSheet } from "react-native";
import SubjectListStudyMenu from "../SubjectListStudyMenu";

jest.mock("../../utils/theme", () => ({
  useTheme: () => ({
    theme: {
      textColor: "#222222",
      textSecondary: "#666666",
      textLight: "#999999",
      cardBackground: "#ffffff",
      border: "#dddddd",
      isDark: false,
    },
  }),
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("../GlassButton", () => {
  const React = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  return {
    GlassButton: (props: object) =>
      React.createElement(View, { ...props, testID: "glass-trigger" }),
  };
});
// Expose the adapter's native props and actions without simulating SwiftUI layout.
jest.mock("@expo/ui/swift-ui", () => {
  const React = jest.requireActual("react");
  const { Text, TouchableOpacity, View } = jest.requireActual("react-native");
  return {
    Host: ({ children, ...props }: React.PropsWithChildren<object>) =>
      React.createElement(View, { ...props, testID: "swiftui-host" }, children),
    RNHostView: ({ children, ...props }: React.PropsWithChildren<object>) =>
      React.createElement(View, { ...props, testID: "swiftui-label" }, children),
    Menu: ({
      label,
      children,
      ...props
    }: React.PropsWithChildren<{ label: React.ReactNode }>) =>
      React.createElement(
        View,
        { ...props, testID: "swiftui-menu" },
        label,
        children,
      ),
    Button: ({ label, onPress }: { label: string; onPress: () => void }) =>
      React.createElement(
        TouchableOpacity,
        { accessibilityRole: "button", accessibilityLabel: label, onPress },
        React.createElement(Text, null, label),
      ),
  };
});
jest.mock("@expo/ui/swift-ui/modifiers", () => ({
  buttonStyle: (style: string) => ({ $type: "buttonStyle", style }),
}));

function makeProps() {
  return {
    selectedItemCount: 12,
    selectedKanjiCount: 3,
    hasSelectedLists: true,
    onStandardReview: jest.fn(),
    onFlashcardReview: jest.fn(),
    onKanjiMatch: jest.fn(),
    onCustomLessons: jest.fn(),
    onRandomTest: jest.fn(),
    onSimilarKanji: jest.fn(),
    onKanjiWriting: jest.fn(),
  };
}

beforeEach(() => {
  jest.replaceProperty(Platform, "OS", "ios");
});
afterEach(() => {
  jest.restoreAllMocks();
});

it("uses a plain native Menu around the pre-styled glass trigger", () => {
  const triggerStyle = { width: 44, height: 44, borderRadius: 22 };
  const screen = render(
    <SubjectListStudyMenu {...makeProps()} triggerStyle={triggerStyle} />,
  );

  expect(screen.getByTestId("swiftui-menu").props.modifiers).toEqual(
    expect.arrayContaining([{ $type: "buttonStyle", style: "plain" }]),
  );
  expect(screen.getByTestId("swiftui-host").props.matchContents).toBe(true);
  expect(screen.getByTestId("swiftui-label").props.matchContents).toBe(true);
  for (const trigger of [
    screen.getByTestId("swiftui-host"),
    screen.getByLabelText("Choose study mode"),
    screen.getByTestId("glass-trigger"),
  ]) {
    expect(StyleSheet.flatten(trigger.props.style)).toMatchObject(triggerStyle);
  }
});

it("keeps native action counts and callbacks connected to each study mode", () => {
  const props = makeProps();
  const screen = render(<SubjectListStudyMenu {...props} />);
  const actions = [
    ["Standard Review (12)", props.onStandardReview],
    ["Flashcard Review (12)", props.onFlashcardReview],
    ["Kanji Match (3)", props.onKanjiMatch],
    ["Custom Lessons", props.onCustomLessons],
    ["Random Test", props.onRandomTest],
    ["Similar Kanji", props.onSimilarKanji],
    ["Kanji Writing", props.onKanjiWriting],
  ] as const;

  expect(screen.getAllByRole("button")).toHaveLength(actions.length);
  for (const [label, callback] of actions) {
    fireEvent.press(screen.getByLabelText(label));
    expect(callback).toHaveBeenCalledTimes(1);
  }
});

it("updates native action availability and counts when the selection changes", () => {
  const props = makeProps();
  const screen = render(
    <SubjectListStudyMenu
      {...props}
      selectedItemCount={1}
      selectedKanjiCount={1}
      hasSelectedLists={false}
    />,
  );

  expect(screen.getAllByRole("button")).toHaveLength(3);
  expect(screen.getByLabelText("Standard Review (1)")).toBeTruthy();
  expect(screen.getByLabelText("Flashcard Review (1)")).toBeTruthy();
  expect(screen.queryByText(/^Kanji Match/)).toBeNull();
  for (const label of ["Random Test", "Similar Kanji", "Kanji Writing"]) {
    expect(screen.queryByText(label)).toBeNull();
  }

  screen.rerender(
    <SubjectListStudyMenu
      {...props}
      selectedItemCount={5}
      selectedKanjiCount={2}
    />,
  );

  expect(screen.getAllByRole("button")).toHaveLength(7);
  expect(screen.getByLabelText("Standard Review (5)")).toBeTruthy();
  expect(screen.getByLabelText("Flashcard Review (5)")).toBeTruthy();
  fireEvent.press(screen.getByLabelText("Kanji Match (2)"));
  expect(props.onKanjiMatch).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("Standard Review (1)")).toBeNull();
});

it("replaces the disabled empty selection with the native menu and back again", () => {
  const props = makeProps();
  const screen = render(
    <SubjectListStudyMenu {...props} selectedItemCount={0} />,
  );

  expect(screen.getByLabelText("Choose study mode").props.accessibilityState)
    .toEqual({ disabled: true });
  expect(screen.queryByTestId("swiftui-menu")).toBeNull();
  fireEvent.press(screen.getByLabelText("Choose study mode"));
  expect(props.onStandardReview).not.toHaveBeenCalled();

  screen.rerender(<SubjectListStudyMenu {...props} />);
  expect(screen.getByTestId("swiftui-menu").props.modifiers).toEqual(
    expect.arrayContaining([{ $type: "buttonStyle", style: "plain" }]),
  );
  fireEvent.press(screen.getByLabelText("Standard Review (12)"));
  expect(props.onStandardReview).toHaveBeenCalledTimes(1);

  screen.rerender(<SubjectListStudyMenu {...props} selectedItemCount={0} />);
  expect(screen.queryByTestId("swiftui-menu")).toBeNull();
  expect(screen.getByLabelText("Choose study mode").props.accessibilityState)
    .toEqual({ disabled: true });
});

it("opens the Android fallback, disables unavailable matching, and closes after an action", () => {
  jest.replaceProperty(Platform, "OS", "android");
  const props = makeProps();
  const screen = render(
    <SubjectListStudyMenu
      {...props}
      selectedKanjiCount={1}
      hasSelectedLists={false}
    />,
  );

  expect(screen.queryByTestId("swiftui-menu")).toBeNull();
  expect(screen.queryByText("Choose Study Mode")).toBeNull();
  fireEvent.press(screen.getByLabelText("Choose study mode"));
  expect(screen.getByText("12 selected items")).toBeTruthy();
  const kanjiMatch = screen.getByRole("button", { name: /Kanji Match/ });
  expect(kanjiMatch.props.accessibilityState).toEqual({ disabled: true });
  fireEvent.press(kanjiMatch);
  expect(props.onKanjiMatch).not.toHaveBeenCalled();
  expect(screen.queryByText("Random Test")).toBeNull();

  fireEvent.press(screen.getByText("Flashcard Review"));
  expect(props.onFlashcardReview).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("Choose Study Mode")).toBeNull();
});
