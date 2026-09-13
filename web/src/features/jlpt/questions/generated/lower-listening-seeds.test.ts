import { describe, expect, it } from "vitest";
import type { JlptQuestion } from "../../types";
import { N4_GENERATED_QUESTIONS } from "./n4.generated";
import { N5_GENERATED_QUESTIONS } from "./n5.generated";
import {
  lowerListeningSeeds,
  type LowerListeningFamily,
  type LowerListeningLevel,
  type LowerListeningSeed,
} from "./lower-listening-seeds";

const GENERATED_BANKS: Record<LowerListeningLevel, readonly JlptQuestion[]> = {
  N5: N5_GENERATED_QUESTIONS,
  N4: N4_GENERATED_QUESTIONS,
};

const REQUIRED_FAMILIES = [
  "listening-task",
  "listening-key-points",
  "listening-quick-response",
] as const satisfies readonly LowerListeningFamily[];

const EXPECTED_SEEDS_PER_FAMILY: Record<LowerListeningFamily, number> = {
  "listening-task": 20,
  "listening-key-points": 20,
  "listening-quick-response": 22,
};

const PRESENTATION: Record<
  LowerListeningFamily,
  Pick<LowerListeningSeed, "questionTiming" | "audioOnlyOptions"> & {
    optionCount: number;
  }
> = {
  "listening-task": {
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
    optionCount: 4,
  },
  "listening-key-points": {
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
    optionCount: 4,
  },
  "listening-quick-response": {
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
    optionCount: 3,
  },
};

function withoutSpacing(value: string) {
  return value.replace(/\s/gu, "");
}

const TASK_REMEDIATION_EXPECTATIONS = {
  "N5-task-supermarket-shopping-list": {
    construct: "assigned-item",
    correct: "牛乳",
    cues: ["牛乳", "パン", "たまご", "水", "わたしが買います"],
  },
  "N5-task-classroom-teacher-notebook": {
    construct: "next-preparation",
    correct: "ノートをかばんから出す",
    cues: ["教科書", "ノート", "えんぴつ", "宿題", "あとで", "出したら"],
  },
  "N5-task-library-return-before-borrowing": {
    construct: "required-prerequisite",
    correct: "前の本を返す",
    cues: [
      "新しい本",
      "前の本",
      "かばん",
      "カード",
      "家に帰らないで",
      "そのあと",
    ],
  },
  "N5-task-station-ticket-before-platform": {
    construct: "condition-resolved-next-action",
    correct: "きっぷを買う",
    cues: [
      "きっぷ",
      "カードは家",
      "きかい",
      "駅の人",
      "二番のホーム",
      "分かります",
    ],
  },
  "N5-task-park-cleanup-trash-first": {
    construct: "role-and-order",
    correct: "ごみをひろう",
    cues: ["ごみ", "花に水", "落ち葉", "袋", "わたしがそうじ", "あとで"],
  },
  "N5-task-dinner-wash-hands-first": {
    construct: "changed-priority",
    correct: "手を洗う",
    cues: [
      "ごはん",
      "お皿",
      "手",
      "食べたあと",
      "わたしが持っていきます",
      "から",
    ],
  },
  "N5-task-clinic-write-name-first": {
    construct: "before-named-step",
    correct: "紙に名前を書く",
    cues: ["名前", "紙", "カード", "受付", "いす", "それから"],
  },
  "N5-task-rainy-trip-pack-umbrella": {
    construct: "role-assignment",
    correct: "かさ",
    cues: ["かさ", "おべんとう", "水", "地図", "わたしが", "山田さん", "もう"],
  },
  "N4-task-delivery-choose-new-time": {
    construct: "constraint-resolved-plan",
    correct: "ウェブで土曜日の配達を選ぶ",
    cues: [
      "センター",
      "六時",
      "ウェブ",
      "平日の午後",
      "土曜日",
      "電話する必要はありません",
    ],
  },
  "N4-task-community-class-form-first": {
    construct: "next-registration-step",
    correct: "機械で参加費を払う",
    cues: ["書きました", "参加費", "レシート", "受付", "教室", "そのあと"],
  },
  "N4-task-office-poster-manager-check": {
    construct: "conditional-approval",
    correct: "部長にポスターをメールで送る",
    cues: [
      "三十枚",
      "部長",
      "メール",
      "今日",
      "明日",
      "日にちは自分で変えない",
    ],
  },
  "N4-task-bicycle-call-repair-shop": {
    construct: "condition-before-transport",
    correct: "修理の店に電話する",
    cues: [
      "乗らないで",
      "チェーン",
      "店に",
      "今日直せる",
      "車",
      "番号を調べます",
    ],
  },
  "N4-task-cooking-preheat-oven": {
    construct: "in-progress-sequence",
    correct: "たまごと牛乳をまぜる",
    cues: [
      "オーブン",
      "つけました",
      "たまごと牛乳",
      "小麦粉",
      "ケーキを切る",
      "冷めてから",
    ],
  },
  "N4-task-hotel-return-key-before-luggage": {
    construct: "combined-preparation",
    correct: "かぎと荷物",
    cues: ["駅のロッカー", "かぎ", "荷物", "いっしょ", "預かりカード", "夕方"],
  },
  "N4-task-school-trip-select-photos": {
    construct: "criteria-based-choice",
    correct: "みんなの写真と昼ごはんの写真",
    cues: [
      "みんなが写っている",
      "昼ごはん",
      "バス",
      "ホテル",
      "顔がよく見えません",
      "暗い",
    ],
  },
  "N4-task-laundry-check-pockets": {
    construct: "split-destination",
    correct: "かぎはかばんに、百円玉は機械に入れる",
    cues: ["かぎ", "百円玉", "ポケット", "かばん", "服", "機械"],
  },
} as const;

describe("lower-level listening seed pack", () => {
  it("contains the exact independently authored count for every N5 and N4 family", () => {
    expect(lowerListeningSeeds).toHaveLength(124);

    for (const level of ["N5", "N4"] satisfies readonly LowerListeningLevel[]) {
      const levelSeeds = lowerListeningSeeds.filter(
        (seed) => seed.level === level,
      );
      expect(new Set(levelSeeds.map((seed) => seed.family)), level).toEqual(
        new Set(REQUIRED_FAMILIES),
      );

      for (const family of REQUIRED_FAMILIES) {
        expect(
          levelSeeds.filter((seed) => seed.family === family),
          `${level} ${family}`,
        ).toHaveLength(EXPECTED_SEEDS_PER_FAMILY[family]);
      }
    }
  });

  it("uses global semantic identities and nonduplicated authored scenarios", () => {
    const ids = lowerListeningSeeds.map((seed) => seed.semanticId);
    const focuses = lowerListeningSeeds.map((seed) => seed.semanticFocus);
    const scripts = lowerListeningSeeds.map((seed) =>
      withoutSpacing(seed.script),
    );

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(focuses).size).toBe(focuses.length);
    expect(new Set(scripts).size).toBe(scripts.length);

    for (const seed of lowerListeningSeeds) {
      const familyFragment = {
        "listening-task": "task",
        "listening-key-points": "key",
        "listening-quick-response": "quick",
      }[seed.family];
      expect(seed.semanticId).toMatch(
        new RegExp(`^${seed.level}-${familyFragment}-[a-z0-9-]+$`),
      );
      expect(
        seed.semanticFocus.trim().split(/\s+/u).length,
        seed.semanticId,
      ).toBeGreaterThanOrEqual(5);
    }
  });

  it("encodes printed pre-stimulus task/key choices and audio-only quick responses", () => {
    for (const seed of lowerListeningSeeds) {
      const expected = PRESENTATION[seed.family];
      expect(seed.questionTiming, seed.semanticId).toBe(
        expected.questionTiming,
      );
      expect(seed.audioOnlyOptions, seed.semanticId).toBe(
        expected.audioOnlyOptions,
      );
      expect(seed.options, seed.semanticId).toHaveLength(expected.optionCount);
      expect(new Set(seed.options).size, seed.semanticId).toBe(
        seed.options.length,
      );
      expect(seed.correctIndex, seed.semanticId).toBeGreaterThanOrEqual(0);
      expect(seed.correctIndex, seed.semanticId).toBeLessThan(
        seed.options.length,
      );

      if (seed.family === "listening-quick-response") {
        expect(seed.question, seed.semanticId).toBe(
          "最も適切な応答を選んでください。",
        );
      }
    }
  });

  it("keeps tasks action-based and key-point questions focused on a pre-announced fact", () => {
    for (const seed of lowerListeningSeeds) {
      if (seed.family === "listening-task") {
        expect(seed.question, seed.semanticId).toMatch(/何を|どの|どう|どこ/u);
        expect(seed.questionTiming, seed.semanticId).toBe("before-stimulus");
        expect(seed.audioOnlyOptions, seed.semanticId).toBe(false);
      }

      if (seed.family === "listening-key-points") {
        expect(seed.question, seed.semanticId).toMatch(
          /何|どの|どこ|いつ|だれ|いくつ|いくら/u,
        );
        expect(seed.questionTiming, seed.semanticId).toBe("before-stimulus");
        expect(seed.audioOnlyOptions, seed.semanticId).toBe(false);
      }
    }
  });

  it("protects all sixteen task remediations and their audible competing cues", () => {
    const tasks = lowerListeningSeeds.filter(
      (seed) =>
        seed.family === "listening-task" &&
        seed.semanticId in TASK_REMEDIATION_EXPECTATIONS,
    );
    expect(tasks.map((seed) => seed.semanticId).sort()).toEqual(
      Object.keys(TASK_REMEDIATION_EXPECTATIONS).sort(),
    );
    expect(
      new Set(
        Object.values(TASK_REMEDIATION_EXPECTATIONS).map(
          ({ construct }) => construct,
        ),
      ).size,
    ).toBeGreaterThanOrEqual(8);
    expect(
      tasks.filter((seed) =>
        /まず|最初/u.test(`${seed.question}\n${seed.script}`),
      ).length,
    ).toBeLessThan(tasks.length / 2);

    for (const seed of tasks) {
      const expected =
        TASK_REMEDIATION_EXPECTATIONS[
          seed.semanticId as keyof typeof TASK_REMEDIATION_EXPECTATIONS
        ];
      expect(expected, seed.semanticId).toBeDefined();
      expect(seed.options[seed.correctIndex], seed.semanticId).toBe(
        expected.correct,
      );
      expect(seed.options, seed.semanticId).toHaveLength(4);
      expect(new Set(seed.options).size, seed.semanticId).toBe(4);

      for (const cue of expected.cues) {
        expect(seed.script, `${seed.semanticId}: ${cue}`).toContain(cue);
      }
    }

    const allTaskOptions = tasks.flatMap((seed) => seed.options);
    const unsupportedOldOptions = [
      "ノートをかばんに入れる",
      "先生のいすを持ってくる",
      "かばんを買う",
      "駅の人に電話する",
      "公園から帰る",
      "花を買う",
      "ごはんを作る",
      "薬を飲む",
      "先生を呼ぶ",
      "紙に住所を書く",
      "電話で申し込む",
      "コピー機を直す",
      "牛乳を買いに行く",
      "新しい部屋を予約する",
      "旅行へ行く",
      "教室の写真を撮る",
      "新しい服を買う",
    ];
    for (const option of unsupportedOldOptions) {
      expect(allTaskOptions, option).not.toContain(option);
    }
  });

  it("contains complete Japanese stimuli, distinct candidates, and evidence-backed explanations", () => {
    for (const seed of lowerListeningSeeds) {
      expect(seed.script.trim().length, seed.semanticId).toBeGreaterThan(8);
      expect(seed.question.trim().length, seed.semanticId).toBeGreaterThan(5);
      expect(seed.explanation.trim().length, seed.semanticId).toBeGreaterThan(
        45,
      );
      expect(seed.script, seed.semanticId).toMatch(/[ぁ-んァ-ヶ一-龠]/u);
      expect(seed.question, seed.semanticId).toMatch(/[ぁ-んァ-ヶ一-龠]/u);
      expect(
        seed.options.every((option) => /[ぁ-んァ-ヶ一-龠〇]/u.test(option)),
        seed.semanticId,
      ).toBe(true);
      expect(
        [seed.script, seed.question, ...seed.options].join("\n"),
        seed.semanticId,
      ).not.toMatch(/\$\{|\{(?:person|place|day|time|count)\}|TODO|TBD/iu);
    }
  });

  it("does not use the previously identified malformed quick-response giveaways", () => {
    const quickResponseText = lowerListeningSeeds
      .filter((seed) => seed.family === "listening-quick-response")
      .flatMap((seed) => seed.options)
      .join("\n");

    expect(quickResponseText).not.toMatch(
      /図書館で本です|一杯を飲みましたか|あしたがあります|あした電話しました|明日の予約は昨日でした|こちらこそ、借りてください|今日は田中さんにしました/u,
    );
  });

  it("preserves the independently audited quick-response repairs", () => {
    const seed = (semanticId: string) => {
      const match = lowerListeningSeeds.find(
        (candidate) => candidate.semanticId === semanticId,
      );
      expect(match, semanticId).toBeDefined();
      return match!;
    };

    expect(seed("N5-quick-phone-number-request").options[0]).toBe(
      "はい、〇九〇の二三四五の六七八九です",
    );
    expect(seed("N5-quick-dessert-choice").script).toBe(
      "デザートはケーキとアイスがあります。どちらがいいですか。",
    );
    expect(seed("N5-quick-library-invitation").options).not.toContain(
      "もう図書館へ行きました",
    );
    expect(seed("N5-task-station-ticket-before-platform").script).toContain(
      "もう電車に乗れますか",
    );
    expect(seed("N5-quick-station-directions").explanation).toContain(
      "あの角を右に曲がってください",
    );
    expect(seed("N5-quick-return-time").explanation).not.toContain(
      "completed action",
    );
    expect(seed("N4-quick-copies-not-yet").options).not.toContain(
      "はい、三枚でした",
    );
    expect(seed("N4-quick-reschedule-reservation").options).not.toContain(
      "来週は水曜日が休みです",
    );
    expect(seed("N4-quick-submission-deadline").options).not.toContain(
      "はい、昨日出しました",
    );
    expect(seed("N4-quick-thanks-for-umbrella").explanation).toContain(
      "umbrella or weather",
    );

    expect(
      lowerListeningSeeds.map((candidate) => candidate.script).join("\n"),
    ).not.toMatch(/お茶をもう一杯、?いかがですか/u);
  });

  it("wires every semantic seed into its 200-record generated family", () => {
    for (const level of ["N5", "N4"] satisfies readonly LowerListeningLevel[]) {
      for (const familyName of REQUIRED_FAMILIES) {
        const family = GENERATED_BANKS[level].filter(
          (question) => question.officialType === familyName,
        );
        const seeds = lowerListeningSeeds.filter(
          (seed) => seed.level === level && seed.family === familyName,
        );

        expect(family, `${level} ${familyName}`).toHaveLength(200);
        expect(
          new Set(family.map((question) => question.provenance?.semanticKey))
            .size,
          `${level} ${familyName}`,
        ).toBe(EXPECTED_SEEDS_PER_FAMILY[familyName]);

        for (const seed of seeds) {
          const question = family.find(
            (candidate) =>
              candidate.provenance?.semanticKey ===
              `${level.toLowerCase()}:${familyName}:${seed.semanticId}`,
          );
          const keyedOption = question?.options.find(
            (option) => option.id === question.correctOptionId,
          );

          expect(question, seed.semanticId).toBeDefined();
          expect(question?.stem, seed.semanticId).toBe(seed.question);
          expect(question?.listening?.audioOnlyOptions, seed.semanticId).toBe(
            seed.audioOnlyOptions,
          );
          expect(question?.listening?.script, seed.semanticId).toContain(
            seed.script,
          );
          expect(question?.options, seed.semanticId).toHaveLength(
            seed.options.length,
          );
          expect(keyedOption?.label, seed.semanticId).toBe(
            seed.options[seed.correctIndex],
          );
        }
      }
    }
  });
});
