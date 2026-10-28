import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

const { PlaybackPositionSlider } =
  jest.requireActual<typeof import("../PlaybackPositionSlider")>("../PlaybackPositionSlider.tsx");

jest.mock("@react-native-community/slider", () => {
  const React = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  return function NativePlatformSlider(props: object) {
    return React.createElement(View, { ...props, testID: "platform-slider" });
  };
});

it("keeps the platform slider exposed and forwards its native seek callbacks", () => {
  const onSlidingStart = jest.fn();
  const onValueChange = jest.fn();
  const onSlidingComplete = jest.fn();
  const screen = render(
    <PlaybackPositionSlider
      value={100}
      duration={304}
      onSlidingStart={onSlidingStart}
      onValueChange={onValueChange}
      onSlidingComplete={onSlidingComplete}
    />,
  );
  const slider = screen.getByTestId("platform-slider");
  expect(slider.props.accessibilityLabel).toBe("Playback position");
  expect(slider.props.accessible).not.toBe(false);
  expect(slider.props.accessibilityElementsHidden).toBeUndefined();
  fireEvent(slider, "slidingStart");
  fireEvent(slider, "valueChange", 102);
  fireEvent(slider, "slidingComplete", 102);
  expect(onSlidingStart).toHaveBeenCalledTimes(1);
  expect(onValueChange).toHaveBeenCalledWith(102);
  expect(onSlidingComplete).toHaveBeenCalledWith(102);
});
