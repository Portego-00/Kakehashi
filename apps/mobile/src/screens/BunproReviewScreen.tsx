import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { KanaInputHandle } from "../components/TextToKanaInput";
import KanaInput from "../components/TextToKanaInput";
import type {
  BunproJsonApiResource,
  BunproReviewOnlyFilter,
  BunproReviewQueueItem,
  BunproStudyQuestionAttributes,
} from "../types/bunpro";
import { BunproApiError, getBunproReviewQuizIndex, updateBunproReview } from "../utils/bunproApi";
import { Audio, type AudioSound } from "../utils/expoAvCompat";
import { isPortegoUsername } from "../utils/portegoAccess";
import { useAuthStore } from "../utils/store";
import { useTheme } from "../utils/theme";
import * as wanakana from "wanakana";

export type BunproReviewMode = "all" | "grammar" | "vocab";

export type BunproReviewCompletionSummary = {
  correctCount: number;
  incorrectCount: number;
  totalItems: number;
};

type BunproReviewScreenProps = {
  initialQueue?: BunproReviewQueueItem[] | null;
  initialReviewSessionId?: number | null;
  initialMode?: BunproReviewMode;
  submissionContext?: "review" | "learn";
  loadingLabel?: string;
  emptyTitle?: string;
  emptySubtitle?: string;
  completeTitle?: string;
  completeButtonLabel?: string;
  onBack?: () => void;
  onComplete?: (summary: BunproReviewCompletionSummary) => void;
};

type StrongRun = {
  text: string;
  strong: boolean;
};

type ParsedQuestionSentence = {
  beforeBlank: string;
  afterBlank: string;
  hasBlank: boolean;
};

type PendingOutcome = {
  correct: boolean;
  enteredText: string;
  stageLabel: string;
};

type ReviewFeedback = {
  kind: "warning" | "error";
  message: string;
};

type BunproReviewResultItem = {
  reviewId: string;
  reviewableKind: "grammar" | "vocab";
  reviewableSlug: string;
  reviewableTitle: string;
  reviewableMeaning: string;
  reviewableLevel: string;
  question: string;
  translation: string;
  tenseHint: string;
  enteredAnswer: string;
  correctAnswer: string;
  wasCorrect: boolean;
  stageLabel: string;
};

type FuriganaRun =
  | {
      kind: "text";
      text: string;
    }
  | {
      kind: "ruby";
      base: string;
      reading: string;
    };

const trailingKanaRunPattern = /[\u3040-\u309F\u30A0-\u30FFー]+$/;
const leadingKanaRunPattern = /^[\u3040-\u309F\u30A0-\u30FFー]+/;
const kanjiLikeCharacterPattern = /[\u3400-\u4DBF\u4E00-\u9FFF々〆ヵヶ]/;

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

function resolveReviewMode(rawValue: string): BunproReviewMode {
  if (rawValue === "grammar") {
    return "grammar";
  }
  if (rawValue === "vocab") {
    return "vocab";
  }
  return "all";
}

function toOnlyReviewFilter(mode: BunproReviewMode): BunproReviewOnlyFilter | undefined {
  if (mode === "grammar") {
    return "GrammarPoint";
  }
  if (mode === "vocab") {
    return "Vocab";
  }
  return undefined;
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

function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]*>/g, "");
}

function sanitizeQuestionContent(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "";
  }

  return decodeHtmlEntities(
    stripHtmlTags(
      value
        .replace(/\[\[[\s\S]*?\]\]/g, "")
        .replace(/<br\s*\/?\s*>/gi, "\n")
    )
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function sanitizeText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return decodeHtmlEntities(stripHtmlTags(value)).replace(/\s+/g, " ").trim();
}

function hasKanji(value: string): boolean {
  return /[\u3400-\u4DBF\u4E00-\u9FFF々〆ヵヶ]/.test(value);
}

function normalizeKanaForRuby(value: string): string {
  return wanakana
    .toHiragana(value, { IMEMode: false })
    .replace(/\s+/g, "");
}

function findFirstKanjiLikeIndex(value: string): number {
  for (let index = 0; index < value.length; index += 1) {
    if (kanjiLikeCharacterPattern.test(value[index] ?? "")) {
      return index;
    }
  }
  return -1;
}

function findLastKanjiLikeEndIndex(value: string): number {
  for (let index = value.length - 1; index >= 0; index -= 1) {
    if (kanjiLikeCharacterPattern.test(value[index] ?? "")) {
      return index + 1;
    }
  }
  return -1;
}

function splitFuriganaBase(
  base: string,
  reading: string
): { prefix: string; rubyBase: string; suffix: string } | null {
  const firstKanjiIndex = findFirstKanjiLikeIndex(base);
  const lastKanjiEndIndex = findLastKanjiLikeEndIndex(base);

  if (firstKanjiIndex < 0 || lastKanjiEndIndex <= firstKanjiIndex) {
    return null;
  }

  const normalizedReading = normalizeKanaForRuby(reading);
  const leadingText = base.slice(0, firstKanjiIndex);
  const leadingKana = leadingText.match(trailingKanaRunPattern)?.[0] ?? "";
  const leadingKanaStart = leadingText.length - leadingKana.length;
  const shouldKeepLeadingKana =
    leadingKana.length > 0 &&
    normalizedReading.startsWith(normalizeKanaForRuby(leadingKana));
  const rubyStart = shouldKeepLeadingKana ? leadingKanaStart : firstKanjiIndex;

  const trailingText = base.slice(lastKanjiEndIndex);
  const trailingKana = trailingText.match(leadingKanaRunPattern)?.[0] ?? "";
  const shouldKeepTrailingKana =
    trailingKana.length > 0 &&
    normalizedReading.endsWith(normalizeKanaForRuby(trailingKana));
  const rubyEnd = shouldKeepTrailingKana
    ? lastKanjiEndIndex + trailingKana.length
    : lastKanjiEndIndex;

  return {
    prefix: base.slice(0, rubyStart),
    rubyBase: base.slice(rubyStart, rubyEnd),
    suffix: base.slice(rubyEnd),
  };
}

function appendFuriganaTextRun(runs: FuriganaRun[], text: string) {
  if (!text) {
    return;
  }

  const previousRun = runs[runs.length - 1];
  if (previousRun?.kind === "text") {
    previousRun.text += text;
    return;
  }

  runs.push({ kind: "text", text });
}

function parseQuestionSentence(value: string): ParsedQuestionSentence {
  const blankMatch = value.match(/(?:_{2,}|＿{2,})/);
  if (!blankMatch || blankMatch.index === undefined) {
    return {
      beforeBlank: value,
      afterBlank: "",
      hasBlank: false,
    };
  }

  const beforeBlank = value.slice(0, blankMatch.index);
  const afterBlank = value.slice(blankMatch.index + blankMatch[0].length);

  return {
    beforeBlank,
    afterBlank,
    hasBlank: true,
  };
}

export function parseFuriganaRuns(raw: string): FuriganaRun[] {
  if (!raw) {
    return [];
  }

  const source = raw.replace(/\s+/g, " ");
  const runs: FuriganaRun[] = [];
  const furiganaPattern = /([^\s（）()]+)(?:（([^）]+)）|\(([^)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = furiganaPattern.exec(source)) !== null) {
    const [full, base, fullWidthReading, asciiReading] = match;
    const reading = (fullWidthReading || asciiReading || "").trim();
    const prefix = source.slice(lastIndex, match.index);

    if (prefix.length > 0) {
      appendFuriganaTextRun(runs, prefix);
    }

    if (base && reading && hasKanji(base)) {
      const splitBase = splitFuriganaBase(base, reading);

      if (!splitBase) {
        appendFuriganaTextRun(runs, full);
        lastIndex = match.index + full.length;
        continue;
      }

      appendFuriganaTextRun(runs, splitBase.prefix);
      runs.push({
        kind: "ruby",
        base: splitBase.rubyBase,
        reading,
      });
      appendFuriganaTextRun(runs, splitBase.suffix);
    } else {
      appendFuriganaTextRun(runs, full);
    }

    lastIndex = match.index + full.length;
  }

  const tail = source.slice(lastIndex);
  if (tail.length > 0) {
    appendFuriganaTextRun(runs, tail);
  }

  return runs;
}

function formatBunproError(error: unknown): string {
  if (error instanceof BunproApiError) {
    return error.code ? `${error.message} (${error.code})` : error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Could not load Bunpro reviews.";
}

function normalizeAnswer(value: string): string {
  const cleaned = decodeHtmlEntities(value).replace(/\s+/g, "").trim();
  if (!cleaned) {
    return "";
  }

  return wanakana
    .toHiragana(cleaned, { IMEMode: false })
    .toLowerCase()
    .replace(/[。．\.,、!！?？]/g, "")
    .trim();
}

function collectAcceptedAnswers(attributes: Record<string, unknown>): string[] {
  const values = new Set<string>();

  const pushValue = (candidate: unknown) => {
    if (typeof candidate !== "string") {
      return;
    }
    const normalized = normalizeAnswer(candidate);
    if (normalized.length > 0) {
      values.add(normalized);
    }
  };

  pushValue(attributes.answer);
  pushValue(attributes.kanji_answer);

  const alternateGrammar = attributes.alternate_grammar;
  if (Array.isArray(alternateGrammar)) {
    alternateGrammar.forEach((entry) => pushValue(entry));
  }

  const kanjiAltGrammar = attributes.kanji_alt_grammar;
  if (Array.isArray(kanjiAltGrammar)) {
    kanjiAltGrammar.forEach((entry) => pushValue(entry));
  }

  return Array.from(values);
}

function pickCanonicalAnswer(attributes: Record<string, unknown>): string {
  const candidates: unknown[] = [
    attributes.kanji_answer,
    attributes.answer,
  ];

  const alternateGrammar = attributes.alternate_grammar;
  if (Array.isArray(alternateGrammar)) {
    candidates.push(...alternateGrammar);
  }

  const kanjiAltGrammar = attributes.kanji_alt_grammar;
  if (Array.isArray(kanjiAltGrammar)) {
    candidates.push(...kanjiAltGrammar);
  }

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return sanitizeText(candidate);
    }
  }

  return "";
}

function extractAlternativeAnswers(
  attributes: Record<string, unknown>,
  canonicalAnswer: string
): string[] {
  const values = new Set<string>();
  const canonicalKey = canonicalAnswer.toLowerCase().trim();

  const pushCandidate = (candidate: unknown) => {
    if (typeof candidate !== "string") {
      return;
    }

    const cleaned = sanitizeText(candidate);
    if (!cleaned) {
      return;
    }

    const key = cleaned.toLowerCase();
    if (key === canonicalKey) {
      return;
    }

    values.add(cleaned);
  };

  const alternateGrammar = attributes.alternate_grammar;
  if (Array.isArray(alternateGrammar)) {
    alternateGrammar.forEach((entry) => pushCandidate(entry));
  }

  const kanjiAltGrammar = attributes.kanji_alt_grammar;
  if (Array.isArray(kanjiAltGrammar)) {
    kanjiAltGrammar.forEach((entry) => pushCandidate(entry));
  }

  return Array.from(values);
}

function pickFeedbackMessage(value: unknown): string {
  if (typeof value === "string") {
    return sanitizeText(value);
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  const feedbackByLocale = value as Record<string, unknown>;
  const preferredKeys = ["en", "ja", "es", "fr", "id"];
  for (const key of preferredKeys) {
    const candidate = feedbackByLocale[key];
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return sanitizeText(candidate);
    }
  }

  for (const candidate of Object.values(feedbackByLocale)) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return sanitizeText(candidate);
    }
  }

  return "";
}

function buildAnswerFeedbackMap(value: unknown): Map<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return new Map();
  }

  const feedbackMap = new Map<string, string>();
  for (const [rawAnswer, rawMessage] of Object.entries(value as Record<string, unknown>)) {
    const normalizedAnswer = normalizeAnswer(rawAnswer);
    const feedbackMessage = pickFeedbackMessage(rawMessage);

    if (!normalizedAnswer || !feedbackMessage) {
      continue;
    }

    feedbackMap.set(normalizedAnswer, feedbackMessage);
  }

  return feedbackMap;
}

function mapBunproStageNumber(stage: number): string {
  const labels = [
    "Beginner 1",
    "Beginner 2",
    "Beginner 3",
    "Adept 1",
    "Adept 2",
    "Seasoned 1",
    "Seasoned 2",
    "Expert 1",
    "Expert 2",
    "Master",
  ];

  if (stage >= 1 && stage <= labels.length) {
    return labels[stage - 1] ?? `Stage ${stage}`;
  }

  return `Stage ${stage}`;
}

function tryReadStringKey(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return "";
}

function tryReadNumberKey(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function extractStageLabelFromSubmission(
  response: Record<string, unknown> | null,
  reviewAttributes: Record<string, unknown> | null
): string {
  const stringKeyCandidates = [
    "new_srs_stage_name",
    "srs_stage_name",
    "next_srs_stage_name",
    "new_stage_name",
    "stage_name",
    "new_level_name",
    "level_name",
  ];

  const numberKeyCandidates = [
    "new_srs_stage",
    "srs_stage",
    "next_srs_stage",
    "new_stage",
    "stage",
    "new_level",
    "level",
    "streak",
  ];

  const sources: Record<string, unknown>[] = [];
  if (response) {
    sources.push(response);
    const responseData = response.data;
    if (responseData && typeof responseData === "object") {
      sources.push(responseData as Record<string, unknown>);
      const attributes = (responseData as { attributes?: unknown }).attributes;
      if (attributes && typeof attributes === "object") {
        sources.push(attributes as Record<string, unknown>);
      }
    }
  }
  if (reviewAttributes) {
    sources.push(reviewAttributes);
  }

  for (const source of sources) {
    const directLabel = tryReadStringKey(source, stringKeyCandidates);
    if (directLabel) {
      return directLabel;
    }
  }

  for (const source of sources) {
    const stageNumber = tryReadNumberKey(source, numberKeyCandidates);
    if (stageNumber !== null) {
      return mapBunproStageNumber(stageNumber);
    }
  }

  return "";
}

function buildStrongRuns(value: string): StrongRun[] {
  if (!value.trim()) {
    return [];
  }

  const source = value.replace(/<br\s*\/?\s*>/gi, "\n");
  const runs: StrongRun[] = [];
  const strongPattern = /<strong[^>]*>([\s\S]*?)<\/strong>/gi;

  let cursor = 0;
  let match: RegExpExecArray | null;

  const pushRun = (text: string, strong: boolean) => {
    const cleanedText = decodeHtmlEntities(stripHtmlTags(text));
    if (!cleanedText) {
      return;
    }

    const previous = runs[runs.length - 1];
    if (previous && previous.strong === strong) {
      previous.text += cleanedText;
      return;
    }

    runs.push({ text: cleanedText, strong });
  };

  while ((match = strongPattern.exec(source)) !== null) {
    const plainText = source.slice(cursor, match.index);
    pushRun(plainText, false);
    pushRun(match[1], true);
    cursor = strongPattern.lastIndex;
  }

  pushRun(source.slice(cursor), false);
  return runs;
}

function getIncludedResource(
  included: BunproJsonApiResource[] | undefined,
  id: string | undefined,
  type: string
): BunproJsonApiResource | null {
  if (!included || !id) {
    return null;
  }

  return included.find((resource) => resource.id === id && resource.type === type) ?? null;
}

function getModeLabel(mode: BunproReviewMode): string {
  if (mode === "grammar") {
    return "Grammar";
  }
  if (mode === "vocab") {
    return "Vocab";
  }
  return "Grammar & Vocab";
}

export function buildReviewQueue(response: {
  pending_wrapup?: BunproReviewQueueItem[];
  pending_attempt?: BunproReviewQueueItem[];
}): BunproReviewQueueItem[] {
  const seenReviewIds = new Set<string>();
  const mergedQueue: BunproReviewQueueItem[] = [];
  const queueBuckets = [
    ...(response.pending_wrapup ?? []),
    ...(response.pending_attempt ?? []),
  ];

  queueBuckets.forEach((item) => {
    const reviewId = item.data?.id ? String(item.data.id) : "";
    if (reviewId && seenReviewIds.has(reviewId)) {
      return;
    }

    if (reviewId) {
      seenReviewIds.add(reviewId);
    }
    mergedQueue.push(item);
  });

  return mergedQueue;
}

function mergeReviewQueueItems(
  existingQueue: BunproReviewQueueItem[],
  nextItems: BunproReviewQueueItem[]
): BunproReviewQueueItem[] {
  if (nextItems.length === 0) {
    return existingQueue;
  }

  const seenReviewIds = new Set(
    existingQueue
      .map((item) => (item.data?.id ? String(item.data.id) : ""))
      .filter(Boolean)
  );
  const mergedQueue = [...existingQueue];

  nextItems.forEach((item) => {
    const reviewId = item.data?.id ? String(item.data.id) : "";
    if (reviewId && seenReviewIds.has(reviewId)) {
      return;
    }

    if (reviewId) {
      seenReviewIds.add(reviewId);
    }
    mergedQueue.push(item);
  });

  return mergedQueue;
}

function readPendingTotal(response: {
  total_pending_attempt_count?: number | null;
  total_pending_wrapup_count?: number | null;
}): number {
  const attempts =
    typeof response.total_pending_attempt_count === "number"
      ? response.total_pending_attempt_count
      : 0;
  const wrapup =
    typeof response.total_pending_wrapup_count === "number"
      ? response.total_pending_wrapup_count
      : 0;

  return Math.max(0, attempts + wrapup);
}

type RubyTextProps = {
  runs: FuriganaRun[];
  baseTextStyle: any;
  readingTextStyle: any;
};

function RubyText({ runs, baseTextStyle, readingTextStyle }: RubyTextProps) {
  if (runs.length === 0) {
    return null;
  }

  return (
    <>
      {runs.map((run, index) => {
        const key = `${run.kind}-${index}`;
        if (run.kind === "ruby") {
          return (
            <View key={key} style={styles.rubyContainer}>
              <Text style={[styles.rubyReading, readingTextStyle]}>{run.reading}</Text>
              <Text style={[styles.rubyBase, baseTextStyle]}>{run.base}</Text>
            </View>
          );
        }

        return (
          <Text key={key} style={[styles.rubyBase, baseTextStyle]}>
            {run.text}
          </Text>
        );
      })}
    </>
  );
}

function getAccuracyColor(accuracyPercent: number, errorColor: string): string {
  if (accuracyPercent >= 85) {
    return "#8acb88";
  }
  if (accuracyPercent >= 65) {
    return "#c89a3c";
  }
  return errorColor;
}

function BunproResultQuestion({
  result,
  color,
  mutedColor,
}: {
  result: BunproReviewResultItem;
  color: string;
  mutedColor: string;
}) {
  const parsedQuestion = parseQuestionSentence(result.question);
  const answerText = result.wasCorrect
    ? result.enteredAnswer
    : result.correctAnswer || result.enteredAnswer;

  return (
    <Text style={[styles.resultQuestionText, { color }]}>
      {parsedQuestion.beforeBlank}
      {parsedQuestion.hasBlank ? (
        <Text style={{ color: result.wasCorrect ? "#8acb88" : "#db6466", fontWeight: "800" }}>
          {answerText || "____"}
        </Text>
      ) : null}
      {parsedQuestion.afterBlank}
      {!parsedQuestion.hasBlank && result.question.length === 0 ? (
        <Text style={{ color: mutedColor }}>No prompt available</Text>
      ) : null}
    </Text>
  );
}

function BunproResultCard({
  result,
  index,
  theme,
  mutedColor,
  panelBorder,
  accent,
  onOpenReviewable,
}: {
  result: BunproReviewResultItem;
  index: number;
  theme: any;
  mutedColor: string;
  panelBorder: string;
  accent: string;
  onOpenReviewable: (kind: "grammar" | "vocab", slug: string) => void;
}) {
  const resultColor = result.wasCorrect ? "#8acb88" : theme.error;
  const kindLabel = result.reviewableKind === "grammar" ? "Grammar" : "Vocab";

  return (
    <View
      style={[
        styles.resultCard,
        {
          backgroundColor: theme.cardBackground,
          borderColor: panelBorder,
        },
      ]}
    >
      <View style={styles.resultCardHeader}>
        <View style={styles.resultTitleGroup}>
          <Text style={[styles.resultIndexText, { color: mutedColor }]}>
            #{index + 1}
          </Text>
          <View style={[styles.resultKindPill, { backgroundColor: accent }]}>
            <Text style={styles.resultKindPillText}>{kindLabel}</Text>
          </View>
          {result.reviewableLevel ? (
            <Text style={[styles.resultLevelText, { color: mutedColor }]}>
              {result.reviewableLevel}
            </Text>
          ) : null}
        </View>
        <Ionicons
          name={result.wasCorrect ? "checkmark-circle" : "close-circle"}
          size={24}
          color={resultColor}
        />
      </View>

      <TouchableOpacity
        activeOpacity={result.reviewableSlug ? 0.75 : 1}
        disabled={!result.reviewableSlug}
        onPress={() => onOpenReviewable(result.reviewableKind, result.reviewableSlug)}
        style={styles.resultSubjectButton}
      >
        <View style={styles.resultSubjectTextGroup}>
          <Text style={[styles.resultSubjectTitle, { color: theme.textColor }]}>
            {result.reviewableTitle || kindLabel}
          </Text>
          {result.reviewableMeaning ? (
            <Text style={[styles.resultSubjectMeaning, { color: mutedColor }]}>
              {result.reviewableMeaning}
            </Text>
          ) : null}
        </View>
        {result.reviewableSlug ? (
          <Ionicons name="chevron-forward" size={16} color={mutedColor} />
        ) : null}
      </TouchableOpacity>

      <View
        style={[
          styles.resultPromptBox,
          {
            backgroundColor: theme.isDark
              ? "rgba(255,255,255,0.05)"
              : "rgba(0,0,0,0.035)",
          },
        ]}
      >
        {result.tenseHint ? (
          <Text style={[styles.resultTenseText, { color: mutedColor }]}>
            {result.tenseHint}
          </Text>
        ) : null}
        <BunproResultQuestion
          result={result}
          color={theme.textColor}
          mutedColor={mutedColor}
        />
        {result.translation ? (
          <Text style={[styles.resultTranslationText, { color: mutedColor }]}>
            {result.translation}
          </Text>
        ) : null}
      </View>

      <View style={styles.resultAnswersRow}>
        <View style={styles.resultAnswerColumn}>
          <Text style={[styles.resultAnswerLabel, { color: mutedColor }]}>
            Your answer
          </Text>
          <Text style={[styles.resultAnswerValue, { color: resultColor }]}>
            {result.enteredAnswer || "—"}
          </Text>
        </View>
        {!result.wasCorrect ? (
          <View style={styles.resultAnswerColumn}>
            <Text style={[styles.resultAnswerLabel, { color: mutedColor }]}>
              Expected
            </Text>
            <Text style={[styles.resultAnswerValue, { color: "#8acb88" }]}>
              {result.correctAnswer || "—"}
            </Text>
          </View>
        ) : null}
      </View>

      {result.stageLabel ? (
        <View style={styles.resultStageRow}>
          <Ionicons
            name={result.wasCorrect ? "arrow-up" : "arrow-down"}
            size={14}
            color={resultColor}
          />
          <Text style={[styles.resultStageText, { color: resultColor }]}>
            {result.stageLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function BunproResultsScreen({
  theme,
  isDark,
  modeLabel,
  results,
  correctCount,
  incorrectCount,
  totalItems,
  completeTitle,
  completeButtonLabel,
  accent,
  mutedColor,
  panelBorder,
  backgroundColor,
  onBack,
  onDone,
  onOpenReviewable,
}: {
  theme: any;
  isDark: boolean;
  modeLabel: string;
  results: BunproReviewResultItem[];
  correctCount: number;
  incorrectCount: number;
  totalItems: number;
  completeTitle: string;
  completeButtonLabel: string;
  accent: string;
  mutedColor: string;
  panelBorder: string;
  backgroundColor: string;
  onBack: () => void;
  onDone: () => void;
  onOpenReviewable: (kind: "grammar" | "vocab", slug: string) => void;
}) {
  const scoredTotal = Math.max(1, correctCount + incorrectCount);
  const accuracyPercent = Math.round((correctCount / scoredTotal) * 100);
  const scoreColor = getAccuracyColor(accuracyPercent, theme.error);
  const missedResults = results.filter((result) => !result.wasCorrect);
  const displayedResults = missedResults.length > 0 ? missedResults : results.slice(0, 10);
  const detailTitle = missedResults.length > 0 ? "Needs Review" : "Clean Sweep";
  const detailSubtitle =
    missedResults.length > 0
      ? `${missedResults.length} item${missedResults.length === 1 ? "" : "s"} marked incorrect.`
      : results.length > 0
        ? "No missed items this session."
        : "No scored review details were captured.";

  return (
    <SafeAreaView style={[styles.resultsContainer, { backgroundColor }]}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <View style={[styles.resultsHeader, { borderBottomColor: panelBorder }]}>
        <TouchableOpacity onPress={onBack} style={styles.resultsHeaderButton}>
          <Ionicons name="arrow-back-outline" size={24} color={theme.textColor} />
        </TouchableOpacity>
        <Text style={[styles.resultsHeaderTitle, { color: theme.textColor }]}>
          Bunpro Results
        </Text>
        <View style={styles.resultsHeaderButton} />
      </View>

      <ScrollView
        style={styles.resultsScroll}
        contentContainerStyle={styles.resultsScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.resultsHeroCard,
            {
              backgroundColor: theme.cardBackground,
              borderColor: panelBorder,
            },
          ]}
        >
          <View style={styles.resultsScoreColumn}>
            <View style={[styles.resultsScoreRing, { borderColor: scoreColor }]}>
              <Text style={[styles.resultsScoreText, { color: scoreColor }]}>
                {accuracyPercent}%
              </Text>
            </View>
            <Text style={[styles.resultsScoreLabel, { color: mutedColor }]}>
              {modeLabel}
            </Text>
          </View>

          <View style={styles.resultsStatsColumn}>
            <Text style={[styles.resultsCompleteTitle, { color: theme.textColor }]}>
              {completeTitle}
            </Text>
            <View style={styles.resultsStatRow}>
              <Ionicons name="checkmark-circle-outline" size={17} color="#8acb88" />
              <Text style={[styles.resultsStatLabel, { color: theme.textColor }]}>
                Correct
              </Text>
              <Text style={[styles.resultsStatValue, { color: "#8acb88" }]}>
                {correctCount}
              </Text>
            </View>
            <View style={styles.resultsStatRow}>
              <Ionicons name="close-circle-outline" size={17} color={theme.error} />
              <Text style={[styles.resultsStatLabel, { color: theme.textColor }]}>
                Incorrect
              </Text>
              <Text style={[styles.resultsStatValue, { color: theme.error }]}>
                {incorrectCount}
              </Text>
            </View>
            <View style={styles.resultsStatRow}>
              <Ionicons name="file-tray-full-outline" size={17} color={mutedColor} />
              <Text style={[styles.resultsStatLabel, { color: theme.textColor }]}>
                Reviews
              </Text>
              <Text style={[styles.resultsStatValue, { color: theme.textColor }]}>
                {totalItems}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.resultsSectionHeading}>
          <Text style={[styles.resultsSectionTitle, { color: theme.textColor }]}>
            {detailTitle}
          </Text>
          <Text style={[styles.resultsSectionSubtitle, { color: mutedColor }]}>
            {detailSubtitle}
          </Text>
        </View>

        {displayedResults.length > 0 ? (
          displayedResults.map((result, index) => (
            <BunproResultCard
              key={`${result.reviewId}-${index}`}
              result={result}
              index={index}
              theme={theme}
              mutedColor={mutedColor}
              panelBorder={panelBorder}
              accent={accent}
              onOpenReviewable={onOpenReviewable}
            />
          ))
        ) : (
          <View
            style={[
              styles.resultsEmptyCard,
              { backgroundColor: theme.cardBackground, borderColor: panelBorder },
            ]}
          >
            <Ionicons name="sparkles-outline" size={24} color={accent} />
            <Text style={[styles.resultsEmptyText, { color: mutedColor }]}>
              Nothing to review here.
            </Text>
          </View>
        )}

        {missedResults.length === 0 && results.length > displayedResults.length ? (
          <Text style={[styles.resultsFootnote, { color: mutedColor }]}>
            Showing the first {displayedResults.length} correct items.
          </Text>
        ) : null}

        <TouchableOpacity
          activeOpacity={0.86}
          style={[styles.resultsDoneButton, { backgroundColor: accent }]}
          onPress={onDone}
        >
          <Ionicons name="checkmark" size={20} color="#101217" />
          <Text style={styles.resultsDoneButtonText}>{completeButtonLabel}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function BunproReviewScreen({
  initialQueue,
  initialReviewSessionId,
  initialMode,
  submissionContext = "review",
  loadingLabel = "Loading Bunpro reviews...",
  emptyTitle = "No reviews due",
  emptySubtitle,
  completeTitle = "Review complete",
  completeButtonLabel = "Back to Bunpro",
  onBack,
  onComplete,
}: BunproReviewScreenProps = {}) {
  const { theme, isDark } = useTheme();
  const { userData } = useAuthStore();
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const inputRef = useRef<KanaInputHandle>(null);
  const activeSoundRef = useRef<AudioSound | null>(null);
  const commitLockRef = useRef(false);

  const isPortegoUser = isPortegoUsername(userData?.username);
  const hasExternalQueue = Array.isArray(initialQueue);
  const mode = useMemo(
    () => initialMode ?? resolveReviewMode(decodeParam(params.mode)),
    [initialMode, params.mode]
  );
  const onlyReviewFilter = useMemo(
    () => toOnlyReviewFilter(mode),
    [mode]
  );

  const [queue, setQueue] = useState<BunproReviewQueueItem[]>(() => initialQueue ?? []);
  const [loadedReviewTotal, setLoadedReviewTotal] = useState(() => initialQueue?.length ?? 0);
  const [reviewSessionId, setReviewSessionId] = useState<number | null>(
    () => initialReviewSessionId ?? null
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(!hasExternalQueue);
  const [isSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [isHintsVisible, setIsHintsVisible] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [pendingOutcome, setPendingOutcome] = useState<PendingOutcome | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [masteryRepeatReviewIds, setMasteryRepeatReviewIds] = useState<string[]>([]);
  const [reviewFeedback, setReviewFeedback] = useState<ReviewFeedback | null>(null);
  const [inputResetSignal, setInputResetSignal] = useState(0);
  const [isLoadingMoreReviews, setIsLoadingMoreReviews] = useState(false);
  const [reviewResults, setReviewResults] = useState<BunproReviewResultItem[]>([]);

  const accent = isDark ? "#db6466" : "#cc5b5d";
  const warningColor = isDark ? "#c89a3c" : "#b27a1a";
  const mutedColor = isDark ? "#a4a8b2" : theme.textSecondary;
  const backgroundColor = isDark ? "#0d1118" : theme.backgroundColor;
  const inputBorder = isDark ? "rgba(255,255,255,0.2)" : theme.border;

  const stopActiveSound = useCallback(async () => {
    if (!activeSoundRef.current) {
      setIsPlayingAudio(false);
      return;
    }

    try {
      await activeSoundRef.current.unloadAsync();
    } catch {
      // noop
    } finally {
      activeSoundRef.current = null;
      setIsPlayingAudio(false);
    }
  }, []);

  const clearReviewInput = useCallback(() => {
    inputRef.current?.clearInput();
    inputRef.current?.setInputText?.("");
    setInputValue("");
    setInputResetSignal((previousValue) => previousValue + 1);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, []);

  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
      return;
    }

    router.back();
  }, [onBack, router]);

  useEffect(() => {
    return () => {
      void stopActiveSound();
    };
  }, [stopActiveSound]);

  const loadQueue = useCallback(async () => {
    if (hasExternalQueue) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await getBunproReviewQuizIndex({
        onlyReview: onlyReviewFilter,
      });
      const nextQueue = buildReviewQueue(response);
      setQueue(nextQueue);
      setLoadedReviewTotal(Math.max(nextQueue.length, readPendingTotal(response)));
      setReviewSessionId(response.review_session_id ?? null);
      setCurrentIndex(0);
      setCorrectCount(0);
      setIncorrectCount(0);
      setIsLoadingMoreReviews(false);
      setReviewResults([]);
      clearReviewInput();
      setIsHintsVisible(false);
    } catch (error) {
      setErrorMessage(formatBunproError(error));
      setIsLoadingMoreReviews(false);
    } finally {
      setIsLoading(false);
    }
  }, [clearReviewInput, hasExternalQueue, onlyReviewFilter]);

  useEffect(() => {
    if (!hasExternalQueue) {
      return;
    }

    setQueue(initialQueue ?? []);
    setLoadedReviewTotal(initialQueue?.length ?? 0);
    setReviewSessionId(initialReviewSessionId ?? null);
    setCurrentIndex(0);
    setCorrectCount(0);
    setIncorrectCount(0);
    setErrorMessage(null);
    setIsLoadingMoreReviews(false);
    setReviewResults([]);
    setPendingOutcome(null);
    setShowAnswer(false);
    setShowAlternatives(false);
    setReviewFeedback(null);
    setMasteryRepeatReviewIds([]);
    setIsHintsVisible(false);
    setIsLoading(false);
    clearReviewInput();
  }, [clearReviewInput, hasExternalQueue, initialQueue, initialReviewSessionId]);

  useEffect(() => {
    if (hasExternalQueue) {
      setIsLoading(false);
      return;
    }

    if (!isPortegoUser) {
      setIsLoading(false);
      return;
    }

    void loadQueue();
  }, [hasExternalQueue, isPortegoUser, loadQueue]);

  const currentItem = queue[currentIndex] ?? null;
  const currentReviewAttributes = (currentItem?.data?.attributes ?? null) as
    | Record<string, unknown>
    | null;
  const currentReviewId = currentItem?.data?.id ?? null;
  const reviewableType = sanitizeText(currentReviewAttributes?.reviewable_type);

  const studyQuestionId = currentItem?.data?.relationships?.study_question?.data?.id;
  const studyQuestionResource = getIncludedResource(
    currentItem?.included,
    studyQuestionId,
    "study_question"
  );
  const studyQuestionAttributes = useMemo(
    () =>
      ((studyQuestionResource?.attributes ?? {}) as BunproStudyQuestionAttributes &
        Record<string, unknown>),
    [studyQuestionResource?.attributes]
  );

  const questionSentence = sanitizeQuestionContent(studyQuestionAttributes.content);
  const parsedQuestion = parseQuestionSentence(questionSentence);
  const beforeRuns = useMemo(
    () => parseFuriganaRuns(parsedQuestion.beforeBlank),
    [parsedQuestion.beforeBlank]
  );
  const afterRuns = useMemo(
    () => parseFuriganaRuns(parsedQuestion.afterBlank),
    [parsedQuestion.afterBlank]
  );
  const wordPrompt = sanitizeText(studyQuestionAttributes.word_prompt);
  const wordPromptRuns = useMemo(() => parseFuriganaRuns(wordPrompt), [wordPrompt]);
  const tenseHint = sanitizeText(studyQuestionAttributes.tense);
  const translationText = sanitizeText(studyQuestionAttributes.translation);
  const translationRuns = buildStrongRuns(
    typeof studyQuestionAttributes.translation === "string"
      ? studyQuestionAttributes.translation
      : ""
  );

  const hasAudio =
    sanitizeText(studyQuestionAttributes.female_audio_url).length > 0 ||
    sanitizeText(studyQuestionAttributes.male_audio_url).length > 0;
  const canonicalAnswer = pickCanonicalAnswer(
    (studyQuestionAttributes as unknown as Record<string, unknown>) ?? {}
  );
  const alternativeAnswers = extractAlternativeAnswers(
    (studyQuestionAttributes as unknown as Record<string, unknown>) ?? {},
    canonicalAnswer
  );
  const hasAlternatives = alternativeAnswers.length > 0;
  const currentReviewIdString = currentReviewId ? String(currentReviewId) : "";
  const isMasteryRepeat =
    currentReviewIdString.length > 0 &&
    masteryRepeatReviewIds.includes(currentReviewIdString);
  const alternateAnswerFeedback = useMemo(
    () =>
      buildAnswerFeedbackMap(
        (studyQuestionAttributes as unknown as Record<string, unknown>)?.alternate_answers
      ),
    [studyQuestionAttributes]
  );
  const wrongAnswerFeedback = useMemo(
    () =>
      buildAnswerFeedbackMap(
        (studyQuestionAttributes as unknown as Record<string, unknown>)?.wrong_answers
      ),
    [studyQuestionAttributes]
  );

  const reviewableRelation = currentItem?.data?.relationships?.reviewable?.data;
  const reviewableKind = reviewableRelation?.type === "grammar_point" ? "grammar" : "vocab";
  const reviewableResource = getIncludedResource(
    currentItem?.included,
    reviewableRelation?.id,
    reviewableRelation?.type ?? ""
  );
  const reviewableAttributes = (reviewableResource?.attributes ?? {}) as Record<string, unknown>;
  const reviewableSlug = sanitizeText(reviewableAttributes.slug);
  const reviewableTitle =
    sanitizeText(reviewableAttributes.title) ||
    sanitizeText(reviewableAttributes.furigana) ||
    sanitizeText(reviewableAttributes.kana) ||
    reviewableSlug ||
    getModeLabel(mode);
  const reviewableMeaning =
    sanitizeText(reviewableAttributes.meaning) ||
    sanitizeText(reviewableAttributes.nuance_translation);
  const reviewableLevel =
    sanitizeText(reviewableAttributes.level) ||
    sanitizeText(reviewableAttributes.jlpt_level);

  const totalItems = queue.length;
  const displayTotalItems = Math.max(totalItems, loadedReviewTotal);
  const displayCurrentItem = Math.min(
    currentIndex + 1,
    Math.max(1, displayTotalItems)
  );
  const isWaitingForMoreReviews =
    !hasExternalQueue && isLoadingMoreReviews && totalItems > 0 && currentIndex >= totalItems;
  const isComplete = totalItems > 0 && currentIndex >= totalItems && !isWaitingForMoreReviews;

  useEffect(() => {
    setPendingOutcome(null);
    setShowAnswer(false);
    setShowAlternatives(false);
    setReviewFeedback(null);
    clearReviewInput();
    void stopActiveSound();
    setIsHintsVisible(false);
  }, [clearReviewInput, currentIndex, currentReviewId, stopActiveSound]);

  useEffect(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [currentIndex]);

  const playCurrentAudio = useCallback(async () => {
    if (!studyQuestionAttributes) {
      return;
    }

    const urls = [
      sanitizeText(studyQuestionAttributes.female_audio_url),
      sanitizeText(studyQuestionAttributes.male_audio_url),
    ].filter((value) => value.length > 0);

    if (urls.length === 0) {
      return;
    }

    if (isPlayingAudio) {
      await stopActiveSound();
      return;
    }

    await stopActiveSound();

    let createdSound: AudioSound | null = null;
    for (const url of urls) {
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay: true }
        );
        createdSound = sound;
        break;
      } catch {
        // try next audio source
      }
    }

    if (!createdSound) {
      return;
    }

    activeSoundRef.current = createdSound;
    setIsPlayingAudio(true);

    createdSound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) {
        return;
      }

      if (status.didJustFinish) {
        void stopActiveSound();
      }
    });
  }, [isPlayingAudio, stopActiveSound, studyQuestionAttributes]);

  const submitCurrentAnswer = useCallback(async () => {
    if (
      !currentItem ||
      !currentReviewId ||
      !reviewSessionId ||
      isSubmitting ||
      commitLockRef.current
    ) {
      return;
    }

    if (!pendingOutcome) {
      const flushedInput = inputRef.current?.flushKana() ?? inputValue;
      const enteredText = flushedInput.trim();
      if (!enteredText) {
        return;
      }

      setInputValue(flushedInput);

      const normalizedInput = normalizeAnswer(flushedInput);
      const acceptedAnswers = collectAcceptedAnswers(
        (studyQuestionAttributes as unknown as Record<string, unknown>) ?? {}
      );
      const correct = normalizedInput.length > 0 && acceptedAnswers.includes(normalizedInput);
      const alternateFeedbackMessage =
        normalizedInput.length > 0 ? alternateAnswerFeedback.get(normalizedInput) : undefined;
      const wrongFeedbackMessage =
        normalizedInput.length > 0 ? wrongAnswerFeedback.get(normalizedInput) : undefined;

      setErrorMessage(null);
      setIsHintsVisible(false);

      if (!correct && alternateFeedbackMessage) {
        setReviewFeedback({
          kind: "warning",
          message: alternateFeedbackMessage,
        });
        return;
      }

      setPendingOutcome({
        correct,
        enteredText,
        stageLabel: extractStageLabelFromSubmission(null, currentReviewAttributes),
      });
      setReviewFeedback(
        !correct && wrongFeedbackMessage
          ? {
              kind: "error",
              message: wrongFeedbackMessage,
            }
          : null
      );
      setShowAnswer(false);
      setShowAlternatives(false);
      return;
    }

    const remainingLoadedQueue = queue.slice(currentIndex);
    const shouldRequestMoreReviews =
      submissionContext === "review" &&
      !hasExternalQueue &&
      remainingLoadedQueue.length > 1 &&
      remainingLoadedQueue.length <= 10;
    const loadedReviewIds = remainingLoadedQueue
      .map((item) => Number.parseInt(item.data.id, 10))
      .filter((value) => Number.isFinite(value));

    const itemOnlyReview =
      submissionContext === "learn"
        ? null
        : reviewableType.length > 0
          ? reviewableType
          : onlyReviewFilter ?? null;
    const resultItem: BunproReviewResultItem = {
      reviewId: currentReviewIdString,
      reviewableKind,
      reviewableSlug,
      reviewableTitle,
      reviewableMeaning,
      reviewableLevel,
      question: questionSentence,
      translation: translationText,
      tenseHint,
      enteredAnswer: pendingOutcome.enteredText,
      correctAnswer: canonicalAnswer,
      wasCorrect: pendingOutcome.correct,
      stageLabel: pendingOutcome.stageLabel,
    };

    const submitToApi = async (correct: boolean): Promise<Record<string, unknown> | null> => {
      const payloadVariants = [
        {
          review_session_id: reviewSessionId,
          correct,
          fsrs_input: null,
          loaded_review_ids: shouldRequestMoreReviews ? loadedReviewIds : null,
          loaded_ghost_review_ids: shouldRequestMoreReviews ? [] : null,
          loaded_self_study_review_ids: shouldRequestMoreReviews ? [] : null,
          deck_id: null,
          only_review: itemOnlyReview,
        },
        {
          review_session_id: reviewSessionId,
          correct,
          fsrs_input: null,
          loaded_review_ids: null,
          loaded_ghost_review_ids: null,
          loaded_self_study_review_ids: null,
          deck_id: null,
          only_review: itemOnlyReview,
        },
        {
          review_session_id: reviewSessionId,
          correct,
          fsrs_input: null,
          loaded_review_ids: null,
          loaded_ghost_review_ids: null,
          loaded_self_study_review_ids: null,
          deck_id: null,
        },
      ];

      let lastSubmissionError: unknown = null;

      for (const payload of payloadVariants) {
        try {
          const response = await updateBunproReview({
            reviewId: currentReviewId,
            payload,
          });
          return response && typeof response === "object"
            ? (response as Record<string, unknown>)
            : null;
        } catch (error) {
          lastSubmissionError = error;
        }
      }

      throw lastSubmissionError;
    };

    const submitToApiInBackground = (correct: boolean) => {
      if (shouldRequestMoreReviews) {
        setIsLoadingMoreReviews(true);
      }

      void submitToApi(correct)
        .then((response) => {
          if (!response) {
            return;
          }

          const nextQueueItems = buildReviewQueue(response);
          const nextTotal = readPendingTotal(response);

          if (nextQueueItems.length > 0) {
            setQueue((previousQueue) =>
              mergeReviewQueueItems(previousQueue, nextQueueItems)
            );
          }

          if (nextTotal > 0) {
            setLoadedReviewTotal((previousTotal) =>
              Math.max(previousTotal, correctCount + incorrectCount + nextTotal)
            );
          }
        })
        .catch((error) => {
          setErrorMessage(`Background sync failed: ${formatBunproError(error)}`);
        })
        .finally(() => {
          if (shouldRequestMoreReviews) {
            setIsLoadingMoreReviews(false);
          }
        });
    };

    const advanceToNext = () => {
      clearReviewInput();
      setCurrentIndex((previousValue) => previousValue + 1);
      setPendingOutcome(null);
      setShowAnswer(false);
      setShowAlternatives(false);
      setReviewFeedback(null);
      void stopActiveSound();
    };

    try {
      commitLockRef.current = true;

      if (pendingOutcome.correct) {
        if (isMasteryRepeat) {
          setMasteryRepeatReviewIds((previousIds) =>
            previousIds.filter((id) => id !== currentReviewIdString)
          );
          advanceToNext();
          return;
        }

        setCorrectCount((previousValue) => previousValue + 1);
        setReviewResults((previousResults) => [...previousResults, resultItem]);
        submitToApiInBackground(true);
        advanceToNext();
        return;
      }

      if (!isMasteryRepeat) {
        setIncorrectCount((previousValue) => previousValue + 1);
        setReviewResults((previousResults) => [...previousResults, resultItem]);
        submitToApiInBackground(false);

        if (currentReviewIdString) {
          setMasteryRepeatReviewIds((previousIds) =>
            previousIds.includes(currentReviewIdString)
              ? previousIds
              : [...previousIds, currentReviewIdString]
          );
        }
      }

      setQueue((previousQueue) => [...previousQueue, currentItem]);
      advanceToNext();
    } catch (error) {
      setErrorMessage(formatBunproError(error));
    } finally {
      commitLockRef.current = false;
    }
  }, [
    currentItem,
    currentReviewAttributes,
    currentReviewId,
    currentReviewIdString,
    currentIndex,
    correctCount,
    incorrectCount,
    canonicalAnswer,
    hasExternalQueue,
    inputValue,
    isMasteryRepeat,
    isSubmitting,
    onlyReviewFilter,
    pendingOutcome,
    queue,
    reviewSessionId,
    reviewableType,
    stopActiveSound,
    clearReviewInput,
    studyQuestionAttributes,
    alternateAnswerFeedback,
    wrongAnswerFeedback,
    submissionContext,
    questionSentence,
    reviewableKind,
    reviewableLevel,
    reviewableMeaning,
    reviewableSlug,
    reviewableTitle,
    tenseHint,
    translationText,
  ]);

  const translatedPrompt = pendingOutcome
    ? pendingOutcome.correct || !showAnswer
      ? pendingOutcome.enteredText
      : canonicalAnswer || pendingOutcome.enteredText
    : inputValue.trim().length > 0
      ? inputValue.trim()
      : "　　";
  const statusColor = pendingOutcome
    ? pendingOutcome.correct
      ? "#8acb88"
      : theme.error
    : accent;
  const isFrozenOnResult = Boolean(pendingOutcome);
  const thirdActionLabel = !pendingOutcome
    ? ""
    : !pendingOutcome.correct && !showAnswer
      ? "Show Answer"
      : hasAlternatives
        ? showAlternatives
          ? "Hide Alts."
          : "Alternatives"
        : "No Alts.";
  const thirdActionIcon = !pendingOutcome
    ? "list-outline"
    : !pendingOutcome.correct && !showAnswer
      ? "eye-outline"
      : "reorder-three-outline";
  const isThirdActionDisabled = !pendingOutcome
    ? true
    : pendingOutcome.correct
      ? !hasAlternatives
      : showAnswer
        ? !hasAlternatives
        : false;

  if (!isPortegoUser) {
    return (
      <SafeAreaView style={[styles.centeredContainer, { backgroundColor: theme.backgroundColor }]}>
        <StatusBar style={theme.statusBarStyle} />
        <Ionicons name="lock-closed-outline" size={26} color={theme.textSecondary} />
        <Text style={[styles.gatedTitle, { color: theme.textColor }]}>Bunpro Beta Is Portego-Only</Text>
        <Text style={[styles.gatedSubtitle, { color: theme.textSecondary }]}>
          This review flow is currently enabled only for the Portego account.
        </Text>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.centeredContainer, { backgroundColor }]}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <ActivityIndicator size="large" color={accent} />
        <Text style={[styles.loadingText, { color: mutedColor }]}>{loadingLabel}</Text>
      </SafeAreaView>
    );
  }

  if (errorMessage && totalItems === 0) {
    return (
      <SafeAreaView style={[styles.centeredContainer, { backgroundColor }]}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <Ionicons name="alert-circle-outline" size={32} color={theme.error} />
        <Text style={[styles.errorText, { color: theme.error }]}>{errorMessage}</Text>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: accent }]}
          onPress={() => {
            if (hasExternalQueue) {
              setErrorMessage(null);
              return;
            }
            void loadQueue();
          }}
        >
          <Text style={styles.primaryButtonText}>Try again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (totalItems === 0) {
    return (
      <SafeAreaView style={[styles.centeredContainer, { backgroundColor }]}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <Ionicons name="checkmark-done-outline" size={32} color={accent} />
        <Text style={[styles.emptyTitle, { color: theme.textColor }]}>{emptyTitle}</Text>
        <Text style={[styles.emptySubtitle, { color: mutedColor }]}>
          {emptySubtitle ?? `You are all caught up for ${getModeLabel(mode)}.`}
        </Text>
      </SafeAreaView>
    );
  }

  if (isWaitingForMoreReviews) {
    return (
      <SafeAreaView style={[styles.centeredContainer, { backgroundColor }]}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <ActivityIndicator size="large" color={accent} />
        <Text style={[styles.loadingText, { color: mutedColor }]}>
          Loading more Bunpro reviews...
        </Text>
      </SafeAreaView>
    );
  }

  if (isComplete) {
    return (
      <BunproResultsScreen
        theme={theme}
        isDark={isDark}
        modeLabel={getModeLabel(mode)}
        results={reviewResults}
        correctCount={correctCount}
        incorrectCount={incorrectCount}
        totalItems={displayTotalItems}
        completeTitle={completeTitle}
        completeButtonLabel={completeButtonLabel}
        accent={accent}
        mutedColor={mutedColor}
        panelBorder={inputBorder}
        backgroundColor={backgroundColor}
        onBack={handleBack}
        onDone={() => {
          if (onComplete) {
            onComplete({ correctCount, incorrectCount, totalItems: displayTotalItems });
            return;
          }
          router.back();
        }}
        onOpenReviewable={(kind, slug) => {
          router.push({
            pathname: "/bunpro-reviewable/[kind]/[slug]",
            params: {
              kind,
              slug: encodeURIComponent(slug),
            },
          });
        }}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <View style={[styles.header, { borderBottomColor: inputBorder }]}>
        <View style={styles.headerLeftGroup}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleBack}
          >
            <Ionicons name="arrow-back-outline" size={24} color={theme.textColor} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => {
              router.push("/(app)/(bunpro-tabs)/bunpro-search");
            }}
          >
            <Ionicons name="search" size={23} color={theme.textColor} />
          </TouchableOpacity>
        </View>

        <View style={styles.headerRightGroup}>
          {pendingOutcome?.stageLabel ? (
            <View style={styles.stageRow}>
              <Ionicons
                name={pendingOutcome.correct ? "arrow-up" : "arrow-down"}
                size={15}
                color={statusColor}
              />
              <Text style={[styles.stageLabel, { color: statusColor }]}>
                {pendingOutcome.stageLabel}
              </Text>
            </View>
          ) : null}
          <Text style={[styles.headerStatsText, { color: mutedColor }]}>
            {displayCurrentItem}/{displayTotalItems}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.promptArea}>
          {tenseHint ? (
            <Text style={[styles.tenseLabel, { color: mutedColor }]}>{tenseHint}</Text>
          ) : null}

          <View style={styles.rubyLine}>
            <RubyText
              runs={beforeRuns}
              baseTextStyle={[styles.japaneseSentenceBase, { color: theme.textColor }]}
              readingTextStyle={[styles.japaneseSentenceReading, { color: mutedColor }]}
            />
            {parsedQuestion.hasBlank ? (
              <Text
                style={[
                  styles.answerInline,
                  {
                    borderBottomColor: statusColor,
                    color: statusColor,
                  },
                ]}
              >
                {translatedPrompt}
              </Text>
            ) : null}
            <RubyText
              runs={afterRuns}
              baseTextStyle={[styles.japaneseSentenceBase, { color: theme.textColor }]}
              readingTextStyle={[styles.japaneseSentenceReading, { color: mutedColor }]}
            />
          </View>

          {wordPrompt ? (
            <View style={[styles.rubyLine, styles.wordPromptLine]}>
              <Text style={[styles.wordPromptParen, { color: mutedColor }]}>(</Text>
              <RubyText
                runs={wordPromptRuns}
                baseTextStyle={[styles.wordPromptBase, { color: mutedColor }]}
                readingTextStyle={[styles.wordPromptReading, { color: mutedColor }]}
              />
              <Text style={[styles.wordPromptParen, { color: mutedColor }]}>)</Text>
            </View>
          ) : null}

          {translationRuns.length > 0 ? (
            <Text style={[styles.translationText, { color: theme.textColor }]}>
              {translationRuns.map((run, index) => (
                <Text
                  key={`${index}-${run.strong ? "strong" : "plain"}`}
                  style={
                    run.strong
                      ? [styles.translationStrong, { color: statusColor }]
                      : undefined
                  }
                >
                  {run.text}
                </Text>
              ))}
            </Text>
          ) : null}

          {showAlternatives && hasAlternatives ? (
            <Text style={[styles.alternativesText, { color: mutedColor }]}>
              Alternatives: {alternativeAnswers.join(" ・ ")}
            </Text>
          ) : null}

          {reviewFeedback ? (
            <View style={styles.feedbackRow}>
              <Ionicons
                name={reviewFeedback.kind === "warning" ? "warning" : "close"}
                size={18}
                color={reviewFeedback.kind === "warning" ? warningColor : theme.error}
              />
              <Text
                style={[
                  styles.feedbackText,
                  { color: reviewFeedback.kind === "warning" ? warningColor : theme.error },
                ]}
              >
                {reviewFeedback.message}
              </Text>
            </View>
          ) : null}

          {!!errorMessage ? (
            <Text style={[styles.inlineError, { color: theme.error }]}>{errorMessage}</Text>
          ) : null}
        </View>

        <View style={styles.bottomArea}>
          {!isFrozenOnResult ? (
            <View style={styles.bottomActions}>
              <TouchableOpacity
                activeOpacity={0.86}
                style={[styles.hintButton, { borderColor: inputBorder }]}
                onPress={() => {
                  setIsHintsVisible((previousValue) => !previousValue);
                }}
              >
                <Ionicons name="bulb-outline" size={16} color={theme.textColor} />
                <Text style={[styles.hintButtonText, { color: theme.textColor }]}>Hints</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.resultActionsRow}>
              <View style={styles.resultActionSlot}>
                <TouchableOpacity
                  activeOpacity={0.86}
                  style={[styles.resultActionButton, { borderColor: inputBorder }]}
                  onPress={() => {
                    setPendingOutcome(null);
                    setShowAnswer(false);
                    setShowAlternatives(false);
                    setReviewFeedback(null);
                    setErrorMessage(null);
                    void stopActiveSound();
                  }}
                >
                  <Ionicons name="arrow-undo-outline" size={17} color={theme.textColor} />
                  <Text style={[styles.resultActionButtonText, { color: theme.textColor }]}>Undo</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.resultActionSlot}>
                <TouchableOpacity
                  activeOpacity={0.86}
                  style={[styles.resultActionButton, { borderColor: inputBorder }]}
                  onPress={() => {
                    if (!reviewableSlug) {
                      return;
                    }

                    router.push({
                      pathname: "/bunpro-reviewable/[kind]/[slug]",
                      params: {
                        kind: reviewableKind,
                        slug: encodeURIComponent(reviewableSlug),
                      },
                    });
                  }}
                  disabled={!reviewableSlug}
                >
                  <Ionicons name="information-circle-outline" size={17} color={theme.textColor} />
                  <Text style={[styles.resultActionButtonText, { color: theme.textColor }]}>Show Info</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.resultActionSlot}>
                <TouchableOpacity
                  activeOpacity={0.86}
                  style={[styles.resultActionButton, { borderColor: inputBorder }]}
                  disabled={isThirdActionDisabled}
                  onPress={() => {
                    if (!pendingOutcome) {
                      return;
                    }
                    if (!pendingOutcome.correct && !showAnswer) {
                      setShowAnswer(true);
                      return;
                    }
                    if (hasAlternatives) {
                      setShowAlternatives((previousValue) => !previousValue);
                    }
                  }}
                >
                  <Ionicons
                    name={thirdActionIcon}
                    size={17}
                    color={isThirdActionDisabled ? mutedColor : theme.textColor}
                  />
                  <Text
                    style={[
                      styles.resultActionButtonText,
                      { color: isThirdActionDisabled ? mutedColor : theme.textColor },
                    ]}
                  >
                    {thirdActionLabel}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {isHintsVisible && !isFrozenOnResult ? (
            <View style={[styles.hintPanel, { borderColor: inputBorder }]}>
              <Text style={[styles.hintPanelText, { color: mutedColor }]}>
                {wordPrompt ? `Prompt: ${wordPrompt}` : "No prompt available"}
              </Text>
              <Text style={[styles.hintPanelText, { color: mutedColor }]}>
                {tenseHint ? `Tense: ${tenseHint}` : "No tense hint available"}
              </Text>
            </View>
          ) : null}

          <View style={[styles.inputRow, { borderColor: isFrozenOnResult ? statusColor : inputBorder }]}>
            {isFrozenOnResult && hasAudio ? (
              <TouchableOpacity
                style={[styles.submitButton, styles.leftInputButton]}
                activeOpacity={0.82}
                onPress={() => {
                  void playCurrentAudio();
                }}
              >
                <Ionicons
                  name={isPlayingAudio ? "pause" : "play"}
                  size={20}
                  color={statusColor}
                />
              </TouchableOpacity>
            ) : (
              <View style={styles.inputSideSpacer} />
            )}
            <KanaInput
              ref={inputRef}
              onKanaChange={(nextKana) => {
                setInputValue(nextKana);

                if (pendingOutcome) {
                  const shouldUndo = nextKana.trim() !== pendingOutcome.enteredText;
                  if (shouldUndo) {
                    setPendingOutcome(null);
                    setShowAnswer(false);
                    setShowAlternatives(false);
                    setReviewFeedback(null);
                    setErrorMessage(null);
                  }
                  return;
                }

                if (reviewFeedback) {
                  setReviewFeedback(null);
                }
              }}
              initialValue=""
              enableKanaConversion
              useJapaneseKeyboard={false}
              resetSignal={inputResetSignal}
              autoCorrect={false}
              autoCapitalize="none"
              placeholder="Type your answer..."
              placeholderTextColor={mutedColor}
              style={[styles.answerInput, { color: isFrozenOnResult ? statusColor : theme.textColor }]}
              returnKeyType="send"
              onSubmitEditing={() => {
                void submitCurrentAnswer();
              }}
              editable={!isSubmitting}
              blurOnSubmit={false}
            />

            <TouchableOpacity
              disabled={isSubmitting}
              style={styles.submitButton}
              activeOpacity={0.82}
              onPress={() => {
                void submitCurrentAnswer();
              }}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={accent} />
              ) : (
                <Ionicons
                  name={isFrozenOnResult ? "arrow-forward" : "paper-plane-outline"}
                  size={22}
                  color={isFrozenOnResult ? statusColor : mutedColor}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centeredContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  gatedTitle: {
    marginTop: 12,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  gatedSubtitle: {
    marginTop: 8,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
  },
  errorText: {
    marginTop: 10,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 22,
    fontWeight: "700",
  },
  emptySubtitle: {
    marginTop: 8,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  primaryButton: {
    marginTop: 18,
    minWidth: 170,
    borderRadius: 12,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: "#101217",
    fontWeight: "700",
    fontSize: 15,
  },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeftGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerRightGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 1,
  },
  stageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  stageLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  headerStatsText: {
    fontSize: 16,
    fontWeight: "700",
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
  },
  promptArea: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  tenseLabel: {
    fontSize: 15,
    marginBottom: 14,
    textAlign: "center",
  },
  rubyLine: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-end",
    justifyContent: "center",
    rowGap: 2,
    columnGap: 1,
  },
  rubyContainer: {
    alignItems: "center",
    justifyContent: "flex-end",
    marginHorizontal: 1,
  },
  rubyReading: {
    fontSize: 11,
    lineHeight: 12,
    fontWeight: "500",
  },
  rubyBase: {
    fontSize: 34,
    lineHeight: 44,
    fontWeight: "500",
  },
  japaneseSentenceBase: {
    fontSize: 34,
    lineHeight: 44,
    fontWeight: "500",
  },
  japaneseSentenceReading: {
    fontSize: 11,
    lineHeight: 12,
  },
  answerInline: {
    borderBottomWidth: 2,
    fontWeight: "700",
    fontSize: 34,
    lineHeight: 44,
    minWidth: 66,
    textAlign: "center",
    paddingHorizontal: 6,
  },
  wordPromptLine: {
    marginTop: 8,
  },
  wordPromptParen: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "500",
  },
  wordPromptBase: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "500",
  },
  wordPromptReading: {
    fontSize: 10,
    lineHeight: 12,
  },
  translationText: {
    marginTop: 16,
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
  },
  translationStrong: {
    fontWeight: "800",
  },
  inlineError: {
    marginTop: 10,
    fontSize: 13,
    textAlign: "center",
  },
  alternativesText: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    paddingHorizontal: 6,
  },
  feedbackRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 12,
  },
  feedbackText: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "600",
    textAlign: "center",
    flexShrink: 1,
  },
  bottomArea: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === "ios" ? 16 : 12,
    gap: 10,
  },
  bottomActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  hintButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  hintButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  resultActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: "100%",
  },
  resultActionSlot: {
    flex: 1,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  resultActionButton: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 14,
    height: 42,
    paddingHorizontal: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  resultActionButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  hintPanel: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  hintPanelText: {
    fontSize: 13,
    lineHeight: 18,
  },
  inputRow: {
    borderWidth: 1,
    borderRadius: 18,
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  inputSideSpacer: {
    width: 44,
    height: 44,
  },
  leftInputButton: {
    marginLeft: 0,
    marginRight: 8,
  },
  answerInput: {
    flex: 1,
    fontSize: 22,
    lineHeight: 28,
    minHeight: 40,
    textAlign: "center",
    paddingVertical: 0,
  },
  submitButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  resultsContainer: {
    flex: 1,
  },
  resultsHeader: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  resultsHeaderButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  resultsHeaderTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  resultsScroll: {
    flex: 1,
  },
  resultsScrollContent: {
    padding: 16,
    paddingBottom: 34,
    gap: 14,
  },
  resultsHeroCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },
  resultsScoreColumn: {
    alignItems: "center",
    width: 102,
  },
  resultsScoreRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  resultsScoreText: {
    fontSize: 24,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  resultsScoreLabel: {
    marginTop: 7,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  resultsStatsColumn: {
    flex: 1,
    gap: 9,
  },
  resultsCompleteTitle: {
    fontSize: 19,
    fontWeight: "900",
    marginBottom: 1,
  },
  resultsStatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  resultsStatLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },
  resultsStatValue: {
    fontSize: 15,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  resultsSectionHeading: {
    gap: 4,
    marginTop: 4,
  },
  resultsSectionTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  resultsSectionSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  resultCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 15,
    gap: 12,
  },
  resultCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  resultTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    flex: 1,
  },
  resultIndexText: {
    fontSize: 12,
    fontWeight: "800",
  },
  resultKindPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  resultKindPillText: {
    color: "#101217",
    fontSize: 12,
    fontWeight: "900",
  },
  resultLevelText: {
    fontSize: 12,
    fontWeight: "700",
  },
  resultSubjectButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  resultSubjectTextGroup: {
    flex: 1,
    gap: 2,
  },
  resultSubjectTitle: {
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "800",
  },
  resultSubjectMeaning: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  resultPromptBox: {
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  resultTenseText: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  resultQuestionText: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: "600",
    textAlign: "center",
  },
  resultTranslationText: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  resultAnswersRow: {
    flexDirection: "row",
    gap: 12,
  },
  resultAnswerColumn: {
    flex: 1,
    gap: 3,
  },
  resultAnswerLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  resultAnswerValue: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
  },
  resultStageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  resultStageText: {
    fontSize: 13,
    fontWeight: "700",
  },
  resultsEmptyCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    alignItems: "center",
    gap: 8,
  },
  resultsEmptyText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    textAlign: "center",
  },
  resultsFootnote: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  resultsDoneButton: {
    marginTop: 4,
    borderRadius: 16,
    minHeight: 50,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  resultsDoneButtonText: {
    color: "#101217",
    fontSize: 16,
    fontWeight: "900",
  },
});
