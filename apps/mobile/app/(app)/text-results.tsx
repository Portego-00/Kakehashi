import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, {
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { VocabularyTooltip } from "../../src/components/VocabularyTooltip";
import { WaniKaniItemType } from "../../src/types/wanikani";
import { azureSpeechService } from "../../src/utils/azureSpeech";
import { azureTranslatorService } from "../../src/utils/azureTranslator";
import { getAllSubjects } from "../../src/utils/cache";
import { fontStyles } from "../../src/utils/fonts";
import {
  getReadableTextColor,
  useSubjectColors,
  withAlpha,
} from "../../src/utils/subjectColors";
import {
  saveTextHistory,
  type VocabularyMatch as HistoryVocabularyMatch,
  type KanjiMatch as HistoryKanjiMatch,
} from "../../src/utils/searchHistory";
import { useTheme } from "../../src/utils/theme";

interface VocabularyMatch {
  id: number;
  characters: string;
  meaning: string;
  type: WaniKaniItemType;
  level: number;
  readings?: { reading: string; primary: boolean }[];
}

interface KanjiMatch {
  id: number;
  characters: string;
  meaning: string;
  type: WaniKaniItemType;
  level: number;
  readings?: { reading: string; primary: boolean }[];
}

export default function TextResultsScreen() {
  const { theme } = useTheme();
  const subjectColors = useSubjectColors();
  const kanjiTextColor = getReadableTextColor(subjectColors.kanji);
  const styles = useMemo(
    () => createStyles(subjectColors),
    [subjectColors.kanji, subjectColors.radical, subjectColors.vocabulary]
  );
  const router = useRouter();
  const { inputText, sourceLanguage, historyItem } = useLocalSearchParams<{
    inputText: string;
    sourceLanguage: string;
    historyItem?: string;
  }>();

  // Parse history item if provided
  const parsedHistoryItem = historyItem ? JSON.parse(historyItem) : null;

  const isEnglishMode = sourceLanguage === "english" || parsedHistoryItem?.isEnglishMode;
  const originalInput = inputText || parsedHistoryItem?.inputText || "";

  const [vocabularyMatches, setVocabularyMatches] = useState<VocabularyMatch[]>(
    parsedHistoryItem?.vocabularyMatches || []
  );
  const [kanjiMatches, setKanjiMatches] = useState<KanjiMatch[]>(
    parsedHistoryItem?.kanjiMatches || []
  );
  const [isLoading, setIsLoading] = useState(!parsedHistoryItem);
  const [error, setError] = useState<string | null>(null);
  const [japaneseText, setJapaneseText] = useState<string>(
    parsedHistoryItem?.japaneseText || (isEnglishMode ? "" : originalInput)
  );
  const [translation, setTranslation] = useState<string | null>(
    parsedHistoryItem?.translation || null
  );
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [vocabularyCollapsed, setVocabularyCollapsed] = useState(false);
  const [kanjiCollapsed, setKanjiCollapsed] = useState(false);

  // Tooltip state
  const [selectedItem, setSelectedItem] = useState<
    (VocabularyMatch | KanjiMatch) | null
  >(null);
  const [selectedSurfaceText, setSelectedSurfaceText] = useState<string | null>(
    null
  );
  const [tooltipPosition, setTooltipPosition] = useState<{
    x: number;
    y: number;
    width: number;
  } | null>(null);
  const [tooltipReady, setTooltipReady] = useState(false);
  const tooltipOpacity = useSharedValue(0);

  // Skeleton animation
  const skeletonOpacity = useSharedValue(0.3);

  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!parsedHistoryItem && originalInput) {
      processText();
    }
  }, [originalInput]);

  // Skeleton animation for loading state
  useEffect(() => {
    if (isLoading || isTranslating) {
      skeletonOpacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 800 }),
          withTiming(0.3, { duration: 800 })
        ),
        -1,
        true
      );
    }
  }, [isLoading, isTranslating]);

  // Save to history when matches are found
  useEffect(() => {
    const saveToHistory = async () => {
      if (
        originalInput &&
        !isLoading &&
        !parsedHistoryItem &&
        (vocabularyMatches.length > 0 || kanjiMatches.length > 0)
      ) {
        const historyVocabularyMatches: HistoryVocabularyMatch[] =
          vocabularyMatches.map((match) => ({
            id: match.id,
            characters: match.characters,
            meaning: match.meaning,
            type: match.type,
            level: match.level,
            readings: match.readings,
          }));

        const historyKanjiMatches: HistoryKanjiMatch[] = kanjiMatches.map(
          (match) => ({
            id: match.id,
            characters: match.characters,
            meaning: match.meaning,
            type: match.type,
            level: match.level,
            readings: match.readings,
          })
        );

        await saveTextHistory({
          inputText: originalInput,
          japaneseText,
          translation: translation || undefined,
          vocabularyMatchCount: vocabularyMatches.length,
          kanjiMatchCount: kanjiMatches.length,
          isEnglishMode,
          vocabularyMatches: historyVocabularyMatches,
          kanjiMatches: historyKanjiMatches,
        });
      }
    };

    saveToHistory();
  }, [vocabularyMatches, kanjiMatches, translation, isLoading]);

  const processText = async () => {
    try {
      setIsLoading(true);
      setError(null);

      let textToAnalyze = originalInput;

      // If English mode, translate to Japanese first
      if (isEnglishMode) {
        setIsTranslating(true);
        try {
          const translated = await azureTranslatorService.translate(
            originalInput,
            "en",
            "ja"
          );
          textToAnalyze = translated;
          setJapaneseText(translated);
        } catch (err) {
          console.error("Translation error:", err);
          setError("Failed to translate text. Please try again.");
          setIsLoading(false);
          setIsTranslating(false);
          return;
        }
        setIsTranslating(false);
      } else {
        // Japanese mode - translate to English for display
        setJapaneseText(originalInput);
        translateToEnglish(originalInput);
      }

      // Find vocabulary and kanji matches
      await findMatches(textToAnalyze);
    } catch (err) {
      console.error("Error processing text:", err);
      setError("Failed to process text. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const translateToEnglish = async (text: string) => {
    try {
      setIsTranslating(true);
      const translatedText = await azureTranslatorService.translate(text);
      setTranslation(translatedText);
    } catch (err) {
      console.error("Error translating text:", err);
      setTranslation(null);
    } finally {
      setIsTranslating(false);
    }
  };

  const findMatches = async (text: string) => {
    try {
      const allSubjects = await getAllSubjects();
      const vocabularySubjects = allSubjects.filter(
        (subject) =>
          subject.object === "vocabulary" || subject.object === "kana_vocabulary"
      );
      const kanjiSubjects = allSubjects.filter(
        (subject) => subject.object === "kanji"
      );

      const cleanText = text.replace(/\s+/g, "").trim();

      // Find vocabulary matches
      const allVocabMatches: VocabularyMatch[] = [];
      const foundVocabCharacters = new Set<string>();

      for (const subject of vocabularySubjects) {
        const characters = subject.data.characters;
        if (!characters || foundVocabCharacters.has(characters)) continue;

        if (cleanText.includes(characters)) {
          allVocabMatches.push({
            id: subject.id,
            characters,
            meaning:
              subject.data.meanings.find((m: any) => m.primary)?.meaning ||
              subject.data.meanings[0]?.meaning ||
              "",
            type: subject.object as WaniKaniItemType,
            level: subject.data.level || 1,
            readings: subject.data.readings,
          });
          foundVocabCharacters.add(characters);
        }
      }

      // Filter to keep only longest matches
      const filteredVocabMatches = allVocabMatches.filter((match) => {
        return !allVocabMatches.some((otherMatch) => {
          return (
            otherMatch.characters !== match.characters &&
            otherMatch.characters.includes(match.characters)
          );
        });
      });

      filteredVocabMatches.sort((a, b) => {
        if (a.characters.length !== b.characters.length) {
          return b.characters.length - a.characters.length;
        }
        return a.level - b.level;
      });

      // Find kanji matches
      const kanjiMatchesFound: KanjiMatch[] = [];
      const foundKanjiCharacters = new Set<string>();

      for (const subject of kanjiSubjects) {
        const characters = subject.data.characters;
        if (!characters || foundKanjiCharacters.has(characters)) continue;

        if (cleanText.includes(characters)) {
          kanjiMatchesFound.push({
            id: subject.id,
            characters,
            meaning:
              subject.data.meanings.find((m: any) => m.primary)?.meaning ||
              subject.data.meanings[0]?.meaning ||
              "",
            type: subject.object as WaniKaniItemType,
            level: subject.data.level || 1,
            readings: subject.data.readings,
          });
          foundKanjiCharacters.add(characters);
        }
      }

      kanjiMatchesFound.sort((a, b) => a.level - b.level);

      setVocabularyMatches(filteredVocabMatches);
      setKanjiMatches(kanjiMatchesFound);
    } catch (err) {
      console.error("Error finding matches:", err);
      setError("Failed to find vocabulary matches");
    }
  };

  const handleSubjectPress = useCallback(
    (subjectId: number) => {
      router.push(`/subject/${subjectId}`);
    },
    [router]
  );

  const handleVocabularyPress = useCallback(
    (itemId: number, surfaceText: string, event: any) => {
      const item = [...vocabularyMatches, ...kanjiMatches].find(
        (m) => m.id === itemId
      );
      if (item && event?.target) {
        setTooltipReady(false);
        tooltipOpacity.value = 0;

        event.target.measureInWindow(
          (x: number, y: number, width: number, height: number) => {
            const screenWidth = Dimensions.get("window").width;
            const screenHeight = Dimensions.get("window").height;
            const tooltipWidth = 280;
            const tooltipEstimatedHeight = 180;

            let left = x + width / 2 - tooltipWidth / 2;
            left = Math.max(
              16,
              Math.min(left, screenWidth - tooltipWidth - 16)
            );

            const spaceBelow = screenHeight - (y + height);
            const spaceAbove = y;
            let top: number;

            if (
              spaceBelow >= tooltipEstimatedHeight ||
              spaceBelow > spaceAbove
            ) {
              top = y + height + 8;
            } else {
              top = y - tooltipEstimatedHeight - 8;
            }

            setTooltipPosition({ x: left, y: top, width });
            setSelectedItem(item);
            setSelectedSurfaceText(surfaceText);
            requestAnimationFrame(() => {
              setTooltipReady(true);
              tooltipOpacity.value = withTiming(1, { duration: 200 });
            });
          }
        );
      }
    },
    [vocabularyMatches, kanjiMatches]
  );

  const handleCloseTooltip = useCallback(() => {
    tooltipOpacity.value = 0;
    setTooltipReady(false);
    setSelectedItem(null);
    setSelectedSurfaceText(null);
    setTooltipPosition(null);
  }, []);

  const handleViewDetails = useCallback(() => {
    if (selectedItem) {
      handleCloseTooltip();
      router.push(`/subject/${selectedItem.id}`);
    }
  }, [selectedItem, router, handleCloseTooltip]);

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  const handleNewSearch = useCallback(() => {
    router.replace("/text-search");
  }, [router]);

  const handleShowHistory = useCallback(() => {
    router.push("/text-history");
  }, [router]);

  const handleSpeak = useCallback(
    async (text: string) => {
      if (isSpeaking) {
        await azureSpeechService.stop();
        setIsSpeaking(false);
        return;
      }

      try {
        setIsSpeaking(true);
        await azureSpeechService.speak(
          text,
          () => console.log("Speech started"),
          () => {
            console.log("Speech finished");
            setIsSpeaking(false);
          },
          (error) => {
            console.error("Speech error:", error);
            setIsSpeaking(false);
          }
        );
      } catch (error) {
        console.error("Error starting speech:", error);
        setIsSpeaking(false);
      }
    },
    [isSpeaking]
  );

  const getItemColor = (type: WaniKaniItemType) => {
    return subjectColors.getColorForType(type);
  };

  const highlightMatchesInText = (text: string): ReactElement[] | null => {
    if (!text) return null;

    const allMatches = [...vocabularyMatches, ...kanjiMatches].sort(
      (a, b) => b.characters.length - a.characters.length
    );

    let result = text;
    const highlights: {
      start: number;
      end: number;
      type: WaniKaniItemType;
      id: number;
      characters: string;
    }[] = [];

    allMatches.forEach((match) => {
      let startIndex = 0;
      while (true) {
        const index = result.indexOf(match.characters, startIndex);
        if (index === -1) break;

        const overlaps = highlights.some(
          (h) =>
            (index >= h.start && index < h.end) ||
            (index + match.characters.length > h.start && index < h.end)
        );

        if (
          !overlaps ||
          match.characters.length >
            highlights.find((h) => h.start <= index && h.end > index)
              ?.characters.length!
        ) {
          const existingIndex = highlights.findIndex(
            (h) =>
              h.start <= index &&
              h.end > index &&
              h.characters.length < match.characters.length
          );
          if (existingIndex !== -1) {
            highlights.splice(existingIndex, 1);
          }

          highlights.push({
            start: index,
            end: index + match.characters.length,
            type: match.type,
            id: match.id,
            characters: match.characters,
          });
        }

        startIndex = index + 1;
      }
    });

    highlights.sort((a, b) => a.start - b.start);

    const segments: ReactElement[] = [];
    let lastIndex = 0;

    highlights.forEach((highlight, index) => {
      if (highlight.start > lastIndex) {
        segments.push(
          <View
            key={`text-${lastIndex}-${index}`}
            style={styles.textSegmentWrapper}
          >
            <Text style={[styles.highlightedText, { color: theme.textColor }]}>
              {result.slice(lastIndex, highlight.start)}
            </Text>
          </View>
        );
      }

      const color = getItemColor(highlight.type);
      segments.push(
        <View
          key={`highlight-${highlight.start}-${highlight.end}-${highlight.id}`}
          style={[styles.highlightedMatch, { backgroundColor: color }]}
        >
          <TouchableOpacity
            style={styles.highlightTouchable}
            onPress={(e) =>
              handleVocabularyPress(
                highlight.id,
                result.slice(highlight.start, highlight.end),
                e
              )
            }
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.highlightedMatchText,
                { color: getReadableTextColor(color) },
              ]}
            >
              {result.slice(highlight.start, highlight.end)}
            </Text>
          </TouchableOpacity>
        </View>
      );

      lastIndex = highlight.end;
    });

    if (lastIndex < result.length) {
      segments.push(
        <View key={`text-end-${lastIndex}`} style={styles.textSegmentWrapper}>
          <Text style={[styles.highlightedText, { color: theme.textColor }]}>
            {result.slice(lastIndex)}
          </Text>
        </View>
      );
    }

    return segments;
  };

  const renderVocabularyMatch = ({
    item,
  }: {
    item: VocabularyMatch;
    index: number;
  }) => {
    return (
      <TouchableOpacity
        style={[styles.matchCard, { backgroundColor: theme.cardBackground }]}
        activeOpacity={0.7}
        onPress={(e) => handleVocabularyPress(item.id, item.characters, e)}
      >
        <View style={styles.cardHeader}>
          <View
            style={[
              styles.characterBox,
              { backgroundColor: getItemColor(item.type) },
              item.characters.length > 2 && {
                width: 56 + (item.characters.length - 2) * 18,
              },
            ]}
          >
            <Text
              style={[
                styles.characterText,
                { color: getReadableTextColor(getItemColor(item.type)) },
                fontStyles.japaneseText,
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {item.characters}
            </Text>
          </View>

          <View style={styles.matchInfo}>
            <Text
              style={[styles.meaningText, { color: theme.textColor }]}
              numberOfLines={2}
            >
              {item.meaning}
            </Text>
            <View style={styles.matchMetadata}>
              <Text style={[styles.levelText, { color: theme.textLight }]}>
                Level {item.level}
              </Text>
            </View>
            {item.readings && item.readings.length > 0 && (
              <View style={styles.readingsContainer}>
                {item.readings.slice(0, 2).map((reading, index) => (
                  <View
                    key={index}
                    style={[
                      styles.readingBadge,
                      { backgroundColor: theme.isDark ? "#333" : "#f5f5f5" },
                      reading.primary && { backgroundColor: getItemColor(item.type) },
                    ]}
                  >
                    <Text
                      style={[
                        styles.readingText,
                        {
                          color: reading.primary
                            ? getReadableTextColor(getItemColor(item.type))
                            : theme.textSecondary,
                        },
                        fontStyles.japaneseText,
                      ]}
                    >
                      {reading.reading}
                    </Text>
                  </View>
                ))}
                {item.readings.length > 2 && (
                  <Text
                    style={[styles.moreReadings, { color: theme.textLight }]}
                  >
                    +{item.readings.length - 2}
                  </Text>
                )}
              </View>
            )}
          </View>

          <Ionicons
            name="chevron-forward"
            size={20}
            color={theme.textSecondary}
          />
        </View>
      </TouchableOpacity>
    );
  };

  const renderKanjiMatch = ({
    item,
  }: {
    item: KanjiMatch;
    index: number;
  }) => {
    return (
      <TouchableOpacity
        style={[styles.matchCard, { backgroundColor: theme.cardBackground }]}
        activeOpacity={0.7}
        onPress={(e) => handleVocabularyPress(item.id, item.characters, e)}
      >
        <View style={styles.cardHeader}>
          <View
            style={[
              styles.characterBox,
              { backgroundColor: getItemColor(item.type) },
            ]}
          >
            <Text
              style={[
                styles.characterText,
                { color: getReadableTextColor(getItemColor(item.type)) },
                fontStyles.japaneseText,
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {item.characters}
            </Text>
          </View>

          <View style={styles.matchInfo}>
            <Text
              style={[styles.meaningText, { color: theme.textColor }]}
              numberOfLines={2}
            >
              {item.meaning}
            </Text>
            <View style={styles.matchMetadata}>
              <Text style={[styles.levelText, { color: theme.textLight }]}>
                Level {item.level}
              </Text>
            </View>
            {item.readings && item.readings.length > 0 && (
              <View style={styles.readingsContainer}>
                {item.readings.slice(0, 2).map((reading, index) => (
                  <View
                    key={index}
                    style={[
                      styles.readingBadge,
                      { backgroundColor: theme.isDark ? "#333" : "#f5f5f5" },
                      reading.primary && {
                        backgroundColor: subjectColors.kanji,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.readingText,
                        {
                          color: reading.primary
                            ? kanjiTextColor
                            : theme.textSecondary,
                        },
                        fontStyles.japaneseText,
                      ]}
                    >
                      {reading.reading}
                    </Text>
                  </View>
                ))}
                {item.readings.length > 2 && (
                  <Text
                    style={[styles.moreReadings, { color: theme.textLight }]}
                  >
                    +{item.readings.length - 2}
                  </Text>
                )}
              </View>
            )}
          </View>

          <Ionicons
            name="chevron-forward"
            size={20}
            color={theme.textSecondary}
          />
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.backgroundColor }]}
      >
        <View
          style={[styles.header, { backgroundColor: theme.backgroundColor }]}
        >
          <TouchableOpacity
            onPress={handleClose}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={theme.textColor} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.textColor }]}>
            Analyzing...
          </Text>
        </View>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Show input text with skeleton for translation/matches */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
                {isEnglishMode ? "Input & Translation" : "Analyzed Text"}
              </Text>
            </View>

            <View
              style={[
                styles.textCard,
                { backgroundColor: theme.cardBackground },
              ]}
            >
              {isEnglishMode && (
                <View style={styles.originalTextWrapper}>
                  <View style={styles.languageBadge}>
                    <Text style={styles.languageBadgeText}>EN</Text>
                  </View>
                  <Text
                    style={[styles.originalInputText, { color: theme.textColor }]}
                  >
                    {originalInput}
                  </Text>
                </View>
              )}

              {!isEnglishMode && (
                <View style={styles.japaneseTextWrapper}>
                  <View style={styles.textWithAudio}>
                    <View style={styles.highlightedTextContainer}>
                      <Text style={[styles.highlightedText, { color: theme.textColor }]}>
                        {originalInput}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Skeleton for translation/Japanese text */}
              <View style={styles.skeletonSection}>
                {isEnglishMode ? (
                  <View style={styles.japaneseTextWrapper}>
                    <View style={[styles.languageBadge, { backgroundColor: "#34C759" }]}>
                      <Text style={styles.languageBadgeText}>JA</Text>
                    </View>
                    <View style={styles.skeletonTextContainer}>
                      <Animated.View
                        style={[
                          styles.skeletonLine,
                          {
                            backgroundColor: theme.border,
                            width: "90%",
                            opacity: skeletonOpacity,
                          },
                        ]}
                      />
                      <Animated.View
                        style={[
                          styles.skeletonLine,
                          {
                            backgroundColor: theme.border,
                            width: "75%",
                            opacity: skeletonOpacity,
                          },
                        ]}
                      />
                    </View>
                  </View>
                ) : (
                  <View style={styles.translationWrapper}>
                    <View style={styles.skeletonTextContainer}>
                      <Animated.View
                        style={[
                          styles.skeletonLine,
                          {
                            backgroundColor: theme.border,
                            width: "85%",
                            opacity: skeletonOpacity,
                          },
                        ]}
                      />
                      <Animated.View
                        style={[
                          styles.skeletonLine,
                          {
                            backgroundColor: theme.border,
                            width: "60%",
                            opacity: skeletonOpacity,
                          },
                        ]}
                      />
                    </View>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Skeleton for vocabulary matches */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
                  Vocabulary Matches
                </Text>
              </View>
            </View>
            <View style={styles.skeletonMatchesContainer}>
              {[...Array(3)].map((_, index) => (
                <View
                  key={`vocab-skeleton-${index}`}
                  style={[
                    styles.skeletonMatchCard,
                    { backgroundColor: theme.cardBackground },
                  ]}
                >
                  <Animated.View
                    style={[
                      styles.skeletonCharacterBox,
                      {
                        backgroundColor: theme.border,
                        opacity: skeletonOpacity,
                      },
                    ]}
                  />
                  <View style={styles.skeletonMatchInfo}>
                    <Animated.View
                      style={[
                        styles.skeletonLine,
                        {
                          backgroundColor: theme.border,
                          width: "70%",
                          opacity: skeletonOpacity,
                        },
                      ]}
                    />
                    <Animated.View
                      style={[
                        styles.skeletonLine,
                        {
                          backgroundColor: theme.border,
                          width: "40%",
                          height: 12,
                          opacity: skeletonOpacity,
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Skeleton for kanji matches */}
          <View style={[styles.section, { marginBottom: 100 }]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
                  Kanji Matches
                </Text>
              </View>
            </View>
            <View style={styles.skeletonMatchesContainer}>
              {[...Array(2)].map((_, index) => (
                <View
                  key={`kanji-skeleton-${index}`}
                  style={[
                    styles.skeletonMatchCard,
                    { backgroundColor: theme.cardBackground },
                  ]}
                >
                  <Animated.View
                    style={[
                      styles.skeletonCharacterBox,
                      {
                        backgroundColor: theme.border,
                        opacity: skeletonOpacity,
                      },
                    ]}
                  />
                  <View style={styles.skeletonMatchInfo}>
                    <Animated.View
                      style={[
                        styles.skeletonLine,
                        {
                          backgroundColor: theme.border,
                          width: "60%",
                          opacity: skeletonOpacity,
                        },
                      ]}
                    />
                    <Animated.View
                      style={[
                        styles.skeletonLine,
                        {
                          backgroundColor: theme.border,
                          width: "35%",
                          height: 12,
                          opacity: skeletonOpacity,
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.backgroundColor }]}
      >
        <View
          style={[styles.header, { backgroundColor: theme.backgroundColor }]}
        >
          <TouchableOpacity
            onPress={handleClose}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={theme.textColor} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.textColor }]}>
            Error
          </Text>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={theme.error} />
          <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.primary }]}
            onPress={handleNewSearch}
            activeOpacity={0.7}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.backgroundColor }]}>
        <TouchableOpacity
          onPress={handleClose}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={theme.textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textColor }]}>
          Results
        </Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleShowHistory}
            activeOpacity={0.7}
          >
            <Ionicons name="time-outline" size={24} color={theme.textColor} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleNewSearch}
            activeOpacity={0.7}
          >
            <Ionicons
              name="document-text-outline"
              size={24}
              color={theme.textColor}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Input Text Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
              {isEnglishMode ? "Input & Translation" : "Analyzed Text"}
            </Text>
          </View>

          <View
            style={[
              styles.textCard,
              { backgroundColor: theme.cardBackground },
            ]}
          >
            {isEnglishMode && (
              <View style={styles.originalTextWrapper}>
                <View style={styles.languageBadge}>
                  <Text style={styles.languageBadgeText}>EN</Text>
                </View>
                <Text
                  style={[styles.originalInputText, { color: theme.textColor }]}
                >
                  {originalInput}
                </Text>
              </View>
            )}

            <View style={styles.japaneseTextWrapper}>
              {isEnglishMode && (
                <View style={[styles.languageBadge, { backgroundColor: "#34C759" }]}>
                  <Text style={styles.languageBadgeText}>JA</Text>
                </View>
              )}
              <View style={styles.textWithAudio}>
                <View style={styles.highlightedTextContainer}>
                  {highlightMatchesInText(japaneseText)}
                </View>
                <TouchableOpacity
                  style={[
                    styles.audioButton,
                    isSpeaking && styles.audioButtonActive,
                  ]}
                  onPress={() => handleSpeak(japaneseText)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isSpeaking ? "stop" : "play"}
                    size={16}
                    color={isSpeaking ? "#fff" : subjectColors.vocabulary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {!isEnglishMode && (
              <View style={styles.translationWrapper}>
                {isTranslating ? (
                  <View style={styles.translatingRow}>
                    <ActivityIndicator size="small" color={theme.primary} />
                    <Text
                      style={[
                        styles.translationText,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Translating...
                    </Text>
                  </View>
                ) : translation ? (
                  <Text
                    style={[
                      styles.translationText,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {translation}
                  </Text>
                ) : null}
              </View>
            )}
          </View>
        </View>

        {/* Vocabulary Matches Section */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => setVocabularyCollapsed(!vocabularyCollapsed)}
            activeOpacity={0.7}
          >
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
                Vocabulary Matches
              </Text>
              {vocabularyMatches.length > 0 && (
                <View
                  style={[
                    styles.countBadge,
                    { backgroundColor: subjectColors.vocabulary },
                  ]}
                >
                  <Text style={styles.countBadgeText}>
                    {vocabularyMatches.length}
                  </Text>
                </View>
              )}
            </View>
            <Ionicons
              name={vocabularyCollapsed ? "chevron-down" : "chevron-up"}
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          {!vocabularyCollapsed &&
            (vocabularyMatches.length === 0 ? (
              <View
                style={[
                  styles.emptyCard,
                  { backgroundColor: theme.cardBackground },
                ]}
              >
                <Ionicons
                  name="search-outline"
                  size={40}
                  color={theme.textLight}
                />
                <Text
                  style={[styles.emptyText, { color: theme.textSecondary }]}
                >
                  No vocabulary matches found
                </Text>
              </View>
            ) : (
              <View style={styles.matchList}>
                <FlashList
                  data={vocabularyMatches}
                  renderItem={({ item, index }) =>
                    renderVocabularyMatch({ item, index })
                  }
                  keyExtractor={(item) => item.id.toString()}
                  scrollEnabled={false}
                  contentContainerStyle={styles.listContent}
                />
              </View>
            ))}
        </View>

        {/* Kanji Matches Section */}
        <View style={[styles.section, { marginBottom: 100 }]}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => setKanjiCollapsed(!kanjiCollapsed)}
            activeOpacity={0.7}
          >
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
                Kanji Matches
              </Text>
              {kanjiMatches.length > 0 && (
                <View
                  style={[
                    styles.countBadge,
                    { backgroundColor: subjectColors.kanji },
                  ]}
                >
                  <Text style={styles.countBadgeText}>
                    {kanjiMatches.length}
                  </Text>
                </View>
              )}
            </View>
            <Ionicons
              name={kanjiCollapsed ? "chevron-down" : "chevron-up"}
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          {!kanjiCollapsed &&
            (kanjiMatches.length === 0 ? (
              <View
                style={[
                  styles.emptyCard,
                  { backgroundColor: theme.cardBackground },
                ]}
              >
                <Ionicons
                  name="search-outline"
                  size={40}
                  color={theme.textLight}
                />
                <Text
                  style={[styles.emptyText, { color: theme.textSecondary }]}
                >
                  No kanji matches found
                </Text>
              </View>
            ) : (
              <View style={styles.matchList}>
                <FlashList
                  data={kanjiMatches}
                  renderItem={({ item, index }) =>
                    renderKanjiMatch({ item, index })
                  }
                  keyExtractor={(item) => item.id.toString()}
                  scrollEnabled={false}
                  contentContainerStyle={styles.listContent}
                />
              </View>
            ))}
        </View>
      </ScrollView>

      {/* Tooltip Modal */}
      {tooltipReady && (
        <VocabularyTooltip
          selectedItem={selectedItem}
          position={tooltipPosition}
          opacity={tooltipOpacity}
          selectedSurfaceText={selectedSurfaceText}
          onClose={handleCloseTooltip}
          onViewDetails={handleViewDetails}
        />
      )}
    </View>
  );
}

const createStyles = (subjectColors: ReturnType<typeof useSubjectColors>) =>
  StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
  // Skeleton loading styles
  skeletonSection: {
    marginTop: 12,
  },
  skeletonTextContainer: {
    flex: 1,
    gap: 8,
  },
  skeletonLine: {
    height: 20,
    borderRadius: 4,
  },
  skeletonMatchesContainer: {
    gap: 10,
  },
  skeletonMatchCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 14,
    shadowColor: "rgba(0,0,0,0.08)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
  },
  skeletonCharacterBox: {
    width: 56,
    height: 56,
    borderRadius: 10,
    marginRight: 14,
  },
  skeletonMatchInfo: {
    flex: 1,
    gap: 8,
  },
  // Sections
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 24,
    alignItems: "center",
  },
  countBadgeText: {
    color: "white",
    fontSize: 13,
    fontWeight: "bold",
  },
  // Text Card
  textCard: {
    borderRadius: 16,
    padding: 16,
    shadowColor: "rgba(0,0,0,0.1)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
  },
  originalTextWrapper: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,122,255,0.2)",
  },
  languageBadge: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 12,
  },
  languageBadgeText: {
    color: "white",
    fontSize: 11,
    fontWeight: "700",
  },
  originalInputText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
  },
  japaneseTextWrapper: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  textWithAudio: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  highlightedTextContainer: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
  },
  audioButton: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: withAlpha(subjectColors.vocabulary, 0.1),
    marginLeft: 8,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 36,
    minHeight: 36,
  },
  audioButtonActive: {
    backgroundColor: subjectColors.vocabulary,
  },
  translationWrapper: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: withAlpha(subjectColors.vocabulary, 0.2),
  },
  translatingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  translationText: {
    fontSize: 15,
    fontStyle: "italic",
    marginLeft: 8,
  },
  // Highlighted text
  textSegmentWrapper: {
    height: 36,
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  highlightedText: {
    fontSize: 18,
    lineHeight: 26,
  },
  highlightedMatch: {
    paddingHorizontal: 8,
    borderRadius: 10,
    height: 32,
    marginHorizontal: 2,
    shadowColor: "rgba(0,0,0,0.2)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  highlightedMatchText: {
    fontSize: 18,
    lineHeight: 24,
    color: "white",
    fontWeight: "600",
  },
  highlightTouchable: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 2,
  },
  // Match cards
  matchList: {
    minHeight: 100,
  },
  listContent: {
    paddingBottom: 16,
  },
  matchCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: "rgba(0,0,0,0.08)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  characterBox: {
    width: 56,
    height: 56,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  characterText: {
    fontSize: 22,
    fontWeight: "bold",
    color: "white",
    textAlign: "center",
  },
  matchInfo: {
    flex: 1,
  },
  meaningText: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
  },
  matchMetadata: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  levelText: {
    fontSize: 13,
  },
  readingsContainer: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  readingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginRight: 6,
    marginBottom: 2,
  },
  readingText: {
    fontSize: 13,
    fontWeight: "500",
  },
  moreReadings: {
    fontSize: 11,
    fontStyle: "italic",
  },
  // Empty state
  emptyCard: {
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    shadowColor: "rgba(0,0,0,0.1)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyText: {
    fontSize: 15,
    marginTop: 12,
    textAlign: "center",
  },
});
