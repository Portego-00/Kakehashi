import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, useWindowDimensions } from "react-native";
import { useSharedValue, withTiming } from "react-native-reanimated";
import { VocabularyTooltip } from "../../components/VocabularyTooltip";
import { getAllSubjects } from "../../utils/cache";
import { fontStyles } from "../../utils/fonts";
import {
  findVocabularyMatchesWithJpdbFirstPass,
  getHighlightSegments,
  isWaniKaniBackedMatch,
  type AnyMatch,
} from "../../utils/textHighlighting";
import { useTheme } from "../../utils/theme";

let subjectsPromise: Promise<any[]> | null = null;

function loadSubjectsOnce() {
  subjectsPromise ??= getAllSubjects();
  return subjectsPromise;
}

type TooltipPosition = { x: number; y: number; width?: number };

export function InspectableJapaneseText({
  text,
  style,
}: {
  text: string;
  style?: object;
}) {
  const { theme } = useTheme();
  const { width, height } = useWindowDimensions();
  const [matches, setMatches] = useState<AnyMatch[]>([]);
  const [selectedItem, setSelectedItem] = useState<AnyMatch | null>(null);
  const [selectedSurfaceText, setSelectedSurfaceText] = useState<string | null>(
    null,
  );
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const opacity = useSharedValue(0);

  useEffect(() => {
    let cancelled = false;
    setMatches([]);
    setSelectedItem(null);
    setPosition(null);

    void loadSubjectsOnce()
      .then((subjects) =>
        findVocabularyMatchesWithJpdbFirstPass(text, subjects),
      )
      .then(({ vocabularyMatches, kanjiMatches }) => {
        if (!cancelled) setMatches([...vocabularyMatches, ...kanjiMatches]);
      })
      .catch(() => {
        if (!cancelled) setMatches([]);
      });

    return () => {
      cancelled = true;
    };
  }, [text]);

  const segments = useMemo(
    () => getHighlightSegments(text, matches),
    [matches, text],
  );

  const closeTooltip = useCallback(() => {
    opacity.value = 0;
    setSelectedItem(null);
    setSelectedSurfaceText(null);
    setPosition(null);
  }, [opacity]);

  const openTooltip = useCallback(
    (match: AnyMatch, surfaceText: string, event: any) => {
      const pageX = Number(event?.nativeEvent?.pageX);
      const pageY = Number(event?.nativeEvent?.pageY);
      if (!Number.isFinite(pageX) || !Number.isFinite(pageY)) return;

      const tooltipWidth = Math.min(280, width - 32);
      const estimatedHeight = 205;
      const left = Math.max(
        16,
        Math.min(pageX - tooltipWidth / 2, width - tooltipWidth - 16),
      );
      const spaceBelow = height - pageY;
      const top =
        spaceBelow >= estimatedHeight + 24
          ? pageY + 16
          : Math.max(16, pageY - estimatedHeight - 16);

      setSelectedItem(match);
      setSelectedSurfaceText(surfaceText);
      setPosition({ x: left, y: top, width: 24 });
      opacity.value = withTiming(1, { duration: 150 });
    },
    [height, opacity, width],
  );

  const viewDetails = useCallback(() => {
    if (!selectedItem || !isWaniKaniBackedMatch(selectedItem)) return;
    const id = selectedItem.id;
    closeTooltip();
    router.push({
      pathname: "/subject/[id]",
      params: { id: String(id), initialTab: "context" },
    });
  }, [closeTooltip, selectedItem]);

  return (
    <>
      <Text
        selectable
        style={[
          styles.text,
          fontStyles.japaneseText,
          { color: theme.textColor },
          style,
        ]}
      >
        {segments.map((segment, index) =>
          segment.match ? (
            <Text
              accessibilityRole="button"
              accessibilityHint="Shows WaniKani or JPDB information"
              key={`${segment.match.id}-${index}-${segment.text}`}
              onPress={(event) =>
                openTooltip(segment.match!, segment.text, event)
              }
              style={styles.inspectableToken}
            >
              {segment.text}
            </Text>
          ) : (
            <Text key={`plain-${index}`}>{segment.text}</Text>
          ),
        )}
      </Text>
      <VocabularyTooltip
        selectedItem={selectedItem}
        selectedSurfaceText={selectedSurfaceText}
        position={position}
        opacity={opacity}
        onClose={closeTooltip}
        onViewDetails={viewDetails}
        onViewSubject={(subjectId) => {
          closeTooltip();
          router.push({
            pathname: "/subject/[id]",
            params: { id: String(subjectId), initialTab: "context" },
          });
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 22,
    lineHeight: 36,
  },
  inspectableToken: {
    textDecorationLine: "none",
  },
});
