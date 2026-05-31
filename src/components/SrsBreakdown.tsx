import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  type LayoutChangeEvent,
  ScrollView,
  type StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  type ViewStyle,
  View,
} from "react-native";
import type { SrsLevel } from "../types/wanikani";
import { useSubjectColors, withAlpha } from "../utils/subjectColors";
import {
  ACTIVE_SRS_STAGES,
  GROUPED_ACTIVE_SRS_STAGES,
  buildSrsStageBreakdown,
  buildSrsStageBreakdownFromLevels,
  findGroupLevelForStage,
  groupSrsStageBreakdown,
  type SrsStageBreakdown,
} from "../utils/srsBreakdownStages";
import { useSettingsStore } from "../utils/store";
import { useTheme } from "../utils/theme";
import SrsStageIcon from "./SrsStageIcon";

export type SrsBreakdownViewMode = "combined" | "graph" | "details";
export type SrsBreakdownGroupStagesScope = "shared" | "graph" | "details";

type SrsBreakdownProps = {
  levels: SrsLevel[];
  assignments?: { data?: { srs_stage?: number; subject_id?: number; started_at?: string | null } }[];
  subjects?: { id?: number; object?: string }[];
  onLevelPress?: (level: SrsLevel) => void;
  onStagePress?: (
    stage: number,
    stageLabel: string,
    options?: { exactStage?: boolean }
  ) => void;
  viewMode?: SrsBreakdownViewMode;
  groupStagesScope?: SrsBreakdownGroupStagesScope;
  style?: StyleProp<ViewStyle>;
};

type BreakdownPillProps = {
  value: number;
  backgroundColor: string;
  textColor: string;
  borderColor?: string;
};

const CHART_HEIGHT = 136;
const AXIS_INTERVALS = 4;
const AXIS_LABEL_LINE_HEIGHT = 14;
const BAR_VALUE_LABEL_LINE_HEIGHT = 10;
const BAR_VALUE_LABEL_GAP = 6;
const CHART_TOP_INSET = 8;
const HEADER_HEIGHT = 34;
const X_AXIS_HEIGHT = 66;
const PANEL_HEIGHT = CHART_HEIGHT + X_AXIS_HEIGHT;
const TRANSITION_MS = 220;

function getNiceAxisStep(value: number): number {
  if (!Number.isFinite(value) || value <= 1) {
    return 1;
  }

  const base = 10 ** Math.floor(Math.log10(value));
  const normalized = value / base;

  if (normalized <= 1) {
    return base;
  }
  if (normalized <= 2) {
    return 2 * base;
  }
  if (normalized <= 2.5) {
    return 2.5 * base;
  }
  if (normalized <= 5) {
    return 5 * base;
  }
  return 10 * base;
}

function formatAxisValue(value: number): string {
  return value.toLocaleString("en-US");
}

function BreakdownPill({ value, backgroundColor, textColor, borderColor }: BreakdownPillProps) {
  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor,
          borderColor: borderColor ?? "transparent",
        },
      ]}
    >
      <Text style={[styles.pillText, { color: textColor }]}>{value}</Text>
    </View>
  );
}

export default function SrsBreakdown({
  levels,
  assignments,
  subjects,
  onLevelPress,
  onStagePress,
  viewMode = "combined",
  groupStagesScope = "shared",
  style,
}: SrsBreakdownProps) {
  const { theme } = useTheme();
  const subjectColors = useSubjectColors();
  const sharedWidgetSrsBreakdownGroupStages = useSettingsStore(
    (state) => state.widgetSrsBreakdownGroupStages
  );
  const graphWidgetSrsBreakdownGroupStages = useSettingsStore(
    (state) => state.widgetSrsBreakdownGraphGroupStages
  );
  const detailsWidgetSrsBreakdownGroupStages = useSettingsStore(
    (state) => state.widgetSrsBreakdownDetailsGroupStages
  );
  const setSharedWidgetSrsBreakdownGroupStages = useSettingsStore(
    (state) => state.setWidgetSrsBreakdownGroupStages
  );
  const setGraphWidgetSrsBreakdownGroupStages = useSettingsStore(
    (state) => state.setWidgetSrsBreakdownGraphGroupStages
  );
  const setDetailsWidgetSrsBreakdownGroupStages = useSettingsStore(
    (state) => state.setWidgetSrsBreakdownDetailsGroupStages
  );
  const widgetSrsBreakdownGroupStages =
    groupStagesScope === "graph"
      ? graphWidgetSrsBreakdownGroupStages
      : groupStagesScope === "details"
        ? detailsWidgetSrsBreakdownGroupStages
        : sharedWidgetSrsBreakdownGroupStages;
  const setWidgetSrsBreakdownGroupStages =
    groupStagesScope === "graph"
      ? setGraphWidgetSrsBreakdownGroupStages
      : groupStagesScope === "details"
        ? setDetailsWidgetSrsBreakdownGroupStages
        : setSharedWidgetSrsBreakdownGroupStages;
  const [showDetails, setShowDetails] = useState(false);
  const [cardWidth, setCardWidth] = useState(0);
  const isCombinedView = viewMode === "combined";
  const isGraphOnlyView = viewMode === "graph";
  const isDetailsOnlyView = viewMode === "details";
  const shouldScrollDetailsOnly = isDetailsOnlyView && !widgetSrsBreakdownGroupStages;
  const transitionTarget = isCombinedView ? (showDetails ? 1 : 0) : isDetailsOnlyView ? 1 : 0;
  const detailsVisible = transitionTarget === 1;

  const transitionValue = useRef(new Animated.Value(transitionTarget)).current;

  useEffect(() => {
    if (!isCombinedView && showDetails) {
      setShowDetails(false);
    }
  }, [isCombinedView, showDetails]);

  useEffect(() => {
    if (!isCombinedView) {
      transitionValue.setValue(transitionTarget);
      return;
    }

    Animated.timing(transitionValue, {
      toValue: transitionTarget,
      duration: TRANSITION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [isCombinedView, transitionTarget, transitionValue]);

  const graphOpacity = transitionValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const detailsOpacity = transitionValue;

  const graphTranslateX = transitionValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });
  const detailsTranslateX = transitionValue.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 0],
  });

  const activeStagesSet = useMemo(
    () =>
      new Set<number>(
        widgetSrsBreakdownGroupStages
          ? GROUPED_ACTIVE_SRS_STAGES
          : ACTIVE_SRS_STAGES
      ),
    [widgetSrsBreakdownGroupStages]
  );

  const baseStages = useMemo(() => {
    if (assignments && subjects) {
      return buildSrsStageBreakdown(assignments, subjects);
    }

    return buildSrsStageBreakdownFromLevels(levels);
  }, [assignments, levels, subjects]);

  const allStages = useMemo(
    () =>
      widgetSrsBreakdownGroupStages
        ? groupSrsStageBreakdown(baseStages)
        : baseStages,
    [baseStages, widgetSrsBreakdownGroupStages]
  );

  const visibleStages = useMemo(
    () => allStages.filter((stage) => activeStagesSet.has(stage.stage)),
    [activeStagesSet, allStages]
  );

  const maxTotal = useMemo(
    () => Math.max(1, ...allStages.map((stage) => stage.total)),
    [allStages]
  );

  const axisConfig = useMemo(() => {
    const intervalCandidates = [AXIS_INTERVALS, 5, 6];
    let best: { intervals: number; step: number; max: number } | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    intervalCandidates.forEach((intervals) => {
      const step = getNiceAxisStep(maxTotal / intervals);
      const max = step * intervals;
      const ratio = max / maxTotal;
      const score = ratio + intervals * 0.01;

      if (!best || score < bestScore) {
        best = { intervals, step, max };
        bestScore = score;
      }
    });

    return best ?? { intervals: AXIS_INTERVALS, step: 1, max: AXIS_INTERVALS };
  }, [maxTotal]);

  const axisMax = axisConfig.max;
  const axisIntervals = axisConfig.intervals;

  const axisValues = useMemo(
    () =>
      Array.from({ length: axisIntervals + 1 }, (_, index) =>
        Math.round((axisMax * (axisIntervals - index)) / axisIntervals)
      ),
    [axisIntervals, axisMax]
  );

  const canPressStages = Boolean(onStagePress || onLevelPress);
  const useCompactDetailsLabels = cardWidth > 0 && cardWidth < 360;

  const handleCardLayout = (event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (Math.abs(nextWidth - cardWidth) > 1) {
      setCardWidth(nextWidth);
    }
  };

  const handlePressStage = (stage: SrsStageBreakdown) => {
    const groupedRangeStage =
      widgetSrsBreakdownGroupStages && (stage.stage === 1 || stage.stage === 5);

    if (onStagePress) {
      onStagePress(stage.stage, stage.label, {
        exactStage: !groupedRangeStage,
      });
      return;
    }

    if (!onLevelPress) {
      return;
    }

    const matchingLevel = findGroupLevelForStage(levels, stage.stage);
    if (matchingLevel) {
      onLevelPress(matchingLevel);
    }
  };

  const getStageTickLabel = (stage: SrsStageBreakdown): string => {
    if (!widgetSrsBreakdownGroupStages) {
      return stage.roman;
    }

    if (stage.stage === 1) {
      return "I-IV";
    }

    if (stage.stage === 5) {
      return "V-VI";
    }

    return stage.roman;
  };

  const renderDetailsRows = () =>
    allStages.map((stage) => (
      <TouchableOpacity
        key={stage.stage}
        style={[
          styles.stageRow,
          {
            borderColor: theme.border,
          },
        ]}
        onPress={() => handlePressStage(stage)}
        activeOpacity={0.82}
        disabled={!canPressStages}
      >
        <View style={styles.stageLabelArea}>
          <SrsStageIcon stage={stage.stage} size={22} color={theme.textSecondary} />
          <Text style={[styles.stageLabel, { color: theme.textColor }]} numberOfLines={1}>
            {useCompactDetailsLabels ? stage.shortLabel : stage.label}
          </Text>
        </View>

        <View style={styles.pillsRow}>
          <BreakdownPill
            value={stage.breakdown.radical}
            backgroundColor={subjectColors.radical}
            textColor="#ffffff"
          />
          <BreakdownPill
            value={stage.breakdown.kanji}
            backgroundColor={subjectColors.kanji}
            textColor="#ffffff"
          />
          <BreakdownPill
            value={stage.breakdown.vocabulary}
            backgroundColor={subjectColors.vocabulary}
            textColor="#ffffff"
          />
          <BreakdownPill
            value={stage.total}
            backgroundColor={withAlpha(theme.textSecondary, theme.isDark ? 0.17 : 0.08)}
            textColor={theme.textColor}
            borderColor={withAlpha(theme.textSecondary, theme.isDark ? 0.48 : 0.2)}
          />
        </View>
      </TouchableOpacity>
    ));

  const renderGroupToggleButton = () => (
    <TouchableOpacity
      style={[
        styles.groupToggleButton,
        {
          borderColor: widgetSrsBreakdownGroupStages
            ? withAlpha(theme.primary, theme.isDark ? 0.65 : 0.55)
            : withAlpha(theme.textSecondary, theme.isDark ? 0.45 : 0.3),
          backgroundColor: widgetSrsBreakdownGroupStages
            ? withAlpha(theme.primary, theme.isDark ? 0.2 : 0.14)
            : withAlpha(theme.textSecondary, theme.isDark ? 0.12 : 0.08),
        },
      ]}
      onPress={() =>
        setWidgetSrsBreakdownGroupStages(!widgetSrsBreakdownGroupStages)
      }
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={
        widgetSrsBreakdownGroupStages
          ? "Show split SRS stages"
          : "Show grouped SRS stages"
      }
    >
      <Ionicons
        name={widgetSrsBreakdownGroupStages ? "layers" : "layers-outline"}
        size={15}
        color={
          widgetSrsBreakdownGroupStages ? theme.primary : theme.textSecondary
        }
      />
    </TouchableOpacity>
  );

  return (
    <View
      style={[
        styles.card,
        isGraphOnlyView && styles.cardGraphOnly,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.border,
          shadowColor: theme.isDark ? "#000" : "rgba(0,0,0,0.1)",
        },
        style,
      ]}
      onLayout={handleCardLayout}
    >
      <View style={styles.headerViewport}>
        <Animated.View
          pointerEvents={detailsVisible ? "none" : "auto"}
          style={[
            styles.headerLayer,
            {
              opacity: graphOpacity,
              transform: [{ translateX: graphTranslateX }],
            },
          ]}
        >
          <Text style={[styles.title, { color: theme.textColor }]}>Active Item Spread</Text>
          <View style={styles.headerActions}>
            {renderGroupToggleButton()}

            {isCombinedView ? (
              <TouchableOpacity
                style={styles.detailsButton}
                onPress={() => setShowDetails(true)}
                activeOpacity={0.75}
              >
                <Text style={[styles.detailsText, { color: theme.textColor }]}>Details</Text>
                <Ionicons name="chevron-forward" size={19} color={theme.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>
        </Animated.View>

        <Animated.View
          pointerEvents={detailsVisible ? "auto" : "none"}
          style={[
            styles.headerLayer,
            {
              opacity: detailsOpacity,
              transform: [{ translateX: detailsTranslateX }],
            },
          ]}
        >
          {isCombinedView ? (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setShowDetails(false)}
              activeOpacity={0.75}
            >
              <Ionicons name="chevron-back" size={19} color={theme.textSecondary} />
              <Text style={[styles.backText, { color: theme.textColor }]}>Back</Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.title, { color: theme.textColor }]}>Stage Breakdown</Text>
          )}

          <View style={styles.headerActions}>
            {renderGroupToggleButton()}
          </View>
        </Animated.View>
      </View>

      <View
        style={[
          styles.panelViewport,
          isDetailsOnlyView &&
            !shouldScrollDetailsOnly &&
            styles.panelViewportForDetailsOnly,
        ]}
      >
        <Animated.View
          pointerEvents={detailsVisible ? "none" : "auto"}
          style={[
            styles.panelLayer,
            {
              opacity: graphOpacity,
              transform: [{ translateX: graphTranslateX }],
            },
          ]}
        >
          <View style={styles.chartBody}>
            <View style={styles.chartTopRow}>
                <View style={[styles.axisLabelColumn, { height: CHART_HEIGHT }]}>
                {axisValues.map((value, index) => {
                  const lineY =
                    CHART_TOP_INSET +
                    ((CHART_HEIGHT - CHART_TOP_INSET) / axisIntervals) * index;
                  const centeredTop = lineY - AXIS_LABEL_LINE_HEIGHT / 2;
                  const top =
                    index === 0
                      ? Math.max(0, centeredTop)
                      : index === axisIntervals
                        ? CHART_HEIGHT - AXIS_LABEL_LINE_HEIGHT
                        : centeredTop;

                  return (
                    <Text
                      key={`${value}-${index}`}
                      style={[
                        styles.axisLabel,
                        { color: theme.textSecondary, top },
                      ]}
                    >
                      {value === 0 ? "" : formatAxisValue(value)}
                    </Text>
                  );
                })}
              </View>

              <View style={styles.chartColumn}>
                <View style={styles.gridContainer}>
                  {axisValues.map((value) => (
                    <View
                      key={value}
                      style={[
                        styles.gridLine,
                        {
                          borderBottomColor: withAlpha(
                            theme.textSecondary,
                            value === 0 ? 0.28 : 0.2
                          ),
                        },
                      ]}
                    />
                  ))}
                </View>

                <View style={[styles.barsRow, { height: CHART_HEIGHT }]}>
                  {visibleStages.map((stage) => {
                    const totalHeight =
                      stage.total > 0
                        ? Math.max(2, (stage.total / axisMax) * (CHART_HEIGHT - CHART_TOP_INSET))
                        : 0;
                    const valueLabelBottom = Math.min(
                      totalHeight + BAR_VALUE_LABEL_GAP,
                      CHART_HEIGHT - BAR_VALUE_LABEL_LINE_HEIGHT
                    );

                    const radicalHeight =
                      stage.total > 0 ? (stage.breakdown.radical / stage.total) * totalHeight : 0;
                    const kanjiHeight =
                      stage.total > 0 ? (stage.breakdown.kanji / stage.total) * totalHeight : 0;
                    const vocabularyHeight =
                      stage.total > 0
                        ? (stage.breakdown.vocabulary / stage.total) * totalHeight
                        : 0;

                    return (
                      <TouchableOpacity
                        key={stage.stage}
                        style={styles.stageCell}
                        onPress={() => handlePressStage(stage)}
                        disabled={!canPressStages}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.barValueLabel,
                            {
                              color: theme.textSecondary,
                              bottom: stage.total > 0 ? valueLabelBottom : 4,
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {formatAxisValue(stage.total)}
                        </Text>
                        <View style={styles.barContainer}>
                          <View
                            style={[
                              styles.barSegment,
                              styles.barSegmentTopRadius,
                              { height: vocabularyHeight, backgroundColor: subjectColors.vocabulary },
                            ]}
                          />
                          <View
                            style={[
                              styles.barSegment,
                              { height: kanjiHeight, backgroundColor: subjectColors.kanji },
                            ]}
                          />
                          <View
                            style={[
                              styles.barSegment,
                              { height: radicalHeight, backgroundColor: subjectColors.radical },
                            ]}
                          />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            <View
              style={[
                styles.xAxisRow,
                { borderBottomColor: withAlpha(theme.textSecondary, theme.isDark ? 0.32 : 0.24) },
              ]}
            >
              <View style={styles.axisSpacer} />
              <View style={styles.stageTicksRow}>
                {visibleStages.map((stage) => (
                  <TouchableOpacity
                    key={`tick-${stage.stage}`}
                    style={styles.stageCell}
                    onPress={() => handlePressStage(stage)}
                    disabled={!canPressStages}
                    activeOpacity={0.8}
                  >
                    <View style={styles.stageLegend}>
                      <SrsStageIcon stage={stage.stage} size={24} color={theme.textSecondary} />
                      <Text
                        style={[
                          styles.stageRoman,
                          getStageTickLabel(stage).includes("-") && styles.stageRomanRange,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {getStageTickLabel(stage)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </Animated.View>

        {isDetailsOnlyView ? (
          shouldScrollDetailsOnly ? (
            <ScrollView
              style={styles.detailsScroll}
              contentContainerStyle={styles.detailsScrollContent}
              showsVerticalScrollIndicator
            >
              {renderDetailsRows()}
            </ScrollView>
          ) : (
            <View style={styles.detailsList}>{renderDetailsRows()}</View>
          )
        ) : (
          <Animated.View
            pointerEvents={detailsVisible ? "auto" : "none"}
            style={[
              styles.panelLayer,
              {
                opacity: detailsOpacity,
                transform: [{ translateX: detailsTranslateX }],
              },
            ]}
          >
            <ScrollView
              style={styles.detailsScroll}
              contentContainerStyle={styles.detailsScrollContent}
              showsVerticalScrollIndicator
            >
              {renderDetailsRows()}
            </ScrollView>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardGraphOnly: {
    justifyContent: "center",
  },
  headerViewport: {
    height: HEADER_HEIGHT,
    marginBottom: 6,
    position: "relative",
  },
  headerLayer: {
    ...StyleSheet.absoluteFill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.1,
    flexShrink: 1,
    paddingHorizontal: 3,
  },
  detailsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 1,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginLeft: 8,
  },
  groupToggleButton: {
    borderWidth: 1,
    borderRadius: 8,
    width: 30,
    height: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  detailsText: {
    fontSize: 14,
    fontWeight: "500",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingRight: 6,
  },
  backText: {
    fontSize: 15,
    fontWeight: "500",
  },
  panelViewport: {
    height: PANEL_HEIGHT,
    position: "relative",
    overflow: "hidden",
  },
  panelViewportForDetailsOnly: {
    height: "auto",
    overflow: "visible",
    minHeight: 0,
  },
  panelLayer: {
    ...StyleSheet.absoluteFill,
  },
  chartBody: {
    flex: 1,
  },
  chartTopRow: {
    flexDirection: "row",
    gap: 6,
  },
  axisLabelColumn: {
    width: 50,
    position: "relative",
  },
  axisLabel: {
    position: "absolute",
    right: 0,
    width: "100%",
    fontSize: 12,
    lineHeight: AXIS_LABEL_LINE_HEIGHT,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  chartColumn: {
    flex: 1,
  },
  gridContainer: {
    justifyContent: "space-between",
    position: "absolute",
    left: 0,
    right: 0,
    top: CHART_TOP_INSET,
    height: CHART_HEIGHT - CHART_TOP_INSET,
    pointerEvents: "none",
  },
  gridLine: {
    borderBottomWidth: 1,
  },
  barsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 1,
  },
  stageCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    position: "relative",
  },
  barValueLabel: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 2,
    textAlign: "center",
    fontSize: 8,
    lineHeight: BAR_VALUE_LABEL_LINE_HEIGHT,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    paddingHorizontal: 1,
  },
  barContainer: {
    width: "70%",
    maxWidth: 30,
    minWidth: 10,
    justifyContent: "flex-end",
    alignItems: "stretch",
    overflow: "hidden",
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
  },
  barSegment: {
    width: "100%",
  },
  barSegmentTopRadius: {
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
  },
  xAxisRow: {
    marginTop: 5,
    height: X_AXIS_HEIGHT - 5,
    flexDirection: "row",
    gap: 6,
  },
  axisSpacer: {
    width: 50,
  },
  stageTicksRow: {
    flex: 1,
    flexDirection: "row",
    paddingHorizontal: 1,
  },
  stageLegend: {
    alignItems: "center",
    gap: 2,
    minHeight: X_AXIS_HEIGHT - 8,
    justifyContent: "center",
  },
  stageRoman: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.35,
  },
  stageRomanRange: {
    fontSize: 8.5,
    letterSpacing: 0.08,
  },
  detailsScroll: {
    flex: 1,
  },
  detailsScrollContent: {
    gap: 4,
    paddingRight: 1,
    paddingBottom: 1,
  },
  detailsList: {
    gap: 4,
    paddingRight: 1,
    paddingBottom: 1,
  },
  stageRow: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 44,
    paddingHorizontal: 7,
    paddingVertical: 3,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  stageLabelArea: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  stageLabel: {
    fontSize: 13,
    fontWeight: "500",
    flexShrink: 1,
  },
  pillsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  pill: {
    minWidth: 36,
    height: 24,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  pillText: {
    fontSize: 10,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
});
