import { clearStudySession, loadStudyConfig, loadStudySession, loadSubjectLists, saveStudyConfig, saveStudySession, saveSubjectLists, subscribeStudySubjectLists } from "./storage";
import { createStudySession, DEFAULT_STUDY_FILTERS } from "./engine";
import type { StudyQuestion } from "./types";

describe("study persistence", () => {
  const scope = 42;
  beforeEach(() => window.localStorage.clear());

  it("round-trips configuration and resumable sessions", () => {
    const filters = { ...DEFAULT_STUDY_FILTERS, count: 35, selectedSubjectIds: [7, 9], strokeLeniency: 2.5 };
    expect(saveStudyConfig(scope, "kanji-writing", filters)).toBe(true);
    expect(loadStudyConfig(scope, "kanji-writing")).toMatchObject({ count: 35, selectedSubjectIds: [7, 9], strokeLeniency: 2.5 });

    const session = createStudySession("random-test", [{ id: "q", subjectId: 7, subjectType: "kanji", kind: "meaning", prompt: "七", promptLabel: "Meaning", acceptedAnswers: ["Seven"], displayAnswer: "Seven" }], new Date("2026-08-06T10:00:00Z"));
    expect(saveStudySession(scope, session)).toBe(true);
    expect(loadStudySession(scope, "random-test")).toMatchObject({ id: session.id, currentIndex: 0, complete: false });
    clearStudySession(scope, "random-test");
    expect(loadStudySession(scope, "random-test")).toBeNull();
  });

  it("never persists a completed session as resumable", () => {
    const session = createStudySession("random-test", [{ id: "q", subjectId: 7, subjectType: "kanji", kind: "meaning", prompt: "七", promptLabel: "Meaning", acceptedAnswers: ["Seven"], displayAnswer: "Seven" }], new Date("2026-08-06T10:00:00Z"));
    saveStudySession(scope, session);

    expect(saveStudySession(scope, { ...session, currentIndex: 1, complete: true })).toBe(true);
    expect(loadStudySession(scope, "random-test")).toBeNull();
  });

  it("restores media in a listening session saved before ImmersionKit moved its files", () => {
    const legacy = "https://us-southeast-1.linodeobjects.com/immersionkit/media/";
    const current = "https://immersionkit.s3.bhs.io.cloud.ovh.net/media/";
    const scene = "anime/Fate%20Zero/media/scene%201";
    const question: StudyQuestion = { id: "q", subjectId: 7, subjectType: "vocabulary", kind: "listening-characters", prompt: "七", promptLabel: "Listen", acceptedAnswers: ["七"], displayAnswer: "七", audioUrl: legacy + scene + ".mp3", imageUrl: legacy + scene + ".jpg" };
    const otherAudio = "https://example.com/clip.mp3";
    const session = createStudySession("listening", [
      question,
      { ...question, id: "q2", audioUrl: otherAudio },
    ], new Date("2026-08-06T10:00:00Z"));
    const answers = [{ questionId: "q", value: "七", correct: true, answeredAt: session.createdAt }];
    saveStudySession(scope, { ...session, currentIndex: 1, answers });

    expect(loadStudySession(scope, "listening")).toMatchObject({
      id: session.id, currentIndex: 1, answers,
      questions: [
        { audioUrl: current + scene + ".mp3", imageUrl: current + scene + ".jpg" },
        { audioUrl: otherAudio, imageUrl: current + scene + ".jpg" },
      ],
    });
  });

  it("persists reusable subject lists and ignores malformed data", () => {
    const list = { id: "list-1", name: "Trouble", subjectIds: [1, 2], createdAt: "2026-08-06", updatedAt: "2026-08-06" };
    expect(saveSubjectLists(scope, [list])).toBe(true);
    expect(loadSubjectLists(scope)).toEqual([list]);
    window.localStorage.setItem("kakehashi:study:v1:account:42:subject-lists", "not json");
    expect(loadSubjectLists(scope)).toEqual([]);
  });

  it("isolates every persisted value by WaniKani account", () => {
    const filters = { ...DEFAULT_STUDY_FILTERS, count: 15 };
    saveStudyConfig("alice", "random-test", filters);
    saveSubjectLists("alice", [{ id: "a", name: "Alice", subjectIds: [1], createdAt: "", updatedAt: "" }]);
    expect(loadStudyConfig("bob", "random-test")).toBeNull();
    expect(loadSubjectLists("bob")).toEqual([]);
  });

  it("notifies mounted study screens when lists change in the same tab", () => {
    let changes = 0;
    const unsubscribe = subscribeStudySubjectLists(scope, () => { changes += 1; });
    saveSubjectLists(scope, [{ id: "live", name: "Live", subjectIds: [], createdAt: "", updatedAt: "" }]);
    unsubscribe();
    expect(changes).toBe(1);
  });
});
