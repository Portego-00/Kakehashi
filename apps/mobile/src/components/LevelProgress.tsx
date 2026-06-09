import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SvgXml } from "react-native-svg";
import { LevelItem } from "../types/wanikani";
import { pickBestImage, useRemoteSvg } from "../utils/radicalSvg";
import { useSubjectColors } from "../utils/subjectColors";
import { useTheme } from "../utils/theme";

type SubjectIconSizing = {
  itemSize: number;
  itemGap: number;
  textSize: number;
  glyphSize: number;
  radicalImageSize: number;
  progressBarHeight: number;
  progressBarRadius: number;
  progressBarMarginTop: number;
};

const DEFAULT_SUBJECT_ICON_SIZING: SubjectIconSizing = {
  itemSize: 40,
  itemGap: 8,
  textSize: 18,
  glyphSize: 24,
  radicalImageSize: 28,
  progressBarHeight: 5,
  progressBarRadius: 2,
  progressBarMarginTop: 2,
};

const LARGE_SUBJECT_ICON_SIZING: SubjectIconSizing = {
  itemSize: 52,
  itemGap: 10,
  textSize: 22,
  glyphSize: 30,
  radicalImageSize: 36,
  progressBarHeight: 6,
  progressBarRadius: 3,
  progressBarMarginTop: 3,
};

function getResponsiveSubjectIconSizing(screenWidth: number): SubjectIconSizing {
  const minWidth = 390;
  const maxWidth = 1100;
  const normalizedProgress = Math.min(
    1,
    Math.max(0, (screenWidth - minWidth) / (maxWidth - minWidth))
  );

  const lerp = (smallValue: number, largeValue: number): number =>
    Math.round(smallValue + (largeValue - smallValue) * normalizedProgress);

  return {
    itemSize: lerp(
      DEFAULT_SUBJECT_ICON_SIZING.itemSize,
      LARGE_SUBJECT_ICON_SIZING.itemSize
    ),
    itemGap: lerp(
      DEFAULT_SUBJECT_ICON_SIZING.itemGap,
      LARGE_SUBJECT_ICON_SIZING.itemGap
    ),
    textSize: lerp(
      DEFAULT_SUBJECT_ICON_SIZING.textSize,
      LARGE_SUBJECT_ICON_SIZING.textSize
    ),
    glyphSize: lerp(
      DEFAULT_SUBJECT_ICON_SIZING.glyphSize,
      LARGE_SUBJECT_ICON_SIZING.glyphSize
    ),
    radicalImageSize: lerp(
      DEFAULT_SUBJECT_ICON_SIZING.radicalImageSize,
      LARGE_SUBJECT_ICON_SIZING.radicalImageSize
    ),
    progressBarHeight: lerp(
      DEFAULT_SUBJECT_ICON_SIZING.progressBarHeight,
      LARGE_SUBJECT_ICON_SIZING.progressBarHeight
    ),
    progressBarRadius:
      normalizedProgress >= 0.5
        ? LARGE_SUBJECT_ICON_SIZING.progressBarRadius
        : DEFAULT_SUBJECT_ICON_SIZING.progressBarRadius,
    progressBarMarginTop: lerp(
      DEFAULT_SUBJECT_ICON_SIZING.progressBarMarginTop,
      LARGE_SUBJECT_ICON_SIZING.progressBarMarginTop
    ),
  };
}

type LevelProgressProps = {
  level: number;
  completedCount: number;
  totalCount: number;
  srsStagesCompleted: number;
  srsStagesTotal: number;
  levelTimeRemaining: string;
  levelTimeRemainingIsEstimate: boolean;
  items: LevelItem[];
  onItemPress: (item: LevelItem) => void;
};

const KanjiBlock = ({
  item,
  onPress,
  sizing,
}: {
  item: LevelItem;
  onPress: () => void;
  sizing: SubjectIconSizing;
}) => {
  // Gray if never started (srsStage === 0)
  // Full color if started (srsStage > 0)
  // Types have their own colors: radicals are blue, kanji are pink

  const { isDark } = useTheme();
  const subjectColors = useSubjectColors();
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(
    null
  );

  let backgroundColor = isDark ? "#444444" : "#ccc"; // Dark gray for dark mode, light gray for light mode

  if (item.srsStage > 0) {
    // Item has been started, use full color based on type
    backgroundColor =
      item.item_type === "radical"
        ? subjectColors.radical
        : subjectColors.kanji;
  }

  // ------------- image selection (SVG preferred) -------------
  const bestImg =
    item.characterImages && item.characterImages.length > 0
      ? pickBestImage(item.characterImages)
      : null;
  const svgUrl = bestImg?.type === "svg" ? bestImg.url : null;
  const svgXml = useRemoteSvg(svgUrl, "#ffffff"); // White color for visibility

  useEffect(() => {
    if (bestImg?.type === "png") {
      const cleaned = bestImg.url.replace(/^@/, "");
      setProcessedImageUrl(cleaned);
    } else if (item.imageUrl) {
      const cleaned = item.imageUrl.replace(/^@/, "");
      setProcessedImageUrl(cleaned);
    } else {
      setProcessedImageUrl(null);
    }
  }, [bestImg, item.imageUrl]);

  // Check if characters is a Japanese character, not just English text
  // For radicals, if characters matches the first meaning, it's likely just English
  const isEnglishCharacters =
    item.item_type === "radical" &&
    item.characters &&
    item.meanings.length > 0 &&
    item.characters.toLowerCase() === item.meanings[0].toLowerCase();

  return (
    <View style={styles.itemWrapper}>
      <TouchableOpacity
        style={[
          styles.itemBlock,
          {
            backgroundColor,
            width: sizing.itemSize,
            height: sizing.itemSize,
            borderRadius: sizing.progressBarRadius * 2,
          },
        ]}
        onPress={onPress}
      >
        {item.characters && !isEnglishCharacters ? (
          <Text style={[styles.itemText, { fontSize: sizing.textSize }]}>
            {item.characters}
          </Text>
        ) : svgXml ? (
          <SvgXml
            xml={svgXml}
            width={sizing.glyphSize}
            height={sizing.glyphSize}
          />
        ) : processedImageUrl ? (
          <Image
            source={{ uri: processedImageUrl }}
            style={[
              styles.radicalImage,
              {
                width: sizing.radicalImageSize,
                height: sizing.radicalImageSize,
              },
            ]}
            resizeMode="contain"
          />
        ) : (
          <Text style={[styles.itemText, { fontSize: sizing.textSize }]}>
            {item.meanings[0]}
          </Text>
        )}
      </TouchableOpacity>

      {/* Progress bar below the block for items in progress */}
      {item.srsStage > 0 && (
        <View
          style={[
            styles.progressBarWrapper,
            {
              width: sizing.itemSize,
              height: sizing.progressBarHeight,
              marginTop: sizing.progressBarMarginTop,
            },
          ]}
        >
          {item.srsStage >= 5 ? (
            // Guru+ level item: show full bar with no segments
            <View
              style={[
                styles.progressBarFull,
                { borderRadius: sizing.progressBarRadius },
              ]}
            />
          ) : (
            // Item in progress: show segmented bar
            <View style={styles.progressBarSegments}>
              {[1, 2, 3, 4, 5].map((stage) => (
                <View
                  key={stage}
                  style={[
                    styles.progressBarSegment,
                    // First segment gets left border radius
                    stage === 1
                      ? [
                          styles.progressBarSegmentLeft,
                          {
                            borderTopLeftRadius: sizing.progressBarRadius,
                            borderBottomLeftRadius: sizing.progressBarRadius,
                          },
                        ]
                      : null,
                    // Last segment gets right border radius
                    stage === 5
                      ? [
                          styles.progressBarSegmentRight,
                          {
                            borderTopRightRadius: sizing.progressBarRadius,
                            borderBottomRightRadius: sizing.progressBarRadius,
                          },
                        ]
                      : null,
                    // Fill segments based on current SRS stage
                    item.srsStage >= stage
                      ? styles.progressBarSegmentFilled
                      : null,
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
};

export default function LevelProgress({
  level,
  completedCount,
  totalCount,
  srsStagesCompleted,
  srsStagesTotal,
  levelTimeRemaining,
  levelTimeRemainingIsEstimate,
  items,
  onItemPress,
}: LevelProgressProps) {
  const { theme } = useTheme();
  const subjectColors = useSubjectColors();
  const { width: screenWidth } = useWindowDimensions();
  const timeRemainingTitle = "Level Up In";
  const iconSizing = React.useMemo(
    () => getResponsiveSubjectIconSizing(screenWidth),
    [screenWidth]
  );

  // Check if we have valid data
  const hasValidData = items && items.length > 0 && totalCount > 0;

  // Separate radicals and kanji
  const radicals = hasValidData
    ? items
        .filter((item) => item.item_type === "radical")
        .sort((a, b) => b.srsStage - a.srsStage) // Sort by srsStage descending
    : [];

  const kanji = hasValidData
    ? items
        .filter((item) => item.item_type === "kanji")
        .sort((a, b) => b.srsStage - a.srsStage) // Sort by srsStage descending
    : [];

  // Calculate progress percentage based on SRS stages
  const progressPercent =
    srsStagesTotal > 0
      ? Math.round((srsStagesCompleted / srsStagesTotal) * 100)
      : 0;

  const guruKanjiRequiredForLevelUp =
    totalCount > 0 ? Math.ceil(totalCount * 0.9) : 0;
  const guruKanjiCompletedForLevelUp = Math.min(
    completedCount,
    guruKanjiRequiredForLevelUp
  );
  const kanjiRemainingToGuru = Math.max(
    guruKanjiRequiredForLevelUp - completedCount,
    0
  );

  const [containerWidth, setContainerWidth] = useState(0);
  const fallbackItemsPerRow = Math.max(radicals.length, kanji.length, 1);
  const calculatedItemsPerRow =
    containerWidth > 0
      ? Math.floor(
          (containerWidth + iconSizing.itemGap) /
            (iconSizing.itemSize + iconSizing.itemGap)
        )
      : fallbackItemsPerRow;
  const maxItemsPerRow =
    calculatedItemsPerRow > 0 ? calculatedItemsPerRow : 1;
  const horizontalGap =
    containerWidth > 0 && maxItemsPerRow > 1
      ? (containerWidth - iconSizing.itemSize * maxItemsPerRow) /
        (maxItemsPerRow - 1)
      : iconSizing.itemGap;
  const radicalRows = React.useMemo(() => {
    const rows: LevelItem[][] = [];
    for (let i = 0; i < radicals.length; i += maxItemsPerRow) {
      rows.push(radicals.slice(i, i + maxItemsPerRow));
    }
    return rows;
  }, [radicals, maxItemsPerRow]);
  const kanjiRows = React.useMemo(() => {
    const rows: LevelItem[][] = [];
    for (let i = 0; i < kanji.length; i += maxItemsPerRow) {
      rows.push(kanji.slice(i, i + maxItemsPerRow));
    }
    return rows;
  }, [kanji, maxItemsPerRow]);

  // Show loading state if no valid data
  if (!hasValidData) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.cardBackground,
            shadowColor: theme.isDark ? "#000" : "#000",
          },
        ]}
      >
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: theme.textColor }]}>
            Level {level} Progress
          </Text>
          <View style={styles.progressInfo}>
            <Ionicons
              name="time-outline"
              size={18}
              color={theme.textSecondary}
            />
            <Text
              style={[styles.progressPercent, { color: theme.textSecondary }]}
            >
              Loading...
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.progressBarContainer,
            { backgroundColor: theme.isDark ? "#333" : "#f0f0f0" },
          ]}
        >
          <View style={[styles.progressBar, { width: "0%" }]} />
        </View>

        <Text style={[styles.progressDetail, { color: theme.textSecondary }]}>
          Loading level data...
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.border,
          shadowColor: theme.isDark ? "#000" : "#000",
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: theme.textColor }]}>
          Level {level} Progress
        </Text>
        <View style={styles.progressInfo}>
          <Ionicons name="checkmark-circle" size={18} color="#43aa8b" />
          <Text style={styles.progressPercent}>{progressPercent}%</Text>
        </View>
      </View>

      <View
        style={[
          styles.progressBarContainer,
          { backgroundColor: theme.isDark ? "#333" : "#f0f0f0" },
        ]}
      >
        <View style={[styles.progressBar, { width: `${progressPercent}%` }]} />
      </View>

      <Text style={[styles.progressDetail, { color: theme.textSecondary }]}>
        {srsStagesCompleted} of {srsStagesTotal} SRS stages completed
      </Text>

      {guruKanjiRequiredForLevelUp > 0 && (
        <View style={styles.kanjiLevelUpContainer}>
          <Text style={[styles.kanjiLevelUpText, { color: theme.textSecondary }]}>
            Guru{" "}
            <Text style={[styles.kanjiLevelUpHighlight, { color: theme.textColor }]}>
              {kanjiRemainingToGuru} more kanji
            </Text>{" "}
            to level up.
          </Text>

          <View style={styles.kanjiRequirementBar}>
            {Array.from({ length: guruKanjiRequiredForLevelUp }).map(
              (_, index) => {
                const isFirst = index === 0;
                const isLast = index === guruKanjiRequiredForLevelUp - 1;

                return (
                  <View
                    key={index}
                    style={[
                      styles.kanjiRequirementSegment,
                      {
                        backgroundColor:
                          index < guruKanjiCompletedForLevelUp
                            ? subjectColors.kanji
                            : theme.isDark
                            ? "#4a5058"
                            : "#c0c7cf",
                        marginRight: isLast ? 0 : 2,
                        borderTopLeftRadius: isFirst ? 4 : 1,
                        borderBottomLeftRadius: isFirst ? 4 : 1,
                        borderTopRightRadius: isLast ? 4 : 1,
                        borderBottomRightRadius: isLast ? 4 : 1,
                      },
                    ]}
                  />
                );
              }
            )}
          </View>
        </View>
      )}

      <View
        style={[
          styles.timeRemainingCard,
          {
            backgroundColor: theme.isDark ? "#242424" : "#f6f7f8",
            borderColor: theme.border,
          },
        ]}
      >
        <View style={styles.timeRemainingContent}>
          <View
            style={[
              styles.timeRemainingIcon,
              { backgroundColor: theme.isDark ? "#2f2f2f" : "#ffffff" },
            ]}
          >
            <Ionicons name="time-outline" size={16} color={theme.textSecondary} />
          </View>

          <View style={styles.timeRemainingText}>
            <View style={styles.timeRemainingHeader}>
              <Text
                style={[styles.timeRemainingTitle, { color: theme.textSecondary }]}
              >
                {timeRemainingTitle}
              </Text>

              {levelTimeRemainingIsEstimate && (
                <View
                  style={[
                    styles.estimateBadge,
                    {
                      backgroundColor: theme.isDark
                        ? "rgba(250, 159, 66, 0.2)"
                        : "rgba(250, 159, 66, 0.16)",
                    },
                  ]}
                >
                  <Text style={styles.estimateBadgeText}>Estimated</Text>
                </View>
              )}
            </View>

            <Text style={[styles.timeRemainingValue, { color: theme.textColor }]}>
              {levelTimeRemaining}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionContainer}>
        <View
          style={[styles.sectionHeader, { borderBottomColor: theme.border }]}
        >
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            Radicals
          </Text>
        </View>

        <View onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
          {radicalRows.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.rowContainer}>
              {row.map((item, idx) => (
                <View
                  key={item.id}
                  style={{
                    marginRight: idx < row.length - 1 ? horizontalGap : 0,
                    marginBottom: iconSizing.itemGap,
                  }}
                >
                  <KanjiBlock
                    item={item}
                    sizing={iconSizing}
                    onPress={() => onItemPress(item)}
                  />
                </View>
              ))}
            </View>
          ))}
        </View>
      </View>

      <View style={styles.sectionContainer}>
        <View
          style={[styles.sectionHeader, { borderBottomColor: theme.border }]}
        >
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            Kanji
          </Text>
        </View>

        <View onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
          {kanjiRows.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.rowContainer}>
              {row.map((item, idx) => (
                <View
                  key={item.id}
                  style={{
                    marginRight: idx < row.length - 1 ? horizontalGap : 0,
                    marginBottom: iconSizing.itemGap,
                  }}
                >
                  <KanjiBlock
                    item={item}
                    sizing={iconSizing}
                    onPress={() => onItemPress(item)}
                  />
                </View>
              ))}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
  },
  progressInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  progressPercent: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#43aa8b",
    marginLeft: 4,
  },
  progressDetail: {
    fontSize: 14,
    marginBottom: 16,
  },
  kanjiLevelUpContainer: {
    marginBottom: 16,
  },
  kanjiLevelUpText: {
    fontSize: 14,
    marginBottom: 6,
  },
  kanjiLevelUpHighlight: {
    fontSize: 14,
    fontWeight: "700",
  },
  kanjiRequirementBar: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    height: 8,
  },
  kanjiRequirementSegment: {
    flex: 1,
    height: "100%",
  },
  timeRemainingCard: {
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  timeRemainingContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeRemainingIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  timeRemainingText: {
    flex: 1,
  },
  timeRemainingHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  timeRemainingTitle: {
    fontSize: 12,
    fontWeight: "500",
  },
  estimateBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  estimateBadgeText: {
    color: "#fa9f42",
    fontSize: 11,
    fontWeight: "700",
  },
  timeRemainingValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  progressBarContainer: {
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#43aa8b",
    borderRadius: 4,
  },
  sectionContainer: {
    marginBottom: 16,
    marginTop: 8,
  },
  sectionHeader: {
    marginBottom: 8,
    borderBottomWidth: 1,
    paddingBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  itemsContainer: {},
  itemWrapper: {
    // margin: 4,
    alignItems: "center",
  },
  itemBlock: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 4,
  },
  itemText: {
    fontSize: 18,
    color: "white",
    fontWeight: "400",
    fontFamily: "SourceHanSansJP-Regular",
    // Android-specific: remove extra font padding and center vertically
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  radicalImage: {
    width: 28,
    height: 28,
  },
  progressBarWrapper: {
    width: 40,
    height: 5,
    marginTop: 2,
  },
  progressBarFull: {
    width: "100%",
    height: "100%",
    backgroundColor: "#43aa8b",
    borderRadius: 2,
  },
  progressBarSegments: {
    flexDirection: "row",
    height: "100%",
    width: "100%",
  },
  progressBarSegment: {
    flex: 1,
    height: "100%",
    backgroundColor: "#ddd",
    marginHorizontal: 0.5,
  },
  progressBarSegmentLeft: {
    borderTopLeftRadius: 2,
    borderBottomLeftRadius: 2,
    marginLeft: 0,
  },
  progressBarSegmentRight: {
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
    marginRight: 0,
  },
  progressBarSegmentFilled: {
    backgroundColor: "#43aa8b",
  },
  progressDots: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    height: 5,
  },
  progressDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#ddd",
    marginHorizontal: 1,
  },
  progressDotFilled: {
    backgroundColor: "#43aa8b", // Green color for filled progress
  },
  rowContainer: {
    flexDirection: "row",
  },
});
