import React, { useMemo } from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import Svg, { Circle, Polyline } from "react-native-svg";
import { fontStyles } from "../utils/fonts";
import {
  getPitchAccentTypeLabel,
  splitReadingIntoMoras,
} from "../utils/pitchAccent";
import { useTheme } from "../utils/theme";

type PitchLevel = "high" | "low";

type PitchAccentVisualizationProps = {
  reading: string;
  accents: number[];
  containerStyle?: StyleProp<ViewStyle>;
  compact?: boolean;
  showHeader?: boolean;
};

function getPitchLevels(moraCount: number, accent: number): PitchLevel[] {
  if (moraCount === 0) {
    return [];
  }

  const clampedAccent = Math.max(0, Math.min(accent, moraCount));

  if (moraCount === 1) {
    return [clampedAccent === 1 ? "high" : "low"];
  }

  if (clampedAccent === 1) {
    return Array.from({ length: moraCount }, (_, index) =>
      index === 0 ? "high" : "low"
    );
  }

  return Array.from({ length: moraCount }, (_, index) => {
    const moraPosition = index + 1;

    if (moraPosition === 1) {
      return "low";
    }

    if (clampedAccent === 0 || moraPosition <= clampedAccent) {
      return "high";
    }

    return "low";
  });
}

function getFollowingPitchLevel(moraCount: number, accent: number): PitchLevel {
  if (moraCount <= 0) {
    return "low";
  }

  const clampedAccent = Math.max(0, Math.min(accent, moraCount));
  return clampedAccent === 0 ? "high" : "low";
}

export default function PitchAccentVisualization({
  reading,
  accents,
  containerStyle,
  compact = false,
  showHeader = true,
}: PitchAccentVisualizationProps) {
  const { theme } = useTheme();

  const moras = useMemo(() => splitReadingIntoMoras(reading), [reading]);

  const normalizedAccents = useMemo(
    () =>
      Array.from(
        new Set(
          accents
            .map((accent) => Number(accent))
            .filter((accent) => Number.isInteger(accent) && accent >= 0)
        )
      ).sort((a, b) => a - b),
    [accents]
  );

  if (!reading || moras.length === 0 || normalizedAccents.length === 0) {
    return null;
  }

  const horizontalPadding = compact ? 8 : 10;
  const compactMaxChartWidth = 220;
  const basePointSpacing = compact ? 20 : 28;
  const pointSpacing = compact
    ? Math.max(
        12,
        Math.min(
          basePointSpacing,
          (compactMaxChartWidth - horizontalPadding * 2) / (moras.length + 1),
        ),
      )
    : basePointSpacing;
  const chartHeight = compact ? 34 : 42;
  const highY = compact ? 7 : 8;
  const lowY = compact ? 24 : 30;
  const chartWidth = horizontalPadding * 2 + (moras.length + 1) * pointSpacing;
  const compactContainerWidth = Math.max(
    chartWidth + horizontalPadding * 2,
    showHeader ? 132 : 0,
  );
  const primaryAccent = normalizedAccents[0];
  const accentSummary = normalizedAccents.join(", ");
  const primaryAccentType = getPitchAccentTypeLabel(
    primaryAccent,
    moras.length,
  );

  return (
    <View
      style={[
        styles.container,
        compact && styles.containerCompact,
        compact && {
          width: compactContainerWidth,
        },
        {
          borderColor: theme.border,
          backgroundColor: theme.isDark ? "#222" : "#f7f7fb",
        },
        containerStyle,
      ]}
    >
      {showHeader && (
        <View style={[styles.headerRow, compact && styles.headerRowCompact]}>
          <Text
            style={[
              styles.accentTypeLabel,
              compact && styles.accentTypeLabelCompact,
              { color: theme.textSecondary },
            ]}
          >
            {primaryAccentType}
          </Text>
          <View
            style={[
              styles.numberBadge,
              {
                backgroundColor: theme.isDark
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(0,0,0,0.06)",
              },
              compact && styles.numberBadgeCompact,
            ]}
          >
            <Text
              style={[
                styles.numberBadgeText,
                compact && styles.numberBadgeTextCompact,
                { color: theme.textColor },
              ]}
            >
              {accentSummary}
            </Text>
          </View>
        </View>
      )}

      {normalizedAccents.map((accent) => {
        const pitchLevels = getPitchLevels(moras.length, accent);
        const followingLevel = getFollowingPitchLevel(moras.length, accent);
        const trailingPointX =
          horizontalPadding + pointSpacing / 2 + moras.length * pointSpacing;
        const trailingPointY = followingLevel === "high" ? highY : lowY;

        const points = [...pitchLevels, followingLevel]
          .map((level, index) => {
            const x = horizontalPadding + pointSpacing / 2 + index * pointSpacing;
            const y = level === "high" ? highY : lowY;
            return `${x},${y}`;
          })
          .join(" ");

        return (
          <View key={`accent-${accent}`} style={styles.patternRow}>
            <View style={styles.patternContent}>
              <Svg width={chartWidth} height={chartHeight}>
                <Polyline
                  points={points}
                  fill="none"
                  stroke={theme.primary}
                  strokeWidth={compact ? 2 : 2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {pitchLevels.map((level, index) => (
                  <Circle
                    key={`point-${accent}-${index}`}
                    cx={horizontalPadding + pointSpacing / 2 + index * pointSpacing}
                    cy={level === "high" ? highY : lowY}
                    r={compact ? 2.6 : 3.2}
                    fill={theme.primary}
                  />
                ))}
                <Circle
                  cx={trailingPointX}
                  cy={trailingPointY}
                  r={compact ? 3.3 : 4.2}
                  fill={theme.isDark ? "#222" : "#f7f7fb"}
                  stroke={theme.primary}
                  strokeWidth={compact ? 1.8 : 2}
                />
              </Svg>

              <View style={[styles.moraRow, { paddingHorizontal: horizontalPadding }]}>
                {moras.map((mora, index) => (
                  <Text
                    key={`mora-${accent}-${index}`}
                    style={[
                      styles.moraText,
                      compact && styles.moraTextCompact,
                      { color: theme.textSecondary, width: pointSpacing },
                      fontStyles.japaneseText,
                    ]}
                  >
                    {mora}
                  </Text>
                ))}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  containerCompact: {
    alignSelf: "center",
    borderRadius: 10,
    flexGrow: 0,
    flexShrink: 0,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  headerRowCompact: {
    marginBottom: 2,
  },
  accentTypeLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  accentTypeLabelCompact: {
    fontSize: 12,
  },
  numberBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  numberBadgeCompact: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 9,
    marginLeft: 6,
  },
  numberBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  numberBadgeTextCompact: {
    fontSize: 10,
  },
  patternRow: {
    alignItems: "center",
    marginBottom: 3,
  },
  patternContent: {
    alignItems: "center",
  },
  moraRow: {
    flexDirection: "row",
    marginTop: -2,
  },
  moraText: {
    textAlign: "center",
    fontSize: 13,
  },
  moraTextCompact: {
    fontSize: 11,
  },
});
