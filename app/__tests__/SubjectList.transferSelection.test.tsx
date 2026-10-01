import AsyncStorage from "@react-native-async-storage/async-storage";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert } from "react-native";
import SubjectListEditorScreen from "../(app)/subject-list/[id]";
import { getAllSubjects } from "../../src/utils/cache";
import type { Subject } from "../../src/utils/api";

const mockRouter = { push: jest.fn(), back: jest.fn() };
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "source" }),
  useRouter: () => mockRouter,
}));
jest.mock("../../src/lib/supabase", () => ({ supabase: {} }));
jest.mock("../../src/utils/store", () => ({
  useAuthStore: Object.assign(() => ({ apiToken: "test-token" }), {
    getState: () => ({ userData: null }),
  }),
}));
jest.mock("../../src/utils/cache", () => ({ getAllSubjects: jest.fn() }));
jest.mock("../../src/utils/api", () => ({
  getAllAssignmentsCached: jest.fn(async () => ({
    data: [1, 2, 3, 4].map((subject_id) => ({ data: { subject_id, srs_stage: 1 } })),
  })),
}));
jest.mock("../../src/utils/theme", () => ({
  useTheme: () => ({ theme: {
    primary: "#3a86ff", backgroundColor: "#f6f6f6", cardBackground: "#fff",
    border: "#eee", textColor: "#333", textSecondary: "#666", textLight: "#999", error: "#e53935",
  } }),
}));
jest.mock("../../src/utils/subjectColors", () => ({ getSubjectTypeColor: () => "#fa1f62" }));
jest.mock("../../src/utils/jlptClassification", () => ({ getJLPTLevelForSubject: () => null }));
jest.mock("../../src/utils/radicalSvg", () => ({ pickBestImage: () => null, useRemoteSvg: () => null }));
jest.mock("../../src/components/SubjectListStudyMenu", () => () => null);
jest.mock("../../src/components/CommonFilterModal", () => ({ CommonFilterModal: () => null }));
jest.mock("../../src/components/SearchFilterModal", () => ({
  SearchFilterModal: () => null,
  createDefaultSearchFilters: () => ({
    minLevel: 1, maxLevel: 60,
    types: new Set(["radical", "kanji", "vocabulary", "kana_vocabulary"]),
    srsStages: new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
    jlptLevels: new Set(), vocabularyTypes: [], maxFrequencyRank: null,
  }),
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock("@expo/ui/swift-ui", () => {
  const { View } = jest.requireActual("react-native");
  return { Host: View, Menu: View, RNHostView: View, Button: () => null };
});
jest.mock("../../src/components/GlassButton", () => {
  const { TouchableOpacity } = jest.requireActual("react-native");
  return { GlassButton: TouchableOpacity };
});

const subjects: Subject[] = [
  { id: 1, meaning: "One", characters: "一" },
  { id: 2, meaning: "Two", characters: "二" },
  { id: 3, meaning: "Three", characters: "三" },
  { id: 4, meaning: "Four", characters: "四" },
].map(({ id, meaning, characters }) => ({
  id, object: "kanji", url: "", data_updated_at: "2026-09-30T00:00:00Z", data: {
    created_at: "2026-09-30T00:00:00Z", hidden_at: null, document_url: "", character_images: null,
    slug: characters, characters, level: 1,
    meanings: [{ meaning, primary: true, accepted_answer: true }],
    readings: [], auxiliary_meanings: [], parts_of_speech: [], component_subject_ids: [],
    amalgamation_subject_ids: [], visually_similar_subject_ids: [], meaning_mnemonic: "",
    meaning_hint: null, reading_mnemonic: null, reading_hint: null,
  },
}));

describe("list action selection", () => {
  const storage = new Map<string, string>();
  const listKey = "subject_lists:v1";
  const savedIds = (id: string): number[] => JSON.parse(storage.get(listKey)!).lists
    .find((list: { id: string }) => list.id === id).subjectIds;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    storage.clear();
    storage.set(listKey, JSON.stringify({ version: 3, lists: [
      { id: "source", name: "Numbers", subjectIds: [1, 2, 3, 4] },
      { id: "destination", name: "Practice", subjectIds: [2] },
    ].map((list, sortOrder) => ({
      ...list, sortOrder, createdAt: "2026-09-30T00:00:00Z", updatedAt: "2026-09-30T00:00:00Z",
      ownerUserId: null, deletedAt: null, syncStatus: "synced",
    })) }));
    jest.mocked(AsyncStorage.getItem).mockImplementation(async (key) => storage.get(key) ?? null);
    jest.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => { storage.set(key, value); });
    jest.mocked(getAllSubjects).mockResolvedValue(subjects);
    jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  async function openList() {
    const screen = render(<SubjectListEditorScreen />);
    await waitFor(() => expect(screen.getByText("In List (4)")).toBeTruthy());
    fireEvent.press(screen.getByText("In List (4)"));
    await waitFor(() => expect(screen.getByLabelText("Select One for list actions")).toBeTruthy());
    return screen;
  }

  it("selects items without changing membership or enabling Save", async () => {
    const screen = await openList();
    expect(screen.getByLabelText("Transfer selected subjects to another list").props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByLabelText("Select Two for list actions"));
    expect(screen.getByText("1 selected")).toBeTruthy();
    expect(screen.getByLabelText("Select Two for list actions").props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText("Save list changes").props.accessibilityState.disabled).toBe(true);
    expect(savedIds("source")).toEqual([1, 2, 3, 4]);
    fireEvent.press(screen.getByLabelText("Select Two for list actions"));
    expect(screen.getByText("0 selected")).toBeTruthy();
  });

  it.each(["Copy", "Move"])("%s transfers only checked items and preserves the rest", async (mode) => {
    const screen = await openList();
    fireEvent.press(screen.getByLabelText("Select Two for list actions"));
    fireEvent.press(screen.getByLabelText("Select Three for list actions"));
    fireEvent.press(screen.getByLabelText("Transfer selected subjects to another list"));
    await waitFor(() => expect(screen.getByText("2 subjects from Numbers")).toBeTruthy());
    fireEvent.press(screen.getByLabelText(`${mode} subjects`));
    await waitFor(() => expect(screen.getByLabelText("Practice, 1 subject")).toBeTruthy());
    fireEvent.press(screen.getByLabelText("Practice, 1 subject"));
    fireEvent.press(screen.getByLabelText(`${mode} 2 subjects to Practice`));
    await waitFor(() => expect(screen.getByText("0 selected")).toBeTruthy());
    expect(savedIds("destination")).toEqual([2, 3]);
    expect(savedIds("source")).toEqual(mode === "Move" ? [1, 4] : [1, 2, 3, 4]);
    expect(Alert.alert).toHaveBeenCalledWith(mode === "Move" ? "Subjects Moved" : "Subjects Copied", expect.any(String));
  });

  it("keeps membership and checks when a transfer is canceled", async () => {
    const screen = await openList();
    fireEvent.press(screen.getByLabelText("Select One for list actions"));
    fireEvent.press(screen.getByLabelText("Transfer selected subjects to another list"));
    await waitFor(() => expect(screen.getByText("1 subject from Numbers")).toBeTruthy());
    fireEvent.press(screen.getByLabelText("Cancel subject transfer"));
    expect(screen.getByText("1 selected")).toBeTruthy();
    expect(savedIds("source")).toEqual([1, 2, 3, 4]);
    expect(savedIds("destination")).toEqual([2]);
  });

  it("removes only checked items when changes are saved", async () => {
    const screen = await openList();
    fireEvent.press(screen.getByLabelText("Select Two for list actions"));
    fireEvent.press(screen.getByLabelText("Remove selected subjects from this list"));
    expect(screen.getByText("In List (3)")).toBeTruthy();
    expect(savedIds("source")).toEqual([1, 2, 3, 4]);
    fireEvent.press(screen.getByText("Save Changes"));
    await waitFor(() => expect(savedIds("source")).toEqual([1, 3, 4]));
    expect(screen.getByText("0 selected")).toBeTruthy();
  });

  it("selects all, deselects all, and limits filtered selection to matching items", async () => {
    const screen = await openList();
    fireEvent.press(screen.getByText("Select All"));
    expect(screen.getByText("4 selected")).toBeTruthy();
    fireEvent.press(screen.getByText("Deselect All"));
    expect(screen.getByText("0 selected")).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText("Search subjects in this list..."), "Two");
    fireEvent.press(screen.getByText("Select Filtered"));
    expect(screen.getByText("1 selected")).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText("Search subjects in this list..."), "");
    expect(screen.getByLabelText("Select Two for list actions").props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText("Select One for list actions").props.accessibilityState.checked).toBe(false);
    expect(savedIds("source")).toEqual([1, 2, 3, 4]);
  });

  it("still allows transferring the whole list from Browse", async () => {
    const screen = await openList();
    fireEvent.press(screen.getByText("Browse"));
    fireEvent.press(screen.getByText("Transfer List"));
    await waitFor(() => expect(screen.getByText("4 subjects from Numbers")).toBeTruthy());
    await waitFor(() => expect(screen.getByLabelText("Practice, 1 subject")).toBeTruthy());
    fireEvent.press(screen.getByLabelText("Practice, 1 subject"));
    fireEvent.press(screen.getByLabelText("Copy 4 subjects to Practice"));
    await waitFor(() => expect(savedIds("destination")).toEqual([2, 1, 3, 4]));
    expect(savedIds("source")).toEqual([1, 2, 3, 4]);
  });

  it("clears checks for items removed through Browse", async () => {
    const screen = await openList();
    fireEvent.press(screen.getByLabelText("Select Two for list actions"));
    fireEvent.press(screen.getByText("Browse"));
    fireEvent.press(screen.getByText("Two"));
    fireEvent.press(screen.getByText("In List (3)"));
    expect(screen.getByText("0 selected")).toBeTruthy();
    expect(screen.getByLabelText("Transfer selected subjects to another list").props.accessibilityState.disabled).toBe(true);
  });
});
