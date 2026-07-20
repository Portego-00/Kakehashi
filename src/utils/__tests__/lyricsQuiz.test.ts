import type { TimedLyricsLine } from "../../services/lyricsService";
import type { VocabularyMatch } from "../textHighlighting";
import {
  buildLyricsQuizQuestions,
  getLyricsQuizSessionKey,
} from "../lyricsQuiz";

const lines: TimedLyricsLine[] = [
  { startTimeMs: 0, words: "朝の空を見る" },
  { startTimeMs: 3000, words: "青い海へ行く" },
  { startTimeMs: 6000, words: "君と歌を聞く" },
  { startTimeMs: 9000, words: "夜の星が光る" },
  { startTimeMs: 12000, words: "明日また会える" },
];

const vocabularyMatches: VocabularyMatch[] = [
  "朝",
  "空",
  "見る",
  "青い",
  "海",
  "行く",
  "君",
  "歌",
  "聞く",
  "夜",
  "星",
  "光る",
  "明日",
  "会える",
].map((characters, index) => ({
  id: index + 1,
  characters,
  meaning: characters,
  type: "vocabulary",
  level: 1,
}));

describe("lyrics quiz generation", () => {
  it("builds deterministic four-option questions on alternating eligible lines", () => {
    const first = buildLyricsQuizQuestions(lines, vocabularyMatches);
    const second = buildLyricsQuizQuestions(lines, vocabularyMatches);

    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(1);
    expect(first.map((question) => question.lineIndex)).toEqual([0, 2, 4]);

    for (const question of first) {
      expect(question.options).toHaveLength(4);
      expect(new Set(question.options).size).toBe(4);
      expect(question.options).toContain(question.answer);
      expect(question.answerItem.characters).toBeTruthy();
      expect(
        `${question.beforeBlank}${question.answer}${question.afterBlank}`,
      ).toBe(question.lineText);
      expect(question.pauseTimeMs).toBeGreaterThan(
        lines[question.lineIndex].startTimeMs,
      );
      expect(question.pauseTimeMs).toBeLessThan(question.lineEndTimeMs);
    }
  });

  it("does not create misleading questions without four unique options", () => {
    expect(
      buildLyricsQuizQuestions(lines.slice(0, 1), vocabularyMatches.slice(0, 3)),
    ).toEqual([]);
  });

  it("uses WaniKani items at or below the user's level as blanks", () => {
    const leveledMatches = vocabularyMatches.map((match, index) => ({
      ...match,
      level: index < 4 ? 2 : 12,
      isWaniKaniSubject: true,
    }));

    const questions = buildLyricsQuizQuestions(lines, leveledMatches, 2);
    const knownCharacters = new Set(
      leveledMatches
        .filter((match) => match.level <= 2)
        .map((match) => match.characters),
    );

    expect(questions.length).toBeGreaterThan(0);
    expect(
      questions.every(
        (question) =>
          question.answerItem.isWaniKaniSubject !== false &&
          question.answerItem.level <= 2,
      ),
    ).toBe(true);
    expect(
      questions.every((question) =>
        question.options.every((option) => knownCharacters.has(option)),
      ),
    ).toBe(true);
  });

  it("falls back to the full lyric vocabulary when no known item is usable", () => {
    const advancedMatches = vocabularyMatches.map((match) => ({
      ...match,
      level: 20,
      isWaniKaniSubject: true,
    }));

    expect(buildLyricsQuizQuestions(lines, advancedMatches, 2).length).toBe(
      buildLyricsQuizQuestions(lines, advancedMatches).length,
    );
  });

  it("changes the session key when synchronized lyrics change", () => {
    const originalKey = getLyricsQuizSessionKey("Song", "Artist", lines);
    const changedKey = getLyricsQuizSessionKey("Song", "Artist", [
      ...lines,
      { startTimeMs: 15000, words: "新しい歌" },
    ]);

    expect(changedKey).not.toBe(originalKey);
  });
});
