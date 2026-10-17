import type { learningDisplay } from "./display";
import { displaySubject } from "./display";

export type PracticeDisplay = ReturnType<typeof learningDisplay>;

export function practiceSentence(display: PracticeDisplay, subject: unknown, ja: string, en: string): string {
  return display.sentence(subject, { ja, en })?.translation ?? en;
}

function meaningKey(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase().replace(/-/g, " ").replace(/[.'\/]/g, "").replace(/\s+/g, " ");
}

// A reading question can use any accepted English meaning. Alternatives have
// no one-to-one translation mapping, so show the subject's full translated
// meaning set rather than inventing a translation for the selected English sense.
export function practicePrompt(display: PracticeDisplay, subject: { data: { meanings?: { meaning: string; primary?: boolean; accepted_answer?: boolean }[]; auxiliary_meanings?: { meaning: string; type: string }[] | null } }, original: string): string {
  const meanings = subject.data.meanings ?? [];
  const primary = meanings.find(meaning => meaning.primary) ?? meanings[0];
  const translated = display.resolveMeaning(subject);
  if (!translated) return original;
  const accepted = [...meanings.filter(meaning => meaning.accepted_answer !== false), ...(subject.data.auxiliary_meanings ?? []).filter(meaning => meaning.type === "whitelist")];
  const key = meaningKey(original);
  if (!accepted.some(meaning => meaningKey(meaning.meaning) === key)) return original;
  if (primary && meaningKey(primary.meaning) === key) return display.formatMeaning(translated.primary);
  return [...new Set([translated.primary, ...translated.alternatives].map(display.formatMeaning))].join(", ");
}

export function practiceHintLabels(display: PracticeDisplay, originals: string[], sources: unknown[]): string[] {
  return originals.map(original => {
    const source = sources.find(value => {
      const subject = displaySubject(value);
      const primary = subject?.meanings.find(meaning => meaning.primary) ?? subject?.meanings[0];
      return primary && meaningKey(primary.meaning) === meaningKey(original);
    });
    return source ? display.meaning(source, original) : original;
  });
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
