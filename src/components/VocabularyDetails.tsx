import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { useNavigation } from "expo-router/react-navigation";
import { Audio, type AudioSound } from "@/src/utils/expoAvCompat";
import { BlurView } from "expo-blur";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  enableLayoutAnimations,
  FadeInDown,
  FadeOutUp,
  LinearTransition,
  useAnimatedRef,
} from "react-native-reanimated";
import PagerView from "react-native-pager-view";
import { SRS_COLORS } from "../constants/srsColors";
import AudioSessionManager from "../modules/AudioSessionManager";
import {
  getCategoryColor,
  getCategoryDisplayName,
  ImmersionKitSentence,
  searchImmersionKit,
} from "../services/immersionKitService";
import {
  getUniquePronunciationAudiosByVoiceActor,
  sortPronunciationAudiosByReadingAndGender,
} from "../utils/pronunciationAudio";
import { azureSpeechService } from "../utils/azureSpeech";
import { resolveOfflineVocabularyAudioUri } from "../services/offlineVocabularyAudioService";
import { getNiaiSimilarKanjiSubjects } from "../utils/niaiSimilarKanji";
import {
  type SubjectColors,
  useSubjectColors,
  withAlpha,
} from "../utils/subjectColors";
import { useAuthStore, useSettingsStore } from "../utils/store";
import { useTheme } from "../utils/theme";
import { getAllSubjects } from "../utils/cache";
import type { Subject } from "../utils/api";
import { CopyTooltip, useCopyTooltip } from "./CopyTooltip";
import PitchAccentVisualization from "./PitchAccentVisualization";
import SrsLevelIcon from "./SrsLevelIcon";
import { SynonymsModal } from "./SynonymsModal";
import { getWaniKaniPitchAccent } from "../utils/pitchAccent";
import { getWaniKaniVocabularyPatterns } from "../utils/wanikaniVocabularyPatterns";

// Enable Reanimated layout animations (Fabric / new‑arch friendly)
enableLayoutAnimations(true);

interface AudioFile {
  url: string;
  content_type: string;
  metadata: {
    gender: string;
    source_id: number;
    pronunciation: string;
    voice_actor_id: number;
    voice_actor_name: string;
    voice_description: string;
  };
}

interface SimilarVocabularyItem {
  id: number;
  level: number;
  characters: string;
  primaryMeaning: string;
  matchedReadings: string[];
  matchedMeanings: string[];
}

interface SimilarKanjiItem {
  id: number;
  level: number;
  characters: string;
  meanings: string[];
}

interface VocabularyDetailsProps {
  vocabulary: {
    id: number;
    object: string;
    level: number;
    characters: string;
    meanings: { meaning: string; primary: boolean }[];
    readings: {
      reading: string;
      primary: boolean;
      type?: string;
    }[];
    partsOfSpeech: string[];
    meaningMnemonic: string;
    readingMnemonic: string;
    meaningHint?: string | null;
    readingHint?: string | null;
    componentSubjects?: {
      id: number;
      characters: string;
      meanings: string[];
      level: number;
    }[];
    contextSentences?: {
      ja: string;
      en: string;
    }[];
    audioFiles?: AudioFile[];
    userSynonyms?: string[];
    srsStage?: number;
    srsSystem?: {
      stages: { name: string }[];
    };
    currentStreak?: number;
    longestStreak?: number;
    meaningNote?: string;
    readingNote?: string;
    meaningCorrect?: number;
    meaningIncorrect?: number;
    readingCorrect?: number;
    readingIncorrect?: number;
    meaningCurrentStreak?: number;
    meaningMaxStreak?: number;
    readingCurrentStreak?: number;
    readingMaxStreak?: number;
    percentageCorrect?: number;
    nextReviewAt?: string;
    onEditNote?: (type: "meaning" | "reading") => void;
  };
  progressionStatus: "loading" | "success" | "offline";
  onSubjectPress?: (subjectId: number) => void;
  initialTab?: "meaning" | "reading" | "context";
  onOpenConstellation?: () => void;
  onAddToList?: () => void;
  userLevel?: number;
  onSynonymsChange?: (synonyms: string[]) => Promise<void>;
  embedded?: boolean;
}

const BACK_BUTTON_HIT_SLOP = { top: 10, right: 10, bottom: 10, left: 10 };
const HEADER_TOP_OFFSET = 64;
const BACK_BUTTON_SIZE = 40;

const CONTEXT_AUDIO_SPEED_MIN = 0.5;
const CONTEXT_AUDIO_SPEED_MAX = 1.5;
const CONTEXT_AUDIO_SPEED_STEP = 0.05;
const DEFAULT_CONTEXT_AUDIO_SPEED = 1;

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

function normalizeSimilarKanjiSubject(subject: any): SimilarKanjiItem | null {
  if (!subject?.id) {
    return null;
  }

  const characters =
    typeof subject.data?.characters === "string"
      ? subject.data.characters
      : typeof subject.characters === "string"
        ? subject.characters
        : "";
  if (!characters) {
    return null;
  }

  const rawMeanings = Array.isArray(subject.data?.meanings)
    ? subject.data.meanings
    : Array.isArray(subject.meanings)
      ? subject.meanings
      : [];
  const meanings = rawMeanings
    .map((meaning: any) =>
      typeof meaning === "string" ? meaning : meaning?.meaning
    )
    .filter((meaning: unknown): meaning is string => typeof meaning === "string");

  return {
    id: subject.id,
    level: Number(subject.data?.level ?? subject.level ?? 0),
    characters,
    meanings,
  };
}

function sortSimilarKanjiItems(items: SimilarKanjiItem[]): SimilarKanjiItem[] {
  return [...items].sort((a, b) => {
    if (a.level !== b.level) {
      return a.level - b.level;
    }
    return a.characters.localeCompare(b.characters);
  });
}

// grid metrics calculated at runtime via window dimensions

export default function VocabularyDetails({
  vocabulary,
  progressionStatus,
  onSubjectPress,
  initialTab = "meaning",
  onOpenConstellation,
  onAddToList,
  userLevel = 60,
  onSynonymsChange,
  embedded = false,
}: VocabularyDetailsProps) {
  const [activeTab, setActiveTab] = useState<"meaning" | "reading" | "context">(
    initialTab
  );
  const navigation = useNavigation();
  const [sound, setSound] = useState<AudioSound | null>(null);
  const soundRef = useRef<AudioSound | null>(null);
  const audioPlaybackRequestIdRef = useRef(0);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  const [showAllComponents, setShowAllComponents] = useState(false);
  const [showAllSimilarByMeaning, setShowAllSimilarByMeaning] =
    useState(false);
  const [showAllSimilarByReading, setShowAllSimilarByReading] =
    useState(false);
  const [showAllSimilarKanji, setShowAllSimilarKanji] = useState(false);
  const [synonymsModalVisible, setSynonymsModalVisible] = useState(false);
  const [playingContextSentence, setPlayingContextSentence] = useState<
    string | null
  >(null);
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
  const [cachedVocabularySubjects, setCachedVocabularySubjects] = useState<
    Subject[]
  >([]);
  const [singleKanjiVocabularySimilarSubjects, setSingleKanjiVocabularySimilarSubjects] =
    useState<SimilarKanjiItem[]>([]);
  const [loadingSimilarVocabulary, setLoadingSimilarVocabulary] =
    useState(false);
  const { theme } = useTheme();
  const subjectColors = useSubjectColors();
  const styles = useMemo(
    () => createStyles(subjectColors),
    [subjectColors.kanji, subjectColors.radical, subjectColors.vocabulary]
  );
  const mainCharacterRef = useRef<View>(null);
  const {
    containerRef,
    tooltipVisible,
    tooltipPosition,
    tooltipOpacity,
    tooltipTranslateY,
    copyText,
  } = useCopyTooltip();
  const {
    showPitchAccent,
    showPatternsOfUse,
    showSimilarVocabulary,
    showSingleKanjiVocabularySimilarKanji,
    showMediaContextSentences,
    hideContextSentenceTranslations,
    showContextSentenceSpeedControl,
    myAnimeListUsername,
    immersionKitAnimes,
    visuallySimilarKanjiSource,
  } = useSettingsStore();
  const { userData } = useAuthStore();
  const { width: screenWidth } = useWindowDimensions();
  const pagerRef = useRef<PagerView>(null);
  const [revealedTranslations, setRevealedTranslations] = useState<Set<string>>(
    new Set()
  );
  const [selectedUsagePatternIndex, setSelectedUsagePatternIndex] = useState(0);
  const [sentencePlaybackSpeeds, setSentencePlaybackSpeeds] = useState<
    Record<string, number>
  >({});
  const [expandedSentenceSpeedId, setExpandedSentenceSpeedId] = useState<
    string | null
  >(null);

  const meaningScrollRef = useAnimatedRef<Animated.ScrollView>();
  const readingScrollRef = useAnimatedRef<Animated.ScrollView>();
  const contextScrollRef = useAnimatedRef<Animated.ScrollView>();

  // Compute responsive metrics per render
  const isTablet = screenWidth > 768;
  const horizontalPadding = 32;
  const gridSpacing = isTablet ? 12 : 8;
  const similarVocabCols = isTablet ? 4 : screenWidth > 400 ? 3 : 2;
  const componentCols = isTablet ? 5 : screenWidth > 400 ? 4 : 3;
  const availableWidth = screenWidth - horizontalPadding;
  const baseSimilarVocabItemWidth = Math.floor(
    (availableWidth - gridSpacing * (similarVocabCols + 1)) / similarVocabCols
  );
  const componentItemWidth = Math.floor(
    (availableWidth - gridSpacing * (componentCols + 1)) / componentCols
  );
  const similarVocabCardHeight = isTablet ? 84 : 78;
  const smallCardHeight = isTablet ? 84 : 80; // fixed small card height
  const similarVocabItemMaxWidth = Math.min(
    Math.floor(availableWidth - gridSpacing * 2),
    Math.floor(baseSimilarVocabItemWidth * 1.8)
  );
  const minSimilarVocabCardWidth =
    Platform.OS === "android" ? 80 : baseSimilarVocabItemWidth;
  const smallItemMaxWidth = Math.min(
    Math.floor(availableWidth - gridSpacing * 2),
    Math.floor(componentItemWidth * 1.8)
  );

  // Configure audio to play in silent mode on iOS when component mounts
  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

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
      // Stop Azure TTS if playing
      azureSpeechService.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let isMounted = true;

    if (!showSimilarVocabulary) {
      setCachedVocabularySubjects([]);
      setLoadingSimilarVocabulary(false);
      return () => {
        isMounted = false;
      };
    }

    const loadCachedVocabulary = async () => {
      setLoadingSimilarVocabulary(true);

      try {
        const subjects = (await getAllSubjects()) as Subject[];
        if (!isMounted) {
          return;
        }

        const vocabularySubjects = subjects.filter(
          (subject) =>
            subject.object === "vocabulary" || subject.object === "kana_vocabulary"
        );
        setCachedVocabularySubjects(vocabularySubjects);
      } catch (error) {
        console.warn(
          "[VocabDetails] Failed to load cached vocabulary subjects:",
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
  }, [showSimilarVocabulary]);

  // Fetch media sentences from ImmersionKit (only if setting is enabled)
  const fetchMediaSentences = async (offset = 0) => {
    if (!vocabulary.characters || !showMediaContextSentences) {
      return;
    }

    setLoadingMediaSentences(true);

    try {
      // Fetch a larger batch for buffering (e.g. 50)
      const BUFFER_SIZE = 50;
      const { results, nextOffset } = await searchImmersionKit(
        vocabulary.characters,
        {
          exactMatch: true,
          limit: BUFFER_SIZE,
          category: "anime",
          myAnimeListUsername,
          selectedAnimes: immersionKitAnimes,
          userLevel: userData?.level || vocabulary.level,
          skip: offset,
        }
      );

      setNextDataOffset(nextOffset);

      setMediaSentences((prev) => {
        if (offset === 0) {
          return results;
        }
        // Append new results, avoiding duplicates
        const existingIds = new Set(prev.map((s) => s.id));
        const newSentences = results.filter((s) => !existingIds.has(s.id));
        return [...prev, ...newSentences];
      });
    } catch (error) {
      console.error("[VocabDetails] Error fetching media sentences:", error);
    } finally {
      setLoadingMediaSentences(false);
    }
  };

  useEffect(() => {
    setNextDataOffset(0);
    setVisibleMediaCount(10);
    fetchMediaSentences(0);
  }, [
    vocabulary.characters,
    showMediaContextSentences,
    myAnimeListUsername,
    immersionKitAnimes,
    userData?.level,
  ]);

  useEffect(() => {
    setRevealedTranslations(new Set());
    setSentencePlaybackSpeeds({});
    setExpandedSentenceSpeedId(null);
    setSelectedUsagePatternIndex(0);
    setShowAllSimilarByMeaning(false);
    setShowAllSimilarByReading(false);
  }, [vocabulary.id]);

  useEffect(() => {
    if (!showContextSentenceSpeedControl) {
      setExpandedSentenceSpeedId(null);
    }
  }, [showContextSentenceSpeedControl]);

  const loadMoreMediaSentences = () => {
    const newVisibleCount = visibleMediaCount + 10;
    setVisibleMediaCount(newVisibleCount);

    // If we're nearing the end of our buffer, fetch more in the background
    // (e.g., if we have less than 10 unseen items left)
    if (mediaSentences.length - newVisibleCount < 10) {
      fetchMediaSentences(nextDataOffset);
    }
  };

  // Keep one pronunciation per voice actor and filter out hidden readings when possible.
  const mpegAudioFiles = useMemo(() => {
    return getUniquePronunciationAudiosByVoiceActor(
      vocabulary.audioFiles,
      vocabulary.readings,
      { preferredContentType: "audio/mpeg" }
    );
  }, [vocabulary.audioFiles, vocabulary.readings]);
  const orderedMpegAudioFiles = useMemo(
    () =>
      sortPronunciationAudiosByReadingAndGender(
        mpegAudioFiles,
        vocabulary.readings
      ),
    [mpegAudioFiles, vocabulary.readings]
  );

  const pitchAccentEntry = useMemo(
    () =>
      getWaniKaniPitchAccent(
        vocabulary.id,
        vocabulary.readings.map((reading) => reading.reading)
      ),
    [vocabulary.id, vocabulary.readings]
  );
  const vocabularyUsagePatterns = useMemo(
    () => getWaniKaniVocabularyPatterns(vocabulary.level, vocabulary.characters),
    [vocabulary.level, vocabulary.characters]
  );
  const selectedUsagePattern =
    vocabularyUsagePatterns[selectedUsagePatternIndex] ??
    vocabularyUsagePatterns[0] ??
    null;

  // Determine the primary meaning
  const primaryMeaning =
    vocabulary.meanings.find((m) => m.primary)?.meaning ||
    vocabulary.meanings[0]?.meaning ||
    "";

  // Determine the primary reading
  const primaryReading =
    vocabulary.readings.find((r) => r.primary)?.reading ||
    vocabulary.readings[0]?.reading ||
    "";

  const singleKanjiVocabularyCharacter = useMemo(
    () =>
      getSingleKanjiVocabularyCharacter(
        vocabulary.object,
        vocabulary.characters
      ),
    [vocabulary.object, vocabulary.characters]
  );

  const vocabularyComponentSubjectIds = useMemo(
    () =>
      Array.isArray(vocabulary.componentSubjects)
        ? vocabulary.componentSubjects.map((subject) => subject.id)
        : [],
    [vocabulary.componentSubjects]
  );
  const vocabularyComponentSubjectIdsKey = vocabularyComponentSubjectIds.join(",");

  const vocabularyReadingSet = useMemo(() => {
    const set = new Set<string>();
    for (const reading of vocabulary.readings) {
      const normalized = normalizeSimilarVocabularyValue(reading.reading);
      if (normalized) {
        set.add(normalized);
      }
    }
    return set;
  }, [vocabulary.readings]);

  const vocabularyMeaningSet = useMemo(() => {
    const set = new Set<string>();
    for (const meaning of vocabulary.meanings) {
      const normalized = normalizeSimilarVocabularyValue(meaning.meaning);
      if (normalized) {
        set.add(normalized);
      }
    }
    return set;
  }, [vocabulary.meanings]);

  const similarVocabularyByReading = useMemo<SimilarVocabularyItem[]>(() => {
    if (!showSimilarVocabulary || vocabularyReadingSet.size === 0) {
      return [];
    }

    const matches: SimilarVocabularyItem[] = [];

    for (const subject of cachedVocabularySubjects) {
      if (subject.id === vocabulary.id) {
        continue;
      }

      const readings = subject.data.readings ?? [];
      const matchedReadings = collectMatchingValues(
        readings.map((reading) => reading.reading),
        vocabularyReadingSet
      );
      if (matchedReadings.length === 0) {
        continue;
      }

      const meanings = subject.data.meanings ?? [];
      const primaryMeaning =
        meanings.find((meaning) => meaning.primary)?.meaning ??
        meanings[0]?.meaning ??
        "";

      matches.push({
        id: subject.id,
        level: subject.data.level ?? 0,
        characters: subject.data.characters ?? "",
        primaryMeaning,
        matchedReadings,
        matchedMeanings: [],
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
    showSimilarVocabulary,
    vocabulary.id,
    vocabularyReadingSet,
  ]);

  const similarVocabularyByMeaning = useMemo<SimilarVocabularyItem[]>(() => {
    if (!showSimilarVocabulary || vocabularyMeaningSet.size === 0) {
      return [];
    }

    const matches: SimilarVocabularyItem[] = [];

    for (const subject of cachedVocabularySubjects) {
      if (subject.id === vocabulary.id) {
        continue;
      }

      const meanings = subject.data.meanings ?? [];
      const matchedMeanings = collectMatchingValues(
        meanings.map((meaning) => meaning.meaning),
        vocabularyMeaningSet
      );
      if (matchedMeanings.length === 0) {
        continue;
      }

      const primaryMeaning =
        meanings.find((meaning) => meaning.primary)?.meaning ??
        meanings[0]?.meaning ??
        "";

      matches.push({
        id: subject.id,
        level: subject.data.level ?? 0,
        characters: subject.data.characters ?? "",
        primaryMeaning,
        matchedReadings: [],
        matchedMeanings,
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
    showSimilarVocabulary,
    vocabulary.id,
    vocabularyMeaningSet,
  ]);

  useEffect(() => {
    setShowAllSimilarKanji(false);
  }, [vocabulary.id, visuallySimilarKanjiSource]);

  useEffect(() => {
    let isMounted = true;

    if (
      !showSingleKanjiVocabularySimilarKanji ||
      !singleKanjiVocabularyCharacter
    ) {
      setSingleKanjiVocabularySimilarSubjects([]);
      return () => {
        isMounted = false;
      };
    }

    setSingleKanjiVocabularySimilarSubjects([]);

    const loadSimilarKanji = async () => {
      try {
        if (visuallySimilarKanjiSource === "niai") {
          const niaiSubjects = await getNiaiSimilarKanjiSubjects(
            singleKanjiVocabularyCharacter
          );
          if (!isMounted) {
            return;
          }

          const similarItems = niaiSubjects
            .map(normalizeSimilarKanjiSubject)
            .filter(
              (item): item is SimilarKanjiItem =>
                item !== null &&
                item.characters !== singleKanjiVocabularyCharacter
            );
          setSingleKanjiVocabularySimilarSubjects(
            sortSimilarKanjiItems(similarItems)
          );
          return;
        }

        const allSubjects = (await getAllSubjects()) as Subject[];
        if (!isMounted) {
          return;
        }

        const subjectsById = new Map<number, Subject>();
        for (const subject of allSubjects) {
          subjectsById.set(subject.id, subject);
        }

        const componentSubjectIds = vocabularyComponentSubjectIdsKey
          ? vocabularyComponentSubjectIdsKey.split(",").map(Number)
          : [];
        const componentKanjiSubject =
          componentSubjectIds
            .map((subjectId) => subjectsById.get(subjectId))
            .find(
              (subject) =>
                subject?.object === "kanji" &&
                subject.data?.characters === singleKanjiVocabularyCharacter
            ) ??
          allSubjects.find(
            (subject) =>
              subject.object === "kanji" &&
              subject.data?.characters === singleKanjiVocabularyCharacter
          );

        const similarSubjectIds = Array.isArray(
          componentKanjiSubject?.data?.visually_similar_subject_ids
        )
          ? componentKanjiSubject.data.visually_similar_subject_ids
          : [];
        const seenIds = new Set<number>();
        const similarItems = similarSubjectIds
          .map((subjectId) => subjectsById.get(subjectId))
          .map(normalizeSimilarKanjiSubject)
          .filter((item): item is SimilarKanjiItem => {
            if (
              item === null ||
              item.characters === singleKanjiVocabularyCharacter ||
              seenIds.has(item.id)
            ) {
              return false;
            }
            seenIds.add(item.id);
            return true;
          });

        setSingleKanjiVocabularySimilarSubjects(
          sortSimilarKanjiItems(similarItems)
        );
      } catch (error) {
        console.warn(
          "[VocabDetails] Failed to load visually similar kanji for vocabulary:",
          error
        );
        if (isMounted) {
          setSingleKanjiVocabularySimilarSubjects([]);
        }
      }
    };

    void loadSimilarKanji();

    return () => {
      isMounted = false;
    };
  }, [
    singleKanjiVocabularyCharacter,
    showSingleKanjiVocabularySimilarKanji,
    visuallySimilarKanjiSource,
    vocabularyComponentSubjectIdsKey,
  ]);
  const maxInitialSimilarVocabularyItems = 6;

  // SRS stage name lookup (if available)
  const srsName = (() => {
    // If no SRS stage is defined, the subject hasn't been started
    if (vocabulary.srsStage === undefined || vocabulary.srsStage === null) {
      return "Not Started";
    }

    // If we have SRS system data, look up the stage name
    if (
      vocabulary.srsSystem &&
      vocabulary.srsSystem.stages &&
      vocabulary.srsSystem.stages[vocabulary.srsStage]
    ) {
      return vocabulary.srsSystem.stages[vocabulary.srsStage].name;
    }

    // Fallback based on common WaniKani SRS stage mappings
    switch (vocabulary.srsStage) {
      case 0:
        return "Initiate";
      case 1:
        return "Apprentice I";
      case 2:
        return "Apprentice II";
      case 3:
        return "Apprentice III";
      case 4:
        return "Apprentice IV";
      case 5:
        return "Guru I";
      case 6:
        return "Guru II";
      case 7:
        return "Master";
      case 8:
        return "Enlightened";
      case 9:
        return "Burned";
      default:
        return "Apprentice I";
    }
  })();

  // Format next review time
  const formatNextReviewTime = (nextReviewAt?: string) => {
    if (!nextReviewAt) {
      return "No review scheduled";
    }

    const reviewDate = new Date(nextReviewAt);
    const now = new Date();
    const timeDiff = reviewDate.getTime() - now.getTime();

    // If the review is in the past or very soon (within 5 minutes), it's available now
    if (timeDiff <= 5 * 60 * 1000) {
      return "Available now";
    }

    // If it's within the next hour, show minutes
    if (timeDiff < 60 * 60 * 1000) {
      const minutes = Math.ceil(timeDiff / (60 * 1000));
      return `${minutes}m`;
    }

    // If it's within the next day, show hours
    if (timeDiff < 24 * 60 * 60 * 1000) {
      const hours = Math.ceil(timeDiff / (60 * 60 * 1000));
      return `${hours}h`;
    }

    // If it's within the next week, show days
    if (timeDiff < 7 * 24 * 60 * 60 * 1000) {
      const days = Math.ceil(timeDiff / (24 * 60 * 60 * 1000));
      return `${days}d`;
    }

    // For longer periods, show the actual date
    return reviewDate.toLocaleDateString();
  };

  // Audio playback function
  async function playAudio(
    audioUrl: string,
    id: string,
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

      setLoadingAudioId(id);

      const cachedAudioUri = await resolveOfflineVocabularyAudioUri(
        vocabulary.id,
        pronunciationAudio ?? { url: audioUrl }
      );

      // Load and play the new audio
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: cachedAudioUri ?? audioUrl },
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
    } catch (err) {
      if (requestId !== audioPlaybackRequestIdRef.current) {
        return;
      }
      console.error("Error playing audio:", err);
      setPlayingAudioId(null);
      setLoadingAudioId(null);
    }
  }

  // Azure TTS playback function for context sentences
  async function playContextSentence(text: string, sentenceId: string) {
    try {
      const speedMultiplier =
        showContextSentenceSpeedControl
          ? sentencePlaybackSpeeds[sentenceId] ?? DEFAULT_CONTEXT_AUDIO_SPEED
          : DEFAULT_CONTEXT_AUDIO_SPEED;

      // If this sentence is currently playing, stop it
      if (playingContextSentence === sentenceId) {
        await azureSpeechService.stop();
        setPlayingContextSentence(null);
        return;
      }

      // Stop any currently playing Azure TTS
      if (playingContextSentence !== null) {
        await azureSpeechService.stop();
      }

      setPlayingContextSentence(sentenceId);

      await azureSpeechService.speak(
        text,
        () => {},
        () => {
          setPlayingContextSentence(null);
        },
        () => {
          setPlayingContextSentence(null);
        },
        { speedMultiplier }
      );
    } catch {
      setPlayingContextSentence(null);
    }
  }

  // Play media sentence audio (from ImmersionKit or TTS fallback)
  async function playMediaSentence(
    sentence: ImmersionKitSentence,
    index: number,
    sentenceId: string
  ) {
    try {
      const speedMultiplier =
        showContextSentenceSpeedControl
          ? sentencePlaybackSpeeds[sentenceId] ?? DEFAULT_CONTEXT_AUDIO_SPEED
          : DEFAULT_CONTEXT_AUDIO_SPEED;

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

      setPlayingAudioId(null);
      setLoadingAudioId(null);
      setPlayingMediaSentence(index);
      setLoadingMediaSentence(index);

      // If the sentence has audio, play it directly
      if (sentence.audio) {
        // Override audio session to use speaker (iOS only)
        if (Platform.OS === "ios") {
          try {
            await AudioSessionManager.overrideSpeaker();
          } catch {
            // Silent failure for audio session override
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
      console.error("Error playing media sentence:", error);
      setPlayingMediaSentence(null);
      setLoadingMediaSentence(null);
    }
  }

  // Helper function to format mnemonic text with special tags
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
          <Text
            key={index++}
            style={[styles.mnemonicText, { color: theme.textColor }]}
          >
            {match[3]}
          </Text>
        );
      } else if (match[1] === "em") {
        // Emphasized text
        segments.push(
          <Text
            key={index++}
            style={[styles.emText, { color: theme.textColor }]}
          >
            {match[2]}
          </Text>
        );
      } else if (match[1] === "radical") {
        // Radical text
        segments.push(
          <View key={index++} style={styles.inlineRadicalTag}>
            <Text style={styles.radicalTagText}>{match[2]}</Text>
          </View>
        );
      } else if (match[1] === "kanji") {
        // Kanji text
        segments.push(
          <View key={index++} style={styles.inlineKanjiTag}>
            <Text style={styles.kanjiTagText}>{match[2]}</Text>
          </View>
        );
      } else if (match[1] === "vocabulary") {
        // Vocabulary text
        segments.push(
          <View key={index++} style={styles.inlineVocabTag}>
            <Text style={styles.vocabTagText}>{match[2]}</Text>
          </View>
        );
      } else if (match[1] === "reading") {
        // Reading text
        segments.push(
          <View key={index++} style={styles.inlineReadingTag}>
            <Text style={styles.readingTagText}>{match[2]}</Text>
          </View>
        );
      } else if (match[1] === "ja") {
        // Japanese text (render as plain text)
        segments.push(
          <Text
            key={index++}
            style={[styles.mnemonicText, { color: theme.textColor }]}
          >
            {match[2]}
          </Text>
        );
      }
    }

    return <Text style={styles.mnemonicTextContainer}>{segments}</Text>;
  };

  // Sort component subjects by their kanji position in the vocabulary string.
  const sortedComponentSubjects = useMemo(() => {
    if (!Array.isArray(vocabulary.componentSubjects)) {
      return [];
    }

    if (vocabulary.componentSubjects.length <= 1) {
      return vocabulary.componentSubjects;
    }

    const characters =
      typeof vocabulary.characters === "string" ? vocabulary.characters : "";

    return vocabulary.componentSubjects
      .map((component, index) => {
        const characterIndex =
          typeof component.characters === "string" && characters.length > 0
            ? characters.indexOf(component.characters)
            : -1;

        return {
          component,
          index,
          characterIndex:
            characterIndex >= 0 ? characterIndex : Number.MAX_SAFE_INTEGER,
        };
      })
      .sort(
        (left, right) =>
          left.characterIndex - right.characterIndex || left.index - right.index
      )
      .map((entry) => entry.component);
  }, [vocabulary.componentSubjects, vocabulary.characters]);

  // Composition Section - limit to first 8 initially
  const maxInitialComponentItems = 8;
  const hasMoreComponentItems = sortedComponentSubjects.length > maxInitialComponentItems;
  const displayComponentItems = showAllComponents
    ? sortedComponentSubjects
    : sortedComponentSubjects.slice(0, maxInitialComponentItems);

  // Toggle show all components
  const toggleShowAllComponents = () => {
    setShowAllComponents((prev) => !prev);
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
            <Text style={[styles.rubyReading, { color: theme.textSecondary }]}>
              {reading}
            </Text>
            <Text
              style={[
                styles.rubyBase,
                { color: theme.textColor },
                isKeyword && styles.highlightedKeyword,
              ]}
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
            style={[
              styles.rubyBase,
              { color: theme.textColor },
              isKeyword && styles.highlightedKeyword,
            ]}
          >
            {text}
          </Text>
        );
      }
    }

    return <View style={styles.rubyLine}>{parts}</View>;
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

  // Render patterns of use section
  const renderUsagePatternSection = () => {
    if (!showPatternsOfUse || vocabularyUsagePatterns.length === 0) {
      return null;
    }

    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
          Patterns of Use
        </Text>
        <View
          style={[
            styles.infoBox,
            { backgroundColor: theme.cardBackground },
          ]}
        >
          <Text
            style={[
              styles.patternSelectorHint,
              { color: theme.textSecondary },
            ]}
          >
            Select a pattern to view example contexts.
          </Text>
          <View style={styles.patternPillsContainer}>
            {vocabularyUsagePatterns.map((patternGroup, groupIndex) => {
              const isSelected = groupIndex === selectedUsagePatternIndex;
              return (
                <TouchableOpacity
                  key={`pattern-pill-${groupIndex}`}
                  style={[
                    styles.patternPill,
                    {
                      borderColor: isSelected
                        ? subjectColors.vocabulary
                        : theme.border,
                      backgroundColor: isSelected
                        ? withAlpha(subjectColors.vocabulary, 0.16)
                        : theme.isDark
                          ? "rgba(255,255,255,0.03)"
                          : "rgba(0,0,0,0.02)",
                    },
                  ]}
                  onPress={() => setSelectedUsagePatternIndex(groupIndex)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.patternPillText,
                      {
                        color: isSelected
                          ? subjectColors.vocabulary
                          : theme.textSecondary,
                      },
                    ]}
                  >
                    {patternGroup.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {selectedUsagePattern && (
            <View
              style={[
                styles.patternExamplesCard,
                { borderColor: theme.border },
              ]}
            >
              <View style={styles.patternExamplesHeader}>
                <Text
                  style={[styles.patternExamplesTitle, { color: theme.textColor }]}
                >
                  {selectedUsagePattern.name}
                </Text>
              </View>

              {selectedUsagePattern.examples.map((example, exampleIndex) => {
                const translationId = `pattern-${selectedUsagePatternIndex}-example-${exampleIndex}`;
                return (
                  <View
                    key={translationId}
                    style={[
                      styles.patternExampleRow,
                      { borderBottomColor: theme.border },
                      exampleIndex === selectedUsagePattern.examples.length - 1 && {
                        borderBottomWidth: 0,
                        marginBottom: 0,
                        paddingBottom: 0,
                      },
                    ]}
                  >
                    <View style={styles.sentenceRow}>
                      <Text
                        selectable
                        style={[
                          styles.japaneseSentence,
                          { color: theme.textColor, flex: 1 },
                        ]}
                      >
                        {example.ja}
                      </Text>
                      <TouchableOpacity
                        style={[
                          styles.sentencePlayButton,
                          playingContextSentence === translationId &&
                            styles.sentencePlayButtonActive,
                        ]}
                        onPress={() => playContextSentence(example.ja, translationId)}
                      >
                        <Ionicons
                          name={
                            playingContextSentence === translationId ? "stop" : "play"
                          }
                          size={16}
                          color={
                            playingContextSentence === translationId
                              ? "#fff"
                              : subjectColors.vocabulary
                          }
                        />
                      </TouchableOpacity>
                    </View>
                    {renderTranslation(
                      example.en,
                      translationId,
                      [styles.englishSentence, { color: theme.textSecondary }]
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </View>
    );
  };

  // Render context sentences (both regular and media) - used in both tabs
  const renderContextSections = () => (
    <>
      {/* Context Sentences Section */}
      {vocabulary.contextSentences &&
        vocabulary.contextSentences.some((s) => s.ja && s.en) && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
              Context Sentences
            </Text>
            <View
              style={[
                styles.infoBox,
                { backgroundColor: theme.cardBackground },
              ]}
            >
              {vocabulary.contextSentences
                .filter((sentence) => sentence.ja && sentence.en)
                .map((sentence, index, filteredArray) => {
                  const sentenceId = `wk-${index}`;
                  return (
                    <View
                      key={index}
                      style={[
                        styles.sentenceContainer,
                        { borderBottomColor: theme.border },
                        index === filteredArray.length - 1 && {
                          borderBottomWidth: 0,
                          marginBottom: 0,
                          paddingBottom: 0,
                        },
                      ]}
                    >
                      <View style={styles.sentenceRow}>
                        <Text
                          selectable
                          style={[
                            styles.japaneseSentence,
                            { color: theme.textColor, flex: 1 },
                          ]}
                        >
                          {sentence.ja}
                        </Text>
                        <TouchableOpacity
                          style={[
                            styles.sentencePlayButton,
                            playingContextSentence === sentenceId &&
                              styles.sentencePlayButtonActive,
                          ]}
                          onPress={() =>
                            playContextSentence(sentence.ja, sentenceId)
                          }
                        >
                          <Ionicons
                            name={
                              playingContextSentence === sentenceId
                                ? "stop"
                                : "play"
                            }
                            size={16}
                            color={
                              playingContextSentence === sentenceId
                                ? "#fff"
                                : subjectColors.vocabulary
                            }
                          />
                        </TouchableOpacity>
                      </View>
                      {renderTranslation(
                        sentence.en,
                        sentenceId,
                        [styles.englishSentence, { color: theme.textSecondary }]
                      )}
                      {renderSentenceSpeedControl(sentenceId)}
                    </View>
                  );
                })}
            </View>
          </View>
        )}
    </>
  );

  const renderSimilarVocabularySection = (
    title: string,
    matches: SimilarVocabularyItem[],
    showAll: boolean,
    toggleShowAll: () => void
  ) => {
    if (loadingSimilarVocabulary || matches.length === 0) {
      return null;
    }

    const hasMoreItems = matches.length > maxInitialSimilarVocabularyItems;
    const displayItems = showAll
      ? matches
      : matches.slice(0, maxInitialSimilarVocabularyItems);
    const shouldStaggerItems = displayItems.length <= 30;

    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
          {title}
        </Text>
        <View
          style={[
            styles.infoBox,
            { backgroundColor: theme.cardBackground },
          ]}
        >
          <Animated.View
            style={styles.similarVocabularyGrid}
            entering={FadeInDown.duration(140)}
            exiting={FadeOutUp.duration(120)}
            layout={LinearTransition.duration(180)}
          >
            {displayItems.map((item, idx) => {
              return (
                <Animated.View
                  key={`similar-vocab-${item.id}`}
                  entering={
                    shouldStaggerItems
                      ? FadeInDown.duration(140).delay(idx * 10)
                      : FadeInDown.duration(140)
                  }
                  exiting={FadeOutUp.duration(120)}
                  layout={LinearTransition.duration(180)}
                >
                  <TouchableOpacity
                    style={[
                      styles.similarVocabularyCard,
                      {
                        width: Math.min(
                          Math.max(
                            minSimilarVocabCardWidth,
                            80 + (item.characters?.length || 0) * 18
                          ),
                          similarVocabItemMaxWidth
                        ),
                        height: similarVocabCardHeight,
                        margin: gridSpacing / 2,
                        opacity: item.level > userLevel ? 0.8 : 1,
                      },
                    ]}
                    disabled={!onSubjectPress}
                    onPress={() => onSubjectPress?.(item.id)}
                  >
                    <Text
                      style={[
                        styles.similarVocabularyCharacter,
                        item.characters && item.characters.length > 3
                          ? {
                              fontSize: Math.max(
                                14,
                                22 - (item.characters.length - 3) * 2
                              ),
                            }
                          : null,
                      ]}
                      adjustsFontSizeToFit
                      numberOfLines={1}
                    >
                      {item.characters || item.primaryMeaning}
                    </Text>
                    <Text
                      style={styles.similarVocabularyMeaning}
                      numberOfLines={2}
                      ellipsizeMode="tail"
                    >
                      {item.primaryMeaning}
                    </Text>
                    {item.level > userLevel && (
                      <View style={styles.itemLevelBadgeSimilarVocabulary}>
                        <Text style={styles.itemLevelBadgeText}>{item.level}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </Animated.View>

          {hasMoreItems && (
            <Animated.View
              entering={FadeInDown.duration(200)}
              exiting={FadeOutUp.duration(200)}
              layout={LinearTransition.duration(180)}
            >
              <TouchableOpacity
                style={[
                  styles.showMoreButton,
                  { borderTopColor: theme.border },
                ]}
                onPress={toggleShowAll}
              >
                <Text
                  style={[
                    styles.showMoreText,
                    { color: theme.textSecondary },
                  ]}
                >
                  {showAll
                    ? "Show Less"
                    : `Show ${
                        matches.length - maxInitialSimilarVocabularyItems
                      } More`}
                </Text>
                <Ionicons
                  name={showAll ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={subjectColors.vocabulary}
                />
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </View>
    );
  };

  const maxInitialSimilarKanjiItems = 8;

  const renderVisuallySimilarKanjiSection = () => {
    if (
      !showSingleKanjiVocabularySimilarKanji ||
      !singleKanjiVocabularyCharacter ||
      singleKanjiVocabularySimilarSubjects.length === 0
    ) {
      return null;
    }

    const hasMoreItems =
      singleKanjiVocabularySimilarSubjects.length > maxInitialSimilarKanjiItems;
    const displayItems = showAllSimilarKanji
      ? singleKanjiVocabularySimilarSubjects
      : singleKanjiVocabularySimilarSubjects.slice(
          0,
          maxInitialSimilarKanjiItems
        );
    const shouldStaggerItems = displayItems.length <= 30;

    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
          Visually Similar Kanji
        </Text>
        <View
          style={[
            styles.infoBox,
            { backgroundColor: theme.cardBackground },
          ]}
        >
          <Animated.View
            style={styles.componentGrid}
            entering={FadeInDown.duration(140)}
            exiting={FadeOutUp.duration(120)}
            layout={LinearTransition.duration(180)}
          >
            {displayItems.map((item, idx) => {
              const isAboveUserLevel = item.level > userLevel;
              return (
                <Animated.View
                  key={`similar-kanji-${item.id}`}
                  entering={
                    shouldStaggerItems
                      ? FadeInDown.duration(140).delay(idx * 10)
                      : FadeInDown.duration(140)
                  }
                  exiting={FadeOutUp.duration(120)}
                  layout={LinearTransition.duration(180)}
                >
                  <TouchableOpacity
                    style={[
                      styles.componentItem,
                      {
                        width: componentItemWidth,
                        height: smallCardHeight,
                        margin: gridSpacing / 2,
                        opacity: isAboveUserLevel ? 0.8 : 1,
                      },
                    ]}
                    onPress={() => onSubjectPress?.(item.id)}
                    disabled={!onSubjectPress}
                  >
                    <Text
                      style={styles.componentCharacter}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                    >
                      {item.characters}
                    </Text>
                    <Text
                      style={styles.componentMeaning}
                      numberOfLines={2}
                      ellipsizeMode="tail"
                    >
                      {item.meanings[0] || "Loading..."}
                    </Text>
                    {isAboveUserLevel && (
                      <View style={styles.itemLevelBadge}>
                        <Text style={styles.itemLevelBadgeText}>
                          {item.level}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </Animated.View>

          {hasMoreItems && (
            <Animated.View
              entering={FadeInDown.duration(200)}
              exiting={FadeOutUp.duration(200)}
              layout={LinearTransition.duration(180)}
            >
              <TouchableOpacity
                style={[
                  styles.showMoreButton,
                  { borderTopColor: theme.border },
                ]}
                onPress={() => setShowAllSimilarKanji((prev) => !prev)}
              >
                <Text
                  style={[
                    styles.showMoreText,
                    { color: theme.textSecondary },
                  ]}
                >
                  {showAllSimilarKanji
                    ? "Show Less"
                    : `Show ${
                        singleKanjiVocabularySimilarSubjects.length -
                        maxInitialSimilarKanjiItems
                      } More`}
                </Text>
                <Ionicons
                  name={showAllSimilarKanji ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={subjectColors.kanji}
                />
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </View>
    );
  };

  // For smoother perf: stagger only if ≤ 30 items
  const shouldStaggerComponents =
    displayComponentItems && displayComponentItems.length <= 30;

  const tabOrder = ["meaning", "reading", "context"] as const;

  const getTabIndex = (tab: "meaning" | "reading" | "context") =>
    tabOrder.indexOf(tab);

  const changeTab = (tab: "meaning" | "reading" | "context") => {
    const targetIndex = getTabIndex(tab);

    if (targetIndex < 0 || tabOrder[targetIndex] === activeTab) {
      return;
    }

    setActiveTab(tabOrder[targetIndex]);
    pagerRef.current?.setPage(targetIndex);
  };

  const onTabPageSelected = (event: { nativeEvent: { position: number } }) => {
    const nextTab = tabOrder[event.nativeEvent.position];

    if (!nextTab || nextTab === activeTab) {
      return;
    }

    setActiveTab(nextTab);
  };

  const renderTabBody = (tab: "meaning" | "reading" | "context") => {
    const activeTab = tab;

    return (
      <>
        {activeTab === "meaning" && (
          <View>
            {/* Meaning Tab Content */}
            {/* Name Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
                Name
              </Text>
              <View
                style={[
                  styles.infoBox,
                  { backgroundColor: theme.cardBackground },
                ]}
              >
                <View style={[styles.row, { marginBottom: 8 }]}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>
                    Primary
                  </Text>
                  <Text style={[styles.value, { color: theme.textColor }]}>
                    {primaryMeaning}
                  </Text>
                </View>

                {vocabulary.meanings.length > 1 && (
                  <View style={[styles.row, { marginBottom: 8 }]}>
                    <Text
                      style={[styles.label, { color: theme.textSecondary }]}
                    >
                      Alternative
                    </Text>
                    <Text style={[styles.value, { color: theme.textColor }]}>
                      {vocabulary.meanings
                        .filter((m) => !m.primary)
                        .map((m) => m.meaning)
                        .join(", ")}
                    </Text>
                  </View>
                )}

                <View
                  style={[
                    styles.row,
                    {
                      marginBottom:
                        vocabulary.partsOfSpeech &&
                        vocabulary.partsOfSpeech.length > 0
                          ? 8
                          : 0,
                    },
                  ]}
                >
                  <Text
                    style={[styles.label, { color: theme.textSecondary }]}
                  >
                    User Synonyms
                  </Text>
                  <View style={styles.synonymsValueContainer}>
                    <Text
                      style={[
                        styles.value,
                        { color: theme.textColor, flex: 1 },
                        !vocabulary.userSynonyms?.length && {
                          color: theme.textSecondary,
                          fontStyle: "italic",
                        },
                      ]}
                      numberOfLines={2}
                    >
                      {vocabulary.userSynonyms?.length
                        ? vocabulary.userSynonyms.join(", ")
                        : "None"}
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.manageSynonymsButton,
                        { borderColor: theme.border },
                      ]}
                      onPress={() => setSynonymsModalVisible(true)}
                    >
                      <Text
                        style={[
                          styles.manageSynonymsText,
                          { color: theme.textSecondary },
                        ]}
                      >
                        Manage
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {vocabulary.partsOfSpeech &&
                  vocabulary.partsOfSpeech.length > 0 && (
                    <View style={styles.row}>
                      <Text
                        style={[styles.label, { color: theme.textSecondary }]}
                      >
                        Part of Speech
                      </Text>
                      <Text style={[styles.value, { color: theme.textColor }]}>
                        {vocabulary.partsOfSpeech.join(", ")}
                      </Text>
                    </View>
                  )}
              </View>
            </View>

            {/* Mnemonic Section */}
            {vocabulary.meaningMnemonic && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
                  Mnemonic
                </Text>
                <View
                  style={[
                    styles.infoBox,
                    { backgroundColor: theme.cardBackground },
                  ]}
                >
                  <View style={styles.mnemonicContainer}>
                    {formatMnemonic(vocabulary.meaningMnemonic)}
                  </View>
                </View>
              </View>
            )}

            {/* Meaning Hint Section */}
            {vocabulary.meaningHint && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
                  Meaning Hint
                </Text>
                <View
                  style={[
                    styles.infoBox,
                    { backgroundColor: theme.cardBackground },
                  ]}
                >
                  <View style={styles.mnemonicContainer}>
                    {formatMnemonic(vocabulary.meaningHint)}
                  </View>
                </View>
              </View>
            )}

            {/* Context Sections removed from Meaning tab */}
          </View>
        )}
        {activeTab === "reading" && (
          <View>
            {/* Reading Tab Content */}
            {/* Readings Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
                Readings
              </Text>
              <View
                style={[
                  styles.infoBox,
                  { backgroundColor: theme.cardBackground },
                ]}
              >
                {vocabulary.readings.length > 0 && (
                  <View
                    style={[
                      styles.readingRow,
                      {
                        marginBottom:
                          orderedMpegAudioFiles.length > 0 ||
                          (showPitchAccent && !!pitchAccentEntry)
                            ? 16
                            : 0,
                      },
                    ]}
                  >
                    {vocabulary.readings.map((reading, index) => (
                      <View
                        key={`reading-${index}`}
                        style={[
                          styles.readingBadge,
                          {
                            backgroundColor: theme.isDark ? "#333" : "#f5f5f5",
                          },
                          reading.primary && styles.primaryReadingBadge,
                        ]}
                      >
                        <Text
                          style={[
                            styles.readingBadgeText,
                            { color: theme.textSecondary },
                            reading.primary && styles.primaryReadingBadgeText,
                          ]}
                        >
                          {reading.reading}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {showPitchAccent && pitchAccentEntry && (
                  <PitchAccentVisualization
                    reading={pitchAccentEntry.r}
                    accents={pitchAccentEntry.p}
                    containerStyle={{
                      marginBottom: orderedMpegAudioFiles.length > 0 ? 16 : 0,
                    }}
                  />
                )}

                {/* Audio Playback Section */}
                {orderedMpegAudioFiles.length > 0 && (
                  <View style={styles.audioContainer}>
                    <Text
                      style={[styles.audioTitle, { color: theme.textColor }]}
                    >
                      Audio
                    </Text>
                    <View style={styles.audioButtonsContainer}>
                      {orderedMpegAudioFiles.map((audio, index) => {
                        const actorId = audio.metadata?.voice_actor_id ?? index;
                        const audioId = `audio-${actorId}`;
                        return (
                          <TouchableOpacity
                            key={audioId}
                            style={[
                              styles.audioButton,
                              (playingAudioId === audioId ||
                                loadingAudioId === audioId) &&
                                styles.audioButtonPlaying,
                            ]}
                            onPress={() => playAudio(audio.url, audioId, audio)}
                            disabled={loadingAudioId === audioId}
                          >
                            {loadingAudioId === audioId ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Ionicons
                                name={
                                  playingAudioId === audioId ? "stop" : "play"
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
                      })}
                    </View>
                  </View>
                )}
              </View>
            </View>

            {/* Reading Mnemonic Section */}
            {vocabulary.readingMnemonic && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
                  Mnemonic
                </Text>
                <View
                  style={[
                    styles.infoBox,
                    { backgroundColor: theme.cardBackground },
                  ]}
                >
                  <View style={styles.mnemonicContainer}>
                    {formatMnemonic(vocabulary.readingMnemonic)}
                  </View>
                </View>
              </View>
            )}

            {/* Reading Hint Section */}
            {vocabulary.readingHint && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
                  Reading Hint
                </Text>
                <View
                  style={[
                    styles.infoBox,
                    { backgroundColor: theme.cardBackground },
                  ]}
                >
                  <View style={styles.mnemonicContainer}>
                    {formatMnemonic(vocabulary.readingHint)}
                  </View>
                </View>
              </View>
            )}

            {/* Context Sections removed from Reading tab */}
          </View>
        )}
        {activeTab === "context" && (
          <View>
            {/* Patterns of Use */}
            {renderUsagePatternSection()}

            {/* Regular Context Sentences */}
            {renderContextSections()}

            {/* Media Context Sentences Section */}
            {showMediaContextSentences && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
                  Media Context Sentences
                </Text>
                <View
                  style={[
                    styles.infoBox,
                    { backgroundColor: theme.cardBackground },
                  ]}
                >
                  {loadingMediaSentences && mediaSentences.length === 0 && (
                    <Text
                      style={[
                        styles.loadingText,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Loading examples for &quot;{vocabulary.characters}
                      &quot;...
                    </Text>
                  )}

                  {!loadingMediaSentences &&
                    validMediaSentences.length === 0 &&
                    mediaSentences.length === 0 && (
                      <View>
                        <Text
                          style={[
                            styles.loadingText,
                            { color: theme.textSecondary },
                          ]}
                        >
                          No media examples found for &quot;
                          {vocabulary.characters}
                          &quot;
                        </Text>
                      </View>
                    )}

                  {/* Media Sentences List - Render if we have items, even if loading more */}
                  {mediaSentences.length > 0 &&
                    mediaSentences
                      .slice(0, visibleMediaCount)
                      .map((sentence, index) => {
                        const sentenceId = `media-${sentence.id ?? index}`;
                        return (
                          <View
                            key={`${sentence.id}-${index}`}
                            style={[
                              styles.mediaSentenceContainer,
                              { borderBottomColor: theme.border },
                              index ===
                                Math.min(
                                  mediaSentences.length,
                                  visibleMediaCount
                                ) -
                                  1 && {
                                borderBottomWidth: 0,
                                marginBottom: 0,
                                paddingBottom: 0,
                              },
                            ]}
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
                                    style={[
                                      styles.sourceName,
                                      { color: theme.textSecondary },
                                    ]}
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
                                  !sentence.audio && styles.mediaPlayButtonDisabled,
                                ]}
                                onPress={() =>
                                  playMediaSentence(sentence, index, sentenceId)
                                }
                                disabled={
                                  loadingMediaSentence === index || !sentence.audio
                                }
                              >
                                {loadingMediaSentence === index ? (
                                  <ActivityIndicator size={16} color="#fff" />
                                ) : (
                                  <Ionicons
                                    name={
                                      playingMediaSentence === index
                                        ? "stop"
                                        : sentence.audio
                                          ? "play"
                                          : "volume-mute"
                                    }
                                    size={16}
                                    color={
                                      playingMediaSentence === index || !sentence.audio
                                        ? "#fff"
                                        : subjectColors.vocabulary
                                    }
                                  />
                                )}
                              </TouchableOpacity>
                            </View>
                            {/* Horizontal layout: Image on left, text on right */}
                            <View style={styles.mediaContentRow}>
                              {/* Screenshot from the media */}
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

                              {/* Text content on the right */}
                              <View style={styles.mediaTextContent}>
                                {/* 1. Japanese sentence */}
                                <Text
                                  selectable
                                  style={[
                                    styles.mediaSentenceText,
                                    { color: theme.textColor },
                                  ]}
                                >
                                  {renderHighlightedSentence(
                                    sentence.sentence,
                                    vocabulary.characters.startsWith("〜")
                                      ? vocabulary.characters.slice(1)
                                      : vocabulary.characters
                                  )}
                                </Text>

                                {/* 2. English translation */}
                                {renderTranslation(
                                  sentence.translation,
                                  sentenceId,
                                  [
                                    styles.mediaTranslationText,
                                    { color: theme.textSecondary },
                                  ]
                                )}
                                {renderSentenceSpeedControl(sentenceId)}

                                {/* 3. Furigana (kanji with readings above) */}
                                {sentence.sentence_with_furigana && (
                                  <View style={styles.mediaFuriganaContainer}>
                                    {renderFurigana(
                                      sentence.sentence_with_furigana,
                                      vocabulary.characters.startsWith("〜")
                                        ? vocabulary.characters.slice(1)
                                        : vocabulary.characters
                                    )}
                                  </View>
                                )}
                              </View>
                            </View>
                          </View>
                        );
                      })}
                </View>

                {/* Load More Button - Rendered OUTSIDE the infoBox container */}
                {(mediaSentences.length > visibleMediaCount ||
                  (loadingMediaSentences && mediaSentences.length > 0)) && (
                  <TouchableOpacity
                    onPress={loadMoreMediaSentences}
                    disabled={loadingMediaSentences}
                    style={{
                      backgroundColor: theme.cardBackground,
                      marginTop: 12,
                      padding: 14,
                      borderRadius: 12,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.1,
                      shadowRadius: 2,
                      elevation: 2,
                    }}
                  >
                    {loadingMediaSentences ? (
                      <ActivityIndicator
                        size="small"
                        color={theme.secondary}
                        style={{ marginRight: 8 }}
                      />
                    ) : (
                      <Text
                        style={{
                          color: theme.textSecondary,
                          marginRight: 6,
                          fontWeight: "600",
                          fontSize: 15,
                        }}
                      >
                        Load More
                      </Text>
                    )}
                    {!loadingMediaSentences && (
                      <Ionicons
                        name="chevron-down"
                        size={18}
                        color={theme.secondary}
                      />
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}
        {activeTab !== "context" && (
          <>
            {/* Notes Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
                Notes
              </Text>
              <View
                style={[
                  styles.infoBox,
                  styles.noteBox,
                  { backgroundColor: theme.cardBackground },
                ]}
              >
                {activeTab === "meaning" ? (
                  <TouchableOpacity
                    style={styles.noteContainer}
                    onPress={() => vocabulary.onEditNote?.("meaning")}
                  >
                    <View style={styles.noteHeader}>
                      <Text style={[styles.noteTitle, { color: theme.textColor }]}>
                        Meaning Note
                      </Text>
                      <View style={styles.editButton}>
                        <Ionicons
                          name="pencil"
                          size={16}
                          color={theme.textSecondary}
                          style={{ fontWeight: "bold" }}
                        />
                      </View>
                    </View>
                    {vocabulary.meaningNote ? (
                      <Text style={[styles.noteContent, { color: theme.textColor }]}>
                        {vocabulary.meaningNote}
                      </Text>
                    ) : (
                      <Text style={[styles.noteText, { color: theme.textLight }]}>
                        Click to add meaning note
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.noteContainer}
                    onPress={() => vocabulary.onEditNote?.("reading")}
                  >
                    <View style={styles.noteHeader}>
                      <Text style={[styles.noteTitle, { color: theme.textColor }]}>
                        Reading Note
                      </Text>
                      <View style={styles.editButton}>
                        <Ionicons
                          name="pencil"
                          size={16}
                          color={theme.textSecondary}
                          style={{ fontWeight: "bold" }}
                        />
                      </View>
                    </View>
                    {vocabulary.readingNote ? (
                      <Text style={[styles.noteContent, { color: theme.textColor }]}>
                        {vocabulary.readingNote}
                      </Text>
                    ) : (
                      <Text style={[styles.noteText, { color: theme.textLight }]}>
                        Click to add reading note
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Vocabulary Composition Section */}
            {sortedComponentSubjects.length > 0 && (
              <View style={styles.section}>
                <Text
                  style={[styles.sectionTitle, { color: theme.textColor }]}
                >
                  Composition
                </Text>
                <View
                  style={[
                    styles.infoBox,
                    { backgroundColor: theme.cardBackground },
                  ]}
                >
                  <Animated.View
                    style={styles.componentGrid}
                    entering={FadeInDown.duration(160)}
                    exiting={FadeOutUp.duration(140)}
                    layout={LinearTransition.springify()
                      .damping(18)
                      .stiffness(100)}
                  >
                    {displayComponentItems?.map((component) => {
                      const isAboveUserLevel = component.level > userLevel;
                      return (
                        <TouchableOpacity
                          key={component.id}
                          style={[
                            styles.componentItem,
                            {
                              width: Math.min(
                                componentItemWidth +
                                  (component.meanings?.[0] || "").length * 3,
                                smallItemMaxWidth
                              ),
                              height: smallCardHeight,
                              margin: gridSpacing / 2,
                              opacity: isAboveUserLevel ? 0.8 : 1,
                            },
                          ]}
                          onPress={() => onSubjectPress?.(component.id)}
                        >
                          <Text
                            style={styles.componentCharacter}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.75}
                          >
                            {component.characters}
                          </Text>
                          <Text
                            style={styles.componentMeaning}
                            numberOfLines={2}
                            ellipsizeMode="tail"
                          >
                            {component.meanings[0]}
                          </Text>
                          {isAboveUserLevel && (
                            <View style={styles.itemLevelBadge}>
                              <Text style={styles.itemLevelBadgeText}>
                                {component.level}
                              </Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </Animated.View>

                  {hasMoreComponentItems && (
                    <Animated.View
                      entering={FadeInDown.duration(160)}
                      exiting={FadeOutUp.duration(140)}
                      layout={LinearTransition.springify()
                        .damping(18)
                        .stiffness(100)}
                    >
                      <TouchableOpacity
                        style={[
                          styles.showMoreButton,
                          { borderTopColor: theme.border },
                        ]}
                        onPress={toggleShowAllComponents}
                      >
                        <Text
                          style={[
                            styles.showMoreText,
                            { color: theme.textSecondary },
                          ]}
                        >
                          {showAllComponents
                            ? "Show Less"
                            : `Show ${
                                sortedComponentSubjects.length -
                                maxInitialComponentItems
                              } More`}
                        </Text>
                        <Ionicons
                          name={
                            showAllComponents ? "chevron-up" : "chevron-down"
                          }
                          size={16}
                          color={subjectColors.kanji}
                        />
                      </TouchableOpacity>
                    </Animated.View>
                  )}
                </View>
              </View>
            )}

            {renderVisuallySimilarKanjiSection()}

            {showSimilarVocabulary &&
              activeTab === "meaning" &&
              renderSimilarVocabularySection(
                "Similar Vocabulary by Meaning",
                similarVocabularyByMeaning,
                showAllSimilarByMeaning,
                () => setShowAllSimilarByMeaning((prev) => !prev)
              )}

            {showSimilarVocabulary &&
              activeTab === "reading" &&
              renderSimilarVocabularySection(
                "Similar Vocabulary by Reading",
                similarVocabularyByReading,
                showAllSimilarByReading,
                () => setShowAllSimilarByReading((prev) => !prev)
              )}

            {/* Your Progression Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
                Your Progression
              </Text>
              <View
                style={[
                  styles.infoBox,
                  { backgroundColor: theme.cardBackground },
                ]}
              >
                <View style={styles.progressionContainer}>
                  {progressionStatus === "loading" ? (
                    /* Loading State */
                    (<View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color={theme.secondary} />
                      <Text
                        style={[
                          styles.loadingText,
                          { color: theme.textSecondary },
                        ]}
                      >
                        Loading progression...
                      </Text>
                    </View>)
                  ) : progressionStatus === "offline" ? (
                    /* Offline State */
                    (<View style={styles.notStartedContainer}>
                      <View style={[styles.srsBadge, styles.lockedBadge]}>
                        <Ionicons name="cloud-offline" size={28} color="#fff" />
                      </View>
                      <Text
                        style={[styles.srsName, { color: theme.textColor }]}
                      >
                        Offline
                      </Text>
                      <Text
                        style={[
                          styles.notStartedText,
                          { color: theme.textSecondary },
                        ]}
                      >
                        Cannot determine progression while offline
                      </Text>
                    </View>)
                  ) : vocabulary.srsStage === undefined ||
                    vocabulary.srsStage === null ||
                    vocabulary.srsStage === 0 ? (
                    /* Not Started State */
                    (<View style={styles.notStartedContainer}>
                      <View style={[styles.srsBadge, styles.lockedBadge]}>
                        <Ionicons name="lock-closed" size={28} color="#fff" />
                      </View>
                      <Text
                        style={[styles.srsName, { color: theme.textColor }]}
                      >
                        {vocabulary.srsStage === 0 ? "Initiate" : "Not Started"}
                      </Text>
                      <Text
                        style={[
                          styles.notStartedText,
                          { color: theme.textSecondary },
                        ]}
                      >
                        Complete the lesson to start tracking progress
                      </Text>
                    </View>)
                  ) : (
                    /* Started State */
                    (<>
                      <View style={styles.srsContainer}>
                        <View
                          style={[
                            styles.srsBadge,
                            getSrsStyleByName(srsName, styles),
                          ]}
                        >
                          <SrsLevelIcon
                            level={srsName}
                            size={28}
                            color="#fff"
                          />
                        </View>
                        <Text
                          style={[styles.srsName, { color: theme.textColor }]}
                        >
                          {srsName}
                        </Text>

                        <View style={styles.nextReviewContainer}>
                          <Text
                            style={[
                              styles.nextReviewText,
                              { color: theme.textSecondary },
                            ]}
                          >
                            Next review:{" "}
                            <Text
                              style={{
                                fontWeight: "600",
                                color: theme.textColor,
                              }}
                            >
                              {formatNextReviewTime(vocabulary.nextReviewAt)}
                            </Text>
                          </Text>
                        </View>

                        {vocabulary.percentageCorrect !== undefined && (
                          <View style={styles.percentageIndicator}>
                            <Text
                              style={[
                                styles.percentageText,
                                { color: theme.textColor },
                              ]}
                            >
                              {Math.round(vocabulary.percentageCorrect)}%
                              Accuracy
                            </Text>
                          </View>
                        )}
                      </View>
                      <View
                        style={[
                          styles.divider,
                          { backgroundColor: theme.border },
                        ]}
                      />
                      <View style={styles.statsContainer}>
                        <View style={styles.statColumn}>
                          <Text
                            style={[
                              styles.statTitle,
                              { color: theme.textColor },
                            ]}
                          >
                            Meaning
                          </Text>

                          <View style={styles.streakContainer}>
                            <View style={styles.streakItem}>
                              <Text
                                style={[
                                  styles.streakLabel,
                                  { color: theme.textSecondary },
                                ]}
                              >
                                Current
                              </Text>
                              <Text
                                style={[
                                  styles.streakValue,
                                  { color: theme.textColor },
                                ]}
                              >
                                {vocabulary.meaningCurrentStreak || 0}
                              </Text>
                            </View>
                            <View style={styles.streakItem}>
                              <Text
                                style={[
                                  styles.streakLabel,
                                  { color: theme.textSecondary },
                                ]}
                              >
                                Longest
                              </Text>
                              <Text
                                style={[
                                  styles.streakValue,
                                  { color: theme.textColor },
                                ]}
                              >
                                {vocabulary.meaningMaxStreak || 0}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.correctnessRow}>
                            <View style={styles.correctness}>
                              <Ionicons
                                name="checkmark-circle"
                                size={16}
                                color="#43aa8b"
                              />
                              <Text
                                style={[
                                  styles.correctnessText,
                                  { color: theme.textColor },
                                ]}
                              >
                                {vocabulary.meaningCorrect || 0}
                              </Text>
                            </View>
                            <View style={styles.correctness}>
                              <Ionicons
                                name="close-circle"
                                size={16}
                                color="#e53935"
                              />
                              <Text
                                style={[
                                  styles.correctnessText,
                                  { color: theme.textColor },
                                ]}
                              >
                                {vocabulary.meaningIncorrect || 0}
                              </Text>
                            </View>
                          </View>
                        </View>

                        <View
                          style={[
                            styles.statDivider,
                            { backgroundColor: theme.border },
                          ]}
                        />

                        <View style={styles.statColumn}>
                          <Text
                            style={[
                              styles.statTitle,
                              { color: theme.textColor },
                            ]}
                          >
                            Reading
                          </Text>

                          <View style={styles.streakContainer}>
                            <View style={styles.streakItem}>
                              <Text
                                style={[
                                  styles.streakLabel,
                                  { color: theme.textSecondary },
                                ]}
                              >
                                Current
                              </Text>
                              <Text
                                style={[
                                  styles.streakValue,
                                  { color: theme.textColor },
                                ]}
                              >
                                {vocabulary.readingCurrentStreak || 0}
                              </Text>
                            </View>
                            <View style={styles.streakItem}>
                              <Text
                                style={[
                                  styles.streakLabel,
                                  { color: theme.textSecondary },
                                ]}
                              >
                                Longest
                              </Text>
                              <Text
                                style={[
                                  styles.streakValue,
                                  { color: theme.textColor },
                                ]}
                              >
                                {vocabulary.readingMaxStreak || 0}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.correctnessRow}>
                            <View style={styles.correctness}>
                              <Ionicons
                                name="checkmark-circle"
                                size={16}
                                color="#43aa8b"
                              />
                              <Text
                                style={[
                                  styles.correctnessText,
                                  { color: theme.textColor },
                                ]}
                              >
                                {vocabulary.readingCorrect || 0}
                              </Text>
                            </View>
                            <View style={styles.correctness}>
                              <Ionicons
                                name="close-circle"
                                size={16}
                                color="#e53935"
                              />
                              <Text
                                style={[
                                  styles.correctnessText,
                                  { color: theme.textColor },
                                ]}
                              >
                                {vocabulary.readingIncorrect || 0}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    </>)
                  )}
                </View>
              </View>
            </View>
          </>
        )}
      </>
    );
  };

  const renderPage = (
    tab: "meaning" | "reading" | "context",
    scrollRef: typeof meaningScrollRef
  ) => (
    <View style={styles.page}>
      <Animated.ScrollView
        ref={scrollRef}
        style={[
          styles.container,
          { backgroundColor: theme.backgroundColor },
          embedded && styles.embeddedContainer,
        ]}
        contentContainerStyle={[
          styles.contentContainer,
          embedded && styles.embeddedContentContainer,
        ]}
        overScrollMode="never"
        indicatorStyle={theme.isDark ? "white" : "black"}
        scrollEventThrottle={16}
      >
        {renderTabBody(tab)}
      </Animated.ScrollView>
    </View>
  );

  return (
    <View style={[styles.wrapper, embedded && styles.embeddedWrapper]} ref={containerRef}>
      <View
        style={[
          styles.container,
          { backgroundColor: theme.backgroundColor },
          embedded && styles.embeddedContainer,
        ]}
      >
        {!embedded && (
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={BACK_BUTTON_HIT_SLOP}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          {onAddToList && (
            <TouchableOpacity
              onPress={onAddToList}
              style={styles.addToListButton}
            >
              <Ionicons name="bookmark-outline" size={20} color="#fff" />
            </TouchableOpacity>
          )}

          {onOpenConstellation && vocabulary.object !== "kana_vocabulary" && (
            <TouchableOpacity
              onPress={onOpenConstellation}
              style={styles.constellationButton}
            >
              <Ionicons name="planet-outline" size={24} color="#fff" />
            </TouchableOpacity>
          )}

          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>{vocabulary.level}</Text>
          </View>

          <TouchableOpacity
            ref={mainCharacterRef}
            style={styles.characterContainer}
            activeOpacity={0.75}
            onPress={() => copyText(vocabulary.characters, mainCharacterRef)}
          >
            <Text
              style={[
                styles.character,
                vocabulary.characters && vocabulary.characters.length > 3
                  ? {
                      fontSize: Math.max(
                        18,
                        40 - (vocabulary.characters.length - 3) * 4
                      ),
                    }
                  : {},
              ]}
              adjustsFontSizeToFit={true}
              numberOfLines={1}
            >
              {vocabulary.characters}
            </Text>
          </TouchableOpacity>

          <Text style={styles.mainTitle}>{primaryMeaning}</Text>
          {!!primaryReading && (
            <Text style={styles.mainReading}>{primaryReading}</Text>
          )}
        </View>
        )}

        <View
          style={[
            styles.tabContainer,
            { backgroundColor: theme.cardBackground },
            embedded && styles.embeddedTabContainer,
          ]}
        >
          <TouchableOpacity
            style={[styles.tab, activeTab === "meaning" && styles.activeTab]}
            onPress={() => changeTab("meaning")}
          >
            <Text
              style={[
                styles.tabText,
                { color: theme.textColor },
                activeTab === "meaning" && styles.activeTabText,
              ]}
            >
              Meaning
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "reading" && styles.activeTab]}
            onPress={() => changeTab("reading")}
          >
            <Text
              style={[
                styles.tabText,
                { color: theme.textColor },
                activeTab === "reading" && styles.activeTabText,
              ]}
            >
              Reading
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "context" && styles.activeTab]}
            onPress={() => changeTab("context")}
          >
            <Text
              style={[
                styles.tabText,
                { color: theme.textColor },
                activeTab === "context" && styles.activeTabText,
              ]}
            >
              Context
            </Text>
          </TouchableOpacity>
        </View>

        <PagerView
          ref={pagerRef}
          style={styles.pagerContainer}
          initialPage={getTabIndex(activeTab)}
          onPageSelected={onTabPageSelected}
        >
          {renderPage("meaning", meaningScrollRef)}
          {renderPage("reading", readingScrollRef)}
          {renderPage("context", contextScrollRef)}
        </PagerView>
      </View>

      <CopyTooltip
        visible={tooltipVisible}
        position={tooltipPosition}
        opacity={tooltipOpacity}
        translateY={tooltipTranslateY}
      />

      {/* Synonyms Modal */}
      <SynonymsModal
        visible={synonymsModalVisible}
        onClose={() => setSynonymsModalVisible(false)}
        onSave={async (synonyms) => {
          if (onSynonymsChange) {
            await onSynonymsChange(synonyms);
          }
        }}
        currentSynonyms={vocabulary.userSynonyms || []}
        subjectType="vocabulary"
      />
    </View>
  );
}

// Helper function to get SRS stage style
function getSrsStyleByName(
  name: string,
  styles: ReturnType<typeof createStyles>
) {
  const normalizedName = name.toLowerCase();
  if (normalizedName.startsWith("apprentice")) {
    return styles.apprenticeBadge;
  }
  if (normalizedName.startsWith("guru")) {
    return styles.guruBadge;
  }

  switch (normalizedName) {
    case "master":
      return styles.masterBadge;
    case "enlightened":
      return styles.enlightenedBadge;
    case "burned":
      return styles.burnedBadge;
    default:
      return styles.apprenticeBadge;
  }
}

const createStyles = (subjectColors: SubjectColors) =>
  StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  embeddedWrapper: {
    minHeight: 0,
  },
  pagerContainer: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: "#f6f6f6",
  },
  embeddedContainer: {},
  contentContainer: {
    paddingBottom: 24,
  },
  embeddedContentContainer: {
    paddingBottom: 0,
  },
  stickyHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    shadowColor: "rgba(0,0,0,0.3)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 3,
    zIndex: 100,
  },
  stickyBackButton: {
    padding: 8,
    marginRight: 8,
  },
  stickyContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  stickyCharacterBox: {
    width: 44,
    height: 44,
    backgroundColor: "white",
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    paddingHorizontal: 4,
  },
  stickyCharacter: {
    fontSize: 24,
    color: subjectColors.vocabulary,
    fontWeight: "bold",
    fontFamily: "SourceHanSansJP-Bold",
    textAlign: "center",
  },
  stickyTextContainer: {
    flex: 1,
    justifyContent: "center",
  },
  stickyMeaning: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
    marginBottom: 2,
  },
  stickyReading: {
    fontSize: 14,
    color: "white",
    opacity: 0.9,
  },
  stickyLevelBadge: {
    backgroundColor: "rgba(0,0,0,0.2)",
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  stickyLevelText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 14,
  },
  overscrollBackground: {
    position: "absolute",
    top: -1000, // Extend well above the visible area
    left: 0,
    right: 0,
    height: 1000, // Arbitrary large height
    backgroundColor: subjectColors.vocabulary,
  },
  header: {
    backgroundColor: subjectColors.vocabulary,
    padding: 16,
    alignItems: "center",
    paddingTop: HEADER_TOP_OFFSET, // Extra padding for status bar
    position: "relative",
  },
  backButton: {
    position: "absolute",
    top: HEADER_TOP_OFFSET,
    left: 20,
    width: BACK_BUTTON_SIZE,
    height: BACK_BUTTON_SIZE,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  addToListButton: {
    position: "absolute",
    top: HEADER_TOP_OFFSET,
    right: 56,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  levelBadge: {
    backgroundColor: "rgba(0,0,0,0.2)",
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    top: HEADER_TOP_OFFSET,
    right: 16,
  },
  levelText: {
    color: "white",
    fontWeight: "bold",
  },
  characterContainer: {
    width: 80,
    height: 80,
    backgroundColor: "white",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    shadowColor: "rgba(0,0,0,0.3)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 3,
    paddingHorizontal: 8,
    marginHorizontal: 16, // Add horizontal margin to prevent overflow on small screens
  },
  character: {
    fontSize: 40,
    color: subjectColors.vocabulary,
    fontWeight: "bold",
    textAlign: "center",
    fontFamily: "SourceHanSansJP-Bold",
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
    marginBottom: 4,
    textAlign: "center",
  },
  mainReading: {
    fontSize: 18,
    color: "white",
    opacity: 0.9,
    marginBottom: 8,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "white",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    overflow: "hidden",
    shadowColor: "rgba(0,0,0,0.1)",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.8,
    shadowRadius: 1,
    elevation: 1,
  },
  embeddedTabContainer: {
    marginTop: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  activeTab: {
    backgroundColor: subjectColors.vocabulary,
  },
  tabText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },
  activeTabText: {
    color: "white",
  },
  section: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  infoBox: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 16,
    shadowColor: "rgba(0,0,0,0.1)",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.8,
    shadowRadius: 1,
    // Use border on Android instead of elevation to avoid jarring shadow during tab animations
    ...Platform.select({
      ios: { elevation: 1 },
      android: { borderWidth: 1, borderColor: "rgba(0,0,0,0.06)" },
    }),
  },
  row: {
    flexDirection: "row",
    marginBottom: 8,
    alignItems: "center",
  },
  label: {
    width: 100,
    fontSize: 14,
    color: "#666",
  },
  value: {
    flex: 1,
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  mnemonicContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  mnemonicText: {
    fontSize: 16,
    lineHeight: 24,
    color: "#333",
  },
  mnemonicTextContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  emText: {
    fontStyle: "italic",
    fontSize: 16,
    lineHeight: 24,
    color: "#333",
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
  hintText: {
    fontSize: 16,
    color: "#333",
    lineHeight: 24,
  },
  noteText: {
    fontSize: 16,
    color: "#999",
    fontStyle: "italic",
  },
  patternSelectorHint: {
    fontSize: 13,
    marginBottom: 10,
  },
  patternPillsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  patternPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  patternPillText: {
    fontSize: 13,
    fontWeight: "600",
  },
  patternExamplesCard: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    backgroundColor: "rgba(127,127,127,0.05)",
  },
  patternExamplesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  patternExamplesTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
  },
  patternExampleRow: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  sentenceContainer: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  sentenceRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  japaneseSentence: {
    fontSize: 18,
    color: "#333",
    marginBottom: 4,
    lineHeight: 28,
    fontFamily: "SourceHanSansJP-Regular",
  },
  englishSentence: {
    fontSize: 14,
    color: "#666",
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
    ...StyleSheet.absoluteFill,
  },
  translationRevealHint: {
    ...StyleSheet.absoluteFill,
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
  readingRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 16,
  },
  readingBadge: {
    backgroundColor: "#f5f5f5",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    margin: 4,
  },
  primaryReadingBadge: {
    backgroundColor: subjectColors.vocabulary,
  },
  readingBadgeText: {
    color: "#666",
    fontSize: 16,
    fontFamily: "SourceHanSansJP-Regular",
    // Android-specific: remove extra font padding for proper chip height
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  primaryReadingBadgeText: {
    color: "white",
    fontWeight: "bold",
    fontFamily: "SourceHanSansJP-Bold",
    // Android-specific: remove extra font padding for proper chip height
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  audioContainer: {
    marginTop: 8,
  },
  audioTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  audioButtonsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
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
  similarVocabularyGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    alignItems: "flex-start",
  },
  similarVocabularyCard: {
    backgroundColor: subjectColors.vocabulary,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    paddingHorizontal: 4,
    minWidth: 80,
    flexShrink: 0,
    position: "relative",
  },
  similarVocabularyCharacter: {
    fontSize: 20,
    color: "white",
    fontWeight: "bold",
    fontFamily: "SourceHanSansJP-Bold",
  },
  similarVocabularyMeaning: {
    fontSize: 12,
    color: "white",
    textAlign: "center",
    lineHeight: 14,
    fontWeight: "500",
    marginTop: 4,
    paddingHorizontal: 6,
  },
  componentGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },
  componentItem: {
    backgroundColor: subjectColors.kanji, // Use kanji color for individual kanji components
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    paddingHorizontal: 4,
    flexShrink: 0,
    position: "relative",
  },
  componentCharacter: {
    fontSize: 22,
    color: "white",
    fontWeight: "bold",
    fontFamily: "SourceHanSansJP-Bold",
  },
  componentMeaning: {
    fontSize: 12,
    color: "white",
    textAlign: "center",
    lineHeight: 14,
    fontWeight: "500",
    marginTop: 4,
    paddingHorizontal: 4,
  },
  progressionContainer: {
    alignItems: "center",
  },
  srsContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  srsBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  apprenticeBadge: {
    backgroundColor: SRS_COLORS.apprentice.hex,
  },
  guruBadge: {
    backgroundColor: SRS_COLORS.guru.hex,
  },
  masterBadge: {
    backgroundColor: SRS_COLORS.master.hex,
  },
  enlightenedBadge: {
    backgroundColor: SRS_COLORS.enlightened.hex,
  },
  burnedBadge: {
    backgroundColor: SRS_COLORS.burned.hex,
  },
  srsName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  streakContainer: {
    flexDirection: "row",
    marginBottom: 16,
    width: "100%",
    justifyContent: "space-around",
  },
  streakItem: {
    alignItems: "center",
  },
  streakLabel: {
    fontSize: 14,
    color: "#666",
  },
  streakValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  progressBar: {
    height: 8,
    backgroundColor: "#f0f0f0",
    borderRadius: 4,
    width: "100%",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#43aa8b",
    borderRadius: 4,
  },
  noteBox: {
    paddingVertical: 8,
  },
  noteContainer: {
    paddingVertical: 4,
  },
  noteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  editButton: {
    padding: 4,
  },
  noteContent: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
  },
  separator: {
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    marginTop: 8,
    paddingTop: 8,
  },
  statsContainer: {
    flexDirection: "row",
    width: "100%",
    marginBottom: 16,
    marginTop: 8,
  },
  statColumn: {
    flex: 1,
    alignItems: "center",
  },
  statTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  correctnessRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 8,
  },
  correctness: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 8,
  },
  correctnessText: {
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 4,
    color: "#333",
  },
  statDivider: {
    width: 1,
    backgroundColor: "#f0f0f0",
  },
  percentageIndicator: {
    marginTop: 4,
  },
  percentageText: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  nextReviewContainer: {
    marginTop: 4,
  },
  nextReviewText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  showMoreButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  showMoreText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
    marginRight: 4,
  },
  sentencePlayButton: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: withAlpha(subjectColors.vocabulary, 0.1),
    marginLeft: 8,
  },
  sentencePlayButtonActive: {
    backgroundColor: subjectColors.vocabulary,
    borderRadius: 16,
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
  // Media Sentences Styles
  mediaSentenceContainer: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  mediaSentenceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  mediaSourceInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginRight: 8,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
    marginBottom: 4,
  },
  categoryBadgeText: {
    color: "white",
    fontSize: 11,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  sourceName: {
    fontSize: 13,
    fontWeight: "500",
    color: "#666",
    flex: 1,
    marginBottom: 4,
    textTransform: "capitalize",
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
  mediaPlayButtonDisabled: {
    backgroundColor: withAlpha(subjectColors.vocabulary, 0.35),
  },
  mediaContentRow: {
    flexDirection: "row",
    gap: 12,
  },
  mediaImageLeft: {
    width: 120,
    height: 90,
    borderRadius: 6,
    backgroundColor: "#f0f0f0",
    flexShrink: 0,
  },
  mediaTextContent: {
    flex: 1,
    gap: 8,
  },
  mediaSentenceText: {
    fontSize: 16,
    color: "#333",
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
    color: "#666",
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
    color: "#999",
    fontFamily: "SourceHanSansJP-Regular",
  },
  rubyBase: {
    fontSize: 14,
    lineHeight: 18,
    color: "#333",
    fontFamily: "SourceHanSansJP-Regular",
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
  loadingContainer: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    paddingVertical: 8,
  },
  notStartedContainer: {
    alignItems: "center",
    paddingVertical: 16,
  },
  lockedBadge: {
    backgroundColor: "#ccc",
  },
  notStartedText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  divider: {
    width: "100%",
    height: 1,
    marginVertical: 16,
  },
  itemLevelBadge: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: subjectColors.kanji,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "white",
    shadowColor: "rgba(0,0,0,0.5)",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 5,
  },
  itemLevelBadgeSimilarVocabulary: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: subjectColors.vocabulary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "white",
    shadowColor: "rgba(0,0,0,0.5)",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 5,
  },
  itemLevelBadgeText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "center",
    lineHeight: 14,
  },
  synonymsValueContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  manageSynonymsButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  manageSynonymsText: {
    fontSize: 13,
    fontWeight: "500",
  },
});
