import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, {
    ReactElement,
    useCallback,
    useEffect,
    useMemo,
    useState
} from "react";
import {
    ActivityIndicator,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { WaniKaniItemType } from "../../src/types/wanikani";
import { azureSpeechService } from "../../src/utils/azureSpeech";
import { azureTranslatorService } from "../../src/utils/azureTranslator";
import { getAllSubjects } from "../../src/utils/cache";
import { fontStyles } from "../../src/utils/fonts";
import { getStoredJpdbApiKey } from "../../src/utils/jpdbApi";
import {
  findVocabularyMatchesWithJpdbFirstPass as findMatchesWithJpdb,
  type JpdbParsedTokenAnnotation,
} from "../../src/utils/textHighlighting";
import {
  getReadableTextColor,
  useSubjectColors,
  withAlpha,
} from "../../src/utils/subjectColors";
import { useTheme } from "../../src/utils/theme";

interface VocabularyMatch {
  id: number;
  characters: string;
  meaning: string;
  type: WaniKaniItemType;
  level: number;
  readings?: { reading: string; primary: boolean }[];
  // OCR-specific properties
  positions?: {
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
}

interface KanjiMatch {
  id: number;
  characters: string;
  meaning: string;
  type: WaniKaniItemType;
  level: number;
  readings?: { reading: string; primary: boolean }[];
  // OCR-specific properties
  positions?: {
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
}

interface TextRegion {
  text: string;
  frame: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

type StudyMode = "none" | "wk" | "full";

export default function OCRResultsScreen() {
  const { theme } = useTheme();
  const subjectColors = useSubjectColors();
  const kanjiTextColor = getReadableTextColor(subjectColors.kanji);
  const vocabularyTextColor = getReadableTextColor(subjectColors.vocabulary);
  const styles = useMemo(
    () => createStyles(subjectColors),
    [subjectColors.kanji, subjectColors.radical, subjectColors.vocabulary]
  );
  const router = useRouter();
  const { recognizedText, originalText, imageUri, textRegions } = useLocalSearchParams<{
    recognizedText: string;
    originalText: string;
    imageUri: string;
    textRegions: string; // JSON stringified array of TextRegion[]
  }>();

  const [vocabularyMatches, setVocabularyMatches] = useState<VocabularyMatch[]>([]);
  const [kanjiMatches, setKanjiMatches] = useState<KanjiMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [translationLines, setTranslationLines] = useState<string[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [textLines, setTextLines] = useState<string[]>([]);
  const [studyMode, setStudyMode] = useState<StudyMode>("wk");
  const [hasStoredJpdbApiKey, setHasStoredJpdbApiKey] = useState(false);
  const [jpdbParsedTokens, setJpdbParsedTokens] = useState<JpdbParsedTokenAnnotation[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [playingLineIndex, setPlayingLineIndex] = useState<number | null>(null);
  const [vocabularyCollapsed, setVocabularyCollapsed] = useState(false);
  const [kanjiCollapsed, setKanjiCollapsed] = useState(false);
  
  const parsedTextRegions: TextRegion[] = textRegions ? JSON.parse(textRegions) : [];
  const grammarUnderlineColor = theme.isDark ? "#fbbf24" : "#b45309";
  const verbUnderlineColor = theme.isDark ? "#34d399" : "#0f766e";
  const vocabUnderlineColor = theme.isDark ? "#60a5fa" : "#1d4ed8";
  const fullModeEnabled = studyMode === "full" && hasStoredJpdbApiKey;
  const wkVocabularyMatches = useMemo(
    () => vocabularyMatches.filter((match) => match.id > 0),
    [vocabularyMatches]
  );
  const wkKanjiMatches = useMemo(
    () => kanjiMatches.filter((match) => match.id > 0),
    [kanjiMatches]
  );
  const lineOffsets = useMemo(() => {
    let cursor = 0;
    return textLines.map((line) => {
      const start = cursor;
      cursor += line.length + 1;
      return start;
    });
  }, [textLines]);
  
  // Debug: log the parsed regions
  useEffect(() => {
    console.log('Parsed text regions:', parsedTextRegions);
    console.log('Image URI:', imageUri);
  }, [parsedTextRegions, imageUri]);

  useEffect(() => {
    let didCancel = false;

    const loadJpdbApiKey = async () => {
      try {
        const storedKey = await getStoredJpdbApiKey();
        if (!didCancel) {
          setHasStoredJpdbApiKey(Boolean(storedKey));
        }
      } catch (error) {
        console.error("Failed to read JPDB API key in OCR results:", error);
        if (!didCancel) {
          setHasStoredJpdbApiKey(false);
        }
      }
    };

    void loadJpdbApiKey();

    return () => {
      didCancel = true;
    };
  }, []);
  

  useEffect(() => {
    if (recognizedText) {
      const lines = recognizedText.split('\n').filter(line => line.trim().length > 0);
      setTextLines(lines);
      findVocabularyMatches(recognizedText);
      translateLines(lines);
    }
  }, [recognizedText]);


  const translateLines = async (lines: string[]) => {
    try {
      setIsTranslating(true);
      setTranslationLines([]);
      
      // Translate each line individually
      const translations: string[] = [];
      for (const line of lines) {
        try {
          const translatedLine = await azureTranslatorService.translate(line);
          translations.push(translatedLine || '');
        } catch (err) {
          console.error(`Error translating line "${line}":`, err);
          translations.push('');
        }
      }
      
      setTranslationLines(translations);
    } catch (err) {
      console.error("Error translating lines:", err);
      setTranslationLines([]);
    } finally {
      setIsTranslating(false);
    }
  };

  const findVocabularyMatches = async (text: string) => {
    try {
      setIsLoading(true);
      setError(null);

      // Get all subjects from cache
      const allSubjects = await getAllSubjects();
      const {
        vocabularyMatches: parsedVocabularyMatches,
        kanjiMatches: parsedKanjiMatches,
        jpdbParsedTokens: parsedTokens,
      } = await findMatchesWithJpdb(text, allSubjects);

      const vocabularyWithPositions: VocabularyMatch[] = parsedVocabularyMatches.map((match) => ({
        ...match,
        positions: findCharacterPositions(match.characters, parsedTextRegions),
      }));
      const kanjiWithPositions: KanjiMatch[] = parsedKanjiMatches.map((match) => ({
        ...match,
        positions: findCharacterPositions(match.characters, parsedTextRegions),
      }));

      console.log(
        "Vocabulary matches found:",
        vocabularyWithPositions.map((m) => m.characters)
      );
      console.log(
        "Kanji matches found:",
        kanjiWithPositions.map((m) => m.characters)
      );

      setVocabularyMatches(vocabularyWithPositions);
      setKanjiMatches(kanjiWithPositions);
      setJpdbParsedTokens(Array.isArray(parsedTokens) ? parsedTokens : []);
    } catch (err) {
      console.error("Error finding vocabulary matches:", err);
      setError("Failed to find vocabulary matches");
      setJpdbParsedTokens([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Find positions of characters within text regions
  const findCharacterPositions = (characters: string, regions: TextRegion[]) => {
    const positions: {
      x: number;
      y: number;
      width: number;
      height: number;
    }[] = [];

    regions.forEach((region) => {
      if (region.text.includes(characters)) {
        // For now, use the entire region's frame
        // In a more sophisticated implementation, we could calculate 
        // the exact position within the region based on character index
        positions.push({
          x: region.frame.x,
          y: region.frame.y,
          width: region.frame.width,
          height: region.frame.height,
        });
      }
    });

    return positions;
  };

  const selectStudyMode = useCallback(
    (mode: StudyMode) => {
      if (mode === "full" && !hasStoredJpdbApiKey) {
        router.push({
          pathname: "/settings",
          params: { scrollTo: "jpdbApiKey" },
        });
        return;
      }
      setStudyMode(mode);
    },
    [hasStoredJpdbApiKey, router]
  );

  const handleVocabularyPress = useCallback(
    (vocabularyId: number) => {
      router.push(`/subject/${vocabularyId}`);
    },
    [router]
  );

  const handleKanjiPress = useCallback(
    (kanjiId: number) => {
      router.push(`/subject/${kanjiId}`);
    },
    [router]
  );

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
      type: WaniKaniItemType;
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
              if (highlight.type === 'kanji') {
                handleKanjiPress(highlight.id);
              } else {
                handleVocabularyPress(highlight.id);
              }
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

  const renderUnderlinedAnalyzedText = (
    text: string,
    textStartOffset: number
  ): ReactElement => {
    if (!text) {
      return (
        <Text
          style={[styles.recognizedTextLine, { color: theme.textColor }, fontStyles.japaneseText]}
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

    const textEndOffset = textStartOffset + text.length;
    const inlineSegments: ParsedInlineSegment[] = [];

    if (jpdbParsedTokens.length === 0) {
      inlineSegments.push({
        text,
        tokenType: "plain",
      });
    } else {
      const lineTokens = jpdbParsedTokens
        .filter(
          (token) =>
            token.start >= textStartOffset &&
            token.end <= textEndOffset &&
            token.end > token.start
        )
        .sort((a, b) => {
          if (a.start !== b.start) {
            return a.start - b.start;
          }
          return b.end - b.start - (a.end - a.start);
        });

      let cursor = 0;
      for (const token of lineTokens) {
        const localStart = token.start - textStartOffset;
        const localEnd = token.end - textStartOffset;
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
      styles.recognizedTextLine,
      { color: theme.textColor },
      fontStyles.japaneseText,
      styles.lineText,
    ];

    return (
      <View style={styles.underlinedInlineContainer}>
        {inlineSegments.flatMap((segment, index) => {
          const renderedNodes: ReactElement[] = [];

          if (segment.tokenType === "plain" || !segment.token) {
            renderedNodes.push(
              <Text key={`plain-${textStartOffset}-${index}`} style={baseTextStyle}>
                {segment.text}
              </Text>
            );
            return renderedNodes;
          }

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

          renderedNodes.push(
            <View
              key={`token-${textStartOffset}-${index}-${segment.token.start}-${segment.token.end}`}
              style={styles.underlinedTokenWrapper}
            >
              <Text
                style={[
                  baseTextStyle,
                  styles.inlineUnderlineToken,
                  { borderBottomColor: tokenUnderlineColor },
                ]}
              >
                {segment.text}
              </Text>
            </View>
          );

          const nextSegment = inlineSegments[index + 1];
          const hasAdjacentHighlightedSegment =
            nextSegment &&
            nextSegment.tokenType !== "plain" &&
            Boolean(nextSegment.token);
          if (hasAdjacentHighlightedSegment) {
            renderedNodes.push(
              <Text
                key={`sep-${textStartOffset}-${index}`}
                style={[baseTextStyle, styles.inlineUnderlineSeparator]}
              >
                {"\u200A"}
              </Text>
            );
          }

          return renderedNodes;
        })}
      </View>
    );
  };

  const handleClose = useCallback(() => {
    try {
      // If there is history, go back. Otherwise, go to home.
      // @ts-ignore - canGoBack exists in expo-router at runtime
      if (typeof router.canGoBack === 'function' && router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
    } catch {
      router.replace('/');
    }
  }, [router]);

  const handleRetryOCR = useCallback(() => {
    router.replace("/camera-ocr");
  }, [router]);

  const handleSpeak = useCallback(async (text: string, lineIndex?: number) => {
    // If this specific line is currently playing, stop it
    if (lineIndex !== undefined && playingLineIndex === lineIndex) {
      await azureSpeechService.stop();
      setIsSpeaking(false);
      setPlayingLineIndex(null);
      return;
    }

    // If any speech is playing, stop it first
    if (isSpeaking) {
      await azureSpeechService.stop();
    }

    try {
      setIsSpeaking(true);
      setPlayingLineIndex(lineIndex ?? null);
      await azureSpeechService.speak(
        text,
        () => console.log("Speech started"),
        () => {
          console.log("Speech finished");
          setIsSpeaking(false);
          setPlayingLineIndex(null);
        },
        (error) => {
          console.error("Speech error:", error);
          setIsSpeaking(false);
          setPlayingLineIndex(null);
        }
      );
    } catch (error) {
      console.error("Error starting speech:", error);
      setIsSpeaking(false);
      setPlayingLineIndex(null);
    }
  }, [isSpeaking, playingLineIndex]);

  const getItemColor = (type: WaniKaniItemType) => {
    return subjectColors.getColorForType(type);
  };


  const renderImage = () => {
    return (
      <View style={styles.imageContainer}>
        <Image 
          source={{ uri: imageUri }} 
          style={styles.image}
          resizeMode="contain"
        />
      </View>
    );
  };

  const renderVocabularyMatch = ({
    item,
  }: {
    item: VocabularyMatch;
    index: number;
  }) => {
    
    return (
      <TouchableOpacity
        style={[
          styles.vocabularyCard,
          { 
            backgroundColor: theme.cardBackground,
          },
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
              {item.positions && item.positions.length > 0 && (
                <Text
                  style={[styles.positionCount, { color: theme.textSecondary }]}
                >
                  • {item.positions.length} location{item.positions.length !== 1 ? 's' : ''}
                </Text>
              )}
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
  }: {
    item: KanjiMatch;
    index: number;
  }) => {
    
    return (
      <TouchableOpacity
        style={[
          styles.vocabularyCard,
          { 
            backgroundColor: theme.cardBackground,
          },
        ]}
        activeOpacity={0.7}
        onPress={() => handleKanjiPress(item.id)}
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
              {item.positions && item.positions.length > 0 && (
                <Text
                  style={[styles.positionCount, { color: theme.textSecondary }]}
                >
                  • {item.positions.length} location{item.positions.length !== 1 ? 's' : ''}
                </Text>
              )}
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
        <Text style={[styles.headerTitle, { color: theme.textColor }]}>OCR Results</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleRetryOCR}
          activeOpacity={0.7}
        >
          <Ionicons name="camera" size={24} color={theme.textColor} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Image with highlights */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
              Detected Text
            </Text>
            <View style={styles.studyModeSelector}>
              <TouchableOpacity
                style={[
                  styles.studyModeChip,
                  { borderColor: theme.border, backgroundColor: theme.cardBackground },
                  studyMode === "none" && { backgroundColor: theme.textSecondary },
                ]}
                onPress={() => selectStudyMode("none")}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.studyModeChipText,
                    { color: studyMode === "none" ? "white" : theme.textColor },
                  ]}
                >
                  No
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.studyModeChip,
                  { borderColor: theme.border, backgroundColor: theme.cardBackground },
                  studyMode === "wk" && { backgroundColor: theme.primary },
                ]}
                onPress={() => selectStudyMode("wk")}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.studyModeChipText,
                    { color: studyMode === "wk" ? "white" : theme.textColor },
                  ]}
                >
                  WK
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.studyModeChip,
                  { borderColor: theme.border, backgroundColor: theme.cardBackground },
                  studyMode === "full" && hasStoredJpdbApiKey
                    ? { backgroundColor: theme.primary }
                    : null,
                ]}
                onPress={() => selectStudyMode("full")}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.studyModeChipText,
                    {
                      color:
                        studyMode === "full" && hasStoredJpdbApiKey
                          ? "white"
                          : hasStoredJpdbApiKey
                            ? theme.textColor
                            : theme.textSecondary,
                    },
                  ]}
                >
                  JPDB
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {renderImage()}
          
          {/* Recognized text display with line-by-line layout */}
          <View style={[styles.recognizedTextCard, { backgroundColor: theme.cardBackground }]}>
            {textLines.length > 1 ? (
              // Multiple lines - show line by line with translations
              <View style={styles.linesContainer}>
                {textLines.map((line, index) => (
                  <View key={index} style={index === textLines.length - 1 ? styles.lineContainer : styles.lineContainerWithDivider}>
                    <View style={styles.lineWithAudio}>
                      {studyMode === "none" ? (
                        <Text
                          style={[
                            styles.recognizedTextLine,
                            { color: theme.textColor },
                            fontStyles.japaneseText,
                            styles.lineText,
                          ]}
                        >
                          {line}
                        </Text>
                      ) : fullModeEnabled ? (
                        renderUnderlinedAnalyzedText(line, lineOffsets[index] ?? 0)
                      ) : (
                        <View style={styles.highlightedInlineWrap}>
                          {highlightMatchesInText(line)}
                        </View>
                      )}
                      <TouchableOpacity
                        style={[
                          styles.audioButton,
                          playingLineIndex === index && styles.audioButtonActive,
                        ]}
                        onPress={() => handleSpeak(line, index)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={playingLineIndex === index ? "stop" : "play"}
                          size={14}
                          color={
                            playingLineIndex === index
                              ? "#fff"
                              : subjectColors.vocabulary
                          }
                        />
                      </TouchableOpacity>
                    </View>
                    {isTranslating ? (
                      <View style={styles.lineTranslationContainer}>
                        <ActivityIndicator size="small" color={theme.primary} />
                        <Text style={[styles.translationText, { color: theme.textSecondary }]}>
                          Translating...
                        </Text>
                      </View>
                    ) : translationLines[index] ? (
                      <View style={styles.lineTranslationContainer}>
                        <Text style={[styles.translationText, { color: theme.textSecondary }]}>
                          {translationLines[index]}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : (
              // Single line - show with translation
              <>
                <View style={styles.lineWithAudio}>
                  {studyMode === "none" ? (
                    <Text
                      style={[
                        styles.recognizedText,
                        { color: theme.textColor },
                        fontStyles.japaneseText,
                        styles.lineText,
                      ]}
                    >
                      {recognizedText}
                    </Text>
                  ) : fullModeEnabled ? (
                    renderUnderlinedAnalyzedText(recognizedText, 0)
                  ) : (
                    <View style={styles.highlightedInlineWrap}>
                      {highlightMatchesInText(recognizedText)}
                    </View>
                  )}
                  <TouchableOpacity
                    style={[
                      styles.audioButton,
                      playingLineIndex === 0 && styles.audioButtonActive,
                    ]}
                    onPress={() => handleSpeak(recognizedText, 0)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={playingLineIndex === 0 ? "stop" : "play"}
                      size={14}
                      color={
                        playingLineIndex === 0
                          ? "#fff"
                          : subjectColors.vocabulary
                      }
                    />
                  </TouchableOpacity>
                </View>
                
                {isTranslating ? (
                  <View style={styles.translationContainer}>
                    <ActivityIndicator size="small" color={theme.primary} />
                    <Text style={[styles.translationText, { color: theme.textSecondary }]}>
                      Translating...
                    </Text>
                  </View>
                ) : translationLines[0] ? (
                  <View style={styles.translationContainer}>
                    <Text style={[styles.translationText, { color: theme.textSecondary }]}>
                      {translationLines[0]}
                    </Text>
                  </View>
                ) : null}
              </>
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
            <View style={styles.sectionTitleContainer}>
              <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
                Vocabulary Matches
              </Text>
              {wkVocabularyMatches.length > 0 && (
                <View
                  style={[
                    styles.matchCountBadge,
                    { backgroundColor: subjectColors.vocabulary },
                  ]}
                >
                  <Text
                    style={[styles.matchCountText, { color: vocabularyTextColor }]}
                  >
                    {wkVocabularyMatches.length}
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

          {!vocabularyCollapsed && (isLoading ? (
            <View
              style={[
                styles.loadingCard,
                { backgroundColor: theme.cardBackground },
              ]}
            >
              <ActivityIndicator size="large" color={theme.primary} />
              <Text
                style={[styles.loadingText, { color: theme.textSecondary }]}
              >
                Searching for vocabulary matches...
              </Text>
            </View>
          ) : error ? (
            <View
              style={[
                styles.errorCard,
                { backgroundColor: theme.cardBackground },
              ]}
            >
              <Ionicons
                name="alert-circle-outline"
                size={48}
                color={theme.error}
              />
              <Text style={[styles.errorText, { color: theme.error }]}>
                {error}
              </Text>
            </View>
          ) : wkVocabularyMatches.length === 0 ? (
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
                Try with an image containing more Japanese vocabulary
              </Text>
            </View>
          ) : (
            <View style={styles.vocabularyList}>
              <FlashList
                data={wkVocabularyMatches}
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
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => setKanjiCollapsed(!kanjiCollapsed)}
            activeOpacity={0.7}
          >
            <View style={styles.sectionTitleContainer}>
              <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
                Kanji Matches
              </Text>
              {wkKanjiMatches.length > 0 && (
                <View
                  style={[
                    styles.matchCountBadge,
                    { backgroundColor: subjectColors.kanji },
                  ]}
                >
                  <Text style={[styles.matchCountText, { color: kanjiTextColor }]}>
                    {wkKanjiMatches.length}
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

          {!kanjiCollapsed && (isLoading ? (
            <View
              style={[
                styles.loadingCard,
                { backgroundColor: theme.cardBackground },
              ]}
            >
              <ActivityIndicator size="large" color={theme.primary} />
              <Text
                style={[styles.loadingText, { color: theme.textSecondary }]}
              >
                Searching for kanji matches...
              </Text>
            </View>
          ) : error ? (
            <View
              style={[
                styles.errorCard,
                { backgroundColor: theme.cardBackground },
              ]}
            >
              <Ionicons
                name="alert-circle-outline"
                size={48}
                color={theme.error}
              />
              <Text style={[styles.errorText, { color: theme.error }]}>
                {error}
              </Text>
            </View>
          ) : wkKanjiMatches.length === 0 ? (
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
                data={wkKanjiMatches}
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
  studyModeSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  studyModeChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  studyModeChipText: {
    fontSize: 11,
    fontWeight: "700",
  },
  sectionTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  lineWithAudio: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  lineText: {
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  speakButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 32,
    minHeight: 24,
  },
  imageContainer: {
    position: 'relative',
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  image: {
    width: '100%',
    height: 250,
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
  recognizedText: {
    fontSize: 18,
    lineHeight: 28,
    marginBottom: 8,
  },
  linesContainer: {
    gap: 12,
  },
  lineContainer: {
    paddingBottom: 8,
    marginBottom: 8,
  },
  lineContainerWithDivider: {
    paddingBottom: 8,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: withAlpha(subjectColors.vocabulary, 0.1),
  },
  recognizedTextLine: {
    fontSize: 18,
    lineHeight: 28,
    marginBottom: 4,
  },
  lineTranslationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 4,
  },
  translationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: withAlpha(subjectColors.vocabulary, 0.2),
  },
  translationText: {
    fontSize: 16,
    fontStyle: 'italic',
    marginLeft: 8,
  },
  highlightedText: {
    fontSize: 18,
  },
  highlightedInlineWrap: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
  },
  underlinedInlineContainer: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
  },
  underlinedTokenWrapper: {
    borderRadius: 8,
    marginHorizontal: 0.6,
  },
  inlineUnderlineToken: {
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
  inlineUnderlineSeparator: {
    opacity: 0,
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
    fontSize: 18,
    lineHeight: 24,
    color: "white",
    fontWeight: "600",
    textAlign: "center",
  },
  highlightTouchable: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 2,
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
  positionCount: {
    fontSize: 12,
    marginLeft: 8,
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
  loadingCard: {
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    shadowColor: "rgba(0,0,0,0.1)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: "center",
  },
  errorCard: {
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    shadowColor: "rgba(0,0,0,0.1)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
  },
  errorText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: "center",
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
  numberBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  numberBadgeText: {
    color: "white",
    fontSize: 14,
    fontWeight: "bold",
  },
});
