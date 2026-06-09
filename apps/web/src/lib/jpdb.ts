"use client";

const JPDB_API_KEY_STORAGE_KEY = "kakehashi_jpdb_api_key_v1";
const JPDB_PARSE_ENDPOINT = "https://jpdb.io/api/v1/parse";
const JPDB_PARSE_TOKEN_FIELDS = ["vocabulary_index", "position", "length"] as const;
const JPDB_PARSE_VOCABULARY_FIELDS = [
  "spelling",
  "reading",
  "part_of_speech",
  "meanings_chunks",
] as const;

type JpdbTokenTuple = [number, number, number];
type JpdbVocabularyTuple = [string, string, string[], string[][]?];

type JpdbParseResponse = {
  tokens?: JpdbTokenTuple[] | JpdbTokenTuple[][];
  vocabulary?: JpdbVocabularyTuple[];
};

export type JpdbParsedToken = {
  start: number;
  end: number;
  surface: string;
  spelling: string;
  reading: string;
  meaning: string;
  partsOfSpeech: string[];
  tokenType: "grammar" | "verb" | "vocabulary";
};

const grammarPartsOfSpeech = new Set([
  "aux",
  "aux-v",
  "aux-adj",
  "cop",
  "conj",
  "exp",
  "prt",
  "int",
]);

export function normalizeJpdbApiKey(rawValue: string | null | undefined): string | null {
  if (typeof rawValue !== "string") return null;
  const normalized = rawValue.trim();
  return normalized ? normalized : null;
}

export function loadJpdbApiKey(): string | null {
  if (typeof window === "undefined") return null;
  return normalizeJpdbApiKey(window.localStorage.getItem(JPDB_API_KEY_STORAGE_KEY));
}

export function saveJpdbApiKey(apiKey: string): void {
  const normalized = normalizeJpdbApiKey(apiKey);
  if (!normalized) {
    throw new Error("JPDB API key cannot be empty.");
  }
  window.localStorage.setItem(JPDB_API_KEY_STORAGE_KEY, normalized);
}

export function clearJpdbApiKey(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(JPDB_API_KEY_STORAGE_KEY);
}

export async function validateJpdbApiKey(apiKey: string): Promise<boolean> {
  const normalized = normalizeJpdbApiKey(apiKey);
  if (!normalized) return false;

  try {
    const response = await fetch(JPDB_PARSE_ENDPOINT, {
      method: "POST",
      headers: createJpdbHeaders(normalized),
      body: JSON.stringify(createParseBody("テスト")),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function parseTextWithJpdb(
  text: string,
  apiKey: string
): Promise<JpdbParsedToken[]> {
  const normalizedText = text.trim();
  const normalizedKey = normalizeJpdbApiKey(apiKey);
  if (!normalizedText || !normalizedKey) return [];

  const response = await fetch(JPDB_PARSE_ENDPOINT, {
    method: "POST",
    headers: createJpdbHeaders(normalizedKey),
    body: JSON.stringify(createParseBody(text)),
  });

  if (!response.ok) {
    throw new Error(`JPDB parse failed: ${response.status}`);
  }

  const payload = (await response.json()) as JpdbParseResponse;
  const tokenTuples = extractPrimaryTokenTuples(payload.tokens);
  const vocabulary = Array.isArray(payload.vocabulary) ? payload.vocabulary : [];
  const parsed: JpdbParsedToken[] = [];

  for (const tokenTuple of tokenTuples) {
    if (!Array.isArray(tokenTuple) || tokenTuple.length < 3) continue;

    const vocabularyIndex = Number(tokenTuple[0]);
    const start = Number(tokenTuple[1]);
    const length = Number(tokenTuple[2]);
    const vocabularyTuple = vocabulary[vocabularyIndex];
    if (!Array.isArray(vocabularyTuple) || !Number.isFinite(start) || !Number.isFinite(length)) {
      continue;
    }

    const end = start + length;
    const surface = text.slice(start, end);
    const spelling = typeof vocabularyTuple[0] === "string" ? vocabularyTuple[0].trim() : "";
    const reading = typeof vocabularyTuple[1] === "string" ? vocabularyTuple[1].trim() : "";
    const partsOfSpeech = Array.isArray(vocabularyTuple[2])
      ? vocabularyTuple[2]
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean)
      : [];

    if (!/[\u3040-\u30ff\u3400-\u9fff々]/.test(surface + spelling)) {
      continue;
    }

    const isGrammar = partsOfSpeech.some((part) => grammarPartsOfSpeech.has(part));
    const isVerb = partsOfSpeech.some(isVerbPartOfSpeech);
    parsed.push({
      start,
      end,
      surface,
      spelling,
      reading,
      meaning: getPrimaryMeaning(vocabularyTuple[3]),
      partsOfSpeech,
      tokenType: isGrammar ? "grammar" : isVerb ? "verb" : "vocabulary",
    });
  }

  return parsed;
}

function createJpdbHeaders(apiKey: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
}

function createParseBody(text: string) {
  return {
    text: [text],
    position_length_encoding: "utf16",
    token_fields: JPDB_PARSE_TOKEN_FIELDS,
    vocabulary_fields: JPDB_PARSE_VOCABULARY_FIELDS,
  };
}

function extractPrimaryTokenTuples(rawTokens: unknown): unknown[] {
  if (!Array.isArray(rawTokens) || rawTokens.length === 0) return [];
  const firstEntry = rawTokens[0];
  if (Array.isArray(firstEntry) && (firstEntry.length === 0 || Array.isArray(firstEntry[0]))) {
    return firstEntry;
  }
  return rawTokens;
}

function getPrimaryMeaning(chunks?: string[][]): string {
  if (!Array.isArray(chunks)) return "";
  return chunks
    .flat()
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .slice(0, 3)
    .join("; ");
}

function isVerbPartOfSpeech(partOfSpeech: string): boolean {
  return partOfSpeech.startsWith("v1") || partOfSpeech.startsWith("v5") || partOfSpeech.startsWith("vs") || partOfSpeech === "vk";
}
