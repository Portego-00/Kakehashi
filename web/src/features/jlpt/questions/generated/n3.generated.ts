import { OFFICIAL_TYPES_BY_LEVEL } from "../../structure";
import {
  buildGeneratedQuestionBank,
  type LevelQuestionProfile,
  type LexemeSeed,
} from "./bank-builder";
import {
  N3_COMPOSITION_EXPANSION,
  N3_CONTEXT_EXPANSION,
  N3_GRAMMAR_EXPANSION,
  N3_LEXEME_EXPANSION,
  N3_USAGE_EXPANSION,
} from "./n3-language-expansion";
import { N3_TEXT_GRAMMAR_SEEDS } from "./text-grammar-seeds";
import { upperListeningSeeds } from "./upper-listening-seeds";
import { N3_LOWER_READING_SEEDS } from "./lower-reading-seeds";

const lexemes: readonly LexemeSeed[] = [
  {
    surface: "影響",
    reading: "えいきょう",
    readingDistractors: ["えいぎょう", "えきょう", "かげきょう"],
    kana: "えいきょう",
    spellingDistractors: ["影強", "映響", "影教"],
    sentence: "天候の変化が試合の結果に影響した。",
    paraphrase: "結果を変える働きをした",
    paraphraseDistractors: [
      "結果と全く関係がなかった",
      "結果を前もって発表した",
      "結果を記録から消した",
    ],
  },
  {
    surface: "状況",
    reading: "じょうきょう",
    readingDistractors: ["じょきょう", "じょうぎょう", "じょうこう"],
    kana: "じょうきょう",
    spellingDistractors: ["状態", "条況", "状教"],
    sentence: "{person}さんは現場の状況を電話で説明した。",
    paraphrase: "その場がどうなっているか",
    paraphraseDistractors: [
      "そこへ行く方法",
      "以前の担当者の名前",
      "これから買う物の値段",
    ],
  },
  {
    surface: "改善",
    reading: "かいぜん",
    readingDistractors: ["かいせん", "がいぜん", "かいぜい"],
    kana: "かいぜん",
    spellingDistractors: ["改前", "開善", "改善ん"],
    sentence: "利用者の意見をもとに、サービスを改善した。",
    paraphrase: "悪い点を直してよくした",
    paraphraseDistractors: [
      "内容を変えずに続けた",
      "利用を完全に中止した",
      "ほかの人に任せた",
    ],
  },
  {
    surface: "具体的",
    reading: "ぐたいてき",
    readingDistractors: ["くたいてき", "ぐたいでき", "ぐていてき"],
    kana: "ぐたいてき",
    spellingDistractors: ["具体的く", "具対的", "具体敵"],
    sentence: "{person}さんは計画の内容を具体的に説明した。",
    paraphrase: "細かい内容が分かるように",
    paraphraseDistractors: [
      "大切な点を隠して",
      "意味が伝わらないように",
      "急に話題を変えて",
    ],
  },
  {
    surface: "確認",
    reading: "かくにん",
    readingDistractors: ["かくじん", "かにん", "かくねん"],
    kana: "かくにん",
    spellingDistractors: ["確忍", "各認", "角認"],
    sentence: "出発する前に、時間と場所を確認してください。",
    paraphrase: "間違いがないか確かめる",
    paraphraseDistractors: [
      "新しく決め直す",
      "だれにも知らせない",
      "必要な物を捨てる",
    ],
  },
  {
    surface: "適切",
    reading: "てきせつ",
    readingDistractors: ["てきせち", "てっせつ", "てききり"],
    kana: "てきせつ",
    spellingDistractors: ["適説", "的切", "適節"],
    sentence: "その場面では、もっと適切な言い方を選ぶ必要がある。",
    paraphrase: "その場合によく合っている",
    paraphraseDistractors: [
      "必要以上に古い",
      "全く関係がない",
      "説明できないほど難しい",
    ],
  },
  {
    surface: "参加",
    reading: "さんか",
    readingDistractors: ["さんが", "せんか", "さんけ"],
    kana: "さんか",
    spellingDistractors: ["参化", "三加", "参加か"],
    sentence: "{person}さんは{day}の説明会に参加する予定だ。",
    paraphrase: "集まりに加わる",
    paraphraseDistractors: [
      "集まりから帰る",
      "予定を秘密にする",
      "一人で計画を変える",
    ],
  },
  {
    surface: "責任",
    reading: "せきにん",
    readingDistractors: ["せいにん", "せきじん", "せきねん"],
    kana: "せきにん",
    spellingDistractors: ["積任", "責人", "関任"],
    sentence: "担当者には、結果を報告する責任がある。",
    paraphrase: "自分が果たすべき役目",
    paraphraseDistractors: [
      "自由に休める時間",
      "ほかの人だけの失敗",
      "すでに終わった約束",
    ],
  },
  {
    surface: "判断",
    reading: "はんだん",
    readingDistractors: ["ばんだん", "はんたん", "はんてい"],
    kana: "はんだん",
    spellingDistractors: ["判段", "半断", "判断ん"],
    sentence: "情報が少ない段階で判断するのは難しい。",
    paraphrase: "考えて決める",
    paraphraseDistractors: [
      "同じ文を暗記する",
      "大きな声で読む",
      "何も考えずに忘れる",
    ],
  },
  {
    surface: "期待",
    reading: "きたい",
    readingDistractors: ["ぎたい", "きだい", "きまち"],
    kana: "きたい",
    spellingDistractors: ["期対", "機待", "季待"],
    sentence: "新しい方法で時間が短くなると期待されている。",
    paraphrase: "そうなるだろうと望まれている",
    paraphraseDistractors: [
      "絶対に起こらないと言われている",
      "すでに失敗したと決められている",
      "だれも関心を持っていない",
    ],
  },
  ...N3_LEXEME_EXPANSION,
];

const profile = {
  level: "N3",
  complexity: 3,
  listeningRate: 0.96,
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
    "市民会館",
    "研究室",
    "交流センター",
    "支店",
    "図書館",
    "研修会場",
    "大学",
    "工場",
    "博物館",
    "地域事務所",
  ],
  lexemes,
  contexts: [
    {
      stem: "会議では、部門ごとに異なる説明があり、問題の原因について＿＿意見が出た。",
      correct: "さまざまな",
      distractors: ["共通した", "限られた", "一方的な"],
      explanation:
        "The differing explanations from each department support さまざまな: a variety of opinions were expressed.",
    },
    {
      stem: "説明が分かりにくかったので、例を使って＿＿説明した。",
      correct: "改めて",
      distractors: ["たまたま", "めったに", "まもなくを"],
      explanation:
        "改めて means again or afresh and fits explaining something again with examples.",
    },
    {
      stem: "この制度を利用するには、二つの条件を＿＿必要がある。",
      correct: "満たす",
      distractors: ["支える", "断る", "散らす"],
      explanation:
        "条件を満たす is the fixed collocation meaning to meet requirements.",
    },
    {
      stem: "{person}さんは経験が豊富なので、この仕事を＿＿ことになった。",
      correct: "任される",
      distractors: ["断らせる", "迷われる", "届かせる"],
      explanation:
        "Someone with ample experience is naturally entrusted with the work: 任される.",
    },
    {
      stem: "工事の音が大きく、話に＿＿するのが難しかった。",
      correct: "集中",
      distractors: ["完成", "共通", "終了"],
      explanation:
        "話に集中する means to focus on the talk and is obstructed by loud noise.",
    },
    {
      stem: "予想より参加者が多かったため、資料が＿＿しまった。",
      correct: "足りなくなって",
      distractors: ["余りすぎてを", "届きすぎて", "増えられて"],
      explanation:
        "More participants than expected naturally causes the handouts to run short.",
    },
    {
      stem: "結果だけでなく、そこまでの＿＿も評価するべきだ。",
      correct: "過程",
      distractors: ["景色", "気温", "表面"],
      explanation:
        "The contrast with 結果 is naturally 結果だけでなく過程も: process as well as outcome.",
    },
    {
      stem: "担当者が不在だったので、受付に伝言を＿＿。",
      correct: "頼んだ",
      distractors: ["断った", "拾った", "結んだ"],
      explanation:
        "伝言を頼む is the natural expression for asking reception to pass on a message.",
    },
    {
      stem: "説明を聞いて、ようやく問題の意味が＿＿。",
      correct: "理解できた",
      distractors: ["利用された", "影響した", "準備させた"],
      explanation:
        "An explanation enables comprehension, expressed as 意味が理解できた.",
    },
    {
      stem: "古い建物を＿＿し、地域の交流施設として使う。",
      correct: "改修",
      distractors: ["改札", "回収", "回答"],
      explanation:
        "改修する means to renovate a building, distinct from collecting or answering.",
    },
    ...N3_CONTEXT_EXPANSION,
  ],
  usages: [
    {
      focus: "取り上げる",
      correct: "新聞は地域の交通問題を大きく取り上げた。",
      distractors: [
        "{person}さんは駅への近道を地図から取り上げた。",
        "強い風が屋根を空へ取り上げた。",
        "料理の味をよくするため塩を取り上げた。",
      ],
      explanation:
        "A newspaper can 取り上げる a topic; the distractors call for 見つける, 吹き上げる, or 加える.",
    },
    {
      focus: "目立つ",
      correct: "白い壁に赤い案内がよく目立つ。",
      distractors: [
        "{person}さんは仕事を目立って終えた。",
        "この薬を飲むと熱が目立ってくる。",
        "駅まで歩けば時間が目立つ。",
      ],
      explanation:
        "A red sign can stand out visually; the distractors misuse 目立つ for speed, symptoms, or elapsed time.",
    },
    {
      focus: "省く",
      correct: "時間がないので、細かい説明を省いた。",
      distractors: [
        "混雑を避けるため、駅を一つ省いて降りた。",
        "会議に来られない{person}さんを名簿から省いた。",
        "雨が降ったので、公園への道を省いた。",
      ],
      explanation:
        "省く correctly means to omit part of an explanation; the distractors require 乗り越す, 外す, or 避ける.",
    },
    {
      focus: "支える",
      correct: "多くの職員が地域のサービスを支えている。",
      distractors: [
        "音量を上げて音楽を大きく支えた。",
        "この電車は次の駅まで乗客を支える。",
        "三冊の本が棚の一段を支えている。",
      ],
      explanation:
        "People can sustain a service; the distractors call for 鳴らす, 運ぶ, or 占める.",
    },
    {
      focus: "広がる",
      correct: "新しい働き方が若い世代に広がっている。",
      distractors: [
        "{person}さんは机の上に資料を広がった。",
        "会議の時間を三時まで広がった。",
        "駅へ広がっている道を歩いた。",
      ],
      explanation:
        "An idea can spread intransitively; the distractors require 広げた, 延ばした, or 続いている.",
    },
    {
      focus: "見直す",
      correct: "利用者の意見を聞いて、料金を見直した。",
      distractors: [
        "展望台から町の景色を見直した。",
        "駅で十年ぶりに{person}さんを見直した。",
        "読み終えた本を机の上に見直した。",
      ],
      explanation:
        "見直す means to reconsider or revise; the distractors call for 眺めた, 見かけた, or 戻した.",
    },
    {
      focus: "伴う",
      correct: "計画の変更には、追加の費用が伴う。",
      distractors: [
        "{person}さんは説明会に資料を伴った。",
        "案内の人が駅まで参加者を伴った。",
        "料理に温かい飲み物を伴って出した。",
      ],
      explanation:
        "A change can be accompanied by cost; the distractors require 持参した, 案内した, or 添えた.",
    },
    {
      focus: "限る",
      correct: "このサービスは登録した人に限って利用できる。",
      distractors: [
        "道を右に限って歩けば駅に着く。",
        "読む本を三冊に限って選んだ。",
        "雨が降る時間を一時間に限った。",
      ],
      explanation:
        "人に限って correctly restricts eligibility; the distractors call for 曲がる, 絞る, or 続いた.",
    },
    {
      focus: "得る",
      correct: "調査を始める前に、参加者の同意を得た。",
      distractors: [
        "駅まで行くため電車を得た。",
        "雨の予報を得て、かさを持って出た。",
        "{person}さんは質問に静かに得た。",
      ],
      explanation:
        "同意を得る is a natural collocation; the distractors require 乗った, 聞いた, or 答えた.",
    },
    {
      focus: "応じる",
      correct: "利用者の希望に応じて、時間を変更する。",
      distractors: [
        "駅の名前に応じて、乗っていた電車を降りた。",
        "本の重さに応じて、書かれた内容を理解した。",
        "電話の音に応じて、外で雨が降り始めた。",
      ],
      explanation:
        "希望に応じて correctly means according to a request; the distractors describe unrelated events for which 到着して, 読んで, or 偶然 would be needed.",
    },
    ...N3_USAGE_EXPANSION,
  ],
  grammar: [
    {
      stem: "安全規則には『経験者だけに操作が認められている』とあります。そのため、この機械は操作の経験がある人＿＿動かすことができません。",
      correct: "でないと",
      distractors: ["であっても", "だけでも", "だからこそ"],
      explanation:
        "The preceding rule allows only experienced operators, so でないと uniquely expresses the necessary condition; the alternatives contradict that rule.",
    },
    {
      stem: "{person}さんは忙しい＿＿、手伝いに来てくれた。",
      correct: "にもかかわらず",
      distractors: ["にしたがって", "について", "に比べては"],
      explanation:
        "にもかかわらず expresses the unexpected contrast with being busy.",
    },
    {
      stem: "説明を聞けば聞く＿＿、分からなくなった。",
      correct: "ほど",
      distractors: ["まで", "だけ", "しか"],
      explanation:
        "ば...ほど expresses a proportional relation: the more one listens, the less one understands.",
    },
    {
      stem: "雨が降る＿＿、試合は行われます。",
      correct: "としても",
      distractors: ["ためには", "ばかりに", "ところを"],
      explanation:
        "としても means even assuming that it rains, the match will still occur.",
    },
    {
      stem: "この本は、初めて日本語を学ぶ人にも理解できるよう、初級者＿＿やさしい言葉で書かれています。",
      correct: "向けに",
      distractors: ["として", "において", "によると"],
      explanation:
        "初級者向けに means written for beginners; the purpose clause confirms the intended readership.",
    },
    {
      stem: "帰ろうとした＿＿、電話がかかってきた。",
      correct: "ところに",
      distractors: ["ばかりで", "ままに", "ほどで"],
      explanation:
        "たところに marks an event occurring just as another action was about to happen.",
    },
    {
      stem: "この機械は子どもでも使える＿＿簡単だ。",
      correct: "ほど",
      distractors: ["ばかり", "しか", "まま"],
      explanation:
        "ほど indicates the degree: simple enough even for a child to use.",
    },
    {
      stem: "会議は予定どおり行われる＿＿です。",
      correct: "はず",
      distractors: ["ため", "ところ", "ばかり"],
      explanation:
        "はずです expresses a well-grounded expectation based on the schedule.",
    },
    {
      stem: "健康のため、毎日歩く＿＿しています。",
      correct: "ように",
      distractors: ["そうに", "ことを", "ものを"],
      explanation: "ようにしています expresses a deliberate ongoing habit.",
    },
    {
      stem: "{person}さんが来る＿＿、会議を始めずに待ちましょう。",
      correct: "まで",
      distractors: ["だけ", "ほど", "しか"],
      explanation:
        "まで marks the endpoint of waiting: wait without starting until the person arrives.",
    },
    {
      stem: "この施設では、安全のため、中に入る前に名前を書く＿＿。",
      correct: "ことになっています",
      distractors: [
        "ことにしています",
        "ようになっています",
        "ようにしています",
      ],
      explanation:
        "The subject is an established facility rule, so ことになっています is uniquely appropriate. ことにしています and ようにしています describe a person's own policy or habit, while ようになっています describes a resulting state or change.",
    },
    ...N3_GRAMMAR_EXPANSION,
  ],
  compositions: [
    {
      prefix: "この制度は",
      parts: ["利用者の", "意見をもとに", "大きく", "改善されました"],
      suffix: "。",
      explanation:
        "The source phrase 意見をもとに precedes the degree adverb and passive result.",
    },
    {
      prefix: "{person}さんは",
      parts: ["忙しいにも", "かかわらず", "会議に", "参加してくれました"],
      suffix: "。",
      explanation:
        "忙しいにもかかわらず forms one contrastive unit before the main action.",
    },
    {
      prefix: "説明を",
      parts: ["聞けば", "聞くほど", "問題が", "分かってきました"],
      suffix: "。",
      explanation:
        "The paired proportional pattern is 聞けば聞くほど, followed by the result.",
    },
    {
      prefix: "この資料は",
      parts: ["初めての人にも", "分かるように", "例を使って", "書かれています"],
      suffix: "。",
      explanation:
        "The target reader and purpose precede the means and passive verb.",
    },
    {
      prefix: "駅に",
      parts: ["着いたところで", "財布が", "ないことに", "気づきました"],
      suffix: "。",
      explanation:
        "ないことに気づく is the embedded discovery after the arrival-time phrase.",
    },
    {
      prefix: "結果だけで",
      parts: [
        "判断するのではなく",
        "そこまでの過程も",
        "見る",
        "必要があります",
      ],
      suffix: "。",
      explanation:
        "のではなく contrasts the rejected criterion with the additional process to examine.",
    },
    {
      prefix: "{day}の行事は",
      parts: ["雨が", "降ったとしても", "予定どおり", "行います"],
      suffix: "。",
      explanation:
        "The concessive condition is followed by the adverb and main action.",
    },
    {
      prefix: "この店は",
      parts: ["駅から", "遠いわりに", "いつも", "こんでいます"],
      suffix: "。",
      explanation:
        "遠いわりに establishes an unexpected contrast with being crowded.",
    },
    {
      prefix: "先生に",
      parts: [
        "すすめられた本を",
        "読んでみたら",
        "思ったより",
        "おもしろかったです",
      ],
      suffix: "。",
      explanation:
        "The object is followed by the trial condition and comparative evaluation.",
    },
    {
      prefix: "計画を",
      parts: ["進めるにあたって", "関係者の同意を", "得ることが", "必要です"],
      suffix: "。",
      explanation:
        "にあたって sets the occasion, followed by the required action nominalized with こと.",
    },
    ...N3_COMPOSITION_EXPANSION,
  ],
  textGrammar: N3_TEXT_GRAMMAR_SEEDS,
  upperListening: upperListeningSeeds.filter((seed) => seed.level === "N3"),
  upperReading: N3_LOWER_READING_SEEDS,
} satisfies LevelQuestionProfile;

export const N3_GENERATED_QUESTIONS = buildGeneratedQuestionBank(
  profile,
  OFFICIAL_TYPES_BY_LEVEL.N3,
);
