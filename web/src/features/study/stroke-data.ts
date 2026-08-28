export interface StrokePoint { x: number; y: number }
export interface KanjiStrokeData {
  strokes: string[];
  medians: number[][][];
  radStrokes?: number[];
}

export interface FreehandEvaluationThresholds {
  minSimilarityPercent: number;
  minCoveragePercent: number;
  minStrokeMatchPercent: number;
  maxStrokeDelta: number;
  maxAverageDistance: number;
  maxEndpointDistance: number;
  minStrokeScorePercent: number;
}

export interface FreehandStrokeChecks {
  path: boolean;
  endpoints: boolean;
  direction: boolean;
  length: boolean;
}

export interface FreehandStrokeEvaluation {
  expectedIndex: number;
  drawnIndex: number;
  matched: boolean;
  scorePercent: number;
  pathScorePercent: number;
  endpointScorePercent: number;
  directionScorePercent: number;
  lengthScorePercent: number;
  checks: FreehandStrokeChecks;
}

export interface FreehandEvaluationChecks extends FreehandStrokeChecks {
  similarity: boolean;
  coverage: boolean;
  strokeCount: boolean;
  strokeOrder: boolean;
}

export interface FreehandEvaluation {
  correct: boolean;
  similarityPercent: number;
  coveragePercent: number;
  strokeMatchPercent: number;
  matchedStrokeCount: number;
  drawnStrokeCount: number;
  expectedStrokeCount: number;
  strokeDelta: number;
  thresholds: FreehandEvaluationThresholds;
  checks: FreehandEvaluationChecks;
  strokeEvaluations: FreehandStrokeEvaluation[];
}

const JAPANESE_CDN = "https://cdn.jsdelivr.net/gh/mnako/hanzi-writer-data-ja@master/data";
const CHINESE_CDN = "https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0";
const cache = new Map<string, KanjiStrokeData>();

export async function loadKanjiStrokeData(character: string): Promise<KanjiStrokeData> {
  const cached = cache.get(character);
  if (cached) return cached;
  for (const base of [JAPANESE_CDN, CHINESE_CDN]) {
    try {
      const response = await fetch(`${base}/${encodeURIComponent(character)}.json`, { signal: AbortSignal.timeout(8_000) });
      if (!response.ok) continue;
      const value = await response.json() as Partial<KanjiStrokeData>;
      if (!Array.isArray(value.strokes) || !Array.isArray(value.medians) || !value.medians.length) continue;
      const data = value as KanjiStrokeData;
      cache.set(character, data);
      return data;
    } catch {
      continue;
    }
  }
  throw new Error(`Stroke data is unavailable for ${character}.`);
}

export function medianPoint(point: number[]): StrokePoint {
  return { x: point[0] ?? 0, y: 900 - (point[1] ?? 0) };
}

function distance(a: StrokePoint, b: StrokePoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number) {
  return clamp(value, 0, 1);
}

function validPoint(point: StrokePoint) {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function expectedStroke(median: number[][]): StrokePoint[] {
  return median
    .filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]))
    .map(medianPoint);
}

function polylineLength(points: StrokePoint[]) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += distance(points[index - 1], points[index]);
  }
  return total;
}

function distanceToSegment(point: StrokePoint, start: StrokePoint, end: StrokePoint) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return distance(point, start);
  const position = clamp(
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,
    0,
    1,
  );
  return distance(point, {
    x: start.x + dx * position,
    y: start.y + dy * position,
  });
}

function distanceToPolyline(point: StrokePoint, polyline: StrokePoint[]) {
  if (!polyline.length) return Number.POSITIVE_INFINITY;
  if (polyline.length === 1) return distance(point, polyline[0]);
  let closest = Number.POSITIVE_INFINITY;
  for (let index = 1; index < polyline.length; index += 1) {
    closest = Math.min(
      closest,
      distanceToSegment(point, polyline[index - 1], polyline[index]),
    );
  }
  return closest;
}

function samplePolyline(points: StrokePoint[], spacing: number) {
  if (points.length < 2) return points.slice();
  const samples: StrokePoint[] = [points[0]];
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const segmentLength = distance(start, end);
    const divisions = Math.max(1, Math.ceil(segmentLength / spacing));
    for (let division = 1; division <= divisions; division += 1) {
      const position = division / divisions;
      samples.push({
        x: start.x + (end.x - start.x) * position,
        y: start.y + (end.y - start.y) * position,
      });
    }
  }
  return samples;
}

function averagePathDistance(first: StrokePoint[], second: StrokePoint[]) {
  if (first.length < 2 || second.length < 2) return Number.POSITIVE_INFINITY;
  const firstSamples = samplePolyline(first, 24);
  const secondSamples = samplePolyline(second, 24);
  const firstToSecond = firstSamples.reduce(
    (sum, point) => sum + distanceToPolyline(point, second),
    0,
  ) / firstSamples.length;
  const secondToFirst = secondSamples.reduce(
    (sum, point) => sum + distanceToPolyline(point, first),
    0,
  ) / secondSamples.length;
  return (firstToSecond + secondToFirst) / 2;
}

function directionScore(points: StrokePoint[], expected: StrokePoint[]) {
  if (points.length < 2 || expected.length < 2) return 0;
  const actualStart = points[0];
  const actualEnd = points[points.length - 1];
  const expectedStart = expected[0];
  const expectedEnd = expected[expected.length - 1];
  const actualVector = {
    x: actualEnd.x - actualStart.x,
    y: actualEnd.y - actualStart.y,
  };
  const expectedVector = {
    x: expectedEnd.x - expectedStart.x,
    y: expectedEnd.y - expectedStart.y,
  };
  const denominator = Math.hypot(actualVector.x, actualVector.y)
    * Math.hypot(expectedVector.x, expectedVector.y);
  if (denominator < 1) return 0;
  const cosine = clamp(
    (actualVector.x * expectedVector.x + actualVector.y * expectedVector.y)
      / denominator,
    -1,
    1,
  );
  return (cosine + 1) / 2;
}

function evaluationThresholds(expectedStrokeCount: number, leniency: number): FreehandEvaluationThresholds {
  const minSimilarityPercent = Math.round(
    clamp(74 - (leniency - 1) * 16, 56, 82),
  );
  const minCoveragePercent = Math.round(
    clamp(66 - (leniency - 1) * 18, 48, 74),
  );
  const minStrokeMatchPercent = Math.round(
    clamp(70 - (leniency - 1) * 15, 50, 78),
  );
  const minDeltaByComplexity = expectedStrokeCount >= 8 ? 2 : 1;
  const strokeDeltaBase = Math.round(expectedStrokeCount * 0.16);
  const strokeDeltaLeniencyAdjustment = Math.round((leniency - 1) * 1);
  const maxStrokeDelta = Math.round(
    clamp(
      strokeDeltaBase + strokeDeltaLeniencyAdjustment,
      minDeltaByComplexity,
      Math.max(minDeltaByComplexity, Math.round(expectedStrokeCount * 0.24)),
    ),
  );

  return {
    minSimilarityPercent,
    minCoveragePercent,
    minStrokeMatchPercent,
    maxStrokeDelta,
    maxAverageDistance: 350 * leniency,
    maxEndpointDistance: 250 * leniency,
    minStrokeScorePercent: Math.round(
      clamp(0.67 - (leniency - 1) * 0.1, 0.5, 0.72) * 100,
    ),
  };
}

function evaluateOrderedStroke(
  drawnSource: StrokePoint[] | undefined,
  expected: StrokePoint[],
  expectedIndex: number,
  thresholds: FreehandEvaluationThresholds,
  leniency: number,
): FreehandStrokeEvaluation {
  const drawn = (drawnSource ?? []).filter(validPoint);
  if (drawn.length < 2 || expected.length < 2) {
    return {
      expectedIndex,
      drawnIndex: expectedIndex,
      matched: false,
      scorePercent: 0,
      pathScorePercent: 0,
      endpointScorePercent: 0,
      directionScorePercent: 0,
      lengthScorePercent: 0,
      checks: { path: false, endpoints: false, direction: false, length: false },
    };
  }

  const averageDistance = averagePathDistance(drawn, expected);
  const pathScore = clamp01(1 - averageDistance / thresholds.maxAverageDistance);
  const startScore = clamp01(
    1 - distance(drawn[0], expected[0]) / thresholds.maxEndpointDistance,
  );
  const endScore = clamp01(
    1 - distance(drawn[drawn.length - 1], expected[expected.length - 1])
      / thresholds.maxEndpointDistance,
  );
  const expectedLength = polylineLength(expected);
  const drawnLength = polylineLength(drawn);
  const lengthScore = expectedLength > 0 && drawnLength > 0
    ? Math.min(drawnLength, expectedLength) / Math.max(drawnLength, expectedLength)
    : 0;
  const strokeDirectionScore = directionScore(drawn, expected);
  const score = pathScore * 0.5
    + startScore * 0.2
    + endScore * 0.2
    + lengthScore * 0.08
    + strokeDirectionScore * 0.02;
  const minDirectionScore = clamp(0.675 - (leniency - 1) * 0.08, 0.58, 0.72);
  const minLengthScore = clamp(0.5 - (leniency - 1) * 0.1, 0.35, 0.56);
  const checks: FreehandStrokeChecks = {
    path: pathScore >= 0.5,
    endpoints: startScore > 0 && endScore > 0,
    direction: strokeDirectionScore >= minDirectionScore,
    length: lengthScore >= minLengthScore,
  };

  return {
    expectedIndex,
    drawnIndex: expectedIndex,
    matched: Math.round(score * 100) >= thresholds.minStrokeScorePercent
      && checks.path
      && checks.endpoints
      && checks.direction
      && checks.length,
    scorePercent: Math.round(score * 100),
    pathScorePercent: Math.round(pathScore * 100),
    endpointScorePercent: Math.round(((startScore + endScore) / 2) * 100),
    directionScorePercent: Math.round(strokeDirectionScore * 100),
    lengthScorePercent: Math.round(lengthScore * 100),
    checks,
  };
}

function expectedCoverage(
  expectedStrokes: StrokePoint[][],
  drawnStrokes: StrokePoint[][],
  leniency: number,
) {
  const drawn = drawnStrokes
    .map((stroke) => stroke.filter(validPoint))
    .filter((stroke) => stroke.length >= 2);
  if (!drawn.length) return 0;
  const samples = expectedStrokes.flatMap((stroke) => samplePolyline(stroke, 12));
  if (!samples.length) return 0;
  const coverageDistance = 44 * leniency;
  const covered = samples.filter((point) => drawn.some(
    (stroke) => distanceToPolyline(point, stroke) <= coverageDistance,
  )).length;
  return covered / samples.length;
}

/**
 * Grades a complete web-canvas drawing against Hanzi Writer median data.
 * Strokes are intentionally compared by array index: drawing the correct
 * shapes in a different order does not count as an ordered stroke match.
 */
export function evaluateFreehandDrawing(
  drawnStrokes: StrokePoint[][],
  strokeData: KanjiStrokeData,
  leniency = 1,
): FreehandEvaluation {
  const normalizedLeniency = clamp(
    Number.isFinite(leniency) ? leniency : 1,
    0.6,
    2,
  );
  const expectedStrokes = strokeData.medians.map(expectedStroke);
  const expectedStrokeCount = expectedStrokes.length;
  const drawnStrokeCount = drawnStrokes.length;
  const strokeDelta = Math.abs(drawnStrokeCount - expectedStrokeCount);
  const thresholds = evaluationThresholds(expectedStrokeCount, normalizedLeniency);
  const strokeEvaluations = expectedStrokes.map((stroke, index) =>
    evaluateOrderedStroke(
      drawnStrokes[index],
      stroke,
      index,
      thresholds,
      normalizedLeniency,
    ));
  const matchedStrokeCount = strokeEvaluations.filter((stroke) => stroke.matched).length;

  if (expectedStrokeCount === 0) {
    return {
      correct: false,
      similarityPercent: 0,
      coveragePercent: 0,
      strokeMatchPercent: 0,
      matchedStrokeCount,
      drawnStrokeCount,
      expectedStrokeCount,
      strokeDelta,
      thresholds,
      checks: {
        similarity: false,
        coverage: false,
        strokeCount: strokeDelta <= thresholds.maxStrokeDelta,
        strokeOrder: false,
        path: false,
        endpoints: false,
        direction: false,
        length: false,
      },
      strokeEvaluations,
    };
  }

  const strokeMatchRatio = matchedStrokeCount / expectedStrokeCount;
  const coverageRaw = expectedCoverage(
    expectedStrokes,
    drawnStrokes,
    normalizedLeniency,
  );
  const coveragePercent = Math.round(coverageRaw * 100);
  const strokeMatchPercent = Math.round(strokeMatchRatio * 100);
  const strokePenalty = Math.min(strokeDelta / expectedStrokeCount, 1) * 10;
  const similarityPercent = Math.round(
    clamp(
      strokeMatchPercent * 0.6 + coveragePercent * 0.4 - strokePenalty,
      0,
      100,
    ),
  );
  const checks: FreehandEvaluationChecks = {
    similarity: similarityPercent >= thresholds.minSimilarityPercent,
    coverage: coveragePercent >= thresholds.minCoveragePercent,
    strokeCount: strokeDelta <= thresholds.maxStrokeDelta,
    strokeOrder: strokeMatchPercent >= thresholds.minStrokeMatchPercent,
    path: strokeEvaluations.every((stroke) => stroke.checks.path),
    endpoints: strokeEvaluations.every((stroke) => stroke.checks.endpoints),
    direction: strokeEvaluations.every((stroke) => stroke.checks.direction),
    length: strokeEvaluations.every((stroke) => stroke.checks.length),
  };

  return {
    correct: checks.similarity
      && checks.coverage
      && checks.strokeCount,
    similarityPercent,
    coveragePercent,
    strokeMatchPercent,
    matchedStrokeCount,
    drawnStrokeCount,
    expectedStrokeCount,
    strokeDelta,
    thresholds,
    checks,
    strokeEvaluations,
  };
}

export function validateStroke(points: StrokePoint[], median: number[][], leniency = 220): { correct: boolean; message: string } {
  if (points.length < 2 || median.length < 2) return { correct: false, message: "Draw the full stroke before releasing." };
  const expected = expectedStroke(median);
  if (expected.length < 2) return { correct: false, message: "Draw the full stroke before releasing." };
  const expectedStart = expected[0];
  const expectedEnd = expected[expected.length - 1];
  const actualStart = points[0];
  const actualEnd = points[points.length - 1];
  const expectedVector = { x: expectedEnd.x - expectedStart.x, y: expectedEnd.y - expectedStart.y };
  const actualVector = { x: actualEnd.x - actualStart.x, y: actualEnd.y - actualStart.y };
  const denominator = Math.hypot(expectedVector.x, expectedVector.y) * Math.hypot(actualVector.x, actualVector.y);
  const direction = denominator ? (expectedVector.x * actualVector.x + expectedVector.y * actualVector.y) / denominator : -1;
  if (distance(actualStart, expectedStart) > leniency) return { correct: false, message: "Start closer to the highlighted stroke origin." };
  if (distance(actualEnd, expectedEnd) > leniency) return { correct: false, message: "Finish closer to the highlighted stroke end." };
  if (direction < 0.35) return { correct: false, message: "Check the stroke direction." };
  if (averagePathDistance(points, expected) > leniency) return { correct: false, message: "Follow the highlighted stroke path more closely." };
  return { correct: true, message: "Stroke accepted." };
}
