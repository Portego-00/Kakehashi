export type MusicTranslation = {
  source: string;
  translation: string;
};

export type MusicTranslationCompletion = {
  warning: string | null;
  code: string | null;
};

type LegacyMusicTranslationPayload = {
  translations?: unknown;
  warning?: unknown;
  code?: unknown;
  error?: unknown;
};

const STREAM_MAX_BYTES = 2_000_000;
const STREAM_LINE_MAX_CHARACTERS = 20_000;

export class MusicTranslationStreamError extends Error {
  readonly code: string | null;

  constructor(message: string, code: string | null = null) {
    super(message);
    this.name = "MusicTranslationStreamError";
    this.code = code;
  }
}

function optionalText(value: unknown) {
  return typeof value === "string" ? value.trim() || null : null;
}

function translationFrom(value: unknown): MusicTranslation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { source, translation } = value as { source?: unknown; translation?: unknown };
  if (typeof source !== "string" || typeof translation !== "string") return null;
  const normalizedSource = source.trim();
  const normalizedTranslation = translation.trim();
  return normalizedSource && normalizedTranslation
    ? { source: normalizedSource, translation: normalizedTranslation }
    : null;
}

function invalidStream() {
  return new MusicTranslationStreamError("JPDB returned an invalid lyric translation response.");
}

async function readLegacyResponse(
  response: Response,
  onTranslation: (translation: MusicTranslation) => void,
): Promise<MusicTranslationCompletion> {
  const payload = await response.json().catch(() => ({})) as LegacyMusicTranslationPayload;
  if (!response.ok) {
    throw new MusicTranslationStreamError(
      optionalText(payload.error) ?? `Request failed with HTTP ${response.status}.`,
      optionalText(payload.code),
    );
  }
  if (!Array.isArray(payload.translations)) throw invalidStream();
  for (const value of payload.translations) {
    const translation = translationFrom(value);
    if (translation) onTranslation(translation);
  }
  return { warning: optionalText(payload.warning), code: optionalText(payload.code) };
}

export async function readMusicTranslationResponse(
  response: Response,
  onTranslation: (translation: MusicTranslation) => void,
): Promise<MusicTranslationCompletion> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!response.ok || !contentType.includes("application/x-ndjson")) {
    return readLegacyResponse(response, onTranslation);
  }
  if (!response.body) throw invalidStream();

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let receivedBytes = 0;
  let completion: MusicTranslationCompletion | null = null;

  function consumeLine(rawLine: string) {
    const line = rawLine.trim();
    if (!line) return;
    if (line.length > STREAM_LINE_MAX_CHARACTERS) throw invalidStream();
    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      throw invalidStream();
    }
    if (!event || typeof event !== "object" || Array.isArray(event)) throw invalidStream();
    const record = event as Record<string, unknown>;
    if (record.type === "translation") {
      const translation = translationFrom(record);
      if (!translation) throw invalidStream();
      onTranslation(translation);
      return;
    }
    if (record.type === "complete") {
      completion = { warning: optionalText(record.warning), code: optionalText(record.code) };
      return;
    }
    if (record.type === "error") {
      throw new MusicTranslationStreamError(
        optionalText(record.error) ?? "JPDB lyric translation is temporarily unavailable.",
        optionalText(record.code),
      );
    }
    throw invalidStream();
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    receivedBytes += value.byteLength;
    if (receivedBytes > STREAM_MAX_BYTES) throw invalidStream();
    buffer += decoder.decode(value, { stream: true });
    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex >= 0) {
      consumeLine(buffer.slice(0, newlineIndex));
      buffer = buffer.slice(newlineIndex + 1);
      newlineIndex = buffer.indexOf("\n");
    }
    if (buffer.length > STREAM_LINE_MAX_CHARACTERS) throw invalidStream();
  }

  buffer += decoder.decode();
  if (buffer.trim()) consumeLine(buffer);
  if (!completion) {
    throw new MusicTranslationStreamError("JPDB lyric translation ended before it finished.");
  }
  return completion;
}
