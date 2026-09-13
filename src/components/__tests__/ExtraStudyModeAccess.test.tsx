import { render } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";
import ExtraStudyModeAccess from "../ExtraStudyModeAccess";

const mockAuthState: {
  userData: { username: string } | null;
  isLoading: boolean;
} = { userData: null, isLoading: false };

jest.mock("../../utils/store", () => ({
  useAuthStore: (selector: (state: typeof mockAuthState) => unknown) =>
    selector(mockAuthState),
}));
jest.mock("expo-router", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Text } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    Redirect: ({ href }: { href: string }) =>
      React.createElement(Text, { testID: "redirect" }, href),
  };
});

const mountSession = jest.fn();
function Session() {
  React.useEffect(() => {
    mountSession();
  }, []);
  return <Text>Audio vocabulary session</Text>;
}
function protectedSession() {
  return (
    <ExtraStudyModeAccess modeId="audio-vocab">
      <Session />
    </ExtraStudyModeAccess>
  );
}

beforeEach(() => {
  mockAuthState.userData = null;
  mockAuthState.isLoading = false;
  mountSession.mockClear();
});

it.each([null, "another-user"])(
  "allows Audio Vocab for %s without a username restriction",
  (username) => {
    mockAuthState.userData = username ? { username } : null;
    const screen = render(protectedSession());
    expect(screen.queryByTestId("redirect")).toBeNull();
    expect(screen.getByText("Audio vocabulary session")).toBeTruthy();
    expect(mountSession).toHaveBeenCalledTimes(1);
  },
);

it("waits for account loading before mounting Audio Vocab", () => {
  mockAuthState.isLoading = true;
  const screen = render(protectedSession());
  expect(screen.queryByTestId("redirect")).toBeNull();
  expect(mountSession).not.toHaveBeenCalled();
  mockAuthState.userData = { username: "another-user" };
  mockAuthState.isLoading = false;
  screen.rerender(protectedSession());
  expect(screen.getByText("Audio vocabulary session")).toBeTruthy();
  expect(mountSession).toHaveBeenCalledTimes(1);
});

it("keeps Audio Vocab available when switching away from Portego", () => {
  mockAuthState.userData = { username: "Portego" };
  const screen = render(protectedSession());
  expect(screen.getByText("Audio vocabulary session")).toBeTruthy();
  mockAuthState.userData = { username: "another-user" };
  screen.rerender(protectedSession());
  expect(screen.getByText("Audio vocabulary session")).toBeTruthy();
  expect(screen.queryByTestId("redirect")).toBeNull();
});
