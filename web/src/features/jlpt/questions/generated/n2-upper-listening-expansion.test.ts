import { describe, expect, it } from "vitest";
import {
  BASE_UPPER_LISTENING_SEEDS,
  type UpperListeningFamily,
  type UpperListeningSeed,
} from "./upper-listening-seeds";
import { n2UpperListeningExpansion } from "./n2-upper-listening-expansion";

const FAMILIES = [
  "listening-task",
  "listening-key-points",
  "listening-outline",
  "listening-quick-response",
  "listening-integrated",
] as const satisfies readonly UpperListeningFamily[];

const PRESENTATION: Record<
  UpperListeningFamily,
  Pick<UpperListeningSeed, "questionTiming" | "audioOnlyOptions"> & {
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
  "listening-outline": {
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
    optionCount: 4,
  },
  "listening-quick-response": {
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
    optionCount: 3,
  },
  "listening-integrated": {
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
    optionCount: 4,
  },
};

const TASK_OPTION_CUES: Record<
  string,
  readonly [string, string, string, string]
> = {
  "N2-task-storm-event-backup-room": [
    "参加者へ変更を知らせ",
    "管理担当に会議室を仮予約",
    "昼までに天気をもう一度確認",
    "案内板を入口に移しましょう",
  ],
  "N2-task-moving-elevator-booking": [
    "荷物を先に玄関へ出して",
    "普通のエレベーターでは家具を運べません",
    "管理会社に時間を確認して予約",
    "運送会社に到着時刻を合わせてもらって",
  ],
  "N2-task-online-order-split-shipment": [
    "在庫のある本だけ先に発送",
    "両方そろうまで発送を待ちますか",
    "店で受け取るには営業時間に間に合いません",
    "取り消す必要もありません",
  ],
  "N2-task-training-accessibility-confirmation": [
    "手話通訳を予約",
    "機材を借り",
    "席の位置も決めます",
    "本人が希望する方法を確認",
  ],
  "N2-task-catering-allergy-count-update": [
    "申込表でほかの食事制限も変わっていないか確認",
    "料理会社へ電話する前に",
    "席札に印を付ける",
    "注文を確定する",
  ],
  "N2-task-lost-wallet-transit-card": [
    "駅の忘れ物窓口へ行けば",
    "交通カードが入っていたなら、先に発行会社へ連絡して利用を止めた",
    "警察へ届ける",
    "免許証の再発行",
  ],
  "N2-task-museum-guide-reassignment": [
    "参加者に中止のメール",
    "午前へ変更できるか",
    "午後の担当者なら英語も話せます",
    "別の会社へ通訳を頼む",
  ],
  "N2-task-rental-damage-photo-record": [
    "引き渡し表にサイン",
    "管理会社へ修理を頼む",
    "家具を置きましょう",
    "傷の写真を撮り、表に場所を書き加えて",
  ],
};

const TASK_KEYS: Record<string, string> = {
  "N2-task-storm-event-backup-room": "管理担当に会議室の仮予約を頼む",
  "N2-task-moving-elevator-booking":
    "管理会社にサービス用エレベーターを予約する",
  "N2-task-online-order-split-shipment": "在庫のある本だけ先に発送してもらう",
  "N2-task-training-accessibility-confirmation":
    "参加者に希望する支援方法を確認する",
  "N2-task-catering-allergy-count-update": "申込表を確認して人数を更新する",
  "N2-task-lost-wallet-transit-card": "交通カードの利用を止める",
  "N2-task-museum-guide-reassignment": "午後の担当者に時間と展示知識を確認する",
  "N2-task-rental-damage-photo-record": "傷を写真に撮って表へ書き加える",
};

const QUICK_RESPONSE_KEYS: Record<string, string> = {
  "N2-quick-proposal-cost-concern": "機能を絞った場合の費用も出してみます",
  "N2-quick-draft-checkpoint": "木曜の午後には一度見ていただける段階にします",
  "N2-quick-overlapping-meetings": "片方は私が出て、あとで内容を共有しましょう",
  "N2-quick-customer-wait-complaint":
    "申し訳ありません。すぐ状況を確認いたします",
  "N2-quick-review-reservation": "根拠を整理して、次回もう一度ご説明します",
  "N2-quick-favor-reciprocity": "いえ、前に私も助けてもらいましたから",
  "N2-quick-chart-density-feedback": "重要な二つを残して、グラフに直します",
  "N2-quick-schedule-change-apology": "はい、その時間でも間に合います",
};

function withoutSpacing(value: string) {
  return value.replace(/\s/gu, "");
}

describe("N2 upper-listening expansion tranche", () => {
  it("contains exactly eight independent semantic items in every N2 family", () => {
    expect(n2UpperListeningExpansion).toHaveLength(40);
    for (const family of FAMILIES) {
      expect(
        n2UpperListeningExpansion.filter((seed) => seed.family === family),
        family,
      ).toHaveLength(8);
    }
  });

  it("uses unique N2-owned identities, focuses, scripts, and answer sets", () => {
    const ids = n2UpperListeningExpansion.map((seed) => seed.semanticId);
    const focuses = n2UpperListeningExpansion.map((seed) => seed.semanticFocus);
    const scripts = n2UpperListeningExpansion.map((seed) =>
      withoutSpacing(seed.script),
    );

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(focuses).size).toBe(focuses.length);
    expect(new Set(scripts).size).toBe(scripts.length);

    for (const seed of n2UpperListeningExpansion) {
      const fragment = {
        "listening-task": "task",
        "listening-key-points": "key",
        "listening-outline": "outline",
        "listening-quick-response": "quick",
        "listening-integrated": "integrated",
      }[seed.family];

      expect(seed.level, seed.semanticId).toBe("N2");
      expect(seed.semanticId).toMatch(
        new RegExp(`^N2-${fragment}-[a-z0-9-]+$`),
      );
      expect(
        seed.semanticFocus.trim().split(/\s+/u).length,
        seed.semanticId,
      ).toBeGreaterThanOrEqual(7);
      expect(new Set(seed.options).size, seed.semanticId).toBe(
        seed.options.length,
      );
      expect(seed.correctIndex, seed.semanticId).toBeGreaterThanOrEqual(0);
      expect(seed.correctIndex, seed.semanticId).toBeLessThan(
        seed.options.length,
      );
    }
  });

  it("does not collide with the current upper-listening inventory", () => {
    const baselineIds = new Set(
      BASE_UPPER_LISTENING_SEEDS.map((seed) => seed.semanticId),
    );
    const baselineFocuses = new Set(
      BASE_UPPER_LISTENING_SEEDS.map((seed) => seed.semanticFocus),
    );
    const baselineScripts = new Set(
      BASE_UPPER_LISTENING_SEEDS.map((seed) => withoutSpacing(seed.script)),
    );

    for (const seed of n2UpperListeningExpansion) {
      expect(baselineIds.has(seed.semanticId), seed.semanticId).toBe(false);
      expect(baselineFocuses.has(seed.semanticFocus), seed.semanticId).toBe(
        false,
      );
      expect(
        baselineScripts.has(withoutSpacing(seed.script)),
        seed.semanticId,
      ).toBe(false);
    }
  });

  it("preserves the official presentation mechanics for all five families", () => {
    for (const seed of n2UpperListeningExpansion) {
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

  it("uses every available answer position in every response stream", () => {
    for (const family of FAMILIES) {
      const positions = n2UpperListeningExpansion
        .filter((seed) => seed.family === family)
        .map((seed) => seed.correctIndex);
      expect(new Set(positions).size, family).toBe(
        PRESENTATION[family].optionCount,
      );
    }
  });

  it("grounds every task alternative in an audible plan, condition, rejection, or later step", () => {
    const tasks = n2UpperListeningExpansion.filter(
      (seed) => seed.family === "listening-task",
    );
    expect(Object.keys(TASK_OPTION_CUES).sort()).toEqual(
      tasks.map((seed) => seed.semanticId).sort(),
    );

    for (const seed of tasks) {
      const cues = TASK_OPTION_CUES[seed.semanticId];
      expect(cues, seed.semanticId).toHaveLength(seed.options.length);
      expect(seed.options[seed.correctIndex], seed.semanticId).toBe(
        TASK_KEYS[seed.semanticId],
      );
      for (const cue of cues) {
        expect(seed.script, `${seed.semanticId}: ${cue}`).toContain(cue);
      }
    }
  });

  it("locks the reviewed quick-response keys without accepting a second direct resolution", () => {
    const quickResponses = n2UpperListeningExpansion.filter(
      (seed) => seed.family === "listening-quick-response",
    );
    expect(quickResponses.map((seed) => seed.semanticId).sort()).toEqual(
      Object.keys(QUICK_RESPONSE_KEYS).sort(),
    );

    for (const seed of quickResponses) {
      expect(seed.options[seed.correctIndex], seed.semanticId).toBe(
        QUICK_RESPONSE_KEYS[seed.semanticId],
      );
      expect(
        seed.options.filter((_, index) => index !== seed.correctIndex),
        seed.semanticId,
      ).not.toContain(QUICK_RESPONSE_KEYS[seed.semanticId]);
      expect(
        Math.min(...seed.options.map((option) => option.length)),
        seed.semanticId,
      ).toBeGreaterThanOrEqual(12);
    }
  });

  it("keeps N2 coherent stimuli above N3-like one-step recall and below N1-style abstraction", () => {
    const minimumLength: Record<UpperListeningFamily, number> = {
      "listening-task": 170,
      "listening-key-points": 145,
      "listening-outline": 170,
      "listening-quick-response": 18,
      "listening-integrated": 430,
    };
    const maximumLength: Record<UpperListeningFamily, number> = {
      "listening-task": 330,
      "listening-key-points": 300,
      "listening-outline": 360,
      "listening-quick-response": 50,
      "listening-integrated": 750,
    };
    const trackingCue =
      /ただ|一方|前に|あと|なら|場合|ても|でも|ではなく|わけでは|より|ないと|必要|だけ|そのまま|一度|一律|限/u;

    for (const seed of n2UpperListeningExpansion) {
      const length = withoutSpacing(seed.script).length;
      expect(length, seed.semanticId).toBeGreaterThanOrEqual(
        minimumLength[seed.family],
      );
      expect(length, seed.semanticId).toBeLessThanOrEqual(
        maximumLength[seed.family],
      );

      if (seed.family !== "listening-quick-response") {
        expect(seed.script, seed.semanticId).toMatch(trackingCue);
      }
    }
  });

  it("requires multi-source synthesis for integrated items without announcing the key verbatim", () => {
    const integrated = n2UpperListeningExpansion.filter(
      (seed) => seed.family === "listening-integrated",
    );

    for (const seed of integrated) {
      const speakerLabels = [...seed.script.matchAll(/([ァ-ヶ一-龠]+)：/gu)]
        .map((match) => match[1])
        .filter((label) => label !== "ナレーション");
      const correct = seed.options[seed.correctIndex];

      expect(seed.sourceCount, seed.semanticId).toBeGreaterThanOrEqual(2);
      expect(
        new Set(speakerLabels).size,
        seed.semanticId,
      ).toBeGreaterThanOrEqual(seed.sourceCount ?? 0);
      expect(withoutSpacing(seed.script), seed.semanticId).not.toContain(
        withoutSpacing(correct),
      );
      expect(seed.script, seed.semanticId).toContain("ナレーション：");
      expect(seed.explanation.length, seed.semanticId).toBeGreaterThanOrEqual(
        120,
      );
    }
  });

  it("locks the repaired integrated source-count wording and accessibility condition", () => {
    for (const semanticId of [
      "N2-integrated-coworking-room-allocation",
      "N2-integrated-clinic-video-access",
      "N2-integrated-museum-family-guide",
    ]) {
      const seed = n2UpperListeningExpansion.find(
        (candidate) => candidate.semanticId === semanticId,
      );
      expect(seed?.question, semanticId).not.toMatch(/三人/u);
      expect(seed?.sourceCount, semanticId).toBe(4);
    }

    const studyRoom = n2UpperListeningExpansion.find(
      (seed) => seed.semanticId === "N2-integrated-study-room-booking",
    );
    expect(
      studyRoom?.options[studyRoom.correctIndex],
      studyRoom?.semanticId,
    ).toContain("設備の必要な部屋は予約可能に保ち");
  });

  it("keeps the reviewed natural-Japanese repairs in place", () => {
    const byId = new Map(
      n2UpperListeningExpansion.map((seed) => [seed.semanticId, seed]),
    );
    expect(byId.get("N2-task-storm-event-backup-room")?.script).not.toContain(
      "雨の予報が強く",
    );
    expect(byId.get("N2-task-lost-wallet-transit-card")?.script).toContain(
      "発行会社へ連絡",
    );
    expect(byId.get("N2-task-museum-guide-reassignment")?.script).toContain(
      "午後の担当者なら",
    );
    expect(byId.get("N2-outline-exercise-startup-barrier")?.script).toContain(
      "短い時間だけ歩く",
    );
    expect(byId.get("N2-integrated-clinic-video-access")?.script).toContain(
      "一回限りの接続番号",
    );
    expect(byId.get("N2-integrated-festival-transport-loop")?.script).toContain(
      "二台で往復運行",
    );
    expect(
      byId.get("N2-integrated-commute-support-flexibility")?.script,
    ).toContain("これまでの定期券代までは支給");
  });

  it("does not attach integrated provenance to other families", () => {
    for (const seed of n2UpperListeningExpansion) {
      if (seed.family === "listening-integrated") {
        expect(seed.sourceCount, seed.semanticId).toBeDefined();
      } else {
        expect(seed.sourceCount, seed.semanticId).toBeUndefined();
      }
    }
  });

  it("contains complete Japanese, substantive explanations, and no copy or template red flags", () => {
    const knownOfficialCopyRedFlags = [
      "もう一杯いかがですか",
      "あのう、このコピー機の使い方を教えていただけませんか",
      "この授業を休むときは",
      "来週のパーティーなんですが",
      "通販販売を利用されたことがありますか",
      "今日ちょっと、残って仕事してってもらえない",
      "お父さん、またタバコですか",
    ].map(withoutSpacing);

    for (const seed of n2UpperListeningExpansion) {
      const text = [seed.script, seed.question, ...seed.options].join("\n");
      const normalized = withoutSpacing(text);
      expect(seed.script, seed.semanticId).toMatch(/[ぁ-んァ-ヶ一-龠]/u);
      expect(seed.question, seed.semanticId).toMatch(/[ぁ-んァ-ヶ一-龠]/u);
      expect(
        seed.options.every((option) => /[ぁ-んァ-ヶ一-龠]/u.test(option)),
        seed.semanticId,
      ).toBe(true);
      expect(
        seed.explanation.trim().length,
        seed.semanticId,
      ).toBeGreaterThanOrEqual(95);
      expect(text, seed.semanticId).not.toMatch(
        /\$\{|\{(?:person|place|day|time|count)\}|TODO|TBD/iu,
      );
      for (const redFlag of knownOfficialCopyRedFlags) {
        expect(normalized, `${seed.semanticId}: ${redFlag}`).not.toContain(
          redFlag,
        );
      }
    }
  });
});
