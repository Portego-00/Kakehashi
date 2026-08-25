export interface StrokePoint { x: number; y: number }
export interface KanjiStrokeData { strokes: string[]; medians: number[][][] }

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

export function validateStroke(points: StrokePoint[], median: number[][], leniency = 220): { correct: boolean; message: string } {
  if (points.length < 2 || median.length < 2) return { correct: false, message: "Draw the full stroke before releasing." };
  const expectedStart = medianPoint(median[0]);
  const expectedEnd = medianPoint(median[median.length - 1]);
  const actualStart = points[0];
  const actualEnd = points[points.length - 1];
  const expectedVector = { x: expectedEnd.x - expectedStart.x, y: expectedEnd.y - expectedStart.y };
  const actualVector = { x: actualEnd.x - actualStart.x, y: actualEnd.y - actualStart.y };
  const denominator = Math.hypot(expectedVector.x, expectedVector.y) * Math.hypot(actualVector.x, actualVector.y);
  const direction = denominator ? (expectedVector.x * actualVector.x + expectedVector.y * actualVector.y) / denominator : -1;
  if (distance(actualStart, expectedStart) > leniency) return { correct: false, message: "Start closer to the highlighted stroke origin." };
  if (distance(actualEnd, expectedEnd) > leniency) return { correct: false, message: "Finish closer to the highlighted stroke end." };
  if (direction < 0.35) return { correct: false, message: "Check the stroke direction." };
  return { correct: true, message: "Stroke accepted." };
}
