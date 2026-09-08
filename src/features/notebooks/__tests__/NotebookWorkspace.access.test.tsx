import React from "react";
import { render } from "@testing-library/react-native";
import NotebookWorkspace from "../NotebookWorkspace";
import { useAuthStore } from "../../../utils/store";
import { useNotebooks } from "../use-notebooks";

jest.mock("expo-router", () => ({ Redirect: ({ href }: { href: string }) => { const { Text } = require("react-native"); return <Text>Redirect: {href}</Text>; }, router: {}, useLocalSearchParams: () => ({}) }));
jest.mock("../../../utils/store", () => ({ useAuthStore: jest.fn() }));
jest.mock("../../../utils/cache", () => ({ getAllSubjects: jest.fn().mockResolvedValue([]) }));
jest.mock("../use-notebooks", () => ({ useNotebooks: jest.fn() }));
jest.mock("../NotebookEditor.dom", () => () => null);
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

describe("notebook route access", () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([undefined, "", "visitor", "portego-copy", "Portego2000"])("blocks %s before reading notebook data, including in development", (username) => {
    jest.mocked(useAuthStore).mockImplementation((selector: any) => selector({ userData: username === undefined ? null : { username } }));
    const screen = render(<NotebookWorkspace />);
    expect(screen.getByText("Redirect: /")).toBeTruthy();
    expect(useNotebooks).not.toHaveBeenCalled();
  });

  it("also guards the standalone settings entry", () => {
    jest.mocked(useAuthStore).mockImplementation((selector: any) => selector({ userData: { username: "visitor" } }));
    const screen = render(<NotebookWorkspace showBackButton />);
    expect(screen.getByText("Redirect: /")).toBeTruthy();
    expect(useNotebooks).not.toHaveBeenCalled();
  });
});
