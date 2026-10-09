import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Keyboard, ScrollView } from "react-native";

let mockFocus: (() => void) | undefined;
const mockIssue = (index: number) => ({ id: `issue-${index}`, user_username: "Viewer", title: `Issue ${index}`, content: "A conversation", status: "open", created_at: "2026-10-01T12:00:00Z", updated_at: "2026-10-01T12:00:00Z", likes_count: 0, reply_count: 0 });
const mockKeyboard = new Map<string, () => void>();
const mockScrollToEnd = jest.fn();
const mockMarkdownRendered = jest.fn();
const mockTheme = { primary: "#111111", border: "#eeeeee", backgroundColor: "#ffffff", textColor: "#111111" };
jest.mock("expo-router", () => ({
  Stack: { Screen: () => null }, useRouter: () => ({ push: jest.fn(), back: jest.fn() }), useLocalSearchParams: () => ({ id: "issue-0" }),
  useFocusEffect: (callback: () => void) => { const React = jest.requireActual("react"); React.useEffect(() => { mockFocus = callback; callback(); }, [callback]); },
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));
jest.mock("expo-video", () => ({ VideoView: () => null, useVideoPlayer: () => ({}) }));
jest.mock("expo-image-picker", () => ({}));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock("react-native-markdown-display", () => { const { Text } = jest.requireActual("react-native"); return ({ children }: { children: string }) => { mockMarkdownRendered(children); return <Text>{children}</Text>; }; });
jest.mock("../../src/contexts/AuthContext", () => ({ useSession: () => ({ isLoading: false }) }));
jest.mock("../../src/utils/store", () => ({
  useAuthStore: (selector?: (state: unknown) => unknown) => { const state = { apiToken: "test", userData: { id: "1", username: "Viewer" } }; return selector ? selector(state) : state; },
  useSettingsStore: (selector?: (state: unknown) => unknown) => { const state = { gravatarEmail: "", appTextSizeScale: 1 }; return selector ? selector(state) : state; },
}));
jest.mock("../../src/utils/theme", () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock("../../src/hooks/usePatreonSupporterUsernames", () => ({ usePatreonSupporterUsernames: () => new Set(), isPatreonSupporterUsername: () => false }));
jest.mock("../../src/components/UserAvatar", () => ({ UserAvatar: () => null }));
jest.mock("../../src/components/PatreonSupporterBadge", () => ({ PatreonSupporterBadge: () => null }));
jest.mock("../../src/services/imageUploadService", () => ({ ISSUE_MEDIA_MAX_BYTES: 1000 }));
jest.mock("../../src/services/issueService", () => ({ issueService: {
  getIssues: jest.fn(async (page: number, size: number) => ({ issues: Array.from({ length: size }, (_, i) => mockIssue(page * size + i)), count: 60 })),
  toggleLike: jest.fn(async () => undefined),
  getIssueCounts: jest.fn(async () => ({ open: 60, closed: 0 })),
  getIssue: jest.fn(async () => mockIssue(0)), getComments: jest.fn(async () => []),
} }));
jest.mock("../../src/components/issue/IssueList", () => {
  const { Text, View, TouchableOpacity } = jest.requireActual("react-native");
  return ({ issues, onLoadMore }: { issues: { id: string; title: string }[]; onLoadMore: () => void }) => <View><TouchableOpacity onPress={onLoadMore}><Text>Load more</Text></TouchableOpacity>{issues.map((issue) => <Text key={issue.id}>{issue.title}</Text>)}</View>;
});
jest.mock("../../src/hooks/useIssueActivity", () => ({ useIssueActivity: () => ({ items: [], unreadCount: 0, loading: false, visits: {}, error: "", reload: jest.fn() }) }));
jest.mock("../../src/components/issue/issue-view-menu", () => ({ IssueViewMenu: () => null }));
import CommunityTab from "../(app)/issues";
import IssueDetailScreen from "../(app)/issue/[id]";

beforeEach(() => { jest.clearAllMocks(); mockKeyboard.clear(); jest.spyOn(Keyboard, "addListener").mockImplementation((name, callback) => { mockKeyboard.set(name, callback as () => void); return { remove: jest.fn() }; }); jest.spyOn(ScrollView.prototype, "scrollToEnd").mockImplementation(mockScrollToEnd); });
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

test("quiet focus refresh keeps loaded issue pages and their scroll anchors", async () => {
  const screen = render(<CommunityTab />);
  await screen.findByText("Issue 19");
  fireEvent.press(screen.getByText("Load more"));
  await screen.findByText("Issue 39");
  await act(async () => { mockFocus?.(); });
  await waitFor(() => expect(screen.getByText("Issue 39")).toBeTruthy());
});

test("opening the reply keyboard does not scroll the entire conversation", async () => {
  jest.useFakeTimers();
  const screen = render(<IssueDetailScreen />);
  await act(async () => { await Promise.resolve(); });
  await waitFor(() => expect(screen.getByText("Issue 0")).toBeTruthy());
  act(() => { mockKeyboard.get("keyboardDidShow")?.(); jest.advanceTimersByTime(150); });
  expect(mockScrollToEnd).not.toHaveBeenCalled();
});


test("liking an issue does not rebuild the unchanged conversation markdown", async () => {
  const screen = render(<IssueDetailScreen />);
  await screen.findByText("Issue 0");
  const rendered = mockMarkdownRendered.mock.calls.length;
  fireEvent.press(screen.getByText("0"));
  await screen.findByText("1");
  await act(async () => { await Promise.resolve(); });
  expect(mockMarkdownRendered).toHaveBeenCalledTimes(rendered);
  fireEvent.changeText(screen.getByPlaceholderText("Add a comment..."), "A new draft");
  expect(mockMarkdownRendered).toHaveBeenCalledTimes(rendered);
});
