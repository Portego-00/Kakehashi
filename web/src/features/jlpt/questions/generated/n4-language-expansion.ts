import type {
  ClozeSeed,
  CompositionSeed,
  LexemeSeed,
  UsageSeed,
} from "./bank-builder";

type IdentifiedSeed<T> = T & { semanticId: string };

/**
 * Original N4 language-knowledge seeds authored against the official N4 item
 * purposes. `semanticId` is source-level editorial identity and is also used
 * directly for cloze and composition provenance; lexical and usage runtime
 * identities remain their stable surface word and focus word.
 */
export const N4_LEXEME_EXPANSION = [
  {
    semanticId: "N4-lexeme-reception-desk",
    surface: "受付",
    reading: "うけつけ",
    readingDistractors: ["うけづけ", "じゅけつけ", "うけつき"],
    kana: "うけつけ",
    spellingDistractors: ["受村", "授付", "受附"],
    sentence: "病院に着いたら、まず受付で名前を書いてください。",
    paraphrase: "最初に手続きをする場所",
    paraphraseDistractors: [
      "荷物を受け取るだけの部屋",
      "医者が休むための場所",
      "薬を作っている工場",
    ],
  },
  {
    semanticId: "N4-lexeme-guidance",
    surface: "案内",
    reading: "あんない",
    readingDistractors: ["あんだい", "あない", "あんらい"],
    kana: "あんない",
    spellingDistractors: ["安内", "案肉", "案納"],
    sentence: "係の人が新しい図書館の中を案内してくれました。",
    paraphrase: "場所や使い方を説明しながら見せる",
    paraphraseDistractors: [
      "建物の外で長く待たせる",
      "必要な道具を全部借りる",
      "予定を変えて家へ帰る",
    ],
  },
  {
    semanticId: "N4-lexeme-equipment-breakdown",
    surface: "故障",
    reading: "こしょう",
    readingDistractors: ["ごしょう", "こじょう", "こうしょう"],
    kana: "こしょう",
    spellingDistractors: ["古障", "故章", "固障"],
    sentence: "エレベーターは故障しているので、階段を使ってください。",
    paraphrase: "機械がこわれて動かないこと",
    paraphraseDistractors: [
      "建物が休みで入れないこと",
      "電気を使わずに働くこと",
      "新しい機械に取り替えること",
    ],
  },
  {
    semanticId: "N4-lexeme-attendance",
    surface: "出席",
    reading: "しゅっせき",
    readingDistractors: ["しゅせき", "しゅつせき", "しゅっぜき"],
    kana: "しゅっせき",
    spellingDistractors: ["出昔", "出関", "主席"],
    sentence: "来週の会議に出席できる人は、今日中に返事をしてください。",
    paraphrase: "会議や授業に出ること",
    paraphraseDistractors: [
      "会議の時間を別の日に変えること",
      "授業で使う本を用意すること",
      "学校や会社をしばらく休むこと",
    ],
  },
  {
    semanticId: "N4-lexeme-arrival",
    surface: "到着",
    reading: "とうちゃく",
    readingDistractors: ["どうちゃく", "とうじゃく", "とちゃく"],
    kana: "とうちゃく",
    spellingDistractors: ["道着", "倒着", "到者"],
    sentence: "バスは予定より十分遅れて駅に到着しました。",
    paraphrase: "目的の場所に着くこと",
    paraphraseDistractors: [
      "乗り物が途中で止まること",
      "駅を出る時間を決めること",
      "別の乗り物に乗り換えること",
    ],
  },
  {
    semanticId: "N4-lexeme-schedule-change",
    surface: "変更",
    reading: "へんこう",
    readingDistractors: ["へんごう", "べんこう", "へんきょう"],
    kana: "へんこう",
    spellingDistractors: ["変向", "辺更", "返更"],
    sentence: "雨のため、遠足の日が{day}に変更になりました。",
    paraphrase: "決まっていたことを変えること",
    paraphraseDistractors: [
      "決めたとおりに始めること",
      "終わった予定を記録すること",
      "必要な物を先に集めること",
    ],
  },
  {
    semanticId: "N4-lexeme-participation",
    surface: "参加",
    reading: "さんか",
    readingDistractors: ["さんが", "せんか", "さんけ"],
    kana: "さんか",
    spellingDistractors: ["参化", "三加", "産加"],
    sentence: "{person}さんは{day}の町の掃除に参加します。",
    paraphrase: "活動の仲間に加わる",
    paraphraseDistractors: [
      "活動を見るだけで帰る",
      "一人で別の仕事を始める",
      "活動を来月まで休みにする",
    ],
  },
  {
    semanticId: "N4-lexeme-explanation",
    surface: "説明",
    reading: "せつめい",
    readingDistractors: ["せっめい", "せつみょう", "せちめい"],
    kana: "せつめい",
    spellingDistractors: ["設明", "説名", "切明"],
    sentence: "先生がこの機械の使い方を分かりやすく説明しました。",
    paraphrase: "相手に分かるように話す",
    paraphraseDistractors: [
      "相手の質問を聞かずに終わる",
      "使い方を自分で考え直す",
      "機械を別の部屋へ運ぶ",
    ],
  },
] satisfies readonly IdentifiedSeed<LexemeSeed>[];

export const N4_CONTEXT_EXPANSION = [
  {
    semanticId: "N4-context-cancellation-notice",
    stem: "雨で試合が中止になったことを、先生がみんなに＿＿。",
    correct: "伝えました",
    distractors: ["たずねました", "比べました", "迎えました"],
    explanation:
      "伝える means to communicate information, so it fits a teacher notifying everyone that the match was cancelled.",
  },
  {
    semanticId: "N4-context-station-locker",
    stem: "荷物が重かったので、駅のロッカーに＿＿。",
    correct: "預けました",
    distractors: ["集めました", "並べました", "包みました"],
    explanation:
      "荷物をロッカーに預ける is the natural expression for leaving luggage in a station locker.",
  },
  {
    semanticId: "N4-context-participation-reply",
    stem: "明日の試合に参加できるか、今日中に＿＿ください。",
    correct: "返事して",
    distractors: ["支度して", "案内して", "遠慮して"],
    explanation:
      "返事する means to reply; the listener must report whether they can participate by the stated deadline.",
  },
  {
    semanticId: "N4-context-shirt-exchange",
    stem: "店員が同じ値段の大きいシャツに＿＿くれました。",
    correct: "取り替えて",
    distractors: ["預けて", "片付けて", "届けて"],
    explanation:
      "取り替える means to exchange one item for another and fits changing the shirt for a larger one.",
  },
  {
    semanticId: "N4-context-safer-road-choice",
    stem: "いつもの道は暗くて危ないので、今日は別の道を＿＿。",
    correct: "選びました",
    distractors: ["間違えました", "断りました", "ほめました"],
    explanation:
      "選ぶ means to choose; the danger on the usual road gives a clear reason to choose a different one.",
  },
] satisfies readonly IdentifiedSeed<ClozeSeed>[];

export const N4_USAGE_EXPANSION = [
  {
    semanticId: "N4-usage-leave-in-care",
    focus: "預ける",
    correct: "旅行の間、飼っている猫を友だちに預けた。",
    distractors: [
      "駅までの道を知らない人に預けた。",
      "会議の時間を三時に預けた。",
      "汚れたシャツを洗濯機に預けた。",
    ],
    explanation:
      "預ける is used when leaving a person, animal, or possession in someone else's care; the cat is entrusted to a friend.",
  },
  {
    semanticId: "N4-usage-decline-invitation",
    focus: "断る",
    correct: "都合が悪かったので、友だちの誘いを断った。",
    distractors: [
      "道が分からなかったので、駅員に道を断った。",
      "寒かったので、窓をしっかり断った。",
      "字が小さかったので、本を近くに断った。",
    ],
    explanation:
      "断る means to decline an invitation or request; the other sentences require asking, closing, or moving something.",
  },
  {
    semanticId: "N4-usage-check-locked-door",
    focus: "確かめる",
    correct: "出かける前に、ドアにかぎをかけたか確かめた。",
    distractors: [
      "電車が来たので、急いでホームへ確かめた。",
      "雨がやんだので、かさを細く確かめた。",
      "疲れたので、いすに座って体を確かめた。",
    ],
    explanation:
      "確かめる means to check or confirm a fact, such as whether the door was locked before leaving.",
  },
  {
    semanticId: "N4-usage-wrong-number",
    focus: "間違える",
    correct: "電話番号を間違えて、知らない人にかけてしまった。",
    distractors: [
      "重い荷物を駅のロッカーに間違えた。",
      "来月の旅行を早く間違えておいた。",
      "先生の説明をノートに間違えてある。",
    ],
    explanation:
      "間違える means to make an error; entering the wrong telephone number naturally leads to calling a stranger.",
  },
  {
    semanticId: "N4-usage-delivery-arrives",
    focus: "届く",
    correct: "インターネットで注文した本が、昨日家に届いた。",
    distractors: [
      "店員が注文した本を家に届いた。",
      "駅に着いたら、友だちを電話で届いた。",
      "旅行の予定をみんなにメールで届いた。",
    ],
    explanation:
      "届く is intransitive and describes a sent item arriving; the first distractor needs 届けた and the others need unrelated verbs.",
  },
  {
    semanticId: "N4-usage-illness-recovers",
    focus: "治る",
    correct: "薬を飲んでよく寝たら、風邪が治った。",
    distractors: [
      "医者が父の病気を治った。",
      "作文の間違いを赤いペンで治った。",
      "こわれた時計を店で治った。",
    ],
    explanation:
      "治る is intransitive for an illness getting better; the distractors need the transitive forms 治した or 直した.",
  },
] satisfies readonly IdentifiedSeed<UsageSeed>[];

export const N4_GRAMMAR_EXPANSION = [
  {
    semanticId: "N4-grammar-reason-node",
    stem: "このかばんは軽くて、たくさん入る＿＿、旅行に便利です。",
    correct: "ので",
    distractors: ["のに", "ながら", "まで"],
    explanation:
      "ので gives the reason the bag is convenient: it is light and holds a lot. のに would signal an unsupported contrast.",
  },
  {
    semanticId: "N4-grammar-simultaneous-photo-talk",
    stem: "みんなで写真を見＿＿、旅行の話をしました。",
    correct: "ながら",
    distractors: ["そうで", "ために", "しか"],
    explanation:
      "The verb stem plus ながら links two simultaneous actions: looking at photographs while talking about the trip.",
  },
  {
    semanticId: "N4-grammar-visible-small-writing",
    stem: "この字は小さすぎて、よく＿＿。",
    correct: "見えません",
    distractors: ["見ません", "見せません", "見つけません"],
    explanation:
      "見えません expresses that the writing is not visible because it is too small; the other forms describe not looking, not showing, or not finding.",
  },
  {
    semanticId: "N4-grammar-study-decision",
    stem: "来週のテストのために、毎日漢字を勉強する＿＿しました。",
    correct: "ことに",
    distractors: ["ことが", "ようと", "つもりに"],
    explanation:
      "Dictionary form plus ことにしました expresses a decision made by the speaker to study kanji every day.",
  },
  {
    semanticId: "N4-grammar-benefactive-directions",
    stem: "先生がわたしに教えて＿＿道を行ったら、すぐ駅に着きました。",
    correct: "くれた",
    distractors: ["あげた", "やった", "くれられた"],
    explanation:
      "教えてくれた presents the teacher's helpful action toward the speaker, and the whole relative clause modifies 道.",
  },
  {
    semanticId: "N4-grammar-until-homework-finished",
    stem: "宿題が全部終わる＿＿、遊びに行けません。",
    correct: "まで",
    distractors: ["より", "ほど", "しか"],
    explanation:
      "まで marks the endpoint: going out is not possible until all the homework is finished.",
  },
  {
    semanticId: "N4-grammar-acquired-newspaper-ability",
    stem: "勉強を続けて、日本語の新聞が少し読める＿＿なりました。",
    correct: "ように",
    distractors: ["そうで", "ことを", "ためで"],
    explanation:
      "Potential form plus ようになりました describes an acquired ability: becoming able to read some Japanese newspaper text.",
  },
] satisfies readonly IdentifiedSeed<ClozeSeed>[];

export const N4_COMPOSITION_EXPANSION = [
  {
    semanticId: "N4-composition-trip-list-preparation",
    prefix: "旅行の前に",
    parts: ["必要な物を", "紙に", "書いて", "おきました"],
    suffix: "。",
    explanation:
      "必要な物を is the object, 紙に gives the destination for writing, and 書いておきました expresses preparation in advance.",
  },
  {
    semanticId: "N4-composition-shared-cooked-meal",
    prefix: "きのうは",
    parts: ["{person}さんが", "作ってくれた", "料理を", "みんなで食べました"],
    suffix: "。",
    explanation:
      "{person}さんが作ってくれた is a relative clause modifying 料理を, followed by the main action みんなで食べました.",
  },
  {
    semanticId: "N4-composition-store-home-delivery",
    prefix: "この店では",
    parts: ["買った品物を", "家まで", "送って", "もらえます"],
    suffix: "。",
    explanation:
      "The purchased goods are the object, 家まで is their destination, and 送ってもらえます expresses receiving the delivery service.",
  },
  {
    semanticId: "N4-composition-fever-advice",
    prefix: "熱があるので",
    parts: ["今日は", "早く", "寝た", "ほうがいいです"],
    suffix: "。",
    explanation:
      "今日は and 早く modify the action, while past plain form plus ほうがいいです gives advice to go to bed early.",
  },
  {
    semanticId: "N4-composition-meeting-schedule-decision",
    prefix: "{day}の会議は",
    parts: ["二時から", "始まる", "ことに", "なりました"],
    suffix: "。",
    explanation:
      "二時から modifies 始まる, and 始まることになりました reports that the meeting schedule has been decided.",
  },
  {
    semanticId: "N4-composition-convenient-station-bus",
    prefix: "駅へ行くには",
    parts: ["このバスに", "乗るのが", "いちばん", "便利です"],
    suffix: "。",
    explanation:
      "このバスに乗る is nominalized with の, marked as the subject by が, and evaluated as the most convenient option.",
  },
] satisfies readonly IdentifiedSeed<CompositionSeed>[];

export const N4_LANGUAGE_EXPANSION_SOURCE_COUNT =
  N4_LEXEME_EXPANSION.length +
  N4_CONTEXT_EXPANSION.length +
  N4_USAGE_EXPANSION.length +
  N4_GRAMMAR_EXPANSION.length +
  N4_COMPOSITION_EXPANSION.length;
