import { act, fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { Platform } from "react-native";
import { registerOpenNoteSubjectPreview } from "../../utils/note-subject-preview-state";
import MultipleChoiceKeyboard from "../multiple-choice-keyboard";

const mockFocus = jest.fn();
const mockBlur = jest.fn();
let mockScreenFocused = true;

jest.mock("../../utils/navigation-focus", () => ({
  useOptionalScreenIsFocused: () => mockScreenFocused,
}));
jest.mock("react-native-external-keyboard", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  const MockKeyboardView = React.forwardRef((props: React.ComponentProps<typeof View>, ref) => {
    React.useImperativeHandle(ref, () => ({ focus: mockFocus, blur: mockBlur }));
    return <View {...props} />;
  });
  MockKeyboardView.displayName = "MockKeyboardView";
  return { KeyboardExtendedBaseView: MockKeyboardView };
});

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockScreenFocused = true;
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it.each([
  ["ios", 30, 0], ["ios", 31, 1], ["ios", 32, 2], ["ios", 33, 3],
  ["ios", 89, 0], ["ios", 92, 3],
  ["android", 8, 0], ["android", 9, 1], ["android", 10, 2], ["android", 11, 3],
  ["android", 145, 0], ["android", 148, 3],
] as const)("maps physical number codes on %s (%i) to choice %i", (platform, keyCode, index) => {
  jest.replaceProperty(Platform, "OS", platform);
  const onSelectIndex = jest.fn();
  const screen = render(<MultipleChoiceKeyboard enabled questionKey="one" onSelectIndex={onSelectIndex} testID="keys" />);
  fireEvent(screen.getByTestId("keys"), "keyUpPress", { nativeEvent: { unicodeChar: "", keyCode, hasNoModifiers: true } });
  expect(onSelectIndex).toHaveBeenCalledWith(index);
});

it("answers on release and ignores modifiers, shifted symbols, and other keys", () => {
  const onSelectIndex = jest.fn();
  const screen = render(<MultipleChoiceKeyboard enabled questionKey="one" onSelectIndex={onSelectIndex} testID="keys" />);
  const keyboard = screen.getByTestId("keys");
  fireEvent(keyboard, "keyUpPress", { nativeEvent: { unicodeChar: "1", hasNoModifiers: false } });
  fireEvent(keyboard, "keyUpPress", { nativeEvent: { unicodeChar: "!", keyCode: 30, hasNoModifiers: true } });
  fireEvent(keyboard, "keyUpPress", { nativeEvent: { unicodeChar: "5", hasNoModifiers: true } });
  expect(onSelectIndex).not.toHaveBeenCalled();
  fireEvent(keyboard, "keyUpPress", { nativeEvent: { unicodeChar: "3", hasNoModifiers: true } });
  expect(onSelectIndex).toHaveBeenCalledTimes(1);
  expect(onSelectIndex).toHaveBeenCalledWith(2);
});

it("refocuses each question and suspends keyboard capture behind previews or inactive screens", () => {
  const onSelectIndex = jest.fn();
  const props = { enabled: true, questionKey: "one", onSelectIndex, testID: "keys" };
  const screen = render(<MultipleChoiceKeyboard {...props} />);
  act(() => jest.advanceTimersByTime(150));
  expect(mockFocus).toHaveBeenCalledTimes(1);
  screen.rerender(<MultipleChoiceKeyboard {...props} questionKey="two" />);
  act(() => jest.advanceTimersByTime(150));
  expect(mockFocus).toHaveBeenCalledTimes(2);
  let closePreview!: () => void;
  act(() => { closePreview = registerOpenNoteSubjectPreview(); });
  fireEvent(screen.getByTestId("keys"), "keyUpPress", { nativeEvent: { unicodeChar: "1", hasNoModifiers: true } });
  expect(onSelectIndex).not.toHaveBeenCalled();
  expect(mockBlur).toHaveBeenCalled();
  act(() => closePreview());
  act(() => jest.advanceTimersByTime(150));
  expect(mockFocus).toHaveBeenCalledTimes(3);
  mockScreenFocused = false;
  screen.rerender(<MultipleChoiceKeyboard {...props} />);
  fireEvent(screen.getByTestId("keys"), "keyUpPress", { nativeEvent: { unicodeChar: "1", hasNoModifiers: true } });
  expect(onSelectIndex).not.toHaveBeenCalled();
  screen.rerender(<MultipleChoiceKeyboard {...props} enabled={false} />);
  act(() => jest.advanceTimersByTime(150));
  expect(mockFocus).toHaveBeenCalledTimes(3);
});

it("confirms a selected answer with Enter on an external keyboard", () => {
  const onConfirm = jest.fn();
  const screen = render(<MultipleChoiceKeyboard enabled questionKey="one" onSelectIndex={jest.fn()} onConfirm={onConfirm} testID="keys" />);
  fireEvent(screen.getByTestId("keys"), "keyUpPress", { nativeEvent: { unicodeChar: "\r", hasNoModifiers: true } });
  expect(onConfirm).toHaveBeenCalledTimes(1);
});
