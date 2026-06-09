import { afterEach, describe, expect, it, jest } from "@jest/globals";
import type {
  Assignment,
  LevelProgression,
  ReviewStatistic,
  Subject,
} from "../api";
import {
  buildLevelAnalyticsDetailedExportRows,
  buildLevelAnalyticsExportRows,
  getAvailableLevelAnalyticsLevels,
  serializeLevelAnalyticsDetailedExportRows,
  serializeLevelAnalyticsExportRows,
} from "../levelAnalyticsExport";

function makeSubject(params: {
  id: number;
  level: number;
  object: Subject["object"];
  meaning: string;
  characters?: string | null;
}): Subject {
  return {
    id: params.id,
    object: params.object,
    url: `https://api.wanikani.com/v2/subjects/${params.id}`,
    data_updated_at: "2026-04-15T00:00:00.000Z",
    data: {
      created_at: "2026-01-01T00:00:00.000Z",
      level: params.level,
      slug: `subject-${params.id}`,
      hidden_at: null,
      document_url: "",
      characters: params.characters ?? params.meaning,
      character_images: null,
      meanings: [{ meaning: params.meaning, primary: true, accepted_answer: true }],
      auxiliary_meanings: [],
      readings: null,
      parts_of_speech: null,
      component_subject_ids: null,
      amalgamation_subject_ids: null,
      visually_similar_subject_ids: null,
      meaning_mnemonic: "",
      meaning_hint: null,
      reading_mnemonic: null,
      reading_hint: null,
    },
  };
}

function makeAssignment(params: {
  id: number;
  subjectId: number;
  subjectType: "radical" | "kanji" | "vocabulary";
  srsStage: number;
  unlockedAt: string | null;
  startedAt: string | null;
  passedAt: string | null;
}): Assignment {
  return {
    id: params.id,
    object: "assignment",
    url: `https://api.wanikani.com/v2/assignments/${params.id}`,
    data_updated_at: "2026-04-15T00:00:00.000Z",
    data: {
      created_at: "2026-01-01T00:00:00.000Z",
      subject_id: params.subjectId,
      subject_type: params.subjectType,
      srs_stage: params.srsStage,
      unlocked_at: params.unlockedAt,
      started_at: params.startedAt,
      passed_at: params.passedAt,
      burned_at: null,
      available_at: null,
      resurrected_at: null,
      hidden: false,
    },
  };
}

function makeReviewStatistic(params: {
  id: number;
  subjectId: number;
  meaningCorrect: number;
  meaningIncorrect: number;
  readingCorrect: number;
  readingIncorrect: number;
  percentageCorrect: number;
}): ReviewStatistic {
  return {
    id: params.id,
    object: "review_statistic",
    url: `https://api.wanikani.com/v2/review_statistics/${params.id}`,
    data_updated_at: "2026-04-15T00:00:00.000Z",
    data: {
      created_at: "2026-01-01T00:00:00.000Z",
      subject_id: params.subjectId,
      subject_type: "kanji",
      meaning_correct: params.meaningCorrect,
      meaning_incorrect: params.meaningIncorrect,
      meaning_max_streak: 5,
      meaning_current_streak: 2,
      reading_correct: params.readingCorrect,
      reading_incorrect: params.readingIncorrect,
      reading_max_streak: 4,
      reading_current_streak: 2,
      percentage_correct: params.percentageCorrect,
      hidden: false,
    },
  };
}

describe("levelAnalyticsExport", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("builds rows for completed and current levels", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-04-15T00:00:00.000Z"));

    const subjects: Subject[] = [
      makeSubject({ id: 1, level: 1, object: "radical", meaning: "Ground" }),
      makeSubject({ id: 2, level: 1, object: "kanji", meaning: "Water, Liquid", characters: "水" }),
      makeSubject({ id: 3, level: 1, object: "vocabulary", meaning: "Water", characters: "みず" }),
      makeSubject({ id: 4, level: 2, object: "kanji", meaning: "Fire", characters: "火" }),
    ];

    const assignments: Assignment[] = [
      makeAssignment({
        id: 1,
        subjectId: 1,
        subjectType: "radical",
        srsStage: 6,
        unlockedAt: "2026-03-01T00:00:00.000Z",
        startedAt: "2026-03-01T00:00:00.000Z",
        passedAt: "2026-03-05T00:00:00.000Z",
      }),
      makeAssignment({
        id: 2,
        subjectId: 2,
        subjectType: "kanji",
        srsStage: 6,
        unlockedAt: "2026-03-01T00:00:00.000Z",
        startedAt: "2026-03-01T00:00:00.000Z",
        passedAt: "2026-03-06T00:00:00.000Z",
      }),
      makeAssignment({
        id: 3,
        subjectId: 3,
        subjectType: "vocabulary",
        srsStage: 5,
        unlockedAt: "2026-03-02T00:00:00.000Z",
        startedAt: "2026-03-02T00:00:00.000Z",
        passedAt: "2026-03-10T00:00:00.000Z",
      }),
      makeAssignment({
        id: 4,
        subjectId: 4,
        subjectType: "kanji",
        srsStage: 3,
        unlockedAt: "2026-03-10T00:00:00.000Z",
        startedAt: "2026-03-10T00:00:00.000Z",
        passedAt: null,
      }),
    ];

    const reviewStatistics: ReviewStatistic[] = [
      makeReviewStatistic({
        id: 100,
        subjectId: 1,
        meaningCorrect: 10,
        meaningIncorrect: 1,
        readingCorrect: 0,
        readingIncorrect: 0,
        percentageCorrect: 90,
      }),
      makeReviewStatistic({
        id: 101,
        subjectId: 2,
        meaningCorrect: 12,
        meaningIncorrect: 2,
        readingCorrect: 8,
        readingIncorrect: 1,
        percentageCorrect: 86,
      }),
      makeReviewStatistic({
        id: 102,
        subjectId: 3,
        meaningCorrect: 9,
        meaningIncorrect: 0,
        readingCorrect: 6,
        readingIncorrect: 1,
        percentageCorrect: 88,
      }),
      makeReviewStatistic({
        id: 103,
        subjectId: 4,
        meaningCorrect: 2,
        meaningIncorrect: 3,
        readingCorrect: 2,
        readingIncorrect: 2,
        percentageCorrect: 44,
      }),
    ];

    const levelProgressions: LevelProgression[] = [
      {
        id: 1,
        object: "level_progression",
        url: "",
        data_updated_at: "2026-03-10T00:00:00.000Z",
        data: {
          created_at: "2026-03-01T00:00:00.000Z",
          level: 1,
          unlocked_at: "2026-03-01T00:00:00.000Z",
          started_at: null,
          passed_at: "2026-03-10T00:00:00.000Z",
          completed_at: "2026-03-10T00:00:00.000Z",
          abandoned_at: null,
        },
      },
      {
        id: 2,
        object: "level_progression",
        url: "",
        data_updated_at: "2026-03-10T00:00:00.000Z",
        data: {
          created_at: "2026-03-10T00:00:00.000Z",
          level: 2,
          unlocked_at: "2026-03-10T00:00:00.000Z",
          started_at: null,
          passed_at: null,
          completed_at: null,
          abandoned_at: null,
        },
      },
    ];

    const rows = buildLevelAnalyticsExportRows({
      subjects,
      assignments,
      reviewStatistics,
      levelProgressions,
      currentLevel: 2,
      username: "pedro",
    });

    expect(rows).toHaveLength(2);
    expect(rows[0].level).toBe(1);
    expect(rows[0].is_complete_level).toBe(true);
    expect(rows[0].learned_subjects_total).toBe(3);
    expect(rows[1].level).toBe(2);
    expect(rows[1].is_current_level).toBe(true);
    expect(rows[1].is_complete_level).toBe(false);
    expect(rows[1].overall_accuracy_percent).toBe(44);
  });

  it("filters summary rows when selectedLevels is provided", () => {
    const rows = buildLevelAnalyticsExportRows({
      subjects: [
        makeSubject({ id: 1, level: 1, object: "kanji", meaning: "One", characters: "一" }),
        makeSubject({ id: 2, level: 2, object: "kanji", meaning: "Two", characters: "二" }),
      ],
      assignments: [
        makeAssignment({
          id: 1,
          subjectId: 1,
          subjectType: "kanji",
          srsStage: 6,
          unlockedAt: "2026-03-01T00:00:00.000Z",
          startedAt: "2026-03-01T00:00:00.000Z",
          passedAt: "2026-03-03T00:00:00.000Z",
        }),
        makeAssignment({
          id: 2,
          subjectId: 2,
          subjectType: "kanji",
          srsStage: 3,
          unlockedAt: "2026-03-05T00:00:00.000Z",
          startedAt: "2026-03-05T00:00:00.000Z",
          passedAt: null,
        }),
      ],
      levelProgressions: [
        {
          id: 1,
          object: "level_progression",
          url: "",
          data_updated_at: "2026-03-03T00:00:00.000Z",
          data: {
            created_at: "2026-03-01T00:00:00.000Z",
            level: 1,
            unlocked_at: "2026-03-01T00:00:00.000Z",
            started_at: null,
            passed_at: "2026-03-03T00:00:00.000Z",
            completed_at: "2026-03-03T00:00:00.000Z",
            abandoned_at: null,
          },
        },
        {
          id: 2,
          object: "level_progression",
          url: "",
          data_updated_at: "2026-03-05T00:00:00.000Z",
          data: {
            created_at: "2026-03-05T00:00:00.000Z",
            level: 2,
            unlocked_at: "2026-03-05T00:00:00.000Z",
            started_at: null,
            passed_at: null,
            completed_at: null,
            abandoned_at: null,
          },
        },
      ],
      currentLevel: 2,
      selectedLevels: [2],
      username: "pedro",
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].level).toBe(2);
  });

  it("builds detailed rows with per-subject review fields", () => {
    const rows = buildLevelAnalyticsDetailedExportRows({
      subjects: [
        makeSubject({
          id: 10,
          level: 3,
          object: "kanji",
          meaning: "Tree",
          characters: "木",
        }),
      ],
      assignments: [
        makeAssignment({
          id: 200,
          subjectId: 10,
          subjectType: "kanji",
          srsStage: 7,
          unlockedAt: "2026-03-01T00:00:00.000Z",
          startedAt: "2026-03-01T00:00:00.000Z",
          passedAt: "2026-03-04T00:00:00.000Z",
        }),
      ],
      reviewStatistics: [
        makeReviewStatistic({
          id: 300,
          subjectId: 10,
          meaningCorrect: 9,
          meaningIncorrect: 1,
          readingCorrect: 8,
          readingIncorrect: 2,
          percentageCorrect: 85,
        }),
      ],
      selectedLevels: [3],
      username: "pedro",
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].level).toBe(3);
    expect(rows[0].subject_id).toBe(10);
    expect(rows[0].assignment_srs_stage).toBe(7);
    expect(rows[0].overall_accuracy_percent).toBe(85);
    expect(rows[0].total_incorrect).toBe(3);
  });

  it("serializes rows as CSV with escaped values", () => {
    const csv = serializeLevelAnalyticsExportRows([
      {
        level: 1,
        is_current_level: false,
        is_complete_level: true,
        level_started_at: "2026-03-01T00:00:00.000Z",
        level_passed_at: "2026-03-10T00:00:00.000Z",
        level_duration_days: 9,
        level_duration_hours: 216,
        level_duration_total_ms: 777600000,
        compared_to_average_days: 0,
        is_faster_than_average: false,
        learned_subjects_total: 3,
        learned_radicals: 1,
        learned_kanji: 1,
        learned_vocabulary: 1,
        overall_accuracy_percent: 88,
        meaning_accuracy_percent: 90,
        reading_accuracy_percent: 86,
        total_reviews_in_level_window: 20,
        most_missed_count: 1,
        most_missed_subject_ids: "2",
        most_missed_subjects: "2:Water, Liquid:3",
        star_performer_subject_id: 2,
        star_performer_characters: "水",
        star_performer_primary_meaning: "Water, Liquid",
        star_performer_subject_type: "kanji",
        star_performer_max_streak: 5,
        star_performer_accuracy_percent: 86,
        fastest_to_guru_subject_id: 1,
        fastest_to_guru_characters: "Ground",
        fastest_to_guru_primary_meaning: "Ground",
        fastest_to_guru_subject_type: "radical",
        fastest_to_guru_hours: 96,
        username: "pedro",
      },
    ]);

    const lines = csv.split("\n");
    expect(lines[0]).toContain("level");
    expect(lines[1]).toContain("\"2:Water, Liquid:3\"");
    expect(lines[1]).toContain("\"Water, Liquid\"");
  });

  it("serializes detailed rows as CSV", () => {
    const csv = serializeLevelAnalyticsDetailedExportRows([
      {
        level: 1,
        subject_id: 100,
        subject_object: "kanji",
        subject_type: "kanji",
        slug: "water",
        characters: "水",
        primary_meaning: "Water, Liquid",
        primary_reading: "みず",
        accepted_meanings: "Water|Liquid",
        accepted_readings: "みず",
        is_hidden_subject: false,
        assignment_id: 200,
        assignment_data_updated_at: "2026-03-10T00:00:00.000Z",
        assignment_srs_stage: 8,
        assignment_available_at: null,
        assignment_unlocked_at: "2026-03-01T00:00:00.000Z",
        assignment_started_at: "2026-03-01T00:00:00.000Z",
        assignment_passed_at: "2026-03-03T00:00:00.000Z",
        assignment_burned_at: null,
        assignment_resurrected_at: null,
        assignment_hidden: false,
        meaning_correct: 12,
        meaning_incorrect: 2,
        reading_correct: 8,
        reading_incorrect: 1,
        meaning_accuracy_percent: 85.71,
        reading_accuracy_percent: 88.89,
        overall_accuracy_percent: 86.96,
        percentage_correct: 87,
        meaning_max_streak: 5,
        reading_max_streak: 6,
        meaning_current_streak: 2,
        reading_current_streak: 3,
        total_incorrect: 3,
        review_stat_created_at: "2026-03-02T00:00:00.000Z",
        review_stat_data_updated_at: "2026-03-10T00:00:00.000Z",
        subject_created_at: "2026-02-01T00:00:00.000Z",
        subject_data_updated_at: "2026-03-10T00:00:00.000Z",
        document_url: "https://www.wanikani.com/kanji/%E6%B0%B4",
        username: "pedro",
      },
    ]);

    const lines = csv.split("\n");
    expect(lines[0]).toContain("subject_id");
    expect(lines[1]).toContain("\"Water, Liquid\"");
  });

  it("returns available levels from current analytics data", () => {
    const levels = getAvailableLevelAnalyticsLevels({
      subjects: [
        makeSubject({ id: 1, level: 1, object: "kanji", meaning: "One", characters: "一" }),
        makeSubject({ id: 2, level: 2, object: "kanji", meaning: "Two", characters: "二" }),
      ],
      assignments: [
        makeAssignment({
          id: 1,
          subjectId: 1,
          subjectType: "kanji",
          srsStage: 6,
          unlockedAt: "2026-03-01T00:00:00.000Z",
          startedAt: "2026-03-01T00:00:00.000Z",
          passedAt: "2026-03-03T00:00:00.000Z",
        }),
      ],
      levelProgressions: [],
      currentLevel: 2,
    });

    expect(levels).toEqual([1, 2]);
  });
});
