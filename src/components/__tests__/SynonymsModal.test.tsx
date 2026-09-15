import { act, fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { SynonymsModal } from "../SynonymsModal";

jest.mock("../../utils/theme", () => ({ useTheme: () => ({ theme: {} }) }));
jest.mock("../../utils/subjectColors", () => ({ useSubjectColors: () => ({ vocabulary: "purple" }) }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-blur", () => ({ BlurView: () => null }));

it("preserves the draft when progression rerenders a card with a new synonyms array", async () => {
  const save = jest.fn(async () => {});
  const props = { visible: true, onClose: jest.fn(), onSave: save };
  const screen = render(<SynonymsModal {...props} currentSynonyms={["grown-up"]} />);
  fireEvent.changeText(screen.getByPlaceholderText("Enter a synonym..."), "mature person");
  fireEvent.press(screen.getByText("Add"));
  fireEvent.changeText(screen.getByPlaceholderText("Enter a synonym..."), "draft in progress");
  screen.rerender(<SynonymsModal {...props} currentSynonyms={["grown-up"]} />);

  expect(screen.getByText("mature person")).toBeTruthy();
  expect(screen.getByPlaceholderText("Enter a synonym...").props.value).toBe("draft in progress");
  await act(async () => { fireEvent.press(screen.getByText("Save")); });
  expect(save).toHaveBeenCalledWith(["grown-up", "mature person"], ["grown-up"]);
});

it("merges late-arriving existing synonyms into the open draft", async () => {
  const save = jest.fn(async () => {});
  const props = { visible: true, onClose: jest.fn(), onSave: save };
  const screen = render(<SynonymsModal {...props} currentSynonyms={[]} />);
  fireEvent.changeText(screen.getByPlaceholderText("Enter a synonym..."), "mature person");
  fireEvent.press(screen.getByText("Add"));
  screen.rerender(<SynonymsModal {...props} currentSynonyms={["grown-up"]} />);

  expect(screen.getByText("grown-up")).toBeTruthy();
  expect(screen.getByText("mature person")).toBeTruthy();
  await act(async () => { fireEvent.press(screen.getByText("Save")); });
  expect(save).toHaveBeenCalledWith(["grown-up", "mature person"], ["grown-up"]);
});
