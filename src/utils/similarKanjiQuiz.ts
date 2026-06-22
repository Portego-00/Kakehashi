import type { Subject as ApiSubject } from "./api";

export interface SimilarKanjiMeaningChoice {
  subjectId: number;
  meaning: string;
}

export interface SimilarKanjiQuestion<
  TSubject extends SimilarKanjiQuizSubject = SimilarKanjiQuizSubject,
> {
  id: number;
  targetSubject: TSubject;
  similarSubject: TSubject;
  choices: [SimilarKanjiMeaningChoice, SimilarKanjiMeaningChoice];
  correctChoiceSubjectId: number;
}

export type SimilarKanjiQuizSubject = Pick<ApiSubject, "id" | "object"> & {
  data: Pick<ApiSubject["data"], "characters" | "meanings">;
};

interface BuildSimilarKanjiQuestionsOptions<
  TSubject extends SimilarKanjiQuizSubject,
> {
  targetSubjects: TSubject[];
  allKanjiSubjects: TSubject[];
  learnedKanjiSubjectIds: ReadonlySet<number>;
  includeUnlearnedSimilarKanji: boolean;
  numberOfQuestions: number;
  getSimilarKanji: (kanji: string) => string[];
  randomFn?: () => number;
}

function shuffleCopy<T>(items: T[], randomFn: () => number): T[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(randomFn() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}

function sampleOne<T>(items: T[], randomFn: () => number): T | null {
  if (items.length === 0) {
    return null;
  }

  return items[Math.floor(randomFn() * items.length)] ?? items[0];
}

export function getPrimaryKanjiMeaning(
  subject: SimilarKanjiQuizSubject,
): string | null {
  const meanings = subject.data.meanings;
  if (!Array.isArray(meanings) || meanings.length === 0) {
    return null;
  }

  const primaryMeaning =
    meanings.find((meaning) => meaning.primary) ??
    meanings.find((meaning) => meaning.accepted_answer) ??
    meanings[0];

  const meaning = primaryMeaning?.meaning?.trim();
  return meaning ? meaning : null;
}

function getKanjiCharacters(subject: SimilarKanjiQuizSubject): string | null {
  if (subject.object !== "kanji") {
    return null;
  }

  const characters = subject.data.characters?.trim();
  return characters ? characters : null;
}

function hasUsableMeaning(subject: SimilarKanjiQuizSubject): boolean {
  return getPrimaryKanjiMeaning(subject) !== null;
}

function normalizeMeaningForComparison(meaning: string): string {
  return meaning.trim().toLocaleLowerCase();
}

export function buildSimilarKanjiQuestions<
  TSubject extends SimilarKanjiQuizSubject,
>({
  targetSubjects,
  allKanjiSubjects,
  learnedKanjiSubjectIds,
  includeUnlearnedSimilarKanji,
  numberOfQuestions,
  getSimilarKanji,
  randomFn = Math.random,
}: BuildSimilarKanjiQuestionsOptions<TSubject>): SimilarKanjiQuestion<TSubject>[] {
  const maxQuestions = Math.max(0, Math.floor(numberOfQuestions));
  if (maxQuestions === 0) {
    return [];
  }

  const subjectByCharacters = new Map<string, TSubject>();
  allKanjiSubjects.forEach((subject) => {
    const characters = getKanjiCharacters(subject);
    if (characters && hasUsableMeaning(subject)) {
      subjectByCharacters.set(characters, subject);
    }
  });

  const shuffledTargets = shuffleCopy(
    targetSubjects.filter((subject) => {
      const characters = getKanjiCharacters(subject);
      return Boolean(characters && hasUsableMeaning(subject));
    }),
    randomFn,
  );
  const questions: SimilarKanjiQuestion<TSubject>[] = [];

  for (const targetSubject of shuffledTargets) {
    if (questions.length >= maxQuestions) {
      break;
    }

    const targetCharacters = getKanjiCharacters(targetSubject);
    const targetMeaning = getPrimaryKanjiMeaning(targetSubject);
    if (!targetCharacters || !targetMeaning) {
      continue;
    }

    const targetMeaningKey = normalizeMeaningForComparison(targetMeaning);
    const similarCandidates = getSimilarKanji(targetCharacters)
      .map((characters) => subjectByCharacters.get(characters))
      .filter((subject): subject is TSubject => {
        if (!subject || subject.id === targetSubject.id) {
          return false;
        }

        if (
          !includeUnlearnedSimilarKanji &&
          !learnedKanjiSubjectIds.has(subject.id)
        ) {
          return false;
        }

        const meaning = getPrimaryKanjiMeaning(subject);
        return Boolean(
          meaning &&
            normalizeMeaningForComparison(meaning) !== targetMeaningKey,
        );
      });

    const similarSubject = sampleOne(similarCandidates, randomFn);
    const similarMeaning = similarSubject
      ? getPrimaryKanjiMeaning(similarSubject)
      : null;
    if (!similarSubject || !similarMeaning) {
      continue;
    }

    const choices = shuffleCopy(
      [
        { subjectId: targetSubject.id, meaning: targetMeaning },
        { subjectId: similarSubject.id, meaning: similarMeaning },
      ],
      randomFn,
    ) as [SimilarKanjiMeaningChoice, SimilarKanjiMeaningChoice];

    questions.push({
      id: questions.length,
      targetSubject,
      similarSubject,
      choices,
      correctChoiceSubjectId: targetSubject.id,
    });
  }

  return questions;
}
