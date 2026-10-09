import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import BunproTab from "../(app)/(bunpro-tabs)/index";
import { getBunproDashboard, getStoredBunproApiToken } from "../../src/utils/bunproApi";

let mockFocused = true;
const mockAuth = { userData: { id: 1, username: "Portego" } };
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useFocusEffect: (callback: () => (() => void) | undefined) => jest.requireActual<typeof import("react")>("react").useEffect(() => mockFocused ? callback() : undefined, [callback, mockFocused]),
}));
jest.mock("../../src/utils/store", () => ({ useAuthStore: () => mockAuth }));
jest.mock("../../src/utils/bunproApi", () => ({
  BunproApiError: class extends Error {},
  getBunproDashboard: jest.fn(),
  getStoredBunproApiToken: jest.fn(),
}));
jest.mock("../../src/utils/theme", () => ({ useTheme: () => ({ isDark: false, theme: { primary: "#a00", textColor: "#222", textSecondary: "#666", border: "#ddd", backgroundColor: "#fff", headerBackground: "#a00", headerText: "#fff", error: "#a00" } }) }));
jest.mock("../../src/utils/nativeTabs", () => ({ supportsNativeTabs: () => false }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));
jest.mock("../../src/components/GlassButton", () => ({ GlassButton: () => null }));
jest.mock("../../src/components/SwitchModeIcons", () => ({ WanikaniSwitchIcon: () => null }));
jest.mock("../../src/components/bunpro/BunproActivityCard", () => () => null);
jest.mock("../../src/components/bunpro/BunproForecastCard", () => () => null);
jest.mock("../../src/components/bunpro/BunproJlptProgressCard", () => () => null);
jest.mock("../../src/components/bunpro/BunproProgressCard", () => () => null);
jest.mock("../../src/components/bunpro/BunproStudyQueueCard", () => () => null);

beforeEach(() => {
  jest.clearAllMocks();
  mockFocused = true;
  mockAuth.userData = { id: 1, username: "Portego" };
  jest.mocked(getStoredBunproApiToken).mockResolvedValue(null);
  jest.mocked(getBunproDashboard).mockRejectedValue(new Error("Fixture unavailable"));
});

it("routes connection management to the Bunpro reviews section without a duplicate key editor", async () => {
  const view = render(<BunproTab />);
  await act(async () => {});
  expect(getBunproDashboard).not.toHaveBeenCalled();
  expect(view.queryByPlaceholderText("Paste Bunpro API token")).toBeNull();
  fireEvent.press(view.getByLabelText("Open Bunpro review settings"));
  expect(router.push).toHaveBeenCalledWith({ pathname: "/settings", params: { scrollTo: "bunproReviews" } });
});

it("reads a changed key after returning from Settings and clears the connection after removal", async () => {
  jest.mocked(getStoredBunproApiToken).mockResolvedValue("first-key");
  const view = render(<BunproTab />);
  await waitFor(() => expect(getBunproDashboard).toHaveBeenCalledWith(expect.objectContaining({ apiToken: "first-key" })));
  const originalSignal = jest.mocked(getBunproDashboard).mock.calls[0][0]?.signal;
  mockFocused = false;
  view.rerender(<BunproTab />);
  expect(originalSignal?.aborted).toBe(true);
  jest.mocked(getStoredBunproApiToken).mockResolvedValue("replacement-key");
  mockFocused = true;
  view.rerender(<BunproTab />);
  await waitFor(() => expect(getBunproDashboard).toHaveBeenLastCalledWith(expect.objectContaining({ apiToken: "replacement-key" })));
  mockFocused = false;
  view.rerender(<BunproTab />);
  jest.mocked(getStoredBunproApiToken).mockResolvedValue(null);
  mockFocused = true;
  view.rerender(<BunproTab />);
  await act(async () => {});
  expect(getBunproDashboard).toHaveBeenCalledTimes(2);
  expect(view.getByText("Add your API key in Settings to connect Bunpro.")).toBeTruthy();
});

it("does not read Bunpro credentials for accounts outside the rollout", async () => {
  mockAuth.userData.username = "SomeoneElse";
  const view = render(<BunproTab />);
  await act(async () => {});
  expect(view.queryByLabelText("Open Bunpro review settings")).toBeNull();
  expect(getStoredBunproApiToken).not.toHaveBeenCalled();
  expect(getBunproDashboard).not.toHaveBeenCalled();
});
