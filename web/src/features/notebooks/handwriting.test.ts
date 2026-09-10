import { describe, expect, it } from "vitest";
import { applyNotebookMutation, assertNotebookFeatures, createNotebookState, notebookDrawingReferences, sanitizeNotebookBlocks } from "./model";
import { isNotebookDrawingSize, NOTEBOOK_HANDWRITING_FEATURES, supportsNotebookHandwriting, supportsNotebookStrokes } from "./handwriting";
const drawingId = "00a00000-0000-4000-8000-000000000001";
const block = { id: "ink", type: "handwriting", props: { drawingId, width: 768, height: 1024 } };
describe("portable handwriting references", () => {
  it("preserves immutable metadata without embedding ink or preview content", () => {
    expect(sanitizeNotebookBlocks([{ ...block, props: { ...block.props, inkBase64: "secret" }, content: "untrusted" }])).toEqual([block]);
  });
  it.each(["../another-owner", "https://example.com/ink", "", drawingId.toUpperCase()])("rejects unsafe asset IDs %s", (id) => {
    expect(() => sanitizeNotebookBlocks([{ ...block, props: { ...block.props, drawingId: id } }])).toThrow("handwriting reference");
  });
  it("bounds canvas dimensions and rejects fractions", () => {
    for (const [width, height] of [[0, 1], [1, -1], [1.5, 1], [4097, 2], [4096, 4096]]) expect(isNotebookDrawingSize(width, height)).toBe(false);
    expect(isNotebookDrawingSize(2048, 2048)).toBe(true);
  });
  it("requires the exact negotiated feature for nested handwriting, including trash", () => {
    const state = applyNotebookMutation(createNotebookState(), { action: "create_page", page: { id: "page", content: [{ id: "parent", type: "paragraph", children: [block] }] } }).state;
    state.pages[0].trashedAt = new Date().toISOString();
    expect(notebookDrawingReferences(state)).toEqual([block.props]);
    for (const features of [undefined, null, "", "handwriting-v10"]) expect(() => assertNotebookFeatures(state, features)).toThrow(expect.objectContaining({ code: "update_required", status: 426 }));
    expect(() => assertNotebookFeatures(state, "another-feature, handwriting-v1")).not.toThrow();
    expect(() => assertNotebookFeatures(createNotebookState(), null)).not.toThrow();
    expect(supportsNotebookHandwriting("handwriting-v1-extra")).toBe(false);
  });
  it.each(["", drawingId])("preserves portable format and gates even blank areas in nested trash: %j", (id) => {
    const portable = { ...block, props: { ...block.props, drawingId: id, inkFormat: "strokes-v1" } };
    expect(sanitizeNotebookBlocks([portable])).toEqual([portable]);
    const state = applyNotebookMutation(createNotebookState(), { action: "create_page", page: { id: "page", content: [{ id: "parent", type: "paragraph", children: [portable] }] } }).state;
    state.pages[0].trashedAt = new Date().toISOString();
    expect(notebookDrawingReferences(state)).toEqual([portable.props]);
    for (const features of [undefined, "handwriting-v1", "handwriting-v1,handwriting-strokes-v10", "handwriting-strokes-v1"]) {
      expect(() => assertNotebookFeatures(state, features)).toThrow(expect.objectContaining({ code: "update_required", status: 426 }));
    }
    expect(() => assertNotebookFeatures(state, NOTEBOOK_HANDWRITING_FEATURES)).not.toThrow();
    expect(supportsNotebookStrokes("handwriting-strokes-v1-extra")).toBe(false);
  });
  it.each([null, "strokes-v2", "", 1])("rejects unknown explicit ink format %j", (inkFormat) => {
    expect(() => sanitizeNotebookBlocks([{ ...block, props: { ...block.props, inkFormat } }])).toThrow("handwriting reference");
  });
});
