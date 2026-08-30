import type {
  ClozeSeed,
  CompositionSeed,
  LexemeSeed,
  UsageSeed,
} from "./bank-builder";

type IdentifiedSeed<T> = T & { semanticId: string };

/** Machine validation is not proficient-human or native-speaker approval. */
export const N3_LANGUAGE_EXPANSION_EDITORIAL_STATUS =
  "machine-validated" as const;

export const N3_LEXEME_EXPANSION = [
  {
    semanticId: "N3-lexeme-class-absence",
    surface: "欠席",
    reading: "けっせき",
    readingDistractors: ["けつせき", "けっしゃく", "かっせき"],
    kana: "けっせき",
    spellingDistractors: ["決席", "欠昔", "欠関"],
    sentence: "体調が悪かったので、昨日の授業を欠席した。",
    paraphrase: "授業に出なかった",
    paraphraseDistractors: [
      "授業に遅れて入った",
      "授業を予定より早く終えた",
      "同じ授業をもう一度受けた",
    ],
    relatedKanji: ["欠", "席"],
  },
  {
    semanticId: "N3-lexeme-application-deadline",
    surface: "期限",
    reading: "きげん",
    readingDistractors: ["ぎげん", "きけん", "きがん"],
    kana: "きげん",
    spellingDistractors: ["気限", "期原", "期眼"],
    sentence: "申込書は期限までに提出してください。",
    paraphrase: "決められた最後の日",
    paraphraseDistractors: [
      "申し込みを始めた日",
      "結果を知らせる方法",
      "書類を受け取る場所",
    ],
    relatedKanji: ["期", "限"],
  },
  {
    semanticId: "N3-lexeme-station-crowding",
    surface: "混雑",
    reading: "こんざつ",
    readingDistractors: ["こんさつ", "こんじつ", "こんぞう"],
    kana: "こんざつ",
    spellingDistractors: ["混札", "困雑", "混察"],
    sentence: "朝の駅は通勤する人で混雑している。",
    paraphrase: "人が多くてこんでいる",
    paraphraseDistractors: [
      "人が少なくて静かだ",
      "電車が一台も来ない",
      "駅の建物が新しくなった",
    ],
    relatedKanji: ["混", "雑"],
  },
  {
    semanticId: "N3-lexeme-event-postponement",
    surface: "延期",
    reading: "えんき",
    readingDistractors: ["えんぎ", "のぶき", "えんけい"],
    kana: "えんき",
    spellingDistractors: ["遠期", "延季", "延記"],
    sentence: "大雨のため、運動会は来週に延期された。",
    paraphrase: "予定より後の日に変えられた",
    paraphraseDistractors: [
      "予定より早く始まった",
      "場所だけが変更された",
      "予定どおりの日に行われた",
    ],
    relatedKanji: ["延", "期"],
  },
  {
    semanticId: "N3-lexeme-address-procedure",
    surface: "手続き",
    reading: "てつづき",
    readingDistractors: ["てつつき", "てづづき", "しゅぞくき"],
    kana: "てつづき",
    spellingDistractors: ["手継き", "手続ぎ", "手統き"],
    sentence: "引っ越した後、市役所で住所変更の手続きをした。",
    paraphrase: "必要な書類を出して決められた処理をすること",
    paraphraseDistractors: [
      "新しい住所まで荷物を運ぶこと",
      "引っ越す理由を友人に話すこと",
      "市役所の場所を地図で探すこと",
    ],
    relatedKanji: ["手", "続"],
  },
  {
    semanticId: "N3-lexeme-venue-cost",
    surface: "費用",
    reading: "ひよう",
    readingDistractors: ["びよう", "ひょう", "ひよ"],
    kana: "ひよう",
    spellingDistractors: ["非用", "費要", "費様"],
    sentence: "会場を借りる費用は会社が払う。",
    paraphrase: "何かをするために必要なお金",
    paraphraseDistractors: [
      "仕事を終えるまでの時間",
      "会場を利用できる人数",
      "会社に提出する書類",
    ],
    relatedKanji: ["費", "用"],
  },
  {
    semanticId: "N3-lexeme-machine-cause",
    surface: "原因",
    reading: "げんいん",
    readingDistractors: ["げいいん", "けんいん", "げんにん"],
    kana: "げんいん",
    spellingDistractors: ["源因", "原困", "原印"],
    sentence: "機械が止まった原因を調べている。",
    paraphrase: "問題が起きた理由",
    paraphraseDistractors: [
      "機械を使い始めた時間",
      "問題を直すための道具",
      "調査を担当している人",
    ],
    relatedKanji: ["原", "因"],
  },
  {
    semanticId: "N3-lexeme-traffic-solution",
    surface: "解決",
    reading: "かいけつ",
    readingDistractors: ["かいげつ", "げかつ", "かいせつ"],
    kana: "かいけつ",
    spellingDistractors: ["会決", "解結", "快決"],
    sentence: "みんなで話し合い、交通の問題を解決した。",
    paraphrase: "問題をなくしてうまく終わらせた",
    paraphraseDistractors: [
      "問題について初めて聞いた",
      "話し合いを途中で中止した",
      "交通の問題を記録に残した",
    ],
    relatedKanji: ["解", "決"],
  },
] satisfies readonly IdentifiedSeed<LexemeSeed>[];

export const N3_CONTEXT_EXPANSION = [
  {
    semanticId: "N3-context-delay-meeting-start",
    stem: "電車が止まって講師の到着が遅れたため、会議の開始を三十分＿＿。",
    correct: "遅らせた",
    distractors: ["早めた", "縮めた", "加えた"],
    explanation:
      "The lecturer arrived late, so 遅らせた is the only choice that moves the meeting's start thirty minutes later.",
  },
  {
    semanticId: "N3-context-correct-handout-error",
    stem: "資料に間違いが見つかったので、配る前に内容を＿＿。",
    correct: "修正した",
    distractors: ["交換した", "延長した", "通過した"],
    explanation:
      "An error in a handout is corrected before distribution; 内容を修正する is the natural and decisive collocation.",
  },
  {
    semanticId: "N3-context-consult-doctor",
    stem: "この薬を飲んでも熱が下がらない場合は、医師に＿＿してください。",
    correct: "相談",
    distractors: ["参加", "出席", "到着"],
    explanation:
      "If the fever does not fall, the instruction is to consult a doctor: 医師に相談してください.",
  },
  {
    semanticId: "N3-context-incomplete-application",
    stem: "必要な書類が一枚足りなかったため、申し込みの手続きを＿＿できなかった。",
    correct: "完了",
    distractors: ["解決", "実現", "達成"],
    explanation:
      "A missing required document prevents completing the application procedure, expressed as 手続きを完了できなかった.",
  },
  {
    semanticId: "N3-context-free-shuttle-convenience",
    stem: "会場は駅から遠いが、無料のバスが出ているので、それほど＿＿ではない。",
    correct: "不便",
    distractors: ["不足", "不安", "不満"],
    explanation:
      "The free shuttle offsets the distant location, so the venue is not especially inconvenient: 不便ではない.",
  },
] satisfies readonly IdentifiedSeed<ClozeSeed>[];

export const N3_USAGE_EXPANSION = [
  {
    semanticId: "N3-usage-maintain-temperature",
    focus: "保つ",
    correct: "機械を使って、室内の温度を一定に保っている。",
    distractors: [
      "駅までの道が分からなかったので、地図に保った。",
      "野菜を細かく保ってから、鍋に入れた。",
      "先生の説明が聞こえず、もう一度保ってもらった。",
    ],
    explanation:
      "保つ means to maintain a state, so keeping the room temperature constant is the only standard use.",
  },
  {
    semanticId: "N3-usage-finish-bank-errand",
    focus: "済ませる",
    correct: "昼休みの間に、銀行の用事を済ませた。",
    distractors: [
      "雨がやんだので、使った傘を済ませた。",
      "駅に着くと、電車から乗客が済ませた。",
      "この薬を飲めば、すぐに熱を済ませる。",
    ],
    explanation:
      "用事を済ませる means to finish an errand; the other sentences require putting away, getting off, or lowering.",
  },
  {
    semanticId: "N3-usage-prevent-accidents",
    focus: "防ぐ",
    correct: "事故を防ぐため、作業の前に機械を点検する。",
    distractors: [
      "寒かったので、厚い上着を防いで出かけた。",
      "予定が合わず、会議を来週に防いだ。",
      "駅までの道を知らないので、駅員に防いだ。",
    ],
    explanation:
      "防ぐ means to prevent an unwanted event, so inspecting machinery to prevent accidents is the correct use.",
  },
  {
    semanticId: "N3-usage-fee-includes-drink",
    focus: "含む",
    correct: "参加費には、資料代と飲み物代も含まれている。",
    distractors: [
      "雨が降ったので、かさを手に含んで出かけた。",
      "会議で自分の考えを大きな声に含んだ。",
      "友だちの荷物を駅まで含んであげた。",
    ],
    explanation:
      "含まれている correctly states that the two charges are included in the participation fee.",
  },
  {
    semanticId: "N3-usage-avoid-rush-hour",
    focus: "避ける",
    correct: "朝の混雑を避けるため、いつもより早く家を出た。",
    distractors: [
      "料理が冷めたので、電子レンジで避けた。",
      "部屋が暗かったので、電気を避けた。",
      "人数分の資料を避けて、机の上に置いた。",
    ],
    explanation:
      "混雑を避ける means to avoid crowding; leaving earlier is a coherent action for that purpose.",
  },
] satisfies readonly IdentifiedSeed<UsageSeed>[];

export const N3_GRAMMAR_EXPANSION = [
  {
    semanticId: "N3-grammar-preparation-despite-cancellation",
    stem: "せっかく資料を準備した＿＿、会議は急に中止になった。",
    correct: "のに",
    distractors: ["ので", "ために", "ながら"],
    explanation:
      "せっかく plus のに expresses the disappointed contrast between preparing the materials and the meeting being cancelled.",
  },
  {
    semanticId: "N3-grammar-passive-designer-agent",
    stem: "この建物は、町で有名な建築家＿＿設計された。",
    correct: "によって",
    distractors: ["について", "に対して", "にとって"],
    explanation:
      "In a passive sentence, によって marks the agent responsible for the design; the other compounds cannot mark its creator.",
  },
  {
    semanticId: "N3-grammar-after-moving-habit",
    stem: "この町に引っ越して＿＿、毎朝この公園を歩いている。",
    correct: "からは",
    distractors: ["までは", "ほどは", "ばかりは"],
    explanation:
      "てからは marks the move as the starting point for the morning habit that continues through the present.",
  },
  {
    semanticId: "N3-grammar-contrasting-work-tradeoff",
    stem: "この仕事は自由な時間が多い＿＿、毎月の収入が安定しないという問題もある。",
    correct: "一方で",
    distractors: ["たびに", "うちに", "ところで"],
    explanation:
      "一方で introduces the contrasting disadvantage after the job's benefit of having more free time.",
  },
  {
    semanticId: "N3-grammar-only-after-homework",
    stem: "宿題を全部＿＿からでないと、遊びに行けません。",
    correct: "終えて",
    distractors: ["終える", "終えた", "終わる"],
    explanation:
      "The restriction pattern is the て-form plus からでないと: only after finishing all the homework.",
  },
  {
    semanticId: "N3-grammar-not-only-grammar",
    stem: "この講座では文法＿＿、会話も練習できる。",
    correct: "だけでなく",
    distractors: ["しかなく", "について", "に比べて"],
    explanation:
      "文法だけでなく、会話も forms the paired addition not only grammar but also conversation.",
  },
] satisfies readonly IdentifiedSeed<ClozeSeed>[];

export const N3_COMPOSITION_EXPANSION = [
  {
    semanticId: "N3-composition-near-and-delicious",
    prefix: "この店は",
    parts: ["駅から近い", "だけでなく", "料理も", "おいしいです"],
    suffix: "。",
    explanation:
      "駅から近いだけでなく creates the first half of the paired addition, followed by 料理もおいしいです.",
  },
  {
    semanticId: "N3-composition-continuing-after-coming-to-japan",
    prefix: "わたしは",
    parts: ["日本に", "来てからずっと", "この町に", "住んでいます"],
    suffix: "。",
    explanation:
      "日本に来てからずっと sets the starting point and duration, followed by この町に住んでいます.",
  },
  {
    semanticId: "N3-composition-leave-early-for-meeting",
    prefix: "会議に",
    parts: ["間に合うように", "いつもより", "早く家を", "出ました"],
    suffix: "。",
    explanation:
      "間に合うように expresses purpose, then いつもより早く modifies the action 家を出ました.",
  },
  {
    semanticId: "N3-composition-considered-study-abroad",
    prefix: "家族と",
    parts: ["よく相談した結果", "来年から", "留学することに", "しました"],
    suffix: "。",
    explanation:
      "相談した結果 establishes the considered basis; 来年から留学することにしました states the resulting decision.",
  },
  {
    semanticId: "N3-composition-shop-already-closed",
    prefix: "教えてもらった",
    parts: ["店へ", "行ってみたところ", "もう", "閉まっていました"],
    suffix: "。",
    explanation:
      "店へ行ってみたところ introduces the discovered result, completed by もう閉まっていました.",
  },
  {
    semanticId: "N3-composition-no-experience-required",
    prefix: "この仕事は",
    parts: ["特別な", "経験がなくても", "すぐに", "始められます"],
    suffix: "。",
    explanation:
      "特別な directly modifies 経験, なくても gives the concessive condition, and すぐに modifies 始められます.",
  },
] satisfies readonly IdentifiedSeed<CompositionSeed>[];

export const N3_LANGUAGE_EXPANSION_SOURCE_COUNT =
  N3_LEXEME_EXPANSION.length +
  N3_CONTEXT_EXPANSION.length +
  N3_USAGE_EXPANSION.length +
  N3_GRAMMAR_EXPANSION.length +
  N3_COMPOSITION_EXPANSION.length;
