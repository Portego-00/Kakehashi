import * as Font from "expo-font";
import React, { useEffect, useState } from "react";
import { Dimensions, Platform, StyleSheet, Text } from "react-native";
import { SvgXml } from "react-native-svg";
import { Subject as WKSubject } from "../types/wanikani";
import { fontStyles } from "../utils/fonts";
import {
  DEFAULT_JITAI_FONT_FAMILY,
  JITAI_BUNDLED_FONTS,
  getJitaiFontFamiliesForSelection,
  getCachedDownloadedJitaiFonts,
  loadDownloadedJitaiFonts,
  type DownloadedJitaiFont,
} from "../utils/jitaiFonts";
import { pickBestImage, useRemoteSvg } from "../utils/radicalSvg";
import { useSettingsStore } from "../utils/store";

const { width } = Dimensions.get("window");
const bundledFontIds = new Set(JITAI_BUNDLED_FONTS.map((font) => font.id));

// Stable, memoized character renderer to avoid unmount/remount on parent re-renders
const ReviewPromptCharacters = React.memo(
  function ReviewPromptCharacters({
    subject,
    size = Math.min(width * 0.25, 120),
    fontCycleIndex = 0,
  }: {
    subject: WKSubject;
    size?: number;
    fontCycleIndex?: number;
  }) {
    const { jitaiEnabled, jitaiSelectedFontIds, jitaiCycleAllFonts } = useSettingsStore();
    const downloadedSelectionKey =
      jitaiEnabled && jitaiSelectedFontIds.some((id) => !bundledFontIds.has(id))
        ? JSON.stringify(jitaiSelectedFontIds)
        : null;
    const [downloadedFonts, setDownloadedFonts] = useState<{
      selectionKey: string;
      fonts: DownloadedJitaiFont[];
    } | null>(() => {
      const cachedFonts = getCachedDownloadedJitaiFonts();
      return downloadedSelectionKey === null || cachedFonts === null
        ? null
        : {
            selectionKey: downloadedSelectionKey,
            fonts: cachedFonts.filter((font) => Font.isLoaded(font.family)),
          };
    });
    const waitingForDownloadedFonts =
      downloadedSelectionKey !== null &&
      downloadedFonts?.selectionKey !== downloadedSelectionKey;
    const [loadingFontPosition, setLoadingFontPosition] = useState<{
      subjectId: number;
      selectionKey: string | null;
      index: number;
    } | null>(null);
    const isRadical = subject.object === "radical";

    const bestImg =
      isRadical && subject.data.character_images?.length
        ? pickBestImage(subject.data.character_images)
        : null;
    const svgUrl = bestImg?.type === "svg" ? bestImg.url : null;
    const svgXml = useRemoteSvg(svgUrl, "#ffffff");

    useEffect(() => {
      if (downloadedSelectionKey === null || !waitingForDownloadedFonts) return;
      let cancelled = false;

      loadDownloadedJitaiFonts()
        .then((fonts) => {
          if (!cancelled) {
            // The manifest retains failed fonts for retry; only render families
            // whose native registration succeeded for this session.
            setDownloadedFonts({
              selectionKey: downloadedSelectionKey,
              fonts: fonts.filter((font) => Font.isLoaded(font.family)),
            });
          }
        })
        .catch((error) => {
          console.error("Failed to load downloaded Jitai fonts:", error);
          if (!cancelled) {
            setDownloadedFonts({
              selectionKey: downloadedSelectionKey,
              fonts: [],
            });
          }
        });

      return () => {
        cancelled = true;
      };
    }, [downloadedSelectionKey, waitingForDownloadedFonts]);

    useEffect(() => {
      if (!jitaiCycleAllFonts || fontCycleIndex === 0) {
        setLoadingFontPosition(null);
      } else if (waitingForDownloadedFonts) {
        setLoadingFontPosition({
          subjectId: subject.id,
          selectionKey: downloadedSelectionKey,
          index: fontCycleIndex,
        });
      }
    }, [
      jitaiCycleAllFonts,
      fontCycleIndex,
      waitingForDownloadedFonts,
      subject.id,
      downloadedSelectionKey,
    ]);

    const availableFontsKey = waitingForDownloadedFonts
      ? null
      : JSON.stringify(
          jitaiEnabled
            ? getJitaiFontFamiliesForSelection(
                jitaiSelectedFontIds,
                downloadedFonts?.fonts ?? [],
              )
            : [DEFAULT_JITAI_FONT_FAMILY],
        );

    // Choose once per subject and actual candidate set. Async manifest updates
    // must not replace a font that the user is already reading.
    const fontCycle = React.useMemo(() => {
      if (availableFontsKey === null) return null;
      const availableFonts: string[] = JSON.parse(availableFontsKey);
      const randomIndex = Math.floor(Math.random() * availableFonts.length);
      const subjectOffset = subject.id % availableFonts.length;
      const initialFont =
        availableFonts[(randomIndex + subjectOffset) % availableFonts.length] ??
        DEFAULT_JITAI_FONT_FAMILY;

      // Keep the readable default one tap away unless it is already first,
      // then visit every selected family once before returning to the start.
      return [
        ...new Set([initialFont, DEFAULT_JITAI_FONT_FAMILY, ...availableFonts]),
      ];
    }, [subject.id, availableFontsKey]);

    // A tap during loading displays the default immediately. Anchor that tap
    // to the default's resolved position so loading cannot change visible text.
    const resolvedCycleIndex =
      fontCycle &&
      loadingFontPosition?.subjectId === subject.id &&
      loadingFontPosition.selectionKey === downloadedSelectionKey &&
      fontCycleIndex >= loadingFontPosition.index
        ? fontCycleIndex - loadingFontPosition.index +
          fontCycle.indexOf(DEFAULT_JITAI_FONT_FAMILY)
        : fontCycleIndex;
    const cycledFont = fontCycle
      ? fontCycle[resolvedCycleIndex % fontCycle.length]
      : fontCycleIndex > 0
        ? DEFAULT_JITAI_FONT_FAMILY
        : null;
    const fontToUse = jitaiCycleAllFonts
      ? cycledFont
      : fontCycleIndex % 2 === 1
        ? DEFAULT_JITAI_FONT_FAMILY
        : fontCycle?.[0] ?? null;

    if (subject.data.characters) {
      // Only show a fallback while fonts load if the user explicitly cycles.
      if (fontToUse === null) return null;
      return (
        <Text
          key={`${subject.id}-${subject.data.characters}-${fontToUse}-${size}`}
          // Android selectable TextView clips auto-fitted Japanese prompts (#54).
          selectable={Platform.OS !== "android"}
          style={[
            styles.characterText,
            fontStyles.japaneseText,
            { fontFamily: fontToUse, fontSize: size },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
        >
          {subject.data.characters}
        </Text>
      );
    }

    if (svgXml) {
      return <SvgXml xml={svgXml} width={size} height={size} />;
    }

    if (svgUrl) {
      return null; // loading svg
    }

    return (
      <Text
        style={styles.placeholderText}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {subject.data.meanings[0]?.meaning || ""}
      </Text>
    );
  },
  (prev, next) =>
    prev.subject.id === next.subject.id &&
    prev.size === next.size &&
    prev.fontCycleIndex === next.fontCycleIndex,
);

export default ReviewPromptCharacters;

const styles = StyleSheet.create({
  characterText: {
    fontSize: Math.min(width * 0.25, 120),
    color: "white",
    fontWeight: "400",
    textAlign: "center",
    fontFamily: "SourceHanSansJP-Regular",
    // Android-specific: remove extra font padding and center vertically
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  placeholderText: {
    fontSize: Math.min(width * 0.09, 36),
    color: "white",
    fontWeight: "500",
    textAlign: "center",
  },
});
