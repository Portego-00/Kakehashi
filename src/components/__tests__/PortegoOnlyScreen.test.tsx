import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";
import PortegoOnlyScreen from "../PortegoOnlyScreen";

const mockBack = jest.fn();
let mockUsername: string | null = null;

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("expo-router", () => ({
  router: { back: () => mockBack() },
}));

jest.mock("expo-status-bar", () => ({
  StatusBar: () => null,
}));

jest.mock("../../utils/store", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({
      userData: mockUsername ? { username: mockUsername } : null,
    }),
}));

jest.mock("../../utils/theme", () => ({
  useTheme: () => ({
    theme: {
      backgroundColor: "#ffffff",
      border: "#dddddd",
      statusBarStyle: "dark",
      textColor: "#111111",
      textSecondary: "#666666",
    },
  }),
}));

describe("PortegoOnlyScreen", () => {
  beforeEach(() => {
    mockUsername = null;
    mockBack.mockClear();
  });

  it("hides its content from other accounts", () => {
    mockUsername = "someone-else";
    const screen = render(
      <PortegoOnlyScreen featureName="JLPT Quiz">
        <Text>Protected content</Text>
      </PortegoOnlyScreen>,
    );

    expect(screen.queryByText("Protected content")).toBeNull();
    expect(
      screen.getByText(
        "JLPT Quiz is currently available only to the Portego account.",
      ),
    ).toBeTruthy();

    fireEvent.press(screen.getByLabelText("Go back"));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("renders its content for Portego without case sensitivity", () => {
    mockUsername = " portEGO ";
    const screen = render(
      <PortegoOnlyScreen featureName="JLPT Quiz">
        <Text>Protected content</Text>
      </PortegoOnlyScreen>,
    );

    expect(screen.getByText("Protected content")).toBeTruthy();
    expect(screen.queryByTestId("portego-only-screen")).toBeNull();
  });
});
