import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";
import CustomVocabularyLayout from "../../../../app/(app)/custom-vocabulary/_layout";

let mockAuth = {
  apiToken: "test-token" as string | null,
  userData: { username: "Portego" } as { username: string } | null,
  isLoading: false,
};

jest.mock("../../../utils/store", () => ({ useAuthStore: () => mockAuth }));
jest.mock("../../../utils/theme", () => ({
  useTheme: () => ({ theme: { backgroundColor: "#000", primary: "#93f", headerBackground: "#111", headerText: "#fff" } }),
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }) }));
jest.mock("expo-router", () => {
  const React = jest.requireActual("react");
  const { View, Text } = jest.requireActual("react-native");
  const Stack = ({ children }: { children: React.ReactNode }) =>
    React.createElement(View, { testID: "custom-route-stack" }, children);
  Stack.Screen = function MockStackScreen() { return null; };
  return {
    Stack,
    router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
    Redirect: ({ href }: { href: string }) => React.createElement(Text, { testID: "redirect" }, href),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth = { apiToken: "test-token", userData: { username: "Portego" }, isLoading: false };
});

it.each(["Portego", "portego", " PORTEGO "])("allows the configured account (%s)", (username) => {
  mockAuth.userData = { username };
  expect(render(<CustomVocabularyLayout />).getByTestId("custom-route-stack")).toBeTruthy();
});

it.each(["AnotherUser", "Portego2", ""]) ("blocks direct links for %s", (username) => {
  mockAuth.userData = { username };
  const screen = render(<CustomVocabularyLayout />);
  expect(screen.queryByTestId("custom-route-stack")).toBeNull();
  expect(screen.getByTestId("redirect").props.children).toBe("/(app)/(tabs)");
});

it("hides an open screen on account change or logout", () => {
  const screen = render(<CustomVocabularyLayout />);
  mockAuth.userData = { username: "AnotherUser" };
  screen.rerender(<CustomVocabularyLayout />);
  expect(screen.queryByTestId("custom-route-stack")).toBeNull();
  mockAuth.userData = { username: "Portego" };
  mockAuth.apiToken = null;
  screen.rerender(<CustomVocabularyLayout />);
  expect(screen.queryByTestId("custom-route-stack")).toBeNull();
});

it("waits for restored identity before mounting protected screens", () => {
  mockAuth.userData = null;
  const screen = render(<CustomVocabularyLayout />);
  expect(screen.getByLabelText("Checking access")).toBeTruthy();
  expect(screen.queryByTestId("custom-route-stack")).toBeNull();
});

it("allows back during identity restoration without exposing protected content", () => {
  mockAuth.userData = null;
  const screen = render(<CustomVocabularyLayout />);
  fireEvent.press(screen.getByLabelText("Go back"));
  expect(router.back).toHaveBeenCalledTimes(1);
  expect(router.replace).not.toHaveBeenCalled();
  expect(screen.queryByTestId("custom-route-stack")).toBeNull();
});
