import type { LowerListeningSeed } from "./lower-listening-seeds";

/**
 * Original N4 lower-listening semantic items awaiting independent editorial review.
 *
 * This tranche is deliberately isolated from the generated bank until it has
 * passed the repository's review workflow. Nothing in this file is human-approved.
 */

const taskSeeds = [
  {
    semanticId: "N4-task-pool-lost-member-card",
    level: "N4",
    family: "listening-task",
    semanticFocus:
      "pool visitor reports a lost membership card before receiving temporary entry",
    script:
      "女の人：会員カードをなくしたようです。今日、プールを使いたいんですが。男の人：入口の機械で券を買う必要はありません。まず受付でカードをなくしたことを伝えてください。名前を確認したあと、一日カードを受け取って、入口の機械を通ってください。新しいカードを取りに来るのは来週で大丈夫です。",
    question: "女の人は、このあと最初に何をしますか。",
    options: [
      "受付でカードをなくしたことを伝える",
      "入口の機械で券を買う",
      "一日カードを受け取る",
      "新しいカードを取りに来る",
    ],
    correctIndex: 0,
    explanation:
      "She must first report the lost card at reception. Buying a ticket is unnecessary, the one-day card comes after identity confirmation, and the replacement is collected next week.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N4-task-office-handout-page-check",
    level: "N4",
    family: "listening-task",
    semanticFocus:
      "employee checks a corrected page before sending and printing a meeting handout",
    script:
      "女の人：会議の資料を直しました。もう部長に送ってもいいですか。男の人：三ページの表だけ、数字が古いかもしれません。三ページの数字を確認してから、部長に新しい資料を送ってください。部長から返事が来たら二十部コピーします。古い資料を送るのはやめてください。女の人：分かりました。",
    question: "女の人は、このあと何をしますか。",
    options: [
      "三ページの数字を確認する",
      "部長に新しい資料を送る",
      "二十部コピーする",
      "古い資料を送る",
    ],
    correctIndex: 0,
    explanation:
      "Checking the figures on page three is the prerequisite. Sending the revised file and making copies happen later, while sending the old file is explicitly rejected.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N4-task-delayed-train-bus-route",
    level: "N4",
    family: "listening-task",
    semanticFocus:
      "travelers select an airport bus after comparing train delay cost and walking distance",
    script:
      "男の人：空港へ行く電車が四十分遅れています。このまま電車を待ちますか。女の人：待つと飛行機に遅れそうです。空港までタクシーで行くと高いですね。ここから十五分歩けば、空港行きのバスに乗れます。次のバスは二十分後なので間に合います。自転車を借りる店は今日は休みです。男の人：では、バス停まで歩きましょう。",
    question: "二人は、空港までどう行きますか。",
    options: [
      "電車を待つ",
      "タクシーで行く",
      "バス停まで歩いてバスに乗る",
      "自転車を借りて行く",
    ],
    correctIndex: 2,
    explanation:
      "They reject the forty-minute train wait and costly taxi, and the bicycle shop is closed. Walking to the stop for the next bus satisfies the timing constraint.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N4-task-pharmacy-prescription-procedure",
    level: "N4",
    family: "listening-task",
    semanticFocus:
      "pharmacy customer submits a prescription before showing a card and paying",
    script:
      "女の人：この薬を受け取りたいんですが、先にお金を払いますか。男の人：いいえ。まず処方せんをこの箱に入れてください。名前を呼ばれたら、受付で保険のカードを見せます。薬の説明を聞いたあとで、お金を払ってください。水を買うなら、そのときいっしょに払えます。",
    question: "女の人は、このあと最初に何をしますか。",
    options: [
      "処方せんを箱に入れる",
      "受付で保険のカードを見せる",
      "薬の説明を聞く",
      "お金を払う",
    ],
    correctIndex: 0,
    explanation:
      "The prescription goes into the box first. Showing the insurance card waits until her name is called, and the explanation and payment follow after that.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N4-task-apartment-gas-inspection-preparation",
    level: "N4",
    family: "listening-task",
    semanticFocus:
      "tenant clears the kitchen entrance while leaving appliances ready for a gas inspection",
    script:
      "男の人：午後、ガスの点検があります。何か準備しますか。女の人：台所の入口に置いた箱を別の部屋へ運んでください。ガスの元を閉めるのは、点検の人がします。窓も今は開けなくていいです。テーブルの上の書類は点検に使うので、そのまま置いてください。男の人：では、箱を動かします。",
    question: "男の人は、点検の前に何をしますか。",
    options: [
      "入口の箱を別の部屋へ運ぶ",
      "ガスの元を閉める",
      "台所の窓を開ける",
      "テーブルの書類を片づける",
    ],
    correctIndex: 0,
    explanation:
      "Only the box blocks the inspector's access, so the man moves it. The inspector closes the gas, the window need not be opened, and the documents must stay.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N4-task-festival-cup-shortage",
    level: "N4",
    family: "listening-task",
    semanticFocus:
      "festival volunteer fetches cups while other drink-stall preparations are completed or assigned",
    script:
      "女の人：飲み物の店を開けるまで、あと三十分です。ジュースを冷蔵庫に入れるのは終わりました。氷は田中さんが運んでいます。値段の紙を入口にはるのは、店を開ける五分前でいいです。でも、紙コップがまだ届いていません。倉庫に五十個あるので、紙コップを取りに行ってください。男の人：はい、すぐ行きます。",
    question: "男の人は、このあと何をしますか。",
    options: [
      "ジュースを冷蔵庫に入れる",
      "氷を運ぶ",
      "値段の紙を入口にはる",
      "紙コップを取りに行く",
    ],
    correctIndex: 3,
    explanation:
      "The juice is already chilled, Tanaka handles the ice, and the price notice waits until five minutes before opening. The missing cups are the man's immediate task.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N4-task-rental-bicycle-return-station",
    level: "N4",
    family: "listening-task",
    semanticFocus:
      "cyclist changes the return station after rain closes the nearest counter",
    script:
      "男の人：雨が強くなりました。借りた自転車を駅前の返却所へ返しますか。女の人：駅前は六時で閉まりました。公園の返却所は八時まで開いています。自転車をここに置くと追加料金がかかります。店に電話しても、返却時間は変えられません。公園までは近いので、そこへ返しましょう。",
    question: "二人は、自転車をどうしますか。",
    options: [
      "駅前の返却所へ返す",
      "公園の返却所へ返す",
      "今いる場所に置く",
      "店に電話して返却時間を変える",
    ],
    correctIndex: 1,
    explanation:
      "The station counter is closed, leaving the nearby park counter open until eight. Leaving the bicycle incurs a fee, and calling cannot change the return time.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N4-task-chilled-delivery-unpacking",
    level: "N4",
    family: "listening-task",
    semanticFocus:
      "resident refrigerates a chilled delivery before handling its receipt and packaging",
    script:
      "女の人：冷たい荷物が届きました。受け取りのサインをして、箱を開けましたが、次はどうしますか。男の人：中のチーズを冷蔵庫に入れてください。送り主に電話する必要はありません。空の箱をたたむのはあとでいいです。箱に入っていた店の紙は、明日持っていくので捨てないでください。女の人：分かりました。",
    question: "女の人は、このあと何をしますか。",
    options: [
      "チーズを冷蔵庫に入れる",
      "送り主に電話する",
      "空の箱をたたむ",
      "店の紙を捨てる",
    ],
    correctIndex: 0,
    explanation:
      "The chilled cheese needs immediate refrigeration. Calling is unnecessary, folding the box can wait, and the delivery paper must be kept for tomorrow.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N4-task-dinner-fish-before-salad",
    level: "N4",
    family: "listening-task",
    semanticFocus:
      "home cook grills fish while rice cooks and salad waits for a family member",
    script:
      "女の人：ごはんは炊飯器で炊いています。野菜も切りました。次はサラダを作りますか。男の人：サラダは妹が帰ってからいっしょに作ります。先に魚を焼いてください。みそ汁は魚を焼いている間にわたしが作ります。食器を並べるのは全部できてからでいいです。",
    question: "女の人は、このあと何をしますか。",
    options: ["サラダを作る", "魚を焼く", "みそ汁を作る", "食器を並べる"],
    correctIndex: 1,
    explanation:
      "The salad waits for the sister, the man will make soup while the fish cooks, and table setting comes last. The woman therefore grills the fish next.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N4-task-library-damaged-book-desk",
    level: "N4",
    family: "listening-task",
    semanticFocus:
      "library volunteer separates a damaged return from normal shelving categories",
    script:
      "男の人：返された本は、どこへ運びますか。女の人：日本語の本は青い棚、外国語の本は緑の棚へ戻します。雑誌は入口の台に置いてください。ただ、ページが破れている本は棚に戻さないで、係の人の机へ持っていきます。この本は英語の本ですが、ページが破れていますね。",
    question: "男の人は、この本をどうしますか。",
    options: [
      "青い棚へ戻す",
      "緑の棚へ戻す",
      "入口の台に置く",
      "係の人の机へ持っていく",
    ],
    correctIndex: 3,
    explanation:
      "Although the book is in English, the damage rule overrides the normal language shelf. A torn book goes to the staff desk, not either shelf or the magazine table.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N4-task-restaurant-family-table-change",
    level: "N4",
    family: "listening-task",
    semanticFocus:
      "restaurant worker moves a growing family reservation to a larger non-window table",
    script:
      "女の人：七時の予約は、大人四人で窓の近くの席でしたね。男の人：はい。でも子どもが二人増えて、子ども用のいすも一つ必要になりました。女の人：窓の近くは四人の席しかありません。入口の近くなら六人の席があり、子ども用のいすも置けます。二つの席に分かれるより、その席に変えましょう。電話で人数をもう一度聞く必要はありません。",
    question: "女の人は、予約の席をどうしますか。",
    options: [
      "窓の近くの四人席にする",
      "入口の近くの六人席にする",
      "二つの席に分ける",
      "電話で人数をもう一度聞く",
    ],
    correctIndex: 1,
    explanation:
      "Six people and a child's chair no longer fit the window table. The entrance-side six-person table meets both needs without splitting the group or calling again.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N4-task-hike-raincoat-choice",
    level: "N4",
    family: "listening-task",
    semanticFocus:
      "hiker chooses a raincoat after group roles and trail conditions rule out other gear",
    script:
      "男の人：明日の山歩きは、午後から雨の予報です。何を持っていけばいいですか。女の人：昼ごはんは案内の人が用意し、地図はリーダーが持ちます。水は一人一本ずつ持ってきてください。山では両手を使うので、かさではなくレインコートがいいですよ。男の人：水はもうかばんに入れました。では、レインコートを用意します。",
    question: "男の人は、このあと何を用意しますか。",
    options: [
      "昼ごはんを用意する",
      "地図を用意する",
      "水を用意する",
      "レインコートを用意する",
    ],
    correctIndex: 3,
    explanation:
      "Lunch and the map belong to other people, and his water is already packed. Because an umbrella would occupy his hands, he now prepares a raincoat.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
] as const satisfies readonly LowerListeningSeed[];

const keyPointSeeds = [
  {
    semanticId: "N4-key-dentist-rescheduled-time",
    level: "N4",
    family: "listening-key-points",
    semanticFocus:
      "patient identifies a Wednesday afternoon appointment after comparing four offered times",
    script:
      "女の人：歯医者の予約を変えたいんですが。火曜日の三時は空いていますか。男の人：火曜日はいっぱいです。水曜日なら午前十時と午後四時が空いています。女の人：午前は仕事です。木曜日の五時も考えましたが、その日は出張があります。水曜日の午後四時でお願いします。",
    question: "女の人の新しい予約は、いつですか。",
    options: [
      "火曜日の三時",
      "水曜日の午前十時",
      "水曜日の午後四時",
      "木曜日の五時",
    ],
    correctIndex: 2,
    explanation:
      "Tuesday is full, Wednesday morning conflicts with work, and Thursday conflicts with travel. She explicitly chooses Wednesday at four in the afternoon.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N4-key-community-bus-temporary-stop",
    level: "N4",
    family: "listening-key-points",
    semanticFocus:
      "passenger identifies the temporary library bus stop during road work",
    script:
      "男の人：市役所へ行くバスは、どこから乗りますか。女の人：いつもの駅前は工事中です。今週だけ、図書館の前から出ます。病院の前には止まりますが、そこは二つ目の停留所です。公園の入口を使うのは来週からです。男の人：では、図書館の前へ行きます。",
    question: "男の人は、どこからバスに乗りますか。",
    options: ["駅前", "図書館の前", "病院の前", "公園の入口"],
    correctIndex: 1,
    explanation:
      "Road work closes the usual station stop. This week the bus begins at the library; the hospital is a later stop and the park arrangement starts next week.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N4-key-phone-plan-monthly-cost",
    level: "N4",
    family: "listening-key-points",
    semanticFocus:
      "customer calculates the first three months of a discounted mobile plan",
    script:
      "女の人：この電話のプランは、毎月いくらですか。男の人：普通は四千円ですが、学生は最初の三か月だけ三千円です。電話をたくさんかけるプランは五千円、インターネットだけなら二千五百円です。女の人：学生で、電話も使うので、三千円のプランにします。",
    question: "女の人は、最初の三か月、毎月いくら払いますか。",
    options: ["二千五百円", "三千円", "四千円", "五千円"],
    correctIndex: 1,
    explanation:
      "She is a student and needs calls, so the three-month student price of 3,000 yen applies. The other amounts describe internet-only, regular, and high-call plans.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N4-key-cooking-class-room",
    level: "N4",
    family: "listening-key-points",
    semanticFocus:
      "class participant identifies room two after enrollment exceeds the small kitchen",
    script:
      "男の人：土曜日の料理教室は、どの部屋ですか。一番の部屋でしたね。女の人：申し込みが十五人になったので、広い二番の部屋に変わりました。三番は子どもの教室、四番は道具を置く部屋です。入口の紙にも二番と書き直しました。",
    question: "土曜日の料理教室は、何番の部屋で行いますか。",
    options: ["一番の部屋", "二番の部屋", "三番の部屋", "四番の部屋"],
    correctIndex: 1,
    explanation:
      "Room one was the former plan, but enrollment caused a move to the larger room two. Rooms three and four have separate stated uses.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N4-key-holiday-garbage-date",
    level: "N4",
    family: "listening-key-points",
    semanticFocus:
      "resident identifies Thursday as the shifted burnable-garbage day during a holiday week",
    script:
      "女の人：来週のごみの日を確認したいんですが。月曜日は祝日ですね。男の人：はい。いつも月曜日に出す燃えるごみは、来週だけ木曜日です。火曜日はびん、水曜日は紙です。金曜日の燃えないごみは、いつもどおりです。",
    question: "来週、燃えるごみは何曜日に出しますか。",
    options: ["月曜日", "火曜日", "木曜日", "金曜日"],
    correctIndex: 2,
    explanation:
      "The Monday holiday shifts burnable garbage to Thursday for that week. Tuesday and Friday are other categories, and Monday is the canceled usual day.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N4-key-library-reserved-book-counter",
    level: "N4",
    family: "listening-key-points",
    semanticFocus:
      "library patron finds a reserved book at the second-floor service counter",
    script:
      "男の人：予約した本は、どこで受け取れますか。女の人：新しい本は一階の入口、雑誌は三階にありますが、予約した本は二階の受付です。返すだけなら外の箱も使えます。男の人：借りるカードを持って、二階の受付へ行きます。",
    question: "男の人は、予約した本をどこで受け取りますか。",
    options: ["一階の入口", "二階の受付", "三階の雑誌の場所", "外の返却箱"],
    correctIndex: 1,
    explanation:
      "Reserved books are collected at the second-floor desk. The first and third floors hold other materials, while the outside box is only for returns.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N4-key-cafe-allergy-lunch-set",
    level: "N4",
    family: "listening-key-points",
    semanticFocus:
      "customer chooses fish lunch after excluding egg and dairy dishes",
    script:
      "女の人：卵と牛乳が入っていない昼ごはんはありますか。男の人：Aセットのサンドイッチには卵、Bセットのカレーには牛乳が入っています。Cセットの焼き魚にはどちらも入っていません。Dセットのうどんには卵があります。女の人：では、Cセットにします。",
    question: "女の人は、どの昼ごはんを注文しますか。",
    options: ["Aセット", "Bセット", "Cセット", "Dセット"],
    correctIndex: 2,
    explanation:
      "Only set C avoids both egg and milk. Sets A and D contain egg, and set B contains milk, so the stated ingredient requirements leave one choice.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N4-key-train-stroller-car",
    level: "N4",
    family: "listening-key-points",
    semanticFocus:
      "parent identifies car four after the designated accessible train car changes",
    script:
      "男の人：ベビーカーで乗りやすい車両は何号車ですか。女の人：前は三号車でしたが、今月から四号車です。一号車は静かな車両で、二号車にはトイレがあります。五号車は予約した人だけです。男の人：では、四号車の近くで待ちます。",
    question: "男の人は、何号車に乗りますか。",
    options: ["二号車", "三号車", "四号車", "五号車"],
    correctIndex: 2,
    explanation:
      "The accessible position changed from car three to car four this month. Cars one, two, and five have different stated functions or restrictions.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N4-key-museum-workshop-item",
    level: "N4",
    family: "listening-key-points",
    semanticFocus:
      "museum visitor identifies the pencil as the only personal workshop supply required",
    script:
      "女の人：午後の絵の教室には、何を持っていけばいいですか。男の人：紙と絵の具は美術館で用意します。水を入れるコップも会場にあります。ただ、えんぴつだけは自分で持ってきてください。消しゴムは使わないので、必要ありません。",
    question: "女の人は、何を持っていきますか。",
    options: ["紙", "絵の具", "えんぴつ", "消しゴム"],
    correctIndex: 2,
    explanation:
      "The museum supplies paper, paint, and a water cup, while an eraser is unnecessary. The visitor alone must bring a pencil.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N4-key-report-submission-day",
    level: "N4",
    family: "listening-key-points",
    semanticFocus:
      "employee identifies Tuesday as the revised report deadline after a Monday holiday",
    script:
      "男の人：売上げのレポートは、いつまでに出しますか。女の人：いつもは月曜日ですが、来週の月曜日は会社が休みです。金曜日では早すぎるので、火曜日の午前中までになりました。水曜日の会議で使います。男の人：火曜日の朝、出します。",
    question: "男の人は、レポートをいつ出しますか。",
    options: ["金曜日", "月曜日", "火曜日の午前中", "水曜日"],
    correctIndex: 2,
    explanation:
      "The usual Monday deadline is displaced by the company holiday. Friday is unnecessarily early and Wednesday is the meeting, leaving Tuesday morning as the revised submission time.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N4-key-apartment-water-shutoff",
    level: "N4",
    family: "listening-key-points",
    semanticFocus:
      "tenant identifies the two-hour morning water shutoff within a longer repair schedule",
    script:
      "女の人：水道の工事は、何時からですか。男の人：工事の人は八時に来ますが、水が止まるのは九時から十一時までです。十二時には建物を出ます。午後二時にエレベーターの点検がありますが、水道とは関係ありません。女の人：では、九時までに水を使います。",
    question: "水が使えないのは、何時から何時までですか。",
    options: [
      "八時から九時まで",
      "九時から十一時まで",
      "十一時から十二時まで",
      "十二時から二時まで",
    ],
    correctIndex: 1,
    explanation:
      "Workers arrive at eight and leave at noon, but the actual water interruption is specifically from nine until eleven. The elevator work is unrelated.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N4-key-school-gym-entrance",
    level: "N4",
    family: "listening-key-points",
    semanticFocus:
      "visitor identifies the east entrance for an evening school concert",
    script:
      "男の人：今夜の音楽会は、どの入口から入りますか。女の人：正面の入口は昼の授業が終わると閉まります。西の入口は工事中です。東の入口を六時から開けます。南の入口は出演する学生だけが使います。男の人：では、東の入口へ行きます。",
    question: "男の人は、どの入口を使いますか。",
    options: ["正面の入口", "西の入口", "東の入口", "南の入口"],
    correctIndex: 2,
    explanation:
      "The front entrance closes, the west is under construction, and the south is restricted to performers. Visitors must use the east entrance after six.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
] as const satisfies readonly LowerListeningSeed[];

const quickResponseSeeds = [
  {
    semanticId: "N4-quick-train-delay-apology",
    level: "N4",
    family: "listening-quick-response",
    semanticFocus:
      "listener accepts an apology for lateness caused by a delayed train",
    script: "電車が遅れて、待たせてしまってすみません。",
    question: "最も適切な応答を選んでください。",
    options: [
      "大丈夫ですよ。今来たところです",
      "電車は駅の近くにあります",
      "待つ時間を調べました",
    ],
    correctIndex: 0,
    explanation:
      "The speaker apologizes for keeping someone waiting. Reassuring them that the wait was not a problem is the only socially appropriate direct response.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N4-quick-dictionary-return-request",
    level: "N4",
    family: "listening-quick-response",
    semanticFocus:
      "borrower agrees to return a dictionary by the requested morning deadline",
    script: "その辞書、明日の朝までに返してもらえますか。",
    question: "最も適切な応答を選んでください。",
    options: [
      "はい、今日の帰りに持ってきます",
      "辞書で意味を調べました",
      "明日の朝は雨だそうです",
    ],
    correctIndex: 0,
    explanation:
      "This is a request to return the dictionary by tomorrow morning. Promising to bring it back today directly accepts and satisfies that deadline.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N4-quick-manager-document-status",
    level: "N4",
    family: "listening-quick-response",
    semanticFocus:
      "employee reports that a document has not yet been sent to the manager",
    script: "この資料、もう部長に送りましたか。",
    question: "最も適切な応答を選んでください。",
    options: [
      "まだです。確認してから送ります",
      "部長は資料を三部使うそうです",
      "この資料は三ページあります",
    ],
    correctIndex: 0,
    explanation:
      "The prompt asks whether sending is complete. The first reply directly says it is not yet done and states the next step; the others do not answer completion status.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N4-quick-heater-temperature-request",
    level: "N4",
    family: "listening-quick-response",
    semanticFocus: "listener agrees to lower an overly warm room heater",
    script: "少し暑いので、暖房を弱くしていただけませんか。",
    question: "最も適切な応答を選んでください。",
    options: [
      "分かりました。少し下げますね",
      "暖房は冬に使うものです",
      "この部屋は南にあります",
    ],
    correctIndex: 0,
    explanation:
      "The speaker politely asks for the heat to be reduced. Agreeing and saying it will be lowered is the only response that addresses the request.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N4-quick-station-directions-request",
    level: "N4",
    family: "listening-quick-response",
    semanticFocus:
      "passerby gives a clear first step in response to a station directions request",
    script: "すみません、駅までの道を教えていただけませんか。",
    question: "最も適切な応答を選んでください。",
    options: [
      "この道をまっすぐ行ってください",
      "駅で友だちを待っています",
      "道が広くなりました",
    ],
    correctIndex: 0,
    explanation:
      "The speaker asks for directions to the station. Telling them to continue straight provides usable guidance, unlike the unrelated comments about the station or road.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N4-quick-carry-parcel-request",
    level: "N4",
    family: "listening-quick-response",
    semanticFocus: "coworker accepts a request to carry a parcel to reception",
    script: "この荷物、受付まで運ぶのを手伝ってもらえませんか。",
    question: "最も適切な応答を選んでください。",
    options: [
      "いいですよ。こちらを持ちます",
      "受付は一階にあります",
      "荷物が昨日届きました",
    ],
    correctIndex: 0,
    explanation:
      "The prompt requests help carrying the parcel. Offering to take one side accepts the task, while the other replies only state location or delivery time.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N4-quick-meeting-time-correction",
    level: "N4",
    family: "listening-quick-response",
    semanticFocus: "colleague corrects a mistaken meeting start time",
    script: "明日の会議は、十時からでしたよね。",
    question: "最も適切な応答を選んでください。",
    options: [
      "いいえ、九時半に変わりました",
      "はい、会議室は広いです",
      "明日は電車で来ます",
    ],
    correctIndex: 0,
    explanation:
      "The speaker seeks confirmation of the start time. Correcting it to the revised time directly answers, while room size and transportation are irrelevant.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N4-quick-trip-impression",
    level: "N4",
    family: "listening-quick-response",
    semanticFocus: "traveler answers a question about how a recent trip went",
    script: "先週の旅行、どうでしたか。",
    question: "最も適切な応答を選んでください。",
    options: [
      "天気もよくて、楽しかったです",
      "来週、旅行へ行く予定です",
      "駅まで一時間かかります",
    ],
    correctIndex: 0,
    explanation:
      "どうでしたか asks for an impression of the completed trip. Describing it as enjoyable directly answers; future plans and travel time do not.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N4-quick-copier-help-offer",
    level: "N4",
    family: "listening-quick-response",
    semanticFocus:
      "coworker offers practical help after hearing that a copier will not operate",
    script: "コピー機が動かなくて、困っているんです。",
    question: "最も適切な応答を選んでください。",
    options: [
      "ちょっと見てみましょうか",
      "コピーは十枚あります",
      "会議はもう終わりました",
    ],
    correctIndex: 0,
    explanation:
      "The speaker is explicitly having trouble with the copier. Offering to inspect it is the fitting helpful response; the other statements do not address the problem.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N4-quick-umbrella-reminder",
    level: "N4",
    family: "listening-quick-response",
    semanticFocus:
      "listener confirms compliance with a reminder not to forget an umbrella",
    script: "午後は雨らしいから、かさを忘れないでね。",
    question: "最も適切な応答を選んでください。",
    options: [
      "うん、もうかばんに入れたよ",
      "雨は昨日も降ったよ",
      "かばんは駅で買ったよ",
    ],
    correctIndex: 0,
    explanation:
      "The utterance is a reminder to bring an umbrella. Saying it is already packed confirms compliance, whereas the other replies merely share related facts.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N4-quick-window-permission",
    level: "N4",
    family: "listening-quick-response",
    semanticFocus: "listener grants a polite request to open a nearby window",
    script: "部屋の中が少し暑いので、この窓を開けてもかまいませんか。",
    question: "最も適切な応答を選んでください。",
    options: [
      "ええ、どうぞ。私も暑かったんです",
      "窓の外に木が見えます",
      "この部屋は二階でした",
    ],
    correctIndex: 0,
    explanation:
      "The speaker asks permission to open the window. Granting permission is the appropriate reply; observations about the view or room floor do not answer the request.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N4-quick-saturday-help-availability",
    level: "N4",
    family: "listening-quick-response",
    semanticFocus:
      "friend accepts a Saturday venue preparation request with a clear availability condition",
    script: "来週の土曜日、午後の会場準備を手伝ってもらえませんか。",
    question: "最も適切な応答を選んでください。",
    options: [
      "ええ、二時からなら手伝えますよ",
      "会場は駅の近くですね",
      "準備する荷物は多そうですね",
    ],
    correctIndex: 0,
    explanation:
      "The prompt asks for help preparing the venue on Saturday afternoon. Offering to help from two o'clock gives a usable availability answer; comments about the venue or workload do not accept or decline.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
] as const satisfies readonly LowerListeningSeed[];

export const n4LowerListeningExpansion = [
  ...taskSeeds,
  ...keyPointSeeds,
  ...quickResponseSeeds,
] as const satisfies readonly LowerListeningSeed[];
