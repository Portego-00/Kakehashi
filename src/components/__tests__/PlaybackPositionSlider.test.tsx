import { act, fireEvent, render } from "@testing-library/react-native";
import React, { useState } from "react";
import { PlaybackPositionSlider } from "../PlaybackPositionSlider.ios";

jest.mock("@react-native-community/slider", () => {
  const React = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  return function MockTouchSlider({ ...props }: object) {
    return React.createElement(View, { ...props, testID: "touch-slider" });
  };
});

function props(value = 103, duration = 304) {
  return {
    value,
    duration,
    onSlidingStart: jest.fn(),
    onValueChange: jest.fn(),
    onSlidingComplete: jest.fn(),
  };
}

it("exposes one adjustable control with the real playback position and duration", () => {
  const screen = render(<PlaybackPositionSlider {...props()} />);
  expect(screen.getAllByRole("adjustable")).toHaveLength(1);
  expect(screen.getByLabelText("Playback position").props.accessibilityValue).toEqual({
    min: 0,
    max: 304,
    now: 103,
    text: "1 minute, 43 seconds of 5 minutes, 4 seconds",
  });
  expect(screen.getByTestId("touch-slider", { includeHiddenElements: true }).props.accessible).toBe(false);
});

it("seeks one second per action, including rapid actions before the next render", () => {
  const seek = jest.fn();
  function Player() {
    const [time, setTime] = useState(103);
    return <PlaybackPositionSlider {...props(time)} onSlidingComplete={(next) => {
      seek(next);
      setTime(next);
    }} />;
  }
  const screen = render(<Player />);
  const onAction = screen.getByRole("adjustable").props.onAccessibilityAction;
  act(() => {
    onAction({ nativeEvent: { actionName: "decrement" } });
    onAction({ nativeEvent: { actionName: "decrement" } });
    onAction({ nativeEvent: { actionName: "decrement" } });
  });
  expect(seek.mock.calls).toEqual([[102], [101], [100]]);
  expect(screen.getByRole("adjustable").props.accessibilityValue.now).toBe(100);
  fireEvent(screen.getByRole("adjustable"), "accessibilityAction", { nativeEvent: { actionName: "increment" } });
  expect(seek).toHaveBeenLastCalledWith(101);
});

it("does not seek beyond the track boundaries or before duration is available", () => {
  const callbacks = props(0);
  const screen = render(<PlaybackPositionSlider {...callbacks} />);
  fireEvent(screen.getByRole("adjustable"), "accessibilityAction", { nativeEvent: { actionName: "decrement" } });
  expect(callbacks.onSlidingComplete).not.toHaveBeenCalled();
  screen.rerender(<PlaybackPositionSlider {...callbacks} value={304} />);
  fireEvent(screen.getByRole("adjustable"), "accessibilityAction", { nativeEvent: { actionName: "increment" } });
  expect(callbacks.onSlidingComplete).not.toHaveBeenCalled();
  screen.rerender(<PlaybackPositionSlider {...callbacks} duration={0} />);
  expect(screen.getByRole("adjustable").props.accessibilityState.disabled).toBe(true);
  fireEvent(screen.getByRole("adjustable"), "accessibilityAction", { nativeEvent: { actionName: "increment" } });
  expect(callbacks.onSlidingComplete).not.toHaveBeenCalled();
});

it("preserves the touch slider callbacks for the same seek path", () => {
  const callbacks = props();
  const screen = render(<PlaybackPositionSlider {...callbacks} />);
  const slider = screen.getByTestId("touch-slider", { includeHiddenElements: true });
  fireEvent(slider, "slidingStart");
  fireEvent(slider, "valueChange", 100);
  fireEvent(slider, "slidingComplete", 100);
  expect(callbacks.onSlidingStart).toHaveBeenCalledTimes(1);
  expect(callbacks.onValueChange).toHaveBeenCalledWith(100);
  expect(callbacks.onSlidingComplete).toHaveBeenCalledWith(100);
});
