import { describe, expect, it } from "vitest";
import type { JlptQuestion } from "../../types";
import {
  LOWER_READING_SEEDS,
  N3_LOWER_READING_SEEDS,
  N4_LOWER_READING_SEEDS,
  N5_LOWER_READING_SEEDS,
  lowerReadingCharacterCount,
  type LowerReadingSeed,
} from "./lower-reading-seeds";
import { readingBody } from "./reading-seed";
import { N3_GENERATED_QUESTIONS } from "./n3.generated";
import { N4_GENERATED_QUESTIONS } from "./n4.generated";
import { N5_GENERATED_QUESTIONS } from "./n5.generated";

type LowerLevel = "N5" | "N4" | "N3";
type LowerFamily =
  | "reading-short"
  | "reading-mid"
  | "reading-long"
  | "information-retrieval";

const EXPECTED_FAMILIES = {
  N5: ["reading-short", "reading-mid", "information-retrieval"],
  N4: ["reading-short", "reading-mid", "information-retrieval"],
  N3: ["reading-short", "reading-mid", "reading-long", "information-retrieval"],
} as const satisfies Record<LowerLevel, readonly LowerFamily[]>;

const LENGTH_FLOORS: Record<
  LowerLevel,
  Partial<Record<LowerFamily, number>>
> = {
  N5: { "reading-short": 60, "reading-mid": 120, "information-retrieval": 180 },
  N4: {
    "reading-short": 100,
    "reading-mid": 180,
    "information-retrieval": 300,
  },
  N3: {
    "reading-short": 130,
    "reading-mid": 240,
    "reading-long": 450,
    "information-retrieval": 450,
  },
};

const MID_RELEASE_BANDS = {
  N5: { minimum: 220, maximum: 300 },
  N4: { minimum: 380, maximum: 550 },
  N3: { minimum: 320, maximum: 450 },
} as const;

const MID_PASSAGE_IDS = {
  N5: [
    "N5-mid-apartment-laundry-rules-passage",
    "N5-mid-birthday-party-roles-passage",
    "N5-mid-grandmother-gift-letter-passage",
    "N5-mid-lunch-shopping-plan",
    "N5-mid-museum-weekend-choice-passage",
    "N5-mid-new-student-day-passage",
    "N5-mid-wallet-found-process-passage",
    "N5-mid-zoo-train-bus-plan-passage",
  ],
  N4: [
    "N4-mid-exchange-event-roles-passage",
    "N4-mid-imperfect-vegetable-market-passage",
    "N4-mid-library-study-seat-passage",
    "N4-mid-neighborhood-cat-feeding-passage",
    "N4-mid-office-quiet-hour-passage",
    "N4-mid-online-course-group-time-passage",
    "N4-mid-reusable-cup-system",
    "N4-mid-walking-map-updates-passage",
  ],
  N3: [
    "N3-mid-bakery-preorder-waste-passage",
    "N3-mid-child-exhibit-explanation-passage",
    "N3-mid-comment-delay-reflection-passage",
    "N3-mid-library-reminder-timing-passage",
    "N3-mid-museum-audio-choice-passage",
    "N3-mid-shared-tools-system",
    "N3-mid-team-near-mistake-log-passage",
    "N3-mid-walking-commute-attention-passage",
  ],
} as const satisfies Record<LowerLevel, readonly string[]>;

const DISTRACTOR_REMEDIATION_REGRESSIONS = {
  "N3-mid-shared-tools-location": "工具の種類ごとに買う数を決めたから",
  "N3-mid-shared-tools-failed-purchase":
    "新しく買った工具が、よく使う種類ではなかったから",
  "N3-mid-library-reminder-timing":
    "返却の三日前から当日のメールを送らないため",
  "N3-mid-museum-audio-choice": "説明を聞く作品を入口で一つだけ選べる",
  "N3-mid-bakery-preorder-waste": "予約分と当日分をいつも同じ数にするため",
  "N3-mid-walking-commute-attention":
    "雨の日も同じ道を歩き、毎日運動する習慣をつける",
  "N3-mid-team-near-mistake-log": "迷った本人へ後から個別に注意するため",
  "N3-mid-comment-delay-reflection":
    "公開前に管理者が強い表現だけを直せるようにするため",
  "N3-mid-child-exhibit-explanation":
    "先生が作品の時代を最初の十分で説明したから",
  "N3-long-repair-cafe-learning": "直せる物の数を増やして、ごみを減らすこと",
  "N3-long-repair-cafe-unrepairable":
    "使える部品だけを外し、持ち主に持ち帰ってもらう",
  "N3-long-street-tree-aftercare":
    "一年目に植える本数を減らし、店の前を避けるため",
  "N3-long-public-map-missing-reports":
    "中心部の印を先に直し、印の少ない地域は後に調べること",
  "N3-long-letter-slower-revision":
    "返事を急がない手紙で、友人の生活を全部聞く時間",
  "N3-long-school-project-shared-goal":
    "二つの案を同じ量ずつ残せるよう、展示を半分に分けたから",
  "N3-long-community-quiet-room":
    "静かな利用者が多い午前だけ、部屋を予約制にしたかったから",
  "N3-long-oral-history-context":
    "食いちがう話から、正しい一方を選びやすくするため",
  "N3-long-library-of-things-care":
    "返却時だけ部品を数え、こわれた物を早く買い直すこと",
} as const;

const SEEDS: Record<LowerLevel, readonly LowerReadingSeed[]> = {
  N5: N5_LOWER_READING_SEEDS,
  N4: N4_LOWER_READING_SEEDS,
  N3: N3_LOWER_READING_SEEDS,
};

const BANKS: Record<LowerLevel, readonly JlptQuestion[]> = {
  N5: N5_GENERATED_QUESTIONS,
  N4: N4_GENERATED_QUESTIONS,
  N3: N3_GENERATED_QUESTIONS,
};

function normalized(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\s「」『』【】、。！？：；・―—（）()]/gu, "");
}

describe("N5-N3 lower reading semantic seeds", () => {
  it.each(["N5", "N4", "N3"] as const)(
    "provides at least eight independent %s passages per supported family",
    (level) => {
      for (const family of EXPECTED_FAMILIES[level]) {
        const seeds = SEEDS[level].filter((seed) => seed.family === family);
        const passageIds = new Set(seeds.map((seed) => seed.passageId));
        const passageBodies = new Set(
          seeds.map((seed) => normalized(readingBody(seed))),
        );

        expect(
          seeds.length,
          `${level} ${family} scored questions`,
        ).toBeGreaterThanOrEqual(8);
        expect(
          passageIds.size,
          `${level} ${family} passage identities`,
        ).toBeGreaterThanOrEqual(8);
        expect(
          passageBodies.size,
          `${level} ${family} independent bodies`,
        ).toBeGreaterThanOrEqual(8);
        expect(
          new Set(seeds.map((seed) => seed.semanticFocus)).size,
          `${level} ${family} semantic foci`,
        ).toBe(seeds.length);
      }
    },
  );

  it("uses stable unique question IDs and non-human editorial labels", () => {
    expect(LOWER_READING_SEEDS).toHaveLength(86);
    expect(
      new Set(LOWER_READING_SEEDS.map((seed) => seed.semanticId)).size,
    ).toBe(LOWER_READING_SEEDS.length);

    for (const seed of LOWER_READING_SEEDS) {
      const familyToken =
        seed.family === "information-retrieval"
          ? "info"
          : seed.family.replace("reading-", "");
      expect(seed.semanticId, seed.semanticId).toMatch(
        new RegExp(`^${seed.level}-${familyToken}-[a-z0-9-]+$`),
      );
      expect(seed.passageId, seed.semanticId).toMatch(
        new RegExp(`^${seed.level}-[a-z0-9-]+$`),
      );
      expect(seed.passageQuestionIndex, seed.semanticId).toBeGreaterThanOrEqual(
        1,
      );
      expect(
        ["machine-validated", "sampled-ai-review"],
        seed.semanticId,
      ).toContain(seed.editorialStatus);
    }
  });

  it("keeps four unique options, one explicit key, and exact source evidence", () => {
    for (const seed of LOWER_READING_SEEDS) {
      expect(seed.options, seed.semanticId).toHaveLength(4);
      expect(new Set(seed.options).size, seed.semanticId).toBe(4);
      expect(seed.correctIndex, seed.semanticId).toBeGreaterThanOrEqual(0);
      expect(seed.correctIndex, seed.semanticId).toBeLessThan(4);
      expect(
        seed.options[seed.correctIndex].trim().length,
        seed.semanticId,
      ).toBeGreaterThan(0);
      expect(seed.explanation.trim().length, seed.semanticId).toBeGreaterThan(
        60,
      );
      expect(seed.evidence.length, seed.semanticId).toBeGreaterThan(0);

      const body = readingBody(seed);
      for (const evidence of seed.evidence) {
        expect(
          body.includes(evidence),
          `${seed.semanticId} is missing evidence: ${evidence}`,
        ).toBe(true);
      }
    }
  });

  it("clears the conservative release floors for each official size class", () => {
    for (const seed of LOWER_READING_SEEDS) {
      const minimum = LENGTH_FLOORS[seed.level][seed.family as LowerFamily];
      expect(
        minimum,
        `${seed.semanticId} has an unsupported family`,
      ).toBeDefined();
      const actual = lowerReadingCharacterCount(seed);
      expect
        .soft(actual, `${seed.semanticId} has ${actual} characters`)
        .toBeGreaterThanOrEqual(minimum ?? 0);
    }
  });

  it.each(["N5", "N4", "N3"] as const)(
    "keeps every audited %s mid passage in its conservative release band",
    (level) => {
      const passages = Map.groupBy(
        SEEDS[level].filter((seed) => seed.family === "reading-mid"),
        (seed) => seed.passageId,
      );
      expect([...passages.keys()].sort()).toEqual([...MID_PASSAGE_IDS[level]]);

      const { minimum, maximum } = MID_RELEASE_BANDS[level];
      for (const [passageId, seeds] of passages) {
        const actual = lowerReadingCharacterCount(seeds[0]);
        expect
          .soft(actual, `${passageId} has ${actual} characters`)
          .toBeGreaterThanOrEqual(minimum);
        expect
          .soft(actual, `${passageId} has ${actual} characters`)
          .toBeLessThanOrEqual(maximum);
      }
    },
  );

  it("pins every independently audited N3 mid/long distractor remediation", () => {
    expect(Object.keys(DISTRACTOR_REMEDIATION_REGRESSIONS)).toHaveLength(18);

    for (const [semanticId, expectedDistractor] of Object.entries(
      DISTRACTOR_REMEDIATION_REGRESSIONS,
    )) {
      const seed = N3_LOWER_READING_SEEDS.find(
        (candidate) => candidate.semanticId === semanticId,
      );
      expect(seed, semanticId).toBeDefined();
      expect(seed?.options, semanticId).toContain(expectedDistractor);
      expect(seed?.options[seed.correctIndex], semanticId).not.toBe(
        expectedDistractor,
      );
      for (const [index, option] of seed?.options.entries() ?? []) {
        if (index !== seed?.correctIndex)
          expect(
            option.length,
            `${semanticId} distractor ${index}`,
          ).toBeGreaterThanOrEqual(15);
      }
    }
  });

  it("gives information-retrieval items structured, multi-constraint source material", () => {
    const seeds = LOWER_READING_SEEDS.filter(
      (seed) => seed.family === "information-retrieval",
    );
    for (const seed of seeds) {
      const body = seed.sources[0].body;
      expect(body.split("\n").length, seed.semanticId).toBeGreaterThanOrEqual(
        4,
      );
      expect(body, seed.semanticId).toMatch(/[0-9０-９]|円|時|曜日|月|日/u);
      expect(seed.question.trim().length, seed.semanticId).toBeGreaterThan(12);
    }
  });

  it("models representative shared sources as ordered question groups without duplicating their bodies", () => {
    for (const level of ["N5", "N4", "N3"] as const) {
      const grouped = Map.groupBy(SEEDS[level], (seed) => seed.passageId);
      const sharedGroups = [...grouped.values()].filter(
        (seeds) => seeds.length > 1,
      );
      expect(
        sharedGroups.length,
        `${level} shared groups`,
      ).toBeGreaterThanOrEqual(1);

      for (const seeds of sharedGroups) {
        expect(seeds, seeds[0].passageId).toHaveLength(2);
        expect(seeds[0].sources, seeds[0].passageId).toBe(seeds[1].sources);
        expect(seeds.map((seed) => seed.passageQuestionIndex).sort()).toEqual([
          1, 2,
        ]);
        expect(new Set(seeds.map(readingBody)).size).toBe(1);
      }
    }
  });

  it("contains no blank templates or claims of copied official content", () => {
    for (const seed of LOWER_READING_SEEDS) {
      const serialized = JSON.stringify(seed);
      expect(serialized, seed.semanticId).not.toContain("＿＿");
      expect(serialized, seed.semanticId).not.toContain("${");
      expect(serialized, seed.semanticId).not.toMatch(
        /公式問題|出典：.*JLPT|sample question/u,
      );
    }
  });

  it("preserves the independently audited content repairs", () => {
    const seed = (semanticId: string) => {
      const match = LOWER_READING_SEEDS.find(
        (candidate) => candidate.semanticId === semanticId,
      );
      expect(match, semanticId).toBeDefined();
      return match!;
    };

    expect(seed("N5-short-library-renewal-phone").sources[0].body).toContain(
      "かえす日をすぎた本",
    );
    expect(seed("N5-mid-wallet-found-process").sources[0].body).toContain(
      "そのさいふが見つかった",
    );
    expect(
      seed("N5-mid-wallet-found-process")
        .sources.map((source) => source.body)
        .join("\n"),
    ).toContain("電話で聞いたばんごう");
    expect(seed("N5-info-library-monday-return").question).toContain("月曜日");
    expect(
      seed("N5-info-restaurant-fish-free-lunch").sources[0].body,
    ).toContain("ツナサラダ");
    expect(seed("N5-info-restaurant-fish-free-lunch").explanation).toContain(
      "includes tuna salad",
    );
    expect(seed("N5-info-bicycle-three-hour-return").question).toContain(
      "どのコースをえらびますか",
    );
    expect(seed("N4-info-cooking-class-vegetarian").sources[0].body).toContain(
      "小麦とたまごとハム",
    );
    expect(seed("N4-short-project-file-and-paper").options).toContain(
      "しゃしんだけ",
    );
    expect(seed("N4-short-restaurant-late-arrival").options).toContain(
      "二十分おくれてから電話する",
    );
    expect(seed("N4-short-office-key-return").options).toContain("会議室の中");
    expect(seed("N4-short-train-lost-item-contact").options).toContain(
      "夜に見つかったか自分からメールする",
    );
    expect(seed("N4-info-volunteer-evening-books").question).toContain(
      "18さい以上",
    );
    expect(seed("N4-info-camping-two-night-rental").question).toContain(
      "二泊して",
    );
    expect(
      seed("N4-info-museum-family-pass")
        .sources.map((source) => source.body)
        .join("\n"),
    ).toContain("五人まで");
    expect(
      seed("N4-mid-neighborhood-cat-feeding")
        .sources.map((source) => source.body)
        .join("\n"),
    ).toContain("毎日同じように世話ができる");
    expect(
      seed("N4-mid-exchange-event-roles")
        .sources.map((source) => source.body)
        .join("\n"),
    ).toContain("全員の話す時間を同じ長さにするよりも");
    expect(seed("N3-short-lecture-seat-release").options[0]).toContain(
      "受付メールなどを見せる",
    );
    expect(seed("N3-short-lecture-seat-release").evidence).toContain(
      "受付メールの画面か、印刷した紙を見せてください",
    );
    expect(seed("N3-short-book-exchange-condition").question).toContain(
      "ほしい本が見つからなかった人",
    );
    expect(seed("N3-info-festival-volunteer-shifts").sources[0].body).toContain(
      "8:00〜12:00／12:00〜16:00",
    );
    expect(seed("N3-info-coworking-evening-room").question).toContain(
      "来週の火曜日",
    );
    expect(seed("N3-info-adult-course-path").question).toContain(
      "初めて受講する中級の人",
    );
  });

  it.each(["N5", "N4", "N3"] as const)(
    "wires all %s lower-reading items into the generated bank",
    (level) => {
      for (const family of EXPECTED_FAMILIES[level]) {
        const generated = BANKS[level].filter(
          (question) => question.officialType === family,
        );
        const seeds = SEEDS[level].filter((seed) => seed.family === family);
        expect(generated, `${level} ${family}`).toHaveLength(200);
        expect(
          new Set(generated.map((question) => question.provenance?.semanticKey))
            .size,
        ).toBe(seeds.length);
        expect(
          new Set(generated.map((question) => question.passage?.body)).size,
        ).toBe(8);

        for (const seed of seeds) {
          const item = generated.find((question) =>
            question.provenance?.semanticKey.endsWith(seed.semanticId),
          );
          expect(item?.passage?.body, seed.semanticId).toBe(readingBody(seed));
          expect(item?.passage?.groupId, seed.semanticId).toBe(
            `${level}:${seed.passageId}:variant-0`,
          );
          expect(item?.passage?.groupQuestionIndex, seed.semanticId).toBe(
            seed.passageQuestionIndex,
          );
          expect(item?.provenance?.editorialStatus, seed.semanticId).toBe(
            seed.editorialStatus,
          );
          expect(item?.stem, seed.semanticId).toBe(seed.question);
          expect(
            item?.options.map((option) => option.label),
            seed.semanticId,
          ).toContain(seed.options[seed.correctIndex]);
        }
      }
    },
  );
});
