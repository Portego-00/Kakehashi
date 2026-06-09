import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { Easing, FadeInDown, Layout } from "react-native-reanimated";
import { getBestContrastTextColor } from "../../utils/subjectColors";
import BunproTogglePill from "./BunproTogglePill";

type ForecastPoint = {
  key: string;
  label: string;
  grammar: number;
  vocab: number;
  total: number;
};

type BunproForecastCardProps = {
  panelBackground: string;
  panelBorder: string;
  themeTextColor: string;
  softText: string;
  accent: string;
  accentMuted: string;
  accentSoft: string;
  isDark: boolean;
  compactLayout: boolean;
  forecastMode: "hourly" | "daily";
  onSetForecastMode: (mode: "hourly" | "daily") => void;
  showForecastGrammar: boolean;
  showForecastVocab: boolean;
  onToggleForecastGrammar: () => void;
  onToggleForecastVocab: () => void;
  forecastPoints: ForecastPoint[];
};

export default function BunproForecastCard({
  panelBackground,
  panelBorder,
  themeTextColor,
  softText,
  accent,
  accentMuted,
  accentSoft,
  isDark,
  compactLayout,
  forecastMode,
  onSetForecastMode,
  showForecastGrammar,
  showForecastVocab,
  onToggleForecastGrammar,
  onToggleForecastVocab,
  forecastPoints,
}: BunproForecastCardProps) {
  const grammarActiveTextColor = getBestContrastTextColor(accentMuted, "#17171c", "#ffffff");
  const vocabActiveTextColor = getBestContrastTextColor(accentSoft, "#17171c", "#ffffff");

  const barLayoutTransition = useMemo(
    () => Layout.duration(320).easing(Easing.out(Easing.cubic)),
    []
  );

  const visiblePoints = useMemo(() => {
    return forecastPoints.map((entry) => {
      const grammar = showForecastGrammar ? entry.grammar : 0;
      const vocab = showForecastVocab ? entry.vocab : 0;
      return {
        ...entry,
        grammar,
        vocab,
        total: grammar + vocab,
      };
    });
  }, [forecastPoints, showForecastGrammar, showForecastVocab]);

  const maxValue = useMemo(() => {
    const totals = visiblePoints.map((point) => point.total);
    return totals.length > 0 ? Math.max(...totals, 1) : 1;
  }, [visiblePoints]);

  const getBarHeight = (value: number) => {
    if (value <= 0) {
      return 2;
    }
    return Math.max(2, Math.round((value / maxValue) * 120));
  };

  return (
    <View
      style={[
        styles.sectionCard,
        { backgroundColor: panelBackground, borderColor: panelBorder },
      ]}
    >
      <View style={styles.sectionHeaderRow}>
        <Text
          style={[
            styles.sectionTitle,
            compactLayout && styles.sectionTitleCompact,
            { color: themeTextColor },
          ]}
        >
          Forecast
        </Text>
        <BunproTogglePill
          leftLabel="Hourly"
          rightLabel="Daily"
          activeSide={forecastMode === "hourly" ? "left" : "right"}
          onLeftPress={() => onSetForecastMode("hourly")}
          onRightPress={() => onSetForecastMode("daily")}
          accent={accent}
          compactLayout={compactLayout}
        />
      </View>

      <View style={styles.seriesToggleRow}>
        <View style={styles.seriesToggleMeta}>
          <Ionicons name="settings-outline" size={14} color={softText} />
          <Text style={[styles.sectionMeta, { color: softText }]}>Series</Text>
        </View>
        <View style={styles.seriesToggleButtons}>
          <TouchableOpacity
            style={[
              styles.seriesToggleButton,
              {
                borderColor: accentMuted,
                backgroundColor: showForecastGrammar ? accentMuted : "transparent",
              },
            ]}
            onPress={onToggleForecastGrammar}
          >
            <Text
              style={[
                styles.seriesToggleText,
                { color: showForecastGrammar ? grammarActiveTextColor : accentMuted },
              ]}
            >
              Grammar
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.seriesToggleButton,
              {
                borderColor: accentSoft,
                backgroundColor: showForecastVocab ? accentSoft : "transparent",
              },
            ]}
            onPress={onToggleForecastVocab}
          >
            <Text
              style={[
                styles.seriesToggleText,
                { color: showForecastVocab ? vocabActiveTextColor : accentSoft },
              ]}
            >
              Vocab
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={[styles.sectionMeta, { color: softText }]}>
        Cumulative reviews due by time bucket
      </Text>

      {showForecastGrammar || showForecastVocab ? (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.forecastScrollView}
            contentContainerStyle={styles.forecastScrollContent}
          >
            {visiblePoints.length > 0 ? (
              visiblePoints.map((entry, index) => {
                const barHeight = getBarHeight(entry.total);
                const grammarHeight =
                  showForecastGrammar && entry.total > 0
                    ? Math.round((entry.grammar / entry.total) * barHeight)
                    : 0;
                const vocabHeight =
                  showForecastVocab && entry.total > 0 ? barHeight - grammarHeight : 0;

                return (
                  <Animated.View
                    key={entry.key}
                    style={styles.forecastBarCell}
                    layout={barLayoutTransition}
                    entering={FadeInDown.delay(index * 20).duration(220)}
                  >
                    <Text style={[styles.forecastBarTopValue, { color: softText }]}>
                      {entry.total}
                    </Text>
                    <Animated.View
                      style={[styles.forecastBar, { height: barHeight }]}
                      layout={barLayoutTransition}
                    >
                      {showForecastGrammar ? (
                        <Animated.View
                          style={[
                            styles.forecastBarGrammar,
                            {
                              height: Math.max(0, grammarHeight),
                              backgroundColor: accentMuted,
                            },
                          ]}
                          layout={barLayoutTransition}
                        />
                      ) : null}
                      {showForecastVocab ? (
                        <Animated.View
                          style={[
                            styles.forecastBarVocab,
                            {
                              height: Math.max(0, vocabHeight),
                              backgroundColor: accentSoft,
                            },
                          ]}
                          layout={barLayoutTransition}
                        />
                      ) : null}
                    </Animated.View>
                    <Text style={[styles.forecastBarLabel, { color: softText }]}>
                      {entry.label}
                    </Text>
                  </Animated.View>
                );
              })
            ) : (
              <Text style={[styles.emptyLabel, { color: softText }]}>
                No forecast data available.
              </Text>
            )}
          </ScrollView>

          <View style={styles.legendRow}>
            {showForecastGrammar ? (
              <View style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: accentMuted }]} />
                <Text style={[styles.legendLabel, { color: softText }]}>Grammar</Text>
              </View>
            ) : null}
            {showForecastVocab ? (
              <View style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: accentSoft }]} />
                <Text style={[styles.legendLabel, { color: softText }]}>Vocab</Text>
              </View>
            ) : null}
          </View>
        </>
      ) : (
        <Text style={[styles.emptyLabel, { color: softText }]}>
          Enable at least one series to view forecast.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    flexShrink: 1,
  },
  sectionTitleCompact: {
    fontSize: 16,
  },
  sectionMeta: {
    fontSize: 10,
    fontWeight: "500",
  },
  seriesToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  seriesToggleMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  seriesToggleButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  seriesToggleButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  seriesToggleText: {
    fontSize: 11,
    fontWeight: "600",
  },
  forecastScrollView: {
    marginTop: 2,
  },
  forecastScrollContent: {
    alignItems: "flex-end",
    paddingHorizontal: 4,
    gap: 8,
    minHeight: 160,
  },
  forecastBarCell: {
    width: 48,
    alignItems: "center",
    gap: 6,
  },
  forecastBarTopValue: {
    fontSize: 10,
    fontWeight: "500",
    minHeight: 14,
  },
  forecastBar: {
    width: 34,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  forecastBarGrammar: {
    width: "100%",
  },
  forecastBarVocab: {
    width: "100%",
  },
  forecastBarLabel: {
    fontSize: 9,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 11,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    marginTop: 4,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  legendSwatch: {
    width: 24,
    height: 7,
    borderRadius: 999,
  },
  legendLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  emptyLabel: {
    fontSize: 13,
    marginTop: 4,
  },
});
