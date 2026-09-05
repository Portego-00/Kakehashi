import type {
  ClozeSeed,
  CompositionSeed,
  LexemeSeed,
  UsageSeed,
} from "./bank-builder";

/**
 * Original N1 language-knowledge source items checked by deterministic tests.
 * This status records machine validation only; it is not human or native-speaker approval.
 */
export const N1_LANGUAGE_EXPANSION_EDITORIAL_STATUS =
  "machine-validated" as const;

export const N1_LEXEME_EXPANSION = [
  {
    surface: "逼迫",
    reading: "ひっぱく",
    readingDistractors: ["ひつぱく", "ひっぱつ", "へきはく"],
    kana: "ひっぱく",
    spellingDistractors: ["逼泊", "必迫", "迫迫"],
    sentence: "原材料費の高騰で、事業部の予算は以前にも増して逼迫している。",
    paraphrase: "余裕がほとんどない状態になっている",
    paraphraseDistractors: [
      "使える額が大幅に増えている",
      "配分の基準が明確になっている",
      "支出の内容が公開されている",
    ],
    relatedKanji: ["逼", "迫"],
  },
  {
    surface: "払拭",
    reading: "ふっしょく",
    readingDistractors: ["はらいしょく", "ふっせつ", "ふつしき"],
    kana: "ふっしょく",
    spellingDistractors: ["払触", "払沫", "払植"],
    sentence: "監査結果を公表しただけでは、組織への不信を払拭できなかった。",
    paraphrase: "すっかり取り除く",
    paraphraseDistractors: [
      "さらに強く意識させる",
      "公の場で詳しく説明する",
      "一時的に別の話題へ移す",
    ],
    relatedKanji: ["払", "拭"],
  },
  {
    surface: "醸成",
    reading: "じょうせい",
    readingDistractors: ["しょうせい", "じょうじょう", "じょうなり"],
    kana: "じょうせい",
    spellingDistractors: ["譲成", "醸正", "情成"],
    sentence: "異なる部署が意見を交わす場を設け、協力しやすい風土を醸成した。",
    paraphrase: "時間をかけて作り上げる",
    paraphraseDistractors: [
      "規則によって直ちに禁止する",
      "外部からそのまま取り入れる",
      "一度に細かく分類する",
    ],
    relatedKanji: ["醸", "成"],
  },
  {
    surface: "頓挫",
    reading: "とんざ",
    readingDistractors: ["どんざ", "とんさ", "たんざ"],
    kana: "とんざ",
    spellingDistractors: ["頓座", "鈍挫", "頓左"],
    sentence: "共同事業は資金のめどが立たず、準備段階で頓挫した。",
    paraphrase: "途中で行き詰まって止まる",
    paraphraseDistractors: [
      "予定より早く完了する",
      "規模を広げながら継続する",
      "担当を別の組織へ引き継ぐ",
    ],
    relatedKanji: ["頓", "挫"],
  },
  {
    surface: "逸脱",
    reading: "いつだつ",
    readingDistractors: ["いちだつ", "えつだつ", "いつぬけ"],
    kana: "いつだつ",
    spellingDistractors: ["逸悦", "一脱", "逸説"],
    sentence: "その運用は、制度が本来想定していた範囲から逸脱している。",
    paraphrase: "決められた範囲から外れる",
    paraphraseDistractors: [
      "定められた手順を忠実に守る",
      "対象となる範囲を意図的に狭める",
      "複数の基準を一つに統合する",
    ],
    relatedKanji: ["逸", "脱"],
  },
  {
    surface: "勘案",
    reading: "かんあん",
    readingDistractors: ["かんがん", "こうあん", "かんない"],
    kana: "かんあん",
    spellingDistractors: ["勘安", "感案", "観案"],
    sentence: "地域ごとの人口構成も勘案して、支援策の配分を決める必要がある。",
    paraphrase: "複数の事情を考え合わせる",
    paraphraseDistractors: [
      "一つの数値だけを基準にする",
      "既に決まった案を撤回する",
      "関係のない事情を切り離す",
    ],
    relatedKanji: ["勘", "案"],
  },
  {
    surface: "収斂",
    reading: "しゅうれん",
    readingDistractors: ["しゅうけん", "しゅうれい", "しゅれん"],
    kana: "しゅうれん",
    spellingDistractors: ["収練", "集斂", "収廉"],
    sentence:
      "議論を重ねるうちに、対立していた意見が一つの案に収斂していった。",
    paraphrase: "次第に一つの方向へまとまる",
    paraphraseDistractors: [
      "互いの差がさらに大きくなる",
      "結論を出さず議論を打ち切る",
      "論点を無関係な話題へ移す",
    ],
    relatedKanji: ["収", "斂"],
  },
  {
    surface: "黙認",
    reading: "もくにん",
    readingDistractors: ["もくじん", "だくにん", "もくねん"],
    kana: "もくにん",
    spellingDistractors: ["黙任", "墨認", "黙忍"],
    sentence: "管理職が規則違反を黙認してきた責任も問われている。",
    paraphrase: "問題だと知りながら止めずに認める",
    paraphraseDistractors: [
      "事実を知らないまま正式に承認する",
      "違反を見つけて直ちに処分する",
      "判断を保留して調査を依頼する",
    ],
    relatedKanji: ["黙", "認"],
  },
  {
    surface: "毀損",
    reading: "きそん",
    readingDistractors: ["かいそん", "きしつ", "こそん"],
    kana: "きそん",
    spellingDistractors: ["毀存", "棄損", "既損"],
    sentence: "根拠のない発表は、研究機関への信頼を毀損しかねない。",
    paraphrase: "価値や信用を傷つける",
    paraphraseDistractors: [
      "評価の基準を具体的に示す",
      "失われた信用を完全に回復する",
      "関係者の責任を公平に分ける",
    ],
    relatedKanji: ["毀", "損"],
  },
  {
    surface: "淘汰",
    reading: "とうた",
    readingDistractors: ["とうち", "たくた", "とうだ"],
    kana: "とうた",
    spellingDistractors: ["陶汰", "淘太", "投汰"],
    sentence: "需要の変化に対応できないサービスは、市場から徐々に淘汰された。",
    paraphrase: "選別されて残らなくなる",
    paraphraseDistractors: [
      "利用者の要望に合わせて改良される",
      "公的な支援を受けて普及する",
      "複数の事業者によって共同運営される",
    ],
    relatedKanji: ["淘", "汰"],
  },
] as const satisfies readonly LexemeSeed[];

export const N1_CONTEXT_EXPANSION = [
  {
    semanticId: "conflicting-testimony-leaves-picture-unclear",
    stem: "複数の証言が食い違い、事件の全体像は依然として＿＿なままだ。",
    correct: "不明瞭",
    distractors: ["簡潔", "円滑", "厳密"],
    explanation:
      "食い違う証言のため全体像が明確になっていないので、不明瞭なままだ is the only expression that fits both the meaning and construction.",
  },
  {
    semanticId: "negotiations-reach-complete-deadlock",
    stem: "交渉は双方が譲歩せず、完全に＿＿している。",
    correct: "膠着",
    distractors: ["進展", "緩和", "収束"],
    explanation:
      "双方が譲歩しないという原因から、交渉が動かない膠着状態だと分かる。進展・緩和・収束は文脈と反対になる。",
  },
  {
    semanticId: "selective-quotation-distorts-intent",
    stem: "発言の一部だけが切り取られ、本人の真意が＿＿伝わってしまった。",
    correct: "ゆがんで",
    distractors: ["和らいで", "潤って", "整って"],
    explanation:
      "一部だけの引用によって本来の意図とは違う形になったため、真意がゆがんで伝わる is the natural and contextually precise combination.",
  },
  {
    semanticId: "examples-insufficient-to-support-claim",
    stem: "その説明は具体例に乏しく、主張を＿＿だけの説得力がない。",
    correct: "裏付ける",
    distractors: ["取り締まる", "引き受ける", "差し控える"],
    explanation:
      "具体例は主張の根拠としてそれを裏付けるものなので、説得力がないという後半にも裏付けるだけのが正確につながる。",
  },
  {
    semanticId: "surface-numbers-cannot-capture-change",
    stem: "表面的な数字だけでは、制度が現場にもたらした変化を＿＿ことはできない。",
    correct: "捉える",
    distractors: ["携える", "唱える", "衰える"],
    explanation:
      "変化の全体を理解するという意味には変化を捉えるが適切で、携える・唱える・衰えるは目的語と意味の両方が合わない。",
  },
] as const satisfies readonly ClozeSeed[];

export const N1_USAGE_EXPANSION = [
  {
    focus: "講じる",
    correct: "事故の再発を防ぐため、追加の対策を講じた。",
    distractors: [
      "会議で新しい議題を講じ、参加者に意見を求めた。",
      "報告書の要点を三行に講じて提出した。",
      "来年度の予算を部門ごとに講じた。",
    ],
    explanation:
      "対策を講じる is the established collocation meaning to devise and carry out measures. The other sentences require 提起する, まとめる, or 配分する.",
  },
  {
    focus: "まかなう",
    correct: "施設の維持費は、利用料だけではまかなえない。",
    distractors: [
      "参加者から出た意見を一つずつまかなった。",
      "道路の混雑をまかなうため、通行時間を制限した。",
      "申請書をまかなってから窓口に提出した。",
    ],
    explanation:
      "費用をまかなう means to cover or supply the required expense. The distractors need 検討する, 緩和する, or 記入する rather than まかなう.",
  },
  {
    focus: "見据える",
    correct: "十年後の需要を見据えて、生産体制を見直した。",
    distractors: [
      "資料の誤字を見据えて、赤いペンで直した。",
      "次の会議の日程を来週の水曜に見据えた。",
      "届いた荷物を倉庫の棚に見据えた。",
    ],
    explanation:
      "将来の需要を見据える means to look ahead and take that future condition into account. The distractors require 見つける, 設定する, or 置く.",
  },
  {
    focus: "如実",
    correct: "制度の問題点が、利用者数の急減に如実に表れている。",
    distractors: [
      "委員は複数の意見を如実にまとめて提出した。",
      "予定より如実に早く作業が終わった。",
      "受付では本人確認を如実に行っている。",
    ],
    explanation:
      "如実に表れる means to appear clearly and unmistakably in observable evidence. The other sentences need 簡潔に, 大幅に, or 厳格に.",
  },
  {
    focus: "つぶさに",
    correct: "調査員は被災地の状況をつぶさに記録した。",
    distractors: [
      "担当者は資料をつぶさに束ねて棚に置いた。",
      "委員会は来年度の予算をつぶさに削減した。",
      "参加者は開始時刻までに会場へつぶさに集まった。",
    ],
    explanation:
      "つぶさに記録する means to observe and record something in full detail. The distractors describe bundling, reducing, or gathering, none of which takes つぶさに in this way.",
  },
] as const satisfies readonly UsageSeed[];

export const N1_GRAMMAR_EXPANSION = [
  {
    semanticId: "expert-o-oite-hoka-ni-inai",
    stem: "長年この地域を調査してきた{person}氏をおいて、今回の分析を任せられる人は＿＿。",
    correct: "ほかにいない",
    distractors: ["ほかならない", "ほかでもない", "ほかにすぎない"],
    explanation:
      "Xをおいてほかにいない is the fixed evaluative pattern meaning that no one other than X is suitable; the long research record supplies the reason for that judgment.",
  },
  {
    semanticId: "investigate-in-order-to-clarify-s-beku",
    stem: "被害の実態を明らかに＿＿、専門家による調査委員会が設置された。",
    correct: "すべく",
    distractors: ["するなり", "しつつ", "するそばから"],
    explanation:
      "明らかにすべく expresses the formal purpose for establishing the committee: it was formed in order to clarify the actual damage.",
  },
  {
    semanticId: "gaze-without-purpose-tomo-naku",
    stem: "窓の外を眺める＿＿眺めていると、昔の記憶がふとよみがえった。",
    correct: "ともなく",
    distractors: ["にしても", "だけあって", "ばかりか"],
    explanation:
      "Verb-dictionary form plus ともなく followed by the repeated verb expresses doing something without a particular intention, matching the memory that surfaced unexpectedly.",
  },
  {
    semanticId: "documentary-compels-reflection-zuniwa-okanai",
    stem: "上映後、観客の間で防災をめぐる議論が相次いだ。その記録映画は、見る者に防災のあり方を考え＿＿。",
    correct: "させずにはおかない",
    distractors: ["させずじまいだ", "させるには及ばない", "させるとも限らない"],
    explanation:
      "考えさせずにはおかない means the film is certain to compel viewers to reflect. The other endings mean it did not make them think, need not do so, or may not do so.",
  },
  {
    semanticId: "two-factors-combine-to-amattan-te",
    stem: "通信環境の改善が、働き方の多様化＿＿、郊外の共有オフィスへの需要を押し上げている。",
    correct: "と相まって",
    distractors: ["に先立って", "をものともせず", "にひきかえ"],
    explanation:
      "XがYと相まって describes two factors combining to produce one result; both improved connectivity and diversified work styles contribute to the increased demand.",
  },
] as const satisfies readonly ClozeSeed[];

export const N1_COMPOSITION_EXPANSION = [
  {
    semanticId: "evidence-sufficient-to-reconsider-policy",
    prefix: "この調査は",
    parts: ["方針を見直すに", "足る", "十分な根拠を", "示しています"],
    suffix: "。",
    explanation:
      "方針を見直すに足る means sufficient to justify reconsidering the policy, and the full phrase modifies 十分な根拠 before the predicate.",
  },
  {
    semanticId: "circumstances-do-not-change-deadline",
    prefix: "事情の",
    parts: ["いかんに", "かかわらず、", "期限後の申請は", "受理できません"],
    suffix: "。",
    explanation:
      "事情のいかんにかかわらず is the complete formal concessive phrase, followed by the unchanged rule for applications submitted after the deadline.",
  },
  {
    semanticId: "reform-despite-opposition",
    prefix: "{person}氏は",
    parts: ["周囲の反対を", "ものともせず", "改革を", "進めました"],
    suffix: "。",
    explanation:
      "周囲の反対をものともせず is the complete concessive phrase, followed by the object and predicate 改革を進めました.",
  },
  {
    semanticId: "cannot-abandon-after-accepting",
    prefix: "一度",
    parts: ["引き受けた", "以上", "途中で投げ出す", "わけにはいきません"],
    suffix: "。",
    explanation:
      "引き受けた以上 establishes the responsibility created by accepting the task, and わけにはいきません expresses that abandoning it is not an acceptable option.",
  },
  {
    semanticId: "concede-insufficient-explanation",
    prefix: "説明が",
    parts: [
      "不十分であったことは",
      "否めない",
      "ものの、",
      "結論自体は妥当です",
    ],
    suffix: "。",
    explanation:
      "ことは否めない concedes the inadequate explanation; ものの then introduces the contrasting judgment that the conclusion itself remains valid.",
  },
] as const satisfies readonly CompositionSeed[];

/** Stable authored-source identities; lexical surfaces and usage focuses are also runtime semantic IDs. */
export const N1_LANGUAGE_EXPANSION_SOURCE_IDS = [
  ...N1_LEXEME_EXPANSION.map((seed) => `lexeme:${seed.surface}`),
  ...N1_CONTEXT_EXPANSION.map((seed) => `context:${seed.semanticId}`),
  ...N1_USAGE_EXPANSION.map((seed) => `usage:${seed.focus}`),
  ...N1_GRAMMAR_EXPANSION.map((seed) => `grammar:${seed.semanticId}`),
  ...N1_COMPOSITION_EXPANSION.map((seed) => `composition:${seed.semanticId}`),
] as const;
