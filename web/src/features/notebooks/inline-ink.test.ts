import { describe, expect, it } from "vitest";
import { decodeInlineInk, encodeInlineInk, INLINE_INK_MAX_POINTS, INLINE_INK_MAX_STROKES, parseInlineInk, type InlineInkDocument } from "./inline-ink";

const document: InlineInkDocument = { version: 1, width: 768, height: 384, strokes: [
  { id: "stroke-1", tool: "pen", color: "#123abc", width: 2.5, points: [[10, 20, 0.25], [30, 40, 1]] },
  { id: "stroke-2", tool: "marker", color: "#ffcc00", width: 24, points: [[60, 70, 0]] },
] };
const stroke = document.strokes[0];

describe("bounded portable inline ink", () => {
  it("round-trips editable strokes as ASCII JSON without native or browser encoders", () => {
    const encoded = encodeInlineInk(document);
    expect(encoded).toBe(Buffer.from(JSON.stringify(document), "ascii").toString("base64"));
    expect(decodeInlineInk(encoded)).toEqual(document);
    expect(parseInlineInk(document)).not.toBe(document);
    expect(decodeInlineInk(encodeInlineInk({ ...document, strokes: [] })).strokes).toEqual([]);
  });
  it("clips finite pointer positions at paper edges without changing pressure or input objects", () => {
    const input = { ...document, strokes: [{ ...stroke, points: [[-3, 500, 0.7]] }] };
    expect(parseInlineInk(input).strokes[0].points).toEqual([[0, 384, 0.7]]);
    expect(input.strokes[0].points).toEqual([[-3, 500, 0.7]]);
  });
  it.each([
    null, [], { ...document, version: 2 }, { ...document, extra: true },
    { ...document, width: 0 }, { ...document, height: 1.5 }, { ...document, width: 4096, height: 4096 },
    { ...document, strokes: [stroke, stroke] }, { ...document, strokes: Array(1) },
    ...[{ id: "日本" }, { id: "a".repeat(65) }, { id: "../other" }, { tool: "eraser" }, { color: "red" }, { color: "#ABCDEF" },
      { width: 0.49 }, { width: 25 }, { width: Infinity }, { points: [] }, { points: [[1, 2]] }, { points: [Array(3)] },
      { points: [[Infinity, 1, 0.5]] }, { points: [[1, NaN, 0.5]] }, { points: [[1, 2, -0.1]] }, { points: [[1, 2, 1.01]] },
      { points: [[1, 2, 0.5, 4]] }, { url: "https://example.test" }].map((patch) => ({ ...document, strokes: [{ ...stroke, ...patch }] })),
  ])("rejects unsupported or unsafe data %#", (input) => { expect(() => parseInlineInk(input)).toThrow("inline handwriting"); });
  it("enforces total stroke, point, and serialized byte bounds", () => {
    const strokes = Array.from({ length: INLINE_INK_MAX_STROKES + 1 }, (_, i) => ({ ...stroke, id: `s${i}` }));
    expect(() => parseInlineInk({ ...document, strokes })).toThrow();
    expect(() => parseInlineInk({ ...document, strokes: [{ ...stroke, points: Array.from({ length: INLINE_INK_MAX_POINTS + 1 }, () => [1, 2, 0.5]) }] })).toThrow();
    const precise = Array.from({ length: INLINE_INK_MAX_POINTS }, () => [0.12345678901234567, 0.23456789012345678, 0.34567890123456789]);
    expect(() => parseInlineInk({ ...document, strokes: [{ ...stroke, points: precise }] })).toThrow();
  });
  it.each(["", "!!!!", "data:application/json;base64,e30=", "Zh==", "e30", "w6k=", "A".repeat(1_398_108)])("rejects noncanonical, non-ASCII, or oversized encodings %#", (encoded) => {
    expect(() => decodeInlineInk(encoded)).toThrow("inline handwriting");
  });
});
