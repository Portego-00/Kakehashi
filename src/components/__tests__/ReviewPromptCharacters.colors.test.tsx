import React from "react";
import { act, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import ReviewPromptCharacters from "../ReviewPromptCharacters";
import { useSettingsStore } from "../../utils/store";
import { useRemoteSvg } from "../../utils/radicalSvg";
import type { Subject } from "../../types/wanikani";

jest.mock("../../utils/radicalSvg", () => ({
  pickBestImage: () => ({ type: "svg", url: "https://example.test/radical.svg" }),
  useRemoteSvg: jest.fn(() => null),
}));

const subject: Subject = {
  id: 1, object: "vocabulary", data: { characters: "猫", meanings: [{ meaning: "Cat" }] },
};

beforeEach(() => useSettingsStore.setState({ jitaiEnabled: false, reviewPromptTextColor: "", bunproReviewPromptTextColor: "" }));
afterEach(() => useSettingsStore.setState(useSettingsStore.getInitialState(), true));

it("updates the shared WaniKani/extra-study prompt immediately and restores white by default", () => {
  const view = render(<ReviewPromptCharacters subject={subject} />);
  const color = () => StyleSheet.flatten(view.getByText("猫").props.style).color;
  expect(color()).toBe("#ffffff");
  act(() => useSettingsStore.getState().setReviewPromptTextColor("#123456"));
  expect(color()).toBe("#123456");
  act(() => useSettingsStore.getState().setBunproReviewPromptTextColor("#abcdef"));
  expect(color()).toBe("#123456");
  act(() => useSettingsStore.getState().setReviewPromptTextColor(""));
  expect(color()).toBe("#ffffff");
});

it("uses the same prompt color for image radicals and text fallbacks", () => {
  useSettingsStore.getState().setReviewPromptTextColor("#123456");
  const radical: Subject = { ...subject, object: "radical", data: { ...subject.data, characters: null, character_images: [{ url: "https://example.test/radical.svg" }] } };
  const view = render(<ReviewPromptCharacters subject={radical} />);
  expect(useRemoteSvg).toHaveBeenLastCalledWith("https://example.test/radical.svg", "#123456");
  view.rerender(<ReviewPromptCharacters subject={{ ...radical, id: 2, data: { ...radical.data, character_images: [] } }} />);
  expect(StyleSheet.flatten(view.getByText("Cat").props.style).color).toBe("#123456");
});
