import { Ionicons } from "@expo/vector-icons";
import Feather from "@expo/vector-icons/Feather";
import Slider from "@react-native-community/slider";
import { Audio, type AudioSound } from "@/src/utils/expoAvCompat";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  ActivityIndicator,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  type KeyboardEvent,
  type LayoutChangeEvent,
  Modal,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import PagerView from "react-native-pager-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SvgXml } from "react-native-svg";
import { TabBar, TabView } from "react-native-tab-view";
import {
  KeyboardExtendedBaseView,
  type KeyboardExtendedViewType,
  type OnKeyPress,
} from "react-native-external-keyboard";
import AudioSessionManager from "../modules/AudioSessionManager";
import {
  getCategoryColor,
  getCategoryDisplayName,
  ImmersionKitSentence,
  searchImmersionKit,
} from "../services/immersionKitService";
import {
  createStudyMaterial,
  getStudyMaterials,
  Subject as ApiSubject,
  updateStudyMaterial,
} from "../utils/api";
import { getAllSubjects } from "../utils/cache";
import { azureSpeechService } from "../utils/azureSpeech";
import { SynonymsModal } from "./SynonymsModal";
import { CopyTooltip, useCopyTooltip } from "./CopyTooltip";
import { fontStyles } from "../utils/fonts";
import { hiraganaToKata } from "../utils/katakanaMadness";
import { getNiaiSimilarKanjiSubjects } from "../utils/niaiSimilarKanji";
import { getWaniKaniPitchAccent } from "../utils/pitchAccent";
import { getWaniKaniVocabularyPatterns } from "../utils/wanikaniVocabularyPatterns";
import {
  getMnemonicImageAsset,
  getMnemonicImageUrlFromDocument,
  inlineSvgClassStyles,
} from "../utils/mnemonicImage";
import {
  pickPreferredPronunciationAudio,
  sortPronunciationAudiosByReadingAndGender,
} from "../utils/pronunciationAudio";
import { pickBestImage, useRemoteSvg } from "../utils/radicalSvg";
import { getCachedOrDownloadVocabularyAudioUri } from "../services/offlineVocabularyAudioService";
import {
  type SubjectColors,
  useSubjectColors,
  withAlpha,
} from "../utils/subjectColors";
import { useAuthStore, useSettingsStore } from "../utils/store";
import { useTheme } from "../utils/theme";
import KanjiPracticeModal from "./KanjiPracticeModal";
import PitchAccentVisualization from "./PitchAccentVisualization";
import StrokeOrderAnimation from "./StrokeOrderAnimation";

// Get screen dimensions
const { height } = Dimensions.get("window");

interface LessonDetailScreenProps {
  item: {
    id: number;
    subject: any;
  };
  onNext: () => void;
  onPrev: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  progress: {
    current: number;
    total: number;
    batchCurrent: number;
    batchTotal: number;
  };
  onExit: () => void;
  relatedSubjects?: { [key: number]: ApiSubject };
  typeCounts?: {
    radical: number;
    kanji: number;
    vocabulary: number;
  };
  batchItems?: { id: number; subject: any }[];
  currentBatchIndex?: number;
  onBatchItemPress?: (index: number) => void;
  onSubjectPress?: (subjectId: number) => void;
  onAddSubjectToList?: (subject: ApiSubject) => void;
}

const CONTEXT_AUDIO_SPEED_MIN = 0.5;
const CONTEXT_AUDIO_SPEED_MAX = 1.5;
const CONTEXT_AUDIO_SPEED_STEP = 0.05;
const DEFAULT_CONTEXT_AUDIO_SPEED = 1;
const MAX_INITIAL_SIMILAR_VOCAB_ITEMS = 12;
const CLOSE_BUTTON_HIT_SLOP = { top: 10, right: 10, bottom: 10, left: 10 };
const HEADER_TOP_OFFSET = 64;
const CLOSE_BUTTON_SIZE = 40;
// iOS keyCode values use UIKeyboardHIDUsage; Android/Web use platform key codes.
const IOS_LEFT_ARROW_KEY_CODE = 80;
const IOS_RIGHT_ARROW_KEY_CODE = 79;
const ANDROID_LEFT_ARROW_KEY_CODE = 21;
const ANDROID_RIGHT_ARROW_KEY_CODE = 22;
const WEB_LEFT_ARROW_KEY_CODE = 37;
const WEB_RIGHT_ARROW_KEY_CODE = 39;

const deferStateUpdate = (update: () => void) => {
  const timeout = setTimeout(update, 0);
  return () => clearTimeout(timeout);
};

interface SimilarVocabularyItem {
  id: number;
  characters: string;
  primaryMeaning: string;
  level: number;
}

interface SimilarKanjiSubject {
  id: number;
  object?: string;
  data?: {
    characters?: string | null;
    level?: number;
    meanings?: { meaning?: string; primary?: boolean }[];
    visually_similar_subject_ids?: number[] | null;
  };
  characters?: string;
  level?: number;
  meanings?: string[];
}

function normalizeSimilarVocabularyValue(value: string | null | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase("en-US");
}

function collectMatchingValues(values: string[], targetSet: Set<string>): string[] {
  const matches: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalized = normalizeSimilarVocabularyValue(value);
    if (!normalized || seen.has(normalized) || !targetSet.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    matches.push(value);
  }

  return matches;
}

function isKanjiCodePoint(codePoint: number): boolean {
  return (
    (codePoint >= 0x3400 && codePoint <= 0x4dbf) ||
    (codePoint >= 0x4e00 && codePoint <= 0x9fff) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0x20000 && codePoint <= 0x2a6df) ||
    (codePoint >= 0x2a700 && codePoint <= 0x2b73f) ||
    (codePoint >= 0x2b740 && codePoint <= 0x2b81f) ||
    (codePoint >= 0x2b820 && codePoint <= 0x2ceaf) ||
    (codePoint >= 0x2ceb0 && codePoint <= 0x2ebef) ||
    (codePoint >= 0x30000 && codePoint <= 0x323af)
  );
}

function getSingleKanjiVocabularyCharacter(
  object: string | undefined,
  characters: string | null | undefined
): string | null {
  if (object !== "vocabulary" || typeof characters !== "string") {
    return null;
  }

  const trimmedCharacters = characters.trim();
  const characterList = [...trimmedCharacters];
  if (characterList.length !== 1) {
    return null;
  }

  const codePoint = characterList[0].codePointAt(0);
  return codePoint !== undefined && isKanjiCodePoint(codePoint)
    ? characterList[0]
    : null;
}

function getSimilarKanjiSubjectCharacters(subject: SimilarKanjiSubject): string {
  return (
    subject.data?.characters ??
    subject.characters ??
    (typeof subject.id === "number" ? String(subject.id) : "?")
  );
}

function getSimilarKanjiSubjectLevel(subject: SimilarKanjiSubject): number {
  return Number(subject.data?.level ?? subject.level ?? 0);
}

function getSimilarKanjiSubjectPrimaryMeaning(
  subject: SimilarKanjiSubject
): string {
  const dataMeanings = Array.isArray(subject.data?.meanings)
    ? subject.data.meanings
    : [];
  const primaryDataMeaning =
    dataMeanings.find((meaning) => meaning?.primary)?.meaning ??
    dataMeanings[0]?.meaning;
  if (primaryDataMeaning) {
    return primaryDataMeaning;
  }

  return Array.isArray(subject.meanings) ? subject.meanings[0] ?? "" : "";
}

function sortAndDedupeSimilarKanjiSubjects(
  subjects: SimilarKanjiSubject[],
  excludedCharacter?: string | null
): SimilarKanjiSubject[] {
  const seenIds = new Set<number>();

  return subjects
    .filter((candidate) => {
      if (!candidate?.id || seenIds.has(candidate.id)) {
        return false;
      }
      const characters = getSimilarKanjiSubjectCharacters(candidate);
      if (excludedCharacter && characters === excludedCharacter) {
        return false;
      }
      seenIds.add(candidate.id);
      return true;
    })
    .sort((a, b) => {
      const levelDifference =
        getSimilarKanjiSubjectLevel(a) - getSimilarKanjiSubjectLevel(b);
      if (levelDifference !== 0) {
        return levelDifference;
      }
      return getSimilarKanjiSubjectCharacters(a).localeCompare(
        getSimilarKanjiSubjectCharacters(b)
      );
    });
}

const SubjectImageFallbackGlyph = ({
  subject,
  size,
  color,
  imageStyle,
  fallbackTextStyle,
  fallbackText = "?",
}: {
  subject: any;
  size: number;
  color: string;
  imageStyle?: StyleProp<any>;
  fallbackTextStyle?: StyleProp<TextStyle>;
  fallbackText?: string;
}) => {
  const characterImages = subject?.data?.character_images;
  const hasImages = Array.isArray(characterImages) && characterImages.length > 0;
  const bestImage = hasImages ? pickBestImage(characterImages) : null;
  const svgUrl = bestImage?.type === "svg" ? bestImage.url : null;
  const svgXml = useRemoteSvg(svgUrl, color);

  if (svgXml) {
    return <SvgXml xml={svgXml} width={size} height={size} />;
  }

  if (bestImage?.type === "png") {
    return (
      <Image
        source={{ uri: bestImage.url }}
        style={[imageStyle, { width: size, height: size, tintColor: color }]}
        resizeMode="contain"
      />
    );
  }

  const fallbackGlyph = fallbackText?.trim()?.charAt(0) || "?";
  return <Text style={fallbackTextStyle}>{fallbackGlyph}</Text>;
};

// Create a component that renders only the content of SubjectTabs without the tab UI
const SubjectContent = ({
  subject,
  tabIndex,
  relatedSubjects,
  onSubjectPress,
  playingAudioId,
  playAudio,
  loadingAudioId,
  setLoadingAudioId,
  sound,
  setSound,
  setPlayingAudioId,
  speakingSentenceId,
  speakJapanese,
  setSpeakingSentenceId,
  subjectTypeColor,
  showAllSections = false,
}: {
  subject: any;
  tabIndex: number;
  relatedSubjects: { [key: number]: ApiSubject };
  onSubjectPress?: (subjectId: number) => void;
  playingAudioId: string | null;
  playAudio: (
    audioUrl: string,
    id: string,
    subjectId?: number,
    pronunciationAudio?: { url: string }
  ) => void | Promise<void>;
  loadingAudioId: string | null;
  setLoadingAudioId: Dispatch<SetStateAction<string | null>>;
  sound: AudioSound | null;
  setSound: Dispatch<SetStateAction<AudioSound | null>>;
  setPlayingAudioId: Dispatch<SetStateAction<string | null>>;
  speakingSentenceId: string | null;
  speakJapanese: (text: string, id: string, speedMultiplier?: number) => void;
  setSpeakingSentenceId: Dispatch<SetStateAction<string | null>>;
  subjectTypeColor: string;
  showAllSections?: boolean;
}) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const {
    showPitchAccent,
    showPatternsOfUse,
    showSimilarVocabulary,
    showSingleKanjiVocabularySimilarKanji,
    showMediaContextSentences,
    hideContextSentenceTranslations,
    showContextSentenceSpeedControl,
    showMnemonicIllustrations,
    myAnimeListUsername,
    immersionKitAnimes,
    showStrokeOrder,
    showOnyomiInKatakana,
    visuallySimilarKanjiSource,
  } = useSettingsStore();
  const { userData } = useAuthStore();
  const { theme } = useTheme();
  const subjectColors = useSubjectColors();
  const styles = createStyles(theme, subjectColors);
  const [mediaSentences, setMediaSentences] = useState<ImmersionKitSentence[]>(
    []
  );
  const [loadingMediaSentences, setLoadingMediaSentences] = useState(false);
  const [playingMediaSentence, setPlayingMediaSentence] = useState<
    number | null
  >(null);
  const [loadingMediaSentence, setLoadingMediaSentence] = useState<
    number | null
  >(null);
  const [failedMediaUrls, setFailedMediaUrls] = useState<Set<string>>(
    new Set()
  );
  const [nextDataOffset, setNextDataOffset] = useState(0);
  const [visibleMediaCount, setVisibleMediaCount] = useState(10);
  const [revealedTranslations, setRevealedTranslations] = useState<Set<string>>(
    new Set()
  );
  const [sentencePlaybackSpeeds, setSentencePlaybackSpeeds] = useState<
    Record<string, number>
  >({});
  const [expandedSentenceSpeedId, setExpandedSentenceSpeedId] = useState<
    string | null
  >(null);
  const [cachedVocabularySubjects, setCachedVocabularySubjects] = useState<
    ApiSubject[]
  >([]);
  const [loadingSimilarVocabulary, setLoadingSimilarVocabulary] =
    useState(false);
  const [showAllSimilarByMeaning, setShowAllSimilarByMeaning] =
    useState(false);
  const [showAllSimilarByReading, setShowAllSimilarByReading] =
    useState(false);
  const [selectedUsagePatternIndex, setSelectedUsagePatternIndex] = useState(0);
  const [practiceModalVisible, setPracticeModalVisible] = useState(false);
  const [radicalMnemonicImageUrl, setRadicalMnemonicImageUrl] = useState<
    string | null
  >(null);
  const [radicalMnemonicSvgXml, setRadicalMnemonicSvgXml] = useState<
    string | null
  >(null);
  const [radicalMnemonicImageKind, setRadicalMnemonicImageKind] = useState<
    "unknown" | "svg" | "raster"
  >("unknown");

  // Synonyms state
  const [synonymsModalVisible, setSynonymsModalVisible] = useState(false);
  const [userSynonyms, setUserSynonyms] = useState<string[]>([]);
  const [studyMaterialId, setStudyMaterialId] = useState<number | null>(null);
  const [meaningNote, setMeaningNote] = useState("");
  const [readingNote, setReadingNote] = useState("");
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [editingNoteType, setEditingNoteType] = useState<
    "meaning" | "reading"
  >("meaning");
  const [editingNoteText, setEditingNoteText] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [androidKeyboardHeight, setAndroidKeyboardHeight] = useState(0);
  const [androidNoteModalLayoutHeight, setAndroidNoteModalLayoutHeight] =
    useState(0);
  const [androidBaselineModalHeight, setAndroidBaselineModalHeight] =
    useState(0);
  const { apiToken } = useAuthStore();
  const mountedRef = useRef(true);

  // Visually similar kanji state (for Niai source)
  const [niaiSimilarKanji, setNiaiSimilarKanji] = useState<any[]>([]);
  const [
    singleKanjiVocabularySimilarKanji,
    setSingleKanjiVocabularySimilarKanji,
  ] = useState<SimilarKanjiSubject[]>([]);

  const pitchAccentEntry = useMemo(() => {
    if (subject.object !== "vocabulary" && subject.object !== "kana_vocabulary") {
      return null;
    }

    const readings =
      Array.isArray(subject.data?.readings) && subject.data.readings.length > 0
        ? subject.data.readings
            .map((reading: { reading?: string }) => reading.reading)
            .filter(
              (reading: unknown): reading is string =>
                typeof reading === "string"
            )
        : [];

    if (typeof subject.data?.characters === "string") {
      readings.push(subject.data.characters);
    }

    return getWaniKaniPitchAccent(subject.id, readings);
  }, [
    subject.id,
    subject.object,
    subject.data,
  ]);
  const usagePatterns = useMemo(() => {
    if (subject.object !== "vocabulary" && subject.object !== "kana_vocabulary") {
      return [];
    }

    const level = Number(subject.data?.level ?? 0);
    const characters =
      typeof subject.data?.characters === "string" ? subject.data.characters : "";

    return getWaniKaniVocabularyPatterns(level, characters);
  }, [subject.object, subject.data]);
  const selectedUsagePattern =
    usagePatterns[selectedUsagePatternIndex] ?? usagePatterns[0] ?? null;
  const isVocabularySubject =
    subject.object === "vocabulary" || subject.object === "kana_vocabulary";
  const isVocabularyMeaningTab =
    showAllSections ||
    (subject.object === "vocabulary" && tabIndex === 1) ||
    (subject.object === "kana_vocabulary" && tabIndex === 0);
  const isVocabularyReadingTab =
    showAllSections ||
    (subject.object === "vocabulary" && tabIndex === 2) ||
    (subject.object === "kana_vocabulary" && tabIndex === 0);
  const isVocabularyContextTab =
    showAllSections ||
    (subject.object === "vocabulary" && tabIndex === 3) ||
    (subject.object === "kana_vocabulary" && tabIndex === 1);
  const shouldLoadStudyMaterials =
    showAllSections ||
    (subject.object === "radical" && tabIndex === 0) ||
    (subject.object === "kanji" && (tabIndex === 1 || tabIndex === 2)) ||
    (subject.object === "vocabulary" && (tabIndex === 1 || tabIndex === 2)) ||
    (subject.object === "kana_vocabulary" && tabIndex === 0);
  const shouldLoadSimilarVocabulary =
    showSimilarVocabulary &&
    isVocabularySubject &&
    (isVocabularyMeaningTab || isVocabularyReadingTab);
  const shouldLoadSingleKanjiVocabularySimilarKanji =
    showAllSections || (subject.object === "vocabulary" && tabIndex === 0);
  const shouldLoadMediaContextSentences =
    showMediaContextSentences && isVocabularySubject && isVocabularyContextTab;
  const shouldLoadRadicalMnemonicIllustration =
    showAllSections || (subject.object === "radical" && tabIndex === 0);
  const shouldLoadKanjiVisualSimilar =
    showAllSections || (subject.object === "kanji" && tabIndex === 0);

  const subjectReadingSet = useMemo(() => {
    if (!isVocabularySubject || !Array.isArray(subject.data?.readings)) {
      return new Set<string>();
    }

    const set = new Set<string>();
    for (const reading of subject.data.readings) {
      const normalized = normalizeSimilarVocabularyValue(reading?.reading);
      if (normalized) {
        set.add(normalized);
      }
    }

    return set;
  }, [isVocabularySubject, subject.data.readings]);

  const subjectMeaningSet = useMemo(() => {
    if (!isVocabularySubject || !Array.isArray(subject.data?.meanings)) {
      return new Set<string>();
    }

    const set = new Set<string>();
    for (const meaning of subject.data.meanings) {
      const normalized = normalizeSimilarVocabularyValue(meaning?.meaning);
      if (normalized) {
        set.add(normalized);
      }
    }

    return set;
  }, [isVocabularySubject, subject.data]);

  const similarVocabularyByReading = useMemo<SimilarVocabularyItem[]>(() => {
    if (!showSimilarVocabulary || !isVocabularySubject || subjectReadingSet.size === 0) {
      return [];
    }

    const matches: SimilarVocabularyItem[] = [];
    for (const candidate of cachedVocabularySubjects) {
      if (!candidate?.id || candidate.id === subject.id) {
        continue;
      }
      if (
        candidate.object !== "vocabulary" &&
        candidate.object !== "kana_vocabulary"
      ) {
        continue;
      }

      const readings = Array.isArray(candidate.data?.readings)
        ? candidate.data.readings
        : [];
      const matchedReadings = collectMatchingValues(
        readings.map((reading: any) => reading?.reading ?? ""),
        subjectReadingSet
      );
      if (matchedReadings.length === 0) {
        continue;
      }

      const meanings = Array.isArray(candidate.data?.meanings)
        ? candidate.data.meanings
        : [];
      const primaryMeaning =
        meanings.find((meaning: any) => meaning?.primary)?.meaning ??
        meanings[0]?.meaning ??
        "";

      matches.push({
        id: candidate.id,
        characters: candidate.data?.characters ?? "",
        primaryMeaning,
        level: Number(candidate.data?.level ?? 0),
      });
    }

    return matches.sort((a, b) => {
      if (a.level !== b.level) {
        return a.level - b.level;
      }
      return (a.characters || a.primaryMeaning).localeCompare(
        b.characters || b.primaryMeaning
      );
    });
  }, [
    cachedVocabularySubjects,
    isVocabularySubject,
    showSimilarVocabulary,
    subject.id,
    subjectReadingSet,
  ]);

  const similarVocabularyByMeaning = useMemo<SimilarVocabularyItem[]>(() => {
    if (!showSimilarVocabulary || !isVocabularySubject || subjectMeaningSet.size === 0) {
      return [];
    }

    const matches: SimilarVocabularyItem[] = [];
    for (const candidate of cachedVocabularySubjects) {
      if (!candidate?.id || candidate.id === subject.id) {
        continue;
      }
      if (
        candidate.object !== "vocabulary" &&
        candidate.object !== "kana_vocabulary"
      ) {
        continue;
      }

      const meanings = Array.isArray(candidate.data?.meanings)
        ? candidate.data.meanings
        : [];
      const matchedMeanings = collectMatchingValues(
        meanings.map((meaning: any) => meaning?.meaning ?? ""),
        subjectMeaningSet
      );
      if (matchedMeanings.length === 0) {
        continue;
      }

      const primaryMeaning =
        meanings.find((meaning: any) => meaning?.primary)?.meaning ??
        meanings[0]?.meaning ??
        "";

      matches.push({
        id: candidate.id,
        characters: candidate.data?.characters ?? "",
        primaryMeaning,
        level: Number(candidate.data?.level ?? 0),
      });
    }

    return matches.sort((a, b) => {
      if (a.level !== b.level) {
        return a.level - b.level;
      }
      return (a.characters || a.primaryMeaning).localeCompare(
        b.characters || b.primaryMeaning
      );
    });
  }, [
    cachedVocabularySubjects,
    isVocabularySubject,
    showSimilarVocabulary,
    subject.id,
    subjectMeaningSet,
  ]);
  const themedRadicalMnemonicSvgXml = useMemo(
    () =>
      radicalMnemonicSvgXml
        ? inlineSvgClassStyles(
            radicalMnemonicSvgXml,
            theme.textColor,
            theme.isDark,
            theme.textColor
          )
        : null,
    [radicalMnemonicSvgXml, theme.textColor, theme.isDark]
  );

  const orderedPronunciationAudios = useMemo(() => {
    const mpegAudios = Array.isArray(subject.data?.pronunciation_audios)
      ? subject.data.pronunciation_audios.filter(
          (audio: any) => audio?.content_type === "audio/mpeg"
        )
      : [];

    return sortPronunciationAudiosByReadingAndGender(
      mpegAudios,
      Array.isArray(subject.data?.readings) ? subject.data.readings : null
    );
  }, [subject.data.pronunciation_audios, subject.data.readings]);

  const orderedVocabularyComponentSubjectIds = useMemo(() => {
    if (subject.object !== "vocabulary") {
      return [];
    }

    const componentSubjectIds = Array.isArray(subject.data?.component_subject_ids)
      ? subject.data.component_subject_ids
      : [];
    if (componentSubjectIds.length <= 1) {
      return componentSubjectIds;
    }

    const vocabularyCharacters =
      typeof subject.data?.characters === "string" ? subject.data.characters : "";

    type OrderedComponentSubjectEntry = {
      id: number;
      index: number;
      characterIndex: number;
    };

    const orderedEntries: OrderedComponentSubjectEntry[] = componentSubjectIds
      .map((id: number, index: number): OrderedComponentSubjectEntry => {
        const componentCharacters = relatedSubjects[id]?.data?.characters;
        const characterIndex =
          typeof componentCharacters === "string" && vocabularyCharacters.length > 0
            ? vocabularyCharacters.indexOf(componentCharacters)
            : -1;

        return {
          id,
          index,
          characterIndex:
            characterIndex >= 0 ? characterIndex : Number.MAX_SAFE_INTEGER,
        };
      });

    return orderedEntries
      .sort(
        (left: OrderedComponentSubjectEntry, right: OrderedComponentSubjectEntry) =>
          left.characterIndex - right.characterIndex || left.index - right.index
      )
      .map((entry: OrderedComponentSubjectEntry) => entry.id);
  }, [
    subject.object,
    subject.data.component_subject_ids,
    subject.data.characters,
    relatedSubjects,
  ]);
  const singleKanjiVocabularyCharacter = useMemo(
    () =>
      getSingleKanjiVocabularyCharacter(
        subject.object,
        subject.data?.characters
      ),
    [subject.object, subject.data.characters]
  );

  const renderPitchAccent = (withBottomMargin = false) => {
    if (!showPitchAccent || !pitchAccentEntry) {
      return null;
    }

    return (
      <PitchAccentVisualization
        reading={pitchAccentEntry.r}
        accents={pitchAccentEntry.p}
        containerStyle={{
          marginTop: 8,
          marginBottom: withBottomMargin ? 16 : 0,
        }}
      />
    );
  };

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    if (!shouldLoadSimilarVocabulary) {
      const cancelReset = deferStateUpdate(() => {
        if (!isMounted) {
          return;
        }
        setCachedVocabularySubjects([]);
        setLoadingSimilarVocabulary(false);
      });
      return () => {
        isMounted = false;
        cancelReset();
      };
    }

    const loadCachedVocabulary = async () => {
      setLoadingSimilarVocabulary(true);

      try {
        const subjects = (await getAllSubjects()) as ApiSubject[];
        if (!isMounted) {
          return;
        }

        const vocabularySubjects = subjects.filter(
          (candidate) =>
            candidate.object === "vocabulary" ||
            candidate.object === "kana_vocabulary"
        );
        setCachedVocabularySubjects(vocabularySubjects);
      } catch (error) {
        console.warn(
          "[LessonDetail] Failed to load cached vocabulary subjects:",
          error
        );
        if (isMounted) {
          setCachedVocabularySubjects([]);
        }
      } finally {
        if (isMounted) {
          setLoadingSimilarVocabulary(false);
        }
      }
    };

    loadCachedVocabulary();

    return () => {
      isMounted = false;
    };
  }, [shouldLoadSimilarVocabulary]);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const handleKeyboardDidShow = (event: KeyboardEvent) => {
      const nextHeight = Math.max(0, Math.round(event.endCoordinates?.height ?? 0));
      setAndroidKeyboardHeight(nextHeight);
    };

    const handleKeyboardDidHide = () => {
      setAndroidKeyboardHeight(0);
    };

    const showSubscription = Keyboard.addListener(
      "keyboardDidShow",
      handleKeyboardDidShow,
    );
    const hideSubscription = Keyboard.addListener(
      "keyboardDidHide",
      handleKeyboardDidHide,
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android" || noteModalVisible) return;
    return deferStateUpdate(() => setAndroidKeyboardHeight(0));
  }, [noteModalVisible]);

  const handleNoteModalOverlayLayout = (event: LayoutChangeEvent) => {
    if (Platform.OS !== "android") return;
    const nextHeight = Math.round(event.nativeEvent.layout.height);
    if (androidKeyboardHeight <= 0) {
      setAndroidBaselineModalHeight((currentHeight) =>
        Math.max(currentHeight, nextHeight),
      );
    }
    setAndroidNoteModalLayoutHeight((currentHeight) =>
      currentHeight === nextHeight ? currentHeight : nextHeight,
    );
  };

  const syncAndroidKeyboardMetrics = () => {
    if (Platform.OS !== "android") return;

    const syncMetrics = () => {
      if (!mountedRef.current) return;
      const keyboardMetrics = Keyboard.metrics();
      const measuredHeight = Math.max(
        0,
        Math.round(keyboardMetrics?.height ?? 0),
      );
      if (measuredHeight > 0) {
        setAndroidKeyboardHeight(measuredHeight);
      }
    };

    requestAnimationFrame(syncMetrics);
    setTimeout(syncMetrics, 120);
  };

  // Reset scroll position when subject changes
  useEffect(() => {
    scrollViewRef.current?.scrollTo({ x: 0, y: 0, animated: false });
    return deferStateUpdate(() => {
      setRevealedTranslations(new Set());
      setSentencePlaybackSpeeds({});
      setExpandedSentenceSpeedId(null);
      setSelectedUsagePatternIndex(0);
      setShowAllSimilarByMeaning(false);
      setShowAllSimilarByReading(false);
    });
  }, [subject.id]);

  useEffect(() => {
    if (!showContextSentenceSpeedControl) {
      return deferStateUpdate(() => setExpandedSentenceSpeedId(null));
    }
  }, [showContextSentenceSpeedControl]);

  // Fetch Niai similar kanji when source is set to Niai
  useEffect(() => {
    if (
      subject.object !== "kanji" ||
      visuallySimilarKanjiSource !== "niai" ||
      !shouldLoadKanjiVisualSimilar
    ) {
      return deferStateUpdate(() => setNiaiSimilarKanji([]));
    }

    const kanjiChar = subject.data?.characters;
    if (!kanjiChar) return;

    getNiaiSimilarKanjiSubjects(kanjiChar)
      .then((subjects) => setNiaiSimilarKanji(subjects))
      .catch((err) => {
        console.warn("[LessonDetail] Failed to fetch Niai similar kanji:", err);
        setNiaiSimilarKanji([]);
      });
  }, [
    subject.id,
    subject.object,
    subject.data?.characters,
    visuallySimilarKanjiSource,
    shouldLoadKanjiVisualSimilar,
  ]);

  useEffect(() => {
    let isMounted = true;

    if (
      !showSingleKanjiVocabularySimilarKanji ||
      !singleKanjiVocabularyCharacter ||
      !shouldLoadSingleKanjiVocabularySimilarKanji
    ) {
      const cancelReset = deferStateUpdate(() => {
        if (isMounted) {
          setSingleKanjiVocabularySimilarKanji([]);
        }
      });
      return () => {
        isMounted = false;
        cancelReset();
      };
    }

    const cancelInitialReset = deferStateUpdate(() => {
      if (isMounted) {
        setSingleKanjiVocabularySimilarKanji([]);
      }
    });

    const loadSimilarKanji = async () => {
      try {
        if (visuallySimilarKanjiSource === "niai") {
          const niaiSubjects = await getNiaiSimilarKanjiSubjects(
            singleKanjiVocabularyCharacter
          );
          if (!isMounted) {
            return;
          }

          setSingleKanjiVocabularySimilarKanji(
            sortAndDedupeSimilarKanjiSubjects(
              niaiSubjects,
              singleKanjiVocabularyCharacter
            )
          );
          return;
        }

        const allSubjects = (await getAllSubjects()) as SimilarKanjiSubject[];
        if (!isMounted) {
          return;
        }

        const subjectsById = new Map<number, SimilarKanjiSubject>();
        for (const cachedSubject of allSubjects) {
          if (cachedSubject?.id) {
            subjectsById.set(cachedSubject.id, cachedSubject);
          }
        }

        const componentKanjiSubject =
          orderedVocabularyComponentSubjectIds
            .map(
              (subjectId: number) =>
                relatedSubjects[subjectId] ?? subjectsById.get(subjectId)
            )
            .find(
              (candidate: SimilarKanjiSubject | undefined) =>
                candidate?.object === "kanji" &&
                getSimilarKanjiSubjectCharacters(candidate) ===
                  singleKanjiVocabularyCharacter
            ) ??
          allSubjects.find(
            (candidate) =>
              candidate?.object === "kanji" &&
              getSimilarKanjiSubjectCharacters(candidate) ===
                singleKanjiVocabularyCharacter
          );

        const similarSubjectIds = Array.isArray(
          componentKanjiSubject?.data?.visually_similar_subject_ids
        )
          ? componentKanjiSubject.data.visually_similar_subject_ids
          : [];
        const similarSubjects = similarSubjectIds
          .map(
            (subjectId: number) =>
              relatedSubjects[subjectId] ?? subjectsById.get(subjectId)
          )
          .filter(
            (
              candidate: SimilarKanjiSubject | undefined
            ): candidate is SimilarKanjiSubject =>
              candidate !== undefined && candidate !== null
          );

        setSingleKanjiVocabularySimilarKanji(
          sortAndDedupeSimilarKanjiSubjects(
            similarSubjects,
            singleKanjiVocabularyCharacter
          )
        );
      } catch (err) {
        console.warn(
          "[LessonDetail] Failed to load visually similar kanji for vocabulary:",
          err
        );
        if (isMounted) {
          setSingleKanjiVocabularySimilarKanji([]);
        }
      }
    };

    void loadSimilarKanji();

    return () => {
      isMounted = false;
      cancelInitialReset();
    };
  }, [
    singleKanjiVocabularyCharacter,
    showSingleKanjiVocabularySimilarKanji,
    shouldLoadSingleKanjiVocabularySimilarKanji,
    visuallySimilarKanjiSource,
    orderedVocabularyComponentSubjectIds,
    relatedSubjects,
  ]);

  const applyStudyMaterialState = (material: any | null) => {
    if (!material) {
      setUserSynonyms([]);
      setStudyMaterialId(null);
      setMeaningNote("");
      setReadingNote("");
      return;
    }

    setUserSynonyms(material.data?.meaning_synonyms || []);
    setStudyMaterialId(material.id);
    setMeaningNote(material.data?.meaning_note || "");
    setReadingNote(material.data?.reading_note || "");
  };

  const upsertStudyMaterial = useCallback(
    async (updates: {
      meaning_synonyms?: string[];
      meaning_note?: string;
      reading_note?: string;
    }) => {
      if (!apiToken) throw new Error("Missing API token");

      if (studyMaterialId) {
        return updateStudyMaterial(apiToken, studyMaterialId, updates);
      }

      try {
        return await createStudyMaterial(apiToken, {
          subject_id: subject.id,
          ...updates,
        });
      } catch (createError: any) {
        // Handle eventual consistency when a material exists but local state has no id.
        if (!String(createError?.message || "").includes("422")) {
          throw createError;
        }
        const studyMaterials = await getStudyMaterials(
          apiToken,
          { subject_ids: [subject.id] },
          { skipCache: true }
        );
        const existingMaterial = studyMaterials?.data?.[0];
        if (existingMaterial?.id) {
          return updateStudyMaterial(apiToken, existingMaterial.id, updates);
        }
        throw createError;
      }
    },
    [apiToken, studyMaterialId, subject.id]
  );

  // Fetch study materials for user synonyms and notes
  useEffect(() => {
    if (!apiToken || !subject.id || !shouldLoadStudyMaterials) {
      return deferStateUpdate(() => applyStudyMaterialState(null));
    }

    getStudyMaterials(apiToken, { subject_ids: [subject.id] })
      .then((response) => {
        if (response?.data?.[0]) {
          applyStudyMaterialState(response.data[0]);
        } else {
          applyStudyMaterialState(null);
        }
      })
      .catch((error) => {
        console.warn("[LessonDetail] Failed to fetch study materials:", error);
      });
  }, [apiToken, subject.id, shouldLoadStudyMaterials]);

  // Handler for saving synonyms
  const handleSynonymsChange = async (synonyms: string[]) => {
    if (!apiToken) return;

    try {
      const savedMaterial = await upsertStudyMaterial({
        meaning_synonyms: synonyms,
      });
      applyStudyMaterialState(savedMaterial);
    } catch (error) {
      console.error("[LessonDetail] Failed to save synonyms:", error);
      throw error;
    }
  };

  const handleEditNote = (type: "meaning" | "reading") => {
    setEditingNoteType(type);
    setEditingNoteText(type === "meaning" ? meaningNote : readingNote);
    setNoteModalVisible(true);
  };

  const handleSaveNote = async () => {
    if (!apiToken) return;

    setIsSavingNote(true);
    try {
      const updates =
        editingNoteType === "meaning"
          ? { meaning_note: editingNoteText }
          : { reading_note: editingNoteText };
      const savedMaterial = await upsertStudyMaterial(updates);
      applyStudyMaterialState(savedMaterial);
      setNoteModalVisible(false);
    } catch (error) {
      console.error("[LessonDetail] Failed to save note:", error);
      Alert.alert(
        "Error",
        `Failed to save note: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsSavingNote(false);
    }
  };

  // Fetch media sentences for vocabulary
  const fetchMediaSentences = useCallback(async (offset = 0) => {
    const isVocabulary =
      subject.object === "vocabulary" || subject.object === "kana_vocabulary";
    if (
      !subject.data.characters ||
      !isVocabulary ||
      !shouldLoadMediaContextSentences
    ) {
      return;
    }

    setLoadingMediaSentences(true);

    try {
      // Fetch a larger batch for buffering (e.g. 50)
      const BUFFER_SIZE = 50;
      const response = await searchImmersionKit(subject.data.characters, {
        exactMatch: true,
        limit: BUFFER_SIZE,
        category: "anime",
        myAnimeListUsername,
        selectedAnimes: immersionKitAnimes,
        userLevel: userData?.level || subject.data.level,
        skip: offset,
      });

      setNextDataOffset(response.nextOffset);

      setMediaSentences((prev) => {
        if (offset === 0) {
          return response.results;
        }
        // Append new results, avoiding duplicates
        const existingIds = new Set(prev.map((s) => s.id));
        const newSentences = response.results.filter((s) => !existingIds.has(s.id));
        return [...prev, ...newSentences];
      });
    } catch (error) {
      console.error("[LessonDetail] Error fetching media sentences:", error);
    } finally {
      setLoadingMediaSentences(false);
    }
  }, [
    subject.object,
    subject.data.characters,
    subject.data.level,
    shouldLoadMediaContextSentences,
    myAnimeListUsername,
    immersionKitAnimes,
    userData,
  ]);

  useEffect(() => {
    if (!shouldLoadMediaContextSentences) {
      return deferStateUpdate(() => {
        setLoadingMediaSentences(false);
        setMediaSentences([]);
        setNextDataOffset(0);
        setVisibleMediaCount(10);
      });
    }

    return deferStateUpdate(() => {
      setNextDataOffset(0);
      setVisibleMediaCount(10);
      fetchMediaSentences(0);
    });
  }, [fetchMediaSentences, shouldLoadMediaContextSentences]);

  const loadMoreMediaSentences = () => {
    const newVisibleCount = visibleMediaCount + 10;
    setVisibleMediaCount(newVisibleCount);

    // If we're nearing the end of our buffer, fetch more in the background
    // (e.g., if we have less than 10 unseen items left)
    if (mediaSentences.length - newVisibleCount < 10) {
      fetchMediaSentences(nextDataOffset);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const documentUrl =
      typeof subject.data?.document_url === "string"
        ? subject.data.document_url.trim()
        : "";

    if (
      subject.object !== "radical" ||
      !showMnemonicIllustrations ||
      !shouldLoadRadicalMnemonicIllustration ||
      !documentUrl
    ) {
      return deferStateUpdate(() => setRadicalMnemonicImageUrl(null));
    }

    getMnemonicImageUrlFromDocument(documentUrl)
      .then((imageUrl) => {
        if (!cancelled) setRadicalMnemonicImageUrl(imageUrl);
      })
      .catch(() => {
        if (!cancelled) setRadicalMnemonicImageUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [
    subject.id,
    subject.object,
    subject.data?.document_url,
    showMnemonicIllustrations,
    shouldLoadRadicalMnemonicIllustration,
  ]);

  useEffect(() => {
    let cancelled = false;

    if (
      subject.object !== "radical" ||
      !showMnemonicIllustrations ||
      !shouldLoadRadicalMnemonicIllustration ||
      !radicalMnemonicImageUrl
    ) {
      return deferStateUpdate(() => {
        setRadicalMnemonicSvgXml(null);
        setRadicalMnemonicImageKind("unknown");
      });
    }

    const cancelInitialReset = deferStateUpdate(() => {
      if (cancelled) {
        return;
      }
      setRadicalMnemonicSvgXml(null);
      setRadicalMnemonicImageKind("unknown");
    });

    getMnemonicImageAsset(radicalMnemonicImageUrl)
      .then((asset) => {
        if (cancelled) return;
        if (asset.kind === "svg") {
          setRadicalMnemonicSvgXml(asset.svgXml);
          setRadicalMnemonicImageKind("svg");
        } else {
          setRadicalMnemonicSvgXml(null);
          setRadicalMnemonicImageKind("raster");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRadicalMnemonicSvgXml(null);
          setRadicalMnemonicImageKind("raster");
        }
      });

    return () => {
      cancelled = true;
      cancelInitialReset();
    };
  }, [
    subject.id,
    subject.object,
    showMnemonicIllustrations,
    shouldLoadRadicalMnemonicIllustration,
    radicalMnemonicImageUrl,
  ]);
  // Format mnemonic text with HTML highlighting (similar to KanjiDetails.tsx)
  const formatMnemonic = (mnemonic: string) => {
    if (!mnemonic) return null;

    // Replace HTML entities
    let processedText = mnemonic.replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    // Strip <ja> tags (open/self-closing and closing) entirely
    processedText = processedText
      .replace(/<ja\s*\/?>/g, "")
      .replace(/<\/ja\s*>/g, "");

    // Split the text by these tags to process them
    const segments: React.ReactNode[] = [];

    // Regular expression to find <em>, <radical>, <kanji>, <vocabulary>, <reading>, <ja> tags
    const regex =
      /<(em|radical|kanji|vocabulary|reading|ja)>(.*?)<\/\1>|([^<]+)/g;
    let match;
    let index = 0;

    while ((match = regex.exec(processedText)) !== null) {
      if (match[3]) {
        // Regular text
        segments.push(
          <Text key={index++} style={styles.mnemonicText}>
            {match[3]}
          </Text>
        );
      } else if (match[1] === "em") {
        // Emphasized text
        segments.push(
          <Text key={index++} style={styles.emText}>
            {match[2]}
          </Text>
        );
      } else if (match[1] === "radical") {
        // Radical text
        segments.push(
          <Text key={index++}>
            <View style={styles.inlineRadicalTag}>
              <Text style={styles.radicalTagText}>{match[2]}</Text>
            </View>
          </Text>
        );
      } else if (match[1] === "kanji") {
        // Kanji text
        segments.push(
          <Text key={index++}>
            <View style={styles.inlineKanjiTag}>
              <Text style={styles.kanjiTagText}>{match[2]}</Text>
            </View>
          </Text>
        );
      } else if (match[1] === "vocabulary") {
        // Vocabulary text
        segments.push(
          <Text key={index++}>
            <View style={styles.inlineVocabTag}>
              <Text style={styles.vocabTagText}>{match[2]}</Text>
            </View>
          </Text>
        );
      } else if (match[1] === "reading") {
        // Reading text
        segments.push(
          <Text key={index++}>
            <View style={styles.inlineReadingTag}>
              <Text style={styles.readingTagText}>{match[2]}</Text>
            </View>
          </Text>
        );
      } else if (match[1] === "ja") {
        // Japanese text (render as plain text)
        segments.push(
          <Text key={index++} style={styles.mnemonicText}>
            {match[2]}
          </Text>
        );
      }
    }

    return <Text style={styles.mnemonicTextContainer}>{segments}</Text>;
  };

  // Handle image load errors
  const handleImageError = (imageUrl: string) => {
    setFailedMediaUrls((prev) => new Set(prev).add(imageUrl));
  };

  // Filter out sentences with failed media
  const validMediaSentences = mediaSentences.filter(
    (sentence) => sentence.imageUrl && !failedMediaUrls.has(sentence.imageUrl)
  );

  const getSentenceSpeed = (sentenceId: string) =>
    showContextSentenceSpeedControl
      ? sentencePlaybackSpeeds[sentenceId] ?? DEFAULT_CONTEXT_AUDIO_SPEED
      : DEFAULT_CONTEXT_AUDIO_SPEED;

  const formatSentenceSpeed = (speed: number) =>
    speed.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");

  const updateSentenceSpeed = (sentenceId: string, speed: number) => {
    setSentencePlaybackSpeeds((prev) => ({
      ...prev,
      [sentenceId]: Number(speed.toFixed(2)),
    }));
  };

  const toggleSentenceSpeedControl = (sentenceId: string) => {
    setExpandedSentenceSpeedId((prev) => (prev === sentenceId ? null : sentenceId));
  };

  const renderSentenceSpeedControl = (sentenceId: string) => {
    if (!showContextSentenceSpeedControl) {
      return null;
    }

    const speed = getSentenceSpeed(sentenceId);
    const isExpanded = expandedSentenceSpeedId === sentenceId;

    return (
      <View style={styles.sentenceSpeedControl}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={[
            styles.sentenceSpeedToggle,
            {
              borderColor: theme.border,
              backgroundColor: isExpanded
                ? theme.primary
                : theme.isDark
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(0,0,0,0.04)",
            },
          ]}
          onPress={() => toggleSentenceSpeedControl(sentenceId)}
        >
          <Ionicons
            name="speedometer-outline"
            size={14}
            color={isExpanded ? "#fff" : theme.textSecondary}
          />
          <Text
            style={[
              styles.sentenceSpeedToggleText,
              { color: isExpanded ? "#fff" : theme.textSecondary },
            ]}
          >
            {formatSentenceSpeed(speed)}x
          </Text>
          <Ionicons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={14}
            color={isExpanded ? "#fff" : theme.textSecondary}
          />
        </TouchableOpacity>

        {isExpanded && (
          <View
            style={[
              styles.sentenceSpeedSliderContainer,
              {
                borderColor: theme.border,
                backgroundColor: theme.isDark
                  ? "rgba(255,255,255,0.03)"
                  : "rgba(0,0,0,0.03)",
              },
            ]}
          >
            <Slider
              minimumValue={CONTEXT_AUDIO_SPEED_MIN}
              maximumValue={CONTEXT_AUDIO_SPEED_MAX}
              step={CONTEXT_AUDIO_SPEED_STEP}
              value={speed}
              onValueChange={(value) => updateSentenceSpeed(sentenceId, value)}
              minimumTrackTintColor={theme.primary}
              maximumTrackTintColor={theme.border}
              thumbTintColor={theme.primary}
              style={styles.sentenceSpeedSlider}
            />
            <View style={styles.sentenceSpeedSliderFooter}>
              <Text
                style={[
                  styles.sentenceSpeedSliderEdgeLabel,
                  { color: theme.textSecondary },
                ]}
              >
                {CONTEXT_AUDIO_SPEED_MIN}x
              </Text>
              <TouchableOpacity
                style={styles.sentenceSpeedResetButton}
                onPress={() =>
                  updateSentenceSpeed(sentenceId, DEFAULT_CONTEXT_AUDIO_SPEED)
                }
              >
                <Text
                  style={[
                    styles.sentenceSpeedResetText,
                    { color: theme.primary },
                  ]}
                >
                  Reset
                </Text>
              </TouchableOpacity>
              <Text
                style={[
                  styles.sentenceSpeedSliderEdgeLabel,
                  { color: theme.textSecondary },
                ]}
              >
                {CONTEXT_AUDIO_SPEED_MAX}x
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  const revealTranslation = (translationId: string) => {
    setRevealedTranslations((prev) => {
      const next = new Set(prev);
      next.add(translationId);
      return next;
    });
  };

  const renderTranslation = (
    translation: string,
    translationId: string,
    textStyle: StyleProp<TextStyle>
  ) => {
    const isRevealed =
      !hideContextSentenceTranslations || revealedTranslations.has(translationId);

    if (isRevealed) {
      return (
        <Text selectable style={textStyle}>
          {translation}
        </Text>
      );
    }

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.translationRevealContainer}
        onPress={() => revealTranslation(translationId)}
      >
        <Text style={[textStyle, styles.translationHiddenText]}>{translation}</Text>
        <BlurView
          tint={theme.isDark ? "dark" : "light"}
          intensity={24}
          style={styles.translationBlurOverlay}
        />
        <View style={styles.translationRevealHint}>
          <Ionicons name="eye-outline" size={14} color={theme.textSecondary} />
          <Text
            style={[
              styles.translationRevealHintText,
              { color: theme.textSecondary },
            ]}
          >
            Tap to reveal translation
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Highlight the vocabulary word in the sentence
  const renderHighlightedSentence = (sentence: string, keyword: string) => {
    if (!keyword) return sentence;

    const parts = sentence.split(keyword);
    if (parts.length === 1) return sentence;

    return (
      <>
        {parts.map((part, index) => (
          <React.Fragment key={index}>
            {part}
            {index < parts.length - 1 && (
              <Text style={styles.highlightedKeyword}>{keyword}</Text>
            )}
          </React.Fragment>
        ))}
      </>
    );
  };

  // Parse and render furigana (kanji[reading] format) with ruby-like display
  const renderFurigana = (furiganaText: string, keyword: string) => {
    if (!furiganaText) return null;

    // Parse format like: 俺[おれ]も 食[た]べなさい
    const parts: React.ReactNode[] = [];
    const regex = /([^\s\[]+)\[([^\]]+)\]|([^\s\[]+)/g;
    let match;
    let index = 0;

    while ((match = regex.exec(furiganaText)) !== null) {
      if (match[1] && match[2]) {
        // Kanji with reading: 俺[おれ]
        const kanji = match[1];
        const reading = match[2];
        const isKeyword = kanji.includes(keyword);

        parts.push(
          <View key={index++} style={styles.rubyContainer}>
            <Text style={styles.rubyReading}>{reading}</Text>
            <Text
              style={[styles.rubyBase, isKeyword && styles.highlightedKeyword]}
            >
              {kanji}
            </Text>
          </View>
        );
      } else if (match[3]) {
        // Plain text without reading
        const text = match[3];
        const isKeyword = text.includes(keyword);

        parts.push(
          <Text
            key={index++}
            style={[styles.rubyBase, isKeyword && styles.highlightedKeyword]}
          >
            {text}
          </Text>
        );
      }
    }

    return <View style={styles.rubyLine}>{parts}</View>;
  };

  // Play media sentence audio or fallback to TTS
  const playMediaSentence = async (
    sentence: ImmersionKitSentence,
    index: number,
    sentenceId: string
  ) => {
    try {
      const speedMultiplier = getSentenceSpeed(sentenceId);

      // If this sentence is currently playing, stop it
      if (playingMediaSentence === index) {
        if (sound) {
          sound.setOnPlaybackStatusUpdate(null);
          await sound.stopAsync();
          await sound.unloadAsync();
          setSound(null);
        }
        setPlayingAudioId(null);
        setLoadingAudioId(null);
        setSpeakingSentenceId(null);
        setPlayingMediaSentence(null);
        setLoadingMediaSentence(null);
        return;
      }

      // Stop any currently playing media sentence
      if (playingMediaSentence !== null) {
        if (sound) {
          sound.setOnPlaybackStatusUpdate(null);
          await sound.stopAsync();
          await sound.unloadAsync();
          setSound(null);
        }
      }

      // Ensure other playback indicators reset
      setPlayingAudioId(null);
      setLoadingAudioId(null);
      setSpeakingSentenceId(null);
      setPlayingMediaSentence(index);
      setLoadingMediaSentence(index);

      // If the sentence has audio, play it directly
      if (sentence.audio) {
        // Override audio session to use speaker (iOS only)
        if (Platform.OS === "ios") {
          try {
            await AudioSessionManager.overrideSpeaker();
          } catch (error) {
            console.warn("Failed to override audio session:", error);
          }
        }

        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: sentence.audio },
          {
            shouldPlay: true,
            rate: speedMultiplier,
            shouldCorrectPitch: true,
          }
        );

        setSound(newSound);
        setLoadingMediaSentence(null);

        newSound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            setSound((currentSound) => {
              if (currentSound === newSound) {
                setPlayingMediaSentence(null);
                void newSound.unloadAsync();
                return null;
              }
              return currentSound;
            });
          }
        });
      } else {
        // ImmersionKit sentence has no source audio; keep the player idle.
        setPlayingMediaSentence(null);
        setLoadingMediaSentence(null);
      }
    } catch (error) {
      console.error("[LessonDetail] Error playing media sentence:", error);
      setPlayingMediaSentence(null);
      setLoadingMediaSentence(null);
    }
  };

  // Character renderer for related subjects (handles radical SVG fallback)
  const RelatedSubjectCharacter = ({
    subj,
    color = "#ffffff",
    size = 30,
  }: {
    subj?: ApiSubject;
    color?: string;
    size?: number;
  }) => {
    // Prepare data first
    const isRadical = subj?.object === "radical";
    const characterImages = (subj?.data as any)?.character_images;
    const hasImages =
      isRadical && Array.isArray(characterImages) && characterImages.length > 0;
    const best = hasImages ? pickBestImage(characterImages) : null;
    const svgUrl = best?.type === "svg" ? best.url : null;
    const svgXml = useRemoteSvg(svgUrl, color);

    // Now render with early exits
    if (!subj) {
      return <Text style={styles.relatedItemCharacter}>?</Text>;
    }
    const hasChars = !!subj.data?.characters;
    if (hasChars) {
      return (
        <Text style={styles.relatedItemCharacter}>{subj.data.characters}</Text>
      );
    }
    if (svgXml) {
      return <SvgXml xml={svgXml} width={size} height={size} />;
    }
    if (best?.type === "png") {
      return (
        <Image
          source={{ uri: best.url }}
          style={{ width: size, height: size }}
          resizeMode="contain"
        />
      );
    }
    const fallback = subj.data?.meanings?.[0]?.meaning || "?";
    return (
      <Text style={styles.relatedItemCharacter}>{fallback.charAt(0)}</Text>
    );
  };

  const getSimilarKanjiToShow = () => {
    if (subject.object !== "kanji") return [];
    const sourceItems =
      visuallySimilarKanjiSource === "niai"
        ? niaiSimilarKanji
        : (subject.data.visually_similar_subject_ids || [])
            .map((id: number) => relatedSubjects[id])
            .filter(Boolean);

    return sortAndDedupeSimilarKanjiSubjects(
      sourceItems,
      subject.data?.characters
    );
  };

  const renderVisuallySimilarKanjiSection = () => {
    const similarKanjiToShow = getSimilarKanjiToShow();
    if (similarKanjiToShow.length === 0) return null;

    return (
      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>Visually Similar Kanji</Text>
        <View style={styles.relatedItemsGrid}>
          {similarKanjiToShow.slice(0, 8).map((kanjiSubject: any) => (
            <TouchableOpacity
              key={kanjiSubject.id}
              style={[styles.relatedItem, { backgroundColor: subjectColors.kanji }]}
              onPress={() => onSubjectPress?.(kanjiSubject.id)}
            >
              <Text style={styles.relatedItemCharacter}>
                {getSimilarKanjiSubjectCharacters(kanjiSubject)}
              </Text>
              <Text style={styles.relatedItemMeaning}>
                {getSimilarKanjiSubjectPrimaryMeaning(kanjiSubject) ||
                  "Loading..."}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderSingleKanjiVocabularySimilarKanjiSection = () => {
    if (
      !showSingleKanjiVocabularySimilarKanji ||
      !singleKanjiVocabularyCharacter ||
      singleKanjiVocabularySimilarKanji.length === 0
    ) {
      return null;
    }

    return (
      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>Visually Similar Kanji</Text>
        <View style={styles.relatedItemsGrid}>
          {singleKanjiVocabularySimilarKanji
            .slice(0, 8)
            .map((kanjiSubject) => (
              <TouchableOpacity
                key={kanjiSubject.id}
                style={[
                  styles.relatedItem,
                  { backgroundColor: subjectColors.kanji },
                ]}
                onPress={() => onSubjectPress?.(kanjiSubject.id)}
                disabled={!onSubjectPress}
              >
                <Text style={styles.relatedItemCharacter}>
                  {getSimilarKanjiSubjectCharacters(kanjiSubject)}
                </Text>
                <Text style={styles.relatedItemMeaning}>
                  {getSimilarKanjiSubjectPrimaryMeaning(kanjiSubject) ||
                    "Loading..."}
                </Text>
              </TouchableOpacity>
            ))}
        </View>
      </View>
    );
  };

  const renderSimilarVocabularySection = (
    title: string,
    matches: SimilarVocabularyItem[],
    showAll: boolean,
    toggleShowAll: () => void
  ) => {
    if (!showSimilarVocabulary || !isVocabularySubject) {
      return null;
    }
    if (loadingSimilarVocabulary || matches.length === 0) {
      return null;
    }

    const hasMoreItems = matches.length > MAX_INITIAL_SIMILAR_VOCAB_ITEMS;
    const displayItems = showAll
      ? matches
      : matches.slice(0, MAX_INITIAL_SIMILAR_VOCAB_ITEMS);

    return (
      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.relatedItemsGrid}>
          {displayItems.map((item) => {
            const displayCharacters =
              item.characters || item.primaryMeaning?.charAt(0) || "?";
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.relatedItem,
                  { backgroundColor: subjectColors.vocabulary },
                ]}
                onPress={() => onSubjectPress?.(item.id)}
                disabled={!onSubjectPress}
              >
                <Text style={styles.relatedItemCharacter}>
                  {displayCharacters}
                </Text>
                <Text style={styles.relatedItemMeaning}>
                  {item.primaryMeaning || "Loading..."}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {hasMoreItems && (
          <TouchableOpacity
            style={styles.similarVocabShowMoreButton}
            onPress={toggleShowAll}
            activeOpacity={0.85}
          >
            <Text style={styles.similarVocabShowMoreText}>
              {showAll
                ? "Show Less"
                : `Show ${matches.length - MAX_INITIAL_SIMILAR_VOCAB_ITEMS} More`}
            </Text>
            <Ionicons
              name={showAll ? "chevron-up" : "chevron-down"}
              size={16}
              color={subjectColors.vocabulary}
            />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderHintSection = (
    title: "Meaning Hint" | "Reading Hint",
    hint: unknown
  ) => {
    if (typeof hint !== "string" || hint.trim().length === 0) {
      return null;
    }

    return (
      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {formatMnemonic(hint)}
      </View>
    );
  };

  const renderMeaningHintSection = () =>
    renderHintSection("Meaning Hint", subject.data?.meaning_hint);

  const renderReadingHintSection = () =>
    renderHintSection("Reading Hint", subject.data?.reading_hint);

  const renderNoteCard = (type: "meaning" | "reading") => {
    const noteValue = type === "meaning" ? meaningNote : readingNote;
    const noteLabel = type === "meaning" ? "Meaning Note" : "Reading Note";
    return (
      <TouchableOpacity
        style={styles.infoSection}
        onPress={() => handleEditNote(type)}
        activeOpacity={0.85}
      >
        <View style={styles.noteCardHeader}>
          <Text style={styles.noteCardTitle}>{noteLabel}</Text>
          <Ionicons name="pencil" size={16} color={theme.textSecondary} />
        </View>
        <Text
          style={[styles.noteCardBody, !noteValue && styles.noteCardBodyEmpty]}
        >
          {noteValue || `Tap to add ${type} note`}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderUsagePatternSection = () => {
    if (!showPatternsOfUse || usagePatterns.length === 0) {
      return null;
    }

    return (
      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>Patterns of Use</Text>
        <Text style={styles.patternSelectorHint}>
          Select a pattern to view example contexts.
        </Text>
        <View style={styles.patternPillsContainer}>
          {usagePatterns.map((patternGroup, index) => {
            const isSelected = index === selectedUsagePatternIndex;
            return (
              <TouchableOpacity
                key={`usage-pattern-pill-${subject.id}-${index}`}
                style={[
                  styles.patternPill,
                  isSelected && styles.patternPillActive,
                ]}
                onPress={() => setSelectedUsagePatternIndex(index)}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.patternPillText,
                    isSelected && styles.patternPillTextActive,
                  ]}
                >
                  {patternGroup.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {selectedUsagePattern && (
          <View style={styles.patternExamplesContainer}>
            <View style={styles.patternExamplesHeader}>
              <Text style={styles.patternExamplesTitle}>
                {selectedUsagePattern.name}
              </Text>
            </View>

            {selectedUsagePattern.examples.map((example, exampleIndex) => {
              const sentenceId = `usage-pattern-speech-${subject.id}-${selectedUsagePatternIndex}-${exampleIndex}`;
              const translationId = `usage-pattern-translation-${subject.id}-${selectedUsagePatternIndex}-${exampleIndex}`;
              const isSpeaking = speakingSentenceId === sentenceId;

              return (
                <View
                  key={`usage-pattern-example-${subject.id}-${selectedUsagePatternIndex}-${exampleIndex}`}
                  style={[
                    styles.patternExampleItem,
                    exampleIndex === selectedUsagePattern.examples.length - 1 && {
                      marginBottom: 0,
                    },
                  ]}
                >
                  <View style={styles.japaneseSentenceContainer}>
                    <Text
                      selectable
                      style={[
                        styles.japaneseSentence,
                        styles.japaneseSentenceWithButton,
                      ]}
                    >
                      {example.ja}
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.speakButtonFixed,
                        isSpeaking && styles.speakingButtonFixed,
                      ]}
                      onPress={() => speakJapanese(example.ja, sentenceId)}
                    >
                      <Ionicons
                        name={isSpeaking ? "stop-circle" : "volume-high"}
                        size={20}
                        color={isSpeaking ? "white" : subjectColors.vocabulary}
                      />
                    </TouchableOpacity>
                  </View>
                  {renderTranslation(
                    example.en,
                    translationId,
                    styles.englishSentence
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  // Render all sections in a single scrollable page (when showAllSections is true)
  const renderAllSections = () => {
    const subjectType = subject.object;

    // Helper to render user synonyms section
    const renderUserSynonyms = () => (
      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>User Synonyms</Text>
        <View style={styles.synonymsRow}>
          <Text
            style={[
              styles.synonymsText,
              !userSynonyms.length && styles.synonymsTextEmpty,
            ]}
            numberOfLines={2}
          >
            {userSynonyms.length ? userSynonyms.join(", ") : "None"}
          </Text>
          <TouchableOpacity
            style={styles.manageSynonymsButton}
            onPress={() => setSynonymsModalVisible(true)}
          >
            <Text style={styles.manageSynonymsText}>Manage</Text>
          </TouchableOpacity>
        </View>
      </View>
    );

    // Helper to render context sentences (for vocabulary)
    const renderContextSentences = () => (
      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>Context Sentences</Text>
        {subject.data.context_sentences &&
        subject.data.context_sentences.length > 0 ? (
          <View style={styles.sentencesContainer}>
            {subject.data.context_sentences.map(
              (sentence: any, idx: number) => {
                const sentenceId = `sentence-${subject.id}-${idx}`;
                return (
                  <View key={sentenceId} style={styles.sentenceItem}>
                    <View style={styles.japaneseSentenceContainer}>
                      <Text
                        selectable
                        style={[
                          styles.japaneseSentence,
                          styles.japaneseSentenceWithButton,
                        ]}
                      >
                        {sentence.ja}
                      </Text>
                      <TouchableOpacity
                        style={[
                          styles.speakButtonFixed,
                          speakingSentenceId === sentenceId &&
                            styles.speakingButtonFixed,
                        ]}
                        onPress={() =>
                          speakJapanese(
                            sentence.ja,
                            sentenceId,
                            getSentenceSpeed(sentenceId)
                          )
                        }
                      >
                        <Ionicons
                          name={
                            speakingSentenceId === sentenceId
                              ? "stop-circle"
                              : "volume-high"
                          }
                          size={20}
                          color={
                            speakingSentenceId === sentenceId
                              ? "white"
                              : subjectColors.vocabulary
                          }
                        />
                      </TouchableOpacity>
                    </View>
                    {renderTranslation(
                      sentence.en,
                      `wk-${subject.id}-${idx}`,
                      styles.englishSentence
                    )}
                    {renderSentenceSpeedControl(sentenceId)}
                  </View>
                );
              }
            )}
          </View>
        ) : (
          <Text style={styles.noteText}>
            No context sentences available for this vocabulary.
          </Text>
        )}
      </View>
    );

    // Helper to render media context sentences
    const renderMediaContextSentences = () => {
      if (!showMediaContextSentences) return null;
      return (
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Media Context Sentences</Text>
          {loadingMediaSentences && validMediaSentences.length === 0 && (
            <Text style={styles.noteText}>Loading examples...</Text>
          )}
          {!loadingMediaSentences && validMediaSentences.length === 0 && (
            <Text style={styles.noteText}>
              No media examples found for this vocabulary.
            </Text>
          )}
          {validMediaSentences.length > 0 && (
            <View style={{ marginTop: 8 }}>
              {validMediaSentences
                .slice(0, visibleMediaCount)
                .map((sentence, idx) => (
                  <View
                    key={sentence.id || idx}
                    style={styles.mediaSentenceContainer}
                  >
                    <View style={styles.mediaSentenceHeader}>
                      <View style={styles.mediaSourceInfo}>
                        <View
                          style={[
                            styles.categoryBadge,
                            {
                              backgroundColor: getCategoryColor(
                                sentence.category || "anime"
                              ),
                            },
                          ]}
                        >
                          <Text style={styles.categoryBadgeText}>
                            {getCategoryDisplayName(sentence.category || "")}
                          </Text>
                        </View>
                        {sentence.title && (
                          <Text style={styles.sourceName} numberOfLines={1}>
                            {sentence.title.replace(/_/g, " ")}
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.mediaPlayButton,
                          (playingMediaSentence === idx ||
                            loadingMediaSentence === idx) &&
                            styles.mediaPlayButtonActive,
                        ]}
                        onPress={() =>
                          playMediaSentence(
                            sentence,
                            idx,
                            `media-${subject.id}-${sentence.id ?? idx}`
                          )
                        }
                        disabled={loadingMediaSentence === idx}
                      >
                        {loadingMediaSentence === idx ? (
                          <ActivityIndicator size={16} color="#fff" />
                        ) : (
                          <Ionicons
                            name={
                              playingMediaSentence === idx ? "stop" : "play"
                            }
                            size={16}
                            color={
                              playingMediaSentence === idx ? "#fff" : subjectColors.vocabulary
                            }
                          />
                        )}
                      </TouchableOpacity>
                    </View>
                    <View style={styles.mediaContentRow}>
                      {sentence.imageUrl && (
                        <Image
                          source={{ uri: sentence.imageUrl }}
                          style={styles.mediaImageLeft}
                          resizeMode="cover"
                          onError={() => handleImageError(sentence.imageUrl!)}
                        />
                      )}
                      <View style={styles.mediaTextContent}>
                        <Text selectable style={styles.mediaSentenceText}>
                          {renderHighlightedSentence(
                            sentence.sentence,
                            subject.data.characters?.startsWith("〜")
                              ? subject.data.characters.slice(1)
                              : subject.data.characters
                          )}
                        </Text>
                        {renderTranslation(
                          sentence.translation,
                          `media-${subject.id}-${sentence.id ?? idx}`,
                          styles.mediaTranslationText
                        )}
                        {renderSentenceSpeedControl(
                          `media-${subject.id}-${sentence.id ?? idx}`
                        )}
                        {sentence.sentence_with_furigana && (
                          <View style={styles.mediaFuriganaContainer}>
                            {renderFurigana(
                              sentence.sentence_with_furigana,
                              subject.data.characters?.startsWith("〜")
                                ? subject.data.characters.slice(1)
                                : subject.data.characters
                            )}
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                ))}
              {(mediaSentences.length > visibleMediaCount ||
                (loadingMediaSentences && mediaSentences.length > 0)) && (
                <TouchableOpacity
                  onPress={loadMoreMediaSentences}
                  disabled={loadingMediaSentences}
                  style={styles.mediaLoadMoreButton}
                >
                  {loadingMediaSentences ? (
                    <ActivityIndicator
                      size="small"
                      color={theme.primary}
                      style={styles.mediaLoadMoreSpinner}
                    />
                  ) : (
                    <Text style={styles.mediaLoadMoreText}>
                      Load More
                    </Text>
                  )}
                  {!loadingMediaSentences && (
                    <Ionicons
                      name="chevron-down"
                      size={18}
                      color={theme.primary}
                    />
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      );
    };

    switch (subjectType) {
      case "radical":
        return (
          <ScrollView ref={scrollViewRef} style={styles.tabContentScrollView}>
            <View style={styles.tabContent}>
              {/* Mnemonic Section */}
              <View style={styles.infoSection}>
                <Text style={styles.sectionTitle}>Mnemonic</Text>
                {subject.data.meaning_mnemonic ? (
                  formatMnemonic(subject.data.meaning_mnemonic)
                ) : (
                  <Text style={styles.mnemonicText}>No mnemonic available</Text>
                )}
                {showMnemonicIllustrations && radicalMnemonicImageUrl ? (
                  radicalMnemonicImageKind === "svg" &&
                  themedRadicalMnemonicSvgXml ? (
                    <View style={styles.mnemonicSvgContainer}>
                      <SvgXml
                        xml={themedRadicalMnemonicSvgXml}
                        width="100%"
                        height="100%"
                      />
                    </View>
                  ) : radicalMnemonicImageKind === "raster" ? (
                    <Image
                      source={{ uri: radicalMnemonicImageUrl }}
                      style={styles.mnemonicImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.mnemonicImageLoading}>
                      <ActivityIndicator size="small" color={subjectTypeColor} />
                    </View>
                  )
                ) : null}
              </View>

              {renderMeaningHintSection()}
              {renderReadingHintSection()}

              {renderUserSynonyms()}

              {/* Found in Kanji Section */}
              <View style={styles.infoSection}>
                <Text style={styles.sectionTitle}>Found in Kanji</Text>
                {subject.data.amalgamation_subject_ids &&
                subject.data.amalgamation_subject_ids.length > 0 ? (
                  (() => {
                    const kanjiIds = subject.data.amalgamation_subject_ids
                      .filter(
                        (id: number) => relatedSubjects[id]?.object === "kanji"
                      )
                      .slice(0, 12);
                    if (kanjiIds.length === 0) {
                      return (
                        <Text style={styles.noteText}>
                          No kanji using this radical are available at your
                          current level.
                        </Text>
                      );
                    }
                    return (
                      <View style={styles.relatedItemsGrid}>
                        {kanjiIds.map((id: number) => (
                          <TouchableOpacity
                            key={id}
                            style={[
                              styles.relatedItem,
                              { backgroundColor: subjectColors.kanji },
                            ]}
                            onPress={() => onSubjectPress?.(id)}
                          >
                            <Text style={styles.relatedItemCharacter}>
                              {relatedSubjects[id]?.data.characters || id}
                            </Text>
                            <Text style={styles.relatedItemMeaning}>
                              {relatedSubjects[id]?.data.meanings.find(
                                (m: any) => m.primary
                              )?.meaning ||
                                relatedSubjects[id]?.data.meanings[0]
                                  ?.meaning ||
                                "Loading..."}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    );
                  })()
                ) : (
                  <Text style={styles.noteText}>
                    No kanji using this radical are available yet.
                  </Text>
                )}
              </View>
            </View>
          </ScrollView>
        );

      case "kanji":
        return (
          <ScrollView ref={scrollViewRef} style={styles.tabContentScrollView}>
            <View style={styles.tabContent}>
              {/* Radicals Section */}
              <View style={styles.infoSection}>
                <Text style={styles.sectionTitle}>Radicals</Text>
                {subject.data.component_subject_ids &&
                subject.data.component_subject_ids.length > 0 ? (
                  <View style={styles.relatedItemsGrid}>
                    {subject.data.component_subject_ids.map((id: number) => (
                      <TouchableOpacity
                        key={id}
                        style={[
                          styles.relatedItem,
                          { backgroundColor: subjectColors.radical },
                        ]}
                        onPress={() => onSubjectPress?.(id)}
                      >
                        <RelatedSubjectCharacter subj={relatedSubjects[id]} />
                        <Text style={styles.relatedItemMeaning}>
                          {relatedSubjects[id]?.data.meanings.find(
                            (m: any) => m.primary
                          )?.meaning ||
                            relatedSubjects[id]?.data.meanings[0]?.meaning ||
                            "Loading..."}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.noteText}>
                    This kanji is not composed of any radicals.
                  </Text>
                )}
              </View>

              {renderVisuallySimilarKanjiSection()}

              {/* Stroke Order Section */}
              {showStrokeOrder && (
                <View style={styles.infoSection}>
                  <Text style={styles.sectionTitle}>Stroke Order</Text>
                  <StrokeOrderAnimation
                    character={subject.data.characters}
                    onPractice={() => setPracticeModalVisible(true)}
                  />
                </View>
              )}

              {renderUserSynonyms()}

              {/* Meaning Mnemonic Section */}
              <View style={styles.infoSection}>
                <Text style={styles.sectionTitle}>Meaning Mnemonic</Text>
                {subject.data.meaning_mnemonic ? (
                  formatMnemonic(subject.data.meaning_mnemonic)
                ) : (
                  <Text style={styles.mnemonicText}>No mnemonic available</Text>
                )}
              </View>

              {renderMeaningHintSection()}

              {renderNoteCard("meaning")}

              {/* Readings Section */}
              <View style={styles.infoSection}>
                <Text style={styles.sectionTitle}>Readings</Text>
                {subject.data.readings && subject.data.readings.length > 0 ? (
                  <View>
                    {subject.data.readings.filter(
                      (r: any) => r.type === "onyomi"
                    ).length > 0 && (
                      <View style={styles.readingsContainer}>
                        <Text style={styles.readingTypeLabel}>
                          On&apos;yomi:
                        </Text>
                        <View style={styles.readingBadges}>
                          {subject.data.readings
                            .filter((r: any) => r.type === "onyomi")
                            .map((r: any, idx: number) => (
                              <View
                                key={`on-${idx}`}
                                style={[
                                  styles.readingBadge,
                                  r.primary && {
                                    backgroundColor: subjectTypeColor,
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.readingBadgeText,
                                    r.primary && styles.primaryReadingBadgeText,
                                    fontStyles.japaneseText,
                                  ]}
                                >
                                  {showOnyomiInKatakana
                                    ? hiraganaToKata(r.reading)
                                    : r.reading}
                                </Text>
                              </View>
                            ))}
                        </View>
                      </View>
                    )}
                    {subject.data.readings.filter(
                      (r: any) => r.type === "kunyomi"
                    ).length > 0 && (
                      <View style={styles.readingsContainer}>
                        <Text style={styles.readingTypeLabel}>
                          Kun&apos;yomi:
                        </Text>
                        <View style={styles.readingBadges}>
                          {subject.data.readings
                            .filter((r: any) => r.type === "kunyomi")
                            .map((r: any, idx: number) => (
                              <View
                                key={`kun-${idx}`}
                                style={[
                                  styles.readingBadge,
                                  r.primary && {
                                    backgroundColor: subjectTypeColor,
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.readingBadgeText,
                                    r.primary && styles.primaryReadingBadgeText,
                                    fontStyles.japaneseText,
                                  ]}
                                >
                                  {r.reading}
                                </Text>
                              </View>
                            ))}
                        </View>
                      </View>
                    )}
                    <View style={styles.mnemonicSection}>
                      <Text style={styles.mnemonicSectionTitle}>
                        Reading Mnemonic
                      </Text>
                      {subject.data.reading_mnemonic ? (
                        formatMnemonic(subject.data.reading_mnemonic)
                      ) : (
                        <Text style={styles.mnemonicText}>
                          No reading mnemonic available
                        </Text>
                      )}
                    </View>
                  </View>
                ) : (
                  <Text style={styles.noteText}>
                    No readings available for this kanji.
                  </Text>
                )}
              </View>

              {renderReadingHintSection()}

              {renderNoteCard("reading")}

              {/* Examples Section */}
              <View style={styles.infoSection}>
                <Text style={styles.sectionTitle}>Vocabulary Examples</Text>
                {subject.data.amalgamation_subject_ids &&
                subject.data.amalgamation_subject_ids.length > 0 ? (
                  (() => {
                    const vocabularyIds = subject.data.amalgamation_subject_ids
                      .filter(
                        (id: number) =>
                          relatedSubjects[id]?.object === "vocabulary" &&
                          (relatedSubjects[id]?.data?.characters?.length ?? 0) <=
                            3
                      )
                      .slice(0, 6);
                    if (vocabularyIds.length === 0) {
                      return (
                        <Text style={styles.noteText}>
                          No short vocabulary examples available for this kanji
                          yet.
                        </Text>
                      );
                    }
                    return (
                      <View style={styles.relatedItemsGrid}>
                        {vocabularyIds.map((id: number) => (
                          <TouchableOpacity
                            key={id}
                            style={[
                              styles.relatedItem,
                              { backgroundColor: subjectColors.vocabulary },
                            ]}
                            onPress={() => onSubjectPress?.(id)}
                          >
                            <RelatedSubjectCharacter
                              subj={relatedSubjects[id]}
                            />
                            <Text style={styles.relatedItemMeaning}>
                              {relatedSubjects[id]?.data.meanings.find(
                                (m: any) => m.primary
                              )?.meaning ||
                                relatedSubjects[id]?.data.meanings[0]
                                  ?.meaning ||
                                "Loading..."}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    );
                  })()
                ) : (
                  <Text style={styles.noteText}>
                    No vocabulary examples available for this kanji yet.
                  </Text>
                )}
              </View>

            </View>
          </ScrollView>
        );

      case "vocabulary":
        return (
          <ScrollView ref={scrollViewRef} style={styles.tabContentScrollView}>
            <View style={styles.tabContent}>
              {/* Kanji Composition Section */}
              <View style={styles.infoSection}>
                <Text style={styles.sectionTitle}>Kanji Composition</Text>
                {orderedVocabularyComponentSubjectIds.length > 0 ? (
                  <View style={styles.relatedItemsGrid}>
                    {orderedVocabularyComponentSubjectIds.map((id: number) => (
                      <TouchableOpacity
                        key={id}
                        style={[
                          styles.relatedItem,
                          { backgroundColor: subjectColors.kanji },
                        ]}
                        onPress={() => onSubjectPress?.(id)}
                      >
                        <Text style={styles.relatedItemCharacter}>
                          {relatedSubjects[id]?.data.characters || id}
                        </Text>
                        <Text style={styles.relatedItemMeaning}>
                          {relatedSubjects[id]?.data.meanings.find(
                            (m: any) => m.primary
                          )?.meaning ||
                            relatedSubjects[id]?.data.meanings[0]?.meaning ||
                            "Loading..."}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.noteText}>
                    This vocabulary doesn&apos;t use any kanji from your current
                    level.
                  </Text>
                )}
              </View>

              {renderSingleKanjiVocabularySimilarKanjiSection()}

              {renderSimilarVocabularySection(
                "Similar Vocabulary by Meaning",
                similarVocabularyByMeaning,
                showAllSimilarByMeaning,
                () => setShowAllSimilarByMeaning((prev) => !prev)
              )}

              {renderSimilarVocabularySection(
                "Similar Vocabulary by Reading",
                similarVocabularyByReading,
                showAllSimilarByReading,
                () => setShowAllSimilarByReading((prev) => !prev)
              )}

              {/* Meaning Section */}
              {(subject.data.meanings.length > 1 ||
                (subject.data.parts_of_speech &&
                  subject.data.parts_of_speech.length > 0)) && (
                <View style={styles.infoSection}>
                  {subject.data.meanings.length > 1 && (
                    <View style={styles.alternativeMeaningsNoDiv}>
                      <Text style={styles.altMeaningsLabel}>
                        Alternative Meanings:
                      </Text>
                      <Text style={styles.altMeaningsText}>
                        {subject.data.meanings
                          .filter((m: any) => !m.primary)
                          .map((m: any) => m.meaning)
                          .join(", ")}
                      </Text>
                    </View>
                  )}
                  {subject.data.parts_of_speech &&
                    subject.data.parts_of_speech.length > 0 && (
                      <View
                        style={[
                          styles.partsOfSpeech,
                          subject.data.meanings.length <= 1 &&
                            styles.partsOfSpeechNoDivider,
                        ]}
                      >
                        <Text style={styles.posLabel}>Part of Speech:</Text>
                        <Text style={styles.posText}>
                          {subject.data.parts_of_speech.join(", ")}
                        </Text>
                      </View>
                    )}
                </View>
              )}

              {renderUserSynonyms()}

              <View style={styles.infoSection}>
                <Text style={styles.sectionTitle}>Meaning Mnemonic</Text>
                {subject.data.meaning_mnemonic ? (
                  formatMnemonic(subject.data.meaning_mnemonic)
                ) : (
                  <Text style={styles.mnemonicText}>No mnemonic available</Text>
                )}
              </View>

              {renderMeaningHintSection()}

              {renderNoteCard("meaning")}

              {/* Reading Section */}
              <View style={styles.infoSection}>
                <Text style={styles.sectionTitle}>Reading</Text>
                {subject.data.readings && subject.data.readings.length > 0 ? (
                  <View style={styles.readingsContainer}>
                    <View style={styles.readingBadges}>
                      {subject.data.readings.map((r: any, idx: number) => (
                        <View
                          key={`reading-${idx}`}
                          style={[
                            styles.readingBadge,
                            r.primary && { backgroundColor: subjectTypeColor },
                          ]}
                        >
                          <Text
                            style={[
                              styles.readingBadgeText,
                              r.primary && styles.primaryReadingBadgeText,
                              fontStyles.japaneseText,
                            ]}
                          >
                            {r.reading}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : (
                  <Text style={styles.noteText}>
                    No reading available for this vocabulary.
                  </Text>
                )}
                {renderPitchAccent(
                  orderedPronunciationAudios.length > 0
                )}
                {orderedPronunciationAudios.length > 0 && (
                    <View style={styles.audioContainer}>
                      <Text style={styles.audioSectionTitle}>Audio</Text>
                      <View style={styles.audioButtonsContainer}>
                        {orderedPronunciationAudios.map(
                          (audio: any, idx: number) => {
                            const audioId = `audio-${subject.id}-${idx}`;
                            return (
                              <TouchableOpacity
                                key={audioId}
                                style={[
                                  styles.audioButton,
                                  (playingAudioId === audioId ||
                                    loadingAudioId === audioId) &&
                                    styles.audioButtonPlaying,
                                ]}
                                onPress={() =>
                                  playAudio(audio.url, audioId, subject.id, audio)
                                }
                                disabled={loadingAudioId === audioId}
                              >
                                {loadingAudioId === audioId ? (
                                  <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                  <Ionicons
                                    name={
                                      playingAudioId === audioId
                                        ? "stop"
                                        : "play"
                                    }
                                    size={20}
                                    color="white"
                                  />
                                )}
                                <Text style={styles.audioButtonText}>
                                  {audio.metadata?.voice_actor_name || "Audio"}
                                  {audio.metadata?.gender
                                    ? ` (${audio.metadata.gender})`
                                    : ""}
                                </Text>
                              </TouchableOpacity>
                            );
                          }
                        )}
                      </View>
                    </View>
                  )}
                <View style={styles.mnemonicSection}>
                  <Text style={styles.mnemonicSectionTitle}>
                    Reading Mnemonic
                  </Text>
                  {subject.data.reading_mnemonic ? (
                    formatMnemonic(subject.data.reading_mnemonic)
                  ) : (
                    <Text style={styles.mnemonicText}>
                      No reading mnemonic available
                    </Text>
                  )}
                </View>
              </View>

              {renderReadingHintSection()}

              {renderNoteCard("reading")}

              {/* Context Section */}
              {renderUsagePatternSection()}
              {renderContextSentences()}
              {renderMediaContextSentences()}
            </View>
          </ScrollView>
        );

      case "kana_vocabulary":
        return (
          <ScrollView ref={scrollViewRef} style={styles.tabContentScrollView}>
            <View style={styles.tabContent}>
              {/* Meaning Section */}
              {(subject.data.meanings.length > 1 ||
                (subject.data.parts_of_speech &&
                  subject.data.parts_of_speech.length > 0)) && (
                <View style={styles.infoSection}>
                  {subject.data.meanings.length > 1 && (
                    <View style={styles.alternativeMeaningsNoDiv}>
                      <Text style={styles.altMeaningsLabel}>
                        Alternative Meanings:
                      </Text>
                      <Text style={styles.altMeaningsText}>
                        {subject.data.meanings
                          .filter((m: any) => !m.primary)
                          .map((m: any) => m.meaning)
                          .join(", ")}
                      </Text>
                    </View>
                  )}
                  {subject.data.parts_of_speech &&
                    subject.data.parts_of_speech.length > 0 && (
                      <View
                        style={[
                          styles.partsOfSpeech,
                          subject.data.meanings.length <= 1 &&
                            styles.partsOfSpeechNoDivider,
                        ]}
                      >
                        <Text style={styles.posLabel}>Part of Speech:</Text>
                        <Text style={styles.posText}>
                          {subject.data.parts_of_speech.join(", ")}
                        </Text>
                      </View>
                    )}
                </View>
              )}

              {/* Pronunciation Section */}
              <View style={styles.infoSection}>
                <Text style={styles.sectionTitle}>Pronunciation</Text>
                {orderedPronunciationAudios.length > 0 && (
                    <View style={[styles.audioContainer, { marginTop: 0 }]}>
                      <View style={styles.audioButtonsContainer}>
                        {orderedPronunciationAudios.map(
                          (audio: any, idx: number) => {
                            const audioId = `audio-${subject.id}-${idx}`;
                            return (
                              <TouchableOpacity
                                key={audioId}
                                style={[
                                  styles.audioButton,
                                  (playingAudioId === audioId ||
                                    loadingAudioId === audioId) &&
                                    styles.audioButtonPlaying,
                                ]}
                                onPress={() =>
                                  playAudio(audio.url, audioId, subject.id, audio)
                                }
                                disabled={loadingAudioId === audioId}
                              >
                                {loadingAudioId === audioId ? (
                                  <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                  <Ionicons
                                    name={
                                      playingAudioId === audioId
                                        ? "stop"
                                        : "play"
                                    }
                                    size={20}
                                    color="white"
                                  />
                                )}
                                <Text style={styles.audioButtonText}>
                                  {audio.metadata?.voice_actor_name || "Audio"}
                                  {audio.metadata?.gender
                                    ? ` (${audio.metadata.gender})`
                                    : ""}
                                </Text>
                              </TouchableOpacity>
                            );
                          }
                        )}
                      </View>
                    </View>
                  )}
                {renderPitchAccent()}
              </View>

              <View style={styles.infoSection}>
                <Text style={styles.sectionTitle}>Mnemonic</Text>
                {subject.data.meaning_mnemonic ? (
                  formatMnemonic(subject.data.meaning_mnemonic)
                ) : (
                  <Text style={styles.mnemonicText}>No mnemonic available</Text>
                )}
              </View>

              {renderMeaningHintSection()}
              {renderReadingHintSection()}

              {renderUserSynonyms()}

              {/* Context Section */}
              {renderUsagePatternSection()}
              {renderContextSentences()}
              {renderMediaContextSentences()}
            </View>
          </ScrollView>
        );

      default:
        return (
          <Text style={styles.noContentText}>No information available</Text>
        );
    }
  };

  // Render tab content based on subject type
  const renderContent = () => {
    const subjectType = subject.object;

    switch (subjectType) {
      case "radical":
        return (
          <ScrollView ref={scrollViewRef} style={styles.tabContentScrollView}>
            <View style={styles.tabContent}>
              {tabIndex === 0 ? (
                // Name & Mnemonic tab
                <View>
                  <View style={styles.infoSection}>
                    <Text style={styles.sectionTitle}>Mnemonic</Text>
                    {subject.data.meaning_mnemonic ? (
                      formatMnemonic(subject.data.meaning_mnemonic)
                    ) : (
                      <Text style={styles.mnemonicText}>
                        No mnemonic available
                      </Text>
                    )}
                    {showMnemonicIllustrations && radicalMnemonicImageUrl ? (
                      radicalMnemonicImageKind === "svg" &&
                      themedRadicalMnemonicSvgXml ? (
                        <View style={styles.mnemonicSvgContainer}>
                          <SvgXml
                            xml={themedRadicalMnemonicSvgXml}
                            width="100%"
                            height="100%"
                          />
                        </View>
                      ) : radicalMnemonicImageKind === "raster" ? (
                        <Image
                          source={{ uri: radicalMnemonicImageUrl }}
                          style={styles.mnemonicImage}
                          resizeMode="contain"
                        />
                      ) : (
                        <View style={styles.mnemonicImageLoading}>
                          <ActivityIndicator
                            size="small"
                            color={subjectTypeColor}
                          />
                        </View>
                      )
                    ) : null}
                  </View>

                  {renderMeaningHintSection()}
                  {renderReadingHintSection()}

                  {/* User Synonyms */}
                  <View style={styles.infoSection}>
                    <Text style={styles.sectionTitle}>User Synonyms</Text>
                    <View style={styles.synonymsRow}>
                      <Text
                        style={[
                          styles.synonymsText,
                          !userSynonyms.length && styles.synonymsTextEmpty,
                        ]}
                        numberOfLines={2}
                      >
                        {userSynonyms.length
                          ? userSynonyms.join(", ")
                          : "None"}
                      </Text>
                      <TouchableOpacity
                        style={styles.manageSynonymsButton}
                        onPress={() => setSynonymsModalVisible(true)}
                      >
                        <Text style={styles.manageSynonymsText}>Manage</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ) : (
                // Found in Kanji tab
                <View>
                  <View style={styles.infoSection}>
                    <Text style={styles.sectionTitle}>Found in Kanji</Text>

                    {subject.data.amalgamation_subject_ids &&
                    subject.data.amalgamation_subject_ids.length > 0 ? (
                      (() => {
                        const kanjiIds = subject.data.amalgamation_subject_ids
                          .filter(
                            (id: number) =>
                              relatedSubjects[id]?.object === "kanji"
                          )
                          .slice(0, 12); // Limit to first 12 kanji

                        if (kanjiIds.length === 0) {
                          return (
                            <Text style={styles.noteText}>
                              No kanji using this radical are available at your
                              current level.
                            </Text>
                          );
                        }

                        return (
                          <View style={styles.relatedItemsGrid}>
                            {kanjiIds.map((id: number) => (
                              <TouchableOpacity
                                key={id}
                                style={[
                                  styles.relatedItem,
                                  { backgroundColor: subjectColors.kanji },
                                ]}
                                onPress={() => onSubjectPress?.(id)}
                              >
                                <Text style={styles.relatedItemCharacter}>
                                  {relatedSubjects[id]?.data.characters || id}
                                </Text>
                                <Text style={styles.relatedItemMeaning}>
                                  {relatedSubjects[id]?.data.meanings.find(
                                    (m: any) => m.primary
                                  )?.meaning ||
                                    relatedSubjects[id]?.data.meanings[0]
                                      ?.meaning ||
                                    "Loading..."}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        );
                      })()
                    ) : (
                      <Text style={styles.noteText}>
                        No kanji using this radical are available yet.
                      </Text>
                    )}
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
        );

      case "kanji":
        return (
          <ScrollView ref={scrollViewRef} style={styles.tabContentScrollView}>
            <View style={styles.tabContent}>
              {tabIndex === 0 ? (
                // Radicals tab
                <View>
                  <View style={styles.infoSection}>
                    <Text style={styles.sectionTitle}>Radicals</Text>

                    {subject.data.component_subject_ids &&
                    subject.data.component_subject_ids.length > 0 ? (
                      <View>
                        <View style={styles.relatedItemsGrid}>
                          {subject.data.component_subject_ids.map(
                            (id: number) => (
                              <TouchableOpacity
                                key={id}
                                style={[
                                  styles.relatedItem,
                                  { backgroundColor: subjectColors.radical },
                                ]}
                                onPress={() => onSubjectPress?.(id)}
                              >
                                <RelatedSubjectCharacter
                                  subj={relatedSubjects[id]}
                                />
                                <Text style={styles.relatedItemMeaning}>
                                  {relatedSubjects[id]?.data.meanings.find(
                                    (m: any) => m.primary
                                  )?.meaning ||
                                    relatedSubjects[id]?.data.meanings[0]
                                      ?.meaning ||
                                    "Loading..."}
                                </Text>
                              </TouchableOpacity>
                            )
                          )}
                        </View>
                      </View>
                    ) : (
                      <Text style={styles.noteText}>
                        This kanji is not composed of any radicals.
                      </Text>
                    )}
                  </View>

                  {renderVisuallySimilarKanjiSection()}

                  {showStrokeOrder && (
                    <View style={styles.infoSection}>
                      <Text style={styles.sectionTitle}>Stroke Order</Text>
                      <StrokeOrderAnimation
                        character={subject.data.characters}
                        onPractice={() => setPracticeModalVisible(true)}
                      />
                    </View>
                  )}
                </View>
              ) : tabIndex === 1 ? (
                // Meaning tab
                <View>
                  <View style={styles.infoSection}>
                    <Text style={styles.sectionTitle}>Mnemonic</Text>
                    {subject.data.meaning_mnemonic ? (
                      formatMnemonic(subject.data.meaning_mnemonic)
                    ) : (
                      <Text style={styles.mnemonicText}>
                        No mnemonic available
                      </Text>
                    )}
                  </View>

                  {renderMeaningHintSection()}

                  {renderNoteCard("meaning")}

                  {/* User Synonyms */}
                  <View style={styles.infoSection}>
                    <Text style={styles.sectionTitle}>User Synonyms</Text>
                    <View style={styles.synonymsRow}>
                      <Text
                        style={[
                          styles.synonymsText,
                          !userSynonyms.length && styles.synonymsTextEmpty,
                        ]}
                        numberOfLines={2}
                      >
                        {userSynonyms.length
                          ? userSynonyms.join(", ")
                          : "None"}
                      </Text>
                      <TouchableOpacity
                        style={styles.manageSynonymsButton}
                        onPress={() => setSynonymsModalVisible(true)}
                      >
                        <Text style={styles.manageSynonymsText}>Manage</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ) : tabIndex === 2 ? (
                // Readings tab
                <View>
                  <View style={styles.infoSection}>
                    <Text style={styles.sectionTitle}>Readings</Text>

                    {subject.data.readings &&
                    subject.data.readings.length > 0 ? (
                      <View>
                        {subject.data.readings.filter(
                          (r: any) => r.type === "onyomi"
                        ).length > 0 && (
                          <View style={styles.readingsContainer}>
                            <Text style={styles.readingTypeLabel}>
                              On&apos;yomi:
                            </Text>
                            <View style={styles.readingBadges}>
                              {subject.data.readings
                                .filter((r: any) => r.type === "onyomi")
                                .map((r: any, index: number) => (
                                  <View
                                    key={`on-${index}`}
                                    style={[
                                      styles.readingBadge,
                                      r.primary && {
                                        backgroundColor: subjectTypeColor,
                                      },
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.readingBadgeText,
                                        r.primary &&
                                          styles.primaryReadingBadgeText,
                                        fontStyles.japaneseText,
                                      ]}
                                    >
                                      {showOnyomiInKatakana
                                        ? hiraganaToKata(r.reading)
                                        : r.reading}
                                    </Text>
                                  </View>
                                ))}
                            </View>
                          </View>
                        )}

                        {subject.data.readings.filter(
                          (r: any) => r.type === "kunyomi"
                        ).length > 0 && (
                          <View style={styles.readingsContainer}>
                            <Text style={styles.readingTypeLabel}>
                              Kun&apos;yomi:
                            </Text>
                            <View style={styles.readingBadges}>
                              {subject.data.readings
                                .filter((r: any) => r.type === "kunyomi")
                                .map((r: any, index: number) => (
                                  <View
                                    key={`kun-${index}`}
                                    style={[
                                      styles.readingBadge,
                                      r.primary && {
                                        backgroundColor: subjectTypeColor,
                                      },
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.readingBadgeText,
                                        r.primary &&
                                          styles.primaryReadingBadgeText,
                                        fontStyles.japaneseText,
                                      ]}
                                    >
                                      {r.reading}
                                    </Text>
                                  </View>
                                ))}
                            </View>
                          </View>
                        )}

                        <View style={styles.mnemonicSection}>
                          <Text style={styles.mnemonicSectionTitle}>
                            Reading Mnemonic
                          </Text>
                          {subject.data.reading_mnemonic ? (
                            formatMnemonic(subject.data.reading_mnemonic)
                          ) : (
                            <Text style={styles.mnemonicText}>
                              No reading mnemonic available
                            </Text>
                          )}
                        </View>
                      </View>
                    ) : (
                      <Text style={styles.noteText}>
                        No readings available for this kanji.
                      </Text>
                    )}
                  </View>

                  {renderReadingHintSection()}

                  {renderNoteCard("reading")}
                </View>
              ) : tabIndex === 3 ? (
                // Examples tab
                <View>
                  <View style={styles.infoSection}>
                    <Text style={styles.sectionTitle}>Vocabulary Examples</Text>

                    {subject.data.amalgamation_subject_ids &&
                    subject.data.amalgamation_subject_ids.length > 0 ? (
                      (() => {
                        const vocabularyIds =
                          subject.data.amalgamation_subject_ids
                            .filter(
                              (id: number) =>
                                relatedSubjects[id]?.object === "vocabulary" &&
                                (relatedSubjects[id]?.data?.characters
                                  ?.length ?? 0) <= 3
                            )
                            .slice(0, 6);
                        if (vocabularyIds.length === 0) {
                          return (
                            <Text style={styles.noteText}>
                              No short vocabulary examples available for this
                              kanji yet.
                            </Text>
                          );
                        }
                        return (
                          <View style={styles.relatedItemsGrid}>
                            {vocabularyIds.map((id: number) => (
                              <TouchableOpacity
                                key={id}
                                style={[
                                  styles.relatedItem,
                                  { backgroundColor: subjectColors.vocabulary },
                                ]}
                                onPress={() => onSubjectPress?.(id)}
                              >
                                <RelatedSubjectCharacter
                                  subj={relatedSubjects[id]}
                                />
                                <Text style={styles.relatedItemMeaning}>
                                  {relatedSubjects[id]?.data.meanings.find(
                                    (m: any) => m.primary
                                  )?.meaning ||
                                    relatedSubjects[id]?.data.meanings[0]
                                      ?.meaning ||
                                    "Loading..."}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        );
                      })()
                    ) : (
                      <Text style={styles.noteText}>
                        No vocabulary examples available for this kanji yet.
                      </Text>
                    )}
                  </View>

                </View>
              ) : null}
            </View>
          </ScrollView>
        );

      case "vocabulary":
        return (
          <ScrollView ref={scrollViewRef} style={styles.tabContentScrollView}>
            <View style={styles.tabContent}>
              {tabIndex === 0 ? (
                // Kanji tab
                <View>
                  <View style={styles.infoSection}>
                    <Text style={styles.sectionTitle}>Kanji Composition</Text>

                    {orderedVocabularyComponentSubjectIds.length > 0 ? (
                      <View>
                        <View style={styles.relatedItemsGrid}>
                          {orderedVocabularyComponentSubjectIds.map(
                            (id: number) => (
                              <TouchableOpacity
                                key={id}
                                style={[
                                  styles.relatedItem,
                                  { backgroundColor: subjectColors.kanji },
                                ]}
                                onPress={() => onSubjectPress?.(id)}
                              >
                                <Text style={styles.relatedItemCharacter}>
                                  {relatedSubjects[id]?.data.characters || id}
                                </Text>
                                <Text style={styles.relatedItemMeaning}>
                                  {relatedSubjects[id]?.data.meanings.find(
                                    (m: any) => m.primary
                                  )?.meaning ||
                                    relatedSubjects[id]?.data.meanings[0]
                                      ?.meaning ||
                                    "Loading..."}
                                </Text>
                              </TouchableOpacity>
                            )
                          )}
                        </View>
                      </View>
                    ) : (
                      <Text style={styles.noteText}>
                        This vocabulary doesn&apos;t use any kanji from your
                        current level.
                      </Text>
                    )}
                  </View>
                  {renderSingleKanjiVocabularySimilarKanjiSection()}
                </View>
              ) : tabIndex === 1 ? (
                // Meaning tab
                <View>
                  {(subject.data.meanings.length > 1 ||
                    (subject.data.parts_of_speech &&
                      subject.data.parts_of_speech.length > 0)) && (
                    <View style={styles.infoSection}>
                      {subject.data.meanings.length > 1 && (
                        <View style={styles.alternativeMeaningsNoDiv}>
                          <Text style={styles.altMeaningsLabel}>
                            Alternative Meanings:
                          </Text>
                          <Text style={styles.altMeaningsText}>
                            {subject.data.meanings
                              .filter((m: any) => !m.primary)
                              .map((m: any) => m.meaning)
                              .join(", ")}
                          </Text>
                        </View>
                      )}

                      {subject.data.parts_of_speech &&
                        subject.data.parts_of_speech.length > 0 && (
                          <View
                            style={[
                              styles.partsOfSpeech,
                              subject.data.meanings.length <= 1 &&
                                styles.partsOfSpeechNoDivider,
                            ]}
                          >
                            <Text style={styles.posLabel}>Part of Speech:</Text>
                            <Text style={styles.posText}>
                              {subject.data.parts_of_speech.join(", ")}
                            </Text>
                          </View>
                        )}
                    </View>
                  )}

                  <View style={styles.infoSection}>
                    <Text style={styles.sectionTitle}>Mnemonic</Text>
                    {subject.data.meaning_mnemonic ? (
                      formatMnemonic(subject.data.meaning_mnemonic)
                    ) : (
                      <Text style={styles.mnemonicText}>
                        No mnemonic available
                      </Text>
                    )}
                  </View>

                  {renderMeaningHintSection()}

                  {renderNoteCard("meaning")}

                  {/* User Synonyms */}
                  <View style={styles.infoSection}>
                    <Text style={styles.sectionTitle}>User Synonyms</Text>
                    <View style={styles.synonymsRow}>
                      <Text
                        style={[
                          styles.synonymsText,
                          !userSynonyms.length && styles.synonymsTextEmpty,
                        ]}
                        numberOfLines={2}
                      >
                        {userSynonyms.length
                          ? userSynonyms.join(", ")
                          : "None"}
                      </Text>
                      <TouchableOpacity
                        style={styles.manageSynonymsButton}
                        onPress={() => setSynonymsModalVisible(true)}
                      >
                        <Text style={styles.manageSynonymsText}>Manage</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {renderSimilarVocabularySection(
                    "Similar Vocabulary by Meaning",
                    similarVocabularyByMeaning,
                    showAllSimilarByMeaning,
                    () => setShowAllSimilarByMeaning((prev) => !prev)
                  )}
                </View>
              ) : tabIndex === 2 ? (
                // Reading tab
                <View>
                  <View style={styles.infoSection}>
                    <Text style={styles.sectionTitle}>Reading</Text>

                    {subject.data.readings &&
                    subject.data.readings.length > 0 ? (
                      <View style={styles.readingsContainer}>
                        <View style={styles.readingBadges}>
                          {subject.data.readings.map(
                            (r: any, index: number) => (
                              <View
                                key={`reading-${index}`}
                                style={[
                                  styles.readingBadge,
                                  r.primary && {
                                    backgroundColor: subjectTypeColor,
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.readingBadgeText,
                                    r.primary && styles.primaryReadingBadgeText,
                                    fontStyles.japaneseText,
                                  ]}
                                >
                                  {r.reading}
                                </Text>
                              </View>
                            )
                          )}
                        </View>
                      </View>
                    ) : (
                      <Text style={styles.noteText}>
                        No reading available for this vocabulary.
                      </Text>
                    )}
                    {renderPitchAccent(
                      orderedPronunciationAudios.length > 0
                    )}

                    {orderedPronunciationAudios.length > 0 && (
                        <View style={styles.audioContainer}>
                          <Text style={styles.audioSectionTitle}>Audio</Text>
                          <View style={styles.audioButtonsContainer}>
                            {orderedPronunciationAudios.map(
                              (audio: any, index: number) => {
                                const audioId = `audio-${subject.id}-${index}`;
                                return (
                                  <TouchableOpacity
                                    key={audioId}
                                    style={[
                                      styles.audioButton,
                                      (playingAudioId === audioId ||
                                        loadingAudioId === audioId) &&
                                        styles.audioButtonPlaying,
                                    ]}
                                    onPress={() =>
                                      playAudio(audio.url, audioId, subject.id, audio)
                                    }
                                    disabled={loadingAudioId === audioId}
                                  >
                                    {loadingAudioId === audioId ? (
                                      <ActivityIndicator
                                        size="small"
                                        color="#fff"
                                      />
                                    ) : (
                                      <Ionicons
                                        name={
                                          playingAudioId === audioId
                                            ? "stop"
                                            : "play"
                                        }
                                        size={20}
                                        color="white"
                                      />
                                    )}
                                    <Text style={styles.audioButtonText}>
                                      {audio.metadata?.voice_actor_name ||
                                        "Audio"}
                                      {audio.metadata?.gender
                                        ? ` (${audio.metadata.gender})`
                                        : ""}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              }
                            )}
                          </View>
                        </View>
                      )}

                    <View style={styles.mnemonicSection}>
                      <Text style={styles.mnemonicSectionTitle}>
                        Reading Mnemonic
                      </Text>
                      {subject.data.reading_mnemonic ? (
                        formatMnemonic(subject.data.reading_mnemonic)
                      ) : (
                        <Text style={styles.mnemonicText}>
                          No reading mnemonic available
                        </Text>
                      )}
                    </View>
                  </View>

                  {renderReadingHintSection()}

                  {renderNoteCard("reading")}

                  {renderSimilarVocabularySection(
                    "Similar Vocabulary by Reading",
                    similarVocabularyByReading,
                    showAllSimilarByReading,
                    () => setShowAllSimilarByReading((prev) => !prev)
                  )}
                </View>
              ) : (
                // Context tab
                <View>
                  {renderUsagePatternSection()}
                  <Text style={styles.sectionTitle}>Context Sentences</Text>

                  {subject.data.context_sentences &&
                  subject.data.context_sentences.length > 0 ? (
                    <View style={styles.sentencesContainer}>
                      {subject.data.context_sentences.map(
                        (sentence: any, index: number) => {
                          const sentenceId = `sentence-${subject.id}-${index}`;
                          return (
                            <View key={sentenceId} style={styles.sentenceItem}>
                              <View style={styles.japaneseSentenceContainer}>
                                <Text
                                  selectable
                                  style={[
                                    styles.japaneseSentence,
                                    styles.japaneseSentenceWithButton,
                                  ]}
                                >
                                  {sentence.ja}
                                </Text>
                                <TouchableOpacity
                                  style={[
                                    styles.speakButtonFixed,
                                    speakingSentenceId === sentenceId &&
                                      styles.speakingButtonFixed,
                                  ]}
                                  onPress={() =>
                                    speakJapanese(
                                      sentence.ja,
                                      sentenceId,
                                      getSentenceSpeed(sentenceId)
                                    )
                                  }
                                >
                                  <Ionicons
                                    name={
                                      speakingSentenceId === sentenceId
                                        ? "stop-circle"
                                        : "volume-high"
                                    }
                                    size={20}
                                    color={
                                      speakingSentenceId === sentenceId
                                        ? "white"
                                        : subjectColors.vocabulary
                                    }
                                  />
                                </TouchableOpacity>
                              </View>
                              {renderTranslation(
                                sentence.en,
                                `wk-${subject.id}-${index}`,
                                styles.englishSentence
                              )}
                              {renderSentenceSpeedControl(sentenceId)}
                            </View>
                          );
                        }
                      )}
                    </View>
                  ) : (
                    <Text style={styles.noteText}>
                      No context sentences available for this vocabulary.
                    </Text>
                  )}

                  {/* Media Context Sentences */}
                  {showMediaContextSentences && (
                    <>
                      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
                        Media Context Sentences
                      </Text>

                      {loadingMediaSentences && validMediaSentences.length === 0 && (
                        <Text style={styles.noteText}>Loading examples...</Text>
                      )}

                      {!loadingMediaSentences &&
                        validMediaSentences.length === 0 && (
                          <Text style={styles.noteText}>
                            No media examples found for this vocabulary.
                          </Text>
                        )}

                      {validMediaSentences.length > 0 && (
                        <View style={{ marginTop: 8 }}>
                          {validMediaSentences
                            .slice(0, visibleMediaCount)
                            .map((sentence, index) => (
                                <View
                                  key={sentence.id || index}
                                  style={styles.mediaSentenceContainer}
                                >
                                  {/* Header with category, title, and play button */}
                                  <View style={styles.mediaSentenceHeader}>
                                    <View style={styles.mediaSourceInfo}>
                                      <View
                                        style={[
                                          styles.categoryBadge,
                                          {
                                            backgroundColor: getCategoryColor(
                                              sentence.category || "anime"
                                            ),
                                          },
                                        ]}
                                      >
                                        <Text style={styles.categoryBadgeText}>
                                          {getCategoryDisplayName(
                                            sentence.category || ""
                                          )}
                                        </Text>
                                      </View>
                                      {sentence.title && (
                                        <Text
                                          style={styles.sourceName}
                                          numberOfLines={1}
                                        >
                                          {sentence.title.replace(/_/g, " ")}
                                        </Text>
                                      )}
                                    </View>
                                    <TouchableOpacity
                                      style={[
                                        styles.mediaPlayButton,
                                        (playingMediaSentence === index ||
                                          loadingMediaSentence === index) &&
                                          styles.mediaPlayButtonActive,
                                      ]}
                                      onPress={() =>
                                        playMediaSentence(
                                          sentence,
                                          index,
                                          `media-${subject.id}-${sentence.id ?? index}`
                                        )
                                      }
                                      disabled={loadingMediaSentence === index}
                                    >
                                      {loadingMediaSentence === index ? (
                                        <ActivityIndicator size={16} color="#fff" />
                                      ) : (
                                        <Ionicons
                                          name={
                                            playingMediaSentence === index
                                              ? "stop"
                                              : "play"
                                          }
                                          size={16}
                                          color={
                                            playingMediaSentence === index
                                              ? "#fff"
                                              : subjectColors.vocabulary
                                          }
                                        />
                                      )}
                                    </TouchableOpacity>
                                  </View>

                                  {/* Horizontal layout: Image on left, text on right */}
                                  <View style={styles.mediaContentRow}>
                                    {sentence.imageUrl && (
                                      <Image
                                        source={{ uri: sentence.imageUrl }}
                                        style={styles.mediaImageLeft}
                                        resizeMode="cover"
                                        onError={() =>
                                          handleImageError(sentence.imageUrl!)
                                        }
                                      />
                                    )}

                                    <View style={styles.mediaTextContent}>
                                      {/* 1. Japanese sentence */}
                                      <Text
                                        selectable
                                        style={styles.mediaSentenceText}
                                      >
                                        {renderHighlightedSentence(
                                          sentence.sentence,
                                          subject.data.characters.startsWith(
                                            "〜"
                                          )
                                            ? subject.data.characters.slice(1)
                                            : subject.data.characters
                                        )}
                                      </Text>

                                      {/* 2. English translation */}
                                      {renderTranslation(
                                        sentence.translation,
                                        `media-${subject.id}-${sentence.id ?? index}`,
                                        styles.mediaTranslationText
                                      )}
                                      {renderSentenceSpeedControl(
                                        `media-${subject.id}-${sentence.id ?? index}`
                                      )}

                                      {/* 3. Furigana (kanji with readings above) */}
                                      {sentence.sentence_with_furigana && (
                                        <View
                                          style={styles.mediaFuriganaContainer}
                                        >
                                          {renderFurigana(
                                            sentence.sentence_with_furigana,
                                            subject.data.characters.startsWith(
                                              "〜"
                                            )
                                              ? subject.data.characters.slice(1)
                                              : subject.data.characters
                                          )}
                                        </View>
                                      )}
                                    </View>
                                  </View>
                                </View>
                              ))}

                            {/* Load More Button */}
                            {(mediaSentences.length > visibleMediaCount ||
                              (loadingMediaSentences &&
                                mediaSentences.length > 0)) && (
                              <TouchableOpacity
                                onPress={loadMoreMediaSentences}
                                disabled={loadingMediaSentences}
                                style={styles.mediaLoadMoreButton}
                              >
                                {loadingMediaSentences ? (
                                  <ActivityIndicator
                                    size="small"
                                    color={theme.primary}
                                    style={styles.mediaLoadMoreSpinner}
                                  />
                                ) : (
                                  <Text style={styles.mediaLoadMoreText}>
                                    Load More
                                  </Text>
                                )}
                                {!loadingMediaSentences && (
                                  <Ionicons
                                    name="chevron-down"
                                    size={18}
                                    color={theme.primary}
                                  />
                                )}
                              </TouchableOpacity>
                            )}
                          </View>
                        )}
                    </>
                  )}
                </View>
              )}
            </View>
          </ScrollView>
        );

      case "kana_vocabulary":
        return (
          <ScrollView ref={scrollViewRef} style={styles.tabContentScrollView}>
            <View style={styles.tabContent}>
              {tabIndex === 0 ? (
                // Meaning tab
                <View>
                  {(subject.data.meanings.length > 1 ||
                    (subject.data.parts_of_speech &&
                      subject.data.parts_of_speech.length > 0)) && (
                    <View style={styles.infoSection}>
                      {subject.data.meanings.length > 1 && (
                        <View style={styles.alternativeMeaningsNoDiv}>
                          <Text style={styles.altMeaningsLabel}>
                            Alternative Meanings:
                          </Text>
                          <Text style={styles.altMeaningsText}>
                            {subject.data.meanings
                              .filter((m: any) => !m.primary)
                              .map((m: any) => m.meaning)
                              .join(", ")}
                          </Text>
                        </View>
                      )}

                      {subject.data.parts_of_speech &&
                        subject.data.parts_of_speech.length > 0 && (
                          <View
                            style={[
                              styles.partsOfSpeech,
                              subject.data.meanings.length <= 1 &&
                                styles.partsOfSpeechNoDivider,
                            ]}
                          >
                            <Text style={styles.posLabel}>Part of Speech:</Text>
                            <Text style={styles.posText}>
                              {subject.data.parts_of_speech.join(", ")}
                            </Text>
                          </View>
                        )}
                    </View>
                  )}

                  <View style={styles.infoSection}>
                    <Text style={styles.sectionTitle}>Pronunciation</Text>
                    {orderedPronunciationAudios.length > 0 && (
                        <View style={[styles.audioContainer, { marginTop: 0 }]}>
                          <View style={styles.audioButtonsContainer}>
                            {orderedPronunciationAudios.map(
                              (audio: any, index: number) => {
                                const audioId = `audio-${subject.id}-${index}`;
                                return (
                                  <TouchableOpacity
                                    key={audioId}
                                    style={[
                                      styles.audioButton,
                                      (playingAudioId === audioId ||
                                        loadingAudioId === audioId) &&
                                        styles.audioButtonPlaying,
                                    ]}
                                    onPress={() =>
                                      playAudio(audio.url, audioId, subject.id, audio)
                                    }
                                    disabled={loadingAudioId === audioId}
                                  >
                                    {loadingAudioId === audioId ? (
                                      <ActivityIndicator
                                        size="small"
                                        color="#fff"
                                      />
                                    ) : (
                                      <Ionicons
                                        name={
                                          playingAudioId === audioId
                                            ? "stop"
                                            : "play"
                                        }
                                        size={20}
                                        color="white"
                                      />
                                    )}
                                    <Text style={styles.audioButtonText}>
                                      {audio.metadata?.voice_actor_name ||
                                        "Audio"}
                                      {audio.metadata?.gender
                                        ? ` (${audio.metadata.gender})`
                                        : ""}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              }
                            )}
                          </View>
                        </View>
                      )}
                    {renderPitchAccent()}
                  </View>

                  <View style={styles.infoSection}>
                    <Text style={styles.sectionTitle}>Mnemonic</Text>
                    {subject.data.meaning_mnemonic ? (
                      formatMnemonic(subject.data.meaning_mnemonic)
                    ) : (
                      <Text style={styles.mnemonicText}>
                        No mnemonic available
                      </Text>
                    )}
                  </View>

                  {renderMeaningHintSection()}
                  {renderReadingHintSection()}

                  {/* User Synonyms */}
                  <View style={styles.infoSection}>
                    <Text style={styles.sectionTitle}>User Synonyms</Text>
                    <View style={styles.synonymsRow}>
                      <Text
                        style={[
                          styles.synonymsText,
                          !userSynonyms.length && styles.synonymsTextEmpty,
                        ]}
                        numberOfLines={2}
                      >
                        {userSynonyms.length
                          ? userSynonyms.join(", ")
                          : "None"}
                      </Text>
                      <TouchableOpacity
                        style={styles.manageSynonymsButton}
                        onPress={() => setSynonymsModalVisible(true)}
                      >
                        <Text style={styles.manageSynonymsText}>Manage</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ) : (
                // Context tab
                <View>
                  {renderUsagePatternSection()}
                  <Text style={styles.sectionTitle}>Context Sentences</Text>

                  {subject.data.context_sentences &&
                  subject.data.context_sentences.length > 0 ? (
                    <View style={styles.sentencesContainer}>
                      {subject.data.context_sentences.map(
                        (sentence: any, index: number) => {
                          const sentenceId = `sentence-${subject.id}-${index}`;
                          return (
                            <View key={sentenceId} style={styles.sentenceItem}>
                              <View style={styles.japaneseSentenceContainer}>
                                <Text
                                  selectable
                                  style={[
                                    styles.japaneseSentence,
                                    styles.japaneseSentenceWithButton,
                                  ]}
                                >
                                  {sentence.ja}
                                </Text>
                                <TouchableOpacity
                                  style={[
                                    styles.speakButtonFixed,
                                    speakingSentenceId === sentenceId &&
                                      styles.speakingButtonFixed,
                                  ]}
                                  onPress={() =>
                                    speakJapanese(
                                      sentence.ja,
                                      sentenceId,
                                      getSentenceSpeed(sentenceId)
                                    )
                                  }
                                >
                                  <Ionicons
                                    name={
                                      speakingSentenceId === sentenceId
                                        ? "stop-circle"
                                        : "volume-high"
                                    }
                                    size={20}
                                    color={
                                      speakingSentenceId === sentenceId
                                        ? "white"
                                        : subjectColors.vocabulary
                                    }
                                  />
                                </TouchableOpacity>
                              </View>
                              {renderTranslation(
                                sentence.en,
                                `wk-${subject.id}-${index}`,
                                styles.englishSentence
                              )}
                              {renderSentenceSpeedControl(sentenceId)}
                            </View>
                          );
                        }
                      )}
                    </View>
                  ) : (
                    <Text style={styles.noteText}>
                      No context sentences available for this vocabulary.
                    </Text>
                  )}

                  {/* Media Context Sentences */}
                  {showMediaContextSentences && (
                    <>
                      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
                        Media Context Sentences
                      </Text>

                      {loadingMediaSentences && validMediaSentences.length === 0 && (
                        <Text style={styles.noteText}>Loading examples...</Text>
                      )}

                      {!loadingMediaSentences &&
                        validMediaSentences.length === 0 && (
                          <Text style={styles.noteText}>
                            No media examples found for this vocabulary.
                          </Text>
                        )}

                      {validMediaSentences.length > 0 && (
                        <View style={{ marginTop: 8 }}>
                          {validMediaSentences
                            .slice(0, visibleMediaCount)
                            .map((sentence, index) => (
                                <View
                                  key={sentence.id || index}
                                  style={styles.mediaSentenceContainer}
                                >
                                  {/* Header with category, title, and play button */}
                                  <View style={styles.mediaSentenceHeader}>
                                    <View style={styles.mediaSourceInfo}>
                                      <View
                                        style={[
                                          styles.categoryBadge,
                                          {
                                            backgroundColor: getCategoryColor(
                                              sentence.category || "anime"
                                            ),
                                          },
                                        ]}
                                      >
                                        <Text style={styles.categoryBadgeText}>
                                          {getCategoryDisplayName(
                                            sentence.category || ""
                                          )}
                                        </Text>
                                      </View>
                                      {sentence.title && (
                                        <Text
                                          style={styles.sourceName}
                                          numberOfLines={1}
                                        >
                                          {sentence.title.replace(/_/g, " ")}
                                        </Text>
                                      )}
                                    </View>
                                    <TouchableOpacity
                                      style={[
                                        styles.mediaPlayButton,
                                        (playingMediaSentence === index ||
                                          loadingMediaSentence === index) &&
                                          styles.mediaPlayButtonActive,
                                      ]}
                                      onPress={() =>
                                        playMediaSentence(
                                          sentence,
                                          index,
                                          `media-${subject.id}-${sentence.id ?? index}`
                                        )
                                      }
                                      disabled={loadingMediaSentence === index}
                                    >
                                      {loadingMediaSentence === index ? (
                                        <ActivityIndicator size={16} color="#fff" />
                                      ) : (
                                        <Ionicons
                                          name={
                                            playingMediaSentence === index
                                              ? "stop"
                                              : "play"
                                          }
                                          size={16}
                                          color={
                                            playingMediaSentence === index
                                              ? "#fff"
                                              : subjectColors.vocabulary
                                          }
                                        />
                                      )}
                                    </TouchableOpacity>
                                  </View>

                                  {/* Horizontal layout: Image on left, text on right */}
                                  <View style={styles.mediaContentRow}>
                                    {sentence.imageUrl && (
                                      <Image
                                        source={{ uri: sentence.imageUrl }}
                                        style={styles.mediaImageLeft}
                                        resizeMode="cover"
                                        onError={() =>
                                          handleImageError(sentence.imageUrl!)
                                        }
                                      />
                                    )}

                                    <View style={styles.mediaTextContent}>
                                      {/* 1. Japanese sentence */}
                                      <Text
                                        selectable
                                        style={styles.mediaSentenceText}
                                      >
                                        {renderHighlightedSentence(
                                          sentence.sentence,
                                          subject.data.characters.startsWith(
                                            "〜"
                                          )
                                            ? subject.data.characters.slice(1)
                                            : subject.data.characters
                                        )}
                                      </Text>

                                      {/* 2. English translation */}
                                      {renderTranslation(
                                        sentence.translation,
                                        `media-${subject.id}-${sentence.id ?? index}`,
                                        styles.mediaTranslationText
                                      )}
                                      {renderSentenceSpeedControl(
                                        `media-${subject.id}-${sentence.id ?? index}`
                                      )}

                                      {/* 3. Furigana (kanji with readings above) */}
                                      {sentence.sentence_with_furigana && (
                                        <View
                                          style={styles.mediaFuriganaContainer}
                                        >
                                          {renderFurigana(
                                            sentence.sentence_with_furigana,
                                            subject.data.characters.startsWith(
                                              "〜"
                                            )
                                              ? subject.data.characters.slice(1)
                                              : subject.data.characters
                                          )}
                                        </View>
                                      )}
                                    </View>
                                  </View>
                                </View>
                              ))}

                            {/* Load More Button */}
                            {(mediaSentences.length > visibleMediaCount ||
                              (loadingMediaSentences &&
                                mediaSentences.length > 0)) && (
                              <TouchableOpacity
                                onPress={loadMoreMediaSentences}
                                disabled={loadingMediaSentences}
                                style={styles.mediaLoadMoreButton}
                              >
                                {loadingMediaSentences ? (
                                  <ActivityIndicator
                                    size="small"
                                    color={theme.primary}
                                    style={styles.mediaLoadMoreSpinner}
                                  />
                                ) : (
                                  <Text style={styles.mediaLoadMoreText}>
                                    Load More
                                  </Text>
                                )}
                                {!loadingMediaSentences && (
                                  <Ionicons
                                    name="chevron-down"
                                    size={18}
                                    color={theme.primary}
                                  />
                                )}
                              </TouchableOpacity>
                            )}
                          </View>
                        )}
                    </>
                  )}
                </View>
              )}
            </View>
          </ScrollView>
        );

      default:
        return (
          <Text style={styles.noContentText}>No information available</Text>
        );
    }
  };

  // Get primary meaning and reading for the practice modal
  const primaryMeaning =
    subject.data.meanings?.find((m: any) => m.primary)?.meaning ||
    subject.data.meanings?.[0]?.meaning ||
    "";
  const primaryReading =
    subject.data.readings?.find((r: any) => r.primary)?.reading ||
    subject.data.readings?.[0]?.reading ||
    "";
  // Get subject type for modal
  const getSubjectType = () => {
    const type = subject.object as string;
    if (type === "radical") return "radical";
    if (type === "kanji") return "kanji";
    return "vocabulary";
  };
  const androidAppliedKeyboardResize =
    Platform.OS === "android" &&
    androidKeyboardHeight > 0 &&
    androidBaselineModalHeight > 0
      ? Math.max(
          0,
          androidBaselineModalHeight - androidNoteModalLayoutHeight,
        )
      : 0;
  const androidKeyboardFallbackLift =
    Platform.OS === "android" && androidKeyboardHeight > 0
      ? Math.max(0, androidKeyboardHeight - androidAppliedKeyboardResize)
      : 0;
  const androidKeyboardLift = Math.min(
    androidKeyboardFallbackLift,
    Math.round(height * 0.6),
  );

  return (
    <>
      <View style={styles.tabContentContainer}>
        {showAllSections ? renderAllSections() : renderContent()}
      </View>

      {/* Kanji Practice Modal */}
      {subject.object === "kanji" && (
        <KanjiPracticeModal
          visible={practiceModalVisible}
          onClose={() => setPracticeModalVisible(false)}
          character={subject.data.characters}
          meaning={primaryMeaning}
          reading={primaryReading}
        />
      )}

      <Modal
        visible={noteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNoteModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.noteModalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
          onLayout={handleNoteModalOverlayLayout}
        >
          <View
            style={[
              styles.noteModalContent,
              Platform.OS === "android" &&
                androidKeyboardLift > 0 && {
                  transform: [{ translateY: -androidKeyboardLift }],
                },
            ]}
          >
            <Text style={styles.noteModalTitle}>
              {editingNoteType === "meaning" ? "Meaning Note" : "Reading Note"}
            </Text>
            <TextInput
              style={styles.noteInput}
              multiline
              value={editingNoteText}
              onChangeText={setEditingNoteText}
              onFocus={syncAndroidKeyboardMetrics}
              placeholder={`Add your ${editingNoteType} note here...`}
              placeholderTextColor={theme.textLight}
            />
            <View style={styles.noteModalButtons}>
              <TouchableOpacity
                style={styles.noteModalButton}
                onPress={() => setNoteModalVisible(false)}
                disabled={isSavingNote}
              >
                <Text style={styles.noteModalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.noteModalButton,
                  styles.noteModalSaveButton,
                  { backgroundColor: subjectTypeColor },
                ]}
                onPress={handleSaveNote}
                disabled={isSavingNote}
              >
                {isSavingNote ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text
                    style={[styles.noteModalButtonText, { color: "#ffffff" }]}
                  >
                    Save
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <SynonymsModal
        visible={synonymsModalVisible}
        onClose={() => setSynonymsModalVisible(false)}
        onSave={handleSynonymsChange}
        currentSynonyms={userSynonyms}
        subjectType={getSubjectType()}
      />
    </>
  );
};

export default function LessonDetailScreen({
  item,
  onNext,
  onPrev,
  canGoBack,
  canGoForward: _canGoForward,
  progress,
  onExit,
  relatedSubjects = {},
  typeCounts = { radical: 0, kanji: 0, vocabulary: 0 },
  batchItems = [],
  currentBatchIndex,
  onBatchItemPress,
  onSubjectPress,
  onAddSubjectToList,
}: LessonDetailScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const subjectColors = useSubjectColors();
  const {
    singlePageLessonView,
    autoplayLessonReadingAudio,
    vocabularyAudioVoice,
  } = useSettingsStore();
  const styles = createStyles(theme, subjectColors);
  const {
    containerRef,
    tooltipVisible,
    tooltipPosition,
    tooltipOpacity,
    tooltipTranslateY,
    copyText,
  } = useCopyTooltip();
  const pageCharacterRefs = useRef<Record<number, View | null>>({});
  // Ref for PagerView to enable programmatic page changes
  const pagerRef = useRef<PagerView>(null);
  const layout = useWindowDimensions();
  const navigationBottomPadding =
    Platform.OS === "android" ? Math.max(insets.bottom, 16) : 16;

  // Calculate responsive font size for Japanese characters
  const getJapaneseFontSize = () => {
    const screenWidth = layout.width;
    const isTablet = screenWidth > 768;

    if (isTablet) {
      // For tablets, use a more conservative scaling to prevent oversized text
      return Math.min(screenWidth / 12, 80);
    } else {
      // For phones, ensure text fits well within the container
      return Math.min(screenWidth / 7, 60);
    }
  };

  // Calculate responsive carousel item font size and padding
  const getCarouselItemStyles = () => {
    const screenWidth = layout.width;
    const isTablet = screenWidth > 768;

    if (isTablet) {
      return {
        fontSize: 16,
        paddingHorizontal: 12,
        paddingVertical: 8,
        imageSize: 24,
      };
    } else {
      return {
        fontSize: 14,
        paddingHorizontal: 8,
        paddingVertical: 6,
        imageSize: 20,
      };
    }
  };
  const [sound, setSound] = useState<AudioSound | null>(null);
  const soundRef = useRef<AudioSound | null>(null);
  const audioPlaybackRequestIdRef = useRef(0);
  const lastLessonReadingAutoplayKeyRef = useRef<string | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  const [speakingSentenceId, setSpeakingSentenceId] = useState<string | null>(
    null
  );

  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  // Configure audio to play in silent mode on iOS when component mounts
  useEffect(() => {
    const configureAudio = async () => {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });
    };

    configureAudio();

    // Cleanup when component unmounts
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  // Audio playback function
  async function playAudio(
    audioUrl: string,
    id: string,
    subjectId?: number,
    pronunciationAudio?: { url: string }
  ) {
    const requestId = ++audioPlaybackRequestIdRef.current;

    try {
      // Override audio session to use speaker (iOS only) before playing audio
      if (Platform.OS === "ios") {
        try {
          await AudioSessionManager.overrideSpeaker();
        } catch {
          // Silent failure for audio session override
        }
      }

      // Stop any currently playing audio
      const currentSound = soundRef.current;
      if (currentSound) {
        currentSound.setOnPlaybackStatusUpdate(null);
        await currentSound.stopAsync();
        await currentSound.unloadAsync();
        soundRef.current = null;
        setSound(null);
        setPlayingAudioId(null);
        setLoadingAudioId(null);
      }

      // Stop any TTS if it's speaking
      if (speakingSentenceId) {
        // Azure Speech cleanup is handled internally
        setSpeakingSentenceId(null);
      }

      setLoadingAudioId(id);

      let playbackUri = audioUrl;
      if (typeof subjectId === "number" && Number.isFinite(subjectId)) {
        const cachedAudioUri = await getCachedOrDownloadVocabularyAudioUri(
          subjectId,
          pronunciationAudio ?? { url: audioUrl }
        );
        if (cachedAudioUri) {
          playbackUri = cachedAudioUri;
        }
      }

      // Load and play the new audio
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: playbackUri },
        { shouldPlay: true }
      );

      if (requestId !== audioPlaybackRequestIdRef.current) {
        newSound.setOnPlaybackStatusUpdate(null);
        await newSound.unloadAsync();
        return;
      }

      soundRef.current = newSound;
      setSound(newSound);
      setPlayingAudioId(id);
      setLoadingAudioId(null);

      // When playback finishes
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          if (soundRef.current !== newSound) {
            return;
          }

          soundRef.current = null;
          setSound(null);
          setPlayingAudioId(null);
          setLoadingAudioId(null);
          newSound.setOnPlaybackStatusUpdate(null);
          void newSound.unloadAsync();
        }
      });
    } catch (error) {
      if (requestId !== audioPlaybackRequestIdRef.current) {
        return;
      }
      console.error("Error playing audio:", error);
      setPlayingAudioId(null);
      setLoadingAudioId(null);
    }
  }

  const maybeAutoplayLessonReadingTab = (subjectForPage: any, routeKey?: string) => {
    if (!autoplayLessonReadingAudio || routeKey !== "reading") {
      if (routeKey !== "reading") {
        lastLessonReadingAutoplayKeyRef.current = null;
      }
      return;
    }

    if (subjectForPage?.object !== "vocabulary") {
      return;
    }

    const autoplayKey = `${subjectForPage.id}:reading`;
    if (lastLessonReadingAutoplayKeyRef.current === autoplayKey) {
      return;
    }
    lastLessonReadingAutoplayKeyRef.current = autoplayKey;

    const pronunciationAudios = Array.isArray(
      subjectForPage?.data?.pronunciation_audios
    )
      ? subjectForPage.data.pronunciation_audios
      : [];
    if (pronunciationAudios.length === 0) {
      return;
    }

    const preferredAudio = pickPreferredPronunciationAudio(
      pronunciationAudios,
      subjectForPage?.data?.readings ?? null,
      vocabularyAudioVoice || "female",
      { preferredContentType: "audio/mpeg" }
    );

    if (!preferredAudio?.url) {
      return;
    }

    const orderedMpegAudios = sortPronunciationAudiosByReadingAndGender(
      pronunciationAudios.filter(
        (audio: any) => audio?.content_type === "audio/mpeg"
      ),
      subjectForPage?.data?.readings ?? null
    );
    const preferredAudioIndex = orderedMpegAudios.findIndex(
      (audio: any) => audio?.url === preferredAudio.url
    );
    const audioId = `audio-${subjectForPage.id}-${
      preferredAudioIndex >= 0 ? preferredAudioIndex : 0
    }`;

    void playAudio(preferredAudio.url, audioId, subjectForPage.id, preferredAudio);
  };

  // TTS function for speaking Japanese sentences using Azure Speech
  const speakJapanese = async (
    text: string,
    id: string,
    speedMultiplier: number = DEFAULT_CONTEXT_AUDIO_SPEED
  ) => {
    try {
      // Stop any playing audio
      if (sound) {
        await sound.stopAsync();
        await sound.unloadAsync();
        setSound(null);
        setPlayingAudioId(null);
        setLoadingAudioId(null);
      }

      // Check if already speaking this sentence - if so, stop it
      if (speakingSentenceId === id) {
        await azureSpeechService.stop();
        setSpeakingSentenceId(null);
        return;
      }

      // Use Azure Speech Services for high-quality Japanese TTS
      await azureSpeechService.speak(
        text,
        () => {
          setSpeakingSentenceId(id);
        },
        () => {
          setSpeakingSentenceId(null);
        },
        () => {
          setSpeakingSentenceId(null);
        },
        { speedMultiplier }
      );
    } catch {
      setSpeakingSentenceId(null);
    }
  };

  // Setup state for TabView (tab index within current subject)
  const [index, setIndex] = useState(0);
  const keyboardNavigationRef = useRef<KeyboardExtendedViewType | null>(null);
  const tabIndexRef = useRef(0);
  const activePageIndexRef = useRef(currentBatchIndex ?? 0);

  // Track overscroll/swipe attempts on last page to trigger quiz
  const overscrollTriggeredRef = useRef(false);
  const lastScrollOffsetRef = useRef(0);
  const swipeAttemptFromLastEndRef = useRef(false);
  const pageChangedDuringSwipeAttemptRef = useRef(false);
  const draggedTowardPreviousRef = useRef(false);

  // Handle PagerView page changes for subject-to-subject navigation
  const onPageSelected = useCallback(
    (e: { nativeEvent: { position: number } }) => {
      const newIndex = e.nativeEvent.position;
      const previousIndex = activePageIndexRef.current;
      activePageIndexRef.current = newIndex;

      if (newIndex !== previousIndex) {
        if (swipeAttemptFromLastEndRef.current) {
          pageChangedDuringSwipeAttemptRef.current = true;
        }
        tabIndexRef.current = 0;
        setIndex(0); // Reset to first tab when changing subjects
        onBatchItemPress?.(newIndex);
      }
    },
    [onBatchItemPress, setIndex]
  );

  const isLastSubjectAndLastTab = useCallback(() => {
    const lastSubjectIndex = (batchItems?.length || 1) - 1;
    if ((currentBatchIndex ?? 0) !== lastSubjectIndex) {
      return false;
    }

    if (singlePageLessonView) {
      return true;
    }

    const currentSubject =
      batchItems?.[currentBatchIndex ?? 0]?.subject ?? item.subject;
    let tabCount = 1;

    switch (currentSubject.object) {
      case "radical":
        tabCount = 2;
        break;
      case "kanji":
        tabCount = 4;
        break;
      case "vocabulary":
        tabCount = 4;
        break;
      case "kana_vocabulary":
        tabCount = 2;
        break;
      default:
        tabCount = 1;
    }

    return index >= tabCount - 1;
  }, [
    batchItems,
    currentBatchIndex,
    index,
    item.subject,
    singlePageLessonView,
  ]);

  const onPageScroll = useCallback(
    (e: { nativeEvent: { position: number; offset: number } }) => {
      const { position, offset } = e.nativeEvent;
      const lastIndex = (batchItems?.length || 1) - 1;
      const canTriggerQuizSwipe = isLastSubjectAndLastTab();

      if (
        swipeAttemptFromLastEndRef.current &&
        position < lastIndex
      ) {
        // User dragged toward previous subject; don't treat this as "finish lesson" swipe.
        draggedTowardPreviousRef.current = true;
      }

      // On the final subject + final tab, swiping forward should start quiz.
      if (position === lastIndex && canTriggerQuizSwipe) {
        lastScrollOffsetRef.current = offset;
        // offset > 0 means trying to go to next (non-existent) page
        if (offset > 0.02 && !overscrollTriggeredRef.current) {
          overscrollTriggeredRef.current = true;
        }
      } else {
        overscrollTriggeredRef.current = false;
      }
    },
    [batchItems?.length, isLastSubjectAndLastTab]
  );

  const onPageScrollStateChanged = useCallback(
    (e: { nativeEvent: { pageScrollState: string } }) => {
      if (e.nativeEvent.pageScrollState === "dragging") {
        const shouldArmAttempt = isLastSubjectAndLastTab();
        swipeAttemptFromLastEndRef.current = shouldArmAttempt;
        pageChangedDuringSwipeAttemptRef.current = false;
        draggedTowardPreviousRef.current = false;
        return;
      }

      if (
        e.nativeEvent.pageScrollState === "idle" &&
        isLastSubjectAndLastTab() &&
        (
          overscrollTriggeredRef.current ||
          (
            swipeAttemptFromLastEndRef.current &&
            !pageChangedDuringSwipeAttemptRef.current &&
            !draggedTowardPreviousRef.current
          )
        )
      ) {
        overscrollTriggeredRef.current = false;
        swipeAttemptFromLastEndRef.current = false;
        pageChangedDuringSwipeAttemptRef.current = false;
        draggedTowardPreviousRef.current = false;
        setIndex(0);
        onNext();
        return;
      }

      if (e.nativeEvent.pageScrollState === "idle") {
        overscrollTriggeredRef.current = false;
        swipeAttemptFromLastEndRef.current = false;
        pageChangedDuringSwipeAttemptRef.current = false;
        draggedTowardPreviousRef.current = false;
      }
    },
    [isLastSubjectAndLastTab, onNext, setIndex]
  );

  const handleConstellationPress = useCallback((subjectId: number) => {
    router.push({
      pathname: "/constellation",
      params: { id: subjectId, rootId: subjectId, constellationDepth: "1" },
    });
  }, []);

  // Get tab routes for a specific subject
  const getTabRoutesForSubject = (subject: any) => {
    const subjectType = subject.object;
    const subjectRoutes = [];

    switch (subjectType) {
      case "radical":
        subjectRoutes.push({ key: "name", title: "Name & Mnemonic" });
        subjectRoutes.push({ key: "kanji", title: "Found in Kanji" });
        break;
      case "kanji":
        subjectRoutes.push({ key: "radicals", title: "Radicals" });
        subjectRoutes.push({ key: "meaning", title: "Meaning" });
        subjectRoutes.push({ key: "readings", title: "Readings" });
        subjectRoutes.push({ key: "examples", title: "Examples" });
        break;
      case "vocabulary":
        subjectRoutes.push({ key: "kanji", title: "Kanji" });
        subjectRoutes.push({ key: "meaning", title: "Meaning" });
        subjectRoutes.push({ key: "reading", title: "Reading" });
        subjectRoutes.push({ key: "context", title: "Context" });
        break;
      case "kana_vocabulary":
        subjectRoutes.push({ key: "meaning", title: "Meaning" });
        subjectRoutes.push({ key: "context", title: "Context" });
        break;
      default:
        subjectRoutes.push({ key: "info", title: "Info" });
    }

    return subjectRoutes;
  };

  const handleLessonShortcutKeyDown = (event: OnKeyPress) => {
    const keyCode = event.nativeEvent?.keyCode;
    if (typeof keyCode !== "number") {
      return;
    }

    const isLeftArrow =
      keyCode === IOS_LEFT_ARROW_KEY_CODE ||
      keyCode === ANDROID_LEFT_ARROW_KEY_CODE ||
      keyCode === WEB_LEFT_ARROW_KEY_CODE;
    const isRightArrow =
      keyCode === IOS_RIGHT_ARROW_KEY_CODE ||
      keyCode === ANDROID_RIGHT_ARROW_KEY_CODE ||
      keyCode === WEB_RIGHT_ARROW_KEY_CODE;

    if (!isLeftArrow && !isRightArrow) {
      return;
    }

    const batchLength = batchItems?.length || 1;
    const activeBatchIndex = activePageIndexRef.current;
    const currentSubject = batchItems?.[activeBatchIndex]?.subject ?? item.subject;
    const currentRoutes = singlePageLessonView
      ? []
      : getTabRoutesForSubject(currentSubject);
    const lastTabIndex = Math.max(0, currentRoutes.length - 1);
    const currentTabIndex = tabIndexRef.current;
    const isLastInBatch = activeBatchIndex >= batchLength - 1;

    if (isLeftArrow) {
      if (!singlePageLessonView && currentTabIndex > 0) {
        const nextTabIndex = currentTabIndex - 1;
        tabIndexRef.current = nextTabIndex;
        setIndex(nextTabIndex);
        maybeAutoplayLessonReadingTab(currentSubject, currentRoutes[nextTabIndex]?.key);
        return;
      }

      if (activeBatchIndex > 0) {
        const previousPageIndex = Math.max(0, activeBatchIndex - 1);
        activePageIndexRef.current = previousPageIndex;
        tabIndexRef.current = 0;
        setIndex(0);
        onBatchItemPress?.(previousPageIndex);
        pagerRef.current?.setPage(previousPageIndex);
      }
      return;
    }

    if (!singlePageLessonView && currentTabIndex < lastTabIndex) {
      const nextTabIndex = currentTabIndex + 1;
      tabIndexRef.current = nextTabIndex;
      setIndex(nextTabIndex);
      maybeAutoplayLessonReadingTab(currentSubject, currentRoutes[nextTabIndex]?.key);
      return;
    }

    tabIndexRef.current = 0;
    setIndex(0);
    if (!isLastInBatch) {
      const nextPageIndex = activeBatchIndex + 1;
      activePageIndexRef.current = nextPageIndex;
      onBatchItemPress?.(nextPageIndex);
      pagerRef.current?.setPage(nextPageIndex);
    } else {
      onNext();
    }
  };

  useEffect(() => {
    tabIndexRef.current = index;
  }, [index]);

  useEffect(() => {
    activePageIndexRef.current = currentBatchIndex ?? 0;
  }, [currentBatchIndex]);

  useEffect(() => {
    const focusTimer = setTimeout(() => {
      keyboardNavigationRef.current?.focus();
    }, 90);

    return () => {
      clearTimeout(focusTimer);
    };
  }, [
    currentBatchIndex,
    index,
    singlePageLessonView,
  ]);

  // Get background color for a specific subject type
  const getSubjectBackgroundColor = (subject: any) => {
    return subjectColors.getColorForType(subject.object);
  };

  const getItemBackgroundColor = () => {
    return subjectColors.getColorForType(item.subject.object);
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <KeyboardExtendedBaseView
        ref={keyboardNavigationRef}
        style={styles.container}
        onKeyDownPress={handleLessonShortcutKeyDown}
        autoFocus
        focusable
      >
      <View style={styles.container} ref={containerRef}>
        <StatusBar style="light" />

      {/* Header - stays fixed outside PagerView */}
      <View
        style={[styles.header, { backgroundColor: getItemBackgroundColor() }]}
      >
        <TouchableOpacity
          style={styles.exitButton}
          onPress={onExit}
          hitSlop={CLOSE_BUTTON_HIT_SLOP}
        >
          <Ionicons name="close" size={24} color="white" />
        </TouchableOpacity>

        <View style={styles.headerContent}>
          <View style={styles.lessonTypeCountsContainer}>
            <View style={styles.typeCountItem}>
              <Text style={styles.typeCountLetter}>R</Text>
              <Feather name="inbox" size={18} color="white" />
              <Text style={styles.typeCountNumber}>{typeCounts.radical}</Text>
            </View>

            <View style={styles.typeCountItem}>
              <Text style={styles.typeCountLetter}>K</Text>
              <Feather name="inbox" size={18} color="white" />
              <Text style={styles.typeCountNumber}>{typeCounts.kanji}</Text>
            </View>

            <View style={styles.typeCountItem}>
              <Text style={styles.typeCountLetter}>V</Text>
              <Feather name="inbox" size={18} color="white" />
              <Text style={styles.typeCountNumber}>
                {typeCounts.vocabulary}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* PagerView for smooth subject-to-subject navigation */}
      <PagerView
        ref={pagerRef}
        style={styles.pagerContainer}
        initialPage={currentBatchIndex || 0}
        onPageSelected={onPageSelected}
        onPageScroll={onPageScroll}
        onPageScrollStateChanged={onPageScrollStateChanged}
        offscreenPageLimit={1}
      >
        {batchItems?.map((batchItem, pageIndex) => {
          const isCurrentPage = pageIndex === currentBatchIndex;
          const pageSubject = batchItem.subject;
          const pageRoutes = getTabRoutesForSubject(pageSubject);
          const pageBackgroundColor = getSubjectBackgroundColor(pageSubject);

          return (
            <View key={batchItem.id} style={styles.pageContainer}>
              {/* Character/Subject Display Section */}
              <View
                style={[
                  styles.subjectDisplaySection,
                  { backgroundColor: pageBackgroundColor },
                ]}
              >
                {onAddSubjectToList && (
                  <TouchableOpacity
                    style={styles.addToListButton}
                    onPress={() => onAddSubjectToList(pageSubject)}
                  >
                    <Ionicons name="bookmark-outline" size={20} color="#fff" />
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.constellationButton}
                  onPress={() => handleConstellationPress(pageSubject.id)}
                >
                  <Ionicons name="planet-outline" size={24} color="#fff" />
                </TouchableOpacity>

                <View
                  ref={(node) => {
                    pageCharacterRefs.current[pageIndex] = node;
                  }}
                  collapsable={false}
                  style={styles.subjectCharacterContainer}
                >
                  <TouchableOpacity
                    activeOpacity={pageSubject.data.characters ? 0.75 : 1}
                    disabled={!pageSubject.data.characters}
                    onPress={() =>
                      copyText(pageSubject.data.characters, {
                        current: pageCharacterRefs.current[pageIndex],
                      })
                    }
                  >
                    {pageSubject.data.characters ? (
                      <Text
                        style={[
                          styles.subjectCharacter,
                          fontStyles.japaneseText,
                          { fontSize: getJapaneseFontSize() },
                        ]}
                      >
                        {pageSubject.data.characters}
                      </Text>
                    ) : pageSubject.data.character_images &&
                      pageSubject.data.character_images.length > 0 ? (
                      <SubjectImageFallbackGlyph
                        subject={pageSubject}
                        size={120}
                        color="#ffffff"
                        imageStyle={styles.subjectRadicalImage}
                        fallbackText={
                          pageSubject.data.meanings?.find((m: any) => m.primary)
                            ?.meaning ||
                          pageSubject.data.meanings?.[0]?.meaning ||
                          "?"
                        }
                        fallbackTextStyle={styles.subjectCharacterPlaceholder}
                      />
                    ) : (
                      <Text style={styles.subjectCharacterPlaceholder}>?</Text>
                    )}
                  </TouchableOpacity>
                </View>

                <View style={styles.subjectMeaningContainer}>
                  <Text style={styles.subjectMeaningText}>
                    {pageSubject.data.meanings.find((m: any) => m.primary)
                      ?.meaning ||
                      pageSubject.data.meanings[0]?.meaning ||
                      "No meaning available"}
                  </Text>
                </View>
                {/* Show reading in header for vocabulary/kanji in single page view */}
                {singlePageLessonView &&
                  (pageSubject.object === "vocabulary" ||
                    pageSubject.object === "kanji") &&
                  pageSubject.data.readings &&
                  pageSubject.data.readings.length > 0 && (
                    <Text
                      style={[
                        styles.subjectReadingText,
                        fontStyles.japaneseText,
                      ]}
                    >
                      {pageSubject.data.readings.find((r: any) => r.primary)
                        ?.reading || pageSubject.data.readings[0]?.reading}
                    </Text>
                  )}
              </View>

              {/* Content area - either TabView or scrollable single page */}
              <View style={styles.contentContainer}>
                {singlePageLessonView ? (
                  // Single page scrollable view - all content in one scroll
                  <SubjectContent
                    subject={pageSubject}
                    tabIndex={0}
                    relatedSubjects={relatedSubjects}
                    onSubjectPress={onSubjectPress}
                    playingAudioId={playingAudioId}
                    playAudio={playAudio}
                    loadingAudioId={loadingAudioId}
                    setLoadingAudioId={setLoadingAudioId}
                    sound={sound}
                    setSound={setSound}
                    setPlayingAudioId={setPlayingAudioId}
                    speakingSentenceId={speakingSentenceId}
                    speakJapanese={speakJapanese}
                    setSpeakingSentenceId={setSpeakingSentenceId}
                    subjectTypeColor={pageBackgroundColor}
                    showAllSections={true}
                  />
                ) : (
                  // Tab-based view (default)
                  <TabView
                    key={batchItem.id}
                    navigationState={{
                      index: isCurrentPage ? index : 0,
                      routes: pageRoutes,
                    }}
                    renderScene={({ route }) => (
                      <SubjectContent
                        subject={pageSubject}
                        tabIndex={pageRoutes.findIndex(
                          (r) => r.key === route.key
                        )}
                        relatedSubjects={relatedSubjects}
                        onSubjectPress={onSubjectPress}
                        playingAudioId={playingAudioId}
                        playAudio={playAudio}
                        loadingAudioId={loadingAudioId}
                        setLoadingAudioId={setLoadingAudioId}
                        sound={sound}
                        setSound={setSound}
                        setPlayingAudioId={setPlayingAudioId}
                        speakingSentenceId={speakingSentenceId}
                        speakJapanese={speakJapanese}
                        setSpeakingSentenceId={setSpeakingSentenceId}
                        subjectTypeColor={pageBackgroundColor}
                      />
                    )}
                    renderTabBar={(props) => (
                      <TabBar
                        {...props}
                        indicatorStyle={{ backgroundColor: pageBackgroundColor }}
                        style={{ backgroundColor: theme.cardBackground }}
                        tabStyle={{ flex: 1 }}
                        contentContainerStyle={{ width: "100%" }}
                        activeColor={pageBackgroundColor}
                        inactiveColor={theme.textLight}
                        pressColor={
                          theme.isDark
                            ? "rgba(255, 255, 255, 0.08)"
                            : "rgba(0, 0, 0, 0.08)"
                        }
                      />
                    )}
                    onIndexChange={
                      isCurrentPage
                        ? (newIndex) => {
                            setIndex(newIndex);
                            maybeAutoplayLessonReadingTab(
                              pageSubject,
                              pageRoutes[newIndex]?.key
                            );
                          }
                        : () => {}
                    }
                    initialLayout={{ width: layout.width }}
                    swipeEnabled={true}
                    lazy
                  />
                )}
              </View>
            </View>
          );
        })}
      </PagerView>

      {/* Bottom Navigation - stays fixed outside PagerView */}
      <View
        style={[
          styles.navigationContainer,
          { paddingBottom: navigationBottomPadding },
        ]}
      >
        <TouchableOpacity
          style={[styles.navButton, !canGoBack && styles.disabledButton]}
          onPress={() => {
            if (canGoBack) {
              setIndex(0);
              pagerRef.current?.setPage((currentBatchIndex || 0) - 1);
            }
          }}
          disabled={!canGoBack}
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={
              canGoBack
                ? theme.textColor
                : theme.isDark
                ? "#444444"
                : "#ccc"
            }
          />
        </TouchableOpacity>

        {/* Item Carousel */}
        <View style={styles.carouselContainer}>
          <View style={styles.carouselItemsWrapper}>
            {batchItems?.map((batchItem, carouselIndex) => {
              const isSelected = batchItem.id === item.id;
              const typeColor = getCarouselItemTypeColor(
                batchItem.subject.object,
                subjectColors
              );
              const characters =
                batchItem.subject.data.characters ||
                batchItem.subject.data.meanings[0]?.meaning ||
                "?";

              const itemStyles = getCarouselItemStyles();

              return (
                <TouchableOpacity
                  key={batchItem.id.toString()}
                  style={[
                    styles.carouselItem,
                    {
                      backgroundColor: isSelected
                        ? typeColor
                        : "rgba(255, 255, 255, 0.1)",
                      borderColor: typeColor,
                      paddingHorizontal: itemStyles.paddingHorizontal,
                      paddingVertical: itemStyles.paddingVertical,
                    },
                  ]}
                  onPress={() => {
                    setIndex(0); // Reset to first tab
                    pagerRef.current?.setPage(carouselIndex);
                  }}
                >
                  {batchItem.subject.data.characters ? (
                    <Text
                      style={[
                        styles.carouselItemText,
                        {
                          color: isSelected ? "white" : typeColor,
                          fontSize: itemStyles.fontSize,
                        },
                      ]}
                    >
                      {characters}
                    </Text>
                  ) : batchItem.subject.data.character_images?.length > 0 ? (
                    <SubjectImageFallbackGlyph
                      subject={batchItem.subject}
                      size={itemStyles.imageSize}
                      color={isSelected ? "white" : typeColor}
                      imageStyle={styles.carouselItemImage}
                      fallbackText={
                        batchItem.subject.data.meanings?.find((m: any) => m.primary)
                          ?.meaning ||
                        batchItem.subject.data.meanings?.[0]?.meaning ||
                        "?"
                      }
                      fallbackTextStyle={[
                        styles.carouselItemText,
                        {
                          color: isSelected ? "white" : typeColor,
                          fontSize: itemStyles.fontSize,
                        },
                      ]}
                    />
                  ) : (
                    <Text
                      style={[
                        styles.carouselItemText,
                        {
                          color: isSelected ? "white" : typeColor,
                          fontSize: itemStyles.fontSize,
                        },
                      ]}
                    >
                      ?
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.navButton, styles.forwardButton]}
          onPress={() => {
            setIndex(0);
            const isLastInBatch =
              (currentBatchIndex || 0) >= (batchItems?.length || 1) - 1;
            if (!isLastInBatch) {
              pagerRef.current?.setPage((currentBatchIndex || 0) + 1);
            } else {
              onNext(); // This handles the quiz transition at the end
            }
          }}
        >
          <Ionicons name="chevron-forward" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <CopyTooltip
        visible={tooltipVisible}
        position={tooltipPosition}
        opacity={tooltipOpacity}
        translateY={tooltipTranslateY}
      />
      </View>
      </KeyboardExtendedBaseView>
    </GestureHandlerRootView>
  );
}

// Helper function to get type color value for carousel items
const getCarouselItemTypeColor = (type: string, subjectColors: SubjectColors) => {
  switch (type) {
    case "radical":
      return subjectColors.radical;
    case "kanji":
      return subjectColors.kanji;
    case "vocabulary":
    case "kana_vocabulary":
      return subjectColors.vocabulary;
    default:
      return "#666";
  }
};

const createStyles = (theme: any, subjectColors: SubjectColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.backgroundColor,
    },
    pagerContainer: {
      flex: 1,
    },
    pageContainer: {
      flex: 1,
    },
    header: {
      paddingTop: HEADER_TOP_OFFSET,
      paddingBottom: 16,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    subjectDisplaySection: {
      paddingHorizontal: 20,
      paddingVertical: 24,
      alignItems: "center",
      borderBottomLeftRadius: 20,
      borderBottomRightRadius: 20,
    },
    addToListButton: {
      position: "absolute",
      top: 16,
      right: 20,
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: "rgba(0,0,0,0.2)",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 20,
    },
    constellationButton: {
      position: "absolute",
      bottom: 20,
      right: 20,
      zIndex: 10,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "rgba(255,100,255,0.3)",
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.3)",
    },
    subjectTypeLabel: {
      backgroundColor: "rgba(255, 255, 255, 0.2)",
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
      marginBottom: 16,
    },
    subjectTypeLabelText: {
      color: "white",
      fontSize: 14,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    subjectCharacterContainer: {
      marginBottom: 16,
    },
    subjectCharacter: {
      color: "white",
      textAlign: "center",
      textShadowColor: "rgba(0, 0, 0, 0.3)",
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 4,
    },
    subjectRadicalImage: {
      width: 120,
      height: 120,
      tintColor: "white",
    },
    subjectCharacterPlaceholder: {
      fontSize: 120,
      color: "rgba(255, 255, 255, 0.7)",
      textAlign: "center",
    },
    subjectMeaningContainer: {
      backgroundColor: "rgba(255, 255, 255, 0.15)",
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.2)",
    },
    subjectMeaningText: {
      color: "white",
      fontSize: 16,
      fontWeight: "600",
      textAlign: "center",
      textShadowColor: "rgba(0, 0, 0, 0.2)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    subjectReadingText: {
      color: "rgba(255, 255, 255, 0.85)",
      fontSize: 16,
      textAlign: "center",
      marginTop: 10,
      textShadowColor: "rgba(0, 0, 0, 0.2)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    headerContent: {
      flex: 1,
      flexDirection: "row",
      justifyContent: "flex-end",
      alignItems: "center",
    },
    exitButton: {
      position: "absolute",
      top: HEADER_TOP_OFFSET,
      left: 20,
      width: CLOSE_BUTTON_SIZE,
      height: CLOSE_BUTTON_SIZE,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 10,
    },
    lessonTypeCountsContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      marginLeft: "auto",
    },
    typeCountItem: {
      flexDirection: "row",
      alignItems: "center",
      marginLeft: 16,
    },
    typeCountLetter: {
      color: "white",
      fontSize: 18,
      fontWeight: "bold",
      marginRight: 4,
    },
    typeCountNumber: {
      fontSize: 16,
      fontWeight: "bold",
      color: "white",
      marginLeft: 4,
    },
    contentContainer: {
      flex: 1,
      backgroundColor: theme.backgroundColor,
    },
    tabContentContainer: {
      flex: 1,
      backgroundColor: theme.backgroundColor,
    },
    tabContentScrollView: {
      flex: 1,
    },
    navigationContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 16,
      backgroundColor: theme.cardBackground,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    navButton: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: theme.isDark ? "#333333" : "#f5f5f5",
      minWidth: 50,
      minHeight: 48,
      justifyContent: "center",
    },
    navButtonText: {
      fontSize: 16,
      fontWeight: "500",
      color: theme.textColor,
    },
    forwardButton: {
      backgroundColor: subjectColors.kanji,
    },
    forwardText: {
      color: "white",
    },
    disabledButton: {
      backgroundColor: theme.isDark ? "#1a1a1a" : "#f9f9f9",
    },
    disabledText: {
      color: theme.isDark ? "#444444" : "#ccc",
    },
    tabContent: {
      padding: 20,
    },
    characterContainer: {
      backgroundColor: theme.isDark ? "#2a2a2a" : "#f9f9f9",
      borderRadius: 8,
      padding: 20,
      alignItems: "center",
      marginBottom: 16,
    },
    characterText: {
      fontSize: 60,
      color: subjectColors.radical, // Blue for radicals
      fontFamily: "SourceHanSansJP-Regular",
    },
    kanjiCharacterText: {
      fontSize: 60,
      color: subjectColors.kanji, // Pink for kanji
      fontFamily: "SourceHanSansJP-Regular",
    },
    vocabCharacterText: {
      fontSize: 50,
      color: subjectColors.vocabulary, // Purple for vocabulary
      fontFamily: "SourceHanSansJP-Regular",
    },
    characterPlaceholder: {
      fontSize: 60,
      color: theme.isDark ? "#666666" : "#ccc",
    },
    radicalImage: {
      width: 100,
      height: 100,
    },
    infoSection: {
      marginBottom: 20,
      backgroundColor: theme.cardBackground,
      borderRadius: 20,
      padding: 24,
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: theme.isDark ? 0.3 : 0.08,
      shadowRadius: 12,
      elevation: 3,
      borderWidth: 0.5,
      borderColor: theme.border,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: theme.textColor,
      marginBottom: 20,
      letterSpacing: -0.3,
      textTransform: "uppercase",
    },
    meaningText: {
      fontSize: 28,
      color: theme.textColor,
      marginBottom: 16,
      fontWeight: "700",
      lineHeight: 36,
      letterSpacing: -0.5,
    },
    mnemonicText: {
      fontSize: 17,
      color: theme.textSecondary,
      lineHeight: 26,
      fontWeight: "400",
    },
    mnemonicSvgContainer: {
      width: "100%",
      height: 220,
      marginTop: 16,
    },
    mnemonicImage: {
      width: "100%",
      height: 140,
      marginTop: 16,
    },
    mnemonicImageLoading: {
      width: "100%",
      height: 120,
      marginTop: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    synonymsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    synonymsText: {
      fontSize: 17,
      color: theme.textColor,
      flex: 1,
      marginRight: 12,
    },
    synonymsTextEmpty: {
      color: theme.textSecondary,
      fontStyle: "italic",
    },
    manageSynonymsButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBackground,
    },
    manageSynonymsText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.textSecondary,
    },
    noteCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    noteCardTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: theme.textColor,
      letterSpacing: -0.2,
      textTransform: "uppercase",
    },
    noteCardBody: {
      fontSize: 16,
      lineHeight: 24,
      color: theme.textColor,
    },
    noteCardBodyEmpty: {
      color: theme.textSecondary,
      fontStyle: "italic",
    },
    noteText: {
      fontSize: 16,
      color: theme.textSecondary,
      lineHeight: 22,
      marginBottom: 12,
      backgroundColor: theme.isDark ? "#2a2a2a" : "#f0f0f0",
      padding: 12,
      borderRadius: 8,
      fontStyle: "italic",
    },
    noteModalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: 16,
    },
    noteModalContent: {
      width: "100%",
      maxWidth: 460,
      backgroundColor: theme.cardBackground,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    noteModalTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.textColor,
      marginBottom: 12,
    },
    noteInput: {
      minHeight: 120,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      padding: 12,
      color: theme.textColor,
      backgroundColor: theme.isDark ? "rgba(255,255,255,0.05)" : "#ffffff",
      fontSize: 16,
      textAlignVertical: "top",
    },
    noteModalButtons: {
      marginTop: 16,
      flexDirection: "row",
      justifyContent: "flex-end",
    },
    noteModalButton: {
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBackground,
      minWidth: 88,
      alignItems: "center",
      justifyContent: "center",
    },
    noteModalSaveButton: {
      borderColor: "transparent",
      marginLeft: 8,
    },
    noteModalButtonText: {
      color: theme.textColor,
      fontSize: 16,
      fontWeight: "600",
    },
    noContentText: {
      padding: 16,
      fontSize: 16,
      color: theme.textSecondary,
      fontStyle: "italic",
      textAlign: "center",
    },
    alternativeMeanings: {
      marginTop: 20,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    alternativeMeaningsNoDiv: {
      marginBottom: 0,
    },
    altMeaningsLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.textLight,
      marginBottom: 8,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    altMeaningsText: {
      fontSize: 17,
      color: theme.textColor,
      lineHeight: 24,
      fontWeight: "500",
    },
    partsOfSpeech: {
      marginTop: 20,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    partsOfSpeechNoDivider: {
      marginTop: 0,
      paddingTop: 0,
      borderTopWidth: 0,
    },
    posLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.textLight,
      marginBottom: 8,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    posText: {
      fontSize: 17,
      color: theme.textColor,
      lineHeight: 24,
      fontWeight: "500",
    },
    readingsContainer: {
      marginVertical: 8,
    },
    readingTypeLabel: {
      fontSize: 14,
      fontWeight: "bold",
      color: theme.textSecondary,
      marginBottom: 8,
    },
    readingBadges: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    readingBadge: {
      backgroundColor: theme.isDark ? "#2a2a2a" : "#f5f5f9",
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 6,
      margin: 4,
    },
    readingBadgeText: {
      color: theme.textSecondary,
      fontSize: 16,
      fontFamily: "SourceHanSansJP-Regular",
      includeFontPadding: false,
      textAlignVertical: "center",
    },
    primaryReadingBadgeText: {
      color: "white",
      fontWeight: "bold",
      fontFamily: "SourceHanSansJP-Regular",
      includeFontPadding: false,
      textAlignVertical: "center",
    },
    audioContainer: {
      marginTop: 16,
      marginBottom: 16,
    },
    audioSectionTitle: {
      fontSize: 16,
      fontWeight: "bold",
      color: theme.textColor,
      marginBottom: 8,
    },
    audioButtonsContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginTop: 8,
    },
    audioButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: subjectColors.vocabulary,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 8,
      margin: 4,
    },
    audioButtonPlaying: {
      backgroundColor: "#333",
    },
    audioButtonText: {
      color: "white",
      marginLeft: 6,
      fontWeight: "500",
    },
    relatedItemsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginTop: 8,
    },
    relatedItem: {
      width: "30%",
      margin: "1.66%",
      padding: 8,
      borderRadius: 8,
      alignItems: "center",
    },
    relatedItemCharacter: {
      fontSize: 24,
      color: "white",
      fontWeight: "bold",
      fontFamily: "SourceHanSansJP-Regular",
    },
    relatedItemMeaning: {
      fontSize: 12,
      color: "white",
      textAlign: "center",
      marginTop: 4,
    },
    similarVocabShowMoreButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "center",
      marginTop: 8,
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    similarVocabShowMoreText: {
      fontSize: 14,
      fontWeight: "500",
      color: theme.textSecondary,
      marginRight: 4,
    },
    sentencesContainer: {
      marginTop: 8,
    },
    patternSelectorHint: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
      marginBottom: 10,
    },
    patternPillsContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 12,
    },
    patternPill: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
      backgroundColor: theme.isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
    },
    patternPillActive: {
      borderColor: subjectColors.vocabulary,
      backgroundColor: withAlpha(subjectColors.vocabulary, 0.16),
    },
    patternPillText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.textSecondary,
    },
    patternPillTextActive: {
      color: subjectColors.vocabulary,
    },
    patternExamplesContainer: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      backgroundColor: theme.isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)",
      padding: 12,
    },
    patternExamplesHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    patternExamplesTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: "700",
      color: theme.textColor,
    },
    patternExampleItem: {
      marginBottom: 10,
    },
    sentenceItem: {
      backgroundColor: theme.isDark ? "#2a2a2a" : "#f9f9f9",
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
    },
    japaneseSentence: {
      fontSize: 16,
      color: theme.textColor,
      marginBottom: 4,
      fontFamily: "SourceHanSansJP-Regular",
    },
    englishSentence: {
      fontSize: 14,
      color: theme.textSecondary,
      fontStyle: "italic",
    },
    translationRevealContainer: {
      position: "relative",
      borderRadius: 8,
      overflow: "hidden",
      minHeight: 24,
      justifyContent: "center",
    },
    translationHiddenText: {
      opacity: 0.18,
    },
    translationBlurOverlay: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
    translationRevealHint: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: 8,
      backgroundColor: "rgba(255, 255, 255, 0.08)",
    },
    translationRevealHintText: {
      fontSize: 12,
      fontWeight: "600",
      fontStyle: "normal",
    },
    sentenceSpeedControl: {
      marginTop: 8,
    },
    sentenceSpeedToggle: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: 14,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    sentenceSpeedToggleText: {
      fontSize: 12,
      fontWeight: "600",
    },
    sentenceSpeedSliderContainer: {
      marginTop: 8,
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingTop: 6,
      paddingBottom: 8,
    },
    sentenceSpeedSlider: {
      width: "100%",
      height: 30,
    },
    sentenceSpeedSliderFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 2,
    },
    sentenceSpeedSliderEdgeLabel: {
      fontSize: 11,
      fontWeight: "500",
    },
    sentenceSpeedResetButton: {
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    sentenceSpeedResetText: {
      fontSize: 12,
      fontWeight: "600",
    },
    carouselContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 4,
      maxWidth: "100%",
    },
    carouselItemsWrapper: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      maxWidth: "100%",
    },
    carouselItem: {
      borderRadius: 8,
      borderWidth: 2,
      justifyContent: "center",
      alignItems: "center",
    },
    carouselItemText: {
      fontSize: 16,
      fontWeight: "bold",
      textAlign: "center",
      fontFamily: "SourceHanSansJP-Regular",
    },
    carouselItemImage: {
      width: 26,
      height: 26,
    },
    radicalCarouselItem: {
      backgroundColor: subjectColors.radical,
    },
    kanjiCarouselItem: {
      backgroundColor: subjectColors.kanji,
    },
    vocabCarouselItem: {
      backgroundColor: subjectColors.vocabulary,
    },
    japaneseSentenceContainer: {
      position: "relative",
      flexDirection: "row",
      alignItems: "flex-start",
      minHeight: 40,
    },
    japaneseSentenceWithButton: {
      flex: 1,
      paddingRight: 52, // Reserve space for 40px button + 12px margin
      minHeight: 40,
      justifyContent: "center",
    },
    speakButton: {
      flexDirection: "row",
      alignItems: "center",
      padding: 6,
      borderRadius: 12,
      marginLeft: 8,
      borderWidth: 1,
      borderColor: subjectColors.vocabulary,
    },
    speakingButton: {
      backgroundColor: subjectColors.vocabulary,
    },
    speakButtonFixed: {
      position: "absolute",
      right: 0,
      top: 0,
      padding: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: subjectColors.vocabulary,
      backgroundColor: "transparent",
      alignItems: "center",
      justifyContent: "center",
      width: 40,
      height: 40,
    },
    speakingButtonFixed: {
      backgroundColor: subjectColors.vocabulary,
      borderColor: subjectColors.vocabulary,
    },
    speakingText: {
      color: "white",
      fontSize: 12,
      fontWeight: "bold",
      marginLeft: 4,
    },
    // Mnemonic formatting styles
    mnemonicTextContainer: {
      fontSize: 16,
      lineHeight: 26,
      color: theme.textSecondary,
      flexWrap: "wrap",
    },
    emText: {
      fontStyle: "italic",
      fontSize: 17,
      lineHeight: 26,
      color: theme.textSecondary,
    },
    inlineRadicalTag: {
      backgroundColor: subjectColors.radical,
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      marginHorizontal: 2,
    },
    inlineKanjiTag: {
      backgroundColor: subjectColors.kanji,
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      marginHorizontal: 2,
    },
    inlineVocabTag: {
      backgroundColor: subjectColors.vocabulary,
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      marginHorizontal: 2,
    },
    inlineReadingTag: {
      backgroundColor: "#333333",
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      marginHorizontal: 2,
    },
    radicalTagText: {
      color: "white",
      fontWeight: "bold",
      fontSize: 14,
    },
    kanjiTagText: {
      color: "white",
      fontWeight: "bold",
      fontSize: 14,
    },
    vocabTagText: {
      color: "white",
      fontWeight: "bold",
      fontSize: 14,
    },
    readingTagText: {
      color: "white",
      fontWeight: "bold",
      fontSize: 14,
    },
    mnemonicSection: {
      marginTop: 20,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    mnemonicSectionTitle: {
      fontSize: 16,
      fontWeight: "bold",
      color: theme.textColor,
      marginBottom: 8,
    },
    // Media context sentence styles
    mediaSentenceContainer: {
      marginBottom: 16,
      padding: 12,
      backgroundColor: theme.isDark ? "#2a2a2a" : "#f9f9f9",
      borderRadius: 8,
    },
    mediaSentenceHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    mediaSourceInfo: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      gap: 8,
    },
    categoryBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
    },
    categoryBadgeText: {
      color: "white",
      fontSize: 10,
      fontWeight: "bold",
      textTransform: "uppercase",
    },
    sourceName: {
      fontSize: 12,
      color: theme.textSecondary,
      flex: 1,
    },
    mediaPlayButton: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 16,
      backgroundColor: withAlpha(subjectColors.vocabulary, 0.1),
    },
    mediaPlayButtonActive: {
      backgroundColor: subjectColors.vocabulary,
      borderRadius: 16,
    },
    mediaLoadMoreButton: {
      backgroundColor: theme.cardBackground,
      borderColor: theme.border,
      borderWidth: 1,
      marginTop: 12,
      padding: 14,
      borderRadius: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },
    mediaLoadMoreSpinner: {
      marginRight: 8,
    },
    mediaLoadMoreText: {
      color: theme.textSecondary,
      marginRight: 6,
      fontWeight: "600",
      fontSize: 15,
    },
    mediaContentRow: {
      flexDirection: "row",
      gap: 12,
    },
    mediaImageLeft: {
      width: 120,
      height: 90,
      borderRadius: 6,
      backgroundColor: theme.isDark ? "#2a2a2a" : "#f0f0f0",
    },
    mediaTextContent: {
      flex: 1,
      gap: 8,
    },
    mediaSentenceText: {
      fontSize: 16,
      color: theme.textColor,
      lineHeight: 24,
      fontFamily: "SourceHanSansJP-Regular",
    },
    highlightedKeyword: {
      color: subjectColors.vocabulary,
      fontWeight: "bold",
      fontFamily: "SourceHanSansJP-Bold",
    },
    mediaTranslationText: {
      fontSize: 13,
      color: theme.textSecondary,
      fontStyle: "italic",
      lineHeight: 18,
    },
    mediaFuriganaContainer: {
      marginTop: 4,
    },
    rubyLine: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "flex-end",
    },
    rubyContainer: {
      alignItems: "center",
      marginRight: 2,
    },
    rubyReading: {
      fontSize: 10,
      lineHeight: 12,
      color: theme.textLight,
      fontFamily: "SourceHanSansJP-Regular",
    },
    rubyBase: {
      fontSize: 14,
      lineHeight: 18,
      color: theme.textColor,
      fontFamily: "SourceHanSansJP-Regular",
    },
  });
