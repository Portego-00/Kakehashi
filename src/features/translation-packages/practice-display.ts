import type { learningDisplay } from "./display";
import { displaySubject } from "./display";

export type PracticeDisplay = ReturnType<typeof learningDisplay>;

export function practiceSentence(display: PracticeDisplay, subject: unknown, ja: string, en: string): string {
  return display.sentence(subject, { ja, en })?.translation ?? en;
}

// A special prompt may refer to a specific alternative or a shared meaning.
// Only replace the primary prompt when its source meaning matches exactly.
export function practicePrompt(display: PracticeDisplay, subject: { data: { meanings?: { meaning: string; primary?: boolean }[] } }, original: string): string {
  const meanings = subject.data.meanings ?? [];
  const primary = meanings.find(meaning => meaning.primary) ?? meanings[0];
  return original === primary?.meaning ? display.meaning(subject, original) : original;
}

export function practiceClue(display: PracticeDisplay | undefined, subject: unknown, original: string, mode: "english" | "kanji" | "english_kanji", kanji: string | null, writtenFallback = original): string {
  const meaning = display?.meaning(subject, original) ?? original;
  if (mode === "kanji") return kanji ?? writtenFallback;
  return mode === "english_kanji" && kanji ? `${meaning} • ${kanji}` : meaning;
}

export function practiceAlternatives(display: PracticeDisplay | undefined, subject: unknown, original: string): string[] {
  const translated = display?.resolveMeaning(subject);
  const values = translated
    ? translated.alternatives.map(value => display!.formatMeaning(value))
    : displaySubject(subject)?.meanings.filter(meaning => !meaning.primary).map(meaning => meaning.meaning) ?? [];
  const primary = display?.meaning(subject, original) ?? original;
  return [...new Set(values.map(value => value.trim()).filter(value => value && value.toLowerCase() !== primary.toLowerCase()))];
}
