import { BlockNoteEditor } from "@blocknote/core";
import { describe, expect, it } from "vitest";
import { DEMO_SUBJECTS } from "@/features/demo/wanikani";
import { createExampleNotebook, EXAMPLE_NOTEBOOK_KANJI, EXAMPLE_NOTEBOOK_PAGE_IDS, EXAMPLE_NOTEBOOK_RADICAL, EXAMPLE_NOTEBOOK_ROOT_ID, EXAMPLE_NOTEBOOK_SENTENCE_ID, EXAMPLE_NOTEBOOK_SUBJECT } from "./example-notebook";
import { notebookSchema } from "./editor-schema";
import { applyNotebookMutation, notebookStateBytes, pageSubjectIds, pageText, sanitizeNotebookBlocks, validateNotebookState, type NotebookBlock } from "./model";

const now = new Date("2026-09-07T18:00:00.000Z");

function allBlocks(blocks: NotebookBlock[]): NotebookBlock[] {
  return blocks.flatMap((block) => [block, ...allBlocks(block.children ?? [])]);
}

describe("default example notebook", () => {
  it("ships a valid small tree with complete, resolvable study and page references", () => {
    const state = validateNotebookState(createExampleNotebook(now));
    const roots = state.pages.filter((page) => page.parentId === null);
    expect(roots.map((page) => page.id)).toEqual([EXAMPLE_NOTEBOOK_ROOT_ID]);
    expect(state.pages.filter((page) => page.parentId === EXAMPLE_NOTEBOOK_ROOT_ID)).toHaveLength(2);
    expect(state.pages.map((page) => page.icon)).toEqual(["🧭", "🌱", "✍️"]);
    expect(notebookStateBytes(state)).toBeLessThan(20_000);
    expect(state.sentences).toHaveLength(1);
    const blocks = state.pages.flatMap((page) => allBlocks(page.content));
    expect(blocks.filter((block) => block.type === "sentence").map((block) => block.props?.sentenceId)).toEqual([EXAMPLE_NOTEBOOK_SENTENCE_ID, EXAMPLE_NOTEBOOK_SENTENCE_ID]);
    for (const reference of blocks.filter((block) => block.type === "pageLink")) {
      expect(state.pages.some((page) => page.id === reference.props?.pageId)).toBe(true);
    }
    for (const [type, reference] of [["radical", EXAMPLE_NOTEBOOK_RADICAL], ["kanji", EXAMPLE_NOTEBOOK_KANJI], ["vocabulary", EXAMPLE_NOTEBOOK_SUBJECT]] as const) {
      expect(DEMO_SUBJECTS.find((subject) => subject.id === reference.id)).toMatchObject({ object: type, data: { characters: reference.label, level: 1 } });
      expect(blocks.some((block) => block.type === "vocabulary" && block.props?.subjectId === reference.id)).toBe(true);
      expect(blocks.some((block) => Array.isArray(block.content) && block.content.some((inline) => inline.type === "vocabularyMention" && inline.props.subjectId === reference.id))).toBe(true);
    }
    expect(state.sentences[0].japanese).toContain(EXAMPLE_NOTEBOOK_SUBJECT.label);
  });

  it("loads every supported block type in the actual editor and preserves content through saving", () => {
    const state = createExampleNotebook(now);
    const types = new Set(state.pages.flatMap((page) => allBlocks(page.content).map((block) => block.type)));
    expect([...types].sort()).toEqual(Object.keys(notebookSchema.blockSchema).sort());
    for (const page of state.pages) {
      const editor = BlockNoteEditor.create({ schema: notebookSchema, initialContent: page.content as typeof notebookSchema.PartialBlock[] });
      const saved = sanitizeNotebookBlocks(editor.document);
      const reopened = BlockNoteEditor.create({ schema: notebookSchema, initialContent: saved as typeof notebookSchema.PartialBlock[] });
      expect(sanitizeNotebookBlocks(reopened.document)).toEqual(saved);
      expect(pageText({ ...page, content: saved }, state.sentences)).toBe(pageText(page, state.sentences));
      editor.unmount();
      reopened.unmount();
    }
  });

  it("makes the guided sentence edit visible in both pages and on the linked word", () => {
    const state = createExampleNotebook(now);
    const original = state.sentences[0];
    const updated = applyNotebookMutation(state, {
      action: "upsert_sentence", expectedRevision: original.revision,
      sentence: { id: original.id, japanese: original.japanese, kana: original.kana, english: "There is a mountain in view.", subjectIds: original.subjectIds },
    }, now).state;
    for (const id of [EXAMPLE_NOTEBOOK_PAGE_IDS.context, EXAMPLE_NOTEBOOK_PAGE_IDS.playground]) {
      const page = updated.pages.find((page) => page.id === id)!;
      expect(pageText(page, updated.sentences)).toContain("There is a mountain in view.");
      expect(pageSubjectIds(page, updated.sentences)).toContain(EXAMPLE_NOTEBOOK_SUBJECT.id);
    }
  });

  it("returns fresh documents so edits cannot change another account’s examples", () => {
    const first = createExampleNotebook(now);
    first.pages[0].title = "My own title";
    first.pages[0].content[0].content = "My own writing";
    first.sentences[0].subjectIds.push(2506);
    const second = createExampleNotebook(now.toISOString());
    expect(second.pages[0].title).toBe("Start here");
    expect(second.pages[0].content[0].content).not.toBe("My own writing");
    expect(second.sentences[0].subjectIds).toEqual([EXAMPLE_NOTEBOOK_SUBJECT.id]);
    expect(second.pages[0].createdAt).toBe(now.toISOString());
  });
});
