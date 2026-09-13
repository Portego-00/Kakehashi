import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { wkCollection, wkRequest } from "@/lib/wanikani/client";
import { recentMistakeRows } from "@/features/dashboard/dashboard-data";
import type { Assignment, LevelProgression, ReviewCreateResponse, ReviewStatistic, StudyMaterial, Subject, WKSummary, WKUser } from "@/types/wanikani";
import { DEMO_USER, setDemoMode } from "./runtime";
import { DEMO_SUBJECTS, DEMO_WANIKANI_STORAGE_KEY, resetDemoWaniKani } from "./wanikani";

beforeEach(() => {
  window.localStorage.clear();
  resetDemoWaniKani();
  setDemoMode(true);
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Demo WaniKani must not use the network"); }));
});
afterEach(() => { setDemoMode(false); vi.unstubAllGlobals(); });

describe("WaniKani demo request adapter", () => {
  it("provides a complete level 21 subject inventory and isolates identity", async () => {
    expect((await wkRequest<WKUser>("user")).data).toMatchObject({ level: 21, username: "demo-level-21", id: "demo-level-21" });
    const subjects = await wkCollection<Subject>("subjects");
    expect(subjects).toHaveLength(DEMO_SUBJECTS.length);
    expect(subjects.length).toBeGreaterThan(3_000);
    expect(new Set(subjects.map((subject) => subject.data.level)).size).toBe(21);
    expect(subjects.filter((subject) => subject.object === "kanji").every((subject) => subject.data.readings?.length)).toBe(true);
    const olderKanjiIds = new Set(subjects.filter((subject) => subject.object === "kanji" && subject.data.level < 21).map((subject) => subject.id));
    const assignments = await wkCollection<Assignment>("assignments");
    expect(assignments.filter((assignment) => olderKanjiIds.has(assignment.data.subject_id)).every((assignment) => assignment.data.passed_at && assignment.data.srs_stage >= 5)).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("supplies all dashboard and progress collections", async () => {
    for (const endpoint of ["assignments", "review_statistics", "subjects", "level_progressions"]) {
      expect((await wkCollection(endpoint)).length).toBeGreaterThan(0);
    }
    expect(await wkCollection("resets")).toEqual([]);
  });

  it("shows varied, chronological level timings that stay stable after a reload", async () => {
    const progressions = await wkCollection<LevelProgression>("level_progressions");
    const completed = progressions.slice(0, -1);
    const days = completed.map(({ data }) => (Date.parse(data.passed_at!) - Date.parse(data.started_at!)) / 86_400_000);
    expect(new Set(days).size).toBeGreaterThan(12);
    expect(Math.min(...days)).toBeGreaterThan(7);
    expect(Math.max(...days)).toBeGreaterThan(20);
    expect(progressions.at(-1)?.data).toMatchObject({ level: 21, passed_at: null, completed_at: null });
    completed.forEach((progression, index) => {
      expect(progression.data.passed_at).toBe(progressions[index + 1].data.started_at);
    });
    const assignments = await wkCollection<Assignment>("assignments");
    expect(new Set(assignments.map((assignment) => assignment.data_updated_at.slice(0, 10))).size).toBeGreaterThan(100);
    for (const { data } of assignments) {
      expect(Date.parse(data.unlocked_at!)).toBeLessThanOrEqual(Date.now());
      if (data.started_at) expect(Date.parse(data.started_at)).toBeGreaterThanOrEqual(Date.parse(data.unlocked_at!));
      if (data.passed_at) expect(Date.parse(data.passed_at)).toBeGreaterThan(Date.parse(data.started_at!));
      if (data.burned_at) {
        expect(Date.parse(data.burned_at)).toBeGreaterThan(Date.parse(data.passed_at!));
        expect(Date.parse(data.burned_at)).toBeLessThan(Date.now());
      }
    }
    expect(localStorage.getItem(DEMO_WANIKANI_STORAGE_KEY)).not.toBeNull();
    vi.resetModules();
    const reloaded = await import("./wanikani");
    expect(await reloaded.demoWaniKaniRequest("level_progressions")).toMatchObject({ data: progressions });
    expect(await reloaded.demoWaniKaniRequest("assignments")).toMatchObject({ data: assignments });
  });

  it("includes current-level radicals and a varied mix of active and passed subjects", async () => {
    const subjects = await wkCollection<Subject>("subjects?levels=21");
    const radicals = subjects.filter((subject) => subject.object === "radical");
    expect(radicals).toHaveLength(8);
    expect(radicals.every((subject) => subject.data.characters || subject.data.character_images?.length)).toBe(true);
    const ids = subjects.map((subject) => subject.id);
    const assignments = await wkCollection<Assignment>(`assignments?subject_ids=${ids.join(",")}`);
    for (const type of ["radical", "kanji", "vocabulary"]) {
      const rows = assignments.filter((assignment) => assignment.data.subject_type === type);
      expect(rows.some((assignment) => assignment.data.srs_stage > 0 && assignment.data.srs_stage < 5)).toBe(true);
      expect(rows.some((assignment) => assignment.data.srs_stage >= 5)).toBe(true);
    }
    const statistics = await wkCollection<ReviewStatistic>("review_statistics");
    expect(new Set(statistics.map((item) => item.data.meaning_current_streak)).size).toBeGreaterThan(10);
    expect(recentMistakeRows(statistics, DEMO_SUBJECTS).length).toBeGreaterThan(0);
    const radicalStatistics = statistics.filter((item) => item.data.subject_type === "radical");
    expect(radicalStatistics.every((item) => item.data.reading_correct === 0 && item.data.reading_current_streak === 0)).toBe(true);
  });

  it("filters due reviews, lessons, subject ids and subject types consistently", async () => {
    const reviews = await wkCollection<Assignment>("assignments?immediately_available_for_review=true&hidden=false");
    const lessons = await wkCollection<Assignment>("assignments?immediately_available_for_lessons=true");
    expect(reviews.length).toBeGreaterThan(0);
    expect(lessons.length).toBeGreaterThan(0);
    expect(reviews.every((item) => item.data.started_at && Date.parse(item.data.available_at!) <= Date.now())).toBe(true);
    expect(lessons.every((item) => item.data.srs_stage === 0 && !item.data.started_at)).toBe(true);
    const ids = reviews.slice(0, 3).map((item) => item.data.subject_id);
    expect((await wkCollection<Subject>(`subjects?ids=${ids.join(",")}`)).map((item) => item.id).sort()).toEqual(ids.sort());
    expect((await wkCollection<Subject>("https://api.wanikani.com/v2/subjects?types=kanji&levels=21")).every((item) => item.object === "kanji" && item.data.level === 21)).toBe(true);
    const summary = await wkRequest<WKSummary>("summary");
    expect(summary.data.lessons[0].subject_ids).toHaveLength(lessons.length);
    const returned = await wkRequest<WKUser>("user");
    returned.data.level = 60;
    expect(DEMO_USER.data.level).toBe(21);
  });

  it("starts lessons and records reviews only in the dedicated demo store", async () => {
    localStorage.setItem("real-account-progress", "untouched");
    const [lesson] = await wkCollection<Assignment>("assignments?immediately_available_for_lessons=true");
    const started = await wkRequest<Assignment>(`assignments/${lesson.id}/start`, { method: "PUT" });
    expect(started.data.srs_stage).toBe(1);
    expect((await wkCollection<Assignment>("assignments?immediately_available_for_lessons=true")).some((item) => item.id === lesson.id)).toBe(false);
    const [due] = await wkCollection<Assignment>("assignments?immediately_available_for_review=true");
    const review = await wkRequest<ReviewCreateResponse>("reviews", { method: "POST", body: { review: { assignment_id: due.id, incorrect_meaning_answers: 0, incorrect_reading_answers: 0 } } });
    expect(review.resources_updated?.assignment?.data.srs_stage).toBe(due.data.srs_stage + 1);
    expect((await wkCollection<Assignment>("assignments?immediately_available_for_review=true")).some((item) => item.id === due.id)).toBe(false);
    expect(localStorage.getItem(DEMO_WANIKANI_STORAGE_KEY)).toContain(String(due.id));
    expect(localStorage.getItem("real-account-progress")).toBe("untouched");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps editable notes and synonyms on demo subjects", async () => {
    const subject = DEMO_SUBJECTS.find((item) => item.object === "vocabulary")!;
    const created = await wkRequest<StudyMaterial>("study_materials", { method: "POST", body: { study_material: { subject_id: subject.id, meaning_synonyms: ["My answer"], meaning_note: "Remember this" } } });
    await wkRequest<StudyMaterial>(`study_materials/${created.id}`, { method: "PUT", body: { study_material: { reading_note: "Read aloud" } } });
    expect((await wkCollection<StudyMaterial>(`study_materials?subject_ids=${subject.id}`))[0].data).toMatchObject({ meaning_synonyms: ["My answer"], meaning_note: "Remember this", reading_note: "Read aloud" });
    await expect(wkRequest("unknown-demo-action", { method: "POST" })).rejects.toMatchObject({ status: 404 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("retains historical answer totals when reviews move an item down and up", async () => {
    const [assignment] = await wkCollection<Assignment>("assignments?subject_types=kanji&srs_stages=8");
    const [before] = await wkCollection<ReviewStatistic>(`review_statistics?subject_ids=${assignment.data.subject_id}`);
    const missed = await wkRequest<ReviewCreateResponse>("reviews", { method: "POST", body: { review: {
      assignment_id: assignment.id, incorrect_meaning_answers: 2, incorrect_reading_answers: 1,
    } } });
    expect(missed.resources_updated?.assignment?.data.srs_stage).toBe(7);
    const [afterMiss] = await wkCollection<ReviewStatistic>(`review_statistics?subject_ids=${assignment.data.subject_id}`);
    expect(afterMiss.data.meaning_correct).toBe(before.data.meaning_correct + 1);
    expect(afterMiss.data.reading_correct).toBe(before.data.reading_correct + 1);
    expect(afterMiss.data.meaning_incorrect).toBe(before.data.meaning_incorrect + 2);
    expect(afterMiss.data.reading_incorrect).toBe(before.data.reading_incorrect + 1);
    expect(afterMiss.data.meaning_current_streak).toBe(0);
    expect(afterMiss.data.reading_current_streak).toBe(0);
    expect(afterMiss.data_updated_at).toBe(missed.data.created_at);
    expect(recentMistakeRows([afterMiss], DEMO_SUBJECTS)).toHaveLength(1);
    await wkRequest("reviews", { method: "POST", body: { review: { assignment_id: assignment.id } } });
    const [afterPass] = await wkCollection<ReviewStatistic>(`review_statistics?subject_ids=${assignment.data.subject_id}`);
    expect(afterPass.data.meaning_correct).toBe(afterMiss.data.meaning_correct + 1);
    expect(afterPass.data.reading_correct).toBe(afterMiss.data.reading_correct + 1);
    expect(afterPass.data.meaning_current_streak).toBe(1);
  });

  it("starts new lesson statistics with only the visitor's actual answers", async () => {
    const [lesson] = await wkCollection<Assignment>("assignments?immediately_available_for_lessons=true&subject_types=vocabulary");
    await wkRequest(`assignments/${lesson.id}/start`, { method: "PUT" });
    expect(await wkCollection(`review_statistics?subject_ids=${lesson.data.subject_id}`)).toEqual([]);
    await wkRequest("reviews", { method: "POST", body: { review: { assignment_id: lesson.id } } });
    const [statistics] = await wkCollection<ReviewStatistic>(`review_statistics?subject_ids=${lesson.data.subject_id}`);
    expect(statistics.data).toMatchObject({
      meaning_correct: 1, reading_correct: 1, meaning_incorrect: 0, reading_incorrect: 0,
      meaning_current_streak: 1, reading_current_streak: 1, percentage_correct: 100,
    });
  });
});
