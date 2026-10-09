import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { BlurView } from "expo-blur";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import type { KanaInputHandle } from "../components/TextToKanaInput";
import KanaInput from "../components/TextToKanaInput";
import type {
  BunproJsonApiResource,
  BunproReviewOnlyFilter,
  BunproReviewQueueItem,
  BunproStudyQuestionAttributes,
} from "../types/bunpro";
import { BunproApiError, getBunproReviewQuizIndex, updateBunproReview } from "../utils/bunproApi";
import { createBunproReviewOutbox, type BunproOutboxState } from "../utils/bunproReviewOutbox";
import { bunproAudioUrls, useBunproAudio } from "../hooks/useBunproAudio";
import { advanceReviewRetrySchedule, createReviewRetrySchedule, insertReviewRetry, orderReviewRetries, retainWrapUpReviews } from "../utils/bunpro-review-retries";
import { orderBunproReviews } from "../utils/bunproReviewOrdering";
import { getBunproLoadedReviewIds, getBunproReviewKey, getBunproReviewType } from "../utils/bunproReviewIdentity";
import { createBunproReviewSavePolicy, type BunproReviewSaveFailure, type BunproReviewSavePolicy } from "../utils/bunproReviewSavePolicy";
import { useOptionalScreenIsFocused } from "../utils/navigation-focus";
import type { MixedReviewBridge, MixedReviewAnswer } from "../types/mixedReviews";
import { isPortegoUsername } from "../utils/portegoAccess";
import { useAuthStore, useSettingsStore } from "../utils/store";
import { useTheme } from "../utils/theme";
import * as Haptics from "../utils/haptics";
import { ReviewPreviousAnswerCard } from "../components/ReviewPreviousAnswerCard";
import { BunproRubyWord } from "../components/bunpro/bunpro-ruby-word";
import { BunproReviewSettingsSheet } from "../components/bunpro/bunpro-review-settings-sheet";
import { useBunproJitaiFont } from "../hooks/use-bunpro-jitai-font";
import { useBunproVoiceAnswer } from "../hooks/use-bunpro-voice-answer";
import { playBunproFeedback } from "../utils/bunpro-feedback-audio";
import { bunproStage, bunproProgression, type BunproProgression } from "../utils/bunpro-progression";
import { DEFAULT_STUDY_SHORTCUTS, studyShortcutAction } from "../utils/bunpro-study-shortcuts";
import { BunproReviewShortcuts } from "../components/bunpro/bunpro-review-shortcuts";
import { BunproProgressionCard } from "../components/bunpro/bunpro-progression-card";
import { BunproDetailsContent } from "../components/bunpro/bunpro-details-content";
import PitchAccentVisualization from "../components/PitchAccentVisualization";
import * as wanakana from "wanakana";

// sRGB equivalent of web/tokens.css --color-success (oklch(51% 0.14 150)).
const BUNPRO_SUCCESS_COLOR = "#017b37";
const BUNPRO_SUCCESS_SOFT = { light: "#dcf2df", dark: "#122d19" };

export type BunproReviewMode = "all" | "grammar" | "vocab";

export type BunproReviewCompletionSummary = {
  correctCount: number;
  incorrectCount: number;
  totalItems: number;
};

export type BunproReviewScreenProps = {
  mixed?: MixedReviewBridge;
  savePolicy?: BunproReviewSavePolicy;
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
  previousStage?: string;
  saveStatus: "pending" | "saved" | "unconfirmed";
  saveError?: string;
  audioSources?: { female_audio_url?: unknown; male_audio_url?: unknown };
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
  if (stage === 0) return "Beginner 0";
  const labels = [
    "Beginner 1",
    "Beginner 2",
    "Beginner 3",
    "Adept 1",
    "Adept 2",
    "Adept 3",
    "Seasoned 1",
    "Seasoned 2",
    "Seasoned 3",
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
  reviewAttributes: Record<string, unknown> | null,
  reviewType: "review" | "ghost_review" | "self_study_review" = "review",
): string {
  if (reviewType === "self_study_review") return "Self-study";
  if (reviewType === "ghost_review") {
    const data = response?.data;
    const attributes = data && typeof data === "object" && "attributes" in data ? data.attributes : undefined;
    const source = attributes && typeof attributes === "object" ? attributes as Record<string, unknown> : reviewAttributes;
    if (source?.is_slain === true) return "Ghost cleared";
    return typeof source?.streak === "number" ? `Ghost ${source.streak + 1}` : "";
  }
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
    const reviewId = item.data?.id ? getBunproReviewKey(item) : "";
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
      .map((item) => (item.data?.id ? getBunproReviewKey(item) : ""))
      .filter(Boolean)
  );
  const mergedQueue = [...existingQueue];

  nextItems.forEach((item) => {
    const reviewId = item.data?.id ? getBunproReviewKey(item) : "";
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
  hideFurigana?: boolean;
  questionKey?: string;
};

function RubyText({ runs, baseTextStyle, readingTextStyle, hideFurigana = false, questionKey = "" }: RubyTextProps) {
  if (runs.length === 0) {
    return null;
  }

  return (
    <>
      {runs.map((run, index) => {
        const key = `${questionKey}-${hideFurigana}-${run.kind}-${index}`;
        if (run.kind === "ruby") {
          return (
            <BunproRubyWord key={key} base={run.base} reading={run.reading} hidden={hideFurigana} containerStyle={styles.rubyContainer} readingStyle={[styles.rubyReading, readingTextStyle]} baseStyle={[styles.rubyBase, baseTextStyle]} />
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
    return BUNPRO_SUCCESS_COLOR;
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
  const parts = result.question.split(/(?:_{2,}|＿{2,})/g);
  const answerText = result.wasCorrect ? result.enteredAnswer : result.correctAnswer || result.enteredAnswer;
  return <Text style={[styles.resultQuestionText, { color }]}>{parts.map((part, index) => <React.Fragment key={index}>{index > 0 ? <Text style={{ color: result.wasCorrect ? BUNPRO_SUCCESS_COLOR : "#db6466", fontWeight: "800" }}>{answerText || "____"}</Text> : null}{part}</React.Fragment>)}{!result.question.length ? <Text style={{ color: mutedColor }}>No prompt available</Text> : null}</Text>;
}

function BunproResultCard({
  result,
  index,
  theme,
  mutedColor,
  panelBorder,
  accent,
  onOpenReviewable,
  onReplay,
  audioLoading,
  audioPlaying,
}: {
  result: BunproReviewResultItem;
  onReplay: () => void;
  audioLoading: boolean;
  audioPlaying: boolean;
  index: number;
  theme: any;
  mutedColor: string;
  panelBorder: string;
  accent: string;
  onOpenReviewable: (kind: "grammar" | "vocab", slug: string) => void;
}) {
  const resultColor = result.wasCorrect ? BUNPRO_SUCCESS_COLOR : theme.error;
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
        {result.audioSources && bunproAudioUrls(result.audioSources).length > 0 ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`${audioPlaying || audioLoading ? "Stop" : "Replay"} audio for ${result.reviewableTitle || kindLabel}`}
            onPress={onReplay}
            style={styles.resultAudioButton}
          >
            {audioLoading ? <ActivityIndicator size="small" color={theme.textColor} /> : <Ionicons name={audioPlaying ? "stop" : "volume-medium-outline"} size={20} color={theme.textColor} />}
            <Text style={{ color: theme.textColor }}>{audioLoading ? "Loading audio…" : audioPlaying ? "Stop audio" : "Replay audio"}</Text>
          </TouchableOpacity>
        ) : null}
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
            <Text style={[styles.resultAnswerValue, { color: BUNPRO_SUCCESS_COLOR }]}>
              {result.correctAnswer || "—"}
            </Text>
          </View>
        ) : null}
      </View>

      {result.saveStatus === "unconfirmed" ? (
        <Text style={[styles.inlineError, { color: theme.error }]}>Save unconfirmed. {result.saveError}</Text>
      ) : result.stageLabel ? (
        <View style={styles.resultStageRow}>
          <Ionicons
            name={result.wasCorrect ? "arrow-up" : "arrow-down"}
            size={14}
            color={resultColor}
          />
          <Text style={[styles.resultStageText, { color: resultColor }]}>
            {result.previousStage ? `${result.previousStage} → ` : ""}{result.stageLabel}
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
  durationMs,
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
  durationMs: number;
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
  const insets = useSafeAreaInsets();
  const audio = useBunproAudio();
  const audioVoice = useSettingsStore((state) => state.vocabularyAudioVoice);
  const focused = useOptionalScreenIsFocused();
  const { stop } = audio;
  useEffect(() => { if (!focused) void stop(); }, [focused, stop]);
  const [duration] = useState(durationMs);
  const scoredTotal = Math.max(1, correctCount + incorrectCount);
  const accuracyPercent = Math.round((correctCount / scoredTotal) * 100);
  const scoreColor = getAccuracyColor(accuracyPercent, theme.error);
  const missedResults = results.filter((result) => !result.wasCorrect);
  const unconfirmedResults = results.filter((result) => result.saveStatus === "unconfirmed");
  const [resultFilter, setResultFilter] = useState<"all" | "correct" | "missed">("all");
  const displayedResults = results.filter(result => resultFilter === "all" || (resultFilter === "correct" ? result.wasCorrect : !result.wasCorrect));
  const detailTitle = "Reviewed items";
  const detailSubtitle =
    missedResults.length > 0
      ? `${missedResults.length} item${missedResults.length === 1 ? "" : "s"} marked incorrect.`
      : results.length > 0
        ? "No missed items this session."
        : "No scored review details were captured.";

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.resultsContainer, { backgroundColor }]}>
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
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[styles.resultsScrollContent, { paddingBottom: insets.bottom + 24 }]}
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
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={[styles.resultsScoreText, { color: scoreColor }]}>
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
              <Ionicons name="checkmark-circle-outline" size={17} color={BUNPRO_SUCCESS_COLOR} />
              <Text style={[styles.resultsStatLabel, { color: theme.textColor }]}>
                Correct
              </Text>
              <Text style={[styles.resultsStatValue, { color: BUNPRO_SUCCESS_COLOR }]}>
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

        <Text style={{ color: mutedColor }}>Session time: {Math.floor(duration / 60000)}m {Math.floor(duration / 1000) % 60}s</Text>
        {unconfirmedResults.length ? <Text accessibilityRole="alert" style={[styles.inlineError, { color: theme.error }]}>
          {unconfirmedResults.length} Bunpro answer{unconfirmedResults.length === 1 ? " has" : "s have"} an unconfirmed save and may still be due in Bunpro.
        </Text> : null}
        <View style={styles.resultsSectionHeading}>
          <Text style={[styles.resultsSectionTitle, { color: theme.textColor }]}>
            {detailTitle}
          </Text>
          <Text style={[styles.resultsSectionSubtitle, { color: mutedColor }]}>
            {detailSubtitle}
          </Text>
        </View>

        {audio.error ? <Text accessibilityRole="alert" style={[styles.inlineError, { color: theme.error }]}>{audio.error}</Text> : null}
        <View style={{ flexDirection: "row", gap: 16 }}>
          {(["all", "correct", "missed"] as const).map(filter => <TouchableOpacity key={filter} accessibilityRole="tab" accessibilityState={{ selected: resultFilter === filter }} onPress={() => setResultFilter(filter)} style={{ minHeight: 44, padding: 12, borderBottomWidth: 2, borderBottomColor: resultFilter === filter ? accent : "transparent" }}><Text style={{ color: theme.textColor }}>{filter === "all" ? "All" : filter === "correct" ? "Correct" : "Missed"} ({results.filter(result => filter === "all" || (filter === "correct" ? result.wasCorrect : !result.wasCorrect)).length})</Text></TouchableOpacity>)}
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
              onOpenReviewable={(kind, slug) => { void audio.stop(); onOpenReviewable(kind, slug); }}
              audioLoading={audio.loadingKey === `result:${index}`}
              audioPlaying={audio.playingKey === `result:${index}`}
              onReplay={() => { void audio.play(`result:${index}`, bunproAudioUrls(result.audioSources ?? {}, audioVoice), audioVoice === "both"); }}
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
  mixed,
  savePolicy: sharedSavePolicy,
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
  const autoSwitchKeyboard = useSettingsStore(
    (state) => state.autoSwitchKeyboard,
  );
  const autoplayAudio = useSettingsStore((state) => state.autoplayVocabularyAudio);
  const audioVoice = useSettingsStore((state) => state.vocabularyAudioVoice);
  const allowSkipping = useSettingsStore((state) => state.allowSkippingReviews);
  const pauseOnCorrect = useSettingsStore((state) => state.disableAutoProgressOnCorrect);
  const pauseOnWrong = useSettingsStore((state) => state.disableAutoProgressOnWrong);
  const reviewOrder = useSettingsStore((state) => state.reviewOrder);
  const backToBackQuestions = useSettingsStore((state) => state.backToBackQuestions);
  const backToBackImmediateRetryIncorrect = useSettingsStore((state) => state.backToBackImmediateRetryIncorrect);
  const immediateRetry = backToBackQuestions && backToBackImmediateRetryIncorrect;
  const reviewBatchSizeEnabled = useSettingsStore((state) => state.reviewBatchSizeEnabled);
  const reviewBatchSize = useSettingsStore((state) => state.reviewBatchSize);
  const reviewPreferencesRef = useRef({ reviewOrder, reviewBatchSizeEnabled, reviewBatchSize });
  reviewPreferencesRef.current = { reviewOrder, reviewBatchSizeEnabled, reviewBatchSize };
  const ankiEnabled = useSettingsStore((state) => state.ankiCardMode);
  const ankiScope = useSettingsStore((state) => state.ankiCardModeScope);
  const hideAnkiAnswer = useSettingsStore((state) => state.ankiHideAnswerCompletely);
  const showAnkiAlternatives = useSettingsStore((state) => state.ankiShowOtherAcceptedAnswersAndUserSynonyms);
  const showAnkiReplay = useSettingsStore((state) => state.ankiShowReplayAudioButton);
  const ankiButtonless = useSettingsStore((state) => state.ankiButtonlessMode);
  const ankiGroup = useSettingsStore((state) => state.ankiGroupQuestions);
  const searchEnabled = useSettingsStore((state) => state.reviewSearchButtonEnabled);
  const inputScale = useSettingsStore((state) => state.reviewInputFontScale) ?? 1;
  const characterScale = useSettingsStore((state) => state.reviewCharacterFontScale) ?? 1;
  const hideFurigana = useSettingsStore(state => state.bunproHideFurigana) ?? false;
  const showDetailsOnWrong = useSettingsStore(state => state.showDetailsOnWrongAnswer);
  const showPauseDetails = useSettingsStore(state => state.showAnswerStopSubjectDetails);
  const showLevel = useSettingsStore(state => state.showReviewItemLevelAndSrsStage);
  const showFrequency = useSettingsStore(state => state.showVocabularyFrequency);
  const showContext = useSettingsStore(state => state.showVocabContextSentencesInReviews);
  const feedbackSounds = useSettingsStore(state => state.answerFeedbackSoundEnabled);
  const voiceEnabled = useSettingsStore(state => state.voiceReviewAnswersEnabled);
  const shortcutsEnabled = useSettingsStore(state => state.reviewKeyboardShortcutsEnabled) ?? true;
  const studyKeys = useSettingsStore(state => state.bunproStudyShortcuts) ?? DEFAULT_STUDY_SHORTCUTS;
  const showAnkiParts = useSettingsStore(state => state.ankiShowWaniKaniGrammarTags);
  const showAnkiPitchNumber = useSettingsStore(state => state.ankiShowPitchAccentNumbers);
  const showAnkiPitchGraph = useSettingsStore(state => state.ankiShowPitchAccentGraph);
  const [progression, setProgression] = useState<BunproProgression | null>(null);
  const [detailsOverride, setDetailsOverride] = useState<boolean | null>(null);
  const [contextOpen, setContextOpen] = useState(false);
  const [reviewSettingsOpen, setReviewSettingsOpen] = useState(false);
  const [ankiRevealed, setAnkiRevealed] = useState(false);
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const inputRef = useRef<KanaInputHandle>(null);
  const audio = useBunproAudio();
  const stopActiveSound = audio.stop;
  const playBunproAudio = audio.play;
  const screenFocused = useOptionalScreenIsFocused();
  const isActive = screenFocused && mixed?.active !== false;
  const activeRef = useRef(isActive);
  activeRef.current = isActive;
  const mixedRef = useRef(mixed);
  mixedRef.current = mixed;
  const sessionStartedAt = useRef(Date.now());
  const sessionGenerationRef = useRef(0);
  const committedOccurrenceRef = useRef<string | null>(null);
  const processedIdsRef = useRef(new Set<string>());
  const savedProgressionsRef = useRef(new Map<string, BunproProgression>());
  const latestCompletedKeyRef = useRef("");
  const savedStagesRef = useRef(new Map<string, string>());
  const pendingWrapupIdsRef = useRef(new Set<string>());
  const retryScheduleRef = useRef(createReviewRetrySchedule());
  const [wrappedUp, setWrappedUp] = useState(false);
  const unconfirmedRef = useRef(new Map<string, string>());
  const localSavePolicyRef = useRef(createBunproReviewSavePolicy());
  const savePolicy = sharedSavePolicy ?? localSavePolicyRef.current;
  const [outboxState, setOutboxState] = useState<BunproOutboxState>({ pending: 0, saving: false, failure: null, title: "" });
  const [outbox] = useState(() => createBunproReviewOutbox(savePolicy, setOutboxState));
  const sessionLimitRef = useRef(Infinity);
  const appliedWrapUpRef = useRef<number | null>(null);
  const promptScrollRef = useRef<ScrollView>(null);
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
  const promotedDraftsRef = useRef(new Map<string, string>());
  const inputValueRef = useRef(inputValue);
  inputValueRef.current = inputValue;
  const [isLoading, setIsLoading] = useState(!hasExternalQueue);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveFailure, setSaveFailure] = useState<BunproReviewSaveFailure | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [hintLevel, setHintLevel] = useState(2);
  const [previousAnswer, setPreviousAnswer] = useState<MixedReviewAnswer | null>(null);
  const isPlayingAudio = Boolean(audio.playingKey || audio.loadingKey);
  const [pendingOutcome, setPendingOutcome] = useState<PendingOutcome | null>(null);
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

  const clearReviewInput = useCallback((nextText = "") => {
    inputRef.current?.clearInput();
    inputRef.current?.setInputText?.(nextText);
    inputValueRef.current = nextText;
    setInputValue(nextText);
    if (!nextText) setInputResetSignal((previousValue) => previousValue + 1);
  }, []);

  const handleBack = useCallback(() => {
    if (commitLockRef.current || outbox.snapshot().pending) return;
    void stopActiveSound();
    if (mixedRef.current) { mixedRef.current.onExit(); return; }
    if (onBack) {
      onBack();
      return;
    }

    router.back();
  }, [onBack, router, stopActiveSound, outbox]);

  useEffect(() => {
    return () => {
      sessionGenerationRef.current += 1;
      outbox.reset();
      void stopActiveSound();
    };
  }, [stopActiveSound, outbox]);

  const loadQueue = useCallback(async () => {
    if (hasExternalQueue) {
      return;
    }

    const generation = ++sessionGenerationRef.current;
    outbox.reset();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await getBunproReviewQuizIndex({
        onlyReview: onlyReviewFilter,
      });
      if (generation !== sessionGenerationRef.current) return;
      const preferences = reviewPreferencesRef.current;
      const limit = preferences.reviewBatchSizeEnabled ? Math.max(1, preferences.reviewBatchSize || 50) : Infinity;
      const nextQueue = orderBunproReviews(buildReviewQueue(response), preferences.reviewOrder).slice(0, limit);
      if (!Number.isInteger(response.review_session_id) || response.review_session_id <= 0) {
        throw new Error("Bunpro did not return a valid review session. Please try again.");
      }
      if (!nextQueue.length && readPendingTotal(response) > 0) {
        throw new Error("Bunpro reports pending reviews but returned no questions. Please try again.");
      }
      sessionStartedAt.current = Date.now();
      processedIdsRef.current.clear();
      pendingWrapupIdsRef.current.clear();
      savedProgressionsRef.current.clear();
      savedStagesRef.current.clear();
      latestCompletedKeyRef.current = "";
      setProgression(null);
      retryScheduleRef.current = createReviewRetrySchedule();
      setWrappedUp(false);
      unconfirmedRef.current.clear();
      setSaveFailure(null);
      localSavePolicyRef.current.succeeded();
      commitLockRef.current = false;
      setIsSubmitting(false);
      committedOccurrenceRef.current = null;
      sessionLimitRef.current = limit;
      setMasteryRepeatReviewIds([]);
      setQueue(nextQueue);
      setLoadedReviewTotal(Math.min(limit, Math.max(nextQueue.length, readPendingTotal(response))));
      setReviewSessionId(response.review_session_id ?? null);
      setCurrentIndex(0);
      setCorrectCount(0);
      setIncorrectCount(0);
      setIsLoadingMoreReviews(false);
      setReviewResults([]);
      setPreviousAnswer(null);
      clearReviewInput();
      setHintLevel(2);
      setAnkiRevealed(false);
    } catch (error) {
      if (generation !== sessionGenerationRef.current) return;
      setErrorMessage(formatBunproError(error));
      setIsLoadingMoreReviews(false);
    } finally {
      if (generation === sessionGenerationRef.current) setIsLoading(false);
    }
  }, [clearReviewInput, hasExternalQueue, onlyReviewFilter, outbox]);

  useEffect(() => {
    if (!hasExternalQueue) {
      return;
    }

    sessionGenerationRef.current += 1;
    outbox.reset();
    processedIdsRef.current.clear();
      pendingWrapupIdsRef.current.clear();
      savedProgressionsRef.current.clear();
      savedStagesRef.current.clear();
      latestCompletedKeyRef.current = "";
      setProgression(null);
      retryScheduleRef.current = createReviewRetrySchedule();
      setWrappedUp(false);
    unconfirmedRef.current.clear();
    setSaveFailure(null);
    localSavePolicyRef.current.succeeded();
    commitLockRef.current = false;
    setIsSubmitting(false);
    committedOccurrenceRef.current = null;
    sessionLimitRef.current = Infinity;
    setQueue(initialQueue ?? []);
    setLoadedReviewTotal(initialQueue?.length ?? 0);
    setReviewSessionId(initialReviewSessionId ?? null);
    setCurrentIndex(0);
    setCorrectCount(0);
    setIncorrectCount(0);
    setErrorMessage(initialQueue?.length && (!initialReviewSessionId || initialReviewSessionId <= 0)
      ? "Bunpro did not return a valid review session. Please restart these lessons." : null);
    setIsLoadingMoreReviews(false);
    setReviewResults([]);
    setPreviousAnswer(null);
    setPendingOutcome(null);

    setShowAlternatives(false);
    setReviewFeedback(null);
    setMasteryRepeatReviewIds([]);
    setHintLevel(2);
    setIsLoading(false);
    clearReviewInput();
  }, [clearReviewInput, hasExternalQueue, initialQueue, initialReviewSessionId, outbox]);

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
  const currentReviewType = currentItem ? getBunproReviewType(currentItem) : "review";
  const reviewableType = sanitizeText(currentReviewAttributes?.reviewable_type);

  const studyQuestionRelation = currentReviewType === "self_study_review"
    ? currentItem?.data?.relationships?.user_study_question?.data
    : currentItem?.data?.relationships?.study_question?.data;
  const userStudyQuestionId = currentReviewAttributes?.user_study_question_id;
  const studyQuestionId = studyQuestionRelation?.id ?? (currentReviewType === "self_study_review" && (typeof userStudyQuestionId === "number" || typeof userStudyQuestionId === "string") ? String(userStudyQuestionId) : undefined);
  const studyQuestionResource = getIncludedResource(
    currentItem?.included,
    studyQuestionId,
    currentReviewType === "self_study_review" ? "user_study_question" : studyQuestionRelation?.type ?? "study_question"
  );
  const studyQuestionAttributes = useMemo(
    () =>
      ((studyQuestionResource?.attributes ?? {}) as BunproStudyQuestionAttributes &
        Record<string, unknown>),
    [studyQuestionResource?.attributes]
  );

  const questionSentence = sanitizeQuestionContent(studyQuestionAttributes.content);
  const questionParts = useMemo(() => questionSentence.split(/(?:_{2,}|＿{2,})/g).map(part => parseFuriganaRuns(part)), [questionSentence]);
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
  const questionError = currentItem && (!studyQuestionResource || !canonicalAnswer || !questionSentence.trim())
    ? "Bunpro did not provide a complete question. Go back and reopen these reviews to try again."
    : null;
  const currentReviewIdString = currentItem ? getBunproReviewKey(currentItem) : "";
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
  const reviewableKind = reviewableRelation?.type === "grammar_point" || reviewableType === "GrammarPoint" ? "grammar" : "vocab";
  const questionKind = reviewableKind === "vocab" && canonicalAnswer && !/[\u3040-\u30ff\u3400-\u9fff]/u.test(canonicalAnswer) ? "meaning" : "reading";
  const selfAssessment = Boolean(ankiEnabled && (!ankiScope || ankiScope === "both" || ankiScope === questionKind));
  const answerRevealed = Boolean(pendingOutcome || (selfAssessment && ankiRevealed));
  const normalizeCurrentAnswer = (value: string) => questionKind === "meaning"
    ? value.trim().toLocaleLowerCase().replace(/[.!?]+$/g, "").replace(/\s+/g, " ")
    : normalizeAnswer(value);
  const occurrenceId = `${currentIndex}:${currentReviewIdString}:${studyQuestionId ?? ""}`;
  const jitaiFamily = useBunproJitaiFont(`bunpro:${currentReviewIdString}`);
  const voice = useBunproVoiceAnswer({ enabled: voiceEnabled && isActive && !pendingOutcome && !selfAssessment && !isSubmitting && !reviewSettingsOpen, questionKey: occurrenceId, language: questionKind === "meaning" ? "en-US" : "ja-JP", onAnswer: text => { inputRef.current?.setInputText?.(text); inputValueRef.current = text; setInputValue(text); } });
  const answerAlreadySaved = processedIdsRef.current.has(currentReviewIdString);
  const paused = Boolean(pendingOutcome && (pendingOutcome.correct ? pauseOnCorrect : pauseOnWrong));
  const detailsOpen = Boolean(answerRevealed && (detailsOverride ?? ((pendingOutcome && !pendingOutcome.correct && showDetailsOnWrong) || (paused && showPauseDetails))));
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

  const firstCorrectRequired = submissionContext === "learn" || (currentReviewType === "review" && currentReviewAttributes?.streak === 0);
  const pendingFirstAnswer = Boolean(pendingOutcome && !processedIdsRef.current.has(currentReviewIdString) && (!firstCorrectRequired || pendingOutcome.correct));
  const answerAccuracy = { correct: correctCount + (pendingFirstAnswer && pendingOutcome?.correct ? 1 : 0), answered: correctCount + incorrectCount + (pendingFirstAnswer ? 1 : 0) };
  const totalItems = queue.length;
  const displayTotalItems = loadedReviewTotal;
  const displayCurrentItem = Math.min(
    Math.max(0, correctCount + incorrectCount - masteryRepeatReviewIds.filter(id => processedIdsRef.current.has(id)).length) + 1,
    Math.max(1, displayTotalItems)
  );
  const isWaitingForMoreReviews =
    !hasExternalQueue && isLoadingMoreReviews && totalItems > 0 && currentIndex >= totalItems;
  const isComplete = totalItems > 0 && currentIndex >= totalItems && !isWaitingForMoreReviews;

  useLayoutEffect(() => {
    setPendingOutcome(null);
    setDetailsOverride(null);
    setContextOpen(false);
    setSaveFailure(null);

    setShowAlternatives(false);
    setReviewFeedback(null);
    const draft = promotedDraftsRef.current.get(currentReviewIdString);
    promotedDraftsRef.current.delete(currentReviewIdString);
    clearReviewInput(draft ?? "");
    void stopActiveSound();
    promptScrollRef.current?.scrollTo({ y: 0, animated: false });
    setHintLevel(2);
    setAnkiRevealed(false);
  }, [clearReviewInput, occurrenceId, currentReviewIdString, stopActiveSound]);

  useLayoutEffect(() => {
    if (!isActive) { void stopActiveSound(); return; }
    if (selfAssessment) { Keyboard.dismiss(); return; }
    inputRef.current?.setInputText?.(inputValueRef.current);
    inputRef.current?.focus();
  }, [isActive, occurrenceId, stopActiveSound, selfAssessment]);

  const playCurrentAudio = useCallback(async () => {
    if (!activeRef.current) return;
    await playBunproAudio(occurrenceId, bunproAudioUrls(studyQuestionAttributes, audioVoice), audioVoice === "both");
  }, [playBunproAudio, occurrenceId, studyQuestionAttributes, audioVoice]);

  useEffect(() => {
    mixedRef.current?.reportSaving?.(isSubmitting || outboxState.pending > 0);
  }, [isSubmitting, outboxState.pending]);
  useEffect(() => {
    mixedRef.current?.reportError(outboxState.failure?.message ?? errorMessage ?? questionError);
  }, [errorMessage, questionError, outboxState.failure]);
  useEffect(() => {
    if (isLoading || (errorMessage && !queue.length)) return;
    mixedRef.current?.report(currentItem
      ? { id: occurrenceId, retryKey: currentReviewIdString,
          pending: queue.slice(currentIndex).map(item => ({ id: getBunproReviewKey(item), subjectId: getBunproReviewKey(item), open: masteryRepeatReviewIds.includes(getBunproReviewKey(item)) || pendingWrapupIdsRef.current.has(getBunproReviewKey(item)) })),
          activate: id => {
            promotedDraftsRef.current.set(currentReviewIdString, inputValueRef.current);
            setQueue(items => {
              const remaining = items.slice(currentIndex);
              const chosen = remaining.find(item => getBunproReviewKey(item) === id);
              return !chosen || chosen === remaining[0] ? items : [...items.slice(0, currentIndex), chosen, ...remaining.filter(item => item !== chosen)];
            });
          }, remaining: Math.max(queue.length - currentIndex, loadedReviewTotal - correctCount - incorrectCount), ...(isMasteryRepeat && immediateRetry ? { keepTurn: true } : {}) }
      : outboxState.pending > 0 ? { id: `saving:${occurrenceId}`, ready: false } : null);
  }, [isLoading, occurrenceId, currentItem, isMasteryRepeat, immediateRetry, errorMessage, queue.length, currentIndex, loadedReviewTotal, correctCount, incorrectCount, outboxState.pending, currentReviewIdString, masteryRepeatReviewIds, queue]);
  useEffect(() => {
    const completed = correctCount + incorrectCount - masteryRepeatReviewIds.filter(id => processedIdsRef.current.has(id)).length;
    mixedRef.current?.reportProgress({ completed, total: loadedReviewTotal });
    mixedRef.current?.reportAccuracy({ correct: answerAccuracy.correct, answered: answerAccuracy.answered });
  }, [correctCount, incorrectCount, masteryRepeatReviewIds, loadedReviewTotal, answerAccuracy.correct, answerAccuracy.answered]);
  useEffect(() => {
    if (!progression) return;
    const timer = setTimeout(() => setProgression(null), 3000);
    return () => clearTimeout(timer);
  }, [progression]);
  const previousOrder = useRef(reviewOrder);
  useEffect(() => {
    if (previousOrder.current === reviewOrder) return;
    previousOrder.current = reviewOrder;
    setQueue(items => [...items.slice(0, currentIndex + 1), ...orderBunproReviews(items.slice(currentIndex + 1), reviewOrder)]);
  }, [reviewOrder, currentIndex]);
  const publishProgression = (key: string) => {
    const value = savedProgressionsRef.current.get(key);
    if (!value?.to || latestCompletedKeyRef.current !== key) return;
    if (mixedRef.current?.reportBunproProgression) mixedRef.current.reportBunproProgression(value);
    else setProgression(value);
  };
  const reportProgression = (response: unknown, correct: boolean, publish = true) => {
    if (currentReviewType !== "review") return;
    const value = bunproProgression(currentReviewIdString, reviewableTitle || canonicalAnswer, currentReviewAttributes, response);
    if (value.to) savedStagesRef.current.set(currentReviewIdString, value.to);
    if (correct && value.to) {
      savedProgressionsRef.current.set(currentReviewIdString, value);
      if (publish) publishProgression(currentReviewIdString);
    }
  };
  const wrapUpSize = useSettingsStore(state => state.reviewWrapUpTargetSubjects) || 10;
  const wrapUp = (limit = wrapUpSize) => {
    const open = new Set(masteryRepeatReviewIds);
    if (currentItem && isActive) open.add(currentReviewIdString);
    const retained = retainWrapUpReviews(queue.slice(currentIndex), open, getBunproReviewKey, Math.max(0, limit));
    const pending = retained.filter(item => !processedIdsRef.current.has(getBunproReviewKey(item))).length;
    sessionLimitRef.current = processedIdsRef.current.size + pending;
    setLoadedReviewTotal(sessionLimitRef.current);
    setQueue(items => [...items.slice(0, currentIndex), ...retained]);
    setWrappedUp(true);
  };
  const wrapUpRequest = mixed?.wrapUpRequest;
  useEffect(() => {
    if (!wrapUpRequest || isLoading || isSubmitting || appliedWrapUpRef.current === wrapUpRequest.id) return;
    appliedWrapUpRef.current = wrapUpRequest.id;
    wrapUp(wrapUpRequest.limit);
    // Apply once; later answers must not shorten the retained queue again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrapUpRequest, isLoading, isSubmitting]);

  const submitCurrentAnswer = async (continueWithoutSaving = false, gradedOutcome?: PendingOutcome): Promise<void> => {
    if (
      !activeRef.current ||
      questionError ||
      outbox.snapshot().failure ||
      committedOccurrenceRef.current === occurrenceId ||
      !currentItem ||
      !currentReviewId ||
      !reviewSessionId ||
      isSubmitting ||
      commitLockRef.current
    ) {
      return;
    }
    if (continueWithoutSaving && (!saveFailure || saveFailure.pause)) return;

    const resolvedOutcome = gradedOutcome ?? pendingOutcome;
    if (!resolvedOutcome) {
      const flushedInput = inputRef.current?.flushKana() ?? inputValue;
      const enteredText = flushedInput.trim();
      if (!enteredText) {
        return;
      }

      setInputValue(flushedInput);

      const normalizedInput = normalizeCurrentAnswer(flushedInput);
      const acceptedAnswers = questionKind === "meaning"
        ? [canonicalAnswer, studyQuestionAttributes.answer, ...alternativeAnswers]
            .filter((value): value is string => typeof value === "string")
            .map(normalizeCurrentAnswer)
        : collectAcceptedAnswers(studyQuestionAttributes);
      const correct = normalizedInput.length > 0 && acceptedAnswers.includes(normalizedInput);
      const feedbackKey = normalizeAnswer(flushedInput);
      const alternateFeedbackMessage =
        normalizedInput.length > 0 ? alternateAnswerFeedback.get(feedbackKey) : undefined;
      const wrongFeedbackMessage =
        normalizedInput.length > 0 ? wrongAnswerFeedback.get(feedbackKey) : undefined;

      setErrorMessage(null);

      if (!correct && alternateFeedbackMessage) {
        setReviewFeedback({
          kind: "warning",
          message: alternateFeedbackMessage,
        });
        return;
      }

      const graded = {
        correct,
        enteredText,
        stageLabel: extractStageLabelFromSubmission(null, currentReviewAttributes, currentReviewType),
      };
      setPendingOutcome(graded);
      setReviewFeedback(
        !correct && wrongFeedbackMessage
          ? {
              kind: "error",
              message: wrongFeedbackMessage,
            }
          : null
      );
      setDetailsOverride(null);

      setShowAlternatives(false);
      if (feedbackSounds) void playBunproFeedback(correct);
      void Haptics.notificationAsync(correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
      if (autoplayAudio && (correct || pauseOnWrong)) void playCurrentAudio();
      return;
    }

    voice.stop();
    setDetailsOverride(false);
    const generation = sessionGenerationRef.current;
    const remainingLoadedQueue = queue.slice(currentIndex).filter((item) => !processedIdsRef.current.has(getBunproReviewKey(item)));
    const shouldRequestMoreReviews = submissionContext === "review" && !hasExternalQueue &&
      processedIdsRef.current.size + remainingLoadedQueue.length < sessionLimitRef.current &&
      remainingLoadedQueue.length <= 1;
    const itemOnlyReview = submissionContext === "learn" ? null : onlyReviewFilter ?? (reviewableType || null);
    const outcome = resolvedOutcome;
    // Keep a loaded next question interactive while its predecessor saves.
    // Mixed sessions can hand off their last loaded answer too, but report a
    // pending head until persistence completes so results cannot finish early.
    const canHandOffLastMixedAnswer = mixed &&
      processedIdsRef.current.size + 1 >= Math.min(loadedReviewTotal, sessionLimitRef.current);
    if (outcome.correct && !pauseOnCorrect && !continueWithoutSaving &&
        (currentIndex + 1 < queue.length || canHandOffLastMixedAnswer) && !processedIdsRef.current.has(currentReviewIdString)) {
      committedOccurrenceRef.current = occurrenceId;
      processedIdsRef.current.add(currentReviewIdString);
      setCorrectCount((count) => count + 1);
      const result: BunproReviewResultItem = {
        reviewId: currentReviewIdString, reviewableKind, reviewableSlug, reviewableTitle,
        reviewableMeaning, reviewableLevel, audioSources: { female_audio_url: studyQuestionAttributes.female_audio_url, male_audio_url: studyQuestionAttributes.male_audio_url }, question: questionSentence, translation: translationText,
        tenseHint, enteredAnswer: outcome.enteredText, correctAnswer: canonicalAnswer,
        wasCorrect: true, previousStage: bunproStage(currentReviewAttributes).label, stageLabel: "", saveStatus: "pending",
      };
      setReviewResults((results) => [...results, result]);
      const answer: MixedReviewAnswer = {
        id: `bunpro:${currentReviewIdString}`, source: "bunpro" as const,
        title: reviewableTitle || canonicalAnswer, correct: true,
        meaning: reviewableMeaning, question: questionSentence, translation: translationText, enteredAnswer: outcome.enteredText, correctAnswer: canonicalAnswer,
        previousStage: bunproStage(currentReviewAttributes).label,
        audioSources: { female_audio_url: studyQuestionAttributes.female_audio_url, male_audio_url: studyQuestionAttributes.male_audio_url },
        ...(reviewableSlug ? { bunproSubject: { kind: reviewableKind, slug: reviewableSlug } } : {}),
      };
      latestCompletedKeyRef.current = currentReviewIdString;
      setPreviousAnswer({ ...answer, saveStatus: "pending" });
      mixedRef.current?.onAnswer({ ...answer, saveStatus: "pending" });
      outbox.enqueue({
        title: answer.title,
        save: async () => {
          const response = await updateBunproReview({ reviewId: currentReviewId, reviewType: currentReviewType, payload: {
            review_session_id: reviewSessionId, correct: true, fsrs_input: null,
            loaded_review_ids: null, loaded_ghost_review_ids: null, loaded_self_study_review_ids: null,
            deck_id: null, only_review: itemOnlyReview,
          } });
          if (generation !== sessionGenerationRef.current) return;
          reportProgression(response, true);
          setReviewResults((results) => results.map((value) => value.reviewId === result.reviewId
            ? { ...value, saveStatus: "saved", stageLabel: extractStageLabelFromSubmission(response, null, currentReviewType) } : value));
          mixedRef.current?.onSaveSettled?.({ ...answer, saveStatus: "saved", stage: extractStageLabelFromSubmission(response, null, currentReviewType) });
        },
        skip: (message) => {
          unconfirmedRef.current.set(currentReviewIdString, message);
          setReviewResults((results) => results.map((value) => value.reviewId === result.reviewId
            ? { ...value, saveStatus: "unconfirmed", saveError: message } : value));
          mixedRef.current?.onSaveSettled?.({ ...answer, saveStatus: "unconfirmed", saveError: message });
        },
      });
      clearReviewInput();
      setCurrentIndex((index) => index + 1);
      setPendingOutcome(null);

      setShowAlternatives(false);
      setReviewFeedback(null);
      void stopActiveSound();
      return;
    }
    commitLockRef.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);
    void stopActiveSound();

    let savingGrade = false;
    try {
      if (outbox.snapshot().pending && !await outbox.drain()) return;
      if (generation !== sessionGenerationRef.current) return;
      let updatedQueue = queue;
      const wasProcessed = processedIdsRef.current.has(currentReviewIdString);
      const needsFirstCorrect = submissionContext === "learn" || (currentReviewType === "review" && currentReviewAttributes?.streak === 0);
      const completingWrapup = wasProcessed && outcome.correct && pendingWrapupIdsRef.current.has(currentReviewIdString);
      if ((!wasProcessed && (!needsFirstCorrect || outcome.correct)) || completingWrapup) {
        savingGrade = !continueWithoutSaving;
        const loadedIds = getBunproLoadedReviewIds(remainingLoadedQueue);
        const response = continueWithoutSaving ? null : await updateBunproReview({
          reviewId: currentReviewId,
          reviewType: currentReviewType,
          payload: {
            review_session_id: reviewSessionId,
            correct: outcome.correct,
            fsrs_input: null,
            loaded_review_ids: shouldRequestMoreReviews ? loadedIds.loaded_review_ids : null,
            loaded_ghost_review_ids: shouldRequestMoreReviews ? loadedIds.loaded_ghost_review_ids : null,
            loaded_self_study_review_ids: shouldRequestMoreReviews ? loadedIds.loaded_self_study_review_ids : null,
            deck_id: null,
            only_review: itemOnlyReview,
          },
        });
        savingGrade = false;
        if (generation !== sessionGenerationRef.current) return;
        if (continueWithoutSaving) unconfirmedRef.current.set(currentReviewIdString, errorMessage ?? "Bunpro review could not be saved.");
        else { savePolicy.succeeded(); reportProgression(response, outcome.correct, false); }
        setSaveFailure(null);
        // Remember saved answers and explicit skips before fetching another page.
        // A page-load retry must not submit either answer again.
        processedIdsRef.current.add(currentReviewIdString);
        if (!continueWithoutSaving && !outcome.correct) pendingWrapupIdsRef.current.add(currentReviewIdString);
        else pendingWrapupIdsRef.current.delete(currentReviewIdString);
        if (!completingWrapup && outcome.correct) setCorrectCount((count) => count + 1);
        else if (!completingWrapup) setIncorrectCount((count) => count + 1);
        const result: BunproReviewResultItem = {
          reviewId: currentReviewIdString, reviewableKind, reviewableSlug, reviewableTitle,
          reviewableMeaning, reviewableLevel, audioSources: { female_audio_url: studyQuestionAttributes.female_audio_url, male_audio_url: studyQuestionAttributes.male_audio_url }, question: questionSentence,
          translation: translationText, tenseHint, enteredAnswer: outcome.enteredText,
          correctAnswer: canonicalAnswer, wasCorrect: outcome.correct,
          previousStage: bunproStage(currentReviewAttributes).label,
          stageLabel: continueWithoutSaving ? "" : extractStageLabelFromSubmission(response, null, currentReviewType),
          saveStatus: continueWithoutSaving ? "unconfirmed" : "saved",
          ...(continueWithoutSaving ? { saveError: errorMessage ?? undefined } : {}),
        };
        setReviewResults(results => completingWrapup
          ? results.map(previous => previous.reviewId === result.reviewId ? { ...previous, stageLabel: result.stageLabel || previous.stageLabel, saveStatus: result.saveStatus, saveError: result.saveError } : previous)
          : [...results, result]);
        if (!hasExternalQueue && submissionContext === "review") {
          const fresh = orderBunproReviews(buildReviewQueue(response ?? {}), reviewPreferencesRef.current.reviewOrder);
          const availableSlots = sessionLimitRef.current - new Set(queue.map((item) => getBunproReviewKey(item))).size;
          const knownIds = new Set(queue.map((item) => getBunproReviewKey(item)));
          updatedQueue = mergeReviewQueueItems(queue, fresh.filter((item) => !knownIds.has(getBunproReviewKey(item))).slice(0, Math.max(0, availableSlots)));
          setQueue(updatedQueue);
        }
      }

      const retryRandom = Math.random();
      let nextItems = updatedQueue.slice(currentIndex + 1);
      if (!outcome.correct) nextItems = immediateRetry ? [currentItem, ...nextItems] : insertReviewRetry(nextItems, [currentItem], { random: retryRandom });
      if (!hasExternalQueue && submissionContext === "review" && !nextItems.length &&
          processedIdsRef.current.size < Math.min(loadedReviewTotal, sessionLimitRef.current)) {
        setIsLoadingMoreReviews(true);
        const more = await getBunproReviewQuizIndex({ onlyReview: onlyReviewFilter });
        if (generation !== sessionGenerationRef.current) return;
        if (!Number.isInteger(more.review_session_id) || more.review_session_id <= 0) {
          throw new Error("Could not load the next review batch. Tap Next to retry.");
        }
        const page = buildReviewQueue(more);
        const remaining = Math.max(0, readPendingTotal(more) - page.filter((item) => processedIdsRef.current.has(getBunproReviewKey(item))).length);
        nextItems = orderBunproReviews(page, reviewPreferencesRef.current.reviewOrder).filter((item) => !processedIdsRef.current.has(getBunproReviewKey(item))).slice(0, Math.max(0, sessionLimitRef.current - processedIdsRef.current.size));
        if (!nextItems.length && remaining > 0) {
          throw new Error("Bunpro still has reviews pending but returned no new questions. Tap Next to retry.");
        }
        setReviewSessionId(more.review_session_id);
        setLoadedReviewTotal(Math.min(sessionLimitRef.current, processedIdsRef.current.size + Math.max(nextItems.length, remaining)));
      }
      retryScheduleRef.current = advanceReviewRetrySchedule(retryScheduleRef.current, [currentReviewIdString], outcome.correct, retryRandom);
      if (outcome.correct) {
        setMasteryRepeatReviewIds((ids) => ids.filter((id) => id !== currentReviewIdString));
      } else {
        setMasteryRepeatReviewIds((ids) => ids.includes(currentReviewIdString) ? ids : [...ids, currentReviewIdString]);
      }
      nextItems = orderReviewRetries(nextItems, new Set([...masteryRepeatReviewIds, ...(!outcome.correct ? [currentReviewIdString] : [])]), getBunproReviewKey, getBunproReviewKey, retryScheduleRef.current, immediateRetry);
      committedOccurrenceRef.current = occurrenceId;
      clearReviewInput();
      setQueue([...updatedQueue.slice(0, currentIndex + 1), ...nextItems]);
      setCurrentIndex((index) => index + 1);
      setPendingOutcome(null);

      setShowAlternatives(false);
      setReviewFeedback(null);
      const completedAnswer: MixedReviewAnswer = { id: `bunpro:${currentReviewIdString}`, source: "bunpro", title: reviewableTitle || canonicalAnswer, correct: outcome.correct, practiceOnly: firstCorrectRequired && !outcome.correct, meaning: reviewableMeaning, question: questionSentence, translation: translationText, enteredAnswer: outcome.enteredText, correctAnswer: canonicalAnswer, previousStage: bunproStage(currentReviewAttributes).label, stage: savedStagesRef.current.get(currentReviewIdString), audioSources: { female_audio_url: studyQuestionAttributes.female_audio_url, male_audio_url: studyQuestionAttributes.male_audio_url }, saveStatus: unconfirmedRef.current.has(currentReviewIdString) ? "unconfirmed" : "saved", saveError: unconfirmedRef.current.get(currentReviewIdString), ...(reviewableSlug ? { bunproSubject: { kind: reviewableKind, slug: reviewableSlug } } : {}) };
      latestCompletedKeyRef.current = currentReviewIdString;
      setPreviousAnswer(completedAnswer);
      mixedRef.current?.onAnswer(completedAnswer);
      if (outcome.correct) publishProgression(currentReviewIdString);
    } catch (error) {
      if (generation === sessionGenerationRef.current) {
        if (savingGrade) {
          setSaveFailure(savePolicy.failed(error));
          setErrorMessage(formatBunproError(error));
        } else {
          setErrorMessage(`${formatBunproError(error)} Your answer is kept. Tap Next to retry.`);
        }
      }
    } finally {
      if (generation === sessionGenerationRef.current) {
        commitLockRef.current = false;
        setIsSubmitting(false);
        setIsLoadingMoreReviews(false);
      }
    }
  };

  const advanceRef = useRef(submitCurrentAnswer);
  advanceRef.current = submitCurrentAnswer;
  useEffect(() => {
    if (detailsOpen || reviewSettingsOpen || selfAssessment || !pendingOutcome || !isActive || isSubmitting || saveFailure || outboxState.failure || errorMessage ||
        (pendingOutcome.correct ? pauseOnCorrect : pauseOnWrong) || isPlayingAudio || audio.error || showAlternatives) return;
    // Match the web app: show the verdict briefly, independently of save latency.
    const timer = setTimeout(() => { void advanceRef.current(); }, 350);
    return () => clearTimeout(timer);
  }, [detailsOpen, reviewSettingsOpen, selfAssessment, pendingOutcome, isActive, isSubmitting, saveFailure, outboxState.failure, errorMessage,
      pauseOnCorrect, pauseOnWrong, isPlayingAudio, audio.error, showAlternatives]);

  const skipCurrentQuestion = () => {
    if (!allowSkipping || commitLockRef.current || answerAlreadySaved || saveFailure || outboxState.failure || currentIndex + 1 >= queue.length) return;
    setQueue((items) => [...items.slice(0, currentIndex), ...items.slice(currentIndex + 1), items[currentIndex]]);
    setPendingOutcome(null);
    void stopActiveSound();
  };

  const handleShortcut = (key: string) => {
    if (!shortcutsEnabled || !isActive || reviewSettingsOpen || isSubmitting || saveFailure || outboxState.failure) return;
    const action = studyShortcutAction(key, studyKeys);
    if (action === "progress") { if (selfAssessment && !ankiRevealed) { setAnkiRevealed(true); if (autoplayAudio) void playCurrentAudio(); } else void submitCurrentAnswer(); return; }
    if (action === "hint" && reviewableKind === "grammar") setHintLevel(value => (value + 1) % 5);
    if (action === "skip") skipCurrentQuestion();
    if (!answerRevealed) return;
    if (action === "details") setDetailsOverride(!detailsOpen);
    if (action === "replayAudio" && hasAudio) void playCurrentAudio();
    if (action === "alternatives") setShowAlternatives(value => !value);
    if (action === "undo" && !answerAlreadySaved) { setPendingOutcome(null);  setShowAlternatives(false); setReviewFeedback(null); setDetailsOverride(null); clearReviewInput(); }
    if ((action === "markCorrect" || action === "markIncorrect") && (selfAssessment || !answerAlreadySaved)) {
      const outcome = { correct: action === "markCorrect", enteredText: pendingOutcome?.enteredText ?? canonicalAnswer, stageLabel: "" };
      setPendingOutcome(outcome); setDetailsOverride(null); if (feedbackSounds) void playBunproFeedback(outcome.correct); if (!selfAssessment || outcome.correct || !showDetailsOnWrong) void submitCurrentAnswer(false, outcome);
    }
  };

  const translatedPrompt = answerRevealed ? canonicalAnswer : inputValue.trim() || "　　";
  const statusColor = pendingOutcome
    ? pendingOutcome.correct
      ? BUNPRO_SUCCESS_COLOR
      : theme.error
    : accent;
  const isFrozenOnResult = Boolean(pendingOutcome);
  const thirdActionLabel = showAlternatives ? "Hide Alternatives" : "Alternatives";
  const thirdActionIcon = "reorder-three-outline";
  const isThirdActionDisabled = !pendingOutcome || isSubmitting;


  if (!isPortegoUser) {
    return (
      <SafeAreaView style={[styles.centeredContainer, { backgroundColor: theme.backgroundColor }]}>
        {isActive ? <StatusBar style={theme.statusBarStyle} /> : null}
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
        {isActive ? <StatusBar style={isDark ? "light" : "dark"} /> : null}
        <ActivityIndicator size="large" color={accent} />
        <Text style={[styles.loadingText, { color: mutedColor }]}>{loadingLabel}</Text>
      </SafeAreaView>
    );
  }

  if (errorMessage && totalItems === 0) {
    return (
      <SafeAreaView style={[styles.centeredContainer, { backgroundColor }]}>
        {isActive ? <StatusBar style={isDark ? "light" : "dark"} /> : null}
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
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back" onPress={handleBack} style={styles.iconButton}><Text style={{ color: theme.textColor }}>Back</Text></TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (totalItems === 0) {
    return (
      <SafeAreaView style={[styles.centeredContainer, { backgroundColor }]}>
        {isActive ? <StatusBar style={isDark ? "light" : "dark"} /> : null}
        <Ionicons name="checkmark-done-outline" size={32} color={accent} />
        <Text style={[styles.emptyTitle, { color: theme.textColor }]}>{emptyTitle}</Text>
        <Text style={[styles.emptySubtitle, { color: mutedColor }]}>
          {emptySubtitle ?? `You are all caught up for ${getModeLabel(mode)}.`}
        </Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back" onPress={handleBack} style={[styles.primaryButton, { backgroundColor: accent }]}><Text style={styles.primaryButtonText}>Back</Text></TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (isWaitingForMoreReviews) {
    return (
      <SafeAreaView style={[styles.centeredContainer, { backgroundColor }]}>
        {isActive ? <StatusBar style={isDark ? "light" : "dark"} /> : null}
        <ActivityIndicator size="large" color={accent} />
        <Text style={[styles.loadingText, { color: mutedColor }]}>
          Loading more Bunpro reviews...
        </Text>
      </SafeAreaView>
    );
  }

  if (isComplete && !mixed) {
    return (
      <BunproResultsScreen
        theme={theme}
        isDark={isDark}
        modeLabel={getModeLabel(mode)}
        results={reviewResults}
        correctCount={correctCount}
        incorrectCount={incorrectCount}
        totalItems={displayTotalItems}
        durationMs={Date.now() - sessionStartedAt.current}
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
    <SafeAreaView
      pointerEvents={mixed && !isActive ? "none" : "auto"}
      accessibilityElementsHidden={Boolean(mixed && !isActive)}
      importantForAccessibility={mixed && !isActive ? "no-hide-descendants" : "auto"}
      style={[styles.container, { backgroundColor }, mixed && !isActive && { ...StyleSheet.absoluteFillObject, opacity: 0 }]}
    >
      {isActive ? <StatusBar style={isDark ? "light" : "dark"} /> : null}

      <View style={[styles.header, { borderBottomColor: inputBorder }]}>
        <View style={styles.headerLeftGroup}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={mixed ? "Exit mixed reviews" : "Back"}
            disabled={isSubmitting}
            style={styles.iconButton}
            onPress={handleBack}
          >
            <Ionicons name="arrow-back-outline" size={24} color={theme.textColor} />
          </TouchableOpacity>
          {searchEnabled ? <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Search Bunpro"
            style={styles.iconButton}
            onPress={() => {
              router.push("/(app)/(bunpro-tabs)/bunpro-search");
            }}
          >
            <Ionicons name="search" size={23} color={theme.textColor} />
          </TouchableOpacity> : null}
        </View>

        <View style={styles.headerRightGroup}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Bunpro review settings" disabled={isSubmitting} style={styles.iconButton} onPress={() => { Keyboard.dismiss(); setReviewSettingsOpen(true); }}>
            <Ionicons name="settings-outline" size={23} color={theme.textColor} />
          </TouchableOpacity>
          {!mixed && pendingOutcome?.stageLabel && !saveFailure ? (
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
          <Text accessibilityLabel={mixed ? "Mixed review accuracy" : "Bunpro review accuracy"} style={[styles.headerStatsText, { color: mutedColor }]}>{(mixed?.accuracy ?? answerAccuracy).answered ? `${Math.round((mixed?.accuracy ?? answerAccuracy).correct / (mixed?.accuracy ?? answerAccuracy).answered * 100)}%` : "—"}</Text>
          <Text accessibilityLabel={mixed ? "Mixed review progress" : "Bunpro review progress"} style={[styles.headerStatsText, { color: mutedColor }]}>
            {mixed ? `${mixed.progress.completed}/${mixed.progress.total}` : `${displayCurrentItem}/${displayTotalItems}`}
          </Text>
          {submissionContext !== "learn" && !wrappedUp && !mixed?.wrapUpRequest && (mixed ? mixed.progress.total - mixed.progress.completed : queue.length - currentIndex) > wrapUpSize ? (
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={mixed ? "Wrap up mixed reviews" : `Wrap up ${wrapUpSize} Bunpro reviews`} disabled={isSubmitting} style={styles.iconButton} onPress={() => mixed ? mixed.onWrapUp() : wrapUp()}>
              <Ionicons name="stop-circle-outline" size={24} color={theme.textColor} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {!mixed ? <ReviewPreviousAnswerCard answer={previousAnswer} /> : null}
      <BunproReviewShortcuts enabled={shortcutsEnabled && isActive && !reviewSettingsOpen && selfAssessment} questionKey={occurrenceId} onKey={handleShortcut} />
      <BunproReviewSettingsSheet visible={reviewSettingsOpen} onClose={() => setReviewSettingsOpen(false)} />
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={promptScrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.promptArea}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.questionType, { color: accent }]}>
            {reviewableKind === "grammar" ? "Bunpro grammar" : "Bunpro vocabulary"} · {questionKind === "meaning" ? "Meaning" : "Reading"}{currentReviewType === "ghost_review" ? " · Ghost review" : currentReviewType === "self_study_review" ? " · Self-study review" : ""}{isMasteryRepeat ? " · Retry" : ""}
          </Text>
          {tenseHint ? (
            <Text accessibilityElementsHidden={hintLevel < 2 && !answerRevealed} importantForAccessibility={hintLevel < 2 && !answerRevealed ? "no-hide-descendants" : "auto"} style={[styles.tenseLabel, { color: mutedColor, opacity: hintLevel >= 2 || answerRevealed ? 1 : 0 }]}>{tenseHint}</Text>
          ) : null}

          <View style={styles.rubyLine}>
            {questionParts.map((runs, index) => <React.Fragment key={index}>
              {index > 0 ? <Text style={[styles.answerInline, { fontFamily: jitaiFamily, fontSize: 34 * characterScale, lineHeight: 46 * characterScale, borderBottomColor: statusColor, color: statusColor }]}>{translatedPrompt}</Text> : null}
              <RubyText runs={runs} hideFurigana={hideFurigana} questionKey={`${occurrenceId}:${index}`} baseTextStyle={[styles.japaneseSentenceBase, { color: theme.textColor, fontSize: 34 * characterScale, lineHeight: 46 * characterScale, fontFamily: jitaiFamily }]} readingTextStyle={[styles.japaneseSentenceReading, { color: mutedColor }]} />
            </React.Fragment>)}
          </View>

          {wordPrompt ? (
            <View accessibilityElementsHidden={hintLevel < 2 && !answerRevealed} importantForAccessibility={hintLevel < 2 && !answerRevealed ? "no-hide-descendants" : "auto"} style={[styles.rubyLine, styles.wordPromptLine, { opacity: hintLevel >= 2 || answerRevealed ? 1 : 0 }]}>
              <Text style={[styles.wordPromptParen, { color: mutedColor }]}>(</Text>
              <RubyText
                runs={wordPromptRuns}
                hideFurigana={hideFurigana}
                questionKey={occurrenceId}
                baseTextStyle={[styles.wordPromptBase, { color: mutedColor }]}
                readingTextStyle={[styles.wordPromptReading, { color: mutedColor }]}
              />
              <Text style={[styles.wordPromptParen, { color: mutedColor }]}>)</Text>
            </View>
          ) : null}

          {translationRuns.length > 0 ? (
            <Text accessibilityElementsHidden={!answerRevealed && (questionKind === "meaning" || hintLevel < 1)} importantForAccessibility={!answerRevealed && (questionKind === "meaning" || hintLevel < 1) ? "no-hide-descendants" : "auto"} style={[styles.translationText, { color: theme.textColor, opacity: answerRevealed || (questionKind !== "meaning" && hintLevel >= 1) ? 1 : 0 }]}>
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

          {reviewableKind === "grammar" && hintLevel >= 3 ? <View style={styles.hintPanel}>
            {hintLevel >= 4 && sanitizeText(reviewableAttributes.nuance) ? <Text style={{ color: theme.textColor }}>{sanitizeText(reviewableAttributes.nuance)}</Text> : null}
            {sanitizeText(reviewableAttributes.nuance_translation) ? <Text style={{ color: theme.textColor }}>{sanitizeText(reviewableAttributes.nuance_translation)}</Text> : null}
            {sanitizeText(studyQuestionAttributes.extra_info) ? <Text style={{ color: mutedColor }}>{sanitizeText(studyQuestionAttributes.extra_info)}</Text> : null}
          </View> : null}
          {pendingOutcome ? <><Text accessibilityLiveRegion="polite" style={[styles.feedbackText, { color: statusColor, marginTop: 12 }]}>{pendingOutcome.correct ? "Correct" : "Incorrect"}</Text>{!pendingOutcome.correct ? <Text selectable style={{ color: theme.textColor }}>The answer is {canonicalAnswer}.</Text> : null}</> : null}
          {showLevel ? <Text style={{ color: mutedColor }}>{reviewableLevel} · {bunproStage(currentReviewAttributes).label}</Text> : null}
          {showFrequency && reviewableKind === "vocab" && typeof reviewableAttributes.frequency_dictionary === "number" ? <Text style={{ color: mutedColor }}>Frequency: Top {reviewableAttributes.frequency_dictionary.toLocaleString()}</Text> : null}
          {showContext && reviewableKind === "vocab" ? <TouchableOpacity accessibilityRole="button" onPress={() => setContextOpen(!contextOpen)} style={{ minHeight: 44, padding: 12 }}><Text style={{ color: theme.textColor }}>{contextOpen ? "Hide context" : "Show context"}</Text></TouchableOpacity> : null}
          {contextOpen && reviewableKind === "vocab" ? <View style={{ height: 480 }}><BunproDetailsContent key={`context:${currentReviewIdString}`} kind="vocab" slug={reviewableSlug} active={isActive} initialTab="Context" /></View> : null}
          {voice.error ? <Text accessibilityRole="alert" style={{ color: theme.error }}>{voice.error}</Text> : null}
          {detailsOpen && reviewableSlug ? <View style={{ height: 480, width: "100%" }}><BunproDetailsContent key={`details:${currentReviewIdString}`} kind={reviewableKind} slug={reviewableSlug} review={currentReviewAttributes ?? undefined} active={isActive} /></View> : null}
          <BunproProgressionCard progression={mixed?.bunproProgression ?? progression} />
          {audio.error ? <Text accessibilityRole="alert" style={[styles.inlineError, { color: theme.error }]}>{audio.error}</Text> : null}

          {showAlternatives ? <View style={{ padding: 12, gap: 8 }}><Text style={{ color: theme.textColor, fontWeight: "600" }}>Accepted answers</Text><Text selectable style={{ color: theme.textColor }}>{[...new Set([canonicalAnswer, ...alternativeAnswers])].join(" ・ ")}</Text>{alternateAnswerFeedback.size ? <><Text style={{ color: theme.textColor, fontWeight: "600" }}>Other answers</Text>{[...alternateAnswerFeedback].map(([answer, feedback]) => <Text key={answer} selectable style={{ color: mutedColor }}>{answer}: {feedback}</Text>)}</> : null}</View> : null}

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

          {errorMessage || questionError ? (
            <Text accessibilityRole="alert" style={[styles.inlineError, { color: theme.error }]}>{errorMessage ?? questionError}</Text>
          ) : null}
          {saveFailure ? <Text style={[styles.inlineError, { color: theme.error }]}>{saveFailure.message}</Text> : null}
          {!saveFailure && unconfirmedRef.current.size ? <Text style={[styles.inlineError, { color: warningColor }]}>
            {unconfirmedRef.current.size} answer{unconfirmedRef.current.size === 1 ? " has" : "s have"} an unconfirmed save.
          </Text> : null}
        </ScrollView>

        <View style={styles.bottomArea}>
          {outboxState.pending > 0 && !outboxState.failure ? <Text accessibilityLiveRegion="polite" style={{ color: mutedColor }}>Saving {outboxState.pending} answer{outboxState.pending === 1 ? "" : "s"}…</Text> : null}
          {outboxState.failure ? <View accessibilityRole="alert">
            <Text style={{ color: theme.error }}>Could not save {outboxState.title}. {outboxState.failure.message}</Text>
            <View style={styles.saveActions}>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Retry previous save" style={[styles.saveActionButton, { borderColor: inputBorder }]} onPress={outbox.retry}>
                <Text style={{ color: theme.textColor }}>Retry save</Text>
              </TouchableOpacity>
              {!outboxState.failure.pause ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Continue without saving previous answer" style={[styles.saveActionButton, { borderColor: inputBorder }]} onPress={outbox.skip}>
                <Text style={{ color: theme.textColor }}>Continue without saving</Text>
              </TouchableOpacity> : null}
            </View>
          </View> : null}
          {saveFailure && pendingOutcome ? <View style={styles.saveActions}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Retry save" disabled={isSubmitting} onPress={() => { void submitCurrentAnswer(); }} style={[styles.saveActionButton, { borderColor: inputBorder }]}>
              <Text style={{ color: theme.textColor }}>Retry save</Text>
            </TouchableOpacity>
            {!saveFailure.pause ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Continue without saving" disabled={isSubmitting} onPress={() => { void submitCurrentAnswer(true); }} style={[styles.saveActionButton, { borderColor: inputBorder }]}>
              <Text style={{ color: theme.textColor }}>Continue without saving</Text>
            </TouchableOpacity> : null}
          </View> : null}
          <View style={styles.bottomActions}>
            {voiceEnabled && !pendingOutcome && !selfAssessment ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Answer with voice" disabled={voice.listening || isSubmitting} onPress={() => { void voice.start(); }} style={[styles.hintButton, { borderColor: inputBorder }]}><Text style={{ color: theme.textColor }}>{voice.listening ? "Listening…" : "Speak"}</Text></TouchableOpacity> : null}
            {reviewableKind === "grammar" ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Hint level ${hintLevel} of 4`} style={[styles.hintButton, { borderColor: inputBorder }]} onPress={() => setHintLevel((level) => (level + 1) % 5)}>
              <Ionicons name="bulb-outline" size={16} color={theme.textColor} />
              <Text style={[styles.hintButtonText, { color: theme.textColor }]}>Hint {"●".repeat(hintLevel)}{"○".repeat(4 - hintLevel)}</Text>
            </TouchableOpacity> : null}
            {allowSkipping && currentIndex + 1 < queue.length ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Skip Bunpro question" disabled={isSubmitting || answerAlreadySaved} style={[styles.hintButton, { borderColor: inputBorder }]} onPress={skipCurrentQuestion}>
              <Text style={{ color: theme.textColor }}>Skip</Text>
            </TouchableOpacity> : null}
            {pendingOutcome && !answerAlreadySaved ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={pendingOutcome.correct ? "Mark incorrect" : "Mark correct"} disabled={isSubmitting || Boolean(saveFailure)} style={[styles.hintButton, { borderColor: inputBorder }]} onPress={() => {
              if (!pendingOutcome) return;
              void submitCurrentAnswer(false, { ...pendingOutcome, correct: !pendingOutcome.correct });
            }}><Text style={{ color: theme.textColor }}>{pendingOutcome.correct ? "Mark incorrect" : "Mark correct"}</Text></TouchableOpacity> : null}
          </View>
          {isFrozenOnResult ? (
            <View style={styles.resultActionsRow}>
              <View style={styles.resultActionSlot}>
                <TouchableOpacity
                  activeOpacity={0.86}
                  style={[styles.resultActionButton, { borderColor: inputBorder, opacity: isSubmitting || answerAlreadySaved || saveFailure ? 0.5 : 1 }]}
                  disabled={isSubmitting || answerAlreadySaved || Boolean(saveFailure)}
                  onPress={() => {
                    if (commitLockRef.current || answerAlreadySaved || saveFailure) return;
                    setPendingOutcome(null);

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
                  onPress={() => setDetailsOverride(!detailsOpen)}
                  disabled={!reviewableSlug}
                >
                  <Ionicons name="information-circle-outline" size={17} color={theme.textColor} />
                  <Text style={[styles.resultActionButtonText, { color: theme.textColor }]}>{detailsOpen ? "Hide Info" : "Show Info"}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.resultActionSlot}>
                <TouchableOpacity
                  activeOpacity={0.86}
                  style={[styles.resultActionButton, { borderColor: inputBorder }]}
                  disabled={isThirdActionDisabled}
                  onPress={() => setShowAlternatives(value => !value)}
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
          ) : null}

          {selfAssessment ? <View style={{ gap: 12 }}>
            {!ankiRevealed ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Reveal Bunpro answer" disabled={!isActive || Boolean(questionError)} style={[styles.resultsDoneButton, { flexDirection: "column", paddingVertical: 12, backgroundColor: theme.cardBackground }]} onPress={() => { setAnkiRevealed(true); if (autoplayAudio) void playCurrentAudio(); }}>
              {!hideAnkiAnswer ? <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ overflow: "hidden", padding: 12 }}>
                <Text style={[styles.resultAnswerValue, { color: theme.textColor }]}>{canonicalAnswer}</Text>
                {Platform.OS === "ios" ? <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.cardBackground ?? backgroundColor }]} />}
              </View> : null}
              <Text style={{ color: theme.textColor }}>Show answer</Text>
            </TouchableOpacity> : <>
              <Text selectable style={[styles.resultAnswerValue, { color: theme.textColor, textAlign: "center" }]}>{canonicalAnswer}</Text>
              {ankiGroup && ankiScope === "both" ? <Text style={{ color: mutedColor, textAlign: "center" }}>{questionKind === "reading" ? reviewableMeaning : sanitizeText(reviewableAttributes.kana || reviewableAttributes.furigana)}</Text> : null}
              {showAnkiAlternatives && alternativeAnswers.length > 0 ? <Text style={{ color: mutedColor, textAlign: "center" }}>{alternativeAnswers.join(" · ")}</Text> : null}
              {showAnkiParts ? <Text style={{ color: mutedColor, textAlign: "center" }}>{Array.isArray(reviewableAttributes.jmdict_pos) ? reviewableAttributes.jmdict_pos.join(", ") : sanitizeText(reviewableAttributes.part_of_speech_translation)}</Text> : null}
              {showAnkiPitchNumber && typeof reviewableAttributes.pitch_accent_stress === "string" && reviewableAttributes.pitch_accent_stress.includes("HL") ? <Text style={{ color: mutedColor, textAlign: "center" }}>Pitch accent: [{reviewableAttributes.pitch_accent_stress.indexOf("HL") + 1}]</Text> : null}
              {showAnkiPitchGraph && typeof reviewableAttributes.pitch_accent_stress === "string" && reviewableAttributes.pitch_accent_stress.includes("HL") ? <PitchAccentVisualization reading={sanitizeText(reviewableAttributes.kana)} accents={[reviewableAttributes.pitch_accent_stress.indexOf("HL") + 1]} compact showHeader={false} /> : null}
              <TouchableOpacity accessibilityRole="button" onPress={() => setDetailsOverride(!detailsOpen)} style={{ padding: 12, minHeight: 44 }}><Text style={{ color: theme.textColor }}>{detailsOpen ? "Hide Info" : "Show Info"}</Text></TouchableOpacity>
              {showAnkiReplay && hasAudio ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Replay Bunpro answer" onPress={() => { void playCurrentAudio(); }} style={styles.resultAudioButton}><Ionicons name={isPlayingAudio ? "stop" : "volume-medium-outline"} size={22} color={theme.textColor} /></TouchableOpacity> : null}
              {pendingOutcome ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Next question" disabled={isSubmitting || Boolean(saveFailure)} onPress={() => { void submitCurrentAnswer(); }} style={styles.resultsDoneButton}><Text style={{ color: theme.textColor }}>Next</Text></TouchableOpacity> :
              <View style={styles.resultActionsRow}>
                {[false, true].map((correct) => <TouchableOpacity key={String(correct)} accessibilityRole="button" accessibilityLabel={correct ? "Mark Bunpro correct" : "Mark Bunpro incorrect"} disabled={!isActive || isSubmitting || Boolean(saveFailure) || Boolean(outboxState.failure)} style={[styles.resultActionSlot, styles.resultActionButton, { minHeight: ankiButtonless ? 100 : 50, borderColor: correct ? BUNPRO_SUCCESS_COLOR : theme.error }]} onPress={() => { const outcome = { correct, enteredText: canonicalAnswer, stageLabel: "" }; setPendingOutcome(outcome); setDetailsOverride(null); if (feedbackSounds) void playBunproFeedback(correct); void Haptics.notificationAsync(correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error); if (correct || !showDetailsOnWrong) void submitCurrentAnswer(false, outcome); }}>
                  <Ionicons name={correct ? "checkmark" : "close"} size={24} color={correct ? BUNPRO_SUCCESS_COLOR : theme.error} />
                  {!ankiButtonless ? <Text style={{ color: theme.textColor }}>{correct ? "Correct" : "Incorrect"}</Text> : null}
                </TouchableOpacity>)}
              </View>}
            </>}
          </View> : (
          <View testID="bunpro-answer-row" style={[styles.inputRow, {
            borderColor: isFrozenOnResult ? statusColor : inputBorder,
            backgroundColor: pendingOutcome?.correct ? BUNPRO_SUCCESS_SOFT[isDark ? "dark" : "light"] : undefined,
          }]}>
            {isFrozenOnResult && hasAudio ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={isPlayingAudio ? "Stop Bunpro audio" : "Play Bunpro audio"}
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
                if (commitLockRef.current || !activeRef.current || (answerAlreadySaved && !isMasteryRepeat) || saveFailure) {
                  inputRef.current?.setInputText?.(pendingOutcome?.enteredText ?? inputValueRef.current);
                  return;
                }
                inputValueRef.current = nextKana;
                setInputValue(nextKana);

                if (pendingOutcome) {
                  inputRef.current?.setInputText?.(pendingOutcome.enteredText);
                  setInputValue(pendingOutcome.enteredText);
                  return;
                }

                if (reviewFeedback) {
                  setReviewFeedback(null);
                }
              }}
              initialValue={inputValue}
              enableKanaConversion={questionKind === "reading"}
              useJapaneseKeyboard={questionKind === "reading" && autoSwitchKeyboard}
              preserveKeyboardOnHandoff={Boolean(mixed)}
              resetSignal={inputResetSignal}
              autoCorrect={false}
              autoCapitalize="none"
              accessibilityLabel="Bunpro answer"
              placeholder={questionKind === "meaning" ? "Type the meaning..." : "Type your answer..."}
              placeholderTextColor={mutedColor}
              style={[styles.answerInput, { fontSize: 22 * inputScale, lineHeight: 28 * inputScale, color: pendingOutcome?.correct ? theme.textColor : isFrozenOnResult ? statusColor : theme.textColor }]}
              returnKeyType="send"
              onKeyPress={event => { if (pendingOutcome) handleShortcut(event.nativeEvent.key); }}
              onSubmitEditing={() => {
                void submitCurrentAnswer();
              }}
              editable={!saveFailure && (!answerAlreadySaved || isMasteryRepeat || isSubmitting)}
              blurOnSubmit={false}
            />

            <TouchableOpacity
              disabled={isSubmitting || !isActive || !currentItem || Boolean(questionError) || Boolean(saveFailure) || Boolean(outboxState.failure)}
              accessibilityRole="button"
              accessibilityLabel={isFrozenOnResult ? "Next question" : "Check answer"}
              style={[styles.submitButton, pendingOutcome?.correct && { backgroundColor: BUNPRO_SUCCESS_COLOR }]}
              activeOpacity={0.82}
              onPress={() => {
                void submitCurrentAnswer();
              }}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={pendingOutcome?.correct ? "white" : accent} />
              ) : (
                <Ionicons
                  name={isFrozenOnResult ? "arrow-forward" : "paper-plane-outline"}
                  size={22}
                  color={pendingOutcome?.correct ? "white" : isFrozenOnResult ? statusColor : mutedColor}
                />
              )}
            </TouchableOpacity>
          </View>)}
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
  previousAnswer: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  questionType: { fontSize: 13, fontWeight: "600", marginBottom: 12, textAlign: "center" },
  promptArea: {
    flexGrow: 1,
    paddingVertical: 20,
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
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },
  saveActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  saveActionButton: {
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: "center",
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
    width: "100%",
    textAlign: "center",
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
  resultAudioButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "center",
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
