import { OFFICIAL_TYPES_BY_LEVEL } from "../../structure";
import {
  buildGeneratedQuestionBank,
  type LevelQuestionProfile,
  type LexemeSeed,
} from "./bank-builder";
import {
  N1_COMPOSITION_EXPANSION,
  N1_CONTEXT_EXPANSION,
  N1_GRAMMAR_EXPANSION,
  N1_LEXEME_EXPANSION,
  N1_USAGE_EXPANSION,
} from "./n1-language-expansion";
import { N1_TEXT_GRAMMAR_SEEDS } from "./text-grammar-seeds";
import { upperListeningSeeds } from "./upper-listening-seeds";
import { N1_UPPER_READING_SEEDS } from "./upper-reading-seeds";

const lexemes: readonly LexemeSeed[] = [
  {
    surface: "脆弱",
    reading: "ぜいじゃく",
    readingDistractors: ["きじゃく", "ぜいにゃく", "もろじゃく"],
    kana: "ぜいじゃく",
    spellingDistractors: ["危弱", "脆若", "勢弱"],
    sentence: "{person}氏は、現行制度の脆弱な部分を具体的に指摘した。",
    paraphrase: "もろくて弱い",
    paraphraseDistractors: [
      "柔軟で変えやすい",
      "十分に普及している",
      "複雑だが安定している",
    ],
  },
  {
    surface: "踏襲",
    reading: "とうしゅう",
    readingDistractors: ["ふしゅう", "とうじゅう", "ふとう"],
    kana: "とうしゅう",
    spellingDistractors: ["踏修", "登襲", "踏習"],
    sentence: "{person}氏は従来の方針をそのまま踏襲することに疑問を呈した。",
    paraphrase: "前のやり方を受け継ぐ",
    paraphraseDistractors: [
      "制度を全面的に廃止する",
      "結論を意図的に隠す",
      "無関係な案を付け加える",
    ],
  },
  {
    surface: "示唆",
    reading: "しさ",
    readingDistractors: ["じさ", "ししゃ", "しそう"],
    kana: "しさ",
    spellingDistractors: ["指差", "示佐", "思唆"],
    sentence: "今回の結果は、別の要因が関与している可能性を示唆している。",
    paraphrase: "直接断定せず可能性を表している",
    paraphraseDistractors: [
      "事実ではないと完全に否定している",
      "今後の予定を正式に命令している",
      "過去の判断を取り消している",
    ],
  },
  {
    surface: "看過",
    reading: "かんか",
    readingDistractors: ["かんが", "けんか", "かんこう"],
    kana: "かんか",
    spellingDistractors: ["観過", "看化", "感過"],
    sentence: "安全に関わる小さな兆候を看過するわけにはいかない。",
    paraphrase: "問題として扱わず見逃す",
    paraphraseDistractors: [
      "詳しく記録して共有する",
      "あらかじめ危険を取り除く",
      "複数の案を公平に比べる",
    ],
  },
  {
    surface: "懸念",
    reading: "けねん",
    readingDistractors: ["けんねん", "かねん", "けれん"],
    kana: "けねん",
    spellingDistractors: ["県念", "懸年", "権念"],
    sentence: "{person}氏は、拙速な導入が混乱を招くと懸念を示した。",
    paraphrase: "悪い結果になるのではないかと心配した",
    paraphraseDistractors: [
      "必ず成功すると保証した",
      "問題は解決済みだと断言した",
      "評価する必要はないと述べた",
    ],
  },
  {
    surface: "乖離",
    reading: "かいり",
    readingDistractors: ["かくり", "はいり", "かいれい"],
    kana: "かいり",
    spellingDistractors: ["解離", "乖利", "皆離"],
    sentence: "制度の理念と実際の運用との乖離が指摘されている。",
    paraphrase: "二つの間に隔たりがあること",
    paraphraseDistractors: [
      "完全に一致していること",
      "徐々に普及していること",
      "互いに支え合っていること",
    ],
  },
  {
    surface: "帰結",
    reading: "きけつ",
    readingDistractors: ["きけち", "かけつ", "きっけつ"],
    kana: "きけつ",
    spellingDistractors: ["帰決", "規結", "気潔"],
    sentence: "その選択がどのような帰結をもたらすか、慎重に検討すべきだ。",
    paraphrase: "最終的に生じる結果",
    paraphraseDistractors: [
      "議論を始めるきっかけ",
      "途中で使う道具",
      "前提とは無関係な意見",
    ],
  },
  {
    surface: "是正",
    reading: "ぜせい",
    readingDistractors: ["せせい", "ぜしょう", "ぜひら"],
    kana: "ぜせい",
    spellingDistractors: ["是正い", "世整", "善正"],
    sentence: "不公平な扱いを是正するため、基準が改められた。",
    paraphrase: "悪い状態を正す",
    paraphraseDistractors: [
      "現状をそのまま認める",
      "判断を先送りする",
      "別の問題に置き換える",
    ],
  },
  {
    surface: "顕在化",
    reading: "けんざいか",
    readingDistractors: ["けんさいか", "げんざいか", "けんぞんか"],
    kana: "けんざいか",
    spellingDistractors: ["健在化", "顕財化", "現在化"],
    sentence: "利用者が増えるにつれ、従来見えなかった課題が顕在化した。",
    paraphrase: "隠れていたものがはっきり現れる",
    paraphraseDistractors: [
      "すでに解決したことを忘れる",
      "複数の問題を一つにまとめる",
      "意見の違いを意図的に隠す",
    ],
  },
  {
    surface: "矛盾",
    reading: "むじゅん",
    readingDistractors: ["むしゅん", "ぼじゅん", "むじゅう"],
    kana: "むじゅん",
    spellingDistractors: ["予盾", "矛順", "無盾"],
    sentence: "効率を求めながら手続きを増やす方針には矛盾がある。",
    paraphrase: "二つの内容が両立しない",
    paraphraseDistractors: [
      "目的と手段が完全に一致する",
      "説明が具体的で分かりやすい",
      "複数の方法を順に試している",
    ],
  },
  ...N1_LEXEME_EXPANSION,
];

const profile = {
  level: "N1",
  complexity: 5,
  listeningRate: 1.1,
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
    "研究機関",
    "審議会",
    "公共施設",
    "自治体",
    "教育機関",
    "文化施設",
    "医療機関",
    "地域協議会",
    "調査委員会",
    "政策研究所",
  ],
  lexemes,
  contexts: [
    {
      stem: "限られた事例から一般的な結論を導くのは＿＿だ。",
      correct: "早計",
      distractors: ["円滑", "精密", "温厚"],
      explanation:
        "早計 describes a conclusion reached prematurely without sufficient evidence.",
    },
    {
      stem: "説明責任を果たさないまま計画を進めれば、不信を＿＿ことになる。",
      correct: "招く",
      distractors: ["遂げる", "免れる", "掲げる"],
      explanation:
        "不信を招く is the natural collocation meaning to cause or invite distrust.",
    },
    {
      stem: "従来の前提を＿＿にせず、状況に応じて検証し直すべきだ。",
      correct: "うのみに",
      distractors: ["おざなり", "ひたむき", "おおむね"],
      explanation:
        "うのみにする means to accept an assertion uncritically, fitting the call to re-examine assumptions.",
    },
    {
      stem: "関係者の合意がないまま、計画が＿＿進められた。",
      correct: "なし崩しに",
      distractors: ["ひたすらに", "あらかじめ", "ことごとく"],
      explanation:
        "なし崩しに describes gradual implementation without an explicit formal decision.",
    },
    {
      stem: "複数の指標が同じ傾向を示しており、主張の妥当性を＿＿いる。",
      correct: "裏付けて",
      distractors: ["差し控えて", "取り締まって", "引き延ばして"],
      explanation:
        "Evidence or indicators 裏付ける a claim by supporting its validity.",
    },
    {
      stem: "個別の事情を無視した一律の対応では、問題の解決は＿＿。",
      correct: "おぼつかない",
      distractors: ["目覚ましい", "紛れもない", "余儀ない"],
      explanation:
        "おぼつかない means unlikely or uncertain to succeed in this evaluative context.",
    },
    {
      stem: "制度の趣旨は理解できるが、実施方法には＿＿の余地がある。",
      correct: "再考",
      distractors: ["返還", "妥協的", "均衡化"],
      explanation:
        "再考の余地がある is the conventional expression meaning there is room for reconsideration.",
    },
    {
      stem: "短期的な成果に目を奪われ、長期的な影響を＿＿にしてはならない。",
      correct: "ないがしろ",
      distractors: ["ありのまま", "ひたすら", "ことさら"],
      explanation:
        "ないがしろにする means to neglect something that deserves attention.",
    },
    {
      stem: "議論は論点が整理されないまま＿＿し、結論に至らなかった。",
      correct: "紛糾",
      distractors: ["円熟", "緩和", "普及"],
      explanation:
        "紛糾する describes a discussion becoming tangled and contentious.",
    },
    {
      stem: "新たな証拠によって、それまでの説明は＿＿から見直す必要が生じた。",
      correct: "根底",
      distractors: ["手元", "間際", "表面上"],
      explanation:
        "根底から見直す means to reconsider something from its foundations.",
    },
    ...N1_CONTEXT_EXPANSION,
  ],
  usages: [
    {
      focus: "看過",
      correct: "小さくても安全上の問題は看過できない。",
      distractors: [
        "審議会は新しい案を全会一致で看過した。",
        "担当者は資料を机の上に看過して帰った。",
        "{person}氏は駅までの経路を看過して歩いた。",
      ],
      explanation:
        "看過できない correctly means a problem cannot be overlooked; the distractors require 採択, 放置, or 確認.",
    },
    {
      focus: "打開",
      correct: "交渉の停滞を打開するため、第三者が加わった。",
      distractors: [
        "室内の空気を入れ替えるため窓を打開した。",
        "資料を人数分に打開して配布した。",
        "交差点で道を右に打開した。",
      ],
      explanation:
        "A deadlock can be broken with 打開する; the distractors require 開ける, 分ける, or 曲がる.",
    },
    {
      focus: "露呈",
      correct: "調査によって管理体制の弱点が露呈した。",
      distractors: [
        "{person}氏は意見を文書に露呈して提出した。",
        "改札で職員に切符を露呈した。",
        "新制度を来年四月に露呈する予定だ。",
      ],
      explanation:
        "A hidden weakness can become exposed; the distractors require 記載, 提示, or 導入.",
    },
    {
      focus: "一蹴",
      correct: "委員長は根拠がないとして、その批判を一蹴した。",
      distractors: [
        "委員は論点を一時間にわたって一蹴した。",
        "担当者は資料を参加者に一蹴ずつ配った。",
        "混雑を避けて駅までの道を一蹴した。",
      ],
      explanation:
        "批判を一蹴する means to dismiss it decisively; the distractors require 議論, 一部, or 一周.",
    },
    {
      focus: "翻す",
      correct: "新たな証拠を受け、当初の判断を翻した。",
      distractors: [
        "読み終えた本を机から棚へ翻した。",
        "参加者の希望を受けて会議を三時に翻した。",
        "予算不足のため費用を二割翻した。",
      ],
      explanation:
        "判断を翻す means to reverse it; the distractors require 移す, 変更する, or 削減する.",
    },
    {
      focus: "相殺",
      correct: "経費の増加が売上の伸びを相殺してしまった。",
      distractors: [
        "{person}氏は反対意見を相殺してから結論を述べた。",
        "古い資料を相殺して電子版だけ保存した。",
        "負担を減らす制度を来月から相殺する。",
      ],
      explanation:
        "One quantitative effect can offset another; the distractors require 整理, 廃棄, or 導入.",
    },
    {
      focus: "示唆",
      correct: "この結果は別の要因がある可能性を示唆している。",
      distractors: [
        "責任者は担当者に来月の予定を示唆した。",
        "必要な資料を保管箱へ示唆した。",
        "駅員に切符を示唆して改札を通った。",
      ],
      explanation:
        "Evidence can suggest a possibility indirectly; the distractors require 指示, 収納, or 提示.",
    },
    {
      focus: "阻害",
      correct: "過度な規則が現場の柔軟な判断を阻害している。",
      distractors: [
        "{person}氏は調査報告を阻害して委員会に提出した。",
        "読み終えた本を棚に阻害した。",
        "予算案では費用を二割阻害した。",
      ],
      explanation:
        "A constraint can hinder judgment; the distractors require 作成, 戻す, or 削減.",
    },
    {
      focus: "踏襲",
      correct: "前任者の手順を無条件に踏襲する必要はない。",
      distractors: [
        "古い建物の階段を一段ずつ踏襲した。",
        "確認済みの資料を踏襲して机に置いた。",
        "予定の変更を知らせるため{person}氏へ電話を踏襲した。",
      ],
      explanation:
        "A predecessor's procedure can be inherited with 踏襲する; the distractors require 上る, 運ぶ, or かける.",
    },
    {
      focus: "顕在化",
      correct: "利用が広がるにつれ、新たな課題が顕在化した。",
      distractors: [
        "担当者は顕在化した質問に順番に答えた。",
        "到着した電車が駅のホームに顕在化した。",
        "会議資料を顕在化して参加者に配布した。",
      ],
      explanation:
        "A hidden issue can become manifest; the distractors require 提示された, 姿を見せた, or 印刷した.",
    },
    ...N1_USAGE_EXPANSION,
  ],
  grammar: [
    {
      stem: "結果が伴わない以上、方針を＿＿。",
      correct: "見直さざるを得ない",
      distractors: [
        "見直すにはあたらない",
        "見直すまでもない",
        "見直したところだ",
      ],
      explanation:
        "The failed results make revision unavoidable; the other complete forms contradict the explicit 以上 premise.",
    },
    {
      stem: "利便性を優先するあまり、安全への配慮を欠いては＿＿。",
      correct: "本末転倒だ",
      distractors: ["余儀なくされる", "やぶさかではない", "極まりないそうだ"],
      explanation:
        "本末転倒 evaluates prioritizing a means so heavily that the essential goal is undermined.",
    },
    {
      stem: "十分な検証なくして、制度への信頼は＿＿。",
      correct: "得られない",
      distractors: ["得るにたえない", "得ないでもない", "得るそばから"],
      explanation:
        "Noun plus なくして...ない means the latter cannot exist without the former.",
    },
    {
      stem: "責任者である以上、知らなかったでは＿＿。",
      correct: "済まされない",
      distractors: [
        "済むきらいがある",
        "済まないものでもない",
        "済むにひきかえ",
      ],
      explanation:
        "では済まされない rejects an excuse as insufficient for someone responsible.",
    },
    {
      stem: "制度の趣旨そのものには賛成＿＿、運用には疑問が残る。",
      correct: "こそすれ",
      distractors: ["とあって", "ならでは", "を皮切りに"],
      explanation:
        "こそすれ concedes agreement with the purpose while contrasting reservations about implementation.",
    },
    {
      stem: "どれほど精密な予測であれ、外れる可能性がない＿＿。",
      correct: "とは言い切れない",
      distractors: [
        "に越したことはない",
        "に足るに違いない",
        "べくもないそうだ",
      ],
      explanation: "とは言い切れない appropriately denies absolute certainty.",
    },
    {
      stem: "個人の努力だけで解決できるならともかく、制度全体に関わる以上、＿＿。",
      correct: "組織的な対応が不可欠だ",
      distractors: [
        "本人に任せるほかない",
        "検討するまでもない",
        "説明は不要というものだ",
      ],
      explanation:
        "ならともかく contrasts a hypothetical individual issue with the actual need for institutional action.",
    },
    {
      stem: "反対意見を封じてまで決定を急ぐのは、合理的とは＿＿。",
      correct: "言い難い",
      distractors: ["言うまでもない", "言わずにはおかない", "言ったそばからだ"],
      explanation:
        "とは言い難い gives a restrained negative evaluation appropriate to the argument.",
    },
    {
      stem: "一時的な成果をもって改革が成功したとするのは、＿＿。",
      correct: "早計というものだ",
      distractors: ["成功にかたくない", "改革を禁じ得ない", "成果の限りだ"],
      explanation:
        "というものだ frames a strong judgment that the conclusion would be premature.",
    },
    {
      stem: "不確実だからこそ、判断の根拠を示す必要があるので＿＿、説明を避けてよいわけではない。",
      correct: "あって",
      distractors: ["すら", "のみ", "きり"],
      explanation:
        "のであって sets up the corrective contrast: uncertainty requires explanation; it does not excuse avoiding it.",
    },
    ...N1_GRAMMAR_EXPANSION,
  ],
  compositions: [
    {
      prefix: "この結果だけをもって",
      parts: ["制度が", "有効だと", "断定するのは", "早計です"],
      suffix: "。",
      explanation:
        "The subject proposition leads to quotation, nominalized judgment, and predicate.",
    },
    {
      prefix: "利便性を",
      parts: ["追求するあまり", "安全への配慮を", "欠いては", "本末転倒です"],
      suffix: "。",
      explanation:
        "あまり marks excessive pursuit, followed by the unacceptable consequence and evaluation.",
    },
    {
      prefix: "十分な",
      parts: ["検証なくして", "利用者の信頼を", "得ることは", "できません"],
      suffix: "。",
      explanation:
        "なくして establishes the indispensable condition for the ability construction.",
    },
    {
      prefix: "現場の判断を",
      parts: [
        "尊重するという方針は",
        "理解できるにせよ",
        "責任の所在まで",
        "曖昧にすべきではありません",
      ],
      suffix: "。",
      explanation:
        "にせよ concedes the policy before introducing the limit on responsibility.",
    },
    {
      prefix: "説明を",
      parts: [
        "簡略化するにしても",
        "判断に必要な情報は",
        "残さなければ",
        "なりません",
      ],
      suffix: "。",
      explanation:
        "The concessive plan is constrained by the obligation to retain essential information.",
    },
    {
      prefix: "結果が",
      parts: [
        "期待に届かなかったからといって",
        "試み自体に",
        "価値がなかった",
        "とは言い切れません",
      ],
      suffix: "。",
      explanation:
        "からといって pairs with とは言い切れません around the rejected inference.",
    },
    {
      prefix: "問題を",
      parts: [
        "個人の注意不足に",
        "帰するだけでは",
        "再発を防ぐことに",
        "つながりません",
      ],
      suffix: "。",
      explanation:
        "帰するだけでは limits the approach before the negative consequence.",
    },
    {
      prefix: "制度を",
      parts: [
        "見直すにあたっては",
        "導入時の目的に",
        "立ち返る必要が",
        "あります",
      ],
      suffix: "。",
      explanation:
        "にあたっては sets the occasion, followed by the required return to original aims.",
    },
    {
      prefix: "関係者の",
      parts: [
        "合意を得ないまま",
        "計画を進めることは",
        "混乱を招き",
        "かねません",
      ],
      suffix: "。",
      explanation:
        "ないまま marks the missing condition; かねません expresses the feared consequence.",
    },
    {
      prefix: "一つの",
      parts: [
        "指標のみを根拠に",
        "全体を評価しようとする",
        "姿勢には",
        "無理があります",
      ],
      suffix: "。",
      explanation:
        "The attempted evaluation phrase modifies 姿勢, which receives the critical judgment.",
    },
    ...N1_COMPOSITION_EXPANSION,
  ],
  textGrammar: N1_TEXT_GRAMMAR_SEEDS,
  upperListening: upperListeningSeeds.filter((seed) => seed.level === "N1"),
  upperReading: N1_UPPER_READING_SEEDS,
} satisfies LevelQuestionProfile;

export const N1_GENERATED_QUESTIONS = buildGeneratedQuestionBank(
  profile,
  OFFICIAL_TYPES_BY_LEVEL.N1,
);
