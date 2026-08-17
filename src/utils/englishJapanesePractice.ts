import {
  convertKatakanaToHiragana,
  convertRomajiToHiragana,
} from "./answerChecker";
import type { PronunciationAudio } from "./pronunciationAudio";

export interface EnglishJapaneseAnswerOption {
  subjectId: number;
  subjectType: string;
  characters: string;
  readings: string[];
  pronunciationAudios: PronunciationAudio[];
}

export interface EnglishJapanesePracticeSubject {
  id: number;
  object: string;
  data: {
    characters?: string | null;
    meanings?: {
      meaning: string;
      accepted_answer?: boolean;
    }[];
    auxiliary_meanings?: {
      meaning: string;
      type: "whitelist" | "blacklist";
    }[] | null;
    readings?: {
      reading: string;
      primary?: boolean;
      accepted_answer?: boolean;
    }[] | null;
    pronunciation_audios?: PronunciationAudio[] | null;
  };
}

export interface EnglishJapaneseMeaningGroup<
  TSubject extends EnglishJapanesePracticeSubject = EnglishJapanesePracticeSubject,
> {
  meaning: string;
  normalizedMeaning: string;
  subjects: TSubject[];
  acceptedAnswers: string[];
  answerOptions: EnglishJapaneseAnswerOption[];
}

export interface EnglishJapaneseQuestionData<
  TSubject extends EnglishJapanesePracticeSubject = EnglishJapanesePracticeSubject,
> {
  subject: TSubject;
  promptMeaning: string;
  acceptedAnswers: string[];
  acceptedAnswerDisplayText: string;
  answerOptions: EnglishJapaneseAnswerOption[];
}

function normalizeMeaning(meaning: string): string {
  return meaning
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/-/g, " ")
    .replace(/[.'\/]/g, "")
    .replace(/\s+/g, " ");
}

function normalizeJapaneseAnswer(answer: string): string {
  const compact = answer.normalize("NFKC").trim().replace(/\s+/g, "");
  if (!compact) {
    return "";
  }

  const withoutLeadingTilde = compact.replace(/^〜/, "");
  const hiragana = convertKatakanaToHiragana(withoutLeadingTilde);
  return /[A-Za-z]/.test(hiragana)
    ? convertRomajiToHiragana(hiragana)
    : hiragana;
}

function uniqueJapaneseAnswers(answers: string[]): string[] {
  const uniqueAnswers = new Map<string, string>();

  for (const answer of answers) {
    const trimmed = answer.trim();
    const normalized = normalizeJapaneseAnswer(trimmed);
    if (trimmed && normalized && !uniqueAnswers.has(normalized)) {
      uniqueAnswers.set(normalized, trimmed);
    }
  }

  return Array.from(uniqueAnswers.values());
}

function getAcceptedMeanings(subject: EnglishJapanesePracticeSubject): string[] {
  const meanings = (subject.data.meanings ?? [])
    .filter((meaning) => meaning.accepted_answer !== false)
    .map((meaning) => meaning.meaning);
  const whitelistedMeanings = (subject.data.auxiliary_meanings ?? [])
    .filter((meaning) => meaning.type === "whitelist")
    .map((meaning) => meaning.meaning);

  const uniqueMeanings = new Map<string, string>();
  for (const meaning of [...meanings, ...whitelistedMeanings]) {
    const trimmed = meaning.trim();
    const normalized = normalizeMeaning(trimmed);
    if (trimmed && normalized && !uniqueMeanings.has(normalized)) {
      uniqueMeanings.set(normalized, trimmed);
    }
  }

  return Array.from(uniqueMeanings.values());
}

function getAcceptedReadings(subject: EnglishJapanesePracticeSubject): string[] {
  const readings = subject.data.readings ?? [];
  const acceptedReadings = readings.filter((reading) => {
    if (reading.accepted_answer === false) {
      return false;
    }

    if (subject.object === "kanji") {
      return reading.primary === true;
    }

    return true;
  });

  return uniqueJapaneseAnswers(
    acceptedReadings.map((reading) => reading.reading),
  );
}

function buildAnswerOption(
  subject: EnglishJapanesePracticeSubject,
): EnglishJapaneseAnswerOption | null {
  const characters = subject.data.characters?.trim() ?? "";
  const readings = getAcceptedReadings(subject);

  if (!characters && readings.length === 0) {
    return null;
  }

  return {
    subjectId: subject.id,
    subjectType: subject.object,
    characters,
    readings,
    pronunciationAudios: subject.data.pronunciation_audios ?? [],
  };
}

function formatAnswerOption(option: EnglishJapaneseAnswerOption): string {
  const readings = option.readings.filter(
    (reading) => normalizeJapaneseAnswer(reading) !== normalizeJapaneseAnswer(option.characters),
  );

  if (!option.characters) {
    return readings.join(", ");
  }
  if (readings.length === 0) {
    return option.characters;
  }

  return `${option.characters} (${readings.join(", ")})`;
}

/**
 * Groups learned subjects by each accepted English meaning. A question can then
 * be sampled by meaning instead of being tied to one arbitrarily chosen subject.
 */
export function buildEnglishJapaneseMeaningGroups<
  TSubject extends EnglishJapanesePracticeSubject,
>(subjects: TSubject[]): EnglishJapaneseMeaningGroup<TSubject>[] {
  const groups = new Map<
    string,
    { meaning: string; subjects: Map<number, TSubject> }
  >();

  for (const subject of subjects) {
    if (!buildAnswerOption(subject)) {
      continue;
    }

    for (const meaning of getAcceptedMeanings(subject)) {
      const normalizedMeaning = normalizeMeaning(meaning);
      const existingGroup = groups.get(normalizedMeaning);
      if (existingGroup) {
        existingGroup.subjects.set(subject.id, subject);
      } else {
        groups.set(normalizedMeaning, {
          meaning,
          subjects: new Map([[subject.id, subject]]),
        });
      }
    }
  }

  return Array.from(groups.entries()).map(
    ([normalizedMeaning, { meaning, subjects: subjectsById }]) => {
      const groupedSubjects = Array.from(subjectsById.values());
      const answerOptions = groupedSubjects
        .map(buildAnswerOption)
        .filter((option): option is EnglishJapaneseAnswerOption => Boolean(option));
      const acceptedAnswers = uniqueJapaneseAnswers(
        answerOptions.flatMap((option) => [option.characters, ...option.readings]),
      );

      return {
        meaning,
        normalizedMeaning,
        subjects: groupedSubjects,
        acceptedAnswers,
        answerOptions,
      };
    },
  );
}

/** Selects unique English prompts with an unbiased partial Fisher-Yates shuffle. */
export function selectEnglishJapaneseQuestions<
  TSubject extends EnglishJapanesePracticeSubject,
>(
  subjects: TSubject[],
  questionCount: number,
  random: () => number = Math.random,
): EnglishJapaneseQuestionData<TSubject>[] {
  const groups = buildEnglishJapaneseMeaningGroups(subjects);
  const selectedCount = Math.min(Math.max(0, questionCount), groups.length);

  for (let index = 0; index < selectedCount; index += 1) {
    const swapIndex =
      index + Math.floor(random() * Math.max(1, groups.length - index));
    [groups[index], groups[swapIndex]] = [groups[swapIndex], groups[index]];
  }

  return groups.slice(0, selectedCount).map((group) => {
    const subjectIndex = Math.min(
      group.subjects.length - 1,
      Math.floor(random() * group.subjects.length),
    );

    return {
      subject: group.subjects[subjectIndex],
      promptMeaning: group.meaning,
      acceptedAnswers: group.acceptedAnswers,
      acceptedAnswerDisplayText: group.answerOptions
        .map(formatAnswerOption)
        .filter(Boolean)
        .join(", "),
      answerOptions: group.answerOptions,
    };
  });
}

export function matchesAcceptedJapaneseAnswer(
  answer: string,
  acceptedAnswers: string[] | null | undefined,
): boolean {
  const normalizedAnswer = normalizeJapaneseAnswer(answer);
  if (!normalizedAnswer || !Array.isArray(acceptedAnswers)) {
    return false;
  }

  return acceptedAnswers.some(
    (acceptedAnswer) =>
      normalizeJapaneseAnswer(acceptedAnswer) === normalizedAnswer,
  );
}
