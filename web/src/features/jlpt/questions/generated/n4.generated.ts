import { OFFICIAL_TYPES_BY_LEVEL } from "../../structure";
import {
  buildGeneratedQuestionBank,
  type LevelQuestionProfile,
  type LexemeSeed,
} from "./bank-builder";
import { lowerListeningSeeds } from "./lower-listening-seeds";
import {
  N4_COMPOSITION_EXPANSION,
  N4_CONTEXT_EXPANSION,
  N4_GRAMMAR_EXPANSION,
  N4_LEXEME_EXPANSION,
  N4_USAGE_EXPANSION,
} from "./n4-language-expansion";
import { N4_LOWER_READING_SEEDS } from "./lower-reading-seeds";
import { N4_TEXT_GRAMMAR_SEEDS } from "./text-grammar-seeds";

const lexemes: readonly LexemeSeed[] = [
  {
    surface: "予定",
    reading: "よてい",
    readingDistractors: ["よたい", "ようてい", "よでい"],
    kana: "よてい",
    spellingDistractors: ["予廷", "余定", "予程"],
    sentence: "{person}さんは{day}の予定を手帳に書きました。",
    paraphrase: "これからすることの計画",
    paraphraseDistractors: [
      "前にしたことの記録",
      "今持っている物",
      "知らない人の名前",
    ],
  },
  {
    surface: "必要",
    reading: "ひつよう",
    readingDistractors: ["ひっよう", "しつよう", "ひつよ"],
    kana: "ひつよう",
    spellingDistractors: ["必用", "心要", "必要う"],
    sentence: "この仕事にはパソコンが必要です。",
    paraphrase: "なくてはならない",
    paraphraseDistractors: [
      "使ってはいけない",
      "すぐ捨てたい",
      "もう終わっている",
    ],
  },
  {
    surface: "連絡",
    reading: "れんらく",
    readingDistractors: ["れいらく", "れんがく", "れんろく"],
    kana: "れんらく",
    spellingDistractors: ["連各", "練絡", "連落"],
    sentence: "遅れるときは、{person}さんに連絡してください。",
    paraphrase: "電話やメールで知らせる",
    paraphraseDistractors: [
      "会わないようにする",
      "何も言わずに待つ",
      "荷物を家へ送る",
    ],
  },
  {
    surface: "予約",
    reading: "よやく",
    readingDistractors: ["よしょく", "ようやく", "よわく"],
    kana: "よやく",
    spellingDistractors: ["予役", "予約く", "野約"],
    sentence: "{person}さんは{place}を{time}から予約しました。",
    paraphrase: "前もって使う時間を決める",
    paraphraseDistractors: [
      "使ったあとで払う",
      "急に予定をやめる",
      "場所を掃除する",
    ],
  },
  {
    surface: "都合",
    reading: "つごう",
    readingDistractors: ["とごう", "つあい", "つこう"],
    kana: "つごう",
    spellingDistractors: ["都号", "津合", "都郷"],
    sentence: "{day}は都合が悪いので、{nextDay}にしてください。",
    paraphrase: "予定が合わない",
    paraphraseDistractors: ["体の調子がいい", "場所が分からない", "天気が悪い"],
  },
  {
    surface: "経験",
    reading: "けいけん",
    readingDistractors: ["けいげん", "きょうけん", "けけん"],
    kana: "けいけん",
    spellingDistractors: ["経険", "係験", "経験ん"],
    sentence: "{person}さんは外国で働いた経験があります。",
    paraphrase: "前に実際にしたことがある",
    paraphraseDistractors: [
      "これから初めてする",
      "本で読んだだけだ",
      "絶対にしたくない",
    ],
  },
  {
    surface: "安全",
    reading: "あんぜん",
    readingDistractors: ["あんせん", "やすぜん", "あんぜい"],
    kana: "あんぜん",
    spellingDistractors: ["安先", "安全ん", "案全"],
    sentence: "道を渡る前に、安全を確かめてください。",
    paraphrase: "危なくないこと",
    paraphraseDistractors: [
      "とても急いでいること",
      "音が大きいこと",
      "値段が高いこと",
    ],
  },
  {
    surface: "準備",
    reading: "じゅんび",
    readingDistractors: ["じゅび", "しゅんび", "じゅんぴ"],
    kana: "じゅんび",
    spellingDistractors: ["準美", "順備", "準日"],
    sentence: "{person}さんは旅行の準備をしています。",
    paraphrase: "始める前に必要な物をそろえる",
    paraphraseDistractors: [
      "終わった物を捨てる",
      "同じ話を何度もする",
      "予定を全部忘れる",
    ],
  },
  {
    surface: "習慣",
    reading: "しゅうかん",
    readingDistractors: ["しゅかん", "しゅうがん", "ならいかん"],
    kana: "しゅうかん",
    spellingDistractors: ["週慣", "習間", "集慣"],
    sentence: "{person}さんには朝に新聞を読む習慣があります。",
    paraphrase: "いつも同じようにすること",
    paraphraseDistractors: [
      "一度だけしたこと",
      "まだ決めていないこと",
      "だれにも言わないこと",
    ],
  },
  {
    surface: "最近",
    reading: "さいきん",
    readingDistractors: ["さいこん", "せいきん", "さいぎん"],
    kana: "さいきん",
    spellingDistractors: ["最斤", "再近", "最金"],
    sentence: "{person}さんは最近、料理を始めました。",
    paraphrase: "今から少し前のころ",
    paraphraseDistractors: ["ずっと昔", "これから十年後", "毎年同じ日"],
  },
  ...N4_LEXEME_EXPANSION,
];

const profile = {
  level: "N4",
  complexity: 2,
  listeningRate: 0.88,
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
    "林",
    "清水",
    "山口",
    "森",
    "池田",
  ],
  places: [
    "市民会館",
    "図書館",
    "体育館",
    "駅前",
    "公園",
    "文化センター",
    "病院",
    "大学",
    "会社",
    "商店街",
  ],
  lexemes,
  contexts: [
    {
      stem: "電車が止まっていたので、会社に＿＿。",
      correct: "遅れました",
      distractors: ["間に合いました", "集まりました", "始まりました"],
      explanation:
        "A stopped train naturally causes someone to arrive late at work.",
    },
    {
      stem: "この薬は食事のあとで＿＿ください。",
      correct: "飲んで",
      distractors: ["食べて", "着て", "乗って"],
      explanation:
        "Medicine is taken with the expression 薬を飲む, using the て-form before ください.",
    },
    {
      stem: "{person}さんは料理が上手で、何を作っても＿＿です。",
      correct: "おいしい",
      distractors: ["まずいそう", "せまい", "ねむい"],
      explanation:
        "Cooking skill is naturally evaluated by the food being delicious.",
    },
    {
      stem: "道が分からなかったので、駅員に＿＿。",
      correct: "たずねました",
      distractors: ["かざりました", "うえました", "ぬりました"],
      explanation:
        "たずねる means to ask or inquire and fits asking station staff for directions.",
    },
    {
      stem: "大切な書類ですから、なくさないように＿＿してください。",
      correct: "注意",
      distractors: ["出発", "卒業", "運転"],
      explanation:
        "注意する means to take care; it fits the warning not to lose an important document.",
    },
    {
      stem: "部屋が暑かったので、エアコンを＿＿。",
      correct: "つけました",
      distractors: ["かけました", "はきました", "さしました"],
      explanation:
        "The normal expression for turning on an air conditioner is エアコンをつける.",
    },
    {
      stem: "この道は工事中です。向こうの道を＿＿ください。",
      correct: "通って",
      distractors: ["落ちて", "壊れて", "拾って"],
      explanation:
        "通ってください naturally directs someone to use the other road.",
    },
    {
      stem: "{person}さんは約束の時間を＿＿しまいました。",
      correct: "忘れて",
      distractors: ["覚えて", "見つけて", "伝えて"],
      explanation:
        "忘れてしまいました expresses the regrettable completion of forgetting an appointment time.",
    },
    {
      stem: "荷物が多いので、駅までタクシーを＿＿。",
      correct: "利用します",
      distractors: ["発見します", "紹介します", "説明します"],
      explanation:
        "利用する means to use a service and collocates naturally with a taxi.",
    },
    {
      stem: "あの店はいつも人が多くて、とても＿＿います。",
      correct: "こんで",
      distractors: ["すいて", "かわいて", "やんで"],
      explanation: "人が多い店 is crowded, expressed as こんでいます.",
    },
    ...N4_CONTEXT_EXPANSION,
  ],
  usages: [
    {
      focus: "間に合う",
      correct: "{person}さんは急いだので、九時の電車に間に合った。",
      distractors: [
        "この薬は頭の痛みによく間に合う。",
        "この赤い帽子は白い服に間に合う。",
        "この道は駅までまっすぐ間に合っている。",
      ],
      explanation:
        "間に合う correctly means to be in time for a train or deadline; the distractors call for 効く, 似合う, or 続く.",
    },
    {
      focus: "片付ける",
      correct: "食事のあとで、{person}さんはテーブルの上を片付けた。",
      distractors: [
        "先生は旅行の日を来月に片付けた。",
        "この薬を飲めば頭の痛みを片付けられる。",
        "駅員は電車の時間を乗客に片付けた。",
      ],
      explanation:
        "片付ける correctly means to tidy or put away things after a meal; the other contexts require 決める, 治す, or 知らせる.",
    },
    {
      focus: "決まる",
      correct: "来月の旅行の日が{day}に決まった。",
      distractors: [
        "{person}さんは答えを三番に決まった。",
        "先生は会議の時間を五時に決まった。",
        "母は晩ごはんをカレーに決まった。",
      ],
      explanation:
        "A date or plan can 決まる, become decided; the distractors need the transitive form 決める.",
    },
    {
      focus: "届ける",
      correct: "{person}さんは忘れ物を交番に届けた。",
      distractors: [
        "先生は難しい文法を学生に届けた。",
        "このバスは駅まで客を届けて走る。",
        "ニュースで明日の天気を届けていた。",
      ],
      explanation:
        "届ける correctly describes taking an item to its destination; the distractors naturally require 教える, 運ぶ, or 伝える.",
    },
    {
      focus: "足りる",
      correct: "この料理には塩が少し足りない。",
      distractors: [
        "駅まであと十分ほど足りる。",
        "この服は弟の体によく足りている。",
        "道をまっすぐ足りると銀行がある。",
      ],
      explanation:
        "足りる concerns whether an amount is sufficient; the distractors require かかる, 合う, or 行く.",
    },
    {
      focus: "見つかる",
      correct: "なくしたかぎが机の下で見つかった。",
      distractors: [
        "{person}さんは駅で古い友人を見つかった。",
        "この写真を見ると町の変化が見つかる。",
        "窓から大きな山が見つかった。",
      ],
      explanation:
        "見つかる is intransitive for a lost object being found; the other sentences need 見つけた, 分かる, or 見えた.",
    },
    {
      focus: "続ける",
      correct: "{person}さんは毎日、日本語の勉強を続けている。",
      distractors: [
        "この道を続けると駅に着きます。",
        "二つの部屋を廊下が続けている。",
        "雨のあと、空に虹が続けた。",
      ],
      explanation:
        "続ける takes an ongoing activity; the distractors call for 進む, つなぐ, or 現れる.",
    },
    {
      focus: "比べる",
      correct: "二つのかばんの大きさを比べてから買った。",
      distractors: [
        "駅の時計と自分の時計が同じ時間を比べている。",
        "この写真は去年の町の様子を比べている。",
        "弟は父と顔がよく比べている。",
      ],
      explanation:
        "比べる correctly describes actively comparing alternatives; the distractors require 示す or 似る.",
    },
    {
      focus: "知らせる",
      correct: "予定が変わったら、すぐ{person}さんに知らせてください。",
      distractors: [
        "この案内を読めば、駅への道を知らせます。",
        "先生の説明で答えを知らせました。",
        "新しい店が駅前に知らせました。",
      ],
      explanation:
        "知らせる means to notify someone; the other contexts call for 分かる or できる.",
    },
    {
      focus: "直す",
      correct: "作文の間違いを直して、もう一度出した。",
      distractors: [
        "病院でもらった薬で風邪を直した。",
        "机から落ちた本を棚に直した。",
        "道を間違えたので駅まで直した。",
      ],
      explanation:
        "直す correctly means to correct an error; the distractors require 治す, 戻す, or 引き返す.",
    },
    ...N4_USAGE_EXPANSION,
  ],
  grammar: [
    {
      stem: "日本へ来て＿＿、一年になります。",
      correct: "から",
      distractors: ["まで", "だけ", "しか"],
      explanation:
        "てから marks the starting point; the sentence says a year has passed since coming to Japan.",
    },
    {
      stem: "雨が降り＿＿なので、かさを持って行きます。",
      correct: "そう",
      distractors: ["ながら", "たり", "まで"],
      explanation:
        "The stem form plus そう describes an appearance: it looks likely to rain.",
    },
    {
      stem: "{person}さんは漢字を読む＿＿できます。",
      correct: "ことが",
      distractors: ["ものを", "ところに", "ためで"],
      explanation: "Dictionary form plus ことができる expresses ability.",
    },
    {
      stem: "先生は学生に本を＿＿ました。",
      correct: "読ませ",
      distractors: ["読まれ", "読みたく", "読むそう"],
      explanation:
        "読ませました is the causative: the teacher made or allowed students to read.",
    },
    {
      stem: "このボタンを押す＿＿、ドアが開きます。",
      correct: "と",
      distractors: ["ても", "のでを", "のにを"],
      explanation:
        "と expresses an automatic or regular result when the button is pressed.",
    },
    {
      stem: "忙しくても、朝ごはんを食べる＿＿しています。",
      correct: "ように",
      distractors: ["そうで", "ためを", "しか"],
      explanation:
        "ようにしています describes making a regular effort to maintain a habit.",
    },
    {
      stem: "この本は図書館で借りる＿＿できます。",
      correct: "ことが",
      distractors: ["はずを", "つもりに", "そうに"],
      explanation:
        "ことができます follows a dictionary-form verb and expresses possibility.",
    },
    {
      stem: "駅へ行く＿＿、この道がいちばん近いです。",
      correct: "なら",
      distractors: ["たり", "ながら", "しか"],
      explanation: "なら sets the condition or topic: if going to the station.",
    },
    {
      stem: "宿題を＿＿あとで、テレビを見ます。",
      correct: "した",
      distractors: ["するの", "しては", "しそう"],
      explanation: "Past plain form plus あとで means after doing the action.",
    },
    {
      stem: "{person}さんは来月、国へ帰る＿＿です。",
      correct: "予定",
      distractors: ["経験", "心配", "途中"],
      explanation:
        "Dictionary form plus 予定です expresses a scheduled future action.",
    },
    {
      stem: "{person}さんは去年、初めて富士山に登りました。{person}さんは富士山に登った＿＿。",
      correct: "ことがあります",
      distractors: ["ところです", "ほうがいいです", "つもりです"],
      explanation:
        "The first sentence locates the completed climb last year, so たことがあります uniquely expresses that past experience; たところです would mean it just happened, while the other choices express advice or intention.",
    },
    ...N4_GRAMMAR_EXPANSION,
  ],
  compositions: [
    {
      prefix: "{person}さんは",
      parts: ["日本へ", "来る前に", "三か月", "勉強しました"],
      suffix: "。",
      explanation:
        "来る前に forms the time phrase, followed by duration and the main verb.",
    },
    {
      prefix: "この本は",
      parts: ["漢字が", "少ないので", "とても", "読みやすいです"],
      suffix: "。",
      explanation:
        "The reason clause leads naturally to the degree adverb and 読みやすいです.",
    },
    {
      prefix: "駅に着いたら",
      parts: ["まず", "{person}さんに", "電話を", "かけてください"],
      suffix: "。",
      explanation:
        "まず introduces the first action, followed by recipient, object, and request verb.",
    },
    {
      prefix: "わたしは",
      parts: ["先生が", "すすめてくれた", "本を", "読みました"],
      suffix: "。",
      explanation: "先生がすすめてくれた is a relative clause modifying 本.",
    },
    {
      prefix: "雨が",
      parts: ["降りそうなので", "出かけるのを", "やめる", "ことにしました"],
      suffix: "。",
      explanation:
        "The reason is followed by the nominalized action and the decision pattern ことにしました.",
    },
    {
      prefix: "{place}では",
      parts: ["写真を", "とっては", "いけない", "そうです"],
      suffix: "。",
      explanation:
        "とってはいけない is the prohibition reported with そうです.",
    },
    {
      prefix: "この料理は",
      parts: ["作り方が", "簡単な", "わりに", "おいしいです"],
      suffix: "。",
      explanation:
        "Noun phrase plus わりに sets an unexpected contrast with the result.",
    },
    {
      prefix: "{day}までに",
      parts: ["借りた本を", "図書館へ", "返さなければ", "なりません"],
      suffix: "。",
      explanation:
        "返さなければなりません is the obligation form after object and destination.",
    },
    {
      prefix: "{person}さんは",
      parts: ["音楽を", "聞きながら", "晩ごはんを", "作っています"],
      suffix: "。",
      explanation:
        "聞きながら links the simultaneous activity to the main cooking action.",
    },
    {
      prefix: "道が",
      parts: ["こんでいたため", "約束の時間に", "間に合い", "ませんでした"],
      suffix: "。",
      explanation:
        "The reason clause precedes the deadline phrase and the split polite negative verb.",
    },
    ...N4_COMPOSITION_EXPANSION,
  ],
  lowerListening: lowerListeningSeeds.filter((seed) => seed.level === "N4"),
  upperReading: N4_LOWER_READING_SEEDS,
  textGrammar: N4_TEXT_GRAMMAR_SEEDS,
} satisfies LevelQuestionProfile;

export const N4_GENERATED_QUESTIONS = buildGeneratedQuestionBank(
  profile,
  OFFICIAL_TYPES_BY_LEVEL.N4,
);
