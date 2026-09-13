import { describe, expect, it } from "vitest";
import { applyNotebookMutation, createNotebookState, DEFAULT_NOTEBOOK_LIMITS, EXAMPLE_NOTEBOOK_CONTENT_VERSION, notebookExamplesNeedInitialization, notebookStateBytes, pageSubjectIds, pageText, parseNotebookMutation, sanitizeNotebookBlocks, validateNotebookState, type NotebookBlock, type NotebookMutation, type NotebookState } from "./model";
import { createExampleNotebook, EXAMPLE_NOTEBOOK_PAGE_IDS, EXAMPLE_NOTEBOOK_ROOT_ID, EXAMPLE_NOTEBOOK_SENTENCE_ID } from "./example-notebook";

const now = new Date("2026-09-07T10:00:00Z");
const sentenceInput = { id: "sentence-1", japanese: "日本語を勉強します。", kana: "にほんごをべんきょうします。", english: "I study Japanese.", subjectIds: [123] };
const paragraph: NotebookBlock = { id: "block-1", type: "paragraph", content: [{ type: "text", text: "Grammar notes" }] };
const addPage = (id: string, parentId: string | null = null): NotebookMutation => ({ action: "create_page", page: { id, title: id, parentId, content: [] } });
const mutate = (state: NotebookState, mutation: NotebookMutation) => applyNotebookMutation(state, mutation, now).state;
function seeded() { let state = mutate(createNotebookState(), addPage("parent")); state = mutate(state, addPage("child", "parent")); return mutate(state, { action: "upsert_sentence", sentence: sentenceInput, expectedRevision: -1 }); }

describe("portable notebook model", () => {
  it("stores a sentence once and resolves edits in every linked page and vocabulary backlink", () => {
    let state = seeded();
    for (const id of ["parent", "child"]) state = mutate(state, { action: "append_blocks", pageId: id, blocks: [{ id: `sentence-${id}`, type: "sentence", props: { sentenceId: sentenceInput.id } }] });
    state = mutate(state, { action: "upsert_sentence", sentence: { ...sentenceInput, english: "I am studying Japanese.", subjectIds: [123, 456] }, expectedRevision: 0 });
    expect(state.sentences).toHaveLength(1);
    for (const page of state.pages) { expect(pageText(page, state.sentences)).toContain("I am studying Japanese."); expect(pageSubjectIds(page, state.sentences)).toEqual([123, 456]); expect(JSON.stringify(page.content)).not.toContain(sentenceInput.japanese); }
  });
  it("deduplicates captured built-in sentences and returns the canonical ID while attaching vocabulary", () => {
    const result = applyNotebookMutation(seeded(), { action: "upsert_sentence", sentence: { ...sentenceInput, id: "new-capture", subjectIds: [456] }, expectedRevision: -1 }, now);
    expect(result.sentenceId).toBe(sentenceInput.id); expect(result.state.sentences).toHaveLength(1); expect(result.state.sentences[0].subjectIds).toEqual([123, 456]); expect(result.state.sentences[0].revision).toBe(1);
  });
  it("rejects stale page and sentence changes without mutating the original state", () => {
    const state = seeded(); const original = JSON.stringify(state);
    expect(() => mutate(state, { action: "update_page", pageId: "parent", expectedRevision: 99, patch: { title: "lost update" } })).toThrow(/another session/);
    expect(() => mutate(state, { action: "upsert_sentence", sentence: { ...sentenceInput, english: "lost update" }, expectedRevision: 99 })).toThrow(/another session/);
    expect(JSON.stringify(state)).toBe(original);
  });
  it("appends against current contents and safely replays the same capture", () => {
    let state = mutate(seeded(), { action: "update_page", pageId: "parent", expectedRevision: 0, patch: { content: [paragraph] } });
    const action: NotebookMutation = { action: "append_blocks", pageId: "parent", blocks: [{ id: "captured", type: "vocabulary", props: { subjectId: 123, label: "日本語" } }] };
    state = mutate(state, action); const again = mutate(state, action);
    expect(again.pages[0].content.map((block) => block.id)).toEqual(["block-1", "captured"]); expect(again.pages[0].revision).toBe(state.pages[0].revision);
    expect(() => mutate(state, { ...action, blocks: [{ ...action.blocks[0], props: { subjectId: 456, label: "違う" } }] })).toThrow(/captured block changed/);
  });
  it("replays uncertain page/sentence creation without duplicates or silently overwriting edits", () => {
    const state = seeded(); expect(mutate(state, addPage("parent"))).toBe(state);
    expect(mutate(state, { action: "upsert_sentence", sentence: sentenceInput, expectedRevision: -1 })).toBe(state);
    expect(() => mutate(state, { action: "upsert_sentence", sentence: { ...sentenceInput, english: "other" }, expectedRevision: -1 })).toThrow(/already exists/);
    expect(() => mutate(state, { action: "create_page", page: { id: "parent", title: "different" } })).toThrow(/already exists/);
  });
  it("prevents missing parents, tree cycles, and edits inside trash", () => {
    const state = seeded();
    expect(() => mutate(state, addPage("orphan", "missing"))).toThrow(/valid tree/);
    expect(() => mutate(state, { action: "update_page", pageId: "parent", expectedRevision: 0, patch: { parentId: "child" } })).toThrow(/valid tree/);
    const trashed = mutate(state, { action: "trash_page", pageId: "parent", expectedRevision: 0 });
    expect(trashed.pages.every((page) => page.trashedAt !== null)).toBe(true);
    expect(() => mutate(trashed, { action: "update_page", pageId: "child", expectedRevision: 1, patch: { title: "hidden" } })).toThrow(/Restore/);
    expect(() => mutate(trashed, addPage("hidden", "parent"))).toThrow(/parent/);
    const restored = mutate(trashed, { action: "restore_page", pageId: "parent", expectedRevision: 1 });
    expect(restored.pages.every((page) => page.trashedAt === null)).toBe(true);
  });
  it("restores an individual child to the root when its parent is still trashed", () => {
    const trashed = mutate(seeded(), { action: "trash_page", pageId: "parent", expectedRevision: 0 });
    const restored = mutate(trashed, { action: "restore_page", pageId: "child", expectedRevision: 1 });
    expect(restored.pages[1]).toMatchObject({ parentId: null, trashedAt: null }); expect(restored.pages[0].trashedAt).toBeTruthy();
  });
  it("permanently deletes only trashed trees and removes their page links without deleting shared sentences", () => {
    let state = mutate(seeded(), addPage("outside"));
    state = mutate(state, { action: "append_blocks", pageId: "outside", blocks: [{ id: "link", type: "pageLink", props: { pageId: "child" } }, paragraph] });
    expect(() => mutate(state, { action: "delete_page", pageId: "parent", expectedRevision: 0 })).toThrow(/trash/);
    state = mutate(state, { action: "trash_page", pageId: "parent", expectedRevision: 0 });
    state = mutate(state, { action: "delete_page", pageId: "parent", expectedRevision: 1 });
    expect(state.pages.map((page) => page.id)).toEqual(["outside"]); expect(state.pages[0].content).toEqual([paragraph]); expect(state.sentences).toHaveLength(1);
  });
  it("refuses sentence deletion while any page including trash references it", () => {
    let state = mutate(seeded(), { action: "append_blocks", pageId: "parent", blocks: [{ id: "link", type: "sentence", props: { sentenceId: sentenceInput.id } }] });
    state = mutate(state, { action: "trash_page", pageId: "parent", expectedRevision: 1 });
    expect(() => mutate(state, { action: "delete_sentence", sentenceId: sentenceInput.id, expectedRevision: 0 })).toThrow(/including trash/);
    expect(() => mutate(seeded(), { action: "append_blocks", pageId: "parent", blocks: [{ id: "link", type: "sentence", props: { sentenceId: "other-account" } }] })).toThrow(/no longer exists/);
  });
  it("enforces UTF-8 byte budgets, page counts, per-page size, and sentence counts", () => {
    const state = seeded(); expect(notebookStateBytes(state)).toBeGreaterThan(JSON.stringify(state).length);
    for (const limits of [{ ...DEFAULT_NOTEBOOK_LIMITS, maxBytes: 200 }, { ...DEFAULT_NOTEBOOK_LIMITS, maxPages: 1 }, { ...DEFAULT_NOTEBOOK_LIMITS, maxPageBytes: 10 }, { ...DEFAULT_NOTEBOOK_LIMITS, maxSentences: 0 }]) expect(() => validateNotebookState(state, limits)).toThrow();
  });
  it.each(["image", "video", "audio", "file", "embed"])("refuses %s blocks and embedded binary content", (type) => {
    expect(() => sanitizeNotebookBlocks([{ id: "x", type, props: { url: "https://example.com/file" } }])).toThrow(/text/);
    expect(() => sanitizeNotebookBlocks([{ id: "x", type: "paragraph", content: "data:image/png;base64,AAAA" }])).toThrow(/text/);
  });
  it.each(["javascript:alert(1)", "data:text/html,bad", "//evil.test/path", "/\\evil.test/path", "file:///tmp/private"])("rejects unsafe rich-text link %s", (href) => {
    expect(() => sanitizeNotebookBlocks([{ id: "x", type: "paragraph", content: [{ type: "link", href, content: [{ type: "text", text: "click" }] }] }])).toThrow(/Links/);
  });
  it("preserves useful formatting, tables and nested vocabulary while discarding unsupported properties", () => {
    const blocks = sanitizeNotebookBlocks([{ id: "x", type: "heading", props: { level: 2, isToggleable: true, textAlignment: "left", secret: "discard" }, content: [{ type: "text", text: "Notes", styles: { bold: true, code: false, dangerous: "discard" } }], children: [{ id: "table", type: "table", content: { type: "tableContent", rows: [{ cells: [[{ type: "vocabularyMention", props: { subjectId: 123, label: "日本語" } }]] }], columnWidths: [240] } }] }]);
    expect(blocks[0].props).toEqual({ level: 2, isToggleable: true }); expect(pageSubjectIds({ ...seeded().pages[0], content: blocks })).toEqual([123]);
    expect(JSON.stringify(blocks)).not.toContain("discard");
  });
  it("omits repeated default formatting while retaining explicit custom formatting", () => {
    const result = sanitizeNotebookBlocks([{ id: "plain", type: "paragraph", props: { textColor: "default", backgroundColor: "default", textAlignment: "left" }, content: [{ type: "text", text: "Compact" }] }, { id: "styled", type: "paragraph", props: { textColor: "red", backgroundColor: "yellow", textAlignment: "center" }, content: [] }]);
    expect(result[0]).not.toHaveProperty("props");
    expect(result[1].props).toEqual({ textColor: "red", backgroundColor: "yellow", textAlignment: "center" });
  });
  it("rejects caller-owned state fields, duplicate block IDs, invalid subject IDs, and malformed actions", () => {
    expect(() => parseNotebookMutation({ action: "create_page", userId: "other", page: { id: "x" } })).toThrow();
    expect(() => parseNotebookMutation({ action: "update_page", pageId: "x", expectedRevision: 0, patch: { revision: 999 } })).toThrow();
    expect(() => sanitizeNotebookBlocks([paragraph, paragraph])).toThrow(/unique/);
    expect(() => sanitizeNotebookBlocks([{ id: "x", type: "vocabulary", props: { subjectId: -1, label: "x" } }])).toThrow(/vocabulary/);
  });
});

describe("default example notebook lifecycle", () => {
  const initialize = (state: NotebookState) => mutate(state, { action: "initialize_examples" });
  it("installs once in new and existing accounts without changing personal pages or sentences", () => {
    for (const original of [createNotebookState(), seeded()]) {
      const initialized = initialize(original);
      expect(initialized.examples).toEqual({ version: 1, status: "installed", contentVersion: EXAMPLE_NOTEBOOK_CONTENT_VERSION });
      expect(initialized.pages).toHaveLength(original.pages.length + Object.keys(EXAMPLE_NOTEBOOK_PAGE_IDS).length);
      expect(initialized.sentences).toHaveLength(original.sentences.length + 1);
      for (const page of original.pages) expect(initialized.pages.find((item) => item.id === page.id)).toEqual(page);
      for (const sentence of original.sentences) expect(initialized.sentences.find((item) => item.id === sentence.id)).toEqual(sentence);
      expect(initialize(initialized)).toBe(initialized);
      expect(validateNotebookState(JSON.parse(JSON.stringify(initialized)))).toEqual(initialized);
    }
  });
  it("persists dismissal through ordinary edits and prevents reinstallation after removal or reload", () => {
    let state = initialize(seeded());
    state = mutate(state, { action: "remove_examples" });
    expect(state.examples?.status).toBe("removed");
    expect(state.pages).toEqual(seeded().pages);
    expect(state.sentences).toEqual(seeded().sentences);
    state = mutate(state, { action: "update_page", pageId: "parent", expectedRevision: 0, patch: { title: "Personal revision" } });
    expect(state.examples?.status).toBe("removed");
    const reloaded = validateNotebookState(JSON.parse(JSON.stringify(state)));
    expect(initialize(reloaded)).toBe(reloaded);
    expect(mutate(reloaded, { action: "remove_examples" })).toBe(reloaded);
  });
  it("does not recreate an example that was removed using normal trash and permanent delete", () => {
    let state = initialize(createNotebookState());
    state = mutate(state, { action: "trash_page", pageId: EXAMPLE_NOTEBOOK_ROOT_ID, expectedRevision: 0 });
    state = mutate(state, { action: "delete_page", pageId: EXAMPLE_NOTEBOOK_ROOT_ID, expectedRevision: 1 });
    expect(state.pages).toHaveLength(0);
    expect(initialize(state)).toBe(state);
  });
  it("keeps personal descendants, nested content and reused sentences while cleaning removed example links", () => {
    let state = initialize(seeded());
    state = mutate(state, addPage("my-child", EXAMPLE_NOTEBOOK_PAGE_IDS.context));
    state = mutate(state, addPage("my-grandchild", "my-child"));
    state = mutate(state, { action: "append_blocks", pageId: "parent", blocks: [
      { id: "outline", type: "toggleListItem", content: "Keep this text", children: [{ id: "example-link", type: "pageLink", props: { pageId: EXAMPLE_NOTEBOOK_ROOT_ID } }, { id: "reused-sentence", type: "sentence", props: { sentenceId: EXAMPLE_NOTEBOOK_SENTENCE_ID } }] },
    ] });
    state = mutate(state, { action: "remove_examples" });
    expect(state.pages.map((page) => page.id)).toEqual(["parent", "child", "my-child", "my-grandchild"]);
    expect(state.pages.find((page) => page.id === "my-child")).toMatchObject({ parentId: null, revision: 1 });
    expect(state.pages.find((page) => page.id === "my-grandchild")).toMatchObject({ parentId: "my-child", revision: 0 });
    expect(state.pages[0].content[0]).toMatchObject({ content: "Keep this text", children: [{ id: "reused-sentence" }] });
    expect(state.sentences.some((sentence) => sentence.id === EXAMPLE_NOTEBOOK_SENTENCE_ID)).toBe(true);
  });
  it("reparents personal children to the nearest surviving ancestor when examples were moved", () => {
    let state = initialize(seeded());
    state = mutate(state, { action: "update_page", pageId: EXAMPLE_NOTEBOOK_ROOT_ID, expectedRevision: 0, patch: { parentId: "parent" } });
    state = mutate(state, addPage("mine", EXAMPLE_NOTEBOOK_PAGE_IDS.context));
    state = mutate(state, { action: "remove_examples" });
    expect(state.pages.find((page) => page.id === "mine")?.parentId).toBe("parent");
  });
  it("preserves an edited example sentence even without a surviving page reference", () => {
    let state = initialize(createNotebookState());
    const sample = state.sentences.find((sentence) => sentence.id === EXAMPLE_NOTEBOOK_SENTENCE_ID)!;
    state = mutate(state, { action: "upsert_sentence", sentence: { id: sample.id, japanese: sample.japanese, kana: sample.kana, english: "My personal translation", subjectIds: sample.subjectIds }, expectedRevision: sample.revision });
    state = mutate(state, { action: "remove_examples" });
    expect(state.pages).toHaveLength(0);
    expect(state.sentences).toHaveLength(1);
    expect(state.sentences[0].english).toBe("My personal translation");
  });
  it("skips colliding IDs without claiming or removing pre-existing data", () => {
    const original = mutate(createNotebookState(), addPage(EXAMPLE_NOTEBOOK_ROOT_ID));
    const state = initialize(original);
    expect(state.examples?.status).toBe("skipped");
    expect(state.pages).toEqual(original.pages);
    expect(mutate(state, { action: "remove_examples" }).pages).toEqual(original.pages);
  });
  it("skips atomically at page, sentence and byte limits without evicting personal work", () => {
    const original = seeded();
    for (const limits of [
      { ...DEFAULT_NOTEBOOK_LIMITS, maxPages: original.pages.length },
      { ...DEFAULT_NOTEBOOK_LIMITS, maxSentences: original.sentences.length },
      { ...DEFAULT_NOTEBOOK_LIMITS, maxBytes: notebookStateBytes(original) + 100 },
    ]) {
      const state = applyNotebookMutation(original, { action: "initialize_examples" }, now, limits).state;
      expect(state.examples?.status).toBe("skipped");
      expect(state.pages).toEqual(original.pages);
      expect(state.sentences).toEqual(original.sentences);
      expect(notebookStateBytes(state)).toBeLessThanOrEqual(limits.maxBytes);
      expect(initialize(state)).toBe(state);
    }
    const full = applyNotebookMutation(original, { action: "initialize_examples" }, now, { ...DEFAULT_NOTEBOOK_LIMITS, maxBytes: notebookStateBytes(original) }).state;
    expect(full).toBe(original);
  });
  it("can record removal before initialization without touching coincidentally named pages", () => {
    const original = mutate(createNotebookState(), addPage(EXAMPLE_NOTEBOOK_ROOT_ID));
    const removed = mutate(original, { action: "remove_examples" });
    expect(removed.pages).toEqual(original.pages);
    expect(initialize(removed)).toBe(removed);
  });
});

describe("editable example notebook upgrades", () => {
  const sectionIds = ["example-context-subject-types", "example-context-radical", "example-context-kanji", "example-context-subject-types-tip", "example-context-subject-filters"];
  const upgradedAt = new Date("2026-09-08T12:00:00.000Z");
  const upgrade = (state: NotebookState) => applyNotebookMutation(state, { action: "initialize_examples" }, upgradedAt).state;
  function legacy(): NotebookState {
    const state = createExampleNotebook(now);
    return { ...state, examples: { version: 1, status: "installed" }, pages: state.pages.map((page) => ({ ...page, icon: "", content: page.content.filter((block) => !sectionIds.includes(block.id)) })) };
  }
  it("adds the new subject section once while preserving edited text, metadata, custom icons and sentences", () => {
    let state = legacy();
    const context = state.pages.find((page) => page.id === EXAMPLE_NOTEBOOK_PAGE_IDS.context)!;
    state = mutate(state, { action: "update_page", pageId: context.id, expectedRevision: 0, patch: { title: "My grammar", favorite: true, icon: "⭐", content: [...context.content, paragraph] } });
    const sample = state.sentences[0];
    state = mutate(state, { action: "upsert_sentence", sentence: { id: sample.id, japanese: sample.japanese, kana: sample.kana, english: "My translation", subjectIds: sample.subjectIds }, expectedRevision: 0 });
    const prior = structuredClone(state);
    const result = upgrade(state);
    const updated = result.pages.find((page) => page.id === context.id)!;
    expect(updated).toMatchObject({ title: "My grammar", favorite: true, icon: "⭐", revision: 2, createdAt: context.createdAt, updatedAt: upgradedAt.toISOString() });
    expect(updated.content.filter((block) => !sectionIds.includes(block.id))).toEqual(prior.pages.find((page) => page.id === context.id)!.content);
    expect(updated.content.slice(updated.content.findIndex((block) => block.id === "example-context-mention") + 1, updated.content.findIndex((block) => block.id === "example-context-rule-title")).map((block) => block.id)).toEqual(sectionIds);
    expect(pageSubjectIds(updated, result.sentences)).toEqual(expect.arrayContaining([1, 455, 2504]));
    expect(result.sentences).toEqual(prior.sentences);
    expect(state).toEqual(prior);
    expect(result.examples).toEqual({ version: 1, status: "installed", contentVersion: EXAMPLE_NOTEBOOK_CONTENT_VERSION });
    expect(upgrade(result)).toBe(result);
    expect(validateNotebookState(JSON.parse(JSON.stringify(result)))).toEqual(result);
  });
  it("replaces empty and legacy document icons, keeps custom icons and increments only changed pages", () => {
    const state = createExampleNotebook(now);
    state.examples = { version: 1, status: "installed" };
    state.pages[0].icon = "";
    state.pages[1].icon = "📄";
    state.pages[2].icon = "🎨";
    const result = upgrade(state);
    expect(result.pages.map((page) => page.icon)).toEqual(["🧭", "🌱", "🎨"]);
    expect(result.pages.map((page) => page.revision)).toEqual([1, 1, 0]);
    expect(result.pages[2]).toEqual(state.pages[2]);
  });
  it("leaves edited or partially deleted subject sections intact, including blocks moved inside a toggle", () => {
    const state = legacy();
    const context = state.pages.find((page) => page.id === EXAMPLE_NOTEBOOK_PAGE_IDS.context)!;
    context.icon = "🌱";
    context.content.push({ id: "my-toggle", type: "toggleListItem", content: "My study", children: [{ id: "example-context-radical", type: "paragraph", content: "My edited radical notes" }] });
    const result = upgrade(state);
    expect(result.pages.find((page) => page.id === context.id)).toEqual(context);
    expect(upgrade(result)).toBe(result);
  });
  it("never recreates deleted pages, edits Trash, or fills a cleared context page", () => {
    let state = legacy();
    state = mutate(state, { action: "trash_page", pageId: EXAMPLE_NOTEBOOK_PAGE_IDS.playground, expectedRevision: 0 });
    const context = state.pages.find((page) => page.id === EXAMPLE_NOTEBOOK_PAGE_IDS.context)!;
    state = mutate(state, { action: "update_page", pageId: context.id, expectedRevision: 0, patch: { content: [], icon: "⭐" } });
    const result = upgrade(state);
    expect(result.pages.find((page) => page.id === EXAMPLE_NOTEBOOK_PAGE_IDS.playground)).toEqual(state.pages.find((page) => page.id === EXAMPLE_NOTEBOOK_PAGE_IDS.playground));
    expect(result.pages.find((page) => page.id === context.id)).toEqual(state.pages.find((page) => page.id === context.id));
    let deleted = mutate(legacy(), { action: "trash_page", pageId: EXAMPLE_NOTEBOOK_ROOT_ID, expectedRevision: 0 });
    deleted = mutate(deleted, { action: "delete_page", pageId: EXAMPLE_NOTEBOOK_ROOT_ID, expectedRevision: 1 });
    expect(upgrade(deleted).pages).toEqual([]);
  });
  it("preserves personal pages, duplicated tours and legacy removals or skips", () => {
    let state = legacy();
    state = mutate(state, { action: "create_page", page: { id: "my-copy", title: "My tour copy", icon: "📄", content: state.pages[1].content } });
    const result = upgrade(state);
    expect(result.pages.find((page) => page.id === "my-copy")).toEqual(state.pages.find((page) => page.id === "my-copy"));
    for (const status of ["removed", "skipped"] as const) {
      const dismissed: NotebookState = { ...state, examples: { version: 1, status } };
      expect(notebookExamplesNeedInitialization(dismissed)).toBe(false);
      expect(upgrade(dismissed)).toBe(dismissed);
    }
    const removed = mutate(result, { action: "remove_examples" });
    expect(upgrade(removed)).toBe(removed);
    expect(removed.pages.map((page) => page.id)).toEqual(["my-copy"]);
  });
  it("retries atomically after quota failures without mutating or prematurely upgrading the marker", () => {
    const state = legacy();
    const context = state.pages.find((page) => page.id === EXAMPLE_NOTEBOOK_PAGE_IDS.context)!;
    for (const limits of [
      { ...DEFAULT_NOTEBOOK_LIMITS, maxBytes: notebookStateBytes(state) },
      { ...DEFAULT_NOTEBOOK_LIMITS, maxPageBytes: new TextEncoder().encode(JSON.stringify(context)).byteLength },
    ]) {
      expect(applyNotebookMutation(state, { action: "initialize_examples" }, upgradedAt, limits).state).toBe(state);
      expect(state.examples?.contentVersion).toBeUndefined();
    }
    expect(upgrade(state).examples?.contentVersion).toBe(EXAMPLE_NOTEBOOK_CONTENT_VERSION);
  });
  it("does not downgrade a future version and rejects malformed content version markers", () => {
    const future: NotebookState = { ...legacy(), examples: { version: 1, status: "installed", contentVersion: EXAMPLE_NOTEBOOK_CONTENT_VERSION + 1 } };
    expect(upgrade(future)).toBe(future);
    expect(notebookExamplesNeedInitialization(future)).toBe(false);
    for (const contentVersion of [0, -1, 1.5, "2"]) expect(() => validateNotebookState({ ...future, examples: { ...future.examples, contentVersion } })).toThrow();
  });
  it("uses a notebook icon for new blank pages and keeps explicit icon choices", () => {
    const state = mutate(createNotebookState(), { action: "create_page", page: { id: "blank" } });
    expect(state.pages[0].icon).toBe("📓");
    expect(mutate(state, { action: "create_page", page: { id: "blank" } })).toBe(state);
    expect(mutate(state, { action: "create_page", page: { id: "custom", icon: "" } }).pages[1].icon).toBe("");
    const legacyBlank = { ...state, pages: state.pages.map((page) => ({ ...page, icon: "" })) };
    expect(mutate(legacyBlank, { action: "create_page", page: { id: "blank" } })).toBe(legacyBlank);
  });
});
