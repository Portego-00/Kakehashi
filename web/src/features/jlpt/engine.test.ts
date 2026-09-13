import { describe, expect, it } from "vitest";
import { jlptQuestionSemanticKey } from "./editorial";
import { N1_QUESTIONS } from "./questions/n1";
import { N2_QUESTIONS } from "./questions/n2";
import { N3_QUESTIONS } from "./questions/n3";
import { N4_QUESTIONS } from "./questions/n4";
import { N5_QUESTIONS } from "./questions/n5";
import {
  JLPT_APPROXIMATE_ITEM_COUNTS,
  JLPT_MOCK_STRUCTURES,
  OFFICIAL_TYPES_BY_LEVEL,
  officialTypeOrder,
  testSectionIdForQuestion,
} from "./structure";
import type { JlptLevel, JlptQuestion, JlptSession, JlptSkill } from "./types";
import {
  advanceJlptSession,
  answerCurrentJlptQuestion,
  createJlptSession,
  expireJlptSection,
  pauseJlptSession,
  recordJlptListeningPlay,
  releaseJlptListeningPlay,
  remainingSectionSeconds,
  resumeJlptSession,
  scoreJlptSession,
  startNextJlptSection,
  waniKaniKanjiInsight,
} from "./engine";

const START = new Date("2026-08-29T10:00:00.000Z");
const BANKS: Record<JlptLevel, readonly JlptQuestion[]> = {
  N5: N5_QUESTIONS,
  N4: N4_QUESTIONS,
  N3: N3_QUESTIONS,
  N2: N2_QUESTIONS,
  N1: N1_QUESTIONS,
};

function expandedN5SkillPool(perSkill = 20) {
  const skills: readonly JlptSkill[] = [
    "kanji",
    "vocabulary",
    "grammar",
    "reading",
    "listening",
  ];
  return skills.flatMap((skill) => {
    const source = N5_QUESTIONS.find((question) => question.skill === skill)!;
    return Array.from(
      { length: perSkill },
      (_, index): JlptQuestion => ({
        ...source,
        id: `selection-${skill}-${index}`,
        shortQuiz: true,
      }),
    );
  });
}

function expandedN5TypePool(perType = 15) {
  return OFFICIAL_TYPES_BY_LEVEL.N5.flatMap((officialType) => {
    const source = N5_QUESTIONS.find(
      (question) => question.officialType === officialType,
    )!;
    return Array.from(
      { length: perType },
      (_, index): JlptQuestion => ({
        ...source,
        id: `mock-${officialType}-${index}`,
      }),
    );
  });
}

describe("JLPT session engine", () => {
  it("creates a ten-question mixed quick quiz with configurable feedback", () => {
    const session = createJlptSession({
      level: "N5",
      mode: "quick",
      questions: N5_QUESTIONS,
      immediateFeedback: false,
      now: START,
    });
    const selected = session.sectionQuestionIds
      .flat()
      .map((id) => N5_QUESTIONS.find((question) => question.id === id)!);
    expect(selected).toHaveLength(10);
    expect(new Set(selected.map((question) => question.skill))).toEqual(
      new Set(["kanji", "vocabulary", "grammar", "reading", "listening"]),
    );
    expect(session.immediateFeedback).toBe(false);
    expect(session.deadlineAt).toBeNull();
  });

  it("randomizes quick quizzes while keeping two questions from every skill", () => {
    const questions = expandedN5SkillPool();
    const low = createJlptSession({
      level: "N5",
      mode: "quick",
      questions,
      random: () => 0,
      now: START,
    });
    const high = createJlptSession({
      level: "N5",
      mode: "quick",
      questions,
      random: () => 0.999999,
      now: START,
    });

    expect(low.sectionQuestionIds[0]).not.toEqual(high.sectionQuestionIds[0]);
    for (const session of [low, high]) {
      const selected = session.sectionQuestionIds[0].map(
        (id) => questions.find((question) => question.id === id)!,
      );
      expect(
        Object.fromEntries(
          ["kanji", "vocabulary", "grammar", "reading", "listening"].map(
            (skill) => [
              skill,
              selected.filter((question) => question.skill === skill).length,
            ],
          ),
        ),
      ).toEqual({
        kanji: 2,
        vocabulary: 2,
        grammar: 2,
        reading: 2,
        listening: 2,
      });
    }
  });

  it("prefers unseen questions and only cycles a pool after it is exhausted", () => {
    const questions = expandedN5SkillPool(4);
    const first = createJlptSession({
      level: "N5",
      mode: "quick",
      questions,
      random: () => 0,
      now: START,
    });
    const seen = new Set(first.sectionQuestionIds.flat());
    const second = createJlptSession({
      level: "N5",
      mode: "quick",
      questions,
      excludedQuestionIds: seen,
      random: () => 0,
      now: START,
    });

    expect(
      second.sectionQuestionIds.flat().filter((id) => seen.has(id)),
    ).toHaveLength(0);
  });

  it("uses every semantic item before repeating a controlled rendering", () => {
    const source = N5_QUESTIONS.find(
      (question) => question.skill === "grammar",
    )!;
    const questions = Array.from(
      { length: 20 },
      (_, index): JlptQuestion => ({
        ...source,
        id: `semantic-${index}`,
        provenance: {
          semanticKey: `n5:grammar:seed-${index % 10}`,
          variantIndex: Math.floor(index / 10),
          authorship: "controlled-variant",
          editorialStatus: "machine-validated",
          contentVersion: 1,
        },
      }),
    );
    const session = createJlptSession({
      level: "N5",
      mode: "weak",
      questions,
      weakSkills: ["grammar"],
      random: () => 0,
      now: START,
    });
    const selected = session.sectionQuestionIds[0].map(
      (id) => questions.find((question) => question.id === id)!,
    );

    expect(selected).toHaveLength(10);
    expect(
      new Set(selected.map((question) => question.provenance?.semanticKey))
        .size,
    ).toBe(10);
  });

  it("prefers an unseen semantic item over an unseen rendering of a practiced item", () => {
    const source = N5_QUESTIONS.find(
      (question) => question.skill === "grammar",
    )!;
    const questions = Array.from(
      { length: 20 },
      (_, index): JlptQuestion => ({
        ...source,
        id: `history-semantic-${index}`,
        provenance: {
          semanticKey: `n5:grammar:history-${index % 4}`,
          variantIndex: Math.floor(index / 4),
          authorship: "controlled-variant",
          editorialStatus: "machine-validated",
          contentVersion: 1,
        },
      }),
    );
    const session = createJlptSession({
      level: "N5",
      mode: "weak",
      questions,
      weakSkills: ["grammar"],
      excludedSemanticKeys: new Set(["n5:grammar:history-0"]),
      random: () => 0,
      now: START,
    });
    const selected = session.sectionQuestionIds[0].map(
      (id) => questions.find((question) => question.id === id)!,
    );

    expect(
      selected.every(
        (question) =>
          question.provenance?.semanticKey !== "n5:grammar:history-0",
      ),
    ).toBe(true);
  });

  it("groups and orders the representative mock into N5's three official timed sections", () => {
    const session = createJlptSession({
      level: "N5",
      mode: "mock",
      questions: N5_QUESTIONS,
      now: START,
    });
    expect(session.sectionQuestionIds).toHaveLength(3);
    expect(
      session.sectionQuestionIds.every((section) => section.length > 0),
    ).toBe(true);
    expect(session.remainingSeconds).toBe(20 * 60);
    expect(session.deadlineAt).toBe("2026-08-29T10:20:00.000Z");
    expect(session.immediateFeedback).toBe(false);
  });

  it("samples each mock question family to the official published approximate count", () => {
    const questions = expandedN5TypePool();
    const session = createJlptSession({
      level: "N5",
      mode: "mock",
      questions,
      random: () => 0,
      now: START,
    });
    const selected = session.sectionQuestionIds
      .flat()
      .map((id) => questions.find((question) => question.id === id)!);

    expect(selected).toHaveLength(
      Object.values(JLPT_APPROXIMATE_ITEM_COUNTS.N5).reduce(
        (total, count) => total + count,
        0,
      ),
    );
    for (const officialType of OFFICIAL_TYPES_BY_LEVEL.N5) {
      expect(
        selected.filter((question) => question.officialType === officialType),
      ).toHaveLength(JLPT_APPROXIMATE_ITEM_COUNTS.N5[officialType] ?? 0);
    }
  });

  it.each(Object.entries(BANKS) as [JlptLevel, readonly JlptQuestion[]][])(
    "builds a complete, ordered, semantically non-repeating %s representative form",
    (level, questions) => {
      const session = createJlptSession({
        level,
        mode: "mock",
        questions,
        random: () => 0,
        now: START,
      });
      const byId = new Map(
        questions.map((question) => [question.id, question]),
      );
      const selected = session.sectionQuestionIds
        .flat()
        .map((id) => byId.get(id)!);
      const expectedTotal = Object.values(
        JLPT_APPROXIMATE_ITEM_COUNTS[level],
      ).reduce((total, count) => total + count, 0);

      expect(session.sectionQuestionIds).toHaveLength(
        JLPT_MOCK_STRUCTURES[level].sections.length,
      );
      expect(session.remainingSeconds).toBe(
        JLPT_MOCK_STRUCTURES[level].sections[0].durationMinutes * 60,
      );
      expect(selected).toHaveLength(expectedTotal);
      for (const officialType of OFFICIAL_TYPES_BY_LEVEL[level]) {
        const family = selected.filter(
          (question) => question.officialType === officialType,
        );
        expect(family).toHaveLength(
          JLPT_APPROXIMATE_ITEM_COUNTS[level][officialType] ?? 0,
        );
        expect(
          new Set(family.map(jlptQuestionSemanticKey)).size,
          `${level} ${officialType}`,
        ).toBe(family.length);
      }
      expect(new Set(selected.map(jlptQuestionSemanticKey)).size).toBe(
        selected.length,
      );
      session.sectionQuestionIds.forEach((ids, sectionIndex) => {
        const section = JLPT_MOCK_STRUCTURES[level].sections[sectionIndex];
        const sectionQuestions = ids.map((id) => byId.get(id)!);
        expect(
          sectionQuestions.every(
            (question) =>
              testSectionIdForQuestion(level, question) === section.id,
          ),
        ).toBe(true);
        const orders = sectionQuestions.map((question) =>
          officialTypeOrder(level, question.officialType),
        );
        expect(orders).toEqual([...orders].sort((left, right) => left - right));
      });
    },
  );

  it("keeps the blanks from one text-grammar passage together and in printed order", () => {
    let textGrammarIndex = 0;
    const questions = expandedN5TypePool().map((question): JlptQuestion => {
      if (question.officialType !== "text-grammar" || textGrammarIndex > 1) {
        if (question.officialType === "text-grammar") textGrammarIndex += 1;
        return question;
      }
      const blankOrder = textGrammarIndex + 1;
      textGrammarIndex += 1;
      return {
        ...question,
        passage: {
          body: `同じ文章の空所${blankOrder}です。`,
          groupId: "n5:test-group:variant-0",
          blankId: `blank-${blankOrder}`,
          blankOrder,
        },
        provenance: {
          semanticKey: `n5:text-grammar:blank-${blankOrder}`,
          variantIndex: 0,
          authorship: "controlled-variant",
          editorialStatus: "machine-validated",
          contentVersion: 1,
        },
      };
    });

    const session = createJlptSession({
      level: "N5",
      mode: "mock",
      questions,
      random: () => 0,
      now: START,
    });
    const selected = session.sectionQuestionIds
      .flat()
      .map((id) => questions.find((question) => question.id === id)!);
    const grouped = selected.filter(
      (question) => question.passage?.groupId === "n5:test-group:variant-0",
    );

    expect(grouped).toHaveLength(2);
    expect(grouped.map((question) => question.passage?.blankOrder)).toEqual([
      1, 2,
    ]);
    expect(selected.indexOf(grouped[1])).toBe(selected.indexOf(grouped[0]) + 1);
  });

  it("selects a shared reading source as one complete ordered question group", () => {
    let readingIndex = 0;
    const groupedSemanticKeys: Record<string, string[]> = {
      "reading-group-a:variant-0": [],
      "reading-group-b:variant-0": [],
    };
    const questions = expandedN5TypePool().map((question): JlptQuestion => {
      if (question.officialType !== "reading-mid" || readingIndex >= 4)
        return question;
      const group =
        readingIndex < 2
          ? "reading-group-a:variant-0"
          : "reading-group-b:variant-0";
      const groupQuestionIndex = (readingIndex % 2) + 1;
      const semanticKey = `n5:reading-mid:${group}:${groupQuestionIndex}`;
      readingIndex += 1;
      groupedSemanticKeys[group].push(semanticKey);
      return {
        ...question,
        passage: {
          body: group.startsWith("reading-group-a")
            ? "一つ目の共有文章です。"
            : "二つ目の共有文章です。",
          groupId: group,
          groupQuestionIndex,
        },
        provenance: {
          semanticKey,
          variantIndex: 0,
          authorship: "controlled-variant",
          editorialStatus: "machine-validated",
          contentVersion: 1,
        },
      };
    });

    const session = createJlptSession({
      level: "N5",
      mode: "mock",
      questions,
      excludedSemanticKeys: new Set(
        groupedSemanticKeys["reading-group-a:variant-0"],
      ),
      random: () => 0,
      now: START,
    });
    const selected = session.sectionQuestionIds
      .flat()
      .map((id) => questions.find((question) => question.id === id)!)
      .filter((question) => question.officialType === "reading-mid");

    expect(selected).toHaveLength(2);
    expect(
      new Set(selected.map((question) => question.passage?.groupId)),
    ).toEqual(new Set(["reading-group-b:variant-0"]));
    expect(
      selected.map((question) => question.passage?.groupQuestionIndex),
    ).toEqual([1, 2]);

    const midQuestions = questions.filter(
      (question) => question.officialType === "reading-mid",
    );
    const afterExhaustion = createJlptSession({
      level: "N5",
      mode: "mock",
      questions,
      excludedSemanticKeys: new Set(
        midQuestions.map(
          (question) => question.provenance?.semanticKey ?? question.id,
        ),
      ),
      random: () => 0,
      now: START,
    });
    const cycled = afterExhaustion.sectionQuestionIds
      .flat()
      .map((id) => questions.find((question) => question.id === id)!)
      .filter((question) => question.officialType === "reading-mid");

    expect(cycled).toHaveLength(2);
    expect(
      new Set(cycled.map((question) => question.passage?.groupId)).size,
    ).toBe(1);
    expect(
      cycled.map((question) => question.passage?.groupQuestionIndex),
    ).toEqual([1, 2]);
  });

  it("records exactly one answer, requires it before advancing, and scores unanswered items as missed", () => {
    let session = createJlptSession({
      level: "N5",
      mode: "quick",
      questions: N5_QUESTIONS,
      now: START,
    });
    const first = N5_QUESTIONS.find(
      (question) => question.id === "n5-kanji-mainichi",
    )!;
    const remaining = N5_QUESTIONS.filter(
      (question) => question.id !== first.id && !question.sentenceComposition,
    ).slice(0, 9);
    session = {
      ...session,
      sectionQuestionIds: [
        [first.id, ...remaining.map((question) => question.id)],
      ],
      currentSectionIndex: 0,
      currentQuestionIndex: 0,
    };
    expect(advanceJlptSession(session, START)).toBe(session);
    session = answerCurrentJlptQuestion(
      session,
      first,
      first.correctOptionId,
      START,
    );
    expect(session.answers).toHaveLength(1);
    expect(answerCurrentJlptQuestion(session, first, "2", START)).toBe(session);
    session = advanceJlptSession(session, START);
    expect(session.currentQuestionIndex).toBe(1);
    expect(scoreJlptSession(session, N5_QUESTIONS)).toMatchObject({
      correct: 1,
      total: 10,
      percent: 10,
    });
  });

  it("grades the complete assembled order in practice sentence composition", () => {
    const composition = N5_QUESTIONS.find(
      (question) => question.id === "n5-composition-school",
    )!;
    let session = createJlptSession({
      level: "N5",
      mode: "quick",
      questions: N5_QUESTIONS,
      now: START,
    });
    session = {
      ...session,
      sectionQuestionIds: [[composition.id]],
      currentQuestionIndex: 0,
    };

    const answered = answerCurrentJlptQuestion(
      session,
      composition,
      composition.correctOptionId,
      START,
      ["2", "1", "3", "4"],
    );

    expect(answered.answers[0]).toMatchObject({
      selectedOptionId: composition.correctOptionId,
      selectedOrderOptionIds: ["2", "1", "3", "4"],
      correct: false,
    });
  });

  it("rejects a sentence-composition answer unless all four fragments are ordered", () => {
    const composition = N5_QUESTIONS.find(
      (question) => question.id === "n5-composition-school",
    )!;
    let session = createJlptSession({
      level: "N5",
      mode: "mock",
      questions: N5_QUESTIONS,
      now: START,
    });
    session = {
      ...session,
      sectionQuestionIds: [[composition.id]],
      currentSectionIndex: 0,
      currentQuestionIndex: 0,
    };

    expect(
      answerCurrentJlptQuestion(
        session,
        composition,
        composition.correctOptionId,
        START,
      ),
    ).toBe(session);
    expect(
      answerCurrentJlptQuestion(
        session,
        composition,
        composition.correctOptionId,
        START,
        ["1", "2", "3"],
      ),
    ).toBe(session);
    expect(
      answerCurrentJlptQuestion(
        session,
        composition,
        composition.correctOptionId,
        START,
        ["1", "2", "3", "4"],
      ).answers[0],
    ).toMatchObject({
      selectedOptionId: composition.correctOptionId,
      selectedOrderOptionIds: ["1", "2", "3", "4"],
      correct: true,
    });
  });

  it("freezes and restores the section timer without granting extra time", () => {
    const initial = createJlptSession({
      level: "N5",
      mode: "mock",
      questions: N5_QUESTIONS,
      now: START,
    });
    const pausedAt = new Date("2026-08-29T10:04:40.000Z");
    const paused = pauseJlptSession(initial, pausedAt);
    expect(paused.status).toBe("paused");
    expect(paused.remainingSeconds).toBe(920);
    expect(
      remainingSectionSeconds(paused, new Date("2026-08-29T11:00:00.000Z")),
    ).toBe(920);
    const resumed = resumeJlptSession(
      paused,
      new Date("2026-08-29T11:00:00.000Z"),
    );
    expect(resumed.deadlineAt).toBe("2026-08-29T11:15:20.000Z");
  });

  it("locks an expired section and starts the next level-specific timer only on request", () => {
    const initial = createJlptSession({
      level: "N5",
      mode: "mock",
      questions: N5_QUESTIONS,
      now: START,
    });
    const expired = expireJlptSection(
      initial,
      new Date("2026-08-29T10:20:00.000Z"),
    );
    expect(expired.status).toBe("section-complete");
    expect(expired.deadlineAt).toBeNull();
    const next = startNextJlptSection(
      expired,
      new Date("2026-08-29T10:25:00.000Z"),
    );
    expect(next.status).toBe("active");
    expect(next.currentSectionIndex).toBe(1);
    expect(next.remainingSeconds).toBe(40 * 60);
    expect(next.deadlineAt).toBe("2026-08-29T11:05:00.000Z");
  });

  it("enforces practice and mock listening limits in persisted session state", () => {
    const listening = N5_QUESTIONS.find(
      (question) => question.id === "n5-listening-cafe",
    )!;
    let session = createJlptSession({
      level: "N5",
      mode: "quick",
      questions: N5_QUESTIONS,
      now: START,
    });
    session = {
      ...session,
      sectionQuestionIds: [[listening.id]],
      currentQuestionIndex: 0,
    };
    session = recordJlptListeningPlay(session, listening, START);
    session = recordJlptListeningPlay(session, listening, START);
    session = recordJlptListeningPlay(session, listening, START);
    expect(session.listeningPlays[listening.id]).toBe(2);

    let mock: JlptSession = { ...session, mode: "mock", listeningPlays: {} };
    mock = recordJlptListeningPlay(mock, listening, START);
    const atLimit = mock;
    mock = recordJlptListeningPlay(mock, listening, START);
    expect(mock).toBe(atLimit);
    expect(mock.listeningPlays[listening.id]).toBe(1);

    const released = releaseJlptListeningPlay(mock, listening.id, START);
    expect(released.listeningPlays[listening.id]).toBeUndefined();
    expect(releaseJlptListeningPlay(released, listening.id, START)).toBe(
      released,
    );
  });

  it("builds weak-area sessions and relates dedicated kanji accuracy to Guru coverage", () => {
    const weak = createJlptSession({
      level: "N5",
      mode: "weak",
      questions: N5_QUESTIONS,
      weakSkills: ["grammar"],
      now: START,
    });
    const selected = weak.sectionQuestionIds
      .flat()
      .map((id) => N5_QUESTIONS.find((question) => question.id === id)!);
    expect(selected.every((question) => question.skill === "grammar")).toBe(
      true,
    );

    const kanji = N5_QUESTIONS.find((question) => question.skill === "kanji")!;
    let answered = {
      ...weak,
      sectionQuestionIds: [[kanji.id]],
      currentQuestionIndex: 0,
    };
    answered = answerCurrentJlptQuestion(
      answered,
      kanji,
      kanji.correctOptionId,
      START,
    );
    expect(
      waniKaniKanjiInsight(answered, N5_QUESTIONS, new Set(kanji.relatedKanji)),
    ).toMatchObject({
      tested: kanji.relatedKanji?.length,
      guru: kanji.relatedKanji?.length,
      quizPercent: 100,
    });
  });
});
