import { buildKnownVocabularyList } from "../known-vocabulary-export";

type VocabularySubject = Parameters<typeof buildKnownVocabularyList>[0][number];
type VocabularyAssignment = Parameters<typeof buildKnownVocabularyList>[1][number];

function subject(
  id: number,
  characters: string | null,
  object = "vocabulary",
  hiddenAt: string | null = null,
): VocabularySubject {
  return { id, object, data: { characters, hidden_at: hiddenAt } };
}

function assignment(
  subjectId: number,
  overrides: Partial<VocabularyAssignment["data"]> = {},
): VocabularyAssignment {
  return {
    data: {
      subject_id: subjectId,
      subject_type: "vocabulary",
      started_at: "2026-09-01T00:00:00.000Z",
      srs_stage: 1,
      hidden: false,
      ...overrides,
    },
  };
}

describe("buildKnownVocabularyList", () => {
  it("includes vocabulary and kana-only words from Apprentice through Burned", () => {
    const words = buildKnownVocabularyList(
      [
        subject(1, "水"),
        subject(2, "食べる"),
        subject(3, "ありがとう", "kana_vocabulary"),
      ],
      [
        assignment(1),
        assignment(2, { srs_stage: 9 }),
        assignment(3, { subject_type: "kana_vocabulary", srs_stage: 5 }),
      ],
    );

    expect(words.join("\n")).toBe("ありがとう\n水\n食べる");
  });

  it("excludes unstarted, reset, hidden, non-vocabulary, and unassigned subjects", () => {
    const words = buildKnownVocabularyList(
      [
        subject(1, "未習"),
        subject(2, "再学習"),
        subject(3, "旧語"),
        subject(4, "廃語", "vocabulary", "2026-09-02T00:00:00.000Z"),
        subject(5, "水", "kanji"),
        subject(6, "一", "radical"),
        subject(7, "未解放"),
        subject(8, "学ぶ"),
      ],
      [
        assignment(1, { started_at: null, srs_stage: 0 }),
        assignment(2, { srs_stage: 0 }),
        assignment(3, { hidden: true }),
        assignment(4),
        assignment(5, { subject_type: "kanji" }),
        assignment(6, { subject_type: "radical" }),
        assignment(8),
      ],
    );

    expect(words).toEqual(["学ぶ"]);
  });

  it("deduplicates spellings and assignments, skips blanks, and orders consistently", () => {
    const subjects = [
      subject(1, " 水 "),
      subject(2, "水", "kana_vocabulary"),
      subject(3, null),
      subject(4, "   "),
      subject(5, "ありがとう"),
    ];
    const assignments = [
      assignment(1),
      assignment(1),
      assignment(2, { subject_type: "kana_vocabulary" }),
      assignment(3),
      assignment(4),
      assignment(5),
    ];

    expect(buildKnownVocabularyList(subjects, assignments)).toEqual([
      "ありがとう",
      "水",
    ]);
    expect(
      buildKnownVocabularyList(
        [...subjects].reverse(),
        [...assignments].reverse(),
      ),
    ).toEqual(["ありがとう", "水"]);
  });

  it("rejects incomplete subject data instead of exporting a partial list", () => {
    expect(() =>
      buildKnownVocabularyList([subject(1, "水")], [assignment(1), assignment(2)]),
    ).toThrow("Known vocabulary is missing subject data.");
  });

  it("returns an empty list when no vocabulary lessons are complete", () => {
    expect(buildKnownVocabularyList([], [])).toEqual([]);
    expect(
      buildKnownVocabularyList([], [
        assignment(1, { started_at: null, srs_stage: 0 }),
      ]),
    ).toEqual([]);
  });
});
