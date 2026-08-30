import type {
  ClozeSeed,
  CompositionSeed,
  LexemeSeed,
  UsageSeed,
  WordFormationSeed,
} from "./bank-builder";

type IdentifiedSeed<T> = T & { semanticId: string };

/**
 * Original N2 language-knowledge seeds authored against the official N2 item
 * purposes. Cloze, word-formation, and composition runtime provenance uses the
 * stable semantic IDs; lexical and usage provenance uses the stable surface or
 * focus word already established by the generator.
 */
export const N2_LEXEME_EXPANSION = [
  {
    semanticId: "N2-lexeme-expert-view",
    surface: "見解",
    reading: "けんかい",
    readingDistractors: ["げんかい", "けんげ", "みかい"],
    kana: "けんかい",
    spellingDistractors: ["見改", "検解", "見階"],
    sentence: "専門家はこの結果について異なる見解を示した。",
    paraphrase: "物事についての考え方",
    paraphraseDistractors: [
      "調査で使った具体的な道具",
      "すでに決定された作業手順",
      "結果が出るまでに必要な時間",
    ],
  },
  {
    semanticId: "N2-lexeme-widespread-adoption",
    surface: "普及",
    reading: "ふきゅう",
    readingDistractors: ["ふきゅ", "ふっきゅう", "ぶきゅう"],
    kana: "ふきゅう",
    spellingDistractors: ["普給", "不及", "府及"],
    sentence: "電子決済の普及に伴い、現金を使わない店も増えている。",
    paraphrase: "広く使われるようになること",
    paraphraseDistractors: [
      "一部の人だけが使用をやめること",
      "古い方法を法律で禁止すること",
      "必要な費用を前もって集めること",
    ],
  },
  {
    semanticId: "N2-lexeme-serious-shortage",
    surface: "深刻",
    reading: "しんこく",
    readingDistractors: ["じんこく", "しんごく", "ふかこく"],
    kana: "しんこく",
    spellingDistractors: ["深告", "新刻", "深国"],
    sentence: "地域によっては、医療を支える人材の不足が深刻だ。",
    paraphrase: "簡単には解決できないほど重大だ",
    paraphraseDistractors: [
      "予想より早く解決しそうだ",
      "話題にする必要がほとんどない",
      "一時的に注目を集めているだけだ",
    ],
  },
  {
    semanticId: "N2-lexeme-room-for-improvement",
    surface: "余地",
    reading: "よち",
    readingDistractors: ["よじ", "あまりち", "よどころ"],
    kana: "よち",
    spellingDistractors: ["予地", "余知", "与地"],
    sentence: "この案には、費用の面でまだ改善の余地がある。",
    paraphrase: "さらに何かできる可能性",
    paraphraseDistractors: [
      "変更してはいけない決まり",
      "すでに失われた選択の機会",
      "計画を実行するための広い土地",
    ],
  },
  {
    semanticId: "N2-lexeme-opinion-difference",
    surface: "相違",
    reading: "そうい",
    readingDistractors: ["しょうい", "そうぎ", "あいい"],
    kana: "そうい",
    spellingDistractors: ["相移", "想違", "総意"],
    sentence: "両者の説明には、重要な点で相違が見られる。",
    paraphrase: "互いに異なっている点",
    paraphraseDistractors: [
      "全員が同意している内容",
      "説明から省かれた具体例",
      "意見をまとめるための方法",
    ],
  },
  {
    semanticId: "N2-lexeme-future-outlook",
    surface: "見通し",
    reading: "みとおし",
    readingDistractors: ["みどおし", "けんつうし", "みとし"],
    kana: "みとおし",
    spellingDistractors: ["見通志", "見道し", "観通し"],
    sentence: "材料の価格が下がる見通しは、今のところ立っていない。",
    paraphrase: "今後どうなるかについての予想",
    paraphraseDistractors: [
      "過去の出来事についての詳しい記録",
      "現在すぐに選べる具体的な方法",
      "話し合いで正式に決まった規則",
    ],
  },
  {
    semanticId: "N2-lexeme-pointing-out-problem",
    surface: "指摘",
    reading: "してき",
    readingDistractors: ["しせき", "してっき", "ゆびてき"],
    kana: "してき",
    spellingDistractors: ["指適", "支摘", "指定"],
    sentence: "委員から、調査方法に問題があるとの指摘を受けた。",
    paraphrase: "問題や重要な点を具体的に示すこと",
    paraphraseDistractors: [
      "意見を聞かずに決定を取り消すこと",
      "必要な資料を順番に並べること",
      "失敗の責任を別の人に任せること",
    ],
  },
] satisfies readonly IdentifiedSeed<LexemeSeed>[];

export const N2_CONTEXT_EXPANSION = [
  {
    semanticId: "N2-context-exceed-forecast",
    stem: "今年の利用者数は、当初の予想を大きく＿＿。",
    correct: "上回った",
    distractors: ["引き受けた", "振り返った", "立ち寄った"],
    explanation:
      "予想を上回る is the standard expression for a result exceeding the original forecast.",
  },
  {
    semanticId: "N2-context-premature-conclusion",
    stem: "限られた資料だけで事故の原因を＿＿するのは早すぎる。",
    correct: "断定",
    distractors: ["分担", "配布", "省略"],
    explanation:
      "原因を断定する means to state the cause conclusively; the limited evidence makes doing so premature.",
  },
  {
    semanticId: "N2-context-consider-local-conditions",
    stem: "制度を設計する際は、地域ごとの事情も十分に＿＿すべきだ。",
    correct: "考慮",
    distractors: ["通過", "加工", "展開"],
    explanation:
      "事情を考慮する means to take circumstances into account and fits designing a system for different regions.",
  },
  {
    semanticId: "N2-context-reflect-public-feedback",
    stem: "説明会で寄せられた意見を、今後の計画に＿＿させる。",
    correct: "反映",
    distractors: ["発展", "移動", "成立"],
    explanation:
      "意見を計画に反映させる means incorporating feedback into a future plan.",
  },
  {
    semanticId: "N2-context-minimize-budget-impact",
    stem: "予算削減によるサービスへの影響を最小限に＿＿必要がある。",
    correct: "抑える",
    distractors: ["支える", "備える", "加える"],
    explanation:
      "影響を最小限に抑える is the natural collocation for limiting the effect of budget reductions.",
  },
] satisfies readonly IdentifiedSeed<ClozeSeed>[];

export const N2_USAGE_EXPANSION = [
  {
    semanticId: "N2-usage-express-concern",
    focus: "懸念する",
    correct: "専門家は、急な変更が安全に与える影響を懸念している。",
    distractors: [
      "担当者は、必要な資料を机の上に懸念した。",
      "参加者は、会場までの道を地図で懸念した。",
      "委員会は、二つの案を一つずつ懸念して決めた。",
    ],
    explanation:
      "懸念する means to be concerned about a possible problem; concern about the safety effect is natural and specific.",
  },
  {
    semanticId: "N2-usage-postpone-departure",
    focus: "見合わせる",
    correct: "天候がさらに悪化したため、チームは出発を見合わせた。",
    distractors: [
      "二つの資料を一つの箱に見合わせた。",
      "駅の入口で友人と時間を見合わせた。",
      "不足した予算を別の費用で見合わせた。",
    ],
    explanation:
      "見合わせる can mean postponing an action after considering conditions; the team delays departure because of worsening weather.",
  },
  {
    semanticId: "N2-usage-account-for-share",
    focus: "占める",
    correct: "交通費が、今月の支出の大きな割合を占めている。",
    distractors: [
      "会議室が空いていたので、入口の席に占めて始めた。",
      "必要な資料を三つの箱に占めて運んだ。",
      "説明が長いため、予定の時間を占めておいた。",
    ],
    explanation:
      "割合を占める means to account for a share of a total; the distractors require taking a seat, dividing, or reserving time.",
  },
  {
    semanticId: "N2-usage-additional-cost-arises",
    focus: "生じる",
    correct: "計画を途中で変更すると、追加の費用が生じる場合がある。",
    distractors: [
      "担当者が会議で新しい案を生じた。",
      "不足した資料をコピーして十部生じた。",
      "駅までの道を地図に大きく生じた。",
    ],
    explanation:
      "生じる is intransitive for something arising or occurring, such as an additional cost caused by a plan change.",
  },
] satisfies readonly IdentifiedSeed<UsageSeed>[];

export const N2_GRAMMAR_EXPANSION = [
  {
    semanticId: "N2-grammar-risk-losing-trust",
    stem: "対応がさらに遅れれば、利用者の信頼を失い＿＿。",
    correct: "かねない",
    distractors: ["っこない", "ようがない", "にすぎない"],
    explanation:
      "The verb stem plus かねない expresses an undesirable risk: further delay may cause the organization to lose users' trust.",
  },
  {
    semanticId: "N2-grammar-regardless-of-experience",
    stem: "年齢や経験の有無＿＿、誰でもこの活動に応募できる。",
    correct: "を問わず",
    distractors: ["に応じて", "に限って", "に比べて"],
    explanation:
      "を問わず means regardless of; 誰でも confirms that neither age nor experience restricts applications.",
  },
  {
    semanticId: "N2-grammar-popular-despite-price",
    stem: "この製品は価格が高い＿＿、長く使えるため人気がある。",
    correct: "にもかかわらず",
    distractors: ["にしたがって", "に対して", "をきっかけに"],
    explanation:
      "にもかかわらず marks the concession that the product remains popular despite its high price.",
  },
  {
    semanticId: "N2-grammar-safest-course",
    stem: "危険が少しでもあるなら、念のため計画をもう一度検討する＿＿。",
    correct: "に越したことはない",
    distractors: ["ことはない", "わけではない", "おそれがある"],
    explanation:
      "に越したことはない expresses that careful review is the best or safest course when any risk remains.",
  },
  {
    semanticId: "N2-grammar-result-due-to-revision",
    stem: "今回、作業時間が短くなったのは、手順を見直した＿＿。",
    correct: "ことによる",
    distractors: ["ほどである", "ものがある", "わけにはいかない"],
    explanation:
      "ことによる identifies revising the procedure as the cause of the shorter work time.",
  },
  {
    semanticId: "N2-grammar-worse-after-repair",
    stem: "機械を修理したのに、音が小さくなる＿＿、前より大きくなった。",
    correct: "どころか",
    distractors: ["にしたがって", "に比べて", "に応じて"],
    explanation:
      "どころか reverses the expected result: rather than becoming quieter after repair, the machine became louder.",
  },
] satisfies readonly IdentifiedSeed<ClozeSeed>[];

export const N2_COMPOSITION_EXPANSION = [
  {
    semanticId: "N2-composition-interpret-survey-conditions",
    prefix: "調査結果を",
    parts: [
      "そのまま受け入れるのではなく",
      "条件の違いも",
      "考慮して",
      "解釈すべきです",
    ],
    suffix: "。",
    explanation:
      "The rejection of uncritical acceptance is followed by the additional object 条件の違いも and the linked predicate 考慮して解釈すべきです.",
  },
  {
    semanticId: "N2-composition-benefit-and-new-problem",
    prefix: "この制度は",
    parts: [
      "利用者の負担を",
      "減らす一方で",
      "新たな問題を",
      "生む可能性もあります",
    ],
    suffix: "。",
    explanation:
      "利用者の負担を減らす一方で introduces one effect before the contrasting possibility of creating a new problem.",
  },
  {
    semanticId: "N2-composition-confirm-facts-first",
    prefix: "会議では",
    parts: [
      "結論を急ぐより",
      "まず事実関係を",
      "確認することが",
      "求められます",
    ],
    suffix: "。",
    explanation:
      "結論を急ぐより sets the rejected priority, followed by the nominalized action 事実関係を確認することが and its passive evaluation.",
  },
  {
    semanticId: "N2-composition-open-discussion-environment",
    prefix: "経験の有無を",
    parts: ["問わず", "意見を出し合える", "環境を整えることが", "大切です"],
    suffix: "。",
    explanation:
      "経験の有無を問わず modifies the inclusive condition, while 意見を出し合える modifies the environment that should be created.",
  },
  {
    semanticId: "N2-composition-analyze-before-failure-judgment",
    prefix: "予定どおりに",
    parts: [
      "進まなかったとしても",
      "原因を分析せずに",
      "失敗だと",
      "決めるべきではありません",
    ],
    suffix: "。",
    explanation:
      "The concessive condition precedes 原因を分析せずに, and the quoted judgment 失敗だと completes 決めるべきではありません.",
  },
] satisfies readonly IdentifiedSeed<CompositionSeed>[];

export const N2_WORD_FORMATION_EXPANSION = [
  {
    semanticId: "N2-word-formation-digitization",
    focus: "〜化",
    stem: "紙の記録をデータにして、管理の電子＿＿を進めた。",
    correct: "化",
    distractors: ["性", "者", "率"],
    explanation:
      "電子化 is the established derivative meaning conversion into electronic or digital form.",
  },
  {
    semanticId: "N2-word-formation-resume-operation",
    focus: "再〜",
    stem: "安全を確認した上で、止めていた機械の運転を＿＿開した。",
    correct: "再",
    distractors: ["未", "不", "無"],
    explanation:
      "再開 means starting an interrupted activity again, which fits resuming operation after a safety check.",
  },
  {
    semanticId: "N2-word-formation-unresolved-issue",
    focus: "未〜",
    stem: "原因がまだ分からない＿＿解決の問題が、いくつか残っている。",
    correct: "未",
    distractors: ["不", "無", "再"],
    explanation:
      "未解決 is the standard compound for a problem that has not yet been resolved.",
  },
  {
    semanticId: "N2-word-formation-reproducibility",
    focus: "〜性",
    stem: "同じ結果が得られるかを調べ、実験方法の再現＿＿を確かめた。",
    correct: "性",
    distractors: ["化", "率", "者"],
    explanation:
      "再現性 is the noun for reproducibility, the quality of producing the same result again.",
  },
] satisfies readonly IdentifiedSeed<WordFormationSeed>[];

export const N2_LANGUAGE_EXPANSION_SOURCE_COUNT =
  N2_LEXEME_EXPANSION.length +
  N2_CONTEXT_EXPANSION.length +
  N2_USAGE_EXPANSION.length +
  N2_GRAMMAR_EXPANSION.length +
  N2_COMPOSITION_EXPANSION.length +
  N2_WORD_FORMATION_EXPANSION.length;
