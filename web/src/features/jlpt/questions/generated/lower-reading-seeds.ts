import { readingCharacterCount, type ReadingSeed } from "./reading-seed";

/**
 * Original N5–N3 reading seeds. Official size descriptions are approximate;
 * these bodies deliberately clear the repository's conservative release floors.
 */
export interface LowerReadingSeed extends Omit<ReadingSeed, "level"> {
  level: "N5" | "N4" | "N3";
}

export function lowerReadingCharacterCount(seed: LowerReadingSeed) {
  return readingCharacterCount(seed);
}

const n5ShortSeeds = [
  {
    semanticId: "N5-short-station-before-movie",
    level: "N5",
    family: "reading-short",
    semanticFocus: "friends meet before a film rather than at its start time",
    sources: [
      {
        body: "ゆきさんへ\n日曜日の映画は二時からです。その前にパンを買いたいです。駅の西口で一時二十分に会いましょう。雨でも同じ場所で待っています。\nあき",
      },
    ],
    question: "ゆきさんは、何時に駅へ行きますか。",
    options: ["一時", "一時二十分", "二時", "二時二十分"],
    correctIndex: 1,
    evidence: ["駅の西口で一時二十分に会いましょう"],
    explanation:
      "The film starts at 2:00, but the message clearly sets the station meeting for 1:20 so they can buy bread first.",
  },
  {
    semanticId: "N5-short-classroom-change-items",
    level: "N5",
    family: "reading-short",
    semanticFocus:
      "student follows a room change while bringing the same required items",
    sources: [
      {
        body: "きょうの日本語クラスは、三かいのへやではありません。一かいの大きいへやでべんきょうします。じかんはいつもと同じです。本と赤いノートをもってきてください。えんぴつはへやにあります。",
      },
    ],
    question: "学生は、何をもっていきますか。",
    options: [
      "本と赤いノート",
      "本とえんぴつ",
      "赤いノートだけ",
      "えんぴつだけ",
    ],
    correctIndex: 0,
    evidence: ["本と赤いノートをもってきてください"],
    explanation:
      "The notice requires the book and red notebook. Pencils are already in the new first-floor room.",
  },
  {
    semanticId: "N5-short-shop-afternoon-opening",
    level: "N5",
    family: "reading-short",
    semanticFocus: "bakery opens late after morning equipment work",
    sources: [
      {
        body: "パンやのおしらせ\n火曜日の午前は、店のきかいをなおします。店は午後一時から六時まであいています。パンは一時半から買えます。水曜日はいつものとおり、朝八時にあきます。",
      },
    ],
    question: "火曜日、パンは何時から買えますか。",
    options: ["朝八時", "午後一時", "午後一時半", "午後六時"],
    correctIndex: 2,
    evidence: ["パンは一時半から買えます"],
    explanation:
      "The shop opens at 1:00 on Tuesday, but sales of bread begin at 1:30. Wednesday's 8:00 opening is unrelated.",
  },
  {
    semanticId: "N5-short-umbrella-return-desk",
    level: "N5",
    family: "reading-short",
    semanticFocus:
      "borrowed umbrella must be returned to reception before closing",
    sources: [
      {
        body: "図書館のかさをかりた人へ\nかさは、あしたの午後五時までに、一かいのうけつけへかえしてください。かさを本のへやにおかないでください。図書館は六時にしまりますが、うけつけは五時でおわります。",
      },
    ],
    question: "かさは、どこへかえしますか。",
    options: ["本のへや", "図書館の外", "二かいのへや", "一かいのうけつけ"],
    correctIndex: 3,
    evidence: ["一かいのうけつけへかえしてください"],
    explanation:
      "The umbrella goes to first-floor reception by 5:00, not to the book room or another part of the library.",
  },
  {
    semanticId: "N5-short-family-dinner-tasks",
    level: "N5",
    family: "reading-short",
    semanticFocus: "family members divide dinner shopping and cooking tasks",
    sources: [
      {
        body: "お母さんへ\nきょうはわたしがカレーを作ります。お米は家にありますが、にんじんがありません。帰りに、にんじんを二本買ってください。サラダはお父さんが作ります。七時にみんなで食べましょう。\nまり",
      },
    ],
    question: "お母さんは、何をしますか。",
    options: ["カレーを作る", "にんじんを買う", "サラダを作る", "お米を買う"],
    correctIndex: 1,
    evidence: ["にんじんを二本買ってください"],
    explanation:
      "Mari cooks the curry, the father makes salad, and the mother is asked to buy two carrots. Rice is already at home.",
  },
  {
    semanticId: "N5-short-bus-temporary-stop",
    level: "N5",
    family: "reading-short",
    semanticFocus: "passenger uses a temporary bus stop during road work",
    sources: [
      {
        body: "バスのおしらせ\n駅まえのこうじは、月曜日から金曜日までです。このあいだ、三ばんのバスは駅の北口にはとまりません。南口のコンビニの前からのってください。土曜日から、また北口にとまります。",
      },
    ],
    question: "水曜日、三ばんのバスはどこからのりますか。",
    options: ["駅の北口", "南口のコンビニの前", "駅の中", "こうじの前"],
    correctIndex: 1,
    evidence: ["南口のコンビニの前からのってください"],
    explanation:
      "During the Monday–Friday road work, route 3 uses the stop in front of the south-exit convenience store.",
  },
  {
    semanticId: "N5-short-library-renewal-phone",
    level: "N5",
    family: "reading-short",
    semanticFocus: "reader may renew an unreserved book once by phone",
    sources: [
      {
        body: "かりた本は、まだほかの人がよやくしていないとき、一どだけ、かえす日をおそくできます。本をかえす日の前までに、図書館へ電話してください。かえす日をすぎた本と、CDは長くかりられません。",
      },
    ],
    question: "本を長くかりたい人は、いつ電話しますか。",
    options: [
      "本をかえす日の前まで",
      "本をかえしたあと",
      "二かい長くしたあと",
      "CDをかりた日だけ",
    ],
    correctIndex: 0,
    evidence: ["本をかえす日の前までに、図書館へ電話"],
    explanation:
      "A qualifying book can be renewed once only if the reader phones before its return date. Overdue books and CDs cannot be renewed.",
  },
  {
    semanticId: "N5-short-sports-day-rain-plan",
    level: "N5",
    family: "reading-short",
    semanticFocus:
      "school sports event moves indoors in rain with different footwear",
    sources: [
      {
        body: "土曜日のスポーツの日は、九時に学校へ来てください。はれのときは白いぼうしをもってきます。雨のときは、たいいくかんでしますから、ぼうしはいりません。中ではくくつをもってきてください。",
      },
    ],
    question: "土曜日が雨のとき、何をもっていきますか。",
    options: ["白いぼうし", "そとのくつだけ", "中ではくくつ", "かさだけ"],
    correctIndex: 2,
    evidence: ["雨のときは、たいいくかん", "中ではくくつをもってきてください"],
    explanation:
      "Rain moves the event to the gym, so indoor shoes are required and the white outdoor hat is not needed.",
  },
] as const satisfies readonly LowerReadingSeed[];

const n5MidSeeds = [
  {
    semanticId: "N5-mid-lunch-shopping-budget",
    level: "N5",
    family: "reading-mid",
    semanticFocus:
      "student buys only missing lunch items within a stated budget",
    sources: [
      {
        body: "あした、学校でみんなと昼ごはんを作ります。四人でサンドイッチとスープを作ります。パンとたまごは、先生が学校にもってきます。わたしは、トマトを二つと牛乳を一本買います。店でぜんぶで五百円までつかえます。チーズもほしいですが、家のれいぞうこにありますから、買いません。買ったものは、あしたの朝九時に学校の台所へもっていきます。",
      },
    ],
    question: "わたしは、店で何を買いますか。",
    options: ["パンとたまご", "トマトと牛乳", "牛乳とチーズ", "パンとチーズ"],
    correctIndex: 1,
    evidence: [
      "トマトを二つと牛乳を一本買います",
      "チーズもほしいですが、家のれいぞうこにありますから、買いません",
    ],
    explanation:
      "The writer buys tomatoes and milk. The teacher brings bread and eggs, and cheese is already in the home refrigerator.",
  },
  {
    semanticId: "N5-mid-zoo-train-bus-plan",
    level: "N5",
    family: "reading-mid",
    semanticFocus:
      "friends follow a train and bus sequence to reach the zoo opening",
    sources: [
      {
        body: "日曜日に友だちとどうぶつえんへ行きます。どうぶつえんは十時にあきます。わたしたちは八時四十分の電車にのって、九時十分にさくら駅につきます。駅からどうぶつえんまで、九時二十分のバスで二十分です。バスの中で食べることはできないので、朝ごはんは電車にのる前に食べます。どうぶつえんの入り口で、ほかの友だちと九時五十分に会います。",
      },
    ],
    question: "わたしたちは、さくら駅から何にのりますか。",
    options: [
      "八時四十分の電車",
      "九時二十分のバス",
      "九時五十分のバス",
      "十時の電車",
    ],
    correctIndex: 1,
    evidence: ["駅からどうぶつえんまで、九時二十分のバス"],
    explanation:
      "After arriving at Sakura Station at 9:10, they take the 9:20 bus to the zoo. The 8:40 service is the earlier train.",
  },
  {
    semanticId: "N5-mid-wallet-found-process",
    level: "N5",
    family: "reading-mid",
    semanticFocus:
      "lost wallet owner identifies and collects it from station staff",
    sources: [
      {
        body: "きのう、駅でさいふをなくしました。駅の人に、さいふは青くて、中に学生のカードと千円があると話しました。今朝、駅から電話がありました。そのさいふが見つかったそうです。きょうの午後八時まで、駅のじむしつにあります。とりに行くときは、わたしの名前がわかるものをもっていきます。お金だけを先にもらうことはできません。",
      },
    ],
    question: "さいふをとりに行くとき、何をもっていきますか。",
    options: ["青いかばん", "学生のカードだけ", "名前がわかるもの", "千円だけ"],
    correctIndex: 2,
    evidence: ["わたしの名前がわかるものをもっていきます"],
    explanation:
      "The station office requires something showing the owner's name. The student card is inside the wallet and cannot serve as the item brought along.",
  },
  {
    semanticId: "N5-mid-birthday-party-roles",
    level: "N5",
    family: "reading-mid",
    semanticFocus:
      "friends coordinate cake, drinks, decorations, and arrival times",
    sources: [
      {
        body: "土曜日、りなさんのたんじょう日パーティーをします。パーティーは午後三時から、けんさんの家です。まりさんは二時半にケーキをもってきます。わたしはジュースを買って、二時に行きます。けんさんといっしょに、へやをきれいにします。りなさんは三時に来ますから、それまでパーティーのことを話してはいけません。プレゼントはみんなで一つ買いました。",
      },
    ],
    question: "わたしは、二時に何をしますか。",
    options: [
      "りなさんをむかえる",
      "ケーキを作る",
      "へやをきれいにする",
      "プレゼントを買いに行く",
    ],
    correctIndex: 2,
    evidence: [
      "わたしはジュースを買って、二時に行きます",
      "けんさんといっしょに、へやをきれいにします",
    ],
    explanation:
      "The writer arrives at 2:00 with juice and helps Ken clean the room. Mari brings the cake at 2:30, and Rina comes at 3:00.",
  },
  {
    semanticId: "N5-mid-new-student-day",
    level: "N5",
    family: "reading-mid",
    semanticFocus:
      "new student follows a first-day schedule and lunch arrangement",
    sources: [
      {
        body: "学校の一日目は、朝八時半に一かいのうけつけへ来てください。そこで学生のカードをもらいます。九時から、二かいの教室で先生の話を聞きます。十一時に学校の中を見ます。十二時から昼休みです。昼ごはんは学校にありませんから、自分でもってくるか、近くの店で買ってください。午後のクラスは一時に始まり、三時に終わります。",
      },
    ],
    question: "昼ごはんについて、正しいものはどれですか。",
    options: [
      "学校でもらう",
      "朝八時半に食べる",
      "自分でもってくるか店で買う",
      "午後三時に買う",
    ],
    correctIndex: 2,
    evidence: ["自分でもってくるか、近くの店で買ってください"],
    explanation:
      "Lunch is not provided by the school, so the student must bring it or buy it nearby. Noon is the lunch break.",
  },
  {
    semanticId: "N5-mid-apartment-laundry-rules",
    level: "N5",
    family: "reading-mid",
    semanticFocus:
      "resident uses shared washing machines within hours and removes clothes promptly",
    sources: [
      {
        body: "アパートのせんたくのへやは、毎日朝七時から夜九時までつかえます。せんたくきは二つあります。一かい三十分で、お金はいりません。せんたくがおわったら、すぐにふくを出してください。ほかの人のふくをかってに出してはいけません。夜九時までにおわるように、八時半よりあとにはじめないでください。せんざいは自分でもってきます。",
      },
    ],
    question:
      "せんたくをはじめることができる、いちばんおそい時間は何時ですか。",
    options: ["八時", "八時半", "九時", "九時半"],
    correctIndex: 1,
    evidence: ["八時半よりあとにはじめないでください"],
    explanation:
      "A wash takes 30 minutes and the room closes at 9:00, so residents must not start after 8:30.",
  },
  {
    semanticId: "N5-mid-museum-weekend-choice",
    level: "N5",
    family: "reading-mid",
    semanticFocus:
      "visitor adjusts museum timing around a morning closure and guided tour",
    sources: [
      {
        body: "土曜日に町のはくぶつかんへ行きます。土曜日の朝は、そうじのため、十一時まで入れません。わたしたちは十一時半に入り、まず一かいの古い電車を見ます。二時から二かいで先生の話を聞きます。話は四十分です。しゃしんは一かいでとれますが、二かいではとれません。はくぶつかんは五時にしまります。中に食べるところはありません。",
      },
    ],
    question: "先生の話は、どこで聞きますか。",
    options: ["一かい", "二かい", "はくぶつかんの外", "食べるところ"],
    correctIndex: 1,
    evidence: ["二時から二かいで先生の話を聞きます"],
    explanation:
      "The guided talk is on the second floor at 2:00. The old train and permitted photography are on the first floor.",
  },
  {
    semanticId: "N5-mid-grandmother-gift-letter",
    level: "N5",
    family: "reading-mid",
    semanticFocus:
      "writer sends grandmother a practical birthday gift after noticing a need",
    sources: [
      {
        body: "おばあさんへ\nたんじょう日、おめでとうございます。先月、おばあさんの家へ行ったとき、いつもつかっているコップがわれていましたね。だから、青いコップを二つおくります。青はおばあさんのすきないろだと、お母さんから聞きました。一つはお茶のとき、もう一つはおきゃくさんが来たときにつかってください。日曜日の午前にとどきます。\nなお",
      },
    ],
    question: "なおさんは、どうして青いコップをおくりますか。",
    options: [
      "おばあさんのコップがわれて、青がすきだから",
      "お母さんが青いコップをほしいから",
      "日曜日におきゃくさんが二人来るから",
      "なおさんがお茶を飲みたいから",
    ],
    correctIndex: 0,
    evidence: [
      "いつもつかっているコップがわれていました",
      "青はおばあさんのすきないろ",
    ],
    explanation:
      "Nao noticed the grandmother's usual cup was broken and learned that blue is her favorite color. The two cups have suggested uses, not two expected guests.",
  },
] as const satisfies readonly LowerReadingSeed[];

const n5InformationSeeds = [
  {
    semanticId: "N5-info-pool-child-saturday",
    level: "N5",
    family: "information-retrieval",
    semanticFocus:
      "parent selects a Saturday pool period that admits a young child",
    sources: [
      {
        label: "みどりプール",
        body: "【あいている時間】\n月〜金：朝九時〜夜八時\n土・日：朝十時〜午後六時\n【お金】大人500円／中学生・高校生300円／小学生200円\n【子ども】小学三年生までの子どもは、大人といっしょに入ってください。午後五時からは、中学生より小さい子どもは入れません。\n【もちもの】水ぎ、ぼうし、タオル。プールの中でめがねはつかえません。食べものは入口の前のへやで食べてください。土曜日の午前十一時から十二時は、半分を水泳クラスがつかいます。",
      },
    ],
    question:
      "お父さんが小学二年生の子どもと土曜日の午後二時に行きます。二人でいくらですか。",
    options: ["500円", "700円", "800円", "1,000円"],
    correctIndex: 1,
    evidence: [
      "大人500円",
      "小学生200円",
      "小学三年生までの子どもは、大人といっしょ",
    ],
    explanation:
      "Saturday at 2:00 is open and the second grader is accompanied as required. One adult plus one elementary pupil costs 500 + 200 = 700 yen.",
  },
  {
    semanticId: "N5-info-train-bus-transfer",
    level: "N5",
    family: "information-retrieval",
    semanticFocus:
      "traveler selects the connection that arrives before an appointment",
    sources: [
      {
        label: "さくら駅から山の公園へ",
        body: "【電車】\nA：さくら駅 8:10 → 川駅 8:35\nB：さくら駅 8:40 → 川駅 9:05\nC：さくら駅 9:10 → 川駅 9:35\n【川駅からのバス】\n1：8:45 → 山の公園 9:05\n2：9:15 → 山の公園 9:35\n3：9:45 → 山の公園 10:05\n電車をおりてからバスのりばまで五分です。バスのきっぷは電車の駅では買えません。山の公園の入口で、友だちと九時半に会います。",
      },
    ],
    question: "九時半までに山の公園へ行くには、どれにのりますか。",
    options: ["電車Aとバス1", "電車Bとバス2", "電車Cとバス2", "電車Cとバス3"],
    correctIndex: 0,
    evidence: [
      "A：さくら駅 8:10 → 川駅 8:35",
      "1：8:45 → 山の公園 9:05",
      "九時半に会います",
    ],
    explanation:
      "Train A reaches Kawa at 8:35, leaving time for bus 1 at 8:45 and arrival at 9:05. The B/2 connection arrives after the 9:30 meeting.",
  },
  {
    semanticId: "N5-info-library-monday-return",
    level: "N5",
    family: "information-retrieval",
    semanticFocus:
      "reader returns books on a closed day and distinguishes borrowing limits",
    sources: [
      {
        label: "ひかり図書館",
        body: "【あいている日】\n火〜金：朝九時〜夜七時\n土・日：朝十時〜午後五時\n月曜日：休み\n【かりる】本は一人5さつ、二週間。CDは一人2まい、一週間。\n【かえす】図書館があいているときは、うけつけへ。しまっているときは、入口の右のはこへ入れてください。CDはこわれることがありますから、はこへ入れないでください。\n【カード】カードをわすれた人は、かりることができません。本をかえすときはカードはいりません。",
      },
    ],
    question: "月曜日に本をかえしたい人は、どうしますか。",
    options: [
      "うけつけへもっていく",
      "入口の右のはこへ入れる",
      "CDといっしょに家へおく",
      "カードを作ってからかえす",
    ],
    correctIndex: 1,
    evidence: ["月曜日：休み", "しまっているときは、入口の右のはこへ"],
    explanation:
      "The library is closed Monday, so books go in the return box to the right of the entrance. CDs are the item barred from that box.",
  },
  {
    semanticId: "N5-info-community-class-beginner-evening",
    level: "N5",
    family: "information-retrieval",
    semanticFocus: "beginner selects an evening class requiring no equipment",
    sources: [
      {
        label: "町のクラス",
        body: "A りょうり：火曜日 10:00〜12:00／4回／3,000円。エプロンをもってきてください。\nB しゃしん：水曜日 18:30〜20:00／5回／4,000円。カメラをつかったことがある人。自分のカメラがひつようです。\nC はじめてのダンス：金曜日 19:00〜20:00／4回／2,500円。はじめての人。うごきやすいふくで来てください。\nD やさしいパソコン：土曜日 13:00〜15:00／3回／3,500円。パソコンは教室にあります。文字をうつことができる人。\n【もうしこみ】クラスがはじまる一週間前まで。お金は一回目の日にはらいます。休んだ日のクラスを、べつの日にうけることはできません。",
      },
    ],
    question:
      "はじめてで、平日の夜にでき、自分のどうぐがいらないクラスはどれですか。",
    options: ["A", "B", "C", "D"],
    correctIndex: 2,
    evidence: ["C はじめてのダンス", "金曜日 19:00", "はじめての人"],
    explanation:
      "Class C is for beginners, meets on a weekday evening, and needs only suitable clothing. B requires camera experience and a personal camera.",
  },
  {
    semanticId: "N5-info-clinic-child-fever",
    level: "N5",
    family: "information-retrieval",
    semanticFocus:
      "parent identifies pediatric afternoon hours and same-day call requirement",
    sources: [
      {
        label: "あおいびょういん",
        body: "【ないか】月・火・木・金 9:00〜12:00／14:00〜17:00。中学生から。\n【子ども】月・水・金 9:00〜12:00／15:00〜18:00。0さいから中学生まで。\n【目とみみ】火・木 13:00〜16:00。6さいから。\n【よやく】朝の時間は、前の日までによやくしてください。午後、ねつやいたみでその日に来たい人は、来る前に電話してください。\n【休み】土曜日、日曜日、しゅく日。くすりの紙と、もっている人はびょういんのカードをもってきてください。カードがなくても、はじめての人は見てもらえます。",
      },
    ],
    question: "金曜日の午後、八さいの子どもがねつを出しました。どうしますか。",
    options: [
      "電話してから、子どもの時間に行く",
      "よやくしないで、ないかへ行く",
      "火曜日まで待って、目とみみへ行く",
      "カードがないので行かない",
    ],
    correctIndex: 0,
    evidence: [
      "【子ども】月・水・金",
      "15:00〜18:00",
      "その日に来たい人は、来る前に電話",
    ],
    explanation:
      "Friday 15:00–18:00 is pediatric time, and a same-day fever visit in the afternoon requires a phone call first.",
  },
  {
    semanticId: "N5-info-restaurant-fish-free-lunch",
    level: "N5",
    family: "information-retrieval",
    semanticFocus: "diner selects a lunch set without fish within budget",
    sources: [
      {
        label: "レストラン青い空　昼のメニュー",
        body: "A さかなセット：さかな、ごはん、みそしる／850円\nB とりにくセット：とりにく、ごはん、サラダ／900円\nC やさいカレー：カレー、サラダ／750円\nD パンセット：パン、ツナサラダ、ミルク／700円\n【昼の時間】11:30〜14:00。セットをたのんだ人は、お茶がむりょうです。\n【食べもの】カレーには牛乳をつかっています。パンにはたまごが入っています。さかなを食べない人はBかCをえらんでください。ごはんを大きくすると100円高くなります。",
      },
    ],
    question:
      "さかなを食べない人が、800円までで昼ごはんを食べます。どれをえらびますか。",
    options: ["A", "B", "C", "D"],
    correctIndex: 2,
    evidence: ["さかなを食べない人はBかC", "C やさいカレー", "750円"],
    explanation:
      "B and C contain no fish, but only vegetable curry C is within the 800-yen budget. D is cheaper but includes tuna salad.",
  },
  {
    semanticId: "N5-info-bicycle-three-hour-return",
    level: "N5",
    family: "information-retrieval",
    semanticFocus:
      "visitor chooses a three-hour bicycle rental and returns before closing",
    sources: [
      {
        label: "駅まえレンタサイクル",
        body: "1時間：300円\n3時間：700円\n1日：1,200円（その日の午後六時まで）\n【時間】朝九時〜午後六時。さいごにかりることができる時間は午後五時です。\n【かりる人】中学生から。名前がわかるカードを見せてください。\n【かえす】駅まえの店へかえします。べつの店へかえすことはできません。時間をすぎると、30分ごとに200円かかります。雨で早くかえしても、お金はかえりません。かぎをなくした人は、店へすぐ電話してください。",
      },
    ],
    question:
      "十二時から午後三時まで自転車をつかいたい人は、どのコースをえらびますか。",
    options: ["1時間", "3時間", "1日", "30分"],
    correctIndex: 1,
    evidence: ["3時間：700円", "朝九時〜午後六時"],
    explanation:
      "Noon to 3:00 is exactly three hours and ends before closing, so the three-hour rental is the direct match.",
  },
  {
    semanticId: "N5-info-park-boats-dog-rules",
    level: "N5",
    family: "information-retrieval",
    semanticFocus:
      "family chooses a park activity allowed with stated age and pet rules",
    sources: [
      {
        label: "大きい池の公園",
        body: "【ボート】土・日 10:00〜16:00。30分600円。小学生だけではのれません。犬はのれません。\n【子どものひろば】毎日 9:00〜17:00。お金はいりません。犬は入れません。\n【花の道】毎日 7:00〜18:00。犬といっしょに歩けますが、犬をひもからはなさないでください。\n【カフェ】火〜日 10:00〜17:00。月曜日は休み。外のせきには犬とすわれます。\n雨や風がつよい日は、ボートは休みです。ボートのきっぷは、池の前でその日に買います。食べものはボートにもちこめません。",
      },
    ],
    question: "日曜日、犬といっしょにできることはどれですか。",
    options: [
      "犬とボートにのる",
      "犬と子どものひろばに入る",
      "犬と花の道を歩く",
      "犬をひもからはなして走る",
    ],
    correctIndex: 2,
    evidence: ["花の道", "犬といっしょに歩けます", "犬をひもからはなさない"],
    explanation:
      "Dogs may walk the flower path on a leash. They are barred from boats and the children's area, and may not be released from the leash.",
  },
] as const satisfies readonly LowerReadingSeed[];

const n4ShortSeeds = [
  {
    semanticId: "N4-short-clinic-delayed-appointment",
    level: "N4",
    family: "reading-short",
    semanticFocus:
      "patient keeps an appointment but arrives later after clinic request",
    sources: [
      {
        body: "山田さんへ\n今日の三時のよやくですが、前の人のけんさに時間がかかっています。三時半ごろ来てください。よやくの日をかえるひつようはありません。くすりは、いつものように飲んで来てください。びょういんに着いたら、二かいではなく、一かいのうけつけで名前を言ってください。",
      },
    ],
    question: "山田さんは、どうしますか。",
    options: [
      "三時に二かいへ行く",
      "三時半ごろ一かいのうけつけへ行く",
      "よやくをべつの日にかえる",
      "くすりを飲まないで行く",
    ],
    correctIndex: 1,
    evidence: ["三時半ごろ来てください", "一かいのうけつけで名前を言って"],
    explanation:
      "The appointment remains today but is delayed to about 3:30, with check-in at first-floor reception and normal medication use.",
  },
  {
    semanticId: "N4-short-parcel-redelivery-choice",
    level: "N4",
    family: "reading-short",
    semanticFocus:
      "recipient requests redelivery within storage period instead of visiting depot",
    sources: [
      {
        body: "おにもつをおとどけしましたが、るすでした。にもつは、金曜日まで駅前の店にあります。もう一ど家へとどけてほしい人は、前の日の夜八時までにウェブで時間をえらんでください。店でうけとる人は、この紙と名前がわかるものをもって来てください。土曜日には、にもつをおくった人へかえします。",
      },
    ],
    question: "金曜日の夜に家でうけとりたい人は、どうしますか。",
    options: [
      "木曜日の夜八時までにウェブで時間をえらぶ",
      "土曜日に駅前の店へ行く",
      "この紙だけを店へもっていく",
      "にもつをおくった人へ電話する",
    ],
    correctIndex: 0,
    evidence: ["前の日の夜八時までにウェブで時間をえらんで", "金曜日まで"],
    explanation:
      "Friday home redelivery must be selected online by 8 p.m. the previous day, Thursday. Saturday is too late because the parcel is returned.",
  },
  {
    semanticId: "N4-short-project-file-and-paper",
    level: "N4",
    family: "reading-short",
    semanticFocus:
      "student submits a digital report and brings only the presentation sheet physically",
    sources: [
      {
        body: "クラスのみなさんへ\n旅行についてのレポートは、来週の月曜日までに、学校のサイトへ出してください。紙で出すひつようはありません。火曜日の発表では、レポートではなく、しゃしんをはった大きい紙を一まいもって来てください。発表のじゅんばんは月曜日の午後、サイトで知らせます。",
      },
    ],
    question: "学生は、火曜日に何をもって来ますか。",
    options: [
      "紙のレポート",
      "しゃしんだけ",
      "しゃしんをはった大きい紙",
      "発表のじゅんばんを書いた紙",
    ],
    correctIndex: 2,
    evidence: ["火曜日の発表", "しゃしんをはった大きい紙を一まいもって来て"],
    explanation:
      "The report is submitted online by Monday. Tuesday requires the single large presentation sheet with photographs.",
  },
  {
    semanticId: "N4-short-cleanup-light-rain",
    level: "N4",
    family: "reading-short",
    semanticFocus:
      "community cleanup continues in light rain but changes under heavy rain",
    sources: [
      {
        body: "日曜日の町のそうじは、朝八時に公園の入り口からはじめます。少しの雨なら、かさをつかわず、雨のふくを着て行います。つよい雨のときは、外のそうじをやめて、九時から会館の中をそうじします。どちらになるかは、日曜日の朝七時にメールで知らせます。道具は町でじゅんびします。",
      },
    ],
    question: "つよい雨のとき、参加する人はどうしますか。",
    options: [
      "八時に公園をそうじする",
      "九時に会館の中をそうじする",
      "自分で道具を買う",
      "朝七時のメールを読まず、家で待つ",
    ],
    correctIndex: 1,
    evidence: ["つよい雨のとき", "九時から会館の中をそうじ"],
    explanation:
      "Heavy rain moves the activity indoors to the hall at 9:00. Only light rain keeps the outdoor plan.",
  },
  {
    semanticId: "N4-short-restaurant-late-arrival",
    level: "N4",
    family: "reading-short",
    semanticFocus:
      "restaurant guest calls before a delay causes reservation cancellation",
    sources: [
      {
        body: "レストランのよやくについて\nよやくの時間から十五分すぎても来ないときは、せきをほかのおきゃくさんに使ってもらうことがあります。おくれるとわかったら、時間の前に電話してください。電話があれば、三十分までせきをとっておきます。人数がかわるときも、店へ来てからではなく、前に知らせてください。",
      },
    ],
    question: "二十分おくれる人は、どうすればせきをつかえますか。",
    options: [
      "何もしないで二十分後に行く",
      "よやく時間の前に電話する",
      "店へ着いてから人数をかえる",
      "二十分おくれてから電話する",
    ],
    correctIndex: 1,
    evidence: [
      "おくれるとわかったら、時間の前に電話",
      "電話があれば、三十分までせきをとって",
    ],
    explanation:
      "A prior phone call extends the held table to 30 minutes, covering a 20-minute delay. Without notice it may be released after 15 minutes.",
  },
  {
    semanticId: "N4-short-office-key-return",
    level: "N4",
    family: "reading-short",
    semanticFocus:
      "last office worker returns a shared key to guarded entrance",
    sources: [
      {
        body: "会議室のかぎは、使いおわったら三かいのはこへもどします。ただし、午後六時よりあとに会議がおわるときは、三かいへ入れません。一かいの入り口にいる人へわたしてください。さいごに部屋を出る人は、まどと電気もかくにんします。かぎを自分のつくえにおかないでください。",
      },
    ],
    question: "午後七時に会議がおわったら、かぎをどこへもっていきますか。",
    options: ["三かいのはこ", "自分のつくえ", "一かいの入り口", "会議室の中"],
    correctIndex: 2,
    evidence: ["午後六時よりあと", "一かいの入り口にいる人へわたして"],
    explanation:
      "After 6 p.m. the third floor is inaccessible, so the key goes to the person at the first-floor entrance.",
  },
  {
    semanticId: "N4-short-train-lost-item-contact",
    level: "N4",
    family: "reading-short",
    semanticFocus:
      "passenger reports a lost item with trip details before visiting collection office",
    sources: [
      {
        body: "電車の中でわすれものをした人は、まず駅の電話センターへ、のった時間、電車、ものの色を知らせてください。見つかったかどうかは、その日の夜までにメールでれんらくします。見つかっても、すぐ近くの駅でうけとれるとはかぎりません。メールに書かれた駅へ、名前がわかるものをもって来てください。",
      },
    ],
    question: "わすれものをした人は、はじめに何をしますか。",
    options: [
      "近くの駅へすぐ行く",
      "電話センターへ電車などを知らせる",
      "夜に見つかったか自分からメールする",
      "名前がわかるものをメールで送る",
    ],
    correctIndex: 1,
    evidence: [
      "まず駅の電話センターへ",
      "のった時間、電車、ものの色を知らせて",
    ],
    explanation:
      "The first step is reporting travel and item details to the phone center. Collection happens later at the station named in the email.",
  },
  {
    semanticId: "N4-short-gym-floor-repair",
    level: "N4",
    family: "reading-short",
    semanticFocus: "gym member uses alternative facilities during floor repair",
    sources: [
      {
        body: "スポーツセンターの二かいは、ゆかをなおすため、六月三日から七日まで使えません。このあいだ、二かいのヨガクラスは一かいのへやで行いますが、バスケットボールは休みです。一かいのプールとシャワーはいつもどおりです。ヨガの時間はかわりません。八日から、すべての場所が使えます。",
      },
    ],
    question: "六月五日にできることはどれですか。",
    options: [
      "二かいでヨガをする",
      "バスケットボールをする",
      "一かいでヨガをする",
      "なおしたゆかを使う",
    ],
    correctIndex: 2,
    evidence: ["六月三日から七日まで", "ヨガクラスは一かいのへやで行います"],
    explanation:
      "During June 3–7, yoga moves to the first floor while basketball pauses. Normal second-floor use resumes on the 8th.",
  },
] as const satisfies readonly LowerReadingSeed[];

const n4MidSeeds = [
  {
    semanticId: "N4-mid-reusable-cup-return",
    level: "N4",
    family: "reading-mid",
    semanticFocus:
      "cafe deposit system succeeds only when cup return remains convenient",
    sources: [
      {
        body: "駅前のカフェでは、飲みものをもって帰る人に、何度も使えるカップを出すことにしました。飲みもののねだんのほかに二百円をはらい、カップを店へかえすと二百円がもどります。はじめはごみがへりましたが、遠くの店で買った人は、同じ店までかえしに行くのがたいへんでした。そこで、町にある五つのカフェなら、どこでもかえせるようにしました。駅や学校の近くでもかえせるため、カップがもどる数がふえました。大切だったのは、カップを強くすることだけでなく、かえしやすい場所を作ることでした。",
      },
    ],
    question: "カップが多くかえってくるようになったのは、なぜですか。",
    options: [
      "カップを一回だけ使うようにしたから",
      "飲みものを二百円安くしたから",
      "五つのカフェのどこでもかえせるようにしたから",
      "遠くの店を全部なくしたから",
    ],
    correctIndex: 2,
    evidence: [
      "五つのカフェなら、どこでもかえせる",
      "カップがもどる数がふえました",
    ],
    explanation:
      "Returns increased after customers could use any of five cafes, making the deposit system convenient rather than tying return to the original shop.",
  },
  {
    semanticId: "N4-mid-library-study-seat",
    level: "N4",
    family: "reading-mid",
    semanticFocus:
      "library changes seat reservations to prevent unused blocked desks",
    sources: [
      {
        body: "大学の図書館では、べんきょうのせきをアプリでよやくできます。しかし、よやくだけして来ない学生が多く、せきが空いているのに、ほかの人が使えないことがありました。今月から、よやくした時間の十分前から十分後までに、入口のきかいで学生カードを見せることにしました。その時間に来ないと、よやくは自動でなくなります。また、早く帰る人はアプリで「終わり」をおします。この二つをはじめてから、同じせきを一日に使う人がふえました。",
      },
    ],
    question: "図書館は、どうして新しいルールを作りましたか。",
    options: [
      "学生カードを新しくするため",
      "使われないよやくでせきが空く問題をへらすため",
      "せきを一人だけが一日中使うため",
      "アプリのよやくを全部やめるため",
    ],
    correctIndex: 1,
    evidence: [
      "よやくだけして来ない学生",
      "せきが空いているのに、ほかの人が使えない",
    ],
    explanation:
      "The check-in and early-release rules address reserved but unused desks, not the reservation app itself.",
  },
  {
    semanticId: "N4-mid-neighborhood-cat-feeding",
    level: "N4",
    family: "reading-mid",
    semanticFocus:
      "neighbors coordinate feeding and cleanup rather than banning care for cats",
    sources: [
      {
        body: "公園のねこに食べものをあげる人がふえ、食べのこしとにおいが問題になりました。ねこをかわいそうだと思う人と、食べものをあげないでほしい人が話し合いました。そして、毎日二人のボランティアだけが、きまった時間と場所で食べものをあげることにしました。ねこが食べおわったら、のこったものと皿をすぐかたづけます。ねこの数や体のようすも記録します。食べものをぜんぶやめるのではなく、世話のしかたをそろえたことで、公園のごみは少なくなりました。",
      },
    ],
    question: "話し合いのあと、何がかわりましたか。",
    options: [
      "だれでも好きな時間に食べものをあげた",
      "ねこを公園から全部出した",
      "きまった人が世話をして、食べのこしもかたづけた",
      "ねこの記録をやめた",
    ],
    correctIndex: 2,
    evidence: ["毎日二人のボランティアだけ", "のこったものと皿をすぐかたづけ"],
    explanation:
      "Care was coordinated: designated volunteers feed at set times and clean up. The solution neither bans all feeding nor leaves it open to everyone.",
  },
  {
    semanticId: "N4-mid-walking-map-updates",
    level: "N4",
    family: "reading-mid",
    semanticFocus:
      "community walking map adds practical rest information after user testing",
    sources: [
      {
        body: "町では、古い建物や小さい店をしょうかいする、歩くための地図を作りました。しゃしんが多く、きれいな地図でしたが、使った人から「道が長くて、どこで休めるかわからない」という意見が出ました。作った人たちは、もう一ど同じ道を歩き、ベンチ、トイレ、さかの多い場所を調べました。そして、休みながら一時間で歩く道と、三十分の短い道を地図に入れました。見る場所をふやすより、安心して歩ける情報をふやしたことで、子どもや年をとった人も使いやすくなりました。",
      },
    ],
    question: "新しい地図では、何を大切にしましたか。",
    options: [
      "しゃしんを全部なくすこと",
      "店の数をふやすこと",
      "休む場所や道の長さをわかりやすくすること",
      "一つの長い道だけをのせること",
    ],
    correctIndex: 2,
    evidence: [
      "ベンチ、トイレ、さかの多い場所",
      "三十分の短い道",
      "安心して歩ける情報",
    ],
    explanation:
      "The revision adds rest points, terrain information, and route-length choices so more people can walk comfortably.",
  },
  {
    semanticId: "N4-mid-online-course-group-time",
    level: "N4",
    family: "reading-mid",
    semanticFocus:
      "online course balances flexible videos with scheduled collaborative work",
    sources: [
      {
        body: "このオンラインクラスでは、動画は好きな時間に見られます。そのため、仕事をしている人も参加しやすいです。しかし、去年は最後のグループ発表の前まで、ほかの学生と一度も話さない人がいました。発表のじゅんびがうまくできなかったので、今年は毎週、三十分のグループ時間を一つえらびます。時間は三つあり、同じ週なら一回だけ変更できます。動画の自由はのこしながら、少しずついっしょに考える時間を作ったのです。",
      },
    ],
    question: "今年、グループ時間を作ったのはなぜですか。",
    options: [
      "動画を決まった時間だけ見せるため",
      "学生が発表の前からいっしょにじゅんびするため",
      "仕事をしている人をクラスから出すため",
      "毎週三回参加させるため",
    ],
    correctIndex: 1,
    evidence: [
      "発表の前まで、ほかの学生と一度も話さない",
      "少しずついっしょに考える時間",
    ],
    explanation:
      "Scheduled small-group contact was added because complete isolation until the final presentation harmed preparation. Video viewing remains flexible.",
  },
  {
    semanticId: "N4-mid-office-quiet-hour",
    level: "N4",
    family: "reading-mid",
    semanticFocus:
      "office quiet period works by moving questions to shared coordination times",
    sources: [
      {
        body: "わたしたちの会社では、午前十時から十二時までを「しずかな時間」にしました。この時間は、電話をべつの部屋でとり、急がないそうだんは午後にします。はじめは、質問できないので仕事がおそくなるという心配がありました。そこで、九時半に十分だけ、今日の仕事と質問をみんなでかくにんします。また、すぐ決めなければならない問題はチャットに赤いしるしをつけます。そうしたら、集中する時間をまもりながら、大事なそうだんも止まらなくなりました。",
      },
    ],
    question: "この会社では、しずかな時間に大事な問題が出たらどうしますか。",
    options: [
      "午後まで何も知らせない",
      "電話を自分のつくえでつづける",
      "チャットに赤いしるしをつける",
      "九時半の会議をなくす",
    ],
    correctIndex: 2,
    evidence: ["すぐ決めなければならない問題はチャットに赤いしるし"],
    explanation:
      "Urgent decision needs are flagged red in chat, preserving focus without blocking essential coordination.",
  },
  {
    semanticId: "N4-mid-imperfect-vegetable-market",
    level: "N4",
    family: "reading-mid",
    semanticFocus:
      "farm market sells misshapen produce after explaining quality rather than hiding it",
    sources: [
      {
        body: "町のやさい店では、形が少しわるいやさいも売りはじめました。今までは、味に問題がなくても、大きさや形がちがうと店に出しませんでした。はじめは、安くても買う人が少なかったです。そこで、作った人が「形がちがうだけで、同じ日にとったものです」と書いたカードをおき、切った中も見せました。料理の写真もいっしょにおくと、スープやカレーに使う人がふえました。安いことだけでなく、なぜ食べられるのかを伝えたことが大切でした。",
      },
    ],
    question: "形のわるいやさいを買う人がふえたのはなぜですか。",
    options: [
      "いつとったかをかくしたから",
      "味や使い方がわかるしょうかいをしたから",
      "形のよいやさいを売らなくしたから",
      "すべてのやさいを同じ大きさに切ったから",
    ],
    correctIndex: 1,
    evidence: ["同じ日にとったもの", "切った中も見せました", "料理の写真"],
    explanation:
      "Customers gained concrete evidence that only appearance differed and saw practical uses, rather than responding to price alone.",
  },
  {
    semanticId: "N4-mid-exchange-event-roles",
    level: "N4",
    family: "reading-mid",
    semanticFocus:
      "language exchange assigns varied roles so quieter participants contribute",
    sources: [
      {
        body: "外国語の交流会では、話すのが上手な人だけが長く話し、はじめて来た人は聞くだけになることがありました。そこで、四人のグループに「質問する人」「時間を見る人」「みんなの答えを書く人」「最後にしょうかいする人」という仕事を作り、二十分ごとにかえました。書くのが好きな人も、質問を考えるのが好きな人も参加できます。全員が同じ長さで話すことより、ちがう方法で話し合いに入れるようにしたのです。",
      },
    ],
    question: "交流会が仕事をかえるようにした目的は何ですか。",
    options: [
      "話すのが上手な人だけをえらぶため",
      "全員を同じ仕事にするため",
      "いろいろな方法で話し合いに参加できるようにするため",
      "二十分で交流会を終わらせるため",
    ],
    correctIndex: 2,
    evidence: ["二十分ごとにかえました", "ちがう方法で話し合いに入れる"],
    explanation:
      "Rotating different meaningful roles lets participants contribute through questioning, timing, writing, or presenting instead of rewarding only fluent speakers.",
  },
] as const satisfies readonly LowerReadingSeed[];

const n4InformationSeeds = [
  {
    semanticId: "N4-info-meeting-room-paid-class",
    level: "N4",
    family: "information-retrieval",
    semanticFocus:
      "local group books an evening room for a paid class with drinks",
    sources: [
      {
        label: "ひので会館　部屋のあんない",
        body: "A 小会議室：10人／9:00〜21:00／1時間400円。ふたのある飲みものだけ可。\nB 大会議室：35人／9:00〜21:00／1時間900円。食べもの・飲みもの不可。\nC 和室：15人／9:00〜17:00／1時間600円。お茶と軽い食べもの可。いすはありません。\nD 料理室：20人／10:00〜20:00／1時間1,200円。料理をする団体だけ。\n【よやく】町のグループは二か月前、町の外のグループは一か月前から。参加する人からお金を集める会は、よやくの前に内容を書いた紙を出してください。会社が仕事のために使う場合、料金は二倍です。\n【キャンセル】七日前まで無料。六日前から前日まで半分、当日は全部の料金がかかります。使った後は机をもどし、ごみをもって帰ってください。",
      },
    ],
    question:
      "町の8人のグループが、夜に飲みものを飲みながら有料の勉強会をします。よやく前に何がひつようですか。",
    options: [
      "Aをえらび、会の内容を書いた紙を出す",
      "Bをえらび、飲みもののきょかをとる",
      "Cを夜九時までよやくする",
      "Dをえらび、料理をしない",
    ],
    correctIndex: 0,
    evidence: [
      "A 小会議室：10人",
      "21:00",
      "ふたのある飲みもの",
      "お金を集める会は、よやくの前に内容を書いた紙",
    ],
    explanation:
      "Room A fits eight people, evening use, and covered drinks. Charging participants requires the event-description form before reservation.",
  },
  {
    semanticId: "N4-info-bus-pass-weekend-visitor",
    level: "N4",
    family: "information-retrieval",
    semanticFocus: "visitor chooses a weekend day pass with museum discount",
    sources: [
      {
        label: "青川バスのきっぷ",
        body: "一回券：一回250円。バスの中で買えます。\n一日券：700円。買った日のさいごのバスまで、何回でものれます。町の人も旅行者も買えます。\n月パス：4,500円。買った日から30日。町に住んでいる人か、町で働く人だけ。名前のカードがひつようです。\n土日おでかけ券：600円。土曜日、日曜日、しゅく日だけ。何回でものれます。旅行者も買えます。\n【サービス】一日券を見せると動物園が100円安くなります。土日おでかけ券を見せると市立はくぶつかんが150円安くなります。月パスにはサービスがありません。\nなくしたきっぷは、もう一ど買ってください。二人で一まいを使うことはできません。子どもの料金は、それぞれ半分です。",
      },
    ],
    question:
      "旅行者が日曜日に三回バスにのり、市立はくぶつかんへ行きます。いちばん合うきっぷはどれですか。",
    options: ["一回券を三まい", "一日券", "月パス", "土日おでかけ券"],
    correctIndex: 3,
    evidence: [
      "土日おでかけ券：600円",
      "旅行者も買えます",
      "市立はくぶつかんが150円安く",
    ],
    explanation:
      "The weekend pass is valid Sunday for a visitor, covers unlimited rides for less than three single fares, and uniquely discounts the city museum.",
  },
  {
    semanticId: "N4-info-cooking-class-vegetarian",
    level: "N4",
    family: "information-retrieval",
    semanticFocus:
      "beginner selects vegetarian weekend cooking workshop with ingredients included",
    sources: [
      {
        label: "秋の料理教室",
        body: "A はじめてのパン：土曜10:00〜13:00。中学生以上。小麦とたまごとハムを使います。材料は教室でじゅんび。3,000円。\nB 町のやさい料理：日曜11:00〜14:00。小学生以上。肉と魚を使いません。小学生は大人と参加。材料は教室でじゅんび。2,500円。\nC 魚を切る練習：水曜18:30〜20:30。包丁を使ったことがある人。魚は各自で買って来ます。2,000円。\nD おべんとう：金曜10:00〜12:30。料理を一年以上している人。肉を使います。材料費をふくめ3,500円。\n【もうしこみ】二週間前まで。一人二つまで。アレルギーがある人は、もうしこむときに書いてください。先生は材料を少しかえることができますが、別の料理は作れません。三日前からのキャンセルは、材料費1,000円をはらいます。エプロンと手をふくタオルをもって来てください。",
      },
    ],
    question:
      "料理がはじめての高校生が、週末に肉や魚を使わない料理をしたいです。どれが合いますか。",
    options: ["A", "B", "C", "D"],
    correctIndex: 1,
    evidence: ["B 町のやさい料理", "日曜", "肉と魚を使いません", "小学生以上"],
    explanation:
      "Course B is a weekend vegetable class open from elementary age upward and explicitly uses neither meat nor fish. The other courses fail the diet, timing, or experience condition.",
  },
  {
    semanticId: "N4-info-volunteer-evening-books",
    level: "N4",
    family: "information-retrieval",
    semanticFocus:
      "worker selects recurring evening library volunteer role without driving",
    sources: [
      {
        label: "町のボランティア",
        body: "①図書館の本：火曜日18:00〜20:00。かえってきた本をたなにもどします。月二回以上来られる人。はじめの説明会に参加。交通費なし。\n②子どもの朝ごはん：土曜日7:00〜10:00。料理やうけつけ。月一回から。食事あり。\n③公園の花：日曜日9:00〜11:00。水やりとそうじ。一回だけでも可。道具あり。\n④病院の車：月〜金9:00〜16:00。病院と駅の間で人を車にのせます。運転めんきょと三年以上の運転けいけんがひつよう。交通費あり。\n【参加】18さい以上。①②は三か月つづけられる人。活動中のしゃしんを広報に使うことがあります。顔を出したくない人は、はじめに知らせてください。休むときは前の日までにれんらくします。",
      },
    ],
    question:
      "18さい以上で、平日の昼は仕事があり、車の運転はできません。本がすきで、三か月つづけられる人に合うものはどれですか。",
    options: ["①", "②", "③", "④"],
    correctIndex: 0,
    evidence: ["図書館の本", "火曜日18:00〜20:00", "三か月つづけられる人"],
    explanation:
      "Role ① is book-related, held on a weekday evening, and matches the three-month commitment. The driving role is daytime and requires a license.",
  },
  {
    semanticId: "N4-info-sports-center-swim-sauna",
    level: "N4",
    family: "information-retrieval",
    semanticFocus:
      "adult selects combined pool and sauna ticket during weekend hours",
    sources: [
      {
        label: "中央スポーツセンター",
        body: "プール：火〜金9:00〜21:00／土日9:00〜18:00。大人500円、子ども250円。\nトレーニング室：毎日10:00〜20:00。16さい以上。一回400円。はじめての人は30分の説明を受けます。\nサウナ：火〜日12:00〜19:00。18さい以上。一回450円。\nセット券：プール＋サウナ800円。18さい以上、その日だけ。\n【休み】月曜日。しゅく日の月曜日は開き、つぎの火曜日が休み。\nプールは水泳ぼうがひつようです。タオルのレンタルは200円。トレーニング室では室内のくつを使ってください。利用をはじめた後、ほかのしせつへかえるための返金はできません。",
      },
    ],
    question:
      "20さいの人が日曜日の午後、プールとサウナを使います。いちばん安いのはどれですか。",
    options: [
      "プール券とサウナ券をべつに買う",
      "セット券を買う",
      "トレーニング室の券を買う",
      "子どものプール券を買う",
    ],
    correctIndex: 1,
    evidence: ["セット券：プール＋サウナ800円", "18さい以上"],
    explanation:
      "The eligible adult can buy the 800-yen set instead of separate 500- and 450-yen tickets, for a 150-yen saving.",
  },
  {
    semanticId: "N4-info-camping-two-night-rental",
    level: "N4",
    family: "information-retrieval",
    semanticFocus:
      "campers reserve a two-night tent set and respect pickup and return windows",
    sources: [
      {
        label: "森キャンプ　レンタル",
        body: "テント小（1〜2人）：一日1,500円\nテント大（3〜5人）：一日2,500円\nねぶくろ：一日一つ500円\n料理セット：一日800円。なべ、皿、ガスこんろ。ガスは別に買います。\n【セット】テント大＋ねぶくろ4つ＋料理セット：一日4,500円\n【時間】使う日の朝8:00からうけとり。さいごの日の17:00までにかえしてください。二日以上かりるときは、夜の数で料金をけいさんします。\n【よやく】ウェブで三日前まで。雨でもキャンセル料金がかかりますが、キャンプ場がしまった場合は全部返金。ぬれたテントは、店でかわかすので、そのままかえしてください。こわれた物はかえすときに知らせます。",
      },
    ],
    question:
      "4人で金曜日から日曜日まで二泊して、テント・ねぶくろ・料理セットをかります。どれが合いますか。",
    options: [
      "テント小を一日だけ",
      "テント大だけを二日",
      "セットを二日",
      "セットを三日",
    ],
    correctIndex: 2,
    evidence: [
      "テント大＋ねぶくろ4つ＋料理セット",
      "夜の数で料金をけいさん",
      "二日以上かりるとき",
    ],
    explanation:
      "Four campers need the large-tent set, and Friday-to-Sunday means two nights, so the set is charged for two days/nights under the notice.",
  },
  {
    semanticId: "N4-info-health-check-morning-fast",
    level: "N4",
    family: "information-retrieval",
    semanticFocus:
      "worker chooses morning blood test and follows fasting and booking rules",
    sources: [
      {
        label: "会社のけんこうチェック",
        body: "A きほん：身長、体重、目、耳、血圧。月〜金9:00〜16:00。食事をしてもよい。\nB 血のけんさ：きほん＋血のけんさ。火・木9:00〜11:00。けんさ前の8時間は、水のほかは飲んだり食べたりしない。\nC 夜のチェック：きほんだけ。水曜日18:00〜20:00。夜の仕事をする人をゆうせん。\nD 女性のチェック：きほん＋女性のけんさ。金曜日13:00〜16:00。\n【よやく】会社のサイトで五日前まで。かわるときは前の日の正午まで。くすりを飲んでいる人は自分でやめず、よやくのときに書いてください。カードと会社の社員証をもって行きます。けっかは二週間後、会社ではなく本人にメールでとどきます。",
      },
    ],
    question: "木曜日の朝に血のけんさを受けたい人は、どうしますか。",
    options: [
      "Bを五日前までによやくし、8時間は水のほかを口にしない",
      "Aをその日に申しこみ、朝ごはんを食べない",
      "Cを木曜日の夜に受ける",
      "くすりを自分でやめてDを受ける",
    ],
    correctIndex: 0,
    evidence: [
      "B 血のけんさ",
      "火・木9:00〜11:00",
      "8時間は、水のほかは",
      "五日前まで",
    ],
    explanation:
      "Only B is Thursday-morning bloodwork; it requires booking five days ahead and eight hours with water as the sole permitted intake.",
  },
  {
    semanticId: "N4-info-museum-family-pass",
    level: "N4",
    family: "information-retrieval",
    semanticFocus:
      "frequent local family selects annual pass covering two adults and children",
    sources: [
      {
        label: "海のはくぶつかん",
        body: "一回券：大人900円／高校生500円／中学生まで無料。\n年間パス（大人）：2,200円。買った人だけ一年間何回でも入れます。\n家族パス：4,000円。大人二人と中学生までの子ども三人まで、一年間何回でも入れます。全員がいっしょでなくても使えますが、名前を登録します。\n旅行者パス：1,500円。買った日から三日間。本人だけ。\n【時間】9:30〜17:00。水曜日休み。年間パスと家族パスの人は、土曜日だけ9:00から入れます。\nパスを作るときは名前がわかるものがひつようです。なくした場合は500円で作りなおします。特別なイベントは別料金。カフェと店の買いものはパスにふくまれません。",
      },
    ],
    question:
      "町に住む大人二人と小学生二人が、一年間に何度も行きたいです。いちばん合うものはどれですか。",
    options: [
      "毎回、一回券を四まい買う",
      "大人の年間パスを一まい買う",
      "家族パスを買い、四人の名前を登録する",
      "旅行者パスを二まい買う",
    ],
    correctIndex: 2,
    evidence: [
      "家族パス",
      "大人二人と中学生までの子ども三人まで",
      "一年間何回でも",
    ],
    explanation:
      "The family pass directly covers both adults and the two elementary children for unlimited annual visits after registration.",
  },
] as const satisfies readonly LowerReadingSeed[];

const n3ShortSeeds = [
  {
    semanticId: "N3-short-report-revision-deadline",
    level: "N3",
    family: "reading-short",
    semanticFocus:
      "employee submits revised report only after manager confirms figures",
    sources: [
      {
        body: "佐藤さんへ\n昨日の売上レポートを読みました。説明は分かりやすくなりましたが、二ページ目の数字は、まだ経理の確認が終わっていません。今日の三時までは外部へ送らず、確認のメールが来てから新しい数字に直してください。表の色は今のままでかまいません。完成したものは、明日の会議で使うので、今日の五時までに共有フォルダーへ入れてください。",
      },
    ],
    question: "佐藤さんは、最初に何をしなければなりませんか。",
    options: [
      "表の色を変える",
      "外部へレポートを送る",
      "経理からの確認メールを待つ",
      "明日の会議を中止する",
    ],
    correctIndex: 2,
    evidence: ["確認のメールが来てから新しい数字に直して"],
    explanation:
      "Sato must wait for accounting's confirmation before revising the figures. The report is then due in the shared folder by 5:00, not sent externally before 3:00.",
  },
  {
    semanticId: "N3-short-repair-estimate-approval",
    level: "N3",
    family: "reading-short",
    semanticFocus:
      "repair shop pauses work when cost exceeds customer's approved ceiling",
    sources: [
      {
        body: "修理をお申し込みのお客様へ\nお預かりしたカメラを調べたところ、電池だけでなく、中の部品も交換する必要があることが分かりました。料金は予定していた八千円より高く、約一万二千円になります。まだ修理は始めていません。金曜日までに、修理を続けるか、そのまま返すかをメールでお知らせください。返す場合、調査料金の千円だけがかかります。",
      },
    ],
    question: "店がまだ修理を始めていないのはなぜですか。",
    options: [
      "カメラが店に届いていないから",
      "客に高くなった料金を確認してもらうため",
      "電池を交換する必要がないから",
      "金曜日は店が休みだから",
    ],
    correctIndex: 1,
    evidence: [
      "料金は予定していた八千円より高く",
      "修理を続けるか、そのまま返すかをメールで",
    ],
    explanation:
      "The estimate rose from 8,000 to about 12,000 yen, so the shop awaits the customer's decision before proceeding.",
  },
  {
    semanticId: "N3-short-remote-day-exception",
    level: "N3",
    family: "reading-short",
    semanticFocus:
      "staff member keeps remote-work day but attends one required in-person drill",
    sources: [
      {
        body: "来週水曜日は全社の安全訓練があります。ふだん水曜日に自宅で働いている人も、午前十時の訓練には会社で参加してください。訓練は一時間で終わります。その後は会社に残っても、自宅へ戻って仕事をしてもかまいません。午後のオンライン会議は予定どおり三時からです。訓練に参加できない事情がある人だけ、月曜日までに総務へ連絡してください。",
      },
    ],
    question: "ふだん水曜日に自宅で働く人は、来週どうしますか。",
    options: [
      "一日中、会社で働かなければならない",
      "安全訓練だけは会社で参加する",
      "午後の会議には参加しない",
      "月曜日に全員が総務へ連絡する",
    ],
    correctIndex: 1,
    evidence: [
      "午前十時の訓練には会社で参加",
      "その後は会社に残っても、自宅へ戻って仕事をしても",
    ],
    explanation:
      "The in-person requirement applies to the one-hour safety drill; afterward remote workers may return home, and the 3:00 online meeting remains scheduled.",
  },
  {
    semanticId: "N3-short-neighborhood-proposal-order",
    level: "N3",
    family: "reading-short",
    semanticFocus:
      "resident submits a park proposal before discussion rather than raising it unannounced",
    sources: [
      {
        body: "今月の町内会では、公園の使い方について話し合います。新しい案がある人は、会議で急に話し始めるのではなく、金曜日までに短い説明をメールで送ってください。会長が似ている案をまとめ、月曜日に全員へ送ります。会議では、送られた案について質問した後、来月試す案を一つ決めます。メールを送れない人は、金曜日の午後五時まで会館で紙に書けます。",
      },
    ],
    question: "公園について新しい案がある人は、まず何をしますか。",
    options: [
      "会議で急に説明する",
      "来月まで何もしない",
      "金曜日までに案を送るか会館で書く",
      "月曜日に会長を決める",
    ],
    correctIndex: 2,
    evidence: [
      "金曜日までに短い説明をメール",
      "メールを送れない人は、金曜日の午後五時まで会館で紙に",
    ],
    explanation:
      "Ideas must be submitted by Friday, by email or on paper at the hall, so they can be grouped and circulated before discussion.",
  },
  {
    semanticId: "N3-short-lecture-seat-release",
    level: "N3",
    family: "reading-short",
    semanticFocus:
      "lecture reservation holder checks in before seat is released",
    sources: [
      {
        body: "土曜日の特別講演に申し込んだ方へ\n受付は午後一時から始まり、講演は一時半からです。予約した方も、一時二十分までに受付をしない場合、席を当日参加の方へお渡しします。遅れる場合に電話をしても、席を取っておくことはできません。会場に入るとき、受付メールの画面か、印刷した紙を見せてください。講演後の質問会は予約なしで参加できます。",
      },
    ],
    question: "予約した席を使うために必要なことは何ですか。",
    options: [
      "一時二十分までに受付をし、受付メールなどを見せる",
      "遅れると電話で知らせる",
      "質問会も予約する",
      "受付メールを家に置いてくる",
    ],
    correctIndex: 0,
    evidence: [
      "一時二十分までに受付をしない場合、席を当日参加の方へ",
      "受付メールの画面か、印刷した紙を見せてください",
    ],
    explanation:
      "Reservation alone does not hold the seat after 1:20; timely check-in with the email screen or printout is required.",
  },
  {
    semanticId: "N3-short-book-exchange-condition",
    level: "N3",
    family: "reading-short",
    semanticFocus:
      "book-exchange participant brings eligible books and receives tokens after inspection",
    sources: [
      {
        body: "本の交換会では、家で読まなくなった本を一人五冊まで持って来られます。書き込みが多い本や、ページがない本、学校の教科書は受け付けません。入口で本を確認した後、受け付けた冊数と同じ数の券を渡します。会場では、券一枚で本一冊と交換できます。ほしい本がなくても、券をお金にかえることはできませんが、次の交換会でも使えます。",
      },
    ],
    question: "ほしい本が見つからなかった人は、どうなりますか。",
    options: [
      "券をお金にかえられる",
      "券を次の交換会で使える",
      "教科書を一冊もらえる",
      "持って来た本を六冊にふやせる",
    ],
    correctIndex: 1,
    evidence: ["券をお金にかえることはできません", "次の交換会でも使えます"],
    explanation:
      "Unused tokens have no cash value but remain valid for the next exchange. Eligibility is determined before tokens are issued.",
  },
  {
    semanticId: "N3-short-survey-return-channel",
    level: "N3",
    family: "reading-short",
    semanticFocus:
      "employee submits anonymous survey separately from identifying interview request",
    sources: [
      {
        body: "働き方についてのアンケートは、名前を書かず、金曜日までに入口の箱へ入れてください。アンケートの答えは、仕事の評価には使いません。くわしい話を聞いてもよい人は、アンケートとは別の紙に名前と連絡先を書き、人事部へ直接出してください。二つの紙をいっしょにすると、どの回答を書いた人か分かってしまうため、別々に集めます。話をしたくない人は、アンケートだけでかまいません。",
      },
    ],
    question: "くわしい話をしてもよい人は、どうしますか。",
    options: [
      "アンケートに名前を書く",
      "名前と連絡先を別の紙で人事部へ出す",
      "入口の箱へ何も入れない",
      "仕事の評価を書いて提出する",
    ],
    correctIndex: 1,
    evidence: ["アンケートとは別の紙に名前と連絡先", "人事部へ直接"],
    explanation:
      "Interview volunteers identify themselves on a separate paper to HR, preserving the anonymity of the survey placed in the entrance box.",
  },
  {
    semanticId: "N3-short-delivery-consolidation-day",
    level: "N3",
    family: "reading-short",
    semanticFocus:
      "customer groups separate orders into one delivery before cutoff",
    sources: [
      {
        body: "同じ週に二回以上注文した商品を、まとめて一度に届けるサービスを始めました。最初の商品が届く前日の正午までなら、後から注文した商品を同じ箱にできます。まとめると送料は一回分だけですが、冷たい商品と大きい家具は対象外です。また、一つでも発送の準備が終わった後は変更できません。利用したい人は、注文画面で同じ配達日を選んでください。",
      },
    ],
    question: "商品をまとめて届けてもらえるのは、どの場合ですか。",
    options: [
      "家具と冷たい商品を同じ日に買った",
      "発送の準備が終わった後に連絡した",
      "前日の正午までに同じ配達日を選んだ",
      "最初の商品が届いた後に注文した",
    ],
    correctIndex: 2,
    evidence: ["届く前日の正午まで", "注文画面で同じ配達日を選んで"],
    explanation:
      "Eligible orders must share a selected delivery date and be consolidated before noon on the preceding day, before dispatch preparation finishes.",
  },
] as const satisfies readonly LowerReadingSeed[];

const n3MidSeeds = [
  {
    semanticId: "N3-mid-shared-tools-location",
    level: "N3",
    family: "reading-mid",
    semanticFocus:
      "workshop reduces tool-search time by labeling return locations rather than buying more tools",
    sources: [
      {
        body: "地域の工房には、だれでも使える工具がたくさんある。しかし、使いたい道具が見つからないという声が多かった。数が足りないのだろうと考え、新しい工具を買ったが、問題はあまり変わらなかった。調べてみると、使った人が空いている場所へ道具を置くため、同じ種類の物がいくつもの棚に分かれていた。\nそこで、道具の形を描いたラベルを棚にはり、使い終わったら同じ絵の場所へ返すことにした。また、こわれた物は赤い箱へ入れ、使える物とまぜないようにした。すると、工具の数は増えていないのに、探す時間が短くなった。必要だったのは、物を増やすことではなく、どこへ戻すかを共有する仕組みだったのである。",
      },
    ],
    question: "工具を探す時間が短くなったのは、なぜですか。",
    options: [
      "工具の種類ごとに買う数を決めたから",
      "使った後の置き場所を分かりやすく決めたから",
      "こわれた工具を使える物と同じ棚にまとめたから",
      "よく使う工具だけを棚の近くへ移したから",
    ],
    correctIndex: 1,
    evidence: [
      "道具の形を描いたラベル",
      "同じ絵の場所へ返す",
      "探す時間が短くなった",
    ],
    explanation:
      "The successful change was a shared visual return system, including separating broken tools. Purchasing more tools had already failed to solve the locating problem.",
  },
  {
    semanticId: "N3-mid-library-reminder-timing",
    level: "N3",
    family: "reading-mid",
    semanticFocus:
      "library reminder succeeds when sent early enough for users to act",
    sources: [
      {
        body: "図書館では、本を返す日をすぎる人が多いため、当日の朝にメールを送っていた。しかし、学校や仕事に出た後でメールを見ても、本は家にあり、その日に返せないという意見があった。そこで、返す日の三日前にもメールを送ることにした。三日前のメールには、図書館へ来られない場合の延長方法も書いた。\nその結果、返す日をすぎる本が減った。当日のメールをなくしたわけではない。前の連絡で準備し、当日の連絡で最後に確認できるようにしたのである。同じ情報でも、受け取った人が行動できる時間に送らなければ、十分には役立たない。",
      },
    ],
    question: "三日前にもメールを送るようにした理由は何ですか。",
    options: [
      "返却の三日前から当日のメールを送らないため",
      "利用者が本を持って出るなどの準備をできるようにするため",
      "延長した利用者には返す日を知らせないため",
      "学校や仕事にいる時間だけに連絡するため",
    ],
    correctIndex: 1,
    evidence: [
      "学校や仕事に出た後",
      "本は家にあり、その日に返せない",
      "三日前のメール",
    ],
    explanation:
      "The earlier reminder gives readers time to bring the book or arrange renewal. The same-day reminder remains as a final check.",
  },
  {
    semanticId: "N3-mid-museum-audio-choice",
    level: "N3",
    family: "reading-mid",
    semanticFocus:
      "museum audio guide offers optional depths instead of forcing one long route",
    sources: [
      {
        body: "ある博物館の音声案内は、以前、入口から出口まで順番に聞く形だった。一つの作品について三分ほどの説明があり、全部聞くと二時間近くかかった。くわしく知りたい人にはよかったが、時間のない人は、途中で聞くのをやめてしまった。\n新しい案内では、まず三十秒の短い説明を聞き、興味があれば「もっと聞く」を選ぶ。作品を見る順番も自由にした。短い説明だけを聞いた人が、知識の少ない人とは限らない。自分が気になった作品に時間を使えるようになったからだ。案内の量を一つに決めるより、見る人が深さを選べることが大切なのである。",
      },
    ],
    question: "新しい音声案内のよい点は何ですか。",
    options: [
      "最初に短い説明を聞けば、すべての作品を順番に見られる",
      "くわしい説明を三十秒にまとめ、二時間で全部聞ける",
      "興味や時間に合わせて説明の長さを選べる",
      "説明を聞く作品を入口で一つだけ選べる",
    ],
    correctIndex: 2,
    evidence: ["興味があれば「もっと聞く」を選ぶ", "見る人が深さを選べる"],
    explanation:
      "The redesigned guide provides a brief layer with optional detail and free route order, letting each visitor allocate time rather than imposing a single depth.",
  },
  {
    semanticId: "N3-mid-bakery-preorder-waste",
    level: "N3",
    family: "reading-mid",
    semanticFocus:
      "bakery uses optional preorders as demand information while keeping walk-in stock",
    sources: [
      {
        body: "小さなパン屋では、夕方にパンが残る一方、人気のパンが昼前になくなることもあった。毎日同じ数を作っていたためである。店は、前日の夜まで注文できる仕組みを始めた。ただし、予約した人だけの店にはしなかった。予約の数を見て作る量を少し変え、当日来る客のためのパンも残した。\n一か月後、売れ残りが減り、人気のパンを買えない人も少なくなった。予約は、商品を先に売るだけでなく、次の日に何が必要かを知る情報になったのである。すべてを予約分だけ作れば急に来た客が買えない。店は、予約と当日の選びやすさの両方を残した。",
      },
    ],
    question: "店は予約の数をどのように使っていますか。",
    options: [
      "予約の多い商品だけを当日に店へ並べるため",
      "次の日に作る量を調整するため",
      "前日に残ったパンを予約した人へ回すため",
      "予約分と当日分をいつも同じ数にするため",
    ],
    correctIndex: 1,
    evidence: ["予約の数を見て作る量を少し変え", "何が必要かを知る情報"],
    explanation:
      "Preorders inform production quantities while the bakery retains stock for walk-ins. They are not used to eliminate ordinary customers.",
  },
  {
    semanticId: "N3-mid-walking-commute-attention",
    level: "N3",
    family: "reading-mid",
    semanticFocus:
      "walking part of commute creates a transition that improves mental readiness",
    sources: [
      {
        body: "私は以前、家から会社の前までバスに乗っていた。時間は短かったが、会社に着いても頭がまだ家のことを考えていて、仕事を始めるまでに時間がかかった。最近、二つ前の停留所で降り、十五分歩くようにした。歩きながら、今日する仕事を三つだけ考える。\nもちろん、雨の日や荷物の多い日はバスで最後まで行く。毎日必ず歩くことを目標にしたわけではない。家の時間から仕事の時間へ気持ちを切りかえる方法として、歩く時間が自分に合っていたのである。移動を短くすることだけが便利さではない。次の行動へ入る準備ができるなら、少し長い道にも意味がある。",
      },
    ],
    question: "筆者にとって、十五分歩く時間にはどんな意味がありますか。",
    options: [
      "家から会社までの移動時間を毎日同じにする",
      "雨の日も同じ道を歩き、毎日運動する習慣をつける",
      "家から仕事へ気持ちを切りかえる",
      "会社に着く前に、その日の仕事をすべて決める",
    ],
    correctIndex: 2,
    evidence: [
      "家の時間から仕事の時間へ気持ちを切りかえる",
      "次の行動へ入る準備",
    ],
    explanation:
      "The walk functions as a mental transition into work, not an absolute daily exercise rule or a faster commute.",
  },
  {
    semanticId: "N3-mid-team-near-mistake-log",
    level: "N3",
    family: "reading-mid",
    semanticFocus:
      "team logs almost-mistakes to improve instructions without blaming individuals",
    sources: [
      {
        body: "仕事で本当に問題が起きたときは報告するが、まちがえそうになって自分で気づいた場合は、何も書かない人が多かった。結果が悪くなかったので、知らせる必要がないと考えたからだ。しかし、同じところで何人もまちがえそうになっていたら、説明のしかたに問題があるかもしれない。\nそこで私たちのチームは、名前を書かずに「どこで迷ったか」を短く残すことにした。すると、新しい注文画面の二つのボタンが似ているという記録が集まった。ボタンの色とことばを変えると、迷ったという記録は減った。人を注意する前に、まちがいが起きやすい場所を見つけられたのである。",
      },
    ],
    question: "チームが名前を書かない記録を始めた目的は何ですか。",
    options: [
      "迷った本人へ後から個別に注意するため",
      "問題にならなかった迷いから、説明の弱い所を見つけるため",
      "注文画面を使う人の名前と操作を結びつけるため",
      "実際の失敗だけを集め、報告の基準を厳しくするため",
    ],
    correctIndex: 1,
    evidence: [
      "同じところで何人もまちがえそう",
      "どこで迷ったか",
      "まちがいが起きやすい場所",
    ],
    explanation:
      "Anonymous near-mistake logs reveal recurring design problems and support system changes rather than identifying a person to blame.",
  },
  {
    semanticId: "N3-mid-comment-delay-reflection",
    level: "N3",
    family: "reading-mid",
    semanticFocus:
      "community forum introduces a brief edit delay to reduce impulsive conflict",
    sources: [
      {
        body: "地域の交流サイトでは、意見がちがう人への強いことばが増えていた。書いた人の中には、後で読みなおして消したいと思っても、すでに多くの人へ広がっていたという人もいた。管理者は、書きこみをすぐ公開せず、送った人だけが五分間見られる時間を作った。その間は直したり、取り消したりできる。\n五分たつと、いつものように公開される。管理者が意見の内容を決めるのではない。書いた本人が、相手へ届く前にもう一度読む時間を持つ仕組みである。強い意見を禁止しなくても、思ったままのことばがすぐ争いになるのを少し減らせた。",
      },
    ],
    question: "五分間、書きこみを公開しないのはなぜですか。",
    options: [
      "公開前に管理者が強い表現だけを直せるようにするため",
      "書いた人が公開前に読みなおせるようにするため",
      "五分間にほかの利用者から賛成を集めるため",
      "公開後に争いになった投稿だけを自動で消すため",
    ],
    correctIndex: 1,
    evidence: [
      "送った人だけが五分間見られる",
      "直したり、取り消したり",
      "もう一度読む時間",
    ],
    explanation:
      "The delay creates a self-review window before publication; moderators do not rewrite the content, and disagreement itself is not banned.",
  },
  {
    semanticId: "N3-mid-child-exhibit-explanation",
    level: "N3",
    family: "reading-mid",
    semanticFocus:
      "children deepen observation by explaining their chosen museum object to peers",
    sources: [
      {
        body: "博物館の子ども向け活動では、以前、先生が作品の名前や時代を順番に説明していた。子どもたちは聞いていたが、活動が終わると、どの作品が気になったか思い出せないことが多かった。そこで、最初の十分だけ先生が話し、その後は子どもが一つ作品を選ぶことにした。\n子どもは「どこを見て選んだか」を小さい紙に書き、三人のグループで説明する。正しい知識を長く話す必要はない。色、形、使い方など、自分が見つけたことをことばにする。ほかの子の説明を聞いて、もう一度作品へ戻る子も増えた。説明することが、よく見るための方法になったのである。",
      },
    ],
    question:
      "新しい活動で、子どもが作品をよく見るようになったのはなぜですか。",
    options: [
      "先生が作品の時代を最初の十分で説明したから",
      "選んだ理由を自分のことばで説明したから",
      "グループで同じ作品を選び、名前を覚えたから",
      "ほかの子の説明を正しい知識として書き写したから",
    ],
    correctIndex: 1,
    evidence: [
      "どこを見て選んだか",
      "自分が見つけたことをことばに",
      "説明することが、よく見るための方法",
    ],
    explanation:
      "Selecting an object and articulating observed reasons makes looking active; the task does not require long expert knowledge or a single prescribed answer.",
  },
] as const satisfies readonly LowerReadingSeed[];

const n3LongSeeds = [
  {
    semanticId: "N3-long-repair-cafe-learning",
    level: "N3",
    family: "reading-long",
    semanticFocus:
      "community repair event values shared diagnosis as well as repaired objects",
    sources: [
      {
        body: "町の会館で、月に一度「修理の日」が開かれている。こわれた家電やおもちゃを持って行くと、修理が得意な人がいっしょに見てくれる。私は、動かなくなった小さい時計を持って行った。すぐ直してもらえると思っていたが、担当の人はまず私に、いつから、どんなときに止まるのかを聞いた。\n時計を開けると、部品がこわれたのではなく、細かいほこりが動きをじゃましていた。担当の人は、ほこりを取る前に、どこを見れば原因が分かるかを説明した。そして、私にも安全な部分をそうじさせてくれた。時間は店へ出すよりかかったが、次に同じようなことが起きたら、自分で確認できると思った。\nこの活動では、全部の物が直るわけではない。部品がない場合や、安全に問題がある場合は、修理をやめることもある。そのときも、なぜ使い続けられないのか、どう捨てればよいかを教える。直った数だけを活動の結果にはしていないのである。\n物を長く使えば、ごみを減らせる。しかし、この「修理の日」の大切な点は、それだけではない。修理する人だけが知識を持ち、持ち主は待つだけ、という関係にしないことだ。原因をいっしょに考えることで、持ち主も物の使い方を知る。直す時間は、知識を次の人へ渡す時間にもなっている。",
      },
    ],
    question: "筆者が「修理の日」の大切な点だと考えていることは何ですか。",
    options: [
      "直せる物の数を増やして、ごみを減らすこと",
      "持ち主が待つ間に、担当者だけで安全を確認すること",
      "持ち主も原因や使い方を学べること",
      "直らない物について、捨て方だけを伝えること",
    ],
    correctIndex: 2,
    evidence: [
      "原因をいっしょに考える",
      "持ち主も物の使い方を知る",
      "知識を次の人へ渡す時間",
    ],
    explanation:
      "The essay's conclusion values shared diagnosis and learning, not merely the number repaired or waste reduced. Some items appropriately remain unrepaired for safety or parts reasons.",
  },
  {
    semanticId: "N3-long-street-tree-aftercare",
    level: "N3",
    family: "reading-long",
    semanticFocus:
      "tree-planting plan measures long-term shade and care rather than initial planting count",
    sources: [
      {
        body: "夏の暑さをやわらげるため、駅から学校までの道に木を植える計画が始まった。最初の案では、できるだけ多くの木を一年で植え、植えた本数を成果として発表する予定だった。住民からも、早く緑を増やしてほしいという声が出ていた。\nしかし、公園の職員は、木は植えた後の世話が必要だと説明した。若い木は、数年間、水をやり、枝を切り、病気がないか調べなければならない。一度に多く植えると、世話をする人と水が足りず、夏をこえられない木が増えるかもしれない。また、店の前に大きく育つ木を植えると、看板が見えなくなるという意見もあった。\nそこで計画は三年間に変わった。最初の年は、学校の近くと、休む場所の少ない道を中心に植える。次の年に、木が元気に育っているか、歩く人がどこで日かげを使っているかを調べてから、次の場所を決める。店の前では、店の人と木の種類を選ぶ。\n植える本数は最初の案より少なくなったため、計画が小さくなったように見える。しかし目的は、式の日に多くの木を並べることではない。数年後も木が育ち、必要な場所に日かげがあることだ。そのためには、始める速さだけでなく、世話を続けられる量を考えなければならない。",
      },
    ],
    question: "計画が三年間に変わったのはなぜですか。",
    options: [
      "一年目に植える本数を減らし、店の前を避けるため",
      "植えた後の世話と日かげの使われ方を確かめながら進めるため",
      "若い木への水やりを住民だけに任せるため",
      "日かげより看板の見え方を優先して木を選ぶため",
    ],
    correctIndex: 1,
    evidence: [
      "植えた後の世話が必要",
      "木が元気に育っているか",
      "日かげを使っているかを調べてから",
    ],
    explanation:
      "The staged plan aligns planting with ongoing care and observed shade needs. A smaller initial count supports the real goal of surviving, useful trees.",
  },
  {
    semanticId: "N3-long-public-map-missing-reports",
    level: "N3",
    family: "reading-long",
    semanticFocus:
      "citizen issue map distinguishes no reports from evidence of no problem",
    sources: [
      {
        body: "市は、道路のこわれた場所や、夜に暗い場所を住民が知らせる地図を作った。スマートフォンで場所と写真を送ると、地図に印がつき、市が直した後は色が変わる。どこに問題が多いかが見えるため、職員も仕事の順番を考えやすくなった。\n地図が始まって半年後、中心部には多くの印があったが、町のはしにはほとんどなかった。市は最初、はしの地域には問題が少ないと考えた。しかし調べてみると、その地域には高齢者が多く、スマートフォンで写真を送る人が少なかった。また、地図の説明会も中心部だけで開かれていた。印がないことは、問題がないことと同じではなかったのである。\n市は、電話でも報告できるようにし、地域の店に紙の用紙を置いた。職員が月に一度歩いて確認する道も決めた。すると、これまで印のなかった場所から、段差や消えた道路の線についての情報が集まった。\n地図は、住民の目を行政の仕事に生かす便利な道具である。ただし、使える人の情報だけで町全体を考えると、声を送りにくい人の場所が安全に見えてしまう。集まった情報を見るだけでなく、どこから情報が来ていないのかも確かめる必要がある。",
      },
    ],
    question: "筆者が、この地図を使うときに必要だと考えていることは何ですか。",
    options: [
      "中心部の印を先に直し、印の少ない地域は後に調べること",
      "スマートフォン以外の報告は、職員の確認後だけ地図に載せること",
      "情報が来ない地域にも別の方法で問題がないか確かめること",
      "報告の少ない地域では、説明会を増やすだけにすること",
    ],
    correctIndex: 2,
    evidence: [
      "印がないことは、問題がないことと同じではなかった",
      "どこから情報が来ていないのかも確かめる",
    ],
    explanation:
      "The map is useful but participation is uneven. The conclusion requires checking silent areas through phone, paper, and staff observation rather than treating absence of reports as safety.",
  },
  {
    semanticId: "N3-long-letter-slower-revision",
    level: "N3",
    family: "reading-long",
    semanticFocus:
      "slower letter writing helps writer reconsider what a relationship needs",
    sources: [
      {
        body: "私は、遠くに住む友人とは、いつも短いメッセージで話している。すぐ返事が来るので便利だし、写真も簡単に送れる。去年、その友人の誕生日に、久しぶりに手紙を書いた。最初は、メッセージで十分なのに、なぜ時間をかけるのだろうと思った。\nしかし、紙に書いてみると、いつものようには進まなかった。「元気？」と書いた後、私は本当に何を聞きたいのか考えた。友人が新しい町へ引っこしてから、仕事の話ばかり聞き、生活について聞いていなかったことに気づいた。書いた文を一度消し、町で見つけた好きな場所や、休日をどうすごしているかをたずねる文に変えた。\n手紙がメッセージより正しい、ということではない。急ぐ相談には、すぐ届く方法がよい。手紙も、長く書けば気持ちが深くなるとはかぎらない。私にとって意味があったのは、返事を急がず、書いた文を読みなおす時間ができたことだった。\n友人からは二週間後に手紙が届いた。新しい町でまだ友だちが少なく、一人で歩いて見つけた川辺が好きだと書いてあった。私が質問を変えたことで、今まで聞かなかった話を知ることができた。ゆっくり書く時間は、文をきれいにするだけでなく、相手について何を知ろうとしているかを考える時間だったのである。",
      },
    ],
    question: "筆者にとって、手紙を書く時間にどんな意味がありましたか。",
    options: [
      "返事を急がない手紙で、友人の生活を全部聞く時間",
      "仕事についての質問を整理し、短いメッセージで送り直す時間",
      "相手に本当に聞きたいことを考えなおす時間",
      "友人が川辺について書くまで、質問を何度も変える時間",
    ],
    correctIndex: 2,
    evidence: [
      "本当に何を聞きたいのか考えた",
      "質問を変えた",
      "何を知ろうとしているかを考える時間",
    ],
    explanation:
      "The slower medium prompts reflection on the relationship and leads to a different, more meaningful question. The author still values instant messages for urgent matters.",
  },
  {
    semanticId: "N3-long-school-project-shared-goal",
    level: "N3",
    family: "reading-long",
    semanticFocus:
      "students resolve competing project ideas by identifying a shared purpose and combining roles",
    sources: [
      {
        body: "中学校の文化祭で、私たちのクラスは地域を紹介する発表をすることになった。あるグループは、昔の写真を集めた展示を作りたいと言った。別のグループは、商店の人に話を聞いて動画にしたいと言った。準備できる時間は一か月しかなく、両方をそのまま作るのはむずかしかった。話し合いでは、自分の案のよい点を説明するばかりで、なかなか決まらなかった。\n先生は、どちらの案を選ぶかを考える前に、見に来た人に何を伝えたいのかを書いてみようと言った。すると、二つのグループとも、「町が昔から変わってきたこと」と「今も続いているもの」を知ってほしいと考えていることが分かった。方法はちがっても、目的は同じだったのである。\nそこで、展示の数を少なくし、三つの場所だけを選んだ。それぞれについて昔の写真を置き、今その場所で働く人への短いインタビュー動画を見られるようにした。写真を集めるのが得意な人、質問を考える人、動画を編集する人が、それぞれ役割を持つこともできた。全部の案を残したわけではないが、二つの案の大事な部分は生かされた。\n意見が分かれたとき、すぐに一つを選ぼうとすると、負けたと感じる人が出ることがある。今回、私たちは案の形ではなく、その案で何を実現したいのかを確かめた。その結果、ただ半分ずつにしたのではなく、同じ目的に合う形へ作り直すことができた。話し合いで必要なのは、どちらが正しいかだけでなく、何をいっしょに目指しているかを見つけることなのだと思う。",
      },
    ],
    question: "クラスの話し合いが進んだきっかけは何ですか。",
    options: [
      "二つの案を同じ量ずつ残せるよう、展示を半分に分けたから",
      "二つの案に共通する目的を確かめたから",
      "得意な作業ごとに先にグループを分けたから",
      "準備時間に合うよう、動画の案だけを小さくしたから",
    ],
    correctIndex: 1,
    evidence: [
      "方法はちがっても、目的は同じだった",
      "何をいっしょに目指しているか",
    ],
    explanation:
      "The impasse changes when the class identifies a shared communicative goal. The final form is redesigned around that goal rather than simply choosing one side or preserving every idea.",
  },
  {
    semanticId: "N3-long-community-quiet-room",
    level: "N3",
    family: "reading-long",
    semanticFocus:
      "community center tests time-zoned room use after listening to conflicting needs",
    sources: [
      {
        body: "駅の近くに新しい交流センターができた。広い部屋には机といすがあり、だれでも自由に使える。開館したばかりのころは、学生が勉強したり、近所の人が話したり、幼い子どもが遊んだりしていた。しかし、静かに仕事をしたい人から「話し声が気になる」という意見が出た。一方、親子からは「子どもにずっと静かにさせるなら利用できない」という声があった。\nセンターは、部屋を完全に静かな場所にする案を考えた。けれども、その建物には親子が雨の日に過ごせる別の場所がない。また、話す人のために新しい部屋を作るお金もなかった。そこで職員は、一週間、利用する時間と目的を記録し、利用者にも希望を聞いた。すると、静かに使いたい人は平日の午前と夕方に多く、親子は昼すぎに多いことが分かった。\n次の月から、平日の午前九時から十二時までは静かに使う時間にした。午後一時から四時までは、小さい声なら会話もできる時間にした。夕方には、机の半分だけを静かな場所とし、床の色で分けた。入口にはその日の使い方を大きく表示し、知らずに入った人にも職員が説明した。\nこの方法で、すべての音の問題がなくなったわけではない。それでも、「静かな人」か「話す人」のどちらかだけを選ぶより、実際に使われる時間を調べたことで、同じ部屋を分けて使えるようになった。公共の場所では、一つの規則を全員へ同じように当てることが公平とは限らない。ちがう必要を知り、場所と時間を組み合わせることも公平な使い方の一つである。",
      },
    ],
    question: "交流センターが時間によって使い方を変えたのはなぜですか。",
    options: [
      "利用者の目的が時間によって異なることが分かったから",
      "静かな利用者が多い午前だけ、部屋を予約制にしたかったから",
      "親子向けの別室を作るまで、一時的に会話を認めたから",
      "すべての時間に同じ規則を使う方が公平だと判断したから",
    ],
    correctIndex: 0,
    evidence: [
      "利用する時間と目的を記録",
      "静かに使いたい人は平日の午前と夕方",
      "親子は昼すぎ",
    ],
    explanation:
      "Observation showed that different needs peaked at different times, so time and partial space zoning could accommodate both. It is a negotiated use plan, not a ban on either group.",
  },
  {
    semanticId: "N3-long-oral-history-context",
    level: "N3",
    family: "reading-long",
    semanticFocus:
      "local archive preserves interview context so later listeners do not mistake one memory for a complete record",
    sources: [
      {
        body: "私が手伝っている資料館では、町で長く暮らしてきた人の話を録音している。昔の市場や学校について、写真だけでは分からない生活を残すためだ。最初は、印象に残る話だけを短く切り、題名をつけて公開していた。短いので聞きやすく、学校の授業でもよく使われた。\nところが、ある人の「昔の市場は毎日とてもにぎやかだった」という話を聞いた学生が、そのころは町のどこでも店が増えていたのだと考えた。実際には、その人が話していたのは祭りの前の一週間で、別の時期には店が少なかった。長い録音の前後を聞けば分かることが、短い部分だけでは消えていたのである。\nそれから資料館は、短い音声といっしょに、話した人がいつ、どこで経験したことかを表示するようにした。質問した人のことばも一部残し、同じ出来事について別の人が話した音声があれば、続けて聞けるようにした。話が食いちがう場合も、一つを消して正しい形にそろえるのではなく、両方を置いている。\n個人の記憶には、その人にしか語れない価値がある。同時に、一人の記憶だけで町全体を説明することはできない。短く分かりやすくする工夫は必要だが、いつの話か、どんな質問への答えかという情報まで切ってしまうと、聞く人は話の範囲を広く考えすぎる。記録を残すとは、声だけでなく、その声を正しく考えるための手がかりも残すことなのである。",
      },
    ],
    question:
      "資料館が音声といっしょに経験した時期や場所を表示するようにしたのはなぜですか。",
    options: [
      "短い音声を授業で使わず、長い録音だけを聞かせるため",
      "一人の話を町全体の事実だと広く受け取られないようにするため",
      "食いちがう話から、正しい一方を選びやすくするため",
      "個人の記憶を年代順に並べ、町全体の変化を示すため",
    ],
    correctIndex: 1,
    evidence: [
      "短い部分だけでは消えていた",
      "一人の記憶だけで町全体を説明することはできない",
      "話の範囲を広く考えすぎる",
    ],
    explanation:
      "Context fields limit overgeneralization from a vivid personal memory. The archive still uses short clips and preserves conflicting accounts rather than standardizing them away.",
  },
  {
    semanticId: "N3-long-library-of-things-care",
    level: "N3",
    family: "reading-long",
    semanticFocus:
      "shared-item library sustains access by teaching inspection and recording condition, not merely lending cheaply",
    sources: [
      {
        body: "私の町の図書館では、本のほかに、電動工具やキャンプ用品も借りられるようになった。年に一、二回しか使わない物を、それぞれの家で買わなくてもよいようにするためだ。利用する人はすぐ増えたが、半年後には、部品が足りないまま返された物や、よごれて次の人が使えない物が目立つようになった。\n図書館は最初、こわした人に新しい物を買ってもらう規則を作ろうとした。しかし、職員が調べると、借りる前から小さな傷があったのか、使っている間についたのか分からない場合が多かった。また、テントの正しいたたみ方を知らず、むりに袋へ入れたために部品が曲がることもあった。利用者だけを注意しても、必要な情報を渡していなければ問題は続く。\nそこで、貸す前に職員と利用者がいっしょに部品を数え、写真で状態を記録することにした。初めて使う道具については、短い説明を受ける。返すときも、その場で動くかを確認し、次の人へ伝える注意をカードに書く。こわれた場合も、かくさず早く知らせれば、すぐに買う費用を求めるのではなく、原因を調べる。\n物を共有する仕組みは、買うお金を節約するだけのサービスに見える。しかし、多くの人が長く使うには、物の状態についての情報も共有しなければならない。借りる人は単なる客ではなく、次に使う人へ物を渡す一人でもある。貸す数を増やすことと同じくらい、使い方を学び、状態を記録する仕組みが大切なのである。",
      },
    ],
    question: "筆者が、物を共有するために大切だと考えていることは何ですか。",
    options: [
      "借りる前の傷を、利用者の責任として記録すること",
      "物の使い方と状態の情報を次の人へつなぐこと",
      "返却時だけ部品を数え、こわれた物を早く買い直すこと",
      "初めて使う人には、職員が代わりに道具を操作すること",
    ],
    correctIndex: 1,
    evidence: [
      "状態についての情報も共有",
      "次に使う人へ物を渡す一人",
      "使い方を学び、状態を記録",
    ],
    explanation:
      "Sustainable sharing depends on shared knowledge and documented condition, with borrowers participating in stewardship. Automatic replacement penalties do not address ambiguous prior damage or missing instruction.",
  },
] as const satisfies readonly LowerReadingSeed[];

const n3InformationSeeds = [
  {
    semanticId: "N3-info-training-certificate-route",
    level: "N3",
    family: "information-retrieval",
    semanticFocus:
      "employee selects required workshop sequence and certificate conditions",
    sources: [
      {
        label: "市民仕事講座・秋",
        body: "基礎A　10月5日（土）9:30〜12:00　会場：産業館　2,000円\n基礎B　10月12日（土）9:30〜12:00　会場：産業館　2,000円\n実習C　10月19日（土）13:00〜17:00　会場：工房　3,500円\nオンライン復習　10月23日（水）19:00〜20:00　無料\n\n実習Cは、今年の基礎Aと基礎Bの両方に出席した人だけ申し込めます。修了証が必要な人はA・B・Cに出席し、Cの終了後一週間以内に課題を提出してください。オンライン復習は欠席した講座の代わりにはなりません。会社が費用を払う場合は、最初の講座の七日前までに会社名を書いた申込書を送ってください。個人で申し込む人は各講座の三日前まで受け付けます。",
      },
    ],
    question:
      "会社が費用を払い、修了証も必要な人は、どうしなければなりませんか。",
    options: [
      "Cだけに出て、オンライン復習を受ける",
      "A・B・Cに出て課題を出し、Aの七日前までに会社の申込書を送る",
      "AとCに出て、Bの代わりにオンライン復習を受ける",
      "Bだけに出て、Cの一週間前に課題を出す",
    ],
    correctIndex: 1,
    evidence: [
      "A・B・Cに出席",
      "Cの終了後一週間以内に課題",
      "最初の講座の七日前までに会社名を書いた申込書",
    ],
    explanation:
      "The certificate requires all three in-person stages plus the post-C assignment; employer payment also activates the earlier company-form deadline. Online review cannot replace an absence.",
  },
  {
    semanticId: "N3-info-island-ferry-bus-connection",
    level: "N3",
    family: "information-retrieval",
    semanticFocus:
      "traveler combines ferry and reservation-only island bus under seasonal constraints",
    sources: [
      {
        label: "青島　秋の交通案内",
        body: "港発フェリー　8:10／10:40／14:20　所要50分\n青島発フェリー　12:00／16:30／18:10　所要50分\n島内バス「灯台線」　船着場発 9:15／12:00／15:30　灯台まで35分\n島内バス「森線」　船着場発 11:50／14:50　森の入口まで25分\n\n灯台は10:00〜16:00、森の案内所は9:30〜15:30です。11月の平日は島内バスが予約制になり、前日の17時までに予約がない便は運休します。フェリーが20分以上遅れた場合、予約したバスは出発を待ちます。予約していない便は待ちません。森から船着場へは徒歩で約70分、灯台からは約90分です。",
      },
    ],
    question:
      "11月の火曜日、10時40分の船で島へ行き、森の案内所が開いている間に着きたい人は、どうするのがよいですか。",
    options: [
      "予約せず11時50分の森線に乗る",
      "前日17時までに11時50分の森線を予約する",
      "15時30分の灯台線を予約する",
      "14時50分の森線で着いてから案内所へ入る",
    ],
    correctIndex: 1,
    evidence: [
      "10:40",
      "船着場発 11:50",
      "11月の平日は島内バスが予約制",
      "森の案内所は9:30〜15:30",
    ],
    explanation:
      "The 10:40 ferry arrives about 11:30, making the 11:50 forest bus viable; because it is a November weekday it must be booked by 17:00 the prior day. The later forest bus arrives after the office closes.",
  },
  {
    semanticId: "N3-info-festival-volunteer-shifts",
    level: "N3",
    family: "information-retrieval",
    semanticFocus:
      "volunteer chooses role satisfying age, training, and consecutive-shift rules",
    sources: [
      {
        label: "川まつりボランティア募集",
        body: "案内係　8:00〜12:00／12:00〜16:00　高校生以上　各回20人\n子ども工作　9:00〜13:00／13:00〜17:00　18歳以上　各回8人\n舞台準備　7:00〜11:00／16:00〜20:00　高校生以上　各回12人\n通訳案内　9:00〜14:00　大学生以上・英語か中国語で案内できる人　10人\n\n初めて参加する人は、前週の日曜日14時からの説明会に出てください。去年参加した人はオンライン資料の確認だけでかまいません。二つの回へ続けて参加する場合、同じ係なら昼食を用意します。別の係を選ぶ場合は、間に一時間以上あけてください。舞台準備の夕方の回だけに参加する人は、当日15時30分の安全説明にも出席します。",
      },
    ],
    question:
      "去年案内係をした17歳の高校生が、今年は昼食を受け取り、一日続けて参加したい場合、どれを選べますか。",
    options: [
      "案内係の午前と午後",
      "子ども工作の午前と午後",
      "案内係の午前と子ども工作の午後",
      "舞台準備の午前と案内係の午後",
    ],
    correctIndex: 0,
    evidence: [
      "案内係　8:00",
      "高校生以上",
      "同じ係なら昼食を用意",
      "去年参加した人はオンライン資料",
    ],
    explanation:
      "A 17-year-old high-school student meets the guide-role age rule and consecutive same-role shifts qualify for lunch. Children's craft requires age 18, while switching roles lacks the required one-hour gap.",
  },
  {
    semanticId: "N3-info-coworking-evening-room",
    level: "N3",
    family: "information-retrieval",
    semanticFocus:
      "member selects workspace plan and reservation path for evening meeting",
    sources: [
      {
        label: "まちの仕事室　利用案内",
        body: "一日会員　9:00〜18:00　1,200円　共有席のみ\n夜会員　17:00〜22:00　月4,000円　共有席と電話室\n全日会員　8:00〜22:00　月8,000円　共有席・電話室・会議室\n会議室　6人まで・一時間1,500円（全日会員は一日一時間無料）\n\n電話室は一人用で、30分まで予約できます。会議室は利用日の二週間前から前日18時まで予約できます。当日の予約は、空いていれば受付で申し込めますが、無料時間は使えません。会員以外を会議室へ呼ぶ場合、一人300円の入館料が必要です。オンライン会議を共有席で行うことはできません。",
      },
    ],
    question:
      "全日会員が、来週の火曜日の20時から一時間、会員ではない二人と会議をしたい場合、必要なことは何ですか。",
    options: [
      "一日会員になり、共有席を三つ取る",
      "前日18時までに会議室を予約し、二人分の入館料を払う",
      "電話室を一時間予約し、入館料は払わない",
      "当日受付で無料の会議室を必ず取る",
    ],
    correctIndex: 1,
    evidence: [
      "全日会員",
      "前日18時まで予約",
      "会員以外を会議室へ呼ぶ場合、一人300円",
    ],
    explanation:
      "The full-day member can use the meeting room in the evening and has a free hour when reserved in advance, but two outside guests each incur entry fees. Same-day availability is not guaranteed and forfeits the free hour.",
  },
  {
    semanticId: "N3-info-bulky-waste-pickup",
    level: "N3",
    family: "information-retrieval",
    semanticFocus:
      "resident distinguishes reusable collection, bulky booking, and prohibited pickup locations",
    sources: [
      {
        label: "北山市　大きなごみの出し方",
        body: "まだ使える家具：再利用センターへ写真を送り、引き取り可能と返事があった物だけ無料回収\nこわれた家具：粗大ごみ受付へ電話予約し、料金券をはって指定日の朝8時までに建物の入口へ出す\n家電四品目（テレビ・冷蔵庫・洗濯機・エアコン）：市では回収しません。買った店か指定業者へ相談\n長さ50センチ未満に分けた木材：燃やすごみの日に一回三束まで\n\n集合住宅では、部屋の前や廊下からは回収しません。管理人に確認した共用入口へ出してください。再利用センターへ申し込んだ後、三日以内に返事がない場合は粗大ごみとして予約できます。予約内容を変える場合は、回収日の二日前までに連絡してください。",
      },
    ],
    question:
      "集合住宅に住む人が、まだ使える机を無料で引き取ってほしい場合、まず何をしますか。",
    options: [
      "料金券をはって部屋の前へ出す",
      "再利用センターへ写真を送り、引き取り可能という返事を待つ",
      "50センチ未満に切って何束でも出す",
      "家電の指定業者へ電話する",
    ],
    correctIndex: 1,
    evidence: [
      "再利用センターへ写真",
      "引き取り可能と返事があった物だけ無料回収",
    ],
    explanation:
      "Free reusable-furniture pickup begins with a photo assessment and affirmative response. The common entrance rule matters only when an approved or booked item is put out; a desk is not one of the four excluded appliances.",
  },
  {
    semanticId: "N3-info-adult-course-path",
    level: "N3",
    family: "information-retrieval",
    semanticFocus:
      "learner matches language course placement, attendance, and presentation requirements",
    sources: [
      {
        label: "市民日本語講座",
        body: "生活会話　火曜10:00〜11:30　初級　全10回　3,000円\n仕事の会話　木曜19:00〜20:30　中級　全10回　4,000円\n文章を書く　土曜10:00〜12:00　中級以上　全8回　4,500円\n発表練習　土曜14:00〜16:00　上級　全6回　3,500円\n\n初めて受講する人は9月3日のレベル確認を受けてください。昨年度の受講証がある人は不要です。「文章を書く」と「発表練習」は最後に作品や発表を提出し、全体の4分の3以上出席した人へ修了証を出します。仕事の会話を8回以上受けた人は、次の期に発表練習へ申し込むことができますが、講師の推薦も必要です。",
      },
    ],
    question:
      "初めて受講する中級の人が、文章の修了証を取りたい場合、何が必要ですか。",
    options: [
      "レベル確認を受け、文章を書く講座に6回以上出て作品を出す",
      "仕事の会話に一回出て、発表だけを提出する",
      "レベル確認を受けず、文章を書く講座に4回出る",
      "生活会話を全部受け、作品は出さない",
    ],
    correctIndex: 0,
    evidence: [
      "初めて受講する人は9月3日のレベル確認",
      "全体の4分の3以上出席",
      "作品や発表を提出",
    ],
    explanation:
      "A first-time learner takes placement. Six of eight sessions meets the three-quarter attendance rule, and the writing course requires a submitted work for certification.",
  },
  {
    semanticId: "N3-info-arts-festival-pass",
    level: "N3",
    family: "information-retrieval",
    semanticFocus:
      "visitor combines festival pass benefits with separate limited-event reservation",
    sources: [
      {
        label: "港アート週間",
        body: "一日券　一般2,000円／学生1,200円　当日一回だけ各展示へ入場可\n三日券　一般4,500円／学生2,500円　期間中、各展示へ何度でも入場可\n夜券　18時以降　一般・学生1,000円　A館とB館のみ\n公開制作　土曜15時・C館　定員30人　入場券のほかに無料予約が必要\n\n一日券と三日券には港バスの一日乗車券が付きます。夜券には付きません。公開制作の予約は開催日の十日前から前日までです。予約した人は開始20分前までにC館受付で入場券を見せてください。遅れた場合は、空きを待つ人が先に入ります。学生料金には当日、学生証が必要です。",
      },
    ],
    question:
      "学生が土曜日にA・B・C館を回り、15時の公開制作も必ず見たい場合、どうしますか。",
    options: [
      "夜券だけを買い、予約せずC館へ行く",
      "一日券か三日券を買い、公開制作を前日までに予約して14時40分までに受付する",
      "一日券を買えば公開制作の予約はしなくてよい",
      "三日券だけを買い、開始後に学生証を見せる",
    ],
    correctIndex: 1,
    evidence: [
      "入場券のほかに無料予約が必要",
      "前日まで",
      "開始20分前まで",
      "学生証が必要",
    ],
    explanation:
      "A standard day or three-day pass covers all galleries, but the limited live-production event separately requires advance booking and check-in by 14:40. Student pricing also requires identification.",
  },
  {
    semanticId: "N3-info-home-repair-grant",
    level: "N3",
    family: "information-retrieval",
    semanticFocus:
      "homeowner applies before work and distinguishes eligible safety improvement from decoration",
    sources: [
      {
        label: "安心住宅工事　費用補助",
        body: "対象：市内に一年以上住み、自分が住む住宅を所有している人\n対象工事：手すりの設置、入口の段差を低くする工事、地震に強くする工事\n対象外：壁紙の色かえ、家具の購入、すでに始めた工事、貸している住宅の工事\n補助額：工事費の3分の1（上限10万円）。工事費が3万円未満の場合は対象外\n\n工事を始める前に、見積書、工事前の写真、所有者を確認できる書類を市へ出してください。市から決定通知が届く前に契約・工事を始めると補助を受けられません。工事後30日以内に領収書と工事後の写真を提出します。今年度の受付は12月20日までですが、予算がなくなれば早く終了します。",
      },
    ],
    question:
      "市内の自宅に二年住む所有者が、8万円で入口の段差を低くしたい場合、最初にすることは何ですか。",
    options: [
      "工事を始めてから写真だけを送る",
      "契約前に見積書などを市へ出し、決定通知を待つ",
      "壁紙もいっしょに変えてから申し込む",
      "工事後30日たってから所有者の書類を出す",
    ],
    correctIndex: 1,
    evidence: [
      "工事を始める前に",
      "見積書、工事前の写真、所有者",
      "決定通知が届く前に契約・工事を始めると補助を受けられません",
    ],
    explanation:
      "The resident and safety modification are eligible, but approval must precede both contract and construction. Post-work documents cannot cure an application begun too late.",
  },
] as const satisfies readonly LowerReadingSeed[];

const sharedPassageQuestions = [
  {
    semanticId: "N5-mid-lunch-shopping-delivery",
    passageId: "N5-mid-lunch-shopping-plan",
    passageQuestionIndex: 2,
    level: "N5",
    family: "reading-mid",
    semanticFocus:
      "student identifies when and where the lunch ingredients must be delivered",
    sources: n5MidSeeds[0].sources,
    question: "買ったものは、いつ、どこへもっていきますか。",
    options: [
      "きょうの九時に教室",
      "あしたの朝九時に学校の台所",
      "あしたの十二時にスーパー",
      "あしたの朝十時に駅",
    ],
    correctIndex: 1,
    evidence: ["あしたの朝九時に学校の台所へもっていきます"],
    explanation:
      "The shopping is done today, but the ingredients must be brought to the school kitchen tomorrow at 9:00 in the morning.",
  },
  {
    semanticId: "N4-mid-reusable-cup-original-problem",
    passageId: "N4-mid-reusable-cup-system",
    passageQuestionIndex: 2,
    level: "N4",
    family: "reading-mid",
    semanticFocus:
      "reader identifies why the first reusable-cup program was inconvenient",
    sources: n4MidSeeds[0].sources,
    question: "最初のカップのしくみには、どんな問題がありましたか。",
    options: [
      "店でカップを一つも借りられなかった",
      "借りた店が遠いと返しにくかった",
      "カップは家でしか使えなかった",
      "どの店でも現金を返していた",
    ],
    correctIndex: 1,
    evidence: ["同じ店までかえしに行くのがたいへん", "遠くの店で買った人"],
    explanation:
      "The original system tied every return to the lending shop, which made return inconvenient for customers who traveled away from that location.",
  },
  {
    semanticId: "N4-info-meeting-room-company-fee",
    passageId: "N4-info-meeting-room-rules",
    passageQuestionIndex: 2,
    level: "N4",
    family: "information-retrieval",
    semanticFocus: "company user applies room capacity and business surcharge",
    sources: n4InformationSeeds[0].sources,
    question:
      "会社の15人が、平日の夜に食事をしない会議をするとき、どのへやを申しこめますか。",
    options: [
      "Aだけ。料金は同じ",
      "Bだけ。会社利用の料金をはらう",
      "Cだけ。食事代もはらう",
      "AとB。どちらも無料",
    ],
    correctIndex: 1,
    evidence: [
      "B 大会議室：35人",
      "9:00〜21:00",
      "会社が仕事のために使う場合、料金は二倍",
    ],
    explanation:
      "Fifteen people exceed room A's capacity but fit room B. With no meal, C is unnecessary; business use pays the stated company surcharge.",
  },
  {
    semanticId: "N3-mid-shared-tools-failed-purchase",
    passageId: "N3-mid-shared-tools-system",
    passageQuestionIndex: 2,
    level: "N3",
    family: "reading-mid",
    semanticFocus:
      "reader explains why purchasing more tools did not solve the locating problem",
    sources: n3MidSeeds[0].sources,
    question: "新しい工具を買っても問題があまり変わらなかったのはなぜですか。",
    options: [
      "新しく買った工具が、よく使う種類ではなかったから",
      "工具を返す場所が決まっておらず、いくつもの棚に分かれていたから",
      "新しい工具の置き場所だけを利用者に知らせなかったから",
      "こわれた工具を買い直す前に赤い箱へ集めたから",
    ],
    correctIndex: 1,
    evidence: [
      "空いている場所へ道具を置く",
      "同じ種類の物がいくつもの棚に分かれていた",
    ],
    explanation:
      "Quantity was not the main constraint: inconsistent return locations scattered equivalent tools, so users still could not find them reliably.",
  },
  {
    semanticId: "N3-long-repair-cafe-unrepairable",
    passageId: "N3-long-repair-cafe",
    passageQuestionIndex: 2,
    level: "N3",
    family: "reading-long",
    semanticFocus:
      "reader identifies how the repair event handles unsafe or unrepairable objects",
    sources: n3LongSeeds[0].sources,
    question: "持って来た物を直せない場合、活動ではどうしますか。",
    options: [
      "使える部品だけを外し、持ち主に持ち帰ってもらう",
      "別の店なら直せると伝え、そこで説明を終える",
      "直せない理由や捨て方を持ち主へ説明する",
      "修理できた数には入れず、理由を活動の記録だけに残す",
    ],
    correctIndex: 2,
    evidence: ["なぜ使い続けられないのか、どう捨てればよいかを教える"],
    explanation:
      "An item may appropriately remain unrepaired, but the event still shares the safety reason and disposal guidance; learning remains part of the outcome.",
  },
  {
    semanticId: "N3-info-training-online-substitution",
    passageId: "N3-info-training-certificate",
    passageQuestionIndex: 2,
    level: "N3",
    family: "information-retrieval",
    semanticFocus:
      "participant distinguishes optional online review from required attendance",
    sources: n3InformationSeeds[0].sources,
    question: "基礎Bを休んだ人について、案内から分かることはどれですか。",
    options: [
      "オンライン復習を受ければ実習Cへ出られる",
      "基礎Aに出ていれば実習Cへ出られる",
      "オンライン復習はBの欠席の代わりにならず、実習Cへ申しこめない",
      "課題を先に出せば修了証をもらえる",
    ],
    correctIndex: 2,
    evidence: [
      "基礎Aと基礎Bの両方に出席",
      "オンライン復習は欠席した講座の代わりにはなりません",
    ],
    explanation:
      "C requires attendance at both A and B, and the notice explicitly denies substitution by the online review. An early assignment cannot replace either prerequisite.",
  },
] as const satisfies readonly LowerReadingSeed[];

const SHARED_PASSAGE_IDS = new Map<string, string>([
  ["N5-mid-lunch-shopping-budget", "N5-mid-lunch-shopping-plan"],
  ["N5-mid-lunch-shopping-delivery", "N5-mid-lunch-shopping-plan"],
  ["N4-mid-reusable-cup-return", "N4-mid-reusable-cup-system"],
  ["N4-mid-reusable-cup-original-problem", "N4-mid-reusable-cup-system"],
  ["N4-info-meeting-room-paid-class", "N4-info-meeting-room-rules"],
  ["N4-info-meeting-room-company-fee", "N4-info-meeting-room-rules"],
  ["N3-mid-shared-tools-location", "N3-mid-shared-tools-system"],
  ["N3-mid-shared-tools-failed-purchase", "N3-mid-shared-tools-system"],
  ["N3-long-repair-cafe-learning", "N3-long-repair-cafe"],
  ["N3-long-repair-cafe-unrepairable", "N3-long-repair-cafe"],
  ["N3-info-training-certificate-route", "N3-info-training-certificate"],
  ["N3-info-training-online-substitution", "N3-info-training-certificate"],
]);

const SUPPLEMENTAL_SOURCE_BY_PASSAGE_ID = new Map<
  string,
  { label?: string; body: string }
>([
  [
    "N5-mid-lunch-shopping-plan",
    {
      body: "学校についたら、先生といっしょに作ります。わたしはトマトをあらいます。ゆきさんはたまごを切ります。スープは時間がかかるので、はじめに作ります。牛乳はつめたいままもっていきます。昼ごはんは十二時に食べます。食べたあとは、四人で台所をそうじします。",
    },
  ],
  [
    "N5-mid-zoo-train-bus-plan-passage",
    {
      body: "バスをおりたら、入り口まで五分ぐらい歩きます。きっぷは友だちが先に買ってくれます。中へ入ったら、午前は大きい鳥とさるを見ます。昼ごはんは十二時に外のいすで食べます。雨のときは、入り口のちかくのへやで食べることができます。帰りは午後四時のバスです。",
    },
  ],
  [
    "N5-mid-wallet-found-process-passage",
    {
      body: "じむしつで、駅の人に電話で聞いたばんごうを言います。それから、さいふの色と中にあるものをもう一ど話します。駅の人といっしょに中を見て、わたしのさいふなら紙に名前を書きます。八時をすぎたときは、あしたの朝九時からとりに行くことができます。",
    },
  ],
  [
    "N5-mid-birthday-party-roles-passage",
    {
      body: "二時十五分から、けんさんはつくえをならべ、わたしはかざりをつけます。ケーキはれいぞうこに入れます。りなさんが来たら、みんなで歌をうたってからプレゼントをわたします。雨のときもパーティーは同じ時間です。おわったあと、まりさんとわたしがコップをあらいます。",
    },
  ],
  [
    "N5-mid-new-student-day-passage",
    {
      body: "午後のクラスでは、本を一さつもらいます。えんぴつとノートは自分でもってきてください。学生のカードは、図書館で本をかりるときにつかいます。名前やじゅうしょがちがうときは、クラスのあとでうけつけに話してください。学校を出る前に、あしたの教室をかくにんします。",
    },
  ],
  [
    "N5-mid-apartment-laundry-rules-passage",
    {
      body: "せんたくきが二つともつかわれているときは、へやの外でまちます。ふくを入れたまま、買いものへ行かないでください。おわる時間を紙に書いて、せんたくきの前におきます。大きいふとんは、このせんたくきではあらえません。土曜日も時間とルールは同じです。",
    },
  ],
  [
    "N5-mid-museum-weekend-choice-passage",
    {
      body: "先生の話を聞いたあと、三時から一かいの電車の中を見ることができます。大きいかばんは、入り口のはこに入れてください。飲みものはもって入れますが、へやの中では飲みません。外へ出ると、同じきっぷでもう一ど入ることはできません。店は四時半までです。",
    },
  ],
  [
    "N5-mid-grandmother-gift-letter-passage",
    {
      body: "コップのはこには、青い花のカードも入れました。二つは同じ大きさですが、一つには白い線があります。おきゃくさんのコップがすぐわかるようにしたかったからです。日曜日の午後に電話します。はこがとどかなかったときは、わたしにおしえてください。来月また会いに行きます。",
    },
  ],
  [
    "N4-mid-reusable-cup-system",
    {
      body: "新しいしくみを始める前に、五つの店はカップの形と大きさを同じにしました。どの店のカップか分からなくても、返すことができるようにするためです。返されたカップは、その店で数を記録してから、まとめて洗う場所へ運びます。始めた月は、駅の店に返す人が多く、カップが足りなくなる店もありました。そこで、毎朝、必要な店へカップを動かすことにしました。店の人の仕事は少しふえましたが、新しいカップを買う数と、すてるカップの数はへりました。利用する人には、返す店の地図もわたしています。この経験から、物をくり返し使うには、物を用意するだけではなく、返したあとにまた使えるようにする流れも必要だと分かりました。",
    },
  ],
  [
    "N4-mid-library-study-seat-passage",
    {
      body: "新しいルールを決める前に、図書館は二週間、よやくされたせきが何分使われなかったかを調べました。特に昼休みの後は、来ない人のよやくが一時間以上のこることがありました。一方、授業がおそく終わり、十分だけおくれる学生もいます。そのため、よやく時間ちょうどではなく、前後十分の間にカードを見せればよいことにしました。早く帰る人が「終わり」をおすと、次の人はすぐによやくできます。今は、来られなくなった学生にも、アプリからよやくを消すよう知らせています。新しい方法は学生をきびしく調べるためではなく、使わない時間を次の人へ早くわたすためのものです。",
    },
  ],
  [
    "N4-mid-neighborhood-cat-feeding-passage",
    {
      body: "ボランティアは一週間ごとにかわり、食べものの量をノートに書きます。ねこが来なかった日も、そのことを記録します。月に一度、動物の病院の人が記録を見て、やせたねこや病気のねこがいないかを調べます。近所の人が自分で食べものをあげたいときは、まずボランティアにれんらくします。食べものが多すぎると、ねこが食べのこし、鳥や虫が集まるからです。はじめは「世話をする人を二人にしたら、ねこが食べられない日がある」と心配する人もいました。しかし、時間と量を記録することで、毎日同じように世話ができるようになりました。公園をきれいにすることと、ねこの健康を守ることを、べつの問題にしなかったのです。",
    },
  ],
  [
    "N4-mid-walking-map-updates-passage",
    {
      body: "地図を直すとき、作った人だけで歩くのではなく、小学生の家族と足のわるい人にも使ってもらいました。大人なら気にならないさかでも、子どもには長く感じることが分かりました。また、地図に書いたベンチが工事で使えない日もありました。そこで、道を三つに分け、それぞれの時間と、休める場所までのきょりを書きました。トイレには、かいだんを使わずに入れるかどうかもしるしをつけました。店や建物のしゃしんはのこしましたが、歩くために必要な情報を大きくしました。地図は町をきれいに見せるだけのものではありません。実際に歩いた人が、つぎにどう動くかを決められることが大切だからです。",
    },
  ],
  [
    "N4-mid-online-course-group-time-passage",
    {
      body: "三つのグループ時間は、火曜日の朝、木曜日の夜、土曜日の午後です。学生は生活に合う時間をえらび、四週間は同じメンバーと活動します。毎週の話し合いでは、動画について一つ質問を出し、発表で使う例を少しずつ集めます。どうしても参加できない週は、一回だけ時間をかえられますが、ほかの週の話し合いの記録を読んでから入ります。先生は答えを決めるのではなく、グループが仕事を分けられているかをかくにんします。去年のように最後の一週間で全部を決める必要がなくなり、発表の前に意見のちがいにも気づけるようになりました。自由に動画を見るよさと、人と考えるよさを、どちらものこすための変更です。",
    },
  ],
  [
    "N4-mid-office-quiet-hour-passage",
    {
      body: "一か月後に職員へ聞くと、長い書類を作る仕事は前より早く終わるようになったという人が多くいました。一方で、新しい職員からは、何を赤いしるしにするか分かりにくいという意見が出ました。そこで、今日中に答えが必要なことと、お客さんを待たせていることだけに、赤いしるしを使うと決めました。それ以外の質問はメモに書き、十二時すぎに十五分の相談時間を作ります。九時半のかくにんでは、その日に一人で進める仕事と、先に相談する仕事を分けます。しずかな時間は、だれとも話さないためではありません。話す時間をまとめることで、集中と相談の両方をしやすくする方法なのです。",
    },
  ],
  [
    "N4-mid-imperfect-vegetable-market-passage",
    {
      body: "店は、形のちがうやさいを、いつものやさいより少し安くしました。しかし、ねだんだけを書いたときは、「古いから安いのではないか」と考える客もいました。カードにとった日を書き、切った中を見せると、客は自分でちがいをかくにんできました。料理のしゃしんの横には、農家の人がよく作る食べ方も書きました。大きさがそろわないトマトはスープに、小さいにんじんはカレーに使えます。買った人からは「味は同じだった」という声が集まり、そのことも店に出しました。形を気にする客へむりにすすめるのではなく、選ぶための情報をふやしたのです。その結果、農家がすてるやさいも少なくなりました。",
    },
  ],
  [
    "N4-mid-exchange-event-roles-passage",
    {
      body: "最初の回では、仕事の名前だけをカードに書いて配りました。しかし、「時間を見る人は話さなくてよい」と考える人もいました。次の回から、どの仕事でも一度は質問か意見を言うことにしました。時間を見る人は、まだ話していない人に知らせます。答えを書く人は、同じ意見とちがう意見を一つずつ記録します。最後にしょうかいする人は、自分の意見だけではなく、グループで出た考えを話します。仕事を二十分ごとにかえるので、一回の交流会で二つ以上の方法を経験できます。全員の話す時間を同じ長さにするよりも、自分にできる仕事から入り、次の仕事にも少し挑戦できるようにしたのです。",
    },
  ],
  [
    "N3-mid-shared-tools-system",
    {
      body: "ラベルを付ける前に、利用者へ一週間、見つからなかった工具を書いてもらった。よく使う工具ほど、置かれる場所が毎日変わっていることも分かった。変更後は、初めて来た人でも絵を見て返せるかを確かめ、分かりにくい絵は描き直した。ルールを作るだけでなく、だれが使っても同じ場所を選べる表示にしたことも効果につながった。",
    },
  ],
  [
    "N3-mid-library-reminder-timing-passage",
    {
      body: "三日前と当日ではメールの題名も変えた。三日前は返す準備や延長を選べる連絡、当日は本を持って出たかを確かめる連絡にしたのである。連絡が多すぎると読まれなくなるため、返却した人にはその後のメールを送らない。送る回数だけでなく、各時点でできる行動に合わせて内容も分けた。",
    },
  ],
  [
    "N3-mid-museum-audio-choice-passage",
    {
      body: "変更後の利用記録を見ると、短い説明だけを多く聞く人もいれば、二、三点にしぼって長い説明を聞く人もいた。以前より案内を最後まで使う人は増えたが、全員が同じ情報を聞いたわけではない。博物館は、聞いた数ではなく、自分で選んだ作品の前に長く立つ人が増えたことを大切にしている。",
    },
  ],
  [
    "N3-mid-bakery-preorder-waste-passage",
    {
      body: "店は予約数をそのまま翌日の生産数にはしていない。天気や曜日、近くの行事も見ながら、予約のない客の分を加えて決める。たとえば雨の日は来店客が少ないが、休日の朝は予約なしで家族分を買う人が多い。予約を確実な数として使い、当日の変化を予想する材料と組み合わせているのである。",
    },
  ],
  [
    "N3-mid-walking-commute-attention-passage",
    {
      body: "歩き始めてから、会社に着いて最初の仕事を選ぶ時間が短くなった。考える仕事を三つにしぼるので、歩きながら全部の予定を決めるわけではない。大切なのは歩いた距離ではなく、家を出てすぐ仕事を始めるのではなく、頭の向きを少しずつ変えられることである。",
    },
  ],
  [
    "N3-mid-team-near-mistake-log-passage",
    {
      body: "記録は月に一度まとめ、同じ場所で三件以上の迷いがあれば、担当者が画面や説明を確認する。一件だけで直すのではなく、ほかの人も同じように迷う可能性を見るためだ。名前を書かないことで人を責めにくくする一方、いつ、どの作業で迷ったかは残し、改善に必要な具体性を失わないようにした。",
    },
  ],
  [
    "N3-mid-comment-delay-reflection-passage",
    {
      body: "一か月の記録では、五分以内に書き直された投稿の多くで、相手を直接責める表現が理由や質問の形に変わっていた。一方、内容への反対意見そのものは残った。公開を遅らせる目的は意見を弱くすることではなく、伝えたい内容と、その場の感情で選んだことばを分けて考えられるようにすることだった。",
    },
  ],
  [
    "N3-mid-child-exhibit-explanation-passage",
    {
      body: "先生はグループを回り、作品名をすぐ教える代わりに、「どの形からそう思ったの」と質問した。子どもは答えるために作品へ近づいたり、別の方向から見たりした。最後に先生が時代や使い方を説明すると、自分の発見と結びつけて聞くことができた。知識を後にしたことも、観察を続ける助けになった。",
    },
  ],
  [
    "N5-info-train-bus-transfer-passage",
    {
      label: "きをつけること",
      body: "バスのきっぷは川駅のバスのりばで買います。電車やバスがおくれたときは、友だちに電話してください。",
    },
  ],
  [
    "N4-info-bus-pass-weekend-visitor-passage",
    {
      label: "きっぷの使い方",
      body: "バスをおりるとき、運転手にきっぷの日づけを見せてください。",
    },
  ],
  [
    "N4-info-sports-center-swim-sauna-passage",
    {
      label: "セット券について",
      body: "セット券でも水泳ぼうは自分でもって来ます。サウナだけを先に使うこともできます。",
    },
  ],
  [
    "N4-info-camping-two-night-rental-passage",
    {
      label: "セットに入らないもの",
      body: "食べものとガスはセットに入っていません。必要な人は、店かキャンプ場で買ってください。",
    },
  ],
  [
    "N4-info-health-check-morning-fast-passage",
    {
      label: "当日のうけつけ",
      body: "予約時間の十分前に受付へ来てください。けんさ中は会社の電話に出ることができません。",
    },
  ],
  [
    "N4-info-museum-family-pass-passage",
    {
      label: "登録について",
      body: "家族パスには使う五人までの名前と顔写真を登録します。後から人をかえることはできません。",
    },
  ],
  [
    "N3-info-training-certificate",
    {
      label: "定員・持ち物・取り消し",
      body: "A・Bは各40人、Cは16人です。申し込みが多い場合、Cは仕事で使う予定がある人を優先します。AとBには筆記用具、Cには汚れてもよい服と室内用の靴を持参してください。開始から30分以上遅れた回は出席として数えません。講座を取り消す場合、開始日の五日前までは全額、四日前から前日までは半額を返します。当日の欠席は返金しません。オンライン復習は録画せず、参加用URLを当日の正午に送ります。質問は終了後三日間、専用ページで受け付けます。",
    },
  ],
  [
    "N3-info-island-ferry-bus-connection-passage",
    {
      label: "料金と帰りの交通",
      body: "フェリーは片道1,100円、往復2,000円です。島内バスは一回300円で、乗るときに払います。小学生はどちらも半額です。強い風でフェリーが運休した日は、使わなかった往復券を港の窓口で返金します。自転車はフェリーに一台400円で持ちこめますが、島内バスにはのせられません。灯台には飲みものを買う店がありますが、森の案内所にはありません。帰りのバスは灯台発15:00、森の入口発15:25で、どちらも船着場へ向かいます。バスの帰り便も11月の平日は予約が必要です。",
    },
  ],
  [
    "N3-info-festival-volunteer-shifts-passage",
    {
      label: "服装・欠席・活動証明",
      body: "案内係と通訳案内には帽子と名札を貸します。子ども工作は汚れてもよい服、舞台準備は運動靴で参加してください。荷物は本部のロッカーへ入れられますが、数に限りがあります。雨の場合、案内係と子ども工作は屋内で行い、舞台準備は朝6時に実施するかをメールで知らせます。欠席するときは前日の18時までに担当へ連絡してください。活動証明書が必要な人は申し込み時に希望し、当日の終了後に本部で受け取ります。交通費は出ませんが、二回続けて参加しない人にも飲みものを一本用意します。",
    },
  ],
  [
    "N3-info-coworking-evening-room-passage",
    {
      label: "設備・飲食・予約変更",
      body: "共有席では電源と無線インターネットを利用できます。印刷は白黒一枚10円、カラー一枚40円です。飲みものはふたのある容器に入れ、食事は一階の休憩室で取ってください。会議室には画面がありますが、接続用のパソコンは各自で用意します。予約を取り消す場合、前日18時までは無料、それ以降は一時間分の料金がかかります。毎月第一日曜日は設備点検のため休館し、その日も月会費の期間は延長されません。会員証を忘れた人は、受付で名前を確認してから入室します。",
    },
  ],
  [
    "N3-info-bulky-waste-pickup-passage",
    {
      label: "料金と回収できる数",
      body: "粗大ごみの料金は、いす300円、机600円、たんす900円です。一つずつ料金券を用意し、予約番号も券に書いてください。回収できるのは一世帯一回五点までです。引っこし会社が出したごみや、店で使った家具は家庭の回収対象になりません。再利用センターが引き取る家具は、大きな汚れがなく安全に使える物に限ります。写真では分からない傷が見つかった場合、当日に無料回収を断ることがあります。雨の日も回収しますが、紙の料金券が読めるよう透明な袋で守ってください。",
    },
  ],
  [
    "N3-info-adult-course-path-passage",
    {
      label: "申し込みと受講中の変更",
      body: "9月5日から12日まで、市の窓口かウェブで受け付けます。一人二講座までで、定員をこえた場合は抽選です。結果は9月16日にメールで知らせます。教科書代は受講料に含まれますが、「文章を書く」では自分の辞書か辞書アプリを使います。欠席した回の個人授業はありません。講師が用意した資料は後から受け取れます。受講を始めてから別のレベルへ移りたい人は、三回目の授業までに講師へ相談してください。修了証には受講した講座名と出席回数が書かれます。受講料は初回にまとめて払い、抽選後の自己都合による取り消しでは返金しません。",
    },
  ],
  [
    "N3-info-arts-festival-pass-passage",
    {
      label: "会場時間と再入場",
      body: "A館は10時〜20時、B館は11時〜21時、C館は10時〜18時です。各館の最終入場は閉館の30分前です。一日券で一度出た館へは再入場できませんが、三日券なら同じ日でも再入場できます。大きな荷物は各館の無料ロッカーへ入れてください。公開制作では写真を撮れません。予約を取り消す人は前日18時までに連絡してください。当日の空きはC館入口に12時から表示します。港バスが運休しても入場券の返金はありません。車いすで公開制作を見る人は、予約時に座席について相談できます。館内のカフェはB館だけにあります。",
    },
  ],
  [
    "N3-info-home-repair-grant-passage",
    {
      label: "工事会社と内容変更",
      body: "市に登録した会社だけが工事を行えます。登録会社の一覧は市役所とウェブで確認できます。一つの工事にほかの制度の補助を同時に使うことはできません。対象工事と壁紙の変更をいっしょに頼む場合、見積書で費用を分け、対象部分だけを計算します。決定通知の後に工事内容や金額が変わるときは、工事を進める前に変更届を出してください。工事後、市の担当者が確認に行く場合があります。補助金は必要な書類を確認した後、申請者の口座へ振りこみます。書類に不足がある場合は、市から二週間以内に連絡します。",
    },
  ],
]);

function finalizeLowerReadingSeeds(
  seeds: readonly LowerReadingSeed[],
): readonly LowerReadingSeed[] {
  const sourcesByPassageId = new Map<string, LowerReadingSeed["sources"]>();

  return seeds.map((seed) => {
    const passageId =
      seed.passageId ??
      SHARED_PASSAGE_IDS.get(seed.semanticId) ??
      `${seed.semanticId}-passage`;
    let sources = sourcesByPassageId.get(passageId);
    if (!sources) {
      const supplementalSource =
        SUPPLEMENTAL_SOURCE_BY_PASSAGE_ID.get(passageId);
      sources = supplementalSource
        ? [...seed.sources, supplementalSource]
        : seed.sources;
      sourcesByPassageId.set(passageId, sources);
    }

    return {
      ...seed,
      sources,
      passageId,
      passageQuestionIndex: seed.passageQuestionIndex ?? 1,
      editorialStatus: seed.editorialStatus ?? "machine-validated",
    };
  });
}

const allSeeds = [
  ...n5ShortSeeds,
  ...n5MidSeeds,
  ...n5InformationSeeds,
  ...n4ShortSeeds,
  ...n4MidSeeds,
  ...n4InformationSeeds,
  ...n3ShortSeeds,
  ...n3MidSeeds,
  ...n3LongSeeds,
  ...n3InformationSeeds,
  ...sharedPassageQuestions,
] as const satisfies readonly LowerReadingSeed[];

export const LOWER_READING_SEEDS = finalizeLowerReadingSeeds(allSeeds);
export const N5_LOWER_READING_SEEDS = LOWER_READING_SEEDS.filter(
  (seed) => seed.level === "N5",
);
export const N4_LOWER_READING_SEEDS = LOWER_READING_SEEDS.filter(
  (seed) => seed.level === "N4",
);
export const N3_LOWER_READING_SEEDS = LOWER_READING_SEEDS.filter(
  (seed) => seed.level === "N3",
);
