import { describe, expect, it } from "vitest";
import {
  BASE_LOWER_LISTENING_SEEDS,
  type LowerListeningFamily,
  type LowerListeningSeed,
} from "./lower-listening-seeds";
import { n4LowerListeningExpansion } from "./n4-lower-listening-expansion";

const EXPECTED_COUNTS: Record<LowerListeningFamily, number> = {
  "listening-task": 12,
  "listening-key-points": 12,
  "listening-quick-response": 12,
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

const TASK_OPTION_CUES: Record<
  string,
  readonly [string, string, string, string]
> = {
  "N4-task-pool-lost-member-card": [
    "カードをなくしたことを伝えて",
    "入口の機械で券を買う",
    "一日カードを受け取って",
    "新しいカードを取りに来る",
  ],
  "N4-task-office-handout-page-check": [
    "三ページの数字を確認して",
    "部長に新しい資料を送って",
    "二十部コピーします",
    "古い資料を送る",
  ],
  "N4-task-delayed-train-bus-route": [
    "電車を待ちますか",
    "空港までタクシーで行く",
    "空港行きのバスに乗れます",
    "自転車を借りる",
  ],
  "N4-task-pharmacy-prescription-procedure": [
    "処方せんをこの箱に入れて",
    "受付で保険のカードを見せます",
    "薬の説明を聞いた",
    "お金を払って",
  ],
  "N4-task-apartment-gas-inspection-preparation": [
    "入口に置いた箱を別の部屋へ運んで",
    "ガスの元を閉める",
    "窓も今は開けなくて",
    "テーブルの上の書類",
  ],
  "N4-task-festival-cup-shortage": [
    "ジュースを冷蔵庫に入れる",
    "氷は田中さんが運んで",
    "値段の紙を入口にはる",
    "紙コップを取りに行って",
  ],
  "N4-task-rental-bicycle-return-station": [
    "駅前の返却所へ返しますか",
    "公園の返却所",
    "自転車をここに置く",
    "店に電話しても、返却時間は変えられません",
  ],
  "N4-task-chilled-delivery-unpacking": [
    "チーズを冷蔵庫に入れて",
    "送り主に電話する",
    "空の箱をたたむ",
    "店の紙は、明日持っていくので捨てないで",
  ],
  "N4-task-dinner-fish-before-salad": [
    "サラダを作りますか",
    "魚を焼いて",
    "みそ汁は魚を焼いている間にわたしが作ります",
    "食器を並べる",
  ],
  "N4-task-library-damaged-book-desk": [
    "日本語の本は青い棚",
    "外国語の本は緑の棚",
    "雑誌は入口の台に置いて",
    "係の人の机へ持っていきます",
  ],
  "N4-task-restaurant-family-table-change": [
    "窓の近くは四人の席",
    "入口の近くなら六人の席",
    "二つの席に分かれる",
    "電話で人数をもう一度聞く",
  ],
  "N4-task-hike-raincoat-choice": [
    "昼ごはんは案内の人が用意",
    "地図はリーダーが持ちます",
    "水はもうかばんに入れました",
    "レインコートを用意します",
  ],
};

describe("N4 lower-listening expansion tranche", () => {
  it("contains exactly twelve independently authored items per requested family", () => {
    expect(n4LowerListeningExpansion).toHaveLength(36);

    for (const [family, count] of Object.entries(EXPECTED_COUNTS)) {
      expect(
        n4LowerListeningExpansion.filter((seed) => seed.family === family),
        family,
      ).toHaveLength(count);
    }
  });

  it("uses unique stable identities, focuses, scripts, and keyed choices", () => {
    const ids = n4LowerListeningExpansion.map((seed) => seed.semanticId);
    const focuses = n4LowerListeningExpansion.map((seed) => seed.semanticFocus);
    const scripts = n4LowerListeningExpansion.map((seed) =>
      withoutSpacing(seed.script),
    );

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(focuses).size).toBe(focuses.length);
    expect(new Set(scripts).size).toBe(scripts.length);

    for (const seed of n4LowerListeningExpansion) {
      const fragment = {
        "listening-task": "task",
        "listening-key-points": "key",
        "listening-quick-response": "quick",
      }[seed.family];
      expect(seed.level, seed.semanticId).toBe("N4");
      expect(seed.semanticId).toMatch(
        new RegExp(`^N4-${fragment}-[a-z0-9-]+$`),
      );
      expect(
        seed.semanticFocus.trim().split(/\s+/u).length,
        seed.semanticId,
      ).toBeGreaterThanOrEqual(6);
      expect(new Set(seed.options).size, seed.semanticId).toBe(
        seed.options.length,
      );
      expect(seed.correctIndex, seed.semanticId).toBeGreaterThanOrEqual(0);
      expect(seed.correctIndex, seed.semanticId).toBeLessThan(
        seed.options.length,
      );
    }
  });

  it("does not collide with the existing lower-listening semantic inventory", () => {
    const existingIds = new Set(
      BASE_LOWER_LISTENING_SEEDS.map((seed) => seed.semanticId),
    );
    const existingFocuses = new Set(
      BASE_LOWER_LISTENING_SEEDS.map((seed) => seed.semanticFocus),
    );
    const existingScripts = new Set(
      BASE_LOWER_LISTENING_SEEDS.map((seed) => withoutSpacing(seed.script)),
    );

    for (const seed of n4LowerListeningExpansion) {
      expect(existingIds.has(seed.semanticId), seed.semanticId).toBe(false);
      expect(existingFocuses.has(seed.semanticFocus), seed.semanticId).toBe(
        false,
      );
      expect(
        existingScripts.has(withoutSpacing(seed.script)),
        seed.semanticId,
      ).toBe(false);
    }
  });

  it("preserves official printed and audio-only response mechanics", () => {
    for (const seed of n4LowerListeningExpansion) {
      const expected = PRESENTATION[seed.family];
      expect(seed.questionTiming, seed.semanticId).toBe(
        expected.questionTiming,
      );
      expect(seed.audioOnlyOptions, seed.semanticId).toBe(
        expected.audioOnlyOptions,
      );
      expect(seed.options, seed.semanticId).toHaveLength(expected.optionCount);

      if (seed.family === "listening-quick-response") {
        expect(seed.question, seed.semanticId).toBe(
          "最も適切な応答を選んでください。",
        );
      }
    }
  });

  it("audibly grounds every task alternative and keeps one explicit keyed rationale", () => {
    const tasks = n4LowerListeningExpansion.filter(
      (seed) => seed.family === "listening-task",
    );
    expect(Object.keys(TASK_OPTION_CUES).sort()).toEqual(
      tasks.map((seed) => seed.semanticId).sort(),
    );

    for (const seed of tasks) {
      const cues = TASK_OPTION_CUES[seed.semanticId];
      expect(cues, seed.semanticId).toHaveLength(seed.options.length);
      for (const cue of cues) {
        expect(seed.script, `${seed.semanticId}: ${cue}`).toContain(cue);
      }
      expect(seed.explanation.length, seed.semanticId).toBeGreaterThanOrEqual(
        100,
      );
    }
  });

  it("uses N4-scale tracking in task and key-point stimuli", () => {
    const coherentItems = n4LowerListeningExpansion.filter(
      (seed) => seed.family !== "listening-quick-response",
    );
    const trackingCue =
      /あと|前|から|まで|なら|ので|だけ|でも|ではなく|変わ|終わ|必要|そのまま|いっしょ|より|場合|もう|まだ|ただ|ないで|ですが|どちらも/u;

    for (const seed of coherentItems) {
      expect(
        withoutSpacing(seed.script).length,
        seed.semanticId,
      ).toBeGreaterThanOrEqual(85);
      expect(seed.script, seed.semanticId).toMatch(trackingCue);
      expect(seed.explanation.length, seed.semanticId).toBeGreaterThanOrEqual(
        95,
      );
    }

    const tasks = coherentItems.filter(
      (seed) => seed.family === "listening-task",
    );
    // Most tasks use an explicit temporal/conditional cue; the remainder use
    // criteria or paired mappings so the tranche does not collapse into twelve
    // versions of the same "what comes first" operation.
    expect(
      tasks.filter((seed) =>
        /あと|前|なら|そのまま|より|もう|まだ/u.test(seed.script),
      ).length,
    ).toBeGreaterThanOrEqual(9);
  });

  it("keeps quick responses substantive while preserving the short-turn construct", () => {
    const quick = n4LowerListeningExpansion.filter(
      (seed) => seed.family === "listening-quick-response",
    );

    for (const seed of quick) {
      expect(
        withoutSpacing(seed.script).length,
        seed.semanticId,
      ).toBeGreaterThanOrEqual(13);
      expect(
        withoutSpacing(seed.script).length,
        seed.semanticId,
      ).toBeLessThanOrEqual(36);
      expect(
        seed.options.every((option) => withoutSpacing(option).length >= 8),
        seed.semanticId,
      ).toBe(true);
      expect(seed.explanation.length, seed.semanticId).toBeGreaterThanOrEqual(
        100,
      );
    }

    expect(
      quick.filter((seed) =>
        /いただけませんか|てもらえませんか|でしたよね|しまって|んです|ないでね/u.test(
          seed.script,
        ),
      ).length,
    ).toBeGreaterThanOrEqual(8);
  });

  it("contains complete Japanese and no unresolved template placeholders", () => {
    for (const seed of n4LowerListeningExpansion) {
      expect(seed.script, seed.semanticId).toMatch(/[ぁ-んァ-ヶ一-龠]/u);
      expect(seed.question, seed.semanticId).toMatch(/[ぁ-んァ-ヶ一-龠]/u);
      expect(
        seed.options.every((option) => /[ぁ-んァ-ヶ一-龠]/u.test(option)),
        seed.semanticId,
      ).toBe(true);
      expect(
        [seed.script, seed.question, ...seed.options].join("\n"),
        seed.semanticId,
      ).not.toMatch(/\$\{|\{(?:person|place|day|time|count)\}|TODO|TBD/iu);
    }
  });

  it("pins the independent editorial re-audit repairs", () => {
    const seed = (semanticId: string) => {
      const match = n4LowerListeningExpansion.find(
        (candidate) => candidate.semanticId === semanticId,
      );
      expect(match, semanticId).toBeDefined();
      return match!;
    };

    expect(seed("N4-key-cooking-class-room").question).toBe(
      "土曜日の料理教室は、何番の部屋で行いますか。",
    );
    expect(seed("N4-key-cooking-class-room").script).not.toContain(
      seed("N4-key-cooking-class-room").question,
    );
    expect(seed("N4-key-cafe-allergy-lunch-set").explanation).toContain(
      "ingredient requirements",
    );
    expect(seed("N4-key-cafe-allergy-lunch-set").explanation).not.toContain(
      "allergy",
    );
    expect(seed("N4-key-train-stroller-car").semanticFocus).not.toContain(
      "platform change",
    );
    expect(seed("N4-quick-manager-document-status").options).toContain(
      "部長は資料を三部使うそうです",
    );
    expect(seed("N4-quick-saturday-help-availability").script).toContain(
      "午後の会場準備",
    );
    expect(seed("N4-quick-saturday-help-availability").script).not.toContain(
      "引っ越し",
    );
    expect(seed("N4-quick-saturday-help-availability").options).toContain(
      "ええ、二時からなら手伝えますよ",
    );
  });
});
