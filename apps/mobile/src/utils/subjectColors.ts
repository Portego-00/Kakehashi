import { useMemo } from "react";
import { useSettingsStore } from "./store";

export type SubjectColorType = "radical" | "kanji" | "vocabulary";
export type SubjectType = SubjectColorType | "kana_vocabulary";

export type SubjectColors = {
  radical: string;
  kanji: string;
  vocabulary: string;
};

export const DEFAULT_SUBJECT_COLORS: SubjectColors = {
  radical: "#3c9bff",
  kanji: "#fa1f62",
  vocabulary: "#9c38d9",
};

const LEGACY_COLOR_BY_TYPE: Record<SubjectColorType, Set<string>> = {
  radical: new Set(["#3c9bff", "#00aaff", "#00a1f1", "#0093dd", "#294dd1"]),
  kanji: new Set(["#fa1f62", "#dd0093"]),
  vocabulary: new Set(["#9c38d9", "#aa00ff", "#8800d7", "#882d9e", "#a855f7"]),
};

export function normalizeHexColor(color: string): string {
  const trimmed = color.trim();
  if (!trimmed) {
    return trimmed;
  }

  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  const normalized = withHash.toLowerCase();

  if (/^#[0-9a-f]{3}$/i.test(normalized)) {
    const [, r, g, b] = normalized;
    return `#${r}${r}${g}${g}${b}${b}`;
  }

  return normalized;
}

export function withAlpha(color: string, alpha: number): string {
  const normalized = normalizeHexColor(color);
  const clampedAlpha = Math.max(0, Math.min(1, alpha));
  const hexMatch = /^#([0-9a-f]{6})$/i.exec(normalized);

  if (hexMatch) {
    const hex = hexMatch[1];
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${clampedAlpha})`;
  }

  const rgbMatch = /^rgba?\(([^)]+)\)$/i.exec(normalized);
  if (rgbMatch) {
    const [r, g, b] = rgbMatch[1]
      .split(",")
      .slice(0, 3)
      .map((part) => Number.parseInt(part.trim(), 10));

    if ([r, g, b].every((value) => Number.isFinite(value))) {
      return `rgba(${r}, ${g}, ${b}, ${clampedAlpha})`;
    }
  }

  return color;
}

function parseColorToRgb(
  color: string
): { r: number; g: number; b: number } | null {
  const normalized = normalizeHexColor(color);

  const hexMatch = /^#([0-9a-f]{6})$/i.exec(normalized);
  if (hexMatch) {
    const hex = hexMatch[1];
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
    };
  }

  const rgbMatch = /^rgba?\(([^)]+)\)$/i.exec(normalized);
  if (rgbMatch) {
    const [r, g, b] = rgbMatch[1]
      .split(",")
      .slice(0, 3)
      .map((part) => Number.parseInt(part.trim(), 10));

    if ([r, g, b].every((value) => Number.isFinite(value))) {
      return { r, g, b };
    }
  }

  return null;
}

export function getReadableTextColor(
  backgroundColor: string,
  darkText: string = "#111111",
  lightText: string = "#ffffff"
): string {
  const rgb = parseColorToRgb(backgroundColor);
  if (!rgb) {
    return lightText;
  }

  const toLinear = (channel: number) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };

  const luminance =
    0.2126 * toLinear(rgb.r) +
    0.7152 * toLinear(rgb.g) +
    0.0722 * toLinear(rgb.b);

  return luminance > 0.5 ? darkText : lightText;
}

function getContrastRatio(backgroundColor: string, textColor: string): number | null {
  const backgroundRgb = parseColorToRgb(backgroundColor);
  const textRgb = parseColorToRgb(textColor);

  if (!backgroundRgb || !textRgb) {
    return null;
  }

  const toLinear = (channel: number) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };

  const backgroundLuminance =
    0.2126 * toLinear(backgroundRgb.r) +
    0.7152 * toLinear(backgroundRgb.g) +
    0.0722 * toLinear(backgroundRgb.b);
  const textLuminance =
    0.2126 * toLinear(textRgb.r) +
    0.7152 * toLinear(textRgb.g) +
    0.0722 * toLinear(textRgb.b);

  const brighter = Math.max(backgroundLuminance, textLuminance);
  const darker = Math.min(backgroundLuminance, textLuminance);
  return (brighter + 0.05) / (darker + 0.05);
}

export function getBestContrastTextColor(
  backgroundColor: string,
  darkText: string = "#111111",
  lightText: string = "#ffffff"
): string {
  const darkContrast = getContrastRatio(backgroundColor, darkText);
  const lightContrast = getContrastRatio(backgroundColor, lightText);

  if (darkContrast === null || lightContrast === null) {
    return getReadableTextColor(backgroundColor, darkText, lightText);
  }

  return darkContrast >= lightContrast ? darkText : lightText;
}

export function getSubjectColorsFromState(): SubjectColors {
  const state = useSettingsStore.getState();

  return {
    radical: normalizeHexColor(state.radicalColor || DEFAULT_SUBJECT_COLORS.radical),
    kanji: normalizeHexColor(state.kanjiColor || DEFAULT_SUBJECT_COLORS.kanji),
    vocabulary: normalizeHexColor(
      state.vocabularyColor || DEFAULT_SUBJECT_COLORS.vocabulary
    ),
  };
}

export function getSubjectTypeColor(type: SubjectType, colors?: SubjectColors): string {
  const resolvedColors = colors || getSubjectColorsFromState();

  if (type === "radical") {
    return resolvedColors.radical;
  }

  if (type === "kanji") {
    return resolvedColors.kanji;
  }

  return resolvedColors.vocabulary;
}

export function resolveLegacySubjectColor(color: string, colors?: SubjectColors): string {
  const normalized = normalizeHexColor(color);
  const resolvedColors = colors || getSubjectColorsFromState();

  if (LEGACY_COLOR_BY_TYPE.radical.has(normalized)) {
    return resolvedColors.radical;
  }

  if (LEGACY_COLOR_BY_TYPE.kanji.has(normalized)) {
    return resolvedColors.kanji;
  }

  if (LEGACY_COLOR_BY_TYPE.vocabulary.has(normalized)) {
    return resolvedColors.vocabulary;
  }

  return color;
}

export function useSubjectColors(): SubjectColors & {
  getColorForType: (type: SubjectType) => string;
  resolveLegacyColor: (color: string) => string;
} {
  const radicalColor = useSettingsStore((state) => state.radicalColor);
  const kanjiColor = useSettingsStore((state) => state.kanjiColor);
  const vocabularyColor = useSettingsStore((state) => state.vocabularyColor);

  return useMemo(() => {
    const colors: SubjectColors = {
      radical: normalizeHexColor(radicalColor || DEFAULT_SUBJECT_COLORS.radical),
      kanji: normalizeHexColor(kanjiColor || DEFAULT_SUBJECT_COLORS.kanji),
      vocabulary: normalizeHexColor(
        vocabularyColor || DEFAULT_SUBJECT_COLORS.vocabulary
      ),
    };

    return {
      ...colors,
      getColorForType: (type: SubjectType) => getSubjectTypeColor(type, colors),
      resolveLegacyColor: (color: string) => resolveLegacySubjectColor(color, colors),
    };
  }, [kanjiColor, radicalColor, vocabularyColor]);
}
