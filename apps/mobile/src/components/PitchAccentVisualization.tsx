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
import { useTheme } from "../utils/theme";

type PitchLevel = "high" | "low";

type PitchAccentVisualizationProps = {
  reading: string;
  accents: number[];
  containerStyle?: StyleProp<ViewStyle>;
};

const COMBINING_SMALL_KANA = new Set([
  "ゃ",
  "ゅ",
  "ょ",
  "ぁ",
  "ぃ",
  "ぅ",
  "ぇ",
  "ぉ",
  "ゎ",
  "ゕ",
  "ゖ",
  "ャ",
  "ュ",
  "ョ",
  "ァ",
  "ィ",
  "ゥ",
  "ェ",
  "ォ",
  "ヮ",
  "ヵ",
  "ヶ",
]);

function splitReadingIntoMoras(reading: string): string[] {
  const moras: string[] = [];

  for (const character of Array.from(reading.trim())) {
    if (COMBINING_SMALL_KANA.has(character) && moras.length > 0) {
      moras[moras.length - 1] += character;
      continue;
    }

    moras.push(character);
  }

  return moras;
}

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

function getAccentTypeLabel(accent: number, moraCount: number): string {
  const clampedAccent = Math.max(0, Math.min(accent, moraCount));

  if (clampedAccent === 0) {
    return "Heiban";
  }

  if (clampedAccent === 1) {
    return "Atamadaka";
  }

  if (clampedAccent >= moraCount) {
    return "Odaka";
  }

  return "Nakadaka";
}

export default function PitchAccentVisualization({
  reading,
  accents,
  containerStyle,
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

  const pointSpacing = 28;
  const horizontalPadding = 10;
  const chartHeight = 42;
  const highY = 8;
  const lowY = 30;
  const chartWidth = horizontalPadding * 2 + (moras.length + 1) * pointSpacing;
  const primaryAccent = normalizedAccents[0];
  const accentSummary = normalizedAccents.join(", ");
  const primaryAccentType = getAccentTypeLabel(primaryAccent, moras.length);

  return (
    <View
      style={[
        styles.container,
        {
          borderColor: theme.border,
          backgroundColor: theme.isDark ? "#222" : "#f7f7fb",
        },
        containerStyle,
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.accentTypeLabel, { color: theme.textSecondary }]}>
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
          ]}
        >
          <Text style={[styles.numberBadgeText, { color: theme.textColor }]}>
            {accentSummary}
          </Text>
        </View>
      </View>

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
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {pitchLevels.map((level, index) => (
                  <Circle
                    key={`point-${accent}-${index}`}
                    cx={horizontalPadding + pointSpacing / 2 + index * pointSpacing}
                    cy={level === "high" ? highY : lowY}
                    r={3.2}
                    fill={theme.primary}
                  />
                ))}
                <Circle
                  cx={trailingPointX}
                  cy={trailingPointY}
                  r={4.2}
                  fill={theme.isDark ? "#222" : "#f7f7fb"}
                  stroke={theme.primary}
                  strokeWidth={2}
                />
              </Svg>

              <View style={[styles.moraRow, { paddingHorizontal: horizontalPadding }]}>
                {moras.map((mora, index) => (
                  <Text
                    key={`mora-${accent}-${index}`}
                    style={[
                      styles.moraText,
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  accentTypeLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  numberBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  numberBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  patternRow: {
    marginBottom: 3,
  },
  patternContent: {
    flex: 1,
  },
  moraRow: {
    flexDirection: "row",
    marginTop: -2,
  },
  moraText: {
    textAlign: "center",
    fontSize: 13,
  },
});
