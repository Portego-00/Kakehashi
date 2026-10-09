import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { BunproCoverage } from "../bunpro-coverage";
import { getBunproCoverage, saveBunproCoverage } from "../../../utils/bunproApi";

jest.mock("../../../utils/theme", () => ({ useTheme: () => ({ theme: { textColor: "black", textSecondary: "gray", border: "gray", cardBackground: "white", backgroundColor: "white", error: "red" } }) }));
jest.mock("../../../utils/bunproApi", () => ({ getBunproCoverage: jest.fn(async () => []), saveBunproCoverage: jest.fn() }));
const vocabulary = [1, 2].map(id => ({ id: String(id), type: "reviewable_base_attribute_mixed", attributes: { id, type_snake: "vocab", title: `Word ${id}`, meaning: `Meaning ${id}`, kana: `Reading ${id}` } }));
beforeEach(() => jest.clearAllMocks());

it("saves coverage grades by group and retries only the groups still unsaved", async () => {
  jest.mocked(saveBunproCoverage).mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce({});
  const view = render(<BunproCoverage vocabulary={vocabulary} deckId={5} />);
  await waitFor(() => expect(view.getByLabelText("Knowledge Check").props.accessibilityState?.disabled).toBe(false));
  fireEvent.press(view.getByLabelText("Knowledge Check"));
  fireEvent.press(view.getByText("Show meaning")); fireEvent.press(view.getByText("Beginner"));
  fireEvent.press(view.getByText("Show meaning")); fireEvent.press(view.getByText("Master"));
  fireEvent.press(view.getByText("Save progress"));
  await waitFor(() => expect(view.getByText("Offline")).toBeTruthy());
  fireEvent.press(view.getByText("Save progress"));
  await waitFor(() => expect(saveBunproCoverage).toHaveBeenCalledTimes(3));
  expect(saveBunproCoverage).toHaveBeenNthCalledWith(1, [1], 0, 5);
  expect(saveBunproCoverage).toHaveBeenNthCalledWith(2, [2], 12, 5);
  expect(saveBunproCoverage).toHaveBeenNthCalledWith(3, [2], 12, 5);
  await waitFor(() => expect(getBunproCoverage).toHaveBeenCalledTimes(2));
});
it("leaves skipped vocabulary unchanged", async () => {
  const view = render(<BunproCoverage vocabulary={vocabulary} />);
  await waitFor(() => expect(view.getByLabelText("Knowledge Check").props.accessibilityState?.disabled).toBe(false));
  fireEvent.press(view.getByLabelText("Knowledge Check"));
  fireEvent.press(view.getByText("Skip")); fireEvent.press(view.getByText("Skip"));
  fireEvent.press(view.getByText("Save progress"));
  await waitFor(() => expect(view.queryByText("Save progress")).toBeNull());
  expect(saveBunproCoverage).not.toHaveBeenCalled();
});
