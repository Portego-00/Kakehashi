import type { Subject as ApiSubject } from "./api";

export type SimilarKanjiSource = "wanikani" | "niai";

export interface SimilarKanjiMeaningChoice {
  id: number;
  subjectId: number;
  meaning: string;
}

export interface SimilarKanjiRoundItem<
  TSubject extends SimilarKanjiQuizSubject = SimilarKanjiQuizSubject,
> {
  id: number;
  subject: TSubject;
  meaning: string;
}

export interface SimilarKanjiRound<
  TSubject extends SimilarKanjiQuizSubject = SimilarKanjiQuizSubject,
> {
  id: number;
  items: SimilarKanjiRoundItem<TSubject>[];
  meaningChoices: SimilarKanjiMeaningChoice[];
}

export type SimilarKanjiQuizSubject = Pick<ApiSubject, "id" | "object"> & {
  data: Pick<
    ApiSubject["data"],
    "characters" | "meanings" | "visually_similar_subject_ids"
  >;
};

interface BuildSimilarKanjiRoundsOptions<
  TSubject extends SimilarKanjiQuizSubject,
> {
  targetSubjects: TSubject[];
  allKanjiSubjects: TSubject[];
  learnedKanjiSubjectIds: ReadonlySet<number>;
  includeUnlearnedSimilarKanji: boolean;
  numberOfRounds: number;
  maxKanjiPerRound: number;
  source: SimilarKanjiSource;
  getNiaiSimilarKanji: (kanji: string) => string[];
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

function getSimilarCandidates<TSubject extends SimilarKanjiQuizSubject>(
  targetSubject: TSubject,
  source: SimilarKanjiSource,
  subjectById: Map<number, TSubject>,
  subjectByCharacters: Map<string, TSubject>,
  getNiaiSimilarKanji: (kanji: string) => string[],
): TSubject[] {
  if (source === "wanikani") {
    const subjectIds = targetSubject.data.visually_similar_subject_ids;
    if (!Array.isArray(subjectIds) || subjectIds.length === 0) {
      return [];
    }

    return subjectIds
      .map((subjectId) => subjectById.get(subjectId))
      .filter((subject): subject is TSubject => Boolean(subject));
  }

  const characters = getKanjiCharacters(targetSubject);
  if (!characters) {
    return [];
  }

  return getNiaiSimilarKanji(characters)
    .map((kanji) => subjectByCharacters.get(kanji))
    .filter((subject): subject is TSubject => Boolean(subject));
}

export function buildSimilarKanjiRounds<
  TSubject extends SimilarKanjiQuizSubject,
>({
  targetSubjects,
  allKanjiSubjects,
  learnedKanjiSubjectIds,
  includeUnlearnedSimilarKanji,
  numberOfRounds,
  maxKanjiPerRound,
  source,
  getNiaiSimilarKanji,
  randomFn = Math.random,
}: BuildSimilarKanjiRoundsOptions<TSubject>): SimilarKanjiRound<TSubject>[] {
  const maxRounds = Math.max(0, Math.floor(numberOfRounds));
  const maxItemsPerRound = Math.max(2, Math.floor(maxKanjiPerRound));
  if (maxRounds === 0) {
    return [];
  }

  const subjectById = new Map<number, TSubject>();
  const subjectByCharacters = new Map<string, TSubject>();
  allKanjiSubjects.forEach((subject) => {
    const characters = getKanjiCharacters(subject);
    if (!characters || !hasUsableMeaning(subject)) {
      return;
    }

    subjectById.set(subject.id, subject);
    subjectByCharacters.set(characters, subject);
  });

  const shuffledTargets = shuffleCopy(
    targetSubjects.filter((subject) => {
      const characters = getKanjiCharacters(subject);
      return Boolean(characters && hasUsableMeaning(subject));
    }),
    randomFn,
  );
  const rounds: SimilarKanjiRound<TSubject>[] = [];
  let nextRoundItemId = 1;

  for (const targetSubject of shuffledTargets) {
    if (rounds.length >= maxRounds) {
      break;
    }

    const targetMeaning = getPrimaryKanjiMeaning(targetSubject);
    if (!targetMeaning) {
      continue;
    }

    const selectedSubjects: TSubject[] = [targetSubject];
    const usedMeaningKeys = new Set([
      normalizeMeaningForComparison(targetMeaning),
    ]);
    const similarCandidates = shuffleCopy(
      getSimilarCandidates(
        targetSubject,
        source,
        subjectById,
        subjectByCharacters,
        getNiaiSimilarKanji,
      ),
      randomFn,
    );

    for (const subject of similarCandidates) {
      if (selectedSubjects.length >= maxItemsPerRound) {
        break;
      }

      if (subject.id === targetSubject.id) {
        continue;
      }

      if (
        !includeUnlearnedSimilarKanji &&
        !learnedKanjiSubjectIds.has(subject.id)
      ) {
        continue;
      }

      const meaning = getPrimaryKanjiMeaning(subject);
      if (!meaning) {
        continue;
      }

      const meaningKey = normalizeMeaningForComparison(meaning);
      if (usedMeaningKeys.has(meaningKey)) {
        continue;
      }

      selectedSubjects.push(subject);
      usedMeaningKeys.add(meaningKey);
    }

    if (selectedSubjects.length < 2) {
      continue;
    }

    const items = selectedSubjects.map((subject) => ({
      id: nextRoundItemId++,
      subject,
      meaning: getPrimaryKanjiMeaning(subject) ?? "",
    }));

    rounds.push({
      id: rounds.length,
      items,
      meaningChoices: shuffleCopy(
        items.map((item) => ({
          id: item.id,
          subjectId: item.subject.id,
          meaning: item.meaning,
        })),
        randomFn,
      ),
    });
  }

  return rounds;
}
