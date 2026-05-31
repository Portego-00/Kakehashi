import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "expo-router/react-navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  enableLayoutAnimations,
  FadeIn,
  FadeInDown,
  FadeOutUp,
  LinearTransition,
  useAnimatedRef,
} from "react-native-reanimated";
import { SvgXml } from "react-native-svg";
import PagerView from "react-native-pager-view";
import { SRS_COLORS } from "../constants/srsColors";
import { hiraganaToKata } from "../utils/katakanaMadness";
import { getWaniKaniPitchAccents } from "../utils/pitchAccent";
import { pickBestImage, useRemoteSvg } from "../utils/radicalSvg";
import {
  type SubjectColors,
  useSubjectColors,
} from "../utils/subjectColors";
import { useSettingsStore } from "../utils/store";
import { useTheme } from "../utils/theme";
import { CopyTooltip, useCopyTooltip } from "./CopyTooltip";
import KanjiPracticeModal from "./KanjiPracticeModal";
import PitchAccentVisualization from "./PitchAccentVisualization";
import SrsLevelIcon from "./SrsLevelIcon";
import StrokeOrderAnimation from "./StrokeOrderAnimation";
import { SynonymsModal } from "./SynonymsModal";

// Turn on Reanimated's global layout animations (required on Fabric / new‑arch)
enableLayoutAnimations(true);

interface KanjiDetailsProps {
  kanji: {
    id: number;
    object: string;
    level: number;
    characters: string;
    meanings: { meaning: string; primary: boolean }[];
    readings: {
      reading: string;
      primary: boolean;
      type: "onyomi" | "kunyomi" | "nanori";
    }[];
    meaningMnemonic: string;
    readingMnemonic: string;
    meaningHint?: string | null;
    readingHint?: string | null;
    componentSubjects?: {
      id: number;
      characters: string | null;
      meanings: string[];
      characterImages?: {
        url: string;
        content_type: string;
        metadata: {
          inline_styles?: boolean;
          color?: string;
          dimensions?: string;
          style_name?: string;
        };
      }[];
      imageUrl?: string | null;
      level: number;
    }[];
    amalgamationSubjects?: {
      id: number;
      characters: string;
      meanings: string[];
      level: number;
    }[];
    visuallySimilarSubjects?: {
      id: number;
      characters: string;
      meanings: string[];
      level: number;
    }[];
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
    percentageCorrect?: number;
    nextReviewAt?: string;
    onEditNote?: (type: "meaning" | "reading") => void;
    meaningCurrentStreak?: number;
    meaningMaxStreak?: number;
    readingCurrentStreak?: number;
    readingMaxStreak?: number;
  };
  progressionStatus: "loading" | "success" | "offline";
  onSubjectPress?: (subjectId: number) => void;
  initialTab?: "meaning" | "reading" | "stroke";
  onOpenConstellation?: () => void;
  onAddToList?: () => void;
  userLevel?: number;
  onSynonymsChange?: (synonyms: string[]) => Promise<void>;
  embedded?: boolean;
}

const BACK_BUTTON_HIT_SLOP = { top: 10, right: 10, bottom: 10, left: 10 };
const HEADER_TOP_OFFSET = 64;
const BACK_BUTTON_SIZE = 40;

// Create a memoized image cache to avoid re-renders
const imageCache: Record<string, string> = {};

// Helper component to render a single radical with SVG/image fallback
interface RadicalComponentProps {
  component: {
    id: number;
    characters: string | null;
    meanings: string[];
    characterImages?: {
      url: string;
      content_type: string;
      metadata: {
        inline_styles?: boolean;
        color?: string;
        dimensions?: string;
        style_name?: string;
      };
    }[];
    imageUrl?: string | null;
    level: number;
  };
  width: number;
  height: number;
  gridSpacing: number;
  onPress: () => void;
  isAboveUserLevel?: boolean;
  styles: ReturnType<typeof createStyles>;
  radicalContentColor?: string;
}

// Add display name for better debugging and lint compliance
const RadicalComponent = React.memo(
  function RadicalComponent({
    component,
    width,
    height,
    gridSpacing,
    onPress,
    isAboveUserLevel = false,
    styles,
    radicalContentColor = "#ffffff",
  }: RadicalComponentProps) {
    const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null);

    // Pick best image from characterImages
    const bestImg = pickBestImage(component.characterImages);
    const svgUrl = bestImg?.type === "svg" ? bestImg.url : null;
    const svgXml = useRemoteSvg(svgUrl, radicalContentColor);

    useEffect(() => {
      if (bestImg?.type === "png") {
        const cleaned = bestImg.url.replace(/^@/, "");
        setProcessedImageUrl(cleaned);
      } else if (bestImg?.type === "svg") {
        setProcessedImageUrl(null);
      } else if (component.imageUrl) {
        const cleaned = component.imageUrl.replace(/^@/, "");
        setProcessedImageUrl(cleaned);
      } else {
        setProcessedImageUrl(null);
      }
    }, [bestImg, component.imageUrl]);

    return (
      <TouchableOpacity
        style={[
          styles.componentItem,
          {
            width: width,
            height: height,
            margin: gridSpacing / 2,
            opacity: isAboveUserLevel ? 0.8 : 1,
          },
        ]}
        onPress={onPress}
      >
        {component.characters ? (
          <Text
            style={styles.componentCharacter}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {component.characters}
          </Text>
        ) : svgXml ? (
          <SvgXml xml={svgXml} width={28} height={28} />
        ) : processedImageUrl ? (
          <Image
            source={{ uri: processedImageUrl }}
            style={styles.componentRadicalImage}
            resizeMode="contain"
          />
        ) : (
          <Text
            style={styles.componentCharacterPlaceholder}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            ?
          </Text>
        )}
        <Text
          style={styles.componentMeaning}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {component.meanings[0]}
        </Text>
        {isAboveUserLevel && (
          <View style={styles.itemLevelBadgeRadical}>
            <Text style={styles.itemLevelBadgeText}>{component.level}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }
);

RadicalComponent.displayName = "RadicalComponent";

export default function KanjiDetails({
  kanji,
  progressionStatus,
  onSubjectPress,
  initialTab = "meaning",
  onOpenConstellation,
  onAddToList,
  userLevel = 60,
  onSynonymsChange,
  embedded = false,
}: KanjiDetailsProps) {
  const { showStrokeOrder, showOnyomiInKatakana, showPitchAccent } =
    useSettingsStore();
  const subjectColors = useSubjectColors();
  const styles = useMemo(
    () => createStyles(subjectColors),
    [subjectColors.kanji, subjectColors.radical, subjectColors.vocabulary]
  );
  const [activeTab, setActiveTab] = useState<"meaning" | "reading" | "stroke">(
    showStrokeOrder || initialTab !== "stroke" ? initialTab : "meaning"
  );
  const navigation = useNavigation();
  const [showAllSimilar, setShowAllSimilar] = useState(false);
  const [showAllVocab, setShowAllVocab] = useState(false);
  const [synonymsModalVisible, setSynonymsModalVisible] = useState(false);
  const [practiceModalVisible, setPracticeModalVisible] = useState(false);
  const [onyomiPitchPage, setOnyomiPitchPage] = useState(0);
  const [kunyomiPitchPage, setKunyomiPitchPage] = useState(0);
  const [nanoriPitchPage, setNanoriPitchPage] = useState(0);
  const { theme } = useTheme();
  const mainCharacterRef = useRef<View>(null);
  const {
    containerRef,
    tooltipVisible,
    tooltipPosition,
    tooltipOpacity,
    tooltipTranslateY,
    copyText,
  } = useCopyTooltip();
  const { width: screenWidth } = useWindowDimensions();
  const pagerRef = useRef<PagerView>(null);
  const meaningScrollRef = useAnimatedRef<Animated.ScrollView>();
  const readingScrollRef = useAnimatedRef<Animated.ScrollView>();
  const strokeScrollRef = useAnimatedRef<Animated.ScrollView>();

  // Compute responsive metrics per render
  const isTablet = screenWidth > 768;
  const horizontalPadding = 32;
  const gridSpacing = isTablet ? 12 : 8;
  // Vocab grid columns
  const vocabCols = isTablet ? 4 : screenWidth > 400 ? 3 : 2;
  const smallItemCols = isTablet ? 5 : screenWidth > 400 ? 4 : 3;
  const availableWidth = screenWidth - horizontalPadding;
  const baseVocabItemWidth = Math.floor(
    (availableWidth - gridSpacing * (vocabCols + 1)) / vocabCols
  );
  const baseSmallItemWidth = Math.floor(
    (availableWidth - gridSpacing * (smallItemCols + 1)) / smallItemCols
  );
  const smallCardHeight = isTablet ? 70 : 64; // smaller fixed small card height
  const vocabCardHeight = isTablet ? 84 : 78; // smaller fixed vocab card height
  const smallItemMaxWidth = Math.min(
    Math.floor(availableWidth - gridSpacing * 2),
    Math.floor(baseSmallItemWidth * 1.5)
  );
  const vocabItemMaxWidth = Math.min(
    Math.floor(availableWidth - gridSpacing * 2),
    Math.floor(baseVocabItemWidth * 1.8)
  );
  const minVocabCardWidth = Platform.OS === "android" ? 80 : baseVocabItemWidth;
  const readingPitchCardGap = 12;
  const readingPitchCardWidth = Math.max(220, screenWidth - 64 - readingPitchCardGap);
  const readingPitchSnapInterval = readingPitchCardWidth + readingPitchCardGap;

  // Determine the primary meaning
  const primaryMeaning =
    kanji.meanings.find((m) => m.primary)?.meaning ||
    kanji.meanings[0]?.meaning ||
    "";

  // Determine the primary reading (fallback to first available reading)
  const primaryReading =
    kanji.readings.find((r) => r.primary)?.reading ||
    kanji.readings[0]?.reading ||
    "";

  // Group readings by type
  const onyomiReadings = kanji.readings.filter((r) => r.type === "onyomi");
  const kunyomiReadings = kanji.readings.filter((r) => r.type === "kunyomi");
  const nanoriReadings = kanji.readings.filter((r) => r.type === "nanori");
  const onyomiPitchAccentEntries = useMemo(
    () =>
      getWaniKaniPitchAccents(
        kanji.id,
        onyomiReadings.map((reading) => reading.reading)
      ),
    [kanji.id, onyomiReadings]
  );
  const kunyomiPitchAccentEntries = useMemo(
    () =>
      getWaniKaniPitchAccents(
        kanji.id,
        kunyomiReadings.map((reading) => reading.reading)
      ),
    [kanji.id, kunyomiReadings]
  );
  const nanoriPitchAccentEntries = useMemo(
    () =>
      getWaniKaniPitchAccents(
        kanji.id,
        nanoriReadings.map((reading) => reading.reading)
      ),
    [kanji.id, nanoriReadings]
  );

  // SRS stage name lookup (if available)
  const srsName = (() => {
    // If no SRS stage is defined, the subject hasn't been started
    if (kanji.srsStage === undefined || kanji.srsStage === null) {
      return "Not Started";
    }

    // If we have SRS system data, look up the stage name
    if (
      kanji.srsSystem &&
      kanji.srsSystem.stages &&
      kanji.srsSystem.stages[kanji.srsStage]
    ) {
      return kanji.srsSystem.stages[kanji.srsStage].name;
    }

    // Fallback based on common WaniKani SRS stage mappings
    switch (kanji.srsStage) {
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

  // Sort and prepare component subjects by level
  const sortedComponentSubjects = kanji.componentSubjects
    ? [...kanji.componentSubjects].sort((a, b) => a.level - b.level)
    : [];

  // Visually Similar Kanji - sort by level and limit to first 8 initially
  const maxInitialSimilarItems = 8;
  const sortedSimilarSubjects = kanji.visuallySimilarSubjects
    ? [...kanji.visuallySimilarSubjects].sort((a, b) => a.level - b.level)
    : [];
  const hasMoreSimilarItems = sortedSimilarSubjects.length > maxInitialSimilarItems;
  const displaySimilarItems = showAllSimilar
    ? sortedSimilarSubjects
    : sortedSimilarSubjects.slice(0, maxInitialSimilarItems);

  // Found In Vocabulary - sort by level and limit to first 6 initially
  const maxInitialVocabItems = 6;
  const sortedVocabSubjects = kanji.amalgamationSubjects
    ? [...kanji.amalgamationSubjects].sort((a, b) => a.level - b.level)
    : [];
  const hasMoreVocabItems = sortedVocabSubjects.length > maxInitialVocabItems;
  const displayVocabItems = showAllVocab
    ? sortedVocabSubjects
    : sortedVocabSubjects.slice(0, maxInitialVocabItems);

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

  // Toggle show all similar kanji
  const toggleShowAllSimilar = () => {
    setShowAllSimilar((prev) => !prev);
  };

  // Toggle show all vocabulary
  const toggleShowAllVocab = () => {
    setShowAllVocab((prev) => !prev);
  };

  // Skip heavy per‑item stagger if list is large
  const shouldStaggerSimilar =
    displaySimilarItems && displaySimilarItems.length <= 30;
  const shouldStaggerVocab =
    displayVocabItems && displayVocabItems.length <= 30;

  useEffect(() => {
    if (!showStrokeOrder && activeTab === "stroke") {
      setActiveTab("meaning");
      pagerRef.current?.setPage(0);
    }
  }, [activeTab, showStrokeOrder]);

  useEffect(() => {
    setOnyomiPitchPage(0);
    setKunyomiPitchPage(0);
    setNanoriPitchPage(0);
  }, [kanji.id]);

  const renderReadingPitchAccentSwiper = (
    entries: { r: string; p: number[] }[],
    currentPage: number,
    onPageChange: (nextPage: number) => void,
    transformReading: (reading: string) => string = (reading) => reading
  ) => {
    if (!showPitchAccent || entries.length === 0) {
      return null;
    }

    const safePage = Math.max(0, Math.min(entries.length - 1, currentPage));
    const currentReading = transformReading(entries[safePage].r);

    if (entries.length === 1) {
      const entry = entries[0];
      return (
        <View style={styles.readingPitchAccents}>
          <View style={styles.readingPitchHeader}>
            <Text
              style={[styles.readingPitchLabel, { color: theme.textSecondary }]}
            >
              Pitch accent for
            </Text>
            <View
              style={[
                styles.readingPitchCurrentReadingBadge,
                { borderColor: theme.border },
              ]}
            >
              <Text
                style={[
                  styles.readingPitchCurrentReadingText,
                  { color: theme.textColor },
                ]}
              >
                {transformReading(entry.r)}
              </Text>
            </View>
          </View>
          <PitchAccentVisualization
            reading={transformReading(entry.r)}
            accents={entry.p}
          />
        </View>
      );
    }

    return (
      <View style={styles.readingPitchAccents}>
        <View
          style={[
            styles.readingPitchHeader,
            { width: readingPitchCardWidth, marginBottom: 8 },
          ]}
        >
          <Text style={[styles.readingPitchLabel, { color: theme.textSecondary }]}>
            Pitch accent for
          </Text>
          <View
            style={[
              styles.readingPitchCurrentReadingBadge,
              { borderColor: theme.border },
            ]}
          >
            <Text
              style={[
                styles.readingPitchCurrentReadingText,
                { color: theme.textColor },
              ]}
            >
              {currentReading}
            </Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={readingPitchSnapInterval}
          snapToAlignment="start"
          disableIntervalMomentum
          contentContainerStyle={{ paddingRight: readingPitchCardGap }}
          onMomentumScrollEnd={(event) => {
            const rawIndex = Math.round(
              event.nativeEvent.contentOffset.x / readingPitchSnapInterval
            );
            const boundedIndex = Math.max(
              0,
              Math.min(entries.length - 1, rawIndex)
            );
            onPageChange(boundedIndex);
          }}
        >
          {entries.map((entry, index) => (
            <View
              key={`pitch-${entry.r}-${entry.p.join("-")}-${index}`}
              style={{
                width: readingPitchCardWidth,
                marginRight: readingPitchCardGap,
              }}
            >
              <PitchAccentVisualization
                reading={transformReading(entry.r)}
                accents={entry.p}
              />
            </View>
          ))}
        </ScrollView>

        <View
          style={[
            styles.readingPitchPagination,
            { width: readingPitchCardWidth },
          ]}
        >
          <Text
            style={[styles.readingPitchPaginationText, { color: theme.textSecondary }]}
          >
            {currentPage + 1} / {entries.length}
          </Text>
          <View style={styles.readingPitchDots}>
            {entries.map((_, index) => (
              <View
                key={`pitch-dot-${index}`}
                style={[
                  styles.readingPitchDot,
                  {
                    backgroundColor:
                      index === currentPage ? subjectColors.kanji : theme.border,
                  },
                ]}
              />
            ))}
          </View>
        </View>
      </View>
    );
  };

  const tabOrder: ("meaning" | "reading" | "stroke")[] = showStrokeOrder
    ? ["meaning", "reading", "stroke"]
    : ["meaning", "reading"];
  const tabScrollRefs: Record<
    "meaning" | "reading" | "stroke",
    typeof meaningScrollRef
  > = {
    meaning: meaningScrollRef,
    reading: readingScrollRef,
    stroke: strokeScrollRef,
  };

  const getTabIndex = (tab: "meaning" | "reading" | "stroke") => {
    const normalizedTab =
      !showStrokeOrder && tab === "stroke" ? "meaning" : tab;

    return tabOrder.indexOf(normalizedTab);
  };

  const changeTab = (tab: "meaning" | "reading" | "stroke") => {
    const targetIndex = getTabIndex(tab);
    const nextTab = tabOrder[targetIndex];

    if (targetIndex < 0 || !nextTab || nextTab === activeTab) {
      return;
    }

    setActiveTab(nextTab);
    pagerRef.current?.setPage(targetIndex);
  };

  const onTabPageSelected = (event: { nativeEvent: { position: number } }) => {
    const nextTab = tabOrder[event.nativeEvent.position];

    if (!nextTab || nextTab === activeTab) {
      return;
    }

    setActiveTab(nextTab);
  };

  const renderTabBody = (tab: "meaning" | "reading" | "stroke") => {
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
                <View
                  style={[
                    styles.row,
                    { marginBottom: kanji.meanings.length > 1 ? 8 : 8 },
                  ]}
                >
                  <Text style={[styles.label, { color: theme.textSecondary }]}>
                    Primary
                  </Text>
                  <Text style={[styles.value, { color: theme.textColor }]}>
                    {primaryMeaning}
                  </Text>
                </View>

                {kanji.meanings.length > 1 && (
                  <View style={[styles.row, { marginBottom: 8 }]}>
                    <Text
                      style={[styles.label, { color: theme.textSecondary }]}
                    >
                      Alternative
                    </Text>
                    <Text style={[styles.value, { color: theme.textColor }]}>
                      {kanji.meanings
                        .filter((m) => !m.primary)
                        .map((m) => m.meaning)
                        .join(", ")}
                    </Text>
                  </View>
                )}

                <View style={styles.row}>
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
                        !kanji.userSynonyms?.length && {
                          color: theme.textSecondary,
                          fontStyle: "italic",
                        },
                      ]}
                      numberOfLines={2}
                    >
                      {kanji.userSynonyms?.length
                        ? kanji.userSynonyms.join(", ")
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
              </View>
            </View>

            {/* Mnemonic Section */}
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
                  {formatMnemonic(kanji.meaningMnemonic)}
                </View>
              </View>
            </View>

            {/* Meaning Hint Section */}
            {kanji.meaningHint && (
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
                    {formatMnemonic(kanji.meaningHint)}
                  </View>
                </View>
              </View>
            )}
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
                {onyomiReadings.length > 0 && (
                  <View
                    style={[
                      styles.readingRow,
                      {
                        marginBottom:
                          kunyomiReadings.length > 0 ||
                          nanoriReadings.length > 0
                            ? 16
                            : 0,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.readingLabel, { color: theme.textColor }]}
                    >
                      On&apos;yomi
                    </Text>
                    <View style={styles.readingValues}>
                      {onyomiReadings.map((reading, index) => (
                        <View
                          key={`on-${index}`}
                          style={[
                            styles.readingBadge,
                            {
                              backgroundColor: theme.isDark
                                ? "#333"
                                : "#f5f5f5",
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
                            {showOnyomiInKatakana
                              ? hiraganaToKata(reading.reading)
                              : reading.reading}
                          </Text>
                        </View>
                      ))}
                    </View>
                    {renderReadingPitchAccentSwiper(
                      onyomiPitchAccentEntries,
                      onyomiPitchPage,
                      setOnyomiPitchPage,
                      (reading) =>
                        showOnyomiInKatakana ? hiraganaToKata(reading) : reading
                    )}
                  </View>
                )}

                {kunyomiReadings.length > 0 && (
                  <View
                    style={[
                      styles.readingRow,
                      { marginBottom: nanoriReadings.length > 0 ? 16 : 0 },
                    ]}
                  >
                    <Text
                      style={[styles.readingLabel, { color: theme.textColor }]}
                    >
                      Kun&apos;yomi
                    </Text>
                    <View style={styles.readingValues}>
                      {kunyomiReadings.map((reading, index) => (
                        <View
                          key={`kun-${index}`}
                          style={[
                            styles.readingBadge,
                            {
                              backgroundColor: theme.isDark
                                ? "#333"
                                : "#f5f5f5",
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
                    {renderReadingPitchAccentSwiper(
                      kunyomiPitchAccentEntries,
                      kunyomiPitchPage,
                      setKunyomiPitchPage
                    )}
                  </View>
                )}

                {nanoriReadings.length > 0 && (
                  <View style={styles.readingRow}>
                    <Text
                      style={[styles.readingLabel, { color: theme.textColor }]}
                    >
                      Nanori
                    </Text>
                    <View style={styles.readingValues}>
                      {nanoriReadings.map((reading, index) => (
                        <View
                          key={`nanori-${index}`}
                          style={[
                            styles.readingBadge,
                            {
                              backgroundColor: theme.isDark
                                ? "#333"
                                : "#f5f5f5",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.readingBadgeText,
                              { color: theme.textSecondary },
                            ]}
                          >
                            {reading.reading}
                          </Text>
                        </View>
                      ))}
                    </View>
                    {renderReadingPitchAccentSwiper(
                      nanoriPitchAccentEntries,
                      nanoriPitchPage,
                      setNanoriPitchPage
                    )}
                  </View>
                )}
              </View>
            </View>

            {/* Reading Mnemonic Section */}
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
                  {formatMnemonic(kanji.readingMnemonic)}
                </View>
              </View>
            </View>

            {/* Reading Hint Section */}
            {kanji.readingHint && (
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
                    {formatMnemonic(kanji.readingHint)}
                  </View>
                </View>
              </View>
            )}
          </View>
        )}
        {activeTab === "stroke" && showStrokeOrder && (
          <View>
            <View style={styles.section}>
              <StrokeOrderAnimation
                character={kanji.characters}
                onPractice={() => setPracticeModalVisible(true)}
              />
            </View>
          </View>
        )}
        {activeTab !== "stroke" && (
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
                    onPress={() => kanji.onEditNote?.("meaning")}
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
                    {kanji.meaningNote ? (
                      <Text style={[styles.noteContent, { color: theme.textColor }]}>
                        {kanji.meaningNote}
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
                    onPress={() => kanji.onEditNote?.("reading")}
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
                    {kanji.readingNote ? (
                      <Text style={[styles.noteContent, { color: theme.textColor }]}>
                        {kanji.readingNote}
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

        {/* Kanji Composition Section */}
        {sortedComponentSubjects.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
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
                entering={FadeIn.duration(150)}
                exiting={FadeOutUp.duration(120)}
                layout={LinearTransition.duration(180)}
              >
                {sortedComponentSubjects.map((component) => (
                  <RadicalComponent
                    key={component.id}
                    component={component}
                    width={baseSmallItemWidth}
                    height={smallCardHeight}
                    gridSpacing={gridSpacing}
                    styles={styles}
                    onPress={() => onSubjectPress?.(component.id)}
                    isAboveUserLevel={component.level > userLevel}
                  />
                ))}
              </Animated.View>
            </View>
          </View>
        )}

        {/* Visually Similar Kanji */}
        {sortedSimilarSubjects.length > 0 && (
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
                entering={FadeIn.duration(150)}
                exiting={FadeOutUp.duration(120)}
                layout={LinearTransition.duration(180)}
              >
                {displaySimilarItems?.map((similarKanji, idx) => {
                  const isAboveUserLevel = similarKanji.level > userLevel;
                  return (
                    <Animated.View
                      key={similarKanji.id}
                      entering={
                        shouldStaggerSimilar
                          ? FadeInDown.duration(140).delay(idx * 10)
                          : FadeInDown.duration(140)
                      }
                      exiting={FadeOutUp.duration(120)}
                      layout={LinearTransition.duration(180)}
                    >
                      <TouchableOpacity
                        style={[
                          styles.similarKanjiItem,
                          {
                            width: baseSmallItemWidth,
                            height: smallCardHeight,
                            margin: gridSpacing / 2,
                            opacity: isAboveUserLevel ? 0.8 : 1,
                          },
                        ]}
                        onPress={() => onSubjectPress?.(similarKanji.id)}
                      >
                        <Text
                          style={styles.similarKanjiCharacter}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.75}
                        >
                          {similarKanji.characters}
                        </Text>
                        <Text
                          style={styles.similarKanjiMeaning}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {similarKanji.meanings[0]}
                        </Text>
                        {isAboveUserLevel && (
                          <View style={styles.itemLevelBadge}>
                            <Text style={styles.itemLevelBadgeText}>
                              {similarKanji.level}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    </Animated.View>
                  );
                })}
              </Animated.View>
              {hasMoreSimilarItems && (
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
                    onPress={toggleShowAllSimilar}
                  >
                    <Text
                      style={[
                        styles.showMoreText,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {showAllSimilar
                        ? "Show Less"
                        : `Show ${
                            sortedSimilarSubjects.length -
                            maxInitialSimilarItems
                          } More`}
                    </Text>
                    <Ionicons
                      name={showAllSimilar ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={subjectColors.kanji}
                    />
                  </TouchableOpacity>
                </Animated.View>
              )}
            </View>
          </View>
        )}

        {/* Found In Vocabulary Section */}
        {sortedVocabSubjects.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
              Found In Vocabulary
            </Text>
            <View
              style={[
                styles.infoBox,
                { backgroundColor: theme.cardBackground },
              ]}
            >
              <Animated.View
                style={styles.vocabGrid}
                entering={FadeIn.duration(150)}
                exiting={FadeOutUp.duration(120)}
                layout={LinearTransition.duration(180)}
              >
                {displayVocabItems?.map((vocab, idx) => {
                  const isAboveUserLevel = vocab.level > userLevel;
                  return (
                    <Animated.View
                      key={vocab.id}
                      entering={
                        shouldStaggerVocab
                          ? FadeInDown.duration(140).delay(idx * 10)
                          : FadeInDown.duration(140)
                      }
                      exiting={FadeOutUp.duration(120)}
                      layout={LinearTransition.duration(180)}
                    >
                      <TouchableOpacity
                        style={[
                          styles.vocabItem,
                          {
                            width: Math.min(
                              Math.max(
                                minVocabCardWidth,
                                80 + (vocab.characters?.length || 0) * 18
                              ),
                              vocabItemMaxWidth
                            ),
                            height: vocabCardHeight,
                            margin: gridSpacing / 2,
                            opacity: isAboveUserLevel ? 0.8 : 1,
                          },
                        ]}
                        onPress={() => onSubjectPress?.(vocab.id)}
                      >
                        <Text
                          style={[
                            styles.vocabCharacter,
                            // Adjust font size for longer vocabulary words
                            vocab.characters && vocab.characters.length > 3
                              ? {
                                  fontSize: Math.max(
                                    14,
                                    22 - (vocab.characters.length - 3) * 2
                                  ),
                                }
                              : null,
                          ]}
                          adjustsFontSizeToFit={true}
                          numberOfLines={1}
                        >
                          {vocab.characters}
                        </Text>
                        <Text
                          style={styles.vocabMeaning}
                          numberOfLines={2}
                          ellipsizeMode="tail"
                        >
                          {vocab.meanings[0]}
                        </Text>
                        {isAboveUserLevel && (
                          <View style={styles.itemLevelBadgeVocab}>
                            <Text style={styles.itemLevelBadgeText}>
                              {vocab.level}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    </Animated.View>
                  );
                })}
              </Animated.View>
              {hasMoreVocabItems && (
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
                    onPress={toggleShowAllVocab}
                  >
                    <Text
                      style={[
                        styles.showMoreText,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {showAllVocab
                        ? "Show Less"
                        : `Show ${
                            sortedVocabSubjects.length - maxInitialVocabItems
                          } More`}
                    </Text>
                    <Ionicons
                      name={showAllVocab ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={subjectColors.vocabulary}
                    />
                  </TouchableOpacity>
                </Animated.View>
              )}
            </View>
          </View>
        )}

        {/* Your Progression Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            Your Progression
          </Text>
          <View
            style={[styles.infoBox, { backgroundColor: theme.cardBackground }]}
          >
            <View style={styles.progressionContainer}>
              {progressionStatus === "loading" ? (
                /* Loading State */
                (<View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={theme.secondary} />
                  <Text
                    style={[styles.loadingText, { color: theme.textSecondary }]}
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
                  <Text style={[styles.srsName, { color: theme.textColor }]}>
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
              ) : kanji.srsStage === undefined ||
                kanji.srsStage === null ||
                kanji.srsStage === 0 ? (
                /* Not Started State */
                (<View style={styles.notStartedContainer}>
                  <View style={[styles.srsBadge, styles.lockedBadge]}>
                    <Ionicons name="lock-closed" size={28} color="#fff" />
                  </View>
                  <Text style={[styles.srsName, { color: theme.textColor }]}>
                    {kanji.srsStage === 0 ? "Initiate" : "Not Started"}
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
                      <SrsLevelIcon level={srsName} size={28} color="#fff" />
                    </View>
                    <Text style={[styles.srsName, { color: theme.textColor }]}>
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
                          style={{ fontWeight: "600", color: theme.textColor }}
                        >
                          {formatNextReviewTime(kanji.nextReviewAt)}
                        </Text>
                      </Text>
                    </View>

                    {kanji.percentageCorrect !== undefined && (
                      <View style={styles.percentageIndicator}>
                        <Text
                          style={[
                            styles.percentageText,
                            { color: theme.textColor },
                          ]}
                        >
                          {Math.round(kanji.percentageCorrect)}% Accuracy
                        </Text>
                      </View>
                    )}
                  </View>
                  <View
                    style={[styles.divider, { backgroundColor: theme.border }]}
                  />
                  <View style={styles.statsContainer}>
                    <View style={styles.statColumn}>
                      <Text
                        style={[styles.statTitle, { color: theme.textColor }]}
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
                            {kanji.meaningCurrentStreak || 0}
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
                            {kanji.meaningMaxStreak || 0}
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
                            {kanji.meaningCorrect || 0}
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
                            {kanji.meaningIncorrect || 0}
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
                        style={[styles.statTitle, { color: theme.textColor }]}
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
                            {kanji.readingCurrentStreak || 0}
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
                            {kanji.readingMaxStreak || 0}
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
                            {kanji.readingCorrect || 0}
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
                            {kanji.readingIncorrect || 0}
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
    tab: "meaning" | "reading" | "stroke",
    scrollRef: typeof meaningScrollRef
  ) => (
    <View key={tab} style={styles.page}>
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

          {onOpenConstellation && (
            <TouchableOpacity
              onPress={onOpenConstellation}
              style={styles.constellationButton}
            >
              <Ionicons name="planet-outline" size={24} color="#fff" />
            </TouchableOpacity>
          )}

          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>{kanji.level}</Text>
          </View>

          <TouchableOpacity
            ref={mainCharacterRef}
            style={styles.characterContainer}
            activeOpacity={0.75}
            onPress={() => copyText(kanji.characters, mainCharacterRef)}
          >
            <Text style={styles.character}>{kanji.characters}</Text>
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
          {showStrokeOrder && (
            <TouchableOpacity
              style={[styles.tab, activeTab === "stroke" && styles.activeTab]}
              onPress={() => changeTab("stroke")}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: theme.textColor },
                  activeTab === "stroke" && styles.activeTabText,
                ]}
              >
                Stroke
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <PagerView
          ref={pagerRef}
          style={styles.pagerContainer}
          initialPage={getTabIndex(activeTab)}
          onPageSelected={onTabPageSelected}
        >
          {tabOrder.map((tab) => renderPage(tab, tabScrollRefs[tab]))}
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
        currentSynonyms={kanji.userSynonyms || []}
        subjectType="kanji"
      />

      {/* Kanji Practice Modal */}
      <KanjiPracticeModal
        visible={practiceModalVisible}
        onClose={() => setPracticeModalVisible(false)}
        character={kanji.characters}
        meaning={primaryMeaning}
        reading={primaryReading}
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
  },
  stickyCharacter: {
    fontSize: 24,
    color: subjectColors.kanji,
    fontWeight: "bold",
    fontFamily: "SourceHanSansJP-Bold",
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
    backgroundColor: subjectColors.kanji,
  },
  header: {
    backgroundColor: subjectColors.kanji,
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
  },
  character: {
    fontSize: 40,
    color: subjectColors.kanji,
    fontWeight: "bold",
    fontFamily: "SourceHanSansJP-Bold",
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
    marginBottom: 4,
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
    backgroundColor: subjectColors.kanji,
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
  readingRow: {
    marginBottom: 16,
  },
  readingLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  readingValues: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  readingPitchAccents: {
    marginTop: 12,
  },
  readingPitchHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  readingPitchLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  readingPitchCurrentReadingBadge: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  readingPitchCurrentReadingText: {
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "SourceHanSansJP-Bold",
  },
  readingPitchPagination: {
    marginTop: 8,
    paddingHorizontal: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  readingPitchPaginationText: {
    fontSize: 12,
    fontWeight: "600",
  },
  readingPitchDots: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 2,
  },
  readingPitchDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 4,
  },
  readingBadge: {
    backgroundColor: "#f5f5f5",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    margin: 4,
  },
  primaryReadingBadge: {
    backgroundColor: subjectColors.kanji,
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
  componentGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    alignItems: "flex-start",
  },
  componentItem: {
    backgroundColor: subjectColors.radical,
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
  componentCharacterPlaceholder: {
    fontSize: 22,
    color: "white",
    fontWeight: "bold",
    opacity: 0.5,
  },
  componentRadicalImage: {
    width: 28,
    height: 28,
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
  similarKanjiItem: {
    backgroundColor: subjectColors.kanji,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    paddingHorizontal: 4,
    flexShrink: 0,
    position: "relative",
  },
  similarKanjiCharacter: {
    fontSize: 22,
    color: "white",
    fontWeight: "bold",
    fontFamily: "SourceHanSansJP-Bold",
  },
  similarKanjiMeaning: {
    fontSize: 12,
    color: "white",
    textAlign: "center",
    lineHeight: 14,
    fontWeight: "500",
    marginTop: 4,
    paddingHorizontal: 4,
  },
  vocabGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    alignItems: "flex-start",
  },
  vocabItem: {
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
  vocabCharacter: {
    fontSize: 20,
    color: "white",
    fontWeight: "bold",
    fontFamily: "SourceHanSansJP-Bold",
  },
  vocabMeaning: {
    fontSize: 12,
    color: "white",
    textAlign: "center",
    lineHeight: 14,
    fontWeight: "500",
    marginTop: 4,
    paddingHorizontal: 6,
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
  inlineReadingTag: {
    backgroundColor: "#333333",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginHorizontal: 2,
  },
  readingTagText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 14,
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
  correctnessRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 8,
    gap: 10,
  },
  correctness: {
    flexDirection: "row",
    alignItems: "center",
  },
  correctnessText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: "500",
  },
  loadingContainer: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
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
  itemLevelBadgeRadical: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: subjectColors.radical,
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
  itemLevelBadgeVocab: {
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
