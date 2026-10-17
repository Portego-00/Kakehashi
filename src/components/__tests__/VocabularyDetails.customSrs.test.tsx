import {packageManager} from "../../features/translation-packages/package-store";
import {parseTranslationPackage} from "../../features/translation-packages/resolver";
import {SentenceExplanation} from "../../features/translation-packages/SentenceExplanation";
import { act, fireEvent, render, waitFor, within } from "@testing-library/react-native";
import React from "react";
import { StyleSheet } from "react-native";
import PagerView from "react-native-pager-view";
import { searchImmersionKit } from "../../services/immersionKitService";
import { CustomContextSentencesSection } from "../CustomContextSentencesSection";
import VocabularyDetails from "../VocabularyDetails";
import { Audio } from "../../utils/expoAvCompat";
import { resolveCustomVocabularyAudioForPlayback } from "../../features/custom-srs/audio-cache";
import { getWaniKaniVocabularyPatterns } from "../../utils/wanikaniVocabularyPatterns";
import pilotContent from "../../../tests/fixtures/translation-packages/tr-learning-pilot.json";
import { useLearningContentStore } from "../../features/translation-packages/store";
import { getAllSubjects } from "../../utils/cache";

const mockSetPage = jest.fn();
const mockSettings = {
  showPitchAccent: false,
  showJLPTLevel: false,
  showVocabularyFrequency: false,
  showPatternsOfUse: false,
  showSimilarVocabulary: false,
  showSingleKanjiVocabularySimilarKanji: false,
  showMediaContextSentences: true,
  hideContextSentenceTranslations: false,
  hideContextSentenceTranslationsCompletely: false,
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
  // Exercise the shipped iOS child handling; a plain View hides null-page crashes.
  const { childrenWithOverriddenStyle } = jest.requireActual("react-native-pager-view/lib/commonjs/utils.ios");
  const Pager = React.forwardRef((props: React.ComponentProps<typeof View>, ref: React.ForwardedRef<{ setPage: (index: number) => void }>) => {
    React.useImperativeHandle(ref, () => ({ setPage: mockSetPage }));
    return <View {...props}>{childrenWithOverriddenStyle(props.children)}</View>;
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
jest.mock("../../utils/wanikaniVocabularyPatterns", () => ({ getWaniKaniVocabularyPatterns: jest.fn(() => []) }));
jest.mock("../../utils/store", () => ({ useAuthStore: () => ({ userData: { username: "Portego", level: 21 } }), useSettingsStore: (selector?: (state: typeof mockSettings) => unknown) => selector ? selector(mockSettings) : mockSettings }));
jest.mock("../../utils/theme", () => ({ useTheme: () => ({ theme: { backgroundColor: "#fff", border: "#ddd", cardBackground: "#fff", isDark: false, primary: "#08f", secondary: "#fa1f62", textColor: "#111", textLight: "#888", textSecondary: "#555" } }) }));
jest.mock("../../utils/subjectColors", () => ({ useSubjectColors: () => ({ radical: "#3c9bff", kanji: "#fa1f62", vocabulary: "#9c38d9" }), withAlpha: (color: string) => color }));
jest.mock("../../services/immersionKitService", () => ({ searchImmersionKit: jest.fn(), getCategoryColor: () => "#9c38d9", getCategoryDisplayName: () => "Anime" }));
jest.mock("../CopyTooltip", () => ({ CopyTooltip: () => null, useCopyTooltip: () => ({ containerRef: { current: null }, tooltipVisible: false, tooltipPosition: { x: 0, y: 0 }, tooltipOpacity: { value: 0 }, tooltipTranslateY: { value: 0 }, copyText: jest.fn() }) }));
jest.mock("../formatted-note", () => {
  const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
  return { FormattedNoteText: ({ text }: { text: string }) => <Text>{text}</Text> };
});
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
  srsStage: 1,
  nextReviewAt: "2030-01-01T12:00:00.000Z",
};

beforeEach(() => {
  packageManager.state.setState({packet: parseTranslationPackage(pilotContent), hydrated: true});
  jest.clearAllMocks();
  useLearningContentStore.setState({enabled: true});
  mockSettings.showJLPTLevel = false;
  mockSettings.showVocabularyFrequency = false;
  mockSettings.hideContextSentenceTranslations = false;
  mockSettings.hideContextSentenceTranslationsCompletely = false;
  mockSettings.showPatternsOfUse = false;
  mockSettings.showSimilarVocabulary = false;
  jest.mocked(getAllSubjects).mockResolvedValue([]);
  jest.mocked(getWaniKaniVocabularyPatterns).mockReturnValue([]);
  jest.mocked(searchImmersionKit).mockResolvedValue({ results: [], nextOffset: 0 });
});

const turkishFixture = () => {
  const source = pilotContent.subjects["9208"].source;
  return {...vocabulary, id: 9208, level: 8, characters: source.word,
    meanings: source.meaningsEn.map(meaning => ({meaning, primary: true})),
    readings: source.readingsJa.map(reading => ({reading, primary: true})),
    contextSentences: pilotContent.subjects["9208"].examples.map(example => example.source)};
};

it("shows Turkish meaning and checked sentence usage, with optional original English", async () => {
  const screen = render(<VocabularyDetails vocabulary={turkishFixture()} progressionStatus="success" initialTab="context" />);
  expect(screen.getAllByText("Hâlâ").length).toBeGreaterThan(0);
  expect(screen.getByText("Bunu henüz bilmiyorum.")).toBeTruthy();
  expect(screen.getByText(pilotContent.subjects["9208"].examples[0].usage)).toBeTruthy();
  expect(screen.queryByText("I don't know that yet.")).toBeNull();
  const explanation = screen.UNSAFE_getAllByType(SentenceExplanation).find(node => node.props.english === "I don't know that yet.")!;
  fireEvent.press(within(explanation).getByText("Show original English"));
  expect(screen.getByText("I don't know that yet.")).toBeTruthy();
  await waitFor(() => expect(searchImmersionKit).toHaveBeenCalled());
});

it("uses original English when Turkish content is disabled", async () => {
  useLearningContentStore.setState({enabled:false});
  const screen = render(<VocabularyDetails vocabulary={turkishFixture()} progressionStatus="success" initialTab="context" />);
  expect(screen.getByText("I don't know that yet.")).toBeTruthy();
  expect(screen.queryByText("Bunu henüz bilmiyorum.")).toBeNull();
  expect(screen.queryByText(pilotContent.subjects["9208"].examples[0].usage)).toBeNull();
  await waitFor(() => expect(searchImmersionKit).toHaveBeenCalled());
});

it("does not leak the Turkish usage explanation before revealing a translation", async () => {
  mockSettings.hideContextSentenceTranslations = true;
  const screen = render(<VocabularyDetails vocabulary={turkishFixture()} progressionStatus="success" initialTab="context" />);
  expect(screen.queryByText(pilotContent.subjects["9208"].examples[0].usage)).toBeNull();
  fireEvent.press(screen.getAllByText("Tap to reveal translation")[0]);
  expect(screen.getByText(pilotContent.subjects["9208"].examples[0].usage)).toBeTruthy();
  await waitFor(() => expect(searchImmersionKit).toHaveBeenCalled());
});

it("hides translation, usage and original English when all translations are hidden", async () => {
  mockSettings.hideContextSentenceTranslationsCompletely = true;
  const screen = render(<VocabularyDetails vocabulary={turkishFixture()} progressionStatus="success" initialTab="context" />);
  expect(screen.queryByText("Bunu henüz bilmiyorum.")).toBeNull();
  expect(screen.queryByText("I don't know that yet.")).toBeNull();
  expect(screen.queryByText(pilotContent.subjects["9208"].examples[0].usage)).toBeNull();
  await waitFor(() => expect(searchImmersionKit).toHaveBeenCalled());
});

it("matches similar vocabulary across English casing and whitespace without changing kana", async () => {
  mockSettings.showSimilarVocabulary = true;
  const subject = (id: number, characters: string, meaning: string, reading: string) => ({
    id, object: "vocabulary", data: { level: 4, characters,
      meanings: [{ meaning, primary: true }], readings: [{ reading, primary: true }],
    },
  });
  jest.mocked(getAllSubjects).mockResolvedValue([
    subject(2652, "先日", "The Other Day", "せんじつ"),
    subject(2653, "意味一致", "  the OTHER day  ", "べつ"),
    subject(2654, "読み一致", "Different Meaning", "  せんじつ  "),
    subject(2655, "不一致", "Unrelated", "きゅうじつ"),
  ] as any);
  const onSubjectPress = jest.fn();
  const screen = render(<VocabularyDetails vocabulary={{ ...vocabulary,
    id: 2652, object: "vocabulary", characters: "先日",
    meanings: [{ meaning: "The Other Day", primary: true }],
    readings: [{ reading: "せんじつ", primary: true }],
  }} progressionStatus="success" onSubjectPress={onSubjectPress}/>);
  await waitFor(() => expect(screen.getByText("意味一致")).toBeTruthy());
  expect(screen.queryByText("不一致")).toBeNull();
  fireEvent.press(screen.getByText("意味一致"));
  expect(onSubjectPress).toHaveBeenCalledWith(2653);
  fireEvent.press(screen.getAllByText("Reading")[0]);
  await waitFor(() => expect(screen.getByText("読み一致")).toBeTruthy());
  fireEvent.press(screen.getByText("読み一致"));
  expect(onSubjectPress).toHaveBeenCalledWith(2654);
});

it.each([
  [false, ""],
  [true, ""],
  [false, "My kana meaning note"],
  [true, "My kana meaning note"],
] as const)("shows editable WaniKani kana notes (embedded: %s, note: %j)", async (embedded, meaningNote) => {
  const onEditNote = jest.fn();
  const screen = render(<VocabularyDetails
    embedded={embedded}
    vocabulary={{ ...vocabulary, id: 9232, meaningNote, onEditNote }}
    progressionStatus="success"
  />);

  expect(screen.getByText("Notes")).toBeTruthy();
  expect(screen.getByText("Meaning Note")).toBeTruthy();
  expect(screen.queryByText("Reading Note")).toBeNull();
  if (meaningNote) expect(screen.getByText(meaningNote)).toBeTruthy();
  fireEvent.press(screen.getByLabelText(meaningNote ? "Edit meaning note" : "Add meaning note"), { stopPropagation: jest.fn() });
  expect(onEditNote).toHaveBeenCalledWith("meaning");

  fireEvent.press(screen.getByText("Context"));
  await waitFor(() => expect(screen.getByText(/No media examples found/)).toBeTruthy());
});

it.each([false, true])("renders ドキドキ with working kana tabs (embedded: %s)", async (embedded) => {
  const screen = render(
    <VocabularyDetails
      embedded={embedded}
      vocabulary={{
        ...vocabulary,
        id: 9232,
        characters: "ドキドキ",
        meanings: [{ meaning: "Pounding Heart", primary: true }],
        meaningMnemonic: "A <vocabulary>pounding heart</vocabulary> goes ドキドキ.",
        contextSentences: [{ ja: "心臓がドキドキする。", en: "My heart is pounding." }],
      }}
      progressionStatus="success"
    />,
  );

  expect(screen.getAllByText("Pounding Heart").length).toBeGreaterThan(0);
  const pager = screen.UNSAFE_getByType(PagerView);
  expect(React.Children.toArray(pager.props.children)).toHaveLength(2);
  expect(pager.props.initialPage).toBe(0);

  fireEvent.press(screen.getByText("Context"));
  expect(mockSetPage).toHaveBeenLastCalledWith(1);
  expect(screen.getByText("My heart is pounding.")).toBeTruthy();
  fireEvent.press(screen.getAllByText("Meaning")[0]);
  expect(mockSetPage).toHaveBeenLastCalledWith(0);
  fireEvent(pager, "pageSelected", { nativeEvent: { position: 1 } });
  expect(StyleSheet.flatten(screen.getByText("Context").props.style).color).toBe("white");
  fireEvent.press(screen.getByText("Context"));
  await waitFor(() => expect(screen.getByText(/No media examples found/)).toBeTruthy());
});

it.each([false, true])("removes all example translations regardless of tap-to-reveal being %s", async (hideUntilTapped) => {
  mockSettings.hideContextSentenceTranslations = hideUntilTapped;
  mockSettings.hideContextSentenceTranslationsCompletely = true;
  mockSettings.showPatternsOfUse = true;
  const pattern = { ja: "やっぱりそうだ。", en: "It is as I thought." };
  const media = { id: "anime-test", sentence: "やっぱり、君だったんだ。", translation: "It was you after all.", title: "Fixture_anime", category: "anime" };
  jest.mocked(getWaniKaniVocabularyPatterns).mockReturnValue([{ name: "やっぱり〜", examples: [pattern] }]);
  jest.mocked(searchImmersionKit).mockResolvedValue({ results: [media], nextOffset: 1 });

  const details = (
    <VocabularyDetails
      vocabulary={vocabulary}
      progressionStatus="success"
      initialTab="context"
    />
  );
  const screen = render(details);

  expect(await screen.findByText(media.sentence)).toBeTruthy();
  for (const sentence of [...vocabulary.contextSentences, pattern, { ja: media.sentence, en: media.translation }]) {
    expect(screen.getByText(sentence.ja)).toBeTruthy();
    expect(screen.queryByText(sentence.en)).toBeNull();
  }
  expect(screen.queryByText("Tap to reveal translation")).toBeNull();

  mockSettings.hideContextSentenceTranslationsCompletely = false;
  screen.rerender(React.cloneElement(details));
  expect(screen.getByText(pattern.en)).toBeTruthy();
  expect(screen.getByText(media.translation)).toBeTruthy();
  if (hideUntilTapped) {
    const revealButtons = screen.getAllByText("Tap to reveal translation");
    expect(revealButtons).toHaveLength(4);
    fireEvent.press(revealButtons[0]);
    expect(screen.getAllByText("Tap to reveal translation")).toHaveLength(3);
  } else {
    expect(screen.queryByText("Tap to reveal translation")).toBeNull();
  }

  mockSettings.hideContextSentenceTranslationsCompletely = true;
  screen.rerender(React.cloneElement(details));
  expect(screen.queryByText(pattern.en)).toBeNull();
  expect(screen.queryByText(media.translation)).toBeNull();
  expect(screen.queryByText(vocabulary.contextSentences[0].en)).toBeNull();
  expect(screen.queryByText("Tap to reveal translation")).toBeNull();
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
  fireEvent.press(screen.getByText("Context"));
  await waitFor(() => expect(screen.getByText(/No media examples found/)).toBeTruthy());
});

it("keeps custom progress but hides WaniKani-only editing and fabricated statistics", async () => {
  const screen = render(<VocabularyDetails vocabulary={vocabulary} progressionStatus="success" />);
  expect(screen.getAllByText("Apprentice I").length).toBeGreaterThan(0);
  expect(screen.queryByText("User Synonyms")).toBeNull();
  expect(screen.queryByText("Manage")).toBeNull();
  expect(screen.queryByText("Meaning Note")).toBeNull();
  expect(screen.queryByText("Reading Note")).toBeNull();
  expect(screen.queryByText("Current")).toBeNull();
  expect(screen.queryByText("Longest")).toBeNull();
  expect(screen.queryByText("0")).toBeNull();
  expect(CustomContextSentencesSection).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText("Context"));
  await waitFor(() => expect(screen.getByText(/No media examples found/)).toBeTruthy());
});

it("fetches anime context using the word rather than its synthetic subject ID", async () => {
  jest.mocked(searchImmersionKit).mockResolvedValue({ results: [{ id: "anime-test", sentence: "やっぱり、君だったんだ。", translation: "It was you after all.", title: "Fixture_anime", category: "anime" }], nextOffset: 1 });
  const screen = render(<VocabularyDetails vocabulary={vocabulary} progressionStatus="success" initialTab="context" />);
  await waitFor(() => expect(searchImmersionKit).toHaveBeenCalledWith("やっぱり", expect.objectContaining({ exactMatch: true, category: "anime", userLevel: 21 })));
  expect(screen.getByText("Media Context Sentences")).toBeTruthy();
  expect(CustomContextSentencesSection).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getByText("It was you after all.")).toBeTruthy());
  expect(screen.getByText("Fixture anime")).toBeTruthy();
});

it("retains the Reading tab for custom kanji vocabulary", async () => {
  const screen = render(<VocabularyDetails vocabulary={{ ...vocabulary, object: "vocabulary", characters: "女子", level: 3, readings: [{ reading: "じょし", primary: true }], readingMnemonic: "The <reading>JO</reading>ker meets a sheep." }} progressionStatus="success" />);
  expect(screen.getByText("Reading")).toBeTruthy();
  fireEvent.press(screen.getByText("Reading"));
  expect(mockSetPage).toHaveBeenCalledWith(1);
  fireEvent.press(screen.getByText("Context"));
  expect(mockSetPage).toHaveBeenCalledWith(2);
  fireEvent.press(screen.getByText("Context"));
  await waitFor(() => expect(screen.getByText(/No media examples found/)).toBeTruthy());
});

it.each([false, true])("keeps unvisited heavy pages unmounted while progression loads (embedded: %s) (#110)", async (embedded) => {
  const screen = render(<VocabularyDetails embedded={embedded} vocabulary={{ ...vocabulary,
    object: "vocabulary", characters: "先日", readings: [{ reading: "せんじつ", primary: true }],
  }} progressionStatus="loading" />);
  expect(screen.getAllByText("Loading progression...")).toHaveLength(1);
  expect(screen.queryByText("Readings")).toBeNull();
  expect(screen.queryByText(vocabulary.contextSentences[0].ja)).toBeNull();
  fireEvent.press(screen.getByText("Reading"));
  expect(screen.getByText("Readings")).toBeTruthy();
  fireEvent.press(screen.getByText("Context"));
  expect(screen.getByText(vocabulary.contextSentences[0].ja)).toBeTruthy();
  await screen.findByText(/No media examples found/);
});

it("offers Shizuka audio on Meaning for custom kana and plays the cached clip", async () => {
  const audio = { url: "https://audio.example/clip.mp3", content_type: "audio/mpeg", metadata: { gender: "female", source_id: 1, pronunciation: "やっぱり", voice_actor_id: -1, voice_actor_name: "Shizuka", voice_description: "AI-generated Japanese pronunciation" } };
  jest.mocked(Audio.Sound.createAsync).mockResolvedValue({ sound: { setOnPlaybackStatusUpdate: jest.fn(), stopAsync: jest.fn(), unloadAsync: jest.fn() } } as never);
  const screen = render(<VocabularyDetails vocabulary={{ ...vocabulary, audioFiles: [audio] }} progressionStatus="success" />);
  expect(screen.getByText("Pronunciation")).toBeTruthy();
  expect(screen.getByText("Shizuka")).toBeTruthy();
  expect(screen.queryByText(/AI-generated/)).toBeNull();
  expect(screen.queryByText("Reading")).toBeNull();
  fireEvent.press(screen.getByLabelText("Play Shizuka pronunciation"));
  await waitFor(() => expect(resolveCustomVocabularyAudioForPlayback).toHaveBeenCalledWith(vocabulary.id, audio));
  await waitFor(() => expect(Audio.Sound.createAsync).toHaveBeenCalledWith({ uri: "file:///custom-audio.mp3" }, { shouldPlay: true }));
});

it("releases the active vocabulary player when closing the card (#110)", async () => {
  const sound = { setOnPlaybackStatusUpdate: jest.fn(), stopAsync: jest.fn(async () => {}), unloadAsync: jest.fn(async () => {}) };
  jest.mocked(Audio.Sound.createAsync).mockResolvedValue({ sound } as never);
  const audio = { url: "https://audio.example/clip.mp3", content_type: "audio/mpeg", metadata: { gender: "female", source_id: 1, pronunciation: "やっぱり", voice_actor_id: -1, voice_actor_name: "Shizuka", voice_description: "" } };
  const screen = render(<VocabularyDetails vocabulary={{ ...vocabulary, audioFiles: [audio] }} progressionStatus="success" />);
  fireEvent.press(screen.getByLabelText("Play Shizuka pronunciation"));
  await waitFor(() => expect(sound.setOnPlaybackStatusUpdate).toHaveBeenCalled());
  screen.unmount();
  expect(sound.unloadAsync).toHaveBeenCalledTimes(1);
  expect(sound.setOnPlaybackStatusUpdate).toHaveBeenLastCalledWith(null);
});

it("releases a player that finishes loading after the card closes (#110)", async () => {
  const sound = { setOnPlaybackStatusUpdate: jest.fn(), stopAsync: jest.fn(async () => {}), unloadAsync: jest.fn(async () => {}) };
  let finishLoading!: (value: unknown) => void;
  jest.mocked(Audio.Sound.createAsync).mockImplementationOnce(() => new Promise(resolve => { finishLoading = resolve; }) as never);
  const audio = { url: "https://audio.example/clip.mp3", content_type: "audio/mpeg", metadata: { gender: "female", source_id: 1, pronunciation: "やっぱり", voice_actor_id: -1, voice_actor_name: "Shizuka", voice_description: "" } };
  const screen = render(<VocabularyDetails vocabulary={{ ...vocabulary, audioFiles: [audio] }} progressionStatus="success" />);
  fireEvent.press(screen.getByLabelText("Play Shizuka pronunciation"));
  await waitFor(() => expect(Audio.Sound.createAsync).toHaveBeenCalled());
  screen.unmount();
  await act(async () => finishLoading({ sound }));
  expect(sound.unloadAsync).toHaveBeenCalledTimes(1);
});

it.each(["vocabulary", "kana_vocabulary"])("shows optional JLPT and frequency labels in %s details", async (object) => {
  mockSettings.showJLPTLevel = true;
  mockSettings.showVocabularyFrequency = true;
  const screen = render(
    <VocabularyDetails
      embedded
      vocabulary={{ ...vocabulary, object, characters: "テレビ" }}
      progressionStatus="success"
    />,
  );
  expect(screen.getByText("JLPT Level")).toBeTruthy();
  expect(screen.getByText("N5")).toBeTruthy();
  expect(screen.getByText("Frequency")).toBeTruthy();
  fireEvent.press(screen.getByText("Context"));
  await waitFor(() => expect(screen.getByText(/No media examples found/)).toBeTruthy());
});
