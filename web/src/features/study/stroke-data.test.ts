import { afterEach, describe, expect, it, vi } from "vitest";

import {
  evaluateFreehandDrawing,
  loadKanjiStrokeData,
  validateStroke,
  type KanjiStrokeData,
  type StrokePoint,
} from "./stroke-data";

const point = (x: number, y: number): StrokePoint => ({ x, y });

// Median y values use Hanzi Writer's bottom-left origin. Drawn points use the
// web canvas's top-left origin, so these represent a horizontal then vertical
// cross in the same 1024-unit view box as the writing-practice canvas.
const cross: KanjiStrokeData = {
  strokes: ["horizontal", "vertical"],
  medians: [
    [[100, 700], [500, 700], [900, 700]],
    [[500, 800], [500, 400], [500, 0]],
  ],
};

const perfectCross: StrokePoint[][] = [
  [point(100, 200), point(500, 200), point(900, 200)],
  [point(500, 100), point(500, 500), point(500, 900)],
];

// Real hanzi-writer-data-ja medians for 語. Its many short strokes expose
// false positives that a synthetic cross with two long strokes cannot.
const language: KanjiStrokeData = {
  strokes: Array.from({ length: 14 }, (_, index) => `stroke-${index}`),
  medians: [
    [[277, 832], [363, 775], [382, 720]],
    [[59, 579], [134, 571], [446, 622]],
    [[191, 474], [373, 501]],
    [[202, 386], [372, 399]],
    [[133, 269], [170, 238], [210, 40]],
    [[184, 261], [321, 293], [353, 277], [367, 255], [334, 154]],
    [[213, 125], [376, 143]],
    [[508, 708], [849, 754]],
    [[605, 684], [643, 645], [563, 380]],
    [[493, 526], [716, 568], [764, 558], [787, 533], [715, 401]],
    [[400, 360], [902, 405], [991, 393]],
    [[483, 262], [521, 228], [565, 11]],
    [[538, 247], [750, 277], [797, 263], [824, 225], [757, 107]],
    [[565, 71], [765, 97], [821, 83]],
  ],
};

const canvasStroke = (median: number[][]): StrokePoint[] =>
  median.map(([x, y]) => point(x, 900 - y));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadKanjiStrokeData", () => {
  it("uses the mobile app's Japanese stroke source before the fallback", async () => {
    const japaneseData: KanjiStrokeData = {
      strokes: ["M10,20L30,40Z"],
      medians: [[[10, 20], [30, 40]]],
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      void input;
      return {
        ok: true,
        json: async () => japaneseData,
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadKanjiStrokeData("書")).resolves.toEqual(japaneseData);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://cdn.jsdelivr.net/gh/mnako/hanzi-writer-data-ja@master/data/%E6%9B%B8.json",
    );
  });
});

describe("evaluateFreehandDrawing", () => {
  it("accepts a complete drawing in the expected stroke order", () => {
    const result = evaluateFreehandDrawing(perfectCross, cross);

    expect(result.correct).toBe(true);
    expect(result.similarityPercent).toBe(100);
    expect(result.coveragePercent).toBe(100);
    expect(result.strokeMatchPercent).toBe(100);
    expect(result.checks).toEqual({
      similarity: true,
      coverage: true,
      strokeCount: true,
      strokeOrder: true,
      path: true,
      endpoints: true,
      direction: true,
      length: true,
    });
    expect(result.strokeEvaluations).toHaveLength(2);
    expect(result.strokeEvaluations.every((stroke) => stroke.matched)).toBe(true);
  });

  it("rejects the right paths when they are drawn in the wrong order", () => {
    const result = evaluateFreehandDrawing(
      [perfectCross[1], perfectCross[0]],
      cross,
    );

    expect(result.correct).toBe(false);
    expect(result.checks.strokeCount).toBe(true);
    expect(result.checks.strokeOrder).toBe(false);
    expect(result.strokeMatchPercent).toBe(0);
  });

  it("detects a backwards stroke even when its path is fully covered", () => {
    const backwards = [
      [point(900, 200), point(500, 200), point(100, 200)],
      perfectCross[1],
    ];
    const result = evaluateFreehandDrawing(backwards, cross);

    expect(result.correct).toBe(false);
    expect(result.coveragePercent).toBe(100);
    expect(result.checks.path).toBe(true);
    expect(result.checks.direction).toBe(false);
    expect(result.checks.endpoints).toBe(false);
    expect(result.strokeMatchPercent).toBe(50);
  });

  it("rejects tiny start marks for a real complex kanji", () => {
    const tinyStartMarks = language.medians.map((median) => {
      const start = canvasStroke(median)[0];
      return [start, point(start.x + 8, start.y)];
    });
    const result = evaluateFreehandDrawing(tinyStartMarks, language, 1.5);

    expect(result.correct).toBe(false);
    expect(result.strokeMatchPercent).toBe(0);
    expect(result.coveragePercent).toBeLessThan(result.thresholds.minCoveragePercent);
    expect(result.checks.length).toBe(false);
  });

  it("rejects every stroke reversed while retaining geometric coverage", () => {
    const reversedStrokes = language.medians.map((median) =>
      canvasStroke(median).reverse());
    const result = evaluateFreehandDrawing(reversedStrokes, language, 1.5);

    expect(result.correct).toBe(false);
    expect(result.coveragePercent).toBe(100);
    expect(result.strokeMatchPercent).toBe(0);
    expect(result.checks.direction).toBe(false);
  });

  it("rejects an incomplete drawing using coverage and stroke-count checks", () => {
    const result = evaluateFreehandDrawing([], cross);

    expect(result.correct).toBe(false);
    expect(result.coveragePercent).toBe(0);
    expect(result.strokeMatchPercent).toBe(0);
    expect(result.checks.coverage).toBe(false);
    expect(result.checks.strokeCount).toBe(false);
    expect(result.drawnStrokeCount).toBe(0);
    expect(result.expectedStrokeCount).toBe(2);
  });

  it("rejects drawings that have too many extra strokes", () => {
    const extras = [
      ...perfectCross,
      [point(100, 100), point(900, 900)],
      [point(900, 100), point(100, 900)],
    ];
    const result = evaluateFreehandDrawing(extras, cross);

    expect(result.checks.strokeOrder).toBe(true);
    expect(result.checks.strokeCount).toBe(false);
    expect(result.correct).toBe(false);
  });

  it("returns stable zero scores when reference medians are unavailable", () => {
    const result = evaluateFreehandDrawing(perfectCross, {
      strokes: [],
      medians: [],
    });

    expect(result.correct).toBe(false);
    expect(result.similarityPercent).toBe(0);
    expect(result.coveragePercent).toBe(0);
    expect(result.strokeMatchPercent).toBe(0);
    expect(result.expectedStrokeCount).toBe(0);
  });
});

describe("validateStroke", () => {
  const horizontalMedian = [[100, 700], [500, 700], [900, 700]];

  it("keeps accepting a close stroke with the right endpoints and direction", () => {
    expect(validateStroke([
      point(105, 205),
      point(500, 215),
      point(895, 195),
    ], horizontalMedian)).toEqual({ correct: true, message: "Stroke accepted." });
  });

  it("rejects a stroke that reaches the endpoints by taking the wrong path", () => {
    const result = validateStroke([
      point(100, 200),
      point(500, 900),
      point(900, 200),
    ], horizontalMedian);

    expect(result).toEqual({
      correct: false,
      message: "Follow the highlighted stroke path more closely.",
    });
  });
});
