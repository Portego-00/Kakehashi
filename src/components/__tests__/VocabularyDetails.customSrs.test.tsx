import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { StyleSheet } from "react-native";
import { searchImmersionKit } from "../../services/immersionKitService";
import VocabularyDetails from "../VocabularyDetails";
import { Audio } from "../../utils/expoAvCompat";
import { resolveCustomVocabularyAudioForPlayback } from "../../features/custom-srs/audio-cache";

const mockSetPage = jest.fn();
const mockSettings = {
  showPitchAccent: false,
  showPatternsOfUse: false,
  showSimilarVocabulary: false,
  showSingleKanjiVocabularySimilarKanji: false,
  showMediaContextSentences: true,
  hideContextSentenceTranslations: false,
  showContextSentenceSpeedControl: false,
  myAnimeListUsername: "",
  immersionKitAnimes: [],
};

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("@react-native-community/slider", () => () => null);
jest.mock("@react-navigation/native", () => ({ useNavigation: () => ({ goBack: jest.fn() }) }));
jest.mock("expo-blur", () => ({ BlurView: ({ children }: { children?: React.ReactNode }) => children }));
jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View, ScrollView } = jest.requireActual<typeof import("react-native")>("react-native");
  const transition: Record<string, jest.Mock> = {};
  for (const method of ["duration", "delay", "springify", "damping", "stiffness", "mass"]) transition[method] = jest.fn(() => transition);
  return { __esModule: true, default: { View, ScrollView }, enableLayoutAnimations: jest.fn(), FadeInDown: transition, FadeOutUp: transition, LinearTransition: transition, useAnimatedRef: () => React.useRef(null) };
});
jest.mock("react-native-pager-view", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  const Pager = React.forwardRef((props: React.ComponentProps<typeof View>, ref: React.ForwardedRef<{ setPage: (index: number) => void }>) => {
    React.useImperativeHandle(ref, () => ({ setPage: mockSetPage }));
    return <View {...props} />;
  });
  Pager.displayName = "MockPager";
  return Pager;
});
jest.mock("../../modules/AudioSessionManager", () => ({ __esModule: true, default: { overrideSpeaker: jest.fn() } }));
jest.mock("../../utils/expoAvCompat", () => ({ Audio: { setAudioModeAsync: jest.fn(() => Promise.resolve()), Sound: { createAsync: jest.fn() } } }));
jest.mock("../../utils/azureSpeech", () => ({ azureSpeechService: { speak: jest.fn(), stop: jest.fn(() => Promise.resolve()) } }));
jest.mock("../../services/offlineVocabularyAudioService", () => ({ resolveOfflineVocabularyAudioUri: jest.fn() }));
jest.mock("../../features/custom-srs/audio-cache", () => ({ resolveCustomVocabularyAudioForPlayback: jest.fn(async () => "file:///custom-audio.mp3") }));
jest.mock("../../utils/niaiSimilarKanji", () => ({ getNiaiSimilarKanjiSubjects: jest.fn(() => Promise.resolve([])) }));
jest.mock("../../utils/cache", () => ({ getAllSubjects: jest.fn(() => Promise.resolve([])) }));
jest.mock("../../utils/pitchAccent", () => ({ getWaniKaniPitchAccent: () => null }));
jest.mock("../../utils/wanikaniVocabularyPatterns", () => ({ getWaniKaniVocabularyPatterns: () => [] }));
jest.mock("../../utils/store", () => ({ useAuthStore: () => ({ userData: { username: "Portego", level: 21 } }), useSettingsStore: () => mockSettings }));
jest.mock("../../utils/theme", () => ({ useTheme: () => ({ theme: { backgroundColor: "#fff", border: "#ddd", cardBackground: "#fff", isDark: false, primary: "#08f", secondary: "#fa1f62", textColor: "#111", textLight: "#888", textSecondary: "#555" } }) }));
jest.mock("../../utils/subjectColors", () => ({ useSubjectColors: () => ({ radical: "#3c9bff", kanji: "#fa1f62", vocabulary: "#9c38d9" }), withAlpha: (color: string) => color }));
jest.mock("../../services/immersionKitService", () => ({ searchImmersionKit: jest.fn(), getCategoryColor: () => "#9c38d9", getCategoryDisplayName: () => "Anime" }));
jest.mock("../CopyTooltip", () => ({ CopyTooltip: () => null, useCopyTooltip: () => ({ containerRef: { current: null }, tooltipVisible: false, tooltipPosition: { x: 0, y: 0 }, tooltipOpacity: { value: 0 }, tooltipTranslateY: { value: 0 }, copyText: jest.fn() }) }));
jest.mock("../formatted-note", () => ({ FormattedNoteText: () => null }));
jest.mock("../note-field-container", () => ({ NoteFieldContainer: () => null }));
jest.mock("../CustomContextSentencesSection", () => ({ CustomContextSentencesSection: jest.fn(() => null) }));
jest.mock("../PitchAccentVisualization", () => () => null);
jest.mock("../SrsLevelIcon", () => () => null);
jest.mock("../SynonymsModal", () => ({ SynonymsModal: () => null }));
jest.mock("../VocabularyFrequencyBadge", () => () => null);

const vocabulary = {
  id: -2026,
  object: "kana_vocabulary",
  level: 0,
  characters: "やっぱり",
  meanings: [{ meaning: "As Expected", primary: true }],
  readings: [],
  partsOfSpeech: ["adverb"],
  meaningMnemonic: "The puppy says <reading>YAP—PARRY!</reading> and catches the ball, <vocabulary>as expected</vocabulary>.",
  readingMnemonic: "",
  contextSentences: [
    { ja: "やっぱりこの店のカレーはおいしい。", en: "As expected, this restaurant's curry is delicious." },
    { ja: "やっぱり歩いて行く。", en: "After all, I'll walk." },
  ],
  srsStage: 0,
  nextReviewAt: "2030-01-01T12:00:00.000Z",
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(searchImmersionKit).mockResolvedValue({ results: [], nextOffset: 0 });
});

it("shows only Meaning and Context for custom kana, rendering mnemonic tags as styled text", async () => {
  const screen = render(<VocabularyDetails vocabulary={vocabulary} progressionStatus="success" />);
  expect(screen.getByText("Meaning")).toBeTruthy();
  expect(screen.getByText("Context")).toBeTruthy();
  expect(screen.queryByText("Reading")).toBeNull();
  expect(screen.queryByText("Readings")).toBeNull();
  expect(screen.getByText("YAP—PARRY!")).toBeTruthy();
  expect(screen.queryByText(/<reading>/)).toBeNull();
  const meaningHighlight = screen.getByText("as expected");
  let highlightContainer = meaningHighlight.parent;
  while (highlightContainer && !StyleSheet.flatten(highlightContainer.props.style)?.backgroundColor) {
    highlightContainer = highlightContainer.parent;
  }
  expect(StyleSheet.flatten(highlightContainer?.props.style).backgroundColor).toBe("#9c38d9");
  fireEvent.press(screen.getByText("Context"));
  expect(mockSetPage).toHaveBeenCalledWith(1);
  expect(screen.getByText(vocabulary.contextSentences[0].ja)).toBeTruthy();
  expect(screen.getByText(vocabulary.contextSentences[1].en)).toBeTruthy();
  await waitFor(() => expect(screen.getByText(/No media examples found/)).toBeTruthy());
});

it("retains the Reading tab for custom kanji vocabulary", async () => {
  const screen = render(<VocabularyDetails vocabulary={{ ...vocabulary, object: "vocabulary", characters: "女子", level: 3, readings: [{ reading: "じょし", primary: true }], readingMnemonic: "The <reading>JO</reading>ker meets a sheep." }} progressionStatus="success" />);
  expect(screen.getByText("Reading")).toBeTruthy();
  fireEvent.press(screen.getByText("Reading"));
  expect(mockSetPage).toHaveBeenCalledWith(1);
  fireEvent.press(screen.getByText("Context"));
  expect(mockSetPage).toHaveBeenCalledWith(2);
  await waitFor(() => expect(screen.getByText(/No media examples found/)).toBeTruthy());
});

it("offers Shizuka audio on Meaning for custom kana and plays the cached clip", async () => {
  const audio = { url: "https://audio.example/clip.mp3", content_type: "audio/mpeg", metadata: { gender: "female", source_id: 1, pronunciation: "やっぱり", voice_actor_id: -1, voice_actor_name: "Shizuka", voice_description: "AI-generated Japanese pronunciation" } };
  jest.mocked(Audio.Sound.createAsync).mockResolvedValue({ sound: { setOnPlaybackStatusUpdate: jest.fn(), stopAsync: jest.fn(), unloadAsync: jest.fn() } } as never);
  const screen = render(<VocabularyDetails vocabulary={{ ...vocabulary, audioFiles: [audio] }} progressionStatus="success" />);
  expect(screen.getByText("Pronunciation")).toBeTruthy();
  expect(screen.getByText("Shizuka · AI-generated")).toBeTruthy();
  expect(screen.queryByText("Reading")).toBeNull();
  fireEvent.press(screen.getByLabelText("Play Shizuka pronunciation"));
  await waitFor(() => expect(resolveCustomVocabularyAudioForPlayback).toHaveBeenCalledWith(vocabulary.id, audio));
  await waitFor(() => expect(Audio.Sound.createAsync).toHaveBeenCalledWith({ uri: "file:///custom-audio.mp3" }, { shouldPlay: true }));
});
