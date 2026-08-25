import type { Assignment, Subject, SubjectType } from "@/types/wanikani";
import { advanceStudySession, answerStudyQuestion, checkAnswer, createStudySession, DEFAULT_STUDY_FILTERS, filterStudySubjects, generateQuestions, getSessionSummary, getStudyItemProgress, normalizeMeaning, normalizeReading, recentLessonSubjectIds, unlockedLessonSubjects } from "./engine";
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
  it("normalizes English and kana answers without accepting blanks", () => {
    expect(normalizeMeaning("  To RUN! ")).toBe("run");
    expect(normalizeReading("neko")).toBe("ねこ");
    const question: StudyQuestion = { id: "1", subjectId: 1, subjectType: "vocabulary", kind: "meaning-to-reading", prompt: "Cat", promptLabel: "Reading", acceptedAnswers: ["ねこ"], displayAnswer: "ねこ" };
    expect(checkAnswer(question, "neko")).toBe(true);
    expect(checkAnswer(question, "")).toBe(false);
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
    expect(generateQuestions("custom-review", { subjects: [...subjects, locked], assignments }, { ...filters, selectedSubjectIds: [40], count: 10 }, () => 0.5)).toEqual([
      expect.objectContaining({ subjectId: 40, kind: "meaning" }),
      expect.objectContaining({ subjectId: 40, kind: "reading" }),
    ]);
  });

  it("counts paired meaning and reading prompts as one custom-review item", () => {
    const reviewSubjects = Array.from({ length: 5 }, (_, index) => subject(40 + index, "vocabulary", `語${index}`, `Word ${index}`, `ご${index}`));
    const questions = generateQuestions(
      "custom-review",
      { subjects: reviewSubjects, assignments: [] },
      { ...filters, selectedSubjectIds: reviewSubjects.map((item) => item.id), count: 5 },
      () => 0.5,
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
    expect(generateQuestions("listening", dataset, { ...filters, subjectTypes: ["vocabulary"] }, () => 0.5)).toEqual([
      expect.objectContaining({ kind: "listening-characters", acceptedAnswers: ["猫"], audioUrl: "https://example.com/audio.mp3", stopAfterAnswer: false }),
      expect.objectContaining({ kind: "listening-meaning", acceptedAnswers: expect.arrayContaining(["Cat"]), audioUrl: "https://example.com/audio.mp3", stopAfterAnswer: false }),
    ]);
    expect(generateQuestions("context-sentences", dataset, { ...filters, subjectTypes: ["vocabulary"] }, () => 0.5)[0].prompt).toContain("＿＿");
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
