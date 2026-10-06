import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";
import EpubReaderScreen from "../../../app/(app)/epub-reader";
import { epubLibraryService } from "../../services/epubLibraryService";
import { epubAnnotations } from "../../services/epub/annotations";

const mockInject = jest.fn();
jest.mock("react-native-webview", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual("react-native");
  const MockWebView = React.forwardRef((props: any, ref: React.ForwardedRef<unknown>) => {
    React.useImperativeHandle(ref, () => ({ injectJavaScript: mockInject }));
    return <View {...props} testID="epub-webview" />;
  });
  MockWebView.displayName = "MockWebView";
  return { __esModule: true, default: MockWebView };
});
jest.mock("expo-router", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    router: { back: jest.fn(), push: jest.fn() },
    Stack: { Screen: () => null },
    useLocalSearchParams: () => ({ bookId: "book-a" }),
    useFocusEffect: (callback: () => (() => void)) => React.useEffect(callback, [callback]),
  };
});
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }) }));
jest.mock("../../hooks/useActivityTracking", () => ({ useActivityTracking: jest.fn() }));
jest.mock("../../utils/cache", () => ({ getAllSubjects: jest.fn(async () => []) }));
jest.mock("../../utils/fonts", () => ({ fontStyles: {} }));
jest.mock("../../utils/subjectColors", () => ({ withAlpha: (color: string) => color }));
jest.mock("../../utils/theme", () => ({ useTheme: () => ({ theme: { backgroundColor: "#fff", cardBackground: "#fff", textColor: "#111", textSecondary: "#666", primary: "#923", border: "#ddd", error: "#b00", isDark: false } }) }));
jest.mock("../../utils/textHighlighting", () => ({ isWaniKaniBackedMatch: () => false }));
jest.mock("../../services/readingGoalsService", () => ({ readingGoalsService: { addReadingSeconds: jest.fn(async () => {}) } }));
jest.mock("../../services/epubLibraryService", () => ({ epubLibraryService: {
  getBook: jest.fn(async () => ({ metadata: { id: "book-a", title: "My book", lastReadPage: 4, estimatedPages: 20 }, htmlUri: "file:///book-a.html" })),
  updateReadingProgress: jest.fn(async () => {}),
  flushReadingProgress: jest.fn(async () => {}),
} }));
jest.mock("../../services/epub/annotations", () => ({ epubAnnotations: {
  load: jest.fn(async () => []), save: jest.fn(async () => {}),
} }));

const passage = { start: { sectionId: "chapter-1", offset: 2 }, end: { sectionId: "chapter-1", offset: 5 } };

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.mocked(epubAnnotations.load).mockResolvedValue([]);
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

async function openReader() {
  const view = render(<EpubReaderScreen />);
  await waitFor(() => expect(view.getByTestId("epub-webview")).toBeTruthy());
  const send = (type: string, payload: object) => fireEvent(view.getByTestId("epub-webview"), "message", { nativeEvent: { data: JSON.stringify({ type, payload }) } });
  send("ready", { page: 4, totalPages: 20 });
  act(() => jest.advanceTimersByTime(221));
  return { view, send };
}

it("saves the final page on exit before the debounce expires", async () => {
  const { view, send } = await openReader();
  expect(view.getByTestId("epub-webview").props.injectedJavaScriptBeforeContentLoaded).toContain("= 4");
  send("page", { page: 7, totalPages: 20 });
  view.unmount();
  await act(async () => { await Promise.resolve(); });
  expect(epubLibraryService.updateReadingProgress).toHaveBeenLastCalledWith("book-a", 7, 20);
});

it("flushes the final page when the app backgrounds", async () => {
  let onAppState!: (state: AppStateStatus) => void;
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
    onAppState = listener;
    return { remove: jest.fn() };
  });
  Object.defineProperty(AppState, "currentState", { configurable: true, value: "active" });
  const { send } = await openReader();
  send("page", { page: 8, totalPages: 20 });
  await act(async () => { onAppState("background"); });
  expect(epubLibraryService.updateReadingProgress).toHaveBeenLastCalledWith("book-a", 8, 20);
});

it("restores through the ready bridge if the initial injection arrives too late", async () => {
  const view = render(<EpubReaderScreen />);
  await waitFor(() => expect(view.getByTestId("epub-webview")).toBeTruthy());
  const send = (type: string, page: number) => fireEvent(view.getByTestId("epub-webview"), "message", { nativeEvent: { data: JSON.stringify({ type, payload: { page, totalPages: 20 } }) } });
  send("ready", 1);
  send("page", 1);
  expect(mockInject.mock.calls.some(([script]) => script.includes("goTo?.(4, false)"))).toBe(true);
  act(() => jest.advanceTimersByTime(500));
  expect(epubLibraryService.updateReadingProgress).not.toHaveBeenCalled();
  send("page", 4);
  view.unmount();
  await act(async () => { await Promise.resolve(); });
  expect(epubLibraryService.updateReadingProgress).toHaveBeenLastCalledWith("book-a", 4, 20);
});

it("keeps highlights and the passage list hidden until requested", async () => {
  const { view, send } = await openReader();
  expect(view.queryByText("Highlight")).toBeNull();
  expect(view.queryByText("Saved passages")).toBeNull();
  fireEvent.press(view.getByLabelText("Bookmark this page"));
  send("bookmark", { page: 4, text: "日本語", passage });
  await waitFor(() => expect(view.getByLabelText("Remove bookmark from this page")).toBeTruthy());
  expect(epubAnnotations.save).toHaveBeenLastCalledWith("book-a", [expect.objectContaining({ kind: "bookmark", page: 4, text: "日本語", passage })]);
  fireEvent.press(view.getByLabelText("Open bookmarks and highlights"));
  expect(view.getByText("Saved passages")).toBeTruthy();
  expect(view.getByText("日本語")).toBeTruthy();
  fireEvent.press(view.getByLabelText("Delete bookmark on page 4"));
  await waitFor(() => expect(view.getByText("No bookmarks yet")).toBeTruthy());
});

it("saves a selected passage, then removes the selection action", async () => {
  const { view, send } = await openReader();
  send("selection", { page: 4, text: "日本語", passage });
  fireEvent.press(view.getByLabelText("Highlight selected passage"));
  await waitFor(() => expect(view.queryByLabelText("Highlight selected passage")).toBeNull());
  expect(epubAnnotations.save).toHaveBeenLastCalledWith("book-a", [expect.objectContaining({ kind: "highlight", text: "日本語", passage })]);
  expect(mockInject.mock.calls.some(([script]) => script.includes("setAnnotations") && script.includes('"kind":"highlight"'))).toBe(true);
});

it("keeps the existing bookmark when deleting it fails", async () => {
  jest.mocked(epubAnnotations.load).mockResolvedValueOnce([{ id: "existing", kind: "bookmark", page: 4, text: "日本語", passage, createdAt: 100 }]);
  const { view } = await openReader();
  jest.mocked(epubAnnotations.save).mockRejectedValueOnce(new Error("storage unavailable"));
  fireEvent.press(view.getByLabelText("Open bookmarks and highlights"));
  fireEvent.press(view.getByLabelText("Delete bookmark on page 4"));
  await waitFor(() => expect(view.getByText("Could not save this change. Please try again.")).toBeTruthy());
  expect(view.getByText("日本語")).toBeTruthy();
});

it("keeps a storage load error visible and prevents overwriting unread annotations", async () => {
  jest.mocked(epubAnnotations.load).mockRejectedValueOnce(new Error("corrupt annotations"));
  const { view, send } = await openReader();
  send("selection", { page: 4, text: "日本語", passage });
  expect(view.getByText("Could not load saved passages. Reopen the book to try again.")).toBeTruthy();
  fireEvent.press(view.getByLabelText("Highlight selected passage"));
  expect(epubAnnotations.save).not.toHaveBeenCalled();
});
