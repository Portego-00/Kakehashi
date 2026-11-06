import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, cleanupAsync, fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert, FlatList } from "react-native";
import SubjectListEditorScreen from "../(app)/subject-list/[id]";
import { getAllSubjects } from "../../src/utils/cache";
import { useVocabularyFrequencyRanks } from "../../src/hooks/useVocabularyFrequencyRanks";
import type { Subject } from "../../src/utils/api";
import { SearchFilterModal } from "../../src/components/SearchFilterModal";

const mockRouter = { push: jest.fn(), back: jest.fn() };
const mockSettings = { showVocabularyFrequency: true, setShowVocabularyFrequency: jest.fn() };
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "source" }),
  useRouter: () => mockRouter,
}));
jest.mock("expo-router/react-navigation", () => ({ useIsFocused: () => true }));
jest.mock("../../src/lib/supabase", () => ({ supabase: {} }));
jest.mock("../../src/utils/store", () => ({
  useAuthStore: Object.assign(() => ({ apiToken: "test-token" }), {
    getState: () => ({ userData: null }),
  }),
  useSettingsStore: (selector: (state: typeof mockSettings) => unknown) => selector(mockSettings),
}));
jest.mock("../../src/hooks/useVocabularyFrequencyRanks", () => ({ useVocabularyFrequencyRanks: jest.fn() }));
jest.mock("../../src/hooks/use-subject-list-audio", () => ({
  useSubjectListAudio: () => ({ play: jest.fn(), stop: jest.fn(), activeSubjectId: null, loading: false, error: null }),
}));
jest.mock("../../src/utils/cache", () => ({ getAllSubjects: jest.fn() }));
jest.mock("../../src/utils/api", () => ({
  getAllAssignmentsCached: jest.fn(async () => ({
    data: Array.from({ length: 751 }, (_, index) => ({ data: { subject_id: index + 1, srs_stage: 1 } })),
  })),
}));
jest.mock("../../src/utils/theme", () => ({
  useTheme: () => ({ theme: {
    primary: "#3a86ff", backgroundColor: "#f6f6f6", cardBackground: "#fff",
    border: "#eee", textColor: "#333", textSecondary: "#666", textLight: "#999", error: "#e53935",
  } }),
}));
jest.mock("../../src/utils/subjectColors", () => ({
  getSubjectTypeColor: () => "#fa1f62",
  useSubjectColors: () => ({ radical: "#0088cc", kanji: "#cc0088", vocabulary: "#8800cc" }),
}));
jest.mock("../../src/utils/jlptClassification", () => ({
  getJLPTLevelForSubject: () => null,
  JLPT_LEVELS: ["N5", "N4", "N3", "N2", "N1"],
}));
jest.mock("../../src/utils/radicalSvg", () => ({ pickBestImage: () => null, useRemoteSvg: () => null }));
jest.mock("../../src/components/SubjectListStudyMenu", () => {
  const { View, Text, TouchableOpacity } = jest.requireActual("react-native");
  return function MockStudyMenu({ onStandardReview, onFlashcardReview }: {
    onStandardReview: () => void;
    onFlashcardReview: () => void;
  }) {
    return <View>
      <TouchableOpacity onPress={onStandardReview}><Text>Standard Review</Text></TouchableOpacity>
      <TouchableOpacity onPress={onFlashcardReview}><Text>Flashcard Review</Text></TouchableOpacity>
    </View>;
  };
});
jest.mock("../../src/components/TransferSubjectListsModal", () => () => null);
jest.mock("../../src/components/CommonFilterModal", () => ({ CommonFilterModal: () => null }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-blur", () => ({ BlurView: jest.requireActual("react-native").View }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock("@expo/ui/swift-ui", () => {
  const { View, TouchableOpacity, Text } = jest.requireActual("react-native");
  return {
    Host: View, Menu: View, RNHostView: View,
    Button: ({ label, onPress }: { label: string; onPress: () => void }) => (
      <TouchableOpacity onPress={onPress}><Text>{label}</Text></TouchableOpacity>
    ),
  };
});
jest.mock("@expo/ui/swift-ui/modifiers", () => ({
  buttonStyle: (style: string) => ({ $type: "buttonStyle", style }),
}));
jest.mock("../../src/components/GlassButton", () => {
  const { TouchableOpacity } = jest.requireActual("react-native");
  return { GlassButton: ({ iconName, accessibilityLabel, ...props }: { iconName: string; accessibilityLabel?: string }) => (
    <TouchableOpacity {...props} accessibilityLabel={accessibilityLabel ?? iconName} />
  ) };
});

function vocabulary(id: number, object: Subject["object"] = "vocabulary"): Subject {
  return {
    id, object, url: "", data_updated_at: "2026-10-13T00:00:00Z", data: {
      created_at: "2026-10-13T00:00:00Z", hidden_at: null, document_url: "", character_images: null,
      slug: `Word ${id}`, characters: `語${id}`, level: 1,
      meanings: [{ meaning: `Word ${id}`, primary: true, accepted_answer: true }],
      readings: [], auxiliary_meanings: [], parts_of_speech: ["noun"], component_subject_ids: [],
      amalgamation_subject_ids: [], visually_similar_subject_ids: [], meaning_mnemonic: "",
      meaning_hint: null, reading_mnemonic: null, reading_hint: null,
    },
  };
}

describe("subject list frequency filtering", () => {
  const storage = new Map<string, string>();
  const listKey = "subject_lists:v1";
  let frequencyState: ReturnType<typeof useVocabularyFrequencyRanks>;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockSettings.showVocabularyFrequency = true;
    storage.clear();
    storage.set(listKey, JSON.stringify({ version: 3, lists: [{
      id: "source", name: "Common words", subjectIds: [], sortOrder: 0,
      createdAt: "2026-10-13T00:00:00Z", updatedAt: "2026-10-13T00:00:00Z",
      ownerUserId: null, deletedAt: null, syncStatus: "synced",
    }] }));
    jest.mocked(AsyncStorage.getItem).mockImplementation(async (key) => storage.get(key) ?? null);
    jest.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => { storage.set(key, value); });
    jest.mocked(getAllSubjects).mockResolvedValue([vocabulary(1), vocabulary(2, "kana_vocabulary"), vocabulary(3)]);
    frequencyState = {
      ranks: new Map([[1, 500], [2, 2000], [3, 2001]]),
      isScanningCache: false, isLoading: false, progress: { completed: 3, total: 3 },
      dataReady: true, canUseResults: true, resolvedCount: 3, needsApproval: false,
      unresolvedCount: 0, lookupError: null,
      approveLookup: jest.fn(), retryLookup: jest.fn(), resetLookupState: jest.fn(),
    };
    jest.mocked(useVocabularyFrequencyRanks).mockImplementation(() => frequencyState);
    jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await cleanupAsync();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  async function openList() {
    const screen = render(<SubjectListEditorScreen />);
    await screen.findByText("Word 1");
    act(() => jest.advanceTimersByTime(1000));
    return screen;
  }

  async function applyMaximum(screen: ReturnType<typeof render>, value = "2000") {
    fireEvent.press(screen.getByLabelText(/^Filters/));
    act(() => jest.advanceTimersByTime(500));
    fireEvent.changeText(screen.getByLabelText("Maximum word frequency rank"), value);
    fireEvent.press(screen.getByText("Apply Filters"));
    act(() => jest.advanceTimersByTime(1000));
    expect(screen.UNSAFE_getByType(SearchFilterModal).props.visible).toBe(false);
  }

  it.each(["browse", "selected"])("loads every page in the %s tab and hides Load more at the end", async (tab) => {
    const subjects = Array.from({ length: 751 }, (_, index) => vocabulary(index + 1));
    jest.mocked(getAllSubjects).mockResolvedValue(subjects);
    const saved = JSON.parse(storage.get(listKey)!);
    saved.lists[0].subjectIds = subjects.map((subject) => subject.id);
    storage.set(listKey, JSON.stringify(saved));

    const screen = await openList();
    if (tab === "selected") fireEvent.press(screen.getByText("In List (751)"));
    const displayedIds = () => screen.UNSAFE_getByType(FlatList).props.data.map((subject: Subject) => subject.id);
    expect(displayedIds()).toEqual(subjects.slice(0, 250).map((subject) => subject.id));

    for (const count of [500, 750, 751]) {
      fireEvent.press(screen.getByRole("button", { name: "Load more" }));
      expect(displayedIds()).toEqual(subjects.slice(0, count).map((subject) => subject.id));
      if (count === 500) {
        fireEvent.press(screen.getByText(tab === "browse" ? "In List (751)" : "Browse"));
        expect(displayedIds()).toHaveLength(250);
        fireEvent.press(screen.getByText(tab === "browse" ? "Browse" : "In List (751)"));
        expect(displayedIds()).toHaveLength(500);
      }
    }

    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
    expect(screen.getByLabelText("Save list changes").props.accessibilityState.disabled).toBe(true);

    const search = screen.getByPlaceholderText(tab === "browse" ? "Search subjects..." : "Search subjects in this list...");
    fireEvent.changeText(search, "語751");
    expect(displayedIds()).toEqual([751]);
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
    fireEvent.changeText(search, "");
    expect(displayedIds()).toEqual(subjects.slice(0, 250).map((subject) => subject.id));
    expect(screen.getByRole("button", { name: "Load more" })).toBeTruthy();
  });

  it("does not show Load more when all matches already fit", async () => {
    const screen = await openList();
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
    fireEvent.press(screen.getByText("Select All"));
    fireEvent.press(screen.getByText("In List (3)"));
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it.each([
    ["standard", "Standard Review"], ["flashcard", "Flashcard Review"],
  ])("starts a %s review with the saved list items", async (reviewMode, label) => {
    const screen = await openList();
    await applyMaximum(screen);
    fireEvent.press(screen.getByText("Select Filtered"));
    fireEvent.press(screen.getByText(label));
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: "/custom-review",
      params: { subjectIds: "1,2", reviewMode },
    }));
    expect(JSON.parse(storage.get(listKey)!).lists[0].subjectIds).toEqual([1, 2]);
  });

  it("offers word frequency in the list creation filters", async () => {
    const screen = await openList();
    fireEvent.press(screen.getByLabelText("Filters"));
    expect(screen.getByText("Word Frequency")).toBeTruthy();
    expect(screen.getByLabelText("Maximum word frequency rank")).toBeTruthy();
  });

  it("filters both vocabulary types inclusively and saves only matching words", async () => {
    jest.mocked(getAllSubjects).mockResolvedValue([
      vocabulary(1), vocabulary(2, "kana_vocabulary"), vocabulary(3), vocabulary(4), vocabulary(5, "kanji"),
    ]);
    frequencyState.ranks.set(4, null);
    const screen = await openList();
    await applyMaximum(screen);

    expect(screen.getByText("Word 1")).toBeTruthy();
    expect(screen.getByText("Word 2")).toBeTruthy();
    expect(screen.queryByText("Word 3")).toBeNull();
    expect(screen.queryByText("Word 4")).toBeNull();
    expect(screen.queryByText("Word 5")).toBeNull();
    fireEvent.press(screen.getByText("Select Filtered"));
    fireEvent.press(screen.getByLabelText("Save list changes"));
    await waitFor(() => expect(JSON.parse(storage.get(listKey)!).lists[0].subjectIds).toEqual([1, 2]));

    await applyMaximum(screen, "");
    expect(screen.getByText("Word 3")).toBeTruthy();
    expect(screen.getByText("Word 5")).toBeTruthy();
    expect(screen.getByText("In List (2)")).toBeTruthy();
  });

  it("checks frequency before the display limit and bulk selects all matches", async () => {
    jest.mocked(getAllSubjects).mockResolvedValue(Array.from({ length: 260 }, (_, index) => vocabulary(index + 1)));
    frequencyState.ranks = new Map(Array.from({ length: 260 }, (_, index) => [index + 1, index < 250 ? 3000 : 1000]));
    const screen = await openList();
    await applyMaximum(screen);
    expect(screen.getByText("Word 260")).toBeTruthy();
    expect(screen.queryByText("Word 1")).toBeNull();
    expect(jest.mocked(useVocabularyFrequencyRanks).mock.calls.at(-1)?.[0].subjects).toHaveLength(260);
    fireEvent.press(screen.getByText("Select Filtered"));
    expect(screen.getByText("In List (10)")).toBeTruthy();

    frequencyState.ranks = new Map(Array.from({ length: 260 }, (_, index) => [index + 1, 1000]));
    screen.rerender(<SubjectListEditorScreen />);
    fireEvent.press(screen.getByText("Select Filtered"));
    expect(screen.getByText("In List (260)")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Load more" }));
    expect(screen.UNSAFE_getByType(FlatList).props.data).toHaveLength(260);
  });

  it("allows enabling frequency filtering from the list menu", async () => {
    mockSettings.showVocabularyFrequency = false;
    const screen = await openList();
    fireEvent.press(screen.getByLabelText("Filters"));
    expect(screen.queryByLabelText("Maximum word frequency rank")).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Enable Frequency Filtering" }));
    expect(mockSettings.setShowVocabularyFrequency).toHaveBeenCalledWith(true);
  });

  it("keeps unchecked words out of selection and supports approval and retry", async () => {
    frequencyState.ranks = new Map([[1, 500]]);
    frequencyState.dataReady = false;
    frequencyState.resolvedCount = 1;
    frequencyState.unresolvedCount = 2;
    frequencyState.needsApproval = true;
    const screen = await openList();
    await applyMaximum(screen);
    fireEvent.press(screen.getByLabelText("Check remaining word frequencies"));
    expect(frequencyState.approveLookup).toHaveBeenCalled();
    expect(screen.queryByText("Word 2")).toBeNull();
    fireEvent.press(screen.getByText("Select Filtered"));
    expect(screen.getByText("In List (1)")).toBeTruthy();

    frequencyState.needsApproval = false;
    frequencyState.lookupError = { phase: "network", reason: "request" };
    screen.rerender(<SubjectListEditorScreen />);
    fireEvent.press(screen.getByLabelText("Retry word frequency check"));
    expect(frequencyState.retryLookup).toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText("Clear word frequency filter"));
    expect(screen.getByText("Word 2")).toBeTruthy();
    expect(screen.getByText("In List (1)")).toBeTruthy();
  });

  it("shows lookup progress and explains that checked words are saved", async () => {
    frequencyState.dataReady = false;
    frequencyState.resolvedCount = 1;
    frequencyState.unresolvedCount = 2;
    frequencyState.needsApproval = true;
    const screen = await openList();
    await applyMaximum(screen);
    expect(screen.getByRole("progressbar").props.accessibilityValue).toMatchObject({
      min: 0, max: 3, now: 1,
    });
    expect(screen.getByText("One-time check · Saved for next time")).toBeTruthy();
  });

  it("disables bulk selection while the saved ranks are still being checked", async () => {
    frequencyState.isScanningCache = true;
    frequencyState.canUseResults = false;
    frequencyState.dataReady = false;
    const screen = await openList();
    await applyMaximum(screen);
    expect(screen.getByLabelText("Select matching subjects").props.accessibilityState.disabled).toBe(true);
    expect(screen.queryByText("Word 1")).toBeNull();
    expect(screen.getByLabelText("Clear word frequency filter")).toBeTruthy();
  });
});
