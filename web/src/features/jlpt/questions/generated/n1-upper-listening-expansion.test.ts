import { describe, expect, it } from "vitest";
import {
  N1_UPPER_LISTENING_EXPANSION,
  N1_UPPER_LISTENING_EXPANSION_EDITORIAL_STATUS,
} from "./n1-upper-listening-expansion";
import {
  BASE_UPPER_LISTENING_SEEDS,
  type UpperListeningFamily,
  type UpperListeningSeed,
} from "./upper-listening-seeds";

const FAMILY_COUNTS = {
  "listening-task": 8,
  "listening-key-points": 8,
  "listening-outline": 8,
  "listening-quick-response": 8,
  "listening-integrated": 8,
} as const satisfies Record<UpperListeningFamily, number>;

const PRESENTATION = {
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
} as const satisfies Record<
  UpperListeningFamily,
  Pick<UpperListeningSeed, "questionTiming" | "audioOnlyOptions"> & {
    optionCount: number;
  }
>;

const TASK_AUDIT = {
  "N1-task-procurement-pilot-reversible-sandbox": {
    correct: "三製品を試験環境で同じ条件のもと試す",
    optionCues: [
      "最も安い製品を全庁に入れて",
      "三製品を、実際の情報を含まない試験環境",
      "利用料の交渉",
      "今のシステムの解約",
    ],
  },
  "N1-task-laboratory-calibration-quarantine": {
    correct: "疑いのある結果を保留し装置の使用を止める",
    optionCues: [
      "利用者全員に、結果が無効",
      "標準試料は廃棄せず",
      "測定結果を未確定としてシステム上で保留",
      "装置を廃棄するかどうか",
    ],
  },
  "N1-task-rail-elevator-alternative-route": {
    correct: "利用できる代替経路を確認して所要時間を調べる",
    optionCues: [
      "代替経路を実際にたどって",
      "ウェブに故障だけ",
      "駅員向けの案内",
      "工事の延期",
    ],
  },
  "N1-task-contract-language-controlling-version": {
    correct: "署名済みの契約で優先言語の条項を確認する",
    optionCues: [
      "英語版の表現を日本語に合わせて直",
      "相手方への修正案",
      "英語版を無視",
      "双方が署名した版",
    ],
  },
  "N1-task-citizen-panel-recruitment-gap": {
    correct: "応募状況を地区や移動手段、時間帯でも集計する",
    optionCues: [
      "大学へ追加募集",
      "居住地区、移動手段、参加できる時間帯",
      "締め切りを一律に延ばす",
      "抽選も",
    ],
  },
  "N1-task-construction-archaeological-find": {
    correct: "発見区画を保護して位置と状態を記録する",
    optionCues: [
      "発見地点を囲って",
      "写真だけ撮って掘削を続け",
      "工事全体を中止",
      "破片の洗浄",
    ],
  },
  "N1-task-festival-weather-capacity-check": {
    correct: "会館の設備配置を踏まえた安全な収容人数",
    optionCues: [
      "全部移すと発表",
      "払い戻しの案内",
      "安全な収容人数",
      "屋外開催の可否",
    ],
  },
  "N1-task-water-sensor-manual-verification": {
    correct: "複数地点で採水し二つの方法で値を確認する",
    optionCues: [
      "煮沸を呼びかけ",
      "センサーを交換",
      "給水区域を停止",
      "同じ地点と上流で採水",
    ],
  },
} as const;

const OUTLINE_AUDIT = {
  "N1-outline-redundancy-institutional-memory": {
    correct: "判断の継承を支える重なりまで一律に削るべきではない",
    cues: [
      "責任が曖昧な二重作業",
      "例外に対応する力",
      "組織の学習を支えている",
    ],
  },
  "N1-outline-maps-negotiated-choices": {
    correct: "地図の目的と省略された条件を確認して利用すべきだ",
    cues: ["地図の目的によって変わります", "省かれれば", "何のために作り"],
  },
  "N1-outline-library-quiet-and-encounter": {
    correct: "空間と時間の設計によって静けさと交流を両立できる",
    cues: ["二択にする必要はありません", "時間帯ごとの使い分け", "両立の設計"],
  },
  "N1-outline-failed-prediction-model-boundary": {
    correct: "失敗の仕方を用いて適用条件を検証し直すべきだ",
    cues: ["外れ方には情報", "反証不能", "境界を更新"],
  },
  "N1-outline-replica-transforms-access": {
    correct: "複製の可能性と限界を示し異なるアクセスとして活用すべきだ",
    cues: ["単なる代用品ではありません", "再現できません", "何がなお届かない"],
  },
  "N1-outline-review-productive-friction": {
    correct: "役割と期限が明確な確認は後の手戻りを減らせる",
    cues: [
      "いつも無駄な重複とは限りません",
      "各段階の役割と期限",
      "後戻りを防ぐ",
    ],
  },
  "N1-outline-standard-language-and-variation": {
    correct: "共通形式を活用しつつ地域的な表現が担う知識も尊重すべきだ",
    cues: [
      "効用を否定する必要はありません",
      "細かく区別する働き",
      "差異がどんな知識",
    ],
  },
  "N1-outline-climate-story-scale-and-agency": {
    correct: "身近な行動と制度的な変化のつながりを示すべきだ",
    cues: [
      "制度や産業の選択",
      "必要なのは規模を一つに決めることではなく",
      "構造に参加できる入口",
    ],
  },
} as const;

const QUICK_RESPONSE_AUDIT = {
  "N1-quick-causal-claim-restraint":
    "他の要因をまだ分けられないので、関連が見られたとしましょう。",
  "N1-quick-minutes-preserve-dissent":
    "判断の条件が分かるよう、主な異論も要約して残してください。",
  "N1-quick-citation-before-release":
    "いいえ、文脈も含めて確認してから公開しましょう。",
  "N1-quick-budget-prioritize-scope":
    "全部を薄くする前に、判断に不可欠な項目を選びましょう。",
  "N1-quick-low-use-access-barrier":
    "人数だけでは分からないので、時間や申込み方法も確かめましょう。",
  "N1-quick-failure-case-learning":
    "原因を示せるなら、方法が通用しない条件として残しましょう。",
  "N1-quick-alternate-approval-route":
    "手順は飛ばさず、規程にある代行者へ回してください。",
  "N1-quick-premise-needed-for-conclusion":
    "誤解に関わる前提は残し、ほかを整理しましょう。",
} as const;

const INTEGRATED_SYNTHESIS_AUDIT = {
  "N1-integrated-night-bus-shift-connections": {
    correct:
      "週末に出発を交代時間へ合わせ、主要停留所と複数手段の予約停留所を組み合わせる",
    facets: [
      ["勤務終了時刻と接続の待ち時間", "交代時間"],
      ["金曜と土曜に限り、別の夜間班", "週末"],
      ["電話とウェブの両方", "複数手段"],
      ["主要三停留所", "主要停留所"],
    ],
  },
  "N1-integrated-open-access-rights-and-reciprocity": {
    correct:
      "原稿の利用権を保持して段階的に公開し、機微な資料は同意に基づき制限しつつ要約も届ける",
    facets: [
      ["投稿時に一定の利用権", "利用権を保持"],
      ["出版社の条件に応じて公開日", "段階的に公開"],
      ["原資料の公開範囲は協力者と改めて決めて", "同意に基づき制限"],
      ["地域の言葉で説明した要約", "要約も届ける"],
    ],
  },
  "N1-integrated-river-floodplain-staged-restoration": {
    correct:
      "安全条件を確認した小区間から試し、耕作者を補償して治水と生態の指標で拡大を判断する",
    facets: [
      ["流域全体の計算", "安全条件"],
      ["小さな区間から", "小区間から試し"],
      ["耕作者の損失", "耕作者を補償"],
      ["水温、浅瀬の連続性、産卵期の濁り", "生態の指標"],
    ],
  },
  "N1-integrated-school-smartphone-bounded-use": {
    correct:
      "授業目的の限定利用と端末貸出を設け、通常時の保管と緊急連絡の手順を明確にする",
    facets: [
      ["授業目的で使う時間", "授業目的の限定利用"],
      ["目立たない形で借りられない", "端末貸出"],
      ["授業の冒頭で箱に集め", "通常時の保管"],
      ["緊急連絡", "緊急連絡の手順"],
    ],
  },
  "N1-integrated-museum-free-access-capacity": {
    correct:
      "常設展を無料にし、多様な入場枠と独立性を守る財源を設けて利用の偏りも検証する",
    facets: [
      ["無料化すれば", "常設展を無料"],
      ["当日入れる枠と、十五分だけ見る人のための短時間枠", "多様な入場枠"],
      ["展示内容への介入を防ぐ契約", "独立性を守る財源"],
      ["利用が均等になるとは限りません", "利用の偏りも検証"],
    ],
  },
  "N1-integrated-hybrid-office-predictable-flexibility": {
    correct:
      "一部を転貸して縮小案を試し、予告した共同日と利用しやすい設備を成果評価と組み合わせる",
    facets: [
      ["一フロアを転貸し", "一部を転貸"],
      ["共同作業日を早めに決め", "予告した共同日"],
      ["調整済みの席を予約", "利用しやすい設備"],
      ["出勤日数そのものを評価", "成果評価"],
    ],
  },
  "N1-integrated-community-air-sensor-calibration": {
    correct:
      "小型センサーを基準局で補正し、広い観測網の警告を公定法の調査につなげる",
    facets: [
      ["住民が場所を選び", "広い観測網"],
      ["基準局の隣に定期的に置いて補正式", "基準局で補正"],
      ["公定法の結果で法的措置", "公定法の調査"],
    ],
  },
  "N1-integrated-municipal-translation-risk-tiering": {
    correct:
      "誤訳の影響に応じて方法を分け、権利や健康に関わる場面では専門家と利用者が確認する",
    facets: [
      ["誤訳した場合の影響に応じて", "誤訳の影響に応じて"],
      ["権利や健康に直接関わる場面", "権利や健康に関わる場面"],
      ["訓練を受けた人", "専門家"],
      ["実際の利用者が最初から最後まで試し", "利用者が確認"],
    ],
  },
} as const;

function compact(value: string) {
  return value.replace(/\s/gu, "");
}

function originalityForm(value: string) {
  return compact(value)
    .replace(/[ァ-ヶ一-龠ぁ-んA-Za-z0-9]+：/gu, "")
    .replace(/[「」『』。、・！？,.!?（）()]/gu, "");
}

function shingles(value: string, size: number) {
  const normalized = originalityForm(value);
  if (normalized.length < size) return new Set([normalized]);
  return new Set(
    Array.from({ length: normalized.length - size + 1 }, (_, index) =>
      normalized.slice(index, index + size),
    ),
  );
}

describe("standalone N1 upper-listening expansion", () => {
  it("exports exactly eight original semantic items in each requested family", () => {
    expect(N1_UPPER_LISTENING_EXPANSION).toHaveLength(40);
    for (const [family, count] of Object.entries(FAMILY_COUNTS)) {
      expect(
        N1_UPPER_LISTENING_EXPANSION.filter((seed) => seed.family === family),
        family,
      ).toHaveLength(count);
    }
  });

  it("keeps the isolated tranche globally collision-free", () => {
    const ids = N1_UPPER_LISTENING_EXPANSION.map((seed) => seed.semanticId);
    const focuses = N1_UPPER_LISTENING_EXPANSION.map(
      (seed) => seed.semanticFocus,
    );
    const scripts = N1_UPPER_LISTENING_EXPANSION.map((seed) =>
      compact(seed.script),
    );
    expect(new Set(ids).size).toBe(40);
    expect(new Set(focuses).size).toBe(40);
    expect(new Set(scripts).size).toBe(40);

    const existingIds = new Set(
      BASE_UPPER_LISTENING_SEEDS.map((seed) => seed.semanticId),
    );
    const existingFocuses = new Set(
      BASE_UPPER_LISTENING_SEEDS.map((seed) => seed.semanticFocus),
    );
    const existingScripts = new Set(
      BASE_UPPER_LISTENING_SEEDS.map((seed) => compact(seed.script)),
    );
    for (const seed of N1_UPPER_LISTENING_EXPANSION) {
      const familyToken = {
        "listening-task": "task",
        "listening-key-points": "key",
        "listening-outline": "outline",
        "listening-quick-response": "quick",
        "listening-integrated": "integrated",
      }[seed.family];
      expect(seed.level, seed.semanticId).toBe("N1");
      expect(seed.semanticId, seed.semanticId).toMatch(
        new RegExp(`^N1-${familyToken}-[a-z0-9-]+$`),
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

  it("encodes the official public-sample presentation order and option mechanics", () => {
    for (const seed of N1_UPPER_LISTENING_EXPANSION) {
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

  it("grounds all four printed alternatives in every task stimulus", () => {
    const tasks = N1_UPPER_LISTENING_EXPANSION.filter(
      (seed) => seed.family === "listening-task",
    );
    expect(tasks.map((seed) => seed.semanticId).sort()).toEqual(
      Object.keys(TASK_AUDIT).sort(),
    );

    for (const seed of tasks) {
      const audit = TASK_AUDIT[seed.semanticId as keyof typeof TASK_AUDIT];
      expect(seed.options[seed.correctIndex], seed.semanticId).toBe(
        audit.correct,
      );
      expect(audit.optionCues, seed.semanticId).toHaveLength(4);
      audit.optionCues.forEach((cue, optionIndex) => {
        expect(
          seed.script,
          `${seed.semanticId}: option ${optionIndex + 1} cue '${cue}'`,
        ).toContain(cue);
      });
    }
  });

  it("does not leak answers through a repeated key position", () => {
    for (const [family, optionCount] of Object.entries(PRESENTATION).map(
      ([family, value]) =>
        [family as UpperListeningFamily, value.optionCount] as const,
    )) {
      const familySeeds = N1_UPPER_LISTENING_EXPANSION.filter(
        (seed) => seed.family === family,
      );
      const counts = Array.from(
        { length: optionCount },
        (_, index) =>
          familySeeds.filter((seed) => seed.correctIndex === index).length,
      );
      expect(
        counts.every((count) => count >= 2),
        `${family}: ${counts.join(",")}`,
      ).toBe(true);
    }
  });

  it("pins every outline key to a global rhetorical contrast rather than one isolated detail", () => {
    const outlines = N1_UPPER_LISTENING_EXPANSION.filter(
      (seed) => seed.family === "listening-outline",
    );
    expect(outlines.map((seed) => seed.semanticId).sort()).toEqual(
      Object.keys(OUTLINE_AUDIT).sort(),
    );

    for (const seed of outlines) {
      const audit =
        OUTLINE_AUDIT[seed.semanticId as keyof typeof OUTLINE_AUDIT];
      expect(seed.options[seed.correctIndex], seed.semanticId).toBe(
        audit.correct,
      );
      expect(compact(seed.script), seed.semanticId).not.toContain(
        compact(audit.correct),
      );
      for (const cue of audit.cues)
        expect(seed.script, `${seed.semanticId}: ${cue}`).toContain(cue);
    }
  });

  it("keeps quick responses short, audio-only, and pragmatically contrastive", () => {
    const quickResponses = N1_UPPER_LISTENING_EXPANSION.filter(
      (seed) => seed.family === "listening-quick-response",
    );
    expect(quickResponses.map((seed) => seed.semanticId).sort()).toEqual(
      Object.keys(QUICK_RESPONSE_AUDIT).sort(),
    );
    for (const seed of quickResponses) {
      const expectedReply =
        QUICK_RESPONSE_AUDIT[
          seed.semanticId as keyof typeof QUICK_RESPONSE_AUDIT
        ];
      expect(seed.options[seed.correctIndex], seed.semanticId).toBe(
        expectedReply,
      );
      expect(
        compact(seed.script).length,
        seed.semanticId,
      ).toBeGreaterThanOrEqual(20);
      expect(compact(seed.script).length, seed.semanticId).toBeLessThanOrEqual(
        46,
      );
      expect(seed.script, seed.semanticId).toMatch(/[。？！]$/u);
      expect(
        seed.options.every((option) => /[。？！]$/u.test(option)),
        seed.semanticId,
      ).toBe(true);
      expect(
        Math.min(...seed.options.map((option) => compact(option).length)),
        seed.semanticId,
      ).toBeGreaterThanOrEqual(13);
    }
  });

  it("keeps integrated items long, multi-source, and synthesis-oriented", () => {
    const integrated = N1_UPPER_LISTENING_EXPANSION.filter(
      (seed) => seed.family === "listening-integrated",
    );
    expect(integrated).toHaveLength(8);
    expect(integrated.map((seed) => seed.semanticId).sort()).toEqual(
      Object.keys(INTEGRATED_SYNTHESIS_AUDIT).sort(),
    );

    for (const seed of integrated) {
      const audit =
        INTEGRATED_SYNTHESIS_AUDIT[
          seed.semanticId as keyof typeof INTEGRATED_SYNTHESIS_AUDIT
        ];
      const sourceLabels = [...seed.script.matchAll(/([ァ-ヶ一-龠]+)：/gu)]
        .map((match) => match[1])
        .filter((label) => label !== "ナレーション");
      expect(
        compact(seed.script).length,
        seed.semanticId,
      ).toBeGreaterThanOrEqual(700);
      expect(seed.sourceCount, seed.semanticId).toBe(4);
      expect(
        new Set(sourceLabels).size,
        seed.semanticId,
      ).toBeGreaterThanOrEqual(4);
      expect(
        seed.script.match(/ナレーション：/gu)?.length ?? 0,
        seed.semanticId,
      ).toBeGreaterThanOrEqual(5);
      expect(seed.options[seed.correctIndex], seed.semanticId).toBe(
        audit.correct,
      );
      expect(compact(seed.script), seed.semanticId).not.toContain(
        compact(audit.correct),
      );
      expect(audit.facets.length, seed.semanticId).toBeGreaterThanOrEqual(3);
      for (const [scriptCue, answerCue] of audit.facets) {
        expect(
          seed.script,
          `${seed.semanticId}: evidence '${scriptCue}'`,
        ).toContain(scriptCue);
        expect(
          audit.correct,
          `${seed.semanticId}: synthesis '${answerCue}'`,
        ).toContain(answerCue);
      }
      expect(seed.script, seed.semanticId).not.toMatch(
        /方針をまとめます|結論を述べます|方針を決めます|決定を述べます/u,
      );
      expect(
        compact(seed.options[seed.correctIndex]).length,
        seed.semanticId,
      ).toBeGreaterThanOrEqual(35);
      expect(seed.explanation, seed.semanticId).toMatch(
        /and|while|with|combines|both/iu,
      );
    }
  });

  it("keeps non-integrated families within conservative N1 authored length and discourse guardrails", () => {
    const ranges: Partial<
      Record<UpperListeningFamily, readonly [number, number]>
    > = {
      "listening-task": [180, 410],
      "listening-key-points": [165, 390],
      "listening-outline": [220, 470],
    };
    const discourseMarkers =
      /一方|ただし|しかし|けれど|ものの|とはいえ|ても|なら|限り|ではなく|わけでは|前に|までは|ので|から|ため|だけ|のか|によって|一律|むしろ/gu;

    for (const seed of N1_UPPER_LISTENING_EXPANSION) {
      const range = ranges[seed.family];
      if (!range) continue;
      const length = compact(seed.script).length;
      expect(length, `${seed.semanticId}: minimum`).toBeGreaterThanOrEqual(
        range[0],
      );
      expect(length, `${seed.semanticId}: maximum`).toBeLessThanOrEqual(
        range[1],
      );
      expect(
        seed.script.match(discourseMarkers)?.length ?? 0,
        seed.semanticId,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it("contains complete Japanese stimuli, plausible-length choices, and substantive explanations", () => {
    for (const seed of N1_UPPER_LISTENING_EXPANSION) {
      expect(seed.script, seed.semanticId).toMatch(/[ぁ-んァ-ヶ一-龠]/u);
      expect(seed.question, seed.semanticId).toMatch(/[ぁ-んァ-ヶ一-龠]/u);
      expect(
        seed.options.every((option) => /[ぁ-んァ-ヶ一-龠]/u.test(option)),
        seed.semanticId,
      ).toBe(true);
      expect(seed.question.length, seed.semanticId).toBeLessThanOrEqual(62);
      expect(seed.explanation.length, seed.semanticId).toBeGreaterThanOrEqual(
        90,
      );
      expect(
        Math.min(...seed.options.map((option) => compact(option).length)),
        seed.semanticId,
      ).toBeGreaterThanOrEqual(8);
    }
  });

  it("raises originality red flags for attribution, placeholders, or close phrase reuse", () => {
    const existingN1 = BASE_UPPER_LISTENING_SEEDS.filter(
      (seed) => seed.level === "N1",
    );
    const existingShingles = new Set(
      existingN1.flatMap((seed) => [...shingles(seed.script, 32)]),
    );

    for (const seed of N1_UPPER_LISTENING_EXPANSION) {
      const authoredText = [seed.script, seed.question, ...seed.options].join(
        "\n",
      );
      expect(authoredText, seed.semanticId).not.toMatch(
        /\$\{|TODO|TBD|公式問題|問題例|出典[:：]\s*(?:JLPT|日本語能力試験)|日本語能力試験|国際交流基金|日本国際教育支援協会/iu,
      );
      const sharedPhraseCount = [...shingles(seed.script, 32)].filter((item) =>
        existingShingles.has(item),
      ).length;
      expect(
        sharedPhraseCount,
        `${seed.semanticId}: shared 32-character phrases`,
      ).toBeLessThanOrEqual(2);
    }
  });

  it("keeps independent editorial validation explicitly outstanding", () => {
    expect(N1_UPPER_LISTENING_EXPANSION_EDITORIAL_STATUS).toBe(
      "machine-validated",
    );
  });
});
