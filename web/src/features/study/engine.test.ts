import type { Assignment, Subject, SubjectType } from "@/types/wanikani";
import { advanceStudySession, answerStudyQuestion, checkAnswer, createStudySession, DEFAULT_STUDY_FILTERS, filterStudySubjects, generateQuestions, getSessionSummary, getStudyItemProgress, normalizeMeaning, normalizeReading, recentLessonSubjectIds, resolveStudyAnswerStatus, sanitizeStudyFilters, unlockedLessonSubjects } from "./engine";
import type { StudyFilters, StudyQuestion } from "./types";

function subject(id: number, object: SubjectType, characters: string, meaning: string, reading = ""): Subject {
  return {
    id, object, url: "", data_updated_at: "2026-01-01T00:00:00Z",
    data: {
      level: 2, created_at: "2026-01-01T00:00:00Z", slug: characters, document_url: "", hidden_at: null, characters,
      meanings: [{ meaning, primary: true, accepted_answer: true }], auxiliary_meanings: [{ meaning: `a ${meaning}`, type: "whitelist" }],
      readings: reading ? [{ reading, primary: true, accepted_answer: true }] : undefined,
      visually_similar_subject_ids: id === 2 ? [3] : [],
      context_sentences: object === "vocabulary" ? [{ ja: `${characters}が好きです。`, en: `I like ${meaning}.` }] : undefined,
      pronunciation_audios: object === "vocabulary" ? [{ url: "https://example.com/audio.mp3", content_type: "audio/mpeg", metadata: { gender: "female", source_id: 1, pronunciation: reading, voice_actor_id: 1, voice_actor_name: "M", voice_description: "Tokyo" } }] : undefined,
    },
  };
}

function assignment(subjectId: number, stage = 3): Assignment {
  return { id: subjectId + 100, object: "assignment", url: "", data_updated_at: "2026-01-01T00:00:00Z", data: { subject_id: subjectId, subject_type: "vocabulary", srs_stage: stage, available_at: null, started_at: "2026-08-01T00:00:00Z", unlocked_at: "2026-07-01T00:00:00Z", passed_at: null, burned_at: null, resurrected_at: null, hidden: false, created_at: "2026-01-01T00:00:00Z" } };
}

const subjects = [subject(1, "vocabulary", "猫", "Cat", "ねこ"), subject(2, "kanji", "末", "End", "まつ"), subject(3, "kanji", "未", "Not Yet", "み")];
const assignments = subjects.map((item) => ({ ...assignment(item.id), data: { ...assignment(item.id).data, subject_type: item.object } }));
const filters: StudyFilters = { ...DEFAULT_STUDY_FILTERS, count: 20, subjectTypes: ["kanji", "vocabulary"], srsGroups: ["apprentice"], minLevel: 1, maxLevel: 5, selectedSubjectIds: [], questionKinds: ["meaning", "reading"] };

describe("study question engine", () => {
  it("builds audio-only meaning cards from recorded vocabulary and keeps empty lists empty", () => {
    const noAudio = { ...subject(10, "vocabulary", "犬", "Dog", "いぬ"), data: { ...subject(10, "vocabulary", "犬", "Dog", "いぬ").data, pronunciation_audios: [] } };
    const dataset = { subjects: [...subjects, noAudio], assignments: [...assignments, assignment(10)] };
    const questions = generateQuestions("audio-vocab", dataset, filters);
    expect(questions).toHaveLength(1);
    expect(questions[0]).toMatchObject({ kind: "audio-vocab", prompt: "Listen", displayAnswer: "Cat", reading: "ねこ" });
    expect(questions[0].choices).toBeUndefined();
    expect(generateQuestions("audio-vocab", dataset, { ...filters, selectedListIds: ["empty"], selectedSubjectIds: [] })).toHaveLength(0);
    expect(generateQuestions("audio-vocab", { subjects, assignments: [] }, { ...filters, selectedListIds: ["cats"], selectedSubjectIds: [1] })).toHaveLength(1);
  });

  it("builds sentence audio questions without recordings and grades the target word's meaning", () => {
    const cat = subject(1, "vocabulary", "猫", "Cat", "ねこ");
    const sentenceOnly = { ...cat, data: { ...cat.data, pronunciation_audios: [], context_sentences: [{ ja: "  ", en: "" }, { ja: "  猫が好きです。  ", en: "I like cats." }] } };
    const [question] = generateQuestions("audio-vocab", { subjects: [sentenceOnly], assignments: [assignment(1)] }, { ...filters, audioVocabSource: "sentence", listeningAutoPlayAudio: false });

    expect(question).toMatchObject({ kind: "audio-vocab", prompt: "Listen", audioVocabSentence: "猫が好きです。", reading: "ねこ", acceptedAnswers: ["Cat"], displayAnswer: "Cat", autoPlayAudio: false });
    expect(question.audioUrl).toBeUndefined();
    expect(question.choices).toBeUndefined();
    expect(checkAnswer(question, "cat")).toBe(true);
    expect(checkAnswer(question, "I like cats.")).toBe(false);
    expect(generateQuestions("audio-vocab", { subjects: [sentenceOnly], assignments: [assignment(1)] }, { ...filters, audioVocabSource: "word" })).toHaveLength(0);
  });

  it("excludes words with no usable Japanese sentence from the sentence source", () => {
    const cat = subject(1, "vocabulary", "猫", "Cat", "ねこ");
    const missing = { ...cat, data: { ...cat.data, context_sentences: [] } };
    const blank = { ...cat, id: 10, data: { ...cat.data, context_sentences: [{ ja: " \n ", en: "An English-only sentence." }] } };
    expect(generateQuestions("audio-vocab", { subjects: [missing, blank], assignments: [assignment(1), assignment(10)] }, { ...filters, audioVocabSource: "sentence" })).toHaveLength(0);
  });

  it("defaults old audio configurations to word recordings and preserves a sentence selection", () => {
    expect(DEFAULT_STUDY_FILTERS.audioVocabSource).toBe("word");
    expect(sanitizeStudyFilters({ count: 10 }).audioVocabSource).toBe("word");
    expect(sanitizeStudyFilters({ audioVocabSource: "sentence" }).audioVocabSource).toBe("sentence");
  });

  it("normalizes English and kana answers without accepting blanks", () => {
    expect(normalizeMeaning("  To RUN! ")).toBe("run");
    expect(normalizeReading("neko")).toBe("ねこ");
    const question: StudyQuestion = { id: "1", subjectId: 1, subjectType: "vocabulary", kind: "meaning-to-reading", prompt: "Cat", promptLabel: "Reading", acceptedAnswers: ["ねこ"], displayAnswer: "ねこ" };
    expect(checkAnswer(question, "neko")).toBe(true);
    expect(checkAnswer(question, "")).toBe(false);
  });

  it("persists an already-evaluated close answer without exact regrading", () => {
    const question: StudyQuestion = { id: "close", subjectId: 1, subjectType: "vocabulary", kind: "meaning", prompt: "七日", promptLabel: "Meaning", acceptedAnswers: ["Seventh Day"], displayAnswer: "Seventh Day" };
    const session = answerStudyQuestion(
      createStudySession("random-test", [question]),
      "sevent day",
      new Date("2026-08-27T14:00:00Z"),
      "close",
    );

    expect(session.answers).toEqual([{
      questionId: "close",
      value: "sevent day",
      correct: true,
      status: "close",
      answeredAt: "2026-08-27T14:00:00.000Z",
    }]);
    expect(getSessionSummary(session)).toMatchObject({ correct: 1, accuracy: 100, incorrectSubjectIds: [] });

    const rejected = resolveStudyAnswerStatus(session, "close", "incorrect", new Date("2026-08-27T14:01:00Z"));
    expect(rejected.answers[0]).toMatchObject({ value: "sevent day", correct: false, status: "incorrect" });
    expect(rejected.updatedAt).toBe("2026-08-27T14:01:00.000Z");
    expect(getSessionSummary(rejected)).toMatchObject({ correct: 0, accuracy: 0, incorrectSubjectIds: [1] });
  });

  it("keeps exact grading as the fallback and records its outcome", () => {
    const question: StudyQuestion = { id: "exact", subjectId: 1, subjectType: "vocabulary", kind: "meaning", prompt: "七日", promptLabel: "Meaning", acceptedAnswers: ["Seventh Day"], displayAnswer: "Seventh Day" };
    const accepted = answerStudyQuestion(createStudySession("random-test", [question]), "Seventh Day");
    const rejected = answerStudyQuestion(createStudySession("random-test", [question]), "Sevent Day");

    expect(accepted.answers[0]).toMatchObject({ correct: true, status: "correct" });
    expect(rejected.answers[0]).toMatchObject({ correct: false, status: "incorrect" });
  });

  it("filters by assignment SRS and selected subjects", () => {
    const selected = filterStudySubjects({ subjects, assignments }, { ...filters, selectedSubjectIds: [1] });
    expect(selected.map((item) => item.id)).toEqual([1]);
    expect(filterStudySubjects({ subjects, assignments: assignments.map((item) => ({ ...item, data: { ...item.data, srs_stage: 8 } })) }, filters)).toHaveLength(0);
  });

  it("offers only unlocked, visible subjects for custom lessons", () => {
    const locked = { ...assignment(2), data: { ...assignment(2).data, unlocked_at: null } };
    const hidden = { ...assignment(3), data: { ...assignment(3).data, hidden: true } };
    expect(unlockedLessonSubjects({ subjects, assignments: [assignment(1), locked, hidden] }).map((item) => item.id)).toEqual([1]);
  });

  it("honors an exact custom-review selection even without assignments", () => {
    const locked = subject(40, "vocabulary", "犬", "Dog", "いぬ");
    const questions = generateQuestions("custom-review", { subjects: [...subjects, locked], assignments }, { ...filters, selectedSubjectIds: [40], count: 10 }, () => 0.5);
    expect(questions.map((question) => question.subjectId)).toEqual([40, 40]);
    expect(questions.map((question) => question.kind).toSorted()).toEqual(["meaning", "reading"]);
  });

  it("counts paired meaning and reading prompts as one custom-review item", () => {
    const reviewSubjects = Array.from({ length: 5 }, (_, index) => subject(40 + index, "vocabulary", `語${index}`, `Word ${index}`, `ご${index}`));
    const questions = generateQuestions(
      "custom-review",
      { subjects: reviewSubjects, assignments: [] },
      { ...filters, selectedSubjectIds: reviewSubjects.map((item) => item.id), count: 5 },
      { random: () => 0.5, backToBackQuestions: true },
    );

    expect(new Set(questions.map((question) => question.subjectId))).toHaveLength(5);
    expect(questions).toHaveLength(10);
    expect(getStudyItemProgress(questions, 0)).toEqual({ current: 1, total: 5 });
    expect(getStudyItemProgress(questions, 1)).toEqual({ current: 1, total: 5 });
    expect(getStudyItemProgress(questions, 2)).toEqual({ current: 2, total: 5 });
    for (const reviewSubject of reviewSubjects) {
      expect(questions.filter((question) => question.subjectId === reviewSubject.id).map((question) => question.kind).toSorted()).toEqual(["meaning", "reading"]);
    }
  });

  it("uses the separate custom review subject order", () => {
    const low = { ...subject(60, "kanji", "下", "Below", "した"), data: { ...subject(60, "kanji", "下", "Below", "した").data, level: 2 } };
    const high = { ...subject(61, "kanji", "上", "Above", "うえ"), data: { ...subject(61, "kanji", "上", "Above", "うえ").data, level: 12 } };

    const questions = generateQuestions(
      "custom-review",
      { subjects: [low, high], assignments: [assignment(low.id), assignment(high.id)] },
      { ...filters, selectedSubjectIds: [low.id, high.id] },
      {
        random: () => 0,
        customReviewOrder: "currentLevelFirst",
        reviewQuestionOrderEnabled: true,
        reviewQuestionOrder: "meaning-first",
        backToBackQuestions: true,
      },
    );

    expect(Array.from(new Set(questions.map((question) => question.subjectId)))).toEqual([high.id, low.id]);
  });

  it("uses a shuffled rank as the final tie-break for custom review order", () => {
    const tiedSubjects = [
      subject(90, "kanji", "一", "One", "いち"),
      subject(91, "kanji", "二", "Two", "に"),
      subject(92, "kanji", "三", "Three", "さん"),
    ];
    const questions = generateQuestions(
      "custom-review",
      { subjects: tiedSubjects, assignments: tiedSubjects.map((item) => assignment(item.id)) },
      { ...filters, selectedSubjectIds: tiedSubjects.map((item) => item.id) },
      {
        random: () => 0,
        customReviewOrder: "lowestLevelFirst",
        reviewQuestionOrderEnabled: true,
        reviewQuestionOrder: "meaning-first",
        backToBackQuestions: true,
      },
    );

    expect(Array.from(new Set(questions.map((question) => question.subjectId)))).toEqual([91, 92, 90]);
  });

  it("applies custom type grouping and critical priority before custom review order", () => {
    const olderRadical = { ...subject(70, "radical", "一", "One"), data: { ...subject(70, "radical", "一", "One").data, level: 9 } };
    const criticalKanji = { ...subject(71, "kanji", "二", "Two", "に"), data: { ...subject(71, "kanji", "二", "Two", "に").data, level: 10 } };
    const vocabulary = { ...subject(72, "vocabulary", "三つ", "Three", "みっつ"), data: { ...subject(72, "vocabulary", "三つ", "Three", "みっつ").data, level: 10 } };
    const reviewAssignments = [
      { ...assignment(70, 1), data: { ...assignment(70, 1).data, subject_type: "radical" as const } },
      { ...assignment(71, 2), data: { ...assignment(71, 2).data, subject_type: "kanji" as const } },
      { ...assignment(72, 1), data: { ...assignment(72, 1).data, subject_type: "vocabulary" as const } },
    ];

    const questions = generateQuestions(
      "custom-review",
      { subjects: [olderRadical, criticalKanji, vocabulary], assignments: reviewAssignments },
      { ...filters, selectedSubjectIds: [70, 71, 72] },
      {
        random: () => 0,
        customReviewOrder: "lowestLevelFirst",
        reviewTypeOrderEnabled: true,
        reviewTypeOrder: ["vocabulary", "radical", "kanji"],
        prioritizeCriticalItems: true,
        userLevel: 10,
        backToBackQuestions: true,
      },
    );

    expect(Array.from(new Set(questions.map((question) => question.subjectId)))).toEqual([criticalKanji.id, vocabulary.id, olderRadical.id]);
  });

  it("spreads custom review counterparts with the preferred side first", () => {
    const reviewSubjects = Array.from({ length: 4 }, (_, index) => subject(80 + index, "vocabulary", `例${index}`, `Example ${index}`, `れい${index}`));
    const questions = generateQuestions(
      "custom-review",
      { subjects: reviewSubjects, assignments: reviewSubjects.map((item) => assignment(item.id)) },
      { ...filters, selectedSubjectIds: reviewSubjects.map((item) => item.id) },
      {
        random: () => 0,
        customReviewOrder: "lowestLevelFirst",
        reviewQuestionOrderEnabled: true,
        reviewQuestionOrder: "reading-first",
        backToBackQuestions: false,
        maxQuestionGap: 10,
      },
    );

    for (const reviewSubject of reviewSubjects) {
      const readingIndex = questions.findIndex((question) => question.subjectId === reviewSubject.id && question.kind === "reading");
      const meaningIndex = questions.findIndex((question) => question.subjectId === reviewSubject.id && question.kind === "meaning");
      expect(readingIndex).toBeLessThan(meaningIndex);
      expect(meaningIndex - readingIndex).toBeLessThanOrEqual(10);
    }
    expect(questions.slice(0, reviewSubjects.length).every((question) => question.kind === "reading")).toBe(true);
  });

  it("counts paired meaning and reading prompts as one random-test item", () => {
    const reviewSubjects = Array.from({ length: 6 }, (_, index) => subject(50 + index, "vocabulary", `単語${index}`, `Term ${index}`, `たんご${index}`));
    const reviewAssignments = reviewSubjects.map((item) => ({ ...assignment(item.id), data: { ...assignment(item.id).data, subject_type: item.object } }));
    const questions = generateQuestions(
      "random-test",
      { subjects: reviewSubjects, assignments: reviewAssignments },
      { ...filters, count: 5, subjectTypes: ["vocabulary"] },
      () => 0.5,
    );

    expect(new Set(questions.map((question) => question.subjectId))).toHaveLength(5);
    expect(questions).toHaveLength(10);
  });

  it("generates specialized reading, similar-kanji, listening, and context questions", () => {
    const dataset = { subjects, assignments };
    expect(generateQuestions("vocab-reading", dataset, filters, () => 0.5)[0]).toMatchObject({ kind: "meaning-to-reading", prompt: "Cat", acceptedAnswers: ["ねこ"] });
    expect(generateQuestions("similar-kanji", dataset, { ...filters, subjectTypes: ["kanji"] }, () => 0.5)[0]).toMatchObject({ kind: "similar-kanji", acceptedAnswers: ["末"] });
    const listeningQuestions = generateQuestions("listening", dataset, { ...filters, subjectTypes: ["vocabulary"] }, () => 0.5);
    expect(listeningQuestions).toEqual([
      expect.objectContaining({ kind: "listening-characters", acceptedAnswers: ["猫"], audioUrl: "https://example.com/audio.mp3" }),
      expect.objectContaining({ kind: "listening-meaning", acceptedAnswers: expect.arrayContaining(["Cat"]), audioUrl: "https://example.com/audio.mp3" }),
    ]);
    expect(listeningQuestions.every((question) => question.stopAfterAnswer === undefined)).toBe(true);
    expect(generateQuestions("context-sentences", dataset, { ...filters, subjectTypes: ["vocabulary"] }, () => 0.5)[0].prompt).toContain("＿＿");
  });

  it("accepts kana readings for typed listening vocabulary prompts", () => {
    const question = generateQuestions(
      "listening",
      { subjects, assignments },
      { ...filters, subjectTypes: ["vocabulary"], answerMode: "typed" },
      () => 0.5,
    ).find((candidate) => candidate.kind === "listening-characters");

    expect(question).toMatchObject({ acceptedAnswers: ["猫", "ねこ"], choices: undefined });
    expect(checkAnswer(question!, "ねこ")).toBe(true);
    expect(checkAnswer(question!, "neko")).toBe(true);
  });

  it("summarizes unique missed subjects", () => {
    const question = generateQuestions("vocab-reading", { subjects, assignments }, filters, () => 0.5)[0];
    const session = createStudySession("vocab-reading", [question]);
    session.answers = [{ questionId: question.id, value: "いぬ", correct: false, answeredAt: "2026-01-01T00:00:00Z" }];
    expect(getSessionSummary(session)).toEqual({ correct: 0, total: 1, accuracy: 0, incorrectSubjectIds: [1] });
  });

  it("always includes the accepted answer in similar-kanji choices", () => {
    const manyKanji = Array.from({ length: 8 }, (_, index) => subject(20 + index, "kanji", String.fromCodePoint(0x4e10 + index), `Meaning ${index}`, `reading${index}`));
    manyKanji[0].data.visually_similar_subject_ids = manyKanji.slice(1).map((item) => item.id);
    const manyAssignments = manyKanji.map((item) => ({ ...assignment(item.id), data: { ...assignment(item.id).data, subject_type: "kanji" as const } }));
    for (const random of [() => 0, () => 0.25, () => 0.75, () => 0.999]) {
      const question = generateQuestions("similar-kanji", { subjects: manyKanji, assignments: manyAssignments }, { ...filters, subjectTypes: ["kanji"], count: 5, similarKanjiGroupSize: 4 }, random)[0];
      expect(question.choices).toContain(question.acceptedAnswers[0]);
      expect(question.choices).toHaveLength(4);
    }
  });

  it("filters recent lessons by the configured time window", () => {
    const old = { ...assignment(1), data: { ...assignment(1).data, started_at: "2026-07-10T00:00:00Z" } };
    const recent = { ...assignment(2), data: { ...assignment(2).data, started_at: "2026-08-05T12:00:00Z" } };
    expect([...recentLessonSubjectIds([old, recent], "24h", new Date("2026-08-06T10:00:00Z"))]).toEqual([2]);
    expect([...recentLessonSubjectIds([old, recent], "30d", new Date("2026-08-06T10:00:00Z"))]).toEqual([1, 2]);
    const passedApprentice = { ...recent, data: { ...recent.data, srs_stage: 3, passed_at: "2026-08-05T13:00:00Z" } };
    const burnedRecent = { ...recent, data: { ...recent.data, burned_at: "2026-08-05T13:00:00Z" } };
    expect([...recentLessonSubjectIds([passedApprentice], "apprentice", new Date("2026-08-06T10:00:00Z"))]).toEqual([]);
    expect([...recentLessonSubjectIds([burnedRecent], "30d", new Date("2026-08-06T10:00:00Z"))]).toEqual([]);
  });

  it("requeues an incorrect recent-lesson question until it is answered correctly", () => {
    const question: StudyQuestion = { id: "recent", subjectId: 1, subjectType: "vocabulary", kind: "meaning", prompt: "猫", promptLabel: "Meaning", acceptedAnswers: ["Cat"], displayAnswer: "Cat" };
    let session = createStudySession("recent-lessons", [question], new Date("2026-08-06T10:00:00Z"));
    session = answerStudyQuestion(session, "Dog");
    session = advanceStudySession(session);
    expect(session.complete).toBe(false);
    expect(session.questions).toHaveLength(2);
    expect(session.questions[1]).toMatchObject({ originalQuestionId: "recent", retryNumber: 1 });
    session = answerStudyQuestion(session, "Cat");
    session = advanceStudySession(session);
    expect(session.complete).toBe(true);
    expect(getSessionSummary(session).incorrectSubjectIds).toEqual([]);
  });
});
