import type {
  JlptLevel,
  JlptMockStructure,
  JlptQuestion,
  JlptTestItemType,
  JlptTestSectionId,
} from "./types";

export const OFFICIAL_TYPE_LABELS: Record<JlptTestItemType, string> = {
  "kanji-reading": "Kanji reading",
  orthography: "Orthography",
  "word-formation": "Word formation",
  "context-expression": "Contextually-defined expressions",
  paraphrase: "Paraphrases",
  usage: "Usage",
  "grammar-form": "Selecting grammar form",
  "sentence-composition": "Sentence composition",
  "text-grammar": "Text grammar",
  "reading-short": "Short-passage comprehension",
  "reading-mid": "Mid-size passage comprehension",
  "reading-long": "Long-passage comprehension",
  "reading-integrated": "Integrated comprehension",
  "reading-thematic": "Thematic comprehension",
  "information-retrieval": "Information retrieval",
  "listening-task": "Task-based comprehension",
  "listening-key-points": "Comprehension of key points",
  "listening-outline": "Comprehension of general outline",
  "listening-verbal": "Verbal expressions",
  "listening-quick-response": "Quick response",
  "listening-integrated": "Integrated comprehension",
};

export const SKILL_LABELS = {
  kanji: "Kanji",
  vocabulary: "Vocabulary",
  grammar: "Grammar",
  reading: "Reading",
  listening: "Listening",
} as const;

const language60 = {
  id: "language",
  title: "Language Knowledge (Vocabulary/Grammar)",
  scoreRange: 60,
  officialSectionalPassMark: 19,
  skills: ["kanji", "vocabulary", "grammar"],
} as const;
const reading60 = {
  id: "reading",
  title: "Reading",
  scoreRange: 60,
  officialSectionalPassMark: 19,
  skills: ["reading"],
} as const;
const listening60 = {
  id: "listening",
  title: "Listening",
  scoreRange: 60,
  officialSectionalPassMark: 19,
  skills: ["listening"],
} as const;
const languageReading120 = {
  id: "language-reading",
  title: "Language Knowledge (Vocabulary/Grammar) & Reading",
  scoreRange: 120,
  officialSectionalPassMark: 38,
  skills: ["kanji", "vocabulary", "grammar", "reading"],
} as const;

export const JLPT_MOCK_STRUCTURES: Record<JlptLevel, JlptMockStructure> = {
  N1: {
    level: "N1",
    sections: [
      {
        id: "language-reading",
        title: "Language Knowledge (Vocabulary/Grammar) & Reading",
        shortTitle: "Language & Reading",
        durationMinutes: 110,
      },
      {
        id: "listening",
        title: "Listening",
        shortTitle: "Listening",
        durationMinutes: 55,
      },
    ],
    scoringSections: [language60, reading60, listening60],
    officialOverallPassMark: 100,
    officialTotalRange: 180,
  },
  N2: {
    level: "N2",
    sections: [
      {
        id: "language-reading",
        title: "Language Knowledge (Vocabulary/Grammar) & Reading",
        shortTitle: "Language & Reading",
        durationMinutes: 105,
      },
      {
        id: "listening",
        title: "Listening",
        shortTitle: "Listening",
        durationMinutes: 50,
      },
    ],
    scoringSections: [language60, reading60, listening60],
    officialOverallPassMark: 90,
    officialTotalRange: 180,
  },
  N3: {
    level: "N3",
    sections: [
      {
        id: "vocabulary",
        title: "Language Knowledge (Vocabulary)",
        shortTitle: "Vocabulary",
        durationMinutes: 30,
      },
      {
        id: "grammar-reading",
        title: "Language Knowledge (Grammar) & Reading",
        shortTitle: "Grammar & Reading",
        durationMinutes: 70,
      },
      {
        id: "listening",
        title: "Listening",
        shortTitle: "Listening",
        durationMinutes: 40,
      },
    ],
    scoringSections: [language60, reading60, listening60],
    officialOverallPassMark: 95,
    officialTotalRange: 180,
  },
  N4: {
    level: "N4",
    sections: [
      {
        id: "vocabulary",
        title: "Language Knowledge (Vocabulary)",
        shortTitle: "Vocabulary",
        durationMinutes: 25,
      },
      {
        id: "grammar-reading",
        title: "Language Knowledge (Grammar) & Reading",
        shortTitle: "Grammar & Reading",
        durationMinutes: 55,
      },
      {
        id: "listening",
        title: "Listening",
        shortTitle: "Listening",
        durationMinutes: 35,
      },
    ],
    scoringSections: [languageReading120, listening60],
    officialOverallPassMark: 90,
    officialTotalRange: 180,
  },
  N5: {
    level: "N5",
    sections: [
      {
        id: "vocabulary",
        title: "Language Knowledge (Vocabulary)",
        shortTitle: "Vocabulary",
        durationMinutes: 20,
      },
      {
        id: "grammar-reading",
        title: "Language Knowledge (Grammar) & Reading",
        shortTitle: "Grammar & Reading",
        durationMinutes: 40,
      },
      {
        id: "listening",
        title: "Listening",
        shortTitle: "Listening",
        durationMinutes: 30,
      },
    ],
    scoringSections: [languageReading120, listening60],
    officialOverallPassMark: 80,
    officialTotalRange: 180,
  },
};

const VOCABULARY_TYPES: JlptTestItemType[] = [
  "kanji-reading",
  "orthography",
  "word-formation",
  "context-expression",
  "paraphrase",
  "usage",
];
const GRAMMAR_TYPES: JlptTestItemType[] = [
  "grammar-form",
  "sentence-composition",
  "text-grammar",
];
const READING_TYPES: JlptTestItemType[] = [
  "reading-short",
  "reading-mid",
  "reading-long",
  "reading-integrated",
  "reading-thematic",
  "information-retrieval",
];
export const OFFICIAL_TYPES_BY_LEVEL: Record<
  JlptLevel,
  readonly JlptTestItemType[]
> = {
  N1: [
    "kanji-reading",
    "context-expression",
    "paraphrase",
    "usage",
    ...GRAMMAR_TYPES,
    ...READING_TYPES,
    "listening-task",
    "listening-key-points",
    "listening-outline",
    "listening-quick-response",
    "listening-integrated",
  ],
  N2: [
    ...VOCABULARY_TYPES,
    ...GRAMMAR_TYPES,
    "reading-short",
    "reading-mid",
    "reading-integrated",
    "reading-thematic",
    "information-retrieval",
    "listening-task",
    "listening-key-points",
    "listening-outline",
    "listening-quick-response",
    "listening-integrated",
  ],
  N3: [
    "kanji-reading",
    "orthography",
    "context-expression",
    "paraphrase",
    "usage",
    ...GRAMMAR_TYPES,
    "reading-short",
    "reading-mid",
    "reading-long",
    "information-retrieval",
    "listening-task",
    "listening-key-points",
    "listening-outline",
    "listening-verbal",
    "listening-quick-response",
  ],
  N4: [
    "kanji-reading",
    "orthography",
    "context-expression",
    "paraphrase",
    "usage",
    ...GRAMMAR_TYPES,
    "reading-short",
    "reading-mid",
    "information-retrieval",
    "listening-task",
    "listening-key-points",
    "listening-verbal",
    "listening-quick-response",
  ],
  N5: [
    "kanji-reading",
    "orthography",
    "context-expression",
    "paraphrase",
    ...GRAMMAR_TYPES,
    "reading-short",
    "reading-mid",
    "information-retrieval",
    "listening-task",
    "listening-key-points",
    "listening-verbal",
    "listening-quick-response",
  ],
};

/**
 * Published approximate item counts from the official JLPT test-content guide.
 * Actual operational forms can vary, so Kakehashi presents these as representative
 * mock forms and never as an official released test.
 */
export const JLPT_APPROXIMATE_ITEM_COUNTS: Record<
  JlptLevel,
  Partial<Record<JlptTestItemType, number>>
> = {
  N1: {
    "kanji-reading": 6,
    "context-expression": 7,
    paraphrase: 6,
    usage: 6,
    "grammar-form": 10,
    "sentence-composition": 5,
    "text-grammar": 5,
    "reading-short": 4,
    "reading-mid": 9,
    "reading-long": 4,
    "reading-integrated": 3,
    "reading-thematic": 4,
    "information-retrieval": 2,
    "listening-task": 5,
    "listening-key-points": 6,
    "listening-outline": 5,
    "listening-quick-response": 11,
    "listening-integrated": 3,
  },
  N2: {
    "kanji-reading": 5,
    orthography: 5,
    "word-formation": 5,
    "context-expression": 7,
    paraphrase: 5,
    usage: 5,
    "grammar-form": 12,
    "sentence-composition": 5,
    "text-grammar": 5,
    "reading-short": 5,
    "reading-mid": 9,
    "reading-integrated": 2,
    "reading-thematic": 3,
    "information-retrieval": 2,
    "listening-task": 5,
    "listening-key-points": 6,
    "listening-outline": 5,
    "listening-quick-response": 12,
    "listening-integrated": 4,
  },
  N3: {
    "kanji-reading": 8,
    orthography: 6,
    "context-expression": 11,
    paraphrase: 5,
    usage: 5,
    "grammar-form": 13,
    "sentence-composition": 5,
    "text-grammar": 5,
    "reading-short": 4,
    "reading-mid": 6,
    "reading-long": 4,
    "information-retrieval": 2,
    "listening-task": 6,
    "listening-key-points": 6,
    "listening-outline": 3,
    "listening-verbal": 4,
    "listening-quick-response": 9,
  },
  N4: {
    "kanji-reading": 7,
    orthography: 5,
    "context-expression": 8,
    paraphrase: 4,
    usage: 4,
    "grammar-form": 13,
    "sentence-composition": 4,
    "text-grammar": 4,
    "reading-short": 3,
    "reading-mid": 3,
    "information-retrieval": 2,
    "listening-task": 8,
    "listening-key-points": 7,
    "listening-verbal": 5,
    "listening-quick-response": 8,
  },
  N5: {
    "kanji-reading": 7,
    orthography: 5,
    "context-expression": 6,
    paraphrase: 3,
    "grammar-form": 9,
    "sentence-composition": 4,
    "text-grammar": 4,
    "reading-short": 2,
    "reading-mid": 2,
    "information-retrieval": 1,
    "listening-task": 7,
    "listening-key-points": 6,
    "listening-verbal": 5,
    "listening-quick-response": 6,
  },
};

export function approximateMockQuestionCount(level: JlptLevel) {
  return Object.values(JLPT_APPROXIMATE_ITEM_COUNTS[level]).reduce(
    (total, count) => total + count,
    0,
  );
}

export function supportsOfficialType(level: JlptLevel, type: JlptTestItemType) {
  return OFFICIAL_TYPES_BY_LEVEL[level].includes(type);
}

export function testSectionIdForQuestion(
  level: JlptLevel,
  question: JlptQuestion,
): JlptTestSectionId {
  if (question.skill === "listening") return "listening";
  if (level === "N1" || level === "N2") return "language-reading";
  if (question.skill === "kanji" || question.skill === "vocabulary")
    return "vocabulary";
  return "grammar-reading";
}

export function officialTypeOrder(level: JlptLevel, type: JlptTestItemType) {
  const index = OFFICIAL_TYPES_BY_LEVEL[level].indexOf(type);
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}
