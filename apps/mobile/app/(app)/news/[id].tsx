import { Ionicons } from "@expo/vector-icons";
import { Audio, type AudioSound } from "@/src/utils/expoAvCompat";
import { useFocusEffect } from "@react-navigation/native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, {
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  type LayoutChangeEvent,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  type StyleProp,
  type TextStyle,
  Pressable,
  TouchableOpacity,
  TouchableWithoutFeedback,
  UIManager,
  useWindowDimensions,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { GlassButton } from "../../../src/components/GlassButton";
import { NewsAudioPlayer } from "../../../src/components/news/NewsAudioPlayer";
import {
  NhkEasyItem,
  NhkEasyService,
} from "../../../src/services/NhkEasyService";
import { TranslationCacheService } from "../../../src/services/TranslationCacheService";
import AudioSessionManager from "../../../src/modules/AudioSessionManager";
import { azureTranslatorService } from "../../../src/utils/azureTranslator";
import { getAllSubjects } from "../../../src/utils/cache";
import { fontStyles } from "../../../src/utils/fonts";
import { useSubjectColors, withAlpha } from "../../../src/utils/subjectColors";
import {
  type StudyModePreference,
  useAuthStore,
  useSettingsStore,
} from "../../../src/utils/store";
import { useTheme } from "../../../src/utils/theme";
import { getStoredJpdbApiKey } from "../../../src/utils/jpdbApi";
import {
  InterruptionModeAndroid,
  InterruptionModeIOS,
} from "../../../src/utils/expoAvCompat";
import {
  findVocabularyMatchesWithJpdbFirstPass as findMatches,
  getHighlightSegments,
  getItemColor,
  getVerbInflectionLabelsForMatch,
  isWaniKaniBackedMatch,
  JpdbParsedTokenAnnotation,
  KanjiMatch,
  VocabularyMatch,
} from "../../../src/utils/textHighlighting";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SwiftUI = Platform.OS === "ios" ? require("@expo/ui/swift-ui") : null;

const HEADER_HEIGHT = 110;
const GRAMMAR_TOOLTIP_ID_MIN = -9000000;
const JPDB_FALLBACK_TOOLTIP_ID_MIN = -8000000;
const TOKEN_UNDERLINE_SEPARATOR = "\u200A";

function buildGrammarTooltipItem(token: JpdbParsedTokenAnnotation): VocabularyMatch {
  const meaningText = token.meaning?.trim() || "Grammar point";
  const partsOfSpeechSummary = token.partsOfSpeech.filter(Boolean).join(", ");
  const details = partsOfSpeechSummary
    ? `${meaningText}\nPart of Speech: ${partsOfSpeechSummary}`
    : meaningText;

  return {
    id: -9000000 - token.start * 1000 - token.end,
    characters: token.surface || token.spelling || token.reading || "Grammar",
    meaning: details,
    type: "vocabulary",
    level: 0,
    readings: token.reading
      ? [{ reading: token.reading, primary: true }]
      : undefined,
    isWaniKaniSubject: false,
    disableConjugationExpansion: true,
  };
}

function inferFallbackVerbConjugationKind(
  partsOfSpeech: string[]
): VocabularyMatch["verbConjugationKind"] {
  if (partsOfSpeech.some((partOfSpeech) => partOfSpeech.startsWith("vs"))) {
    return "suru";
  }
  if (partsOfSpeech.some((partOfSpeech) => partOfSpeech === "vk")) {
    return "kuru";
  }
  if (partsOfSpeech.some((partOfSpeech) => partOfSpeech.startsWith("v1"))) {
    return "ichidan";
  }
  if (partsOfSpeech.some((partOfSpeech) => partOfSpeech.startsWith("v5"))) {
    return "godan";
  }
  return undefined;
}

function buildJpdbFallbackTooltipItem(
  token: JpdbParsedTokenAnnotation,
  tokenType: "verb" | "vocabulary"
): VocabularyMatch {
  const meaningText = token.meaning?.trim() || "Detected by JPDB parser.";
  const partsOfSpeechSummary = token.partsOfSpeech.filter(Boolean).join(", ");
  const details = partsOfSpeechSummary
    ? `${meaningText}\nPart of Speech: ${partsOfSpeechSummary}`
    : meaningText;
  const displayText = token.spelling || token.surface || token.reading || "Vocabulary";
  const hasKanji = /[\u3400-\u9FFF々]/.test(displayText);
  const matchCandidates = Array.from(
    new Set([token.surface, token.spelling, token.reading].filter(Boolean))
  ).sort((a, b) => b.length - a.length);

  return {
    id: JPDB_FALLBACK_TOOLTIP_ID_MIN - token.start * 1000 - token.end,
    characters: displayText,
    meaning: details,
    type: hasKanji ? "vocabulary" : "kana_vocabulary",
    level: 0,
    readings: token.reading
      ? [{ reading: token.reading, primary: true }]
      : undefined,
    verbConjugationKind:
      tokenType === "verb"
        ? inferFallbackVerbConjugationKind(token.partsOfSpeech)
        : undefined,
    matchCandidates: matchCandidates.length > 0 ? matchCandidates : undefined,
    isWaniKaniSubject: false,
    disableConjugationExpansion: true,
  };
}


type ContentBlock = {
  type: "text" | "image";
  content: string;
  translation?: string;
  isTranslating?: boolean;
};

export default function NewsDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<NhkEasyItem | undefined>(undefined);
  const { theme } = useTheme();
  const subjectColors = useSubjectColors();
  const { userData } = useAuthStore();
  const {
    hideVocabularyTooltipMeanings,
    hideVocabularyTooltipReadings,
    newsDefaultStudyMode,
  } = useSettingsStore();
  const userLevel = userData?.level || 0;
  const soundRef = useRef<AudioSound | null>(null);
  const audioPlaybackRequestIdRef = useRef(0);
  const isScreenActiveRef = useRef(true);
  const hasUserSelectedStudyModeRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [showFurigana, setShowFurigana] = useState(true);
  const [studyMode, setStudyMode] = useState<StudyModePreference>(
    newsDefaultStudyMode
  );
  const [hasStoredJpdbApiKey, setHasStoredJpdbApiKey] = useState(false);
  const [hasResolvedJpdbKeyState, setHasResolvedJpdbKeyState] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [isWebViewLoaded, setIsWebViewLoaded] = useState(false);
  const router = useRouter();
  const { fontScale } = useWindowDimensions();

  const headerHeight = HEADER_HEIGHT;
  const accessibleFontScale = Math.max(0.85, Math.min(fontScale, 2.2));

  // Audio Player State
  const [durationMillis, setDurationMillis] = useState(0);
  const [positionMillis, setPositionMillis] = useState(0);
  const [isPlayerVisible, setIsPlayerVisible] = useState(false);

  // Highlight state
  const [vocabularyMatches, setVocabularyMatches] = useState<VocabularyMatch[]>(
    []
  );
  const [kanjiMatches, setKanjiMatches] = useState<KanjiMatch[]>([]);
  const [jpdbParsedTokens, setJpdbParsedTokens] = useState<JpdbParsedTokenAnnotation[]>(
    []
  );
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([]);
  const [imageAspectRatios, setImageAspectRatios] = useState<
    Record<string, number>
  >({});

  // Tooltip state
  const [selectedItem, setSelectedItem] = useState<
    (VocabularyMatch | KanjiMatch) | null
  >(null);
  const [selectedSurfaceText, setSelectedSurfaceText] = useState<string | null>(
    null
  );
  const [selectedTokenKey, setSelectedTokenKey] = useState<string | null>(null);
  const [isTooltipMeaningRevealed, setIsTooltipMeaningRevealed] =
    useState(false);
  const [isTooltipReadingRevealed, setIsTooltipReadingRevealed] =
    useState(false);
  const [tooltipInteractionMode, setTooltipInteractionMode] = useState<
    "press" | "hover" | null
  >(null);
  const [tooltipPosition, setTooltipPosition] = useState<{
    x: number;
    y: number;
    width: number;
  } | null>(null);
  const tooltipAnchorRef = useRef<{
    adjustedY: number;
    anchorHeight: number;
    screenHeight: number;
  } | null>(null);
  const tooltipMeasuredHeightRef = useRef(200);
  const tooltipOpacity = useRef(new Animated.Value(0)).current;
  const vocabularyMatchesById = useMemo(
    () => new Map(vocabularyMatches.map((match) => [match.id, match])),
    [vocabularyMatches]
  );
  const textBlockOffsets = useMemo(() => {
    let cursor = 0;
    return contentBlocks.map((block) => {
      if (block.type !== "text") {
        return null;
      }
      const start = cursor;
      cursor += block.content.length + 1;
      return start;
    });
  }, [contentBlocks]);
  const grammarUnderlineColor = theme.isDark ? "#fbbf24" : "#b45309";
  const verbUnderlineColor = theme.isDark ? "#34d399" : "#0f766e";
  const vocabUnderlineColor = theme.isDark ? "#60a5fa" : "#1d4ed8";
  const hoverPreviewEnabled =
    Platform.OS === "ios" ||
    Platform.OS === "web" ||
    (Platform.OS as string) === "macos";
  const fullModeEnabled = studyMode === "full" && hasStoredJpdbApiKey;
  const wkModeEnabled = studyMode === "wk";

  // Animation values
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    setIsTooltipMeaningRevealed(false);
    setIsTooltipReadingRevealed(false);
  }, [selectedItem?.id, selectedItem?.characters, selectedSurfaceText]);

  useEffect(() => {
    if (id) {
      const found = NhkEasyService.getItemById(id);
      setItem(found);
    }
  }, [id]);

  useEffect(() => {
    if (hasUserSelectedStudyModeRef.current) {
      return;
    }
    setStudyMode(newsDefaultStudyMode);
  }, [newsDefaultStudyMode]);

  const refreshJpdbKeyState = useCallback(async () => {
    try {
      const storedKey = await getStoredJpdbApiKey();
      setHasStoredJpdbApiKey(Boolean(storedKey));
    } catch {
      setHasStoredJpdbApiKey(false);
    } finally {
      setHasResolvedJpdbKeyState(true);
    }
  }, []);

  useEffect(() => {
    void refreshJpdbKeyState();
  }, [refreshJpdbKeyState]);

  useFocusEffect(
    useCallback(() => {
      void refreshJpdbKeyState();
    }, [refreshJpdbKeyState])
  );

  useEffect(() => {
    if (!hasResolvedJpdbKeyState) {
      return;
    }

    if (studyMode === "full" && !hasStoredJpdbApiKey) {
      setStudyMode("none");
    }
  }, [studyMode, hasStoredJpdbApiKey, hasResolvedJpdbKeyState]);

  const cleanupSound = useCallback(async () => {
    const currentSound = soundRef.current;
    if (!currentSound) {
      return;
    }

    soundRef.current = null;

    try {
      currentSound.setOnPlaybackStatusUpdate(null);
      try {
        await currentSound.stopAsync();
      } catch {
        // Ignore stop errors for sounds that are already stopped.
      }
      await currentSound.unloadAsync();
    } catch {
      // Ignore unload errors during cleanup.
    }
  }, []);

  useEffect(() => {
    return () => {
      audioPlaybackRequestIdRef.current += 1;
      isScreenActiveRef.current = false;
      void cleanupSound();
    };
  }, [cleanupSound]);

  useFocusEffect(
    useCallback(() => {
      isScreenActiveRef.current = true;

      return () => {
        isScreenActiveRef.current = false;
        audioPlaybackRequestIdRef.current += 1;
        setIsPlaying(false);
        setIsAudioLoading(false);
        setIsPlayerVisible(false);
        setPositionMillis(0);
        setDurationMillis(0);
        void cleanupSound();
      };
    }, [cleanupSound])
  );

  useEffect(() => {
    const configureAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          allowsRecordingIOS: false,
          interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
          interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
          staysActiveInBackground: false,
        });
      } catch (error) {
        console.warn("[News] Failed to configure audio mode:", error);
      }
    };

    void configureAudio();
  }, []);

  // Parse Content for Highlights
  useEffect(() => {
    if (
      item &&
      (studyMode !== "none" || showTranslation) &&
      contentBlocks.length === 0
    ) {
      parseContent(item);
    }
  }, [item, studyMode, showTranslation]);

  // Trigger translation when enabled
  useEffect(() => {
    if (showTranslation && contentBlocks.length > 0) {
      translateContent();
    }
  }, [showTranslation, contentBlocks.length]);

  // Resolve remote image dimensions so native mode matches WebView's
  // `max-width: 100%; height: auto;` behavior.
  useEffect(() => {
    const imageUrls = contentBlocks
      .filter((block): block is ContentBlock & { type: "image" } => block.type === "image")
      .map((block) => block.content)
      .filter(Boolean);

    if (imageUrls.length === 0) {
      return;
    }

    let isCancelled = false;

    imageUrls.forEach((url) => {
      if (imageAspectRatios[url]) {
        return;
      }

      Image.getSize(
        url,
        (width, height) => {
          if (isCancelled || width <= 0 || height <= 0) {
            return;
          }

          const aspectRatio = width / height;
          if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) {
            return;
          }

          setImageAspectRatios((previous) => {
            if (previous[url]) {
              return previous;
            }
            return { ...previous, [url]: aspectRatio };
          });
        },
        () => {
          // Keep fallback height when image dimensions can't be resolved.
        }
      );
    });

    return () => {
      isCancelled = true;
    };
  }, [contentBlocks, imageAspectRatios]);

  // Computed: Study modes render in native mode. No study mode keeps WebView.
  // Translation can work in both rendering paths.
  const isNativeMode = studyMode !== "none";

  // Inject Translations into WebView
  useEffect(() => {
    if (!isNativeMode && isWebViewLoaded && webViewRef.current) {
      if (!showTranslation) {
        webViewRef.current.injectJavaScript(`
                document.querySelectorAll('.nhk-translation').forEach(el => el.remove());
                true;
             `);
        return;
      }

      const textBlocks = contentBlocks.filter((b) => b.type === "text");
      const translationsPayload = textBlocks.map((b) => ({
        text: b.translation || "",
        isTranslating: b.isTranslating || false,
      }));

      const payload = JSON.stringify(translationsPayload);

      const script = `
            (function() {
                const data = ${payload};
                // Assumption: textBlocks[0] is Title (H1), textBlocks[1..N] are <P> tags
                // This aligns with parseContent logic
                
                const h1 = document.querySelector('h1');
                const ps = document.querySelectorAll('p');
                const targets = [h1, ...Array.from(ps)];
                
                data.forEach((item, i) => {
                    const target = targets[i];
                    if (!target) return;
                    
                    const nextNode = target.nextElementSibling;
                    const exists = nextNode && nextNode.classList.contains('nhk-translation');
                    const text = item.text;
                    const isTranslating = item.isTranslating;

                    const content = text || (isTranslating ? 'Translating...' : '');
                    
                    if (content) {
                        if (exists) {
                            if (nextNode.textContent !== content) {
                                nextNode.textContent = content;
                                if (isTranslating) {
                                    nextNode.classList.add('loading');
                                } else {
                                    nextNode.classList.remove('loading');
                                }
                            }
                        } else {
                            const div = document.createElement('div');
                            div.className = 'nhk-translation' + (isTranslating ? ' loading' : '');
                            div.textContent = content;
                            target.insertAdjacentElement('afterend', div);
                        }
                    } else if (exists && !isTranslating) {
                         // Remove empty translation placeholders if not translating
                         // nextNode.remove();
                    }
                });
            })();
            true;
        `;

      webViewRef.current.injectJavaScript(script);
    }
  }, [contentBlocks, showTranslation, isNativeMode, isWebViewLoaded]);

  // Inject Padding for MiniPlayer
  useEffect(() => {
    if (!isNativeMode && isWebViewLoaded && webViewRef.current) {
      // Player height is roughly 140-160 (collapsed/floating) plus margin.
      // Floating player bottom: 30, height approx 80-100.
      // Let's reserve 160px.
      const padding = isPlayerVisible ? "200px" : "100px";
      webViewRef.current.injectJavaScript(`
            document.body.style.paddingBottom = '${padding}';
            true;
        `);
    }
  }, [isPlayerVisible, isNativeMode, isWebViewLoaded]);

  const parseContent = async (item: NhkEasyItem) => {
    // 1. Parse Blocks for Rendering
    // Simple regex parser to find <p>...</p> and <img src="..." />
    // Since native regex parsing of HTML is fragile, we assume NHK format is consistent
    // <p>Content</p> or <img src="..." />

    const blocks: ContentBlock[] = [];

    // Add Title as first block
    blocks.push({ type: "text", content: item.title });

    // Split by paragraph or image tags
    // This is a naive split, but NHK Easy usually wraps text in <p>
    // We want to capture <p> content and <img src>

    const bodyHtml = item.contentHtml;

    // Regex to match <p>(.*?)</p> OR <img[^>]+src="([^">]+)"[^>]*>
    const regex = /<p[^>]*>(.*?)<\/p>|<img[^>]+src="([^">]+)"[^>]*>/g;

    let match;
    while ((match = regex.exec(bodyHtml)) !== null) {
      if (match[1]) {
        // matched <p> content: match[1]
        // Strip internal tags like <ruby>, <rt>, <a>, <span>
        // Be careful with <rt>: we want to REMOVE highlighting logic needs plain kanji
        // content: <ruby>Kanji<rt>reading</rt></ruby> -> Kanji

        let textContent = match[1];
        // Remove rt tags content first
        textContent = textContent.replace(/<rt[^>]*>[\s\S]*?<\/rt>/g, "");
        textContent = textContent.replace(/<rp[^>]*>[\s\S]*?<\/rp>/g, "");
        // Remove remaining tags
        textContent = textContent.replace(/<[^>]+>/g, "");
        // Decode HTML entities if needed (simple check)
        textContent = textContent
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">");

        if (textContent.trim()) {
          blocks.push({ type: "text", content: textContent });
        }
      } else if (match[2]) {
        // matched img src: match[2]
        blocks.push({ type: "image", content: match[2] });
      }
    }

    setContentBlocks(blocks);

    // 2. Build matching text from rendered text blocks so JPDB offsets
    // align with what users see in native mode.
    const textForMatching = blocks
      .filter((block): block is ContentBlock & { type: "text" } => block.type === "text")
      .map((block) => block.content)
      .join("\n");

    if (textForMatching.trim().length > 0) {
      findVocabularyMatches(textForMatching);
    } else {
      setVocabularyMatches([]);
      setKanjiMatches([]);
      setJpdbParsedTokens([]);
    }
  };

  const translateContent = async () => {
    if (!item?.guid) return;

    // 1. Check Cache first
    // We only check cache if we haven't already translated (simple optimization)
    // Or we can check if *any* text block is missing translation
    const textBlocks = contentBlocks.filter((b) => b.type === "text");
    const hasTranslation = textBlocks.every((b) => !!b.translation);

    if (hasTranslation) return;

    // Mark all as translating initially to show spinner/loading state immediately
    setContentBlocks((prev) =>
      prev.map((b) =>
        b.type === "text" && !b.translation ? { ...b, isTranslating: true } : b
      )
    );

    try {
      const cachedTranslations =
        await TranslationCacheService.getCachedTranslation(item.guid);

      if (
        cachedTranslations &&
        cachedTranslations.length === textBlocks.length
      ) {
        // Apply cached translations
        setContentBlocks((prev) => {
          let textIndex = 0;
          return prev.map((b) => {
            if (b.type === "text") {
              const translation = cachedTranslations[textIndex];
              textIndex++;
              return { ...b, translation, isTranslating: false };
            }
            return b;
          });
        });
        return;
      }
    } catch (e) {
      console.log("Cache check failed, proceeding to Azure", e);
    }

    // 2. If no cache, proceed with Azure (existing logic)
    // Create a copy of blocks to avoid direct mutation/frequent rerenders
    // We will iterate and update blocks

    const blocksToTranslate = contentBlocks.map((block, index) => ({
      ...block,
      index,
    }));

    // Filter out blocks that are already translated or translating, or not text
    const candidates = blocksToTranslate.filter(
      (b) => b.type === "text" && !b.translation
      // Note: we already marked them as isTranslating above, so we might need to adjust logic
      // But actually, we want to re-select them for Azure processing
      // If we marked them as isTranslating, they are "in progress".
      // We should select based on index from the fresh state or just use the local matching.
      // Let's refine: filtering based on !b.translation is safer.
    );

    // Filter candidates (text blocks without translation)
    // We need to know which "text block index" they are to save correctly later?
    // Actually, after we get ALL translations, we should save them.

    // We need to translate ALL text blocks to save a complete cache record?
    // Or we save what we have? The schema implies a complete array.
    // So we should try to ensure we have a full set.

    // Let's proceed with parallel translation of candidates.

    if (candidates.length === 0) return;

    // We already marked translating above.

    const newTranslationsMap = new Map<number, string>();

    await Promise.all(
      candidates.map(async (candidate) => {
        try {
          // Double check if we already marked it translating in state,
          // here we definitely want to call Azure.
          const translated = await azureTranslatorService.translate(
            candidate.content
          );
          newTranslationsMap.set(candidate.index, translated);

          setContentBlocks((prev) =>
            prev.map((b, i) => {
              if (i === candidate.index) {
                return { ...b, translation: translated, isTranslating: false };
              }
              return b;
            })
          );
        } catch (error) {
          console.error(`Error translating block ${candidate.index}:`, error);
          setContentBlocks((prev) =>
            prev.map((b, i) => {
              if (i === candidate.index) {
                return { ...b, isTranslating: false }; // Failed, stop spinner
              }
              return b;
            })
          );
        }
      })
    );

    // 3. Save to Cache
    // We need to gather ALL translations (existing + new) to save the full array.
    // We can't easily get the *updated* state inside this closure synchronously after Promise.all
    // unless we trust our `newTranslationsMap` + `contentBlocks` (current closure state).

    // Better way: use the functional update of setContentBlocks to derive the final state and save?
    // Side effects in setState is bad.

    // Let's re-construct the full list of translations.
    // We have `contentBlocks` (initial) + `newTranslationsMap`.
    const finalTranslations: string[] = [];
    let complete = true;

    contentBlocks.forEach((b, i) => {
      if (b.type === "text") {
        const newlyTranslated = newTranslationsMap.get(i);
        const existing = b.translation;
        const val = newlyTranslated || existing;
        if (val) {
          finalTranslations.push(val);
        } else {
          complete = false;
        }
      }
    });

    if (complete && finalTranslations.length > 0) {
      // Save to Supabase
      await TranslationCacheService.saveTranslation(
        item.guid,
        finalTranslations
      );
    }
  };

  const findVocabularyMatches = async (text: string) => {
    try {
      const allSubjects = await getAllSubjects();

      const {
        vocabularyMatches,
        kanjiMatches,
        jpdbParsedTokens: parsedTokens,
      } = await findMatches(
        text,
        allSubjects
      );

      setVocabularyMatches(vocabularyMatches);
      setKanjiMatches(kanjiMatches);
      setJpdbParsedTokens(Array.isArray(parsedTokens) ? parsedTokens : []);
    } catch (err) {
      console.error("Error finding vocabulary matches:", err);
      setJpdbParsedTokens([]);
    }
  };

  const toggleAudio = async () => {
    if (!item?.audioUrl) return;
    if (!isScreenActiveRef.current) return;

    const requestId = ++audioPlaybackRequestIdRef.current;

    // Show player
    setIsPlayerVisible(true);

    try {
      const currentSound = soundRef.current;
      if (currentSound) {
        if (isPlaying) {
          await currentSound.pauseAsync();
          setIsPlaying(false);
        } else {
          setIsAudioLoading(true);
          await currentSound.playAsync();
          setIsAudioLoading(false);
          setIsPlaying(true);
        }
      } else {
        setIsAudioLoading(true);

        if (Platform.OS === "ios") {
          try {
            await AudioSessionManager.overrideSpeaker();
          } catch (error) {
            console.warn("[News] Failed to configure iOS audio session:", error);
          }
        }

        const onPlaybackStatusUpdate = (status: any) => {
          if (!status?.isLoaded) {
            return;
          }

          setDurationMillis(status.durationMillis || 0);
          setPositionMillis(status.positionMillis);
          setIsPlaying(status.isPlaying);

          if (status.didJustFinish) {
            setIsPlaying(false);
            setPositionMillis(0);
            const activeSound = soundRef.current;
            if (activeSound) {
              void activeSound.setPositionAsync(0);
            }
          }
        };

        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: item.audioUrl },
          { shouldPlay: true, volume: 1.0 },
          onPlaybackStatusUpdate
        );

        if (
          requestId !== audioPlaybackRequestIdRef.current ||
          !isScreenActiveRef.current
        ) {
          newSound.setOnPlaybackStatusUpdate(null);
          await newSound.unloadAsync();
          return;
        }

        soundRef.current = newSound;
        setIsAudioLoading(false);
        setIsPlaying(true);
      }
    } catch (error) {
      if (
        requestId !== audioPlaybackRequestIdRef.current ||
        !isScreenActiveRef.current
      ) {
        return;
      }
      console.error("Error toggling audio:", error);
      setIsAudioLoading(false);
    }
  };

  const onSeek = async (value: number) => {
    const currentSound = soundRef.current;
    if (currentSound) {
      setPositionMillis(value);
      await currentSound.setPositionAsync(value);
    }
  };

  const onForward = async () => {
    const currentSound = soundRef.current;
    if (currentSound) {
      const newPos = positionMillis + 10000;
      await currentSound.setPositionAsync(Math.min(newPos, durationMillis));
    }
  };

  const onRewind = async () => {
    const currentSound = soundRef.current;
    if (currentSound) {
      const newPos = positionMillis - 10000;
      await currentSound.setPositionAsync(Math.max(0, newPos));
    }
  };

  const onClosePlayer = async () => {
    audioPlaybackRequestIdRef.current += 1;
    setIsPlaying(false);
    setIsAudioLoading(false);
    setIsPlayerVisible(false);
    setPositionMillis(0);
    setDurationMillis(0);
    await cleanupSound();
  };

  const toggleFurigana = () => {
    const newState = !showFurigana;
    setShowFurigana(newState);
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
            document.body.classList.toggle('hide-furigana', ${!newState});
            true;
        `);
    }
  };

  const openJpdbApiKeySettings = useCallback(() => {
    setShowSettingsMenu(false);
    router.push({
      pathname: "/settings",
      params: { scrollTo: "jpdbApiKey" },
    });
  }, [router]);

  const handleBlockedFullModeSelection = useCallback(() => {
    Alert.alert(
      "JPDB API Key Required",
      "Full grammar + vocabulary mode is blocked until you save a JPDB API key.",
      [
        { text: "Not now", style: "cancel" },
        {
          text: "Open Settings",
          onPress: openJpdbApiKeySettings,
        },
      ]
    );
  }, [openJpdbApiKeySettings]);

  const selectStudyMode = useCallback(
    (mode: StudyModePreference) => {
      if (mode === "full" && !hasStoredJpdbApiKey) {
        handleBlockedFullModeSelection();
        return;
      }
      hasUserSelectedStudyModeRef.current = true;
      setStudyMode(mode);
    },
    [handleBlockedFullModeSelection, hasStoredJpdbApiKey]
  );

  const toggleTranslation = () => {
    // Independent toggle for Translation
    setShowTranslation(!showTranslation);
  };

  const handleTooltipLayout = useCallback((event: LayoutChangeEvent) => {
    const anchor = tooltipAnchorRef.current;
    if (!anchor) {
      return;
    }

    const measuredHeight = Math.max(120, event.nativeEvent.layout.height);
    tooltipMeasuredHeightRef.current = measuredHeight;
    const tooltipMargin = 12;
    const { adjustedY, anchorHeight, screenHeight } = anchor;
    const spaceBelow = screenHeight - (adjustedY + anchorHeight);
    const spaceAbove = adjustedY;

    let top: number;
    if (spaceBelow >= measuredHeight || spaceBelow > spaceAbove) {
      top = adjustedY + anchorHeight + 8;
    } else {
      top = adjustedY - measuredHeight - 8;
    }

    const minTop = tooltipMargin;
    const maxTop = Math.max(minTop, screenHeight - measuredHeight - tooltipMargin);
    const clampedTop = Math.max(minTop, Math.min(top, maxTop));

    setTooltipPosition((previousPosition) => {
      if (!previousPosition) {
        return previousPosition;
      }
      if (Math.abs(previousPosition.y - clampedTop) < 1) {
        return previousPosition;
      }
      return {
        ...previousPosition,
        y: clampedTop,
      };
    });
  }, []);

  const handleVocabularyPress = useCallback(
    (
      itemId: number,
      surfaceText: string,
      event: any,
      itemOverride?: VocabularyMatch | KanjiMatch,
      tokenKey?: string,
      interactionMode: "press" | "hover" = "press"
    ) => {
      const item =
        itemOverride ??
        [...vocabularyMatches, ...kanjiMatches].find((m) => m.id === itemId);
      if (!item) {
        return;
      }

      const openTooltipAtAnchor = (
        x: number,
        y: number,
        width: number,
        height: number,
        source: "measure" | "page" = "measure"
      ) => {
        const statusBarOffset =
          source === "measure" && Platform.OS === "android"
            ? (StatusBar.currentHeight || 0)
            : 0;
        const adjustedY = y + statusBarOffset;
        const screenWidth = Dimensions.get("window").width;
        const screenHeight = Dimensions.get("window").height;
        const tooltipWidth = 280;
        const tooltipMargin = 12;
        const tooltipEstimatedHeight = tooltipMeasuredHeightRef.current;

        let left = x + width / 2 - tooltipWidth / 2;
        left = Math.max(16, Math.min(left, screenWidth - tooltipWidth - 16));

        tooltipAnchorRef.current = {
          adjustedY,
          anchorHeight: height,
          screenHeight,
        };
        const spaceBelow = screenHeight - (adjustedY + height);
        const spaceAbove = adjustedY;
        let top =
          spaceBelow >= tooltipEstimatedHeight || spaceBelow > spaceAbove
            ? adjustedY + height + 8
            : adjustedY - tooltipEstimatedHeight - 8;
        const minTop = tooltipMargin;
        const maxTop = Math.max(
          minTop,
          screenHeight - tooltipEstimatedHeight - tooltipMargin
        );
        top = Math.max(minTop, Math.min(top, maxTop));

        setTooltipPosition({ x: left, y: top, width });
        setSelectedItem(item);
        setSelectedSurfaceText(surfaceText);
        setSelectedTokenKey(tokenKey ?? null);
        setTooltipInteractionMode(interactionMode);

        tooltipOpacity.setValue(0);
        Animated.timing(tooltipOpacity, {
          toValue: 1,
          duration: interactionMode === "hover" ? 120 : 200,
          useNativeDriver: true,
        }).start();
      };

      const measureFromTarget = (x: number, y: number, width: number, height: number) => {
        if (
          Number.isFinite(x) &&
          Number.isFinite(y) &&
          Number.isFinite(width) &&
          Number.isFinite(height) &&
          width > 0 &&
          height > 0
        ) {
          openTooltipAtAnchor(x, y, width, height, "measure");
          return true;
        }
        return false;
      };

      const measurementTag =
        typeof event?.currentTarget === "number"
          ? event.currentTarget
          : typeof event?.target === "number"
            ? event.target
            : null;
      if (
        measurementTag !== null &&
        typeof UIManager.measureInWindow === "function"
      ) {
        UIManager.measureInWindow(
          measurementTag,
          (x: number, y: number, width: number, height: number) => {
            if (measureFromTarget(x, y, width, height)) {
              return;
            }

            const pageX = Number(event?.nativeEvent?.pageX);
            const pageY = Number(event?.nativeEvent?.pageY);
            if (
              Number.isFinite(pageX) &&
              Number.isFinite(pageY) &&
              pageX > 1 &&
              pageY > 1
            ) {
              openTooltipAtAnchor(pageX - 12, pageY - 12, 24, 24, "page");
            }
          }
        );
        return;
      }

      const measurementTarget = event?.target as
        | { measureInWindow?: (callback: (x: number, y: number, w: number, h: number) => void) => void }
        | undefined;
      if (
        measurementTarget &&
        typeof measurementTarget.measureInWindow === "function"
      ) {
        measurementTarget.measureInWindow((x, y, width, height) => {
          if (measureFromTarget(x, y, width, height)) {
            return;
          }

          const pageX = Number(event?.nativeEvent?.pageX);
          const pageY = Number(event?.nativeEvent?.pageY);
          if (
            Number.isFinite(pageX) &&
            Number.isFinite(pageY) &&
            pageX > 1 &&
            pageY > 1
          ) {
            openTooltipAtAnchor(pageX - 12, pageY - 12, 24, 24, "page");
          }
        });
        return;
      }

      const pageX = Number(event?.nativeEvent?.pageX);
      const pageY = Number(event?.nativeEvent?.pageY);
      if (
        Number.isFinite(pageX) &&
        Number.isFinite(pageY) &&
        pageX > 1 &&
        pageY > 1
      ) {
        openTooltipAtAnchor(pageX - 12, pageY - 12, 24, 24, "page");
      }
    },
    [vocabularyMatches, kanjiMatches, tooltipOpacity]
  );

  const handleCloseTooltip = useCallback(() => {
    tooltipOpacity.setValue(0);
    setSelectedItem(null);
    setSelectedSurfaceText(null);
    setSelectedTokenKey(null);
    setTooltipInteractionMode(null);
    setTooltipPosition(null);
    tooltipAnchorRef.current = null;
  }, [tooltipOpacity]);

  const handleHoverTokenLeave = useCallback(
    (tokenKey: string) => {
      if (tooltipInteractionMode !== "hover") {
        return;
      }
      if (selectedTokenKey !== tokenKey) {
        return;
      }
      handleCloseTooltip();
    },
    [tooltipInteractionMode, selectedTokenKey, handleCloseTooltip]
  );

  const handleViewDetails = useCallback(() => {
    if (selectedItem && isWaniKaniBackedMatch(selectedItem)) {
      handleCloseTooltip();
      router.push(`/subject/${selectedItem.id}`);
    }
  }, [selectedItem, router, handleCloseTooltip]);

  const handleOpenSubject = useCallback(
    (subjectId: number) => {
      handleCloseTooltip();
      router.push(`/subject/${subjectId}`);
    },
    [handleCloseTooltip, router]
  );

  const renderHighlightedText = (
    text: string,
    isTitle: boolean = false
  ): ReactElement => {
    if (!text)
      return (
        <Text
          style={[
            isTitle ? styles.nativeTitle : styles.nativeText,
            { color: theme.textColor },
          ]}
        >
          {text}
        </Text>
      );

    const allMatches = [...vocabularyMatches, ...kanjiMatches];
    const segments = getHighlightSegments(text, allMatches);

    return (
      <Text
        style={[
          isTitle ? styles.nativeTitle : styles.nativeText,
          { color: theme.textColor },
          !isTitle && fontStyles.japaneseText, // Add font style only if not title (title already has specific style or font)
        ]}
      >
        {segments.map((segment, index) => {
          if (!segment.match) {
            return (
              <Text
                key={`text-${index}`}
                style={!isTitle ? styles.nativeTextSegment : undefined}
              >
                {segment.text}
              </Text>
            );
          }

          const highlight = segment.match;
          const color = getItemColor(highlight.type);
          const isWaniKaniBacked = isWaniKaniBackedMatch(highlight);
          const shouldKnow = isWaniKaniBacked ? highlight.level <= userLevel : true;
          const showLevelBadge = !shouldKnow && isWaniKaniBacked;
          const showJpdbBadge = !isWaniKaniBacked;

          return (
            <TouchableOpacity
              key={`chip-${index}-${highlight.id}`}
              onPress={(e) => handleVocabularyPress(highlight.id, segment.text, e)}
              activeOpacity={0.7}
              style={[
                styles.inlineChipWrapper,
                (showLevelBadge || showJpdbBadge) && styles.inlineChipWrapperWithBadge,
              ]}
            >
              <View
                style={[
                  styles.inlineChip,
                  isTitle && styles.inlineChipTitle,
                  {
                    backgroundColor: color,
                    opacity: shouldKnow ? 1 : 0.7,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.inlineChipText,
                    isTitle && styles.inlineChipTextTitle,
                  ]}
                >
                  {segment.text}
                </Text>
                {showLevelBadge && (
                  <View
                    style={[styles.levelBadgeChip, { backgroundColor: color }]}
                  >
                    <Text style={styles.levelBadgeText}>{highlight.level}</Text>
                  </View>
                )}
                {showJpdbBadge && (
                  <View style={[styles.levelBadgeChip, styles.jpdbBadgeChip]}>
                    <Text style={styles.levelBadgeText}>JP</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </Text>
    );
  };

  const renderUnderlinedAnalyzedText = (
    text: string,
    blockStart: number,
    isTitle: boolean = false
  ): ReactElement => {
    if (!text) {
      return (
        <Text
          style={[
            isTitle ? styles.nativeTitle : styles.nativeText,
            { color: theme.textColor },
          ]}
        >
          {text}
        </Text>
      );
    }

    type ParsedInlineSegment = {
      text: string;
      tokenType: "plain" | "grammar" | "verb" | "vocabulary";
      token?: JpdbParsedTokenAnnotation;
    };

    const blockEnd = blockStart + text.length;
    const inlineSegments: ParsedInlineSegment[] = [];

    if (jpdbParsedTokens.length === 0) {
      inlineSegments.push({
        text,
        tokenType: "plain",
      });
    } else {
      const blockTokens = jpdbParsedTokens
        .filter(
          (token) =>
            token.start >= blockStart &&
            token.end <= blockEnd &&
            token.end > token.start
        )
        .sort((a, b) => {
          if (a.start !== b.start) {
            return a.start - b.start;
          }
          return b.end - b.start - (a.end - a.start);
        });

      let cursor = 0;
      for (const token of blockTokens) {
        const localStart = token.start - blockStart;
        const localEnd = token.end - blockStart;
        if (localStart < cursor || localStart < 0 || localEnd > text.length) {
          continue;
        }

        if (localStart > cursor) {
          inlineSegments.push({
            text: text.slice(cursor, localStart),
            tokenType: "plain",
          });
        }

        const tokenText = text.slice(localStart, localEnd);
        if (tokenText) {
          inlineSegments.push({
            text: tokenText,
            tokenType: token.tokenType,
            token,
          });
        }

        cursor = localEnd;
      }

      if (cursor < text.length) {
        inlineSegments.push({
          text: text.slice(cursor),
          tokenType: "plain",
        });
      }
    }

    const baseTextStyle = [
      isTitle ? styles.nativeTitle : styles.nativeText,
      { color: theme.textColor },
      !isTitle && fontStyles.japaneseText,
    ];

    return (
      <View style={styles.underlinedInlineContainer}>
        {inlineSegments.flatMap((segment, index) => {
          const renderedNodes: ReactElement[] = [];

          if (segment.tokenType === "plain" || !segment.token) {
            renderedNodes.push(
              <Text key={`plain-${blockStart}-${index}`} style={baseTextStyle}>
                {segment.text}
              </Text>
            );
            return renderedNodes;
          }

          const mappedMatch =
            typeof segment.token.mappedVocabularyId === "number"
              ? vocabularyMatchesById.get(segment.token.mappedVocabularyId)
              : undefined;
          const grammarTooltipItem =
            segment.tokenType === "grammar"
              ? buildGrammarTooltipItem(segment.token)
              : null;
          const jpdbFallbackTooltipItem =
            !grammarTooltipItem && !mappedMatch
              ? buildJpdbFallbackTooltipItem(
                  segment.token,
                  segment.tokenType === "verb" ? "verb" : "vocabulary"
                )
              : null;
          const tooltipItem =
            grammarTooltipItem ?? mappedMatch ?? jpdbFallbackTooltipItem ?? null;
          const tokenKey = `${segment.token.start}-${segment.token.end}-${segment.text}`;
          const isSelectedToken =
            Boolean(selectedItem) && selectedTokenKey === tokenKey;
          const underlineColor =
            segment.tokenType === "grammar"
              ? grammarUnderlineColor
              : segment.tokenType === "verb"
                ? verbUnderlineColor
                : vocabUnderlineColor;
          const tokenUnderlineColor = withAlpha(
            underlineColor,
            theme.isDark ? 0.95 : 0.75
          );
          const selectedTokenBorderColor = withAlpha(
            theme.textColor,
            theme.isDark ? 0.58 : 0.34
          );
          const selectedTokenBackground = withAlpha(
            underlineColor,
            theme.isDark ? 0.24 : 0.18
          );

          const tokenText = (
            <Text
              style={[
                baseTextStyle,
                styles.nativeUnderlineToken,
                isTitle ? styles.nativeUnderlineTokenTitle : null,
                isSelectedToken ? styles.nativeUnderlineTokenSelected : null,
                {
                  borderBottomColor: tokenUnderlineColor,
                  ...(isSelectedToken
                    ? {
                        borderColor: selectedTokenBorderColor,
                        backgroundColor: selectedTokenBackground,
                      }
                    : null),
                },
              ]}
            >
              {segment.text}
            </Text>
          );

          const tokenNodeKey = `token-${blockStart}-${index}-${segment.token.start}-${segment.token.end}`;
          if (!tooltipItem) {
            renderedNodes.push(
              <View key={tokenNodeKey} style={styles.underlinedTokenPressable}>
                {tokenText}
              </View>
            );
          } else {
            renderedNodes.push(
              <Pressable
                key={tokenNodeKey}
                style={styles.underlinedTokenPressable}
                onPress={(event) =>
                  handleVocabularyPress(
                    tooltipItem.id,
                    segment.text,
                    event,
                    tooltipItem,
                    tokenKey,
                    "press"
                  )
                }
                onHoverIn={
                  hoverPreviewEnabled
                    ? (event) =>
                        handleVocabularyPress(
                          tooltipItem.id,
                          segment.text,
                          event,
                          tooltipItem,
                          tokenKey,
                          "hover"
                        )
                    : undefined
                }
                onHoverOut={
                  hoverPreviewEnabled
                    ? () => handleHoverTokenLeave(tokenKey)
                    : undefined
                }
              >
                {tokenText}
              </Pressable>
            );
          }

          const nextSegment = inlineSegments[index + 1];
          const hasAdjacentHighlightedSegment =
            nextSegment &&
            nextSegment.tokenType !== "plain" &&
            Boolean(nextSegment.token);
          if (hasAdjacentHighlightedSegment) {
            renderedNodes.push(
              <Text
                key={`sep-${blockStart}-${index}`}
                style={[baseTextStyle, styles.nativeUnderlineSeparator]}
              >
                {TOKEN_UNDERLINE_SEPARATOR}
              </Text>
            );
          }

          return renderedNodes;
        })}
      </View>
    );
  };

  const renderTooltip = () => {
    if (!selectedItem || !tooltipPosition) return null;
    const isHoverPreview = tooltipInteractionMode === "hover";

    const color =
      selectedItem.id <= GRAMMAR_TOOLTIP_ID_MIN
        ? grammarUnderlineColor
        : getItemColor(selectedItem.type);
    const isWaniKaniBacked = isWaniKaniBackedMatch(selectedItem);
    const inflectionLabels =
      selectedSurfaceText
        ? getVerbInflectionLabelsForMatch(selectedItem, selectedSurfaceText)
        : [];
    const jpdbKanjiComposition =
      !isWaniKaniBacked &&
      (selectedItem.type === "vocabulary" ||
        selectedItem.type === "kana_vocabulary")
        ? (selectedItem as VocabularyMatch).jpdbKanjiComposition ?? []
        : [];
    const primaryReading =
      selectedItem.readings?.find((r) => r.primary)?.reading ||
      selectedItem.readings?.[0]?.reading ||
      "";
    const shouldHideTooltipMeaning =
      hideVocabularyTooltipMeanings && !isTooltipMeaningRevealed;
    const shouldHideTooltipReading =
      hideVocabularyTooltipReadings && !isTooltipReadingRevealed;
    const renderTooltipValueRow = ({
      label,
      value,
      hidden,
      revealLabel,
      onReveal,
      valueStyle,
    }: {
      label: string;
      value: string;
      hidden: boolean;
      revealLabel: string;
      onReveal: () => void;
      valueStyle?: StyleProp<TextStyle>;
    }) => {
      const rowContent = (
        <>
          <Text
            style={[
              styles.tooltipPopupLabel,
              { color: theme.textSecondary },
            ]}
          >
            {label}
          </Text>
          <Text
            style={[
              styles.tooltipPopupValue,
              { color: hidden ? theme.primary : theme.textColor },
              hidden ? styles.tooltipRevealValue : null,
              !hidden ? valueStyle : null,
            ]}
          >
            {hidden ? revealLabel : value}
          </Text>
        </>
      );

      if (hidden) {
        return (
          <Pressable
            style={styles.tooltipPopupRow}
            onPress={onReveal}
            accessibilityRole="button"
          >
            {rowContent}
          </Pressable>
        );
      }

      return <View style={styles.tooltipPopupRow}>{rowContent}</View>;
    };

    return (
      <Modal
        visible={!!selectedItem}
        transparent
        animationType="none"
        onRequestClose={handleCloseTooltip}
      >
        <View
          style={styles.tooltipOverlay}
          pointerEvents={isHoverPreview ? "none" : "box-none"}
        >
          {!isHoverPreview ? (
            <Pressable
              style={styles.tooltipBackdrop}
              onPress={handleCloseTooltip}
            />
          ) : null}
          <Animated.View
            pointerEvents={isHoverPreview ? "none" : "auto"}
            onLayout={handleTooltipLayout}
            style={[
              styles.tooltipPopup,
              {
                backgroundColor: theme.cardBackground,
                top: tooltipPosition.y,
                left: tooltipPosition.x,
                opacity: tooltipOpacity,
              },
            ]}
          >
            <View
              style={[
                styles.tooltipPopupHeader,
                { backgroundColor: color },
              ]}
            >
              <Text
                style={[
                  styles.tooltipPopupCharacters,
                  fontStyles.japaneseText,
                ]}
              >
                {selectedItem.characters}
              </Text>
              <View style={styles.tooltipLevelBadge}>
                <Text style={styles.tooltipLevelBadgeText}>
                  {isWaniKaniBacked ? `Lv ${selectedItem.level}` : "JPDB"}
                </Text>
              </View>
            </View>

            <View style={styles.tooltipPopupContent}>
              {primaryReading && (
                renderTooltipValueRow({
                  label: "Reading:",
                  value: primaryReading,
                  hidden: shouldHideTooltipReading,
                  revealLabel: "Tap to reveal",
                  onReveal: () => setIsTooltipReadingRevealed(true),
                  valueStyle: fontStyles.japaneseText,
                })
              )}

              {renderTooltipValueRow({
                label: "Meaning:",
                value: selectedItem.meaning,
                hidden: shouldHideTooltipMeaning,
                revealLabel: "Tap to reveal",
                onReveal: () => setIsTooltipMeaningRevealed(true),
              })}

              {jpdbKanjiComposition.length > 0 ? (
                <View style={styles.tooltipPopupRow}>
                  <Text
                    style={[
                      styles.tooltipPopupLabel,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Kanji:
                  </Text>
                  <View style={styles.tooltipKanjiCompositionWrap}>
                    {jpdbKanjiComposition.map((kanjiEntry) => (
                      <TouchableOpacity
                        key={`news-jpdb-kanji-${kanjiEntry.id}`}
                        style={[
                          styles.tooltipKanjiChip,
                          { borderColor: theme.border },
                        ]}
                        onPress={() => handleOpenSubject(kanjiEntry.id)}
                        activeOpacity={0.75}
                      >
                        <Text
                          style={[
                            styles.tooltipKanjiChipText,
                            { color: theme.textColor },
                          ]}
                        >
                          {kanjiEntry.characters}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : null}

              {inflectionLabels.length > 0 && (
                <View style={styles.tooltipPopupRow}>
                  <Text
                    style={[
                      styles.tooltipPopupLabel,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Form:
                  </Text>
                  <Text
                    style={[
                      styles.tooltipPopupValue,
                      { color: theme.textColor },
                    ]}
                  >
                    {inflectionLabels.join(", ")}
                  </Text>
                </View>
              )}

              {isWaniKaniBacked ? (
                <TouchableOpacity
                  style={[
                    styles.tooltipPopupButton,
                    { backgroundColor: color },
                  ]}
                  onPress={handleViewDetails}
                  activeOpacity={0.7}
                >
                  <Text style={styles.tooltipPopupButtonText}>
                    View Details
                  </Text>
                  <Ionicons name="arrow-forward" size={14} color="white" />
                </TouchableOpacity>
              ) : null}
            </View>
          </Animated.View>
        </View>
      </Modal>
    );
  };

  if (!item) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.backgroundColor }]}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <View
          style={[
            styles.header,
            {
              backgroundColor: theme.headerBackground,
              paddingTop: 60,
              height: headerHeight,
            },
          ]}
        >
          <GlassButton
            iconName="arrow-back"
            onPress={() => router.back()}
            iconColor={theme.headerText}
            style={styles.backButton}
            variant={theme.isDark ? "colored" : "light"}
          />
        </View>
        <View style={styles.offlineContainer}>
          <Ionicons name="cloud-offline-outline" size={64} color={theme.textLight} />
          <Text style={[styles.offlineTitle, { color: theme.textColor }]}>
            Article Not Available
          </Text>
          <Text style={[styles.offlineText, { color: theme.textSecondary }]}>
            Connect to WiFi to view this article.
          </Text>
        </View>
      </View>
    );
  }

  // HTML content construction
  let htmlContent = item.contentHtml.replace(/<audio.*?>.*?<\/audio>/g, "");

  const css = `
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: ${Math.round(18 * accessibleFontScale)}px;
      line-height: 1.8;
      color: ${theme.textColor}; 
      background-color: ${theme.backgroundColor};
      padding: 16px;
      padding-top: ${headerHeight}px;
      margin: 0;
    }
    img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin-bottom: 16px;
    }
    ruby {
      ruby-position: over;
    }
    rt {
      font-size: 0.6em;
      color: ${theme.primary};
    }
    .hide-furigana rt {
        display: none;
    }
    a {
      color: ${theme.primary};
      text-decoration: none;
    }
    .nhk-translation {
        margin-top: 8px;
        padding: 12px;
        background-color: rgba(0,0,0,0.03);
        border-radius: 8px;
        border-left: 3px solid ${subjectColors.vocabulary};
        font-size: ${Math.round(16 * accessibleFontScale)}px;
        line-height: 1.5;
        font-style: italic;
        color: ${theme.textSecondary};
        margin-bottom: 24px;
    }
    .nhk-translation.loading {
        opacity: 0.6;
    }
  `;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>${css}</style>
      </head>
      <body>
        <h1>${item.title}</h1>
        ${htmlContent}
      </body>
    </html>
  `;

  const headerIconColor = theme.isDark ? theme.headerText : "#000000";

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Custom Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.headerBackground,
            paddingTop: 60,
            height: headerHeight,
          },
        ]}
      >
        <GlassButton
          iconName="arrow-back"
          onPress={() => router.back()}
          iconColor={headerIconColor}
          style={[styles.headerButtonBase, styles.backButton]}
        />

        <View style={{ flex: 1 }} />

        {Platform.OS === "ios" && SwiftUI ? (
          <SwiftUI.Host
            matchContents
            style={[styles.headerButtonBase, styles.actionButton]}
          >
            <SwiftUI.Menu
              label={
                <SwiftUI.RNHostView matchContents>
                  <GlassButton
                    iconName="settings-outline"
                    iconColor={headerIconColor}
                    style={[styles.headerButtonBase, styles.actionButton]}
                  />
                </SwiftUI.RNHostView>
              }
            >
              {!isNativeMode && (
                <SwiftUI.Button
                  label={showFurigana ? "Hide Furigana" : "Show Furigana"}
                  systemImage="textformat"
                  onPress={toggleFurigana}
                />
              )}
              <SwiftUI.Button
                label={showTranslation ? "Hide Translation" : "Show Translation"}
                systemImage="globe"
                onPress={toggleTranslation}
              />
              <SwiftUI.Menu label="Study Mode" systemImage="graduationcap">
                <SwiftUI.Button
                  label="No Study Mode"
                  systemImage={
                    studyMode === "none" ? "checkmark.circle.fill" : "circle"
                  }
                  onPress={() => selectStudyMode("none")}
                />
                <SwiftUI.Button
                  label="WK Study Mode (cards)"
                  systemImage={
                    studyMode === "wk" ? "checkmark.circle.fill" : "circle"
                  }
                  onPress={() => selectStudyMode("wk")}
                />
                <SwiftUI.Button
                  label="Full grammar + vocabulary (underlines)"
                  systemImage={
                    !hasStoredJpdbApiKey
                      ? "lock"
                      : studyMode === "full"
                        ? "checkmark.circle.fill"
                        : "circle"
                  }
                  onPress={() => selectStudyMode("full")}
                />
              </SwiftUI.Menu>
            </SwiftUI.Menu>
          </SwiftUI.Host>
        ) : (
          <GlassButton
            iconName="settings-outline"
            onPress={() => setShowSettingsMenu(true)}
            iconColor={headerIconColor}
            style={[styles.headerButtonBase, styles.actionButton]}
          />
        )}

        {item.audioUrl && (
          <GlassButton
            onPress={toggleAudio}
            style={[styles.headerButtonBase, styles.actionButton]}
          >
            {isAudioLoading ? (
              <ActivityIndicator
                size="small"
                color={headerIconColor}
                style={{ width: 24, height: 24 }}
              />
            ) : (
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={24}
                color={headerIconColor}
              />
            )}
          </GlassButton>
        )}
      </View>

      {isNativeMode ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: isPlayerVisible ? 160 : 30 },
          ]}
        >
          {contentBlocks.map((block, index) => {
            if (block.type === "text") {
              // Check if it's the first text block, assuming matches title logic or first paragraph
              // item.title is handled separately or in the first block if we included it?
              // The current logic included item.title as first block.
              const isTitle = index === 0;
              return (
                <View key={index} style={styles.nativeBlock}>
                  {fullModeEnabled
                    ? renderUnderlinedAnalyzedText(
                        block.content,
                        textBlockOffsets[index] ?? 0,
                        isTitle
                      )
                    : renderHighlightedText(block.content, isTitle)}

                  {/* Translation Section */}
                  {showTranslation &&
                    (block.translation || block.isTranslating) && (
                      <View
                        style={[
                          styles.translationContainer,
                          { borderLeftColor: subjectColors.vocabulary },
                        ]}
                      >
                        {block.isTranslating ? (
                          <View style={styles.translationLoading}>
                            <ActivityIndicator
                              size="small"
                              color={theme.primary}
                            />
                            <Text
                              style={[
                                styles.translationText,
                                { color: theme.textSecondary },
                              ]}
                            >
                              Translating...
                            </Text>
                          </View>
                        ) : (
                          <Text
                            style={[
                              styles.translationText,
                              { color: theme.textSecondary },
                            ]}
                          >
                            {block.translation}
                          </Text>
                        )}
                      </View>
                    )}
                </View>
              );
            } else {
              const aspectRatio = imageAspectRatios[block.content];
              return (
                <Image
                  key={index}
                  source={{ uri: block.content }}
                  style={[
                    styles.nativeImage,
                    aspectRatio
                      ? { aspectRatio }
                      : styles.nativeImageFallback,
                  ]}
                  resizeMode="contain"
                />
              );
            }
          })}
        </ScrollView>
      ) : (
        <WebView
          ref={webViewRef}
          originWhitelist={["*"]}
          source={{ html }}
          style={{ flex: 1, backgroundColor: "transparent" }}
          onLoadEnd={() => setIsWebViewLoaded(true)}
        />
      )}

      {renderTooltip()}

      {!(Platform.OS === "ios" && SwiftUI) && (
        <Modal
          visible={showSettingsMenu}
          transparent
          animationType="fade"
          onRequestClose={() => setShowSettingsMenu(false)}
        >
          <TouchableWithoutFeedback onPress={() => setShowSettingsMenu(false)}>
            <View style={styles.settingsModalOverlay}>
              <TouchableWithoutFeedback>
                <View
                  style={[
                    styles.settingsModalContent,
                    { backgroundColor: theme.cardBackground },
                  ]}
                >
                  <Text
                    style={[styles.settingsModalTitle, { color: theme.textColor }]}
                  >
                    Reading Options
                  </Text>

                  {!isNativeMode && (
                    <TouchableOpacity
                      style={styles.settingsModalOption}
                      onPress={toggleFurigana}
                      activeOpacity={0.8}
                    >
                      <View style={styles.settingsModalOptionLeading}>
                        <Ionicons
                          name="text-outline"
                          size={22}
                          color={theme.textColor}
                        />
                        <Text
                          style={[
                            styles.settingsModalOptionText,
                            { color: theme.textColor },
                          ]}
                        >
                          Show Furigana
                        </Text>
                      </View>
                      <Switch
                        value={showFurigana}
                        onValueChange={toggleFurigana}
                        trackColor={{ false: "#767577", true: theme.primary }}
                        thumbColor="#f4f3f4"
                      />
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.settingsModalOption}
                    onPress={toggleTranslation}
                    activeOpacity={0.8}
                  >
                    <View style={styles.settingsModalOptionLeading}>
                      <Ionicons
                        name="language-outline"
                        size={22}
                        color={theme.textColor}
                      />
                      <Text
                        style={[
                          styles.settingsModalOptionText,
                          { color: theme.textColor },
                        ]}
                      >
                        Show Translation
                      </Text>
                    </View>
                    <Switch
                      value={showTranslation}
                      onValueChange={toggleTranslation}
                      trackColor={{ false: "#767577", true: theme.primary }}
                      thumbColor="#f4f3f4"
                    />
                  </TouchableOpacity>

                  <View
                    style={[
                      styles.settingsStudyModeContainer,
                      { borderColor: theme.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.settingsStudyModeTitle,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Study Mode (choose one)
                    </Text>

                    <TouchableOpacity
                      style={styles.settingsModalOption}
                      onPress={() => selectStudyMode("none")}
                      activeOpacity={0.8}
                    >
                      <View style={styles.settingsModalOptionLeading}>
                        <Ionicons
                          name="document-text-outline"
                          size={22}
                          color={theme.textColor}
                        />
                        <Text
                          style={[
                            styles.settingsModalOptionText,
                            { color: theme.textColor },
                          ]}
                        >
                          No Study Mode
                        </Text>
                      </View>
                      <Switch
                        value={studyMode === "none"}
                        onValueChange={() => selectStudyMode("none")}
                        trackColor={{ false: "#767577", true: theme.primary }}
                        thumbColor="#f4f3f4"
                      />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.settingsModalOption}
                      onPress={() => selectStudyMode("wk")}
                      activeOpacity={0.8}
                    >
                      <View style={styles.settingsModalOptionLeading}>
                        <Ionicons
                          name="color-wand-outline"
                          size={22}
                          color={theme.textColor}
                        />
                        <View style={styles.settingsModalOptionTextWrap}>
                          <Text
                            style={[
                              styles.settingsModalOptionText,
                              { color: theme.textColor },
                            ]}
                          >
                            WK Study Mode
                          </Text>
                          <Text
                            style={[
                              styles.settingsModalOptionSubtext,
                              { color: theme.textSecondary },
                            ]}
                          >
                            Card highlights
                          </Text>
                        </View>
                      </View>
                      <Switch
                        value={wkModeEnabled}
                        onValueChange={() => selectStudyMode("wk")}
                        trackColor={{ false: "#767577", true: theme.primary }}
                        thumbColor="#f4f3f4"
                      />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.settingsModalOption}
                      onPress={() => selectStudyMode("full")}
                      activeOpacity={0.8}
                    >
                      <View style={styles.settingsModalOptionLeading}>
                        <Ionicons
                          name="text-outline"
                          size={22}
                          color={theme.textColor}
                        />
                        <View style={styles.settingsModalOptionTextWrap}>
                          <Text
                            style={[
                              styles.settingsModalOptionText,
                              { color: theme.textColor },
                            ]}
                          >
                            Full grammar + vocabulary mode
                          </Text>
                          <Text
                            style={[
                              styles.settingsModalOptionSubtext,
                              { color: theme.textSecondary },
                            ]}
                          >
                            JPDB underlines
                          </Text>
                        </View>
                      </View>
                      <Switch
                        value={fullModeEnabled}
                        onValueChange={() => selectStudyMode("full")}
                        trackColor={{ false: "#767577", true: theme.primary }}
                        thumbColor="#f4f3f4"
                      />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={[styles.settingsModalOption, styles.settingsModalCancel]}
                    onPress={() => setShowSettingsMenu(false)}
                  >
                    <Text
                      style={[
                        styles.settingsModalCancelText,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Close
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}

      {item && (
        <NewsAudioPlayer
          visible={isPlayerVisible}
          isPlaying={isPlaying}
          duration={durationMillis}
          position={positionMillis}
          onPlayPause={toggleAudio}
          onSeek={onSeek}
          onForward={onForward}
          onRewind={onRewind}
          onClose={onClosePlayer}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    height: HEADER_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)", // Subtle border
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  backButton: {
    marginRight: 16,
  },
  headerButtonBase: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButton: {
    marginLeft: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: HEADER_HEIGHT + 16,
    paddingBottom: 40,
  },
  nativeBlock: {
    marginBottom: 24,
  },
  nativeTitle: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 16,
  },
  nativeText: {
    fontSize: 18,
    lineHeight: 40,
  },
  nativeTextSegment: {
    lineHeight: 40,
  },
  nativeImage: {
    width: "100%",
    borderRadius: 8,
    marginBottom: 16,
    backgroundColor: "#333",
  },
  nativeImageFallback: {
    height: 220,
  },
  translationContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: "rgba(0,0,0,0.03)",
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: "transparent",
  },
  translationLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  translationText: {
    fontSize: 16,
    lineHeight: 24,
    fontStyle: "italic",
  },
  inlineChipWrapper: {
    position: "relative",
  },
  inlineChipWrapperWithBadge: {
    marginRight: 6,
  },
  inlineChip: {
    position: "relative",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginHorizontal: 2,
    minHeight: 28,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.4)",
    shadowColor: "rgba(0,0,0,0.3)",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 2,
    overflow: "visible",
  },
  inlineChipTitle: {
    minHeight: 38,
    paddingHorizontal: 10,
  },
  inlineChipText: {
    color: "white",
    fontWeight: "700",
    fontSize: 18,
    lineHeight: 22,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  inlineChipTextTitle: {
    fontSize: 28,
    lineHeight: 32,
  },
  levelBadgeChip: {
    position: "absolute",
    top: -5,
    right: -5,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "white",
    shadowColor: "rgba(0,0,0,0.5)",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 5,
  },
  jpdbBadgeChip: {
    backgroundColor: "rgba(0, 0, 0, 0.78)",
  },
  levelBadgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
    textAlign: "center",
  },
  nativeUnderlineToken: {
    paddingBottom: 1,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    borderWidth: 1.5,
    borderColor: "transparent",
    borderRadius: 8,
    paddingVertical: 0,
    paddingHorizontal: 2,
    overflow: "hidden",
  },
  underlinedInlineContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
  },
  underlinedTokenPressable: {
    borderRadius: 8,
    marginHorizontal: 0.6,
  },
  nativeUnderlineTokenTitle: {},
  nativeUnderlineTokenSelected: {},
  nativeUnderlineSeparator: {
    textDecorationLine: "none",
  },
  tooltipOverlay: {
    flex: 1,
    backgroundColor: "transparent",
  },
  tooltipBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  tooltipPopup: {
    position: "absolute",
    width: 280,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "rgba(0,0,0,0.3)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1,
  },
  tooltipPopupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  tooltipPopupCharacters: {
    fontSize: 32,
    fontWeight: "bold",
    color: "white",
    flex: 1,
  },
  tooltipLevelBadge: {
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  tooltipLevelBadgeText: {
    color: "white",
    fontSize: 11,
    fontWeight: "bold",
  },
  tooltipPopupContent: {
    padding: 16,
    gap: 10,
  },
  tooltipPopupRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  tooltipPopupLabel: {
    fontSize: 12,
    fontWeight: "600",
    minWidth: 60,
  },
  tooltipPopupValue: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  tooltipRevealValue: {
    fontWeight: "700",
  },
  tooltipKanjiCompositionWrap: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tooltipKanjiChip: {
    borderWidth: 1,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tooltipKanjiChipText: {
    fontSize: 14,
    fontWeight: "700",
  },
  tooltipPopupInflectionNote: {
    fontSize: 12,
    fontStyle: "italic",
    lineHeight: 18,
  },
  tooltipPopupButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 6,
    gap: 6,
  },
  tooltipPopupButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  offlineContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  offlineTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 8,
  },
  offlineText: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
  },
  // Settings Modal styles
  settingsModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  settingsModalContent: {
    width: "85%",
    maxWidth: 340,
    borderRadius: 16,
    padding: 20,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  settingsModalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  settingsModalOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  settingsModalOptionLeading: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  settingsModalOptionTextWrap: {
    flex: 1,
  },
  settingsModalOptionText: {
    fontSize: 16,
    flex: 1,
  },
  settingsModalOptionSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  settingsModalOptionDisabled: {
    opacity: 0.55,
  },
  settingsStudyModeContainer: {
    borderTopWidth: 1,
    marginTop: 8,
    paddingTop: 10,
  },
  settingsStudyModeTitle: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
    marginHorizontal: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  settingsModeHint: {
    fontSize: 12,
    lineHeight: 18,
    marginHorizontal: 12,
    marginBottom: 6,
  },
  settingsModalCancel: {
    marginTop: 8,
    justifyContent: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(128, 128, 128, 0.2)",
    paddingTop: 16,
  },
  settingsModalCancelText: {
    fontSize: 16,
    textAlign: "center",
  },
});
