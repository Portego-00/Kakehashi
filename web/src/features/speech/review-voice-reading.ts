import { toHiragana } from "wanakana";
import type { Subject } from "@/types/wanikani";
import { wkCollection } from "@/lib/wanikani/client";
import { hasJapaneseAsr } from "./japanese-asr-assets";
import type { AsrLanguage, JapaneseAsrResponse } from "./japanese-asr-protocol";
const compact = (text: string) =>
  text.normalize("NFKC").replace(/[\s\p{P}\p{S}]/gu, "");
let lookup: Promise<Map<string, Set<string>>> | null = null;
export function voiceReadingLookup(
  subjects: readonly {
    object?: string;
    data: {
      characters?: string | null;
      readings?: readonly { reading: string }[];
    };
  }[],
) {
  const words = new Map<string, Set<string>>();
  const vocabulary = new Set(
    subjects
      .filter(
        (subject) =>
          subject.object === "vocabulary" ||
          subject.object === "kana_vocabulary",
      )
      .map((subject) => compact(subject.data.characters ?? "")),
  );
  for (const subject of subjects) {
    const characters = compact(subject.data.characters ?? "");
    // A vocabulary word has a pronunciation; the same character’s kanji entry
    // also lists component readings that are not readings of that whole word.
    if (
      !characters ||
      (subject.object === "kanji" && vocabulary.has(characters))
    )
      continue;
    const readings = words.get(characters) ?? new Set<string>();
    for (const reading of subject.data.readings ?? [])
      readings.add(toHiragana(compact(reading.reading)));
    if (readings.size) words.set(characters, readings);
  }
  return words;
}
export function possibleVoiceReadings(
  text: string,
  words: Map<string, Set<string>>,
): string[] {
  const input = toHiragana(compact(text));
  if (words.has(input)) return [...words.get(input)!];
  const memo = new Map<number, string[]>();
  function visit(offset: number): string[] {
    if (offset === input.length) return [""];
    if (memo.has(offset)) return memo.get(offset)!;
    const options = new Set<string>();
    if (/^[\u3041-\u3096ー]$/u.test(input[offset]))
      for (const suffix of visit(offset + 1))
        options.add(input[offset] + suffix);
    for (let end = input.length; end > offset; end--) {
      const readings = words.get(input.slice(offset, end));
      if (!readings) continue;
      for (const reading of readings)
        for (const suffix of visit(end)) {
          options.add(reading + suffix);
          if (options.size > 64) break;
        }
    }
    const result = [...options].slice(0, 64);
    memo.set(offset, result);
    return result;
  }
  return visit(0);
}
async function cachedKana(samples: Float32Array, signal: AbortSignal) {
  if (samples.length > 96_000 || !(await hasJapaneseAsr())) return null;
  signal.throwIfAborted();
  const worker = new Worker(
    new URL("./japanese-asr.worker.ts", import.meta.url),
    { type: "module" },
  );
  return new Promise<string | null>((resolve, reject) => {
    const finish = (text: string | null) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      worker.terminate();
      resolve(text);
    };
    const abort = () => {
      clearTimeout(timer);
      worker.terminate();
      reject(signal.reason);
    };
    const timer = setTimeout(() => finish(null), 30_000);
    signal.addEventListener("abort", abort, { once: true });
    worker.onmessage = ({ data }: MessageEvent<JapaneseAsrResponse>) =>
      finish(data.text ?? null);
    worker.onerror = () => finish(null);
    const copy = samples.slice();
    worker.postMessage(
      { id: 1, language: "ja", type: "recognize", samples: copy },
      [copy.buffer],
    );
  });
}
/** No expected answer is supplied to either model or the reading resolver. */
export async function resolveVoiceTranscript(
  raw: string,
  language: AsrLanguage,
  samples: Float32Array,
  final: boolean,
  signal: AbortSignal,
) {
  const text = raw
    .replace(/<\|[^|]*\|>/g, "")
    .normalize("NFKC")
    .trim();
  if (language === "en") return text;
  const kana = toHiragana(compact(text));
  if (/^[\u3041-\u3096ー]+$/u.test(kana)) return kana;
  if (!/[\u3400-\u9fff]/u.test(kana)) return null;
  lookup ??= wkCollection<Subject>("subjects?hidden=false")
    .then(voiceReadingLookup)
    .catch((error) => {
      lookup = null;
      throw error;
    });
  const readings = possibleVoiceReadings(kana, await lookup);
  signal.throwIfAborted();
  if (readings.length === 1) return readings[0];
  if (!final) return null;
  // Previously downloaded kana-only models can disambiguate spelling without
  // choosing the target card's expected pronunciation (e.g. 川: かわ versus せん).
  const phonetic = await cachedKana(samples, signal);
  return phonetic && (!readings.length || readings.includes(phonetic))
    ? phonetic
    : null;
}
