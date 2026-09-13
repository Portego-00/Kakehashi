import { OFFICIAL_TYPES_BY_LEVEL } from "../../structure";
import {
  buildGeneratedQuestionBank,
  type LevelQuestionProfile,
  type LexemeSeed,
} from "./bank-builder";
import { lowerListeningSeeds } from "./lower-listening-seeds";
import { N5_LOWER_READING_SEEDS } from "./lower-reading-seeds";
import {
  N5_COMPOSITION_EXPANSION,
  N5_CONTEXT_EXPANSION,
  N5_GRAMMAR_EXPANSION,
  N5_LEXEME_EXPANSION,
} from "./n5-language-expansion";
import { N5_TEXT_GRAMMAR_SEEDS } from "./text-grammar-seeds";

const names = [
  "あき",
  "ゆき",
  "まり",
  "けん",
  "なお",
  "はる",
  "りな",
  "こう",
  "えみ",
  "そら",
  "みき",
  "じゅん",
  "あや",
  "れん",
  "もも",
  "しん",
  "なな",
  "りく",
  "めい",
  "かい",
];

const lexemes: readonly LexemeSeed[] = [
  {
    surface: "毎週",
    reading: "まいしゅう",
    readingDistractors: ["まいしゅ", "まいじゅう", "めいしゅう"],
    kana: "まいしゅう",
    spellingDistractors: ["毎集", "海週", "毎習"],
    sentence: "{person}さんは毎週、図書館へ行きます。",
    paraphrase: "一週間に一回",
    paraphraseDistractors: ["毎日", "一か月に一回", "きのうだけ"],
    relatedKanji: ["毎", "週"],
  },
  {
    surface: "図書館",
    reading: "としょかん",
    readingDistractors: ["ずしょかん", "としょうかん", "としょがん"],
    kana: "としょかん",
    spellingDistractors: ["図所館", "書図館", "図書間"],
    sentence: "{person}さんは{day}に図書館で本を借ります。",
    paraphrase: "本を借りたり読んだりする所",
    paraphraseDistractors: [
      "電車に乗る所",
      "病気を見てもらう所",
      "料理を買う所",
    ],
    relatedKanji: ["図", "書", "館"],
  },
  {
    surface: "飲み物",
    reading: "のみもの",
    readingDistractors: ["よみもの", "たべもの", "のみぶつ"],
    kana: "のみもの",
    spellingDistractors: ["食み物", "飲み者", "飲物み"],
    sentence: "{person}さんは店で冷たい飲み物を買いました。",
    paraphrase: "水やお茶など",
    paraphraseDistractors: ["パンやご飯など", "本や新聞など", "机やいすなど"],
    relatedKanji: ["飲", "物"],
  },
  {
    surface: "写真",
    reading: "しゃしん",
    readingDistractors: ["しゃじん", "さしん", "しゃほん"],
    kana: "しゃしん",
    spellingDistractors: ["写直", "社真", "写真ん"],
    sentence: "{person}さんは{place}で写真を三枚とりました。",
    paraphrase: "カメラでとったもの",
    paraphraseDistractors: ["手で書いた手紙", "耳で聞く音楽", "店で買う食べ物"],
    relatedKanji: ["写", "真"],
  },
  {
    surface: "駅前",
    reading: "えきまえ",
    readingDistractors: ["えきぜん", "えきまい", "いきまえ"],
    kana: "えきまえ",
    spellingDistractors: ["駅後", "駅毎", "易前"],
    sentence: "{person}さんと{time}に駅前で会います。",
    paraphrase: "駅のすぐ前",
    paraphraseDistractors: ["駅の中", "駅の後ろ", "駅から遠い所"],
    relatedKanji: ["駅", "前"],
  },
  {
    surface: "料理",
    reading: "りょうり",
    readingDistractors: ["りょり", "りょうい", "りゅうり"],
    kana: "りょうり",
    spellingDistractors: ["料里", "理料", "科理"],
    sentence: "{person}さんは家で日本の料理を作りました。",
    paraphrase: "作った食べ物",
    paraphraseDistractors: ["買った服", "読んだ本", "見た映画"],
    relatedKanji: ["料", "理"],
  },
  {
    surface: "昼休み",
    reading: "ひるやすみ",
    readingDistractors: ["ひるきゅうみ", "ひるやすめ", "ちゅうやすみ"],
    kana: "ひるやすみ",
    spellingDistractors: ["昼体み", "昼安み", "朝休み"],
    sentence: "{person}さんは昼休みに友だちと話します。",
    paraphrase: "昼ごはんのころの休み時間",
    paraphraseDistractors: ["朝起きる時間", "夜寝る時間", "学校へ行く時間"],
    relatedKanji: ["昼", "休"],
  },
  {
    surface: "友達",
    reading: "ともだち",
    readingDistractors: ["ゆうだち", "ともたち", "ゆうたつ"],
    kana: "ともだち",
    spellingDistractors: ["友遠", "反達", "友建"],
    sentence: "{person}さんは{other}さんと友達です。",
    paraphrase: "よくいっしょにいる人",
    paraphraseDistractors: ["学校の先生", "店で働く人", "会ったことがない人"],
    relatedKanji: ["友", "達"],
  },
  {
    surface: "電車",
    reading: "でんしゃ",
    readingDistractors: ["てんしゃ", "でんくるま", "でんじゃ"],
    kana: "でんしゃ",
    spellingDistractors: ["電東", "雷車", "電庫"],
    sentence: "{person}さんは{time}の電車で会社へ行きます。",
    paraphrase: "駅から乗る乗り物",
    paraphraseDistractors: [
      "空を飛ぶ乗り物",
      "海を走る乗り物",
      "自分でこぐ乗り物",
    ],
    relatedKanji: ["電", "車"],
  },
  {
    surface: "有名",
    reading: "ゆうめい",
    readingDistractors: ["ゆめい", "ゆうみょう", "ありな"],
    kana: "ゆうめい",
    spellingDistractors: ["友名", "有明", "右名"],
    sentence: "{place}はきれいな花で有名です。",
    paraphrase: "たくさんの人が知っている",
    paraphraseDistractors: [
      "だれも知らない",
      "とても古くてこわれている",
      "人が一人もいない",
    ],
    relatedKanji: ["有", "名"],
  },
  ...N5_LEXEME_EXPANSION,
];

const orthography: readonly LexemeSeed[] = [
  ...lexemes.slice(0, 5),
  {
    surface: "テレビ",
    reading: "てれび",
    readingDistractors: ["てれひ", "でれび", "てびれ"],
    kana: "てれび",
    spellingDistractors: ["テレピ", "デレビ", "テレビー"],
    sentence: "{person}さんは夜、テレビを見ます。",
    paraphrase: "ニュースや番組を見るもの",
    paraphraseDistractors: ["電話をするもの", "字を書くもの", "料理をするもの"],
  },
  {
    surface: "コンビニ",
    reading: "こんびに",
    readingDistractors: ["こんぴに", "こびんに", "こんびり"],
    kana: "こんびに",
    spellingDistractors: ["コンピニ", "ゴンビニ", "コンビリ"],
    sentence: "{person}さんはコンビニでおにぎりを買いました。",
    paraphrase: "いつでも買い物をしやすい小さい店",
    paraphraseDistractors: [
      "本だけを借りる所",
      "電車に乗る所",
      "勉強をする学校",
    ],
  },
  {
    surface: "タクシー",
    reading: "たくしー",
    readingDistractors: ["たくしい", "だくしー", "たしくー"],
    kana: "たくしー",
    spellingDistractors: ["タクツー", "ダクシー", "タクシ"],
    sentence: "雨なので、{person}さんは駅からタクシーに乗りました。",
    paraphrase: "お金を払って乗る車",
    paraphraseDistractors: ["駅から出る電車", "自分でこぐ自転車", "海を進む船"],
  },
  {
    surface: "レストラン",
    reading: "れすとらん",
    readingDistractors: ["れすとろん", "れそとらん", "れすどらん"],
    kana: "れすとらん",
    spellingDistractors: ["レストラソ", "レストロン", "レスラトン"],
    sentence: "{person}さんは{other}さんとレストランで食べます。",
    paraphrase: "料理を注文して食べる店",
    paraphraseDistractors: ["薬を買う店", "手紙を出す所", "本を借りる所"],
  },
  {
    surface: "カメラ",
    reading: "かめら",
    readingDistractors: ["かめろ", "がめら", "からめ"],
    kana: "かめら",
    spellingDistractors: ["カヌラ", "ガメラ", "カメワ"],
    sentence: "{person}さんは新しいカメラで花をとりました。",
    paraphrase: "写真をとるもの",
    paraphraseDistractors: [
      "音楽を聞くもの",
      "字を消すもの",
      "お湯をわかすもの",
    ],
  },
  ...N5_LEXEME_EXPANSION,
];

const profile = {
  level: "N5",
  complexity: 1,
  listeningRate: 0.82,
  names,
  places: [
    "公園",
    "映画館",
    "デパート",
    "学校",
    "図書館",
    "駅",
    "スーパー",
    "レストラン",
    "病院",
    "銀行",
  ],
  lexemes,
  orthography,
  contexts: [
    {
      stem: "このりんごは百円です。とても＿＿です。",
      correct: "安い",
      distractors: ["高い", "暗い", "遠い"],
      explanation:
        "At only 100 yen, 安い is the natural description; the other adjectives do not fit the price.",
    },
    {
      stem: "雨が降っていますから、かさを＿＿。",
      correct: "さします",
      distractors: ["きます", "はきます", "かぶります"],
      explanation:
        "The fixed expression is かさをさします, meaning to put up or use an umbrella.",
    },
    {
      stem: "{person}さんはのどがかわいたので、水を＿＿。",
      correct: "飲みました",
      distractors: ["食べました", "読みました", "聞きました"],
      explanation:
        "When someone is thirsty, drinking water is the only action that fits naturally.",
    },
    {
      stem: "へやが暗いです。電気を＿＿ください。",
      correct: "つけて",
      distractors: ["けして", "しめて", "あらって"],
      explanation:
        "Turning on the light is expressed as 電気をつける; つけてください is the request form.",
    },
    {
      stem: "あしたテストがありますから、今夜は＿＿します。",
      correct: "勉強",
      distractors: ["散歩", "料理", "洗濯"],
      explanation:
        "Studying tonight is the action directly motivated by having a test tomorrow.",
    },
    {
      stem: "このにもつは大きくて、一人では＿＿です。",
      correct: "持てません",
      distractors: ["会えません", "読めません", "泳げません"],
      explanation:
        "A large piece of luggage may be impossible to carry; the other potential verbs do not take this object.",
    },
    {
      stem: "{person}さんは毎朝、駅まで＿＿行きます。",
      correct: "歩いて",
      distractors: ["開いて", "借りて", "習って"],
      explanation:
        "歩いて行きます naturally describes going somewhere on foot.",
    },
    {
      stem: "外は寒いですから、まどを＿＿ください。",
      correct: "閉めて",
      distractors: ["開けて", "見せて", "教えて"],
      explanation:
        "Because it is cold outside, asking someone to close the window is the coherent choice.",
    },
    {
      stem: "日曜日に友だちと映画を＿＿。",
      correct: "見ました",
      distractors: ["聞きました", "読みました", "書きました"],
      explanation: "The ordinary collocation is 映画を見る, to watch a film.",
    },
    {
      stem: "このスープはとても＿＿です。少し待ってから飲みます。",
      correct: "熱い",
      distractors: ["丸い", "低い", "細い"],
      explanation:
        "Waiting before drinking soup strongly indicates that it is hot: 熱い.",
    },
    ...N5_CONTEXT_EXPANSION,
  ],
  usages: [],
  grammar: [
    {
      stem: "{day}＿＿友だちと{place}へ行きます。",
      correct: "に",
      distractors: ["を", "で", "へ"],
      explanation: "に marks a specific day or time when an action occurs.",
    },
    {
      stem: "これはだれ＿＿かばんですか。",
      correct: "の",
      distractors: ["が", "を", "と"],
      explanation:
        "の connects an owner to the thing owned; だれの means whose.",
    },
    {
      stem: "駅＿＿電車に乗ります。",
      correct: "で",
      distractors: ["を", "が", "へ"],
      explanation:
        "で marks the place where the action of boarding takes place.",
    },
    {
      stem: "{person}さんは日本語＿＿話します。",
      correct: "を",
      distractors: ["に", "へ", "で"],
      explanation:
        "を marks 日本語 as the object of 話します in this elementary pattern.",
    },
    {
      stem: "きのうは雨＿＿、出かけませんでした。",
      correct: "でしたから",
      distractors: ["ですまで", "でしたへ", "ですを"],
      explanation:
        "でしたから gives the reason in polite past style: because it was rainy.",
    },
    {
      stem: "ここで写真を＿＿もいいですか。",
      correct: "とって",
      distractors: ["とる", "とり", "とった"],
      explanation: "The permission pattern is the て-form plus もいいですか.",
    },
    {
      stem: "ごはんを食べる＿＿、手を洗います。",
      correct: "前に",
      distractors: ["下に", "中を", "右で"],
      explanation: "Dictionary form plus 前に means before doing the action.",
    },
    {
      stem: "{place}へ行きたい＿＿。",
      correct: "です",
      distractors: ["ます", "でしたを", "ませんに"],
      explanation:
        "The polite form of an い-adjective-like たい expression ends with です.",
    },
    {
      stem: "つくえの上に本が三冊＿＿。",
      correct: "あります",
      distractors: ["います", "します", "なります"],
      explanation:
        "あります is used for the existence of nonliving things such as books.",
    },
    {
      stem: "{person}さんは今、電話を＿＿。",
      correct: "かけています",
      distractors: ["かけましたか", "かけるです", "かけてでした"],
      explanation:
        "今 signals an action in progress, expressed with the ている form.",
    },
    ...N5_GRAMMAR_EXPANSION,
  ],
  compositions: [
    {
      prefix: "{person}さんは",
      parts: ["本を", "読む", "ことが", "好きです"],
      suffix: "。",
      explanation:
        "読む directly modifies こと, which is marked by が before 好きです.",
    },
    {
      prefix: "わたしは",
      parts: ["日本語を", "勉強し", "なければ", "なりません"],
      suffix: "。",
      explanation:
        "The obligation form is built in the fixed sequence 勉強しなければなりません.",
    },
    {
      prefix: "分からないときは",
      parts: ["先生に", "聞いて", "みて", "ください"],
      suffix: "。",
      explanation:
        "聞いてみてください is one linked request meaning please try asking.",
    },
    {
      prefix: "{day}は",
      parts: ["ごはんを", "食べた", "あとで", "出かけます"],
      suffix: "。",
      explanation: "Past plain form 食べた must directly precede あとで.",
    },
    {
      prefix: "外は",
      parts: ["雨が", "降って", "いる", "そうです"],
      suffix: "。",
      explanation: "降っている is the progressive form reported with そうです.",
    },
    {
      prefix: "ここで",
      parts: ["写真を", "とって", "も", "いいですか"],
      suffix: "。",
      explanation:
        "The permission pattern has the fixed sequence とってもいいですか.",
    },
    {
      prefix: "朝、早く",
      parts: ["起きる", "ことが", "でき", "ません"],
      suffix: "。",
      explanation:
        "ことができません is the fixed ability construction after the dictionary form.",
    },
    {
      prefix: "{place}へ",
      parts: ["友だちに", "会いに", "行って", "きます"],
      suffix: "。",
      explanation:
        "会いに expresses purpose and 行ってきます forms the linked movement predicate.",
    },
    {
      prefix: "この本は",
      parts: ["漢字が", "少なくて", "読み", "やすいです"],
      suffix: "。",
      explanation:
        "少なくて links the reason-like property, and 読みやすい forms one predicate.",
    },
    {
      prefix: "{person}さんに",
      parts: ["借りた本を", "返して", "から", "帰ります"],
      suffix: "。",
      explanation: "返してから is a fixed sequence meaning after returning it.",
    },
    ...N5_COMPOSITION_EXPANSION,
  ],
  lowerListening: lowerListeningSeeds.filter((seed) => seed.level === "N5"),
  upperReading: N5_LOWER_READING_SEEDS,
  textGrammar: N5_TEXT_GRAMMAR_SEEDS,
} satisfies LevelQuestionProfile;

export const N5_GENERATED_QUESTIONS = buildGeneratedQuestionBank(
  profile,
  OFFICIAL_TYPES_BY_LEVEL.N5,
);
