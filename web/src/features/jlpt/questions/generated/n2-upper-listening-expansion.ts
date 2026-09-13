import type { UpperListeningSeed } from "./upper-listening-seeds";

/**
 * Original N2 listening candidates awaiting independent editorial review.
 *
 * This tranche is intentionally not wired into the generated bank. Automated
 * checks establish structure and internal evidence only; they are not human
 * Japanese or JLPT editorial approval.
 */

const taskSeeds = [
  {
    semanticId: "N2-task-storm-event-backup-room",
    level: "N2",
    family: "listening-task",
    semanticFocus:
      "event organizer secures an indoor backup before announcing a weather-dependent venue change",
    script:
      "女：土曜日の交流会ですが、雨の予報が出ていて、降る可能性も高くなっています。中庭から会議室へ変更することを、今すぐ参加者に知らせますか。男：会議室は別の部署も使うかもしれないので、まだ確定ではありません。まず管理担当に会議室を仮予約してもらってください。予約できたら、昼までに天気をもう一度確認します。中庭を使わないと決めた場合だけ、参加者へ変更を知らせ、案内板を入口に移しましょう。女：では、管理担当に連絡します。",
    question: "女の人は、このあとまず何をしますか。",
    options: [
      "参加者へ会場変更を知らせる",
      "管理担当に会議室の仮予約を頼む",
      "昼まで天気を確認し続ける",
      "案内板を入口に移す",
    ],
    correctIndex: 1,
    explanation:
      "The room must be secured before the weather check can trigger a venue change. Participant notice and moving the sign are conditional later actions.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N2-task-moving-elevator-booking",
    level: "N2",
    family: "listening-task",
    semanticFocus:
      "tenant adjusts a moving schedule after learning the service elevator requires advance booking",
    script:
      "男：来週の引っ越し、朝九時にトラックが着く予定です。荷物を先に玄関へ出しておけばいいですか。女：大きい荷物はサービス用エレベーターを使いますが、二日前までの予約が必要です。普通のエレベーターでは家具を運べません。管理会社に時間を確認して予約してから、運送会社に到着時刻を合わせてもらってください。廊下に荷物を出すのは当日の朝だけです。男：分かりました。まず管理会社に電話します。",
    question: "男の人は、まず何をしますか。",
    options: [
      "荷物を廊下へ出す",
      "普通のエレベーターで家具を運ぶ",
      "管理会社にサービス用エレベーターを予約する",
      "運送会社に九時到着を確認する",
    ],
    correctIndex: 2,
    explanation:
      "The service elevator reservation determines the viable moving time. Only after confirming it can the carrier's arrival be adjusted; staging boxes waits until moving day.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N2-task-online-order-split-shipment",
    level: "N2",
    family: "listening-task",
    semanticFocus:
      "customer chooses split shipping so an available gift arrives before a birthday",
    script:
      "女：注文した二冊の本のうち、一冊が入荷待ちになったそうです。両方そろうまで発送を待ちますか。男：一冊目は父の誕生日に渡すので、金曜日までに必要です。別々に送ると送料が一回分増えますが、店で受け取るには営業時間に間に合いません。入荷待ちの本は急ぎませんし、取り消す必要もありません。女：では、在庫のある本だけ先に発送してもらい、もう一冊は入荷後に送ってもらいましょう。男：そうします。",
    question: "男の人は、注文した本をどうしますか。",
    options: [
      "在庫のある本だけ先に発送してもらう",
      "二冊そろうまで発送を待つ",
      "二冊とも店で受け取る",
      "入荷待ちの本を取り消す",
    ],
    correctIndex: 0,
    explanation:
      "The birthday deadline outweighs one extra shipping fee, while store pickup is impractical. He keeps both orders but sends the available gift first.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N2-task-training-accessibility-confirmation",
    level: "N2",
    family: "listening-task",
    semanticFocus:
      "training coordinator confirms a participant accommodation before arranging equipment and seating",
    script:
      "男：来月の研修に、耳の聞こえにくい方が参加します。すぐ手話通訳を予約しましょうか。女：申し込みには『文字での支援を希望』とだけあり、通訳が必要とは書かれていません。本人が希望する方法を確認せずに機材を決めないほうがいいですね。まずメールで、字幕、筆談、通訳のどれが使いやすいか伺ってください。返事を受けてから機材を借り、席の位置も決めます。男：では、今日メールします。",
    question: "男の人は、このあと何をしますか。",
    options: [
      "手話通訳を予約する",
      "字幕用の機材を借りる",
      "参加者の席を前方に決める",
      "参加者に希望する支援方法を確認する",
    ],
    correctIndex: 3,
    explanation:
      "The request is not specific enough to select an accommodation. He must ask the participant first; equipment, interpreting, and seating depend on that answer.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N2-task-catering-allergy-count-update",
    level: "N2",
    family: "listening-task",
    semanticFocus:
      "conference assistant updates dietary counts before requesting a revised catering quote",
    script:
      "女：懇親会の料理、昨日の人数で注文してよいですか。男：今朝、乳製品を食べられない参加者が三人増えました。料理会社へ電話する前に、申込表でほかの食事制限も変わっていないか確認し、種類ごとの人数を更新してください。その数字で見積もりを取り直します。席札に印を付けるのは料理の内容が決まってからです。注文を確定するのは部長の承認後になります。女：まず申込表を確認します。",
    question: "女の人は、まず何をしますか。",
    options: [
      "申込表を確認して人数を更新する",
      "料理会社へ電話する",
      "席札に食事制限の印を付ける",
      "料理の注文を確定する",
    ],
    correctIndex: 0,
    explanation:
      "The revised dietary totals are needed before requesting a quote. Place cards and final ordering occur only after the menu and managerial approval are settled.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N2-task-lost-wallet-transit-card",
    level: "N2",
    family: "listening-task",
    semanticFocus:
      "commuter blocks a registered transit card before filing reports and replacing other documents",
    script:
      "男：電車の中で財布をなくしました。駅の忘れ物窓口へ行けばいいでしょうか。女：それも必要ですが、記名式の交通カードが入っていたなら、先に発行会社へ連絡して利用を止めたほうがいいです。警察へ届けるときは、財布の色や中身を書きます。銀行のカードはもうアプリで停止したんですね。男：はい。免許証の再発行は警察への届け出のあとにします。まず交通カードを止めます。",
    question: "男の人は、このあと最初に何をしますか。",
    options: [
      "駅の忘れ物窓口へ行く",
      "交通カードの利用を止める",
      "警察へ財布の届けを出す",
      "免許証を再発行する",
    ],
    correctIndex: 1,
    explanation:
      "His bank card is already blocked, but the registered transit card remains exposed. He stops it before visiting lost property, filing the police report, or replacing his license.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N2-task-museum-guide-reassignment",
    level: "N2",
    family: "listening-task",
    semanticFocus:
      "museum coordinator confirms a bilingual replacement before notifying an international tour group",
    script:
      "女：明日の英語ツアーの担当者が熱を出して休むそうです。参加者に中止のメールを送りますか。男：午後の担当者なら英語も話せますが、午前の展示内容を説明できるか確認が必要です。まず本人に、午前へ変更できるかと、今回の展示資料を読んでいるかを聞いてください。両方大丈夫なら時間を入れ替えます。そのあと参加者へ担当変更を知らせましょう。別の会社へ通訳を頼むのは、交代できない場合だけです。",
    question: "女の人は、まず何をしますか。",
    options: [
      "参加者にツアー中止を知らせる",
      "午前と午後の時間を入れ替える",
      "午後の担当者に時間と展示知識を確認する",
      "別の会社へ通訳を依頼する",
    ],
    correctIndex: 2,
    explanation:
      "A replacement is possible only if the afternoon guide is available and prepared for the exhibit. Reassignment and participant notice follow that check; outside help is a fallback.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N2-task-rental-damage-photo-record",
    level: "N2",
    family: "listening-task",
    semanticFocus:
      "new tenant records preexisting damage before signing the handover checklist and unpacking",
    script:
      "男：部屋の引き渡し表にサインして、荷物を入れてもいいですか。女：待ってください。窓の横の傷が表に書かれていません。管理会社へ修理を頼むかどうかはあとで決められますが、入居前からあったことは残しておく必要があります。まず日付が分かるように傷の写真を撮り、表に場所を書き加えてください。それからサインして、家具を置きましょう。鍵の本数はもう確認済みです。",
    question: "男の人は、まず何をしますか。",
    options: [
      "引き渡し表にサインする",
      "管理会社へ修理を頼む",
      "部屋に家具を置く",
      "傷を写真に撮って表へ書き加える",
    ],
    correctIndex: 3,
    explanation:
      "The unrecorded preexisting damage must be documented before acceptance. Repair can be decided later, and signing and unpacking follow the photographic record.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
] as const satisfies readonly UpperListeningSeed[];

const keyPointSeeds = [
  {
    semanticId: "N2-key-remote-work-information-gap",
    level: "N2",
    family: "listening-key-points",
    semanticFocus:
      "manager identifies informal information access rather than equipment as remote work weakness",
    script:
      "女：在宅勤務の調査では、パソコンや通信環境への不満はほとんどありませんでした。それでも新人ほど仕事が進めにくいと答えています。男：会議の資料は共有されていますが、事務所なら隣の人に聞ける小さな変更が、在宅だと伝わりにくいんです。正式な連絡を増やすだけでなく、短く相談できる時間をチームで決める必要がありますね。女：機械より、日常の情報の流れが問題なんですね。",
    question: "男の人は、在宅勤務の主な課題を何だと考えていますか。",
    options: [
      "小さな変更や相談が共有されにくいこと",
      "通信環境の差で会議資料を開けないこと",
      "正式な連絡が多く読む時間が足りないこと",
      "新人だけが出社日を自由に選べないこと",
    ],
    correctIndex: 0,
    explanation:
      "Equipment is adequate and formal documents are shared. The unresolved weakness is access to informal updates and quick questions, especially for newcomers.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N2-key-return-policy-packaging-condition",
    level: "N2",
    family: "listening-key-points",
    semanticFocus:
      "shop clerk explains that opened packaging rather than elapsed time blocks a headphone return",
    script:
      "男：三日前に買ったイヤホンを返品したいんですが、音が思ったより小さくて。女：購入から七日以内なので期間は問題ありません。ただ、衛生上、耳に入れる商品は箱を開けたあとの返品を受けられない決まりです。故障なら交換できますが、確認したところ正常に動いています。男：レシートがあるだけでは返品できないんですね。",
    question: "男の人がイヤホンを返品できない理由は何ですか。",
    options: [
      "音量が期待より小さいという理由だから",
      "開封後は返品できない商品だから",
      "購入から三日しか経っていないから",
      "故障した商品は返品ではなく交換になるから",
    ],
    correctIndex: 1,
    explanation:
      "The purchase is recent, the receipt is present, and the device works. The hygiene rule excluding opened in-ear products is the decisive restriction.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N2-key-podcast-commute-change",
    level: "N2",
    family: "listening-key-points",
    semanticFocus:
      "listener explains that a shorter commute reduced podcast use despite continued interest",
    script:
      "女：最近、語学の番組をあまり聞いていませんね。内容が難しくなりましたか。男：番組は今も面白いですよ。以前は電車で片道一時間だったので、毎日聞けました。でも引っ越して自転車で通うようになり、聞く時間がなくなったんです。家では本を読むことが多いですし。女：番組への興味がなくなったわけではないんですね。",
    question: "男の人が最近その番組を聞かなくなった主な理由は何ですか。",
    options: [
      "番組が難しくなり興味が薄れたから",
      "家では本より音声を選ぶことが増えたから",
      "通勤方法が変わり聞く時間が減ったから",
      "引っ越して通勤時間が以前より長くなったから",
    ],
    correctIndex: 2,
    explanation:
      "He still enjoys the program. Moving closer and cycling removed the long train-listening window, while reading occupies his home time.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N2-key-recycling-bin-feedback",
    level: "N2",
    family: "listening-key-points",
    semanticFocus:
      "facility manager attributes recycling errors to unclear bin feedback rather than unwilling users",
    script:
      "男：分別の説明会をしたのに、まだ違う箱に捨てる人が多いですね。女：利用者が協力したくないとは限りません。今の箱は全部同じ色で、投入口も同じ形です。表示を読む前に入れてしまう人が多いので、紙、びん、缶で色と入口の形を変えてみましょう。間違いが減るか一か月記録します。男：注意を増やすより、迷いにくい形にするんですね。",
    question: "女の人は、分別の間違いが多い主な原因を何だと考えていますか。",
    options: [
      "説明会の後も利用者に協力する意思がないこと",
      "表示を読むための時間が短すぎること",
      "分別する種類を増やしすぎたこと",
      "箱の見分けがつきにくいこと",
    ],
    correctIndex: 3,
    explanation:
      "She rejects lack of cooperation as the main assumption and points to identical colors and openings that provide poor visual guidance at the moment of disposal.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N2-key-workshop-attendance-time",
    level: "N2",
    family: "listening-key-points",
    semanticFocus:
      "organizer links declining workshop attendance to a new weekday time rather than content or publicity",
    script:
      "女：今年の料理講座、申し込みが減りましたね。内容は去年より増やし、案内も一か月早く出したのに。男：去年は土曜の午後でしたが、会場の都合で今年は水曜の六時からです。仕事が終わる時間に間に合わないという問い合わせが何件もありました。料金は変えていません。女：次回は会場を変えてでも週末に戻す必要がありそうですね。",
    question: "男の人は、申し込みが減った主な理由を何だと考えていますか。",
    options: [
      "開催時間が参加しにくいこと",
      "講座の内容を増やしすぎたこと",
      "案内を一か月前に出したこと",
      "料金を去年と同じにしたこと",
    ],
    correctIndex: 0,
    explanation:
      "Content and publicity improved and the fee is unchanged. Repeated inquiries show that the new Wednesday evening slot conflicts with work schedules.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N2-key-station-sign-sightline",
    level: "N2",
    family: "listening-key-points",
    semanticFocus:
      "designer finds that renovated station signs are hidden by crowds despite readable text",
    script:
      "男：駅の案内板を大きい字に変えたのに、乗り換えを聞く人が減りません。女：字は読みやすくなりました。ただ、案内板が改札のすぐ横なので、人が並ぶと後ろから見えません。情報の内容を増やすより、少し高い位置に移し、通路の手前から見えるようにするべきです。男：表示ではなく、見える場所の問題だったんですね。",
    question: "女の人は、現在の案内板の何が問題だと言っていますか。",
    options: [
      "文字を大きくしたため案内の量が減ったこと",
      "人に隠れて見えにくい位置にあること",
      "案内板が改札から離れすぎていること",
      "通路の手前にいる人が表示を読まないこと",
    ],
    correctIndex: 1,
    explanation:
      "The text itself is legible, but queues block the low sign. Her proposed fix changes height and sightline rather than wording or amount of information.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N2-key-training-course-prerequisite",
    level: "N2",
    family: "listening-key-points",
    semanticFocus:
      "employee selects a data course because the advanced option conflicts with both prerequisites and schedule",
    script:
      "女：来月、どの研修を受けますか。男：分析の上級講座に興味がありますが、基礎講座を終えた人が対象で、私はまだ受けていません。上級の内容だけ先に聞いても、十分理解できないと思います。それに上級は出張の日です。基礎講座は翌週で、仕事にも使えそうです。発表講座は受講済みで、管理職講座は今年の対象ではありません。女：では、基礎からですね。",
    question: "男の人は、どの研修を受けますか。",
    options: ["分析の上級講座", "発表講座", "分析の基礎講座", "管理職講座"],
    correctIndex: 2,
    explanation:
      "He lacks the advanced prerequisite and is away on its date. The presentation course is completed and management training does not apply, leaving the useful foundation course.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N2-key-reusable-cup-return-rate",
    level: "N2",
    family: "listening-key-points",
    semanticFocus:
      "cafe owner credits a deposit rather than discounts for improved reusable cup return rates",
    script:
      "男：貸し出し用のカップ、返される割合が上がりましたね。値引きを始めた効果ですか。女：飲み物の値段は変えていません。カップを借りるときに三百円預かり、返したときに戻す方法にしたんです。返却場所を駅にも増やしましたが、調査では『お金が戻るから忘れにくい』という回答が一番多かったです。男：便利さだけでなく、返す理由がはっきりしたんですね。",
    question:
      "女の人は、カップの返却が増えた最大の理由を何だと考えていますか。",
    options: [
      "飲み物を値引きしたこと",
      "駅にも返却場所を増やしたこと",
      "カップのデザインを変えたこと",
      "返却すると預けたお金が戻ること",
    ],
    correctIndex: 3,
    explanation:
      "Prices did not change. Although more return locations help, survey respondents most often cite recovering the deposit as the memorable incentive.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
] as const satisfies readonly UpperListeningSeed[];

const outlineSeeds = [
  {
    semanticId: "N2-outline-community-garden-ownership",
    level: "N2",
    family: "listening-outline",
    semanticFocus:
      "shared responsibility keeps a community garden sustainable beyond its enthusiastic launch",
    script:
      "女：地域の空き地を畑にすると、最初は多くの人が集まります。しかし、数か月すると、いつも同じ人だけが水やりや草取りをすることがあります。大切なのは、参加者を増やすことだけではありません。曜日ごとの担当を決め、できないときに交代を頼める仕組みを作ることです。収穫だけを楽しむ場所ではなく、世話の負担も相談して分けられる場所になって、初めて活動が長く続くのです。",
    question: "女の人が最も言いたいことは何ですか。",
    options: [
      "畑を続けるには世話を分担する仕組みが必要だ",
      "参加者を増やすことを長期継続より優先すべきだ",
      "収穫の分け方を決めれば世話の負担も公平になる",
      "毎日同じ担当者が世話をすれば活動は安定する",
    ],
    correctIndex: 0,
    explanation:
      "Her point is not simply recruitment or harvest. Durable participation requires an explicit, flexible way to share routine maintenance responsibilities.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N2-outline-email-recipient-discipline",
    level: "N2",
    family: "listening-outline",
    semanticFocus:
      "workplace email overload is reduced by clarifying who must act rather than changing tools",
    script:
      "男：社内メールが多いという不満から、新しい連絡アプリを入れる会社があります。ところが、同じ人全員に同じ情報を送り続ければ、道具を変えても通知は減りません。送る前に、返事や行動が必要な人、知っておくだけでよい人、送らなくてもよい人を分けるべきです。また、件名で期限と求める行動を示せば、受け手も優先順位を判断できます。問題はメールそのものより、相手と目的を考えずに送る習慣なのです。",
    question: "男の人が最も伝えたいことは何ですか。",
    options: [
      "新しいアプリを入れて通知を自動で分けるべきだ",
      "連絡では相手と求める行動を明確にすべきだ",
      "件名に期限さえ書けば宛先を選ぶ必要はない",
      "情報の見落としを防ぐため全員へ同じ内容を送るべきだ",
    ],
    correctIndex: 1,
    explanation:
      "He argues that indiscriminate distribution and unclear requests create overload; a new tool alone cannot replace disciplined audience and purpose selection.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N2-outline-tourism-daily-life-balance",
    level: "N2",
    family: "listening-outline",
    semanticFocus:
      "tourism planning must preserve resident routines rather than maximize visitor numbers alone",
    script:
      "女：観光客が増えると、店や宿泊施設の売り上げは伸びます。一方、生活道路に大きなバスが入り、住民が普段使う店が観光客向けに変わると、その町で暮らし続けることが難しくなります。観光を成功させるには、人数だけを目標にしてはいけません。訪問する時間や道を分け、地域の店が住民にも必要な商品を残せるよう支えることが大切です。住む人の日常が保たれてこそ、町の魅力も続きます。",
    question: "女の人の話の中心は何ですか。",
    options: [
      "観光客をより多くの観光店へ分散させる方法",
      "生活道路に入る大型バスだけを制限する必要性",
      "住民の生活と観光を両立させる必要性",
      "住民の買い物時間を観光客の予定に合わせる提案",
    ],
    correctIndex: 2,
    explanation:
      "The speaker recognizes economic benefits but makes them conditional on protecting resident mobility, shops, and everyday life over time.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N2-outline-library-sound-zones",
    level: "N2",
    family: "listening-outline",
    semanticFocus:
      "library manages competing uses through clear sound zones instead of one silence rule",
    script:
      "男：図書館では静かにするものだ、という考えは今も大切です。ただ、子どもへの読み聞かせや、学生が相談しながら学ぶ活動も図書館の役割になっています。館内すべてを同じ規則にすると、静かに読みたい人か、会話しながら学びたい人のどちらかが困ります。そこで、音を出せない場所、小さな声なら話せる場所、活動に使える場所を分け、入口で分かりやすく示す必要があります。異なる利用を禁止するのではなく、ぶつからないように設計するのです。",
    question: "男の人が提案していることは何ですか。",
    options: [
      "館内では従来どおり一つの静かさの基準を守ること",
      "利用の多い時間は読書より活動を優先すること",
      "苦情が出てから場所ごとの規則を決めること",
      "館内の場所ごとに音の規則を分けること",
    ],
    correctIndex: 3,
    explanation:
      "He rejects a single rule for incompatible uses and proposes clearly marked zones that allow quiet reading, low conversation, and activities to coexist.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N2-outline-exercise-startup-barrier",
    level: "N2",
    family: "listening-outline",
    semanticFocus:
      "lowering the effort needed to begin matters more than relying on motivation for exercise habits",
    script:
      "女：運動を続けられないと、自分の意志が弱いと思う人がいます。しかし、仕事のあとに遠い運動施設へ行き、着替え、長い運動をする計画では、始めるまでの負担が大きすぎます。帰宅する前に短い時間だけ歩く、靴を玄関に出しておくなど、行動を始めやすくすると、強い決心がない日でも動けます。続けるためには、毎回やる気を出そうとするより、始めるまでの手間を減らす工夫のほうが効果的です。",
    question: "女の人が最も言いたいことは何ですか。",
    options: [
      "運動を続けるには始めやすい環境を作るとよい",
      "運動の前に強い意志を持つ練習をするとよい",
      "長い運動を回数を減らして行うほうが効果的だ",
      "帰宅途中の運動だけを毎日の習慣にすべきだ",
    ],
    correctIndex: 0,
    explanation:
      "She reframes consistency as an environment-design problem: reduce the startup cost so action does not depend on exceptional motivation each day.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N2-outline-repairable-product-design",
    level: "N2",
    family: "listening-outline",
    semanticFocus:
      "product durability depends on repair access and replacement parts as well as strong materials",
    script:
      "男：長く使える製品というと、壊れにくい材料を使うことばかり考えがちです。もちろん強さは重要ですが、どんな製品にも故障は起こります。そのとき、一つの部品を交換するために全体を捨てなければならないなら、実際の使用期間は短くなります。部品を外しやすくし、修理方法を公開し、何年後でも交換部品を手に入れられるようにすることも、製品を長持ちさせる設計の一部なのです。",
    question: "男の人が主張していることは何ですか。",
    options: [
      "長持ちさせるには最も高価な材料を優先すべきだ",
      "長く使える設計には修理のしやすさも必要だ",
      "修理方法は保証期間だけ公開すれば十分だ",
      "部品は利用者が外せない構造にしたほうが安全だ",
    ],
    correctIndex: 1,
    explanation:
      "Material strength alone is insufficient. Replaceable parts, instructions, and long-term availability allow inevitable failures to be repaired instead of ending product life.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N2-outline-meeting-notes-decisions",
    level: "N2",
    family: "listening-outline",
    semanticFocus:
      "useful meeting notes record decisions owners and deadlines rather than reproduce every remark",
    script:
      "女：会議の記録を丁寧にしようとして、発言を一言ずつ書く人がいます。けれども、あとで必要なのは、だれがどんな言葉を使ったかより、何が決まり、だれがいつまでに行うかです。意見が分かれた理由は短く残すべきですが、会話をそのまま写すと重要な行動が見えにくくなります。記録は会議を再現するためではなく、決定を実行し、後から確認できるようにするために作るものです。",
    question: "女の人が考える、会議記録の最も重要な役割は何ですか。",
    options: [
      "発言をすべて再現し、決定事項はあとで探せるようにすること",
      "簡潔にするため意見が分かれた理由を省くこと",
      "決定と担当者と期限を確認できるようにすること",
      "記録を使って会議に出なかった人を評価すること",
    ],
    correctIndex: 2,
    explanation:
      "She treats notes as an execution and accountability tool. Verbatim transcription can obscure the decisions, owners, and due dates people need afterward.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N2-outline-public-art-maintenance",
    level: "N2",
    family: "listening-outline",
    semanticFocus:
      "public art succeeds through community process and maintenance planning beyond installation day",
    script:
      "男：広場に作品を置けば、それだけで町の新しい名所になるとは限りません。住民が計画を知らず、通行の邪魔になると感じれば、立派な作品でも受け入れられないでしょう。また、設置費だけを用意し、清掃や修理の担当を決めなければ、数年後には危険になることもあります。場所を使う人の意見を早い段階で聞き、作品を置いたあとにだれが世話をするかまで考えることが、公共の場所に芸術を生かす条件です。",
    question: "男の人の話の中心は何ですか。",
    options: [
      "有名な芸術家の作品なら住民への説明は少なくてよい",
      "住民の意見より先に十分な設置費を確保すべきだ",
      "維持方法は作品が傷んでから検討すればよい",
      "作品の設置には住民参加と維持計画が必要だ",
    ],
    correctIndex: 3,
    explanation:
      "The speaker argues that social acceptance and long-term stewardship—not installation alone or prestige—determine whether public art works in a shared place.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
] as const satisfies readonly UpperListeningSeed[];

const quickResponseSeeds = [
  {
    semanticId: "N2-quick-proposal-cost-concern",
    level: "N2",
    family: "listening-quick-response",
    semanticFocus:
      "colleague responds constructively to an indirect concern about proposal cost",
    script: "この案、悪くはないんだけど、今の予算では少し厳しくない？",
    question: "最も適切な応答を選んでください。",
    options: [
      "予算が厳しいなら、説明資料だけ先に作ります",
      "機能を絞った場合の費用も出してみます",
      "悪くないとのことなので、この案のまま進めます",
    ],
    correctIndex: 1,
    explanation:
      "The speaker cautiously raises affordability. Offering a reduced-scope cost estimate addresses the concern without misreading it as rejection or shifting responsibility.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N2-quick-draft-checkpoint",
    level: "N2",
    family: "listening-quick-response",
    semanticFocus:
      "writer offers an interim draft when asked whether a report can meet its deadline",
    script: "この報告書、金曜日までに仕上がりそうですか。",
    question: "最も適切な応答を選んでください。",
    options: [
      "金曜日は別の報告書を提出する日です",
      "仕上げる順番は目次どおりにしています",
      "木曜の午後には一度見ていただける段階にします",
    ],
    correctIndex: 2,
    explanation:
      "The question asks about progress toward a deadline. Promising a reviewable draft on Thursday provides concrete evidence that completion is on track.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N2-quick-overlapping-meetings",
    level: "N2",
    family: "listening-quick-response",
    semanticFocus:
      "employee proposes a practical handoff after discovering two required meetings overlap",
    script: "午後の二つの会議、時間が重なってしまいましたね。",
    question: "最も適切な応答を選んでください。",
    options: [
      "片方は私が出て、あとで内容を共有しましょう",
      "会議室が近いので、両方とも同じ時刻のままにしましょう",
      "開始時刻だけ確認して、重なりはそのままにしましょう",
    ],
    correctIndex: 0,
    explanation:
      "The overlap creates a coverage problem. Dividing attendance and sharing notes is the only response that resolves it rather than merely commenting on location or busyness.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N2-quick-customer-wait-complaint",
    level: "N2",
    family: "listening-quick-response",
    semanticFocus:
      "staff member acknowledges an excessive wait and immediately checks order status",
    script: "注文してから三十分も待っているんですが。",
    question: "最も適切な応答を選んでください。",
    options: [
      "順番にお出ししていますので、あと三十分お待ちください",
      "申し訳ありません。すぐ状況を確認いたします",
      "三十分前なら、注文はまだ受けていないと思います",
    ],
    correctIndex: 1,
    explanation:
      "The customer is complaining about a long wait. An apology plus an immediate status check is the fitting service response; the alternatives evade the problem.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N2-quick-review-reservation",
    level: "N2",
    family: "listening-quick-response",
    semanticFocus:
      "presenter interprets a cautious request for further review without treating it as approval",
    script: "方向は分かるんですが、結論はもう少し検討の余地がありそうですね。",
    question: "最も適切な応答を選んでください。",
    options: [
      "では、方向が分かったとのことなので、この結論で決定します",
      "検討の余地があるなら、根拠は今のままでよさそうですね",
      "根拠を整理して、次回もう一度ご説明します",
    ],
    correctIndex: 2,
    explanation:
      "The listener understands the direction but withholds agreement on the conclusion. Offering to strengthen the evidence and return respects that qualified feedback.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N2-quick-favor-reciprocity",
    level: "N2",
    family: "listening-quick-response",
    semanticFocus:
      "colleague responds graciously when thanked for covering an unexpected client visit",
    script: "急な来客に対応してくれて、本当に助かりました。",
    question: "最も適切な応答を選んでください。",
    options: [
      "いえ、前に私も助けてもらいましたから",
      "来客の方もかなり急いでいたようです",
      "次からは急な来客がないよう、先方に伝えてください",
    ],
    correctIndex: 0,
    explanation:
      "The prompt expresses gratitude. Modestly framing the help as reciprocity is socially appropriate, unlike factual but nonresponsive remarks about visitors or schedules.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N2-quick-chart-density-feedback",
    level: "N2",
    family: "listening-quick-response",
    semanticFocus:
      "analyst accepts feedback that a presentation slide contains too many figures",
    script: "このページ、数字が多くて要点が伝わりにくくないですか。",
    question: "最も適切な応答を選んでください。",
    options: [
      "数字は正確なので、このままでも問題ないと思います",
      "重要な二つを残して、グラフに直します",
      "説明時間を延ばして、数字は全部読み上げます",
    ],
    correctIndex: 1,
    explanation:
      "The concern is clarity, not numerical order or printing. Selecting the key figures and visualizing them directly responds to the communication problem.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N2-quick-schedule-change-apology",
    level: "N2",
    family: "listening-quick-response",
    semanticFocus:
      "participant accepts an apologetic last-minute schedule change while confirming availability",
    script:
      "急な変更で申し訳ないんですが、開始を一時間遅らせても大丈夫ですか。",
    question: "最も適切な応答を選んでください。",
    options: [
      "一時間早めるということですね",
      "変更の連絡は一時間前に届きました",
      "はい、その時間でも間に合います",
    ],
    correctIndex: 2,
    explanation:
      "The speaker apologetically asks whether a one-hour delay is acceptable. Confirming continued availability directly answers the request; the other statements do not.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
] as const satisfies readonly UpperListeningSeed[];

const integratedSeeds = [
  {
    semanticId: "N2-integrated-coworking-room-allocation",
    level: "N2",
    family: "listening-integrated",
    semanticFocus:
      "coworking center combines reservable quiet rooms with open booths after reconciling demand and staffing",
    script:
      "ナレーション：市の共同作業施設で、個室の使い方を見直しています。利用調査員：予約記録では、オンライン会議が多い火曜と木曜の午後に個室が足りません。一方、午前中は予約されても使われない部屋が目立ちます。短い電話だけの人も二時間の枠を取っています。施設職員：受付で利用目的を毎回確認すると時間がかかります。声を出せる小さな席を予約なしで用意すれば、短い電話の人はそちらへ案内できます。個室は重要な会議や集中作業のために残せます。ただし予約を完全になくすと、遠くから来る人が困ります。利用者代表：予約時間を一時間単位にして、使わないときは早めに取り消せるようにしてほしいです。午前の利用を無料にしても、必要のない人が来るとは限りません。電話用の席は周りに声が広がらない形なら使いたいです。会計担当：新しい個室を増やす予算はありませんが、空いている廊下の一部に吸音材のある電話席を三つ置く費用なら出せます。受付職員を増やす案は来年度まで難しいため、利用者が自分で選べる仕組みにしてください。ナレーション：担当課は、予約の確実さを残しながら、短時間の通話が個室を占めない方法を選びます。",
    question: "話し合いの内容に最も合う個室の運用方法はどれですか。",
    options: [
      "個室を一時間予約にするが、短い電話にも個室を使わせる",
      "取り消しやすい一時間予約を残し、短い通話向けの別席を設ける",
      "午前の個室を無料にし、午後の予約は二時間のままにする",
      "受付が利用目的を審査し、個室と電話席を割り当てる",
    ],
    correctIndex: 1,
    explanation:
      "One-hour reservable rooms preserve certainty and improve turnover, while separate acoustic booths divert brief calls without requiring labor-intensive screening.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
    sourceCount: 4,
  },
  {
    semanticId: "N2-integrated-school-lunch-waste",
    level: "N2",
    family: "listening-integrated",
    semanticFocus:
      "school reduces lunch waste through adjustable staple portions and student feedback rather than smaller meals for everyone",
    script:
      "ナレーション：中学校で、給食の食べ残しを減らす方法を話し合っています。栄養職員：一か月量ったところ、おかずよりご飯とパンの残りが多く、学年による差もありました。必要な栄養は確保しなければならないので、全員の量を同じように減らすことはできません。調理員：料理を作る前に人数は分かりますが、一人ずつ希望を聞いて盛る時間はありません。教室で配るときなら、主食を少なめにする人と多めにする人を分けられます。余った分は配膳の途中で追加できます。生徒代表：最初から多いと、残したくなくても食べ切れません。自分で減らすのを恥ずかしいと思う人もいるので、先生が全員に量を選べると説明してほしいです。好きなおかずだけ増やす方法では栄養が偏ります。学級担任：量を選ぶことを特別扱いにせず、配る前に全員へ同じように聞けば、生徒も言いやすくなります。追加する場所を教室の前に決めれば、配膳時間も大きく延びません。実施後は残った主食の重さを学級ごとに記録できます。ナレーション：学校は、栄養量と配膳時間を守りながら、主食の個人差に対応する案を選びます。",
    question: "食べ残しを減らす方法として、最も適切なものはどれですか。",
    options: [
      "主食もおかずも全員一律に少なくし、希望者だけ追加する",
      "主食の希望量を毎朝調理前に全生徒から集める",
      "全員に案内して教室で主食量を選ばせ、追加分も用意する",
      "主食を減らした生徒には好きなおかずだけ多く配る",
    ],
    correctIndex: 2,
    explanation:
      "Flexible staple portions at classroom service address measured variation without reducing nutrition for everyone or creating an impossible pre-cooking survey workflow.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
    sourceCount: 4,
  },
  {
    semanticId: "N2-integrated-festival-transport-loop",
    level: "N2",
    family: "listening-integrated",
    semanticFocus:
      "festival transport plan uses remote parking shuttles at peak hours while preserving resident road access",
    script:
      "ナレーション：川沿いの祭りで、会場周辺の交通対策を検討しています。住民代表：去年は昼から夜まで道路を閉じたため、住民も車で家へ戻れませんでした。今年は生活道路を一本残し、観光客の車は住宅地へ入れないようにしてほしいです。交通会社：駅からの路線バスは通常どおり走れますが、花火の前後は乗り切れません。郊外の臨時駐車場から会場近くまで、午後四時から十時なら二台で往復運行できます。一日中では運転手が足りません。実行委員：来場者調査では、車で来る人の多くが駐車場所さえ確実なら少し離れていてもよいと答えています。駅前を臨時駐車場にすると路線バスの邪魔になります。会場前で降ろすと混雑するので、徒歩五分の広場が安全です。警察担当：救急車が通れる道を確保する必要があります。生活道路を一般の来場車から守り、広場から会場までの歩道に案内員を置けば、安全に誘導できます。会場前は人が集まるため、バスの乗り降りには使わないでください。ナレーション：委員会は、住民の移動を守り、花火の混雑時間に利用できる案を選びます。",
    question: "祭りの交通対策として、最も条件に合うものはどれですか。",
    options: [
      "生活道路を住民用に確保し、郊外駐車場と徒歩圏の広場を夕方のバスで結ぶ",
      "郊外駐車場から会場前まで、一日中バスを往復させる",
      "駅前を駐車場にして、路線バスを増便する",
      "生活道路を一本残すが、観光客の車も住宅地へ案内する",
    ],
    correctIndex: 0,
    explanation:
      "A peak-hour shuttle from remote parking to the nearby safe plaza fits driver limits and visitor tolerance while keeping a resident route and existing buses usable.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
    sourceCount: 4,
  },
  {
    semanticId: "N2-integrated-clinic-video-access",
    level: "N2",
    family: "listening-integrated",
    semanticFocus:
      "clinic offers optional video follow-ups with identity checks while retaining phone and in-person access",
    script:
      "ナレーション：診療所で、通院後の相談をオンラインでも行う案が出ています。看護師：薬を始めた一週間後の確認など、診察室へ来なくても話せる内容があります。ただ、画面だけでは判断できない症状もあるので、初めての患者や状態が急に変わった人は対面が必要です。患者代表：仕事中に病院へ行きにくい人には便利ですが、スマートフォンを使わない高齢者もいます。電話相談をなくしたり、オンラインだけにしたりしないでください。情報担当：映像相談では本人確認を行い、患者ごとの案内に記した一回限りの接続番号を使えば、一般の会議用リンクより安全です。録画はせず、相談後の記録だけを通常の診療記録に残せます。医師：映像を選んだ患者でも、話を聞いて診察が必要だと判断したら来院してもらいます。予約時に相談内容を短く確認し、どの方法が適切か決めましょう。映像だから診療記録を別にする必要はなく、同じ記録の中で経過を追えることが大切です。ナレーション：診療所は、便利さを増やしつつ、症状と利用者に合った方法を残す案を選びます。",
    question: "話し合いの内容を反映した相談方法はどれですか。",
    options: [
      "安定した再診には映像も使うが、電話相談は廃止する",
      "映像相談では一般の会議用リンクを使い、録画だけは行わない",
      "予約時には患者が症状に関係なく相談方法を選ぶ",
      "安定した再診には安全な映像相談も選べ、電話と対面も残す",
    ],
    correctIndex: 3,
    explanation:
      "Optional secured video suits stable follow-ups, while phone access and clinical judgment preserve inclusion and route new or worsening cases to in-person care.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
    sourceCount: 4,
  },
  {
    semanticId: "N2-integrated-commute-support-flexibility",
    level: "N2",
    family: "listening-integrated",
    semanticFocus:
      "company replaces uniform commuter passes with capped flexible support based on actual office attendance",
    script:
      "ナレーション：在宅勤務が増えた会社で、交通費の制度を見直しています。人事担当：現在は全員に一か月の定期券代を払っていますが、週一回しか出社しない人には、実際の電車代より高くなる場合があります。一方、毎日来る人には定期券のほうが安いです。社員代表：出社日数は月によって変わります。毎回申請する方法は手間がかかるので、交通カードの利用記録を月末にまとめて出せると助かります。ただ、遠くから来る人が月の途中で自己負担にならないよう、これまでの定期券代までは支給してほしいです。経理担当：実費を無制限に払うと予算を管理できません。実際の出社分を基本にし、同じ区間の定期券代を上限にすれば、毎日出社する人も不利になりません。記録は月一回なら処理できます。部門長：急な出社を命じることもあるので、社員が自己負担を心配して断る制度にはできません。予定より出社が増えた月も実際の利用分が出て、毎日の細かな承認が不要なら、現場でも使いやすいと思います。ナレーション：会社は、出社頻度の違いを反映しながら、申請と予算を管理できる制度を選びます。",
    question: "会社の条件に最も合う交通費制度はどれですか。",
    options: [
      "実費を定期券代まで支払うが、利用のたびに上司の許可を求める",
      "全員に最も安い区間の定期券代を一律に支払う",
      "月ごとの実費を定期券代まで支払い、利用記録をまとめて出す",
      "月末に利用記録を出せば、実費を上限なく支払う",
    ],
    correctIndex: 2,
    explanation:
      "Monthly actual-cost reimbursement reflects attendance, a pass-price cap controls spending and protects frequent commuters, and one bundled record limits administrative burden.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
    sourceCount: 4,
  },
  {
    semanticId: "N2-integrated-museum-family-guide",
    level: "N2",
    family: "listening-integrated",
    semanticFocus:
      "museum combines short family prompts with optional audio and tactile materials instead of one dense guide",
    script:
      "ナレーション：美術館で、家族向けの展示案内を作ろうとしています。学芸員：作品の歴史を正確に説明しようとすると文章が長くなりますが、小学生には読むのが難しいでしょう。重要な背景は残しながら、まず観察する点を短い質問で示したいです。保護者代表：子どもは答えを読むより、『どこが違うかな』と話しながら見るほうが集中します。詳しく知りたい大人もいるので、説明を全部なくすのではなく、音声で選んで聞けると助かります。利用支援員：目で見える情報だけでは使えない人もいます。触れられる材料の見本や、音声の文字版も用意してください。全作品に同じ量を作るのが難しければ、代表的な作品から始められます。小学校教員：見学時間は限られているので、すべてを順番に聞く案は使いにくいです。子どもが気になった作品を選び、質問をきっかけに話せる形なら授業にもつながります。先生向けには、事前に活動例を読める資料があると助かります。ナレーション：美術館は、親子の会話を促し、必要に応じて情報を深められる案を選びます。",
    question: "家族向け案内として、話し合いの内容に最も合うものはどれですか。",
    options: [
      "短い観察質問に、選べる音声・文字・触覚資料を組み合わせる",
      "短い観察質問だけにして、詳しい情報はすべて除く",
      "全作品の音声を順番に聞かせ、文字版は作らない",
      "すべての作品に触覚資料を完成させてから案内を始める",
    ],
    correctIndex: 0,
    explanation:
      "Brief observation prompts support family dialogue, while optional multimodal depth retains accuracy and access without forcing one dense format on every visitor.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
    sourceCount: 4,
  },
  {
    semanticId: "N2-integrated-apartment-heat-retrofit",
    level: "N2",
    family: "listening-integrated",
    semanticFocus:
      "apartment prioritizes roof insulation and targeted window sealing within budget while protecting ventilation",
    script:
      "ナレーション：古い集合住宅で、冬の寒さと暖房費を改善する工事を検討しています。建築士：調査では、最上階の天井から逃げる熱が最も多く、次に古い窓のすき間が問題でした。屋根の断熱は外側からできるので、住民が部屋を空ける必要がありません。すべての窓交換は効果がありますが、今年の予算を超えます。住民代表：寝室の窓から風が入る家が多いです。ただ、工事中に一週間も別の場所へ移るのは難しい人がいます。部屋ごとの作業が一日なら協力できます。管理担当：窓のすき間をふさぐ工事と屋根の断熱なら予算内です。換気口までふさぐと空気の問題が出るため、そこは残す必要があります。効果を冬に測れば、来年の窓交換の優先順位も決められます。設備担当：暖房機を増やすだけでは電気代も上がります。まず熱が逃げる場所を直し、工事前後で各階の室温を同じ時間に測りましょう。換気口は安全のため必要なので、窓のすき間と間違えない表示も付けます。ナレーション：管理組合は、今年実施でき、調査結果にも合う組み合わせを選びます。",
    question: "今年の工事として、最も適切な組み合わせはどれですか。",
    options: [
      "屋根を断熱し、今年中に全戸の窓も交換する",
      "窓のすき間と換気口をふさぎ、屋根は来年にする",
      "最上階の暖房機を増やし、各階の室温だけを測る",
      "屋根を断熱し、窓のすき間をふさいで換気口は残す",
    ],
    correctIndex: 3,
    explanation:
      "Roof insulation addresses the largest loss without displacement, and targeted sealing fits budget and one-day access while preserving required ventilation.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
    sourceCount: 4,
  },
  {
    semanticId: "N2-integrated-study-room-booking",
    level: "N2",
    family: "listening-integrated",
    semanticFocus:
      "university balances study room access with shorter reservations release rules and walk-in availability",
    script:
      "ナレーション：大学図書館で、グループ学習室の予約方法を見直しています。図書館員：試験前は満室ですが、予約したグループが来ない部屋も一日に数件あります。現在は三時間単位で、一週間前から何室でも予約できるため、一つの団体が多く押さえることがあります。学生代表：発表練習には予約が必要ですが、相談が急に決まることもあります。全部を予約制にすると、その日に使える部屋がありません。開始後十五分来なければ予約を取り消す決まりなら、空室を利用しやすいです。教員：長い研究相談には二時間ほど必要ですが、三時間は長すぎます。一団体が同時に取れる数を限り、一部を当日利用に残せば、多くの学生が使えるでしょう。利用支援員：車いすで使いやすい部屋は二室だけなので、その二室まで一律に当日用にすると、必要な人が予約できなくなります。設備条件を予約画面に示し、必要な部屋は事前に選べる状態を残してください。ナレーション：図書館は、計画的な利用と急な利用の両方を可能にし、空予約を減らす案を選びます。",
    question: "条件に最も合う予約方法はどれですか。",
    options: [
      "二時間枠と予約数制限を設けるが、全室を事前予約だけにする",
      "一部を当日用にし、設備の必要な部屋も予約できないようにする",
      "二時間枠と予約数制限を設け、設備の必要な部屋は予約可能に保ち、ほかの一部を当日用にして遅刻枠を解放する",
      "十五分後の解放だけを導入し、三時間枠と予約数は今のままにする",
    ],
    correctIndex: 2,
    explanation:
      "Shorter capped bookings preserve planned work, walk-in rooms and released no-shows support spontaneous use, and equipment labels keep suitable accessible rooms reservable.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
    sourceCount: 4,
  },
] as const satisfies readonly UpperListeningSeed[];

export const n2UpperListeningExpansion: readonly UpperListeningSeed[] = [
  ...taskSeeds,
  ...keyPointSeeds,
  ...outlineSeeds,
  ...quickResponseSeeds,
  ...integratedSeeds,
];
