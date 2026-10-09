import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Pressable, Text } from "react-native";
import MultipleChoiceKeyboard from "../../../../../src/components/multiple-choice-keyboard.web";

vi.mock("../../../../../src/utils/navigation-focus", () => ({
  useOptionalScreenIsFocused: () => true,
}));

afterEach(cleanup);

describe("mobile multiple choice in a browser", () => {
  it("confirms with Enter after clicking a choice without pressing that choice again", () => {
    const onSelectIndex = vi.fn();
    const onConfirm = vi.fn();
    const onPress = vi.fn();
    render(
      <MultipleChoiceKeyboard enabled questionKey="question" onSelectIndex={onSelectIndex} onConfirm={onConfirm}>
        <Pressable accessibilityRole="button" onPress={onPress}><Text>Choice 1</Text></Pressable>
      </MultipleChoiceKeyboard>,
    );
    const choice = screen.getByRole("button", { name: "Choice 1" });
    fireEvent.click(choice);
    act(() => choice.focus());
    expect(onPress).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(choice, { key: "4" });
    expect(onSelectIndex).toHaveBeenCalledWith(3);
    expect(fireEvent.keyDown(choice, { key: "Enter" })).toBe(false);
    fireEvent.keyUp(choice, { key: "Enter" });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("leaves Enter button activation available when there is no confirm action", () => {
    const onPress = vi.fn();
    render(
      <MultipleChoiceKeyboard enabled questionKey="question" onSelectIndex={vi.fn()}>
        <Pressable accessibilityRole="button" onPress={onPress}><Text>Choice 1</Text></Pressable>
      </MultipleChoiceKeyboard>,
    );
    const choice = screen.getByRole("button", { name: "Choice 1" });
    act(() => choice.focus());
    expect(fireEvent.keyDown(choice, { key: "Enter" })).toBe(true);
    fireEvent.keyUp(choice, { key: "Enter" });
    // jsdom does not synthesize the native button click from an uncancelled Enter.
    fireEvent.click(choice);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("ignores editors, other buttons, modifiers and inactive questions", () => {
    const onSelectIndex = vi.fn();
    const onConfirm = vi.fn();
    const props = { enabled: true, questionKey: "question", onSelectIndex, onConfirm };
    const view = render(<><MultipleChoiceKeyboard {...props} /><input aria-label="Note" /><button>Other action</button></>);
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "1" });
    fireEvent.keyDown(screen.getByRole("button", { name: "Other action" }), { key: "2" });
    fireEvent.keyDown(window, { key: "3", metaKey: true });
    fireEvent.keyDown(window, { key: "4", repeat: true });
    fireEvent.keyDown(window, { key: "1", isComposing: true });
    expect(onSelectIndex).not.toHaveBeenCalled();
    view.rerender(<MultipleChoiceKeyboard {...props} enabled={false} />);
    fireEvent.keyDown(window, { key: "1" });
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onSelectIndex).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
