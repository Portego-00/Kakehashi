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

  it.each([
    { apiToken: null, userData: null },
    { apiToken: null, userData: { id: 42, username: "visitor" } },
    { apiToken: "token", userData: null },
    { apiToken: "token", userData: { username: "visitor" } },
  ])("requires a token and account before reading notebook data: %j", (auth) => {
    jest.mocked(useAuthStore).mockImplementation((selector: any) => selector(auth));
    const screen = render(<NotebookWorkspace />);
    expect(screen.getByText("Redirect: /")).toBeTruthy();
    expect(useNotebooks).not.toHaveBeenCalled();
  });

  it("also requires authentication for the standalone settings entry", () => {
    jest.mocked(useAuthStore).mockImplementation((selector: any) => selector({ apiToken: null, userData: null }));
    const screen = render(<NotebookWorkspace showBackButton />);
    expect(screen.getByText("Redirect: /")).toBeTruthy();
    expect(useNotebooks).not.toHaveBeenCalled();
  });
});
