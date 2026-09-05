import type { ClozeSeed, CompositionSeed, LexemeSeed } from "./bank-builder";

/**
 * Original N5 language-knowledge source items checked by deterministic tests.
 * This status records machine validation only; it is not human editorial approval.
 */
export const N5_LANGUAGE_EXPANSION_EDITORIAL_STATUS =
  "machine-validated" as const;

export const N5_LEXEME_EXPANSION = [
  {
    surface: "入口",
    reading: "いりぐち",
    readingDistractors: ["いれぐち", "はいりくち", "にゅうぐち"],
    kana: "いりぐち",
    spellingDistractors: ["人口", "入ロ", "人ロ"],
    sentence: "学校の入口で先生を待ちます。",
    paraphrase: "中へ入るところ",
    paraphraseDistractors: [
      "外へ出るところ",
      "勉強するへや",
      "電車に乗るところ",
    ],
    relatedKanji: ["入", "口"],
  },
  {
    surface: "出口",
    reading: "でぐち",
    readingDistractors: ["でくち", "いでぐち", "しゅつぐち"],
    kana: "でぐち",
    spellingDistractors: ["出ロ", "山口", "出国"],
    sentence: "駅の出口で友達に会いました。",
    paraphrase: "外へ出るところ",
    paraphraseDistractors: [
      "中へ入るところ",
      "切符を買うところ",
      "電車を待つところ",
    ],
    relatedKanji: ["出", "口"],
  },
  {
    surface: "午前",
    reading: "ごぜん",
    readingDistractors: ["ごまえ", "ごせん", "うままえ"],
    kana: "ごぜん",
    spellingDistractors: ["牛前", "午牛", "後前"],
    sentence: "午前九時に学校が始まります。",
    paraphrase: "昼の十二時より前",
    paraphraseDistractors: ["昼の十二時よりあと", "夜の十二時", "一日じゅう"],
    relatedKanji: ["午", "前"],
  },
  {
    surface: "午後",
    reading: "ごご",
    readingDistractors: ["ごうご", "こうご", "ごあと"],
    kana: "ごご",
    spellingDistractors: ["牛後", "後午", "午役"],
    sentence: "午後三時にお茶を飲みます。",
    paraphrase: "昼の十二時よりあと",
    paraphraseDistractors: ["昼の十二時より前", "朝早い時間", "夜の十二時"],
    relatedKanji: ["午", "後"],
  },
  {
    surface: "天気",
    reading: "てんき",
    readingDistractors: ["でんき", "てんけ", "あまき"],
    kana: "てんき",
    spellingDistractors: ["天汽", "大気", "天記"],
    sentence: "今日は天気がいいので、公園へ行きます。",
    paraphrase: "晴れや雨などのようす",
    paraphraseDistractors: ["朝や夜の時間", "町や国の名前", "春や夏の休み"],
    relatedKanji: ["天", "気"],
  },
  {
    surface: "名前",
    reading: "なまえ",
    readingDistractors: ["なまい", "めいまえ", "なまへ"],
    kana: "なまえ",
    spellingDistractors: ["名間", "各前", "名面"],
    sentence: "紙に名前を書いてください。",
    paraphrase: "人をよぶときのことば",
    paraphraseDistractors: [
      "住んでいるところ",
      "生まれた日にち",
      "仕事をする時間",
    ],
    relatedKanji: ["名", "前"],
  },
  {
    surface: "電話",
    reading: "でんわ",
    readingDistractors: ["てんわ", "でんば", "でんは"],
    kana: "でんわ",
    spellingDistractors: ["雷話", "電活", "電語"],
    sentence: "夜、父に電話をかけました。",
    paraphrase: "遠くの人と話すもの",
    paraphraseDistractors: [
      "写真をとるもの",
      "字を書くもの",
      "ごはんを作るもの",
    ],
    relatedKanji: ["電", "話"],
  },
  {
    surface: "時間",
    reading: "じかん",
    readingDistractors: ["しかん", "じげん", "じっかん"],
    kana: "じかん",
    spellingDistractors: ["時問", "寺間", "時門"],
    sentence: "出かける時間は七時です。",
    paraphrase: "何かをする時",
    paraphraseDistractors: [
      "何かをする場所",
      "いっしょにする人",
      "持って行くもの",
    ],
    relatedKanji: ["時", "間"],
  },
  {
    surface: "外国",
    reading: "がいこく",
    readingDistractors: ["がいごく", "そとくに", "がいこ"],
    kana: "がいこく",
    spellingDistractors: ["外園", "多国", "外告"],
    sentence: "兄は外国で日本語を教えています。",
    paraphrase: "日本ではない国",
    paraphraseDistractors: ["日本の中の町", "家の近くの道", "学校の中のへや"],
    relatedKanji: ["外", "国"],
  },
  {
    surface: "白い",
    reading: "しろい",
    readingDistractors: ["しらい", "はくい", "しろ"],
    kana: "しろい",
    spellingDistractors: ["自い", "百い", "白し"],
    sentence: "妹は白いシャツを着ています。",
    paraphrase: "雪のような色の",
    paraphraseDistractors: [
      "夜のような色の",
      "空のような色の",
      "りんごのような色の",
    ],
    relatedKanji: ["白"],
  },
  {
    surface: "上手",
    reading: "じょうず",
    readingDistractors: ["じょうて", "うえで", "かみて"],
    kana: "じょうず",
    spellingDistractors: ["上足", "上図", "土手"],
    sentence: "姉はピアノが上手です。",
    paraphrase: "ピアノをひくのがうまい",
    paraphraseDistractors: [
      "ピアノをひくのがきらい",
      "ピアノを持っていない",
      "ピアノを習っていない",
    ],
    relatedKanji: ["上", "手"],
  },
  {
    surface: "去年",
    reading: "きょねん",
    readingDistractors: ["きょうねん", "さくねん", "こねん"],
    kana: "きょねん",
    spellingDistractors: ["去午", "古年", "去牛"],
    sentence: "去年、家族と京都へ行きました。",
    paraphrase: "今年の前の年",
    paraphraseDistractors: [
      "今年のあとの年",
      "今の月の前の月",
      "今の週のあとの週",
    ],
    relatedKanji: ["去", "年"],
  },
] as const satisfies readonly LexemeSeed[];

export const N5_CONTEXT_EXPANSION = [
  {
    semanticId: "wash-face-before-breakfast",
    stem: "朝、顔を＿＿から、朝ごはんを食べます。",
    correct: "洗って",
    distractors: ["開けて", "借りて", "返して"],
    explanation:
      "顔を洗ってから is the natural routine and the てから form fixes the order: wash one's face, then eat breakfast.",
  },
  {
    semanticId: "box-too-heavy-to-carry",
    stem: "この箱はとても＿＿です。一人では持てません。",
    correct: "重い",
    distractors: ["軽い", "明るい", "若い"],
    explanation:
      "一人では持てません supplies the decisive reason: the box is heavy, 重い.",
  },
  {
    semanticId: "consult-map-for-station",
    stem: "駅の場所が分からないので、地図を＿＿。",
    correct: "見ます",
    distractors: ["聞きます", "着ます", "飲みます"],
    explanation:
      "When the station's location is unknown, 地図を見ます is the natural object-verb combination.",
  },
  {
    semanticId: "give-mother-birthday-flowers",
    stem: "今日は母の誕生日なので、母に花を＿＿。",
    correct: "あげます",
    distractors: ["もらいます", "借ります", "習います"],
    explanation:
      "The speaker gives flowers to their mother, so 母に花をあげます is the only coherent direction of giving.",
  },
  {
    semanticId: "brush-teeth-before-sleep",
    stem: "ねる前に、歯を＿＿。",
    correct: "みがきます",
    distractors: ["洗います", "切ります", "消します"],
    explanation:
      "歯をみがきます is the fixed everyday expression for brushing one's teeth before bed.",
  },
] as const satisfies readonly ClozeSeed[];

export const N5_GRAMMAR_EXPANSION = [
  {
    semanticId: "companion-particle-to",
    stem: "{person}さんは{other}さん＿＿いっしょに帰りました。",
    correct: "と",
    distractors: ["に", "を", "で"],
    explanation:
      "と marks the person who accompanies {person}さん; といっしょに means together with {other}さん.",
  },
  {
    semanticId: "open-until-nine",
    stem: "今は八時半です。スーパーは九時＿＿開いていますから、まだ買い物ができます。",
    correct: "まで",
    distractors: ["から", "を", "へ"],
    explanation:
      "九時まで marks the end point: the supermarket remains open until nine, so shopping is still possible.",
  },
  {
    semanticId: "shop-request-two-cakes",
    stem: "{person}さんは店の人に言いました。「このケーキを二つ＿＿。」",
    correct: "ください",
    distractors: ["くださる", "くださって", "くださった"],
    explanation:
      "After naming the item and quantity in a shop, ください makes the direct polite request: two of these cakes, please.",
  },
  {
    semanticId: "movie-invitation-masen-ka",
    stem: "{person}さんは友達を映画にさそいました。「{day}、いっしょに映画を見＿＿か。」",
    correct: "ません",
    distractors: ["ました", "ています", "ませんでした"],
    explanation:
      "The invitation pattern is verb stem plus ませんか: 見ませんか means would you like to watch it together?.",
  },
] as const satisfies readonly ClozeSeed[];

export const N5_COMPOSITION_EXPANSION = [
  {
    semanticId: "polite-negative-i-adjective",
    prefix: "この",
    parts: ["かばんは", "高く", "あり", "ません"],
    suffix: "。",
    explanation:
      "The polite negative of 高い is the fixed sequence 高くありません, after the topic かばんは.",
  },
  {
    semanticId: "indeterminate-negative-past",
    prefix: "きのうは",
    parts: ["どこへも", "行き", "ません", "でした"],
    suffix: "。",
    explanation:
      "どこへも pairs with the negative past predicate 行きませんでした to mean did not go anywhere.",
  },
  {
    semanticId: "relative-clause-mothers-cake",
    prefix: "これは",
    parts: ["母が", "作った", "いちごの", "ケーキです"],
    suffix: "。",
    explanation:
      "母が作った modifies いちごのケーキ, and ケーキです completes the sentence.",
  },
  {
    semanticId: "one-small-desk-in-room",
    prefix: "わたしのへやには",
    parts: ["小さい", "つくえが", "一つ", "あります"],
    suffix: "。",
    explanation:
      "小さい directly modifies つくえ, which is counted by 一つ before the existence verb あります.",
  },
] as const satisfies readonly CompositionSeed[];
