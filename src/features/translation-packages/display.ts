import { useActiveContent } from "./package-store";
import { useLearningContentStore } from "./store";
import { resolveTranslatedMeaning, resolveTranslatedSentence, type DisplaySubject, type TranslationPackage } from "./resolver";
import { formatDisplayMeaning } from "./format";

// Accept API subjects and complete flat display records without changing their source fields.
export function displaySubject(value: unknown): DisplaySubject | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, any>;
  const data = record.data ?? record;
  const meanings = data.meanings;
  const readings = data.readings ?? [];
  if (!Number.isInteger(record.id) || typeof record.object !== "string" ||
    !(typeof data.characters === "string" || data.characters === null) ||
    !Array.isArray(meanings) || !Array.isArray(readings)) return null;
  const normalizedMeanings = meanings.map(m => typeof m === "string" ? {meaning: m} : m);
  const normalizedReadings = readings.map(r => typeof r === "string" ? {reading: r} : r);
  if (normalizedMeanings.some(m => typeof m?.meaning !== "string") ||
    normalizedReadings.some(r => typeof r?.reading !== "string")) return null;
  return {id: record.id, object: record.object, characters: data.characters,
    meanings: normalizedMeanings, readings: normalizedReadings};
}
export function learningDisplay(packet: TranslationPackage | null, enabled: boolean) {
  const resolveMeaning = (value: unknown) => {
    const subject = displaySubject(value);
    return enabled && subject ? resolveTranslatedMeaning(packet, subject) : null;
  };
  const meaning = (value: unknown, fallback = "No meaning available") => {
    const translated = resolveMeaning(value);
    if (translated) return formatDisplayMeaning(translated.primary, packet!.language);
    const subject = displaySubject(value);
    return subject?.meanings.find(m => m.primary)?.meaning ?? subject?.meanings[0]?.meaning ?? fallback;
  };
  const sentence = (value: unknown, source: {ja: string; en: string}) => {
    const subject = displaySubject(value);
    return enabled && subject ? resolveTranslatedSentence(packet, subject, source) : null;
  };
  return {meaning, resolveMeaning, sentence, formatMeaning: (value:string) => formatDisplayMeaning(value,packet?.language ?? "en")};
}
export function useLearningDisplay() {
  const packet = useActiveContent();
  const enabled = useLearningContentStore(s => s.enabled);
  return learningDisplay(packet, enabled);
}
