import { describe, expect, it } from "vitest";
import { notebookMarkdown } from "./export";
import { applyNotebookMutation, createNotebookState } from "./model";

describe("notebook Markdown export", () => {
  it("distinguishes an intentionally blank writing area from a saved private drawing", () => {
    const state = applyNotebookMutation(createNotebookState(), { action: "create_page", page: { id: "notes", content: [
      { id: "ink", type: "handwriting", props: { drawingId: "", inkFormat: "strokes-v1", width: 768, height: 384 } },
    ] } }).state;
    expect(notebookMarkdown(state.pages[0], state)).toContain("[Empty handwriting area]");
  });
  it("keeps an explicit handwriting fallback without exposing a private image reference", () => {
    const state = applyNotebookMutation(createNotebookState(), { action: "create_page", page: { id: "notes", title: "Writing practice", content: [
      { id: "ink", type: "handwriting", props: { drawingId: "8b7f489d-1f66-4667-800a-f83ed02dd170", width: 768, height: 1024 } },
    ] } }).state;
    const result = notebookMarkdown(state.pages[0], state);
    expect(result).toContain("Handwriting — view the saved drawing in your notebook");
    expect(result).toContain("not included in this text export");
    expect(result).not.toContain("8b7f489d-1f66-4667-800a-f83ed02dd170");
    expect(result).not.toContain("/api/notebooks");
  });

  it("resolves the current shared sentence once for every reference and keeps word and page links", () => {
    let state = applyNotebookMutation(createNotebookState(), { action: "upsert_sentence", expectedRevision: -1, sentence: { id: "example", japanese: "日本に行きます。", kana: "にほんにいきます。", english: "I am going to Japan.", subjectIds: [123] } }).state;
    state = applyNotebookMutation(state, { action: "create_page", page: { id: "source", title: "Grammar" } }).state;
    state = applyNotebookMutation(state, { action: "create_page", page: { id: "notes", title: "Travel", content: [
      { id: "heading", type: "heading", props: { level: 2 }, content: [{ type: "text", text: "Examples" }] },
      { id: "sentence", type: "sentence", props: { sentenceId: "example" } },
      { id: "inline", type: "paragraph", content: [{ type: "vocabularyMention", props: { subjectId: 123, label: "日本" } }] },
      { id: "link", type: "pageLink", props: { pageId: "source" } },
    ] } }).state;
    state = applyNotebookMutation(state, { action: "upsert_sentence", expectedRevision: 0, sentence: { id: "example", japanese: "明日、日本に行きます。", kana: "あした、にほんにいきます。", english: "I am going to Japan tomorrow.", subjectIds: [123] } }).state;
    const result = notebookMarkdown(state.pages[1], state);
    expect(result).toContain("# Travel\n\n## Examples");
    expect(result).toContain("明日、日本に行きます。");
    expect(result).toContain("I am going to Japan tomorrow.");
    expect(result).toContain("[日本](/subjects/123)");
    expect(result).toContain("[Grammar](/notebooks/source)");
    expect(result).not.toContain('"sentenceId"');
  });
});
