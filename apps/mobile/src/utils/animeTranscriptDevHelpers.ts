import type {
  JpdbParsedTokenAnnotation,
  VocabularyMatch,
} from "./textHighlighting";
import type {
  AnimeTranscriptSubtitleCue,
  AnimeTranscriptVideoSourceType,
} from "./animeTranscriptDevSession";

export const GRAMMAR_TOOLTIP_ID_MIN = -9000000;
export const JPDB_FALLBACK_TOOLTIP_ID_MIN = -8000000;
export const TOKEN_UNDERLINE_SEPARATOR = "\u200A";
const CONTINUATION_ARROW_REGEX = /[→➡➜➞➝➟➠]/g;
const RETURN_SYMBOL_REGEX = /[↵⏎]/g;
const MP4_VIDEO_MIME_TYPES = new Set(["video/mp4"]);
const MKV_VIDEO_MIME_TYPES = new Set(["video/x-matroska", "video/mkv"]);

export function isPickerCancellation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "");
  return /cancel|canceled|cancelled|abort/i.test(message);
}

export function parseSrtTimestamp(rawTimestamp: string): number | null {
  const match = rawTimestamp
    .trim()
    .match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})[,.](\d{1,3})$/);
  if (!match) {
    return null;
  }

  const [, hourPart, minutePart, secondPart, millisecondPart] = match;
  const hours = Number(hourPart ?? 0);
  const minutes = Number(minutePart);
  const seconds = Number(secondPart);
  const milliseconds = Number(millisecondPart.padEnd(3, "0").slice(0, 3));

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    !Number.isFinite(seconds) ||
    !Number.isFinite(milliseconds)
  ) {
    return null;
  }

  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}

export function parseSrtCues(rawSrt: string): AnimeTranscriptSubtitleCue[] {
  const normalized = rawSrt
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .trim();

  if (!normalized) {
    return [];
  }

  const blocks = normalized.split(/\n{2,}/);
  const baseCues: Omit<AnimeTranscriptSubtitleCue, "startOffset">[] = [];

  blocks.forEach((block, blockIndex) => {
    const lines = block.split("\n").map((line) => line.trimEnd());
    const timingLineIndex = lines.findIndex((line) => line.includes("-->"));
    if (timingLineIndex < 0) {
      return;
    }

    const timingLine = lines[timingLineIndex];
    const [rawStart, rawEnd] = timingLine.split("-->").map((value) => value.trim());
    if (!rawStart || !rawEnd) {
      return;
    }

    const startTimestamp = rawStart.split(/\s+/)[0];
    const endTimestamp = rawEnd.split(/\s+/)[0];
    const startTime = parseSrtTimestamp(startTimestamp);
    const endTime = parseSrtTimestamp(endTimestamp);
    if (
      startTime === null ||
      endTime === null ||
      !Number.isFinite(startTime) ||
      !Number.isFinite(endTime)
    ) {
      return;
    }

    const rawText = lines
      .slice(timingLineIndex + 1)
      .map((line) => line.trim())
      .filter(Boolean)
      .join(" ")
      .replace(CONTINUATION_ARROW_REGEX, " ")
      .replace(RETURN_SYMBOL_REGEX, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (!rawText) {
      return;
    }

    baseCues.push({
      id: `cue-${blockIndex}-${baseCues.length}`,
      startTime,
      endTime,
      text: rawText,
    });
  });

  const sorted = baseCues.sort((left, right) => left.startTime - right.startTime);
  let cursor = 0;

  return sorted.map((cue, index) => {
    const startOffset = cursor;
    cursor += cue.text.length + 1;

    return {
      ...cue,
      id: `cue-${index}`,
      startOffset,
    };
  });
}

// Keep 1:1 character width for newline/arrow replacement to preserve existing token offsets.
export function normalizeSubtitleCueTextForRendering(rawText: string): string {
  return rawText
    .replace(/\r/g, " ")
    .replace(/[\u2028\u2029]/g, " ")
    .replace(/\n/g, " ")
    .replace(CONTINUATION_ARROW_REGEX, " ")
    .replace(RETURN_SYMBOL_REGEX, " ");
}

export function getFileNameFromUri(uri: string | null | undefined): string {
  if (!uri) {
    return "Selected video";
  }
  const normalizedUri = uri.split("?")[0];
  const segments = normalizedUri.split("/");
  return segments[segments.length - 1] || "Selected video";
}

export function extractExtension(fileName: string): string | null {
  const match = fileName.toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match?.[1] ?? null;
}

export function inferTranscriptVideoSourceType(
  fileName: string | null | undefined,
  mimeType: string | null | undefined
): AnimeTranscriptVideoSourceType | null {
  const normalizedMimeType =
    typeof mimeType === "string" && mimeType.trim().length > 0
      ? mimeType.trim().toLowerCase()
      : null;

  if (normalizedMimeType && MP4_VIDEO_MIME_TYPES.has(normalizedMimeType)) {
    return "mp4";
  }

  if (normalizedMimeType && MKV_VIDEO_MIME_TYPES.has(normalizedMimeType)) {
    return "mkv";
  }

  if (typeof fileName === "string" && fileName.trim().length > 0) {
    const extension = extractExtension(fileName);
    if (extension === ".mp4") {
      return "mp4";
    }
    if (extension === ".mkv") {
      return "mkv";
    }
  }

  return null;
}

export function isLikelySupportedTranscriptVideo(
  fileName: string | null | undefined,
  mimeType: string | null | undefined
): boolean {
  if (inferTranscriptVideoSourceType(fileName, mimeType)) {
    return true;
  }

  const normalizedMimeType =
    typeof mimeType === "string" && mimeType.trim().length > 0
      ? mimeType.trim().toLowerCase()
      : null;
  const extension =
    typeof fileName === "string" && fileName.trim().length > 0
      ? extractExtension(fileName)
      : null;

  if (!normalizedMimeType && !extension) {
    return true;
  }

  return false;
}

export function isLikelyMp4Video(
  fileName: string | null | undefined,
  mimeType: string | null | undefined
): boolean {
  const videoSourceType = inferTranscriptVideoSourceType(fileName, mimeType);
  if (videoSourceType) {
    return videoSourceType === "mp4";
  }

  if (typeof mimeType === "string" && mimeType.trim().length > 0) {
    return mimeType.toLowerCase() === "video/mp4";
  }

  if (typeof fileName === "string" && fileName.trim().length > 0) {
    const extension = extractExtension(fileName);
    if (extension) {
      return extension === ".mp4";
    }
  }

  // If metadata is missing, allow the pick and let player load fail naturally.
  return true;
}

export function formatTimestamp(totalSeconds: number): string {
  const roundedSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(roundedSeconds / 3600);
  const minutes = Math.floor((roundedSeconds % 3600) / 60);
  const seconds = roundedSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function buildGrammarTooltipItem(
  token: JpdbParsedTokenAnnotation
): VocabularyMatch {
  const meaningText = token.meaning?.trim() || "Grammar point";
  const partsOfSpeechSummary = token.partsOfSpeech.filter(Boolean).join(", ");
  const details = partsOfSpeechSummary
    ? `${meaningText}\nPart of Speech: ${partsOfSpeechSummary}`
    : meaningText;

  return {
    id: GRAMMAR_TOOLTIP_ID_MIN - token.start * 1000 - token.end,
    characters: token.surface || token.spelling || token.reading || "Grammar",
    meaning: details,
    type: "vocabulary",
    level: 0,
    readings: token.reading
      ? [{ reading: token.reading, primary: true }]
      : undefined,
    isWaniKaniSubject: false,
    disableConjugationExpansion: true,
  };
}

export function inferFallbackVerbConjugationKind(
  partsOfSpeech: string[]
): VocabularyMatch["verbConjugationKind"] {
  if (partsOfSpeech.some((partOfSpeech) => partOfSpeech.startsWith("vs"))) {
    return "suru";
  }
  if (partsOfSpeech.some((partOfSpeech) => partOfSpeech === "vk")) {
    return "kuru";
  }
  if (partsOfSpeech.some((partOfSpeech) => partOfSpeech.startsWith("v1"))) {
    return "ichidan";
  }
  if (partsOfSpeech.some((partOfSpeech) => partOfSpeech.startsWith("v5"))) {
    return "godan";
  }
  return undefined;
}

export function buildJpdbFallbackTooltipItem(
  token: JpdbParsedTokenAnnotation,
  tokenType: "verb" | "vocabulary"
): VocabularyMatch {
  const meaningText = token.meaning?.trim() || "Detected by JPDB parser.";
  const partsOfSpeechSummary = token.partsOfSpeech.filter(Boolean).join(", ");
  const details = partsOfSpeechSummary
    ? `${meaningText}\nPart of Speech: ${partsOfSpeechSummary}`
    : meaningText;
  const displayText = token.spelling || token.surface || token.reading || "Vocabulary";
  const hasKanji = /[\u3400-\u9FFF々]/.test(displayText);
  const matchCandidates = Array.from(
    new Set([token.surface, token.spelling, token.reading].filter(Boolean))
  ).sort((a, b) => b.length - a.length);

  return {
    id: JPDB_FALLBACK_TOOLTIP_ID_MIN - token.start * 1000 - token.end,
    characters: displayText,
    meaning: details,
    type: hasKanji ? "vocabulary" : "kana_vocabulary",
    level: 0,
    readings: token.reading
      ? [{ reading: token.reading, primary: true }]
      : undefined,
    verbConjugationKind:
      tokenType === "verb"
        ? inferFallbackVerbConjugationKind(token.partsOfSpeech)
        : undefined,
    matchCandidates: matchCandidates.length > 0 ? matchCandidates : undefined,
    isWaniKaniSubject: false,
    disableConjugationExpansion: true,
  };
}
