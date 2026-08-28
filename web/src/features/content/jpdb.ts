export const JPDB_PARSE_ENDPOINT = "https://jpdb.io/api/v1/parse";
export const JPDB_PARSE_TOKEN_FIELDS = ["vocabulary_index", "position", "length", "furigana"] as const;
export const JPDB_PARSE_VOCABULARY_FIELDS = ["spelling", "reading", "part_of_speech", "meanings_chunks", "alt_spellings"] as const;

export interface JpdbTokenAnnotation {
  start: number;
  end: number;
  surface: string;
  spelling: string;
  reading: string;
  surfaceReading?: string;
  meaning: string;
  meanings: string[];
  alternativeSpellings: string[];
  partsOfSpeech: string[];
  tokenType: "verb" | "grammar" | "vocabulary";
}

const CONTEXTUAL_PARTICLES: Record<string, string[]> = {
  "が": ["marks the grammatical subject", "but; however"],
  "は": ["marks the sentence topic", "marks a contrast"],
  "を": ["marks the direct object"],
  "に": ["at; in; to", "marks time, destination, or an indirect object"],
  "で": ["at; in", "by; with"],
  "と": ["and; with", "marks a quotation or condition"],
  "へ": ["toward; to"],
  "も": ["also; too; even"],
  "の": ["marks possession", "nominalizes a phrase"],
  "か": ["marks a question", "or"],
  "や": ["and; among other examples"],
};

const KANA_ONLY = /^[\u3040-\u30ff\u31f0-\u31ff\uff66-\uff9fー]+$/u;

function contextualSurfaceReading(surface: string, value: unknown, dictionaryReading: string) {
  const normalizedSurface = surface.normalize("NFKC");
  const fallback = KANA_ONLY.test(normalizedSurface) ? normalizedSurface : dictionaryReading;
  if (!Array.isArray(value) || value.length === 0) return fallback;

  let renderedSurface = "";
  let renderedReading = "";
  for (const part of value) {
    if (typeof part === "string") {
      renderedSurface += part;
      renderedReading += part;
      continue;
    }
    if (
      !Array.isArray(part)
      || part.length !== 2
      || typeof part[0] !== "string"
      || typeof part[1] !== "string"
      || !part[0]
      || !part[1]
    ) return fallback;
    renderedSurface += part[0];
    renderedReading += part[1];
  }

  return renderedSurface.normalize("NFKC") === normalizedSurface && renderedReading.trim()
    ? renderedReading.normalize("NFKC")
    : fallback;
}

function meanings(value: unknown) {
  if (!Array.isArray(value)) return [];
  const results: string[] = [];
  for (const chunk of value) {
    if (!Array.isArray(chunk)) continue;
    for (const item of chunk) {
      if (typeof item !== "string" || !item.trim()) continue;
      const normalized = item.trim();
      if (!results.includes(normalized)) results.push(normalized);
    }
  }
  return results;
}

function alternativeSpellings(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((item) => {
    if (typeof item === "string") return item.trim() ? [item.trim()] : [];
    if (!Array.isArray(item)) return [];
    const spelling = item.find((entry): entry is string => typeof entry === "string" && Boolean(entry.trim()));
    return spelling ? [spelling.trim()] : [];
  }))];
}

function primaryTokenTuples(value: unknown): unknown[] {
  if (!Array.isArray(value) || value.length === 0) return [];
  const first = value[0];
  return Array.isArray(first) && (first.length === 0 || Array.isArray(first[0])) ? first : value;
}

function tokenType(partsOfSpeech: string[]): JpdbTokenAnnotation["tokenType"] {
  if (partsOfSpeech.some((part) => part === "vi" || part === "vt" || part.startsWith("v"))) return "verb";
  if (partsOfSpeech.some((part) => ["aux", "aux-v", "aux-adj", "cop", "conj", "exp", "prt", "int"].includes(part))) return "grammar";
  return "vocabulary";
}

function correctContextualParticles(tokens: JpdbTokenAnnotation[]) {
  return tokens.map((token, index) => {
    const particleMeanings = CONTEXTUAL_PARTICLES[token.surface];
    if (!particleMeanings || token.partsOfSpeech.includes("prt")) return token;
    const previous = tokens[index - 1];
    const next = tokens[index + 1];
    const sitsBetweenJapaneseTerms = Boolean(
      previous
      && next
      && previous.end === token.start
      && token.end === next.start
      && previous.tokenType !== "grammar",
    );
    if (!sitsBetweenJapaneseTerms) return token;
    return {
      ...token,
      spelling: token.surface,
      reading: token.surface,
      surfaceReading: token.surface,
      meaning: particleMeanings[0],
      meanings: particleMeanings,
      alternativeSpellings: [],
      partsOfSpeech: ["prt"],
      tokenType: "grammar" as const,
    };
  });
}

export function jpdbParseRequest(text: string) {
  return {
    text: [text],
    position_length_encoding: "utf16",
    token_fields: JPDB_PARSE_TOKEN_FIELDS,
    vocabulary_fields: JPDB_PARSE_VOCABULARY_FIELDS,
  };
}

export function parseJpdbResponse(text: string, payload: unknown): JpdbTokenAnnotation[] {
  if (!payload || typeof payload !== "object") return [];
  const response = payload as { tokens?: unknown; vocabulary?: unknown };
  const vocabulary = Array.isArray(response.vocabulary) ? response.vocabulary : [];
  const tokens: JpdbTokenAnnotation[] = [];

  for (const tuple of primaryTokenTuples(response.tokens)) {
    if (!Array.isArray(tuple) || tuple.length < 3) continue;
    const vocabularyIndex = Number(tuple[0]);
    const start = Number(tuple[1]);
    const length = Number(tuple[2]);
    if (!Number.isInteger(vocabularyIndex) || !Number.isInteger(start) || !Number.isInteger(length) || start < 0 || length <= 0 || start + length > text.length) continue;
    const entry = vocabulary[vocabularyIndex];
    if (!Array.isArray(entry)) continue;
    const surface = text.slice(start, start + length);
    const spelling = typeof entry[0] === "string" ? entry[0].trim() : "";
    const reading = typeof entry[1] === "string" ? entry[1].trim() : "";
    const partsOfSpeech = Array.isArray(entry[2]) ? entry[2].filter((part): part is string => typeof part === "string").map((part) => part.trim().toLocaleLowerCase()).filter(Boolean) : [];
    const tokenMeanings = meanings(entry[3]);
    if (!/[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff々]/u.test(`${surface}${spelling}`)) continue;
    tokens.push({ start, end: start + length, surface, spelling, reading, surfaceReading: contextualSurfaceReading(surface, tuple[3], reading), meaning: tokenMeanings[0] ?? "", meanings: tokenMeanings, alternativeSpellings: alternativeSpellings(entry[4]), partsOfSpeech, tokenType: tokenType(partsOfSpeech) });
  }

  return correctContextualParticles(tokens.sort((left, right) => left.start - right.start || right.end - left.end));
}
