/**
 * Original upper-level listening seeds.
 *
 * These records contain the audible stimulus and answer content only. The quiz
 * assembler is responsible for applying the official presentation order:
 * task/key-point questions before the stimulus; outline/integrated questions
 * after it; and quick-response as a prompt followed by three audio-only replies.
 */

import { N1_UPPER_LISTENING_EXPANSION } from "./n1-upper-listening-expansion";
import { n2UpperListeningExpansion } from "./n2-upper-listening-expansion";
import { N3_UPPER_LISTENING_EXPANSION } from "./n3-upper-listening-expansion";

export type UpperListeningLevel = "N3" | "N2" | "N1";

export type UpperListeningFamily =
  | "listening-task"
  | "listening-key-points"
  | "listening-outline"
  | "listening-quick-response"
  | "listening-integrated";

export type UpperListeningQuestionTiming =
  | "before-stimulus"
  | "after-stimulus"
  | "prompt-only";

export interface UpperListeningSeed {
  /** Stable editorial identity; never derive this from array position. */
  semanticId: string;
  level: UpperListeningLevel;
  family: UpperListeningFamily;
  /** A globally unique scenario description used to audit semantic diversity. */
  semanticFocus: string;
  /** The audio heard before any answer choices. */
  script: string;
  /** Printed before/after the stimulus, except for the generic quick-response instruction. */
  question: string;
  /** Three options for quick response; four for every other family. */
  options: readonly string[];
  correctIndex: number;
  explanation: string;
  questionTiming: UpperListeningQuestionTiming;
  audioOnlyOptions: boolean;
  /** Count of genuinely distinct information sources in an integrated item. */
  sourceCount?: number;
}

const n3TaskSeeds = [
  {
    semanticId: "N3-task-seminar-payment-order",
    level: "N3",
    family: "listening-task",
    semanticFocus:
      "seminar registration requires acceptance mail before payment",
    script:
      "女：来月の写真セミナーに申し込みたいんですが、先に参加費を振り込めばいいですか。男：いいえ。まずウェブの申し込み用紙を送ってください。人数が多い場合は抽選になります。参加できる方には金曜日にメールを送りますので、そのメールが来てから参加費を払ってください。女：分かりました。では、今、用紙を送ります。",
    question: "女の人は、まず何をしますか。",
    options: [
      "参加費を振り込む",
      "申し込み用紙を送る",
      "金曜日に電話する",
      "写真をメールで送る",
    ],
    correctIndex: 1,
    explanation:
      "The man explicitly says to submit the application form first; payment happens only after an acceptance email.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N3-task-copier-scan-support-call",
    level: "N3",
    family: "listening-task",
    semanticFocus: "office copier scan must be saved before requesting support",
    script:
      "男：この資料、コピー機で読み取ったんですが、パソコンに届きません。女：画面の右下に『保存』と出ていますか。男：はい。女：では、そこを押してから、一分ぐらい待ってください。それでも届かなければ、管理室に電話しましょう。男：あ、まだ保存していませんでした。",
    question: "男の人は、このあとまず何をしますか。",
    options: [
      "管理室に電話する",
      "資料をもう一度コピーする",
      "画面の保存ボタンを押す",
      "パソコンを一分間止める",
    ],
    correctIndex: 2,
    explanation:
      "He notices that he has not pressed Save; calling support is conditional on that not working.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N3-task-club-rain-room-notice",
    level: "N3",
    family: "listening-task",
    semanticFocus:
      "rain moves club practice indoors and members need notification",
    script:
      "女：明日のテニス練習、雨になりそうですね。男：体育館が三時から使えることになったよ。予約は先生がしてくれた。女：じゃあ、私はボールを準備します。男：ボールは体育館にあるから大丈夫。それより、場所が変わったことをみんなに知らせてもらえる？女：はい、今、グループに送ります。",
    question: "女の人は、このあと何をしますか。",
    options: [
      "体育館を予約する",
      "ボールを準備する",
      "先生に天気を聞く",
      "練習場所の変更を知らせる",
    ],
    correctIndex: 3,
    explanation:
      "The reservation and balls are already handled; she agrees to notify the group about the venue change.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N3-task-library-overdue-return-before-new-loan",
    level: "N3",
    family: "listening-task",
    semanticFocus: "overdue library book blocks renewal until returned",
    script:
      "男：この本をもう二週間借りたいんですが。女：すみません、別に借りている本の返す日が昨日でした。遅れている本があると、こちらの本も長く借りられないんです。男：遅れている本は家にあります。女：では、それを返してから、もう一度この本をお持ちください。予約は入っていないので、そのとき延長できます。",
    question: "男の人は、まず何をしなければなりませんか。",
    options: [
      "この本を予約する",
      "家にある本を返す",
      "二週間待つ",
      "新しいカードを作る",
    ],
    correctIndex: 1,
    explanation:
      "The overdue book must be returned before the current loan can be extended.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N3-task-hotel-luggage-name-label",
    level: "N3",
    family: "listening-task",
    semanticFocus: "hotel stores luggage only after guest attaches name label",
    script:
      "女：チェックアウトしたあとも、この荷物を夕方まで預かっていただけますか。男：もちろんです。こちらの紙にお名前と部屋番号を書いて、かばんにつけてください。女：引き取る時間も書きますか。男：それは書かなくて結構です。お名前の札をつけたら、荷物は私が奥へ運びます。",
    question: "女の人は、このあと何をしますか。",
    options: [
      "荷物を自分で奥へ運ぶ",
      "引き取る時間を紙に書く",
      "名前と部屋番号を書いて荷物につける",
      "部屋に荷物を置きに戻る",
    ],
    correctIndex: 2,
    explanation:
      "She is told to write her name and room number on the label and attach it; staff will move the bag.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N3-task-cooking-class-apron-only",
    level: "N3",
    family: "listening-task",
    semanticFocus:
      "cooking class participant brings apron while organizer buys missing eggs",
    script:
      "男：明日の料理教室、材料は全部そろいましたか。女：野菜と肉はありますが、卵が足りません。帰りに私が買います。男：じゃあ、僕も何か持っていきます。女：材料は大丈夫です。エプロンだけ忘れないでください。教室には貸すものがないそうです。男：分かりました。今夜、かばんに入れておきます。",
    question: "男の人は、何を準備しますか。",
    options: ["卵", "野菜", "肉", "エプロン"],
    correctIndex: 3,
    explanation:
      "The woman will buy the eggs and says ingredients are covered; he only needs to bring an apron.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N3-task-train-ticket-machine-pickup",
    level: "N3",
    family: "listening-task",
    semanticFocus:
      "reserved train ticket must be collected from machine before boarding",
    script:
      "女：明日の大阪行き、スマートフォンで指定席を予約しました。改札では予約の画面を見せればいいですか。男：その予約は、駅の機械で切符を受け取るタイプです。予約に使ったカードを入れると出てきますよ。女：駅でお金を払うんですか。男：支払いはもう終わっています。切符だけ受け取ってください。",
    question: "女の人は、駅で何をしますか。",
    options: [
      "予約画面を駅員に見せる",
      "機械で切符を受け取る",
      "窓口で料金を払う",
      "もう一度席を予約する",
    ],
    correctIndex: 1,
    explanation:
      "Payment and reservation are complete, but this booking requires collecting a paper ticket at the station machine.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N3-task-festival-signs-before-reception",
    level: "N3",
    family: "listening-task",
    semanticFocus:
      "festival volunteer places direction signs before helping reception",
    script:
      "男：明日の祭り、受付を手伝ってくれる？女：はい。九時に受付へ行けばいいですか。男：受付は九時半からでいいんだけど、その前に駅から会場まで案内の紙を三か所につけてほしいんだ。紙は事務所の机に置いてあるよ。女：分かりました。八時四十五分に事務所へ行きます。",
    question: "女の人は、最初に何をしますか。",
    options: [
      "駅で客を迎える",
      "受付を始める",
      "事務所で案内の紙を受け取る",
      "会場の机を並べる",
    ],
    correctIndex: 2,
    explanation:
      "Before reception she must collect the direction signs from the office, then place them along the route.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
] as const satisfies readonly UpperListeningSeed[];

const n3KeyPointSeeds = [
  {
    semanticId: "N3-key-roadworks-early-bus",
    level: "N3",
    family: "listening-key-points",
    semanticFocus:
      "commuter chooses earlier bus because roadworks make usual route unreliable",
    script:
      "女：最近、会社に来るのが早いですね。男：駅前の工事が始まって、いつものバスがよく遅れるんです。電車に変えようかと思ったんですが、駅まで歩くと遠くて。それで、同じバスの一本早い便に乗ることにしました。女：朝は大変ですが、遅刻する心配は減りますね。",
    question: "男の人は、なぜ早いバスに乗っていますか。",
    options: [
      "会社の始まる時間が早くなったから",
      "駅まで歩く運動をしたいから",
      "工事でいつものバスが遅れやすいから",
      "朝のバスの料金が安いから",
    ],
    correctIndex: 2,
    explanation:
      "Road construction makes the usual bus late; the earlier bus reduces the risk of being late.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N3-key-new-project-learning-value",
    level: "N3",
    family: "listening-key-points",
    semanticFocus:
      "employee values unfamiliar project because it creates a learning opportunity",
    script:
      "男：新しい仕事、どう？前にやったことがない分野でしょう。女：覚えることが多くて、帰るころには疲れています。でも、今まで知らなかったことを毎日教えてもらえるので、引き受けてよかったです。男：忙しいのに、楽しそうだね。女：ええ。時間はかかりますけどね。",
    question: "女の人は、新しい仕事についてどう思っていますか。",
    options: [
      "難しいので、すぐにやめたい",
      "忙しいが、新しいことを学べてよい",
      "簡単だが、あまり役に立たない",
      "前と同じ仕事なので、つまらない",
    ],
    correctIndex: 1,
    explanation:
      "Although tired and busy, she explicitly says she is glad she accepted because she learns something new every day.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N3-key-museum-east-wing-closure-date",
    level: "N3",
    family: "listening-key-points",
    semanticFocus:
      "museum visitor identifies only the east wing closure period",
    script:
      "館内放送：お客様にお知らせします。二階の東展示室は、作品を入れ替えるため、今日の午後三時から金曜日まで閉まります。西展示室と一階の特別展は、いつもどおりご覧いただけます。土曜日からは、すべての展示室が開きます。",
    question: "東展示室は、いつからまた見られますか。",
    options: ["今日の午後三時", "金曜日", "土曜日", "来週の月曜日"],
    correctIndex: 2,
    explanation: "The east room is closed through Friday and reopens Saturday.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N3-key-apartment-traffic-noise",
    level: "N3",
    family: "listening-key-points",
    semanticFocus:
      "apartment rejected because late traffic noise outweighs reasonable rent",
    script:
      "女：昨日見た部屋、駅から近くて、家賃も思ったより高くなかったよ。男：じゃあ、そこに決めるの？女：ううん。大きい道路のすぐ横で、夜遅くまで車の音が聞こえるんだって。私は朝が早いから、よく眠れないと困るし。もう少し駅から遠くても、静かな所を探すつもり。",
    question: "女の人が、その部屋を借りない一番の理由は何ですか。",
    options: [
      "駅から遠いから",
      "家賃が高いから",
      "部屋が狭いから",
      "車の音がうるさいから",
    ],
    correctIndex: 3,
    explanation:
      "The rent and distance are acceptable; traffic noise and its effect on sleep are decisive.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N3-key-online-lesson-conversation-gap",
    level: "N3",
    family: "listening-key-points",
    semanticFocus:
      "online language lessons are convenient but provide too little spontaneous conversation",
    script:
      "男：そのオンライン英語教室、どう？女：好きな時間に勉強できるし、文法の説明も分かりやすいよ。ただ、ビデオを見る時間がほとんどで、先生やほかの学生と話す機会が少ないんだ。男：会話を練習したい人には、少し足りないね。女：そうなの。そこだけ変われば続けたいんだけど。",
    question: "女の人は、この教室の何が問題だと言っていますか。",
    options: [
      "時間を自由に選べないこと",
      "文法の説明が難しいこと",
      "会話をする機会が少ないこと",
      "ビデオが短すぎること",
    ],
    correctIndex: 2,
    explanation:
      "Convenience and grammar explanations are praised; the stated weakness is insufficient conversation practice.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N3-key-cafe-bean-guidance",
    level: "N3",
    family: "listening-key-points",
    semanticFocus:
      "customer returns to cafe for staff guidance about unfamiliar coffee beans",
    script:
      "女：いつもこの店でコーヒー豆を買いますね。もっと安い店もあるでしょう。男：ここでは、店員さんが味の違いや、おいしい入れ方を丁寧に教えてくれるんです。名前を見ても分からない豆を、好みに合わせて選んでくれるし。値段より、その説明がありがたいんですよ。",
    question: "男の人が、この店をよく利用するのはなぜですか。",
    options: [
      "豆がどの店よりも安いから",
      "店員が豆の選び方を教えてくれるから",
      "家の近くにこの店しかないから",
      "コーヒーを無料で飲めるから",
    ],
    correctIndex: 1,
    explanation:
      "He explicitly values the staff's explanations and personalized bean recommendations over price.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N3-key-shoe-return-width-not-length",
    level: "N3",
    family: "listening-key-points",
    semanticFocus:
      "shoes are returned because toe width is tight despite correct length",
    script:
      "男：昨日買った靴、サイズを変えるんですか。女：長さはちょうどいいんだけど、少し歩くと、つま先の横が痛くなるの。店では気づかなかったんだ。男：一つ大きくすると長すぎない？女：だから、同じ長さで、幅が広い形に交換してもらうつもり。",
    question: "女の人は、靴の何が合わないと言っていますか。",
    options: ["長さ", "幅", "色", "重さ"],
    correctIndex: 1,
    explanation:
      "The length is right; pressure at the sides of the toes means the width is the problem.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N3-key-report-graph-labels",
    level: "N3",
    family: "listening-key-points",
    semanticFocus:
      "report graph values are correct but category labels are reversed",
    script:
      "女：昨日の売り上げ報告、数字は確認しましたか。男：はい、表の数字は全部合っています。ただ、二ページ目のグラフで、『店内』と『オンライン』の名前が反対になっています。女：線の色は正しいですか。男：色も正しいので、名前だけ直せば大丈夫です。",
    question: "報告書のどこを直す必要がありますか。",
    options: ["表の数字", "グラフの線の色", "グラフの名前", "ページの順番"],
    correctIndex: 2,
    explanation:
      "The numbers and colors are confirmed correct; only the two graph labels are reversed.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
] as const satisfies readonly UpperListeningSeed[];

const n3OutlineSeeds = [
  {
    semanticId: "N3-outline-community-garden-access",
    level: "N3",
    family: "listening-outline",
    semanticFocus:
      "community garden expands access through shared plots and beginner sessions",
    script:
      "男：この町の市民農園は人気がありますが、今までは一つの区画を一年間借りる方法しかなく、時間や経験がない人には利用しにくいという声がありました。そこで来月から、何人かで一つの区画を使う制度を始めます。道具は農園で貸し、月に二回、初めての人向けの説明会も開きます。多くの人に野菜作りを楽しんでもらうのが目的です。",
    question: "男の人の話の内容として、最もよいものはどれですか。",
    options: [
      "市民農園の料金を上げる計画",
      "市民農園を利用しやすくする新しい取り組み",
      "農家が野菜を売る新しい市場",
      "経験者だけの農業教室",
    ],
    correctIndex: 1,
    explanation:
      "Shared plots, tool loans, and beginner sessions all support the central aim of making the garden easier to use.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N3-outline-library-quiet-room-trial",
    level: "N3",
    family: "listening-outline",
    semanticFocus:
      "library trials separate quiet study and group discussion spaces",
    script:
      "女：図書館では、静かに勉強したい人と、話しながら学びたい人の両方から、場所が足りないという意見が出ていました。今月、三階を静かな学習室にし、一階の一部では小さな声で話せるようにします。まず一か月試して、利用者へのアンケートを見てから、続けるかどうか決めます。",
    question: "女の人は、主に何について話していますか。",
    options: [
      "図書館の本を減らす理由",
      "学習場所を分ける試み",
      "図書館員を増やす計画",
      "アンケートを中止する知らせ",
    ],
    correctIndex: 1,
    explanation:
      "The talk describes a one-month trial separating silent study from discussion space, followed by evaluation.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N3-outline-remote-work-daily-checkin",
    level: "N3",
    family: "listening-outline",
    semanticFocus:
      "remote team improves communication with brief daily check-ins rather than more meetings",
    script:
      "男：家で働く日が増えてから、同じチームでも、だれが何をしているか分かりにくくなりました。長い会議を増やすと仕事の時間が減ってしまいます。そこで私たちのチームでは、毎朝十分だけオンラインで集まり、その日の予定と困っていることを一人ずつ話しています。短いですが、助けが必要な人に早く気づけるようになりました。",
    question: "男の人のチームが始めたことは何ですか。",
    options: [
      "毎朝の短いオンライン確認",
      "毎週の長い会議",
      "全員が毎日会社へ行くこと",
      "仕事の予定をなくすこと",
    ],
    correctIndex: 0,
    explanation:
      "The team chose a ten-minute daily check-in to share plans and problems, explicitly avoiding longer meetings.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N3-outline-festival-heat-safety-changes",
    level: "N3",
    family: "listening-outline",
    semanticFocus:
      "summer festival changes schedule and rest facilities for heat safety",
    script:
      "女：今年の夏祭りは、暑さの中でも安全に楽しめるよう、いくつか変更します。子どもの踊りは午後二時ではなく、夕方五時からにします。また、会場には水を飲める場所と、冷房のある休憩室を用意します。祭りを短くするのではなく、時間と場所を工夫して、体調が悪くなる人を減らしたいと考えています。",
    question: "女の人の話の中心は何ですか。",
    options: [
      "夏祭りを今年は中止すること",
      "祭りの店を少なくすること",
      "暑さから参加者を守るための変更",
      "子どもの踊りを昼に行う理由",
    ],
    correctIndex: 2,
    explanation:
      "The later dance time, water stations, and cooled rest room are all heat-safety measures.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N3-outline-repair-cafe-reuse",
    level: "N3",
    family: "listening-outline",
    semanticFocus:
      "repair cafe teaches residents to fix objects and reduce waste",
    script:
      "男：駅前の交流センターで、月に一度『修理カフェ』が開かれています。壊れた時計や小さな家具などを持っていくと、修理が得意な人が、持ち主と一緒に直します。無料で何でも直してもらう場所ではありません。自分で直す方法を学び、まだ使える物をすぐ捨てないようにする活動です。",
    question: "修理カフェの目的は何ですか。",
    options: [
      "新しい家具を安く売ること",
      "専門家が無料で全部修理すること",
      "直し方を学んで物を長く使うこと",
      "壊れた時計を集めて捨てること",
    ],
    correctIndex: 2,
    explanation:
      "The speaker explicitly distinguishes it from a free repair service: owners learn repair skills and extend objects' use.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N3-outline-class-think-pair-share",
    level: "N3",
    family: "listening-outline",
    semanticFocus:
      "teacher increases classroom participation through individual then pair discussion",
    script:
      "女：授業で質問しても、いつも同じ学生しか答えないことがありました。そこで、質問のあと、まず全員に一分間、一人で考えてもらいます。次に二人で意見を話してから、クラス全体で発表します。急に大勢の前で話すより準備ができるため、今では多くの学生が自分の考えを言うようになりました。",
    question: "女の先生が行った工夫はどれですか。",
    options: [
      "答える学生を毎回一人に決めた",
      "考えて二人で話す時間を先に作った",
      "質問を授業の前日に全部渡した",
      "発表をしない授業に変えた",
    ],
    correctIndex: 1,
    explanation:
      "Students first think alone, then discuss in pairs, which prepares more of them to speak to the class.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N3-outline-exercise-sustainable-routine",
    level: "N3",
    family: "listening-outline",
    semanticFocus: "small exercise routine succeeds because it fits daily life",
    script:
      "男：運動を始めても、忙しくなるとやめてしまう人は少なくありません。私は以前、一時間走る目標を立てましたが、三日で終わりました。今は、昼休みに十分歩き、エレベーターではなく階段を使っています。少しでも毎日できる方法を選んだほうが、結果として長く続きます。大切なのは、最初から大きな目標を立てないことです。",
    question: "男の人が最も伝えたいことは何ですか。",
    options: [
      "毎日一時間走るべきだ",
      "昼休みには休まないほうがよい",
      "続けられる小さな運動を選ぶとよい",
      "階段だけを使えば十分だ",
    ],
    correctIndex: 2,
    explanation:
      "His examples support the main point that modest exercise integrated into daily life is easier to sustain.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N3-outline-bus-survey-targeted-trial",
    level: "N3",
    family: "listening-outline",
    semanticFocus:
      "town uses rider survey to trial evening bus on only the route with unmet demand",
    script:
      "女：市は、利用者の少ないバスをすべて減らす前に、乗客にアンケートを行いました。すると、昼の便は空いていても、病院から駅へ向かう夕方の便が足りないことが分かりました。そこで来月から三か月、その道だけ夕方のバスを一本増やします。利用者数を確認してから、その後の運行を決めます。",
    question: "市は、来月から何をしますか。",
    options: [
      "すべての昼のバスをなくす",
      "すべての道で夕方の便を増やす",
      "病院から駅への夕方の便を試しに増やす",
      "アンケートをせずに運行を決める",
    ],
    correctIndex: 2,
    explanation:
      "Survey results led to a three-month trial adding one evening bus only on the hospital-to-station route.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
] as const satisfies readonly UpperListeningSeed[];

const n3QuickResponseSeeds = [
  {
    semanticId: "N3-quick-package-delivered-neighbor",
    level: "N3",
    family: "listening-quick-response",
    semanticFocus: "neighbor reports accepting a delivered package",
    script: "留守の間に荷物が来たので、預かっておきましたよ。",
    question: "最も適切な応答を選んでください。",
    options: [
      "助かりました。あとで取りに伺います。",
      "では、荷物を送りましょう。",
      "留守にする予定はありません。",
    ],
    correctIndex: 0,
    explanation:
      "The natural response thanks the neighbor and arranges to collect the package.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N3-quick-window-cold-request",
    level: "N3",
    family: "listening-quick-response",
    semanticFocus: "coworker asks permission to close a cold open window",
    script: "少し寒いので、窓を閉めてもいいですか。",
    question: "最も適切な応答を選んでください。",
    options: [
      "ええ、お願いします。",
      "いいえ、閉めませんでした。",
      "窓がありません。",
    ],
    correctIndex: 0,
    explanation:
      "A permission request is naturally accepted with 「ええ、お願いします」.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N3-quick-meeting-moved-thursday",
    level: "N3",
    family: "listening-quick-response",
    semanticFocus: "colleague checks whether moved meeting is Thursday",
    script: "会議って、水曜日から木曜日に変わったんですよね。",
    question: "最も適切な応答を選んでください。",
    options: [
      "はい、木曜の三時からです。",
      "いいえ、水曜に変えますか。",
      "三時まで会議でした。",
    ],
    correctIndex: 0,
    explanation:
      "The speaker seeks confirmation of the new day; confirming Thursday and the time directly answers it.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N3-quick-forgot-umbrella-offer",
    level: "N3",
    family: "listening-quick-response",
    semanticFocus: "friend says they forgot an umbrella as rain starts",
    script: "困ったな。傘を家に忘れてきちゃった。",
    question: "最も適切な応答を選んでください。",
    options: [
      "雨が忘れたんですね。",
      "駅まで一緒に入りましょう。",
      "傘を使わなかったんです。",
    ],
    correctIndex: 1,
    explanation:
      "Offering to share an umbrella to the station appropriately addresses the problem.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N3-quick-heavy-box-help",
    level: "N3",
    family: "listening-quick-response",
    semanticFocus: "coworker struggles with a heavy box",
    script: "この箱、一人で運ぶにはちょっと重いなあ。",
    question: "最も適切な応答を選んでください。",
    options: [
      "私も持ちましょうか。",
      "一人で買ったんですか。",
      "箱は重くありませんでした。",
    ],
    correctIndex: 0,
    explanation:
      "The remark implies a need for help; offering to carry it together is the appropriate response.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N3-quick-presentation-outcome-question",
    level: "N3",
    family: "listening-quick-response",
    semanticFocus: "friend asks how a presentation went",
    script: "昨日の発表、どうだった？",
    question: "最も適切な応答を選んでください。",
    options: [
      "来週、発表するつもりです。",
      "緊張したけど、質問にも答えられたよ。",
      "発表の資料を見ませんか。",
    ],
    correctIndex: 1,
    explanation:
      "The question asks for the outcome of yesterday's presentation, which option two supplies.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N3-quick-station-walking-time",
    level: "N3",
    family: "listening-quick-response",
    semanticFocus: "visitor asks walking time to station",
    script: "ここから駅まで、歩いてどのくらいかかりますか。",
    question: "最も適切な応答を選んでください。",
    options: [
      "十分ぐらいですよ。",
      "駅で歩いてください。",
      "昨日、駅に着きました。",
    ],
    correctIndex: 0,
    explanation:
      "The prompt asks a duration; 「十分ぐらい」 gives the required information.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N3-quick-seat-occupied-check",
    level: "N3",
    family: "listening-quick-response",
    semanticFocus: "passenger asks whether adjacent seat is free",
    script: "すみません、ここ、どなたか座っていますか。",
    question: "最も適切な応答を選んでください。",
    options: [
      "ええ、座りません。",
      "いいえ、空いていますよ。",
      "ここには座りました。",
    ],
    correctIndex: 1,
    explanation:
      "「いいえ、空いていますよ」 correctly says nobody is using the seat and permits the person to sit.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
] as const satisfies readonly UpperListeningSeed[];

const n2TaskSeeds = [
  {
    semanticId: "N2-task-conference-abstract-reupload",
    level: "N2",
    family: "listening-task",
    semanticFocus:
      "conference presenter corrects abstract title and uploads replacement before requesting review",
    script:
      "女：学会の発表要旨、事務局からタイトルの英訳が登録内容と違うと連絡が来ました。男：本文は直さなくていいの？女：本文には問題ないそうです。まず英語のタイトルを登録画面と同じ表現に直して、ファイルを差し替えます。そのあと先生にも最終版を送って確認していただきます。男：締め切りは今日の五時だよね。女：ええ、ですからすぐ取りかかります。",
    question: "女の人は、まず何をしますか。",
    options: [
      "本文を書き直す",
      "英語のタイトルを直してファイルを差し替える",
      "先生に登録内容を決めてもらう",
      "事務局に締め切りを延ばしてもらう",
    ],
    correctIndex: 1,
    explanation:
      "Only the English title is inconsistent. She will correct it and replace the file before sending the final version to her professor.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N2-task-clinic-shift-cover-supervisor",
    level: "N2",
    family: "listening-task",
    semanticFocus:
      "clinic worker secures shift replacement before notifying supervisor",
    script:
      "男：来週火曜の午後、研修に出ることになって、診療所の受付に入れないんです。女：まず代わってくれる人を探して、決まったら主任に勤務変更の用紙を出すことになってますよ。男：鈴木さんが空いていると言っていました。女：まだ正式に頼んでいないなら、先に本人の了承を取ったほうがいいですね。主任への連絡はそのあとで大丈夫です。",
    question: "男の人は、まず何をすることになりましたか。",
    options: [
      "主任に勤務変更の用紙を出す",
      "研修の日程を変更する",
      "鈴木さんに交代を正式に頼む",
      "火曜の受付を閉める",
    ],
    correctIndex: 2,
    explanation:
      "He must first obtain Suzuki's agreement; the supervisor form follows once the substitute is confirmed.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N2-task-museum-label-date-proof",
    level: "N2",
    family: "listening-task",
    semanticFocus:
      "museum editor corrects one exhibit date and returns proof without redesign",
    script:
      "女：新しい展示の解説パネル、印刷会社から校正が届きました。男：写真の位置はどうですか。女：配置はこのままで問題ありません。ただ、三番の作品だけ制作年が図録と違っています。図録を確認して正しい年に直し、今日中に校正を返してください。デザイン担当に戻す必要はありません。男：では、年だけ修正して印刷会社へ送ります。",
    question: "男の人は、このあと何をしますか。",
    options: [
      "写真の位置を変える",
      "図録全体を作り直す",
      "制作年を確認して校正を返す",
      "デザイン担当にパネルを戻す",
    ],
    correctIndex: 2,
    explanation:
      "Layout is approved; he must verify and correct the one production year, then return the proof today.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N2-task-cancelled-flight-train-reservation",
    level: "N2",
    family: "listening-task",
    semanticFocus:
      "traveler reserves last feasible train before arranging flight refund",
    script:
      "男：今夜の便が欠航になったって。明日の午前の会議に間に合わないかもしれない。女：夜行バスは満席だけど、九時発の新幹線なら、乗り継げば今夜中に着けるみたい。残り二席だよ。航空券の払い戻しは明日でも手続きできるって。男：じゃあ、席がなくなる前に新幹線を取る。ホテルには予約できてから連絡するよ。",
    question: "男の人は、まず何をしますか。",
    options: [
      "航空券の払い戻しをする",
      "ホテルに到着時刻を連絡する",
      "夜行バスの空席を待つ",
      "新幹線を予約する",
    ],
    correctIndex: 3,
    explanation:
      "Only two train seats remain, so he prioritizes booking one; refund and hotel contact can follow.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N2-task-workshop-projector-adapter-test",
    level: "N2",
    family: "listening-task",
    semanticFocus:
      "workshop speaker borrows adapter and tests projector compatibility before copying handouts",
    script:
      "女：明日の講習会、資料はできましたか。男：はい。ただ、会場のプロジェクターは古い型で、私のパソコンを直接つなげないそうです。女：総務に変換アダプターがありますよ。配布資料のコピーは私がやっておきます。男：助かります。では、今日のうちにアダプターを借りて、実際に映るか会場で確かめます。",
    question: "男の人は、今日何をしますか。",
    options: [
      "配布資料をコピーする",
      "新しいパソコンを買う",
      "アダプターを借りて映像を確認する",
      "講習会の資料を書き直す",
    ],
    correctIndex: 2,
    explanation:
      "The woman handles copying. His action is to borrow the adapter and test the display in the venue.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N2-task-return-label-cover-old-barcode",
    level: "N2",
    family: "listening-task",
    semanticFocus:
      "online return requires covering old shipping barcode before attaching new label",
    script:
      "女：ネットで買った商品を返品したいんですが、届いた箱をそのまま使ってもいいですか。男：はい。ただし、箱についている古い配送ラベルのバーコードが見えないようにしてください。女：はがしたほうがいいですか。男：はがれにくければ、白い紙で完全に隠せば結構です。その上から、メールでお送りした返品用ラベルを貼ってください。",
    question: "女の人は、新しいラベルを貼る前に何をしますか。",
    options: [
      "新しい箱を用意する",
      "古いバーコードを見えなくする",
      "返品理由を箱に書く",
      "商品を別の袋に入れる",
    ],
    correctIndex: 1,
    explanation:
      "The old barcode must be removed or fully covered before the return label is attached.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N2-task-research-consent-version-reapproval",
    level: "N2",
    family: "listening-task",
    semanticFocus:
      "researcher submits revised consent form for approval before recruiting participants",
    script:
      "男：調査の参加者募集、予定どおり来週から始めてもいいですか。女：謝礼の渡し方を変えたので、同意書も修正しましたよね。男：はい、新しい説明を加えました。女：では、募集を始める前に、その版を審査担当へ提出して承認をもらってください。古い同意書で先に募集して、あとから説明するのは認められません。",
    question: "男の人は、参加者を募集する前に何をしなければなりませんか。",
    options: [
      "古い同意書を参加者に送る",
      "謝礼を先に全員へ渡す",
      "修正した同意書の承認を得る",
      "調査の日程を一週間遅らせる",
    ],
    correctIndex: 2,
    explanation:
      "The revised consent form must be approved before any recruitment; retroactive explanation is explicitly disallowed.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N2-task-evacuation-groups-route-cards",
    level: "N2",
    family: "listening-task",
    semanticFocus:
      "drill coordinator assigns groups before printing route cards",
    script:
      "女：避難訓練の参加者名簿はそろいました。次は経路カードを印刷すればいいですか。男：その前に、階ごとの人数が同じくらいになるよう、参加者を四つの班に分けてください。班が決まらないと、それぞれの集合場所をカードに入れられません。女：分かりました。班分けをして、あなたに確認してもらってから印刷します。",
    question: "女の人は、まず何をしますか。",
    options: [
      "経路カードを印刷する",
      "集合場所を変更する",
      "参加者を四つの班に分ける",
      "訓練の参加者を募集する",
    ],
    correctIndex: 2,
    explanation:
      "Group assignment determines the collection point printed on each card, so it necessarily comes first.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
] as const satisfies readonly UpperListeningSeed[];

const n2KeyPointSeeds = [
  {
    semanticId: "N2-key-editor-evidence-conclusion-gap",
    level: "N2",
    family: "listening-key-points",
    semanticFocus:
      "editor requests revision because evidence does not justify article conclusion",
    script:
      "女：原稿、具体例が多くて読みやすいです。ただ、最後に『この制度を全国に広げるべきだ』と結論づけていますが、紹介しているのは一つの町の半年間の結果だけですよね。男：例をもう一つ加えればいいでしょうか。女：それより、この資料から確実に言える範囲に結論を調整してください。制度に効果がないと言っているのではなく、根拠以上に一般化している点が問題なんです。",
    question: "女の人が、原稿の最も問題だと考えている点は何ですか。",
    options: [
      "具体例が多すぎること",
      "文章が読みにくいこと",
      "資料の範囲を超えた結論になっていること",
      "制度の効果を否定していること",
    ],
    correctIndex: 2,
    explanation:
      "Her objection is not to the examples or the policy itself, but to a national conclusion unsupported by one short local case.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N2-key-mentoring-exposes-assumptions",
    level: "N2",
    family: "listening-key-points",
    semanticFocus:
      "mentor values teaching because questions expose unexamined work assumptions",
    script:
      "男：新人の指導、ずいぶん時間を取られているようですね。女：確かに、自分でやったほうが早いと思うこともあります。でも、『なぜこの順番なんですか』と聞かれると、今まで習慣でやっていた作業を見直すきっかけになるんです。説明できない手順は、必要かどうか考え直すべきですから。男：教える側にも発見があるということですね。",
    question: "女の人は、新人を指導することのどんな点を評価していますか。",
    options: [
      "自分の仕事量がすぐ減る点",
      "仕事の習慣を見直せる点",
      "新人が質問をしなくなる点",
      "すべての手順を残せる点",
    ],
    correctIndex: 1,
    explanation:
      "Questions from the newcomer reveal habitual procedures she had not examined and prompt useful reevaluation.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N2-key-launch-support-capacity",
    level: "N2",
    family: "listening-key-points",
    semanticFocus:
      "software launch is delayed because customer support cannot absorb expected inquiries",
    script:
      "女：新サービス、開発は予定より早く終わったのに、公開を来月に延ばしたそうですね。男：機能には問題ないんです。ただ、試験利用者からの質問が予想以上に多くて、今の相談窓口の人数では一般公開後に対応しきれないと判断しました。女：宣伝が間に合わないからではないんですね。男：宣伝は準備済みです。まず問い合わせ体制を整えます。",
    question: "新サービスの公開を延ばした理由は何ですか。",
    options: [
      "機能に重大な問題があるから",
      "宣伝の準備が遅れているから",
      "相談窓口の対応力が足りないから",
      "試験利用者が少なすぎるから",
    ],
    correctIndex: 2,
    explanation:
      "Development and publicity are ready; expected support demand exceeds the current help desk's capacity.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N2-key-comparison-period-mismatch",
    level: "N2",
    family: "listening-key-points",
    semanticFocus:
      "professor rejects sales comparison because seasonal periods differ",
    script:
      "男：新しい広告を出してから売り上げが二割増えたので、広告の効果があったと書きました。女：比較しているのは今年の十二月と十一月ですね。十二月は毎年、贈り物の需要で売り上げが伸びる時期です。男：では、去年の十二月と比べるべきですか。女：ええ。広告以外の季節の影響を分けないと、この数字だけでは効果を判断できません。",
    question: "女の先生は、男の学生の分析の何が問題だと言っていますか。",
    options: [
      "売り上げの計算が間違っていること",
      "広告を出した日が不明なこと",
      "季節の違う月を単純に比べていること",
      "去年の広告費が高すぎること",
    ],
    correctIndex: 2,
    explanation:
      "November-to-December growth is confounded by seasonal demand; a same-month year-on-year comparison is needed.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N2-key-open-office-focus-space",
    level: "N2",
    family: "listening-key-points",
    semanticFocus:
      "open office succeeds socially but lacks spaces for concentrated individual work",
    script:
      "女：壁をなくした新しい事務所、部署を越えた相談は増えましたね。男：ええ、それは狙いどおりです。一方で、資料をじっくり読むときまで周りの会話が聞こえて、集中しにくいという声も出ています。女：以前の個室に戻すんですか。男：交流の良さは残しつつ、一人で静かに作業できる小部屋を増やすつもりです。",
    question: "新しい事務所について、男の人は何が課題だと考えていますか。",
    options: [
      "部署間の相談が減ったこと",
      "静かに集中できる場所が不足していること",
      "個室が多すぎて交流できないこと",
      "資料を読む社員がいないこと",
    ],
    correctIndex: 1,
    explanation:
      "Cross-department communication improved, but the office lacks sufficient quiet space for focused work.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N2-key-event-mobile-registration-barrier",
    level: "N2",
    family: "listening-key-points",
    semanticFocus:
      "community event attendance falls because phone-only registration excludes older residents",
    script:
      "男：今年の健康講座、内容は去年と同じなのに参加者が減りましたね。女：申し込みをスマートフォンだけにした影響が大きいと思います。電話で問い合わせた高齢の方に、家族に手伝ってもらうよう案内しましたが、そこであきらめた方もいたようです。男：宣伝の時期が遅かったからでは？女：案内は去年より早く出しています。次回は電話でも受け付けましょう。",
    question:
      "参加者が減った主な原因として、女の人が考えていることは何ですか。",
    options: [
      "講座の内容が変わらなかったこと",
      "案内を出す時期が遅かったこと",
      "申し込み方法が限られていたこと",
      "高齢者向けの内容ではなかったこと",
    ],
    correctIndex: 2,
    explanation:
      "Publicity was earlier, and the same content is not blamed; smartphone-only registration created the barrier.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N2-key-rental-short-term-unavailable",
    level: "N2",
    family: "listening-key-points",
    semanticFocus:
      "equipment rental becomes impractical because minimum term exceeds short project",
    script:
      "女：映像制作の機材、買うより借りたほうが安いんじゃないですか。男：私もそう思ったんですが、あの会社は最低三か月からなんです。今回使うのは来週の四日間だけですし、必要なレンズも料金に含まれていません。女：では、別の会社を探しますか。男：ええ。一日単位で必要な組み合わせを借りられる所を探します。",
    question: "男の人が、その会社から機材を借りない主な理由は何ですか。",
    options: [
      "機材の質が低いから",
      "借りられる期間が用途に合わないから",
      "会社が遠すぎるから",
      "映像制作を中止したから",
    ],
    correctIndex: 1,
    explanation:
      "A three-month minimum is unsuitable for a four-day need; the missing lens reinforces, but does not replace, that main reason.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N2-key-lunch-change-afternoon-energy",
    level: "N2",
    family: "listening-key-points",
    semanticFocus:
      "employee changes lunch size to avoid afternoon sleepiness rather than lose weight",
    script:
      "男：最近、昼は軽いものにしていますね。ダイエットですか。女：体重を減らしたいわけではないんです。以前は昼にたくさん食べて、三時ごろ眠くなり、仕事が進まなくて。今は昼を少なめにして、夕方に果物を食べるようにしたら、集中が続くようになりました。男：午後の働き方に合わせたんですね。",
    question: "女の人が昼食を変えた目的は何ですか。",
    options: [
      "体重を減らすため",
      "食費を安くするため",
      "午後も集中して働くため",
      "夕食を食べないため",
    ],
    correctIndex: 2,
    explanation:
      "She denies dieting and says the lighter lunch prevents afternoon sleepiness and preserves concentration.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
] as const satisfies readonly UpperListeningSeed[];

const n2OutlineSeeds = [
  {
    semanticId: "N2-outline-failure-reports-learning",
    level: "N2",
    family: "listening-outline",
    semanticFocus:
      "organization redesigns failure reports to capture decisions and lessons rather than assign blame",
    script:
      "男：失敗の報告書というと、だれが間違えたかを明らかにするものだと思われがちです。しかし、それだけでは同じ問題を防げません。結果が悪かったと分かったあとなら、判断を批判するのは簡単です。必要なのは、その時点でどんな情報があり、なぜその選択が合理的に見えたのかを記録することです。個人の責任を探すより、判断の条件を共有するほうが、組織全体の学びにつながります。",
    question: "男の人が最も言いたいことは何ですか。",
    options: [
      "失敗した個人をすぐ公表すべきだ",
      "報告書では当時の判断条件を共有すべきだ",
      "結果が悪ければ判断の理由は不要だ",
      "報告書そのものを廃止すべきだ",
    ],
    correctIndex: 1,
    explanation:
      "The central contrast is blame versus documenting the information and reasoning available at the time so the organization can learn.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N2-outline-public-dashboard-context",
    level: "N2",
    family: "listening-outline",
    semanticFocus:
      "public data dashboard needs definitions and context to prevent misleading comparisons",
    script:
      "女：行政の情報をグラフで公開すれば、透明性が高まると思われています。確かに、数字を見られることは重要です。しかし、同じ『待ち時間』でも、受付から診察までなのか、予約から診察までなのかで意味が違います。定義や調査方法を示さずに順位だけを並べると、かえって誤解を招きます。データの公開には、その数字がどのように作られたかという説明も必要です。",
    question: "女の人の主張に最も近いものはどれですか。",
    options: [
      "行政の数字は公開しないほうがよい",
      "グラフは文章より必ず正確だ",
      "数字とともに定義や調査方法も示す必要がある",
      "待ち時間はすべて同じ方法で測られている",
    ],
    correctIndex: 2,
    explanation:
      "She supports transparency but argues that definitions and collection methods are essential context for interpreting data.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N2-outline-efficiency-idle-capacity",
    level: "N2",
    family: "listening-outline",
    semanticFocus:
      "apparent idle capacity can be a resilience resource rather than waste",
    script:
      "男：機械や人が常に百パーセント動いている状態は、効率がよいように見えます。ところが、急な注文や故障が起きると、余裕がないため全体が止まりやすくなります。普段は使われていない時間や設備を、単なる無駄と考えてはいけません。それは変化に対応するための余力でもあります。短期的な利用率だけで効率を判断すると、長期的には大きな損失を招くことがあります。",
    question: "男の人は、何を指摘していますか。",
    options: [
      "すべての設備を常に動かすべきだ",
      "使われない時間は必ず無駄になる",
      "余裕を持つことが変化への対応力になる",
      "急な注文は受けないほうがよい",
    ],
    correctIndex: 2,
    explanation:
      "The talk reframes unused capacity as resilience that can prevent larger disruption when unexpected events occur.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N2-outline-tourism-resident-life",
    level: "N2",
    family: "listening-outline",
    semanticFocus:
      "tourism policy must preserve resident services to remain sustainable",
    script:
      "女：観光客が増えると、地域にお金が入り、店や交通が活発になります。一方、短期宿泊施設が増えすぎて住宅が不足したり、住民が使っていた店が観光客向けに変わったりすることもあります。観光の成功を訪問者数だけで測るのは十分ではありません。住民が暮らし続けられる環境を守ってこそ、訪れる人にも魅力のある地域が長く保たれるのです。",
    question: "女の人が最も伝えたいことは何ですか。",
    options: [
      "観光客の数だけを増やすべきだ",
      "住民の生活を守ることが持続的な観光につながる",
      "観光による経済効果は存在しない",
      "住民向けの店をすべて観光用に変えるべきだ",
    ],
    correctIndex: 1,
    explanation:
      "She acknowledges tourism benefits but makes resident livability a condition of a durable, attractive destination.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N2-outline-translation-function-fidelity",
    level: "N2",
    family: "listening-outline",
    semanticFocus:
      "translation fidelity depends on preserving communicative function, not word order",
    script:
      "男：原文に忠実な翻訳とは、単語を同じ順番で置き換えることではありません。例えば、ある言語で丁寧さを示す表現をそのまま移すと、別の言語では冷たく聞こえることがあります。読み手に与える働きを保つためには、形を変えなければならない場合もあります。何を変えず、何を変えるかを決めるには、言葉だけでなく、場面や話し手の関係を理解する必要があります。",
    question: "男の人の考えに最も近いものはどれですか。",
    options: [
      "翻訳では原文の語順を必ず守るべきだ",
      "丁寧な表現はどの言語でも同じ印象になる",
      "場面を考えて表現の働きを保つことが大切だ",
      "形を変えた翻訳はすべて不正確だ",
    ],
    correctIndex: 2,
    explanation:
      "He defines fidelity by communicative effect in context, which may require changing surface form.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N2-outline-renewable-energy-local-ownership",
    level: "N2",
    family: "listening-outline",
    semanticFocus:
      "renewable project acceptance improves when residents share decisions and benefits",
    script:
      "女：再生可能エネルギーの設備は、環境に良いという理由だけでは地域に受け入れられません。景色や騒音への不安があるのに、計画を外部の会社だけで決め、利益も地域に残らなければ、反対が起こるのは当然です。初めから住民が場所や規模の決定に参加し、収益の一部を地域のサービスに使える仕組みにすると、設備を自分たちのものとして考えやすくなります。",
    question:
      "女の人は、再生可能エネルギーの計画で何が重要だと言っていますか。",
    options: [
      "外部企業だけで早く決めること",
      "住民が意思決定と利益に関われること",
      "設備の環境効果を説明しないこと",
      "景色への影響を無視すること",
    ],
    correctIndex: 1,
    explanation:
      "Her proposed solution is local participation in siting and scale plus locally shared benefits.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N2-outline-meeting-silence-structure",
    level: "N2",
    family: "listening-outline",
    semanticFocus:
      "meeting silence reflects discussion design rather than lack of ideas",
    script:
      "男：会議で意見が出ないと、参加者に考えがないと思ってしまいがちです。しかし、資料をその場で初めて配り、上司が先に結論を述べれば、異なる意見をすぐ言える人は限られます。会議の前に論点を伝え、まず少人数で話す時間を作ると、発言は増えます。沈黙を個人の性格の問題にせず、意見を出しやすい手順になっているかを見るべきです。",
    question: "男の人の主張は何ですか。",
    options: [
      "会議で黙る人には考えがない",
      "上司が最初に結論を言うべきだ",
      "発言を促すには会議の進め方を工夫すべきだ",
      "資料は会議中に初めて配るべきだ",
    ],
    correctIndex: 2,
    explanation:
      "The speaker attributes silence to meeting structure and recommends advance topics and small-group discussion.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N2-outline-museum-digitization-selection",
    level: "N2",
    family: "listening-outline",
    semanticFocus:
      "museum digitization increases access but curatorial selection still shapes what audiences see",
    script:
      "女：作品をデジタル化すれば、遠くにいる人も見られ、保存のため展示できない資料も紹介できます。ただし、何を撮影し、どんな順番で検索結果に出すかは人が決めます。画面上にあるものが収蔵品のすべてだと思われると、選ばれなかった作品は存在しないのと同じになってしまいます。公開を増やすだけでなく、選び方と限界を説明することも博物館の責任です。",
    question: "女の人が最も言いたいことは何ですか。",
    options: [
      "デジタル化すれば選択の問題はなくなる",
      "博物館は実物の展示をやめるべきだ",
      "デジタル公開では選び方や限界も示す必要がある",
      "検索結果は自動なので人の判断と無関係だ",
    ],
    correctIndex: 2,
    explanation:
      "She values access but stresses that human selection remains and should be made visible rather than mistaken for completeness.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
] as const satisfies readonly UpperListeningSeed[];

const n2QuickResponseSeeds = [
  {
    semanticId: "N2-quick-proposal-review-by-noon",
    level: "N2",
    family: "listening-quick-response",
    semanticFocus: "manager asks for proposal review by noon",
    script: "この提案書、昼までに目を通してもらえないかな。",
    question: "最も適切な応答を選んでください。",
    options: [
      "承知しました。気になる点に印をつけておきます。",
      "昼は提案しないことになりました。",
      "目を通したかもしれません。",
    ],
    correctIndex: 0,
    explanation:
      "The response accepts the request and states a relevant review action.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N2-quick-training-schedule-conflict",
    level: "N2",
    family: "listening-quick-response",
    semanticFocus:
      "employee is invited to training during a fixed client visit",
    script: "来週の研修、火曜日なら参加できますよね。",
    question: "最も適切な応答を選んでください。",
    options: [
      "研修には参加したそうです。",
      "その日は客先なので、別の日程があるか確認します。",
      "火曜日に参加していただきました。",
    ],
    correctIndex: 1,
    explanation:
      "The speaker's assumption is corrected politely, and the respondent proposes checking an alternative date.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N2-quick-explanation-still-unclear",
    level: "N2",
    family: "listening-quick-response",
    semanticFocus: "listener admits one part of an explanation remains unclear",
    script: "今の説明で、だいたい分かってもらえましたか。",
    question: "最も適切な応答を選んでください。",
    options: [
      "全体は分かりましたが、最後の条件だけもう一度お願いします。",
      "説明したことはありません。",
      "だいたい説明しておきました。",
    ],
    correctIndex: 0,
    explanation:
      "It directly answers the comprehension check while requesting clarification of the remaining uncertainty.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N2-quick-shift-swap-reciprocity",
    level: "N2",
    family: "listening-quick-response",
    semanticFocus: "coworker asks for weekend shift swap",
    script: "悪いんだけど、今度の日曜、勤務を代わってもらえない？",
    question: "最も適切な応答を選んでください。",
    options: [
      "日曜日なら休みませんでした。",
      "予定を確認して、今日中に返事するね。",
      "勤務は代わったほうがよかった。",
    ],
    correctIndex: 1,
    explanation:
      "The reply neither overcommits nor ignores the request; it promises a timely answer after checking availability.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N2-quick-numbers-different-basis",
    level: "N2",
    family: "listening-quick-response",
    semanticFocus:
      "colleague proposes comparing figures that may use different definitions",
    script: "去年の数字と並べれば、変化が分かりやすいんじゃない？",
    question: "最も適切な応答を選んでください。",
    options: [
      "そうですね。集計方法が同じか確かめてから載せましょう。",
      "去年は数字を並べません。",
      "変化が分からなかったそうです。",
    ],
    correctIndex: 0,
    explanation:
      "The response accepts the useful comparison while prudently checking that the figures are comparable.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N2-quick-room-booking-mistake",
    level: "N2",
    family: "listening-quick-response",
    semanticFocus: "meeting room appears unreserved despite colleague's claim",
    script: "会議室、予約しておいてくれたんだよね。",
    question: "最も適切な応答を選んでください。",
    options: [
      "すみません、登録できていないようなので、すぐ空きを確認します。",
      "予約してくれたんですね。",
      "会議室は予約されていましたか。",
    ],
    correctIndex: 0,
    explanation:
      "It acknowledges the booking failure, apologizes, and states an immediate corrective action.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N2-quick-submission-delay-warning",
    level: "N2",
    family: "listening-quick-response",
    semanticFocus:
      "supervisor warns that a late submission will delay the schedule",
    script: "今日中に出ないと、そのあとの作業が全部ずれ込むんだけど。",
    question: "最も適切な応答を選んでください。",
    options: [
      "作業はずれ込んでいませんでした。",
      "優先して仕上げ、四時までに一度お見せします。",
      "今日中に出してもらえますか。",
    ],
    correctIndex: 1,
    explanation:
      "The reply recognizes urgency and commits to a concrete checkpoint before the deadline.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N2-quick-delegation-junior-readiness",
    level: "N2",
    family: "listening-quick-response",
    semanticFocus:
      "manager asks whether junior employee can own client briefing",
    script: "次の顧客説明、田中さんに任せてみても大丈夫そう？",
    question: "最も適切な応答を選んでください。",
    options: [
      "資料は作れています。事前に練習すれば任せられると思います。",
      "田中さんが顧客を任せたそうです。",
      "説明は大丈夫ではありませんでした。",
    ],
    correctIndex: 0,
    explanation:
      "It gives a balanced readiness assessment and a concrete condition for delegating the task.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
] as const satisfies readonly UpperListeningSeed[];

const n2IntegratedSeeds = [
  {
    semanticId: "N2-integrated-library-evening-hours-pilot",
    level: "N2",
    family: "listening-integrated",
    semanticFocus:
      "library adopts two-night evening-hours pilot after balancing demand and staffing",
    script:
      "ナレーション：市立図書館の開館時間について、検討会が開かれています。まず調査担当者が説明します。調査担当：先月のアンケートでは、回答者の六割が『仕事や学校のあとにも利用したい』と答えました。ただし、希望する曜日は火曜と木曜に集中しています。土日は現在の午後六時までで十分という回答が多く、毎日延長してほしいという人は一割ほどでした。ナレーション：次に、図書館員が話します。図書館員：夜九時まで毎日開けるには、受付と警備の人員が足りません。けれども週二日なら、昼の勤務を組み替えることで、追加の採用をせずに試せます。ただ、返却だけなら入口の箱が二十四時間使えることも、もっと知らせるべきです。ナレーション：利用者代表が意見を述べます。利用者代表：資格の勉強をしている会社員には、静かな場所を夜使えることが重要です。一方、延長しても利用者が少なければ続けられません。まず曜日を限って始め、入館者数を見てはどうでしょうか。ナレーション：三人の意見を聞き、委員長がまとめます。委員長：では、来月から三か月、火曜と木曜だけ午後九時まで開館します。同時に夜間返却の案内も増やし、期間中の利用者数と費用を確認して、その後を決めましょう。",
    question: "図書館は、まずどのように開館時間を変更することになりましたか。",
    options: [
      "毎日、午後九時まで延長する",
      "火曜と木曜だけ、三か月間午後九時まで延長する",
      "土日だけ、午後九時まで延長する",
      "開館時間は変えず、返却箱だけを増やす",
    ],
    correctIndex: 1,
    explanation:
      "Demand clusters on Tuesday and Thursday, and staffing can support only a limited trial; the chair explicitly selects a three-month two-night pilot.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
    sourceCount: 4,
  },
  {
    semanticId: "N2-integrated-lecture-recording-bounded-access",
    level: "N2",
    family: "listening-integrated",
    semanticFocus:
      "university records lectures with delayed limited access and protected discussion segments",
    script:
      "ナレーション：大学で、授業を録画して学生に公開する方針について話し合っています。支援室の職員が話します。支援室職員：病気や障害で教室に来られない学生にとって、録画は学習を続ける大切な手段です。字幕があれば、聞き取りに困難のある学生にも役立ちます。ただ、全授業を永久に公開する必要はなく、履修者だけが一定期間見られれば目的は達成できます。ナレーション：教員が意見を述べます。教員：講義部分の録画には賛成ですが、学生同士の討論まで残ると、間違いを恐れて発言が減る心配があります。また、録画があるから出席しなくていいと思われるのも困ります。欠席者だけに許可する方法は、確認作業が増えすぎます。ナレーション：学生代表が話します。学生代表：復習にも使えるので、出席した学生にも見せてほしいです。ただ、討論の前に録画を止めることや、公開を試験期間までに限ることには賛成です。授業直後に全部見られると出席が減るなら、二日後に公開する方法もあります。ナレーション：教育担当の副学長がまとめます。副学長：来学期は、講義部分のみ録画し、二日後から履修者全員に公開します。字幕を付け、公開は学期末までとします。討論は原則録画せず、この条件で出席率と学習効果を調べましょう。",
    question: "来学期、授業の録画はどのように扱われることになりましたか。",
    options: [
      "討論を含む全授業を当日から一般公開する",
      "欠席した学生だけに永久に公開する",
      "講義部分を二日後から履修者に学期末まで公開する",
      "録画せず、字幕つき資料だけを配る",
    ],
    correctIndex: 2,
    explanation:
      "The decision combines access with participation safeguards: lecture only, delayed two days, enrolled students only, through term end.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
    sourceCount: 4,
  },
  {
    semanticId: "N2-integrated-community-shuttle-hospital-market-loop",
    level: "N2",
    family: "listening-integrated",
    semanticFocus:
      "community shuttle pilots a morning hospital-market loop rather than duplicating commuter buses",
    script:
      "ナレーション：郊外地区の新しい乗り合いバスについて、担当者が意見を聞いています。交通調査員が結果を説明します。交通調査員：住民の移動記録を見ると、朝の通勤時間には既存の路線バスが利用されています。不便が大きいのは、九時から正午までの病院と商店街への移動です。特に車を運転しない高齢者から要望が多く出ています。ナレーション：病院の職員が話します。病院職員：予約は九時半から十一時に集中しています。帰りに薬局や買い物へ寄りたい患者も多いので、病院だけを往復する便より、商店街を通る経路が便利でしょう。ただし診察時間は人によって違うため、一日に一本では帰れない人が出ます。ナレーション：自治会の代表が話します。自治会代表：夕方は学生も使える便がほしいという声があります。しかし限られた予算で最初から一日中走らせ、空のバスが増えるのは避けたいです。まず一番困っている時間帯で需要を確かめてから広げるべきです。ナレーション：担当者が結論を述べます。担当者：では、六か月の試験として、平日の午前中に地区、病院、商店街を一周する便を二本運行します。夕方便は今回は設けません。利用記録と予約の時間を調べ、次年度の経路を検討します。",
    question: "新しい乗り合いバスは、試験期間中どのように運行されますか。",
    options: [
      "平日の朝夕に駅と学校を往復する",
      "毎日一日中、病院だけを往復する",
      "平日の午前に地区・病院・商店街を二便で回る",
      "週末の午後に商店街と駅を一便で結ぶ",
    ],
    correctIndex: 2,
    explanation:
      "Evidence points to unmet late-morning medical and shopping trips, leading to two weekday-morning loop services for six months.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
    sourceCount: 4,
  },
  {
    semanticId: "N2-integrated-hybrid-onboarding-anchor-days",
    level: "N2",
    family: "listening-integrated",
    semanticFocus:
      "hybrid company uses first-month anchor days and named buddies instead of full office return",
    script:
      "ナレーション：在宅勤務が中心の会社で、新入社員の研修方法を見直しています。人事担当者が話します。人事担当：オンライン教材の理解度テストは良い結果ですが、新入社員への調査では、『だれに小さな質問をすればよいか分からない』という回答が多くありました。全員を毎日出社させれば解決するかもしれませんが、遠方に住む社員も採用したという方針と合いません。ナレーション：現場の課長が話します。課長：部署ごとに出社日が違うので、新入社員が来ても指導役がいないことがあります。最初の一か月だけ、火曜から木曜を共通の出社日にし、実際の仕事を一緒に行うのがよいと思います。ただし金曜まで出社させる必要はありません。ナレーション：入社半年の社員が話します。若手社員：私が困ったのは、研修後に質問する相手が毎回変わったことです。一人の先輩を相談相手として決め、在宅の日も短く連絡できる時間があると安心します。大人数のオンライン交流会より、同じ人に続けて相談できるほうが助かります。ナレーション：部長がまとめます。部長：では、新入社員は最初の一か月、火・水・木を共通出社日とします。加えて一人ずつ相談役を決め、在宅日には毎朝十五分、質問できる時間を設けます。二か月目からは通常の勤務に戻しましょう。",
    question: "会社は、新入社員の研修をどのように変えることにしましたか。",
    options: [
      "最初の一年間は全員を毎日出社させる",
      "研修をすべて録画教材だけにする",
      "最初の一か月に共通出社日と決まった相談役を設ける",
      "部署ごとに異なる出社日をさらに増やす",
    ],
    correctIndex: 2,
    explanation:
      "The solution addresses both in-person coordination and continuity of questions without abandoning hybrid work.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
    sourceCount: 4,
  },
  {
    semanticId: "N2-integrated-museum-layered-labels",
    level: "N2",
    family: "listening-integrated",
    semanticFocus:
      "museum adopts short core labels plus optional QR depth after visitor testing",
    script:
      "ナレーション：美術館で、作品の横に置く解説文について検討しています。学芸員が話します。学芸員：作品の背景を正確に伝えようとすると、どうしても専門用語や長い説明が必要になります。短くしすぎると、作者がその材料を選んだ理由や当時の社会状況が伝わりません。ナレーション：教育担当者が報告します。教育担当：来館者調査では、二百字を超える解説は途中で読むのをやめる人が多い一方、『もっと知りたいときの情報がない』という不満もありました。試しに、八十字の要点と、詳しい説明を読める二次元コードを用意したところ、立ち止まる人も詳しいページを見る人も増えました。ナレーション：視覚に障害のある利用者を支援する職員が話します。支援職員：コードだけに情報を移すと、機器を使えない人が困ります。作品名、重要な背景、鑑賞の手がかりは、読みやすい大きさで会場にも残してください。詳しい文章には音声版も必要です。ナレーション：館長が結論を述べます。館長：基本の解説は会場に短く分かりやすく表示し、詳しい背景はコード先の文章と音声で提供します。すべてを短くするのでも、長い解説をそのまま残すのでもなく、情報を段階に分けましょう。",
    question: "美術館は、作品の解説をどのようにすることになりましたか。",
    options: [
      "会場の解説をすべてなくし、コードだけにする",
      "長い専門的な解説だけを会場に残す",
      "短い基本解説を会場に置き、詳しい情報を別にも用意する",
      "作品名以外の情報は一切示さない",
    ],
    correctIndex: 2,
    explanation:
      "The final layered design preserves accessible essential information in the gallery while offering optional detailed text and audio.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
    sourceCount: 4,
  },
  {
    semanticId: "N2-integrated-cafeteria-small-default-seconds",
    level: "N2",
    family: "listening-integrated",
    semanticFocus:
      "cafeteria reduces plate waste with smaller defaults and free seconds supported by measurement",
    script:
      "ナレーション：社員食堂で、食べ残しを減らす方法について話し合っています。調査担当者が報告します。調査担当：一週間、料理別に残った量を量ったところ、ご飯と付け合わせの野菜が特に多く捨てられていました。売れ残った料理より、皿に盛られたあとに残る量のほうが多いです。利用者アンケートでは、昼食時間が短く、標準の量を食べ切れないという回答が目立ちました。ナレーション：料理長が話します。料理長：予約制にすれば作る量は調整できますが、今回多いのは提供後の残りです。最初から全員分を減らすと、体を使う仕事の人には足りません。ご飯と野菜を少なめに盛り、足りない人は無料で追加できるようにしてはどうでしょう。ナレーション：社員代表が意見を述べます。社員代表：注文のたびに『少なめ』と言うのは気を使いますが、最初が少なめで、自由に追加できるなら選びやすいです。ただ、追加の場所が遠いと利用されないので、受け取り口の近くにしてください。ナレーション：食堂長がまとめます。食堂長：来月、ご飯と付け合わせは少なめを標準にし、受け取り口で無料の追加を用意します。残った量と追加回数を毎日記録し、一か月後に量を調整しましょう。",
    question: "社員食堂は、食べ残しを減らすために何を試すことになりましたか。",
    options: [
      "すべての料理を予約制にする",
      "料理の販売数を半分にする",
      "標準量を少なめにし、希望者には追加を出す",
      "付け合わせの野菜をなくす",
    ],
    correctIndex: 2,
    explanation:
      "The measured problem is plate waste, so the chosen trial changes default portions while preserving adequate intake through free seconds.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
    sourceCount: 4,
  },
  {
    semanticId: "N2-integrated-park-targeted-lighting-sensors",
    level: "N2",
    family: "listening-integrated",
    semanticFocus:
      "park lights only main routes with shielded sensor fixtures to balance safety and ecology",
    script:
      "ナレーション：夜の公園の照明について、住民説明会が開かれています。近隣住民が話します。住民：駅から住宅地へ抜ける道は、夜八時ごろも多くの人が通りますが、木の陰が暗く、足元が見えません。公園全体を昼のように明るくしてほしいわけではなく、通路だけ安心して歩けるようにしてほしいです。ナレーション：自然環境の専門家が話します。専門家：池や林を一晩中照らすと、昆虫や鳥の行動に影響します。特に上や横へ広がる光を避け、必要な場所だけ下向きに照らすべきです。人がいない時間は弱くするセンサーも有効です。ナレーション：防犯担当者が話します。防犯担当：明るさだけで安全が決まるわけではありません。曲がり角の植物を低くして見通しを良くし、利用の多い道を明確にすることも重要です。すべての小道を照らすより、人を主要な経路に導くほうが管理もしやすくなります。ナレーション：市の担当者が結論を述べます。市担当者：駅と住宅地を結ぶ二本の主要通路に、下向きで人感センサー付きの照明を設置します。池と林の小道には設置せず、曲がり角の植物を整えます。半年後に利用者と生き物への影響を確認します。",
    question: "市は、公園の照明をどのように整備することにしましたか。",
    options: [
      "公園全体を一晩中強く照らす",
      "池と林だけに照明を増やす",
      "主要通路に限定してセンサー付き照明を置く",
      "照明を設置せず、公園を夜間閉鎖する",
    ],
    correctIndex: 2,
    explanation:
      "The selected plan limits shielded, sensor-controlled lighting to two main routes and combines it with vegetation changes.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
    sourceCount: 4,
  },
  {
    semanticId: "N2-integrated-market-cashless-shared-terminals",
    level: "N2",
    family: "listening-integrated",
    semanticFocus:
      "street market adds shared cashless terminals while retaining cash and optional vendor participation",
    script:
      "ナレーション：週末市場で、電子決済を導入するか話し合っています。若い出店者が話します。出店者：観光客からカードで払えないかよく聞かれます。自分の店では端末を入れましたが、月に数回しか出店しない人が一台ずつ契約するのは費用が高いでしょう。市場全体で貸し出せる端末があれば便利です。ナレーション：長く出店している農家が話します。農家：現金に慣れたお客様も多く、通信が切れたときもあります。電子決済だけにするのは反対です。また、操作に不安があるので、導入を義務にされると出店を続けられない人が出ます。ナレーション：会計担当者が説明します。会計担当：主催者名義で共通端末を六台契約し、希望する店に一日単位で貸せます。手数料は利用した売り上げに応じて負担してもらい、操作研修も行います。店ごとの売り上げは端末内で分けて記録できます。ナレーション：市場の代表がまとめます。市場代表：現金払いはこれまでどおり残します。その上で共通端末を試験的に用意し、使いたい店だけが借りられるようにします。三か月後、利用額と出店者の負担を確認して台数を見直しましょう。",
    question: "週末市場では、電子決済をどのように導入することになりましたか。",
    options: [
      "全店舗に個別端末の契約を義務づける",
      "現金を廃止して電子決済だけにする",
      "共通端末を希望店に貸し、現金も残す",
      "観光客だけに電子決済を認める",
    ],
    correctIndex: 2,
    explanation:
      "The compromise creates optional shared terminals for cost control while retaining cash and avoiding mandatory adoption.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
    sourceCount: 4,
  },
] as const satisfies readonly UpperListeningSeed[];

const n1TaskSeeds = [
  {
    semanticId: "N1-task-committee-conflict-recusal",
    level: "N1",
    family: "listening-task",
    semanticFocus:
      "committee member discloses financial conflict and withdraws before proposal review",
    script:
      "女：来週の助成金審査ですが、応募企業の一社から、以前、研究費を受けていたことに気づきました。契約は二年前に終わっています。男：利害関係の有無は事務局が判断しますから、まず所定の申告書に関係と終了時期を書いて提出してください。女：審査資料には目を通してもいいでしょうか。男：判断が出るまでは、その企業の資料にはアクセスせず、該当案件の協議からも外れてください。ほかの案件は通常どおり担当できます。",
    question: "女の人は、まず何をしなければなりませんか。",
    options: [
      "応募企業に契約終了を確認する",
      "すべての審査業務を辞退する",
      "利害関係を申告して該当資料を見ない",
      "該当企業の提案を先に評価する",
    ],
    correctIndex: 2,
    explanation:
      "She must disclose the prior funding and avoid the affected materials and deliberation pending the office's determination; unrelated reviews continue.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N1-task-newspaper-correction-record",
    level: "N1",
    family: "listening-task",
    semanticFocus:
      "editor verifies source record then publishes transparent correction without silently replacing article",
    script:
      "男：昨日の記事で、市の予算額の桁を一つ間違えて掲載したようです。ウェブ版だけなら数字を直せば済みますか。女：まず元資料と取材メモを照合し、正しい額を確定してください。そのうえで本文を修正し、末尾に訂正日時と変更内容を明記します。何も説明せず差し替えるのは避けましょう。紙面については、確認が取れ次第、明日の訂正欄に載せます。",
    question: "男の人は、最初に何をしますか。",
    options: [
      "ウェブ記事を説明なしで差し替える",
      "元資料と取材メモで正しい額を確認する",
      "明日の紙面だけに訂正を出す",
      "市に記事の削除を依頼する",
    ],
    correctIndex: 1,
    explanation:
      "Verification precedes both the transparent web correction and the print correction notice.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N1-task-disaster-report-crosscheck-channel",
    level: "N1",
    family: "listening-task",
    semanticFocus:
      "emergency coordinator cross-checks unverified shelter shortage before posting through official channel",
    script:
      "女：北地区の避難所で水が尽きたという投稿が広がっています。至急、共有したほうがいいでしょうか。男：発信元が個人の匿名アカウントなので、そのまま転載しないでください。避難所の責任者と物資班の両方に連絡し、在庫と配送状況を照合しましょう。女：不足が確認できたら、私のアカウントから知らせますか。男：いいえ。対策本部の公式欄に、確認時刻と対応予定を添えて掲載してください。",
    question: "女の人は、まず何をしますか。",
    options: [
      "匿名投稿を直ちに転載する",
      "自分のアカウントで不足を知らせる",
      "二つの担当先に在庫と配送状況を確認する",
      "避難所への配送を独断で中止する",
    ],
    correctIndex: 2,
    explanation:
      "The claim must first be independently cross-checked with both the shelter and logistics team before an official, time-stamped update.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N1-task-grant-budget-eligible-quote",
    level: "N1",
    family: "listening-task",
    semanticFocus:
      "grant applicant confirms equipment eligibility before obtaining revised comparable quotation",
    script:
      "男：助成金の予算案ですが、分析装置を消耗品として計上してしまいました。見積額自体は上限内です。女：装置は備品扱いなので、今回の公募で購入対象になるか要項だけでは判断できません。まず事務局に型番と用途を伝えて、対象経費か文書で確認してください。認められた場合は、備品の区分に直し、保守費を分けた見積書を取り直します。男：先に別会社の見積もりも集めますか。女：対象外なら無駄になるので、確認が先です。",
    question: "男の人は、まず何をすべきですか。",
    options: [
      "別会社の見積書を複数集める",
      "装置を消耗品のまま申請する",
      "事務局に装置が対象経費か文書で確認する",
      "保守費を予算からすべて削る",
    ],
    correctIndex: 2,
    explanation:
      "Eligibility determines whether revised quotations are worth obtaining, so written confirmation from the grant office comes first.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N1-task-hospital-data-deidentify-approval",
    level: "N1",
    family: "listening-task",
    semanticFocus:
      "clinical researcher finalizes de-identification specification and obtains approval before data export",
    script:
      "女：共同研究先に診療データを渡す準備ができました。氏名と患者番号は削除してあります。男：入院日と珍しい病名の組み合わせから個人が推測される可能性があります。倫理審査で承認された匿名化手順には、日付を月単位にまとめることも含まれていましたね。女：では、その加工をして送ります。男：まだ送らないでください。加工後の項目一覧を情報管理室に確認してもらい、承認記録を残してから、指定の転送環境に置きます。",
    question: "女の人は、データを共同研究先へ渡す前に何をしますか。",
    options: [
      "氏名だけを戻して本人に確認する",
      "日付を加工し、項目一覧について情報管理室の承認を得る",
      "通常のメールにデータを添付する",
      "珍しい病名の患者をすべて研究から除く",
    ],
    correctIndex: 1,
    explanation:
      "Removing direct identifiers is insufficient; she must apply the approved date aggregation and obtain recorded information-governance approval before transfer.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N1-task-symposium-interpreter-cancellation",
    level: "N1",
    family: "listening-task",
    semanticFocus:
      "symposium organizer confirms replacement interpreter subject expertise before changing public program",
    script:
      "男：午後の討論を担当する通訳者が体調不良で来られなくなりました。ウェブの予定を『日本語のみ』に変えましょうか。女：登録者には英語話者も多いので、それは最後の手段です。まず契約会社に、同時通訳ができ、今回の医療政策の用語に対応できる代替者がいるか確認してください。単に空いている人では困ります。男：見つかったらすぐ予定表を更新します。女：経歴を座長に確認してもらってから、変更を案内してください。",
    question: "男の人は、まず何をしますか。",
    options: [
      "討論を日本語だけに変更する",
      "登録者に中止を通知する",
      "専門分野に対応できる代替通訳者を会社に確認する",
      "座長を別の人に変える",
    ],
    correctIndex: 2,
    explanation:
      "He must first locate a qualified replacement with both simultaneous-interpreting and subject expertise; schedule updates follow chair approval.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N1-task-restoration-damage-suspend-document",
    level: "N1",
    family: "listening-task",
    semanticFocus:
      "restorer halts treatment and documents unexpected pigment lifting before consulting specialist",
    script:
      "女：壁画の表面を試験的に洗浄したところ、予定していた濃度でも顔料がわずかに布へ移りました。範囲は数ミリです。男：小さいからといって条件を弱めて続けないでください。作業を止め、処置前後の写真、使用液、接触時間を記録してください。その記録を保存担当と材料の専門家に送り、別の方法を検討します。女：乾くまで待って、同じ場所をもう一度試すのは？男：原因が分かるまでは追加の試験もしません。",
    question: "女の人は、このあとまず何をしますか。",
    options: [
      "液を薄めて洗浄を続ける",
      "同じ場所で追加試験をする",
      "作業を中止して条件と変化を記録する",
      "顔料が移った布を捨てる",
    ],
    correctIndex: 2,
    explanation:
      "Unexpected pigment transfer triggers a stop-and-document protocol; no further testing occurs until specialist review.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N1-task-product-recall-lot-freeze",
    level: "N1",
    family: "listening-task",
    semanticFocus:
      "manufacturer freezes implicated and adjacent lots before tracing distribution and notifying customers",
    script:
      "男：検査で一つの製造番号から基準を超える成分が出ました。該当番号だけ出荷を止めればいいですか。女：原因が特定できていないので、同じ設備で前後に作った二つの番号も倉庫で隔離してください。まず在庫システム上で出荷不可にし、現物の位置を確認します。その後、流通先を追跡して、品質保証部が回収範囲を決め次第、取引先へ通知します。男：原因調査と並行して、三つの番号を止めるんですね。",
    question: "男の人は、最初に何をしますか。",
    options: [
      "該当商品をすべて廃棄する",
      "一つの製造番号だけ取引先に知らせる",
      "三つの製造番号をシステム上で出荷停止にする",
      "原因が判明するまで何もしない",
    ],
    correctIndex: 2,
    explanation:
      "Because the source is unknown, the implicated and adjacent lots are immediately frozen in the inventory system before tracing and notifications.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
] as const satisfies readonly UpperListeningSeed[];

const n1KeyPointSeeds = [
  {
    semanticId: "N1-key-criticism-hidden-premise",
    level: "N1",
    family: "listening-key-points",
    semanticFocus:
      "researcher values criticism that exposes an unstated premise rather than requesting more examples",
    script:
      "女：先日の研究会、かなり厳しい指摘を受けていましたね。男：ええ。ただ、追加の事例を求められたことより、『利用者は常に選択肢を増やしたいはずだ』という前提を無意識に置いていたと指摘されたことが大きかったです。データの解釈以前に、問いの立て方がその前提に引っ張られていました。女：反論するのではなく、研究の出発点を見直すんですね。男：そこを修正すれば、結論もかなり変わるでしょう。",
    question: "男の人が、研究会の指摘で最も重要だと考えていることは何ですか。",
    options: [
      "事例の数が不足していたこと",
      "データの計算方法に誤りがあったこと",
      "無意識の前提が研究の問いを左右していたこと",
      "利用者が選択肢を増やしたがっていること",
    ],
    correctIndex: 2,
    explanation:
      "He distinguishes the major criticism from requests for examples: an unexamined assumption shaped the research question itself.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N1-key-digitization-metadata-context-loss",
    level: "N1",
    family: "listening-key-points",
    semanticFocus:
      "archivist warns that digitized objects lose meaning when relational metadata is omitted",
    script:
      "男：古い手紙をすべて画像にしたので、資料のデジタル化はほぼ終わりました。女：画像がそろっただけでは不十分です。その手紙がどの箱に、何と一緒に保管されていたか、だれがどの順番で整理したかも記録しないと、一通ごとの内容は読めても、資料同士の関係が失われます。男：検索用の題名だけではだめですか。女：題名は入口にすぎません。背景を再現できる情報こそ、後の研究には重要です。",
    question: "女の人が最も懸念していることは何ですか。",
    options: [
      "画像の解像度が低いこと",
      "検索用の題名が長すぎること",
      "資料相互の関係を示す情報が失われること",
      "手紙の内容が一般に読まれること",
    ],
    correctIndex: 2,
    explanation:
      "Her concern is contextual metadata—original grouping, neighbors, and arrangement—which preserves relationships among records.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N1-key-survey-anonymity-visible-response",
    level: "N1",
    family: "listening-key-points",
    semanticFocus:
      "employee survey credibility requires both anonymity and visible organizational response",
    script:
      "女：社員意識調査、今年は回答率がさらに下がりました。匿名だと繰り返し案内したのに、なぜでしょう。男：匿名性への疑いもあるでしょうが、過去に同じ問題を指摘しても、その後どう検討されたのか公表されていません。答えても変わらないと思われれば、秘密が守られても参加しません。女：集計結果だけでなく、対応できることとできないこと、その理由まで返す必要があるんですね。",
    question: "男の人は、回答率を上げるために何が必要だと考えていますか。",
    options: [
      "匿名性の説明をやめること",
      "社員の氏名と回答を公開すること",
      "意見をどう扱ったかを理由とともに示すこと",
      "毎月同じ調査を行うこと",
    ],
    correctIndex: 2,
    explanation:
      "Anonymity alone is insufficient; employees also need evidence that feedback is considered and explained.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N1-key-policy-incentive-conflict",
    level: "N1",
    family: "listening-key-points",
    semanticFocus:
      "quality policy fails because production incentives reward speed that contradicts it",
    script:
      "男：不良品を減らすため、確認項目を増やしたのに、現場では省略されているそうです。女：作業者の意識だけの問題ではありません。評価制度では、一時間当たりの処理数だけが賞与に反映され、確認に時間をかけると評価が下がります。品質を重視すると言いながら、速さだけを報酬につなげているわけです。男：手順を厳しくする前に、評価の基準を合わせる必要がありますね。",
    question:
      "女の人は、確認項目が省略される根本的な理由を何だと考えていますか。",
    options: [
      "作業者が手順を理解していないこと",
      "確認項目そのものが少なすぎること",
      "評価制度が速さを優先させていること",
      "不良品の数がすでに減ったこと",
    ],
    correctIndex: 2,
    explanation:
      "The stated quality goal conflicts with incentives based solely on throughput, making careful checks personally costly.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N1-key-leak-authentic-selection-bias",
    level: "N1",
    family: "listening-key-points",
    semanticFocus:
      "journalist accepts leaked documents as authentic but warns curated subset distorts the whole record",
    script:
      "女：公開された内部文書、専門家が本物だと確認したそうですね。これで組織の方針が証明されたと言えますか。男：文書が本物かどうかと、それが全体を代表するかどうかは別です。匿名の提供者が何千件からこの十件を選んだ基準が分かりません。反対の内容を示す文書が除かれている可能性もあります。女：偽物だと疑うのではなく、選ばれ方を検証する必要があるんですね。",
    question: "男の人は、公開された文書の何を問題にしていますか。",
    options: [
      "文書が偽物である可能性",
      "専門家が内容を読めないこと",
      "一部の文書が選ばれた基準が不明なこと",
      "文書の数が多すぎて公開できないこと",
    ],
    correctIndex: 2,
    explanation:
      "Authenticity is accepted; the unresolved issue is selection bias in an unexplained subset of a much larger archive.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N1-key-building-reuse-embodied-carbon",
    level: "N1",
    family: "listening-key-points",
    semanticFocus:
      "architect favors adaptable reuse because demolition discards embodied carbon despite efficient replacement",
    script:
      "男：古い庁舎を省エネ性能の高い建物に建て替えれば、環境負荷は下がりますよね。女：使用中のエネルギーだけならそう見えます。ただ、既存建物を壊し、新しい材料を製造する際にも大量の炭素が出ます。改修で構造を生かし、将来の用途変更にも対応できる設計にすれば、建て替えを繰り返さずに済みます。男：完成後の性能だけで比較してはいけないということですね。",
    question: "女の人が、建て替えの判断で重視していることは何ですか。",
    options: [
      "完成後の電気使用量だけ",
      "建設と将来の用途変更まで含む長期的な負荷",
      "新しい材料の見た目",
      "庁舎の建設期間の短さ",
    ],
    correctIndex: 1,
    explanation:
      "She broadens the comparison to embodied emissions and adaptability over the building's life, not just operating efficiency.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N1-key-model-distribution-shift",
    level: "N1",
    family: "listening-key-points",
    semanticFocus:
      "predictive model degrades because deployment population differs from historical training data",
    script:
      "女：需要予測のモデル、過去データでは精度が高かったのに、導入後は外れが増えました。男：学習に使ったのは都市部の既存顧客が中心でしたが、新サービスは地方の新規顧客にも広がっています。計算方法が急に壊れたというより、予測する対象が変わったんです。女：では、以前の精度をそのまま現在の保証として扱えませんね。男：ええ。新しい利用者のデータで継続的に検証する必要があります。",
    question: "モデルの精度が下がった主な理由は何ですか。",
    options: [
      "計算方法が削除されたから",
      "学習時と導入後で対象となる顧客が異なるから",
      "都市部の顧客が全員利用をやめたから",
      "過去データが一件も残っていないから",
    ],
    correctIndex: 1,
    explanation:
      "The deployment population expanded beyond the urban existing customers represented in training data, creating distribution shift.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N1-key-negotiation-definition-mismatch",
    level: "N1",
    family: "listening-key-points",
    semanticFocus:
      "negotiation stalls because parties use the same word efficiency for incompatible goals",
    script:
      "男：両社とも『効率化』には賛成なのに、共同事業の協議が進みませんね。女：同じ言葉で別のものを指しているからです。こちらは作業時間の短縮を意味していますが、相手は人員削減による費用低下を期待している。こちらが自動化を提案するたび、相手は削減できる人数を尋ねるので、目的がずれたままです。男：手段を議論する前に、何を成果とするか定義し直す必要がありますね。",
    question: "協議が進まない主な理由は何ですか。",
    options: [
      "両社とも効率化に反対しているから",
      "自動化の技術が存在しないから",
      "効率化という言葉で想定する成果が異なるから",
      "削減できる作業時間がすでに決まったから",
    ],
    correctIndex: 2,
    explanation:
      "Agreement is superficial because one side means time savings and the other head-count cost reduction; the success criterion is not shared.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
] as const satisfies readonly UpperListeningSeed[];

const n1OutlineSeeds = [
  {
    semanticId: "N1-outline-metrics-shape-behavior",
    level: "N1",
    family: "listening-outline",
    semanticFocus:
      "performance metrics reshape behavior and can replace the underlying purpose",
    script:
      "男：指標は、複雑な活動を理解し、改善するために役立ちます。しかし、指標が評価や報酬と強く結びつくと、人は本来の目的より数字を上げる行動を選び始めます。相談窓口で『一件当たりの時間』だけを測れば、難しい相談を避けるほうが有利になるでしょう。問題は数字が不正確なことではありません。正確に測れていても、それが目的の一部にすぎないことを忘れると、活動そのものが指標に合わせて変質するのです。",
    question: "男の人が最も伝えたいことは何ですか。",
    options: [
      "正確な指標なら必ず活動を改善する",
      "評価指標は人の行動を変え、本来の目的を損なうことがある",
      "複雑な活動は一切測定できない",
      "相談時間は短いほど利用者の満足度が高い",
    ],
    correctIndex: 1,
    explanation:
      "The central warning is not measurement error but behavioral distortion when a partial metric becomes the rewarded target.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N1-outline-archives-institutional-forgetting",
    level: "N1",
    family: "listening-outline",
    semanticFocus:
      "archives preserve rejected alternatives and prevent institutions from forgetting why decisions were made",
    script:
      "女：組織の記録というと、最終的な決定や完成した報告書を残せばよいと思われがちです。けれども、後になって重要になるのは、採用されなかった案や、当時は不確かだった情報かもしれません。それらが失われると、なぜ現在の制度がこの形になったのか分からず、過去に退けた案を新しい発想だと思って繰り返すことになります。記録は成功を証明するためだけでなく、組織が自分の判断過程を忘れないためにあるのです。",
    question: "女の人の主張に最も近いものはどれですか。",
    options: [
      "最終決定以外の記録は混乱を招く",
      "採用されなかった案も判断過程を理解するために残すべきだ",
      "過去の案は現在の判断に役立たない",
      "記録は組織の成功だけを示すためにある",
    ],
    correctIndex: 1,
    explanation:
      "She frames rejected proposals and uncertainty as institutional memory needed to understand and avoid blindly repeating prior decisions.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N1-outline-innovation-standards-interface",
    level: "N1",
    family: "listening-outline",
    semanticFocus:
      "standards can enable innovation by stabilizing interfaces while leaving components open to improvement",
    script:
      "男：標準化は創造性を奪うと言われますが、何を固定するかによります。部品同士の接続方法が共通なら、作り手は全体を一から設計せず、特定の部品の改良に集中できます。一方、性能や設計思想まで細かく統一すれば、確かに新しい方法は生まれにくくなります。標準と革新は単純な反対概念ではありません。互いに接続する境界を安定させ、その内側には選択の余地を残すことで、むしろ多様な試みが可能になります。",
    question: "男の人は、標準化についてどのように考えていますか。",
    options: [
      "標準化は常に創造性を妨げる",
      "すべての性能を統一すれば革新が進む",
      "接続部分を共通化し内部の自由を残せば革新を支えられる",
      "部品の接続方法は毎回変えるべきだ",
    ],
    correctIndex: 2,
    explanation:
      "His distinction is between stable interfaces, which enable focused innovation, and overprescriptive standards, which constrain it.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N1-outline-communicating-uncertainty",
    level: "N1",
    family: "listening-outline",
    semanticFocus:
      "transparent uncertainty communication pairs ranges with causes and decision implications",
    script:
      "女：専門家が不確実性を示すと、人々の信頼が下がると心配する人がいます。そのため、一つの数字だけを断定的に伝えがちです。しかし、後で数字が変われば、隠していたと思われる危険があります。大切なのは、単に『分からない』と言うことでも、あらゆる可能性を同じ重さで並べることでもありません。現在考えられる範囲、その幅が生じる理由、どの条件が変われば判断を見直すのかを示すことで、不確実な状況でも行動の根拠を共有できます。",
    question: "女の人が勧める不確実性の伝え方はどれですか。",
    options: [
      "最も都合のよい一つの数字だけを断定する",
      "すべての可能性を同じ確率として列挙する",
      "考えられる範囲と理由、判断を変える条件を示す",
      "情報が完全になるまで何も伝えない",
    ],
    correctIndex: 2,
    explanation:
      "She advocates calibrated transparency: range, sources of uncertainty, and conditions for revising the decision.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N1-outline-participation-representativeness",
    level: "N1",
    family: "listening-outline",
    semanticFocus:
      "public participation must address unequal ability to attend rather than treating an open meeting as representative",
    script:
      "男：住民説明会を開き、だれでも参加できるようにしたからといって、地域の意見を聞いたことにはなりません。開催時間に働いている人、介護や育児で家を離れられない人、日本語で長く発言することが難しい人は、制度上は参加できても実際には声を届けにくいからです。積極的に来た人の意見を尊重しつつ、それを住民全体の意見とみなさないことが重要です。時間帯の異なる会合、個別の聞き取り、翻訳など、参加の負担を下げる複数の方法を組み合わせる必要があります。",
    question: "男の人が最も指摘したいことは何ですか。",
    options: [
      "公開の説明会を一度開けば住民全体を代表できる",
      "参加者の意見は一切参考にすべきでない",
      "形式的に開かれていても参加しにくい人への工夫が必要だ",
      "説明会は日本語だけで長時間行うべきだ",
    ],
    correctIndex: 2,
    explanation:
      "Formal openness does not remove practical barriers, so multiple lower-burden participation channels are required.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N1-outline-translation-productive-ambiguity",
    level: "N1",
    family: "listening-outline",
    semanticFocus:
      "literary translation preserves productive ambiguity instead of resolving what the original leaves open",
    script:
      "女：曖昧な表現に出会うと、翻訳者は意味を一つに決めなければならないと思いがちです。確かに、文法上の違いから選択を避けられない場合もあります。しかし、原文が意図的に主語を隠し、複数の読みを生んでいるなら、翻訳で説明を加えて一つに限定することは、分かりやすさと引き換えに作品の働きを失わせます。訳文が不自然にならない範囲で、読者が迷う余地そのものをどう再現するか。それも正確さの一部として考えるべきです。",
    question: "女の人の考えに最も近いものはどれですか。",
    options: [
      "翻訳では曖昧さを必ず一つの意味に決める",
      "原文の意図的な曖昧さも可能な範囲で訳に残すべきだ",
      "分かりやすい訳は常に不正確である",
      "主語のない文は翻訳できない",
    ],
    correctIndex: 1,
    explanation:
      "She treats deliberate interpretive openness as part of the original's function and therefore a dimension of fidelity.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N1-outline-maintenance-invisible-value",
    level: "N1",
    family: "listening-outline",
    semanticFocus:
      "maintenance is undervalued because success appears as absence of events while innovation is visible",
    script:
      "男：新しい設備の導入には予算がつきやすいのに、既存設備の点検は後回しにされがちです。新設には完成式や目に見える成果がありますが、保守の成果は『事故が起きなかった』『止まらなかった』という形で現れます。何も起きないほど、その仕事は不要だったように見えてしまうのです。しかし、故障してから復旧する費用だけを比べても、停止中に失われたサービスや信頼は戻りません。維持する仕事の価値を、発生した成果ではなく回避した損失も含めて評価する必要があります。",
    question: "男の人が最も言いたいことは何ですか。",
    options: [
      "新しい設備には予算を使うべきでない",
      "事故がないなら点検は不要だ",
      "保守の価値は防いだ損失も含めて評価すべきだ",
      "故障後の復旧費だけを比較すれば十分だ",
    ],
    correctIndex: 2,
    explanation:
      "Maintenance success is invisible precisely because it prevents disruption, so avoided losses must enter its valuation.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N1-outline-speed-versus-judgment",
    level: "N1",
    family: "listening-outline",
    semanticFocus:
      "automation saves time only when organizations reinvest it in judgment rather than increase throughput",
    script:
      "女：自動化によって判断材料が早くそろうと、意思決定の質も上がると期待されます。ところが、空いた時間を検討に使わず、以前より多くの案件を同じ人数で処理するだけなら、一件にかける時間は変わりません。むしろ機械の出力を確かめる余裕さえ失う可能性があります。速度の向上が質につながるかどうかは、技術そのものより、節約した時間を組織が何に配分するかに左右されるのです。",
    question: "女の人の主張に最も近いものはどれですか。",
    options: [
      "自動化すれば意思決定の質は必ず上がる",
      "処理件数を増やすほど確認時間も増える",
      "自動化で得た時間の使い方が判断の質を左右する",
      "機械の出力は確認する必要がない",
    ],
    correctIndex: 2,
    explanation:
      "Her key condition is organizational allocation of saved time: reflection and verification versus simply greater throughput.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
] as const satisfies readonly UpperListeningSeed[];

const n1QuickResponseSeeds = [
  {
    semanticId: "N1-quick-acceptance-with-conditions",
    level: "N1",
    family: "listening-quick-response",
    semanticFocus:
      "negotiator is asked whether qualified acceptance counts as agreement",
    script: "条件付きとはいえ、先方も了承したと見ていいんですよね。",
    question: "最も適切な応答を選んでください。",
    options: [
      "条件の解釈が一致しているか確認するまでは、合意とは言い切れません。",
      "条件は付けなかったことにしましょう。",
      "先方は了承していただけませんでした。",
    ],
    correctIndex: 0,
    explanation:
      "The nuanced response resists treating conditional acceptance as final until both parties share the condition's meaning.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N1-quick-conclusion-leap",
    level: "N1",
    family: "listening-quick-response",
    semanticFocus:
      "colleague challenges whether report conclusion outruns evidence",
    script: "この結論、少し話が飛躍しているように見えませんか。",
    question: "最も適切な応答を選んでください。",
    options: [
      "確かに、この資料から直接言える範囲に絞ったほうがよさそうです。",
      "飛躍して見えないように資料を隠しましょう。",
      "結論は資料を読まなかったそうです。",
    ],
    correctIndex: 0,
    explanation:
      "It acknowledges the evidentiary gap and proposes narrowing the claim rather than disguising or ignoring it.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N1-quick-meeting-no-decision",
    level: "N1",
    family: "listening-quick-response",
    semanticFocus:
      "manager notes that lengthy meeting ended without a decision",
    script: "二時間も議論したのに、結局何も決まりませんでしたね。",
    question: "最も適切な応答を選んでください。",
    options: [
      "論点と決定権者が曖昧なまま始めたのが原因かもしれません。",
      "二時間で決めたことになっています。",
      "何も議論しなければ決まりましたね。",
    ],
    correctIndex: 0,
    explanation:
      "The response offers a plausible process diagnosis that directly engages with the lack of decision.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N1-quick-assignment-overload",
    level: "N1",
    family: "listening-quick-response",
    semanticFocus: "employee signals new assignment exceeds current capacity",
    script: "この案件もお願いしたいんだけど、今の担当と両立できそう？",
    question: "最も適切な応答を選んでください。",
    options: [
      "優先順位を調整していただければ可能ですが、現状のままでは難しいです。",
      "両立したことにしておきます。",
      "今の担当はお願いされませんでした。",
    ],
    correctIndex: 0,
    explanation:
      "It gives a clear capacity constraint and a workable condition rather than an evasive or contradictory reply.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N1-quick-publish-before-verification",
    level: "N1",
    family: "listening-quick-response",
    semanticFocus: "editor urges speed despite one unverified factual claim",
    script:
      "裏が取れていない箇所はあるけど、他社より先に出したほうがいいんじゃない？",
    question: "最も適切な応答を選んでください。",
    options: [
      "その箇所を確認できるまで断定を避けるか、記事から外しましょう。",
      "他社が出す前なら事実になります。",
      "裏付けは出したあとで不要になります。",
    ],
    correctIndex: 0,
    explanation:
      "It preserves publication integrity by withholding or qualifying the unsupported claim while leaving room to publish verified material.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N1-quick-exception-erodes-standard",
    level: "N1",
    family: "listening-quick-response",
    semanticFocus:
      "supervisor proposes one procedural exception for a favored client",
    script: "今回だけなら、審査を省いても前例にはなりませんよね。",
    question: "最も適切な応答を選んでください。",
    options: [
      "理由を記録せず例外にすると、次回断る根拠が弱くなります。",
      "前例は今回のあとに削除できます。",
      "審査はすでに省かなかったそうです。",
    ],
    correctIndex: 0,
    explanation:
      "The reply identifies the governance risk: an undocumented exception undermines consistency in future cases.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N1-quick-study-sample-shrink",
    level: "N1",
    family: "listening-quick-response",
    semanticFocus:
      "researcher asks whether study can shrink sample to meet deadline",
    script:
      "締め切りに間に合わせるため、調査対象を半分に減らしてはどうでしょう。",
    question: "最も適切な応答を選んでください。",
    options: [
      "結論の範囲にどう影響するか検討せずに減らすのは危険です。",
      "半分なら結果も必ず半分になります。",
      "締め切りは調査対象になりません。",
    ],
    correctIndex: 0,
    explanation:
      "It does not reject all reduction, but correctly requires evaluating how sampling changes the claims the study can support.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N1-quick-silence-as-consent",
    level: "N1",
    family: "listening-quick-response",
    semanticFocus: "chair assumes silence means committee agreement",
    script: "反対意見が出なかったんだから、全員賛成ということでいいですよね。",
    question: "最も適切な応答を選んでください。",
    options: [
      "発言しにくかった可能性もあるので、賛否を明示的に確認しましょう。",
      "反対しなかった人は発言できません。",
      "全員が賛成しなかったという意味です。",
    ],
    correctIndex: 0,
    explanation:
      "Silence is ambiguous; an explicit check is the appropriate way to establish consent.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
] as const satisfies readonly UpperListeningSeed[];

const n1IntegratedSeeds = [
  {
    semanticId: "N1-integrated-welfare-algorithm-review-appeal",
    level: "N1",
    family: "listening-integrated",
    semanticFocus:
      "welfare agency limits risk algorithm to review flags with reasons, human decisions, and accessible appeals",
    script:
      "ナレーション：自治体が、福祉手当の不正申請を見つけるために導入した予測システムについて、検証会議を開いています。監査担当者が報告します。監査担当：システム導入後、詳しい確認が必要だと判定される件数は増えました。しかし、過去に調査対象となった世帯の記録を学習しているため、転居回数が多い人や収入が月ごとに変動する人が高い危険度と判定されやすい傾向があります。実際の不正発見率は、従来の職員による抽出と大きく変わりません。一方、判定理由が画面に表示されないため、職員が結果を覆す際に根拠を書けないという問題もあります。ナレーション：窓口職員が話します。窓口職員：現在は高い危険度が出ると支給が一時停止され、本人には『確認中』とだけ通知されます。家賃の支払いが迫っている人もいるので、調査が長引く影響は深刻です。入力データの誤りだと気づいても、システム担当部署にしか修正を依頼できません。ただ、申告書の見落としを知らせる機能自体は、確認作業の助けになっています。ナレーション：利用者支援団体の代表が意見を述べます。支援団体代表：不利益な決定に用いるなら、本人が理由を知り、誤りを訂正し、人に再検討してもらえる仕組みが不可欠です。ウェブだけの異議申し立てでは、端末や言語の支援が必要な人が排除されます。危険度が高いというだけで給付を止めるのではなく、職員が資料を確認して初めて決定するべきです。ナレーション：制度責任者が結論を述べます。責任者：当面、システムは確認項目を職員に示す補助に限定し、自動的な支給停止には使いません。判定に影響した主な項目を画面と通知書に表示し、窓口、電話、ウェブのいずれでも訂正と再審査を求められるようにします。半年ごとに属性別の誤判定率を公表し、改善が見られなければ利用を停止します。",
    question:
      "自治体は、この予測システムを今後どのように扱うことにしましたか。",
    options: [
      "高危険度の申請を直ちに自動却下する",
      "システムを廃止し、過去の方法だけに戻す",
      "確認の補助に限定し、人による決定と複数の異議申立て手段を設ける",
      "判定理由は職員だけに知らせ、利用者には公開しない",
    ],
    correctIndex: 2,
    explanation:
      "The decision preserves the tool's reminder function but removes automated adverse action, exposes contributing factors, guarantees human review, and broadens appeal access.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
    sourceCount: 4,
  },
  {
    semanticId: "N1-integrated-coastal-adaptation-staged-retreat",
    level: "N1",
    family: "listening-integrated",
    semanticFocus:
      "coastal town combines near-term center protection with voluntary high-risk relocation and a ban on new exposure",
    script:
      "ナレーション：海面上昇と高潮への対策を検討する沿岸の町で、公聴会が開かれています。気候研究者が説明します。研究者：現在の堤防は、過去の潮位を基準に設計されています。補強すれば今後二十年程度の中規模の高潮には対応できますが、世紀後半まで安全を保証するものではありません。特に河口側の低地は、堤防を高くすると大雨時の排水が難しくなり、別の浸水危険が増します。将来予測には幅がありますが、新しい住宅を最も低い区域に増やすことは、どの予測でも損失を大きくします。ナレーション：商店街の代表が話します。商店街代表：中心部をすぐ移すのは現実的ではありません。港と市場があるから商売が成り立ち、移転すれば地域の雇用が失われます。少なくとも設備の更新期間に当たる二十年は、堤防と排水施設を整え、事業を続けられるようにしてほしいです。ただ、同じ被害を受けた住宅を公費で何度も直すことが持続的でないのは理解しています。ナレーション：低地区域の住民が意見を述べます。住民：『危険だから移れ』と言われても、補償額で同じ町に家を買えなければ選択とは言えません。高齢者には引っ越しや新しい生活への支援も必要です。一方、希望しても買い取り制度がなく、修理するしかない世帯もあります。強制ではなく、十分な補償と時間を伴う移転の選択肢を早く示してほしいです。ナレーション：財政担当者が話します。財政担当：全海岸を同じ高さで守る案は初期費用だけで予算を超え、維持費も増え続けます。公共施設と商業中心地を守る区間を絞れば、排水改善と合わせて実施できます。同時に、被害が繰り返される区域の住宅を段階的に買い取り、空いた土地を一時的に水を受ける場所にすれば、長期の負担を抑えられます。ナレーション：町長がまとめます。町長：中心部は堤防と排水を二十年計画で強化しますが、安全が永久に続くとは説明しません。最も低い区域では新規建築を認めず、希望世帯への時価に上乗せした買い取りと移転支援を来年度から始めます。強制移転は行わず、五年ごとに予測と対策範囲を見直します。",
    question: "町が採用した方針として、最も適切なものはどれですか。",
    options: [
      "全海岸を永久に守れる高さまで直ちに堤防で囲む",
      "中心部を当面守りつつ、高危険区域では新規建築を止め、希望者の移転を支援する",
      "予測に幅があるため、五年間は何の対策も取らない",
      "低地区域の全住民を補償なしで強制的に移転させる",
    ],
    correctIndex: 1,
    explanation:
      "The adopted adaptive pathway protects critical areas for a defined horizon, stops adding exposure, funds voluntary retreat, and schedules periodic reassessment.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
    sourceCount: 5,
  },
  {
    semanticId: "N1-integrated-research-data-community-governance",
    level: "N1",
    family: "listening-integrated",
    semanticFocus:
      "research consortium separates open measurements from governed community knowledge under continuing collective authority",
    script:
      "ナレーション：環境研究のデータ公開方針について、大学と地域団体が協議しています。主任研究者が話します。研究者：公的資金による研究なので、測定方法と水質データは再利用できる形で公開する責任があります。他の研究者が分析を再現できれば、誤りの発見にもつながります。一方、聞き取りには、地域の人だけが知る薬草の場所や、儀式に関わる知識も含まれています。氏名を消せばすべて公開してよいとは考えていませんが、どこまで制限すべきか基準が必要です。ナレーション：地域評議会の代表が話します。地域代表：その知識は、個人が単独で提供した情報ではなく、世代を通じて共同体が守ってきたものです。話した人が同意書に署名したからといって、第三者が商品開発に使う権利まで渡したわけではありません。場所を少しぼかしても、周辺情報から特定できる場合があります。公開か非公開かを研究者だけで一度決めるのではなく、利用目的ごとに私たちが判断し、後から許可を取り消せる必要があります。ナレーション：研究資金機関の担当者が話します。資金担当：公開原則には例外があります。個人情報だけでなく、文化的に機微な情報や、公開によって自然資源が損なわれる情報も、理由を記録したうえで制限できます。ただし、データが存在すること自体を隠すと、研究全体の範囲が分かりません。非公開部分についても、内容を明かさない説明、管理者、申請手順を示すことが望ましいです。ナレーション：データ管理の専門家が提案します。管理専門家：水質の数値、分析コード、一般的な調査票は公開します。共同体の知識を含む記録は別の保管領域に置き、地域評議会と大学が共同で管理します。利用希望者は目的、期間、共有範囲を申請し、評議会の承認を得ます。公開目録には、制限された資料の種類と制限理由だけを載せ、場所や内容は示しません。ナレーション：議長が結論を述べます。議長：この二層方式を採用します。さらに、同意は一度きりではなく、新しい利用目的が生じるたび地域評議会に確認し、許可の見直しも可能にします。",
    question: "研究データは、どのように管理されることになりましたか。",
    options: [
      "氏名を消したうえで、聞き取りを含む全データを無条件に公開する",
      "水質等は公開し、地域知識は共同管理のもと目的ごとの承認を必要とする",
      "地域知識の存在自体を目録から完全に隠す",
      "公的資金の研究なので、地域評議会には利用判断を認めない",
    ],
    correctIndex: 1,
    explanation:
      "The two-tier model supports reproducibility for ordinary research data while treating collective cultural knowledge as governed, revocable, purpose-specific access.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
    sourceCount: 5,
  },
  {
    semanticId: "N1-integrated-ai-hiring-proxy-audit",
    level: "N1",
    family: "listening-integrated",
    semanticFocus:
      "employer suspends automated rejection while auditing proxy discrimination and requires reasoned human review",
    script:
      "ナレーション：企業が、採用書類を選別する人工知能システムの見直し会議を開いています。販売会社の担当者が説明します。販売会社担当：このシステムは性別や年齢を入力項目にしていません。過去に採用され、入社後の評価が高かった社員の経歴から共通点を学び、応募者の適合度を示します。処理時間は三分の一になり、人事担当者は面接に時間を使えるようになりました。最終的な採用は人が決めています。ナレーション：外部監査人が報告します。監査人：直接の属性を除いても、代理となる情報は残ります。例えば、特定の学校、職歴の中断、通勤可能時間などが性別や家庭状況と強く関係していました。昨年度の結果では、同程度の職務試験成績でも、ある集団が書類段階で落とされる割合が有意に高くなっています。また、人事担当者は低い点数の応募をほとんど見ておらず、『最終判断は人』という説明が実態を表していません。ナレーション：人事部長が話します。人事部長：効率化の効果はありますが、何が点数を下げたのか担当者に分からないままでは、適切に覆せません。職務に本当に必要な条件と、過去の採用慣行を再生産する特徴を分ける必要があります。ただ、今すぐ全工程を手作業に戻すと、応募者への連絡が大幅に遅れます。ナレーション：従業員代表が意見を述べます。従業員代表：少なくとも検証が終わるまで、点数だけで応募者を自動的に除外するのは止めるべきです。応募者には、機械が使われたこと、評価に異議を申し立てられることを知らせてください。監査結果も平均だけでなく、集団別に継続して公表する必要があります。ナレーション：社長が方針を決めます。社長：自動的な不採用処理を本日停止し、システムは優先確認の参考に限ります。監査人と職務担当者が代理指標を検証し、職務との関係を説明できない項目は除きます。低得点の応募も人が理由を記録して判断し、応募者には再確認を求める窓口を示します。三か月後、集団別の通過率と判断の一致度を見て、利用範囲を再決定します。",
    question: "会社は、採用システムを当面どのように使うことにしましたか。",
    options: [
      "従来どおり低得点者を自動的に不採用にする",
      "システムを採用決定者にし、人は異議申立てだけを扱う",
      "自動不採用を止め、代理指標を監査しながら人が理由を記録して判断する",
      "属性別の結果を調べず、全工程を永久に手作業へ戻す",
    ],
    correctIndex: 2,
    explanation:
      "The interim governance removes automatic rejection, audits proxy features, makes human review substantive and documented, and adds applicant recourse plus subgroup monitoring.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
    sourceCount: 5,
  },
  {
    semanticId: "N1-integrated-urban-heat-equity-corridors",
    level: "N1",
    family: "listening-integrated",
    semanticFocus:
      "city targets low-canopy heat corridors with phased street trees while preserving timed deliveries and measuring equity",
    script:
      "ナレーション：都市の暑さ対策予算をどこに使うか、市の検討会で議論しています。環境データ担当者が説明します。データ担当：衛星画像では中心街が最も高温に見えますが、人口と徒歩移動を重ねると、東部の三地区で多くの住民が日陰のない道を歩いています。これらの地区は街路樹が少なく、冷房のない住宅も多い。単に平均気温が高い地点ではなく、暑さにさらされる時間と、避ける手段の少なさを考慮すべきです。ナレーション：商店会の代表が話します。商店会代表：木陰が増えることには賛成ですが、道路沿いの駐車場所を一度に失うと、小規模店への納品ができません。以前の歩道工事では、搬入場所を決めずに車線を閉じ、店が大きな損失を受けました。曜日と時間を限った共同搬入スペースを設けるなら、段階的な転換には協力できます。ナレーション：保健師が話します。保健師：救急搬送は高齢者だけでなく、屋外で働く人や、バス停まで長く歩く人に多く発生しています。公園に木を増やしても、通勤や買い物の経路が日なたのままなら、日常の危険は減りません。診療所、学校、バス停を結ぶ道を優先し、工事中も連続した日陰を確保してください。ナレーション：造園担当者が説明します。造園担当：大きな木を植えるには地下の配管と土の空間を確保する必要があります。鉢植えを並べるだけなら早いですが、数年で弱ります。駐車区画を三つに一つ程度、雨水をためられる植栽帯に変えれば、木を長く育てられます。最初の二年間は仮設の日よけも併用できます。ナレーション：副市長が結論を述べます。副市長：東部三地区のうち、診療所、学校、バス停を結ぶ二つの経路から着手します。駐車区画を段階的に植栽帯へ変えますが、各街区に時間指定の共同搬入場所を残します。完成まで仮設の日よけを設け、路面温度だけでなく、所得層別の徒歩利用と熱中症件数を追跡します。",
    question: "市が決定した暑さ対策として、最も適切なものはどれですか。",
    options: [
      "中心街の平均気温が高い地点だけに鉢植えを置く",
      "東部の生活経路を優先して恒久的な植栽を段階導入し、搬入手段も残す",
      "すべての路上駐車を一度に禁止し、商店への搬入をやめる",
      "公園だけに木を増やし、徒歩経路は対象外とする",
    ],
    correctIndex: 1,
    explanation:
      "The plan uses exposure and vulnerability—not heat alone—to select routes, builds durable canopy in phases, and preserves scheduled commercial access.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
    sourceCount: 5,
  },
  {
    semanticId: "N1-integrated-monument-context-countermemory",
    level: "N1",
    family: "listening-integrated",
    semanticFocus:
      "city retains contested monument while relocating ceremonial focus, adding counter-memory, and documenting reinterpretation",
    script:
      "ナレーション：市役所前の歴史的人物の像をどう扱うか、市民委員会が意見を聞いています。歴史学者が話します。歴史学者：この人物は公共事業を進めた一方、土地の取得で住民を強制的に移転させました。像が建てられたのは本人の時代ではなく、五十年後に市の発展を称える運動が行われた時期です。したがって、像そのものも過去をどう記憶しようとしたかを示す史料です。ただし、台座の文章は功績だけを断定的に述べ、被害を受けた人々を存在しないものにしています。ナレーション：移転させられた地域の子孫が話します。子孫代表：像が市役所の正面にあり、式典で花を供える現状は、市が今もその人物を無条件に称賛しているように見えます。小さな説明板を足すだけでは、像の大きさと場所が伝える意味は変わりません。撤去して倉庫に隠すことを求めているのではなく、公共空間の中心を、異なる経験も見える場所に変えてほしいのです。ナレーション：保存専門家が話します。保存専門家：移動は可能ですが、像と台座を分解する際に一部を失う危険があります。その場に残す場合でも、台座への直接加工は避け、周囲に独立した展示を設けられます。制作時の資料、賛成と反対の記録、現在の議論まで保存すれば、単純な英雄像ではなく、記憶の変化を示せます。ナレーション：若者委員が提案します。若者委員：像の正面性を弱めるため、市の公式式典は新しい市民広場で行いましょう。像の周囲には、立ち退きを経験した人の証言と、現在の住民が制作する作品を常設します。像だけに説明を付けるのではなく、だれが都市の発展の費用を負ったのかを空間全体で示すべきです。ナレーション：委員長が結論を述べます。委員長：像は史料として現位置に保存しますが、称賛の場としての扱いを改めます。公式式典を新広場へ移し、台座の旧文面は残したうえで、その成立背景を批判的に説明します。周囲に証言と新作を置く展示を、影響を受けた地域の代表と共同で設計し、今回の検討記録も公開します。",
    question: "委員会は、像をどのように扱うことにしましたか。",
    options: [
      "像を直ちに廃棄し、議論の記録も残さない",
      "像と従来の式典をそのまま維持し、小さな案内だけ加える",
      "像は保存するが称賛の中心から外し、被害の証言と批判的背景を共同展示する",
      "台座の文章を削り、人物の功績だけを新しく刻む",
    ],
    correctIndex: 2,
    explanation:
      "The decision distinguishes preservation from honor: the artifact stays, ceremonial status changes, and countervailing testimony and history reshape the site collaboratively.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
    sourceCount: 5,
  },
  {
    semanticId: "N1-integrated-hospital-discharge-score-safeguards",
    level: "N1",
    family: "listening-integrated",
    semanticFocus:
      "hospital uses discharge-readiness score as review prompt with clinical override and equity monitoring",
    script:
      "ナレーション：病床不足への対応として導入した退院支援スコアについて、病院が評価会議を開いています。病院長が説明します。病院長：検査値、歩行能力、在宅支援の有無などから退院準備が整った患者を示し、担当チームに通知する仕組みです。導入後、平均入院日数は短くなりました。しかし、短縮だけを成果とせず、再入院や患者の生活状況も確認する必要があります。ナレーション：病棟看護師が話します。看護師：スコアが基準を超えると、現場では『今日退院させる患者』として扱われがちです。ところが、家族が迎えに来られない、薬の説明を本人の言語で受けられていない、といった事情は入力欄に十分反映されません。退院を延期すると病床管理から理由を求められるため、数値に従う圧力を感じます。ナレーション：データ分析担当者が報告します。分析担当：全体の再入院率は変わっていませんが、一人暮らしの患者と、通訳を必要とする患者では七日以内の救急受診が増えています。モデルが医学的な安定を予測しても、自宅で安全に療養できるかまでは測れていません。スコアの精度だけでなく、使われ方の影響を集団別に見る必要があります。ナレーション：倫理委員が意見を述べます。倫理委員：病床を公平に使うことは重要ですが、平均日数を減らす目標が個々の安全を上回ってはいけません。スコアは退院を命じるものではなく、必要な確認を始める合図と位置づけるべきです。延期した職員が不利益を受けないこと、患者が説明を受けて異議を伝えられることも明確にしてください。ナレーション：病院長が方針をまとめます。病院長：今後、基準を超えた場合は退院決定ではなく、多職種による確認を開始します。住居、介護者、言語支援を必須確認項目に加え、担当医と看護師は理由を記録して延期できます。入院日数に加え、集団別の救急受診、再入院、患者の理解度を毎月検証し、職員評価には退院数を用いません。",
    question:
      "病院は、退院支援スコアの運用をどのように改めることにしましたか。",
    options: [
      "基準を超えた患者をその日のうちに自動退院させる",
      "スコアを確認開始の合図とし、生活条件を含む人の判断と延期を認める",
      "平均入院日数だけを職員評価に使う",
      "一人暮らしの患者をスコアの対象から一律に外す",
    ],
    correctIndex: 1,
    explanation:
      "The score becomes a trigger for multidisciplinary review, not a discharge order, with new social-context fields, protected overrides, and subgroup outcome monitoring.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
    sourceCount: 5,
  },
  {
    semanticId: "N1-integrated-supply-chain-carbon-transition-data",
    level: "N1",
    family: "listening-integrated",
    semanticFocus:
      "buyer phases in supplier-specific carbon data with shared methodology, verification, and support for small firms",
    script:
      "ナレーション：製造会社が、取引先の温室効果ガス排出量を調達判断に反映する方法を検討しています。調達責任者が話します。調達責任者：現在は、購入金額に業界平均の排出係数を掛けて計算しています。そのため、実際に設備を改善した取引先も同じ業種なら同じ値になり、削減努力を評価できません。来年度から各社固有のデータを求めたいのですが、測定経験のない小規模企業を直ちに除外すれば、供給が不安定になり、取引先の多様性も失われます。ナレーション：大手部品会社の担当者が話します。大手取引先：当社は工場の電力と燃料を測定していますが、製品ごとの配分方法は顧客によって違います。重量で割る会社も、製造時間で割る会社もあり、都合のよい方法を選べば数字を低く見せられます。一次データを集めるだけでなく、境界と配分の共通ルールが必要です。また、毎年すべてを第三者検証すると費用が大きすぎます。ナレーション：小規模取引先の代表が話します。小規模取引先代表：専任担当者がおらず、最初から複雑な報告を求められると対応できません。ただ、電気と燃料の請求書なら提出できます。計算用の共通表と研修があり、初年度の誤りを改善の対象として扱ってもらえるなら参加できます。報告できないことを理由に、来年すぐ契約を失うのが一番の不安です。ナレーション：会計の専門家が意見を述べます。会計専門家：全取引先に同じ精度を一度に求めるより、段階を分けるべきです。まず活動量の根拠を保存し、共通の境界で計算する。排出量や調達額の大きい取引先は外部検証し、それ以外は抽出監査を行います。削減量は基準年の計算方法を固定しないと、方法を変えただけの減少と区別できません。ナレーション：環境担当役員が決定を述べます。環境担当役員：二年間の移行期間を設けます。初年度は全取引先に共通表と研修を提供し、請求書等の一次情報から計算してもらいます。報告の有無だけで契約を打ち切らず、改善計画を評価します。大口取引先は第三者検証、その他は抽出監査とし、境界と基準年を共通化します。二年目以降、データの質と実際の削減を価格、品質、供給安定性とともに調達評価へ段階的に反映します。",
    question: "会社は、取引先の排出量を調達にどう反映することにしましたか。",
    options: [
      "来年度、固有データを出せない取引先との契約をすべて直ちに終了する",
      "業界平均だけを永久に使い、各社の削減努力は評価しない",
      "共通方法と支援を設けて固有データへ段階移行し、規模に応じて検証する",
      "各取引先が最も低く見える計算方法を自由に選ぶ",
    ],
    correctIndex: 2,
    explanation:
      "The decision combines comparable primary data and tiered assurance with a transition period, capacity support, and gradual—not exclusionary—procurement consequences.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
    sourceCount: 5,
  },
] as const satisfies readonly UpperListeningSeed[];

/** Audited baseline pack: 32 N3, 40 N2, and 40 N1 seeds. */
export const BASE_UPPER_LISTENING_SEEDS: readonly UpperListeningSeed[] = [
  ...n3TaskSeeds,
  ...n3KeyPointSeeds,
  ...n3OutlineSeeds,
  ...n3QuickResponseSeeds,
  ...n2TaskSeeds,
  ...n2KeyPointSeeds,
  ...n2OutlineSeeds,
  ...n2QuickResponseSeeds,
  ...n2IntegratedSeeds,
  ...n1TaskSeeds,
  ...n1KeyPointSeeds,
  ...n1OutlineSeeds,
  ...n1QuickResponseSeeds,
  ...n1IntegratedSeeds,
];

/**
 * Production corpus. Expansion tranches remain separate modules so authorship
 * and cross-review can be audited before integration.
 */
export const upperListeningSeeds: readonly UpperListeningSeed[] = [
  ...BASE_UPPER_LISTENING_SEEDS,
  ...N3_UPPER_LISTENING_EXPANSION,
  ...n2UpperListeningExpansion,
  ...N1_UPPER_LISTENING_EXPANSION,
];
