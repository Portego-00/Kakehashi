import { describe, expect, it } from "vitest";
import type { Subject } from "@/types/wanikani";
import { applyNotebookMutation, createNotebookState } from "./model";
import { notebookPagesForSubject, subjectsWithNotebookSentences } from "./study-integration";

const cat: Subject = {
  id: 88, object: "vocabulary", url: "https://api.wanikani.com/v2/subjects/88", data_updated_at: "2026-09-07T00:00:00.000Z",
  data: { level: 5, created_at: "2026-09-07T00:00:00.000Z", slug: "猫", document_url: "https://www.wanikani.com/vocabulary/猫", hidden_at: null, characters: "猫", meanings: [{ meaning: "Cat", primary: true, accepted_answer: true }], auxiliary_meanings: [], context_sentences: [{ ja: "猫です。", en: "It is a cat." }] },
};
const example = { id: "shared", japanese: "猫が好きです。", kana: "", english: "I like cats.", subjectIds: [88, 89], createdAt: "2026-09-07T00:00:00.000Z", updatedAt: "2026-09-07T00:00:00.000Z", revision: 0 };

describe("notebook study integration", () => {
  it("finds vocabulary mentions and sentence backlinks, omitting trashed pages", () => {
    let state = applyNotebookMutation(createNotebookState(), { action: "upsert_sentence", expectedRevision: -1, sentence: { id: example.id, japanese: example.japanese, kana: example.kana, english: example.english, subjectIds: example.subjectIds } }).state;
    state = applyNotebookMutation(state, { action: "create_page", page: { id: "inline", content: [{ id: "p", type: "paragraph", content: [{ type: "vocabularyMention", props: { subjectId: "88", label: "猫" } }] }] } }).state;
    state = applyNotebookMutation(state, { action: "create_page", page: { id: "sentence", content: [{ id: "s", type: "sentence", props: { sentenceId: "shared" } }] } }).state;
    state = applyNotebookMutation(state, { action: "create_page", page: { id: "trash", content: [{ id: "v", type: "vocabulary", props: { subjectId: 88, label: "猫" } }] } }).state;
    state = applyNotebookMutation(state, { action: "trash_page", pageId: "trash", expectedRevision: 0 }).state;
    expect(notebookPagesForSubject(state.pages, state.sentences, 88).map((page) => page.id)).toEqual(["inline", "sentence"]);
  });

  it("makes shared sentences available to each linked word without changing original examples", () => {
    const other = { ...cat, id: 89 };
    const result = subjectsWithNotebookSentences([cat, other], [example]);
    expect(result[0].data.context_sentences).toEqual([cat.data.context_sentences![0], { ja: example.japanese, en: example.english }]);
    expect(result[1].data.context_sentences).toHaveLength(2);
    expect(cat.data.context_sentences).toHaveLength(1);
  });

  it("deduplicates built-in examples and uses current sentence text on the next dataset", () => {
    const duplicate = { ...example, japanese: "猫です。", english: "It is a cat." };
    expect(subjectsWithNotebookSentences([cat], [duplicate])[0]).toBe(cat);
    const changed = subjectsWithNotebookSentences([cat], [{ ...example, japanese: "猫と遊びます。" }]);
    expect(changed[0].data.context_sentences?.map((sentence) => sentence.ja)).toEqual(["猫です。", "猫と遊びます。"]);
  });
});
