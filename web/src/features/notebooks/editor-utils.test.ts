import { describe, expect, it } from "vitest";
import type { Subject, SubjectType } from "@/types/wanikani";
import { findNotebookSubjects } from "./editor-utils";

function subject(id: number, object: SubjectType, characters: string | null, meaning: string, reading = "", level = 1): Subject {
  return { id, object, url: "", data_updated_at: "2026-09-07T00:00:00.000Z", data: {
    level, created_at: "2026-09-07T00:00:00.000Z", slug: characters || meaning.toLocaleLowerCase(), document_url: "", hidden_at: null, characters,
    meanings: [{ meaning, primary: true, accepted_answer: true }], readings: reading ? [{ reading, primary: true, accepted_answer: true }] : [], auxiliary_meanings: [],
  } };
}

const subjects = [
  subject(1, "radical", "山", "Mountain"),
  subject(2, "kanji", "山", "Mountain", "さん"),
  subject(3, "vocabulary", "山", "Mountain", "やま"),
  subject(4, "kana_vocabulary", "こんにちは", "Hello", "こんにちは"),
  subject(5, "radical", null, "Gun"),
  subject(6, "vocabulary", "富士山", "Mount Fuji", "ふじさん", 2),
];

describe("notebook subject search", () => {
  it("includes radicals, kanji, vocabulary and kana vocabulary in unfiltered search", () => {
    expect(findNotebookSubjects(subjects, "").map((item) => item.object)).toEqual(["radical", "kanji", "vocabulary", "kana_vocabulary", "radical", "vocabulary"]);
    expect(findNotebookSubjects(subjects, "山").map((item) => item.id)).toEqual([1, 2, 3, 6]);
  });
  it("finds image-only radicals by meaning and accepted aliases", () => {
    const gun = { ...subjects[4], data: { ...subjects[4].data, auxiliary_meanings: [{ meaning: "Pistol", type: "whitelist" as const }, { meaning: "Weapon", type: "blacklist" as const }] } };
    expect(findNotebookSubjects([gun], "gun")).toEqual([gun]);
    expect(findNotebookSubjects([gun], "pistol")).toEqual([gun]);
    expect(findNotebookSubjects([gun], "weapon")).toEqual([]);
  });
  it("matches Japanese, kana, romaji and normalized katakana readings", () => {
    for (const query of ["やま", "yama", "ヤマ", "ﾔﾏ"]) expect(findNotebookSubjects(subjects, query).map((item) => item.id)).toEqual([3]);
    expect(findNotebookSubjects(subjects, "hello").map((item) => item.id)).toEqual([4]);
    expect(findNotebookSubjects(subjects, "konnichiha").map((item) => item.id)).toEqual([4]);
  });
  it("filters subject types before limiting results and preserves word-assignment callers", () => {
    expect(findNotebookSubjects(subjects, "山", 1, { types: ["vocabulary"] }).map((item) => item.id)).toEqual([3]);
    expect(findNotebookSubjects(subjects, "", 30, { types: ["kanji", "vocabulary", "kana_vocabulary"] }).some((item) => item.object === "radical")).toBe(false);
    expect(findNotebookSubjects(subjects, "", 30, { types: ["kana_vocabulary"] }).map((item) => item.id)).toEqual([4]);
  });
  it("ranks exact matches before partial matches without changing the subject catalog", () => {
    const catalog = [subjects[5], subjects[2], subjects[0]];
    expect(findNotebookSubjects(catalog, "山", 2).map((item) => item.id)).toEqual([3, 1]);
    expect(catalog.map((item) => item.id)).toEqual([6, 3, 1]);
  });
});
