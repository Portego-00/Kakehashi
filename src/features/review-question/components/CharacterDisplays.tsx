import React, { useEffect, useState } from "react";
import { Text } from "react-native";
import { SvgXml } from "react-native-svg";

import type { Subject as WKSubject } from "../../../types/wanikani";
import { fontStyles } from "../../../utils/fonts";
import {
  DEFAULT_JITAI_FONT_FAMILY,
  getJitaiFontFamiliesForSelection,
  loadDownloadedJitaiFonts,
  type DownloadedJitaiFont,
} from "../../../utils/jitaiFonts";
import { pickBestImage, useRemoteSvg } from "../../../utils/radicalSvg";
import { useSettingsStore } from "../../../utils/store";
import { ANSWERED_ITEM_RADICAL_SIZE, width } from "../constants";
import { styles } from "../styles";

export const RadicalCharacterDisplay = React.memo(
  function RadicalCharacterDisplay({
    subject,
    size = Math.min(width * 0.25, 120),
    forceDefaultFont = false,
  }: {
    subject: WKSubject;
    size?: number;
    forceDefaultFont?: boolean;
  }) {
    const { jitaiEnabled, jitaiSelectedFontIds } = useSettingsStore();
    const [downloadedJitaiFonts, setDownloadedJitaiFonts] = useState<
      DownloadedJitaiFont[]
    >([]);
    const isRadical = subject.object === "radical";

    const bestImg =
      isRadical && subject.data.character_images?.length
        ? pickBestImage(subject.data.character_images)
        : null;
    const svgUrl = bestImg?.type === "svg" ? bestImg.url : null;
    const svgXml = useRemoteSvg(svgUrl, "#ffffff");

    useEffect(() => {
      let cancelled = false;

      loadDownloadedJitaiFonts()
        .then((fonts) => {
          if (!cancelled) {
            setDownloadedJitaiFonts(fonts);
          }
        })
        .catch((error) => {
          console.error("Failed to load downloaded Jitai fonts:", error);
        });

      return () => {
        cancelled = true;
      };
    }, []);

    // Randomize font if enabled (Jitai)
    const selectedRandomFont = React.useMemo(() => {
      if (!jitaiEnabled) {
        return DEFAULT_JITAI_FONT_FAMILY;
      }

      const availableFonts = getJitaiFontFamiliesForSelection(
        jitaiSelectedFontIds,
        downloadedJitaiFonts,
      );
      const randomIndex = Math.floor(Math.random() * availableFonts.length);
      const subjectOffset = subject.id % availableFonts.length;
      return (
        availableFonts[(randomIndex + subjectOffset) % availableFonts.length] ??
        DEFAULT_JITAI_FONT_FAMILY
      );
    }, [subject.id, jitaiEnabled, jitaiSelectedFontIds, downloadedJitaiFonts]);

    const fontToUse = forceDefaultFont
      ? DEFAULT_JITAI_FONT_FAMILY
      : selectedRandomFont;

    if (subject.data.characters) {
      return (
        <Text
          selectable
          style={[
            styles.characterText,
            fontStyles.japaneseText,
            { fontFamily: fontToUse, fontSize: size },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
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
    prev.forceDefaultFont === next.forceDefaultFont,
);

export const AnsweredItemCharacterDisplay = React.memo(
  function AnsweredItemCharacterDisplay({
    subject,
    fallbackText,
  }: {
    subject: WKSubject;
    fallbackText: string;
  }) {
    const isRadical = subject.object === "radical";
    const bestImg =
      isRadical && subject.data.character_images?.length
        ? pickBestImage(subject.data.character_images)
        : null;
    const svgUrl = bestImg?.type === "svg" ? bestImg.url : null;
    const svgXml = useRemoteSvg(svgUrl, "#ffffff");

    if (subject.data.characters) {
      return (
        <Text
          style={styles.answeredItemCharacter}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {subject.data.characters}
        </Text>
      );
    }

    if (svgXml) {
      return (
        <SvgXml
          xml={svgXml}
          width={ANSWERED_ITEM_RADICAL_SIZE}
          height={ANSWERED_ITEM_RADICAL_SIZE}
        />
      );
    }

    if (svgUrl) {
      return null;
    }

    return (
      <Text
        style={styles.answeredItemCharacterFallback}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {fallbackText}
      </Text>
    );
  },
);
