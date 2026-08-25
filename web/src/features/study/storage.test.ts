import { clearStudySession, loadStudyConfig, loadStudySession, loadSubjectLists, saveStudyConfig, saveStudySession, saveSubjectLists, subscribeStudySubjectLists } from "./storage";
import { createStudySession, DEFAULT_STUDY_FILTERS } from "./engine";

describe("study persistence", () => {
  const scope = 42;
  beforeEach(() => window.localStorage.clear());

  it("round-trips configuration and resumable sessions", () => {
    const filters = { ...DEFAULT_STUDY_FILTERS, count: 35, selectedSubjectIds: [7, 9] };
    expect(saveStudyConfig(scope, "random-test", filters)).toBe(true);
    expect(loadStudyConfig(scope, "random-test")).toMatchObject({ count: 35, selectedSubjectIds: [7, 9] });

    const session = createStudySession("random-test", [{ id: "q", subjectId: 7, subjectType: "kanji", kind: "meaning", prompt: "七", promptLabel: "Meaning", acceptedAnswers: ["Seven"], displayAnswer: "Seven" }], new Date("2026-08-06T10:00:00Z"));
    expect(saveStudySession(scope, session)).toBe(true);
    expect(loadStudySession(scope, "random-test")).toMatchObject({ id: session.id, currentIndex: 0, complete: false });
    clearStudySession(scope, "random-test");
    expect(loadStudySession(scope, "random-test")).toBeNull();
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
