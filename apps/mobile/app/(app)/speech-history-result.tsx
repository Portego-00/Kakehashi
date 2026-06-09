import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, {
    ReactElement,
    useCallback,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { WaniKaniItemType } from "../../src/types/wanikani";
import { azureSpeechService } from "../../src/utils/azureSpeech";
import { fontStyles } from "../../src/utils/fonts";
import {
  getReadableTextColor,
  useSubjectColors,
  withAlpha,
} from "../../src/utils/subjectColors";
import { useTheme } from "../../src/utils/theme";
import { type SpeechHistoryItem, formatHistoryTimestamp } from '../../src/utils/searchHistory';

export default function SpeechHistoryResultScreen() {
  const { theme } = useTheme();
  const subjectColors = useSubjectColors();
  const kanjiTextColor = getReadableTextColor(subjectColors.kanji);
  const vocabularyTextColor = getReadableTextColor(subjectColors.vocabulary);
  const styles = useMemo(
    () => createStyles(subjectColors),
    [subjectColors.kanji, subjectColors.radical, subjectColors.vocabulary]
  );
  const router = useRouter();
  const params = useLocalSearchParams<{
    historyItem: string;
  }>();

  // Parse the history item from the parameters
  const historyItem: SpeechHistoryItem = JSON.parse(params.historyItem || '{}');
  
  const {
    recognizedText,
    originalText,
    translation,
    vocabularyMatches,
    kanjiMatches,
    isEnglishMode,
    timestamp,
  } = historyItem;

  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleVocabularyPress = useCallback(
    (vocabularyId: number) => {
      router.push(`/subject/${vocabularyId}`);
    },
    [router]
  );

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  const handleRetryRecording = useCallback(() => {
    router.replace("/translator");
  }, [router]);

  const handleShowHistory = useCallback(() => {
    router.push('/speech-history');
  }, [router]);

  const handleSpeak = useCallback(async (text: string) => {
    if (isSpeaking) {
      // Stop current speech
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
  }, [isSpeaking]);

  const getItemColor = (type: WaniKaniItemType | string) => {
    return subjectColors.getColorForType(type as WaniKaniItemType);
  };

  const renderVocabularyMatch = ({
    item,
    index,
  }: {
    item: typeof vocabularyMatches[0];
    index: number;
  }) => {
    return (
      <TouchableOpacity
        style={[
          styles.vocabularyCard,
          { backgroundColor: theme.cardBackground },
        ]}
        activeOpacity={0.7}
        onPress={() => handleVocabularyPress(item.id)}
      >
        <View style={styles.cardHeader}>
          <View
            style={[
              styles.vocabularyBox,
              { backgroundColor: getItemColor(item.type) },
              item.characters.length > 2 && {
                width: 60 + (item.characters.length - 2) * 20,
              },
            ]}
          >
            <Text
              style={[
                styles.vocabularyCharacter,
                { color: getReadableTextColor(getItemColor(item.type)) },
                fontStyles.japaneseText,
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {item.characters}
            </Text>
          </View>

          <View style={styles.vocabularyInfo}>
            <Text
              style={[styles.vocabularyMeaning, { color: theme.textColor }]}
              numberOfLines={2}
            >
              {item.meaning}
            </Text>
            <View style={styles.vocabularyMetadata}>
              <Text
                style={[styles.vocabularyLevel, { color: theme.textLight }]}
              >
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
                        backgroundColor: subjectColors.vocabulary,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.readingText,
                        {
                          color: reading.primary
                            ? vocabularyTextColor
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
                    +{item.readings.length - 2} more
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
    index,
  }: {
    item: typeof kanjiMatches[0];
    index: number;
  }) => {
    return (
      <TouchableOpacity
        style={[
          styles.vocabularyCard,
          { backgroundColor: theme.cardBackground },
        ]}
        activeOpacity={0.7}
        onPress={() => handleVocabularyPress(item.id)}
      >
        <View style={styles.cardHeader}>
          <View
            style={[
              styles.vocabularyBox,
              { backgroundColor: getItemColor(item.type) },
            ]}
          >
            <Text
              style={[
                styles.vocabularyCharacter,
                { color: getReadableTextColor(getItemColor(item.type)) },
                fontStyles.japaneseText,
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {item.characters}
            </Text>
          </View>

          <View style={styles.vocabularyInfo}>
            <Text
              style={[styles.vocabularyMeaning, { color: theme.textColor }]}
              numberOfLines={2}
            >
              {item.meaning}
            </Text>
            <View style={styles.vocabularyMetadata}>
              <Text
                style={[styles.vocabularyLevel, { color: theme.textLight }]}
              >
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
                    +{item.readings.length - 2} more
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

  // Helper function to highlight matches in text
  const highlightMatchesInText = (text: string): ReactElement[] | null => {
    if (!text) return null;

    // Sort matches by length (longer first) to avoid partial matches
    const allMatches = [...vocabularyMatches, ...kanjiMatches].sort(
      (a, b) => b.characters.length - a.characters.length
    );

    let result = text;
    const highlights: {
      start: number;
      end: number;
      type: WaniKaniItemType | string;
      id: number;
      characters: string;
    }[] = [];

    // Find all matches and their positions
    allMatches.forEach((match) => {
      let startIndex = 0;
      while (true) {
        const index = result.indexOf(match.characters, startIndex);
        if (index === -1) break;

        // Check if this match overlaps with any existing highlight
        const overlaps = highlights.some(
          (h) =>
            (index >= h.start && index < h.end) ||
            (index + match.characters.length > h.start && index < h.end)
        );

        // Only add if it doesn't overlap or if it's a longer match
        if (
          !overlaps ||
          match.characters.length >
            highlights.find((h) => h.start <= index && h.end > index)
              ?.characters.length!
        ) {
          // Remove any overlapping shorter matches
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

    // Sort highlights by start position
    highlights.sort((a, b) => a.start - b.start);

    // Create text segments with highlights
    const segments: ReactElement[] = [];
    let lastIndex = 0;

    highlights.forEach((highlight, index) => {
      // Add text before highlight
      if (highlight.start > lastIndex) {
        segments.push(
          <View key={`text-${lastIndex}-${index}`} style={{ height: 36, justifyContent: "center", paddingTop: 4, paddingHorizontal: 4 }}>
            <Text
              style={[styles.highlightedText, { color: theme.textColor }]}
            >
              {result.slice(lastIndex, highlight.start)}
            </Text>
          </View>
        );
      }

      // Add highlighted text as pressable inline element with proper styling
      const color = getItemColor(highlight.type);
      segments.push(
        <View
          key={`highlight-${highlight.start}-${highlight.end}-${highlight.id}`}
          style={[styles.highlightedMatch, { backgroundColor: color }]}
        >
          <TouchableOpacity
            style={styles.highlightTouchable}
            onPress={() => {
              handleVocabularyPress(highlight.id);
            }}
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

    // Add remaining text
    if (lastIndex < result.length) {
      segments.push(
        <View key={`text-end-${lastIndex}`} style={{ height: 36, justifyContent: "center", paddingTop: 4, paddingHorizontal: 4 }}>
          <Text
            style={[styles.highlightedText, { color: theme.textColor }]}
          >
            {result.slice(lastIndex)}
          </Text>
        </View>
      );
    }

    return segments;
  };

  // Add ref for scrolling
  const scrollViewRef = useRef<ScrollView>(null);

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
        <Text style={[styles.headerTitle, { color: theme.textColor }]}>History Result</Text>
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
            onPress={handleRetryRecording}
            activeOpacity={0.7}
          >
            <Ionicons name="mic" size={24} color={theme.textColor} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Timestamp Section */}
        <View style={styles.section}>
          <View style={[styles.timestampCard, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.timestampContent}>
              <Ionicons name="time-outline" size={20} color={theme.textSecondary} />
              <Text style={[styles.timestampText, { color: theme.textSecondary }]}>
                Searched {formatHistoryTimestamp(timestamp)}
              </Text>
            </View>
          </View>
        </View>

        {/* Recognized Text Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
              Detected Text
            </Text>
          </View>
          
          <View style={[styles.recognizedTextCard, { backgroundColor: theme.cardBackground }]}>
            {isEnglishMode ? (
              <>
                {/* Show English original first */}
                <View style={styles.originalLanguageWrapper}>
                  <Text style={[styles.languageLabel, { color: theme.textSecondary }]}>
                    English:
                  </Text>
                  <Text
                    style={[
                      styles.originalLanguageText,
                      { color: theme.textColor },
                    ]}
                  >
                    {originalText}
                  </Text>
                </View>

                {/* Show Japanese translation with highlights and audio */}
                <View style={styles.lineWithAudio}>
                  <View style={styles.lineTextContainer}>
                    <Text style={[styles.languageLabel, { color: theme.textSecondary }]}>
                      Japanese Translation:
                    </Text>
                    <Text
                      style={[
                        styles.recognizedText,
                        { color: theme.textColor },
                        fontStyles.japaneseText,
                        styles.lineText,
                      ]}
                    >
                      {highlightMatchesInText(recognizedText)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.audioButton,
                      isSpeaking && styles.audioButtonActive,
                    ]}
                    onPress={() => handleSpeak(recognizedText)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={isSpeaking ? "stop" : "play"}
                      size={14}
                      color={isSpeaking ? "#fff" : subjectColors.vocabulary}
                    />
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View style={styles.lineWithAudio}>
                  <Text
                    style={[
                      styles.recognizedText,
                      { color: theme.textColor },
                      fontStyles.japaneseText,
                      styles.lineText,
                    ]}
                  >
                    {highlightMatchesInText(recognizedText)}
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.audioButton,
                      isSpeaking && styles.audioButtonActive,
                    ]}
                    onPress={() => handleSpeak(recognizedText)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={isSpeaking ? "stop" : "play"}
                      size={14}
                      color={isSpeaking ? "#fff" : subjectColors.vocabulary}
                    />
                  </TouchableOpacity>
                </View>

                {/* Translation below the text */}
                {translation && (
                  <View style={styles.translationContainer}>
                    <Text
                      style={[
                        styles.translationText,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {translation}
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
        </View>

        {/* Vocabulary Matches Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
              Vocabulary Matches
            </Text>
            {vocabularyMatches.length > 0 && (
              <View
                style={[
                  styles.matchCountBadge,
                  { backgroundColor: subjectColors.vocabulary },
                ]}
              >
                <Text
                  style={[styles.matchCountText, { color: vocabularyTextColor }]}
                >
                  {vocabularyMatches.length}
                </Text>
              </View>
            )}
          </View>

          {vocabularyMatches.length === 0 ? (
            <View
              style={[
                styles.emptyCard,
                { backgroundColor: theme.cardBackground },
              ]}
            >
              <Ionicons
                name="search-outline"
                size={48}
                color={theme.textLight}
              />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No vocabulary matches found
              </Text>
              <Text style={[styles.emptySubtext, { color: theme.textLight }]}>
                Try speaking more clearly or different words
              </Text>
            </View>
          ) : (
            <View style={styles.vocabularyList}>
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
          )}
        </View>

        {/* Kanji Matches Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
              Kanji Matches
            </Text>
            {kanjiMatches.length > 0 && (
              <View
                style={[
                  styles.matchCountBadge,
                  { backgroundColor: subjectColors.kanji },
                ]}
              >
                <Text style={[styles.matchCountText, { color: kanjiTextColor }]}>
                  {kanjiMatches.length}
                </Text>
              </View>
            )}
          </View>

          {kanjiMatches.length === 0 ? (
            <View
              style={[
                styles.emptyCard,
                { backgroundColor: theme.cardBackground },
              ]}
            >
              <Ionicons
                name="search-outline"
                size={48}
                color={theme.textLight}
              />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No kanji matches found
              </Text>
              <Text style={[styles.emptySubtext, { color: theme.textLight }]}>
                Individual kanji that are not part of vocabulary words
              </Text>
            </View>
          ) : (
            <View style={styles.vocabularyList}>
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
          )}
        </View>
      </ScrollView>

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
  content: {
    flex: 1,
  },
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  matchCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 24,
    alignItems: "center",
  },
  matchCountText: {
    color: "white",
    fontSize: 14,
    fontWeight: "bold",
  },
  timestampCard: {
    borderRadius: 12,
    padding: 12,
    shadowColor: "rgba(0,0,0,0.1)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
  },
  timestampContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  timestampText: {
    fontSize: 14,
    marginLeft: 8,
    fontStyle: "italic",
  },
  recognizedTextCard: {
    borderRadius: 12,
    padding: 16,
    shadowColor: "rgba(0,0,0,0.1)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
  },
  lineWithAudio: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  lineText: {
    flex: 1,
  },
  lineTextContainer: {
    flex: 1,
  },
  audioButton: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: withAlpha(subjectColors.vocabulary, 0.1),
    marginLeft: 8,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 32,
    minHeight: 32,
  },
  audioButtonActive: {
    backgroundColor: subjectColors.vocabulary,
  },
  recognizedText: {
    fontSize: 18,
    lineHeight: 28,
    marginBottom: 8,
  },
  vocabularyList: {
    // Remove minHeight to prevent excessive spacing
  },
  listContent: {
    paddingBottom: 16,
  },
  vocabularyCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "rgba(0,0,0,0.1)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  vocabularyBox: {
    width: 60,
    height: 60,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  vocabularyCharacter: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
    textAlign: "center",
  },
  vocabularyInfo: {
    flex: 1,
  },
  vocabularyMeaning: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  vocabularyMetadata: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  vocabularyLevel: {
    fontSize: 14,
  },
  readingsContainer: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  readingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 4,
  },
  readingText: {
    fontSize: 14,
    fontWeight: "500",
  },
  moreReadings: {
    fontSize: 12,
    fontStyle: "italic",
  },
  emptyCard: {
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    shadowColor: "rgba(0,0,0,0.1)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  highlightedText: {
    fontSize: 20,
  },
  highlightedMatch: {
    paddingHorizontal: 8,
    borderRadius: 12,
    shadowColor: "rgba(0,0,0,0.2)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
    height: 32,
  },
  highlightedMatchText: {
    fontSize: 20,
    lineHeight: 24,
    color: "white",
    fontWeight: "600",
    textAlign: "center",
  },
  highlightTouchable: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    // paddingHorizontal: 10,
    paddingVertical: 2,
  },
  translationContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: withAlpha(subjectColors.vocabulary, 0.2),
  },
  translationText: {
    fontSize: 16,
    fontStyle: "italic",
    marginLeft: 8,
  },
  originalLanguageWrapper: {
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
    backgroundColor: withAlpha(subjectColors.radical, 0.05),
    borderLeftWidth: 4,
    borderLeftColor: subjectColors.radical,
  },
  languageLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  originalLanguageText: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: "500",
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
});
