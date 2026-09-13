const textEncoder = new TextEncoder();
export const PUBLIC_TRANSLATION_MAX_CHARACTERS = 600;
export const PUBLIC_TRANSLATION_MAX_BYTES = 2_400;

export function translationAvailability(configured: boolean) {
  return {
    available: true,
    configured,
    mode: configured ? "configured" as const : "public" as const,
    provider: configured ? "Site translation backend" : "MyMemory",
    maxCharacters: configured ? 10_000 : PUBLIC_TRANSLATION_MAX_CHARACTERS,
  };
}

export function utf8Length(value: string) {
  return textEncoder.encode(value).byteLength;
}

export function splitTranslationText(value: string, maxBytes = 450) {
  if (maxBytes < 4) throw new Error("Translation chunks must allow at least four UTF-8 bytes.");
  const chunks: string[] = [];
  let chunk = "";

  for (const character of value) {
    if (chunk && utf8Length(chunk + character) > maxBytes) {
      chunks.push(chunk);
      chunk = "";
    }
    if (utf8Length(character) > maxBytes) throw new Error("A character exceeds the translation service limit.");
    chunk += character;
    if (/[。！？!?\n]/u.test(character) && utf8Length(chunk) >= Math.floor(maxBytes * 0.55)) {
      chunks.push(chunk);
      chunk = "";
    }
  }

  if (chunk) chunks.push(chunk);
  return chunks;
}

export function readMyMemoryTranslation(payload: unknown) {
  if (!payload || typeof payload !== "object") throw new Error("The public translation service returned an invalid response.");
  const record = payload as { responseStatus?: unknown; responseDetails?: unknown; responseData?: unknown };
  if (Number(record.responseStatus) !== 200) throw new Error(typeof record.responseDetails === "string" && record.responseDetails ? record.responseDetails : "The public translation service rejected the request.");
  const responseData = record.responseData && typeof record.responseData === "object" ? record.responseData as { translatedText?: unknown } : null;
  if (typeof responseData?.translatedText !== "string" || !responseData.translatedText.trim()) throw new Error("The public translation service returned no translation.");
  return responseData.translatedText.trim();
}
