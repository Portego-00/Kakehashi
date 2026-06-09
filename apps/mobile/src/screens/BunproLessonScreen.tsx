import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import PagerView from "react-native-pager-view";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import BunproReviewScreen, { buildReviewQueue } from "./BunproReviewScreen";
import AudioSessionManager from "../modules/AudioSessionManager";
import type {
  BunproJsonApiResource,
  BunproLearnContentItem,
  BunproLearnReviewableTuple,
  BunproReviewQueueItem,
  BunproStudyQuestionAttributes,
} from "../types/bunpro";
import {
  BunproApiError,
  getBunproLearnIndex,
  getBunproLearnQuiz,
  getBunproQueue,
} from "../utils/bunproApi";
import { summarizeBunproQueue } from "../utils/bunproQueue";
import { Audio, type AudioSound } from "../utils/expoAvCompat";
import { isPortegoUsername } from "../utils/portegoAccess";
import { useAuthStore } from "../utils/store";
import { getBestContrastTextColor, withAlpha } from "../utils/subjectColors";
import { useTheme } from "../utils/theme";

type LessonPhase = "loading" | "details" | "quiz-loading" | "quiz" | "done" | "error";
type LessonKind = "grammar" | "vocab";
type StructureMode = "casual" | "polite";

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

type LessonExample = {
  id: string;
  japaneseHtml: string;
  translationHtml: string;
  level: string;
  order: number;
  femaleAudioUrl: string;
  maleAudioUrl: string;
};

type WriteupBlock =
  | {
      kind: "html";
      html: string;
    }
  | {
      kind: "examples";
      ids: string[];
    };

type ResolvedWriteupBlock =
  | {
      kind: "html";
      html: string;
    }
  | {
      kind: "examples";
      examples: LessonExample[];
    };

type LessonItem = {
  key: string;
  id: number;
  kind: LessonKind;
  typeSnake: "grammar_point" | "vocab";
  typePascal: "GrammarPoint" | "Vocab";
  title: string;
  reading: string;
  meaning: string;
  primaryGloss: string;
  level: string;
  lessonId: number | null;
  partOfSpeech: string;
  register: string;
  wordType: string;
  casualStructure: string;
  politeStructure: string;
  nuanceTranslation: string;
  nuanceJapanese: string;
  caution: string;
  rareKanjiWarning: string;
  discourseLink: string;
  acceptedAnswers: string[];
  englishGlosses: string[];
  metadataTags: string[];
  pronunciationAudioUrls: (string | null)[];
  aboutBlocks: ResolvedWriteupBlock[];
  examples: LessonExample[];
  tuple: BunproLearnReviewableTuple;
};

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

function readNumberParam(value: string | string[] | undefined): number | null {
  const decoded = decodeParam(value);
  const parsed = Number.parseInt(decoded, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
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

  return decodeHtmlEntities(stripRawTags(normalizeRuby(value)))
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeHtmlFragment(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

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
    .map((className) => className.trim().toLowerCase())
    .filter(Boolean);
}

function buildHtmlTextRuns(value: unknown): HtmlTextRun[] {
  if (typeof value !== "string" || value.trim().length === 0) {
    return [];
  }

  const source = normalizeRuby(value)
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/ul>/gi, "\n")
    .replace(/<ul[^>]*>/gi, "");

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

    const nextRun: HtmlTextRun = {
      text,
      strong: strongDepth > 0,
      strike: strikeDepth > 0,
      accent: accentDepth > 0 || strongDepth > 0,
    };
    const previousRun = runs[runs.length - 1];

    if (
      previousRun &&
      previousRun.strong === nextRun.strong &&
      previousRun.strike === nextRun.strike &&
      previousRun.accent === nextRun.accent
    ) {
      previousRun.text += nextRun.text;
      return;
    }

    runs.push(nextRun);
  };

  while ((match = tagPattern.exec(source)) !== null) {
    pushText(source.slice(cursor, match.index));

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
      const isAccentSpan = getTagClassNames(tag).some((className) =>
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

function splitStrongSegments(raw: string): { text: string; strong: boolean }[] {
  const source = normalizeRuby(raw);
  const strongPattern = /<strong[^>]*>([\s\S]*?)<\/strong>/gi;
  const segments: { text: string; strong: boolean }[] = [];
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
        runs.push({ kind: "ruby", base, reading, strong: segment.strong });
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

function formatBunproError(error: unknown): string {
  if (error instanceof BunproApiError) {
    return error.code ? `${error.message} (${error.code})` : error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Could not load Bunpro lessons.";
}

function formatLevel(rawValue: unknown): string {
  const normalized = cleanHtmlText(rawValue);
  const jlptMatch = normalized.match(/^JLPT\s*([1-5])$/i) ??
    normalized.match(/^JLPT([1-5])$/i);

  if (jlptMatch?.[1]) {
    return `N${jlptMatch[1]}`;
  }

  return normalized;
}

function getExampleReplacement(attributes: Record<string, unknown>, fallback: string): string {
  const kanjiAnswer = cleanHtmlText(attributes.kanji_answer);
  if (kanjiAnswer) {
    return kanjiAnswer;
  }

  const answer = cleanHtmlText(attributes.answer);
  if (answer) {
    return answer;
  }

  const prompt = cleanHtmlText(attributes.word_prompt);
  return prompt || fallback;
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
      const key = normalized.toLowerCase();
      if (!normalized || seen.has(key)) {
        return;
      }

      seen.add(key);
      glosses.push(normalized);
    });
  });

  return glosses;
}

function extractCommaList(value: unknown): string[] {
  if (typeof value !== "string") {
    return [];
  }

  const seen = new Set<string>();
  const entries: string[] = [];

  value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .forEach((entry) => {
      const key = entry.toLowerCase();
      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      entries.push(entry);
    });

  return entries;
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

function buildWriteupBlocks(value: unknown): WriteupBlock[] {
  if (typeof value !== "string" || value.trim().length === 0) {
    return [];
  }

  const listPattern =
    /<ul[^>]*class=['"][^'"]*writeup-examples--holder[^'"]*['"][^>]*>[\s\S]*?<\/ul>/gi;
  const blocks: WriteupBlock[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = listPattern.exec(value)) !== null) {
    const precedingHtml = value.slice(cursor, match.index);
    if (cleanHtmlText(precedingHtml).length > 0) {
      blocks.push({ kind: "html", html: precedingHtml.trim() });
    }

    const ids = extractWriteupExampleIds(match[0]);
    if (ids.length > 0) {
      blocks.push({ kind: "examples", ids });
    }

    cursor = listPattern.lastIndex;
  }

  const trailingHtml = value.slice(cursor);
  if (cleanHtmlText(trailingHtml).length > 0) {
    blocks.push({ kind: "html", html: trailingHtml.trim() });
  }

  return blocks;
}

function toExampleItem(
  resource: BunproJsonApiResource,
  fallback: string
): LessonExample | null {
  if (resource.type !== "study_question") {
    return null;
  }

  const attributes = resource.attributes as BunproStudyQuestionAttributes &
    Record<string, unknown>;
  const rawJapanese = typeof attributes.content === "string" ? attributes.content : "";
  const replacement = getExampleReplacement(attributes, fallback);
  const japaneseHtml = replacement
    ? rawJapanese.replace(/(?:_{2,}|＿{2,})/g, `<strong>${replacement}</strong>`)
    : rawJapanese;
  const order =
    typeof attributes.sentence_order === "number"
      ? attributes.sentence_order
      : Number.MAX_SAFE_INTEGER;

  if (sanitizeHtmlFragment(japaneseHtml).length === 0) {
    return null;
  }

  return {
    id: resource.id,
    japaneseHtml,
    translationHtml: typeof attributes.translation === "string" ? attributes.translation : "",
    level: formatLevel(attributes.level),
    order,
    femaleAudioUrl: typeof attributes.female_audio_url === "string" ? attributes.female_audio_url : "",
    maleAudioUrl: typeof attributes.male_audio_url === "string" ? attributes.male_audio_url : "",
  };
}

function buildExamples(
  included: BunproJsonApiResource[] | undefined,
  fallback: string
): LessonExample[] {
  return (included ?? [])
    .map((resource) => toExampleItem(resource, fallback))
    .filter((example): example is LessonExample => example !== null)
    .sort((left, right) => left.order - right.order);
}

function resolveAboutBlocks(
  included: BunproJsonApiResource[] | undefined,
  examples: LessonExample[]
): ResolvedWriteupBlock[] {
  const writeupResource = (included ?? []).find((resource) => resource.type === "writeup");
  const writeupAttributes = writeupResource?.attributes as Record<string, unknown> | undefined;
  const writeupBody = typeof writeupAttributes?.body === "string" ? writeupAttributes.body : "";
  const exampleById = new Map(examples.map((example) => [example.id, example]));

  return buildWriteupBlocks(writeupBody)
    .map((block) => {
      if (block.kind === "html") {
        return { kind: "html" as const, html: block.html };
      }

      const examplesForBlock = block.ids
        .map((id) => exampleById.get(id))
        .filter((example): example is LessonExample => Boolean(example));

      if (examplesForBlock.length === 0) {
        return null;
      }

      return { kind: "examples" as const, examples: examplesForBlock };
    })
    .filter((block): block is ResolvedWriteupBlock => block !== null);
}

function stripTrailingPeriod(value: string): string {
  return value.replace(/[.,;:]+$/, "").trim();
}

function readLessonId(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function inferLessonKind(item: BunproLearnContentItem): LessonKind {
  const attributes = item.data.attributes as Record<string, unknown>;
  const typeSnake = cleanHtmlText(attributes.type_snake || item.data.type);
  return typeSnake === "vocab" || item.data.type === "vocab" ? "vocab" : "grammar";
}

function readReviewableId(item: BunproLearnContentItem): number | null {
  const attributes = item.data.attributes as Record<string, unknown>;
  const attributeId = attributes.id;
  const parsedAttributeId = typeof attributeId === "number" ? attributeId : Number(attributeId);
  const parsedResourceId = Number(item.data.id);
  const id = Number.isFinite(parsedAttributeId) && parsedAttributeId > 0
    ? parsedAttributeId
    : parsedResourceId;

  return Number.isFinite(id) && id > 0 ? id : null;
}

function buildLessonItems(content: BunproLearnContentItem[], maxCount: number): LessonItem[] {
  const items = content
    .map((contentItem) => {
      const id = readReviewableId(contentItem);
      if (!id) {
        return null;
      }

      const attributes = contentItem.data.attributes as Record<string, unknown>;
      const kind = inferLessonKind(contentItem);
      const typeSnake = kind === "vocab" ? "vocab" : "grammar_point";
      const typePascal = kind === "vocab" ? "Vocab" : "GrammarPoint";
      const title = cleanHtmlText(attributes.title) || cleanHtmlText(attributes.slug) || `${typePascal} ${id}`;
      const meaning = sanitizeHtmlFragment(attributes.meaning);
      const reading = cleanHtmlText(attributes.furigana) || cleanHtmlText(attributes.kana);
      const level = kind === "vocab" ? formatLevel(attributes.jlpt_level) : formatLevel(attributes.level);
      const lessonId = readLessonId(attributes.lesson_id);
      const partOfSpeech = cleanHtmlText(attributes.part_of_speech_translation) || cleanHtmlText(attributes.part_of_speech);
      const register = cleanHtmlText(attributes.register_translation) || cleanHtmlText(attributes.register);
      const wordType = cleanHtmlText(attributes.word_type_translation) || cleanHtmlText(attributes.word_type);
      const casualStructure = typeof attributes.casual_structure === "string" ? attributes.casual_structure : "";
      const politeStructure = typeof attributes.polite_structure === "string" ? attributes.polite_structure : "";
      const nuanceTranslation = typeof attributes.nuance_translation === "string" ? attributes.nuance_translation : "";
      const nuanceJapanese = typeof attributes.nuance === "string" ? attributes.nuance : "";
      const caution = typeof attributes.caution === "string" ? attributes.caution : "";
      const rareKanjiWarning = cleanHtmlText(attributes.rare_kanji_warning);
      const discourseLink = typeof attributes.discourse_link === "string" ? attributes.discourse_link.trim() : "";
      const acceptedAnswers = extractCommaList(attributes.accepted_answers).slice(0, 20);
      const englishGlosses = getEnglishGlosses(attributes.jmdict_data).slice(0, 20);
      const metadataTags = extractCommaList(attributes.metadata).slice(0, 24);
      const pronunciationAudioUrls = [
        typeof attributes.female_audio_url === "string" ? attributes.female_audio_url : null,
        typeof attributes.male_audio_url === "string" ? attributes.male_audio_url : null,
      ];
      const examples = buildExamples(contentItem.included, title);
      const aboutBlocks = resolveAboutBlocks(contentItem.included, examples);
      const primaryGloss = stripTrailingPeriod(
        meaning || englishGlosses[0] || cleanHtmlText(attributes.meaning)
      );

      return {
        key: `${typeSnake}-${id}`,
        id,
        kind,
        typeSnake,
        typePascal,
        title,
        reading,
        meaning,
        primaryGloss,
        level,
        lessonId,
        partOfSpeech,
        register,
        wordType,
        casualStructure,
        politeStructure,
        nuanceTranslation,
        nuanceJapanese,
        caution,
        rareKanjiWarning,
        discourseLink,
        acceptedAnswers,
        englishGlosses,
        metadataTags,
        pronunciationAudioUrls,
        aboutBlocks,
        examples,
        tuple: [typePascal, id] as BunproLearnReviewableTuple,
      } satisfies LessonItem;
    })
    .filter((item): item is LessonItem => item !== null);

  return maxCount > 0 ? items.slice(0, maxCount) : items;
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
              <Text style={[styles.rubyBase, baseTextStyle, run.strong && strongBaseTextStyle]}>
                {run.base}
              </Text>
            </View>
          );
        }

        return (
          <Text key={key} style={[styles.rubyBase, baseTextStyle, run.strong && strongBaseTextStyle]}>
            {run.text}
          </Text>
        );
      })}
    </View>
  );
}

type DetailPillProps = {
  label: string;
  value: string;
  borderColor: string;
  color: string;
  mutedColor: string;
};

function DetailPill({ label, value, borderColor, color, mutedColor }: DetailPillProps) {
  if (!value) {
    return null;
  }

  return (
    <View style={[styles.detailPill, { borderColor }]}>
      <Text style={[styles.detailPillLabel, { color: mutedColor }]}>{label}</Text>
      <Text style={[styles.detailPillValue, { color }]}>{value}</Text>
    </View>
  );
}

export default function BunproLessonScreen() {
  const { theme, isDark } = useTheme();
  const { userData } = useAuthStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ deckId?: string }>();
  const requestedDeckId = readNumberParam(params.deckId);
  const isPortegoUser = isPortegoUsername(userData?.username);
  const lessonPagerRef = useRef<PagerView>(null);
  const activeSoundRef = useRef<AudioSound | null>(null);

  const [phase, setPhase] = useState<LessonPhase>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deckId, setDeckId] = useState<number | null>(requestedDeckId);
  const [deckTitle, setDeckTitle] = useState("Bunpro Lessons");
  const [lessonPool, setLessonPool] = useState<LessonItem[]>([]);
  const [lessonCursor, setLessonCursor] = useState(0);
  const [lessonBatchSize, setLessonBatchSize] = useState(0);
  const [batchItems, setBatchItems] = useState<LessonItem[]>([]);
  const [detailIndex, setDetailIndex] = useState(0);
  const [structureMode, setStructureMode] = useState<StructureMode>("casual");
  const [quizQueue, setQuizQueue] = useState<BunproReviewQueueItem[]>([]);
  const [reviewSessionId, setReviewSessionId] = useState<number | null>(null);
  const [completedBatchCount, setCompletedBatchCount] = useState(0);
  const [playingAudioKey, setPlayingAudioKey] = useState<string | null>(null);
  const [loadingAudioKey, setLoadingAudioKey] = useState<string | null>(null);
  const completedDeckIdsRef = useRef<number[]>([]);

  const accent = isDark ? "#db6466" : "#cc5b5d";
  const accentTextColor = getBestContrastTextColor(accent, "#17181d", "#ffffff");
  const mutedColor = isDark ? "#a8aeb9" : theme.textSecondary;
  const panelBorder = isDark ? "rgba(255,255,255,0.12)" : theme.border;
  const footerBackground = isDark ? "rgba(13,17,24,0.96)" : withAlpha(theme.backgroundColor, 0.96);

  const currentItem = batchItems[detailIndex] ?? null;
  const detailProgressLabel = batchItems.length > 0 ? `${detailIndex + 1}/${batchItems.length}` : "";
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });
  const stickyHeaderStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [80, 130, 180],
      [0, 0, 1],
      Extrapolation.CLAMP
    );
    const translateY = interpolate(
      scrollY.value,
      [80, 130],
      [-64, 0],
      Extrapolation.CLAMP
    );

    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  const stopActiveSound = useCallback(async () => {
    if (!activeSoundRef.current) {
      setPlayingAudioKey(null);
      return;
    }

    try {
      await activeSoundRef.current.unloadAsync();
    } catch {
      // noop
    } finally {
      activeSoundRef.current = null;
      setPlayingAudioKey(null);
      setLoadingAudioKey(null);
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
          console.warn("[BunproLesson] Failed to play audio", lastError);
        }
        return;
      }

      activeSoundRef.current = createdSound;
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

  const presentLessonBatch = useCallback(
    (pool: LessonItem[], cursor: number, requestedBatchSize: number) => {
      const remainingCount = Math.max(0, pool.length - cursor);
      const effectiveBatchSize =
        requestedBatchSize > 0 ? Math.min(requestedBatchSize, remainingCount) : remainingCount;
      const nextBatchItems = pool.slice(cursor, cursor + effectiveBatchSize);

      if (nextBatchItems.length === 0) {
        return false;
      }

      setLessonCursor(cursor);
      setBatchItems(nextBatchItems);
      setDetailIndex(0);
      setStructureMode("casual");
      scrollY.value = 0;
      setPhase("details");
      return true;
    },
    [scrollY]
  );

  const loadNextBatch = useCallback(
    async (preferredDeckId?: number | null, skippedDeckIds: number[] = []) => {
      if (!isPortegoUser) {
        return;
      }

      setPhase("loading");
      setErrorMessage(null);
      setQuizQueue([]);
      setReviewSessionId(null);

      try {
        const queueResponse = await getBunproQueue();
        const queueSummary = summarizeBunproQueue(queueResponse);
        const deckIdsToSkip = new Set([
          ...completedDeckIdsRef.current,
          ...skippedDeckIds,
        ]);
        const nextDeck = preferredDeckId
          ? queueSummary.queue.find((entry) => entry.deckId === preferredDeckId) ?? queueSummary.next
          : queueSummary.queue.find(
              (entry) =>
                entry.remaining > 0 &&
                !entry.isFinished &&
                (!entry.deckId || !deckIdsToSkip.has(entry.deckId))
            ) ?? null;
        const nextDeckId = nextDeck?.deckId ?? null;

        if (!nextDeckId || !nextDeck || nextDeck.remaining <= 0) {
          setLessonPool([]);
          setLessonCursor(0);
          setLessonBatchSize(0);
          setBatchItems([]);
          setDeckId(nextDeckId);
          setDeckTitle(nextDeck?.deckTitle ?? "Bunpro Lessons");
          setPhase("done");
          return;
        }

        const nextBatchSize = Math.min(
          nextDeck.remaining,
          nextDeck.batchSize > 0 ? nextDeck.batchSize : nextDeck.remaining
        );
        const learnResponse = await getBunproLearnIndex({ deckId: nextDeckId });
        const lessonItems = buildLessonItems(
          learnResponse.content ?? [],
          nextDeck.remaining
        );

        if (lessonItems.length === 0) {
          setLessonPool([]);
          setLessonCursor(0);
          setLessonBatchSize(0);
          setBatchItems([]);
          setDeckId(nextDeckId);
          setDeckTitle(nextDeck.deckTitle);
          setPhase("done");
          return;
        }

        setDeckId(nextDeckId);
        setDeckTitle(nextDeck.deckTitle);
        setLessonPool(lessonItems);
        setLessonBatchSize(nextBatchSize);
        presentLessonBatch(lessonItems, 0, nextBatchSize);
      } catch (error) {
        setErrorMessage(formatBunproError(error));
        setPhase("error");
      }
    },
    [isPortegoUser, presentLessonBatch]
  );

  useEffect(() => {
    if (!isPortegoUser) {
      setPhase("done");
      return;
    }

    void loadNextBatch(requestedDeckId);
  }, [isPortegoUser, loadNextBatch, requestedDeckId]);

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

  const startQuiz = useCallback(async () => {
    if (!deckId || batchItems.length === 0) {
      setPhase("done");
      return;
    }

    setPhase("quiz-loading");
    setErrorMessage(null);

    try {
      const response = await getBunproLearnQuiz({
        deckId,
        reviewables: batchItems.map((item) => item.tuple),
      });
      const nextQuizQueue = buildReviewQueue(response);

      if (nextQuizQueue.length === 0) {
        setPhase("done");
        return;
      }

      setQuizQueue(nextQuizQueue);
      setReviewSessionId(response.review_session_id ?? null);
      setPhase("quiz");
    } catch (error) {
      setErrorMessage(formatBunproError(error));
      setPhase("error");
    }
  }, [batchItems, deckId]);

  const handleNextDetail = useCallback(() => {
    if (detailIndex >= batchItems.length - 1) {
      void startQuiz();
      return;
    }

    const nextIndex = detailIndex + 1;
    setDetailIndex(nextIndex);
    setStructureMode("casual");
    scrollY.value = 0;
    lessonPagerRef.current?.setPage(nextIndex);
  }, [batchItems.length, detailIndex, scrollY, startQuiz]);

  const handleQuizComplete = useCallback(() => {
    setCompletedBatchCount((previousValue) => previousValue + 1);
    const nextCursor = lessonCursor + batchItems.length;

    if (nextCursor < lessonPool.length) {
      presentLessonBatch(lessonPool, nextCursor, lessonBatchSize);
      return;
    }

    const completedDeckId = deckId;
    if (completedDeckId) {
      completedDeckIdsRef.current = completedDeckIdsRef.current.includes(completedDeckId)
        ? completedDeckIdsRef.current
        : [...completedDeckIdsRef.current, completedDeckId];
    }

    void loadNextBatch(null, completedDeckId ? [completedDeckId] : []);
  }, [
    batchItems.length,
    deckId,
    lessonBatchSize,
    lessonCursor,
    lessonPool,
    loadNextBatch,
    presentLessonBatch,
  ]);

  const openDiscourse = useCallback(async (url: string) => {
    if (!url) {
      return;
    }

    try {
      await Linking.openURL(url);
    } catch {
      // noop
    }
  }, []);

  const renderExampleCard = useCallback(
    (example: LessonExample) => {
      const exampleAudioKey = `lesson-example-${example.id}`;
      const hasAudio =
        example.femaleAudioUrl.trim().length > 0 || example.maleAudioUrl.trim().length > 0;

      return (
        <View
          key={example.id}
          style={[
            styles.exampleCard,
            {
              backgroundColor: isDark ? "#171c24" : "#fbfaf7",
              borderColor: panelBorder,
            },
          ]}
        >
          <JapaneseFuriganaText
            value={example.japaneseHtml}
            baseTextStyle={[styles.exampleJapanese, { color: theme.textColor }]}
            readingTextStyle={[styles.exampleRubyReading, { color: mutedColor }]}
            strongBaseTextStyle={{ color: accent, fontWeight: "700" }}
            strongReadingTextStyle={{ color: accent, fontWeight: "600" }}
          />
          {example.translationHtml ? (
            <RichText
              value={example.translationHtml}
              textStyle={[styles.exampleTranslation, { color: mutedColor }]}
              strongTextStyle={{ color: accent, fontWeight: "700" }}
              accentTextStyle={{ color: accent }}
              strikeTextStyle={styles.strikeText}
            />
          ) : null}

          {(example.level || hasAudio) ? (
            <View style={styles.exampleFooterRow}>
              {example.level ? (
                <View style={[styles.levelPill, { borderColor: panelBorder }]}>
                  <Text style={[styles.levelPillText, { color: mutedColor }]}>
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
                    void playAudio(exampleAudioKey, [
                      example.femaleAudioUrl,
                      example.maleAudioUrl,
                    ]);
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
                  <Text style={[styles.playButtonSmallText, { color: theme.textColor }]}>
                    Play
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </View>
      );
    },
    [
      accent,
      isDark,
      loadingAudioKey,
      mutedColor,
      panelBorder,
      playAudio,
      playingAudioKey,
      theme.textColor,
    ]
  );

  if (!isPortegoUser) {
    return (
      <SafeAreaView style={[styles.centerContent, { backgroundColor: theme.backgroundColor }]}>
        <StatusBar style={theme.statusBarStyle} />
        <Ionicons name="lock-closed-outline" size={26} color={theme.textSecondary} />
        <Text style={[styles.centerTitle, { color: theme.textColor }]}>Bunpro Beta Is Portego-Only</Text>
        <Text style={[styles.centerSubtitle, { color: theme.textSecondary }]}>Lessons are currently enabled only for the Portego account.</Text>
      </SafeAreaView>
    );
  }

  if (phase === "quiz") {
    return (
      <BunproReviewScreen
        initialQueue={quizQueue}
        initialReviewSessionId={reviewSessionId}
        initialMode="all"
        submissionContext="learn"
        loadingLabel="Loading lesson review..."
        emptyTitle="Lesson review is empty"
        emptySubtitle="Bunpro did not return quiz questions for this batch."
        completeTitle="Lesson review complete"
        completeButtonLabel="Continue lessons"
        onBack={() => router.back()}
        onComplete={handleQuizComplete}
      />
    );
  }

  if (phase === "loading" || phase === "quiz-loading") {
    return (
      <SafeAreaView style={[styles.centerContent, { backgroundColor: theme.backgroundColor }]}>
        <StatusBar style={theme.statusBarStyle} />
        <ActivityIndicator size="large" color={accent} />
        <Text style={[styles.loadingText, { color: mutedColor }]}>
          {phase === "quiz-loading" ? "Preparing lesson review..." : "Loading Bunpro lessons..."}
        </Text>
      </SafeAreaView>
    );
  }

  if (phase === "error") {
    return (
      <SafeAreaView style={[styles.centerContent, { backgroundColor: theme.backgroundColor }]}>
        <StatusBar style={theme.statusBarStyle} />
        <Ionicons name="alert-circle-outline" size={34} color={theme.error} />
        <Text style={[styles.errorText, { color: theme.error }]}>{errorMessage}</Text>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: accent }]}
          onPress={() => {
            void loadNextBatch(deckId || requestedDeckId);
          }}
        >
          <Text style={[styles.primaryButtonText, { color: accentTextColor }]}>Try again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (phase === "done" || !currentItem) {
    return (
      <SafeAreaView style={[styles.centerContent, { backgroundColor: theme.backgroundColor }]}>
        <StatusBar style={theme.statusBarStyle} />
        <Ionicons name="checkmark-done-outline" size={34} color={accent} />
        <Text style={[styles.centerTitle, { color: theme.textColor }]}>Lessons complete</Text>
        <Text style={[styles.centerSubtitle, { color: mutedColor }]}>
          {completedBatchCount > 0
            ? "Nice work. You finished the available Bunpro lesson batches."
            : "No Bunpro lessons are currently queued for your daily goal."}
        </Text>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: accent }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.primaryButtonText, { color: accentTextColor }]}>Back to Bunpro</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const kindLabel = currentItem.kind === "vocab" ? "Vocabulary" : "Grammar";
  const isLastDetail = detailIndex >= batchItems.length - 1;
  const headerMutedTextColor = isDark ? mutedColor : "rgba(255,255,255,0.86)";
  const topPanelDividerColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.24)";
  const compactKindIcon = currentItem.kind === "vocab" ? "語" : "文";

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <StatusBar style={theme.statusBarStyle} />

      <PagerView
        ref={lessonPagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={(event) => {
          setDetailIndex(event.nativeEvent.position);
          setStructureMode("casual");
          scrollY.value = 0;
          void stopActiveSound();
        }}
        offscreenPageLimit={1}
      >
        {batchItems.map((lessonItem, pageIndex) => {
          const pageKindLabel = lessonItem.kind === "vocab" ? "Vocabulary" : "Grammar";
          const pageHeaderInfo =
            lessonItem.level && lessonItem.lessonId !== null
              ? `${lessonItem.level} Lesson ${lessonItem.lessonId}`
              : lessonItem.level || (lessonItem.lessonId !== null ? `Lesson ${lessonItem.lessonId}` : deckTitle);
          const hasStructureSection = Boolean(lessonItem.casualStructure || lessonItem.politeStructure);
          const hasBothStructures = Boolean(lessonItem.casualStructure && lessonItem.politeStructure);
          const activeStructure =
            structureMode === "polite"
              ? lessonItem.politeStructure || lessonItem.casualStructure
              : lessonItem.casualStructure || lessonItem.politeStructure;
          const hasAboutSection = lessonItem.kind !== "vocab" && lessonItem.aboutBlocks.length > 0;
          const hasMeaningsSection = lessonItem.englishGlosses.length > 0 || lessonItem.acceptedAnswers.length > 0;
          const hasMetadataSection = lessonItem.metadataTags.length > 0;
          const hasDiscussionSection = Boolean(lessonItem.discourseLink);
          const hasPronunciation = lessonItem.pronunciationAudioUrls.some(
            (url) => typeof url === "string" && url.trim().length > 0
          );

          return (
            <View key={lessonItem.key} style={styles.pageContainer}>
              <Animated.ScrollView
                style={styles.pageScroll}
                contentContainerStyle={{ paddingBottom: insets.bottom + 118 }}
                onScroll={pageIndex === detailIndex ? scrollHandler : undefined}
                scrollEventThrottle={16}
                indicatorStyle={isDark ? "white" : "black"}
              >
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
                  <View style={[styles.topRow, { top: insets.top + 8 }]}>
                    <TouchableOpacity style={styles.iconButton} onPress={() => router.back()} activeOpacity={0.78}>
                      <Ionicons name="arrow-back" size={24} color={theme.headerText} />
                    </TouchableOpacity>
                    <View style={styles.topRowSpacer} />
                    {lessonItem.discourseLink ? (
                      <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => {
                          void openDiscourse(lessonItem.discourseLink);
                        }}
                        activeOpacity={0.78}
                      >
                        <Ionicons name="open-outline" size={21} color={theme.headerText} />
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.iconButton} />
                    )}
                  </View>

                  <View style={styles.subjectBlock}>
                    <Text style={[styles.kindOverline, { color: headerMutedTextColor }]}>
                      {pageKindLabel} Lesson
                    </Text>
                    <Text style={[styles.headerInfo, { color: theme.headerText }]}>{pageHeaderInfo}</Text>
                    <Text style={[styles.subjectTitle, { color: accent }]}>{lessonItem.title}</Text>
                    {lessonItem.reading ? (
                      <Text style={[styles.subjectReading, { color: headerMutedTextColor }]}>
                        {lessonItem.reading}
                      </Text>
                    ) : null}
                    {lessonItem.primaryGloss ? (
                      <Text style={[styles.subjectMeaning, { color: theme.headerText }]} numberOfLines={2}>
                        {lessonItem.primaryGloss}
                      </Text>
                    ) : null}
                    {lessonItem.rareKanjiWarning ? (
                      <Text style={[styles.warningText, { color: isDark ? "#d5b26d" : "#9f6b00" }]}>
                        ⚠ {lessonItem.rareKanjiWarning}
                      </Text>
                    ) : null}
                  </View>

                </View>

                {hasStructureSection ? (
                  <View
                    style={[
                      styles.section,
                      styles.sectionNoTopSeparator,
                      { borderTopColor: panelBorder },
                    ]}
                  >
                    <View style={styles.sectionHeaderRow}>
                      <Text style={[styles.sectionTitle, { color: theme.textColor }]}>Structure</Text>
                      {hasBothStructures ? (
                        <View style={[styles.structureToggleRow, { borderColor: panelBorder }]}>
                          <TouchableOpacity
                            style={[
                              styles.structureToggleButton,
                              structureMode === "casual" && { backgroundColor: accent },
                            ]}
                            onPress={() => setStructureMode("casual")}
                          >
                            <Text
                              style={[
                                styles.structureToggleText,
                                { color: structureMode === "casual" ? accentTextColor : mutedColor },
                              ]}
                            >
                              Standard
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.structureToggleButton,
                              structureMode === "polite" && { backgroundColor: accent },
                            ]}
                            onPress={() => setStructureMode("polite")}
                          >
                            <Text
                              style={[
                                styles.structureToggleText,
                                { color: structureMode === "polite" ? accentTextColor : mutedColor },
                              ]}
                            >
                              Polite
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </View>
                    <RichText
                      value={activeStructure}
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
                    <DetailPill label="Type" value={pageKindLabel} borderColor={panelBorder} color={theme.textColor} mutedColor={mutedColor} />
                    <DetailPill label="Level" value={lessonItem.level} borderColor={panelBorder} color={theme.textColor} mutedColor={mutedColor} />
                    <DetailPill label="Lesson" value={lessonItem.lessonId !== null ? String(lessonItem.lessonId) : ""} borderColor={panelBorder} color={theme.textColor} mutedColor={mutedColor} />
                    <DetailPill label="Part Of Speech" value={lessonItem.partOfSpeech} borderColor={panelBorder} color={theme.textColor} mutedColor={mutedColor} />
                    <DetailPill label="Register" value={lessonItem.register} borderColor={panelBorder} color={theme.textColor} mutedColor={mutedColor} />
                    <DetailPill label="Word Type" value={lessonItem.wordType} borderColor={panelBorder} color={theme.textColor} mutedColor={mutedColor} />
                  </View>
                </View>

                {(lessonItem.nuanceTranslation || lessonItem.nuanceJapanese || lessonItem.caution) ? (
                  <View style={[styles.section, { borderTopColor: panelBorder }]}>
                    <Text style={[styles.sectionTitle, { color: theme.textColor }]}>Nuance</Text>
                    {lessonItem.nuanceTranslation ? (
                      <RichText
                        value={lessonItem.nuanceTranslation}
                        textStyle={[styles.paragraphText, { color: theme.textColor }]}
                        strongTextStyle={{ color: accent, fontWeight: "700" }}
                        accentTextStyle={{ color: accent }}
                        strikeTextStyle={styles.strikeText}
                      />
                    ) : null}
                    {lessonItem.nuanceJapanese ? (
                      <RichText
                        value={lessonItem.nuanceJapanese}
                        textStyle={[styles.paragraphSubtle, { color: mutedColor }]}
                        strongTextStyle={{ color: accent, fontWeight: "700" }}
                        accentTextStyle={{ color: accent }}
                        strikeTextStyle={styles.strikeText}
                      />
                    ) : null}
                    {lessonItem.caution ? (
                      <View style={styles.cautionBlock}>
                        <Text style={[styles.cautionText, { color: isDark ? "#d5b26d" : "#9f6b00" }]}>⚠</Text>
                        <RichText
                          value={lessonItem.caution}
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
                    <Text style={[styles.sectionTitle, { color: theme.textColor }]}>About {lessonItem.title}</Text>
                    <View style={styles.aboutContent}>
                      {lessonItem.aboutBlocks.map((block, blockIndex) =>
                        block.kind === "html" ? (
                          <RichText
                            key={`about-${lessonItem.key}-${blockIndex}`}
                            value={block.html}
                            textStyle={[styles.paragraphText, { color: theme.textColor }]}
                            strongTextStyle={{ color: accent, fontWeight: "700" }}
                            accentTextStyle={{ color: accent }}
                            strikeTextStyle={styles.strikeText}
                          />
                        ) : (
                          <View key={`examples-${lessonItem.key}-${blockIndex}`} style={styles.aboutExamplesBlock}>
                            <View style={styles.examplesList}>
                              {block.examples.map(renderExampleCard)}
                            </View>
                          </View>
                        )
                      )}
                    </View>
                  </View>
                ) : null}

                {hasPronunciation ? (
                  <View style={[styles.section, { borderTopColor: panelBorder }]}>
                    <Text style={[styles.sectionTitle, { color: theme.textColor }]}>Pronunciation</Text>
                    <TouchableOpacity
                      style={[styles.playButton, { borderColor: panelBorder }]}
                      activeOpacity={0.84}
                      onPress={() => {
                        void playAudio(`subject-${lessonItem.key}`, lessonItem.pronunciationAudioUrls);
                      }}
                    >
                      {loadingAudioKey === `subject-${lessonItem.key}` ? (
                        <ActivityIndicator color={accent} size="small" />
                      ) : (
                        <Ionicons
                          name={playingAudioKey === `subject-${lessonItem.key}` ? "pause" : "play"}
                          size={16}
                          color={accent}
                        />
                      )}
                      <Text style={[styles.playButtonText, { color: theme.textColor }]}>Play Subject Audio</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                <View style={[styles.section, { borderTopColor: panelBorder }]}>
                  <Text style={[styles.sectionTitle, { color: theme.textColor }]}>Examples</Text>
                  {lessonItem.examples.length > 0 ? (
                    <View style={styles.examplesList}>
                      {lessonItem.examples.map(renderExampleCard)}
                    </View>
                  ) : (
                    <Text style={[styles.emptyText, { color: mutedColor }]}>No example sentences available.</Text>
                  )}
                </View>

                {hasMeaningsSection ? (
                  <View style={[styles.section, { borderTopColor: panelBorder }]}>
                    <Text style={[styles.sectionTitle, { color: theme.textColor }]}>Meanings</Text>
                    {lessonItem.englishGlosses.length > 0 ? (
                      <View style={styles.wrapRow}>
                        {lessonItem.englishGlosses.map((gloss) => (
                          <View key={gloss} style={[styles.chip, { borderColor: panelBorder }]}>
                            <Text style={[styles.chipText, { color: theme.textColor }]}>{gloss}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                    {lessonItem.acceptedAnswers.length > 0 ? (
                      <>
                        <Text style={[styles.inlineLabel, { color: mutedColor }]}>Accepted Answers</Text>
                        <View style={styles.wrapRow}>
                          {lessonItem.acceptedAnswers.map((answer) => (
                            <View key={answer} style={[styles.chip, { borderColor: panelBorder }]}>
                              <Text style={[styles.chipText, { color: theme.textColor }]}>{answer}</Text>
                            </View>
                          ))}
                        </View>
                      </>
                    ) : null}
                  </View>
                ) : null}

                {hasMetadataSection ? (
                  <View style={[styles.section, { borderTopColor: panelBorder }]}>
                    <Text style={[styles.sectionTitle, { color: theme.textColor }]}>Metadata</Text>
                    <View style={styles.wrapRow}>
                      {lessonItem.metadataTags.map((tag) => (
                        <View key={tag} style={[styles.tagChip, { borderColor: panelBorder }]}>
                          <Text style={[styles.tagChipText, { color: mutedColor }]}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}

                {hasDiscussionSection ? (
                  <View style={[styles.section, { borderTopColor: panelBorder }]}>
                    <Text style={[styles.sectionTitle, { color: theme.textColor }]}>Discussion</Text>
                    <TouchableOpacity
                      style={styles.discussionRow}
                      onPress={() => {
                        void openDiscourse(lessonItem.discourseLink);
                      }}
                    >
                      <Text style={[styles.discussionLink, { color: accent }]} numberOfLines={1}>
                        Open Bunpro Discussion
                      </Text>
                      <Ionicons name="chevron-forward" size={15} color={mutedColor} />
                    </TouchableOpacity>
                  </View>
                ) : null}
              </Animated.ScrollView>
            </View>
          );
        })}
      </PagerView>

      <Animated.View
        style={[
          styles.compactStickyHeader,
          {
            backgroundColor: theme.headerBackground,
            paddingTop: insets.top + 8,
            height: insets.top + 68,
          },
          stickyHeaderStyle,
        ]}
        pointerEvents="box-none"
      >
        <TouchableOpacity style={styles.stickyBackButton} onPress={() => router.back()} activeOpacity={0.78}>
          <Ionicons name="arrow-back" size={24} color={theme.headerText} />
        </TouchableOpacity>
        <View style={styles.stickyContent}>
          <View style={[styles.stickyKindBox, { backgroundColor: accent }]}>
            <Text style={[styles.stickyKindText, { color: accentTextColor }]}>{compactKindIcon}</Text>
          </View>
          <View style={styles.stickyTextContainer}>
            <Text style={[styles.stickyTitle, { color: theme.headerText }]} numberOfLines={1}>
              {currentItem.title}
            </Text>
            {currentItem.primaryGloss ? (
              <Text style={[styles.stickyMeaning, { color: headerMutedTextColor }]} numberOfLines={1}>
                {currentItem.primaryGloss}
              </Text>
            ) : null}
          </View>
          <View style={styles.stickyLevelBadge}>
            <Text style={[styles.stickyLevelText, { color: theme.headerText }]}>
              {currentItem.level || kindLabel}
            </Text>
          </View>
        </View>
      </Animated.View>

      <View
        style={[
          styles.stickyFooter,
          {
            backgroundColor: footerBackground,
            borderTopColor: panelBorder,
            paddingBottom: insets.bottom + (Platform.OS === "ios" ? 8 : 12),
          },
        ]}
      >
        <View style={styles.footerMetaRow}>
          <Text style={[styles.footerMetaText, { color: mutedColor }]}>Batch {completedBatchCount + 1}</Text>
          <Text style={[styles.footerMetaText, { color: mutedColor }]}>Swipe lessons · {detailProgressLabel}</Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.86}
          style={[styles.nextButton, { backgroundColor: accent }]}
          onPress={handleNextDetail}
        >
          <Text style={[styles.nextButtonText, { color: accentTextColor }]}>
            {isLastDetail ? "Start Review" : "Next"}
          </Text>
          <Ionicons name="arrow-forward" size={20} color={accentTextColor} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  centerTitle: {
    marginTop: 12,
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  centerSubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
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
  primaryButton: {
    marginTop: 18,
    borderRadius: 14,
    minHeight: 44,
    minWidth: 160,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "700",
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
  compactStickyHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    shadowColor: "rgba(0,0,0,0.3)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  stickyBackButton: {
    padding: 8,
    marginRight: 8,
  },
  stickyContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  stickyKindBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  stickyKindText: {
    fontSize: 18,
    fontWeight: "800",
  },
  stickyTextContainer: {
    flex: 1,
    justifyContent: "center",
  },
  stickyTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  stickyMeaning: {
    marginTop: 1,
    fontSize: 12,
    fontWeight: "500",
  },
  stickyLevelBadge: {
    minWidth: 36,
    height: 32,
    borderRadius: 8,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  stickyLevelText: {
    fontSize: 12,
    fontWeight: "800",
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  subjectBlock: {
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
  pager: {
    flex: 1,
  },
  pageContainer: {
    flex: 1,
  },
  pageScroll: {
    flex: 1,
  },
  detailPill: {
    width: "47%",
    minWidth: 125,
    gap: 2,
  },
  detailPillLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  detailPillValue: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "500",
  },
  section: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 10,
  },
  sectionNoTopSeparator: {
    borderTopWidth: 0,
    paddingTop: 10,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  aboutContent: {
    gap: 4,
  },
  aboutExamplesBlock: {
    marginTop: -2,
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
  stickyFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  footerMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerMetaText: {
    fontSize: 12,
    fontWeight: "700",
  },
  nextButton: {
    minHeight: 50,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: "800",
  },
});
