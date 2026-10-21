import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert, Platform } from "react-native";
import SubjectListEditorScreen from "../(app)/subject-list/[id]";
import { getAllSubjects } from "../../src/utils/cache";
import type { Subject } from "../../src/utils/api";
import { CommonFilterModal } from "../../src/components/CommonFilterModal";

let mockTranslations = false;
jest.mock("../../src/features/translation-packages/display", () => ({useLearningDisplay: () => ({meaning: (subject: any) => mockTranslations && subject.id === 1 ? "Bir" : subject.data.meanings[0].meaning})}));
const mockPlayAudio = jest.fn();
const mockStopAudio = jest.fn();
const mockSettings = {
  showVocabularyFrequency: false,
  setShowVocabularyFrequency: jest.fn(),
  vocabularyAudioVoice: "female",
  setVocabularyAudioVoice: jest.fn(),
};
jest.mock("../../src/hooks/use-subject-list-audio", () => ({
  useSubjectListAudio: () => ({
    play: mockPlayAudio, stop: mockStopAudio, activeSubjectId: null, loading: false, error: null,
  }),
}));

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
  useSettingsStore: (selector: (state: typeof mockSettings) => unknown) => selector(mockSettings),
}));
jest.mock("@react-navigation/native", () => ({ useIsFocused: () => true }));
jest.mock("../../src/hooks/useVocabularyFrequencyRanks", () => ({
  useVocabularyFrequencyRanks: () => ({ ranks: new Map(), canUseResults: true, dataReady: true }),
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
  const React = jest.requireActual<typeof import("react")>("react");
  const { View, TouchableOpacity, Text } = jest.requireActual("react-native");
  return {
    Host: View, RNHostView: View,
    Menu: ({ label, children }: { label: React.ReactNode; children: React.ReactNode }) => {
      const [open, setOpen] = React.useState(false);
      return <View>
        <TouchableOpacity onPress={() => setOpen(true)}>{label}</TouchableOpacity>
        {open ? React.Children.map(children, (child) => {
          if (!React.isValidElement<{ onPress?: () => void }>(child)) return child;
          return React.cloneElement(child, { onPress: () => { setOpen(false); child.props.onPress?.(); } });
        }) : null}
      </View>;
    },
    Button: ({ label, onPress }: { label: string; onPress: () => void }) => (
      <TouchableOpacity onPress={onPress}><Text>{label}</Text></TouchableOpacity>
    ),
  };
});
jest.mock("../../src/components/GlassButton", () => {
  const { TouchableOpacity } = jest.requireActual("react-native");
  return {
    GlassButton: ({ iconName, accessibilityLabel, ...props }: { iconName: string; accessibilityLabel?: string }) => (
      <TouchableOpacity {...props} accessibilityLabel={accessibilityLabel ?? iconName} />
    ),
  };
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
    mockTranslations = false;
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockSettings.vocabularyAudioVoice = "both";
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
    await waitFor(() => expect(screen.getByLabelText(mockTranslations ? "Select Bir for list actions" : "Select One for list actions")).toBeTruthy());
    return screen;
  }

  function pressListOption(screen: ReturnType<typeof render>, label: string) {
    fireEvent.press(screen.getAllByLabelText("ellipsis-horizontal")[0]);
    fireEvent.press(screen.getByText(label));
  }

  function pressSelectedAction(screen: ReturnType<typeof render>, label: string) {
    fireEvent.press(screen.getByLabelText("Selected item actions"));
    fireEvent.press(screen.getByText(label));
  }

  it("selects items without changing membership or enabling Save", async () => {
    const screen = await openList();
    expect(screen.getByLabelText("Selected item actions").props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByLabelText("Select Two for list actions"));
    expect(screen.getByText("1 selected")).toBeTruthy();
    expect(screen.getByLabelText("Select Two for list actions").props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText("Save list changes").props.accessibilityState.disabled).toBe(true);
    expect(savedIds("source")).toEqual([1, 2, 3, 4]);
    fireEvent.press(screen.getByLabelText("Select Two for list actions"));
    expect(screen.getByText("0 selected")).toBeTruthy();
  });

  it("hides meanings from both tabs and accessibility labels, and remembers the preference", async () => {
    const screen = await openList();
    pressListOption(screen, "Hide Meanings");
    expect(screen.queryByText("One")).toBeNull();
    expect(screen.queryByLabelText("Select One for list actions")).toBeNull();
    expect(screen.getByLabelText("Select 一 for list actions")).toBeTruthy();
    expect(screen.getByLabelText("Save list changes").props.accessibilityState.disabled).toBe(true);
    expect(savedIds("source")).toEqual([1, 2, 3, 4]);
    expect(storage.get("subject_list_hide_meanings")).toBe("true");

    fireEvent.press(screen.getByLabelText("Select 二 for list actions"));
    expect(screen.getByText("1 selected")).toBeTruthy();
    fireEvent.press(screen.getByText("Browse"));
    expect(screen.queryByText("Two")).toBeNull();
    expect(screen.getByText("二")).toBeTruthy();
    pressListOption(screen, "Show Meanings");
    expect(screen.getByText("Two")).toBeTruthy();
    expect(storage.get("subject_list_hide_meanings")).toBe("false");
    pressListOption(screen, "Hide Meanings");
    screen.unmount();

    const reopened = render(<SubjectListEditorScreen />);
    await waitFor(() => expect(reopened.getByText("In List (4)")).toBeTruthy());
    expect(reopened.queryByText("One")).toBeNull();
    fireEvent.press(reopened.getByText("In List (4)"));
    expect(reopened.getByLabelText("Select 一 for list actions")).toBeTruthy();
    pressListOption(reopened, "Show Meanings");
    expect(reopened.getByLabelText("Select One for list actions")).toBeTruthy();
  });

  it("does not reveal a radical meaning when its character and image are unavailable", async () => {
    jest.mocked(getAllSubjects).mockResolvedValue([
      ...subjects.slice(0, 3),
      { ...subjects[3], object: "radical", data: { ...subjects[3].data, characters: null } },
    ]);
    const screen = await openList();
    pressListOption(screen, "Hide Meanings");
    expect(screen.queryByText("Four")).toBeNull();
    expect(screen.getByText("?")).toBeTruthy();
    expect(screen.getByLabelText("Select radical 4 for list actions")).toBeTruthy();
    fireEvent.press(screen.getByText("Browse"));
    expect(screen.queryByText("Four")).toBeNull();
    expect(screen.getByText("?")).toBeTruthy();
  });

  it("reveals only checked meanings in hidden mode and hides them again when unchecked", async () => {
    mockTranslations = true;
    const screen = await openList();
    pressListOption(screen, "Hide Meanings");
    fireEvent.press(screen.getByLabelText("Select 一 for list actions"));
    expect(screen.getByText("Bir")).toBeTruthy();
    expect(screen.queryByText("Two")).toBeNull();
    expect(screen.getByLabelText("Select Bir for list actions").props.accessibilityState.checked).toBe(true);
    fireEvent.press(screen.getByLabelText("Select 二 for list actions"));
    expect(screen.getByText("Two")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Select Bir for list actions"));
    expect(screen.queryByText("Bir")).toBeNull();
    expect(screen.getByText("Two")).toBeTruthy();
    expect(screen.getByLabelText("Save list changes").props.accessibilityState.disabled).toBe(true);
    expect(savedIds("source")).toEqual([1, 2, 3, 4]);
  });

  it("reveals a checked radical's fallback meaning", async () => {
    jest.mocked(getAllSubjects).mockResolvedValue([
      ...subjects.slice(0, 3),
      { ...subjects[3], object: "radical", data: { ...subjects[3].data, characters: null } },
    ]);
    const screen = await openList();
    pressListOption(screen, "Hide Meanings");
    fireEvent.press(screen.getByLabelText("Select radical 4 for list actions"));
    expect(screen.getAllByText("Four")).toHaveLength(2);
    fireEvent.press(screen.getByLabelText("Select Four for list actions"));
    expect(screen.queryByText("Four")).toBeNull();
  });

  it.each([
    ["standard", "Review Selected"],
    ["flashcard", "Flashcard Selected"],
  ])("starts a %s review with only checked items, including checks outside the filter", async (reviewMode, label) => {
    const screen = await openList();
    expect(screen.getByLabelText("Selected item actions").props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByLabelText("Select Two for list actions"));
    fireEvent.press(screen.getByLabelText("Select Four for list actions"));
    fireEvent.changeText(screen.getByPlaceholderText("Search subjects in this list..."), "Two");
    pressSelectedAction(screen, label);
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: "/custom-review", params: { subjectIds: "2,4", reviewMode },
    }));
    expect(savedIds("source")).toEqual([1, 2, 3, 4]);
  });

  it("shows speakers beside vocabulary checkboxes immediately and keeps the list voice separate from reviews", async () => {
    const audioSubject: Subject = {
      ...subjects[1], object: "vocabulary", data: {
        ...subjects[1].data, pronunciation_audios: [{
          url: "https://example.com/two.mp3", content_type: "audio/mpeg", metadata: { voice_actor_name: "Kyoko" },
        }],
      },
    };
    jest.mocked(getAllSubjects).mockResolvedValue([subjects[0], audioSubject, ...subjects.slice(2)]);
    // A preference from the old optional-button implementation must not hide speakers.
    storage.set("subject_list_show_audio_buttons", "false");
    const screen = await openList();
    expect(screen.getByLabelText("Play pronunciation for 二")).toBeTruthy();
    pressListOption(screen, "Hide Meanings");
    const stopPropagation = jest.fn();
    fireEvent.press(screen.getByLabelText("Play pronunciation for 二"), { stopPropagation });
    expect(stopPropagation).toHaveBeenCalled();
    expect(mockPlayAudio).toHaveBeenCalledWith(audioSubject, "female");
    expect(screen.getByText("0 selected")).toBeTruthy();
    expect(screen.queryByText("Two")).toBeNull();
    expect(screen.queryByLabelText("Play pronunciation for 一")).toBeNull();
    expect(savedIds("source")).toEqual([1, 2, 3, 4]);
    pressListOption(screen, "List Audio Voice");
    const voiceModal = screen.UNSAFE_getAllByType(CommonFilterModal)
      .find((modal) => modal.props.title === "List Audio Voice");
    expect(voiceModal?.props.visible).toBe(true);
    act(() => voiceModal?.props.onApply({ voice: "male" }));
    expect(storage.get("subject_list_audio_voice")).toBe("male");
    expect(mockSettings.setVocabularyAudioVoice).not.toHaveBeenCalled();
    expect(mockSettings.vocabularyAudioVoice).toBe("both");
    fireEvent.press(screen.getByLabelText("Play pronunciation for 二"), { stopPropagation });
    expect(mockPlayAudio).toHaveBeenLastCalledWith(audioSubject, "male");
    fireEvent.press(screen.getByText("Browse"));
    expect(screen.getByLabelText("Play pronunciation for 二")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Play pronunciation for 二"), { stopPropagation });
    expect(mockPlayAudio).toHaveBeenLastCalledWith(audioSubject, "male");
    expect(savedIds("source")).toEqual([1, 2, 3, 4]);
    screen.unmount();
    const reopened = render(<SubjectListEditorScreen />);
    await waitFor(() => expect(reopened.getByLabelText("Play pronunciation for 二")).toBeTruthy());
    fireEvent.press(reopened.getByLabelText("Play pronunciation for 二"), { stopPropagation });
    expect(mockPlayAudio).toHaveBeenLastCalledWith(audioSubject, "male");
  });

  it("toggles meanings and list audio voice from the fallback three-dot menu", async () => {
    jest.replaceProperty(Platform, "OS", "android");
    const screen = await openList();
    fireEvent.press(screen.getAllByLabelText("ellipsis-horizontal")[0]);
    expect(screen.getByText("Sort Items")).toBeTruthy();
    expect(screen.getByText("Rename")).toBeTruthy();
    expect(screen.getByText("Delete")).toBeTruthy();
    fireEvent.press(screen.getByText("Hide Meanings"));
    expect(screen.queryByText("One")).toBeNull();
    expect(screen.getByLabelText("Select 一 for list actions")).toBeTruthy();
    pressListOption(screen, "Show Meanings");
    expect(screen.getByText("One")).toBeTruthy();
    pressListOption(screen, "List Audio Voice");
    const voiceModal = screen.UNSAFE_getAllByType(CommonFilterModal)
      .find((modal) => modal.props.title === "List Audio Voice");
    expect(voiceModal?.props.visible).toBe(true);
  });

  it.each(["ios", "android"] as const)("opens the four selection actions from one menu on %s", async (platform) => {
    jest.replaceProperty(Platform, "OS", platform);
    const screen = await openList();
    expect(screen.getByLabelText("Selected item actions").props.accessibilityState.disabled).toBe(true);
    expect(screen.queryByText("Remove Selected")).toBeNull();
    fireEvent.press(screen.getByLabelText("Select Two for list actions"));
    expect(screen.queryByText("Review Selected")).toBeNull();
    fireEvent.press(screen.getByLabelText("Selected item actions"));
    for (const label of ["Remove Selected", "Transfer Selected", "Review Selected", "Flashcard Selected"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    fireEvent.press(screen.getByText("Review Selected"));
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: "/custom-review", params: { subjectIds: "2", reviewMode: "standard" },
    }));
    expect(screen.queryByText("Remove Selected")).toBeNull();
    expect(savedIds("source")).toEqual([1, 2, 3, 4]);
  });

  it.each(["Copy", "Move"])("%s transfers only checked items and preserves the rest", async (mode) => {
    const screen = await openList();
    fireEvent.press(screen.getByLabelText("Select Two for list actions"));
    fireEvent.press(screen.getByLabelText("Select Three for list actions"));
    pressSelectedAction(screen, "Transfer Selected");
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
    pressSelectedAction(screen, "Transfer Selected");
    await waitFor(() => expect(screen.getByText("1 subject from Numbers")).toBeTruthy());
    fireEvent.press(screen.getByLabelText("Cancel subject transfer"));
    expect(screen.getByText("1 selected")).toBeTruthy();
    expect(savedIds("source")).toEqual([1, 2, 3, 4]);
    expect(savedIds("destination")).toEqual([2]);
  });

  it("removes only checked items when changes are saved", async () => {
    const screen = await openList();
    fireEvent.press(screen.getByLabelText("Select Two for list actions"));
    pressSelectedAction(screen, "Remove Selected");
    expect(screen.getByText("In List (3)")).toBeTruthy();
    expect(savedIds("source")).toEqual([1, 2, 3, 4]);
    fireEvent.press(screen.getByText("Save Changes"));
    await waitFor(() => expect(savedIds("source")).toEqual([1, 3, 4]));
    expect(screen.getByText("0 selected")).toBeTruthy();
  });

  it("selects all, deselects all, and limits filtered selection to matching items", async () => {
    const screen = await openList();
    fireEvent.press(screen.getByLabelText("Select All"));
    expect(screen.getByText("4 selected")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Deselect All"));
    expect(screen.getByText("0 selected")).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText("Search subjects in this list..."), "Two");
    fireEvent.press(screen.getByLabelText("Select Filtered"));
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

  it("uses translated meanings in list actions and updates when disabled", async () => {
    mockTranslations = true;
    const screen = await openList();
    expect(screen.getByLabelText("Select Bir for list actions")).toBeTruthy();
    expect(screen.getByText("Bir")).toBeTruthy();
    mockTranslations = false;
    screen.rerender(<SubjectListEditorScreen/>);
    expect(screen.getByLabelText("Select One for list actions")).toBeTruthy();
  });

  it("clears checks for items removed through Browse", async () => {
    const screen = await openList();
    fireEvent.press(screen.getByLabelText("Select Two for list actions"));
    fireEvent.press(screen.getByText("Browse"));
    fireEvent.press(screen.getByText("Two"));
    fireEvent.press(screen.getByText("In List (3)"));
    expect(screen.getByText("0 selected")).toBeTruthy();
    expect(screen.getByLabelText("Selected item actions").props.accessibilityState.disabled).toBe(true);
  });
});
