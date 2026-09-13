/* eslint-disable @typescript-eslint/no-require-imports -- Jest mock factories are hoisted and must load their runtime dependencies locally. */
import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import TabsLayout from "../../../../app/(app)/(tabs)/_layout";
import { useNotebooks } from "../use-notebooks";
import { DEFAULT_NOTEBOOK_LIMITS, type NotebookPage } from "../model";

let mockUsername = "Portego";
let mockFocused = true;
let mockNativeTabs = true;
let mockWorkspaceMounted = true;

// The native navigator owns the bar; mount the actual selected route beneath it.
// This keeps the test focused on the real layout/editor visibility contract.
jest.mock("expo-router/unstable-native-tabs", () => {
  const React = require("react");
  const { Text, View } = require("react-native");
  const NativeTabs = ({ hidden }: { hidden?: boolean }) => {
    const Workspace = require("../NotebookWorkspace").default;
    return <View>{!hidden ? <Text>Bottom tabs</Text> : null}{mockWorkspaceMounted ? <Workspace /> : null}</View>;
  };
  NativeTabs.Trigger = Object.assign(() => null, { Icon: () => null, Label: () => null });
  return { NativeTabs };
});
jest.mock("expo-router", () => {
  const React = require("react");
  const { Text, View, StyleSheet } = require("react-native");
  const Tabs = ({ screenOptions }: { screenOptions?: { tabBarStyle?: object } }) => {
    const Workspace = require("../NotebookWorkspace").default;
    const hidden = StyleSheet.flatten(screenOptions?.tabBarStyle)?.display === "none";
    return <View>{!hidden ? <Text>Bottom tabs</Text> : null}{mockWorkspaceMounted ? <Workspace /> : null}</View>;
  };
  Tabs.Screen = function MockTabScreen() { return null; };
  return {
    Tabs,
    Redirect: ({ href }: { href: string }) => <Text>Redirect: {href}</Text>,
    router: { back: jest.fn(), push: jest.fn() },
    useLocalSearchParams: () => ({}),
  };
});
jest.mock("@react-navigation/native", () => ({ useIsFocused: () => mockFocused }));
jest.mock("../../../utils/store", () => ({
  useAuthStore: (selector?: (state: object) => unknown) => {
    const state = { userData: { username: mockUsername } };
    return selector ? selector(state) : state;
  },
  useSettingsStore: () => ({ gravatarEmail: "", customTabOrder: ["home", "notebooks"] }),
}));
jest.mock("../../../utils/theme", () => ({
  useTheme: () => ({ isDark: true, themeMode: "dark", theme: {
    cardBackground: "#202020", backgroundColor: "#111111", textColor: "#ffffff",
    textSecondary: "#aaaaaa", textLight: "#888888", primary: "#2288ff", border: "#333333", error: "#ff5555",
  } }),
}));
jest.mock("../../../utils/nativeTabs", () => ({ supportsNativeTabs: () => mockNativeTabs }));
jest.mock("../../../hooks/useFeatureFlags", () => ({ useFeatureFlag: () => false }));
jest.mock("../../../utils/cache", () => ({ getAllSubjects: jest.fn().mockResolvedValue([]) }));
jest.mock("../use-notebooks", () => ({ useNotebooks: jest.fn() }));
jest.mock("../NotebookEditorSession", () => ({
  NotebookEditorSession: () => { const { Text } = require("react-native"); return <Text>Notebook editor controls</Text>; },
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: require("react-native").View,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 34, left: 0 }),
}));

const page: NotebookPage = {
  id: "page", title: "Japanese notes", icon: "", parentId: null, content: [],
  favorite: false, trashedAt: null, sortOrder: 0, revision: 0,
  createdAt: "2026-09-08T10:00:00Z", updatedAt: "2026-09-08T10:00:00Z",
};

function createStore(): ReturnType<typeof useNotebooks> {
  return {
    accountId: "portego-account", state: { version: 1, pages: [page], sentences: [] },
    revision: 0, limits: DEFAULT_NOTEBOOK_LIMITS, available: true, loading: false,
    saveStatus: "saved", error: null, drafts: {},
    persistDrafts: jest.fn().mockResolvedValue(undefined),
    flushDrafts: jest.fn().mockResolvedValue(undefined),
    mutate: jest.fn(), refresh: jest.fn(), updatePageDraft: jest.fn(),
    discardDraft: jest.fn(), duplicateDraft: jest.fn(),
  };
}

describe("notebook editor bottom tabs", () => {
  let store: ReturnType<typeof useNotebooks>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUsername = "Portego";
    mockFocused = true;
    mockNativeTabs = true;
    mockWorkspaceMounted = true;
    store = createStore();
    jest.mocked(useNotebooks).mockReturnValue(store);
  });

  it.each([true, false])("hides the bar only while a notebook is open (native tabs: %s)", async (nativeTabs) => {
    mockNativeTabs = nativeTabs;
    const screen = render(<TabsLayout />);
    expect(screen.getByText("Bottom tabs")).toBeTruthy();
    expect(screen.queryByText("Notebook editor controls")).toBeNull();
    fireEvent.changeText(screen.getByLabelText("Search notebook pages"), "Japanese");

    await act(async () => fireEvent.press(screen.getByLabelText("Open Japanese notes")));
    expect(screen.getByText("Notebook editor controls")).toBeTruthy();
    expect(screen.queryByText("Bottom tabs")).toBeNull();

    await act(async () => fireEvent.press(screen.getByLabelText("Back to notebooks")));
    expect(screen.queryByText("Notebook editor controls")).toBeNull();
    expect(screen.getByText("Bottom tabs")).toBeTruthy();
    expect(screen.getByLabelText("Search notebook pages").props.value).toBe("Japanese");
    expect(store.persistDrafts).toHaveBeenCalledTimes(2);
  });

  it("keeps the bar hidden when local draft persistence prevents leaving the editor", async () => {
    const screen = render(<TabsLayout />);
    await act(async () => fireEvent.press(screen.getByLabelText("Open Japanese notes")));
    jest.mocked(store.persistDrafts).mockRejectedValueOnce(new Error("Device storage unavailable"));
    await act(async () => fireEvent.press(screen.getByLabelText("Back to notebooks")));
    expect(screen.getByText("Notebook editor controls")).toBeTruthy();
    expect(screen.getByText("Your changes couldn't be saved on this device. Try again before leaving this page.")).toBeTruthy();
    expect(screen.queryByText("Bottom tabs")).toBeNull();
  });

  it("restores the bar on blur and hides it again when the open editor regains focus", async () => {
    const screen = render(<TabsLayout />);
    await act(async () => fireEvent.press(screen.getByLabelText("Open Japanese notes")));
    expect(screen.queryByText("Bottom tabs")).toBeNull();
    mockFocused = false;
    screen.rerender(<TabsLayout />);
    expect(screen.getByText("Bottom tabs")).toBeTruthy();
    mockFocused = true;
    screen.rerender(<TabsLayout />);
    expect(screen.queryByText("Bottom tabs")).toBeNull();
  });

  it("releases the hidden bar when the notebook route unmounts", async () => {
    const screen = render(<TabsLayout />);
    await act(async () => fireEvent.press(screen.getByLabelText("Open Japanese notes")));
    expect(screen.queryByText("Bottom tabs")).toBeNull();
    mockWorkspaceMounted = false;
    screen.rerender(<TabsLayout />);
    expect(screen.getByText("Bottom tabs")).toBeTruthy();
  });

  it("releases the hidden bar when the account loses notebook access", async () => {
    const screen = render(<TabsLayout />);
    await act(async () => fireEvent.press(screen.getByLabelText("Open Japanese notes")));
    expect(screen.queryByText("Bottom tabs")).toBeNull();
    mockUsername = "visitor";
    screen.rerender(<TabsLayout />);
    expect(screen.getByText("Redirect: /")).toBeTruthy();
    expect(screen.getByText("Bottom tabs")).toBeTruthy();
  });

  it("does not read notebooks or hide the bar for unauthorized accounts", () => {
    mockUsername = "visitor";
    const screen = render(<TabsLayout />);
    expect(screen.getByText("Redirect: /")).toBeTruthy();
    expect(screen.getByText("Bottom tabs")).toBeTruthy();
    expect(useNotebooks).not.toHaveBeenCalled();
  });
});
