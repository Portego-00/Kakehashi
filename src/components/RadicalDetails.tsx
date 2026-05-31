import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "expo-router/react-navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  enableLayoutAnimations,
  Extrapolation,
  FadeInDown,
  FadeOutUp,
  interpolate,
  LinearTransition,
  runOnUI,
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SvgXml } from "react-native-svg";
import { SRS_COLORS } from "../constants/srsColors";
import {
  getMnemonicImageAsset,
  getMnemonicImageUrlFromDocument,
  inlineSvgClassStyles,
} from "../utils/mnemonicImage";
import { pickBestImage, useRemoteSvg } from "../utils/radicalSvg";
import {
  getReadableTextColor,
  type SubjectColors,
  useSubjectColors,
} from "../utils/subjectColors";
import { useSettingsStore } from "../utils/store";
import { useTheme } from "../utils/theme";
import { CopyTooltip, useCopyTooltip } from "./CopyTooltip";
import SrsLevelIcon from "./SrsLevelIcon";
import { SynonymsModal } from "./SynonymsModal";

// Enable Reanimated layout animations (required on Fabric / new‑arch)
enableLayoutAnimations(true);

interface RadicalDetailsProps {
  radical: {
    id: number;
    object: string;
    level: number;
    characters: string | null;
    meanings: { meaning: string; primary: boolean }[];
    mnemonic: string;
    imageUrl: string | null;
    documentUrl?: string | null;
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
    amalgamationSubjects: {
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
    meaningCorrect?: number;
    meaningIncorrect?: number;
    percentageCorrect?: number;
    nextReviewAt?: string;
    onEditNote?: () => void;
  };
  progressionStatus: "loading" | "success" | "offline";
  onKanjiPress?: (kanjiId: number) => void;
  onSubjectPress?: (subjectId: number) => void;
  onOpenConstellation?: () => void;
  onAddToList?: () => void;
  userLevel?: number;
  onSynonymsChange?: (synonyms: string[]) => Promise<void>;
  embedded?: boolean;
}

const BACK_BUTTON_HIT_SLOP = { top: 10, right: 10, bottom: 10, left: 10 };
const HEADER_TOP_OFFSET = 64;
const BACK_BUTTON_SIZE = 40;

//

// Pick the best image from WaniKani's character_images array
// 2. Else prefer a PNG of roughly 256 px (good balance of clarity & size)

// grid sizing computed at runtime via window dimensions

export default function RadicalDetails({
  radical,
  progressionStatus,
  onKanjiPress,
  onSubjectPress,
  onOpenConstellation,
  onAddToList,
  userLevel = 60,
  onSynonymsChange,
  embedded = false,
}: RadicalDetailsProps) {
  const navigation = useNavigation();
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(
    null
  );
  const [mnemonicImageUrl, setMnemonicImageUrl] = useState<string | null>(
    null
  );
  const [mnemonicSvgXml, setMnemonicSvgXml] = useState<string | null>(null);
  const [mnemonicImageKind, setMnemonicImageKind] = useState<
    "unknown" | "svg" | "raster"
  >("unknown");
  const [showAllKanji, setShowAllKanji] = useState(false);
  const [synonymsModalVisible, setSynonymsModalVisible] = useState(false);
  const { showMnemonicIllustrations } = useSettingsStore();
  const { theme } = useTheme();
  const subjectColors = useSubjectColors();
  const radicalHeaderTextColor = useMemo(
    () => getReadableTextColor(subjectColors.radical),
    [subjectColors.radical]
  );
  const styles = useMemo(
    () => createStyles(subjectColors),
    [subjectColors.kanji, subjectColors.radical, subjectColors.vocabulary]
  );
  const themedMnemonicSvgXml = useMemo(
    () =>
      mnemonicSvgXml
        ? inlineSvgClassStyles(
            mnemonicSvgXml,
            theme.textColor,
            theme.isDark,
            theme.textColor
          )
        : null,
    [mnemonicSvgXml, theme.textColor, theme.isDark]
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
  // ... existing hooks ...

  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Scroll position for sticky header
  const scrollY = useSharedValue(0);
  const scrollViewRef = useAnimatedRef<Animated.ScrollView>();

  const scrollToTop = () => {
    runOnUI(scrollTo)(scrollViewRef, 0, 0, true);
  };

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // Compute responsive grid metrics per render
  const isTablet = screenWidth > 768;
  const horizontalPadding = 32; // matches section margins
  const gridSpacing = isTablet ? 12 : 8;
  const smallItemCols = isTablet ? 5 : screenWidth > 400 ? 4 : 3;
  const availableWidth = screenWidth - horizontalPadding;
  const gridItemWidth = Math.floor(
    (availableWidth - gridSpacing * (smallItemCols + 1)) / smallItemCols
  );
  const gridItemMaxWidth = Math.min(
    Math.floor(availableWidth - gridSpacing * 2),
    Math.floor(gridItemWidth * 1.5)
  );
  const smallCardHeight = isTablet ? 72 : 66; // fixed height, more compact

  // ------------- image selection (SVG preferred) -------------
  const bestImg = pickBestImage(radical.characterImages);
  const svgUrl = bestImg?.type === "svg" ? bestImg.url : null;
  const svgXml = useRemoteSvg(svgUrl, subjectColors.radical);

  useEffect(() => {
    if (bestImg?.type === "png") {
      const cleaned = bestImg.url.replace(/^@/, "");
      setProcessedImageUrl(cleaned);
    } else if (bestImg?.type === "svg") {
      // Prefer SVG strictly when available; avoid selecting raster fallback
      setProcessedImageUrl(null);
    } else if (radical.imageUrl) {
      const cleaned = radical.imageUrl.replace(/^@/, "");
      setProcessedImageUrl(cleaned);
    } else {
      setProcessedImageUrl(null);
    }
  }, [bestImg, radical.imageUrl, radical.id, svgUrl]);

  // Visual representation is determined by: radical.characters → svgXml → processedImageUrl
  useEffect(() => {
    // Effect kept for potential future use, but no logging
  }, [
    radical.characters,
    svgXml,
    svgUrl,
    processedImageUrl,
    radical.id,
    radical.level,
  ]);

  useEffect(() => {
    let cancelled = false;
    const documentUrl = radical.documentUrl?.trim();

    if (!showMnemonicIllustrations || !documentUrl) {
      setMnemonicImageUrl(null);
      return;
    }

    getMnemonicImageUrlFromDocument(documentUrl)
      .then((imageUrl) => {
        if (!cancelled) setMnemonicImageUrl(imageUrl);
      })
      .catch(() => {
        if (!cancelled) setMnemonicImageUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [showMnemonicIllustrations, radical.documentUrl, radical.id]);

  useEffect(() => {
    let cancelled = false;

    if (!showMnemonicIllustrations || !mnemonicImageUrl) {
      setMnemonicSvgXml(null);
      setMnemonicImageKind("unknown");
      return;
    }

    setMnemonicSvgXml(null);
    setMnemonicImageKind("unknown");

    getMnemonicImageAsset(mnemonicImageUrl)
      .then((asset) => {
        if (cancelled) return;
        if (asset.kind === "svg") {
          setMnemonicSvgXml(asset.svgXml);
          setMnemonicImageKind("svg");
        } else {
          setMnemonicSvgXml(null);
          setMnemonicImageKind("raster");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMnemonicSvgXml(null);
          setMnemonicImageKind("raster");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [showMnemonicIllustrations, mnemonicImageUrl, radical.id]);

  // Determine the primary meaning
  const primaryMeaning =
    radical.meanings.find((m) => m.primary)?.meaning ||
    radical.meanings[0]?.meaning ||
    "";

  // SRS stage name lookup (if available)
  const srsName = (() => {
    // If no SRS stage is defined, the subject hasn't been started
    if (radical.srsStage === undefined || radical.srsStage === null) {
      return "Not Started";
    }

    // If we have SRS system data, look up the stage name
    if (
      radical.srsSystem &&
      radical.srsSystem.stages &&
      radical.srsSystem.stages[radical.srsStage]
    ) {
      return radical.srsSystem.stages[radical.srsStage].name;
    }

    // Fallback based on common WaniKani SRS stage mappings
    switch (radical.srsStage) {
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

  // Found In Kanji - sort by level and limit to first 8 initially
  const maxInitialKanjiItems = 8;
  const sortedAmalgamationSubjects = radical.amalgamationSubjects
    ? [...radical.amalgamationSubjects].sort((a, b) => a.level - b.level)
    : [];
  const hasMoreKanjiItems =
    sortedAmalgamationSubjects.length > maxInitialKanjiItems;
  const displayKanjiItems = showAllKanji
    ? sortedAmalgamationSubjects
    : sortedAmalgamationSubjects.slice(0, maxInitialKanjiItems);

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

    // Regular expression to find <em>, <radical>, <reading>, <ja> tags
    const regex = /<(em|radical|reading|ja)>(.*?)<\/\1>|([^<]+)/g;
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

  // Toggle show all kanji with animation
  const toggleShowAllKanji = () => {
    setShowAllKanji((prev) => !prev);
  };

  // Only stagger the first 30 items (to keep large lists smooth)
  const shouldStaggerKanji =
    displayKanjiItems && displayKanjiItems.length <= 30;

  // Animated style for sticky header
  const stickyHeaderStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [50, 100, 150],
      [0, 0, 1],
      Extrapolation.CLAMP
    );

    const translateY = interpolate(
      scrollY.value,
      [50, 100],
      [-60, 0],
      Extrapolation.CLAMP
    );

    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  return (
    <View style={[styles.wrapper, embedded && styles.embeddedWrapper]} ref={containerRef}>
      <Animated.ScrollView
        ref={scrollViewRef}
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
        onScroll={embedded ? undefined : scrollHandler}
        scrollEventThrottle={16}
      >
        {/* Blue background that extends beyond the header for overscrolling */}
        {!embedded && <View style={styles.overscrollBackground} />}

        {/* Header */}
        {!embedded && (
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={BACK_BUTTON_HIT_SLOP}
          >
            <Ionicons name="arrow-back" size={24} color={radicalHeaderTextColor} />
          </TouchableOpacity>

          {onAddToList && (
            <TouchableOpacity
              onPress={onAddToList}
              style={styles.addToListButton}
            >
              <Ionicons
                name="bookmark-outline"
                size={20}
                color={radicalHeaderTextColor}
              />
            </TouchableOpacity>
          )}

          {onOpenConstellation && (
            <TouchableOpacity
              onPress={onOpenConstellation}
              style={styles.constellationButton}
            >
              <Ionicons
                name="planet-outline"
                size={24}
                color={radicalHeaderTextColor}
              />
            </TouchableOpacity>
          )}

          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>{radical.level}</Text>
          </View>

          <TouchableOpacity
            ref={mainCharacterRef}
            style={styles.characterContainer}
            activeOpacity={radical.characters ? 0.75 : 1}
            disabled={!radical.characters}
            onPress={() => copyText(radical.characters, mainCharacterRef)}
          >
            {radical.characters ? (
              <Text style={styles.character}>{radical.characters}</Text>
            ) : svgXml ? (
              <SvgXml xml={svgXml} width={60} height={60} />
            ) : processedImageUrl ? (
              <Image
                source={{ uri: processedImageUrl }}
                style={styles.radicalImage}
                resizeMode="contain"
              />
            ) : (
              <Text style={styles.characterPlaceholder}>?</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.mainTitle}>{primaryMeaning}</Text>
        </View>
        )}

        {/* Name Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            Name
          </Text>
          <View
            style={[styles.infoBox, { backgroundColor: theme.cardBackground }]}
          >
            <View style={[styles.row, { marginBottom: 8 }]}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Primary
              </Text>
              <Text style={[styles.value, { color: theme.textColor }]}>
                {primaryMeaning}
              </Text>
            </View>

            <View style={styles.row}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                User Synonyms
              </Text>
              <View style={styles.synonymsValueContainer}>
                <Text
                  style={[
                    styles.value,
                    { color: theme.textColor, flex: 1 },
                    !radical.userSynonyms?.length && {
                      color: theme.textSecondary,
                      fontStyle: "italic",
                    },
                  ]}
                  numberOfLines={2}
                >
                  {radical.userSynonyms?.length
                    ? radical.userSynonyms.join(", ")
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
            style={[styles.infoBox, { backgroundColor: theme.cardBackground }]}
          >
            <View style={styles.mnemonicContainer}>
              {formatMnemonic(radical.mnemonic)}
            </View>
            {showMnemonicIllustrations && mnemonicImageUrl ? (
              mnemonicImageKind === "svg" && themedMnemonicSvgXml ? (
                <View style={styles.mnemonicSvgContainer}>
                  <SvgXml xml={themedMnemonicSvgXml} width="100%" height="100%" />
                </View>
              ) : mnemonicImageKind === "raster" ? (
                <Image
                  source={{ uri: mnemonicImageUrl }}
                  style={styles.mnemonicImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.mnemonicImageLoading}>
                  <ActivityIndicator size="small" color={subjectColors.radical} />
                </View>
              )
            ) : null}
          </View>
        </View>

        {/* Notes Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            Notes
          </Text>
          {radical.meaningNote ? (
            <TouchableOpacity
              style={[
                styles.infoBox,
                styles.noteBox,
                { backgroundColor: theme.cardBackground },
              ]}
              onPress={radical.onEditNote}
            >
              <View style={styles.noteContainer}>
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
                <Text style={[styles.noteContent, { color: theme.textColor }]}>
                  {radical.meaningNote}
                </Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.infoBox,
                styles.noteBox,
                { backgroundColor: theme.cardBackground },
              ]}
              onPress={radical.onEditNote}
            >
              <Text style={[styles.noteText, { color: theme.textLight }]}>
                Click to add note
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Found In Kanji Section */}
        {radical.amalgamationSubjects &&
          radical.amalgamationSubjects.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
                Found In Kanji
              </Text>
              <View
                style={[
                  styles.infoBox,
                  { backgroundColor: theme.cardBackground },
                ]}
              >
                <Animated.View
                  style={styles.kanjiGrid}
                  entering={FadeInDown.duration(160)}
                  exiting={FadeOutUp.duration(140)}
                  layout={LinearTransition.duration(180).easing(Easing.ease)}
                >
                  {displayKanjiItems?.map((kanji, idx) => {
                    const isAboveUserLevel = kanji.level > userLevel;
                    return (
                      <Animated.View
                        key={kanji.id}
                        entering={
                          shouldStaggerKanji
                            ? FadeInDown.duration(140).delay(idx * 10)
                            : undefined
                        }
                        exiting={FadeOutUp.duration(120)}
                        layout={LinearTransition.duration(180).easing(Easing.ease)}
                      >
                        <TouchableOpacity
                          style={[
                            styles.kanjiItem,
                            {
                              // Width varies with meaning length; bounded by max width
                              width: Math.min(
                                gridItemWidth +
                                  (kanji.meanings?.[0] || "").length * 3,
                                gridItemMaxWidth
                              ),
                              height: smallCardHeight,
                              margin: gridSpacing / 2,
                              opacity: isAboveUserLevel ? 0.8 : 1,
                            },
                          ]}
                          onPress={() =>
                            onSubjectPress
                              ? onSubjectPress(kanji.id)
                              : onKanjiPress?.(kanji.id)
                          }
                        >
                          <Text
                            style={styles.kanjiCharacter}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.75}
                          >
                            {kanji.characters}
                          </Text>
                          <Text
                            style={styles.kanjiMeaning}
                            numberOfLines={2}
                            ellipsizeMode="tail"
                          >
                            {kanji.meanings[0]}
                          </Text>
                          {isAboveUserLevel && (
                            <View style={styles.itemLevelBadge}>
                              <Text style={styles.itemLevelBadgeText}>
                                {kanji.level}
                              </Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      </Animated.View>
                    );
                  })}
                </Animated.View>
                {hasMoreKanjiItems && (
                  <Animated.View
                    entering={FadeInDown.duration(200)}
                    exiting={FadeOutUp.duration(200)}
                    layout={LinearTransition.duration(180).easing(Easing.ease)}
                  >
                    <TouchableOpacity
                      style={[
                        styles.showMoreButton,
                        { borderTopColor: theme.border },
                      ]}
                      onPress={toggleShowAllKanji}
                    >
                      <Text
                        style={[
                          styles.showMoreText,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {showAllKanji
                          ? "Show Less"
                          : `Show ${
                              sortedAmalgamationSubjects.length -
                              maxInitialKanjiItems
                            } More`}
                      </Text>
                      <Ionicons
                        name={showAllKanji ? "chevron-up" : "chevron-down"}
                        size={16}
                        color={subjectColors.kanji}
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
              ) : radical.srsStage === undefined ||
                radical.srsStage === null ||
                radical.srsStage === 0 ? (
                /* Not Started State */
                (<View style={styles.notStartedContainer}>
                  <View style={[styles.srsBadge, styles.lockedBadge]}>
                    <Ionicons name="lock-closed" size={28} color="#fff" />
                  </View>
                  <Text style={[styles.srsName, { color: theme.textColor }]}>
                    {radical.srsStage === 0 ? "Initiate" : "Not Started"}
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
                          {formatNextReviewTime(radical.nextReviewAt)}
                        </Text>
                      </Text>
                    </View>

                    {radical.percentageCorrect !== undefined && (
                      <View style={styles.percentageIndicator}>
                        <Text
                          style={[
                            styles.percentageText,
                            { color: theme.textColor },
                          ]}
                        >
                          {Math.round(radical.percentageCorrect)}% Accuracy
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
                        Meaning Stats
                      </Text>

                      <View style={styles.streakContainer}>
                        <View style={styles.streakItem}>
                          <Text
                            style={[
                              styles.streakLabel,
                              { color: theme.textSecondary },
                            ]}
                          >
                            Streak
                          </Text>
                          <Text
                            style={[
                              styles.streakValue,
                              { color: theme.textColor },
                            ]}
                          >
                            {radical.currentStreak || 0}
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
                            {radical.longestStreak || 0}
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
                            {radical.meaningCorrect || 0}
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
                            {radical.meaningIncorrect || 0}
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
      </Animated.ScrollView>
      {/* Sticky Header */}
      {!embedded && (
        <Animated.View
          style={[
            styles.stickyHeader,
            {
              backgroundColor: subjectColors.radical,
              paddingTop: insets.top + 8,
              paddingBottom: 8,
              height: insets.top + 68,
            },
            stickyHeaderStyle,
          ]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.stickyBackButton}
            hitSlop={BACK_BUTTON_HIT_SLOP}
          >
            <Ionicons name="arrow-back" size={24} color={radicalHeaderTextColor} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.stickyContent}
            onPress={scrollToTop}
            activeOpacity={0.7}
          >
            <View style={styles.stickyCharacterBox}>
              {radical.characters ? (
                <Text style={styles.stickyCharacter}>{radical.characters}</Text>
              ) : svgXml ? (
                <SvgXml xml={svgXml} width={36} height={36} />
              ) : processedImageUrl ? (
                <Image
                  source={{ uri: processedImageUrl }}
                  style={styles.stickyRadicalImage}
                  resizeMode="contain"
                />
              ) : (
                <Text style={styles.stickyCharacterPlaceholder}>?</Text>
              )}
            </View>
            <View style={styles.stickyTextContainer}>
              <Text style={styles.stickyMeaning} numberOfLines={1}>
                {primaryMeaning}
              </Text>
            </View>
            <View style={styles.stickyLevelBadge}>
              <Text style={styles.stickyLevelText}>{radical.level}</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}
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
        currentSynonyms={radical.userSynonyms || []}
        subjectType="radical"
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

const createStyles = (subjectColors: SubjectColors) => {
  const radicalOnColor = getReadableTextColor(subjectColors.radical);
  const kanjiOnColor = getReadableTextColor(subjectColors.kanji);

  return StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  embeddedWrapper: {
    minHeight: 0,
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
    paddingTop: 0,
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
    color: subjectColors.radical,
    fontWeight: "bold",
    fontFamily: "SourceHanSansJP-Bold",
  },
  stickyCharacterPlaceholder: {
    fontSize: 24,
    color: subjectColors.radical,
    fontWeight: "bold",
  },
  stickyRadicalImage: {
    width: 36,
    height: 36,
  },
  stickyTextContainer: {
    flex: 1,
    justifyContent: "center",
  },
  stickyMeaning: {
    fontSize: 16,
    fontWeight: "600",
    color: radicalOnColor,
    marginBottom: 2,
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
    color: radicalOnColor,
    fontWeight: "bold",
    fontSize: 14,
  },
  overscrollBackground: {
    position: "absolute",
    top: -1000, // Extend well above the visible area
    left: 0,
    right: 0,
    height: 1000, // Arbitrary large height
    backgroundColor: subjectColors.radical, // Match the header color
  },
  header: {
    backgroundColor: subjectColors.radical, // Radical color
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
  levelText: {
    color: radicalOnColor,
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
    color: subjectColors.radical,
    fontWeight: "bold",
    fontFamily: "SourceHanSansJP-Bold",
  },
  characterPlaceholder: {
    fontSize: 40,
    color: "#ccc",
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
  radicalImage: {
    width: 60,
    height: 60,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: radicalOnColor,
    marginBottom: 8,
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
  radicalTagText: {
    color: radicalOnColor,
    fontWeight: "bold",
    fontSize: 14,
    fontFamily: "SourceHanSansJP-Bold",
  },
  highlightedText: {
    color: subjectColors.radical,
    fontWeight: "bold",
  },
  mnemonicImage: {
    width: "100%",
    height: 120,
    marginTop: 16,
  },
  mnemonicSvgContainer: {
    width: "100%",
    height: 220,
    marginTop: 16,
  },
  mnemonicImageLoading: {
    width: "100%",
    height: 120,
    marginTop: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  noteText: {
    fontSize: 16,
    color: "#999",
    fontStyle: "italic",
  },
  kanjiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    paddingHorizontal: 4,
  },
  kanjiItem: {
    backgroundColor: subjectColors.kanji,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    paddingHorizontal: 4,
    position: "relative",
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
  itemLevelBadgeText: {
    color: kanjiOnColor,
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "center",
    lineHeight: 14,
  },
  kanjiCharacter: {
    fontSize: 22,
    color: kanjiOnColor,
    fontWeight: "bold",
    fontFamily: "SourceHanSansJP-Bold",
  },
  kanjiMeaning: {
    fontSize: 12,
    color: kanjiOnColor,
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
    fontFamily: "SourceHanSansJP-Bold",
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
  statsContainer: {
    width: "100%",
    marginBottom: 16,
  },
  statColumn: {
    alignItems: "center",
    padding: 8,
  },
  statTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  statDivider: {
    width: 1,
    height: "100%",
    backgroundColor: "#e0e0e0",
  },
  correctnessRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 8,
    width: "100%",
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
};
