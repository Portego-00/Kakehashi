/**
 * Original N5/N4 listening seeds.
 *
 * Task-based and key-point items show their question and four choices before
 * playback. Quick response is audio-only with three candidate replies. These
 * are semantic items, not surface substitutions.
 */

import { n4LowerListeningExpansion } from "./n4-lower-listening-expansion";
import { N5_LOWER_LISTENING_EXPANSION } from "./n5-lower-listening-expansion";

export type LowerListeningLevel = "N5" | "N4";

export type LowerListeningFamily =
  | "listening-task"
  | "listening-key-points"
  | "listening-quick-response";

interface LowerListeningSeedBase {
  /** Stable editorial identity; never derive this from array position. */
  semanticId: string;
  level: LowerListeningLevel;
  family: LowerListeningFamily;
  /** A globally unique scenario description used to audit semantic diversity. */
  semanticFocus: string;
  /** The audible dialogue or utterance. */
  script: string;
  question: string;
  explanation: string;
}

interface LowerListeningPrintedSeed extends LowerListeningSeedBase {
  family: "listening-task" | "listening-key-points";
  options: readonly [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  questionTiming: "before-stimulus";
  audioOnlyOptions: false;
}

interface LowerListeningQuickResponseSeed extends LowerListeningSeedBase {
  family: "listening-quick-response";
  question: "最も適切な応答を選んでください。";
  options: readonly [string, string, string];
  correctIndex: 0 | 1 | 2;
  questionTiming: "prompt-only";
  audioOnlyOptions: true;
}

export type LowerListeningSeed =
  | LowerListeningPrintedSeed
  | LowerListeningQuickResponseSeed;

const n5TaskSeeds = [
  {
    semanticId: "N5-task-supermarket-shopping-list",
    level: "N5",
    family: "listening-task",
    semanticFocus:
      "child buys the one missing grocery while other items are available or assigned",
    script:
      "女の人：スーパーで牛乳を買ってきてください。男の子：パンとたまごも買いますか。女の人：パンとたまごはまだあります。水はわたしが買います。牛乳だけお願いします。男の子：分かりました。",
    question: "男の子は、何を買いますか。",
    options: ["牛乳", "パン", "たまご", "水"],
    correctIndex: 0,
    explanation:
      "Milk is the only missing item assigned to the boy. Bread and eggs are already available, and the woman will buy the water.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N5-task-classroom-teacher-notebook",
    level: "N5",
    family: "listening-task",
    semanticFocus:
      "student takes out the missing notebook after already preparing a textbook",
    script:
      "男の子：教科書はつくえに出しました。ノートとえんぴつは、まだかばんの中です。女の先生：では、ノートを出してください。えんぴつはあとでいいです。ノートを出したら、宿題を先生のつくえに持ってきてください。",
    question: "男の子は、このあと何をしますか。",
    options: [
      "教科書をつくえに出す",
      "ノートをかばんから出す",
      "えんぴつをかばんから出す",
      "宿題を先生のつくえに持っていく",
    ],
    correctIndex: 1,
    explanation:
      "The textbook is already out, the pencil may wait, and taking homework to the teacher follows taking out the notebook.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N5-task-library-return-before-borrowing",
    level: "N5",
    family: "listening-task",
    semanticFocus:
      "library visitor returns an old book before borrowing a new one",
    script:
      "女の人：この新しい本を借りたいです。男の人：前の本をまだ返していませんね。女の人：前の本はかばんにあります。カードも持っています。男の人：よかったです。家に帰らないで、ここで前の本を返してください。そのあと、カードと新しい本を持ってきてください。",
    question: "女の人は、このあと何をしますか。",
    options: ["新しい本を借りる", "家へ帰る", "前の本を返す", "カードを見せる"],
    correctIndex: 2,
    explanation:
      "The old book is in her bag, so she need not go home. Returning it is required before showing the card and borrowing the new book.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N5-task-station-ticket-before-platform",
    level: "N5",
    family: "listening-task",
    semanticFocus: "traveler buys a ticket before going to the train platform",
    script:
      "男の人：もう電車に乗れますか。女の人：まだきっぷがありません。カードは家にあります。男の人：あのきかいで、きっぷが買えますよ。使い方が分からないときは、駅の人に聞いてください。女の人：使い方は分かります。買ってから、二番のホームへ行きます。",
    question: "女の人は、このあと何をしますか。",
    options: [
      "二番のホームへ行く",
      "カードを使う",
      "駅の人に聞く",
      "きっぷを買う",
    ],
    correctIndex: 3,
    explanation:
      "Her card is at home and she understands the machine, so she buys a ticket before going to platform two without asking staff.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N5-task-park-cleanup-trash-first",
    level: "N5",
    family: "listening-task",
    semanticFocus: "park helper collects litter before watering flowers",
    script:
      "女の人：公園をきれいにしましょう。ごみの袋は、もう買ってベンチに置きました。落ち葉はわたしがそうじします。男の子：ぼくは花に水をやりますか。女の人：それは、ごみをひろったあとでお願いします。",
    question: "男の子は、今、何をしますか。",
    options: [
      "花に水をやる",
      "ごみをひろう",
      "落ち葉をそうじする",
      "ごみの袋を買う",
    ],
    correctIndex: 1,
    explanation:
      "The bag is already bought, the woman will sweep the leaves, and watering comes later; the boy's current job is collecting litter.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N5-task-dinner-wash-hands-first",
    level: "N5",
    family: "listening-task",
    semanticFocus: "child washes hands before carrying dinner plates",
    script:
      "女の人：ごはんができました。お皿をテーブルに持っていってください。ごはんは、わたしが持っていきます。男の子：はい。女の人：あ、手がよごれていますね。手を洗ってから、お皿をお願いします。食べたあとのお皿も洗ってくださいね。",
    question: "男の子は、このあと何をしますか。",
    options: [
      "ごはんをテーブルに持っていく",
      "食べたあとのお皿を洗う",
      "手を洗う",
      "お皿をテーブルに持っていく",
    ],
    correctIndex: 2,
    explanation:
      "The woman will carry the rice, and both carrying and later washing the plates follow the immediate requirement to wash his dirty hands.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N5-task-clinic-write-name-first",
    level: "N5",
    family: "listening-task",
    semanticFocus:
      "clinic visitor writes a name before sitting in the waiting area",
    script:
      "男の人：はじめて来ました。女の人：では、この紙に名前を書いてください。書いた紙をカードといっしょに受付に出して、それから、あちらのいすで待ってください。男の人：はい。",
    question: "男の人は、紙を受付に出す前に何をしますか。",
    options: [
      "紙に名前を書く",
      "紙を受付に出す",
      "カードを受付に出す",
      "いすで待つ",
    ],
    correctIndex: 0,
    explanation:
      "He must write his name on the form before submitting that form with his card; sitting in the waiting area is the final step.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N5-task-rainy-trip-pack-umbrella",
    level: "N5",
    family: "listening-task",
    semanticFocus:
      "traveler prepares the umbrella assigned to him for a rainy group trip",
    script:
      "女の人：あしたの旅行は雨でしょう。おべんとうはわたしが作ります。水は山田さんが持ってきます。地図はもうかばんに入っています。男の人：では、ぼくは何を用意しますか。女の人：かさをお願いします。",
    question: "男の人は、何を用意しますか。",
    options: ["地図", "水", "おべんとう", "かさ"],
    correctIndex: 3,
    explanation:
      "The woman handles lunch, Yamada brings water, and the map is already packed, leaving the umbrella as the man's preparation.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
] as const satisfies readonly LowerListeningSeed[];

const n5KeyPointSeeds = [
  {
    semanticId: "N5-key-bus-departure-time",
    level: "N5",
    family: "listening-key-points",
    semanticFocus: "passenger identifies the changed departure time of a bus",
    script:
      "女の人：駅へ行くバスは九時ですか。男の人：今日は九時のバスがありません。次は九時半です。女の人：分かりました。九時半ですね。",
    question: "女の人は、何時のバスに乗りますか。",
    options: ["八時半", "九時", "九時半", "十時"],
    correctIndex: 2,
    explanation:
      "The nine o'clock bus is not running today, and both speakers confirm that the next usable bus is at nine thirty.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N5-key-library-closed-day",
    level: "N5",
    family: "listening-key-points",
    semanticFocus:
      "library visitor identifies Tuesday as the weekly closed day",
    script:
      "男の人：図書館は月曜日も開いていますか。女の人：はい。月曜日は開いています。火曜日が休みです。土曜日と日曜日も開いていますよ。",
    question: "図書館は、何曜日が休みですか。",
    options: ["月曜日", "火曜日", "土曜日", "日曜日"],
    correctIndex: 1,
    explanation:
      "The woman explicitly contrasts Monday being open with Tuesday being closed; weekend days are also said to be open.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N5-key-classroom-room-change",
    level: "N5",
    family: "listening-key-points",
    semanticFocus:
      "student identifies room one hundred one as the changed classroom",
    script:
      "女の先生：今日の日本語のクラスは、二百一号室ではありません。百一号室です。男の学生：一かいのへやですね。女の先生：はい、そうです。",
    question: "今日の日本語のクラスは、何号室ですか。",
    options: ["百一号室", "百二号室", "二百一号室", "二百二号室"],
    correctIndex: 0,
    explanation:
      "The teacher corrects the expected room 201 to room 101, and the student confirms that it is on the first floor.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N5-key-picnic-drink-choice",
    level: "N5",
    family: "listening-key-points",
    semanticFocus:
      "picnic visitor chooses tea because juice is already provided",
    script:
      "男の人：ピクニックに何を持っていきますか。女の人：ジュースは山田さんが持ってきますね。では、わたしはお茶を持っていきます。水は公園で買えます。",
    question: "女の人は、何を持っていきますか。",
    options: ["ジュース", "お茶", "水", "牛乳"],
    correctIndex: 1,
    explanation:
      "Juice is assigned to Yamada and water can be bought there; the woman explicitly chooses to bring tea herself.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N5-key-shirt-color-choice",
    level: "N5",
    family: "listening-key-points",
    semanticFocus:
      "shopper chooses the blue shirt after comparing available colors",
    script:
      "女の人：このシャツ、白と青がありますか。男の人：はい。赤もあります。女の人：白はもう持っています。今日は青をください。",
    question: "女の人は、何色のシャツを買いますか。",
    options: ["白", "青", "赤", "黒"],
    correctIndex: 1,
    explanation:
      "White and red are discussed, but the shopper clearly requests the blue shirt as the one she will buy today.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N5-key-station-platform-number",
    level: "N5",
    family: "listening-key-points",
    semanticFocus: "traveler identifies platform three for the train to Kyoto",
    script:
      "男の人：京都へ行く電車は、二番のホームですか。女の人：いいえ、二番は大阪行きです。京都行きは三番です。男の人：ありがとうございます。",
    question: "京都へ行く電車は、何番のホームですか。",
    options: ["一番", "二番", "三番", "四番"],
    correctIndex: 2,
    explanation:
      "The staff member says platform two is for Osaka and directly identifies platform three as the Kyoto train's platform.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N5-key-restaurant-lunch-price",
    level: "N5",
    family: "listening-key-points",
    semanticFocus:
      "diner identifies the seven hundred yen price of the curry lunch",
    script:
      "女の人：カレーはいくらですか。男の人：カレーだけは六百円です。昼はサラダとお茶がついて、七百円です。女の人：では、昼のカレーをください。",
    question: "女の人はいくら払いますか。",
    options: ["五百円", "六百円", "七百円", "八百円"],
    correctIndex: 2,
    explanation:
      "She orders the lunch curry set, which the man states costs 700 yen; 600 yen is the curry-only price.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N5-key-friend-meeting-place",
    level: "N5",
    family: "listening-key-points",
    semanticFocus:
      "friends choose the station entrance rather than the café as meeting place",
    script:
      "男の人：あした、どこで会いますか。女の人：駅の中のきっさてんは人が多いです。駅の入口で会いましょう。男の人：分かりました。十時に入口ですね。",
    question: "二人は、どこで会いますか。",
    options: ["駅の入口", "駅のきっさてん", "図書館", "公園"],
    correctIndex: 0,
    explanation:
      "The café is rejected because it is crowded, and both speakers settle on meeting at the station entrance.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
] as const satisfies readonly LowerListeningSeed[];

const n5QuickResponseSeeds = [
  {
    semanticId: "N5-quick-library-invitation",
    level: "N5",
    family: "listening-quick-response",
    semanticFocus: "friend accepts an invitation to visit the library tomorrow",
    script: "あした、いっしょに図書館へ行きませんか。",
    question: "最も適切な応答を選んでください。",
    options: [
      "いいですね。行きましょう",
      "図書館の本はおもしろいです",
      "図書館は駅の近くです",
    ],
    correctIndex: 0,
    explanation:
      "行きませんか is an invitation, so accepting with いいですね。行きましょう is the only reply that directly fits.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N5-quick-pen-owner",
    level: "N5",
    family: "listening-quick-response",
    semanticFocus: "speaker identifies themself as the owner of a pen",
    script: "このペンは、だれのですか。",
    question: "最も適切な応答を選んでください。",
    options: ["わたしのです", "青いペンです", "つくえの上です"],
    correctIndex: 0,
    explanation:
      "だれの asks who owns the pen; わたしのです supplies an owner, while the other replies give color or location.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N5-quick-seat-permission",
    level: "N5",
    family: "listening-quick-response",
    semanticFocus: "listener grants permission to use an available seat",
    script: "ここに座ってもいいですか。",
    question: "最も適切な応答を選んでください。",
    options: ["はい、どうぞ", "そこに座っています", "そのいすは新しいです"],
    correctIndex: 0,
    explanation:
      "座ってもいいですか asks permission. はい、どうぞ is the natural response granting it.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N5-quick-return-time",
    level: "N5",
    family: "listening-quick-response",
    semanticFocus: "speaker gives the approximate time they will return home",
    script: "今日は何時に帰りますか。",
    question: "最も適切な応答を選んでください。",
    options: ["六時ごろです", "電車で帰ります", "家で夕ごはんを食べます"],
    correctIndex: 0,
    explanation:
      "何時 asks for a time, and 六時ごろです answers it. The other replies give transport or a later activity.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N5-quick-heavy-bag-comment",
    level: "N5",
    family: "listening-quick-response",
    semanticFocus: "speaker agrees that the bag being discussed is heavy",
    script: "そのかばん、重いですね。",
    question: "最も適切な応答を選んでください。",
    options: [
      "ええ、本がたくさん入っています",
      "いいえ、黒いかばんです",
      "駅でかばんを買いました",
    ],
    correctIndex: 0,
    explanation:
      "The first reply acknowledges the comment and naturally explains why the bag is heavy.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N5-quick-station-directions",
    level: "N5",
    family: "listening-quick-response",
    semanticFocus: "passerby gives a simple direction to the station",
    script: "すみません、駅はどこですか。",
    question: "最も適切な応答を選んでください。",
    options: [
      "あの角を右に曲がってください",
      "電車で行きます",
      "駅で友達を待っています",
    ],
    correctIndex: 0,
    explanation:
      "駅はどこですか asks for its location. あの角を右に曲がってください is the only direct direction.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N5-quick-dessert-choice",
    level: "N5",
    family: "listening-quick-response",
    semanticFocus:
      "customer chooses ice cream when offered either cake or ice cream",
    script: "デザートはケーキとアイスがあります。どちらがいいですか。",
    question: "最も適切な応答を選んでください。",
    options: [
      "アイスをお願いします",
      "デザートを食べました",
      "ケーキ屋は駅の前です",
    ],
    correctIndex: 0,
    explanation:
      "どちらがいいですか asks the customer to choose between cake and ice cream, so requesting the ice cream is the only direct answer.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N5-quick-homework-not-yet",
    level: "N5",
    family: "listening-quick-response",
    semanticFocus: "student says that the homework is not finished yet",
    script: "宿題は、もう終わりましたか。",
    question: "最も適切な応答を選んでください。",
    options: [
      "いいえ、まだです",
      "宿題は数学です",
      "あした学校へ持っていきます",
    ],
    correctIndex: 0,
    explanation:
      "もう終わりましたか asks whether it is finished already; いいえ、まだです is the standard negative reply.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N5-quick-close-window-request",
    level: "N5",
    family: "listening-quick-response",
    semanticFocus: "listener accepts an offer to close the window",
    script: "窓を閉めましょうか。",
    question: "最も適切な応答を選んでください。",
    options: [
      "はい、お願いします",
      "窓はドアのそばです",
      "きのう自分で閉めました",
    ],
    correctIndex: 0,
    explanation:
      "閉めましょうか offers to close the window; はい、お願いします naturally accepts the offer.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N5-quick-phone-number-request",
    level: "N5",
    family: "listening-quick-response",
    semanticFocus:
      "speaker responds to a request by giving a complete mobile phone number",
    script: "電話番号を教えてください。",
    question: "最も適切な応答を選んでください。",
    options: [
      "はい、〇九〇の二三四五の六七八九です",
      "電話はつくえの上です",
      "きのう電話をかけました",
    ],
    correctIndex: 0,
    explanation:
      "The request is for a phone number, so stating a complete mobile number is the only relevant response.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
] as const satisfies readonly LowerListeningSeed[];

const n4TaskSeeds = [
  {
    semanticId: "N4-task-delivery-choose-new-time",
    level: "N4",
    family: "listening-task",
    semanticFocus:
      "resident chooses Saturday redelivery after work hours rule out collection and weekdays",
    script:
      "女の人：荷物を受け取れなかったんですが、センターへ取りに行けますか。男の人：六時までなら受け取れます。または、ウェブで新しい配達時間を選べます。女の人：仕事が六時に終わるので、センターには間に合いません。平日の午後も家にいません。土曜日の二時から四時なら家にいます。男の人：では、この紙の番号をウェブに入れてください。配達の人に電話する必要はありません。",
    question: "女の人は、荷物を受け取るためにどうしますか。",
    options: [
      "六時までにセンターへ取りに行く",
      "ウェブで土曜日の配達を選ぶ",
      "平日の午後に家で待つ",
      "配達の人に電話する",
    ],
    correctIndex: 1,
    explanation:
      "Work rules out collection by six and she is absent on weekday afternoons, so she uses the web to select the Saturday window.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N4-task-community-class-form-first",
    level: "N4",
    family: "listening-task",
    semanticFocus:
      "class participant pays the fee after completing a form and before submitting the receipt",
    script:
      "男の人：料理教室の紙に、名前と電話番号を書きました。次は受付に出しますか。女の人：その前に、隣の機械で参加費を払ってください。出てきたレシートと紙をいっしょに受付へ持ってきてください。教室へ行くのは、そのあとです。男の人：分かりました。",
    question: "男の人は、このあと何をしますか。",
    options: [
      "紙に名前と電話番号を書く",
      "機械で参加費を払う",
      "紙とレシートを受付に出す",
      "料理の教室へ行く",
    ],
    correctIndex: 1,
    explanation:
      "He has already completed the form. Payment produces the receipt needed for the later reception submission, which precedes entering class.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N4-task-office-poster-manager-check",
    level: "N4",
    family: "listening-task",
    semanticFocus:
      "employee emails a poster for manager approval before deciding whether to print",
    script:
      "女の人：イベントのポスターができました。今から三十枚コピーしてもいいですか。男の人：部長が日にちをまだ確認していません。今は会議中なので、ポスターをメールで送っておきましょう。今日『いい』と返事が来たらコピーします。返事が明日なら、それまで待ってください。日にちは自分で変えないでくださいね。女の人：分かりました。",
    question: "女の人は、このあと何をしますか。",
    options: [
      "ポスターを三十枚コピーする",
      "イベントの日にちを変える",
      "部長にポスターをメールで送る",
      "部長の返事を明日まで待つ",
    ],
    correctIndex: 2,
    explanation:
      "Printing depends on approval, changing the date herself is forbidden, and waiting until tomorrow is only conditional; she sends the poster for review now.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N4-task-bicycle-call-repair-shop",
    level: "N4",
    family: "listening-task",
    semanticFocus:
      "cyclist calls the repair shop before taking in a bicycle with a loose chain",
    script:
      "男の人：自転車のチェーンが外れやすいんです。店まで乗っていってもいいですか。女の人：危ないので、乗らないでください。新しいチェーンを自分で買う前に、店に今日直せるか聞いたほうがいいですよ。直せるなら、車で持っていけます。男の人：では、店の番号を調べます。",
    question: "男の人は、このあと何をしますか。",
    options: [
      "自転車で店へ行く",
      "チェーンを自分で買う",
      "車に自転車を乗せる",
      "修理の店に電話する",
    ],
    correctIndex: 3,
    explanation:
      "Riding is unsafe, buying a chain is premature, and transport depends on availability; looking up the number leads to calling the shop.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N4-task-cooking-preheat-oven",
    level: "N4",
    family: "listening-task",
    semanticFocus:
      "cook mixes wet ingredients while an already switched-on oven heats",
    script:
      "女の人：オーブンを百八十度にして、つけました。温まるまで、何をしますか。男の人：たまごと牛乳をまぜてください。それができたら小麦粉を入れます。ケーキを切るのは、焼いて冷めてからですよ。女の人：はい。",
    question: "女の人は、このあと何をしますか。",
    options: [
      "オーブンを温める",
      "たまごと牛乳をまぜる",
      "ケーキを切る",
      "小麦粉を入れる",
    ],
    correctIndex: 1,
    explanation:
      "The oven is already heating. She mixes egg and milk now, adds flour afterward, and cuts the cake only after baking and cooling.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N4-task-hotel-return-key-before-luggage",
    level: "N4",
    family: "listening-task",
    semanticFocus:
      "hotel guest brings room key and luggage together to arrange storage at checkout",
    script:
      "男の人：チェックアウトしたあと、荷物を夕方まで預かってもらえますか。駅のロッカーへ持っていったほうがいいですか。女の人：ここで預かれます。部屋を出るとき、かぎと荷物をいっしょにフロントへ持ってきてください。そこで預かりカードを渡します。夕方、そのカードを持って戻ってきてください。",
    question: "男の人は、部屋を出るとき何をフロントへ持っていきますか。",
    options: ["かぎだけ", "荷物だけ", "かぎと荷物", "預かりカードだけ"],
    correctIndex: 2,
    explanation:
      "At checkout he brings both key and luggage to the front desk. The storage card is received there and used only when returning later.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N4-task-school-trip-select-photos",
    level: "N4",
    family: "listening-task",
    semanticFocus:
      "student chooses two clear and representative trip photos from four discussed scenes",
    script:
      "女の先生：旅行の写真を教室にはりたいですね。二枚選んでください。男の学生：みんなが写っている写真と、昼ごはんの写真はよく撮れています。バスの前の写真は、みんなの顔がよく見えません。ホテルの写真は暗いです。女の先生：では、よく撮れた二枚をお願いします。",
    question: "男の学生は、どの写真を選びますか。",
    options: [
      "みんなの写真と昼ごはんの写真",
      "みんなの写真とバスの写真",
      "昼ごはんの写真とホテルの写真",
      "バスの写真とホテルの写真",
    ],
    correctIndex: 0,
    explanation:
      "The group and lunch photos are the two clear images. The bus photo hides faces and the hotel photo is too dark.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N4-task-laundry-check-pockets",
    level: "N4",
    family: "listening-task",
    semanticFocus:
      "laundromat customer separates a pocket key from the coin needed by the machine",
    script:
      "男の人：ポケットに、かぎと百円玉が入っていました。このまま洗濯機に服を入れてもいいですか。女の人：どちらもポケットから出してください。かぎはかばんに入れます。百円玉は、服を洗濯機に入れたあとで機械に入れてください。男の人：分かりました。",
    question: "男の人は、かぎと百円玉をどうしますか。",
    options: [
      "両方かばんに入れる",
      "両方洗濯機に入れる",
      "かぎはかばんに、百円玉は機械に入れる",
      "かぎは機械に、百円玉はかばんに入れる",
    ],
    correctIndex: 2,
    explanation:
      "Both leave the pocket, but their destinations differ: the key goes into the bag and the coin goes into the machine after the clothes.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
] as const satisfies readonly LowerListeningSeed[];

const n4KeyPointSeeds = [
  {
    semanticId: "N4-key-pool-class-start-time",
    level: "N4",
    family: "listening-key-points",
    semanticFocus: "swimmer identifies the revised Saturday class start time",
    script:
      "女の人：土曜日の水泳教室は十時からでしたね。男の人：先月はそうでしたが、今月から三十分早くなりました。九時半に始まります。女の人：では、九時二十分までに行きます。",
    question: "水泳教室は何時に始まりますか。",
    options: ["九時", "九時二十分", "九時半", "十時"],
    correctIndex: 2,
    explanation:
      "Ten o'clock was the old schedule; the man states that the class now starts thirty minutes earlier, at nine thirty.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N4-key-parcel-evening-window",
    level: "N4",
    family: "listening-key-points",
    semanticFocus:
      "customer selects the six-to-eight evening parcel delivery window",
    script:
      "男の人：荷物は明日の午後に届けられます。二時から四時と、六時から八時があります。女の人：四時までは仕事です。六時には家に帰れますから、遅いほうでお願いします。",
    question: "荷物は何時ごろ届きますか。",
    options: [
      "午前十時から十二時",
      "午後二時から四時",
      "午後四時から六時",
      "午後六時から八時",
    ],
    correctIndex: 3,
    explanation:
      "She cannot receive the earlier afternoon window and requests the later option, which is explicitly six to eight in the evening.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N4-key-restaurant-egg-free-choice",
    level: "N4",
    family: "listening-key-points",
    semanticFocus:
      "diner with an egg allergy chooses grilled fish from the menu",
    script:
      "女の人：たまごが食べられないんですが、どの料理なら大丈夫ですか。男の人：オムライスとハンバーグには、たまごを使っています。焼き魚には使っていません。カレーにも少し入っています。女の人：では、焼き魚にします。",
    question: "女の人は、何を注文しますか。",
    options: ["オムライス", "ハンバーグ", "焼き魚", "カレー"],
    correctIndex: 2,
    explanation:
      "The staff member identifies grilled fish as the only listed dish without egg, and the woman explicitly orders it.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N4-key-museum-north-entrance",
    level: "N4",
    family: "listening-key-points",
    semanticFocus:
      "museum visitor identifies the north entrance during south entrance construction",
    script:
      "男の人：美術館の入口は、駅に近い南側ですよね。女の人：南の入口は工事中です。今週は北の入口だけ使えます。東と西には入口がありません。男の人：北ですね。分かりました。",
    question: "男の人は、どの入口から入りますか。",
    options: ["北の入口", "南の入口", "東の入口", "西の入口"],
    correctIndex: 0,
    explanation:
      "The usual south entrance is closed for construction, and the north entrance is stated to be the only one available this week.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N4-key-train-car-seat",
    level: "N4",
    family: "listening-key-points",
    semanticFocus:
      "train passenger identifies car five seat twelve A on a reserved ticket",
    script:
      "女の人：私の席は四号車ですか。男の人：きっぷには五号車、十二番Aと書いてあります。四号車は自由席ですよ。女の人：五号車の十二番Aですね。",
    question: "女の人の席はどこですか。",
    options: [
      "四号車の十二番A",
      "五号車の十二番A",
      "五号車の十二番B",
      "十二号車の五番A",
    ],
    correctIndex: 1,
    explanation:
      "The man reads the reserved ticket as car five, seat 12A; car four is mentioned only as the unreserved car.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N4-key-apartment-bottle-day",
    level: "N4",
    family: "listening-key-points",
    semanticFocus:
      "resident identifies Thursday as the collection day for glass bottles",
    script:
      "男の人：びんは水曜日に出してもいいですか。女の人：水曜日は紙の日です。びんは木曜日ですよ。火曜日は燃えるごみです。男の人：では、木曜日の朝に出します。",
    question: "びんは何曜日に出しますか。",
    options: ["火曜日", "水曜日", "木曜日", "金曜日"],
    correctIndex: 2,
    explanation:
      "Wednesday is for paper and Tuesday is for burnable waste; both speakers identify Thursday as the bottle collection day.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N4-key-class-new-textbook",
    level: "N4",
    family: "listening-key-points",
    semanticFocus:
      "student identifies volume two of the new textbook edition for class",
    script:
      "女の学生：来週のクラスは、この古い教科書を使いますか。男の先生：新しい『日本語2』を使います。『日本語1』は先月終わりました。古い教科書は内容が違うので、使えません。女の学生：新しい『日本語2』ですね。",
    question: "来週、どの教科書を使いますか。",
    options: [
      "古い『日本語1』",
      "古い『日本語2』",
      "新しい『日本語1』",
      "新しい『日本語2』",
    ],
    correctIndex: 3,
    explanation:
      "Volume one is finished and the old edition is unusable; the teacher and student both confirm volume two of the new edition.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N4-key-shop-discount-total",
    level: "N4",
    family: "listening-key-points",
    semanticFocus:
      "shopper identifies three thousand yen as the purchase total needed for a discount",
    script:
      "女の人：この店の割引は、いくら買うと使えますか。男の人：一つの商品が三千円ではなくて、全部で三千円以上なら使えます。女の人：二千八百円のかばんと三百円のノートなら使えますね。男の人：はい。",
    question: "いくら以上買うと、割引が使えますか。",
    options: ["二千円", "二千八百円", "三千円", "三千百円"],
    correctIndex: 2,
    explanation:
      "The condition is a total purchase of at least 3,000 yen; 3,100 yen is only the example customer's combined total.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
] as const satisfies readonly LowerListeningSeed[];

const n4QuickResponseSeeds = [
  {
    semanticId: "N4-quick-copies-not-yet",
    level: "N4",
    family: "listening-quick-response",
    semanticFocus: "coworker says the meeting copies will be made next",
    script: "会議の資料、もうコピーしましたか。",
    question: "最も適切な応答を選んでください。",
    options: [
      "いいえ、これからします",
      "資料は三枚必要です",
      "コピー機はあそこです",
    ],
    correctIndex: 0,
    explanation:
      "もうコピーしましたか asks whether the action is complete; いいえ、これからします directly says it is not and will be done next.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N4-quick-leave-early-permission",
    level: "N4",
    family: "listening-quick-response",
    semanticFocus:
      "supervisor conditionally permits an employee to leave early",
    script: "今日は少し早く帰ってもいいですか。",
    question: "最も適切な応答を選んでください。",
    options: [
      "ええ、仕事が終わっていればいいですよ",
      "早く来てもらえますか",
      "昨日は早く帰りました",
    ],
    correctIndex: 0,
    explanation:
      "The utterance asks permission to leave early, and the first reply grants it under a natural workplace condition.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N4-quick-station-walking-time",
    level: "N4",
    family: "listening-quick-response",
    semanticFocus: "local person gives the walking time to the station",
    script: "ここから駅まで、どのくらいかかりますか。",
    question: "最も適切な応答を選んでください。",
    options: ["歩いて十分ぐらいです", "駅で友達を待ちます", "十時に着きました"],
    correctIndex: 0,
    explanation:
      "どのくらいかかりますか asks duration; 歩いて十分ぐらいです supplies both the method and required duration.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N4-quick-box-placement",
    level: "N4",
    family: "listening-quick-response",
    semanticFocus: "organizer directs where a box should be placed",
    script: "この箱、どこに置けばいいですか。",
    question: "最も適切な応答を選んでください。",
    options: [
      "入口の横にお願いします",
      "箱を二つ買いました",
      "そこから持ってきました",
    ],
    correctIndex: 0,
    explanation:
      "どこに置けば asks for a destination, and 入口の横にお願いします gives one directly.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N4-quick-reschedule-reservation",
    level: "N4",
    family: "listening-quick-response",
    semanticFocus:
      "staff member checks availability after a request to reschedule",
    script: "明日の予約を来週に変えられますか。",
    question: "最も適切な応答を選んでください。",
    options: [
      "はい、空いている時間を確認します",
      "明日の予約は十時からです",
      "昨日、予約を入れました",
    ],
    correctIndex: 0,
    explanation:
      "The customer asks to reschedule; checking next week's available times is the only response that advances that request.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N4-quick-thanks-for-umbrella",
    level: "N4",
    family: "listening-quick-response",
    semanticFocus:
      "lender responds modestly after being thanked for an umbrella",
    script: "傘を貸してくれて、ありがとう。",
    question: "最も適切な応答を選んでください。",
    options: ["どういたしまして", "傘は入口にあります", "雨はもうやみました"],
    correctIndex: 0,
    explanation:
      "どういたしまして is the conventional reply to thanks; the other replies give unrelated information about the umbrella or weather.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N4-quick-spicy-dish-opinion",
    level: "N4",
    family: "listening-quick-response",
    semanticFocus: "diner agrees that a dish tastes somewhat spicy",
    script: "この料理、辛くないですか。",
    question: "最も適切な応答を選んでください。",
    options: [
      "ええ、私には少し辛いです",
      "いいえ、甘い物は食べません",
      "料理を作ってみませんか",
    ],
    correctIndex: 0,
    explanation:
      "The first reply directly evaluates the same dish and agrees that it is somewhat spicy for the speaker.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N4-quick-submission-deadline",
    level: "N4",
    family: "listening-quick-response",
    semanticFocus:
      "staff member clarifies that a document is due tomorrow morning",
    script: "資料は今日中に出さなければなりませんか。",
    question: "最も適切な応答を選んでください。",
    options: [
      "いいえ、明日の午前中までで大丈夫です",
      "資料は昨日読みました",
      "資料は机の中です",
    ],
    correctIndex: 0,
    explanation:
      "The question checks today's deadline; the first reply directly corrects it with the actual deadline.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N4-quick-request-a-moment",
    level: "N4",
    family: "listening-quick-response",
    semanticFocus: "busy colleague offers a limited amount of time to talk",
    script: "すみません、今、少しお時間ありますか。",
    question: "最も適切な応答を選んでください。",
    options: ["はい、十分ぐらいなら", "時間は三時です", "昨日は忙しかったです"],
    correctIndex: 0,
    explanation:
      "The speaker asks whether the listener is available now; 十分ぐらいなら offers an appropriate limited window.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N4-quick-colleague-absent",
    level: "N4",
    family: "listening-quick-response",
    semanticFocus:
      "caller changes contact plan after learning a colleague is absent",
    script: "田中さん、今日はお休みだそうですよ。",
    question: "最も適切な応答を選んでください。",
    options: [
      "そうですか。では、明日連絡します",
      "私は今日、休みません",
      "田中さんに会いましたか",
    ],
    correctIndex: 0,
    explanation:
      "The first response acknowledges the new information and gives a sensible next step; the alternatives do not respond to the absence report.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
] as const satisfies readonly LowerListeningSeed[];

export const BASE_LOWER_LISTENING_SEEDS: readonly LowerListeningSeed[] = [
  ...n5TaskSeeds,
  ...n5KeyPointSeeds,
  ...n5QuickResponseSeeds,
  ...n4TaskSeeds,
  ...n4KeyPointSeeds,
  ...n4QuickResponseSeeds,
];

/**
 * Production corpus. Expansion files stay separate so authored tranches can be
 * reviewed independently before they enter the shared renderer.
 */
export const lowerListeningSeeds: readonly LowerListeningSeed[] = [
  ...BASE_LOWER_LISTENING_SEEDS,
  ...N5_LOWER_LISTENING_EXPANSION,
  ...n4LowerListeningExpansion,
];
