import { generateContextSentenceQuestions } from "../contextSentencePracticeService";
import { getAllAssignmentsCached } from "../../utils/api";
import { getSubjectById } from "../../utils/cache";

jest.mock("../../utils/api", () => ({
  getAllAssignmentsCached: jest.fn(),
}));

jest.mock("../../utils/cache", () => ({
  getSubjectById: jest.fn(),
}));

jest.mock("../../utils/extraStudySubjectLists", () => ({
  getSelectedListSubjectIdSet: jest.fn(async () => new Set()),
  subjectMatchesSelectedLists: jest.fn(() => true),
}));

const makeSubject = ({
  id,
  characters,
  reading,
  partsOfSpeech,
  level = 1,
}: {
  id: number;
  characters: string;
  reading: string;
  partsOfSpeech: string[];
  level?: number;
}) => ({
  id,
  object: "vocabulary",
  url: `https://api.wanikani.com/v2/subjects/${id}`,
  data_updated_at: "2026-06-20T00:00:00.000Z",
  data: {
    created_at: "2026-06-20T00:00:00.000Z",
    level,
    slug: characters,
    hidden_at: null,
    document_url: `https://www.wanikani.com/vocabulary/${characters}`,
    characters,
    character_images: null,
    meanings: [{ meaning: characters, primary: true, accepted_answer: true }],
    auxiliary_meanings: [],
    readings: [{ reading, primary: true, accepted_answer: true, type: "onyomi" }],
    parts_of_speech: partsOfSpeech,
    component_subject_ids: null,
    amalgamation_subject_ids: null,
    visually_similar_subject_ids: null,
    meaning_mnemonic: "",
    meaning_hint: null,
    reading_mnemonic: null,
    reading_hint: null,
    context_sentences: [
      {
        ja: `${characters}です。`,
        en: `It is ${characters}.`,
      },
    ],
  },
});

const makeConfig = () => ({
  includeVocabulary: true,
  includeKanaVocabulary: false,
  solutionMode: "multiple_choice" as const,
  numberOfQuestions: 1,
  enableSentenceAudio: false,
  autoPlaySentenceAudio: false,
  hideTranslationUntilTap: false,
  enableJpdbSentenceBreakdown: false,
  stopAfterAnswer: false,
  srsGroups: {
    apprentice: true,
    guru: false,
    master: false,
    enlightened: false,
    burned: false,
  },
  useCustomLevelRange: false,
  minLevel: 1,
  maxLevel: 60,
  devSelectedSubjectIds: [1],
});

const mockEligibleSubjects = (subjects: ReturnType<typeof makeSubject>[]) => {
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));

  (getAllAssignmentsCached as jest.Mock).mockResolvedValue({
    data: subjects.map((subject) => ({
      data: {
        subject_id: subject.id,
        srs_stage: 1,
      },
    })),
  });
  (getSubjectById as jest.Mock).mockImplementation((subjectId: number) =>
    Promise.resolve(subjectById.get(subjectId))
  );
};

describe("generateContextSentenceQuestions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("prefers distractors with the same part of speech as the correct answer", async () => {
    const subjects = [
      makeSubject({
        id: 1,
        characters: "世界",
        reading: "せかい",
        partsOfSpeech: ["noun"],
      }),
      makeSubject({
        id: 2,
        characters: "学生",
        reading: "がくせい",
        partsOfSpeech: ["noun"],
      }),
      makeSubject({
        id: 3,
        characters: "道",
        reading: "みち",
        partsOfSpeech: ["noun"],
      }),
      makeSubject({
        id: 4,
        characters: "本",
        reading: "ほん",
        partsOfSpeech: ["noun"],
      }),
      makeSubject({
        id: 5,
        characters: "果てる",
        reading: "はてる",
        partsOfSpeech: ["ichidan verb"],
      }),
      makeSubject({
        id: 6,
        characters: "歩く",
        reading: "あるく",
        partsOfSpeech: ["godan verb"],
      }),
    ];
    mockEligibleSubjects(subjects);

    const questions = await generateContextSentenceQuestions(makeConfig(), "token");
    const question = questions[0];
    const wrongChoiceIds = question.kanjiChoices
      .filter((choice) => !choice.isCorrect)
      .map((choice) => choice.vocabId);

    expect(question.vocab.id).toBe(1);
    expect(wrongChoiceIds).toHaveLength(3);
    expect(wrongChoiceIds).toEqual(expect.arrayContaining([2, 3, 4]));
    expect(wrongChoiceIds).not.toEqual(expect.arrayContaining([5, 6]));
  });

  it("keeps i-adjective distractors separate from other adjective types when available", async () => {
    const subjects = [
      makeSubject({
        id: 1,
        characters: "楽しい",
        reading: "たのしい",
        partsOfSpeech: ["い adjective"],
      }),
      makeSubject({
        id: 2,
        characters: "嬉しい",
        reading: "うれしい",
        partsOfSpeech: ["い adjective"],
      }),
      makeSubject({
        id: 3,
        characters: "新しい",
        reading: "あたらしい",
        partsOfSpeech: ["い adjective"],
      }),
      makeSubject({
        id: 4,
        characters: "大きい",
        reading: "おおきい",
        partsOfSpeech: ["い adjective"],
      }),
      makeSubject({
        id: 5,
        characters: "静か",
        reading: "しずか",
        partsOfSpeech: ["な adjective"],
      }),
      makeSubject({
        id: 6,
        characters: "歩く",
        reading: "あるく",
        partsOfSpeech: ["godan verb"],
      }),
    ];
    mockEligibleSubjects(subjects);

    const questions = await generateContextSentenceQuestions(makeConfig(), "token");
    const question = questions[0];
    const wrongChoiceIds = question.kanjiChoices
      .filter((choice) => !choice.isCorrect)
      .map((choice) => choice.vocabId);

    expect(question.vocab.id).toBe(1);
    expect(wrongChoiceIds).toHaveLength(3);
    expect(wrongChoiceIds).toEqual(expect.arrayContaining([2, 3, 4]));
    expect(wrongChoiceIds).not.toEqual(expect.arrayContaining([5, 6]));
  });
});
