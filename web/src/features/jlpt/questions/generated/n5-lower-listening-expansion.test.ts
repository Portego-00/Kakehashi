import { describe, expect, it } from "vitest";
import {
  BASE_LOWER_LISTENING_SEEDS,
  type LowerListeningFamily,
} from "./lower-listening-seeds";
import {
  N5_LOWER_LISTENING_EXPANSION,
  N5_LOWER_LISTENING_EXPANSION_EDITORIAL_STATUS,
} from "./n5-lower-listening-expansion";

const FAMILY_COUNTS = {
  "listening-task": 12,
  "listening-key-points": 12,
  "listening-quick-response": 12,
} as const satisfies Record<LowerListeningFamily, number>;

const TASK_AUDIT = {
  "N5-task-school-garden-name-cards": {
    construct: "role-assignment",
    correct: "花の名前をカードに書く",
    cues: [
      "たね",
      "土に入れました",
      "水",
      "田中さん",
      "ごみの袋",
      "先生が",
      "名前をカード",
    ],
  },
  "N5-task-breakfast-wash-strawberries": {
    construct: "current-task",
    correct: "いちごを洗う",
    cues: [
      "パン",
      "もうやけました",
      "牛乳",
      "わたしが",
      "テーブルにお皿",
      "あとで",
      "いちごを洗って",
    ],
  },
  "N5-task-pool-pay-before-locker": {
    construct: "prerequisite",
    correct: "お金をはらう",
    cues: [
      "水ぎ",
      "かばんにあります",
      "お金",
      "それから",
      "ロッカー",
      "シャワー",
    ],
  },
  "N5-task-rainy-sunday-library-plan": {
    construct: "changed-plan",
    correct: "図書館",
    cues: ["公園", "雨", "はくぶつかん", "休み", "図書館", "家で食べ"],
  },
  "N5-task-room-cleaning-boy-trash": {
    construct: "paired-role-mapping",
    correct: "ごみを外へ持っていく",
    cues: [
      "本をたな",
      "わたし",
      "いす",
      "お父さん",
      "テーブル",
      "あとで",
      "ごみを外へ",
    ],
  },
  "N5-task-art-class-crayons-apron": {
    construct: "required-pair",
    correct: "クレヨンとエプロン",
    cues: [
      "紙とのり",
      "学校にあります",
      "はさみ",
      "山田さん",
      "クレヨン",
      "エプロン",
      "自分で",
    ],
  },
  "N5-task-school-bus-second-service": {
    construct: "condition-resolved-route",
    correct: "二番のバスで行く",
    cues: [
      "一番のバス",
      "もう行きました",
      "歩くと四十分",
      "二番のバス",
      "九時まで",
      "タクシー",
      "おくれたら",
    ],
  },
  "N5-task-lunch-rice-ball-choice": {
    construct: "rejected-and-later-alternatives",
    correct: "おにぎり",
    cues: [
      "パン",
      "きのうも",
      "おにぎり",
      "くだもの",
      "おやつ",
      "お茶",
      "水とう",
    ],
  },
  "N5-task-post-office-close-box": {
    construct: "procedure-prerequisite",
    correct: "はこをテープでしめる",
    cues: [
      "名前とじゅうしょ",
      "書きました",
      "はこがあいて",
      "テープ",
      "重さをはか",
      "きって",
    ],
  },
  "N5-task-meeting-bookstore-entrance": {
    construct: "location-change",
    correct: "本屋の入口",
    cues: [
      "駅の入口",
      "人が多い",
      "きっさてん",
      "開いていません",
      "本屋の入口",
      "公園",
      "そのあと",
    ],
  },
  "N5-task-classroom-red-books-role": {
    construct: "material-role-mapping",
    correct: "赤い本",
    cues: [
      "青い本",
      "先生が",
      "赤い本",
      "あなたが",
      "プリント",
      "もうつくえ",
      "えんぴつ",
      "あとで",
    ],
  },
  "N5-task-kitchen-start-rice-cooker": {
    construct: "in-progress-sequence",
    correct: "ごはんのボタンをおす",
    cues: [
      "お米",
      "もう洗いました",
      "やさい",
      "あとで",
      "スープ",
      "わたしが",
      "ボタンをおして",
    ],
  },
} as const;

function compact(value: string) {
  return value.replace(/\s/gu, "");
}

describe("standalone N5 lower-listening expansion", () => {
  it("contains exactly twelve original semantic items in each requested family", () => {
    expect(N5_LOWER_LISTENING_EXPANSION).toHaveLength(36);
    for (const [family, count] of Object.entries(FAMILY_COUNTS)) {
      expect(
        N5_LOWER_LISTENING_EXPANSION.filter((seed) => seed.family === family),
        family,
      ).toHaveLength(count);
    }
  });

  it("uses globally new IDs, focuses, and scripts", () => {
    const ids = N5_LOWER_LISTENING_EXPANSION.map((seed) => seed.semanticId);
    const focuses = N5_LOWER_LISTENING_EXPANSION.map(
      (seed) => seed.semanticFocus,
    );
    const scripts = N5_LOWER_LISTENING_EXPANSION.map((seed) =>
      compact(seed.script),
    );
    expect(new Set(ids).size).toBe(36);
    expect(new Set(focuses).size).toBe(36);
    expect(new Set(scripts).size).toBe(36);

    const existingIds = new Set(
      BASE_LOWER_LISTENING_SEEDS.map((seed) => seed.semanticId),
    );
    const existingFocuses = new Set(
      BASE_LOWER_LISTENING_SEEDS.map((seed) => seed.semanticFocus),
    );
    const existingScripts = new Set(
      BASE_LOWER_LISTENING_SEEDS.map((seed) => compact(seed.script)),
    );
    for (const seed of N5_LOWER_LISTENING_EXPANSION) {
      const familyToken =
        seed.family === "listening-task"
          ? "task"
          : seed.family === "listening-key-points"
            ? "key"
            : "quick";
      expect(seed.semanticId, seed.semanticId).toMatch(
        new RegExp(`^N5-${familyToken}-[a-z0-9-]+$`),
      );
      expect(existingIds, seed.semanticId).not.toContain(seed.semanticId);
      expect(existingFocuses, seed.semanticId).not.toContain(
        seed.semanticFocus,
      );
      expect(existingScripts, seed.semanticId).not.toContain(
        compact(seed.script),
      );
    }
  });

  it("keeps machine validation explicit without claiming editorial approval", () => {
    expect(N5_LOWER_LISTENING_EXPANSION_EDITORIAL_STATUS).toBe(
      "machine-validated",
    );
  });

  it("matches the official printed and audio-only response mechanics", () => {
    for (const seed of N5_LOWER_LISTENING_EXPANSION) {
      expect(new Set(seed.options).size, seed.semanticId).toBe(
        seed.options.length,
      );
      expect(seed.correctIndex, seed.semanticId).toBeGreaterThanOrEqual(0);
      expect(seed.correctIndex, seed.semanticId).toBeLessThan(
        seed.options.length,
      );

      if (seed.family === "listening-quick-response") {
        expect(seed.options, seed.semanticId).toHaveLength(3);
        expect(seed.question, seed.semanticId).toBe(
          "最も適切な応答を選んでください。",
        );
        expect(seed.questionTiming, seed.semanticId).toBe("prompt-only");
        expect(seed.audioOnlyOptions, seed.semanticId).toBe(true);
      } else {
        expect(seed.options, seed.semanticId).toHaveLength(4);
        expect(seed.questionTiming, seed.semanticId).toBe("before-stimulus");
        expect(seed.audioOnlyOptions, seed.semanticId).toBe(false);
      }
    }
  });

  it("grounds every printed task alternative in the heard plan and varies the tested operation", () => {
    const tasks = N5_LOWER_LISTENING_EXPANSION.filter(
      (seed) => seed.family === "listening-task",
    );
    expect(tasks.map((seed) => seed.semanticId).sort()).toEqual(
      Object.keys(TASK_AUDIT).sort(),
    );
    expect(
      new Set(Object.values(TASK_AUDIT).map((item) => item.construct)).size,
    ).toBeGreaterThanOrEqual(9);
    expect(
      tasks.filter((seed) =>
        /まず|最初/u.test(`${seed.question}\n${seed.script}`),
      ),
    ).toHaveLength(0);

    for (const seed of tasks) {
      const audit = TASK_AUDIT[seed.semanticId as keyof typeof TASK_AUDIT];
      expect(seed.options[seed.correctIndex], seed.semanticId).toBe(
        audit.correct,
      );
      for (const cue of audit.cues)
        expect(seed.script, `${seed.semanticId}: ${cue}`).toContain(cue);
    }
  });

  it("keeps key-point targets available before one short selective-listening stimulus", () => {
    const keys = N5_LOWER_LISTENING_EXPANSION.filter(
      (seed) => seed.family === "listening-key-points",
    );
    for (const seed of keys) {
      expect(seed.question, seed.semanticId).toMatch(
        /何時|何曜日|何ページ|何色|いくら|どこ|いくつ|何番|何日|だれ|何を|何かい/u,
      );
      expect(seed.script, seed.semanticId).toMatch(/：/u);
      expect(seed.questionTiming, seed.semanticId).toBe("before-stimulus");
    }
  });

  it("keeps N5 stimuli short, concrete, and within conservative authored guardrails", () => {
    for (const seed of N5_LOWER_LISTENING_EXPANSION) {
      const scriptLength = compact(seed.script).length;
      const [minimum, maximum] =
        seed.family === "listening-task"
          ? [90, 220]
          : seed.family === "listening-key-points"
            ? [55, 160]
            : [10, 50];
      expect
        .soft(scriptLength, `${seed.semanticId} script length`)
        .toBeGreaterThanOrEqual(minimum);
      expect
        .soft(scriptLength, `${seed.semanticId} script length`)
        .toBeLessThanOrEqual(maximum);
      expect(seed.question.length, seed.semanticId).toBeLessThanOrEqual(45);
      expect(seed.explanation.length, seed.semanticId).toBeGreaterThanOrEqual(
        75,
      );
      expect(
        [seed.script, seed.question, ...seed.options].join("\n"),
        seed.semanticId,
      ).not.toMatch(/\$\{|TODO|TBD|公式問題|出典/u);
      expect(
        seed.options.every((option) => /[ぁ-んァ-ヶ一-龠]/u.test(option)),
        seed.semanticId,
      ).toBe(true);
    }
  });

  it("keeps quick responses short, spoken, distinct, and pragmatically targeted", () => {
    const quick = N5_LOWER_LISTENING_EXPANSION.filter(
      (seed) => seed.family === "listening-quick-response",
    );
    for (const seed of quick) {
      expect(seed.script, seed.semanticId).not.toMatch(/：/u);
      expect(seed.options, seed.semanticId).toHaveLength(3);
      expect(
        seed.options.every((option) => option.length <= 28),
        seed.semanticId,
      ).toBe(true);
      expect(seed.explanation, seed.semanticId).toMatch(
        /reply|response|asks|request|offer|apolog|thanks|comment|permission/iu,
      );
    }
  });

  it("pins the independent editorial re-audit repairs", () => {
    const seed = (semanticId: string) => {
      const match = N5_LOWER_LISTENING_EXPANSION.find(
        (candidate) => candidate.semanticId === semanticId,
      );
      expect(match, semanticId).toBeDefined();
      return match!;
    };

    expect(seed("N5-task-rainy-sunday-library-plan").options).toContain("家");
    expect(seed("N5-task-rainy-sunday-library-plan").options).not.toContain(
      "男の人の家",
    );
    expect(seed("N5-key-found-umbrella-color").script).toContain(
      "カードがついています",
    );
    expect(seed("N5-key-homework-page-number").script).toContain(
      "日記のしゅくだい",
    );
    expect(seed("N5-key-homework-page-number").script).not.toContain(
      "宿題は十四ページです",
    );
    expect(seed("N5-key-hospital-meeting-bench").script).toContain(
      "薬局ではなく",
    );
    expect(seed("N5-key-hospital-meeting-bench").options).toContain("薬局");
    expect(seed("N5-quick-apology-for-lateness").options).toContain(
      "十分前に駅を出ました",
    );
    expect(seed("N5-quick-lunch-invitation").options).toContain(
      "昼ごはんは食堂で買えます",
    );
  });
});
