import { describe, expect, it } from "vitest";
import {
  BASE_UPPER_LISTENING_SEEDS,
  type UpperListeningFamily,
} from "./upper-listening-seeds";
import {
  N3_UPPER_LISTENING_EXPANSION,
  N3_UPPER_LISTENING_EXPANSION_EDITORIAL_STATUS,
} from "./n3-upper-listening-expansion";

const FAMILY_COUNTS = {
  "listening-task": 8,
  "listening-key-points": 8,
  "listening-outline": 8,
  "listening-quick-response": 8,
} as const satisfies Partial<Record<UpperListeningFamily, number>>;

const TASK_CUE_AUDIT = {
  "N3-task-market-flyer-final-check": {
    construct: "revision-before-approval",
    correct: "雨の場合の開催日を直す",
    optionCues: [
      "店の人へ電話",
      "雨の場合の開催日",
      "印刷会社へ送って",
      "地図は直しました",
    ],
    contextCues: ["確認できたら"],
  },
  "N3-task-apartment-repair-morning-window": {
    construct: "multi-constraint-schedule",
    correct: "土曜日の九時から十一時、家で待つ",
    optionCues: [
      "木曜日の午後",
      "土曜日の九時から十一時",
      "十二時から建物の入口が工事",
      "部品は担当者が持って",
    ],
    contextCues: ["会社にいます"],
  },
  "N3-task-meeting-chart-source-note": {
    construct: "role-and-completion-mapping",
    correct: "情報の出どころを書く",
    optionCues: [
      "数字は山田さん",
      "色は部長",
      "情報の出どころ",
      "資料運びは山田さん",
    ],
    contextCues: ["私が入れます", "印刷するのは私"],
  },
  "N3-task-station-lost-phone-web-form": {
    construct: "failed-action-next-step",
    correct: "電車と時間をウェブで知らせる",
    optionCues: [
      "携帯の番号にはかけてみましたか",
      "箱や説明書は家",
      "乗った電車と時間",
      "メールで知らせ",
    ],
    contextCues: ["電源が切れて", "見つかったあと", "ウェブフォーム"],
  },
  "N3-task-cooking-event-soup-role": {
    construct: "unassigned-role-selection",
    correct: "乳製品を使わないスープを作る",
    optionCues: [
      "カレーは佐藤さん",
      "サラダは私",
      "野菜を店で買って",
      "スープを作る人",
    ],
    contextCues: ["牛乳は使わないで", "僕が野菜のスープを作ります"],
  },
  "N3-task-library-projector-reservation": {
    construct: "required-resource-with-fallback",
    correct: "受付でプロジェクターを申し込む",
    optionCues: [
      "部屋はもう予約",
      "資料も三十枚印刷",
      "受付で申し込んで",
      "二階の部屋",
    ],
    contextCues: ["プロジェクターも予約", "空いていなければ"],
  },
  "N3-task-club-rain-indoor-training": {
    construct: "changed-plan-and-venue",
    correct: "多目的室でストレッチをする",
    optionCues: [
      "外のランニングをやめ",
      "体育館はバスケットボール部",
      "多目的室でストレッチ",
      "筋力トレーニングは先生がいる金曜日",
    ],
    contextCues: ["雨は強くなる"],
  },
  "N3-task-parcel-return-convenience-store": {
    construct: "constraint-resolved-return-channel",
    correct: "コンビニから箱を送る",
    optionCues: [
      "平日の昼",
      "店では受け取れません",
      "コンビニから送る",
      "返品の紙を入れて",
    ],
    contextCues: ["仕事でいません"],
  },
} as const;

const OUTLINE_INTENT_AUDIT = {
  "N3-outline-lunch-container-return-trial": {
    correct: "容器のごみを減らすための返却制度の試み",
    cues: ["毎日たくさんの容器", "一階にも返す箱", "まず二か月"],
  },
  "N3-outline-neighborhood-news-two-formats": {
    correct: "紙を残しながら携帯でも知らせること",
    cues: ["紙で各家に配って", "携帯電話でも", "紙をなくすわけでは"],
  },
  "N3-outline-shop-closing-time-trial": {
    correct: "客の多い曜日に合わせて営業時間を試しに変える",
    cues: ["客がほとんど来ません", "金曜日は", "一か月の売り上げ"],
  },
  "N3-outline-museum-touch-models": {
    correct: "本物を守りながら模型で理解を助ける工夫",
    cues: ["壊れやすいため", "模型を作り", "具体的に理解"],
  },
  "N3-outline-study-error-notebook": {
    correct: "間違えた理由を知って次の学習に生かすこと",
    cues: ["正しい答えだけ", "理由も短く書いて", "次に注意"],
  },
  "N3-outline-park-shade-observation": {
    correct: "利用の様子を調べてベンチの場所を決めたこと",
    cues: ["入口は午後ずっと日", "一週間", "木の下に二つ"],
  },
  "N3-outline-bakery-reservation-balance": {
    correct: "予約を参考にしながら当日の客にも用意する工夫",
    cues: ["パンが残る日", "予約できるよう", "急に店へ来る人"],
  },
  "N3-outline-reading-group-viewpoints": {
    correct: "登場人物ごとの見方を考えて比べさせた",
    cues: ["正しい答えを探して", "別の登場人物", "グループの意見を比べる"],
  },
} as const;

const QUICK_REPLY_AUDIT = {
  "N3-quick-dinner-date-alternative": "金曜は無理だけど、土曜なら行けるよ。",
  "N3-quick-document-review-tomorrow":
    "今日は難しいですが、明日の朝なら見られます。",
  "N3-quick-homemade-soup-compliment":
    "ありがとうございます。時間をかけて煮たんです。",
  "N3-quick-forgot-form-submission":
    "すみません、忘れました。明日の朝、必ず持ってきます。",
  "N3-quick-wrong-extension-call":
    "失礼しました。人事につないでいただけますか。",
  "N3-quick-offer-group-photo": "ありがとうございます。では、お願いします。",
  "N3-quick-crowded-train-warning": "そうですか。では、その次の電車にします。",
  "N3-quick-colleague-leaving-early":
    "分かりました。急ぎの連絡があれば、伝えておきます。",
} as const;

function normalized(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\s「」『』【】、。！？：；・―—（）()]/gu, "");
}

describe("standalone N3 upper-listening expansion", () => {
  it("contains exactly eight original semantic items in every requested family", () => {
    expect(N3_UPPER_LISTENING_EXPANSION).toHaveLength(32);
    for (const [family, count] of Object.entries(FAMILY_COUNTS)) {
      expect(
        N3_UPPER_LISTENING_EXPANSION.filter((seed) => seed.family === family),
        family,
      ).toHaveLength(count);
    }
  });

  it("owns unique IDs, focuses, and normalized scripts without colliding with the baseline", () => {
    const ids = N3_UPPER_LISTENING_EXPANSION.map((seed) => seed.semanticId);
    const focuses = N3_UPPER_LISTENING_EXPANSION.map(
      (seed) => seed.semanticFocus,
    );
    const scripts = N3_UPPER_LISTENING_EXPANSION.map((seed) =>
      normalized(seed.script),
    );
    expect(new Set(ids).size).toBe(32);
    expect(new Set(focuses).size).toBe(32);
    expect(new Set(scripts).size).toBe(32);

    const existingIds = new Set(
      BASE_UPPER_LISTENING_SEEDS.map((seed) => seed.semanticId),
    );
    const existingFocuses = new Set(
      BASE_UPPER_LISTENING_SEEDS.map((seed) => seed.semanticFocus),
    );
    const existingScripts = new Set(
      BASE_UPPER_LISTENING_SEEDS.map((seed) => normalized(seed.script)),
    );
    for (const seed of N3_UPPER_LISTENING_EXPANSION) {
      const familyToken = seed.family
        .replace("listening-key-points", "key")
        .replace("listening-quick-response", "quick")
        .replace("listening-", "");
      expect(seed.semanticId, seed.semanticId).toMatch(
        new RegExp(`^N3-${familyToken}-[a-z0-9-]+$`),
      );
      expect(existingIds, seed.semanticId).not.toContain(seed.semanticId);
      expect(existingFocuses, seed.semanticId).not.toContain(
        seed.semanticFocus,
      );
      expect(existingScripts, seed.semanticId).not.toContain(
        normalized(seed.script),
      );
    }
  });

  it("records machine validation without claiming human or independent approval", () => {
    expect(N3_UPPER_LISTENING_EXPANSION_EDITORIAL_STATUS).toBe(
      "machine-validated",
    );
  });

  it("encodes the family-specific printed and audio-only mechanics", () => {
    for (const seed of N3_UPPER_LISTENING_EXPANSION) {
      expect(new Set(seed.options).size, seed.semanticId).toBe(
        seed.options.length,
      );
      expect(seed.correctIndex, seed.semanticId).toBeGreaterThanOrEqual(0);
      expect(seed.correctIndex, seed.semanticId).toBeLessThan(
        seed.options.length,
      );
      expect(seed.sourceCount, seed.semanticId).toBeUndefined();

      if (
        seed.family === "listening-task" ||
        seed.family === "listening-key-points"
      ) {
        expect(seed.options, seed.semanticId).toHaveLength(4);
        expect(seed.questionTiming, seed.semanticId).toBe("before-stimulus");
        expect(seed.audioOnlyOptions, seed.semanticId).toBe(false);
      } else if (seed.family === "listening-outline") {
        expect(seed.options, seed.semanticId).toHaveLength(4);
        expect(seed.questionTiming, seed.semanticId).toBe("after-stimulus");
        expect(seed.audioOnlyOptions, seed.semanticId).toBe(true);
      } else {
        expect(seed.options, seed.semanticId).toHaveLength(3);
        expect(seed.question, seed.semanticId).toBe(
          "最も適切な応答を選んでください。",
        );
        expect(seed.questionTiming, seed.semanticId).toBe("prompt-only");
        expect(seed.audioOnlyOptions, seed.semanticId).toBe(true);
      }
    }
  });

  it("pins every task's grounded alternatives and varied decision operation", () => {
    const tasks = N3_UPPER_LISTENING_EXPANSION.filter(
      (seed) => seed.family === "listening-task",
    );
    expect(tasks.map((seed) => seed.semanticId).sort()).toEqual(
      Object.keys(TASK_CUE_AUDIT).sort(),
    );
    expect(
      new Set(Object.values(TASK_CUE_AUDIT).map((item) => item.construct)).size,
    ).toBe(8);
    expect(
      tasks.filter((seed) =>
        /まず|最初/u.test(`${seed.question}\n${seed.script}`),
      ).length,
    ).toBeLessThan(tasks.length / 2);

    for (const seed of tasks) {
      const audit =
        TASK_CUE_AUDIT[seed.semanticId as keyof typeof TASK_CUE_AUDIT];
      expect(seed.options[seed.correctIndex], seed.semanticId).toBe(
        audit.correct,
      );
      expect(audit.optionCues, seed.semanticId).toHaveLength(
        seed.options.length,
      );
      for (const cue of audit.optionCues)
        expect(seed.script, `${seed.semanticId}: ${cue}`).toContain(cue);
      for (const cue of audit.contextCues)
        expect(seed.script, `${seed.semanticId}: ${cue}`).toContain(cue);
    }
  });

  it("keeps key-point items selective and their targets available before the stimulus", () => {
    const keys = N3_UPPER_LISTENING_EXPANSION.filter(
      (seed) => seed.family === "listening-key-points",
    );
    for (const seed of keys) {
      expect(seed.question, seed.semanticId).toMatch(
        /なぜ|何曜日|何が問題|一番の理由|どこ|どんな|どの仕事/u,
      );
      expect(seed.questionTiming, seed.semanticId).toBe("before-stimulus");
      expect(seed.audioOnlyOptions, seed.semanticId).toBe(false);
      expect(
        seed.script.match(/[男女]：/gu)?.length ?? 0,
        seed.semanticId,
      ).toBeGreaterThanOrEqual(2);
    }
  });

  it("makes every outline item depend on the whole speaker intent or summary", () => {
    const outlines = N3_UPPER_LISTENING_EXPANSION.filter(
      (seed) => seed.family === "listening-outline",
    );
    expect(outlines.map((seed) => seed.semanticId)).toEqual(
      Object.keys(OUTLINE_INTENT_AUDIT),
    );
    for (const seed of outlines) {
      const audit =
        OUTLINE_INTENT_AUDIT[
          seed.semanticId as keyof typeof OUTLINE_INTENT_AUDIT
        ];
      expect(seed.options[seed.correctIndex], seed.semanticId).toBe(
        audit.correct,
      );
      for (const cue of audit.cues)
        expect(seed.script, `${seed.semanticId}: ${cue}`).toContain(cue);
      expect(seed.question, seed.semanticId).toMatch(
        /中心|説明している|最も伝えたい|内容として|大切|工夫/u,
      );
      expect(seed.script, seed.semanticId).toMatch(
        /しかし|でも|そこで|すると|ただし|一方|ため|その結果|ではなく/u,
      );
      expect(
        seed.script.split("。").filter(Boolean).length,
        seed.semanticId,
      ).toBeGreaterThanOrEqual(5);
      expect(
        seed.options[seed.correctIndex].length,
        seed.semanticId,
      ).toBeGreaterThanOrEqual(14);
    }
  });

  it("stays inside conservative N3 length and discourse guardrails", () => {
    for (const seed of N3_UPPER_LISTENING_EXPANSION) {
      const length = seed.script.replace(/\s/gu, "").length;
      const [minimum, maximum] =
        seed.family === "listening-task"
          ? [140, 300]
          : seed.family === "listening-key-points"
            ? [105, 240]
            : seed.family === "listening-outline"
              ? [165, 330]
              : [12, 60];
      expect
        .soft(length, `${seed.semanticId} script length ${length}`)
        .toBeGreaterThanOrEqual(minimum);
      expect
        .soft(length, `${seed.semanticId} script length ${length}`)
        .toBeLessThanOrEqual(maximum);
      expect(seed.question.length, seed.semanticId).toBeLessThanOrEqual(52);
      expect(seed.explanation.length, seed.semanticId).toBeGreaterThanOrEqual(
        85,
      );
      expect(
        seed.options.every((option) => /[ぁ-んァ-ヶ一-龠]/u.test(option)),
        seed.semanticId,
      ).toBe(true);
    }
  });

  it("keeps quick responses prompt-only with one direct pragmatic repair or uptake", () => {
    const quick = N3_UPPER_LISTENING_EXPANSION.filter(
      (seed) => seed.family === "listening-quick-response",
    );
    expect(quick.map((seed) => seed.semanticId).sort()).toEqual(
      Object.keys(QUICK_REPLY_AUDIT).sort(),
    );
    for (const seed of quick) {
      const correct =
        QUICK_REPLY_AUDIT[seed.semanticId as keyof typeof QUICK_REPLY_AUDIT];
      expect(seed.options[seed.correctIndex], seed.semanticId).toBe(correct);
      expect(seed.script, seed.semanticId).not.toMatch(/：/u);
      expect(seed.options, seed.semanticId).toHaveLength(3);
      expect(
        seed.options.every((option) => option.length <= 45),
        seed.semanticId,
      ).toBe(true);
      expect(seed.explanation, seed.semanticId).toMatch(
        /reply|response|request|invitation|compliment|offer|obligation|caller|warning|departure/iu,
      );
    }
    expect(new Set(quick.map((seed) => seed.correctIndex)).size).toBe(3);
    expect(quick.flatMap((seed) => seed.options).join("\n")).not.toMatch(
      /今日中の資料を見てもらいました|申し込みの紙は今日まででしたか|昨日、その紙をもらう予定です|イベントは駅で開きました|病院は三時に帰りました/u,
    );
  });

  it("excludes placeholders and known regression red flags", () => {
    const serialized = JSON.stringify(N3_UPPER_LISTENING_EXPANSION);
    expect(serialized).not.toMatch(
      /\$\{|TODO|TBD|公式問題|出典：.*JLPT|sample question/iu,
    );
    expect(serialized).not.toMatch(
      /一人で運ぶにはちょっと重い|昨日の発表、どうだった|どなたか座っていますか/u,
    );
    expect(serialized).not.toMatch(
      /図書館で本です|こちらこそ、借りてください|あしたがあります/u,
    );
  });
});
