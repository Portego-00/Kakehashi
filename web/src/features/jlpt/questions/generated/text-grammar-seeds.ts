import type { TextGrammarSeed } from "./bank-builder";

type TextGrammarSeedInput = Omit<
  TextGrammarSeed,
  "groupId" | "blankId" | "blankOrder"
> &
  Partial<Pick<TextGrammarSeed, "groupId" | "blankId" | "blankOrder">>;

function defineTextGrammarSeeds(
  seeds: readonly TextGrammarSeedInput[],
): readonly TextGrammarSeed[] {
  return seeds.map((seed) => ({
    ...seed,
    groupId: seed.groupId ?? seed.id,
    blankId: seed.blankId ?? `${seed.id}-blank-1`,
    blankOrder: seed.blankOrder ?? 1,
  }));
}

const N5_CLASS_TRIP_CANONICAL =
  "{day}、クラスで{place}へ行きました。朝は雨が降っていました。［1］＿＿、みんなで予定どおりバスに乗りました。着くころには雨がやみました。［2］＿＿、外でお弁当を食べることができました。";
const N4_CLINIC_NOTICE_CANONICAL =
  "{place}の相談会は、これまで予約なしでも参加できた。以前は利用者が少なく、長く待つことはなかった。［1］＿＿、最近は利用者が増え、時間内に相談できない人も出ている。［2］＿＿、来月から午前中だけ予約が必要になる。午後は今までどおり、空いていれば利用できる。";
const N3_TRAINING_REVIEW_CANONICAL =
  "会社は新人研修の説明を整理し、時間を短くした。事前テストでは全員が基本事項に正しく答え、担当者は十分理解できたと考えていた。［1］＿＿、研修後の調査では、例外的な対応が分からないという回答が多かった。担当者は実際の相談例を使う練習が足りなかったと考えた。［2］＿＿、次回は説明を短くしたまま、事例練習の時間を増やす予定だ。";
const N2_PILOT_ACCESS_CANONICAL =
  "市は申請窓口の開設時間を一部の地域で延長した。全体の利用件数は増え、試行に参加した人の評価も高かった。［1］＿＿、交通が不便な地域では、延長後も利用者がほとんど増えていない。地域別の違いを確認した上で、次の支援方法を決める必要がある。［2］＿＿、市は試行を直ちに全域へ広げず、利用しにくい地域で出張窓口も試すことにした。";
const N1_EVIDENCE_UPDATE_CANONICAL =
  "研究結果を政策に用いる以上、結論が変わらないことを期待したくなる。判断の根拠が頻繁に変われば、利用者が混乱するからだ。［1］＿＿、新しい証拠が得られても以前の説明を守り続けるなら、研究を参照する意味が失われる。変更そのものと、根拠なく方針を揺らすことは区別しなければならない。［2］＿＿、どの証拠によって判断を改めたのかを示す仕組みが必要である。";

export const N5_TEXT_GRAMMAR_SEEDS = defineTextGrammarSeeds([
  {
    id: "n5-tg-rain-plan",
    passage:
      "{person}さんは{day}に{place}へ行くつもりでした。朝、外を見ると、雨がたくさん降っていました。＿＿、出かけないで、家で本を読むことにしました。午後は雨がやみましたが、その日は家にいました。",
    correct: "だから",
    distractors: ["でも", "そして", "それから"],
    explanation:
      "The third sentence is the result of the heavy rain, so だから gives the required reason-result connection.",
  },
  {
    id: "n5-tg-cooking-order",
    passage:
      "{person}さんは晩ごはんにカレーを作りました。まず、肉と野菜を小さく切りました。＿＿、なべに水といっしょに入れました。さいごにカレーのルーを入れて、よくまぜました。",
    correct: "つぎに",
    distractors: ["でも", "だから", "たとえば"],
    explanation:
      "The passage gives cooking steps in order: まず, つぎに, and さいごに.",
  },
  {
    id: "n5-tg-birthday-gift",
    passage:
      "{other}さんの誕生日は{day}です。欲しい物を聞くと、{other}さんは青いかさが欲しいと言いました。{person}さんは店でいくつかのかさを見ました。＿＿。誕生日に包みを開け、頼んだかさを見た{other}さんは、とてもよろこびました。",
    correct: "そこで、青いかさを買いました",
    distractors: [
      "そこで、赤いかさを買いました",
      "でも、青いかさは買いませんでした",
      "そのあと、青いぼうしを買いました",
    ],
    explanation:
      "Only buying the blue umbrella matches both the stated request and the later reference to seeing the requested umbrella in the package.",
  },
  {
    id: "n5-tg-library-reference",
    passage:
      "{person}さんは日本語の本を読みたいと思って、{place}の図書館へ行きました。＿＿。その中から読みたい本を二冊見つけ、受付で借りました。家に帰ってから、まず写真の多い本を読みました。",
    correct: "そこには日本語の本がたくさんあります",
    distractors: [
      "そこには日本語の本が一冊だけあります",
      "そこにある日本語の本は見るだけです",
      "そこの日本語の本は別の図書館へ行きました",
    ],
    explanation:
      "そこ must refer to the library, and the books there lead directly to finding two books to borrow.",
  },
  {
    id: "n5-tg-small-room",
    passage:
      "{person}さんのへやはあまり広くありません。＿＿、まどが大きいので、昼はとても明るいです。つくえの横には小さい本だなもあります。{person}さんはこのへやが好きです。",
    correct: "でも",
    distractors: ["だから", "それから", "たとえば"],
    explanation:
      "でも contrasts the room's small size with its positive brightness.",
  },
  {
    id: "n5-tg-book-reference",
    passage:
      "{other}さんが{person}さんに本を貸しました。＿＿。漢字は少ないですが、話がおもしろい本です。{person}さんは三日で全部読んで、{other}さんに返しました。",
    correct: "その本は日本語で書いてあります",
    distractors: [
      "その本は中国語で書いてあります",
      "その本はまだ店にありません",
      "その本は図書館に返してあります",
    ],
    explanation:
      "その本 correctly refers back to the borrowed book and introduces the following description of its Japanese text.",
  },
  {
    id: "n5-tg-after-lunch",
    passage:
      "{person}さんは{other}さんと駅で会いました。二人は近くの店で昼ごはんを食べました。＿＿、いっしょに{place}へ行きました。そこで写真をたくさんとって、夕方に帰りました。",
    correct: "そのあとで",
    distractors: ["それなのに", "たとえば", "ですから"],
    explanation:
      "そのあとで places the visit after lunch in the passage's time sequence.",
  },
  {
    id: "n5-tg-shop-addition",
    passage:
      "駅の前に新しいパン屋ができました。この店のパンは安いです。＿＿、朝早くから開いているので、学校へ行く前にも買えます。{person}さんは毎週ここでパンを買っています。",
    correct: "それに",
    distractors: ["でも", "だから", "それから"],
    explanation:
      "それに adds a second positive feature of the bakery to the low price already mentioned.",
  },
  {
    id: "n5-tg-missed-bus",
    passage:
      "今朝、{person}さんはいつもより遅く家を出ました。駅まで走りましたが、バスはもう出たあとでした。＿＿。次のバスは二十分あとに来ました。学校には少し遅れて着きました。",
    correct: "次のバスを待つことにしました",
    distractors: [
      "家に戻って学校を休みました",
      "タクシーですぐ学校に着きました",
      "歩いて十分で学校に着きました",
    ],
    explanation:
      "Waiting for the next bus is the only decision compatible with that bus arriving twenty minutes later and the slightly late arrival at school.",
  },
  {
    id: "n5-tg-fruit-example",
    passage:
      "{other}さんはくだものが好きです。＿＿、りんごやバナナを毎朝食べます。夏にはすいかもよく買います。でも、みかんはあまり食べません。",
    correct: "たとえば",
    distractors: ["でも", "それから", "さいごに"],
    explanation:
      "The following apples and bananas are examples of the fruit the person likes.",
  },
  {
    id: "n5-tg-lost-key",
    passage:
      "{person}さんは家の前でかぎがないことに気づきました。かばんの中とポケットをよく見ましたが、ありません。＿＿。言われたとおりに見ると、かぎは朝使った上着のポケットに入っていました。",
    correct: "そこで、家族に電話すると、朝の上着を見てと言われました",
    distractors: [
      "そこで、友達に電話すると、駅で待ってと言われました",
      "そこで、店に電話すると、新しいかぎを買ってと言われました",
      "そこで、学校に電話すると、かばんを見てと言われました",
    ],
    explanation:
      "The family member's instruction to check the morning jacket is the only advice that the next sentence can follow and that leads to the key.",
  },
  {
    id: "n5-tg-train-reference",
    passage:
      "{place}へ行く電車は二つあります。青い電車は駅にたくさん止まります。赤い電車は三つの駅にしか止まりません。＿＿。急いでいる人は、赤い電車を選びます。",
    correct: "そのため、青い電車より早く{place}に着きます",
    distractors: [
      "それでも、青い電車と同じ時間に着きます",
      "しかし、青い電車のほうが早く着きます",
      "そのため、赤い電車は青い電車より遅く着きます",
    ],
    explanation:
      "The limited stops make the red train faster, which explains why travelers in a hurry choose it.",
  },
  {
    id: "n5-tg-cold-morning",
    passage:
      "今朝はとても寒かったです。{person}さんは厚いコートを着て家を出ました。＿＿、手ぶくろを持ってくるのを忘れました。駅まで歩くと、手がとても冷たくなりました。",
    correct: "しかし",
    distractors: ["そのため", "たとえば", "ですから"],
    explanation:
      "しかし introduces the contrast between preparing a warm coat and forgetting gloves.",
  },
  {
    id: "n5-tg-sick-rest",
    passage:
      "{other}さんは朝から頭が痛くて、少し熱もありました。＿＿、学校を休んで病院へ行きました。先生にも電話で休むことを伝えました。薬を飲んで早く寝ると、次の日は元気になりました。",
    correct: "そのため",
    distractors: ["ところが", "でも", "たとえば"],
    explanation:
      "The headache and fever cause the decision to miss school and visit a doctor, so そのため is coherent.",
  },
  {
    id: "n5-tg-park-bench",
    passage:
      "{person}さんと{other}さんは{place}を散歩しました。たくさん歩いたので、二人は少しつかれました。＿＿。十分ぐらい休んでから、駅へ向かいました。",
    correct: "近くのベンチにすわることにしました",
    distractors: [
      "駅の電車は全部止まりました",
      "新しいノートを三冊買いました",
      "朝ごはんは家で食べませんでした",
    ],
    explanation:
      "Sitting on a nearby bench is the action that naturally follows being tired and precedes taking a rest.",
  },
  {
    id: "n5-tg-cleaning-first",
    passage:
      "今日は家族みんなでへやをそうじします。＿＿、ゆかにある本やおもちゃを箱に入れます。それから、つくえとまどをきれいにします。さいごに、ゆかをそうじします。",
    correct: "まず",
    distractors: ["でも", "だから", "さいごに"],
    explanation:
      "The following それから and さいごに show that the first step must be introduced by まず.",
  },
  {
    id: "n5-tg-early-meeting",
    passage:
      "あしたは{time}に駅で{other}さんと会います。家から駅まで四十分かかります。＿＿、いつもより早く起きなければなりません。今夜は目覚まし時計を二つかけて寝ます。",
    correct: "ですから",
    distractors: ["けれど", "それから", "たとえば"],
    explanation:
      "The travel time and early meeting are the reason for needing to wake early, so ですから fits.",
  },
  {
    id: "n5-tg-dog-weather",
    passage:
      "{person}さんは毎朝、犬と散歩します。今朝は雨が降っていました。＿＿、犬が外へ行きたそうにしていたので、短い散歩をしました。帰ってから、犬の体をタオルでふきました。",
    correct: "それでも",
    distractors: ["そのため", "たとえば", "それから"],
    explanation: "それでも marks that the walk happened despite the rain.",
  },
  {
    id: "n5-tg-school-location",
    passage:
      "{person}さんの学校のとなりに小さい公園があります。＿＿。昼休みになると、学生がそこでごはんを食べたり話したりします。春には花もたくさん咲きます。",
    correct: "そこにはベンチが五つあります",
    distractors: [
      "その学生は電車で学校へ来ます",
      "この本は図書館で借りました",
      "あそこから海まで二時間です",
    ],
    explanation:
      "そこ refers to the park, and its benches explain where students can eat and talk at lunchtime.",
  },
  {
    id: "n5-tg-letter-addition",
    passage:
      "{other}さんから手紙が来ました。手紙には、新しい仕事がおもしろいと書いてありました。＿＿、来月こちらへ遊びに来るそうです。{person}さんは会える日をすぐに返事しました。",
    correct: "そして",
    distractors: ["しかし", "だから", "たとえば"],
    explanation:
      "そして adds the second piece of news contained in the letter before the reply.",
  },
  {
    id: "n5-tg-class-trip-blank-1",
    groupId: "n5-tg-class-trip",
    blankId: "n5-tg-class-trip-1",
    blankOrder: 1,
    canonicalPassage: N5_CLASS_TRIP_CANONICAL,
    passage:
      "{day}、クラスで{place}へ行きました。朝は雨が降っていました。＿＿、みんなで予定どおりバスに乗りました。着くころには雨がやみました。それで、外でお弁当を食べることができました。",
    correct: "でも",
    distractors: ["だから", "それから", "たとえば"],
    explanation:
      "でも marks that the class took the planned bus trip despite the morning rain.",
  },
  {
    id: "n5-tg-class-trip-blank-2",
    groupId: "n5-tg-class-trip",
    blankId: "n5-tg-class-trip-2",
    blankOrder: 2,
    canonicalPassage: N5_CLASS_TRIP_CANONICAL,
    passage:
      "{day}、クラスで{place}へ行きました。朝は雨が降っていました。でも、みんなで予定どおりバスに乗りました。着くころには雨がやみました。＿＿、外でお弁当を食べることができました。",
    correct: "それで",
    distractors: ["しかし", "たとえば", "さいごに"],
    explanation:
      "The rain stopping makes outdoor lunch possible, so それで supplies the result relation.",
  },
]);

export const N4_TEXT_GRAMMAR_SEEDS = defineTextGrammarSeeds([
  {
    id: "n4-tg-delayed-train",
    passage:
      "{person}さんは{time}からの会議に出るため、早めに家を出た。ところが、途中で電車が止まり、三十分以上動かなかった。＿＿、会議の開始時刻に間に合わなかった。駅から会社にはすぐ連絡したので、会議は先に始めてもらった。",
    correct: "そのため",
    distractors: ["それでも", "たとえば", "一方で"],
    explanation:
      "The stopped train directly causes the late arrival, so そのため is the only coherent link.",
  },
  {
    id: "n4-tg-event-change",
    passage:
      "{place}の行事は外で行う予定だった。朝の天気予報では晴れると言っていた。＿＿、昼前から強い雨が降り始めた。係の人は参加者を建物の中へ案内し、内容を少し変えて行事を続けた。",
    correct: "ところが",
    distractors: ["そのため", "つまり", "たとえば"],
    explanation:
      "ところが introduces the unexpected rain after the forecast of clear weather.",
  },
  {
    id: "n4-tg-library-service",
    passage:
      "この図書館では、本を借りるだけでなく、勉強に使う部屋も予約できる。＿＿、毎週土曜日には子どものために本を読む会も開かれている。駅から近く、夜八時まで開いているので、利用する人が多い。{person}さんも仕事のあとによく利用している。",
    correct: "さらに",
    distractors: ["しかし", "そのため", "反対に"],
    explanation:
      "さらに adds another library service to the two services already introduced.",
  },
  {
    id: "n4-tg-two-routes",
    passage:
      "駅から{place}へ行く道は二つある。大通りを通る道は分かりやすいが、車が多くて少しうるさい。＿＿、川のそばの道は静かだが、駅から十分ほど長くかかる。時間がある日は川の道を選ぶ人も多い。",
    correct: "一方",
    distractors: ["したがって", "たとえば", "その結果"],
    explanation:
      "一方 contrasts the advantages and disadvantages of the second route with the first.",
  },
  {
    id: "n4-tg-volunteer-solution",
    passage:
      "地域の祭りを手伝う人が、今年はまだ十分に集まっていない。特に、朝の準備をする人が少ない。＿＿、係の人は一日中ではなく、二時間だけでも参加できるようにした。その知らせを見て、新しく申し込む人が増えた。",
    correct: "そこで",
    distractors: ["ところが", "一方で", "たとえば"],
    explanation:
      "そこで introduces the organizers' response to the shortage of morning volunteers.",
  },
  {
    id: "n4-tg-reservation-condition",
    passage:
      "{place}の会議室は、インターネットで予約できる。一般の利用なら、空いていれば前日まで申し込める。しかし、この締切がすべての利用に当てはまるわけではない。＿＿、十人以上で使う場合は、一週間前までに申込書を出さなければならない。",
    correct: "たとえば",
    distractors: ["その結果", "つまり", "それでも"],
    explanation:
      "The ten-person rule is a concrete example of a use for which the ordinary previous-day deadline does not apply.",
  },
  {
    id: "n4-tg-breakfast-example",
    passage:
      "忙しい朝でも、少し何かを食べたほうがよい。＿＿、前の日におにぎりを作っておけば、朝はすぐに食べられる。くだものやヨーグルトを用意する方法もある。大切なのは、無理なく続けられる方法を選ぶことだ。",
    correct: "たとえば",
    distractors: ["ところが", "その結果", "一方で"],
    explanation:
      "Preparing a rice ball is offered as one concrete example of an easy breakfast method.",
  },
  {
    id: "n4-tg-summary-rule",
    passage:
      "この教室では、間違えてもすぐに答えを教えない。まず、学生どうしでどこが違うか話し合う。そのあと、先生が必要なところだけ説明する。＿＿、自分たちで考える時間を大切にしているのである。",
    correct: "つまり",
    distractors: ["ところが", "たとえば", "それでも"],
    explanation:
      "つまり summarizes the teaching approach described in the preceding three sentences.",
  },
  {
    id: "n4-tg-continued-practice",
    passage:
      "{person}さんは日本語で話すのが苦手だった。毎日練習したが、初めの一か月は上手になったと感じられなかった。＿＿、短い時間でも練習を続けた。三か月後には、店で自然に質問できるようになった。",
    correct: "それでも",
    distractors: ["その結果", "たとえば", "つまり"],
    explanation:
      "それでも shows that the person continued practicing despite not initially feeling improvement.",
  },
  {
    id: "n4-tg-wrong-size",
    passage:
      "{other}さんはインターネットで机を買った。写真ではちょうどよい大きさに見えた。＿＿、届いた机は思っていたより大きく、部屋に入らなかった。店に相談すると、小さい机と交換してくれた。",
    correct: "しかし",
    distractors: ["そのため", "さらに", "つまり"],
    explanation:
      "しかし contrasts the favorable impression in the photograph with the unexpectedly oversized delivered desk.",
  },
  {
    id: "n4-tg-reusable-bottle",
    passage:
      "{person}さんの会社では、紙のコップを毎日たくさん使っていた。ごみを減らすため、社員に自分のボトルを持ってくるよう頼んだ。＿＿、一か月後には紙のコップのごみが半分になった。今では多くの社員が続けている。",
    correct: "その結果",
    distractors: ["それにもかかわらず", "一方で", "たとえば"],
    explanation:
      "The reduced waste is the measured result of asking employees to bring reusable bottles.",
  },
  {
    id: "n4-tg-course-reference",
    passage:
      "{place}では、来月から写真の教室が始まる。初めてカメラを使う人も参加でき、道具は教室で借りられる。＿＿。興味がある人は{day}までに受付で申し込む必要がある。",
    correct: "この教室は全部で六回行われる",
    distractors: [
      "その写真は去年駅で撮られた",
      "この道具は料理に使われている",
      "その人は毎朝会社まで歩いている",
    ],
    explanation:
      "この教室 coherently refers to the announced photography course and adds scheduling information before registration details.",
  },
  {
    id: "n4-tg-lunch-choice",
    passage:
      "会社の近くには食堂が二つある。駅前の食堂は安くて料理が早く出る。川のそばの食堂は少し高い。＿＿、野菜を使った料理が多く、店の中も静かだ。気分や時間によって店を選ぶ社員が多い。",
    correct: "そのかわり",
    distractors: ["そのため", "たとえば", "つまり"],
    explanation:
      "そのかわり introduces the benefits that balance the second restaurant's higher price.",
  },
  {
    id: "n4-tg-lost-wallet-action",
    passage:
      "{person}さんは駅に着いてから、財布がないことに気づいた。来た道を少し戻ったが、見つからなかった。＿＿。すると、財布は駅員のところに届いていた。中に入っていた物も全部そのままだった。",
    correct: "そこで、駅員に聞いてみることにした",
    distractors: [
      "そこで、最後に寄った店へ電話してみた",
      "そこで、家にいる家族に財布を探してもらった",
      "そこで、近くの交番へ届け出ることにした",
    ],
    explanation:
      "Asking station staff is a purposeful response to failing to find the wallet and leads to the following discovery.",
  },
  {
    id: "n4-tg-morning-market",
    passage:
      "{place}では毎月、朝の市場が開かれる。近くの農家が野菜やくだものを売り、パンやおかしの店も出る。＿＿。そのため、買い物だけでなく、地域の人と話すために来る人も多い。",
    correct: "店の人に料理のしかたを聞くこともできる",
    distractors: [
      "市場が終わると電車は駅に着く",
      "農家は毎日会社で会議をしている",
      "そのパンは図書館で借りることができる",
    ],
    explanation:
      "Talking with sellers about cooking explains why the market also functions as a place for local conversation.",
  },
  {
    id: "n4-tg-study-method",
    passage:
      "新しい言葉を一度にたくさん覚えようとすると、すぐ忘れてしまうことがある。＿＿、毎日少しずつ覚えた言葉を使って文を作るとよい。前の日の言葉もいっしょに復習すれば、さらに覚えやすくなる。覚えた言葉を会話で使う機会も作るとよい。",
    correct: "それよりも",
    distractors: ["その結果", "たとえば", "ところが"],
    explanation:
      "それよりも replaces the less effective mass-memorization method with the recommended gradual method.",
  },
  {
    id: "n4-tg-bus-service-addition",
    passage:
      "来月から駅と病院の間を走るバスが増える。朝は二十分に一本、昼は三十分に一本になる。＿＿、日曜日にも夕方まで運転することになった。病院を利用する人には便利になりそうだ。",
    correct: "また",
    distractors: ["しかし", "そのため", "つまり"],
    explanation:
      "また adds the Sunday service change to the already described increase in frequency.",
  },
  {
    id: "n4-tg-quiet-cafe",
    passage:
      "駅前の新しい店は、昼にはいつもこんでいる。料理がおいしく、値段も高くないからだ。＿＿、午後三時を過ぎると客が少なくなり、静かに本を読める。{person}さんはその時間によく利用している。",
    correct: "一方で",
    distractors: ["そのため", "つまり", "たとえば"],
    explanation:
      "一方で contrasts the crowded lunchtime with the quiet mid-afternoon period.",
  },
  {
    id: "n4-tg-repair-not-replace",
    passage:
      "{other}さんの自転車は古くなり、ブレーキの音も大きくなった。新しい自転車を買おうと思ったが、店で調べてもらうと、まだ直して使えることが分かった。＿＿。今は同じ自転車に音もなく、安全に乗れるようになった。",
    correct: "そこで、悪い部品だけ交換してもらった",
    distractors: [
      "そこで、その自転車を売って新しい物を買った",
      "そこで、自転車を直さず家に置くことにした",
      "そこで、悪い部品を残して外側だけ洗ってもらった",
    ],
    explanation:
      "Replacing only the defective part follows the repair assessment and explains the restored safe condition.",
  },
  {
    id: "n4-tg-early-announcement",
    passage:
      "去年の行事では、時間の変更を当日の朝に知らせた。そのため、古い時間に来た人が何人もいた。今年は同じ問題を起こさないようにしたい。＿＿、変更が決まったらすぐ、メールと掲示の両方で知らせる予定だ。",
    correct: "そこで今年は",
    distractors: ["ところが去年は", "たとえば当日は", "一方で駅では"],
    explanation:
      "そこで今年は introduces this year's concrete response to last year's communication problem.",
  },
  {
    id: "n4-tg-clinic-notice-blank-1",
    groupId: "n4-tg-clinic-notice",
    blankId: "n4-tg-clinic-notice-1",
    blankOrder: 1,
    canonicalPassage: N4_CLINIC_NOTICE_CANONICAL,
    passage:
      "{place}の相談会は、これまで予約なしでも参加できた。以前は利用者が少なく、長く待つことはなかった。＿＿、最近は利用者が増え、時間内に相談できない人も出ている。そこで、来月から午前中だけ予約が必要になる。午後は今までどおり、空いていれば利用できる。",
    correct: "ところが",
    distractors: ["その前に", "たとえば", "つまり"],
    explanation:
      "ところが introduces the unexpected congestion that arose under the previous walk-in arrangement.",
  },
  {
    id: "n4-tg-clinic-notice-blank-2",
    groupId: "n4-tg-clinic-notice",
    blankId: "n4-tg-clinic-notice-2",
    blankOrder: 2,
    canonicalPassage: N4_CLINIC_NOTICE_CANONICAL,
    passage:
      "{place}の相談会は、これまで予約なしでも参加できた。以前は利用者が少なく、長く待つことはなかった。ところが、最近は利用者が増え、時間内に相談できない人も出ている。＿＿、来月から午前中だけ予約が必要になる。午後は今までどおり、空いていれば利用できる。",
    correct: "そこで",
    distractors: ["それでも", "たとえば", "一方で"],
    explanation:
      "そこで introduces the new reservation rule as a response to overcrowding and unserved visitors.",
  },
]);

export const N3_TEXT_GRAMMAR_SEEDS = defineTextGrammarSeeds([
  {
    id: "n3-tg-attendance-and-satisfaction",
    passage:
      "{place}で開かれた講座は、去年より参加者が増えた。申込方法を簡単にしたことが理由だと考えられる。＿＿、終了後の調査では、説明が速すぎたという意見も増えていた。人数だけを見て成功だと判断せず、内容の伝え方も見直す必要がある。",
    correct: "一方で",
    distractors: ["そのため", "たとえば", "つまり"],
    explanation:
      "一方で contrasts increased attendance with the less favorable satisfaction feedback.",
  },
  {
    id: "n3-tg-shared-bicycles-result",
    passage:
      "駅前では、放置された自転車が歩く人のじゃまになっていた。市は駅から少し離れた場所に無料の駐輪場を作り、案内も増やした。＿＿、三か月後には駅前に置かれる自転車が大きく減った。今後は夜の利用状況も調べる予定だ。",
    correct: "その結果",
    distractors: ["それにもかかわらず", "一方で", "たとえば"],
    explanation:
      "The reduction is the observed outcome of adding and publicizing the free bicycle parking area.",
  },
  {
    id: "n3-tg-meeting-shortage-response",
    passage:
      "来週の説明会では、案内をする人が二人必要だった。しかし、一人が急に参加できなくなり、このままでは受付と会場案内を同時にできない。＿＿。頼まれた部署では、経験のある{other}さんが引き受けてくれたので、予定どおり開けることになった。",
    correct: "そこで、担当者は別の部署にも協力を頼んだ",
    distractors: [
      "そこで、受付を閉めて一人で案内する案を考えた",
      "そこで、参加者から手伝う人を募集することにした",
      "そこで、受付と案内を一つの場所にまとめようとした",
    ],
    explanation:
      "Requesting help from another department solves the staffing problem and leads to the experienced colleague volunteering.",
  },
  {
    id: "n3-tg-online-convenience-condition",
    passage:
      "オンライン会議なら、遠くにいる人も移動せず参加できる。資料を画面で共有できる点も便利だ。＿＿、長い会議では集中しにくいという人もいる。目的や時間に合わせて、対面とオンラインを使い分けたほうがよい。",
    correct: "ただし",
    distractors: ["したがって", "つまり", "たとえば"],
    explanation:
      "ただし introduces a limitation after the benefits of online meetings.",
  },
  {
    id: "n3-tg-reading-example",
    passage:
      "分からない言葉が出るたびに辞書を引くと、文章全体の意味をつかみにくくなることがある。まず前後を読み、意味を想像してみる方法も有効だ。＿＿、知らない言葉が『乗り物』の例として並んでいれば、その種類を予想できる。あとで辞書を使って確かめればよい。",
    correct: "たとえば",
    distractors: ["その結果", "それにもかかわらず", "一方で"],
    explanation:
      "The following unknown word within a list of vehicles is a concrete example of using context to infer meaning.",
  },
  {
    id: "n3-tg-note-purpose-summary",
    passage:
      "会議の内容を一字一句書こうとすると、話を聞くことに集中できなくなる。一方、結論だけでは、なぜその決定になったか分からない。大切なのは、主な意見と決定の理由を残すことだ。＿＿、記録の目的は発言をすべて写すことではなく、後で判断の流れを確認できるようにすることなのである。",
    correct: "つまり",
    distractors: ["ところが", "たとえば", "それでも"],
    explanation:
      "つまり restates and summarizes the preceding explanation of what useful meeting notes should preserve.",
  },
  {
    id: "n3-tg-quiet-space-persistence",
    passage:
      "{person}さんは家で勉強しようとしたが、近くの工事の音で集中できなかった。図書館へ行くと、試験の時期で席が全部使われていた。＿＿。三十分待つと席が使えるようになり、予定した勉強を終えられた。",
    correct: "それでも、そのまま帰らず、受付で空く時間を聞いた",
    distractors: [
      "そこで、ロビーの机で勉強を始めた",
      "そこで、空いている会議室を予約した",
      "そこで、近くの喫茶店へ移動することにした",
    ],
    explanation:
      "Persisting and asking when a seat will open is the only event that leads coherently to waiting thirty minutes and completing the study plan.",
  },
  {
    id: "n3-tg-weather-cancellation-cause",
    passage:
      "{day}に予定されていた地域の運動会は、中止になった。朝は雨が降っていなかったが、午後から強い風になる予報が出ていた。小さい子どもも多く参加する。＿＿、主催者は安全を優先して前日のうちに中止を決めた。",
    correct: "そのため",
    distractors: ["それなのに", "一方で", "たとえば"],
    explanation:
      "The forecast and presence of young children cause the organizers to prioritize safety and cancel.",
  },
  {
    id: "n3-tg-provisional-use",
    passage:
      "新しい予約システムは、来月から全員が使う予定だった。試験に参加した人からは、画面が分かりやすいという意見が多かった。＿＿、古い携帯電話では正しく表示されない問題が残っている。まず一部の利用者だけで使い、問題を直してから広げることになった。",
    correct: "しかし",
    distractors: ["したがって", "つまり", "たとえば"],
    explanation:
      "しかし introduces the unresolved compatibility problem after favorable usability feedback.",
  },
  {
    id: "n3-tg-local-shop-value",
    passage:
      "大きな店は品物が多く、値段を比べやすい。＿＿、地域の小さな店には、客の希望をよく知り、必要な量だけ用意できるよさがある。どちらが便利かは、買う物や状況によって変わる。値段だけで店の価値を決めることはできない。",
    correct: "それに対して",
    distractors: ["その結果", "たとえば", "つまり"],
    explanation:
      "それに対して sets the small local shop's strengths against the large store's advantages.",
  },
  {
    id: "n3-tg-feedback-reference",
    passage:
      "{place}では、利用者に新しい案内板を一週間使ってもらった。多くの人は文字が読みやすいと答えたが、出口の場所が分かりにくいという声もあった。＿＿。担当者はその意見をもとに、出口の矢印を大きくすることにした。変更後、もう一度同じ調査を行う予定だ。",
    correct: "特に、初めて来た人から同じ意見が多く出た",
    distractors: [
      "特に、案内板の色が明るいという意見が多かった",
      "特に、写真をもっと増やしてほしいという声があった",
      "特に、案内板の材料が丈夫だと担当者が評価した",
    ],
    explanation:
      "The repeated feedback from first-time visitors gives a concrete reason for enlarging the exit arrow.",
  },
  {
    id: "n3-tg-practice-reassessment",
    passage:
      "{other}さんは発表が苦手なので、原稿を全部覚えようとした。しかし、一か所忘れると、そのあとも話せなくなってしまった。＿＿、要点だけをカードに書き、自分の言葉で説明する練習に変えた。本番では少し間違えたが、最後まで落ち着いて話せた。",
    correct: "そこで",
    distractors: ["その一方で", "たとえば", "つまり"],
    explanation:
      "そこで introduces the revised practice method adopted in response to the failure of memorizing every word.",
  },
  {
    id: "n3-tg-repair-cost-balance",
    passage:
      "古い建物を使い続ければ、新しく建てる費用はかからない。＿＿、安全のための修理を何度も行う必要があり、長い目で見ると高くなる可能性もある。修理の回数と、施設を使えなかった時間も記録しておく必要がある。目の前の費用だけでなく、十年後までに必要な費用を比べるべきだ。",
    correct: "その反面",
    distractors: ["そのため", "つまり", "たとえば"],
    explanation:
      "その反面 introduces the continuing repair-cost disadvantage of keeping the old building.",
  },
  {
    id: "n3-tg-flexible-hours-addition",
    passage:
      "会社は、働く人が始業時刻を選べる制度を始めた。始業を遅くし、子どもを学校へ送ってから出勤する人もいる。＿＿、始業を早くし、夕方を自分の勉強に使う人も増えた。働く時間の選択が生活の組み立て方を変えている。",
    correct: "一方で",
    distractors: ["そのため", "つまり", "ところで"],
    explanation:
      "一方で contrasts later starts used for school drop-off with employees who choose an earlier schedule.",
  },
  {
    id: "n3-tg-map-not-enough",
    passage:
      "観光案内所では、町の地図を無料で配っている。地図には有名な場所が大きく書かれていて、初めて来た人にも分かりやすい。＿＿、工事で通れない道の情報は地図に入っていないことがある。出発前に案内所の人へ確認すると安心だ。",
    correct: "ただし",
    distractors: ["したがって", "つまり", "たとえば"],
    explanation:
      "ただし limits the map's usefulness by introducing information that may not be current.",
  },
  {
    id: "n3-tg-reduced-packaging-purpose",
    passage:
      "ある店では、商品を包む紙を以前より薄くした。初めは、安く見えるのではないかと心配する意見もあった。店は紙を変えた理由と、商品を守る力は変わらないことを説明した。＿＿。今では、同じ方法を使う商品が増えている。",
    correct: "その説明を読んで、選ぶ客が少しずつ増えた",
    distractors: [
      "その商品は説明の前にすべて売り切れていた",
      "一方、店員は駅まで電車で通っていた",
      "たとえば、厚い紙は本を読むために使われた",
    ],
    explanation:
      "Customer acceptance after the explanation provides the missing transition to wider adoption of the packaging method.",
  },
  {
    id: "n3-tg-goal-versus-method",
    passage:
      "作業を早く終えることは大切だ。しかし、確認を省いて間違いが増えれば、直すためにもっと時間がかかる。速さだけを目標にするのではなく、間違いを減らす方法も考える必要がある。＿＿、本当に必要なのは、作業の一部だけを急ぐことではなく、全体にかかる時間を短くすることだ。",
    correct: "つまり",
    distractors: ["ところが", "たとえば", "一方で"],
    explanation:
      "つまり summarizes the distinction between rushing one stage and improving the total process.",
  },
  {
    id: "n3-tg-conversation-opportunity",
    passage:
      "外国語を勉強していても、使う機会がなければ話す自信はつきにくい。＿＿。完璧な文を作ろうとして黙っているより、短くても実際に話したほうがよい。間違えたところをあとで直せば、次の会話に生かせる。短い会話を続けることが、次の練習の機会にもなる。",
    correct: "そのため、自分から会話の機会を作ることが大切だ",
    distractors: [
      "それでも、話す練習はできるだけ避けるべきだ",
      "一方で、外国語は会話では使われていない",
      "たとえば、自信がつくまで一度も話してはいけない",
    ],
    explanation:
      "Creating opportunities to speak follows from the confidence problem and is developed by the next three recommendations.",
  },
  {
    id: "n3-tg-survey-hidden-group",
    passage:
      "新しいサービスの利用者にアンケートを行うと、多くの人が便利だと答えた。＿＿。そもそも利用を始めなかった人の意見は、この結果には入っていないからだ。次の調査では、その人たちにも理由を聞く必要がある。",
    correct: "しかし、この結果だけで全員に便利だとは言えない",
    distractors: [
      "したがって、サービスはすぐに終了すべきだ",
      "たとえば、回答者は全員同じ日に生まれた",
      "つまり、調査をしなくても結果は分かっていた",
    ],
    explanation:
      "The following explanation about non-users requires a caution that the favorable survey cannot represent everyone.",
  },
  {
    id: "n3-tg-community-garden",
    passage:
      "空いていた土地を使って、地域の人が小さな畑を作った。野菜を育てるだけでなく、週末には子ども向けの活動も行っている。＿＿、以前は話したことがなかった住民どうしが、畑であいさつするようになった。畑は交流の場所にもなっている。",
    correct: "その結果",
    distractors: ["それにもかかわらず", "たとえば", "一方で"],
    explanation:
      "The new interaction among residents is an outcome of the shared garden and its activities.",
  },
  {
    id: "n3-tg-training-review-blank-1",
    groupId: "n3-tg-training-review",
    blankId: "n3-tg-training-review-1",
    blankOrder: 1,
    canonicalPassage: N3_TRAINING_REVIEW_CANONICAL,
    passage:
      "会社は新人研修の説明を整理し、時間を短くした。事前テストでは全員が基本事項に正しく答え、担当者は十分理解できたと考えていた。＿＿、研修後の調査では、例外的な対応が分からないという回答が多かった。担当者は実際の相談例を使う練習が足りなかったと考えた。そこで、次回は説明を短くしたまま、事例練習の時間を増やす予定だ。",
    correct: "ところが",
    distractors: ["そのうえ", "たとえば", "つまり"],
    explanation:
      "ところが introduces the unexpected weakness revealed after the shorter training began.",
  },
  {
    id: "n3-tg-training-review-blank-2",
    groupId: "n3-tg-training-review",
    blankId: "n3-tg-training-review-2",
    blankOrder: 2,
    canonicalPassage: N3_TRAINING_REVIEW_CANONICAL,
    passage:
      "会社は新人研修の説明を整理し、時間を短くした。事前テストでは全員が基本事項に正しく答え、担当者は十分理解できたと考えていた。ところが、研修後の調査では、例外的な対応が分からないという回答が多かった。担当者は実際の相談例を使う練習が足りなかったと考えた。＿＿、次回は説明を短くしたまま、事例練習の時間を増やす予定だ。",
    correct: "そこで",
    distractors: ["それでも", "たとえば", "一方で"],
    explanation:
      "そこで introduces the planned training revision in response to the diagnosed lack of case practice.",
  },
]);

export const N2_TEXT_GRAMMAR_SEEDS = defineTextGrammarSeeds([
  {
    id: "n2-tg-numbers-and-access",
    passage:
      "新しい制度の利用者は、開始から半年で目標の人数を超えた。この数字だけを見れば、制度は順調に広がっていると言える。＿＿、地域別に見ると、利用者がほとんどいない場所も残っている。全体の増加を確認するだけでなく、利用しにくい条件を地域ごとに調べる必要がある。",
    correct: "とはいえ",
    distractors: ["したがって", "たとえば", "すなわち"],
    explanation:
      "とはいえ qualifies the favorable total by introducing uneven access across regions.",
  },
  {
    id: "n2-tg-efficiency-and-explanation",
    passage:
      "申請手続きを簡単にすれば、利用者と担当者の負担を減らせる。入力する項目を減らし、同じ情報を二度書かなくてよい仕組みにすることは有効だ。＿＿、審査の基準まで省けば、なぜ結果が異なったのか説明できなくなる。手間と、判断に必要な情報は分けて考えるべきである。",
    correct: "その一方で",
    distractors: ["その結果", "たとえば", "言い換えれば"],
    explanation:
      "その一方で contrasts useful procedural simplification with the danger of removing information needed for accountable decisions.",
  },
  {
    id: "n2-tg-pilot-conclusion",
    passage:
      "{place}で行った試験では、新しい案内方法を使った人の移動時間が短くなった。質問の数も以前より減っている。ただ、調査期間は一週間で、休日の混雑は含まれていない。＿＿。次は期間と対象を広げ、同じ効果が続くか確かめるべきだ。",
    correct: "したがって、この結果だけで全面導入を決めるのは早い",
    distractors: [
      "したがって、短い調査だけで全面導入を決めても問題ない",
      "つまり、移動時間だけを調べれば休日の混雑も判断できる",
      "そのため、質問が減った理由を調べず対象を狭めるべきだ",
    ],
    explanation:
      "The short, incomplete trial supports a cautious conclusion and the following proposal for broader verification.",
  },
  {
    id: "n2-tg-public-data-condition",
    passage:
      "調査のデータを公開すれば、外部の人も分析でき、新しい発見につながる可能性がある。研究の過程を検証しやすくなる点も重要だ。＿＿、個人が特定される情報は、公開前に取り除かなければならない。公開の価値と情報を守る責任は両立させる必要がある。",
    correct: "ただし",
    distractors: ["そのため", "すなわち", "たとえば"],
    explanation:
      "ただし introduces a necessary condition on otherwise beneficial data publication.",
  },
  {
    id: "n2-tg-training-example",
    passage:
      "研修で学んだ知識が、実際の仕事でそのまま使えるとは限らない。現場では、時間や人員など複数の条件を考える必要があるからだ。＿＿、同じ対応でも、相手が初めて利用する人か、経験のある人かによって説明の量は変わる。研修では、条件に合わせて判断する練習も必要である。",
    correct: "たとえば",
    distractors: ["その結果", "それにもかかわらず", "すなわち"],
    explanation:
      "The differing explanation needs are a concrete example of how workplace conditions affect application of training knowledge.",
  },
  {
    id: "n2-tg-recording-purpose",
    passage:
      "作業の記録は、問題が起きたときに責任者を探すためだけのものではない。どの情報をもとに判断したかが分かれば、状況が変わったときに方法を直しやすい。記録を罰のための道具と考えると、失敗を隠す人も出てくる。＿＿、次の改善に必要な情報を共有するものとして扱うべきだ。",
    correct: "むしろ",
    distractors: ["その結果", "たとえば", "言い換えれば"],
    explanation:
      "むしろ rejects the narrow punitive view and redirects the purpose of records toward future improvement.",
  },
  {
    id: "n2-tg-remote-work-qualification",
    passage:
      "在宅勤務を取り入れた結果、通勤時間を家族との時間に使えるようになった社員は多い。集中しやすくなったという報告もある。＿＿、全員が同じ環境で働けるわけではなく、自宅では仕事の場所を確保できない人もいる。制度を評価するときは、平均的な効果だけでなく条件の違いも見る必要がある。",
    correct: "もっとも",
    distractors: ["したがって", "すなわち", "たとえば"],
    explanation:
      "もっとも adds an important qualification to the preceding positive assessment of remote work.",
  },
  {
    id: "n2-tg-museum-congestion-response",
    passage:
      "美術館では、入口の説明を読む人が立ち止まり、混雑が起きていた。説明をなくせば流れはよくなるが、展示の背景が分からなくなる。＿＿、入口には要点だけを示し、詳しい説明は展示の奥に置くことにした。利用者は必要な情報の量を自分で選べる。",
    correct: "そこで",
    distractors: ["ところが", "たとえば", "すなわち"],
    explanation:
      "そこで introduces a solution that responds to both congestion and the need for detailed information.",
  },
  {
    id: "n2-tg-equal-versus-fair",
    passage:
      "全員に同じ支援を提供することは、分かりやすく、運用もしやすい。しかし、出発点が異なる人に同じ物を渡しても、同じように利用できるとは限らない。必要な支援の量が人によって違う場合もある。＿＿、同じ扱いと公平な結果は必ずしも一致しない。",
    correct: "つまり",
    distractors: ["ところが", "たとえば", "それにもかかわらず"],
    explanation:
      "つまり summarizes the distinction developed between identical treatment and equitable outcomes.",
  },
  {
    id: "n2-tg-short-term-cost",
    passage:
      "古い設備を交換するには大きな費用がかかる。そのため、今年の予算だけを見れば、修理しながら使い続けるほうが安い。＿＿、故障のたびに作業が止まり、修理費も増えている。数年間の費用と停止時間を合わせて比べなければならない。",
    correct: "その反面",
    distractors: ["したがって", "たとえば", "すなわち"],
    explanation:
      "その反面 introduces the accumulating disadvantages hidden by the lower short-term cost.",
  },
  {
    id: "n2-tg-public-comments-reference",
    passage:
      "市は新しい計画を発表し、住民から意見を募集した。賛成と反対の数だけでなく、どの部分に不安があるかも整理した。＿＿。市はこの指摘を受け、夜間の工事を減らす案を追加した。修正案についても、もう一度意見を求める予定である。",
    correct: "特に多かったのは、工事の音が生活に与える影響への心配だった",
    distractors: [
      "特に多かったのは、完成後の緑地を増やしてほしいという希望だった",
      "特に多かったのは、工事期間をさらに長くしてほしいという意見だった",
      "特に多かったのは、新しい道路の名前に関する提案だった",
    ],
    explanation:
      "The common concern about construction noise supplies the referent for この指摘 and motivates the night-work revision.",
  },
  {
    id: "n2-tg-ai-review-role",
    passage:
      "機械を使えば、大量の文書から同じ表現を短時間で探せる。見落としを減らすための補助としても役立つ。＿＿、文書が置かれた状況や、書き手が何を意図したかまで自動的に判断できるわけではない。最後の評価には、資料の背景を知る人の確認が必要だ。",
    correct: "とはいえ",
    distractors: ["そのため", "すなわち", "たとえば"],
    explanation:
      "とはいえ limits the machine's documented strengths before explaining what still requires contextual human judgment.",
  },
  {
    id: "n2-tg-failed-program-learning",
    passage:
      "参加者が目標に届かなかった活動を、すぐ失敗と呼ぶことがある。だが、参加しなかった人の理由や途中でやめた時点を調べれば、次の方法を考える材料になる。＿＿。結果だけで活動を終わらせれば、この情報も失われる。評価は続けるかやめるかを決めるだけでなく、改善点を見つける作業でもある。",
    correct: "期待どおりでなかった結果からも学べることはある",
    distractors: [
      "目標に届かなかった活動は、理由を調べる前に中止すべきである",
      "参加しなかった人より、参加者の満足だけを詳しく調べるべきだ",
      "評価では、次の改善より当初の目標だけを確認すればよい",
    ],
    explanation:
      "The following warning about losing information requires the claim that an unmet target can still yield useful learning.",
  },
  {
    id: "n2-tg-translation-audience",
    passage:
      "同じ案内を複数の言語に訳せば、情報を受け取れる人は増える。＿＿、直訳しただけでは、制度を知らない人に目的が伝わらない場合がある。必要なら背景を短く説明し、例も加えるべきだ。言葉を置き換えることと、内容を理解できる形で届けることは同じではない。",
    correct: "しかし",
    distractors: ["したがって", "すなわち", "たとえば"],
    explanation:
      "しかし introduces the limitation that translation alone may not convey unfamiliar institutional context.",
  },
  {
    id: "n2-tg-optional-participation",
    passage:
      "研修への参加を義務にすれば、全員に同じ情報を伝えられる。反対に、自由参加にすると、関心のある人しか来ない可能性がある。＿＿、義務にするだけで内容が理解されるわけでもない。参加方法だけでなく、質問や復習の機会も設計する必要がある。",
    correct: "かといって",
    distractors: ["したがって", "すなわち", "たとえば"],
    explanation:
      "かといって rejects the apparent opposite solution of compulsory attendance as sufficient by itself.",
  },
  {
    id: "n2-tg-deliberation-speed",
    passage:
      "意見の違いをすべて解決してから決めようとすれば、時間がかかる。一方、早さだけを優先して反対意見を聞かなければ、重要な問題を見落とす。＿＿、必要なのは全員の完全な一致ではなく、残った問題を明らかにした上で判断することだ。決定後に見直す条件も決めておくとよい。",
    correct: "したがって",
    distractors: ["ところが", "たとえば", "それにもかかわらず"],
    explanation:
      "したがって draws the proposed decision standard from the two preceding risks.",
  },
  {
    id: "n2-tg-maintenance-visibility",
    passage:
      "建物の修理は、新しい施設を作る事業ほど目立たない。問題が起きなければ、費用をかけた効果も見えにくい。＿＿、点検を後回しにすれば、事故や大きな修理につながるおそれがある。成果が見えにくい仕事も、長期的な安全には欠かせない。",
    correct: "それでも",
    distractors: ["そのため", "すなわち", "たとえば"],
    explanation:
      "それでも marks the need for maintenance despite its low visibility and hard-to-see benefits.",
  },
  {
    id: "n2-tg-update-history",
    passage:
      "案内文を短くするために、古い説明を削除することはある。ただ、現在の文だけを残すと、なぜ規則が変わったのか分からなくなる。変更の理由と日付を別に記録しておけば、後で判断を確かめられる。＿＿、利用者向けの短い案内と、運営のための変更履歴は分けて管理するとよい。",
    correct: "このように",
    distractors: ["ところが", "たとえば", "それにもかかわらず"],
    explanation:
      "このように introduces the practical conclusion derived from distinguishing current guidance from historical decision records.",
  },
  {
    id: "n2-tg-small-sample",
    passage:
      "試作品を十人に使ってもらったところ、八人が使いやすいと答えた。これは改善の方向を考える上で参考になる。＿＿、十人の反応がすべての利用者を代表するとは限らない。年齢や利用経験の異なる人にも試してもらい、結果を比べる必要がある。",
    correct: "もっとも",
    distractors: ["したがって", "すなわち", "たとえば"],
    explanation:
      "もっとも qualifies the encouraging initial result by noting the sample's limited representativeness.",
  },
  {
    id: "n2-tg-choice-architecture",
    passage:
      "選択肢を増やせば、一人一人に合う方法を選びやすくなる。ところが、違いが分かりにくい選択肢が多すぎると、決める負担も大きくなる。必要なのは、数を増やすこと自体ではない。＿＿。それぞれの特徴を比べられる説明も欠かせない。",
    correct: "目的の異なる選択肢を、迷わない形で示すことである",
    distractors: [
      "迷いをなくすため、最も多く選ばれた一つだけを残すことである",
      "違いを説明する前に、できるだけ多くの選択肢を用意することである",
      "内容が似た選択肢を細かく分け、数を増やすことである",
    ],
    explanation:
      "The conclusion must reconcile useful choice with cognitive burden and lead into the need for comparable explanations.",
  },
  {
    id: "n2-tg-pilot-access-blank-1",
    groupId: "n2-tg-pilot-access",
    blankId: "n2-tg-pilot-access-1",
    blankOrder: 1,
    canonicalPassage: N2_PILOT_ACCESS_CANONICAL,
    passage:
      "市は申請窓口の開設時間を一部の地域で延長した。全体の利用件数は増え、試行に参加した人の評価も高かった。＿＿、交通が不便な地域では、延長後も利用者がほとんど増えていない。地域別の違いを確認した上で、次の支援方法を決める必要がある。そこで、市は試行を直ちに全域へ広げず、利用しにくい地域で出張窓口も試すことにした。",
    correct: "とはいえ",
    distractors: ["したがって", "たとえば", "すなわち"],
    explanation:
      "とはいえ qualifies the favorable aggregate result with a region where access did not improve.",
  },
  {
    id: "n2-tg-pilot-access-blank-2",
    groupId: "n2-tg-pilot-access",
    blankId: "n2-tg-pilot-access-2",
    blankOrder: 2,
    canonicalPassage: N2_PILOT_ACCESS_CANONICAL,
    passage:
      "市は申請窓口の開設時間を一部の地域で延長した。全体の利用件数は増え、試行に参加した人の評価も高かった。とはいえ、交通が不便な地域では、延長後も利用者がほとんど増えていない。地域別の違いを確認した上で、次の支援方法を決める必要がある。＿＿、市は試行を直ちに全域へ広げず、利用しにくい地域で出張窓口も試すことにした。",
    correct: "そこで",
    distractors: ["ところが", "たとえば", "すなわち"],
    explanation:
      "そこで introduces the targeted follow-up action taken in response to the regional access gap.",
  },
]);

export const N1_TEXT_GRAMMAR_SEEDS = defineTextGrammarSeeds([
  {
    id: "n1-tg-transparency-limit",
    passage:
      "意思決定の過程を公開すれば、それだけで組織への信頼が高まるとは限らない。資料が大量に並ぶだけでは、何が判断を左右したのか理解できないからだ。＿＿、過程をまったく示さなければ、決定を外から検証する機会そのものが失われる。必要なのは、公開の量を競うことではなく、根拠と論点の関係がたどれる形で示すことである。",
    correct: "とはいえ",
    distractors: ["したがって", "たとえば", "すなわち"],
    explanation:
      "とはいえ qualifies the limits of disclosure without abandoning the necessity of making decisions externally reviewable.",
  },
  {
    id: "n1-tg-measurement-effect",
    passage:
      "成果を数値で表せば、異なる時期や組織を比較しやすくなる。しかし、測りやすいものだけを目標にすると、本来重視すべき活動が後回しになることもある。相談の丁寧さより処理件数が評価されれば、短い相談が優先されかねない。＿＿、指標は現状を映すだけでなく、現場の行動を変える働きも持つ。指標を選ぶ際には、その影響まで検討すべきだ。",
    correct: "つまり",
    distractors: ["ところが", "たとえば", "それにもかかわらず"],
    explanation:
      "つまり summarizes the examples into the broader claim that metrics actively shape behavior.",
  },
  {
    id: "n1-tg-complete-agreement",
    passage:
      "重要な決定ほど、多様な意見を聞く必要がある。異論を検討することで、提案した側が気づかなかった影響を発見できるからだ。＿＿、全員が完全に納得するまで何も決めないというのでは、期限のある問題に対応できない。合意の有無だけでなく、残った論点と見直しの条件を明らかにした上で決定する必要がある。",
    correct: "かといって",
    distractors: ["したがって", "すなわち", "たとえば"],
    explanation:
      "かといって rejects the opposite extreme of requiring complete agreement while preserving the value of hearing dissent.",
  },
  {
    id: "n1-tg-automation-accountability",
    passage:
      "判断の一部を自動化すれば、担当者ごとの差を減らし、処理を速くできる可能性がある。だが、過去の判断をもとに作られた仕組みは、その判断に含まれていた偏りまで引き継ぐおそれがある。問題が起きたときに『機械が決めた』と説明するだけでは、根拠を示したことにはならない。＿＿、自動化するほど、入力条件と例外時の責任を人が明確にしておく必要がある。",
    correct: "むしろ",
    distractors: ["ところで", "たとえば", "すなわち"],
    explanation:
      "むしろ reverses the intuition that automation reduces human responsibility and stresses that it increases the need to define it.",
  },
  {
    id: "n1-tg-local-experiment",
    passage:
      "ある地域で効果のあった施策を、別の地域にもそのまま導入したくなるのは自然である。既に成果が示されていれば、最初から方法を考えるより効率的に見える。＿＿、人口構成や交通事情が異なれば、同じ施策でも利用できる人は変わる。方法を移す前に、効果を生んだ条件のどれが新しい地域にも存在するかを確かめなければならない。",
    correct: "その一方で",
    distractors: ["その結果", "すなわち", "たとえば"],
    explanation:
      "その一方で contrasts the apparent efficiency of copying a proven measure with dependence on local conditions.",
  },
  {
    id: "n1-tg-exception-policy",
    passage:
      "規則に例外を設けると、運用が複雑になり、不公平だという印象を与える場合がある。だからといって、事情の異なる人をすべて同じように扱えば、規則の目的そのものを損なうこともある。例外を認めるかどうかを担当者の感覚だけに任せるのも望ましくない。＿＿。どの条件なら例外となり、その判断を誰が確認するかまで定めておく必要がある。",
    correct:
      "必要なのは、例外をなくすことではなく、その基準を検証可能にすることだ",
    distractors: [
      "例外を認めるかは、最も経験のある担当者に任せればよい",
      "運用を簡単にするため、事情にかかわらず例外を認めないことだ",
      "例外を増やすほど、規則の目的は明確になるはずだ",
    ],
    explanation:
      "The missing thesis must reconcile necessary exceptions with predictable, reviewable decision-making and lead into the stated conditions.",
  },
  {
    id: "n1-tg-invisible-maintenance",
    passage:
      "新しい施設の完成は目に見えやすく、成果として説明しやすい。それに比べ、事故を防ぐための点検は、何も起きなければ効果がなかったように見える。＿＿、点検を省いた結果は、故障が起きるまで表面化しないだけである。問題が起きなかったという事実を、何もしなくてよかった証拠と取り違えてはならない。",
    correct: "しかしながら",
    distractors: ["したがって", "すなわち", "たとえば"],
    explanation:
      "しかしながら challenges the appearance that preventive work has no effect and introduces its hidden causal role.",
  },
  {
    id: "n1-tg-data-category",
    passage:
      "調査結果を属性別に示せば、全体の平均では隠れていた違いが見える。＿＿、分類を細かくしすぎると、人数の少ない集団では個人が推測される危険が高まる。また、分類の境界を固定すると、本来連続している違いを別々のものとして扱ってしまう。分析の細かさと、情報保護や解釈の妥当性との均衡が必要である。",
    correct: "ただし",
    distractors: ["そのため", "すなわち", "たとえば"],
    explanation:
      "ただし introduces two limitations on the otherwise useful practice of breaking results down by category.",
  },
  {
    id: "n1-tg-silence-in-meetings",
    passage:
      "会議で発言がなかった人を、提案に賛成したとみなすことがある。しかし、立場の違いから反対を言いにくかった可能性も、資料を読む時間が足りなかった可能性もある。沈黙だけから理由を一つに決めることはできない。＿＿、発言しなかった人にも後から意見を出せる方法を用意すべきだ。参加の機会は、会議中に話せるかどうかだけで測れない。",
    correct: "したがって",
    distractors: ["ところが", "たとえば", "それにもかかわらず"],
    explanation:
      "したがって draws the procedural recommendation from the uncertainty surrounding silence.",
  },
  {
    id: "n1-tg-failure-publication",
    passage:
      "期待した効果が得られなかった事例は、公表しても注目されにくい。実施した側も、失敗と評価されることを恐れて詳細を示したがらない。＿＿、うまくいかなかった条件が共有されなければ、別の組織が同じ方法を同じ条件で繰り返すことになる。成功例だけを集めた知識は、方法の限界を過小評価させる。",
    correct: "それにもかかわらず",
    distractors: ["そのため", "すなわち", "たとえば"],
    explanation:
      "それにもかかわらず marks why unfavorable results still need publication despite weak incentives to share them.",
  },
  {
    id: "n1-tg-temporary-measure",
    passage:
      "緊急時には、通常の手続きを短くして迅速に対応する必要がある。問題は、その特別な方法が、状況が落ち着いた後も理由を検討されないまま残ることである。仮の措置は、続けるうちに当たり前の制度として受け入れられやすい。＿＿。開始時に終了条件と見直しの日を定めておくことが欠かせない。",
    correct: "だからこそ、例外的な措置には期限が必要になる",
    distractors: [
      "緊急時に始めた措置は、混乱を避けるため見直さず続けるべきだ",
      "仮の措置の評価は、通常の手続きが戻った後にだけ行えばよい",
      "例外的措置は、効果が分かるまで終了条件を決めないほうがよい",
    ],
    explanation:
      "The risk of temporary measures becoming permanent requires an explicit expiration-and-review conclusion.",
  },
  {
    id: "n1-tg-choice-and-default",
    passage:
      "複数の選択肢を用意すれば、利用者の自由が広がるように見える。だが、違いを理解するための情報や時間がなければ、多くの人は最初から選ばれている方法をそのまま受け入れる。＿＿。選択肢の数だけで自由を評価するのではなく、比較できる説明と変更のしやすさも確かめる必要がある。",
    correct: "選ばないという行動も、初期設定の影響を受けているのである",
    distractors: [
      "初期設定は、選択を急ぐ人にだけ影響するものだ",
      "選択肢が多ければ、比較のための説明は少なくてもよい",
      "変更しなかった人は、初期設定を積極的に選んだとみなせる",
    ],
    explanation:
      "The missing sentence identifies the default effect and supports the conclusion that meaningful freedom requires comparability and easy revision.",
  },
  {
    id: "n1-tg-expert-disagreement",
    passage:
      "専門家の意見が一致しないと、知識そのものが役に立たないように感じられることがある。＿＿、意見の違いは、何も分かっていないことを意味するとは限らない。同じ資料を認めながら、重視する危険や許容できる不確実さが異なる場合もある。結論だけでなく、どの前提で判断が分かれたかを示すことが重要だ。",
    correct: "しかし",
    distractors: ["したがって", "すなわち", "たとえば"],
    explanation:
      "しかし rejects the inference that expert disagreement necessarily means the evidence has no value.",
  },
  {
    id: "n1-tg-memory-and-record",
    passage:
      "経験のある人は、過去の似た状況を思い出し、短時間で判断できる。こうした直感は、すべての条件を一から調べるより効率的なことも多い。＿＿、記憶は後から現在の結果に合わせて変化し、当時の不確実さを小さく見せることがある。直感を否定するのではなく、判断時に分かっていた事実を記録と照らして確かめるべきだ。",
    correct: "もっとも",
    distractors: ["したがって", "すなわち", "たとえば"],
    explanation:
      "もっとも qualifies the value of experience by introducing the known unreliability of retrospective memory.",
  },
  {
    id: "n1-tg-standardization-learning",
    passage:
      "手順を標準化すれば、担当者が変わっても一定の質を保ちやすい。新人が基本的な流れを学ぶ助けにもなる。反面、例外に気づいても手順を外れることを恐れ、必要な対応が遅れる場合がある。＿＿、標準化の目的は判断を不要にすることではなく、判断すべき点を明確にすることだ。例外を記録し、手順自体を更新する仕組みが必要である。",
    correct: "換言すれば",
    distractors: ["ところが", "たとえば", "それにもかかわらず"],
    explanation:
      "換言すれば reformulates the preceding benefits and risks into a precise statement of standardization's proper purpose.",
  },
  {
    id: "n1-tg-participation-cost",
    passage:
      "説明会をオンラインでも開けば、遠方の人は参加しやすくなる。録画を後から見られるようにすることも、時間の制約を減らす。＿＿、通信環境や機器の利用に負担を感じる人まで参加しやすくなるわけではない。参加方法を増やす際には、それぞれが新たに生む障壁も調べる必要がある。",
    correct: "とはいえ",
    distractors: ["そのため", "すなわち", "たとえば"],
    explanation:
      "とはいえ limits the accessibility gains by identifying people for whom the added digital modes create other barriers.",
  },
  {
    id: "n1-tg-correlation-cause",
    passage:
      "あるサービスの利用者は、利用しない人より健康状態がよいという調査結果が出た。だからといって、そのサービスだけが差を生んだと結論することはできない。もともと健康への関心が高い人ほど、サービスを利用した可能性もある。＿＿。利用前の状態や他の行動も調べなければ、因果関係は判断できない。",
    correct: "観察された関係には、別の説明があり得るのである",
    distractors: [
      "利用者の健康状態がよい以上、サービスには一定の効果があったと考えられる",
      "利用前の違いがあっても、人数が多ければその影響は無視できる",
      "健康への関心は測りにくいため、原因の候補から外すべきだ",
    ],
    explanation:
      "The missing sentence generalizes the alternative-selection explanation and leads into the need to examine baseline conditions.",
  },
  {
    id: "n1-tg-reversible-decision",
    passage:
      "不確実な状況でも、判断を先送りすること自体が損失を生む場合がある。十分な情報がそろうまで待てないなら、限られた根拠で決めざるを得ない。＿＿、最初の判断を最終的なものとして固定する必要はない。小規模に始め、見直す時点と中止の条件を定めれば、不確実さを残したままでも行動できる。",
    correct: "ただ",
    distractors: ["したがって", "すなわち", "たとえば"],
    explanation:
      "ただ adds the crucial qualification that acting under uncertainty need not make the first decision irreversible.",
  },
  {
    id: "n1-tg-language-simplicity",
    passage:
      "専門的な内容を多くの人に伝える際、用語を日常的な言葉に置き換えることは有効である。文章を短く区切れば、要点も追いやすい。＿＿、簡単な表現にする過程で、条件や例外まで削れば、内容を正確に伝えたことにはならない。分かりやすさは情報量を一律に減らすことではなく、理解に必要な関係を見えるようにすることだ。",
    correct: "その一方で",
    distractors: ["その結果", "すなわち", "たとえば"],
    explanation:
      "その一方で contrasts useful linguistic simplification with the risk of erasing substantive conditions and exceptions.",
  },
  {
    id: "n1-tg-retrospective-evaluation",
    passage:
      "ある決定の結果が悪かったとき、当時の判断も誤りだったと考えやすい。反対に、結果がよければ、危険な決め方だったことが見過ごされる。だが、判断時には結果はまだ分からない。＿＿。評価すべきなのは、当時利用できた情報を適切に検討し、不確実さに応じた備えをしていたかどうかである。",
    correct: "結果だけから過去の判断の質を測ることはできない",
    distractors: [
      "結果がよければ、判断過程の欠点は評価に影響しない",
      "悪い結果は、当時の情報収集が不十分だったことを示す",
      "不確実な状況では、備えより結果を基準に評価すべきだ",
    ],
    explanation:
      "The missing thesis follows from outcome hindsight and sets up the criterion based on information available at the time.",
  },
  {
    id: "n1-tg-evidence-update-blank-1",
    groupId: "n1-tg-evidence-update",
    blankId: "n1-tg-evidence-update-1",
    blankOrder: 1,
    canonicalPassage: N1_EVIDENCE_UPDATE_CANONICAL,
    passage:
      "研究結果を政策に用いる以上、結論が変わらないことを期待したくなる。判断の根拠が頻繁に変われば、利用者が混乱するからだ。＿＿、新しい証拠が得られても以前の説明を守り続けるなら、研究を参照する意味が失われる。変更そのものと、根拠なく方針を揺らすことは区別しなければならない。したがって、どの証拠によって判断を改めたのかを示す仕組みが必要である。",
    correct: "とはいえ",
    distractors: ["したがって", "たとえば", "すなわち"],
    explanation:
      "とはいえ limits the desire for stable conclusions by introducing the obligation to respond to new evidence.",
  },
  {
    id: "n1-tg-evidence-update-blank-2",
    groupId: "n1-tg-evidence-update",
    blankId: "n1-tg-evidence-update-2",
    blankOrder: 2,
    canonicalPassage: N1_EVIDENCE_UPDATE_CANONICAL,
    passage:
      "研究結果を政策に用いる以上、結論が変わらないことを期待したくなる。判断の根拠が頻繁に変われば、利用者が混乱するからだ。とはいえ、新しい証拠が得られても以前の説明を守り続けるなら、研究を参照する意味が失われる。変更そのものと、根拠なく方針を揺らすことは区別しなければならない。＿＿、どの証拠によって判断を改めたのかを示す仕組みが必要である。",
    correct: "したがって",
    distractors: ["ところが", "たとえば", "それにもかかわらず"],
    explanation:
      "したがって draws the transparency requirement from the need to distinguish evidence-based revision from arbitrary instability.",
  },
]);
