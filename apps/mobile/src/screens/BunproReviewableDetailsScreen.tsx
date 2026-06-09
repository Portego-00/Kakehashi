import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import PagerView from "react-native-pager-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AudioSessionManager from "../modules/AudioSessionManager";
import { BunproApiError, getBunproReviewableDetails } from "../utils/bunproApi";
import { Audio, type AudioSound } from "../utils/expoAvCompat";
import { stripFuriganaAndTags } from "../utils/japaneseHtmlNormalization";
import { isPortegoUsername } from "../utils/portegoAccess";
import { useAuthStore } from "../utils/store";
import { getBestContrastTextColor } from "../utils/subjectColors";
import { useTheme } from "../utils/theme";

type BunproDetailKind = "grammar" | "vocab";
type StructureMode = "casual" | "polite";

type HtmlSegment = {
  text: string;
  strong: boolean;
};

type HtmlTextRun = {
  text: string;
  strong: boolean;
  strike: boolean;
  accent: boolean;
};

type FuriganaRun =
  | {
      kind: "text";
      text: string;
      strong: boolean;
    }
  | {
      kind: "ruby";
      base: string;
      reading: string;
      strong: boolean;
    };

type BunproExampleItem = {
  id: string;
  japaneseHtml: string;
  translationHtml: string;
  level: string;
  order: number;
  femaleAudioUrl: string;
  maleAudioUrl: string;
};

type BunproWriteupBlock =
  | {
      kind: "html";
      html: string;
    }
  | {
      kind: "examples";
      ids: string[];
    };

type BunproDetailsPayload = Awaited<ReturnType<typeof getBunproReviewableDetails>>;
type BunproIncludedResource = NonNullable<BunproDetailsPayload["included"]>[number];

const TAB_TITLES = ["Meaning", "Examples", "Resources"] as const;

function decodeParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return decodeParam(value[0]);
  }

  if (typeof value !== "string") {
    return "";
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripRawTags(value: string): string {
  return value.replace(/<[^>]*>/g, "");
}

function hasKanji(value: string): boolean {
  return /[\u3400-\u4DBF\u4E00-\u9FFF々〆ヵヶ]/.test(value);
}

function normalizeExampleFurigana(html: string): string {
  let normalized = decodeHtmlEntities(html).replace(/<br\s*\/?\s*>/gi, "\n");

  normalized = normalized.replace(
    /<ruby[^>]*>([\s\S]*?)<\/ruby>/gi,
    (_match, inner: string) => {
      const readingMatch = inner.match(/<rt[^>]*>([\s\S]*?)<\/rt>/i);
      const reading = readingMatch
        ? decodeHtmlEntities(stripRawTags(readingMatch[1]).trim())
        : "";
      const base = decodeHtmlEntities(
        stripRawTags(
          inner
            .replace(/<rt[^>]*>[\s\S]*?<\/rt>/gi, "")
            .replace(/<rp[^>]*>[\s\S]*?<\/rp>/gi, "")
        ).trim()
      );

      if (base && reading) {
        return `${base}（${reading}）`;
      }

      return base || reading;
    }
  );

  // Convert kanji[reading] format to kanji（reading）.
  normalized = normalized.replace(/([^\s\[\]]+)\[([^\]]+)\]/g, "$1（$2）");

  return normalized;
}

function splitStrongSegments(raw: string): HtmlSegment[] {
  const source = normalizeExampleFurigana(raw);
  const strongPattern = /<strong[^>]*>([\s\S]*?)<\/strong>/gi;

  const segments: HtmlSegment[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = strongPattern.exec(source)) !== null) {
    const plainText = decodeHtmlEntities(stripRawTags(source.slice(cursor, match.index)));
    if (plainText.length > 0) {
      segments.push({ text: plainText, strong: false });
    }

    const strongText = decodeHtmlEntities(stripRawTags(match[1]));
    if (strongText.length > 0) {
      segments.push({ text: strongText, strong: true });
    }

    cursor = strongPattern.lastIndex;
  }

  const tail = decodeHtmlEntities(stripRawTags(source.slice(cursor)));
  if (tail.length > 0) {
    segments.push({ text: tail, strong: false });
  }

  return segments;
}

function parseFuriganaRuns(raw: string): FuriganaRun[] {
  const segments = splitStrongSegments(raw);
  const runs: FuriganaRun[] = [];
  const furiganaPattern = /([^\s（）()]+)(?:（([^）]+)）|\(([^)]+)\))/g;

  segments.forEach((segment) => {
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = furiganaPattern.exec(segment.text)) !== null) {
      const [full, base, fullWidthReading, asciiReading] = match;
      const reading = fullWidthReading || asciiReading || "";
      const prefix = segment.text.slice(lastIndex, match.index);
      if (prefix.length > 0) {
        runs.push({ kind: "text", text: prefix, strong: segment.strong });
      }

      if (hasKanji(base)) {
        runs.push({
          kind: "ruby",
          base,
          reading,
          strong: segment.strong,
        });
      } else {
        runs.push({ kind: "text", text: full, strong: segment.strong });
      }

      lastIndex = match.index + full.length;
    }

    const tail = segment.text.slice(lastIndex);
    if (tail.length > 0) {
      runs.push({ kind: "text", text: tail, strong: segment.strong });
    }
  });

  return runs;
}

function normalizeRuby(value: string): string {
  return value.replace(/<ruby[^>]*>([\s\S]*?)<\/ruby>/gi, (_match, inner: string) => {
    const readingMatch = inner.match(/<rt[^>]*>([\s\S]*?)<\/rt>/i);
    const reading = readingMatch
      ? decodeHtmlEntities(stripRawTags(readingMatch[1]).trim())
      : "";

    const base = decodeHtmlEntities(
      stripRawTags(
        inner
          .replace(/<rt[^>]*>[\s\S]*?<\/rt>/gi, "")
          .replace(/<rp[^>]*>[\s\S]*?<\/rp>/gi, "")
      ).trim()
    );

    if (base && reading) {
      return `${base}（${reading}）`;
    }

    return base || reading;
  });
}

function cleanHtmlText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return stripFuriganaAndTags(normalizeRuby(value));
}

function sanitizeHtmlFragment(value: string): string {
  return decodeHtmlEntities(
    stripRawTags(
      normalizeRuby(value)
        .replace(/<br\s*\/?\s*>/gi, "\n")
        .replace(/<rp[^>]*>[\s\S]*?<\/rp>/gi, "")
    )
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function getTagClassNames(tag: string): string[] {
  const classMatch = tag.match(/\bclass\s*=\s*["']([^"']+)["']/i);
  if (!classMatch?.[1]) {
    return [];
  }

  return classMatch[1]
    .split(/\s+/)
    .map((name) => name.trim().toLowerCase())
    .filter((name) => name.length > 0);
}

function buildHtmlTextRuns(value: unknown): HtmlTextRun[] {
  if (typeof value !== "string" || value.trim().length === 0) {
    return [];
  }

  const source = normalizeRuby(value)
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<h[1-6][^>]*>/gi, "")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/ul>/gi, "\n")
    .replace(/<ul[^>]*>/gi, "")
    .replace(/<\/section>/gi, "\n")
    .replace(/<section[^>]*>/gi, "\n");

  const runs: HtmlTextRun[] = [];
  const tagPattern = /<[^>]+>/g;
  let cursor = 0;
  let strongDepth = 0;
  let strikeDepth = 0;
  let accentDepth = 0;
  const spanAccentStack: boolean[] = [];
  let match: RegExpExecArray | null;

  const pushText = (rawText: string) => {
    const text = decodeHtmlEntities(rawText);
    if (text.length === 0) {
      return;
    }

    const previous = runs[runs.length - 1];
    const nextRun: HtmlTextRun = {
      text,
      strong: strongDepth > 0,
      strike: strikeDepth > 0,
      accent: accentDepth > 0 || strongDepth > 0,
    };

    if (
      previous &&
      previous.strong === nextRun.strong &&
      previous.strike === nextRun.strike &&
      previous.accent === nextRun.accent
    ) {
      previous.text += nextRun.text;
      return;
    }

    runs.push(nextRun);
  };

  while ((match = tagPattern.exec(source)) !== null) {
    const plainText = source.slice(cursor, match.index);
    pushText(plainText);

    const tag = match[0];
    const normalizedTag = tag.toLowerCase();

    if (normalizedTag.startsWith("<strong")) {
      strongDepth += 1;
    } else if (normalizedTag.startsWith("</strong")) {
      strongDepth = Math.max(0, strongDepth - 1);
    } else if (normalizedTag.startsWith("<del")) {
      strikeDepth += 1;
    } else if (normalizedTag.startsWith("</del")) {
      strikeDepth = Math.max(0, strikeDepth - 1);
    } else if (normalizedTag.startsWith("<a")) {
      accentDepth += 1;
    } else if (normalizedTag.startsWith("</a")) {
      accentDepth = Math.max(0, accentDepth - 1);
    } else if (normalizedTag.startsWith("<span")) {
      const classNames = getTagClassNames(tag);
      const isAccentSpan = classNames.some((className) =>
        className.includes("gp-popout") || className.includes("chui")
      );
      spanAccentStack.push(isAccentSpan);
      if (isAccentSpan) {
        accentDepth += 1;
      }
    } else if (normalizedTag.startsWith("</span")) {
      const hadAccent = spanAccentStack.pop();
      if (hadAccent) {
        accentDepth = Math.max(0, accentDepth - 1);
      }
    }

    cursor = tagPattern.lastIndex;
  }

  pushText(source.slice(cursor));

  return runs;
}

function cleanupRunText(text: string): string {
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ");
}

function formatLevel(rawValue: string): string {
  const normalized = rawValue.trim();
  if (normalized.length === 0) {
    return "";
  }

  const jlptMatch = normalized.match(/^JLPT\s*([1-5])$/i) ??
    normalized.match(/^JLPT([1-5])$/i);

  if (jlptMatch?.[1]) {
    return `N${jlptMatch[1]}`;
  }

  return normalized;
}

function formatBunproError(error: unknown): string {
  if (error instanceof BunproApiError) {
    return error.code ? `${error.message} (${error.code})` : error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Could not load Bunpro details.";
}

function getEnglishGlosses(jmdictData: unknown): string[] {
  if (!jmdictData || typeof jmdictData !== "object") {
    return [];
  }

  const senses = (jmdictData as { sense?: unknown }).sense;
  if (!Array.isArray(senses)) {
    return [];
  }

  const seen = new Set<string>();
  const glosses: string[] = [];

  senses.forEach((sense) => {
    if (!sense || typeof sense !== "object") {
      return;
    }

    const entries = (sense as { gloss?: unknown }).gloss;
    if (!Array.isArray(entries)) {
      return;
    }

    entries.forEach((entry) => {
      if (!entry || typeof entry !== "object") {
        return;
      }

      const lang = (entry as { lang?: unknown }).lang;
      const text = (entry as { text?: unknown }).text;
      if (lang !== "eng" || typeof text !== "string") {
        return;
      }

      const normalized = text.trim();
      if (!normalized) {
        return;
      }

      const key = normalized.toLowerCase();
      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      glosses.push(normalized);
    });
  });

  return glosses;
}

function extractAcceptedAnswers(value: unknown): string[] {
  if (typeof value !== "string") {
    return [];
  }

  const seen = new Set<string>();
  const answers: string[] = [];

  value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .forEach((entry) => {
      const key = entry.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        answers.push(entry);
      }
    });

  return answers;
}

function extractMetadataTags(value: unknown): string[] {
  if (typeof value !== "string") {
    return [];
  }

  const seen = new Set<string>();
  const tags: string[] = [];

  value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .forEach((entry) => {
      const key = entry.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        tags.push(entry);
      }
    });

  return tags;
}

function extractWriteupExampleIds(value: unknown): string[] {
  if (typeof value !== "string" || value.trim().length === 0) {
    return [];
  }

  const ids: string[] = [];
  const seen = new Set<string>();
  const idPattern = /data-study-question=['"](\d+)['"]/gi;
  let match: RegExpExecArray | null;

  while ((match = idPattern.exec(value)) !== null) {
    const id = match[1];
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }

  return ids;
}

function buildWriteupBlocks(value: unknown): BunproWriteupBlock[] {
  if (typeof value !== "string" || value.trim().length === 0) {
    return [];
  }

  const listPattern =
    /<ul[^>]*class=['"][^'"]*writeup-examples--holder[^'"]*['"][^>]*>[\s\S]*?<\/ul>/gi;

  const blocks: BunproWriteupBlock[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = listPattern.exec(value)) !== null) {
    const precedingHtml = value.slice(cursor, match.index);
    if (cleanHtmlText(precedingHtml).length > 0) {
      blocks.push({
        kind: "html",
        html: precedingHtml.trim(),
      });
    }

    const ids = extractWriteupExampleIds(match[0]);
    if (ids.length > 0) {
      blocks.push({
        kind: "examples",
        ids,
      });
    }

    cursor = listPattern.lastIndex;
  }

  const trailingHtml = value.slice(cursor);
  if (cleanHtmlText(trailingHtml).length > 0) {
    blocks.push({
      kind: "html",
      html: trailingHtml.trim(),
    });
  }

  return blocks;
}

function getExampleReplacement(
  attributes: Record<string, unknown>,
  fallback: string
): string {
  const kanjiAnswer =
    typeof attributes.kanji_answer === "string" ? attributes.kanji_answer.trim() : "";
  if (kanjiAnswer.length > 0) {
    return kanjiAnswer;
  }

  const answer = typeof attributes.answer === "string" ? attributes.answer.trim() : "";
  if (answer.length > 0) {
    return answer;
  }

  const prompt = cleanHtmlText(attributes.word_prompt);
  if (prompt.length > 0) {
    return prompt;
  }

  return fallback;
}

function toExampleItem(
  resource: BunproIncludedResource,
  fallback: string
): BunproExampleItem | null {
  if (resource.type !== "study_question") {
    return null;
  }

  const attributes = resource.attributes as Record<string, unknown>;
  const replacement = getExampleReplacement(attributes, fallback);
  const rawJapanese = typeof attributes.content === "string" ? attributes.content : "";

  const japaneseHtml = replacement
    ? rawJapanese.replace(/(?:_{2,}|＿{2,})/g, `<strong>${replacement}</strong>`)
    : rawJapanese;

  const order =
    typeof attributes.sentence_order === "number"
      ? attributes.sentence_order
      : Number.MAX_SAFE_INTEGER;

  const normalizedJapanese = sanitizeHtmlFragment(japaneseHtml);
  if (normalizedJapanese.length === 0) {
    return null;
  }

  return {
    id: resource.id,
    japaneseHtml,
    translationHtml: typeof attributes.translation === "string" ? attributes.translation : "",
    level: formatLevel(cleanHtmlText(attributes.level)),
    order,
    femaleAudioUrl: typeof attributes.female_audio_url === "string" ? attributes.female_audio_url : "",
    maleAudioUrl: typeof attributes.male_audio_url === "string" ? attributes.male_audio_url : "",
  };
}

function stripTrailingPeriod(value: string): string {
  return value.replace(/[.,;:]+$/, "").trim();
}

type RichTextProps = {
  value: string;
  textStyle: any;
  strongTextStyle: any;
  accentTextStyle?: any;
  strikeTextStyle?: any;
};

function RichText({
  value,
  textStyle,
  strongTextStyle,
  accentTextStyle,
  strikeTextStyle,
}: RichTextProps) {
  const runs = useMemo(() => buildHtmlTextRuns(value), [value]);

  if (runs.length === 0) {
    return null;
  }

  return (
    <Text style={textStyle}>
      {runs.map((run, index) => (
        <Text
          key={`${index}-${run.strong ? "strong" : "plain"}-${run.text.slice(0, 8)}`}
          style={[
            run.strong && strongTextStyle,
            run.accent && accentTextStyle,
            run.strike && strikeTextStyle,
          ]}
        >
          {cleanupRunText(run.text)}
        </Text>
      ))}
    </Text>
  );
}

type JapaneseFuriganaTextProps = {
  value: string;
  baseTextStyle: any;
  readingTextStyle: any;
  strongBaseTextStyle: any;
  strongReadingTextStyle?: any;
};

function JapaneseFuriganaText({
  value,
  baseTextStyle,
  readingTextStyle,
  strongBaseTextStyle,
  strongReadingTextStyle,
}: JapaneseFuriganaTextProps) {
  const runs = useMemo(() => parseFuriganaRuns(value), [value]);

  if (runs.length === 0) {
    return null;
  }

  return (
    <View style={styles.rubyLine}>
      {runs.map((run, index) => {
        const key = `${run.kind}-${index}`;

        if (run.kind === "ruby") {
          return (
            <View key={key} style={styles.rubyContainer}>
              <Text
                style={[
                  styles.rubyReading,
                  readingTextStyle,
                  run.strong && (strongReadingTextStyle || strongBaseTextStyle),
                ]}
              >
                {run.reading}
              </Text>
              <Text
                style={[
                  styles.rubyBase,
                  baseTextStyle,
                  run.strong && strongBaseTextStyle,
                ]}
              >
                {run.base}
              </Text>
            </View>
          );
        }

        return (
          <Text
            key={key}
            style={[
              styles.rubyBase,
              baseTextStyle,
              run.strong && strongBaseTextStyle,
            ]}
          >
            {run.text}
          </Text>
        );
      })}
    </View>
  );
}

type TabButtonProps = {
  isActive: boolean;
  label: string;
  onPress: () => void;
  activeColor: string;
  inactiveColor: string;
  activeBackground: string;
};

function TabButton({
  isActive,
  label,
  onPress,
  activeColor,
  inactiveColor,
  activeBackground,
}: TabButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.tabButton,
        isActive && {
          backgroundColor: activeBackground,
          borderColor: activeBackground,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.84}
    >
      <Text style={[styles.tabButtonText, { color: isActive ? activeColor : inactiveColor }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

type DetailFieldProps = {
  label: string;
  value: string;
  color: string;
  mutedColor: string;
};

function DetailField({ label, value, color, mutedColor }: DetailFieldProps) {
  if (!value) {
    return null;
  }

  return (
    <View style={styles.detailField}>
      <Text style={[styles.detailFieldLabel, { color: mutedColor }]}>{label}</Text>
      <Text style={[styles.detailFieldValue, { color }]}>{value}</Text>
    </View>
  );
}

export default function BunproReviewableDetailsScreen() {
  const { theme, isDark } = useTheme();
  const { userData } = useAuthStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ kind?: string; slug?: string }>();

  const isPortegoUser = isPortegoUsername(userData?.username);

  const kindParam = decodeParam(params.kind) as BunproDetailKind;
  const slugParam = decodeParam(params.slug);

  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [structureMode, setStructureMode] = useState<StructureMode>("casual");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [details, setDetails] = useState<BunproDetailsPayload | null>(null);
  const [playingAudioKey, setPlayingAudioKey] = useState<string | null>(null);
  const [loadingAudioKey, setLoadingAudioKey] = useState<string | null>(null);

  const pagerRef = useRef<PagerView>(null);
  const soundRef = useRef<AudioSound | null>(null);

  const accent = isDark ? "#db6466" : "#cc5b5d";
  const accentOnTextColor = getBestContrastTextColor(accent, "#17181d", "#ffffff");
  const panelBorder = isDark ? "rgba(255,255,255,0.12)" : theme.border;
  const exampleCardBackground = isDark ? "#10141a" : "#f9fafc";
  const mutedTextColor = isDark ? "#a8aeb9" : theme.textSecondary;
  const headerMutedTextColor = isDark ? mutedTextColor : "rgba(255,255,255,0.86)";
  const topPanelDividerColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.24)";

  const stopActiveSound = useCallback(async () => {
    if (!soundRef.current) {
      return;
    }

    try {
      await soundRef.current.unloadAsync();
    } catch {
      // noop
    } finally {
      soundRef.current = null;
      setPlayingAudioKey(null);
    }
  }, []);

  const playAudio = useCallback(
    async (audioKey: string, rawUrls: (string | null | undefined)[]) => {
      const urls = rawUrls
        .filter((url): url is string => typeof url === "string" && url.trim().length > 0)
        .map((url) => url.trim());

      if (urls.length === 0) {
        return;
      }

      if (playingAudioKey === audioKey && !loadingAudioKey) {
        await stopActiveSound();
        return;
      }

      setLoadingAudioKey(audioKey);
      await stopActiveSound();

      if (Platform.OS === "ios") {
        try {
          await AudioSessionManager.overrideSpeaker();
        } catch {
          // noop
        }
      }

      let createdSound: AudioSound | null = null;
      let lastError: unknown = null;

      for (const url of urls) {
        try {
          const { sound } = await Audio.Sound.createAsync(
            { uri: url },
            { shouldPlay: true }
          );
          createdSound = sound;
          break;
        } catch (error) {
          lastError = error;
        }
      }

      setLoadingAudioKey(null);

      if (!createdSound) {
        if (lastError) {
          console.warn("[BunproDetails] Failed to play audio", lastError);
        }
        return;
      }

      soundRef.current = createdSound;
      setPlayingAudioKey(audioKey);

      createdSound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) {
          return;
        }

        if (status.didJustFinish) {
          void stopActiveSound();
        }
      });
    },
    [loadingAudioKey, playingAudioKey, stopActiveSound]
  );

  const loadDetails = useCallback(async () => {
    if (!isPortegoUser) {
      return;
    }

    if (kindParam !== "grammar" && kindParam !== "vocab") {
      setErrorMessage("Invalid Bunpro reviewable type.");
      setIsLoading(false);
      return;
    }

    if (!slugParam) {
      setErrorMessage("Missing Bunpro reviewable slug.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await getBunproReviewableDetails({
        kind: kindParam,
        slug: slugParam,
      });

      console.log(
        `[BunproDetails] reviewable details response\n${JSON.stringify(
          {
            kind: kindParam,
            slug: slugParam,
            response,
          },
          null,
          2
        )}`
      );

      setDetails(response);
    } catch (error) {
      setErrorMessage(formatBunproError(error));
    } finally {
      setIsLoading(false);
    }
  }, [isPortegoUser, kindParam, slugParam]);

  useEffect(() => {
    void Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: false,
    });

    return () => {
      void stopActiveSound();
    };
  }, [stopActiveSound]);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  useEffect(() => {
    setActiveTabIndex(0);
    setStructureMode("casual");
  }, [kindParam, slugParam]);

  const attributes = details?.data?.attributes as Record<string, unknown> | undefined;
  const isVocab = kindParam === "vocab";

  const title = useMemo(() => {
    const directTitle = cleanHtmlText(attributes?.title);
    if (directTitle.length > 0) {
      return directTitle;
    }
    return slugParam;
  }, [attributes?.title, slugParam]);

  const reading = useMemo(() => {
    const furigana = cleanHtmlText(attributes?.furigana);
    if (furigana.length > 0) {
      return furigana;
    }

    return cleanHtmlText(attributes?.kana);
  }, [attributes?.furigana, attributes?.kana]);

  const meaning = useMemo(
    () => sanitizeHtmlFragment(typeof attributes?.meaning === "string" ? attributes.meaning : ""),
    [attributes?.meaning]
  );

  const nuanceTranslation = useMemo(
    () => (typeof attributes?.nuance_translation === "string" ? attributes.nuance_translation : ""),
    [attributes?.nuance_translation]
  );

  const nuanceJapanese = useMemo(
    () => (typeof attributes?.nuance === "string" ? attributes.nuance : ""),
    [attributes?.nuance]
  );

  const levelLabel = useMemo(() => {
    const rawLevel = isVocab
      ? cleanHtmlText(attributes?.jlpt_level)
      : cleanHtmlText(attributes?.level);

    return formatLevel(rawLevel);
  }, [attributes?.jlpt_level, attributes?.level, isVocab]);

  const lessonId = useMemo(() => {
    const rawLessonId = attributes?.lesson_id;
    if (typeof rawLessonId === "number" && Number.isFinite(rawLessonId)) {
      return rawLessonId;
    }
    return null;
  }, [attributes?.lesson_id]);

  const headerInfo = useMemo(() => {
    if (levelLabel && lessonId !== null) {
      return `${levelLabel} Lesson ${lessonId}`;
    }
    if (levelLabel) {
      return levelLabel;
    }
    if (lessonId !== null) {
      return `Lesson ${lessonId}`;
    }
    return "Bunpro";
  }, [levelLabel, lessonId]);

  const kindLabel = isVocab ? "Vocabulary" : "Grammar";
  const rareKanjiWarning = cleanHtmlText(attributes?.rare_kanji_warning);
  const caution = typeof attributes?.caution === "string" ? attributes.caution : "";

  const partOfSpeech = useMemo(() => {
    const translated = cleanHtmlText(attributes?.part_of_speech_translation);
    if (translated) {
      return translated;
    }
    return cleanHtmlText(attributes?.part_of_speech);
  }, [attributes?.part_of_speech, attributes?.part_of_speech_translation]);

  const registerLabel = useMemo(() => {
    const translated = cleanHtmlText(attributes?.register_translation);
    if (translated) {
      return translated;
    }
    return cleanHtmlText(attributes?.register);
  }, [attributes?.register, attributes?.register_translation]);

  const wordTypeLabel = useMemo(() => {
    const translated = cleanHtmlText(attributes?.word_type_translation);
    if (translated) {
      return translated;
    }
    return cleanHtmlText(attributes?.word_type);
  }, [attributes?.word_type, attributes?.word_type_translation]);

  const politeStructure = useMemo(
    () => (typeof attributes?.polite_structure === "string" ? attributes.polite_structure : ""),
    [attributes?.polite_structure]
  );

  const casualStructure = useMemo(
    () => (typeof attributes?.casual_structure === "string" ? attributes.casual_structure : ""),
    [attributes?.casual_structure]
  );

  const discourseLink = useMemo(
    () =>
      typeof attributes?.discourse_link === "string"
        ? attributes.discourse_link.trim()
        : "",
    [attributes?.discourse_link]
  );

  const pronunciationAudioUrls = useMemo(
    () => [
      typeof attributes?.female_audio_url === "string" ? attributes.female_audio_url : null,
      typeof attributes?.male_audio_url === "string" ? attributes.male_audio_url : null,
    ],
    [attributes?.female_audio_url, attributes?.male_audio_url]
  );

  const acceptedAnswers = useMemo(
    () => extractAcceptedAnswers(attributes?.accepted_answers).slice(0, 20),
    [attributes?.accepted_answers]
  );

  const englishGlosses = useMemo(
    () => getEnglishGlosses(attributes?.jmdict_data).slice(0, 20),
    [attributes?.jmdict_data]
  );

  const metadataTags = useMemo(
    () => extractMetadataTags(attributes?.metadata).slice(0, 24),
    [attributes?.metadata]
  );

  const includedResources = useMemo(
    () => details?.included ?? [],
    [details?.included]
  );

  const examples = useMemo<BunproExampleItem[]>(() => {
    return includedResources
      .map((resource) => toExampleItem(resource, title))
      .filter((item): item is BunproExampleItem => item !== null)
      .sort((a, b) => a.order - b.order);
  }, [includedResources, title]);

  const exampleById = useMemo(() => {
    const map = new Map<string, BunproExampleItem>();
    examples.forEach((example) => {
      map.set(example.id, example);
    });
    return map;
  }, [examples]);

  const writeupResource = useMemo(
    () => includedResources.find((resource) => resource.type === "writeup") ?? null,
    [includedResources]
  );

  const writeupBodyHtml = useMemo(() => {
    if (!writeupResource) {
      return "";
    }
    const writeupAttributes = writeupResource.attributes as Record<string, unknown>;
    return typeof writeupAttributes.body === "string" ? writeupAttributes.body : "";
  }, [writeupResource]);

  const aboutBlocks = useMemo(() => {
    const blocks = buildWriteupBlocks(writeupBodyHtml);

    return blocks
      .map((block) => {
        if (block.kind === "html") {
          return {
            kind: "html" as const,
            html: block.html,
          };
        }

        const examplesForBlock = block.ids
          .map((id) => exampleById.get(id))
          .filter((item): item is BunproExampleItem => Boolean(item));

        if (examplesForBlock.length === 0) {
          return null;
        }

        return {
          kind: "examples" as const,
          examples: examplesForBlock,
        };
      })
      .filter((block): block is { kind: "html"; html: string } | { kind: "examples"; examples: BunproExampleItem[] } => block !== null);
  }, [exampleById, writeupBodyHtml]);

  const primaryGloss = useMemo(() => {
    if (meaning) {
      return stripTrailingPeriod(meaning);
    }
    if (englishGlosses.length > 0) {
      return stripTrailingPeriod(englishGlosses[0]);
    }
    return "";
  }, [englishGlosses, meaning]);

  const openDiscourse = useCallback(async () => {
    if (!discourseLink) {
      return;
    }

    try {
      await Linking.openURL(discourseLink);
    } catch {
      // noop
    }
  }, [discourseLink]);

  const switchTab = useCallback((index: number) => {
    setActiveTabIndex(index);
    pagerRef.current?.setPage(index);
  }, []);

  const renderExampleCard = useCallback(
    (example: BunproExampleItem) => {
      const exampleAudioKey = `example-${example.id}`;
      const hasAudio =
        (typeof example.femaleAudioUrl === "string" && example.femaleAudioUrl.trim().length > 0) ||
        (typeof example.maleAudioUrl === "string" && example.maleAudioUrl.trim().length > 0);

      return (
        <View
          key={example.id}
          style={[
            styles.exampleCard,
            {
              backgroundColor: exampleCardBackground,
              borderColor: panelBorder,
            },
          ]}
        >
          <JapaneseFuriganaText
            value={example.japaneseHtml}
            baseTextStyle={[styles.exampleJapanese, { color: theme.textColor }]}
            readingTextStyle={[styles.exampleRubyReading, { color: mutedTextColor }]}
            strongBaseTextStyle={{ color: accent, fontWeight: "700" }}
            strongReadingTextStyle={{ color: accent, fontWeight: "600" }}
          />

          {example.translationHtml ? (
            <RichText
              value={example.translationHtml}
              textStyle={[styles.exampleTranslation, { color: mutedTextColor }]}
              strongTextStyle={{ color: accent, fontWeight: "700" }}
              accentTextStyle={{ color: accent }}
              strikeTextStyle={styles.strikeText}
            />
          ) : null}

          {(example.level || hasAudio) ? (
            <View style={styles.exampleFooterRow}>
              {example.level ? (
                <View style={[styles.levelPill, { borderColor: panelBorder }]}>
                  <Text style={[styles.levelPillText, { color: mutedTextColor }]}>
                    {example.level}
                  </Text>
                </View>
              ) : (
                <View />
              )}

              {hasAudio ? (
                <TouchableOpacity
                  style={[styles.playButtonSmall, { borderColor: panelBorder }]}
                  onPress={() => {
                    void playAudio(exampleAudioKey, [example.femaleAudioUrl, example.maleAudioUrl]);
                  }}
                >
                  {loadingAudioKey === exampleAudioKey ? (
                    <ActivityIndicator size="small" color={accent} />
                  ) : (
                    <Ionicons
                      name={playingAudioKey === exampleAudioKey ? "pause" : "play"}
                      size={15}
                      color={accent}
                    />
                  )}
                  <Text style={[styles.playButtonSmallText, { color: theme.textColor }]}>Play</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </View>
      );
    },
    [
      accent,
      exampleCardBackground,
      loadingAudioKey,
      mutedTextColor,
      panelBorder,
      playAudio,
      playingAudioKey,
      theme.textColor,
    ]
  );

  const hasStructureSection = Boolean(casualStructure || politeStructure);
  const hasAboutSection = !isVocab && aboutBlocks.length > 0;
  const hasMeaningsSection = englishGlosses.length > 0 || acceptedAnswers.length > 0;
  const hasMetadataSection = metadataTags.length > 0;
  const hasDiscussionSection = Boolean(discourseLink);
  const resourcesFirstSection = hasMeaningsSection
    ? "meanings"
    : hasMetadataSection
      ? "metadata"
      : hasDiscussionSection
        ? "discussion"
        : null;

  if (!isPortegoUser) {
    return (
      <View style={[styles.gatedContainer, { backgroundColor: theme.backgroundColor }]}> 
        <StatusBar style={theme.statusBarStyle} />
        <Ionicons name="lock-closed-outline" size={24} color={theme.textSecondary} />
        <Text style={[styles.gatedTitle, { color: theme.textColor }]}>Bunpro Beta Is Portego-Only</Text>
        <Text style={[styles.gatedSubtitle, { color: theme.textSecondary }]}>This page is currently enabled only for the Portego account.</Text>
      </View>
    );
  }

  if (isLoading && !details) {
    return (
      <View style={[styles.centerContent, { backgroundColor: theme.backgroundColor }]}> 
        <StatusBar style={theme.statusBarStyle} />
        <ActivityIndicator size="large" color={accent} />
        <Text style={[styles.loadingText, { color: mutedTextColor }]}>Loading Bunpro details...</Text>
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View style={[styles.centerContent, { backgroundColor: theme.backgroundColor }]}> 
        <StatusBar style={theme.statusBarStyle} />
        <Ionicons name="alert-circle-outline" size={44} color={theme.error} />
        <Text style={[styles.errorText, { color: theme.error }]}>{errorMessage}</Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: accent }]}
          onPress={() => {
            void loadDetails();
          }}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}> 
      <StatusBar style={theme.statusBarStyle} />

      <View
        style={[
          styles.topPanel,
          {
            backgroundColor: theme.headerBackground,
            borderBottomColor: topPanelDividerColor,
            paddingTop: insets.top + 8,
          },
        ]}
      >
        <View
          style={[
            styles.topRow,
            {
              top: insets.top + 8,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.back()}
            activeOpacity={0.78}
          >
            <Ionicons name="arrow-back" size={24} color={theme.headerText} />
          </TouchableOpacity>

          <View style={styles.topRowSpacer} />

          {discourseLink ? (
            <TouchableOpacity
              style={styles.iconButton}
              onPress={openDiscourse}
              activeOpacity={0.78}
            >
              <Ionicons name="open-outline" size={21} color={theme.headerText} />
            </TouchableOpacity>
          ) : (
            <View style={styles.iconButton} />
          )}
        </View>

        <View style={styles.subjectBlock}>
          <Text style={[styles.kindOverline, { color: headerMutedTextColor }]}>{kindLabel} Info</Text>
          <Text style={[styles.headerInfo, { color: theme.headerText }]}>{headerInfo}</Text>

          <Text style={[styles.subjectTitle, { color: accent }]}>{title}</Text>
          {reading ? <Text style={[styles.subjectReading, { color: headerMutedTextColor }]}>{reading}</Text> : null}
          {primaryGloss ? (
            <Text style={[styles.subjectMeaning, { color: theme.headerText }]} numberOfLines={2}>
              {primaryGloss}
            </Text>
          ) : null}
          {rareKanjiWarning ? (
            <Text style={[styles.warningText, { color: isDark ? "#d5b26d" : "#9f6b00" }]}>⚠ {rareKanjiWarning}</Text>
          ) : null}
        </View>

        <View style={styles.tabsRow}>
          {TAB_TITLES.map((label, index) => (
            <TabButton
              key={label}
              label={label}
              isActive={activeTabIndex === index}
              onPress={() => switchTab(index)}
              activeColor={theme.headerText}
              inactiveColor={headerMutedTextColor}
              activeBackground={isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.22)"}
            />
          ))}
        </View>
      </View>

      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={(event) => {
          setActiveTabIndex(event.nativeEvent.position);
        }}
      >
        <View key="meaning" style={styles.pageContainer}>
          <ScrollView
            style={styles.pageScroll}
            contentContainerStyle={[styles.pageScrollContent, { paddingBottom: insets.bottom + 28 }]}
          >
            {(casualStructure || politeStructure) ? (
              <View
                style={[
                  styles.section,
                  styles.sectionNoTopSeparator,
                  { borderTopColor: panelBorder },
                ]}
              > 
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionTitle, { color: theme.textColor }]}>Structure</Text>

                  {casualStructure && politeStructure ? (
                    <View style={[styles.structureToggleRow, { borderColor: panelBorder }]}> 
                      <TouchableOpacity
                        style={[
                          styles.structureToggleButton,
                          structureMode === "casual" && {
                            backgroundColor: accent,
                          },
                        ]}
                        onPress={() => setStructureMode("casual")}
                      >
                        <Text
                          style={[
                            styles.structureToggleText,
                            {
                              color:
                                structureMode === "casual"
                                  ? accentOnTextColor
                                  : mutedTextColor,
                            },
                          ]}
                        >
                          Standard
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.structureToggleButton,
                          structureMode === "polite" && {
                            backgroundColor: accent,
                          },
                        ]}
                        onPress={() => setStructureMode("polite")}
                      >
                        <Text
                          style={[
                            styles.structureToggleText,
                            {
                              color:
                                structureMode === "polite"
                                  ? accentOnTextColor
                                  : mutedTextColor,
                            },
                          ]}
                        >
                          Polite
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>

                <RichText
                  value={
                    structureMode === "polite"
                      ? politeStructure || casualStructure
                      : casualStructure || politeStructure
                  }
                  textStyle={[styles.structureText, { color: theme.textColor }]}
                  strongTextStyle={{ color: accent, fontWeight: "700" }}
                  accentTextStyle={{ color: accent }}
                  strikeTextStyle={styles.strikeText}
                />
              </View>
            ) : null}

            <View
              style={[
                styles.section,
                !hasStructureSection && styles.sectionNoTopSeparator,
                { borderTopColor: panelBorder },
              ]}
            > 
              <Text style={[styles.sectionTitle, { color: theme.textColor }]}>Details</Text>
              <View style={styles.detailGrid}>
                <DetailField
                  label="Type"
                  value={kindLabel}
                  color={theme.textColor}
                  mutedColor={mutedTextColor}
                />
                <DetailField
                  label="Level"
                  value={levelLabel}
                  color={theme.textColor}
                  mutedColor={mutedTextColor}
                />
                <DetailField
                  label="Lesson"
                  value={lessonId !== null ? String(lessonId) : ""}
                  color={theme.textColor}
                  mutedColor={mutedTextColor}
                />
                <DetailField
                  label="Part Of Speech"
                  value={partOfSpeech}
                  color={theme.textColor}
                  mutedColor={mutedTextColor}
                />
                <DetailField
                  label="Register"
                  value={registerLabel}
                  color={theme.textColor}
                  mutedColor={mutedTextColor}
                />
                <DetailField
                  label="Word Type"
                  value={wordTypeLabel}
                  color={theme.textColor}
                  mutedColor={mutedTextColor}
                />
              </View>
            </View>

            {(nuanceTranslation || nuanceJapanese || caution) ? (
              <View style={[styles.section, { borderTopColor: panelBorder }]}> 
                <Text style={[styles.sectionTitle, { color: theme.textColor }]}>Nuance</Text>
                {nuanceTranslation ? (
                  <RichText
                    value={nuanceTranslation}
                    textStyle={[styles.paragraphText, { color: theme.textColor }]}
                    strongTextStyle={{ color: accent, fontWeight: "700" }}
                    accentTextStyle={{ color: accent }}
                    strikeTextStyle={styles.strikeText}
                  />
                ) : null}
                {nuanceJapanese ? (
                  <RichText
                    value={nuanceJapanese}
                    textStyle={[styles.paragraphSubtle, { color: mutedTextColor }]}
                    strongTextStyle={{ color: accent, fontWeight: "700" }}
                    accentTextStyle={{ color: accent }}
                    strikeTextStyle={styles.strikeText}
                  />
                ) : null}
                {caution ? (
                  <View style={styles.cautionBlock}>
                    <Text style={[styles.cautionText, { color: isDark ? "#d5b26d" : "#9f6b00" }]}>
                      ⚠
                    </Text>
                    <RichText
                      value={caution}
                      textStyle={[styles.cautionText, { color: isDark ? "#d5b26d" : "#9f6b00" }]}
                      strongTextStyle={{ color: isDark ? "#f0ca82" : "#9f6b00", fontWeight: "700" }}
                      accentTextStyle={{ color: isDark ? "#f0ca82" : "#9f6b00" }}
                      strikeTextStyle={styles.strikeText}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}

            {hasAboutSection ? (
              <View style={[styles.section, { borderTopColor: panelBorder }]}>
                <Text style={[styles.sectionTitle, { color: theme.textColor }]}>About {title}</Text>
                <View style={styles.aboutContent}>
                  {aboutBlocks.map((block, blockIndex) => {
                    if (block.kind === "html") {
                      return (
                        <RichText
                          key={`about-html-${blockIndex}`}
                          value={block.html}
                          textStyle={[styles.paragraphText, { color: theme.textColor }]}
                          strongTextStyle={{ color: accent, fontWeight: "700" }}
                          accentTextStyle={{ color: accent }}
                          strikeTextStyle={styles.strikeText}
                        />
                      );
                    }

                    return (
                      <View key={`about-examples-${blockIndex}`} style={styles.aboutExamplesBlock}>
                        <View style={styles.examplesList}>
                          {block.examples.map((example) => renderExampleCard(example))}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {pronunciationAudioUrls.some((url) => typeof url === "string" && url.trim().length > 0) ? (
              <View style={[styles.section, { borderTopColor: panelBorder }]}> 
                <Text style={[styles.sectionTitle, { color: theme.textColor }]}>Pronunciation</Text>
                <TouchableOpacity
                  style={[styles.playButton, { borderColor: panelBorder }]}
                  activeOpacity={0.84}
                  onPress={() => {
                    void playAudio("subject", pronunciationAudioUrls);
                  }}
                >
                  {loadingAudioKey === "subject" ? (
                    <ActivityIndicator color={accent} size="small" />
                  ) : (
                    <Ionicons
                      name={playingAudioKey === "subject" ? "pause" : "play"}
                      size={16}
                      color={accent}
                    />
                  )}
                  <Text style={[styles.playButtonText, { color: theme.textColor }]}>Play Subject Audio</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </ScrollView>
        </View>

        <View key="examples" style={styles.pageContainer}>
          <ScrollView
            style={styles.pageScroll}
            contentContainerStyle={[styles.pageScrollContent, { paddingBottom: insets.bottom + 28 }]}
          >
            <View
              style={[
                styles.section,
                styles.sectionNoTopSeparator,
                { borderTopColor: panelBorder },
              ]}
            > 
              <Text style={[styles.sectionTitle, { color: theme.textColor }]}>Examples</Text>

              {examples.length > 0 ? (
                <View style={styles.examplesList}>
                  {examples.map((example) => renderExampleCard(example))}
                </View>
              ) : (
                <Text style={[styles.emptyText, { color: mutedTextColor }]}>No example sentences available.</Text>
              )}
            </View>
          </ScrollView>
        </View>

        <View key="resources" style={styles.pageContainer}>
          <ScrollView
            style={styles.pageScroll}
            contentContainerStyle={[styles.pageScrollContent, { paddingBottom: insets.bottom + 28 }]}
          >
            {(englishGlosses.length > 0 || acceptedAnswers.length > 0) ? (
              <View
                style={[
                  styles.section,
                  resourcesFirstSection === "meanings" && styles.sectionNoTopSeparator,
                  { borderTopColor: panelBorder },
                ]}
              > 
                <Text style={[styles.sectionTitle, { color: theme.textColor }]}>Meanings</Text>

                {englishGlosses.length > 0 ? (
                  <View style={styles.wrapRow}>
                    {englishGlosses.map((gloss) => (
                      <View key={gloss} style={[styles.chip, { borderColor: panelBorder }]}> 
                        <Text style={[styles.chipText, { color: theme.textColor }]}>{gloss}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {acceptedAnswers.length > 0 ? (
                  <>
                    <Text style={[styles.inlineLabel, { color: mutedTextColor }]}>Accepted Answers</Text>
                    <View style={styles.wrapRow}>
                      {acceptedAnswers.map((answer) => (
                        <View key={answer} style={[styles.chip, { borderColor: panelBorder }]}> 
                          <Text style={[styles.chipText, { color: theme.textColor }]}>{answer}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                ) : null}
              </View>
            ) : null}

            {metadataTags.length > 0 ? (
              <View
                style={[
                  styles.section,
                  resourcesFirstSection === "metadata" && styles.sectionNoTopSeparator,
                  { borderTopColor: panelBorder },
                ]}
              > 
                <Text style={[styles.sectionTitle, { color: theme.textColor }]}>Metadata</Text>
                <View style={styles.wrapRow}>
                  {metadataTags.map((tag) => (
                    <View key={tag} style={[styles.tagChip, { borderColor: panelBorder }]}> 
                      <Text style={[styles.tagChipText, { color: mutedTextColor }]}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {discourseLink ? (
              <View
                style={[
                  styles.section,
                  resourcesFirstSection === "discussion" && styles.sectionNoTopSeparator,
                  { borderTopColor: panelBorder },
                ]}
              > 
                <Text style={[styles.sectionTitle, { color: theme.textColor }]}>Discussion</Text>
                <TouchableOpacity style={styles.discussionRow} onPress={openDiscourse}>
                  <Text style={[styles.discussionLink, { color: accent }]} numberOfLines={1}>
                    Open Bunpro Discussion
                  </Text>
                  <Ionicons name="chevron-forward" size={15} color={mutedTextColor} />
                </TouchableOpacity>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </PagerView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topPanel: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  topRow: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
  },
  topRowSpacer: {
    flex: 1,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  subjectBlock: {
    marginTop: 0,
    alignItems: "center",
    gap: 2,
  },
  kindOverline: {
    fontSize: 13,
    fontWeight: "500",
  },
  headerInfo: {
    fontSize: 14,
    fontWeight: "600",
  },
  subjectTitle: {
    marginTop: 4,
    fontSize: 34,
    fontWeight: "700",
    lineHeight: 40,
    textAlign: "center",
  },
  subjectReading: {
    fontSize: 17,
    fontWeight: "500",
    textAlign: "center",
  },
  subjectMeaning: {
    marginTop: 3,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "500",
    textAlign: "center",
  },
  warningText: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    textAlign: "center",
  },
  tabsRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  tabButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  tabButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  pager: {
    flex: 1,
  },
  pageContainer: {
    flex: 1,
  },
  pageScroll: {
    flex: 1,
  },
  pageScrollContent: {
    paddingHorizontal: 16,
  },
  section: {
    borderTopWidth: 1,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 10,
  },
  sectionNoTopSeparator: {
    borderTopWidth: 0,
    paddingTop: 10,
  },
  aboutContent: {
    gap: 4,
  },
  aboutExamplesBlock: {
    marginTop: -2,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
  },
  structureToggleRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 9,
    overflow: "hidden",
  },
  structureToggleButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  structureToggleText: {
    fontSize: 11,
    fontWeight: "700",
  },
  structureText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "500",
  },
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  detailField: {
    width: "47%",
    minWidth: 125,
    gap: 2,
  },
  detailFieldLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    fontWeight: "600",
  },
  detailFieldValue: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "500",
  },
  paragraphText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "500",
  },
  paragraphSubtle: {
    fontSize: 14,
    lineHeight: 20,
  },
  strikeText: {
    textDecorationLine: "line-through",
  },
  cautionBlock: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  cautionText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
  },
  playButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
  },
  playButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  examplesList: {
    gap: 10,
  },
  exampleCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  exampleJapanese: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "600",
  },
  exampleRubyReading: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "500",
  },
  rubyLine: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-end",
  },
  rubyContainer: {
    alignItems: "center",
    marginRight: 1,
  },
  rubyReading: {
    fontSize: 10,
    lineHeight: 12,
  },
  rubyBase: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "600",
  },
  exampleTranslation: {
    fontSize: 15,
    lineHeight: 22,
  },
  exampleFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  levelPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  levelPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  playButtonSmall: {
    borderWidth: 1,
    borderRadius: 999,
    height: 32,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  playButtonSmallText: {
    fontSize: 12,
    fontWeight: "700",
  },
  wrapRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "500",
  },
  inlineLabel: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.35,
  },
  tagChip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  tagChipText: {
    fontSize: 11,
    fontWeight: "500",
  },
  discussionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  discussionLink: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    marginRight: 8,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 26,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 14,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  gatedContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 8,
  },
  gatedTitle: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  gatedSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
});
