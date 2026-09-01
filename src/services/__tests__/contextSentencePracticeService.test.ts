import { generateContextSentenceQuestions } from "../contextSentencePracticeService";
import { getAllAssignmentsCached } from "../../utils/api";
import { getSubjectById } from "../../utils/cache";
import { getSelectedListSubjectIdSet } from "../../utils/extraStudySubjectLists";
import { getAllCustomContextSentences } from "../customContextSentenceService";

jest.mock("../../utils/api", () => ({
  getAllAssignmentsCached: jest.fn(),
}));

jest.mock("../../utils/cache", () => ({
  getSubjectById: jest.fn(),
}));

jest.mock("../../utils/extraStudySubjectLists", () => ({
  getSelectedListSubjectIdSet: jest.fn(async () => new Set()),
  getExtraStudyCandidateSubjectIds: jest.fn(
    (assignments, selectedListIds, selectedListSubjectIds) =>
      selectedListIds.length > 0
        ? Array.from(selectedListSubjectIds)
        : assignments.map((assignment: any) => assignment.data.subject_id),
  ),
  subjectMatchesExtraStudySrsStage: jest.fn(
    (subjectId, subjectIdToStage, listIds, listSubjectIds, isStageAllowed) => {
      const stage = subjectIdToStage.get(subjectId);
      return stage === undefined || stage <= 0
        ? listIds.length > 0 && listSubjectIds.has(subjectId)
        : isStageAllowed(stage);
    },
  ),
  subjectMatchesSelectedLists: jest.fn(
    (subjectId, selectedListIds, selectedListSubjectIds) =>
      selectedListIds.length === 0 || selectedListSubjectIds.has(subjectId),
  ),
}));

jest.mock("../customContextSentenceService", () => ({
  getAllCustomContextSentences: jest.fn(async () => []),
}));

const makeSubject = ({
  id,
  characters,
  reading,
  partsOfSpeech,
  level = 1,
  contextSentences,
}: {
  id: number;
  characters: string;
  reading: string;
  partsOfSpeech: string[];
  level?: number;
  contextSentences?: { ja: string; en: string }[];
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
    context_sentences:
      contextSentences ??
      [
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
  customSentencesOnly: false,
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
    (getAllCustomContextSentences as jest.Mock).mockResolvedValue([]);
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

  it("loads an above-level subject directly from a selected list", async () => {
    const selectedSubject = makeSubject({
      id: 60,
      characters: "文法",
      reading: "ぶんぽう",
      partsOfSpeech: ["noun"],
      level: 50,
    });
    (getSelectedListSubjectIdSet as jest.Mock).mockResolvedValueOnce(
      new Set([selectedSubject.id]),
    );
    (getAllAssignmentsCached as jest.Mock).mockResolvedValue({ data: [] });
    (getSubjectById as jest.Mock).mockResolvedValue(selectedSubject);

    const questions = await generateContextSentenceQuestions(
      {
        ...makeConfig(),
        maxLevel: 4,
        selectedListIds: ["grammar"],
        devSelectedSubjectIds: [selectedSubject.id],
      },
      "token",
    );

    expect(questions).toHaveLength(1);
    expect(questions[0].vocab.id).toBe(selectedSubject.id);
  });

  it("builds custom-only questions even when the subject has no built-in sentence", async () => {
    const subjects = [
      makeSubject({
        id: 1,
        characters: "世界",
        reading: "せかい",
        partsOfSpeech: ["noun"],
        contextSentences: [],
      }),
      makeSubject({
        id: 2,
        characters: "学生",
        reading: "がくせい",
        partsOfSpeech: ["noun"],
        contextSentences: [],
      }),
      makeSubject({
        id: 3,
        characters: "道",
        reading: "みち",
        partsOfSpeech: ["noun"],
        contextSentences: [],
      }),
      makeSubject({
        id: 4,
        characters: "本",
        reading: "ほん",
        partsOfSpeech: ["noun"],
        contextSentences: [],
      }),
    ];
    mockEligibleSubjects(subjects);
    (getAllCustomContextSentences as jest.Mock).mockResolvedValue([
      {
        version: 1,
        id: "mine-1",
        subjectId: 1,
        japanese: "世界は広いです。",
        kana: "せかいはひろいです。",
        english: "The world is wide.",
        displayMode: "kana",
        createdAt: "2026-08-31T00:00:00.000Z",
        updatedAt: "2026-08-31T00:00:00.000Z",
      },
    ]);

    const questions = await generateContextSentenceQuestions(
      { ...makeConfig(), customSentencesOnly: true },
      "token",
      "user-1",
    );

    expect(getAllCustomContextSentences).toHaveBeenCalledWith("user-1");
    expect(questions).toHaveLength(1);
    expect(questions[0]).toMatchObject({
      sentence: "せかいはひろいです。",
      translation: "The world is wide.",
      sentenceWithBlank: "＿＿＿はひろいです。",
    });
    expect(questions[0].kanjiChoices).toHaveLength(4);
  });

  it("skips a custom sentence that cannot blank its attached vocabulary", async () => {
    const subject = makeSubject({
      id: 1,
      characters: "世界",
      reading: "せかい",
      partsOfSpeech: ["noun"],
      contextSentences: [],
    });
    mockEligibleSubjects([subject]);
    (getAllCustomContextSentences as jest.Mock).mockResolvedValue([
      {
        version: 1,
        id: "invalid-1",
        subjectId: 1,
        japanese: "今日は晴れです。",
        kana: "きょうははれです。",
        english: "It is sunny today.",
        displayMode: "kanji",
        createdAt: "2026-08-31T00:00:00.000Z",
        updatedAt: "2026-08-31T00:00:00.000Z",
      },
    ]);

    const questions = await generateContextSentenceQuestions(
      { ...makeConfig(), customSentencesOnly: true },
      "token",
      "user-1",
    );

    expect(questions).toEqual([]);
  });

  it("does not accept a short reading embedded in a different word", async () => {
    const subject = makeSubject({
      id: 1,
      characters: "見る",
      reading: "みる",
      partsOfSpeech: ["ichidan verb"],
      contextSentences: [],
    });
    mockEligibleSubjects([subject]);
    (getAllCustomContextSentences as jest.Mock).mockResolvedValue([
      {
        version: 1,
        id: "wrong-word-1",
        subjectId: 1,
        japanese: "本を読みました。",
        kana: "ほんをよみました。",
        english: "I read a book.",
        displayMode: "kana",
        createdAt: "2026-08-31T00:00:00.000Z",
        updatedAt: "2026-08-31T00:00:00.000Z",
      },
    ]);

    const questions = await generateContextSentenceQuestions(
      { ...makeConfig(), customSentencesOnly: true },
      "token",
      "user-1",
    );

    expect(questions).toEqual([]);
  });

  it("keeps built-in sentence behavior when the custom-only option is off", async () => {
    const subject = makeSubject({
      id: 1,
      characters: "世界",
      reading: "せかい",
      partsOfSpeech: ["noun"],
    });
    mockEligibleSubjects([subject]);

    const questions = await generateContextSentenceQuestions(
      makeConfig(),
      "token",
      "user-1",
    );

    expect(getAllCustomContextSentences).not.toHaveBeenCalled();
    expect(questions).toHaveLength(1);
    expect(questions[0].sentence).toBe("世界です。");
  });
});
