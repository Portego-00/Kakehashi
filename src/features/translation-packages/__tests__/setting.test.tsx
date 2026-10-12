import { selectTranslationPackage } from "../import-file";
import { packageManager } from "../package-store";
import { parsePackageText } from "../resolver";
import data from "../../../../tests/fixtures/translation-packages/tr-learning-pilot.json";
jest.mock("../import-file", () => ({selectTranslationPackage: jest.fn()}));
import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { ContentLanguageSetting } from "../ContentLanguageSetting";
import { useLearningContentStore } from "../store";

jest.mock("../../../utils/theme", () => ({useTheme: () => ({theme: {
  textColor: "#111", textSecondary: "#555", primary: "#08f",
}})}));

it("lets the user turn Turkish content off and back on", () => {
  useLearningContentStore.setState({enabled: true});
  const screen = render(<ContentLanguageSetting />);
  const toggle = screen.getByLabelText("Use translation package");
  fireEvent(toggle, "valueChange", false);
  expect(useLearningContentStore.getState().enabled).toBe(false);
  expect(screen.getByLabelText("Use translation package").props.value).toBe(false);
  fireEvent(toggle, "valueChange", true);
  expect(useLearningContentStore.getState().enabled).toBe(true);
});

it("previews an imported file before activating it", async () => {
  await packageManager.reset();
  (selectTranslationPackage as jest.Mock).mockResolvedValueOnce(parsePackageText(JSON.stringify({...data, name: "Test paketi"})));
  const screen = render(<ContentLanguageSetting />);
  fireEvent.press(screen.getByText("Import translation file"));
  await waitFor(() => expect(screen.getByText("Use this package")).toBeTruthy());
  expect(packageManager.state.getState().packet).toBeNull();
  fireEvent.press(screen.getByText("Use this package"));
  await waitFor(() => expect(screen.getByText("Imported package")).toBeTruthy());
  expect(packageManager.state.getState().packet?.name).toBe("Test paketi");
  screen.unmount(); await packageManager.reset();
});
it("keeps current content after picker validation failure", async () => {
  await packageManager.hydrate();
  (selectTranslationPackage as jest.Mock).mockRejectedValueOnce(new Error("The file is not valid JSON."));
  const screen = render(<ContentLanguageSetting />);
  fireEvent.press(screen.getByText("Import translation file"));
  await waitFor(() => expect(screen.getByText("The file is not valid JSON.")).toBeTruthy());
  expect(packageManager.state.getState().packet).toBeNull();
});

it("shows no demo content when no package is loaded", async () => {
 await packageManager.reset();
 const screen=render(<ContentLanguageSetting/>);
 expect(screen.getByText("No translation package loaded")).toBeTruthy();
 expect(screen.queryByText("Restore bundled content")).toBeNull();
});

it("keeps package details collapsed and compresses contiguous levels", async () => {
 await packageManager.activate(parsePackageText(JSON.stringify({...data,name:"Hidden long package name"})));
 const screen=render(<ContentLanguageSetting/>);
 expect(screen.queryByText(/Hidden long package name/)).toBeNull();
 fireEvent.press(screen.getByText("Package details"));expect(screen.getByText(/Hidden long package name/)).toBeTruthy();
 screen.unmount();await packageManager.reset();
});
