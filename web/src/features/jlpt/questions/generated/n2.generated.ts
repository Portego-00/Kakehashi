import { OFFICIAL_TYPES_BY_LEVEL } from "../../structure";
import {
  buildGeneratedQuestionBank,
  type LevelQuestionProfile,
  type LexemeSeed,
} from "./bank-builder";
import {
  N2_COMPOSITION_EXPANSION,
  N2_CONTEXT_EXPANSION,
  N2_GRAMMAR_EXPANSION,
  N2_LEXEME_EXPANSION,
  N2_USAGE_EXPANSION,
  N2_WORD_FORMATION_EXPANSION,
} from "./n2-language-expansion";
import { N2_TEXT_GRAMMAR_SEEDS } from "./text-grammar-seeds";
import { upperListeningSeeds } from "./upper-listening-seeds";
import { N2_UPPER_READING_SEEDS } from "./upper-reading-seeds";

const lexemes: readonly LexemeSeed[] = [
  {
    surface: "促進",
    reading: "そくしん",
    readingDistractors: ["そくじん", "そっしん", "ぞくしん"],
    kana: "そくしん",
    spellingDistractors: ["足進", "促信", "則進"],
    sentence: "交流を促進するため、定期的な意見交換の場を設けた。",
    paraphrase: "進みやすくする",
    paraphraseDistractors: ["完全に止める", "関係を隠す", "順番を逆にする"],
  },
  {
    surface: "妥当",
    reading: "だとう",
    readingDistractors: ["たとう", "だどう", "だまさ"],
    kana: "だとう",
    spellingDistractors: ["妥等", "打当", "妥倒"],
    sentence: "現在の資料だけで結論を出すのは妥当ではない。",
    paraphrase: "適切で筋が通っている",
    paraphraseDistractors: [
      "新しくて目立っている",
      "複雑で理解できない",
      "強く禁止されている",
    ],
  },
  {
    surface: "維持",
    reading: "いじ",
    readingDistractors: ["ゆいじ", "いし", "いぢ"],
    kana: "いじ",
    spellingDistractors: ["維待", "意持", "維時"],
    sentence: "品質を維持しながら、費用を減らす方法を検討する。",
    paraphrase: "同じ状態を保つ",
    paraphraseDistractors: [
      "急に悪化させる",
      "一度だけ確認する",
      "別の場所へ移す",
    ],
  },
  {
    surface: "配慮",
    reading: "はいりょ",
    readingDistractors: ["はいろ", "ばいりょ", "はいりょう"],
    kana: "はいりょ",
    spellingDistractors: ["配旅", "杯慮", "配虜"],
    sentence: "利用者の安全に配慮した設計が求められる。",
    paraphrase: "事情を考えて気を配る",
    paraphraseDistractors: [
      "責任をすべて断る",
      "数字だけを暗記する",
      "予定を急に取り消す",
    ],
  },
  {
    surface: "把握",
    reading: "はあく",
    readingDistractors: ["はおく", "わあく", "はかく"],
    kana: "はあく",
    spellingDistractors: ["把屋", "波握", "把悪"],
    sentence: "担当者は問題の全体像を把握してから対応を決めた。",
    paraphrase: "内容や状態をつかむ",
    paraphraseDistractors: [
      "事実をわざと隠す",
      "最初からやり直す",
      "細部を忘れる",
    ],
  },
  {
    surface: "柔軟",
    reading: "じゅうなん",
    readingDistractors: ["じゅなん", "にゅうなん", "じゅうだん"],
    kana: "じゅうなん",
    spellingDistractors: ["柔難", "重軟", "柔南"],
    sentence: "状況の変化に柔軟に対応する必要がある。",
    paraphrase: "変化に合わせて方法を変えられる",
    paraphraseDistractors: [
      "一つの方法を絶対に変えない",
      "判断を他人に任せる",
      "理由を説明しない",
    ],
  },
  {
    surface: "整備",
    reading: "せいび",
    readingDistractors: ["せいひ", "しょうび", "せび"],
    kana: "せいび",
    spellingDistractors: ["設備", "整美", "正備"],
    sentence: "地域の交通環境を整備する計画が発表された。",
    paraphrase: "使いやすい状態に整える",
    paraphraseDistractors: [
      "利用を一時禁止する",
      "古い記録を捨てる",
      "人の数を数える",
    ],
  },
  {
    surface: "負担",
    reading: "ふたん",
    readingDistractors: ["ぶたん", "ふだん", "まけたん"],
    kana: "ふたん",
    spellingDistractors: ["負段", "不担", "負単"],
    sentence: "手続きを簡単にして、利用者の負担を減らした。",
    paraphrase: "費用や手間などの重荷",
    paraphraseDistractors: [
      "期待される成果",
      "安全を守る規則",
      "自由に使える時間",
    ],
  },
  {
    surface: "方針",
    reading: "ほうしん",
    readingDistractors: ["ほうじん", "かたしん", "ほしん"],
    kana: "ほうしん",
    spellingDistractors: ["方新", "法針", "方伸"],
    sentence: "会社は環境への負担を減らす方針を示した。",
    paraphrase: "行動の基本となる考え方",
    paraphraseDistractors: [
      "過去の細かな記録",
      "個人だけの感想",
      "一時的な事故",
    ],
  },
  {
    surface: "傾向",
    reading: "けいこう",
    readingDistractors: ["けいごう", "きょうこう", "けいむき"],
    kana: "けいこう",
    spellingDistractors: ["傾行", "係向", "傾効"],
    sentence: "若い世代ほど電子版を選ぶ傾向が見られた。",
    paraphrase: "ある方向に偏りやすい様子",
    paraphraseDistractors: [
      "例外が一つもない規則",
      "完全に偶然な出来事",
      "すでに終わった計画",
    ],
  },
  ...N2_LEXEME_EXPANSION,
];

const profile = {
  level: "N2",
  complexity: 4,
  listeningRate: 1.04,
  names: [
    "田中",
    "山田",
    "佐藤",
    "鈴木",
    "高橋",
    "伊藤",
    "渡辺",
    "中村",
    "小林",
    "加藤",
    "吉田",
    "山本",
    "松本",
    "井上",
    "木村",
    "斎藤",
    "清水",
    "山口",
    "森",
    "池田",
  ],
  places: [
    "研究所",
    "市民会館",
    "文化施設",
    "本社",
    "支援センター",
    "大学",
    "展示会場",
    "地域事務所",
    "研修施設",
    "図書館",
  ],
  lexemes,
  contexts: [
    {
      stem: "議論が予定より長引き、結論は次回に＿＿ことになった。",
      correct: "持ち越す",
      distractors: ["引き返す", "取り締まる", "差し替わる"],
      explanation:
        "結論を次回に持ち越す is the natural collocation for postponing a decision.",
    },
    {
      stem: "一部の情報だけを見て全体を＿＿するのは危険だ。",
      correct: "判断",
      distractors: ["省略", "移動", "発明"],
      explanation:
        "情報に基づいて全体を判断する is the only semantically suitable expression.",
    },
    {
      stem: "新制度の導入によって、手続きにかかる時間が大幅に＿＿された。",
      correct: "短縮",
      distractors: ["展開", "分散", "成立"],
      explanation: "時間を短縮する means to reduce the time required.",
    },
    {
      stem: "報告書は事実と意見を＿＿して書く必要がある。",
      correct: "区別",
      distractors: ["通過", "省略", "交換"],
      explanation:
        "事実と意見を区別する is a standard and unambiguous collocation.",
    },
    {
      stem: "担当者は質問の意図を正確に＿＿、簡潔に答えた。",
      correct: "読み取り",
      distractors: ["引き取り", "乗り越え", "差し上げ"],
      explanation:
        "意図を読み取る means to discern what a question is seeking.",
    },
    {
      stem: "予算が限られているため、計画の一部を＿＿せざるを得ない。",
      correct: "見直さ",
      distractors: ["見上げ", "見慣れ", "見送れ"],
      explanation:
        "見直さざるを得ない means there is no choice but to revise part of the plan.",
    },
    {
      stem: "利用者の要望をすべて受け入れるのは＿＿ではない。",
      correct: "現実的",
      distractors: ["積極", "具体", "一時"],
      explanation:
        "現実的ではない naturally evaluates an infeasible attempt to satisfy every request.",
    },
    {
      stem: "異なる立場の人が話し合うことで、新しい視点が＿＿。",
      correct: "得られる",
      distractors: ["減らされる", "断られる", "閉じられる"],
      explanation:
        "A new perspective can be obtained through discussion: 視点が得られる.",
    },
    {
      stem: "その説明では、なぜ変更が必要なのかが＿＿伝わらない。",
      correct: "十分に",
      distractors: ["一斉に", "偶然に", "勝手に"],
      explanation:
        "十分に伝わらない directly describes an explanation that does not adequately convey the reason.",
    },
    {
      stem: "複数の案を比較した上で、最も費用対効果の高いものを＿＿。",
      correct: "採用した",
      distractors: ["発生した", "到着した", "通過した"],
      explanation:
        "An organization 採用する a proposal after comparing alternatives.",
    },
    ...N2_CONTEXT_EXPANSION,
  ],
  usages: [
    {
      focus: "踏まえる",
      correct: "調査結果を踏まえて、計画を修正した。",
      distractors: [
        "案内図で道順を踏まえて駅まで歩いた。",
        "会議資料を机の上に踏まえておいた。",
        "強い雨を足元で踏まえながら進んだ。",
      ],
      explanation:
        "結果を踏まえて means taking findings into account; the distractors require 確認する, 置く, or 踏む.",
    },
    {
      focus: "補う",
      correct: "不足している説明を図で補った。",
      distractors: [
        "開始が遅れたので、会議を三時に補った。",
        "本数を増やして朝の電車を補った。",
        "欠席した{person}さんを別の席で補った。",
      ],
      explanation:
        "A diagram can supplement missing explanation; the distractors require 延ばす, 増発する, or 代える.",
    },
    {
      focus: "及ぼす",
      correct: "制度の変更は多くの利用者に影響を及ぼす。",
      distractors: [
        "必要な資料を机の上まで及ぼした。",
        "駅まで歩いて予定の時間に及ぼした。",
        "質問への答えを詳しく及ぼした。",
      ],
      explanation:
        "影響を及ぼす is the standard collocation; the distractors require 届ける, 間に合わせる, or 述べる.",
    },
    {
      focus: "免れる",
      correct: "早く対応したため、大きな混乱は免れた。",
      distractors: [
        "{person}さんは都合が悪くて会議を免れた。",
        "読み終えた本を棚の上に免れた。",
        "料理が冷めないよう温かく免れた。",
      ],
      explanation:
        "混乱を免れる means to escape harm; the distractors require 欠席する, 戻す, or 保つ.",
    },
    {
      focus: "見込む",
      correct: "来年度は利用者が二割増えると見込んでいる。",
      distractors: [
        "窓から遠くの山を見込んだ。",
        "駅の入口を見込んでまっすぐ歩いた。",
        "必要な資料を箱の中に見込んだ。",
      ],
      explanation:
        "見込む correctly expresses a projection; the distractors require 眺める, 目指す, or 入れる.",
    },
    {
      focus: "伴う",
      correct: "新しい制度の導入には一定の費用が伴う。",
      distractors: [
        "{person}さんは資料を伴って説明会へ来た。",
        "雨を伴いながら静かに本を読んだ。",
        "大きな机が四つのいすを伴っている。",
      ],
      explanation:
        "費用が伴う is a natural abstract relation; the distractors require 持参する, 聞く, or 備える.",
    },
    {
      focus: "損なう",
      correct: "不十分な説明は利用者の信頼を損なう。",
      distractors: [
        "駅で大切な切符を損なってしまった。",
        "会議の開始時刻を三時に損なった。",
        "道を間違えて右へ損なった。",
      ],
      explanation:
        "信頼を損なう means to damage trust; the distractors require なくす, 変更する, or 曲がる.",
    },
    {
      focus: "取り巻く",
      correct: "働き方を取り巻く環境は大きく変化している。",
      distractors: [
        "本を紙で取り巻いてからかばんに入れた。",
        "公園を通る道が駅を取り巻いている。",
        "{person}さんは会議の時間を予定で取り巻いた。",
      ],
      explanation:
        "An environment can surround a social issue; the distractors require 包む, つなぐ, or 埋める.",
    },
    {
      focus: "沿う",
      correct: "利用者の希望に沿う形で時間を変更した。",
      distractors: [
        "駅の案内に沿って電車を降りた。",
        "資料の端を机に沿って置いた。",
        "雨の強さが一日の予定に沿った。",
      ],
      explanation:
        "希望に沿う means to conform to a request; the distractors require 従う, そろえる, or 影響する.",
    },
    {
      focus: "欠く",
      correct: "根拠を欠く主張には同意できない。",
      distractors: [
        "{person}さんは乗る予定の駅を欠いた。",
        "資料を三枚欠いて参加者に配った。",
        "大雨で道路の一部を欠いた。",
      ],
      explanation:
        "根拠を欠く means to lack grounds; the distractors require 乗り過ごす, 減らす, or 壊す.",
    },
    ...N2_USAGE_EXPANSION,
  ],
  grammar: [
    {
      stem: "説明を読んだからといって、すぐ使いこなせる＿＿。",
      correct: "とは限らない",
      distractors: ["に違いない", "しかない", "ことになった"],
      explanation:
        "からといって...とは限らない rejects an overgeneralized conclusion.",
    },
    {
      stem: "費用を抑える＿＿、安全性を下げてはいけない。",
      correct: "一方で",
      distractors: ["ばかりに", "ところを", "ことから"],
      explanation:
        "一方で balances cost control against the need to preserve safety.",
    },
    {
      stem: "この方法は簡単である＿＿、効果が高いとは言えない。",
      correct: "ものの",
      distractors: ["だけに", "ことに", "ほどに"],
      explanation:
        "ものの introduces a concession: it is easy, but not necessarily effective.",
    },
    {
      stem: "専門家の助言＿＿、計画を見直した。",
      correct: "をもとに",
      distractors: ["に反してを", "をめぐってを", "に加えてを"],
      explanation:
        "をもとに indicates the source or basis used for the revision.",
    },
    {
      stem: "状況が変わり＿＿、方針も柔軟に調整すべきだ。",
      correct: "次第",
      distractors: ["かけ", "きり", "向け"],
      explanation: "変わり次第 means as soon as the situation changes.",
    },
    {
      stem: "担当者でさえ判断できないのだから、初心者に分かる＿＿。",
      correct: "わけがない",
      distractors: ["ことがある", "にすぎない", "おそれがある"],
      explanation:
        "わけがない expresses the strong logical impossibility established by the premise.",
    },
    {
      stem: "結果は、条件の設定＿＿大きく変わる。",
      correct: "によって",
      distractors: ["にとって", "に対して", "について"],
      explanation: "によって marks the factor on which the outcome depends.",
    },
    {
      stem: "一度決めた方針でも、必要＿＿見直すべきだ。",
      correct: "に応じて",
      distractors: ["に限って", "に比べて", "に代わって"],
      explanation: "必要に応じて means whenever circumstances require it.",
    },
    {
      stem: "制度を導入する＿＿、十分な説明が欠かせない。",
      correct: "にあたって",
      distractors: ["につれて", "に反して", "にかけて"],
      explanation:
        "にあたって sets the occasion for a significant undertaking.",
    },
    {
      stem: "反対意見があることは承知している。＿＿、試行する価値はある。",
      correct: "それでもなお",
      distractors: ["それどころか", "そのためだけ", "したがっては"],
      explanation:
        "それでもなお preserves the conclusion despite acknowledged opposition.",
    },
    ...N2_GRAMMAR_EXPANSION,
  ],
  compositions: [
    {
      prefix: "この結論は",
      parts: ["複数の調査結果を", "踏まえた", "上で", "出されたものです"],
      suffix: "。",
      explanation:
        "調査結果を踏まえた上で forms the basis phrase before the passive conclusion.",
    },
    {
      prefix: "制度を",
      parts: [
        "導入したからといって",
        "問題がすべて",
        "解決する",
        "とは限りません",
      ],
      suffix: "。",
      explanation:
        "からといって pairs with とは限りません around the proposition.",
    },
    {
      prefix: "費用を",
      parts: ["抑えつつ", "質を", "維持する方法を", "検討しています"],
      suffix: "。",
      explanation:
        "抑えつつ links the concurrent constraint to the object and main verb.",
    },
    {
      prefix: "結果が",
      parts: [
        "予想と",
        "異なったとしても",
        "直ちに失敗だと",
        "判断すべきではありません",
      ],
      suffix: "。",
      explanation:
        "The concessive condition precedes the rejected immediate judgment.",
    },
    {
      prefix: "{person}さんは",
      parts: [
        "経験が",
        "豊富であるばかりか",
        "説明も",
        "非常に分かりやすいです",
      ],
      suffix: "。",
      explanation:
        "ばかりか adds the second positive quality expressed after it.",
    },
    {
      prefix: "利用者の",
      parts: ["立場に立って", "手続きを", "見直すことが", "求められています"],
      suffix: "。",
      explanation:
        "The viewpoint phrase precedes the nominalized revision required by the passive expression.",
    },
    {
      prefix: "報告を",
      parts: ["受け次第", "内容を確認して", "関係者に", "連絡してください"],
      suffix: "。",
      explanation:
        "受け次第 marks immediate timing before the sequential requested actions.",
    },
    {
      prefix: "この案には",
      parts: ["検討すべき点が", "残っているものの", "試す", "価値はあります"],
      suffix: "。",
      explanation:
        "ものの concedes remaining issues before asserting the trial's value.",
    },
    {
      prefix: "予定を",
      parts: [
        "変更するにあたって",
        "参加者の都合を",
        "確認せずには",
        "いられません",
      ],
      suffix: "。",
      explanation:
        "The occasion phrase is followed by the unavoidable need to check availability.",
    },
    {
      prefix: "説明が",
      parts: [
        "不十分だったために",
        "誤解を",
        "招く結果と",
        "なってしまいました",
      ],
      suffix: "。",
      explanation:
        "The cause leads to 誤解を招く結果となる as one predicate sequence.",
    },
    ...N2_COMPOSITION_EXPANSION,
  ],
  textGrammar: N2_TEXT_GRAMMAR_SEEDS,
  upperListening: upperListeningSeeds.filter((seed) => seed.level === "N2"),
  upperReading: N2_UPPER_READING_SEEDS,
  wordFormation: [
    {
      focus: "再〜",
      stem: "使用済みの容器を洗って＿＿する仕組みを始めた。",
      correct: "再利用",
      distractors: ["再意見", "再費用", "再安全"],
      explanation:
        "再- combines with 利用 to mean using something again: 再利用.",
    },
    {
      focus: "未〜",
      stem: "調査が終わっていないため、原因はまだ＿＿だ。",
      correct: "未確定",
      distractors: ["未説明者", "未制度", "未結果化"],
      explanation: "未- plus 確定 forms 未確定, not yet determined.",
    },
    {
      focus: "不〜",
      stem: "説明が十分でなく、参加者から＿＿の声が出た。",
      correct: "不満",
      distractors: ["不参加会", "不資料", "不予定者"],
      explanation: "不満 is the established word for dissatisfaction.",
    },
    {
      focus: "〜化",
      stem: "手続きをオンラインにして、作業の効率＿＿を進めた。",
      correct: "化",
      distractors: ["性", "者", "的"],
      explanation:
        "効率化 is the derivative meaning making a process more efficient.",
    },
    {
      focus: "〜性",
      stem: "複数の結果を比べ、方法の有効＿＿を検討した。",
      correct: "性",
      distractors: ["化", "者", "中"],
      explanation: "有効性 is the noun meaning effectiveness or validity.",
    },
    {
      focus: "無〜",
      stem: "事前の連絡がなく会議を休む＿＿欠席が問題になった。",
      correct: "無断",
      distractors: ["無連絡者", "無会議", "無予定化"],
      explanation:
        "無断欠席 is the fixed compound for an absence without notice or permission.",
    },
    {
      focus: "〜向け",
      stem: "この説明書は初めて使う人＿＿に書かれている。",
      correct: "向け",
      distractors: ["的", "性", "化"],
      explanation: "初心者向け means intended or designed for beginners.",
    },
    {
      focus: "〜率",
      stem: "参加者のうち最後まで続けた人の継続＿＿を調べた。",
      correct: "率",
      distractors: ["化", "者", "的"],
      explanation: "継続率 is the proportion of people who continued.",
    },
    {
      focus: "超〜",
      stem: "従来より非常に小さい＿＿小型センサーが開発された。",
      correct: "超",
      distractors: ["再", "未", "無"],
      explanation: "超小型 is the conventional compound meaning ultra-compact.",
    },
    {
      focus: "〜者",
      stem: "制度を実際に利用した経験＿＿から話を聞いた。",
      correct: "者",
      distractors: ["化", "性", "率"],
      explanation: "経験者 means a person who has experience with something.",
    },
    ...N2_WORD_FORMATION_EXPANSION,
  ],
} satisfies LevelQuestionProfile;

export const N2_GENERATED_QUESTIONS = buildGeneratedQuestionBank(
  profile,
  OFFICIAL_TYPES_BY_LEVEL.N2,
);
