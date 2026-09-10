import { describe, expect, it } from "vitest";
import { isNotebookPaperColor, resolveNotebookPaperColor } from "./paper-appearance";
import { applyNotebookMutation, assertNotebookFeatures, createNotebookState, sanitizeNotebookBlocks } from "./model";
import { NOTEBOOK_HANDWRITING_FEATURES } from "./handwriting";

describe("notebook paper and real ink appearances", () => {
  it.each(["auto", "#ffffff", "#1e1e1e", "#fbf6ed", "#ab12cd"])("accepts portable color %s", (color) => expect(isNotebookPaperColor(color)).toBe(true));
  it.each(["#FFF", "#FFFFFF", "red", "rgb(1,2,3)", "#11223344", "url(https://example.com)", "", null, 0])("rejects noncanonical paper colors %s", (color) => expect(isNotebookPaperColor(color)).toBe(false));
  it.each([["#ffffff", "light"], ["#1e1e1e", "dark"], ["#0a0a0a", "dark"], ["#fbf6ed", "light"], ["#00ff00", "light"], ["#0000ff", "dark"]])("selects ink by actual paper luminance %s", (color, appearance) => {
    expect(resolveNotebookPaperColor(color, "#ffffff")).toEqual({ color, appearance });
  });
  it("resolves automatic native and web surface colors without changing explicit choices", () => {
    expect(resolveNotebookPaperColor("auto", "rgb(30, 30, 30)")).toEqual({ color: "#1e1e1e", appearance: "dark" });
    expect(resolveNotebookPaperColor(undefined, "oklch(17.5% 0.009 265)").appearance).toBe("dark");
    expect(resolveNotebookPaperColor("auto", "oklch(96% 0.022 76)").appearance).toBe("light");
    expect(resolveNotebookPaperColor("#ffffff", "#0a0a0a")).toEqual({ color: "#ffffff", appearance: "light" });
  });
  const block = { id: "ink", type: "handwriting", props: { drawingId: "00a00000-0000-4000-8000-000000000001", width: 768, height: 384, paperColor: "#fbf6ed", previewFormat: "themed-v1" } };
  it("preserves appearance through sanitization and rejects older readers and writers including nested trash", () => {
    expect(sanitizeNotebookBlocks([block])).toEqual([block]);
    const state = applyNotebookMutation(createNotebookState(), { action: "create_page", page: { id: "page", content: [{ id: "parent", type: "paragraph", children: [block] }] } }).state;
    state.pages[0].trashedAt = new Date().toISOString();
    for (const features of ["handwriting-v1", "handwriting-v1, handwriting-strokes-v1", "handwriting-v1,handwriting-appearance-v10"]) expect(() => assertNotebookFeatures(state, features)).toThrow(expect.objectContaining({ code: "update_required" }));
    expect(() => assertNotebookFeatures(state, NOTEBOOK_HANDWRITING_FEATURES)).not.toThrow();
  });
  it("protects a blank paper color before it has an immutable asset", () => {
    const blank = { ...block, props: { drawingId: "", width: 768, height: 384, inkFormat: "strokes-v1", paperColor: "auto", previewFormat: "" } };
    const state = applyNotebookMutation(createNotebookState(), { action: "create_page", page: { id: "page", content: [blank] } }).state;
    expect(state.pages[0].content[0].props).not.toHaveProperty("previewFormat");
    expect(() => assertNotebookFeatures(state, "handwriting-v1,handwriting-strokes-v1")).toThrow();
  });
  it.each([{ paperColor: "#ABCDEF" }, { paperColor: "red" }, { previewFormat: "themed-v2" }, { previewFormat: "themed-v1", inkFormat: "strokes-v1" }])("rejects unknown or incompatible appearance props %s", (props) => {
    expect(() => sanitizeNotebookBlocks([{ ...block, props: { ...block.props, ...props } }])).toThrow("appearance");
  });
});
