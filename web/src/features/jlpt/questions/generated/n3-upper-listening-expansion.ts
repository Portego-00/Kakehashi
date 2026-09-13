import type { UpperListeningSeed } from "./upper-listening-seeds";

/** Standalone N3 expansion awaiting independent editorial review. */
export const N3_UPPER_LISTENING_EXPANSION_EDITORIAL_STATUS =
  "machine-validated" as const;

const taskSeeds = [
  {
    semanticId: "N3-task-market-flyer-final-check",
    level: "N3",
    family: "listening-task",
    semanticFocus:
      "market volunteer checks the revised rain date before sending a flyer to the print shop",
    script:
      "女：来週の朝市のチラシ、もう印刷会社に送りましたか。男：まだです。店の名前と地図は直しましたが、雨の場合の開催日が古いままなんです。女：雨なら翌日ではなく、次の土曜日になりましたよ。男：では、開催日を直してから送りましょうか。女：私はこれから店の人へ電話します。開催日を直したら、画面を一度見せてください。確認できたら、あなたが印刷会社へ送ってください。",
    question: "男の人は、このあと何をしますか。",
    options: [
      "店の人へ電話する",
      "雨の場合の開催日を直す",
      "すぐ印刷会社へ送る",
      "チラシの地図を直す",
    ],
    correctIndex: 1,
    explanation:
      "The woman handles the calls, the map is already revised, and printing waits for review. The man's immediate task is correcting the rain-date information.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N3-task-apartment-repair-morning-window",
    level: "N3",
    family: "listening-task",
    semanticFocus:
      "resident selects the only repair visit compatible with work and building access",
    script:
      "男：台所の水が止まらないんですが、修理はいつ来てもらえますか。女：木曜日の午後か、土曜日の午前が空いています。男：木曜は会社にいます。土曜の午前なら家にいますが、十二時から建物の入口が工事で使えません。女：では、土曜日の九時から十一時でどうでしょう。部品は担当者が持っていくので、店へ取りに来なくて大丈夫です。男：その時間でお願いします。",
    question: "男の人は、修理のためにどうしますか。",
    options: [
      "木曜日の午後、家で待つ",
      "土曜日の九時から十一時、家で待つ",
      "土曜日の十二時に入口で会う",
      "店へ部品を取りに行く",
    ],
    correctIndex: 1,
    explanation:
      "Work rules out Thursday, entrance construction rules out noon, and staff bring the part. He chooses the Saturday 9–11 home visit.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N3-task-meeting-chart-source-note",
    level: "N3",
    family: "listening-task",
    semanticFocus:
      "staff member adds a source note while colleagues handle numbers and printing",
    script:
      "女：午後の会議で使うグラフ、数字の確認は終わりましたか。男：はい。数字は山田さんにも見てもらいました。色は部長が青から緑に変えたそうです。女：下に情報の出どころが書いてありませんね。男：では、私が入れます。女：お願いします。紙に印刷するのは私がします。会議室への資料運びは山田さんに頼みました。",
    question: "男の人は、このあと何をしますか。",
    options: [
      "グラフの数字を確認する",
      "グラフの色を変える",
      "情報の出どころを書く",
      "資料を会議室へ運ぶ",
    ],
    correctIndex: 2,
    explanation:
      "Numbers and color have already been handled, and Yamada moves materials. The man accepts the remaining job of adding the source note.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N3-task-station-lost-phone-web-form",
    level: "N3",
    family: "listening-task",
    semanticFocus:
      "traveler files a web report after station staff confirm the lost phone is not yet registered",
    script:
      "男：電車に携帯電話を忘れたと思うんですが。女：今日の落とし物には、まだ黒い携帯電話は届いていません。携帯の番号にはかけてみましたか。男：はい。でも、電源が切れているようです。箱や説明書は家にあります。女：それは見つかったあとで確認に使えます。今は、このウェブフォームに、乗った電車と時間、携帯の色を入力してください。届いたらメールで知らせます。男：では、今、入力します。",
    question: "男の人は、まずどうしますか。",
    options: [
      "携帯電話へもう一度かける",
      "家へ箱を取りに戻る",
      "電車と時間をウェブで知らせる",
      "駅からのメールを待つ",
    ],
    correctIndex: 2,
    explanation:
      "Calling has failed, the box is useful only after recovery, and email comes later. He first submits the train and time details online.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N3-task-cooking-event-soup-role",
    level: "N3",
    family: "listening-task",
    semanticFocus:
      "event helper takes the unassigned dairy-free soup role after tracking other cooking assignments",
    script:
      "女：日曜日の料理会、カレーは佐藤さんが作ります。サラダは私が担当します。男：足りない野菜を店で買っていきましょうか。女：野菜は店の人が届けてくれます。でも、スープを作る人がまだ決まっていません。乳製品を食べられない参加者がいるので、牛乳は使わないでください。男：では、僕が野菜のスープを作ります。飲み物はどうしますか。女：参加する人が自分で持ってきます。男：分かりました。材料を確認しておきます。",
    question: "男の人は、料理会で何をしますか。",
    options: [
      "佐藤さんとカレーを作る",
      "女の人とサラダを作る",
      "店で足りない野菜を買う",
      "乳製品を使わないスープを作る",
    ],
    correctIndex: 3,
    explanation:
      "Sato handles curry, the woman makes salad, and the shop delivers vegetables. The man takes the remaining role and must make the soup without dairy for a participant's restriction.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N3-task-library-projector-reservation",
    level: "N3",
    family: "listening-task",
    semanticFocus:
      "student reserves presentation equipment after the room and handouts are already arranged",
    script:
      "男：来週、図書館の会議室で発表します。部屋はもう予約して、資料も三十枚印刷しました。女：パソコンの画面を見せるなら、プロジェクターも予約が必要ですよ。男：会議室にあると思っていました。女：二台しかないので、受付で申し込んでください。もし空いていなければ、大きい画面のある二階の部屋に変えられます。男：まず受付で聞いてみます。",
    question: "男の人は、このあと何をしますか。",
    options: [
      "会議室を予約する",
      "資料を三十枚印刷する",
      "受付でプロジェクターを申し込む",
      "すぐ二階の部屋へ変える",
    ],
    correctIndex: 2,
    explanation:
      "The room and handouts are complete. He asks reception for a projector; changing rooms is only the fallback if none is available.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N3-task-club-rain-indoor-training",
    level: "N3",
    family: "listening-task",
    semanticFocus:
      "club leader switches from outdoor running to indoor stretching after weather and room constraints",
    script:
      "女：夕方のランニング、雨でもしますか。男：雨は強くなるそうです。体育館はバスケットボール部が使っていますが、小さい多目的室なら六時から空いています。女：そこで走るのは無理ですね。男：ええ。今日は外のランニングをやめて、六時から多目的室でストレッチの練習をしましょう。筋力トレーニングは先生がいる金曜日にします。女：では、みんなに場所と内容を送ります。",
    question: "クラブは、今日どうしますか。",
    options: [
      "雨の中を外で走る",
      "体育館でバスケットボールをする",
      "多目的室でストレッチをする",
      "金曜日の筋力トレーニングを今日する",
    ],
    correctIndex: 2,
    explanation:
      "Rain cancels running, the gym is occupied, and strength work stays on Friday. They move to the multipurpose room for stretching.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N3-task-parcel-return-convenience-store",
    level: "N3",
    family: "listening-task",
    semanticFocus:
      "customer returns shoes through a convenience store after home pickup and shop visit are ruled out",
    script:
      "女：ネットで買った靴を返したいんですが、家まで取りに来てもらえますか。男：平日の昼ならできます。女：昼は仕事でいません。店へ持っていくのはどうですか。男：この商品はネットだけなので、店では受け取れません。近くのコンビニから送ることはできます。箱に返品の紙を入れて、この番号を店員に見せてください。女：では、今夜コンビニへ持っていきます。",
    question: "女の人は、靴を返すためにどうしますか。",
    options: [
      "平日の昼に家で待つ",
      "靴の店へ直接持っていく",
      "コンビニから箱を送る",
      "返品の紙を家に残す",
    ],
    correctIndex: 2,
    explanation:
      "She cannot receive daytime pickup, the physical shop rejects online-only returns, and the form must go inside. She uses the convenience-store shipment.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
] as const satisfies readonly UpperListeningSeed[];

const quickResponseSeeds = [
  {
    semanticId: "N3-quick-dinner-date-alternative",
    level: "N3",
    family: "listening-quick-response",
    semanticFocus:
      "friend declines Friday dinner while proposing a workable Saturday alternative",
    script: "金曜日の夜、みんなで食事に行くんだけど、来ない？",
    question: "最も適切な応答を選んでください。",
    options: [
      "みんなは食事に行ったんだね。",
      "金曜は無理だけど、土曜なら行けるよ。",
      "金曜日は夜になりました。",
    ],
    correctIndex: 1,
    explanation:
      "The first reply addresses the invitation, declines the proposed time, and offers a practical alternative. The others do not answer it.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N3-quick-document-review-tomorrow",
    level: "N3",
    family: "listening-quick-response",
    semanticFocus:
      "busy colleague agrees to review a document by tomorrow rather than immediately",
    script: "この資料、今日中に見てもらえませんか。",
    question: "最も適切な応答を選んでください。",
    options: [
      "資料は昨日、机に置きました。",
      "今日は資料を三部コピーしました。",
      "今日は難しいですが、明日の朝なら見られます。",
    ],
    correctIndex: 2,
    explanation:
      "The request concerns review timing. The first response honestly rejects today and gives a clear available time; the others do not negotiate the request.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N3-quick-homemade-soup-compliment",
    level: "N3",
    family: "listening-quick-response",
    semanticFocus:
      "guest responds modestly when a friend praises homemade soup",
    script: "このスープ、野菜の味がよく出ていて、おいしいですね。",
    question: "最も適切な応答を選んでください。",
    options: [
      "ありがとうございます。時間をかけて煮たんです。",
      "では、野菜を買ってきますね。",
      "スープはまだ飲んでいません。",
    ],
    correctIndex: 0,
    explanation:
      "The first response accepts the compliment and naturally explains the cooking result. The alternatives conflict with the present situation.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N3-quick-forgot-form-submission",
    level: "N3",
    family: "listening-quick-response",
    semanticFocus:
      "student admits forgetting a form and commits to bringing it the next morning",
    script: "申し込みの紙、今日持ってくることになっていましたよね。",
    question: "最も適切な応答を選んでください。",
    options: [
      "申し込みの紙は受付に置いてあります。",
      "すみません、忘れました。明日の朝、必ず持ってきます。",
      "昨日、その紙を受付でもらいました。",
    ],
    correctIndex: 1,
    explanation:
      "The prompt reminds the listener of an unmet obligation. The first reply acknowledges it, apologizes, and offers a concrete correction.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N3-quick-wrong-extension-call",
    level: "N3",
    family: "listening-quick-response",
    semanticFocus:
      "office caller apologizes and asks to be transferred after reaching the wrong department",
    script: "こちらは会計です。人事にご用ではありませんか。",
    question: "最も適切な応答を選んでください。",
    options: [
      "会計の仕事は終わりましたか。",
      "人事から電話がありました。",
      "失礼しました。人事につないでいただけますか。",
    ],
    correctIndex: 2,
    explanation:
      "The caller has reached the wrong department. Apologizing and requesting transfer to HR is the appropriate repair.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N3-quick-offer-group-photo",
    level: "N3",
    family: "listening-quick-response",
    semanticFocus:
      "passerby offers to take a group photo so everyone can appear in it",
    script: "みなさんで写真を撮るなら、私がシャッターを押しましょうか。",
    question: "最も適切な応答を選んでください。",
    options: [
      "ありがとうございます。では、お願いします。",
      "写真は昨日送りました。",
      "みなさんはカメラを持っています。",
    ],
    correctIndex: 0,
    explanation:
      "The speaker offers to take the group's picture. The first reply thanks them and accepts that offer directly.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N3-quick-crowded-train-warning",
    level: "N3",
    family: "listening-quick-response",
    semanticFocus:
      "traveler changes departure plan after learning the next train will be crowded",
    script: "次の電車、イベントの帰りの人でかなり混むらしいですよ。",
    question: "最も適切な応答を選んでください。",
    options: [
      "イベントは来週もあるそうですよ。",
      "そうですか。では、その次の電車にします。",
      "次の電車は空いていたんですね。",
    ],
    correctIndex: 1,
    explanation:
      "The first response acknowledges the crowd warning and sensibly changes to a later train. The other replies misread or fail to use the information.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N3-quick-colleague-leaving-early",
    level: "N3",
    family: "listening-quick-response",
    semanticFocus:
      "coworker acknowledges an early departure and offers to handle an urgent message",
    script: "今日は病院へ行くので、三時に帰らせてもらいます。",
    question: "最も適切な応答を選んでください。",
    options: [
      "病院は駅の近くにあります。",
      "今日は会社に来ないんですね。",
      "分かりました。急ぎの連絡があれば、伝えておきます。",
    ],
    correctIndex: 2,
    explanation:
      "The first response accepts the early departure and offers relevant workplace support. The other replies distort the stated situation.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
] as const satisfies readonly UpperListeningSeed[];

const outlineSeeds = [
  {
    semanticId: "N3-outline-lunch-container-return-trial",
    level: "N3",
    family: "listening-outline",
    semanticFocus:
      "cafeteria trials returnable lunch containers to reduce waste without burdening customers",
    script:
      "女：会社の食堂では、持ち帰り用の昼ごはんが増え、毎日たくさんの容器を捨てていました。来月から、洗って何度も使える容器を試します。利用する人は百円を預け、食べ終わった容器を食堂か一階の箱へ返すと、百円が戻ります。返す場所を食堂だけにすると、仕事が忙しい人には使いにくくなります。そのため、一階にも返す箱を置きます。まず二か月行い、返された数や洗う時間を調べてから、続けるか決めます。",
    question: "女の人の話の中心は何ですか。",
    options: [
      "持ち帰りの昼ごはんをやめる理由",
      "容器のごみを減らすための返却制度の試み",
      "食堂の料理を百円安くする計画",
      "食堂だけに容器を返す新しい規則",
    ],
    correctIndex: 1,
    explanation:
      "The deposit, multiple return points, and two-month evaluation all serve a trial system for reusable containers and less waste.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N3-outline-neighborhood-news-two-formats",
    level: "N3",
    family: "listening-outline",
    semanticFocus:
      "neighborhood keeps paper notices while adding digital updates for speed and broader access",
    script:
      "男：町内会のお知らせは、これまで月に一度、紙で各家に配っていました。しかし、行事の時間が急に変わったとき、次の紙を待っていては間に合いません。そこで、来月から携帯電話でもお知らせを読めるようにします。ただし、紙をなくすわけではありません。携帯電話を使わない人もいるからです。急な変更は携帯で早く伝え、毎月の予定は今までどおり紙でも確認できるようにします。",
    question: "男の人が説明していることは何ですか。",
    options: [
      "町内会のお知らせを携帯だけに変えること",
      "紙の配達を毎週に増やすこと",
      "紙を残しながら携帯でも知らせること",
      "急な行事の変更を知らせないこと",
    ],
    correctIndex: 2,
    explanation:
      "The speaker balances fast mobile updates with continued paper access, rather than replacing one medium completely.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N3-outline-shop-closing-time-trial",
    level: "N3",
    family: "listening-outline",
    semanticFocus:
      "small shop tests different closing times after discovering customer demand varies by weekday",
    script:
      "女：駅前の店では、毎日夜八時まで開けていましたが、月曜日と火曜日は七時をすぎると客がほとんど来ません。一方、金曜日は八時前に仕事帰りの客が集まり、ゆっくり買えないという声がありました。そこで、来月は月曜と火曜を七時に閉め、その分、金曜は九時まで開けます。働く時間を増やすのではなく、客が来る時間に合わせる試みです。一か月の売り上げと職員の意見を見て、その後を決めます。",
    question: "女の人が最も伝えたいことは何ですか。",
    options: [
      "毎日の営業時間を一時間長くする",
      "客の多い曜日に合わせて営業時間を試しに変える",
      "月曜日と火曜日の店を閉める",
      "金曜日の職員を全員増やす",
    ],
    correctIndex: 1,
    explanation:
      "The paired shorter and longer days redistribute—not increase—hours to match actual demand, followed by a one-month review.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N3-outline-museum-touch-models",
    level: "N3",
    family: "listening-outline",
    semanticFocus:
      "museum adds touchable models so visitors can understand objects that must remain behind glass",
    script:
      "男：この博物館の古い道具は、壊れやすいため、ガラスの中に置かれています。説明を読んでも、大きさや使い方が分かりにくいという意見がありました。そこで、本物と同じ形の模型を作り、横に置くことにしました。模型なら手に取って、重さや動かし方を確かめられます。本物を外へ出すのではなく、安全に守りながら、見る人が道具をもっと具体的に理解できるようにするためです。",
    question: "男の人の話の内容として、最もよいものはどれですか。",
    options: [
      "古い道具をガラスから出して使う計画",
      "説明の文章をすべて短くする方法",
      "本物を守りながら模型で理解を助ける工夫",
      "壊れた道具を新しい物に交換する取り組み",
    ],
    correctIndex: 2,
    explanation:
      "Touchable models add size, weight, and motion information while the fragile originals remain protected behind glass.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N3-outline-study-error-notebook",
    level: "N3",
    family: "listening-outline",
    semanticFocus:
      "student improves review by recording why answers were wrong instead of only repeating exercises",
    script:
      "女：私は前まで、テストで間違えた問題をもう一度解いて、正しい答えだけ覚えていました。でも、少し形が変わると、また同じように間違えてしまいました。今は、答えの横に、言葉を知らなかったのか、質問を急いで読んだのか、理由も短く書いています。すると、自分は計算より質問の読み方で間違えることが多いと分かりました。問題の数を増やすより、間違え方を知って、次に注意するほうが役に立っています。",
    question: "女の人が勉強で大切だと考えていることは何ですか。",
    options: [
      "正しい答えをできるだけ多く覚えること",
      "同じ問題を形を変えずに何度も解くこと",
      "間違えた理由を知って次の学習に生かすこと",
      "計算の問題だけを集めて練習すること",
    ],
    correctIndex: 2,
    explanation:
      "Her central contrast is between memorizing answers and diagnosing error causes so later attention can change.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N3-outline-park-shade-observation",
    level: "N3",
    family: "listening-outline",
    semanticFocus:
      "town observes how park visitors use shade before deciding where to add benches",
    script:
      "男：公園にベンチを増やしてほしいという意見があり、市は入口の近くに置く予定でした。しかし夏に調べると、入口は午後ずっと日が当たり、人は木の下や建物の横で休んでいました。そこで、すぐにベンチを買うのではなく、一週間、時間ごとに人が休む場所を記録しました。その結果を見て、木の下に二つ、建物の横に一つ置くことにしました。必要な数だけでなく、実際に使いやすい場所を確かめたのです。",
    question: "男の人が説明していることは何ですか。",
    options: [
      "公園の入口にベンチを全部集める計画",
      "利用の様子を調べてベンチの場所を決めたこと",
      "日が当たる場所から木をなくすこと",
      "公園で休む人の数を減らす方法",
    ],
    correctIndex: 1,
    explanation:
      "Observation overturns the entrance-first plan and locates benches where people already seek shade, making use—not count alone—the criterion.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N3-outline-bakery-reservation-balance",
    level: "N3",
    family: "listening-outline",
    semanticFocus:
      "bakery uses reservations to guide production while preserving bread for walk-in customers",
    script:
      "女：小さなパン屋なので、夕方にパンが残る日もあれば、人気の商品が昼前になくなる日もありました。今月から、前日の夜まで予約できるようにし、その数を見て、次の日に作る量を少し変えています。ただ、予約の分だけ作るのではありません。急に店へ来る人も買えるよう、曜日や天気も考えて、店に並べる分を残します。予約を、客を分ける方法ではなく、必要な量を知るための情報として使っています。",
    question: "女の人の話の中心は何ですか。",
    options: [
      "予約した客だけにパンを売る方法",
      "毎日まったく同じ数のパンを作る理由",
      "予約を参考にしながら当日の客にも用意する工夫",
      "夕方に残ったパンを翌日に予約させる制度",
    ],
    correctIndex: 2,
    explanation:
      "Reservations inform production but do not replace walk-in availability; weather and weekday demand remain part of the balance.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N3-outline-reading-group-viewpoints",
    level: "N3",
    family: "listening-outline",
    semanticFocus:
      "teacher uses different character viewpoints to move reading discussion beyond one correct impression",
    script:
      "男：物語を読んだあと感想を聞くと、学生は正しい答えを探して、なかなか話しませんでした。そこで今は、グループごとに別の登場人物を一人選び、その人から見た出来事を考えてもらいます。同じ場面でも、だれの気持ちを中心にするかで、見え方が変わります。発表の前には、そう考えた理由を文章の中から探してもらいます。最後にグループの意見を比べると、一つの答えを決めるより、文章のどこからそう考えたかを説明するようになりました。",
    question: "男の先生が授業で行った工夫は何ですか。",
    options: [
      "物語の正しい感想を先に学生へ教えた",
      "登場人物ごとの見方を考えて比べさせた",
      "グループで同じ人物だけを選ばせた",
      "感想を話さず、物語を何度も読ませた",
    ],
    correctIndex: 1,
    explanation:
      "Assigning different character viewpoints creates evidence-based comparison and reduces the pressure to guess one approved reaction.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
] as const satisfies readonly UpperListeningSeed[];

const keyPointSeeds = [
  {
    semanticId: "N3-key-gym-morning-quiet",
    level: "N3",
    family: "listening-key-points",
    semanticFocus:
      "member chooses morning gym visits because the equipment is less crowded then",
    script:
      "女：最近、会社へ行く前にスポーツセンターへ行っているそうですね。朝から運動するのが好きなんですか。男：本当は夕方のほうが体を動かしやすいんです。でも、夕方は人が多くて、使いたい機械を待つことが多くて。朝は少し早く起きなければなりませんが、短い時間でも予定どおり運動できます。",
    question: "男の人が朝スポーツセンターへ行くのは、なぜですか。",
    options: [
      "朝のほうが体を動かしやすいから",
      "朝は使いたい機械を待たなくてよいから",
      "会社が夕方の利用を禁止しているから",
      "朝だけ料金が安くなるから",
    ],
    correctIndex: 1,
    explanation:
      "He actually finds evening exercise physically easier, but crowding causes waits. Morning visits let him use equipment on schedule.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N3-key-recycling-collection-friday",
    level: "N3",
    family: "listening-key-points",
    semanticFocus:
      "resident identifies the holiday as the reason paper collection moves to Friday",
    script:
      "男：今週の古い新聞、金曜日に出すと書いてあります。いつもは木曜日ですよね。女：ええ。今週の木曜日は祝日なので、紙だけ金曜日に集めます。びんと缶は予定どおり水曜日です。雨の予報とは関係ありません。来週からは、また木曜日に戻ります。男：祝日で一日遅くなるんですね。",
    question: "今週、古い新聞を金曜日に出すのはなぜですか。",
    options: [
      "木曜日が祝日だから",
      "びんと缶を水曜日に集めるから",
      "来週は木曜日に戻るから",
      "金曜日に雨が降るから",
    ],
    correctIndex: 0,
    explanation:
      "Friday is a one-day holiday shift from the usual Thursday paper collection. Wednesday's bottles and cans, next week's normal schedule, and rain do not cause the change.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N3-key-apartment-morning-train-noise",
    level: "N3",
    family: "listening-key-points",
    semanticFocus:
      "tenant says early train noise rather than neighbors or traffic disrupts sleep",
    script:
      "女：新しいアパート、駅に近くて便利でしょう。男：買い物も通勤も楽です。隣の部屋の音はほとんど聞こえませんし、夜は車も少ないです。ただ、朝早い電車の音で、目覚まし時計より先に起きてしまうんです。窓を閉めても、あまり変わらなくて。",
    question: "男の人は、新しいアパートの何が問題だと言っていますか。",
    options: [
      "買い物をする場所が遠いこと",
      "隣の部屋の音が大きいこと",
      "夜の車が多いこと",
      "朝早い電車の音が聞こえること",
    ],
    correctIndex: 3,
    explanation:
      "Shopping and commuting are convenient, neighbors are quiet, and nighttime traffic is light. Early train noise wakes him unexpectedly.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N3-key-online-course-feedback-delay",
    level: "N3",
    family: "listening-key-points",
    semanticFocus:
      "learner criticizes slow teacher feedback despite clear videos and useful exercises",
    script:
      "男：そのオンライン講座、どうですか。女：説明のビデオは短くて分かりやすいし、練習問題も仕事で使えそうです。ただ、質問を送っても先生から返事が来るまで一週間ぐらいかかるんです。次の課題を始める前に確認したいので、そこが少し困ります。男：返事がもっと早いといいですね。",
    question: "女の人は、この講座の何が問題だと言っていますか。",
    options: [
      "説明のビデオが長すぎること",
      "練習問題が仕事に役立たないこと",
      "先生からの返事が遅いこと",
      "次の課題が出されないこと",
    ],
    correctIndex: 2,
    explanation:
      "She praises the videos and exercises. Her concern is waiting roughly a week for teacher feedback before continuing.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N3-key-bicycle-arrival-predictability",
    level: "N3",
    family: "listening-key-points",
    semanticFocus:
      "commuter cycles because travel time is more predictable than the often delayed bus",
    script:
      "女：最近、駅まで自転車で行っているんですね。健康のためですか。男：運動にもなりますが、一番の理由は時間です。バスは道が混むと十分以上遅れることがあります。自転車なら雨の日は使えませんが、晴れた日はだいたい同じ時間に駅へ着けるんです。",
    question: "男の人が自転車を使う一番の理由は何ですか。",
    options: [
      "毎日運動をしたいから",
      "バスより料金が安いから",
      "駅までかかる時間が予想しやすいから",
      "雨の日にも乗れるから",
    ],
    correctIndex: 2,
    explanation:
      "Exercise is secondary, price is not mentioned, and rain prevents cycling. Predictable travel time is explicitly his main reason.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N3-key-report-photo-caption",
    level: "N3",
    family: "listening-key-points",
    semanticFocus:
      "editor identifies a mismatched photo caption as the only report correction needed",
    script:
      "男：町のイベントの報告書、見ていただけましたか。女：参加者の数と会場の地図は合っています。写真も明るくていいですね。ただ、一枚目の下に『午後の音楽会』とありますが、これは午前の子ども教室の写真です。男：では、写真は変えずに、下の説明だけ直します。女：それで大丈夫です。",
    question: "男の人は、報告書のどこを直しますか。",
    options: ["参加者の数", "会場の地図", "一枚目の写真", "一枚目の写真の説明"],
    correctIndex: 3,
    explanation:
      "Counts, map, and photo quality are approved. The photo remains, while its incorrect caption must identify the morning children's class.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N3-key-small-plant-gift",
    level: "N3",
    family: "listening-key-points",
    semanticFocus:
      "friend chooses a small plant gift because the recipient travels and has limited room",
    script:
      "女：引っ越した友達に、何をあげようか。大きい花の鉢はきれいだけど。男：あの人、仕事で家を空けることが多いよ。新しい部屋もあまり広くないと言っていたし。女：じゃあ、水を毎日やらなくてもいい、小さい植物にしよう。机の上にも置けるね。男：それがよさそうだね。",
    question: "二人は、どんなプレゼントを選びますか。",
    options: [
      "毎日水が必要な大きい花",
      "手入れが少ない大きい植物",
      "手入れが少ない小さい植物",
      "毎日水が必要な小さい花",
    ],
    correctIndex: 2,
    explanation:
      "Frequent travel and limited space rule out a large demanding plant. They choose a small plant needing little daily care.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N3-key-festival-information-desk-role",
    level: "N3",
    family: "listening-key-points",
    semanticFocus:
      "volunteer selects information desk work because it matches language ability and time limits",
    script:
      "男：祭りのボランティア、どの仕事にしますか。女：朝の会場準備は七時からで、電車がありません。夕方の片づけは参加できますが、重い物を運ぶそうです。昼の食べ物の店は料理の経験が必要ですね。私は英語を少し話せますし、昼の案内所なら十時から三時までです。男：迷った人に会場を説明する仕事ですね。女：はい、それに申し込みます。",
    question: "女の人は、どの仕事に申し込みますか。",
    options: ["朝の会場準備", "昼の案内所", "夕方の片づけ", "昼の食べ物の店"],
    correctIndex: 1,
    explanation:
      "She cannot reach the early setup, the cleanup is physically unsuitable, and the food stall requires cooking experience. Her English and availability fit the daytime information desk.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
] as const satisfies readonly UpperListeningSeed[];

export const N3_UPPER_LISTENING_EXPANSION: readonly UpperListeningSeed[] = [
  ...taskSeeds,
  ...keyPointSeeds,
  ...outlineSeeds,
  ...quickResponseSeeds,
];
