import type { learningDisplay } from "./display";
import { displaySubject } from "./display";

export type PracticeDisplay = ReturnType<typeof learningDisplay>;

export function practiceSentence(display: PracticeDisplay, subject: unknown, ja: string, en: string): string {
  return display.sentence(subject, { ja, en })?.translation ?? en;
}

function meaningKey(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase().replace(/-/g, " ").replace(/[.'\/]/g, "").replace(/\s+/g, " ");
}

// Keep the reading prompt to one translated meaning for every accepted source
// sense. Other package meanings belong in the existing context-hint content.
export function practicePrompt(display: PracticeDisplay, subject: { data: { meanings?: { meaning: string; primary?: boolean; accepted_answer?: boolean }[]; auxiliary_meanings?: { meaning: string; type: string }[] | null } }, original: string): string {
  const meanings = subject.data.meanings ?? [];
  const translated = display.resolveMeaning(subject);
  if (!translated) return original;
  const accepted = [...meanings.filter(meaning => meaning.accepted_answer !== false), ...(subject.data.auxiliary_meanings ?? []).filter(meaning => meaning.type === "whitelist")];
  const key = meaningKey(original);
  if (!accepted.some(meaning => meaningKey(meaning.meaning) === key)) return original;
  return display.formatMeaning(translated.primary);
}

export function practiceReadingHints(display: PracticeDisplay, subject: unknown, hints: { en?: string; ja?: string }[]) {
  const translated = display.resolveMeaning(subject);
  if (!translated) return hints;
  const alternatives = practiceAlternatives(display, subject, translated.primary);
  return alternatives.length ? [{ en: alternatives.join(", ") }, ...hints] : hints;
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
