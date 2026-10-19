import { useMemo } from "react";
import { useActiveContent } from "./package-store";
import { useLearningContentStore } from "./store";
import {
  resolveTranslatedMeaning,
  resolveTranslatedSentence,
  resolveTranslatedMnemonic,
  type MnemonicField,
  type DisplaySubject,
  type TranslationPackage,
} from "./resolver";
import { formatDisplayMeaning } from "./format";

// Accept API subjects and complete flat display records without changing their source fields.
export function displaySubject(value: unknown): DisplaySubject | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, any>;
  const data = record.data ?? record;
  const meanings = data.meanings;
  const readings = data.readings ?? [];
  if (
    !Number.isInteger(record.id) ||
    typeof record.object !== "string" ||
    !(typeof data.characters === "string" || data.characters === null) ||
    !Array.isArray(meanings) ||
    !Array.isArray(readings)
  )
    return null;
  const normalizedMeanings = meanings.map((m) =>
    typeof m === "string" ? { meaning: m } : m,
  );
  const normalizedReadings = readings.map((r) =>
    typeof r === "string" ? { reading: r } : r,
  );
  if (
    normalizedMeanings.some((m) => typeof m?.meaning !== "string") ||
    normalizedReadings.some((r) => typeof r?.reading !== "string")
  )
    return null;
  return {
    id: record.id,
    object: record.object,
    characters: data.characters,
    meanings: normalizedMeanings,
    readings: normalizedReadings,
  };
}
export function learningDisplay(
  packet: TranslationPackage | null,
  enabled: boolean,
) {
  const resolveMeaning = (value: unknown) => {
    if (!enabled || !packet) return null;
    const subject = displaySubject(value);
    return subject ? resolveTranslatedMeaning(packet, subject) : null;
  };
  const meaning = (value: unknown, fallback?: string) => {
    const translated = resolveMeaning(value);
    if (translated)
      return formatDisplayMeaning(translated.primary, packet!.language);
    if (fallback !== undefined) return fallback;
    const subject = displaySubject(value);
    return (
      subject?.meanings.find((m) => m.primary)?.meaning ??
      subject?.meanings[0]?.meaning ??
      "No meaning available"
    );
  };
  const sentence = (value: unknown, source: { ja: string; en: string }) => {
    if (!enabled || !packet) return null;
    const subject = displaySubject(value);
    return subject ? resolveTranslatedSentence(packet, subject, source) : null;
  };
  return {
    active: enabled && !!packet,
    meaning,
    resolveMeaning,
    sentence,
    mnemonic: (value: unknown, field: MnemonicField, source: string) => {
      if (!enabled || !packet) return null;
      const subject = displaySubject(value);
      return subject ? resolveTranslatedMnemonic(packet, subject, field, source) : null;
    },
    formatMeaning: (value: string) =>
      formatDisplayMeaning(value, packet?.language ?? "en"),
  };
}
export function useLearningDisplay() {
  const enabled = useLearningContentStore((s) => s.enabled);
  const packet = useActiveContent(enabled);
  return useMemo(() => learningDisplay(packet, enabled), [packet, enabled]);
}
