/* eslint-disable @typescript-eslint/no-require-imports -- Jest mock factories load their runtime dependencies after hoisting. */
import React from "react";
import { ActivityIndicator, StyleSheet } from "react-native";
import { act, fireEvent, render } from "@testing-library/react-native";
import NotebookWorkspace from "../NotebookWorkspace";
import { NotebookEditorSession } from "../NotebookEditorSession";
import { useNotebooks } from "../use-notebooks";
import { DEFAULT_NOTEBOOK_LIMITS, type NotebookPage } from "../model";

let mockIsDark = true;

jest.mock("expo-router", () => ({
  Redirect: () => null,
  router: { back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => ({}),
}));
jest.mock("@react-navigation/native", () => ({ useIsFocused: () => true }));
jest.mock("../../../utils/store", () => ({
  useAuthStore: (selector: (state: object) => unknown) => selector({ userData: { username: "Portego" } }),
}));
jest.mock("../../../utils/theme", () => ({
  useTheme: () => ({ isDark: mockIsDark, theme: {
    cardBackground: mockIsDark ? "#1e1e1e" : "#ffffff", backgroundColor: "#111111", textColor: "#ffffff",
    textSecondary: "#aaaaaa", textLight: "#888888", primary: "#2288ff", border: "#333333", error: "#ff5555",
  } }),
}));
jest.mock("../../../utils/cache", () => ({ getAllSubjects: jest.fn().mockResolvedValue([]) }));
jest.mock("../use-notebooks", () => ({ useNotebooks: jest.fn() }));
jest.mock("../NotebookEditorSession", () => ({
  NotebookEditorSession: jest.fn(() => { const { View } = require("react-native"); return <View testID="embedded-notebook-editor" />; }),
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: require("react-native").View }));

const firstPage: NotebookPage = {
  id: "first", title: "First page", icon: "", parentId: null, content: [],
  favorite: false, trashedAt: null, sortOrder: 0, revision: 0,
  createdAt: "2026-09-08T10:00:00Z", updatedAt: "2026-09-08T10:00:00Z",
};
const secondPage: NotebookPage = { ...firstPage, id: "second", title: "Second page", sortOrder: 1 };
const currentEditor = () => jest.mocked(NotebookEditorSession).mock.calls.at(-1)![0];

describe("notebook loading surface", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsDark = true;
    jest.mocked(useNotebooks).mockReturnValue({
      accountId: "portego-account", state: { version: 1, pages: [firstPage, secondPage], sentences: [] },
      revision: 0, limits: DEFAULT_NOTEBOOK_LIMITS, available: true, loading: false,
      saveStatus: "saved", error: null, drafts: {},
      persistDrafts: jest.fn().mockResolvedValue(undefined),
      flushDrafts: jest.fn().mockResolvedValue(undefined),
      mutate: jest.fn(), refresh: jest.fn(), updatePageDraft: jest.fn(),
      discardDraft: jest.fn(), duplicateDraft: jest.fn(),
    });
  });

  it.each([true, false])("covers the full editor with its theme until ready (dark: %s)", async (isDark) => {
    mockIsDark = isDark;
    const screen = render(<NotebookWorkspace />);
    await act(async () => fireEvent.press(screen.getByLabelText("Open First page")));

    const backgroundColor = isDark ? "#1e1e1e" : "#ffffff";
    expect(StyleSheet.flatten(screen.getByTestId("notebook-editor-loading").props.style)).toMatchObject({
      position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor,
    });
    expect(screen.getByTestId("embedded-notebook-editor")).toBeTruthy();
    expect(StyleSheet.flatten(currentEditor().dom?.style)).toMatchObject({ backgroundColor });
    expect(StyleSheet.flatten(currentEditor().dom?.containerStyle)).toMatchObject({ backgroundColor });
    expect(currentEditor().dom?.injectedJavaScriptBeforeContentLoaded).toEqual(expect.any(String));
    expect(screen.getByText("Opening page…")).toBeTruthy();

    await act(async () => currentEditor().onReady?.());
    expect(screen.queryByTestId("notebook-editor-loading")).toBeNull();
    expect(screen.getByTestId("embedded-notebook-editor")).toBeTruthy();
  });

  it("ignores a previous page's late readiness signal", async () => {
    const screen = render(<NotebookWorkspace />);
    await act(async () => fireEvent.press(screen.getByLabelText("Open First page")));
    const previousEditor = currentEditor();
    await act(async () => previousEditor.onOpenPage("second"));
    expect(currentEditor().page.id).toBe("second");

    await act(async () => previousEditor.onReady?.());
    expect(screen.getByTestId("notebook-editor-loading")).toBeTruthy();
    await act(async () => currentEditor().onReady?.());
    expect(screen.queryByTestId("notebook-editor-loading")).toBeNull();
  });

  it("waits for a fresh editor when reopening the same page", async () => {
    const screen = render(<NotebookWorkspace />);
    await act(async () => fireEvent.press(screen.getByLabelText("Open First page")));
    const previousVisit = currentEditor();
    await act(async () => previousVisit.onReady?.());
    await act(async () => fireEvent.press(screen.getByLabelText("Back to notebooks")));
    await act(async () => fireEvent.press(screen.getByLabelText("Open First page")));

    expect(screen.getByTestId("notebook-editor-loading")).toBeTruthy();
    await act(async () => previousVisit.onReady?.());
    expect(screen.getByTestId("notebook-editor-loading")).toBeTruthy();
    await act(async () => currentEditor().onReady?.());
    expect(screen.queryByTestId("notebook-editor-loading")).toBeNull();
  });

  it("keeps a failed WebView covered and waits for the retried editor", async () => {
    const screen = render(<NotebookWorkspace />);
    await act(async () => fireEvent.press(screen.getByLabelText("Open First page")));
    const failedEditor = currentEditor();
    await act(async () => failedEditor.onError?.("The editor could not load."));

    expect(screen.getByText("The editor could not load.")).toBeTruthy();
    expect(screen.getByTestId("notebook-editor-loading")).toBeTruthy();
    expect(screen.queryByText("Opening page…")).toBeNull();
    expect(screen.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0);

    await act(async () => fireEvent.press(screen.getByText("Retry")));
    expect(screen.getByText("Opening page…")).toBeTruthy();
    await act(async () => failedEditor.onReady?.());
    expect(screen.getByTestId("notebook-editor-loading")).toBeTruthy();
    await act(async () => currentEditor().onReady?.());
    expect(screen.queryByTestId("notebook-editor-loading")).toBeNull();
  });
});
