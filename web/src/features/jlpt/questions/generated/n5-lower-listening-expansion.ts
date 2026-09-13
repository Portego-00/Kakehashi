import type { LowerListeningSeed } from "./lower-listening-seeds";

/**
 * Standalone N5 semantic expansion. This file is intentionally not wired into
 * the generated bank until it receives an independent editorial audit.
 */
export const N5_LOWER_LISTENING_EXPANSION_EDITORIAL_STATUS =
  "machine-validated" as const;

const taskSeeds = [
  {
    semanticId: "N5-task-school-garden-name-cards",
    level: "N5",
    family: "listening-task",
    semanticFocus:
      "student writes plant name cards while other garden jobs are assigned or complete",
    script:
      "女の先生：花のたねは、もう土に入れました。水は田中さんがやります。ごみの袋は先生が持ってきます。女の子：わたしは何をしますか。女の先生：花の名前をカードに書いて、土の前に立ててください。女の子：はい、カードを書きます。",
    question: "女の子は、何をしますか。",
    options: [
      "花のたねを土に入れる",
      "花に水をやる",
      "ごみの袋を持ってくる",
      "花の名前をカードに書く",
    ],
    correctIndex: 3,
    explanation:
      "The seeds are already planted, Tanaka waters, and the teacher brings bags. The girl's assigned job is writing the plant-name cards.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N5-task-breakfast-wash-strawberries",
    level: "N5",
    family: "listening-task",
    semanticFocus:
      "child washes strawberries now after toast is ready and before setting the table",
    script:
      "女の人：パンはもうやけました。牛乳はわたしがコップに入れます。男の子：では、ぼくはテーブルにお皿を出します。女の人：それはあとでいいです。今、いちごを洗ってください。男の子：分かりました。",
    question: "男の子は、今、何をしますか。",
    options: [
      "パンをやく",
      "牛乳をコップに入れる",
      "お皿をテーブルに出す",
      "いちごを洗う",
    ],
    correctIndex: 3,
    explanation:
      "Toast is finished, the woman handles the milk, and plates come later. Washing the strawberries is the boy's current task.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N5-task-pool-pay-before-locker",
    level: "N5",
    family: "listening-task",
    semanticFocus:
      "pool visitor pays admission before using a locker and taking a shower",
    script:
      "男の人：水ぎとタオルは、かばんにあります。もう中へ入ってもいいですか。女の人：まだです。ここでお金をはらってください。それから、ロッカーにかばんを入れて、シャワーをあびます。男の人：はい、先にお金をはらいます。",
    question: "男の人は、中へ入る前に何をしますか。",
    options: [
      "水ぎをかばんに入れる",
      "お金をはらう",
      "ロッカーにかばんを入れる",
      "シャワーをあびる",
    ],
    correctIndex: 1,
    explanation:
      "His swimsuit is already packed. Payment is the required step before entry; the locker and shower steps follow inside.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N5-task-rainy-sunday-library-plan",
    level: "N5",
    family: "listening-task",
    semanticFocus:
      "friends change a rainy Sunday outing from the park to the open library",
    script:
      "女の人：日曜日、公園へ行きましょう。男の人：でも、雨ですよ。はくぶつかんはどうですか。女の人：日曜日は休みです。図書館は開いていますから、図書館へ行きませんか。男の人：いいですね。昼ごはんは、そのあと家で食べましょう。",
    question: "二人は、日曜日にどこへ行きますか。",
    options: ["公園", "はくぶつかん", "図書館", "家"],
    correctIndex: 2,
    explanation:
      "Rain rules out the park, the museum is closed, and home is only the later lunch location. They choose the open library.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N5-task-room-cleaning-boy-trash",
    level: "N5",
    family: "listening-task",
    semanticFocus:
      "boy takes out room trash while books, chairs, and table are handled elsewhere",
    script:
      "女の人：へやをそうじします。わたしは本をたなにもどします。いすはお父さんが、もうとなりのへやへ持っていきました。男の子：ぼくはテーブルをふきますか。女の人：それはわたしがあとでします。ごみを外へ持っていってください。",
    question: "男の子は、何をしますか。",
    options: [
      "本をたなにもどす",
      "いすをとなりのへやへ持っていく",
      "テーブルをふく",
      "ごみを外へ持っていく",
    ],
    correctIndex: 3,
    explanation:
      "The woman returns books and later wipes the table; the father already moved the chairs. The boy takes the trash outside.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N5-task-art-class-crayons-apron",
    level: "N5",
    family: "listening-task",
    semanticFocus:
      "student brings the two missing art supplies while school and friend provide the rest",
    script:
      "女の先生：あした、絵をかきます。紙とのりは学校にあります。はさみは山田さんが持ってきます。クレヨンと、よごれてもいいエプロンは自分で持ってきてください。男の子：クレヨンとエプロンですね。",
    question: "男の子は、何を持ってきますか。",
    options: [
      "紙とのり",
      "のりとはさみ",
      "はさみとクレヨン",
      "クレヨンとエプロン",
    ],
    correctIndex: 3,
    explanation:
      "School provides paper and glue, and Yamada brings scissors. The student must bring both crayons and an apron.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N5-task-school-bus-second-service",
    level: "N5",
    family: "listening-task",
    semanticFocus:
      "student chooses the second bus after missing the first while walking is too slow",
    script:
      "男の子：学校へ行く一番のバスは、もう行きました。歩くと四十分かかります。女の人：二番のバスは八時二十分です。学校に八時四十分につきますよ。男の子：九時までに行きたいです。女の人：では、二番のバスで大丈夫です。バスがおくれたら、タクシーにしましょう。",
    question: "男の子は、今、どうやって学校へ行きますか。",
    options: [
      "一番のバスで行く",
      "二番のバスで行く",
      "歩いて行く",
      "タクシーで行く",
    ],
    correctIndex: 1,
    explanation:
      "The first bus has left and walking is too slow. The second bus arrives before nine; a taxi is only the backup if it is delayed.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N5-task-lunch-rice-ball-choice",
    level: "N5",
    family: "listening-task",
    semanticFocus:
      "parent chooses rice balls after rejecting bread and separating later snacks and drinks",
    script:
      "女の人：あしたの昼ごはん、パンはどうですか。男の子：きのうもパンでした。おにぎりがいいです。女の人：分かりました。くだものは、おやつにしましょう。お茶は水とうに入れます。では、昼ごはんはおにぎりにします。",
    question: "女の人は、昼ごはんに何を作りますか。",
    options: ["パン", "おにぎり", "くだもの", "お茶"],
    correctIndex: 1,
    explanation:
      "Bread is rejected because they ate it yesterday, fruit is a later snack, and tea is the drink. Lunch will be rice balls.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N5-task-post-office-close-box",
    level: "N5",
    family: "listening-task",
    semanticFocus:
      "sender closes a parcel before it can be weighed and receive the correct stamp",
    script:
      "男の人：はこの上に、名前とじゅうしょを書きました。これで送れますか。女の人：まだ、はこがあいています。テープでしめてください。それから、ここで重さをはかります。重さを見て、きってを買います。男の人：はい、はこをしめます。",
    question: "男の人は、このあと何をしますか。",
    options: [
      "名前とじゅうしょを書く",
      "はこをテープでしめる",
      "はこの重さをはかる",
      "きってを買う",
    ],
    correctIndex: 1,
    explanation:
      "The address is complete, but the open box must be taped shut before weighing and buying the weight-based stamp.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N5-task-meeting-bookstore-entrance",
    level: "N5",
    family: "listening-task",
    semanticFocus:
      "friends move a meeting from a crowded station and closed café to a bookstore entrance",
    script:
      "男の人：駅の入口で会いますか。女の人：今日は人が多いですよ。駅のきっさてんはどうですか。男の人：朝はまだ開いていません。となりの本屋の入口なら、分かりやすいです。女の人：では、本屋で会いましょう。天気がよかったら、そのあと公園へ行きます。",
    question: "二人は、どこで会いますか。",
    options: ["駅の入口", "駅のきっさてん", "本屋の入口", "公園"],
    correctIndex: 2,
    explanation:
      "The station is crowded and the café is not open. The park is only a possible later destination, so they meet at the bookstore entrance.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N5-task-classroom-red-books-role",
    level: "N5",
    family: "listening-task",
    semanticFocus:
      "student distributes red books while blue books and other materials follow different plans",
    script:
      "女の先生：青い本は先生がみんなにわたします。赤い本は、あなたがわたしてください。男の子：プリントもわたしますか。女の先生：プリントは、もうつくえの上にあります。えんぴつはクラスのあとで集めます。男の子：分かりました。赤い本ですね。",
    question: "男の子は、何をみんなにわたしますか。",
    options: ["青い本", "赤い本", "プリント", "えんぴつ"],
    correctIndex: 1,
    explanation:
      "The teacher distributes blue books, worksheets are already placed, and pencils are collected later. The boy distributes red books.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N5-task-kitchen-start-rice-cooker",
    level: "N5",
    family: "listening-task",
    semanticFocus:
      "child starts the rice cooker now after washing rice while other dinner tasks occur later",
    script:
      "男の子：お米は、もう洗いました。つぎは、やさいを切りますか。女の人：やさいはあとでいっしょに切りましょう。スープはわたしが作ります。今は、このボタンをおして、ごはんを作りはじめてください。男の子：はい、ボタンをおします。",
    question: "男の子は、今、何をしますか。",
    options: [
      "お米を洗う",
      "やさいを切る",
      "スープを作る",
      "ごはんのボタンをおす",
    ],
    correctIndex: 3,
    explanation:
      "The rice is washed, vegetables wait until later, and the woman makes soup. The boy's current action is starting the rice cooker.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
] as const satisfies readonly LowerListeningSeed[];

const keyPointSeeds = [
  {
    semanticId: "N5-key-swimming-lesson-new-time",
    level: "N5",
    family: "listening-key-points",
    semanticFocus:
      "parent identifies the delayed start time of a child's swimming lesson",
    script:
      "女の人：今日の水泳クラスは三時からですね。男の人：すみません。先生がおくれますから、三時半からです。おわる時間は四時半です。女の人：分かりました。三時半に来ます。",
    question: "水泳クラスは、何時からですか。",
    options: ["二時半", "三時", "三時半", "四時半"],
    correctIndex: 2,
    explanation:
      "The expected three o'clock start is delayed because the teacher is late. The class starts at three thirty and ends at four thirty.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N5-key-bakery-weekly-holiday",
    level: "N5",
    family: "listening-key-points",
    semanticFocus:
      "customer identifies Wednesday as the bakery's regular closed day",
    script:
      "男の人：このパン屋は、火曜日も開いていますか。女の人：はい。月曜日と火曜日は開いています。水曜日は休みです。木曜日は朝八時からです。男の人：では、火曜日に来ます。",
    question: "パン屋は、何曜日が休みですか。",
    options: ["月曜日", "火曜日", "水曜日", "木曜日"],
    correctIndex: 2,
    explanation:
      "Monday and Tuesday are open, and Thursday has an eight o'clock opening. Wednesday is the explicitly stated closed day.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N5-key-homework-page-number",
    level: "N5",
    family: "listening-key-points",
    semanticFocus:
      "student distinguishes the notebook page for a diary from textbook and previously used pages",
    script:
      "男の子：日記のしゅくだいは、どこに書きますか。女の先生：教科書の十二ページを読んでから、ノートの十四ページに書いてください。教科書の十四ページではありません。ノートの十三ページは、きのう使いました。男の子：ノートの十四ページですね。",
    question: "男の子は、日記をノートの何ページに書きますか。",
    options: ["十一ページ", "十二ページ", "十三ページ", "十四ページ"],
    correctIndex: 3,
    explanation:
      "Page twelve belongs to the textbook, and notebook page thirteen was used yesterday. The boy must write the diary on page fourteen of his notebook.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N5-key-found-umbrella-color",
    level: "N5",
    family: "listening-key-points",
    semanticFocus:
      "visitor identifies the green umbrella among several found umbrellas",
    script:
      "男の人：きのう、ここにかさをわすれました。女の人：何色ですか。黒いかさと、みどりのかさがあります。男の人：わたしのは、みどりです。白い名前のカードがついています。女の人：では、これですね。",
    question: "男の人のかさは、何色ですか。",
    options: ["白", "黒", "みどり", "青"],
    correctIndex: 2,
    explanation:
      "Black is another found umbrella and white describes the name tag. The man identifies his umbrella itself as green.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N5-key-noodle-set-price",
    level: "N5",
    family: "listening-key-points",
    semanticFocus:
      "diner identifies the eight hundred yen price of a noodle and rice set",
    script:
      "女の人：うどんは六百円ですか。男の人：はい。うどんだけは六百円です。小さいごはんといっしょなら八百円です。女の人：では、ごはんもお願いします。",
    question: "女の人は、いくら払いますか。",
    options: ["五百円", "六百円", "七百円", "八百円"],
    correctIndex: 3,
    explanation:
      "She adds the small rice to the noodles, so she orders the 800-yen set rather than the 600-yen noodles alone.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N5-key-hospital-meeting-bench",
    level: "N5",
    family: "listening-key-points",
    semanticFocus:
      "family members choose the bench outside the hospital entrance as meeting point",
    script:
      "男の人：病院の中で会いますか。女の人：中は電話をつかえません。入口の外にベンチがあります。そこで会いましょう。男の人：分かりました。薬局ではなく、入口のベンチですね。",
    question: "二人は、どこで会いますか。",
    options: ["病院の中", "入口の外のベンチ", "薬局", "駅の前"],
    correctIndex: 1,
    explanation:
      "They reject meeting inside and distinguish the location from the pharmacy. They settle on the bench outside the entrance.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N5-key-fruit-apple-quantity",
    level: "N5",
    family: "listening-key-points",
    semanticFocus:
      "shopper identifies three as the final number of apples to buy",
    script:
      "女の人：りんごを二つください。男の人：今日は三つで三百円ですよ。女の人：では、三つください。バナナは一本だけお願いします。",
    question: "女の人は、りんごをいくつ買いますか。",
    options: ["一つ", "二つ", "三つ", "四つ"],
    correctIndex: 2,
    explanation:
      "She first asks for two apples but changes to the three-for-300-yen offer. One refers to the separate banana purchase.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N5-key-school-bus-stop-number",
    level: "N5",
    family: "listening-key-points",
    semanticFocus: "visitor identifies bus stop five for the school route",
    script:
      "男の人：学校へ行くバスは、三番のバスていですか。女の人：三番は駅へ行きます。学校へ行くバスは五番です。四番のとなりですよ。男の人：ありがとうございます。",
    question: "学校へ行くバスは、何番のバスていですか。",
    options: ["二番", "三番", "四番", "五番"],
    correctIndex: 3,
    explanation:
      "Stop three serves the station and stop four is only a landmark. The school bus departs from stop five.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N5-key-party-calendar-date",
    level: "N5",
    family: "listening-key-points",
    semanticFocus:
      "friend identifies the twentieth as the rescheduled birthday party date",
    script:
      "女の人：たんじょう日のパーティーは、十八日ですか。男の人：たんじょう日は十八日ですが、パーティーは二十日の日曜日です。十九日はじゅんびをします。女の人：二十日ですね。",
    question: "パーティーは、何日ですか。",
    options: ["十七日", "十八日", "十九日", "二十日"],
    correctIndex: 3,
    explanation:
      "The birthday is on the eighteenth and preparation is on the nineteenth, but the party itself is moved to Sunday the twentieth.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N5-key-dictionary-borrower-name",
    level: "N5",
    family: "listening-key-points",
    semanticFocus:
      "classmates identify Yuki as the person currently holding a borrowed dictionary",
    script:
      "男の子：ぼくのじしょは、だれが持っていますか。田中さんですか。女の子：田中さんは、きのうあなたに返しましたよ。今日は、ゆきさんがつかっています。まりさんは自分のじしょを持っています。",
    question: "今、男の子のじしょを持っている人は、だれですか。",
    options: ["田中さん", "ゆきさん", "まりさん", "男の子"],
    correctIndex: 1,
    explanation:
      "Tanaka returned it yesterday and Mari has her own dictionary. Yuki is explicitly using the boy's dictionary today.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N5-key-sunny-day-hat",
    level: "N5",
    family: "listening-key-points",
    semanticFocus:
      "child identifies a hat as the item needed for a hot sunny school walk",
    script:
      "女の先生：あしたは晴れて、暑くなります。学校の外を歩きますから、ぼうしを持ってきてください。雨はふりませんから、かさはいりません。水は学校にあります。男の子：ぼうしですね。",
    question: "男の子は、何を持ってきますか。",
    options: ["ぼうし", "かさ", "水", "コート"],
    correctIndex: 0,
    explanation:
      "Sunny heat makes the hat necessary. An umbrella is explicitly unnecessary, school provides water, and a coat is not requested.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N5-key-department-store-shoe-floor",
    level: "N5",
    family: "listening-key-points",
    semanticFocus:
      "shopper identifies the second floor as the location for shoes",
    script:
      "女の人：くつは一かいですか。男の人：一かいは食べものです。くつは二かいです。三かいにはシャツやコートがあります。女の人：では、二かいへ行きます。",
    question: "くつは、何かいにありますか。",
    options: ["一かい", "二かい", "三かい", "四かい"],
    correctIndex: 1,
    explanation:
      "The first floor sells food and the third has clothing. Shoes are explicitly located on the second floor.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
] as const satisfies readonly LowerListeningSeed[];

const quickResponseSeeds = [
  {
    semanticId: "N5-quick-apology-for-lateness",
    level: "N5",
    family: "listening-quick-response",
    semanticFocus: "friend accepts a simple apology for arriving slightly late",
    script: "少しおくれて、すみません。",
    question: "最も適切な応答を選んでください。",
    options: ["大丈夫ですよ", "十分前に駅を出ました", "駅で待ちますか"],
    correctIndex: 0,
    explanation:
      "The speaker apologizes for being late, and 大丈夫ですよ naturally accepts the apology. The other replies do not respond to it.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N5-quick-offer-carry-box",
    level: "N5",
    family: "listening-quick-response",
    semanticFocus: "listener accepts an offer of help carrying a heavy box",
    script: "そのはこ、重いですね。持ちましょうか。",
    question: "最も適切な応答を選んでください。",
    options: [
      "はい、お願いします",
      "はこの中に本があります",
      "きのう持ちました",
    ],
    correctIndex: 0,
    explanation:
      "持ちましょうか is an offer to carry the box, so はい、お願いします is the direct and natural acceptance.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N5-quick-weekly-tennis-frequency",
    level: "N5",
    family: "listening-quick-response",
    semanticFocus: "speaker answers how often they play tennis each week",
    script: "一週間に何回、テニスをしますか。",
    question: "最も適切な応答を選んでください。",
    options: ["二回ぐらいです", "公園でします", "日曜日は晴れです"],
    correctIndex: 0,
    explanation:
      "何回 asks for frequency, and 二回ぐらいです supplies it. The other replies give a place or unrelated weather.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N5-quick-lost-key-description",
    level: "N5",
    family: "listening-quick-response",
    semanticFocus:
      "visitor describes a lost key when staff asks what it looks like",
    script: "なくしたかぎは、どんなかぎですか。",
    question: "最も適切な応答を選んでください。",
    options: [
      "小さくて、青いカードがついています",
      "入口の近くでなくしました",
      "きのう家のかぎを使いました",
    ],
    correctIndex: 0,
    explanation:
      "どんな asks for a description. The first reply describes the key, while the others state loss location or a past action.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N5-quick-lunch-invitation",
    level: "N5",
    family: "listening-quick-response",
    semanticFocus:
      "classmate accepts an invitation to eat lunch together today",
    script: "今日、いっしょに昼ごはんを食べませんか。",
    question: "最も適切な応答を選んでください。",
    options: [
      "ええ、いっしょに食べましょう",
      "昼ごはんは食堂で買えます",
      "きのうパンを食べました",
    ],
    correctIndex: 0,
    explanation:
      "食べませんか is an invitation. The first response accepts it; the time statement and yesterday's meal do not answer the invitation.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N5-quick-ask-slower-speech",
    level: "N5",
    family: "listening-quick-response",
    semanticFocus: "listener agrees to repeat an explanation more slowly",
    script: "すみません、もう少しゆっくり話してください。",
    question: "最も適切な応答を選んでください。",
    options: [
      "はい、分かりました",
      "日本語を話しています",
      "さっき話を聞きました",
    ],
    correctIndex: 0,
    explanation:
      "The prompt requests slower speech, and はい、分かりました appropriately agrees. The alternatives do not address the request.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N5-quick-thanks-for-map",
    level: "N5",
    family: "listening-quick-response",
    semanticFocus:
      "helper responds modestly after being thanked for lending a map",
    script: "地図を貸してくれて、ありがとうございました。",
    question: "最も適切な応答を選んでください。",
    options: [
      "いいえ、どういたしまして",
      "地図は大きいです",
      "駅で地図を見ます",
    ],
    correctIndex: 0,
    explanation:
      "The speaker expresses thanks, so どういたしまして is the conventional response. The other choices only mention the map.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N5-quick-cold-morning-comment",
    level: "N5",
    family: "listening-quick-response",
    semanticFocus:
      "speaker agrees with a comment about the cold morning weather",
    script: "今朝は、ずいぶん寒いですね。",
    question: "最も適切な応答を選んでください。",
    options: [
      "ええ、コートを着てきました",
      "朝ごはんは家で食べました",
      "このへやは三かいです",
    ],
    correctIndex: 0,
    explanation:
      "The first reply agrees with the cold-weather comment and gives a natural consequence. The others change to unrelated topics.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N5-quick-borrow-eraser",
    level: "N5",
    family: "listening-quick-response",
    semanticFocus: "classmate grants a request to borrow an eraser briefly",
    script: "その消しゴム、ちょっと借りてもいいですか。",
    question: "最も適切な応答を選んでください。",
    options: ["ええ、どうぞ", "消しゴムで消しました", "白い消しゴムです"],
    correctIndex: 0,
    explanation:
      "借りてもいいですか asks permission to borrow the eraser. ええ、どうぞ is the only response that grants permission.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N5-quick-restroom-location",
    level: "N5",
    family: "listening-quick-response",
    semanticFocus: "staff member gives the location of a nearby restroom",
    script: "すみません、トイレはどこですか。",
    question: "最も適切な応答を選んでください。",
    options: ["あのドアの右です", "トイレへ行きました", "ドアをしめてください"],
    correctIndex: 0,
    explanation:
      "The question asks where the restroom is, and the first reply supplies a location. The alternatives describe an action or request.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N5-quick-tea-or-water-choice",
    level: "N5",
    family: "listening-quick-response",
    semanticFocus: "guest chooses water when offered either tea or water",
    script: "お茶と水、どちらがいいですか。",
    question: "最も適切な応答を選んでください。",
    options: ["水をお願いします", "お茶はあたたかいです", "水を買いましたか"],
    correctIndex: 0,
    explanation:
      "どちらがいいですか requests a choice, and 水をお願いします makes one. The other candidates do not answer the offer.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N5-quick-open-window-permission",
    level: "N5",
    family: "listening-quick-response",
    semanticFocus: "listener grants permission to open a window in a warm room",
    script: "少し暑いですね。窓を開けてもいいですか。",
    question: "最も適切な応答を選んでください。",
    options: [
      "はい、開けてください",
      "窓は二つあります",
      "きのうは暑かったです",
    ],
    correctIndex: 0,
    explanation:
      "The speaker asks permission to open the window. はい、開けてください directly grants that permission.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
] as const satisfies readonly LowerListeningSeed[];

export const N5_LOWER_LISTENING_EXPANSION: readonly LowerListeningSeed[] = [
  ...taskSeeds,
  ...keyPointSeeds,
  ...quickResponseSeeds,
];
