import { toHiragana, toKatakana } from "wanakana";

export interface VoiceReadingLookup {
  wordReadings: Record<string, string[]>;
  singleKanjiReadings: Record<string, string[]>;
}

/** Resolve recognized spelling using dictionary readings, never arbitrary kanji combinations.
 * Whole words take precedence: e.g. 今日 must not be assembled as こん + にち.
 * Expected readings only disambiguate readings actually present in the dictionary.
 */
export function resolveVoiceReading(
  text: string,
  expectedReadings: readonly string[],
  lookup: VoiceReadingLookup,
  options: { allowIsolatedKanjiReadings?: boolean } = {},
): string | null {
  const normalized = toHiragana(text.normalize("NFKC"));
  if (!normalized || normalized.length > 80) return null;
  const choose = (readings: string[]) => {
    const unique = [...new Set(readings.map((reading) => toHiragana(reading)))];
    return expectedReadings.find((reading) => unique.includes(reading)) ??
      (unique.length === 1 ? unique[0] : null);
  };
  const exact = lookup.wordReadings[normalized] ?? [];
  // A lone recognized kanji can stand for an isolated on/kun reading. Never
  // concatenate those character readings to invent a compound pronunciation.
  const isolatedKanji = options.allowIsolatedKanjiReadings && /^[\u3400-\u4DBF\u4E00-\u9FFF]$/.test(normalized)
    ? lookup.singleKanjiReadings[normalized] ?? [] : [];
  if (exact.length || isolatedKanji.length) return choose([...exact, ...isolatedKanji]);

  const memo = new Map<number, string[]>();
  const visit = (offset: number): string[] => {
    if (offset === normalized.length) return [""];
    const cached = memo.get(offset);
    if (cached) return cached;
    const readings = new Set<string>();
    // Prefer longest known words, preserving their real readings and okurigana.
    for (let end = normalized.length; end > offset; end--) {
      const token = normalized.slice(offset, end);
      const options = lookup.wordReadings[token] ??
        (token.length === 1 && /^[ぁ-ゖー]$/.test(token) ? [token] : undefined);
      if (!options?.length) continue;
      for (const suffix of visit(end)) {
        for (const prefix of options) {
          readings.add(toHiragana(prefix) + suffix);
          // Ambiguous/long transcripts are left visible for a retry, not guessed.
          if (readings.size > 32) { memo.set(offset, []); return []; }
        }
      }
      if (readings.size) break;
    }
    const result = [...readings];
    memo.set(offset, result);
    return result;
  };
  return choose(visit(0));
}

export function getJapaneseVoiceContext(readings: readonly string[], characters?: string | null): string[] {
  return [...new Set([
    ...readings.flatMap((reading) => [toHiragana(reading), toKatakana(reading)]),
    characters?.trim() ?? "",
  ].filter(Boolean))].slice(0, 100);
}

interface VoiceSegment {
  segment: string;
  startTimeMillis: number;
  endTimeMillis: number;
}

/** Keep a repeated attempt separate only when native timing proves a pause.
 * Never turn a genuinely spoken word such as つつ into the expected つ.
 */
export function latestJapaneseUtterance(transcript: string, segments: readonly VoiceSegment[] = []): string {
  let start = 0;
  for (let index = 1; index < segments.length; index++) {
    if (segments[index].startTimeMillis - segments[index - 1].endTimeMillis >= 900) start = index;
  }
  return start > 0 ? segments.slice(start).map((segment) => segment.segment).join("") : transcript;
}
