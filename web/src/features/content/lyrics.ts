import { collectJapaneseTerms } from "./annotation";
import type { TimedLyricLine } from "./types";

export interface LyricsQuestion {
  id: string;
  lineIndex: number;
  before: string;
  answer: string;
  after: string;
  options: string[];
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function deterministicOrder(values: string[], seed: string) {
  return [...values].sort((left, right) => stableHash(`${seed}:${left}`) - stableHash(`${seed}:${right}`) || left.localeCompare(right, "ja"));
}

export function buildLyricsQuiz(lines: TimedLyricLine[]): LyricsQuestion[] {
  const termPool = [...new Set(lines.flatMap((line) => collectJapaneseTerms(line.text)).filter((term) => [...term].length <= 12))];
  if (termPool.length < 4) return [];
  const questions: LyricsQuestion[] = [];
  lines.forEach((line, lineIndex) => {
    if (lineIndex % 2 !== 0) return;
    const candidates = collectJapaneseTerms(line.text).filter((term) => termPool.includes(term));
    if (!candidates.length) return;
    const answer = candidates[stableHash(`${lineIndex}:${line.text}`) % candidates.length];
    const start = line.text.indexOf(answer);
    if (start < 0) return;
    const distractors = deterministicOrder(termPool.filter((term) => term !== answer), `${lineIndex}:${answer}`).slice(0, 3);
    if (distractors.length < 3) return;
    questions.push({ id: `question-${lineIndex}-${start}`, lineIndex, before: line.text.slice(0, start), answer, after: line.text.slice(start + answer.length), options: deterministicOrder([answer, ...distractors], line.text) });
  });
  return questions;
}

export function parseYouTubeId(value: string) {
  try {
    const url = new URL(value);
    if (url.hostname === "youtu.be") return /^[\w-]{11}$/.test(url.pathname.slice(1)) ? url.pathname.slice(1) : null;
    if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)) {
      const id = url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/embed/") ? url.pathname.split("/")[2] : url.searchParams.get("v");
      return id && /^[\w-]{11}$/.test(id) ? id : null;
    }
  } catch { return null; }
  return null;
}
