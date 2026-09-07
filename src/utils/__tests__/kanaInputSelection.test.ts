import * as wanakana from "wanakana";
import { inferKanaInputEditEnd } from "../kanaInputSelection";

describe("inferKanaInputEditEnd", () => {
  test.each<[string, string, string, number, number, number]>([
    ["insert at the start", "あう", "いあう", 0, 0, 1],
    ["insert in the middle", "あう", "あいう", 1, 1, 2],
    ["append", "あう", "あうえ", 2, 2, 3],
    ["replace a range", "あいうえ", "あかきえ", 1, 3, 3],
    ["delete a range", "あいうえ", "あえ", 1, 3, 1],
    ["backspace", "あいうえ", "あうえ", 2, 2, 1],
    ["forward delete", "あいうえ", "あうえ", 1, 1, 1],
    ["append repeated text", "ああ", "あああ", 2, 2, 3],
    ["insert repeated text", "ああ", "あああ", 1, 1, 2],
    ["backspace repeated text", "ああああ", "あああ", 3, 3, 2],
    ["replace repeated text", "ああああ", "あああ", 2, 4, 3],
    ["paste over everything", "かな", "shiああああ", 0, 2, 7],
    ["clear everything", "かな", "", 0, 2, 0],
  ])("locates %s", (_description, previous, raw, start, end, expected) => {
    expect(inferKanaInputEditEnd(previous, raw, { start, end })).toBe(expected);
  });

  it("maps a three-letter syllable before a long suffix to its kana caret", () => {
    const raw = "shiああああ";
    const editEnd = inferKanaInputEditEnd("shああああ", raw, { start: 2, end: 2 });
    expect(editEnd).toBe(3);
    expect(wanakana.toKana(raw.slice(0, editEnd), { IMEMode: true })).toBe("し");
    // Android's full Editable replacement instead scales this to offset 2.
    expect(Math.floor(editEnd * wanakana.toKana(raw).length / raw.length)).toBe(2);
  });

  it("uses the changed text when the last selection is stale", () => {
    expect(inferKanaInputEditEnd("あいうえ", "あいかうえ", { start: 0, end: 0 })).toBe(3);
  });

  it("preserves the unchanged suffix without a selection event", () => {
    expect(inferKanaInputEditEnd("ああ", "あああ")).toBe(1);
    expect(inferKanaInputEditEnd("あいうえ", "あえ")).toBe(1);
  });

  it("locates batched romaji while native is ahead of the converted text", () => {
    const raw = "shiaああああ";
    const editEnd = inferKanaInputEditEnd("しああああ", raw, { start: 3, end: 3 }, "shiああああ");
    expect(editEnd).toBe(4);
    expect(wanakana.toKana(raw.slice(0, editEnd), { IMEMode: true })).toBe("しあ");
  });

  it("uses prior raw text for repeated-suffix deletion after a rejected conversion", () => {
    expect(inferKanaInputEditEnd(
      "しああああ", "shiあああ", { start: 6, end: 6 }, "shiああああ",
    )).toBe(5);
  });

  it("does not mistake an Android append for a middle edit when selection lags conversion", () => {
    const raw = "あa";
    const editEnd = inferKanaInputEditEnd("あ", raw, { start: 0, end: 0 }, "a");
    expect(editEnd).toBe(2);
    expect(wanakana.toKana(raw.slice(0, editEnd), { IMEMode: true })).toBe("ああ");
  });

  it("chooses the raw native snapshot when it explains more of a batched append", () => {
    expect(inferKanaInputEditEnd("あ", "ai", { start: 0, end: 0 }, "a")).toBe(2);
  });

  it("preserves an explicit middle edit when prior romaji matches by coincidence", () => {
    const raw = "kaかk";
    const editEnd = inferKanaInputEditEnd("かk", raw, { start: 0, end: 0 }, "kak");
    expect(editEnd).toBe(2);
    expect(wanakana.toKana(raw.slice(0, editEnd), { IMEMode: true })).toBe("か");
  });

  it("ignores a selection outside either previous snapshot", () => {
    expect(inferKanaInputEditEnd("shああああ", "shiああああ", { start: 99, end: 99 })).toBe(3);
  });
});
