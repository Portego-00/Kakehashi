import * as wanakana from "wanakana";
import type { BunproJsonApiResource, BunproReviewQueueItem } from "../../../../src/types/bunpro";
export type { BunproReviewQueueItem, BunproReviewQuizIndexResponse, BunproReviewableDetailsResponse } from "../../../../src/types/bunpro";
export type ReviewMode = "all" | "grammar" | "vocab";
type ParsedQuestionSentence = { beforeBlank: string; afterBlank: string; hasBlank: boolean };
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

export function sanitizeQuestionContent(value: unknown): string {
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

export function sanitizeText(value: unknown): string {
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

export function parseQuestionSentence(value: string): ParsedQuestionSentence {
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


export function normalizeAnswer(value: string): string {
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

export function collectAcceptedAnswers(attributes: Record<string, unknown>): string[] {
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

export function pickCanonicalAnswer(attributes: Record<string, unknown>): string {
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

export function extractAlternativeAnswers(
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

export function buildAnswerFeedbackMap(value: unknown): Map<string, string> {
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


export function reviewContent(item: BunproReviewQueueItem) {
  const relation = item.data.relationships?.study_question?.data;
  const question = getIncludedResource(item.included, relation?.id, relation?.type ?? "study_question")?.attributes ?? {};
  const reviewable = item.data.relationships?.reviewable?.data;
  const attributes = getIncludedResource(item.included, reviewable?.id, reviewable?.type ?? "")?.attributes ?? {};
  const kind = reviewable?.type === "grammar_point" || item.data.attributes.reviewable_type === "GrammarPoint" ? "grammar" : "vocab";
  return { question, attributes, kind: kind as "grammar" | "vocab", slug: sanitizeText(attributes.slug) };
}

/** Bunpro pages quiz items independently of the total due count. */
export function pendingReviewTotal(response: { total_pending_attempt_count?: number; total_pending_wrapup_count?: number }): number {
  return [response.total_pending_attempt_count, response.total_pending_wrapup_count].reduce<number>((sum, value) => sum + (typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0), 0);
}

export function shuffleReviewQueue(items: BunproReviewQueueItem[]): BunproReviewQueueItem[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
