import { describe, expect, it } from "vitest";
import { buildLyricsQuiz, parseYouTubeId } from "../lyrics";
import type { TimedLyricLine } from "../types";

const lines: TimedLyricLine[] = [
  "朝の空を見る",
  "青い海へ行く",
  "君と歌を聞く",
  "夜の星が光る",
  "明日また会える",
].map((text, index) => ({ id: `line-${index}`, text, startMs: index * 3000, endMs: (index + 1) * 3000 }));

describe("lyrics practice", () => {
  it("builds deterministic four-option questions from alternating Japanese lines", () => {
    const first = buildLyricsQuiz(lines);
    const second = buildLyricsQuiz(lines);
    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(1);
    expect(first.map((question) => question.lineIndex)).toEqual([0, 2, 4]);
    for (const question of first) {
      expect(question.options).toHaveLength(4);
      expect(new Set(question.options).size).toBe(4);
      expect(question.options).toContain(question.answer);
      expect(`${question.before}${question.answer}${question.after}`).toBe(lines[question.lineIndex].text);
    }
  });

  it("does not invent distractors for a lyric with too little vocabulary", () => {
    expect(buildLyricsQuiz([{ id: "one", text: "朝", startMs: 0, endMs: 5000 }])).toEqual([]);
  });

  it("accepts standard, short, Shorts, and embed YouTube URLs only", () => {
    expect(parseYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("https://youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
  });
});
