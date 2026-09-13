import {
  readingBody,
  readingCharacterCount,
  type ReadingFamily,
  type ReadingSeed,
  type ReadingSource,
} from "./reading-seed";

/**
 * Original N2/N1 reading seeds authored against the official JLPT item purposes.
 *
 * Official scale is approximate rather than a hard limit. `sources` preserves
 * the multiple-text boundary required by integrated comprehension; consumers
 * may join them for the current single-passage renderer but must retain labels.
 */

export type UpperReadingLevel = "N2" | "N1";

export type UpperReadingFamily = ReadingFamily;

export type UpperReadingSource = ReadingSource;

export interface UpperReadingSeed extends Omit<ReadingSeed, "level"> {
  level: UpperReadingLevel;
}

export function upperReadingBody(seed: UpperReadingSeed) {
  return readingBody(seed);
}

export function upperReadingCharacterCount(seed: UpperReadingSeed) {
  return readingCharacterCount(seed);
}

const n2ShortSeeds = [
  {
    semanticId: "N2-short-flex-hours-overlap",
    level: "N2",
    family: "reading-short",
    semanticFocus:
      "flexible work hours retain a mandatory collaboration window",
    sources: [
      {
        body: "来月から、社員は午前七時から十時までの間に出社時刻を選べる。ただし、部署をこえた相談が難しくならないよう、午前十時から午後三時までは全員が勤務する。外出の予定がある場合も、この時間に連絡が取れるようにしておく必要がある。制度の目的は、各自の生活に合わせながら、協力に必要な時間を失わないことである。",
      },
    ],
    question: "この制度について、正しいものはどれか。",
    options: [
      "出社時刻は選べるが、全員が勤務する共通時間がある",
      "社員は一日中、連絡を受けなくてもよい",
      "部署ごとに勤務時間を完全に別にする",
      "外出する社員は制度を利用できない",
    ],
    correctIndex: 0,
    evidence: [
      "午前十時から午後三時までは全員が勤務する",
      "各自の生活に合わせながら、協力に必要な時間を失わない",
    ],
    explanation:
      "Start time is flexible, but the passage explicitly preserves a shared 10:00–15:00 collaboration window. The other choices remove that requirement or add a restriction not stated.",
  },
  {
    semanticId: "N2-short-library-donation-selection",
    level: "N2",
    family: "reading-short",
    semanticFocus:
      "library book donations are accepted for review rather than guaranteed shelving",
    sources: [
      {
        body: "市立図書館では本の寄付を受け付けているが、寄付された本がすべて館内に置かれるわけではない。内容が古くなった実用書や、同じ本がすでに十分ある場合は、地域の読書会に譲ることがある。寄付した人が置き場所を指定したり、返却を求めたりすることはできない。申し込む前に、本の状態と発行年を用紙に記入する。",
      },
    ],
    question: "本を寄付する人が理解しておくべきことは何か。",
    options: [
      "新しい本だけが受け付けられる",
      "寄付後も本の返却を求められる",
      "本が図書館以外で活用される場合もある",
      "本の置き場所を寄付者が決める",
    ],
    correctIndex: 2,
    evidence: [
      "すべて館内に置かれるわけではない",
      "地域の読書会に譲ることがある",
    ],
    explanation:
      "The library may pass a donated book to a community reading group. It does not restrict all donations to new books, and donors cannot specify placement or request return.",
  },
  {
    semanticId: "N2-short-delivery-locker-deadline",
    level: "N2",
    family: "reading-short",
    semanticFocus:
      "apartment delivery locker releases uncollected parcels after three days",
    sources: [
      {
        body: "宅配ロッカーに荷物が入ると、登録したメールアドレスに番号が届く。その番号は受け取りのたびに変わるため、以前の番号は使えない。荷物は到着した日を含め三日以内に受け取ること。期限を過ぎると管理室が荷物を取り出し、配送会社へ戻す。旅行などで受け取れないと分かっている場合は、到着前に配送日の変更を依頼してほしい。",
      },
    ],
    question: "住民は、三日以内に荷物を受け取れない場合、どうするべきか。",
    options: [
      "以前届いた番号でロッカーを開ける",
      "到着する前に配送日の変更を頼む",
      "管理室に荷物を四日間置いてもらう",
      "配送会社が来るまで何もしない",
    ],
    correctIndex: 1,
    evidence: ["受け取れないと分かっている場合は、到着前に配送日の変更を依頼"],
    explanation:
      "The notice directs residents who know they will be unavailable to change the delivery date before arrival. After three days, management returns the parcel rather than extending storage.",
  },
  {
    semanticId: "N2-short-minutes-decision-boundary",
    level: "N2",
    family: "reading-short",
    semanticFocus:
      "meeting minutes distinguish decisions from unresolved proposals",
    sources: [
      {
        body: "会議の記録には、発言をすべて書く必要はない。後から確認できるよう、決定したこと、担当者、期限を中心にまとめる。一方、意見は出たが結論が出なかった事項は、決定事項と混ぜず、「次回検討」として残す。欠席者が読んだとき、何を実行すべきかと、まだ話し合うべきことを区別できる記録にすることが重要だ。",
      },
    ],
    question: "筆者が会議の記録で重視していることは何か。",
    options: [
      "発言を一語も省かずに書くこと",
      "欠席者の意見を推測して加えること",
      "未決定の意見を記録から除くこと",
      "決定事項と今後の検討事項を分けること",
    ],
    correctIndex: 3,
    evidence: ["決定事項と混ぜず、「次回検討」として残す", "区別できる記録"],
    explanation:
      "The central instruction is to separate executable decisions from unresolved items. Unresolved opinions remain recorded, while verbatim transcription and speculation are rejected.",
  },
  {
    semanticId: "N2-short-rain-event-partial-change",
    level: "N2",
    family: "reading-short",
    semanticFocus: "rain changes only the outdoor part of a community event",
    sources: [
      {
        body: "土曜日の交流会は、雨の場合も開催する。午前の町歩きだけを中止し、参加者は十一時に直接、市民会館へ集合する。昼食作りと午後の発表会は予定どおり行う。町歩きの参加費は当日返金するが、昼食の材料はすでに注文しているため、交流会全体を欠席しても残りの参加費は返金できない。天候による変更は金曜日の夕方にメールで知らせる。",
      },
    ],
    question: "雨で町歩きが中止になった場合、参加者はどうするか。",
    options: [
      "交流会の全日程が中止になる",
      "朝から市民会館で町歩きをする",
      "十一時に市民会館へ行き、残りの活動に参加する",
      "材料費を含む全額の返金を受ける",
    ],
    correctIndex: 2,
    evidence: [
      "参加者は十一時に直接、市民会館へ集合する",
      "昼食作りと午後の発表会は予定どおり",
    ],
    explanation:
      "Only the walk is canceled. Participants assemble at the hall at 11:00 for lunch preparation and the presentations; only the walk fee is refunded.",
  },
  {
    semanticId: "N2-short-museum-photo-exception",
    level: "N2",
    family: "reading-short",
    semanticFocus:
      "museum allows nonflash personal photography except marked borrowed works",
    sources: [
      {
        body: "館内では、個人で楽しむための写真撮影ができる。ただし、赤い印のある作品は他館から借りているため撮影できない。撮影できる作品でも、フラッシュや三脚は使わず、通路をふさがないこと。撮った写真を商品の広告などに利用したい場合は、個人のSNSに載せる場合とは異なり、事前の申請が必要である。",
      },
    ],
    question: "事前の申請をせずにできることはどれか。",
    options: [
      "赤い印の作品をフラッシュなしで撮る",
      "三脚を使って自分の記録用に撮る",
      "撮影した写真を商品の広告に使う",
      "印のない作品をスマートフォンで個人用に撮る",
    ],
    correctIndex: 3,
    evidence: [
      "個人で楽しむための写真撮影ができる",
      "赤い印のある作品は他館から借りているため撮影できない",
      "フラッシュや三脚は使わず",
    ],
    explanation:
      "Personal nonflash photography of an unmarked work is allowed. Marked loans, tripods, and advertising use are explicitly restricted.",
  },
  {
    semanticId: "N2-short-course-cancellation-transfer",
    level: "N2",
    family: "reading-short",
    semanticFocus: "canceled course offers transfer before refund",
    sources: [
      {
        body: "受講者が五人に満たない講座は、開始日の一週間前に中止を決定する。中止になった場合、まず同じ内容の別の日程を案内する。都合が合えば追加料金なしで変更できる。案内された日程にも参加できない人には、受講料を全額返金する。ただし、受講者自身の都合による取り消しには、通常のキャンセル料がかかる。",
      },
    ],
    question: "人数不足で講座が中止になったとき、最初に行われることは何か。",
    options: [
      "受講料からキャンセル料を引く",
      "同じ内容の別の日程を紹介する",
      "開始日を一週間遅らせる",
      "全員にすぐ現金で返金する",
    ],
    correctIndex: 1,
    evidence: ["まず同じ内容の別の日程を案内する"],
    explanation:
      "The organizer first offers another date for the same content. A full refund follows only when that alternative also does not work for the learner.",
  },
  {
    semanticId: "N2-short-shared-kitchen-last-user",
    level: "N2",
    family: "reading-short",
    semanticFocus:
      "shared kitchen assigns closing checks to the final reservation holder",
    sources: [
      {
        body: "共同キッチンでは、使った道具を洗って元の場所に戻し、ごみは各自で持ち帰る。最後の時間帯を予約した人は、自分が使っていない場所も含め、窓が閉まっているか、冷蔵庫の扉が開いていないかを確認してから照明を消す。前の利用者が汚れを残していた場合は、片づける前に必ず写真を撮って管理者へ送る。",
      },
    ],
    question: "最後の時間帯の利用者に特に求められていることは何か。",
    options: [
      "前の利用者のごみを持ち帰ること",
      "冷蔵庫の中身をすべて捨てること",
      "キッチン全体の戸締まりなどを確認すること",
      "汚れを見つけても管理者に知らせないこと",
    ],
    correctIndex: 2,
    evidence: [
      "自分が使っていない場所も含め",
      "窓が閉まっているか、冷蔵庫の扉が開いていないかを確認",
    ],
    explanation:
      "The last booking holder has a whole-room closing duty, not merely cleanup of their own area. Existing dirt should be photographed and reported before cleaning.",
  },
] as const satisfies readonly UpperReadingSeed[];

const n1LongSeeds = [
  {
    semanticId: "N1-long-policy-productive-uncertainty",
    level: "N1",
    family: "reading-long",
    semanticFocus:
      "public policy should make uncertainty governable rather than conceal it",
    sources: [
      {
        body: "将来を予測して計画を立てることは、行政の重要な仕事である。人口や交通量を見積もらなければ、学校も道路も造れない。ところが、予測値が資料に印刷されると、それがどのような条件に基づく値なのかは忘れられ、将来そのものを写した数字のように扱われやすい。十年後の人口を一つの値で示せば説明は簡潔になるが、出生率や転入のわずかな違いで結果が大きく変わることは見えなくなる。\n不確実だから計画をやめる、というのは現実的ではない。問題は、不確実性を計画の外へ追い出すことだ。ある自治体は新しい施設を建てる際、将来の利用者数を低・中・高の三通りで示した。しかし、議会には中央の数字だけが提出され、ほかは「混乱を招く」として省かれた。数年後、利用者は低い見積もりにも届かなかった。予測が外れたこと以上に問題だったのは、低い場合に施設の一部を別用途へ変える設計を、検討していなかったことである。\n幅を示せば誠実だ、というだけでもない。可能性を大量に並べると、今度は何も決められなくなる。必要なのは、結果を変える条件を明らかにし、どの兆候を観察し、いつ判断を更新するかを先に決めることだ。たとえば児童数が一定水準を下回ったら教室を地域活動に転用する、公共交通の利用が増えたら駐車場を縮小する、といった変更の道筋を設計に組み込む。そうすれば、最初の判断は最終決定ではなく、観察を伴う仮の選択となる。\nもちろん、変更可能性を重視しすぎれば、当初から十分な規模の投資ができず、かえって費用が増す場合もある。堤防のように後から簡単には広げられないものもある。だから、あらゆる政策を小さく始めよという話ではない。失敗したときの影響が大きく、しかも後戻りしにくい決定ほど、安全側の余裕が必要である。一方、需要に合わせて用途を変えられる施設なら、変化を受け止める構造のほうが有効だろう。\n政策に求められるのは、未来を正確に言い当てたように見せることではない。何が分かっておらず、そのことがどの決定に影響するかを共有し、新しい情報が得られたときに判断を変えられるようにすることだ。不確実性を認めると責任が弱まると思われるかもしれない。しかし実際には、どの条件を見て決め直すかを公にするほうが、外れた予測に固執するより責任の所在は明確になる。不確実性は、決定を避ける口実ではなく、決定を更新可能にするための材料なのである。",
      },
    ],
    question: "筆者が政策立案について最も主張したいことは何か。",
    options: [
      "予測は必ず外れるので、長期的な公共投資を控えるべきだ",
      "複数の予測値をできるだけ多く示し、判断を将来へ延期すべきだ",
      "不確実性を生む条件と見直しの基準を示し、変更可能な計画にすべきだ",
      "安全に関わる施設も需要に応じて小規模に始めるべきだ",
    ],
    correctIndex: 2,
    evidence: [
      "どの兆候を観察し、いつ判断を更新するかを先に決める",
      "不確実性は、決定を避ける口実ではなく、決定を更新可能にするための材料",
    ],
    explanation:
      "The essay argues for conditional, revisable policy: disclose what drives uncertainty and predefine observation and revision points. It rejects both pretending a central estimate is certain and postponing all decisions, while noting that irreversible safety infrastructure may require a different margin.",
  },
  {
    semanticId: "N1-long-invisible-maintenance-status",
    level: "N1",
    family: "reading-long",
    semanticFocus:
      "maintenance becomes visible only at failure, so institutions must value prevented events",
    sources: [
      {
        body: "新しい橋の完成式には人が集まり、写真が残る。だが、その橋を三十年間安全に保つ点検には、同じ種類の注目は向けられない。問題なく使える日が続くほど、保守の仕事は何も起こしていないように見えるからだ。故障を直せば成果を説明しやすいが、故障を防いだ結果は「起きなかった出来事」であり、数えるのが難しい。\nこの見えにくさは、予算の配分にも影響する。ある組織で設備管理費が削られたとする。翌年すぐ事故が起きなければ、削減は成功に見える。しかし実際には、担当者が予備部品を使い切ったり、点検間隔を延ばしたりして、表面上の安定を支えているかもしれない。数年後に故障が集中しても、その原因が過去の削減と結びつけられるとは限らない。短期的な数字は、蓄積した弱さを隠すことがある。\nだからといって、保守に使った費用をすべて正当化すればよいわけではない。以前から続いているという理由だけで不要な点検を残せば、限られた人員を浪費する。重要なのは、どの故障を避けようとしているのか、その兆候は何か、点検によって実際に何が見つかったかを記録することである。部品交換の回数だけでなく、交換を見送った判断や、異常がないことを確認した範囲も共有されなければならない。\nさらに、保守は単に元の状態へ戻す仕事ではない。現場の担当者は、設計時には想定されなかった使われ方や環境の変化を知っている。大雨の後だけ水がたまる場所、利用者が何度も間違える操作、特定の季節にだけ起きる振動。こうした知識を修理のたびに個人の経験へ戻してしまえば、担当者が替わると失われる。点検記録は設備の履歴であると同時に、設計を更新するための資料でもある。\n華やかな新規事業と比べ、保守は「現状維持」と呼ばれがちだ。しかし、社会や環境が変わる中で同じ機能を保つには、絶えず小さな調整が要る。何も変えないことと、機能を保つことは同じではない。前者は放置であり、後者は変化への対応である。\n保守を正当に評価するには、事故が起きなかったという結果だけを誇るのでも、故障件数だけで担当者を評価するのでも足りない。どの危険を予想し、何を観察し、得られた知識を次の判断へどう渡したかを見る必要がある。見えない仕事を可視化するとは、作業を派手に演出することではない。起きなかった出来事の背後にある判断の連鎖を、組織が学べる形で残すことなのである。",
      },
    ],
    question: "筆者によると、保守を適切に評価するには何が必要か。",
    options: [
      "事故が起きなかった年数だけを成果として示すこと",
      "点検や判断の記録を、危険の予測と将来の改善に結びつけること",
      "新規事業より常に多い予算を保守へ配分すること",
      "過去から続く点検方法を変更せず守ること",
    ],
    correctIndex: 1,
    evidence: [
      "どの故障を避けようとしているのか、その兆候は何か",
      "得られた知識を次の判断へどう渡したか",
      "判断の連鎖を、組織が学べる形で残す",
    ],
    explanation:
      "Maintenance should be evaluated through traceable preventive judgments and institutional learning, not only failure counts or spending. The author also rejects preserving obsolete routines merely because they are established.",
  },
  {
    semanticId: "N1-long-gift-economy-measurement",
    level: "N1",
    family: "reading-long",
    semanticFocus:
      "measuring informal help can protect it yet distort the relationships that sustain it",
    sources: [
      {
        body: "地域で行われている無償の助け合いは、統計に表れにくい。子どもの迎えを代わる、病院へ付き添う、留守中に植物へ水をやる。こうした行為は生活を支えているが、金銭のやり取りがないため、経済活動として数えられない。その見えにくさを解消しようと、ある地域では、助けた時間をポイントとして記録する仕組みを始めた。一時間手伝えば一ポイントを受け取り、将来自分が助けを必要とするときに使えるという。\n仕組みには明らかな利点があった。以前は頼み事をするたびに申し訳なさを感じていた人が、「自分も別の形で返せる」と参加しやすくなった。運営側も、どの時間帯にどんな支援が不足しているかを把握できた。家族や親しい友人に頼れない人の需要が、初めて具体的に見えたのである。\n一方で、記録を始めたことで変わったものもある。近所の人が買い物のついでに荷物を届けたとき、それを十五分として登録するべきかという迷いが生じた。以前なら会話の一部だった行為が、交換の単位として意識されるようになったのだ。ポイントを多く持つ人が、助けを受ける人より貢献しているという見方も現れた。しかし、話を聞くことや気にかけることは時間で区切りにくい。体調の悪い人ほど他人を助ける機会が少ないのに、ポイントが少ないことを本人の貢献不足と解釈すれば、制度は支援から遠ざかる。\nだから、数値化そのものが悪いとは言えない。記録がなければ、負担が特定の人に集中していても「自然な助け合い」として隠れる。善意に任せるだけでは、いつも引き受ける人が疲れて去ることもある。必要なのは、ポイントを権利と義務の完全な計算書にしないことだろう。支援の不足を発見する資料として使いながら、ポイントがなくても緊急時には助けを受けられるようにし、記録しない親切も価値を失わないと明示する。\n制度が測るものは、測られる前と同じではいられない。数字は見えなかった負担を公にする一方、人間関係の意味を交換へ近づける。したがって設計者は、何を正確に数えられるかだけでなく、数えることで何が変わるかを考えなければならない。助け合いを支える制度の目的は、貸し借りを完全に一致させることではない。誰かの余裕が別の誰かの不足を補い、その関係が一方向に固定されないようにすることである。測定はそのための道具であって、関係そのものの価値を決める尺度ではない。",
      },
    ],
    question:
      "助け合いのポイント制度について、筆者の考えに最も近いものはどれか。",
    options: [
      "すべての親切を時間で正確に記録し、貸し借りを一致させるべきだ",
      "数値化は人間関係を必ず壊すため、記録をやめるべきだ",
      "不足や負担を知るために使いつつ、数値が支援の資格や価値を決めないようにすべきだ",
      "ポイントが少ない人には、貢献するまで支援を行うべきではない",
    ],
    correctIndex: 2,
    evidence: [
      "支援の不足を発見する資料として使いながら",
      "測定はそのための道具であって、関係そのものの価値を決める尺度ではない",
    ],
    explanation:
      "The author presents measurement as useful for revealing unmet demand and concentrated burden, but warns against turning points into a moral ledger or condition of care. It is a diagnostic tool, not the value of the relationship itself.",
  },
  {
    semanticId: "N1-long-fiction-memory-photograph",
    level: "N1",
    family: "reading-long",
    semanticFocus:
      "a discovered photograph unsettles rather than authenticates a narrator's remembered scene",
    sources: [
      {
        body: "祖母の家を片づけていたとき、古い写真が一枚出てきた。川辺に三人の子どもが立ち、いちばん端の少年だけがカメラを見ず、水面へ顔を向けている。母は、それが幼いころの私だと言った。私は写真を見た瞬間、夏の午後の匂いと、石の熱さと、対岸から聞こえた笛の音まで思い出した気がした。\nところが写真の裏には、私が生まれる二年前の日付が書かれていた。端の少年は母の弟で、私は会ったことすらない。母は笑い、川は昔も同じだったから混ざったのだろうと言った。私は恥ずかしくなって写真を箱へ戻したが、思い出したはずの笛の音は消えなかった。\n数日後、もう一度写真を取り出した。記憶が偽物だったのなら、どこから来たのだろう。祖母が何度も話した川遊びの話、別の写真に写っていた自分の帽子、子どものころに実際に渡った橋。それらが写真の空白を埋め、一度も経験していない午後を私の内側に作ったのかもしれない。\n私はこれまで、写真は忘れた記憶を呼び戻すものだと思っていた。しかし写真に写っているのは、撮られた瞬間の光だけである。匂いや音、写っていない人の気持ちは残らない。見る側は、自分の経験や聞いた物語を使って、その外側を補う。だから写真は記憶を保存するだけでなく、記憶が組み立てられる場所にもなる。\nそれなら写真は信用できないのか。そう言い切るのも違うだろう。裏の日付は、私の確信が誤りだと教えた。少年の視線や川岸の形は、その日そこにあった何かを確かに伝えている。ただし、その確かさは、写真を見る私の物語全体を保証するものではない。写真は「ここにこの光景があった」と示す一方、「あなたが感じたこともそのとおりだった」とは言わない。\n私は写真を祖母の箱へ戻さず、自分の机に置いた。それは失った幼年期の証明ではなくなったが、私のものではない過去と、自分の記憶が接する場所になった。見るたびに、私は笛の音を思い出す。そして同時に、その音を実際には聞いていないことも思い出す。矛盾した二つを抱えることが、写真に対して最も誠実な見方なのかもしれない。",
      },
    ],
    question:
      "写真を机に置いたとき、「私」にとってその写真はどのようなものになったか。",
    options: [
      "自分の幼年期の記憶がすべて事実だと証明するもの",
      "母が写真の日付を誤って書いたことを示すもの",
      "他人の過去と自分が作った記憶の重なりを意識させるもの",
      "写真から得られる情報は一切信用できないと示すもの",
    ],
    correctIndex: 2,
    evidence: [
      "私のものではない過去と、自分の記憶が接する場所",
      "実際には聞いていないことも思い出す",
    ],
    explanation:
      "The photograph no longer authenticates the narrator's childhood. It holds together a real earlier scene and a memory assembled from stories and experience, allowing the narrator to recognize both felt vividness and factual absence.",
  },

  {
    semanticId: "N1-long-expertise-public-judgment",
    level: "N1",
    family: "reading-long",
    semanticFocus:
      "expertise and public judgment answer different questions in collective decisions",
    sources: [
      {
        body: "専門家に任せるべきか、市民が決めるべきか。この問いは、科学技術を伴う政策で繰り返される。薬の有効性や地盤の強度は人気投票で決まらない。一方、専門家だけで決めると、生活への影響や地域の価値観が無視されるという批判もある。\n対立が解けないのは、両者が同じ種類の判断を奪い合っていると考えるからかもしれない。洪水対策で、雨量ごとの浸水確率や堤防の強度を計算するのは専門的な課題である。しかし、景観を変えてまで危険をどこまで減らすか、限られた予算を何に配分するかは、計算だけでは答えが出ない。何を失うことを重大とみなすかという価値判断が含まれるからだ。\nとはいえ、事実と価値をきれいに分けられるわけではない。専門家がどの危険を測るかを選ぶ段階にも判断が入り、市民が選好を述べる際にも結果についての理解が必要になる。だから、専門家が数字を出し、市民が好きな案を選ぶという一方向の役割分担では足りない。市民の懸念によって調査項目が変わり、新しい分析によって市民が重視する条件も変わる、往復の過程でなければならない。\nある地域の廃棄物処理施設計画では、説明会のたびに「安全です」という結論だけが示された。住民が質問した臭いや搬入車の騒音は、健康被害の基準を超えないとして分析の外に置かれた。その結果、住民は専門家が不都合な情報を隠していると疑った。後に計画側が、住民とともに測定地点や時間帯を決める調査へ変えると、意見の一致はしなかったものの、何について争っているかは明確になった。\n参加があれば必ず信頼が生まれるわけではない。専門用語の多い資料を短時間示すだけの会議や、すでに決まった案への賛否だけを尋ねる手続きは、参加の形を借りているにすぎない。また、声の大きい参加者が住民全体を代表するとも限らない。発言しにくい人の意見を別の方法で集め、専門家が答えられる範囲と答えられない範囲を区別する必要がある。\n専門性を尊重することと、専門家に決定を委ねることは同じではない。同様に、市民が決定に関わることと、事実を多数決で変えることも同じではない。重要なのは、どの問いにどんな知識が必要で、どの段階に価値判断があるのかを公開し、それぞれの判断が互いを修正できる仕組みを作ることである。",
      },
    ],
    question:
      "筆者は、専門家と市民が政策を決める際に何が重要だと述べているか。",
    options: [
      "専門家が安全だと判断した後は、市民の懸念を調査から除くこと",
      "技術的事実も地域の価値も、すべて多数決で決めること",
      "知識と価値判断の関係を明らかにし、両者が往復しながら問いを修正すること",
      "市民の意見が一致するまで、専門的な分析を始めないこと",
    ],
    correctIndex: 2,
    evidence: [
      "市民の懸念によって調査項目が変わり、新しい分析によって市民が重視する条件も変わる",
      "それぞれの判断が互いを修正できる仕組み",
    ],
    explanation:
      "Technical analysis and value judgment have different but interacting roles. Legitimate decisions need an exchange that can alter both expert questions and public trade-offs, not expert closure or majoritarian facts.",
  },
  {
    semanticId: "N1-long-maps-productive-omission",
    level: "N1",
    family: "reading-long",
    semanticFocus:
      "maps guide action by selective omission, which must be examined rather than eliminated",
    sources: [
      {
        body: "地図は現実を小さくした絵ではない。町にあるものをすべて同じ詳しさで描けば、道路も建物も文字に埋もれ、目的地へたどり着けない。地下鉄の路線図が地上の距離や曲線を変形するのは、不正確さを好むからではなく、乗り換えの関係を読みやすくするためである。地図は、何かを省くことで役に立つ。\nこの選択は、単なる技術上の都合ではない。観光地図が名所と飲食店を大きく示し、公衆トイレや急な坂を小さく扱えば、歩行に不安のない旅行者には便利でも、車いすを使う人には必要な町が見えない。地図に存在しないものは現実から消えるわけではないが、利用者の計画からは消えやすい。何を目立たせるかは、想定する利用者を形作る。\n近年は、利用者ごとに表示を変えるデジタル地図が増えた。これは紙の地図より中立だろうか。段差を避ける経路や夜でも明るい道を選べれば、多様な必要に応えられる。しかし表示を決める基準が見えないと、別の偏りが生まれる。ある店が「人気」として上位に出るのは、多くの人が訪れたからか、広告料を払ったからなのか。安全な道と判定されたのは、事故が少ないからか、単にデータがないからか。個別化は選択を増やす一方、その選択を支える編集を隠す。\nでは、すべての情報と基準を画面に出せばよいのか。そうすれば再び読めない地図に戻る。必要なのは、省略をなくすことではなく、省略の目的と限界を問い直せるようにすることだ。地図がどの利用者と用途を想定しているか、表示順位に広告が影響するか、情報がいつ更新されたかを確認できる。利用者も、一枚の地図があらゆる問いに答えると思わず、目的に応じて別の地図や現地情報を組み合わせる。\n地図を信頼するとは、そこに描かれた線を現実そのものと考えることではない。それがどの目的のために現実を切り取り、どの部分を残したかを理解した上で使うことである。地図の価値は完全さにではなく、特定の行動を可能にする編集にある。同時に、その編集によって行動しにくくなる人がいないかを確かめる責任も生じる。\n私たちは地図を見るとき、自分が世界を見渡しているように感じる。しかし実際には、誰かが作った窓から見ている。その窓があるから方向を定められるし、窓の外に残されたものもある。よい地図とは、何も隠さない地図ではない。何を見せる窓なのかが分かり、必要なら別の窓へ移れる地図なのである。",
      },
    ],
    question: "地図についての筆者の考えに最も近いものはどれか。",
    options: [
      "役立つ地図に省略は必要だが、その目的や限界を確認できることも重要だ",
      "デジタル地図は利用者別に表示できるため、編集上の偏りがない",
      "現実にある情報をすべて同じ大きさで示す地図が最も信頼できる",
      "一つの地図でどんな利用者のどんな目的にも応えるべきだ",
    ],
    correctIndex: 0,
    evidence: [
      "地図は、何かを省くことで役に立つ",
      "省略の目的と限界を問い直せるようにする",
      "必要なら別の窓へ移れる地図",
    ],
    explanation:
      "Omission is constitutive of a usable map, while transparency and alternatives matter because editorial choices privilege certain users and actions. Personalization can obscure rather than eliminate selection.",
  },
  {
    semanticId: "N1-long-waiting-civic-time",
    level: "N1",
    family: "reading-long",
    semanticFocus:
      "waiting is distributed civic time whose burden should be designed and made legible",
    sources: [
      {
        body: "待ち時間は、サービスの効率を測る数字として扱われる。窓口で平均十二分、病院で四十分。その数字を短くすることは重要だが、平均だけでは待つ経験の違いは分からない。同じ三十分でも、到着順が明確で座る場所があり、呼ばれる時刻を予測できる場合と、列を離れれば順番を失い、いつ呼ばれるか分からない場合では負担が異なる。\n待つことが特に重くなるのは、その時間を別のことに使えない人である。幼い子どもを連れている、勤務中に抜けてきた、長く立てない。オンラインで順番を取り、近くなったら通知する仕組みは、こうした人の拘束を減らす。しかしスマートフォンを持たない人や操作が難しい人を、別の遅い列へ送るなら、便利さは時間の不平等を広げる。\nある市役所は予約制を導入し、予約者の平均待ち時間を大きく減らした。その成果が発表された一方、予約なしの来庁者については測定されていなかった。相談内容が複雑でウェブ上の分類を選べない人ほど予約せずに来るため、長く待つ人が統計から抜けたのである。後に市は、入口で用件を一緒に整理する担当者を置き、その場で予約枠の空きを使えるようにした。全体の平均は少し伸びたが、極端に長く待つ人は減った。\nここには、効率をどう定義するかという問題がある。処理した人数を職員の時間で割れば、短い相談を多く扱うほうが効率的に見える。しかし、複雑な相談を後回しにして同じ人が何度も来庁すれば、社会全体で使う時間は増える。窓口だけの速さを最適化すると、待ち時間が利用者の移動や再訪へ移されることがある。\n待ち時間を完全になくすことはできない。需要は日によって変わり、すべての窓口を常に最大人数で配置するわけにもいかない。だからこそ、誰がどこで待ち、待っている間に何を失うかを把握する必要がある。平均とともに最長時間や再訪率を示し、待つ場所と情報を整え、対面以外の選択肢を用意しながら、それを唯一の入口にはしない。\n待つことは個人の忍耐の問題に見えるが、実際には制度が人々の時間をどう配分するかという問題である。列は先着順という公平さを示す一方、列に長くいられる条件が誰にでも同じとは限らない。よいサービスは、単に列を速く進めるだけでなく、待つ負担が特定の人に集中していないかを見えるようにし、待ち方を選べるようにする。公共の効率とは、組織の時計だけでなく、利用者の失われる時間まで含めて考えるべきものなのである。",
      },
    ],
    question: "筆者が公共サービスの待ち時間について重視していることは何か。",
    options: [
      "すべての利用者を予約制にし、窓口の平均だけを短くすること",
      "待つ負担の偏りや利用者側の時間も含め、複数の指標と選択肢で改善すること",
      "複雑な相談を別の日へ回し、一日に処理する人数を増やすこと",
      "先着順であれば条件にかかわらず公平だと考えること",
    ],
    correctIndex: 1,
    evidence: [
      "誰がどこで待ち、待っている間に何を失うか",
      "待つ負担が特定の人に集中していないか",
      "利用者の失われる時間まで含めて",
    ],
    explanation:
      "Efficiency must include predictability, extreme waits, repeat visits, accessibility, and displaced user time—not just the counter's average. The author supports multiple access routes without making digital booking the sole gate.",
  },
  {
    semanticId: "N1-long-automation-exception-knowledge",
    level: "N1",
    family: "reading-long",
    semanticFocus:
      "automation needs visible exceptions because edge cases are sources of organizational knowledge",
    sources: [
      {
        body: "手続きの自動化は、同じ判断を速く公平に繰り返せるという期待を伴う。申請書の条件を機械が確認し、不足があれば即座に知らせる。担当者によって結果が変わらず、利用者も返事を何週間も待たなくてよい。しかし、規則を形式に置き換えると、それまで窓口で処理されていた例外が姿を現す。\n住所欄を必須にした申請で、避難中の人や住所を公開できない人はどうするか。人が受け付けていたころは、担当者が事情を聞き、別の連絡先で処理していたかもしれない。その対応が記録されず「現場の工夫」として残っていれば、システム設計者には例外が存在しないように見える。自動化は新しい問題を生むだけでなく、組織が暗黙に扱ってきた問題を表面化させる。\nここで、あらゆる例外を事前に規則へ書けばよいと考えるのは難しい。例外の種類は増え続け、条件分岐が複雑になれば、利用者にも担当者にも理解できない仕組みになる。しかも、過去に多かった例外だけを登録すると、まだ知られていない事情は再び排除される。必要なのは、標準的な処理を明確にすると同時に、そこから外れた申請を人が検討できる経路を残すことである。\n人による経路を残すと不公平が戻る、という懸念は正しい。だから例外対応を個人の善意に任せてはいけない。どの規則で止まり、どんな事情があり、最終的にどう判断したかを記録し、同様の事例を比較できるようにする。例外が繰り返されるなら、規則か入力方法のほうを変える。そうして初めて、人の判断は自動化の穴を埋める作業ではなく、制度を学習させる役割を持つ。\nまた、利用者に「例外申請」と名乗らせることにも注意が要る。自分の事情が例外だと分からない人や、特別扱いを求めることに抵抗を感じる人は、その入口を使えない。システムが拒否理由を具体的に示し、相談へ移る方法を同じ画面に置くべきだろう。例外経路は隠れた救済ではなく、正規の手続きの一部として設計されなければならない。\n自動化の質は、人をどれだけ排除できたかでは測れない。定型的な処理を機械に任せることで、人が本当に判断すべき事例へ時間を使えるなら意味がある。そして、その判断から得た知識が、次の標準を改善するところまで含めて自動化である。例外は制度の失敗を示す雑音ではない。制度がまだ理解していない現実から届く情報なのである。",
      },
    ],
    question:
      "筆者は、手続きの自動化における例外をどのように扱うべきだと考えているか。",
    options: [
      "過去の例外をすべて条件分岐にし、人の判断をなくすべきだ",
      "例外申請の入口を目立たなくし、標準利用者を優先すべきだ",
      "担当者が善意で処理し、記録は残さないほうが柔軟だ",
      "人が検討できる正規の経路を設け、記録を標準の改善へ生かすべきだ",
    ],
    correctIndex: 3,
    evidence: [
      "人が検討できる経路を残す",
      "どんな事情があり、最終的にどう判断したかを記録",
      "次の標準を改善する",
    ],
    explanation:
      "The author calls for an accountable human review path whose cases become evidence for redesign. Neither exhaustive branching nor undocumented discretion works, and review must be visible as part of the normal procedure.",
  },
] as const satisfies readonly UpperReadingSeed[];

const n1ThematicSeeds = [
  {
    semanticId: "N1-thematic-metric-becomes-target",
    level: "N1",
    family: "reading-thematic",
    semanticFocus:
      "a performance indicator loses informational value when actors optimize directly for it",
    sources: [
      {
        body: "組織は、目に見えにくい成果を管理するために指標を作る。学校なら出席率、病院なら待ち時間、相談窓口なら処理件数である。指標がなければ、改善したのか、負担がどこへ集中しているのかを比較できない。ところが、指標が評価や予算に直接結びつくと、人は本来の目的ではなく、数字そのものを改善する方法を学び始める。\nたとえば相談窓口が一日の処理件数で評価されれば、短く終わる相談を優先し、複雑な相談を別部署へ回すかもしれない。件数は増えるが、利用者の問題が解決したとは限らない。病院が平均待ち時間だけを短くしようとすれば、測定の開始点を受付後へ変えたり、診察前の手続きを別の列に移したりできる。数字は改善しても、患者の待つ時間は変わらない。\nこれは担当者の不正だけが原因ではない。指標は現実の一部を切り取るため、評価される側がその切り取りに合わせて行動するのは合理的でもある。むしろ、数字を目標に設定した管理側が、指標と目的が同じだとみなしたことに問題がある。指標は目的への道を示す標識であって、目的地そのものではない。\nでは、数字を使わず、現場の印象だけに任せればよいのか。それでは比較が難しく、都合のよい経験だけが語られる。必要なのは、一つの指標を絶対視しないことだ。処理件数とともに再相談の割合を見たり、平均だけでなく最長の待ち時間も示したりする。数字の変化が実際の利用者経験と一致するかを、聞き取りや事例で確かめる。\nさらに、指標は固定せず、どんな行動を生んだかを定期的に点検するべきである。測り方を変えると長期比較は難しくなるが、比較を守るために現実とのずれを放置すれば、整った時系列が誤った安心を与える。良い指標とは、操作できない指標ではない。どんな行動を促し、何を隠すかが理解され、別の情報によって修正される指標である。\n数字が悪いのではない。数字が管理の言葉として強いからこそ、その限界を数字の外から確認する必要がある。測定の目的は、現実を一つの値に置き換えることではなく、見逃していた変化に気づき、よりよい問いを作ることなのである。",
      },
    ],
    question: "筆者は、組織が指標を用いる際に何が必要だと述べているか。",
    options: [
      "評価される側が工夫できない指標を一つ選び、長期間変えないこと",
      "指標を目的と区別し、他の数字や事例で行動への影響とずれを点検すること",
      "数字による比較をやめ、現場の印象だけで判断すること",
      "測定方法の一貫性を守るため、現実とのずれがあっても修正しないこと",
    ],
    correctIndex: 1,
    evidence: [
      "指標は目的への道を示す標識であって、目的地そのものではない",
      "どんな行動を生んだかを定期的に点検",
      "別の情報によって修正される指標",
    ],
    explanation:
      "Indicators remain useful, but become misleading when treated as the goal. The author recommends triangulation and periodic review of the behaviors and blind spots each measure creates, rather than rejecting measurement or freezing it for comparability.",
  },
  {
    semanticId: "N1-thematic-platform-neutrality",
    level: "N1",
    family: "reading-thematic",
    semanticFocus:
      "platform ordering is governance even when no individual post is authored by the platform",
    sources: [
      {
        body: "情報を載せる場を提供する会社は、自社を「中立な場所」と説明することがある。文章や映像を作るのは利用者であり、会社は内容に賛成も反対もしない、という意味だろう。確かに、掲載された一つ一つの意見を運営者自身の発言とみなすのは適切ではない。だが、何を上に置き、誰に届け、どこで表示を止めるかを決める以上、その場は単なる空の容器でもない。\n紙の掲示板なら、新しい紙が古い紙を覆う。デジタルな場では、表示順は人気、反応の速さ、利用者の過去の行動などから計算される。その基準は、どの内容が注目されやすいかを変える。強い怒りを引き出す投稿ほど長く見られるなら、運営者が怒りを支持していなくても、設計は怒りを広げる条件を作っている。\nだからといって、運営者が望ましい意見だけを選べばよいわけではない。価値判断を避けられないことと、判断が無制限でよいことは別である。何を危険とみなすか、異論をどこまで残すかには、社会的な争いがある。基準を秘密にしたまま「中立ではないから自由に決める」と言えば、利用者は自分の発言がなぜ届かなかったかを検討できない。\n重要なのは、中立という看板を外すことそのものではなく、介入の種類を区別して説明することだ。違法な内容を削除する、誤情報に資料を添える、反応が多い投稿を推薦する、広告主の内容を目立たせる。これらはすべて表示へ影響するが、目的も責任も同じではない。利用者が選べる表示方法を増やし、推薦の主要な基準を知らせ、異議申立ての経路を用意する必要がある。\nまた、透明性は仕組みの設計図をすべて公開することではない。悪用を招く情報や、個人のデータを守る必要もある。むしろ、どの価値を優先し、どんな誤りを想定し、その誤りを誰が訂正できるかを明らかにすることが大切だ。\n情報の場は、発言内容を作らなくても、注意の流れを作る。したがって責任は、すべての発言に同意した責任ではなく、流れを形作る規則を選び、修正可能にする責任である。「中立か、編集者か」という二択ではなく、どのような編集を、誰に説明できる形で行うかが問われている。",
      },
    ],
    question: "情報を載せるプラットフォームの責任について、筆者の主張は何か。",
    options: [
      "利用者の投稿を作っていない以上、表示順への責任もない",
      "中立ではないので、運営者が望む意見だけを秘密に選んでよい",
      "すべての計算方法を公開すれば、内容の削除基準は説明しなくてよい",
      "注意の流れを作る介入を区別して説明し、選択や訂正の手段を設けるべきだ",
    ],
    correctIndex: 3,
    evidence: [
      "何を上に置き、誰に届け",
      "介入の種類を区別して説明",
      "流れを形作る規則を選び、修正可能にする責任",
    ],
    explanation:
      "A platform need not author speech to govern attention. The essay rejects both a claim of empty neutrality and unchecked curation, asking instead for differentiated explanations, user choice, and appeal mechanisms.",
  },
  {
    semanticId: "N1-thematic-resilience-redundancy",
    level: "N1",
    family: "reading-thematic",
    semanticFocus:
      "apparently inefficient redundancy can preserve essential function during disruption",
    sources: [
      {
        body: "効率化の議論では、重複は無駄とみなされやすい。同じ機能を持つ設備が二つあれば、一つにまとめたほうが管理費は下がる。倉庫の在庫を減らし、必要なときだけ配送すれば、資金も場所も節約できる。平常時の利用率だけを見れば、使われない予備は失敗した投資に見える。\nしかし、効率は特定の条件の下で測られる。電力も交通も安定し、需要が予想範囲に収まるなら、集中と削減は力を発揮する。条件が崩れたとき、同じ設計は弱さになる。一本の配送路に依存した地域は、その道が通れなくなると代替がない。一つの大病院へ機能を集めれば、高度な設備を共有できる一方、その病院が停止した際の影響も大きい。\nここでいう余裕は、同じ物を無計画に増やすことではない。同じ原因で同時に止まる予備は、数が多くても役に立たない。非常用電源が主電源と同じ地下室に置かれ、浸水で両方失われた例を考えればよい。耐える力を高めるには、異なる場所、異なる技術、異なる供給先を組み合わせ、障害の原因を共有しすぎないことが重要になる。\nまた、予備を持つだけでなく、切り替えられる能力が要る。年に一度も使わない通信手段は、担当者が操作を忘れ、いざというとき動かない。地域の小さな診療所を残しても、大病院との連携訓練がなければ患者を分担できない。平常時に少し使い、関係と技術を保つことは、一見すると集中の効率を下げるが、非常時の選択肢を現実のものにする。\nもちろん、あらゆるものに無限の予備を用意することはできない。どの機能が止まると回復困難な害が生じるか、復旧までどの程度待てるかを考え、余裕を置く場所を選ぶ必要がある。娯楽設備と飲料水では、同じ停止時間でも重みが違う。\n平常時の効率と非常時の強さは、単純な敵ではない。問題は、前者だけを数字にし、後者を「使われなかった余り」として消すことである。重複の価値は、普段の稼働率ではなく、予想外の変化の中でも重要な機能を続けられる選択肢として評価されなければならない。",
      },
    ],
    question: "筆者によると、非常時に役立つ「余裕」とはどのようなものか。",
    options: [
      "同じ場所に同じ設備をできるだけ多く置くこと",
      "平常時には一度も使わず、管理費をかけない予備を持つこと",
      "停止原因を分散し、実際に切り替えられるよう維持された選択肢を持つこと",
      "重要度にかかわらず、すべての機能に同じ量の予備を用意すること",
    ],
    correctIndex: 2,
    evidence: [
      "障害の原因を共有しすぎない",
      "切り替えられる能力",
      "重要な機能を続けられる選択肢",
    ],
    explanation:
      "Useful redundancy is diverse, maintained, and switchable, not mere duplication exposed to the same failure. Its allocation should reflect the consequence and tolerable duration of interruption.",
  },
  {
    semanticId: "N1-thematic-authenticity-performance",
    level: "N1",
    family: "reading-thematic",
    semanticFocus:
      "claims of cultural authenticity are produced through present-day choices, not recovered untouched",
    sources: [
      {
        body: "観光地で「昔のままの祭り」という表現を目にする。長く続く行事には、人を過去へつなぐ力がある。しかし、昔のままという言葉は慎重に考えたほうがよい。祭りが続く間には、参加者も道具も場所も変わる。戦争や災害で中断したことがあり、復活の際に古い写真を参考に衣装を作り直した例もある。それを偽物と呼べば、変化しながら継承した人々の努力を見落とす。\n一方、変化してきたのだから何をしても伝統だ、というわけでもない。観光客に分かりやすいよう儀式の順番を変え、撮影しやすい場所へ移すと、地域の人にとっての意味が弱まる場合がある。そのとき運営側が「本物」を強調するほど、誰にとっての本物かという問いは隠される。\n真正さは、変更が一度もなかったという物質的な純粋さだけでは決まらない。なぜこの部分を残し、なぜ別の部分を変えたのかを、担い手が説明し、次の世代が問い直せることにある。古い形を正確に再現しても、参加できる人が少なく技術が伝わらなければ、展示としては整っていても行事としては続かない。逆に、新しい材料を使っても、作り方の判断や共同作業の関係が受け継がれることがある。\nただし、説明する主体を一つに決めてはならない。祭りの中心を担う家、最近参加した若者、行列で通行が難しくなる住民、外から訪れる人は、異なるものを価値とみなす。すべての意見を同じ重さで採用する必要はないが、対立が存在しないように演出すれば、「昔からの合意」という新しい物語が作られる。\n観光向けの上演も、それだけで偽物ではない。観客に見せることで資金が得られ、練習する機会が増えるかもしれない。問題は、見せるために変えた部分が、いつの間にか唯一の正しい形として地域へ戻ってくることである。上演用と儀礼用の違いを記録し、誰がどの場面を決めるかを共有する必要がある。\n伝統の真正さは、過去から封をされた品物ではない。現在の人々が過去との関係をどう引き受け、変更の理由と権限をどう明らかにするかという実践である。「変わっていない」という主張より、何が変わり、それでも何をつなごうとしているかを語れることのほうが、継承への誠実さを示すのである。",
      },
    ],
    question:
      "筆者は、伝統の「真正さ」を何によって捉えるべきだと考えているか。",
    options: [
      "古い形や材料を一度も変えずに再現できるかどうか",
      "観光客が最も本物らしいと感じる演出かどうか",
      "変化の理由や決定の権限を説明し、何を継承するか問い続けられるかどうか",
      "地域内の異なる立場を一つの合意として見せられるかどうか",
    ],
    correctIndex: 2,
    evidence: [
      "なぜこの部分を残し、なぜ別の部分を変えたのか",
      "変更の理由と権限をどう明らかにするか",
      "何をつなごうとしているかを語れる",
    ],
    explanation:
      "Authenticity is framed as an accountable present relationship to the past, not immutable material purity or tourist appearance. Change may sustain transmission, provided reasons, authority, and differences are kept open to scrutiny.",
  },
  {
    semanticId: "N1-thematic-deliberation-speed",
    level: "N1",
    family: "reading-thematic",
    semanticFocus:
      "institutional speed should distinguish reversible routine action from decisions needing deliberation",
    sources: [
      {
        body: "決定が遅い組織は批判される。会議を重ね、責任者の承認を待つ間に機会を失うからだ。そこで、手続きを簡略化し、現場へ権限を移す改革が行われる。変化の速い状況では、情報を完全に集めてから動こうとすれば、判断した時点で条件が変わっていることもある。\nしかし、速さを決定の質そのものと考えるのも危うい。即日で決めたことの修正に数年かかるなら、最初の速さは後の負担を増やす。とくに、影響を受ける人が決定過程に入れず、実施後に問題が明らかになる場合、速い決定は反対意見を消したのではなく、後の紛争へ移しただけである。\nすべての決定に同じ時間をかける必要はない。日常的で取り消しやすい選択は、担当者が早く試し、結果を見て変えればよい。一方、土地の利用や個人情報の収集のように、元へ戻すことが難しく、影響が特定の人へ集中する決定は、異なる立場を確認する時間が必要だ。問うべきなのは「何日で決めたか」ではなく、「誤った場合に誰がどの程度戻せるか」である。\n熟議にも形式だけのものがある。長い会議で同じ説明を繰り返し、決定を避けるなら、時間は慎重さの証拠にならない。事前に争点を示し、必要な資料を共有し、何が決まれば次へ進むかを明確にする。少数意見を記録しておけば、条件が変わったときに判断を再検討できる。こうした準備は時間を使うが、単なる停滞とは違う。\n逆に、期限があるからこそ参加が進む場合もある。意見募集に終わりがなければ、参加者はいつ反映されるか分からない。期限までに暫定案を選び、半年後に見直すと約束すれば、速さと修正可能性を組み合わせられる。ただし、見直しが実際に行われなければ「暫定」は永続的な決定を通す言葉になる。\n良い組織は常に速いのでも遅いのでもない。決定の可逆性と影響に応じて、試す速さと考える時間を配分する。効率とは熟議を削ることではなく、どの決定に熟議が必要かを見分け、必要な問いへ時間を集中する能力なのである。",
      },
    ],
    question: "組織の決定の速さについて、筆者の考えに最も近いものはどれか。",
    options: [
      "決定が速いほど、実施後の修正も容易になる",
      "どの決定にも同じ長さの会議を設けるべきだ",
      "取り消しや影響の性質に応じて、試行と熟議にかける時間を変えるべきだ",
      "期限を設けると参加者の意見が反映されないため、意見募集は続けるべきだ",
    ],
    correctIndex: 2,
    evidence: [
      "誤った場合に誰がどの程度戻せるか",
      "決定の可逆性と影響に応じて、試す速さと考える時間を配分",
    ],
    explanation:
      "The author rejects a universal speed target. Reversible routine choices can be tested quickly, while hard-to-reverse, unevenly distributed consequences warrant structured deliberation and genuine review.",
  },
  {
    semanticId: "N1-thematic-data-stewardship",
    level: "N1",
    family: "reading-thematic",
    semanticFocus:
      "collecting data creates continuing duties beyond obtaining one-time consent",
    sources: [
      {
        body: "個人に関するデータを集めるとき、同意を得ることが重視される。利用目的を示し、本人が承諾すれば、収集は正当化されたように見える。もちろん、知らないうちに情報を取られないために同意は不可欠である。しかし、画面のボタンを一度押したことだけで、その後の利用すべてが正当になるわけではない。\nまず、将来の使い方を収集時に完全には予測できない。交通調査の移動履歴が、数年後に商業施設の出店分析へ使えると分かった場合、最初の「交通改善」という説明に含まれるだろうか。目的を広く書けば形式上は含められるが、本人は具体的な影響を判断できない。反対に、用途を細かく限定しすぎれば、公共的に有益な研究までできなくなる。\nさらに、データの意味は他の情報との組み合わせで変わる。名前を削除した記録でも、位置と時刻を重ねれば個人が推測されることがある。収集時に安全だった形式が、技術の進歩や別のデータ公開によって危険になる。管理者の責任は、鍵をかけて保管するだけで終わらず、環境の変化に応じて再評価するところまで続く。\nここから、データを所有物として考えるだけでは不十分だと分かる。所有なら、持ち主が譲渡した時点で関係が切れる。しかし個人データの利用は、本人の機会や評価に後から影響する。集めた組織は、利用目的の変更を知らせ、不要になった情報を削除し、誤りを訂正する経路を保つ必要がある。これは保管者としての継続的な義務である。\n本人がいつでもすべての利用を拒否できる仕組みだけでも解決しない。撤回の負担が個人に集中し、利用先が増えるほど管理できなくなるからだ。組織側が必要性を定期的に説明し、危険の高い二次利用には独立した審査を置くべきである。社会全体の統計のように個別撤回が難しい場合も、その理由と保護策を公開しなければならない。\n同意は責任を個人へ移す免許ではない。それは、データを扱う関係を始める条件の一つである。データを持つ者は、新しい価値を得る権利だけでなく、新しい危険が生じていないかを問い、関係を更新する義務も引き受けるのである。",
      },
    ],
    question: "筆者がデータを集める組織に求めていることは何か。",
    options: [
      "一度同意を得た後は、目的を広げても本人へ知らせないこと",
      "個人に全利用の管理を任せ、組織は保管だけを行うこと",
      "将来の研究を妨げないよう、利用目的をできるだけ曖昧にすること",
      "利用や危険の変化を継続的に見直し、説明・削除・訂正の責任を持つこと",
    ],
    correctIndex: 3,
    evidence: [
      "環境の変化に応じて再評価",
      "利用目的の変更を知らせ、不要になった情報を削除し、誤りを訂正する経路",
      "継続的な義務",
    ],
    explanation:
      "Consent starts rather than exhausts a stewardship relationship. Because uses, linkability, and risks change, the holder owes continuing necessity review, explanation, correction, deletion, and stronger oversight for consequential reuse.",
  },
  {
    semanticId: "N1-thematic-expertise-trust",
    level: "N1",
    family: "reading-thematic",
    semanticFocus:
      "trust in expertise depends on visible methods for handling limits and correction, not certainty",
    sources: [
      {
        body: "専門家への信頼が低下したとき、より強い言葉で確実性を示そうとすることがある。「科学的に証明された」「専門家の結論は一致している」と言えば、不安を抑えられると考えるからだ。しかし、後に見解が変わると、以前の断定は知識の進歩ではなく、欺きだったと受け取られかねない。\n科学的な知識は、何でも疑って決めないことではない。限られた証拠から、その時点で最も支持される判断を行う。ただし、その判断には適用範囲と不確かさがある。専門家が信頼される理由は、未来を外さないからではなく、証拠の質を評価し、誤りを発見し、修正する方法を持つからである。\nところが、修正の過程が外から見えなければ、意見の変更は一貫性の欠如に見える。何が新たに分かり、どの前提が変わったため結論が変わったのかを説明する必要がある。以前の判断を守るために新しい証拠を小さく扱えば、短期的には権威を保てても、修正能力への信頼を失う。\n一方、専門家が限界を示せば自動的に信頼されるわけでもない。「まだ分からない」とだけ言えば、何も判断できないように聞こえる。不確かさの種類を区別し、分かっている範囲でどの行動が合理的かを示すべきだ。原因の詳細は不明でも、被害を減らす措置の有効性には十分な証拠がある場合がある。\n信頼には制度も関わる。研究費の提供者、利益相反、異論を検討した手続きが示されれば、結論を無条件に受け入れなくても、その判断がどのように作られたかを評価できる。逆に、有名な一人の専門家の人格だけに依存すると、その人の誤りが分野全体の信頼を壊す。\n専門性は、疑わないよう求める権威ではない。問いに答えるための方法と、その答えを訂正する手続きを社会へ提供する役割である。信頼を守るとは、確実に見せ続けることではなく、限界、判断、修正の関係を追えるようにすることなのである。",
      },
    ],
    question: "筆者によると、専門家への信頼を支えるものは何か。",
    options: [
      "見解が変わっても、以前の断定を守り続けること",
      "不確かな点が一つでもあれば、行動の提案を避けること",
      "判断の根拠・限界・修正の過程を追えるようにすること",
      "有名な一人の専門家の人格を分野全体の保証にすること",
    ],
    correctIndex: 2,
    evidence: [
      "誤りを発見し、修正する方法",
      "何が新たに分かり、どの前提が変わった",
      "限界、判断、修正の関係を追える",
    ],
    explanation:
      "Expert trust rests on inspectable reasoning and correction, not infallibility. Limits should be specific enough to guide proportionate action, while procedures and conflicts matter more than personal authority.",
  },
  {
    semanticId: "N1-thematic-institutional-forgetting",
    level: "N1",
    family: "reading-thematic",
    semanticFocus:
      "organizational memory requires curated, retrievable reasoning rather than indiscriminate storage",
    sources: [
      {
        body: "組織で同じ失敗が繰り返されると、「記録が残っていなかった」と反省する。そこで会議資料やメールをすべて保存し、共有フォルダーを増やす。しかし、保存された情報が多すぎて見つからなければ、実務上は忘れたのと変わらない。記憶は、保管量だけでは測れない。\nまた、完成した報告書だけを残すと、なぜその結論に至ったかが消える。採用されなかった案には、当時どの危険を予想していたかが表れる。数年後に条件が変わったとき、結論だけを読めば古い方針をそのまま守るか、理由を知らずに捨てるかの二択になる。判断の前提と却下理由があれば、どの部分を見直すべきか分かる。\nとはいえ、議論のすべてを永久に残せばよいわけではない。率直な発言が人事評価へ使われると恐れれば、会議で異論が出なくなる。個人情報や途中の誤解を保存し続ける害もある。必要なのは、誰が何を言ったかを無期限に追跡することではなく、決定に影響した根拠、未解決の懸念、見直す条件を整理して残すことである。\n引き継ぎも、資料を渡すだけでは成立しない。新しい担当者が最初に知りたいのは、フォルダーの構造ではなく、現在の仕事がどの判断に依存し、どこで例外が起きるかである。経験者と一緒に事例をたどり、記録の読み方を学ぶ時間が要る。記録は、解釈する共同体がなければ沈黙したままだ。\n忘れることにも機能がある。役割を終えた手順を消さず、新しい規則と並べれば、どちらが有効か分からなくなる。定期的に資料を整理し、廃止した理由と最低限の履歴だけを残す必要がある。削除は記憶の敵ではなく、重要なものへ到達できるようにする編集でもある。\n組織が学ぶとは、過去を大量に保存することではない。現在の判断に必要な過去を探し出し、当時の前提と現在の条件を比べられることだ。そのためには、残す基準、消す基準、読み継ぐ場を設計しなければならない。制度的な忘却を防ぐのは、巨大な倉庫ではなく、理由を次の問いへ接続する仕組みなのである。",
      },
    ],
    question: "筆者が組織の記憶を保つために重要だと考えていることは何か。",
    options: [
      "メールや発言者名を含むすべての情報を永久に保存すること",
      "最終的な結論だけを短く残し、採用されなかった案は削除すること",
      "記録を増やす代わりに、口頭の引き継ぎだけを行うこと",
      "判断の理由と見直し条件を選んで残し、探し方と読み方も継承すること",
    ],
    correctIndex: 3,
    evidence: [
      "判断の前提と却下理由",
      "見直す条件を整理して残す",
      "残す基準、消す基準、読み継ぐ場",
    ],
    explanation:
      "Institutional memory is curated retrievability and transmitted interpretation, not indiscriminate retention. The author values reasons, assumptions, rejected risks, review triggers, and deliberate deletion of obsolete material.",
  },
] as const satisfies readonly UpperReadingSeed[];

const n1InformationSeeds = [
  {
    semanticId: "N1-info-archive-restricted-records",
    level: "N1",
    family: "information-retrieval",
    semanticFocus:
      "researcher requests restricted municipal records with photography and advance screening",
    sources: [
      {
        label: "北浜市公文書館　資料利用区分",
        body: "公開資料：閲覧室で当日請求可。一度に5冊まで。個人用の撮影は、フラッシュと三脚を使わなければ無料。\n要審査資料：個人情報を含む可能性があるため、資料名・研究目的・必要箇所を来館日の10営業日前までに申請。審査後、該当部分を覆った複製を閲覧する場合があります。撮影は許可されたページのみ。\n寄託資料：所有者との契約により、紹介状と30日前の申請が必要。複写は館が行い、一枚50円。\n保存処理中資料：終了予定日は目録に表示。処理中の特別閲覧は不可。\n閲覧室は火〜土曜9:30〜17:00。資料請求は16:00まで。ノートパソコンは使用可、スキャナー持込不可。出版物へ画像を掲載する場合、閲覧時の撮影許可とは別に掲載申請を行い、所蔵表記を入れてください。審査結果は資料の公開可否を示すもので、記述内容の正確さを館が保証するものではありません。申請した日程を変更する場合、資料準備前なら一度だけ変更できます。",
      },
    ],
    question:
      "研究者が個人情報を含む可能性のある資料の一部を撮影し、論文に画像を載せたい。必要な手続きはどれか。",
    options: [
      "当日5冊を請求し、撮影した全ページをそのまま掲載する",
      "10営業日前までに目的と箇所を申請し、許可ページを撮影した上で別に掲載申請する",
      "紹介状だけを持参し、館のスキャナーで複写する",
      "保存処理中でも30日前に申請すれば特別閲覧する",
    ],
    correctIndex: 1,
    evidence: [
      "来館日の10営業日前までに申請",
      "撮影は許可されたページのみ",
      "別に掲載申請",
    ],
    explanation:
      "Potentially personal records require advance screening and restrict photography to approved pages. Publication is a separate permission from research-room photography; the other procedures belong to different access classes or are prohibited.",
  },
  {
    semanticId: "N1-info-conference-revised-paper",
    level: "N1",
    family: "information-retrieval",
    semanticFocus:
      "presenter chooses revised-paper track with disclosure and final submission deadlines",
    sources: [
      {
        label: "地域研究学会　発表募集",
        body: "一般研究発表：未発表の研究。要旨600〜800字を10月3日17時まで。採否通知10月25日。採択後の題目変更不可。\n実践報告：調査・教育・地域活動の実践を対象。既発表の内容でも、その後の検証を明示すれば応募可。要旨1,000字以内。\n再検討セッション：過去3年以内に本学会で発表した研究を、新しい資料または反論を踏まえて再検討する。旧発表の番号と変更点を記載。要旨締切は9月26日17時。\nポスター：進行中の研究も可。要旨400字以内。\n一人が筆頭発表者になれるのは一件。共同発表者の重複は可。生成AIを翻訳・要約・分析に使用した場合は、方法欄にサービス名と確認手順を記載してください。採択者は11月15日までに最終原稿を提出し、同日までに参加費を支払います。再検討セッションのみ、旧発表との比較表も提出。発表資料の公開を希望しない場合は最終原稿時に申告できますが、題目と要旨は公開されます。",
      },
    ],
    question:
      "2年前に本学会で発表した研究を、新しい資料で結論まで見直して発表したい。何をする必要があるか。",
    options: [
      "一般研究発表へ10月3日に応募し、旧発表を隠す",
      "実践報告へ応募し、採択後に題目を変える",
      "再検討セッションへ9月26日までに応募し、旧番号と変更点を示して比較表も出す",
      "ポスターへ応募し、最終原稿と参加費は不要とする",
    ],
    correctIndex: 2,
    evidence: [
      "再検討セッション",
      "旧発表の番号と変更点",
      "要旨締切は9月26日17時",
      "旧発表との比較表も提出",
    ],
    explanation:
      "A new-evidence revision of a recent prior society presentation belongs to the reconsideration track, which has the earlier deadline and requires both provenance in the abstract and a comparison table after acceptance.",
  },
  {
    semanticId: "N1-info-residency-community-research",
    level: "N1",
    family: "information-retrieval",
    semanticFocus:
      "artist-researcher selects a funded residency permitting community fieldwork and public process report",
    sources: [
      {
        label: "山間創作拠点　2027年度滞在制度",
        body: "A 制作集中枠：4週間。制作室と宿泊を提供。旅費・生活費なし。滞在中の一般公開は任意。個人応募のみ。\nB 地域協働枠：6〜8週間。住民・地域団体と行う調査または制作。宿泊、国内旅費上限4万円、活動費上限12万円を支給。開始前に協働先の同意書が必要。最終作品は不要だが、過程を報告する公開会を行う。\nC 共同研究枠：3か月。大学等に所属する2〜4人のチーム。施設費を免除。成果を査読論文として提出する計画が必要。\nD 短期試作枠：10日間。35歳以下。工房のみ提供、宿泊は各自。\n応募締切は12月1日正午。応募時に滞在希望を二期間まで記載できますが、枠をまたぐ併願は不可。採択通知は1月20日。Bの活動費は採択後に予算を審査し、機材購入は総額の半分まで。調査対象者の個人情報を扱う場合、開始前に倫理・管理計画を提出してください。家族の同伴は可能ですが、追加宿泊費は本人負担。営利商品の直接販売を主目的とする企画は対象外です。",
      },
    ],
    question:
      "個人の作家が住民への聞き取りを含む作品調査を7週間行い、完成品ではなく過程を共有したい。旅費と活動費も必要である。どの枠が適切か。",
    options: [
      "Aを選び、公開を行わず旅費を請求する",
      "Bを選び、協働先の同意書と個人情報の管理計画を準備する",
      "Cを一人で選び、論文の代わりに公開会だけを行う",
      "Dを選び、7週間の宿泊提供を受ける",
    ],
    correctIndex: 1,
    evidence: [
      "B 地域協働枠：6〜8週間",
      "国内旅費",
      "過程を報告する公開会",
      "個人情報を扱う場合",
    ],
    explanation:
      "Only track B matches the duration, community collaboration, process-based public outcome, travel support, and activity funding. Interviews also trigger the ethics/data-management plan, while a partner consent letter is required before starting.",
  },
  {
    semanticId: "N1-info-laboratory-booking-after-hours",
    level: "N1",
    family: "information-retrieval",
    semanticFocus:
      "trained researcher books after-hours imaging with hazardous sample approval",
    sources: [
      {
        label: "共用画像解析室　利用規程",
        body: "通常利用：平日9:00〜18:00。利用者講習を修了した者が予約可。操作支援が必要な場合は3営業日前までに技術員枠も予約。\n時間外利用：平日18:00〜22:00および土曜9:00〜17:00。通常利用を5回以上行い、時間外認定を受けた者に限る。二人以上で入室し、技術員の支援はありません。\n初回相談：未経験者の試料・撮影条件を確認。装置予約ではありません。\n予約は14日前から前日正午まで。連続4時間を超える場合は管理者承認が必要。感染性・揮発性・未固定の人体由来試料は、予約前に試料審査を受け、承認番号を入力してください。終了後はデータを各自の保存先へ移し、装置内のデータを7日以内に削除。利用料は予約時間で計算し、開始24時間以内の取消は全額請求します。ただし装置故障による中止は請求しません。異常時は電源を切らず、非常連絡先へ電話してください。",
      },
    ],
    question:
      "時間外認定を受け、通常利用を6回経験した研究者が、固定していない人体由来試料を土曜に3時間撮影したい。何が必要か。",
    options: [
      "一人で入室し、当日に技術員の操作支援を頼む",
      "予約後に試料審査を受け、承認番号は省略する",
      "予約前に試料審査を受け、承認番号を入力して二人以上で入室する",
      "初回相談だけを予約し、そのまま装置を3時間使う",
    ],
    correctIndex: 2,
    evidence: [
      "時間外認定",
      "二人以上で入室",
      "予約前に試料審査",
      "承認番号を入力",
    ],
    explanation:
      "The researcher meets the experience and certification conditions for Saturday use, but an unfixed human sample requires pre-booking review and its approval number. After-hours access requires at least two people and offers no technical support.",
  },
  {
    semanticId: "N1-info-public-consultation-accessibility",
    level: "N1",
    family: "information-retrieval",
    semanticFocus:
      "resident submits an accessible oral comment with supporting document before deadline",
    sources: [
      {
        label: "都市交通計画案　意見提出手続",
        body: "提出資格：市内在住・在勤・在学者、市内に事業所を持つ法人、および計画に直接利害関係を有する者。\n提出方法：専用フォーム、郵送（締切日消印有効）、各支所への持参、または口頭記録。口頭記録は、障害その他の事情により書面提出が難しい人を対象に、職員が内容を読み返して確認した上で記録します。希望日の3営業日前までに予約してください。\n期間：6月1日〜30日。氏名・住所等の連絡先と、計画案の該当ページを記載。匿名の意見は受理しません。図や調査資料は合計10MBまで添付可。\n意見の概要と市の考え方は8月に公表しますが、個人を特定する情報は除きます。個別の回答は行いません。同じ内容を複数回提出しても一件として整理します。賛否の件数だけで計画を決める手続きではありません。差別的表現や計画と無関係な営業案内は公表対象外。説明会での発言は、別途提出しなければ正式な意見にはなりません。",
      },
    ],
    question:
      "書面入力が難しい市内在住者が、図を示しながら正式な意見を伝えたい。どうすればよいか。",
    options: [
      "説明会で発言すれば自動的に正式意見として扱われる",
      "匿名で同じ意見を何度も送り、賛成件数を増やす",
      "期限内の日を3営業日前までに口頭記録予約し、連絡先・該当ページと資料を示す",
      "7月に支所へ行き、個別回答を求める",
    ],
    correctIndex: 2,
    evidence: [
      "口頭記録",
      "希望日の3営業日前までに予約",
      "6月1日〜30日",
      "該当ページ",
      "調査資料",
    ],
    explanation:
      "The oral-record route exists for people unable to submit writing, but it needs an appointment, identifying/contact details, the relevant page, and submission within June. Hearing speech alone is not a formal comment.",
  },
  {
    semanticId: "N1-info-manuscript-digitization-color",
    level: "N1",
    family: "information-retrieval",
    semanticFocus:
      "rights holder orders preservation scans and limited public derivatives of a fragile manuscript",
    sources: [
      {
        label: "資料デジタル化サービス",
        body: "標準撮影：解像度400dpi、カラー調整なし。PDFとJPEGを納品。1ページ120円。\n保存撮影：解像度600dpi、色見本を含むTIFFと閲覧用JPEG。1ページ260円。製本を外せない資料は、状態確認後に対応可否を通知。\n文字検索追加：活字資料のみ。OCR結果は誤りを含むため、校正は依頼者が行う。1ページ80円。手書き資料は対象外。\n公開用画像作成：保存撮影と同時申込の場合、長辺1600pxのJPEGを一式2,000円で作成。\n申込者が所有権を持っていても、著作権や肖像権を持つとは限りません。ウェブ公開を希望する場合は権利確認書を提出してください。当館は権利調査を代行しません。原資料が破損しやすい場合、撮影台の指定や一部撮影不可などの条件を付けます。納期は標準3週間、保存5週間。100ページを超える場合は別途見積もり。納品後30日で作業データを削除するため、再納品には再作業が必要です。",
      },
    ],
    question:
      "著作権も持つ依頼者が、壊れやすい手書き資料を色管理して保存し、ウェブ用画像も欲しい。適切なのはどれか。",
    options: [
      "標準撮影とOCRを申し込み、館に著作権調査を任せる",
      "保存撮影と公開用画像を同時に申し込み、権利確認書を出して状態確認を受ける",
      "文字検索追加だけを申し込み、TIFFも受け取る",
      "標準撮影を申し込み、納品後いつでも無料で再納品を受ける",
    ],
    correctIndex: 1,
    evidence: [
      "保存撮影",
      "色見本を含むTIFF",
      "公開用画像作成",
      "権利確認書",
      "状態確認",
    ],
    explanation:
      "Preservation capture provides color-referenced TIFFs, and public derivatives can be ordered alongside it. A fragile bound item needs condition review, publication needs a rights declaration, and handwriting is ineligible for OCR.",
  },
  {
    semanticId: "N1-info-executive-program-coaching",
    level: "N1",
    family: "information-retrieval",
    semanticFocus:
      "mid-level manager selects blended program with coaching despite one planned absence",
    sources: [
      {
        label: "産業人材院　管理職プログラム",
        body: "基礎コース：新任管理職向け。対面3日間。全日出席で修了。個別面談なし。\n実践コース：管理職経験2年以上。オンライン講義4回と対面演習2回。欠席は講義1回まで録画視聴で補完可。ただし対面演習は振替不可。課題合格者には修了証を発行。\n組織変革コース：部門責任者向け。6か月間のチームプロジェクト。所属組織の推薦と、参加者3人以上が必要。\n伴走コース：実践コースの全日程に加え、終了後3か月間、月1回の個別コーチング。定員12人。\n受講料は基礎6万円、実践10万円、組織変革一組30万円、伴走16万円。申込時に職歴と解決したい課題を提出。実践・伴走のオンライン講義は録画を7日間公開します。修了証には録画補完の有無を記載しません。勤務先の都合による欠席も上記条件を超えれば修了不可。コーチング日時は採択後に個別調整しますが、翌月への繰越はできません。",
      },
    ],
    question:
      "管理職経験3年で、オンライン講義を一度欠席する予定だが、修了証と研修後の個別支援が必要な人は何を選ぶべきか。",
    options: [
      "基礎コースを選び、欠席分を録画で補う",
      "実践コースを選び、研修後に無料の面談を追加する",
      "組織変革コースへ一人で応募する",
      "伴走コースを選び、欠席講義を7日以内に録画で補完する",
    ],
    correctIndex: 3,
    evidence: [
      "伴走コース",
      "月1回の個別コーチング",
      "欠席は講義1回まで録画視聴で補完可",
      "課題合格者には修了証",
    ],
    explanation:
      "The coaching requirement uniquely selects the companion track, which inherits the practical course's certificate and one-recorded-lecture allowance. In-person exercises still cannot be missed or transferred.",
  },
  {
    semanticId: "N1-info-ethics-review-calendar",
    level: "N1",
    family: "information-retrieval",
    semanticFocus:
      "research team chooses expedited amendment review without starting recruitment early",
    sources: [
      {
        label: "人対象研究倫理審査　日程と区分",
        body: "通常審査：新規の介入研究、侵襲を伴う研究、判断が難しい研究。委員会は毎月第2木曜。申請締切は前月20日。結果は原則10営業日以内。\n迅速審査：匿名化済み既存資料のみを用いる研究、または承認済み研究の軽微な変更。随時受付、標準15営業日。審査者が通常審査を必要と判断した場合は次回委員会へ移行。\n報告のみ：研究責任者・連絡先の変更、研究期間の短縮。変更後10日以内に届け出。\n承認前に参加者募集、同意取得、データ収集を始めることはできません。外部機関と匿名化前のデータを共有する追加は軽微な変更に含まれません。申請書、説明文書、同意書、利益相反申告を提出。迅速審査の軽微変更では、変更対照表も必要。研究期間の延長は終了日の30日前までに変更申請してください。審査結果が「条件付き承認」の場合、指摘へ回答し最終承認を得るまで研究を開始できません。学会発表だけを追加する場合も、同意説明の公開範囲を確認してください。",
      },
    ],
    question:
      "承認済みの質問紙研究で、質問を一つ削除する軽微な変更を行いたい。募集はまだ始めていない。どの手続きが適切か。",
    options: [
      "報告のみとして、変更後10日以内に知らせて募集を始める",
      "迅速審査へ変更対照表などを出し、最終承認後に募集を始める",
      "通常審査の締切を待たず、承認前に同意だけ取る",
      "研究期間短縮として届け出、外部へ匿名化前データを共有する",
    ],
    correctIndex: 1,
    evidence: [
      "承認済み研究の軽微な変更",
      "変更対照表も必要",
      "承認前に参加者募集",
      "最終承認を得るまで研究を開始できません",
    ],
    explanation:
      "Deleting one questionnaire item is a minor amendment eligible for expedited review, with a change table. Recruitment and consent still wait for final approval; reporting-only changes are limited to named administrative updates.",
  },
] as const satisfies readonly UpperReadingSeed[];

const n2MidSeeds = [
  {
    semanticId: "N2-mid-limited-menu-food-waste",
    level: "N2",
    family: "reading-mid",
    semanticFocus:
      "small restaurant narrows menu to reduce waste while rotating one special dish",
    sources: [
      {
        body: "駅前の小さな食堂が、先月からメニューを半分ほどに減らした。選ぶ楽しみがなくなるのではないかと思ったが、実際に行ってみると印象は違った。以前は料理ごとに多くの材料を用意していたため、あまり注文されない材料が残り、閉店前には売り切れを恐れて作り置きも増えていたという。品数をしぼってからは、よく使う材料を新鮮なうちに使い切れ、注文を受けてから作る余裕も生まれたそうだ。\nもちろん、いつ行っても同じでは飽きる。そこで店は、基本の六品に加え、季節の材料を使う一品を週ごとに替えている。多さをそのまま豊かさと考えるのではなく、選択肢を整理した上で変化を残す。この店の工夫は、小さな店が無理なく質を保つ方法として興味深い。",
      },
    ],
    question: "筆者は、この食堂のメニュー変更をどのように評価しているか。",
    options: [
      "品数を減らしたため、客が選ぶ楽しみを完全に失った",
      "材料の無駄を減らしつつ、週替わりで変化も残した",
      "作り置きを増やすことで、売り切れを防いだ",
      "基本の料理を毎週すべて入れ替える点がよい",
    ],
    correctIndex: 1,
    evidence: [
      "よく使う材料を新鮮なうちに使い切れ",
      "季節の材料を使う一品を週ごとに替えている",
      "選択肢を整理した上で変化を残す",
    ],
    explanation:
      "The positive assessment rests on two linked effects: less waste and fresher cooking through a smaller core menu, while a rotating seasonal dish prevents monotony.",
  },
  {
    semanticId: "N2-mid-community-bus-hidden-demand",
    level: "N2",
    family: "reading-mid",
    semanticFocus:
      "community bus survey must ask nonusers why they do not ride",
    sources: [
      {
        body: "市は地域バスの利用者にアンケートを行い、「便数に満足している」という回答が多かったため、現在の時刻表で問題はないと発表した。しかし、この調査だけで判断してよいだろうか。バスが通勤時間に合わず、最初から利用していない人は、車内で配られたアンケートを受け取れない。階段の高い車両に乗りにくい人や、停留所まで歩けない人の意見も同様だ。\n利用中の人の満足度を知ることは大切である。ただ、それは「今のサービスを使える人」にとっての評価にすぎない。路線を改善する目的なら、住民全体に利用しない理由を尋ね、時間、場所、車両など、どこに障害があるかを確かめる必要がある。利用者の声だけが詳しく集まるほど、利用できない人の存在は見えにくくなるのである。",
      },
    ],
    question: "筆者が市の調査に足りないと考えていることは何か。",
    options: [
      "現在の利用者に満足度を何度も尋ねること",
      "バスを利用しない住民の理由も調べること",
      "車内アンケートの質問数を減らすこと",
      "時刻表を調査前に変更すること",
    ],
    correctIndex: 1,
    evidence: [
      "最初から利用していない人は、車内で配られたアンケートを受け取れない",
      "住民全体に利用しない理由を尋ね",
    ],
    explanation:
      "The critique is sampling bias: a bus-only survey excludes people whom the service fails to reach. The author calls for asking nonusers about barriers before redesigning routes.",
  },
  {
    semanticId: "N2-mid-museum-handwritten-captions",
    level: "N2",
    family: "reading-mid",
    semanticFocus:
      "museum handwritten staff captions invite observation without replacing formal labels",
    sources: [
      {
        body: "ある博物館では、作品名や年代を記した正式な説明の横に、担当者が手書きした小さなカードを置いている。「この器の裏にも模様があります」「少し離れると鳥の形が見えます」といった短い言葉だ。専門的な説明ではないため、最初は軽すぎるのではないかと思った。\nだが、カードを読んだ来館者は、答えを教えられて終わるのではなく、もう一度作品に近づいたり、見る位置を変えたりしていた。カードは知識を増やすというより、観察の入口を作っていたのである。一方で、歴史的な背景を知りたい人には正式な説明も必要だ。二つを競わせず、役割の異なる案内として並べたからこそ、見る人は自分に合う入口を選べたのだろう。",
      },
    ],
    question: "筆者によると、手書きのカードにはどのような役割があるか。",
    options: [
      "正式な説明を不要にする",
      "作品の正しい評価を一つに決める",
      "来館者が作品を見直すきっかけを作る",
      "専門知識を詳しく教える",
    ],
    correctIndex: 2,
    evidence: [
      "もう一度作品に近づいたり、見る位置を変えたり",
      "観察の入口を作っていた",
    ],
    explanation:
      "The cards prompt renewed observation rather than replacing scholarly context. The coexistence of the two labels lets visitors choose different ways into the work.",
  },
  {
    semanticId: "N2-mid-standing-meeting-preparation",
    level: "N2",
    family: "reading-mid",
    semanticFocus:
      "short standing meetings work only when discussion material is prepared beforehand",
    sources: [
      {
        body: "私の職場では、朝の会議を立ったまま十五分で行うことにした。時間を短くすれば無駄な発言も減ると思ったからだ。最初の一週間は確かに早く終わったが、重要な問題まで「あとで話そう」と先送りされ、その相談が一日中ばらばらに続くようになった。会議だけを短くしても、仕事全体の時間は減らなかったのである。\nそこで、報告だけの内容は前日までに共有し、会議では判断が必要な二点だけを扱うことにした。資料を読んでいない人がいる場合は、その場で説明を繰り返さず、決定を翌日に回す。準備の責任が明確になってから、十五分でも必要な議論ができるようになった。形式よりも、会議の前に情報をそろえる仕組みが重要だったのだ。",
      },
    ],
    question: "朝の会議がうまくいくようになった理由は何か。",
    options: [
      "重要な問題をすべて会議の外で決めたから",
      "会議を十五分から一時間に戻したから",
      "立って話すことに社員が慣れたから",
      "事前共有を行い、会議で判断する点をしぼったから",
    ],
    correctIndex: 3,
    evidence: [
      "報告だけの内容は前日までに共有し",
      "判断が必要な二点だけを扱う",
      "会議の前に情報をそろえる仕組み",
    ],
    explanation:
      "Standing and a time limit initially displaced work rather than reducing it. Success followed from prior information sharing and reserving the meeting for defined decisions.",
  },
  {
    semanticId: "N2-mid-volunteer-choice-continuity",
    level: "N2",
    family: "reading-mid",
    semanticFocus:
      "school volunteer program improves continuity by letting students choose recurring roles",
    sources: [
      {
        body: "高校の地域活動では、以前、全員が毎月ちがう仕事を体験していた。多くの場所を知るという目的だったが、受け入れる側は毎回説明を一から行わなければならず、生徒も仕事を覚えたころには次の場所へ移っていた。活動後の感想には「役に立てた実感がない」という声が多かった。\n今年は、最初に三つの活動を見学したあと、生徒が一つを選び、半年間続ける方法に変えた。選ばれにくい活動が出るという課題はあるものの、生徒は少しずつ難しい仕事を任され、地域の人との関係も深まった。体験の種類を増やすだけでは、経験が豊かになるとは限らない。一つの場所で変化を見届ける時間にも価値がある。",
      },
    ],
    question: "新しい方法によって、どのような変化があったか。",
    options: [
      "すべての生徒が毎月別の活動を選ぶようになった",
      "地域側が生徒への説明をやめた",
      "生徒が同じ活動を続け、より深く関われるようになった",
      "選ばれにくい活動が完全になくなった",
    ],
    correctIndex: 2,
    evidence: [
      "一つを選び、半年間続ける",
      "少しずつ難しい仕事を任され",
      "関係も深まった",
    ],
    explanation:
      "Continuity lets students develop competence and relationships. The text acknowledges, rather than solves, unequal popularity among activities.",
  },
  {
    semanticId: "N2-mid-bookshop-shelf-conversation",
    level: "N2",
    family: "reading-mid",
    semanticFocus:
      "bookshop recommendation shelf succeeds by exposing staff reasoning rather than bestseller rank",
    sources: [
      {
        body: "近所の書店には、「今週よく売れた本」ではなく、「店員がだれかに渡したい本」という棚がある。カードには本の説明だけでなく、「仕事を始めたばかりの友人に」「長い旅行から帰った人に」など、どんな人を思い浮かべて選んだかが書かれている。私はそこに自分が当てはまらなくても、ついカードを読んでしまう。\n売り上げ順の棚なら、人気という共通の基準で本を比べられる。しかし、この棚で見えるのは、店員が本と読者の間にどんな関係を想像したかだ。その理由に納得しないこともあるが、別の読み方を知るきっかけにはなる。本そのものだけでなく、本を勧める人の考えまで含めて選べる点が、この棚のおもしろさなのだ。",
      },
    ],
    question: "筆者は、この棚の何がおもしろいと述べているか。",
    options: [
      "人気の順位が毎週正確に分かること",
      "自分に合う本だけが並んでいること",
      "店員が本を勧める理由や見方に触れられること",
      "すべてのカードの意見に納得できること",
    ],
    correctIndex: 2,
    evidence: [
      "どんな人を思い浮かべて選んだか",
      "本を勧める人の考えまで含めて選べる",
    ],
    explanation:
      "The distinctive value is access to the recommender's imagined relationship between book and reader, not sales rank or guaranteed agreement.",
  },
  {
    semanticId: "N2-mid-remote-camera-purpose",
    level: "N2",
    family: "reading-mid",
    semanticFocus:
      "remote team replaces permanent camera rule with purpose-specific visual cues",
    sources: [
      {
        body: "オンライン会議でカメラを常にオンにする規則を設ける会社がある。表情が見えれば安心でき、発言のタイミングもつかみやすいという理由だ。私たちのチームも試したが、画面に映る自分を気にして話に集中できない人や、通信が不安定になる人がいた。顔が見えていても、資料を読んでいないことは分からない。\nそこで、初対面のあいさつや、反応を見ながら案を選ぶ場面ではカメラを使い、長い報告を聞く時間は自由にした。代わりに、質問や同意はチャットの印で示す。必要なのは「見えている状態」そのものではなく、その場で不足する情報をどう補うかである。道具の使い方は、会議の目的から決めるべきだ。",
      },
    ],
    question: "筆者のチームは、カメラの使用をどのように変えたか。",
    options: [
      "すべての会議でカメラを禁止した",
      "通信状態に関係なく常に使うことにした",
      "会議の目的に応じて使う場面を選ぶようにした",
      "発言者だけが一日中カメラを使うことにした",
    ],
    correctIndex: 2,
    evidence: [
      "初対面のあいさつや、反応を見ながら案を選ぶ場面ではカメラを使い",
      "長い報告を聞く時間は自由",
      "会議の目的から決める",
    ],
    explanation:
      "The team adopts purpose-based camera use and supplements missing feedback with chat. It neither mandates nor bans cameras universally.",
  },
  {
    semanticId: "N2-mid-street-tree-maintenance",
    level: "N2",
    family: "reading-mid",
    semanticFocus:
      "street tree plan values long-term maintenance capacity over planting count",
    sources: [
      {
        body: "町内会で、夏の暑さをやわらげるために街路樹を増やす案が出た。最初は、空いている場所にできるだけ多く植えればよいと思っていた。しかし専門家によると、若い木は数年間、定期的な水やりや枝の管理が必要で、世話が足りなければ日陰を作る前に弱ってしまうという。植える費用だけを集めても十分ではない。\nそこで町内会は、十年間に植える本数を決めるのではなく、毎年世話ができる本数を確認しながら少しずつ増やすことにした。店や学校にも水やりを分担してもらい、担当が決まらない場所には植えない。成果がすぐ数字に表れなくても、育った木が残らなければ意味がない。計画の大きさは、始める力ではなく続ける力に合わせる必要がある。",
      },
    ],
    question: "町内会は、どのような方針で木を増やすことにしたか。",
    options: [
      "最初の年に空いている場所へすべて植える",
      "世話を担当できる範囲で段階的に植える",
      "水やりが不要な大きい木だけを買う",
      "植えた本数を十年間変えない",
    ],
    correctIndex: 1,
    evidence: [
      "毎年世話ができる本数を確認しながら少しずつ増やす",
      "担当が決まらない場所には植えない",
    ],
    explanation:
      "The revised plan limits planting to maintainable capacity and expands gradually. The author contrasts visible initial scale with the less visible ability to sustain trees.",
  },
] as const satisfies readonly UpperReadingSeed[];

const n2IntegratedSeeds = [
  {
    semanticId: "N2-integrated-coworking-call-evening",
    level: "N2",
    family: "reading-integrated",
    semanticFocus:
      "researcher compares coworking spaces for private calls and evening access",
    sources: [
      {
        label: "ワークラウンジ青葉",
        body: "駅から徒歩三分。平日は午前八時から午後十時まで、土日は午後六時まで利用できます。会話のできる共同席と、予約制の個室があり、個室ではオンライン会議も可能です。個室は一回二時間までで、利用料とは別に一時間五百円かかります。飲み物は共同席だけで飲めます。月会員でなくても、一日券で個室を予約できます。",
      },
      {
        label: "市民仕事室みなと",
        body: "市役所の二階にあり、毎日午前九時から午後八時まで開いています。利用は無料ですが、市内に住む人か市内で働く人に限ります。机のある静音室では通話ができません。通話用の小部屋は二室あり、予約はできず、一回三十分までです。混雑時は利用を待つことがあります。飲食は入口横の休憩場所でお願いします。",
      },
    ],
    question:
      "市外に住み、市内でも働いていない人が、平日の午後八時半から一時間、確実にオンライン面接をしたい。どちらが適切か。",
    options: [
      "青葉の共同席を使う",
      "青葉の個室を予約する",
      "みなとの静音室を使う",
      "みなとの通話用小部屋を使う",
    ],
    correctIndex: 1,
    evidence: [
      "平日は午前八時から午後十時まで",
      "一日券で個室を予約できます",
      "市内に住む人か市内で働く人に限ります",
    ],
    explanation:
      "Only Aoba is open after 20:00 to an otherwise ineligible nonresident, and its private room can be reserved for the full hour. The common area does not guarantee interview privacy.",
  },
  {
    semanticId: "N2-integrated-digital-ticket-access",
    level: "N2",
    family: "reading-integrated",
    semanticFocus:
      "two columns agree digital tickets need a nondigital access path but differ on emphasis",
    sources: [
      {
        label: "コラムA",
        body: "イベントの電子チケットは、印刷や郵送の費用を減らし、なくしても再表示できる点で便利だ。入場時刻を記録できるため、混雑の予測にも役立つ。スマートフォンを持たない人がいるから導入すべきでない、という意見もあるが、窓口で本人確認をする方法を残せばよい。新しい仕組みを止めるより、利用できない人のための別の入口を設計するべきだ。",
      },
      {
        label: "コラムB",
        body: "電子チケットの問題は、機械が苦手な人だけの問題ではない。電池切れや通信障害はだれにでも起こる。便利さを宣伝する一方で、例外時の対応を現場の係員に任せきりにすると、入口で判断がばらばらになる。紙の確認票や共通の本人確認手順を準備し、電子方式を使えない場合にも同じ条件で入場できるようにしておく必要がある。",
      },
    ],
    question: "AとBが共通して必要だと考えていることは何か。",
    options: [
      "電子チケットの導入を中止すること",
      "入場時刻の記録を取らないこと",
      "電子方式が使えない場合の手段を用意すること",
      "例外時の判断を係員一人一人に任せること",
    ],
    correctIndex: 2,
    evidence: [
      "利用できない人のための別の入口",
      "電子方式を使えない場合にも同じ条件で入場",
    ],
    explanation:
      "Both writers accept digital tickets only with a defined alternative route. A stresses inclusive adoption; B stresses resilient and consistent exception handling.",
  },
  {
    semanticId: "N2-integrated-language-course-speaking",
    level: "N2",
    family: "reading-integrated",
    semanticFocus:
      "learner compares language courses for spontaneous speaking practice after work",
    sources: [
      {
        label: "会話講座ひかり",
        body: "火曜と木曜の午後七時から八時半。毎回、身近な話題について四人程度のグループで話します。講師は会話中に止めず、最後に表現や発音について助言します。教科書は使いません。欠席した回の録画はありませんが、月に一度、土曜の交流会へ無料で参加できます。初級修了程度から受講できます。",
      },
      {
        label: "オンライン日本語ラボ",
        body: "好きな時間に十五分の動画を見て、文法や語彙を学びます。週一回、提出した録音に講師から詳しいコメントが届きます。月曜の午後六時には質問会がありますが、参加者同士の会話練習は行いません。仕事などで決まった時間に参加できない人や、一人で発音を繰り返し練習したい人に向いています。",
      },
    ],
    question:
      "平日の仕事後に参加でき、身近な話題について相手の反応を聞きながらその場で話す練習を増やしたい人には、どちらが合うか。",
    options: [
      "ひかり。小グループで即興的に話すから",
      "ひかり。欠席回の録画を何度も見られるから",
      "ラボ。参加者同士で毎週会話するから",
      "ラボ。土曜の交流会が毎月あるから",
    ],
    correctIndex: 0,
    evidence: [
      "午後七時から八時半",
      "身近な話題について四人程度のグループで話します",
      "会話中に止めず",
    ],
    explanation:
      "Hikari directly provides live small-group speaking after work. The other stated features belong to neither course or reverse the descriptions.",
  },
  {
    semanticId: "N2-integrated-apartment-renovation-priority",
    level: "N2",
    family: "reading-integrated",
    semanticFocus:
      "residents compare entrance and courtyard renovations under a limited budget",
    sources: [
      {
        label: "案A：入口の改修",
        body: "自動ドアを広くし、入口の二段の階段をゆるい坂に替える。ベビーカーや車いす、大きな荷物を運ぶ住民が通りやすくなる。工事費は今年の修理予算のほぼ全額で、工事中の二週間は裏口を使う必要がある。屋根の修理も同時に行えるため、入口の雨漏りは解決する。",
      },
      {
        label: "案B：中庭の改修",
        body: "使われていない中庭にベンチと日よけを置き、住民が休める場所にする。工事費は予算の半分で済み、残りを来年の入口改修のために残せる。ただし、入口の雨漏りは別に応急修理が必要で、段差も一年はそのままになる。工事は五日間で、建物への出入りには影響しない。",
      },
    ],
    question:
      "管理組合が『今年中に段差と雨漏りを同時に解決する』ことを最優先する場合、どの案を選ぶべきか。",
    options: [
      "案A。入口の通りやすさと屋根の問題を同時に改善できる",
      "案A。工事中も正面入口をそのまま使える",
      "案B。入口の段差を今年中になくせる",
      "案B。応急修理をしなくても雨漏りが直る",
    ],
    correctIndex: 0,
    evidence: [
      "階段をゆるい坂に替える",
      "屋根の修理も同時に行える",
      "雨漏りは解決する",
    ],
    explanation:
      "Plan A alone resolves both stated priorities this year. Its disadvantages are cost and temporary back-door access, not failure to address either problem.",
  },
  {
    semanticId: "N2-integrated-volunteer-regular-contact",
    level: "N2",
    family: "reading-integrated",
    semanticFocus:
      "volunteer chooses regular child contact over flexible one-off event help",
    sources: [
      {
        label: "放課後学習サポート",
        body: "水曜日の午後四時から六時に、小学生の宿題や読書を手伝います。同じ子どもと関係を作るため、原則として三か月以上、月三回参加できる人を募集します。教える経験は不要ですが、活動前の研修に参加してください。交通費は一回千円まで支給します。",
      },
      {
        label: "週末イベントスタッフ",
        body: "公園や文化施設で行う子ども向けイベントの受付、会場準備、片づけを担当します。日程ごとに申し込めるため、毎月参加する必要はありません。子どもに説明する係は経験者が担当し、初めての人は運営の仕事が中心です。活動は主に土日で、交通費の支給はありません。",
      },
    ],
    question:
      "平日夕方に時間があり、同じ子どもと継続的に関わりたい人には、どちらが適切か。",
    options: [
      "学習サポート。三か月以上、定期的に参加するから",
      "学習サポート。研修を受けずにすぐ教えられるから",
      "イベントスタッフ。毎週同じ子どもを担当するから",
      "イベントスタッフ。活動が平日夕方だけだから",
    ],
    correctIndex: 0,
    evidence: ["同じ子どもと関係を作る", "三か月以上、月三回参加"],
    explanation:
      "The learning program explicitly matches both weekday availability and sustained relationships. Weekend events are flexible one-offs centered on operations for beginners.",
  },
  {
    semanticId: "N2-integrated-book-review-practical-change",
    level: "N2",
    family: "reading-integrated",
    semanticFocus:
      "reader compares habit books for immediately testable workplace changes",
    sources: [
      {
        label: "『小さな仕事の整え方』評",
        body: "机の片づけ、メールを読む時刻、会議前の準備など、職場で今日から変えられる行動を一章に一つ紹介している。なぜ効果があるかの説明は短いが、実行例と一週間の確認表が付いている。大きな理論を学びたい人には物足りないかもしれない。しかし、まず試して結果を記録したい人には使いやすい。",
      },
      {
        label: "『習慣を考える』評",
        body: "個人の努力だけでなく、会社の制度や社会の価値観が習慣に与える影響を、研究を引用しながら論じる。具体的な練習問題は少ないが、「続かないのは意志が弱いからだ」という考えを見直せる。すぐに生活を変える手順より、習慣を広い視点から理解したい読者に向いている。",
      },
    ],
    question:
      "仕事のやり方を一つ選んですぐ試し、その結果を一週間記録したい人には、どちらが合うか。",
    options: [
      "『小さな仕事の整え方』。実行例と確認表があるから",
      "『小さな仕事の整え方』。社会制度の研究が中心だから",
      "『習慣を考える』。毎章に職場の練習があるから",
      "『習慣を考える』。一週間の確認表が付くから",
    ],
    correctIndex: 0,
    evidence: ["今日から変えられる行動", "実行例と一週間の確認表"],
    explanation:
      "The first book is explicitly designed for immediate workplace trials and tracking. The second provides structural understanding rather than a step-by-step practice tool.",
  },
  {
    semanticId: "N2-integrated-flex-work-team-overlap",
    level: "N2",
    family: "reading-integrated",
    semanticFocus:
      "two managers support flexible work but identify different coordination safeguards",
    sources: [
      {
        label: "部長Aの意見",
        body: "出社時刻を自由にすると、育児や通院と仕事を両立しやすくなる。ただし、相談したい相手がいつ働いているか分からなければ、作業が止まる。全員が勤務する時間を一日四時間設け、その時間には会議や共同作業を集めたい。それ以外は各自が集中しやすい時間を選べばよい。",
      },
      {
        label: "部長Bの意見",
        body: "同じ時間に集まるだけでは、だれが何を進めているか見えない問題は解決しない。勤務時間の自由は認めた上で、仕事を終える前に進み具合と翌日の予定を共有する必要がある。緊急でなければ、相手の勤務外に返事を求めないという規則もセットにしたい。",
      },
    ],
    question: "AとBの意見に共通していることは何か。",
    options: [
      "全員が同じ時刻に出社すべきだ",
      "勤務時間の自由と協力の仕組みを両立させるべきだ",
      "勤務外にもすぐ返事をするべきだ",
      "会議をすべてなくすべきだ",
    ],
    correctIndex: 1,
    evidence: [
      "出社時刻を自由に",
      "全員が勤務する時間",
      "勤務時間の自由は認めた上で",
      "進み具合と翌日の予定を共有",
    ],
    explanation:
      "Both accept flexible schedules while adding a coordination mechanism. A favors overlap time; B favors status sharing and boundaries around response expectations.",
  },
  {
    semanticId: "N2-integrated-museum-guide-child-choice",
    level: "N2",
    family: "reading-integrated",
    semanticFocus:
      "family compares museum programs for child-led making versus guided observation",
    sources: [
      {
        label: "発見ツアー",
        body: "学芸員と展示室を回り、道具や絵の細部を観察します。答えを聞くだけでなく、参加者が気づいたことを順番に話します。対象は小学四年生以上。毎週日曜の午前十時から一時間で、保護者も一緒に参加します。展示品には触れません。",
      },
      {
        label: "素材アトリエ",
        body: "展示で使われている色や形を参考に、紙、布、木片から好きな材料を選んで作品を作ります。完成の見本はなく、スタッフは道具の使い方だけを説明します。対象は小学生。土曜の午後に九十分行い、保護者は見学できます。作品は持ち帰れます。",
      },
    ],
    question:
      "小学三年生の子どもが、自分で材料を選び、決まった見本なしで作品を作りたい。どちらに参加できるか。",
    options: [
      "発見ツアー。展示品に触れて作れるから",
      "発見ツアー。三年生だけが対象だから",
      "素材アトリエ。小学生が自由な材料で作れるから",
      "素材アトリエ。完成見本を正確にまねるから",
    ],
    correctIndex: 2,
    evidence: ["対象は小学生", "好きな材料を選んで", "完成の見本はなく"],
    explanation:
      "The atelier accepts a third grader and matches both free material choice and no model. The tour starts at grade four and centers on guided observation.",
  },
] as const satisfies readonly UpperReadingSeed[];

const n2ThematicSeeds = [
  {
    semanticId: "N2-thematic-questioning-skill",
    level: "N2",
    family: "reading-thematic",
    semanticFocus:
      "good questions expose the questioner's current model and invite correction",
    sources: [
      {
        body: "分からないことがあれば質問しなさい、とよく言われる。しかし、質問の数が多ければ学びが深くなるわけではない。説明を聞く前に「分かりません」と言うだけでは、相手はどこから説明すればよいか判断できない。一方、理解したふりをして最後まで黙っていても、間違った考え方がそのまま残る。\n以前、私は機械の操作を教える仕事をしていた。初心者から「動きません」と言われると、原因を一つずつ確かめなければならなかった。ところが、「ここを押すと保存されると思ったのですが、画面が変わりません」と言われれば、相手がどのように考え、どこで予想と結果がずれたかが分かる。答える側にとって、後の質問のほうがずっと助けやすい。\nこれは、質問する前に全部自分で調べるべきだという意味ではない。必要なのは、今分かっていることと、分からない点の境界を示すことだ。「説明の前半は理解したが、この例が同じ規則に当てはまる理由が分からない」という言い方なら、質問そのものが理解の確認にもなる。相手の説明を受けたあと、自分の考えがどう変わったかも確かめられる。\nよい質問は、知識がないことを隠すためのものでも、答えを早く受け取るためだけのものでもない。自分の中にある不完全な地図を相手に見せ、どこを直せばよいか一緒に探す行為である。だから質問する力を育てるには、立派な言葉を覚えるより、まず自分が何をどう理解しているかを言葉にする練習が必要なのだ。",
      },
    ],
    question: "筆者が最も伝えたいことは何か。",
    options: [
      "よい質問には、自分の理解と不明点を示すことが大切だ",
      "初心者は説明を聞く前に必ず自分で答えを見つけるべきだ",
      "質問はできるだけ短く「分かりません」と言うのがよい",
      "知識が十分な人は質問をする必要がない",
    ],
    correctIndex: 0,
    evidence: [
      "今分かっていることと、分からない点の境界を示す",
      "自分が何をどう理解しているかを言葉にする",
    ],
    explanation:
      "Across the example and conclusion, the author defines a useful question as revealing the learner's current understanding and the precise gap, enabling targeted correction.",
  },
  {
    semanticId: "N2-thematic-festival-change-continuity",
    level: "N2",
    family: "reading-thematic",
    semanticFocus:
      "local festival continuity depends on negotiating change rather than freezing one historical form",
    sources: [
      {
        body: "地域の祭りを守ろうという話になると、「昔のまま続けること」が目標になりやすい。衣装や音楽、行列の順番が変われば、本来の祭りではなくなると心配する人もいる。たしかに、理由も考えず流行に合わせて変え続ければ、その地域らしさは薄くなるだろう。\nしかし、調べてみると、「昔の形」は一つではないことが多い。ある町の祭りでは、百年前には川を船で渡っていたが、橋ができてから行列に変わった。夜まで続いた踊りも、働き方や交通事情に合わせて時間が短くなった。現在伝統と呼ばれている形も、それ以前の変化の結果なのである。\n近年、その町では担い手が減り、重い道具を運べる人が足りなくなった。若い人から軽い材料で作り直す案が出たが、年長者は見た目が変わると反対した。そこで、道具が何を表しているかを聞き取り、形と色は残しつつ、内側の材料だけを替えた。また、準備の技術を動画で記録し、町を離れた人も帰省時に参加できるよう日程を早く知らせた。\n大切なのは、変えるか変えないかを単純に選ぶことではない。何を残したいのかを言葉にし、その意味を支えるために形を変える場合もある。議論の過程で、以前は当たり前すぎて説明されなかった祭りの意味が共有されることもある。伝統は動かない物ではなく、受け継ぐ人々が理由を確かめながら次の形を選び続ける関係なのだ。",
      },
    ],
    question: "筆者は、地域の祭りを守ることについてどう考えているか。",
    options: [
      "現在の形を少しでも変えれば、祭りの意味は失われる",
      "残す意味を確かめながら、必要な形の変更を選ぶことが重要だ",
      "若い人の案をすべて採用すれば、担い手不足は解決する",
      "過去の変化を調べず、最も古い形に戻すべきだ",
    ],
    correctIndex: 1,
    evidence: [
      "何を残したいのかを言葉にし",
      "意味を支えるために形を変える場合もある",
      "理由を確かめながら次の形を選び続ける",
    ],
    explanation:
      "The essay rejects both careless novelty and frozen preservation. Continuity comes from identifying meaning and adapting form where that meaning and participation require it.",
  },
  {
    semanticId: "N2-thematic-walking-productive-detour",
    level: "N2",
    family: "reading-thematic",
    semanticFocus:
      "unhurried walking creates observations that goal-driven movement filters out",
    sources: [
      {
        body: "地図のアプリは、目的地までの最短の道をすぐ教えてくれる。知らない町でも迷いにくくなり、約束の時間を守るには便利だ。私も仕事で移動するときは欠かせない。しかし休日まで画面の指示だけを追っていると、町を歩いたはずなのに、駅と目的の店以外ほとんど覚えていないことがある。\nある日、携帯電話の電池が切れ、仕方なく商店街の人に道を聞いた。教えられた角を一つ間違えたため、古い工場の跡に小さな公園があることを知った。壁には地域の子どもが描いた絵があり、近くの店主から、工場が閉じたあと住民が場所の使い方を話し合ったと聞いた。もし最短経路を正確に歩いていたら、この場所にも話にも出会わなかった。\nもちろん、迷うこと自体をすすめたいのではない。急いでいる人や移動に不安がある人にとって、正確な案内は重要だ。問題は、効率のよい移動だけがよい移動だと思い込むことである。目的がはっきりしていると、私たちは関係のない情報を自然に見なくなる。それは作業には役立つが、町の変化や人の暮らしを知る機会も小さくする。\n時間に余裕のある日は、到着だけを目標にせず、一つ手前の駅で降りたり、気になった道を選んだりしてみる。歩く速度を落とすと、遠回りは単なる損失ではなくなる。予定していなかったものに注意を向けられる時間こそ、歩くことが私たちに与える価値の一つではないだろうか。",
      },
    ],
    question:
      "筆者が、時間に余裕のある日の歩き方としてすすめていることは何か。",
    options: [
      "道に迷うまで地図を見ないこと",
      "目的地へ必ず最短時間で着くこと",
      "到着以外にも注意を向け、予定外の発見を受け入れること",
      "知らない人には道を聞かないこと",
    ],
    correctIndex: 2,
    evidence: [
      "効率のよい移動だけがよい移動だと思い込む",
      "予定していなかったものに注意を向けられる時間",
    ],
    explanation:
      "The author retains the value of navigation when needed but argues that less goal-bound walking permits observations and local encounters filtered out by pure efficiency.",
  },
  {
    semanticId: "N2-thematic-near-miss-records",
    level: "N2",
    family: "reading-thematic",
    semanticFocus:
      "organizations learn from near misses only when reporting is separated from blame",
    sources: [
      {
        body: "事故が起きたあと、原因を調べて規則を作ることは必要である。だが、大きな事故だけを記録していると、改善の機会を多く失う。実際には、事故にならなかった小さな出来事の中に、同じ危険の始まりが何度も現れているからだ。操作を間違えかけたが直前で気づいた、表示が分かりにくく別の部屋へ入った、といった経験である。\nところが、こうした出来事は報告されにくい。「結果として問題がなかったのだから、言わなくてもよい」と考える人もいれば、報告すれば自分の注意不足を責められると心配する人もいる。会社が件数の少なさを安全の証拠として評価すると、現場はますます小さな失敗を隠すようになる。数字はよく見えても、危険が減ったとは限らない。\nある工場では、報告書から個人名を外し、「だれが間違えたか」より「どの条件で起こりやすかったか」を話し合うようにした。すると、似た報告が複数の部署から集まり、機械の二つのボタンが暗い場所で区別しにくいことが分かった。ボタンの形を変えた結果、同じ間違いは大きく減った。個人にもっと注意するよう命じるだけでは見つからなかった改善である。\n報告を増やすことは、失敗の多い職場を作ることではない。すでに起きているが見えていなかった出来事を、学べる情報に変えることである。そのためには、報告した人を守り、件数の増加を悪い成績として扱わない姿勢が必要だ。安全を高める第一歩は、失敗がないように見せることではなく、事故になる前の小さな兆候を安心して共有できる環境を作ることなのである。",
      },
    ],
    question: "筆者によると、事故を防ぐために重要なことは何か。",
    options: [
      "報告件数が少ない部署を高く評価すること",
      "小さな間違いを個人の責任として公表すること",
      "事故にならなかった出来事は記録しないこと",
      "小さな兆候を責めずに共有し、仕組みの改善に使うこと",
    ],
    correctIndex: 3,
    evidence: [
      "「だれが間違えたか」より「どの条件で起こりやすかったか」",
      "小さな兆候を安心して共有できる環境",
    ],
    explanation:
      "The passage connects psychological safety, near-miss reporting, pattern discovery, and system redesign. Low report counts and individual blame can instead conceal risk.",
  },
  {
    semanticId: "N2-thematic-public-benches-staying",
    level: "N2",
    family: "reading-thematic",
    semanticFocus:
      "public benches support participation by making rest and unplanned presence possible",
    sources: [
      {
        body: "駅前広場を整備するとき、通行のじゃまになるという理由でベンチを減らす計画が出た。人が立ち止まらなければ流れはよくなり、掃除もしやすいという。たしかに、朝の混雑時だけを見れば、何も置かれていない広場は効率的に見える。\nしかし一日観察すると、別の姿が見えてくる。昼には買い物の途中で休む高齢者がいる。放課後には、バスを待つ生徒が荷物を置く。小さな子どもを連れた人は、靴を直したり水を飲ませたりするために座る。ベンチがなくても人々は消えず、低い塀や店の前に座るようになる。結果として、通行を妨げる場所が増える場合もある。\nベンチは、単に疲れた人のための道具ではない。約束より少し早く着いた人が待ち、偶然会った人が短く話し、何かを買わなくても町にいられる場所を作る。店なら、長く座るには注文が必要だが、公共のベンチは利用の理由を問わない。その自由があるから、体力やお金に余裕のない人も広場を使える。\nもちろん、置き方には工夫がいる。人の流れをふさがず、車いすの横にも人が座れる空間を取り、日陰や照明も考える必要がある。数だけ増やせばよいのではない。それでも、移動の速さだけを基準に広場を作れば、そこに「いる」ことのできる人は限られる。公共空間は通り過ぎるためだけでなく、安心して一時とどまるためにもあるという視点を忘れてはならない。",
      },
    ],
    question: "筆者が公共のベンチについて主張していることは何か。",
    options: [
      "通行量の多い場所には一つも置くべきではない",
      "掃除を簡単にするため、店の中だけに置くべきだ",
      "だれでも休んだり待ったりできる公共空間を支える役割がある",
      "高齢者だけが使えるよう利用者を決めるべきだ",
    ],
    correctIndex: 2,
    evidence: [
      "何かを買わなくても町にいられる場所",
      "安心して一時とどまるためにもある",
    ],
    explanation:
      "The author treats benches as civic infrastructure for inclusive rest, waiting, and presence. Placement requires design, but removing them for flow alone narrows who can use the square.",
  },
  {
    semanticId: "N2-thematic-translation-useful-ambiguity",
    level: "N2",
    family: "reading-thematic",
    semanticFocus:
      "translation sometimes preserves ambiguity because the source deliberately leaves relations open",
    sources: [
      {
        body: "翻訳をしていると、一つの外国語に二つ以上の訳が考えられることがある。そんなとき、意味を一つに決めるのが翻訳者の仕事だと思われがちだ。説明書や契約書なら、誤解が起きないよう関係を明確にする必要があるだろう。だが、小説や詩でも同じとは限らない。\nある物語に、「彼女は窓の外を見た。それはもう戻らなかった」という文があった。「それ」が去った人を指すのか、過ぎた季節を指すのか、原文だけでは決められない。前後を読んでも、どちらとも取れるように書かれていた。ところが最初の訳では、文法上分かりやすくするため「その人は」と補った。その結果、季節について読む可能性は消えてしまった。\n曖昧な文は、必ずしも不完全な文ではない。読者が複数のものを重ねて感じるために、作者が指す対象を開いたままにすることもある。翻訳先の言語では、主語や代名詞を補わなければ不自然になる場合があり、まったく同じ形は保てない。それでも、別の言い回しを探したり、周囲の文で決めすぎないようにしたりすれば、読者が考える余地を残せる。\n大切なのは、曖昧さを見つけたとき、すぐ欠点として消さないことだ。それが情報不足なのか、作品の働きなのかを考えなければならない。翻訳は意味を運ぶ仕事だが、原文が読者に渡していた選択まで一つにまとめてしまえば、運んだ内容はかえって少なくなる。明確にする力と同じように、決めずに残す判断も翻訳には必要なのである。",
      },
    ],
    question: "筆者が文学の翻訳で必要だと考えていることは何か。",
    options: [
      "原文よりも必ず具体的な主語を加えること",
      "複数の読み方を生む曖昧さの役割を考え、可能なら残すこと",
      "曖昧な文を説明書と同じ基準で直すこと",
      "読者が迷わないよう訳を一つの意味に限定すること",
    ],
    correctIndex: 1,
    evidence: [
      "作者が指す対象を開いたままにする",
      "読者が考える余地を残せる",
      "決めずに残す判断",
    ],
    explanation:
      "The author distinguishes harmful ambiguity in practical documents from deliberate openness in literature and argues that translators should preserve interpretive room where it performs a function.",
  },
  {
    semanticId: "N2-thematic-repair-knowledge",
    level: "N2",
    family: "reading-thematic",
    semanticFocus:
      "repair practices preserve knowledge of how objects fail and how users adapt them",
    sources: [
      {
        body: "壊れた製品を直すより、新しい物を買うほうが安いことがある。部品が手に入らず、修理に時間がかかるなら、買い替えは合理的な選択だ。そのため、修理をすすめる議論は、物を捨てないという環境面の利点だけで語られることが多い。もちろん、それは重要である。だが、修理にはもう一つの価値がある。\n町の修理会で、古い扇風機を直す様子を見たことがある。持ち主は「急に動かなくなった」と言ったが、担当者はいつ、どんな音がして、どの速さのとき止まるのかを細かく聞いた。分解すると、長年の振動で線が少しずつ外れていた。持ち主が毎年、向きを変える部分に油をさしていたことも分かり、その手入れが別の故障を防いでいた。\n修理の過程では、製品を作った会社の設計だけでなく、使う人がどんな環境で、どんな工夫をしながら使ってきたかが見える。どこが弱いか、説明書にない手入れがどう役立つかという知識は、完成した製品を眺めるだけでは得られない。修理する人が記録を共有すれば、次の設計を改善したり、同じ物を使う人に注意を伝えたりもできる。\nすべての物を無理に直す必要はない。しかし、修理できない構造にし、壊れたら丸ごと交換することだけを前提にすると、物だけでなく、故障から学ぶ機会も捨てることになる。修理を残すことは、古い物への愛情だけではない。物と人の関係から生まれた知識を、次に渡せる形にすることなのである。",
      },
    ],
    question: "筆者が、環境面以外の修理の価値として述べていることは何か。",
    options: [
      "どんな製品でも新品より安く直せること",
      "会社の説明書を読まなくてもよくなること",
      "故障や使い方から得た知識を今後に生かせること",
      "利用者の手入れがすべての故障を防ぐこと",
    ],
    correctIndex: 2,
    evidence: [
      "どこが弱いか、説明書にない手入れがどう役立つかという知識",
      "故障から学ぶ機会",
      "知識を、次に渡せる形",
    ],
    explanation:
      "Beyond waste reduction, repair reveals design weaknesses and user adaptations that can inform future design and maintenance. The author does not claim universal repairability or prevention.",
  },
  {
    semanticId: "N2-thematic-classroom-silence",
    level: "N2",
    family: "reading-thematic",
    semanticFocus:
      "brief classroom silence redistributes participation by allowing thought before speech",
    sources: [
      {
        body: "授業で質問をしたあと、先生はどのくらい答えを待つだろうか。多くの場合、数秒の沈黙に耐えられず、先生自身が説明を始めるか、すぐ手を挙げる学生を指す。授業を止めないためには効率的に見えるが、この速さは参加できる人を限っているかもしれない。\n私は以前、意見を聞く前に一分間、全員に短いメモを書いてもらう授業を見た。最初は静かな時間が長く感じられた。しかし、その後の話し合いでは、いつも発言する学生だけでなく、言葉を選ぶのに時間がかかる学生や、ほかの人の意見を聞いてから話し始める学生も手を挙げた。メモがあるため、途中で話を忘れる不安も減ったという。\nすぐ答えられることは、一つの能力である。ただし、早い答えが必ずよく考えられた答えとは限らない。質問を聞き、経験を思い出し、言葉にまとめるまでの時間は人によって違う。沈黙を「だれも分からない状態」と決めつけると、考えている途中の人の時間を奪ってしまう。\nもちろん、毎回長く待てばよいわけではない。確認だけの簡単な質問なら、すぐ答えるほうが自然だろう。重要なのは、深く考えてほしい問いに対して、そのための時間を授業の中に用意することだ。沈黙は活動がない空白ではなく、まだ声になっていない参加である。先生が少し待つことで、教室にある考えの幅が初めて見えることもある。",
      },
    ],
    question: "筆者は、授業中の沈黙をどのように捉えているか。",
    options: [
      "学生が質問を理解していない証拠だ",
      "授業を止めるため、すぐなくすべきだ",
      "簡単な質問にも必ず一分必要だ",
      "考えを言葉にする途中の参加として価値がある",
    ],
    correctIndex: 3,
    evidence: [
      "考えている途中の人の時間",
      "沈黙は活動がない空白ではなく、まだ声になっていない参加",
    ],
    explanation:
      "The author reframes purposeful wait time as participation before speech, especially for reflective questions. The claim is conditional, not a demand for fixed silence after every question.",
  },
] as const satisfies readonly UpperReadingSeed[];

const n2InformationSeeds = [
  {
    semanticId: "N2-info-training-center-certificates",
    level: "N2",
    family: "information-retrieval",
    semanticFocus:
      "employee selects an evening course with certificate and no prior experience",
    sources: [
      {
        label: "市民技能センター　秋の講座",
        body: "A 表計算の基礎：火曜18:30〜20:30、全4回。初めて使う人対象。欠席が1回以内で、最終課題を提出した人に修了証を発行。受講料8,000円。\nB データ整理実践：木曜19:00〜21:00、全5回。表計算ソフトで関数を使った経験が必要。修了証なし。受講料10,000円。\nC 接客日本語：土曜10:00〜12:00、全4回。現在接客の仕事をしている人対象。修了証は希望者に発行。受講料6,000円。\nD 仕事の文書：動画を好きな時間に視聴し、月2回の水曜20:00質問会に参加。経験不問。修了証は全動画の視聴と課題3点の提出が条件。受講料7,000円。\n【申込】9月5日まで。A・Bはセンターのパソコンを使用。Cは勤務先名の記入が必要。Dの質問会は任意だが録画はない。定員を超えた場合は、初めて受講する市民を優先し、その後抽選する。開講日の7日前までの取り消しは全額返金。それ以降は教材費2,000円を除いて返金する。",
      },
    ],
    question:
      "表計算の経験がなく、平日の夕方に通えて、会社へ出す修了証が必要な人はどれを選ぶべきか。",
    options: [
      "Aを選び、欠席を1回以内にして最終課題を出す",
      "Bを選び、全5回に出席する",
      "Cを選び、勤務先名を書かない",
      "Dを選び、質問会だけに参加する",
    ],
    correctIndex: 0,
    evidence: ["A 表計算の基礎", "初めて使う人対象", "修了証を発行"],
    explanation:
      "Course A uniquely matches beginner spreadsheet content, weekday evening attendance, and a stated certificate path. B requires experience; C is unrelated; D requires all videos and assignments, not only Q&A.",
  },
  {
    semanticId: "N2-info-community-room-cooking",
    level: "N2",
    family: "information-retrieval",
    semanticFocus:
      "resident group books cooking room for weekend paid workshop",
    sources: [
      {
        label: "青川市民館　部屋利用案内",
        body: "第1会議室（30人）：9:00〜21:00。飲食不可。1時間800円。\n第2会議室（12人）：9:00〜18:00。ふた付き飲料のみ可。1時間400円。\n調理室（20人）：火〜日曜9:00〜20:00。調理器具使用可。1時間1,200円。利用後30分は清掃時間として連続予約に含めること。\n和室（15人）：9:00〜17:00。軽食可、火気不可。1時間600円。\n【予約】市内の非営利団体は3か月前、市内の個人と市外団体は1か月前から。商品の販売や参加費を集める催しは、予約前に企画書の承認が必要。営利目的の場合、上記料金の2倍。\n【変更・取消】利用日の14日前までは無料。13日前から前日までは料金の半額、当日は全額。設備の故障で市民館が中止した場合は全額返金。ごみは持ち帰ること。調理室では食品衛生責任者の資格は不要だが、代表者が安全説明を受ける。",
      },
    ],
    question:
      "市内の料理サークルが日曜に15人の有料料理教室を開く。予約前に必要なことは何か。",
    options: [
      "第1会議室を予約し、飲食の許可を取る",
      "調理室について企画書の承認を受ける",
      "食品衛生責任者の資格を取る",
      "市外団体として一か月前まで待つ",
    ],
    correctIndex: 1,
    evidence: [
      "調理室（20人）",
      "参加費を集める催しは、予約前に企画書の承認が必要",
      "市内の非営利団体は3か月前",
    ],
    explanation:
      "A 15-person cooking class needs the cooking room; collecting a fee triggers prior proposal approval. The notice does not require a hygiene qualification, and a city group is not treated as an outside group.",
  },
  {
    semanticId: "N2-info-library-research-consultation",
    level: "N2",
    family: "information-retrieval",
    semanticFocus:
      "student selects remote research consultation after document submission",
    sources: [
      {
        label: "中央図書館　調べもの相談",
        body: "①受付相談：月〜土曜10:00〜17:00。予約不要、一人15分。資料の場所や検索機の使い方を案内します。\n②個別相談：火・木曜13:00〜19:00。前日17時までに予約。一人45分。研究テーマと調べた資料を予約時に送ってください。\n③オンライン相談：水・金曜18:00〜20:00。利用日の2日前までに予約。一人30分。市内在住・在勤・在学者のみ。質問内容と確認してほしい資料を事前に送付。\n④文献取り寄せ相談：平日10:00〜16:00。館内にない本や論文の取り寄せ方法を説明。取り寄せ料金は利用者負担。\n図書館員は資料の探し方を支援しますが、レポートの文章作成、法律・医療上の判断、答えそのものの保証はしません。予約変更は開始24時間前まで。無断欠席した場合、次回から一か月間②③を予約できません。送られた資料は相談後30日で削除します。",
      },
    ],
    question:
      "市内の大学に通う学生が、金曜夜に自宅から、すでに集めた資料の確認方法を30分相談したい。どうすればよいか。",
    options: [
      "金曜18時に予約なしで受付相談を使う",
      "水曜までにオンライン相談を予約し、質問と資料を送る",
      "前日の17時までに個別相談を予約する",
      "文献取り寄せ相談でレポートを書いてもらう",
    ],
    correctIndex: 1,
    evidence: [
      "オンライン相談：水・金曜18:00〜20:00",
      "利用日の2日前までに予約",
      "質問内容と確認してほしい資料を事前に送付",
    ],
    explanation:
      "Friday-evening remote consultation is option ③, requiring a reservation two days beforehand and advance submission. The other services are on-site, differently timed, or do not write reports.",
  },
  {
    semanticId: "N2-info-bicycle-share-visitor-day",
    level: "N2",
    family: "information-retrieval",
    semanticFocus:
      "visitor chooses day pass and returns bicycle to staffed hub after dock failure",
    sources: [
      {
        label: "まち自転車　利用プラン",
        body: "月会員：月額1,500円。毎回最初の30分無料、以後30分ごと150円。市内在住・在勤者のみ。\n一日券：800円。購入日の23:59まで利用可。1回60分を超えると30分ごと150円。旅行者も購入可。\n三時間券：500円。最初に借りてから3時間以内なら何度でも利用可。ただし一回の利用は60分まで。\n【返却】空きのある専用ポートへ返却し、ランプが緑になったことを確認してください。満車の場合はアプリで15分間の返却延長が一度だけできます。機械の故障で返却できない場合は、自転車を放置せず、駅前・市役所前の有人拠点へ営業時間内に持参してください。連絡だけでは返却完了になりません。\n【利用時間】一般ポート5:00〜24:00。有人拠点9:00〜19:00。身長145cm未満は利用不可。鍵の紛失や禁止区域への放置には別料金がかかります。",
      },
    ],
    question:
      "旅行者が朝から夕方まで何度も利用したい。18時に故障で返却できず、市役所前に近い。最も適切なのは何か。",
    options: [
      "月会員になり、故障した自転車をその場に置く",
      "一日券を買い、18時に市役所前の有人拠点へ持っていく",
      "三時間券を買い、電話だけで返却を終える",
      "一日券を買い、翌朝まで自転車を持っておく",
    ],
    correctIndex: 1,
    evidence: [
      "旅行者も購入可",
      "購入日の23:59まで",
      "市役所前の有人拠点",
      "営業時間内に持参",
    ],
    explanation:
      "A day pass fits all-day visitor use, and the staffed city-hall hub is open at 18:00 for equipment-failure returns. Leaving it or merely calling does not complete return.",
  },
  {
    semanticId: "N2-info-cultural-workshop-ceramics",
    level: "N2",
    family: "information-retrieval",
    semanticFocus:
      "parent and child select a weekend ceramics workshop with kiln firing",
    sources: [
      {
        label: "海辺文化館　ものづくり講座",
        body: "A 草木染め：10月12日（土）10:00〜12:30。中学生以上。材料費1,800円。綿の袋を一つ染めて当日持ち帰ります。\nB 親子の木工：10月13日（日）9:30〜12:00。小学1〜4年生と保護者、12組。二人で一つの棚を作ります。材料費2,500円。\nC はじめての陶芸：10月19日（土）13:00〜16:00。小学5年生以上。茶わんを二つ制作。作品は館で焼き、11月2日以降に窓口で受け取ります。材料・焼成費3,000円。小学生は保護者も制作に参加すること。\nD 金属のしおり：10月20日（日）14:00〜16:00。高校生以上。材料費1,200円。\n【申込】一人一講座まで。9月20日必着でウェブまたは往復はがき。応募多数の場合は抽選し、9月25日に結果を通知します。参加者の変更はできません。欠席の場合、開催日の5日前までに連絡すれば材料費を返金します。それ以降は、希望者に未使用の材料を渡します。Cの作品は郵送できません。館には駐車場がないため、公共交通機関をご利用ください。",
      },
    ],
    question:
      "小学6年生の子どもと保護者が土曜日に一緒に陶器を作り、後日取りに来られる。どの講座が条件に合うか。",
    options: [
      "Aに二人で申し込み、袋を後日受け取る",
      "Bに申し込み、茶わんを二つ作る",
      "Cに申し込み、11月2日以降に作品を受け取る",
      "Dに申し込み、保護者だけが制作する",
    ],
    correctIndex: 2,
    evidence: [
      "C はじめての陶芸",
      "小学5年生以上",
      "小学生は保護者も制作に参加",
      "11月2日以降に窓口で受け取り",
    ],
    explanation:
      "Workshop C is the only Saturday ceramics option open to a sixth grader; it requires the accompanying adult to participate and the fired work must be collected later. The other workshops differ in craft, age, or day.",
  },
  {
    semanticId: "N2-info-employee-health-check-afternoon",
    level: "N2",
    family: "information-retrieval",
    semanticFocus:
      "night-shift employee books an afternoon examination requiring fasting bloodwork",
    sources: [
      {
        label: "社員健康診断　予約案内",
        body: "基本健診：身長・体重・視力・聴力・血圧・胸部撮影・尿検査。全社員が対象。\n血液検査付き健診：基本健診に血液検査を追加。35歳以上、または会社から指定された社員が対象。検査前10時間は水以外を取らないこと。\n女性健診：基本健診と女性向け検査。希望する女性社員が対象。実施日は11月8日と22日のみ。\n【会場と時間】本社会場は11月5〜22日の平日、8:30〜11:30。南診療所は火・木曜の14:00〜16:30。夜勤者は南診療所を優先して予約できます。胸部撮影車は15:30に終了するため、基本健診を含む人は15:00までに受付を済ませてください。\n【予約・変更】社内サイトで希望日の7日前までに予約。満員の場合は別日を選択。変更は前日正午まで。体調不良や服薬中の場合は自己判断で薬を止めず、予約時に申告してください。尿検査の容器は受診日の3日前から各部署で受け取れます。結果は約3週間後に本人へ通知します。",
      },
    ],
    question:
      "38歳の夜勤社員が血液検査を含む健診を木曜の午後に受けたい。最も適切なのはどれか。",
    options: [
      "南診療所を希望日の7日前までに予約し、15時までに受付を済ませ、検査前10時間は水以外を取らない",
      "本社会場を16時に予約し、朝食を必ず取る",
      "女性健診だけを南診療所で予約する",
      "薬を飲んでいる場合は自分で中止して受診する",
    ],
    correctIndex: 0,
    evidence: [
      "南診療所は火・木曜の14:00〜16:30",
      "35歳以上",
      "検査前10時間は水以外を取らない",
      "15:00までに受付",
    ],
    explanation:
      "The employee qualifies for bloodwork by age and can use the Thursday-afternoon clinic, with arrival by 15:00 because the exam includes chest imaging. Fasting permits water, and medication must not be stopped without advice.",
  },
  {
    semanticId: "N2-info-bulky-waste-moving-day",
    level: "N2",
    family: "information-retrieval",
    semanticFocus:
      "resident arranges collection of reusable and nonreusable bulky items before moving",
    sources: [
      {
        label: "緑山市　大型ごみ・再使用品の案内",
        body: "【戸別収集】一辺が50cmを超える家具・寝具・自転車が対象。電話またはウェブで品目と大きさを申し込み、案内された料金の処理券を購入してください。収集日の朝8時までに、処理券を貼って建物の入口へ出します。室内からの運び出しは行いません。通常は申込から収集まで10日前後かかります。\n【持ち込み】清掃工場へ月〜金曜9:00〜16:00に本人が持参。住所を確認できる物が必要。予約は前日の15時まで。料金は重さで計算します。\n【再使用受付】まだ使える木製家具は、写真審査の後、無料で引き取る場合があります。申込から審査結果まで3営業日。汚れや破損が大きい物、寝具、家電は対象外です。\nテレビ、冷蔵庫、洗濯機、エアコンは市では収集しません。購入店または指定業者へ依頼してください。引っ越し当日の大量申込には対応できません。集合住宅では、管理者に搬出場所を確認してから申し込んでください。収集後の返却はできません。",
      },
    ],
    question:
      "集合住宅の住民が、引っ越しまで2週間あり、まだ使える木の机を費用をかけずに処分したい。まず何をするべきか。",
    options: [
      "机を朝8時までに処理券なしで入口へ出す",
      "管理者に搬出場所を確認してから、写真を送って再使用受付の審査を申し込む",
      "清掃工場へ予約せず日曜日に持ち込む",
      "家電の指定業者に机の収集を頼む",
    ],
    correctIndex: 1,
    evidence: [
      "まだ使える木製家具",
      "写真審査の後、無料で引き取る場合",
      "審査結果まで3営業日",
      "集合住宅では、管理者に搬出場所を確認してから申し込んでください",
    ],
    explanation:
      "An apartment resident must first confirm the carry-out location with the building manager. A usable wooden desk is then eligible for the free photo screening, and the two-week window allows the three-business-day review. Ordinary collection needs a fee; the plant requires a weekday reservation; appliance rules do not apply.",
  },
  {
    semanticId: "N2-info-small-business-seminar-plan",
    level: "N2",
    family: "information-retrieval",
    semanticFocus:
      "new shop owner chooses a two-part cash-flow seminar with consultation eligibility",
    sources: [
      {
        label: "商工支援室　小規模事業者向け講座",
        body: "①開業計画入門：9月7日（土）10:00〜12:00。開業前または開業1年未満の人。定員30人。\n②資金繰り基礎：9月11日・18日（水）18:30〜20:30、全2回。事業の収入と支出を整理したい人。両日参加者は後日の無料個別相談に申し込めます。\n③写真で伝える商品：9月14日（土）13:00〜16:00。スマートフォン持参。小売・飲食業を優先。\n④雇用の手続き：9月20日（金）14:00〜16:00。初めて従業員を雇う予定の事業者。\n受講料は各講座1,000円。ただし②は2回で1,500円。申込は各初回の5日前まで。定員超過時は市内事業者を優先し、その後抽選。欠席回への資料送付は行いますが、②を一度でも欠席すると個別相談には申し込めません。個別相談は講座終了後30日以内、一事業者50分です。講師は計画作成を助言しますが、融資の決定や税務申告の代行はしません。",
      },
    ],
    question:
      "開業6か月の店主が、収支を整理し、講座後に無料相談も受けたい。どうすればよいか。",
    options: [
      "①だけに参加し、融資の決定を依頼する",
      "②の一回目だけに参加し、資料で二回目を補う",
      "②の両日に参加し、終了後30日以内に相談を申し込む",
      "④に参加し、税務申告を代行してもらう",
    ],
    correctIndex: 2,
    evidence: [
      "②資金繰り基礎",
      "両日参加者は後日の無料個別相談",
      "終了後30日以内",
    ],
    explanation:
      "Course ② matches cash-flow organization, and attendance at both sessions is an explicit condition for the free consultation, which must be requested within 30 days. Advisers neither approve loans nor file taxes.",
  },
] as const satisfies readonly UpperReadingSeed[];

const n1ShortSeeds = [
  {
    semanticId: "N1-short-metric-behavior-shift",
    level: "N1",
    family: "reading-short",
    semanticFocus:
      "performance measures alter the activity they purport to observe",
    sources: [
      {
        body: "数値は活動の一面を切り取って比較可能にする。しかし、評価される側がその数値を目標として意識し始めると、活動そのものが数値に合わせて組み替えられる。窓口の待ち時間を短くする指標を導入した結果、複雑な相談を別日に回すようになれば、数字は改善しても利用者の問題は解決していない。指標は現実を映す鏡であると同時に、現実を変える力でもあるのだ。",
      },
    ],
    question: "筆者が指標について注意を促している点は何か。",
    options: [
      "数値化すると活動のあらゆる側面を比較できること",
      "指標を目標にすると、測られる活動自体が変質し得ること",
      "複雑な相談には待ち時間の指標が適用できないこと",
      "利用者は数値より職員の態度を重視していること",
    ],
    correctIndex: 1,
    evidence: [
      "活動そのものが数値に合わせて組み替えられる",
      "指標は現実を映す鏡であると同時に、現実を変える力でもある",
    ],
    explanation:
      "The author warns that once a measure becomes a target, people reorganize the measured activity around it. The example illustrates apparent numerical improvement without genuine problem resolution; the other options either overstate measurement or add claims absent from the passage.",
  },
  {
    semanticId: "N1-short-meeting-silence-signal",
    level: "N1",
    family: "reading-short",
    semanticFocus:
      "silence in meetings can indicate unarticulated disagreement rather than consent",
    sources: [
      {
        body: "会議で反対意見が出なかったからといって、合意が得られたとは限らない。発言の機会が一部の人に偏っていたり、異論を述べることで不利益を受けると参加者が感じていたりすれば、沈黙は賛成ではなく警戒の表れとなる。司会者に必要なのは、沈黙を都合よく解釈することではなく、意見を出しても安全だと思える条件が整っているかを確かめることだ。",
      },
    ],
    question: "筆者によれば、司会者は沈黙をどのように扱うべきか。",
    options: [
      "反対がない以上、合意として速やかに記録する",
      "発言者を限定して議論の混乱を防ぐ",
      "参加者が安心して異論を示せる状況か検討する",
      "沈黙した参加者に賛否を公表させる",
    ],
    correctIndex: 2,
    evidence: [
      "沈黙は賛成ではなく警戒の表れとなる",
      "意見を出しても安全だと思える条件が整っているかを確かめる",
    ],
    explanation:
      "Silence may reflect perceived risk, not agreement. The author therefore asks facilitators to examine whether conditions make dissent safe, rather than presuming consent or forcing individuals to declare a position.",
  },
  {
    semanticId: "N1-short-convenience-hidden-labor",
    level: "N1",
    family: "reading-short",
    semanticFocus:
      "consumer convenience often redistributes rather than eliminates effort",
    sources: [
      {
        body: "便利なサービスは、手間を消してくれるように見える。だが実際には、その手間が別の場所へ移されていることが少なくない。翌朝届く商品は、夜間に仕分ける人や細かな時間指定に応じる配達員の働きによって成り立つ。利用者の画面から過程が見えなくなったことと、過程そのものが不要になったことは同じではない。便利さを論じるなら、誰の時間が節約され、誰の負担が増えたかまで問う必要がある。",
      },
    ],
    question: "この文章で筆者が最も言いたいことは何か。",
    options: [
      "配送の自動化によって夜間労働をなくすべきだ",
      "利用者は時間指定のサービスを使うべきではない",
      "便利さは負担の消滅ではなく移転による場合がある",
      "画面上で作業過程をすべて公開すべきだ",
    ],
    correctIndex: 2,
    evidence: [
      "手間が別の場所へ移されていることが少なくない",
      "誰の時間が節約され、誰の負担が増えたかまで問う必要がある",
    ],
    explanation:
      "The central contrast is between effort disappearing from the user's view and effort actually ceasing to exist. Convenience can shift labor to other people; the passage does not demand abolition of a specific service or total process disclosure.",
  },
  {
    semanticId: "N1-short-archive-selection-meaning",
    level: "N1",
    family: "reading-short",
    semanticFocus:
      "archives shape future memory through selection as well as preservation",
    sources: [
      {
        body: "資料館の役割は、過去の記録をただ保存することだと思われがちだ。しかし、保管場所にも整理する人員にも限りがある以上、何を残すかという選択は避けられない。そして、残されなかったものは、後の世代にとって存在しなかったも同然になりかねない。したがって資料館は、過去を受動的に受け取る倉庫ではなく、未来から見える過去の輪郭を形づくる機関でもある。",
      },
    ],
    question: "筆者は資料館をどのような存在だと捉えているか。",
    options: [
      "過去の資料を価値判断なしに保管する施設",
      "失われた資料を復元して過去を完全に再現する機関",
      "現在の選択を通じて将来の過去像にも影響する機関",
      "保管場所の不足を一般市民に知らせる施設",
    ],
    correctIndex: 2,
    evidence: [
      "何を残すかという選択は避けられない",
      "未来から見える過去の輪郭を形づくる機関でもある",
    ],
    explanation:
      "Because an archive must select what to preserve, it actively influences what future generations can know about the past. The author explicitly rejects the image of a neutral warehouse and does not claim complete reconstruction is possible.",
  },
  {
    semanticId: "N1-short-forecast-action-threshold",
    level: "N1",
    family: "reading-short",
    semanticFocus:
      "a forecast's practical value depends on linking uncertainty to action",
    sources: [
      {
        body: "予測の精度を上げることは重要だが、数値が示されただけでは意思決定に結びつかない。降水確率が四十パーセントのとき、野外行事を中止するのか、雨具を用意して続けるのかは、損失の大きさや代替手段の有無によって変わる。必要なのは不確実性をなくすことではなく、どの程度の不確実性なら何をするかを、あらかじめ関係者で共有しておくことである。",
      },
    ],
    question:
      "予測を意思決定に役立てるために必要だと筆者が述べていることは何か。",
    options: [
      "予測が外れた場合の責任者を決めること",
      "不確実性がなくなるまで判断を延期すること",
      "常に最も損失の小さい選択肢を取ること",
      "不確実性の程度と対応方針を事前に結びつけること",
    ],
    correctIndex: 3,
    evidence: [
      "どの程度の不確実性なら何をするかを、あらかじめ関係者で共有しておく",
    ],
    explanation:
      "The passage argues for predetermined action thresholds tied to degrees of uncertainty. It explicitly says uncertainty need not be eliminated, and it does not assign blame or prescribe a single universally lowest-loss choice.",
  },
  {
    semanticId: "N1-short-standard-exception-learning",
    level: "N1",
    family: "reading-short",
    semanticFocus:
      "exceptions reveal where a standard's underlying assumptions fail",
    sources: [
      {
        body: "手順を標準化すれば、経験の浅い人でも一定の質で仕事を進めやすい。一方、標準から外れた事例を単なる現場のミスとして処理していると、手順が前提としていた条件の限界を見落とす。例外は標準化の敵ではない。なぜ既存の手順で扱えなかったのかを検討することで、適用範囲を明確にし、標準そのものを改善する材料になる。",
      },
    ],
    question: "例外について、筆者の考えに合うものはどれか。",
    options: [
      "標準化の効果を下げるため、できるだけ記録しない",
      "現場のミスとして処理すれば手順の質を保てる",
      "手順の前提や適用範囲を見直す手掛かりになる",
      "経験者だけが個別に対処し、標準とは分けて考える",
    ],
    correctIndex: 2,
    evidence: [
      "例外は標準化の敵ではない",
      "適用範囲を明確にし、標準そのものを改善する材料になる",
    ],
    explanation:
      "Exceptions expose the limits of a procedure's assumptions and can improve the standard. The author specifically rejects dismissing them as mere operator error or treating them as an enemy of standardization.",
  },
  {
    semanticId: "N1-short-public-feedback-selection-bias",
    level: "N1",
    family: "reading-short",
    semanticFocus:
      "voluntary public feedback overrepresents people motivated to respond",
    sources: [
      {
        body: "自由記述の意見募集には、数字だけでは分からない経験が集まるという利点がある。ただし、寄せられた意見の数をそのまま住民全体の賛否とみなすことはできない。強い不満や関心を持つ人ほど回答する可能性が高く、知らせに気づかなかった人や書く時間のない人の考えは表れにくいからだ。内容を丁寧に読むことと、回答者の偏りを認識することは両立させなければならない。",
      },
    ],
    question: "意見募集の結果を扱う際、筆者が必要だとする姿勢はどれか。",
    options: [
      "回答数を住民全体の賛否として集計する",
      "強い関心を持つ回答者の意見だけを採用する",
      "自由記述をやめ、数値式の調査だけを行う",
      "内容を尊重しつつ、回答者の偏りも考慮する",
    ],
    correctIndex: 3,
    evidence: [
      "寄せられた意見の数をそのまま住民全体の賛否とみなすことはできない",
      "内容を丁寧に読むことと、回答者の偏りを認識することは両立させなければならない",
    ],
    explanation:
      "The author values qualitative comments while warning that voluntary respondents are not necessarily representative. The required stance is to read the content seriously and simultaneously account for selection bias.",
  },
  {
    semanticId: "N1-short-expertise-participation-role",
    level: "N1",
    family: "reading-short",
    semanticFocus:
      "public participation complements technical expertise by exposing lived consequences",
    sources: [
      {
        body: "専門的な計画に市民が口を出すと、合理的な判断が妨げられるという見方がある。もちろん、構造計算の正しさを多数決で決めることはできない。しかし、その施設が日常の動線をどう変えるか、利用しにくい時間帯はいつかといった影響は、生活者だからこそ気づける。参加の意義は専門知識を置き換えることではなく、専門家が答えるべき問いを広げることにある。",
      },
    ],
    question: "市民参加の意義について、筆者はどのように考えているか。",
    options: [
      "専門的な判断を多数決に置き換えることにある",
      "生活上の影響を示し、検討すべき問いを増やすことにある",
      "専門家が作った計画を分かりやすく説明することにある",
      "合理性より利用者の希望を優先することにある",
    ],
    correctIndex: 1,
    evidence: [
      "生活者だからこそ気づける",
      "専門家が答えるべき問いを広げることにある",
    ],
    explanation:
      "Public participation does not replace technical judgment; it contributes lived knowledge that expands the set of questions experts need to address. The other answers confuse complementing expertise with overruling it.",
  },
] as const satisfies readonly UpperReadingSeed[];

const n1IntegratedSeeds = [
  {
    semanticId: "N1-integrated-ai-minutes-correctability",
    level: "N1",
    family: "reading-integrated",
    semanticFocus:
      "automated meeting summaries are useful only when their authority remains contestable",
    sources: [
      {
        label: "文章A",
        body: "会議の自動要約は、出席できなかった人が論点を素早く把握し、過去の決定を検索するのに役立つ。問題は、短い文章ほど確定した記録として読まれやすいことだ。実際の議論では条件付きだった提案が、要約では単純な決定に見えることもある。だから、要約の各項目から該当する発言箇所を確認できるようにし、参加者が一定期間内に修正を求められる設計が必要だ。効率化の価値は、記録の根拠をたどれなくしてまで得るものではない。とりわけ採用や予算に関わる決定では、要約だけを正式記録として保存せず、参照元と修正履歴を一体で管理する必要がある。",
      },
      {
        label: "文章B",
        body: "自動要約を導入すると、記録担当者の負担は減るが、「機械がまとめるから誰かが直すだろう」という期待も生じる。全員が確認者である状態は、しばしば誰も確認しない状態に等しい。そこで、会議ごとに確認責任者と修正期限を定め、異論が残った箇所は無理に一つの結論にせず併記するべきだ。自動化をやめる必要はないが、作成主体が機械になっても、記録を確定する責任まで消えるわけではない。確認作業を新たな無償労働として曖昧に押し付けないためにも、それを会議工程の一部として時間配分に含めるべきだ。確認済みであることも記録上で明示したい。",
      },
    ],
    question: "自動要約の利用について、文章Aと文章Bに共通する考えはどれか。",
    options: [
      "要約の誤りを避けるため、会議の記録は人だけが作るべきだ",
      "要約を便利に使いつつ、内容を訂正・確定する仕組みを残すべきだ",
      "参加者全員が同じ責任で要約を確認すべきだ",
      "異論がある議論は要約の対象から外すべきだ",
    ],
    correctIndex: 1,
    evidence: [
      "参加者が一定期間内に修正を求められる設計が必要だ",
      "会議ごとに確認責任者と修正期限を定め",
    ],
    explanation:
      "Both writers accept the efficiency benefit but insist that summaries remain correctable and responsibly finalized. A emphasizes links to source speech and correction access; B emphasizes a named reviewer and deadline. Neither calls for abandoning automation.",
  },
  {
    semanticId: "N1-integrated-historic-building-continuity",
    level: "N1",
    family: "reading-integrated",
    semanticFocus:
      "historic continuity can reside in material traces or in adaptive public use",
    sources: [
      {
        label: "文章A",
        body: "歴史的建築の外壁には、当時の職人が選んだ材料だけでなく、修理や増築の跡も残る。それらを表面だけ似せた新材に替えれば、町並みの印象は保てても、建物が経てきた時間は失われる。安全上の補強は必要だが、古い部材を一律に欠陥とみなさず、使える部分を残しながら介入の記録を公開するべきだ。保存とは、完成当初の姿に戻すことではなく、変化の層を読み取れる状態に保つことだ。新材を使わざるを得ない箇所も、古く見せて境界を隠すのではなく、将来の調査者が交換時期を識別できる方法で施工したい。",
      },
      {
        label: "文章B",
        body: "建築を保存する議論では、材料をどこまで残すかが重視される。しかし、内部を固定して現代の用途に合わなくなれば、人が訪れず、維持費も得られない。地域の集会所や店舗として使い続けるには、動線や設備を大きく変える場合もあるだろう。何も変えないことで空き家になるより、改修の経緯を説明しながら新しい活動を受け入れる方が、建物と町との関係は継続する。使われることも保存の一部なのである。ただし、収益性だけで用途を選べば地域の記憶から離れかねないため、改修後の活動が住民に開かれているかを定期的に見直す必要がある。その判断にも地域の利用者が参加するべきだ。",
      },
    ],
    question:
      "歴史的建築の保存について、文章Aと文章Bがそれぞれ重視しているものは何か。",
    options: [
      "Aは完成当初の外観、Bは観光客の増加",
      "Aは古い材料に残る変化の跡、Bは建物と地域の利用関係",
      "Aは補強費用の削減、Bは改修前の内部構造",
      "Aは職人の技術継承、Bは町並み全体の統一",
    ],
    correctIndex: 1,
    evidence: [
      "変化の層を読み取れる状態に保つ",
      "使われることも保存の一部なのである",
    ],
    explanation:
      "A locates continuity in the surviving material layers and legible interventions. B locates it in continued social use and the building's relationship with the town. The other pairings introduce aims not central to the texts.",
  },
  {
    semanticId: "N1-integrated-universal-design-revision",
    level: "N1",
    family: "reading-integrated",
    semanticFocus:
      "inclusive design begins broadly but must be tested and revised with diverse users",
    sources: [
      {
        label: "文章A",
        body: "公共サービスを設計した後で、特定の利用者だけに例外的な対応を追加すると、その人は毎回支援を申し出なければならない。初めから文字の大きさ、操作方法、利用時間に複数の選択肢を用意すれば、多くの人が特別扱いを求めずに利用できる。全員に一つの方法を強いる「同じ扱い」と、異なる人が同じ目的を達成できる「公平な利用」は区別すべきだ。設計の初期段階で利用の幅を見込むことが重要である。それによって個別支援が不要になるとは限らないが、支援を求めること自体に伴う説明や待機の負担を大きく減らすことはできる。",
      },
      {
        label: "文章B",
        body: "「誰にでも使える設計」という言葉は魅力的だが、完成した普遍的な解決策があるかのように受け取ると危険だ。聴覚、視覚、身体の動かし方だけでなく、機器への慣れや利用する場面も異なる。設計者が想定した選択肢が、別の人には障壁になることさえある。したがって多様な当事者と試し、使えなかった理由を設計へ戻す過程が欠かせない。普遍性は最初に宣言する性質ではなく、利用者との反復によって近づく方向なのである。試験に参加した人の範囲も公開し、まだ検証できていない利用場面を示せば、「誰でも」という表現が過度な保証になるのを防げる。",
      },
    ],
    question: "文章Aと文章Bの内容から、包摂的な設計について言えることは何か。",
    options: [
      "完成後に個別対応を加える方が、初期段階で選択肢を作るより公平だ",
      "一度多様な選択肢を用意すれば、利用者による検証は不要になる",
      "初めから利用の幅を考え、実際の多様な利用者との検証で更新する必要がある",
      "全員に同じ操作方法を求めることが、特別扱いを避ける唯一の方法だ",
    ],
    correctIndex: 2,
    evidence: [
      "設計の初期段階で利用の幅を見込むことが重要である",
      "多様な当事者と試し、使えなかった理由を設計へ戻す過程が欠かせない",
    ],
    explanation:
      "A argues for anticipating varied access from the outset, while B warns that no initial design is universally complete and calls for iterative testing. Combined, they support broad initial design followed by revision with diverse users.",
  },
  {
    semanticId: "N1-integrated-preprint-status-context",
    level: "N1",
    family: "reading-integrated",
    semanticFocus:
      "rapid preprint circulation requires conspicuous communication of provisional status",
    sources: [
      {
        label: "文章A",
        body: "査読前の論文を公開する仕組みは、結果を早く共有し、他の研究者から広く指摘を受ける機会を作る。特に変化の速い分野では、正式掲載まで情報を閉じておく損失は大きい。ただし公開版は結論ではなく、検討の途中にある提案だ。修正版との違いや寄せられた批判を同じページから確認できるようにすれば、速さを保ちながら、知識が更新される過程も読者に示せる。否定的な結果や再解析による変更も旧版と結びつけて残せば、最初の結論だけが引用され続ける危険を小さくできるだろう。",
      },
      {
        label: "文章B",
        body: "査読前論文の問題は、公開されること自体より、それがニュースや交流サイトで確定した発見として流通することにある。元のページに注意書きがあっても、切り取られた図だけを見た人には届かない。報道する側は査読の有無を見出しに近い場所で明示し、研究者も断定的な広報を控えるべきだ。公開を禁止すれば誤解は減るかもしれないが、検証への参加も遅れる。必要なのは、情報が移動しても暫定性が失われにくい表示である。画像や要約を共有した際にも査読状況が付随する仕組みなら、注意書きを読む責任を個々の読者だけに負わせずに済む。訂正が出たとき、以前共有された情報の受け手にも変更を通知できれば、誤った結論だけが残るのを抑えられる。",
      },
    ],
    question: "査読前論文について、文章Aと文章Bに共通している考えはどれか。",
    options: [
      "誤解を防ぐには正式掲載まで公開しない方がよい",
      "研究者間では暫定性を示す必要はない",
      "迅速な公開には価値があるが、未確定であることが伝わる工夫が必要だ",
      "修正版は最初の公開版と同じページに載せるべきではない",
    ],
    correctIndex: 2,
    evidence: [
      "速さを保ちながら、知識が更新される過程も読者に示せる",
      "情報が移動しても暫定性が失われにくい表示",
    ],
    explanation:
      "Both accept rapid dissemination and reject prohibition as the primary solution. A focuses on version and criticism history; B focuses on status labels that survive redistribution. Their shared point is speed paired with durable provisional context.",
  },
  {
    semanticId: "N1-integrated-anonymous-survey-followup",
    level: "N1",
    family: "reading-integrated",
    semanticFocus:
      "anonymous workplace surveys reveal patterns but need protected follow-up channels for interpretation",
    sources: [
      {
        label: "文章A",
        body: "職場調査を匿名にすると、上司への不満や制度の使いにくさについて率直な回答を得やすい。個人を特定しないと約束する以上、少人数の部署別結果を公表しないなど、推測による特定も防ぐ必要がある。一方、匿名回答だけで原因まで断定するのは危険だ。「相談しにくい」という回答が、窓口の時間を指すのか、相談後の扱いへの不信を指すのかは分からない。調査は問題の所在を知らせる信号として使うべきだ。また、自由記述をそのまま引用する場合も、固有の出来事から書き手が特定されないよう、本人の同意と文脈の保護を優先しなければならない。",
      },
      {
        label: "文章B",
        body: "匿名調査の後、管理職が平均点だけを示して対策を決めると、回答者は自分の意見が都合よく解釈されたと感じることがある。だから、調査で見えた論点ごとに、参加者が身元を明かさず補足できる会や外部相談員との面談を用意したい。ただし、補足に来た人を全回答者の代表とみなしてはいけない。匿名性を守ったまま仮説を確かめ、実施した変更を再調査で評価するという循環が重要だ。平均値が改善しても、特定の立場だけが悪化していないかを確認するため、回答者を特定しない範囲で分布の変化も見るべきである。改善策の評価にも匿名性への当初の約束は引き継がれる。",
      },
    ],
    question:
      "匿名の職場調査の扱いについて、両方の文章から導ける考えはどれか。",
    options: [
      "匿名回答だけで問題の原因と対策を確定するべきだ",
      "率直な回答を得るため、部署別の結果を必ず公表するべきだ",
      "匿名性を守りながら追加の情報を集め、解釈を検証するべきだ",
      "補足説明をした人を回答者全体の代表として扱うべきだ",
    ],
    correctIndex: 2,
    evidence: [
      "調査は問題の所在を知らせる信号として使うべきだ",
      "匿名性を守ったまま仮説を確かめ",
    ],
    explanation:
      "Both texts treat anonymous results as signals rather than complete causal explanations. They call for confidentiality-preserving follow-up to test interpretations, while warning against identification risks and unrepresentative follow-up participants.",
  },
  {
    semanticId: "N1-integrated-museum-restitution-relationship",
    level: "N1",
    family: "reading-integrated",
    semanticFocus:
      "restitution decisions concern authority and ongoing relationships, not location alone",
    sources: [
      {
        label: "文章A",
        body: "植民地期に持ち出された資料の返還を求める声に対し、「現在の博物館の方が安全に保存できる」という反論がある。しかし保存能力だけを基準にすれば、誰が資料の意味を語り、展示や儀礼への使用を決める権利を持つかという問題が消えてしまう。返還は物の移動である以上に、所有と解釈の権限を見直す行為である。保存上の協力が必要なら、返さない条件にするのではなく、返還後の支援として交渉すべきだ。その支援も、返還する側が管理権を保持する口実にならないよう、受け取る側が必要な内容と終了時期を決められる形で行う必要がある。",
      },
      {
        label: "文章B",
        body: "資料を元の地域へ返せば、過去の不正が直ちに解決するわけではない。返還先にも、国の機関、地域の博物館、特定の共同体など複数の候補があり、内部で意見が一致しているとは限らない。また、研究記録やデジタル画像を誰が管理するかも残る。だから返還を一度きりの引き渡しとして終えず、関係者が利用条件や説明文を継続して協議する枠組みを作る必要がある。物の所在を変えることは出発点であって、関係の完成ではない。協議の参加者や合意の方法自体も固定せず、世代交代や新たな研究によって異なる要求が現れたときに見直せるようにしたい。",
      },
    ],
    question: "資料の返還について、文章Aと文章Bがともに示していることは何か。",
    options: [
      "最も保存技術の高い施設が資料を所有するべきだ",
      "資料を元の国へ移せば、返還に関する問題はすべて解決する",
      "返還先の内部で意見が分かれる場合は、返還を中止するべきだ",
      "物を移すだけでなく、権限や返還後の関係について協議する必要がある",
    ],
    correctIndex: 3,
    evidence: [
      "所有と解釈の権限を見直す行為である",
      "関係者が利用条件や説明文を継続して協議する枠組みを作る必要がある",
    ],
    explanation:
      "A frames restitution as reconsidering ownership and interpretive authority; B stresses continued negotiation after physical transfer. Both reject reducing the issue to storage location or a one-time handover.",
  },
  {
    semanticId: "N1-integrated-carbon-label-decision-context",
    level: "N1",
    family: "reading-integrated",
    semanticFocus:
      "carbon labels enable comparison but cannot by themselves determine sustainable choice",
    sources: [
      {
        label: "文章A",
        body: "商品の温室効果ガス排出量を表示すれば、価格や栄養と同じように環境負荷を比較できる。これまで見えなかった生産・輸送過程を共通の単位で示す意義は大きい。ただし算定範囲が企業ごとに違えば数字は比較できないため、原料調達から廃棄まで、どこを含むかを統一しなければならない。完全な精度を待つより、前提と誤差を公開しながら基準を更新する方が実用的だ。数値の改訂履歴を残せば、ある商品の表示が変わった理由を、実際の改善と算定方法の変更とに分けて理解することもできる。",
      },
      {
        label: "文章B",
        body: "炭素表示の小さい商品を選べば、それだけで持続可能な消費になるとは限らない。長く使える製品を一度買うのと、数値は小さいが短期間で交換する製品を何度も買うのとでは、利用期間全体の負荷が逆転することもある。また、表示を読む余裕のない人に選択の責任を負わせるだけでは、供給側の改善は進まない。数値は判断材料になるが、耐久性の情報や企業への規制と組み合わせる必要がある。さらに、修理のしやすさや共有利用の可能性など、購入時の一単位だけでは表せない行動も選択肢として見えるようにしたい。表示が個人の道徳性を採点する道具になれば、選べる商品の少ない人ほど責任を負わされる。比較の目的は、責任を消費者へ移すことではない。",
      },
    ],
    question: "炭素表示について、二つの文章の内容と合うものはどれか。",
    options: [
      "算定方法を統一すれば、表示の最小の商品が常に最善の選択になる",
      "誤差が完全になくなるまで炭素表示を導入するべきではない",
      "比較可能な表示には意義があるが、利用期間や制度も含めて判断する必要がある",
      "消費者が表示を見て選べば、供給側への規制は不要になる",
    ],
    correctIndex: 2,
    evidence: [
      "前提と誤差を公開しながら基準を更新する方が実用的だ",
      "数値は判断材料になるが、耐久性の情報や企業への規制と組み合わせる必要がある",
    ],
    explanation:
      "A supports standardized, transparent labels despite uncertainty. B explains why product-use patterns and producer-side rules remain relevant. Together they endorse labels as useful but insufficient decision evidence.",
  },
  {
    semanticId: "N1-integrated-group-work-participation",
    level: "N1",
    family: "reading-integrated",
    semanticFocus:
      "group-work participation should be designed as varied, consequential contribution",
    sources: [
      {
        label: "文章A",
        body: "グループ学習では、発言の多い生徒が司会と発表を繰り返し、他の生徒が記録だけを担当することがある。役割を固定すると、得意なことは速く進むが、学ぶ機会が偏る。そこで司会、根拠の確認、反対例の提示、発表などを回ごとに交代させたい。ただ順番にすればよいのではなく、各役割が最終判断にどう貢献したかを振り返ることで、活動を単なる分業にしないことが大切だ。教員は目立つ発表だけを評価せず、問いを立て直したり根拠の不足を指摘したりした過程も記録し、次の役割選択に生かすべきである。",
      },
      {
        label: "文章B",
        body: "全員に同じ回数の発言を求めると公平に見えるが、考えをまとめる速さや、音声で表現する負担は人によって異なる。事前に文章で意見を出す、図で関係を示す、他者の案に質問を加えるなど、参加の形には幅を持たせるべきだ。一方、本人の希望を尊重するという理由で、発言しない生徒を意思決定から外してはならない。重要なのは形式の均一さではなく、各自の考えが成果に影響することである。そのためには、どの提案が最終案にどう取り入れられたかを示し、採用されなかった意見にも理由を返すことが望ましい。そうして初めて、生徒は自分の考えが聞かれただけでなく、共同の判断材料になったと理解できる。",
      },
    ],
    question:
      "グループ学習への参加について、文章Aと文章Bに共通する考えはどれか。",
    options: [
      "得意な役割を固定すれば、全員の学習機会が増える",
      "全員の発言回数を同じにすることが公平である",
      "役割や表現方法に違いがあっても、各自の貢献が判断に反映されるべきだ",
      "話すことが苦手な生徒は、記録だけを担当すればよい",
    ],
    correctIndex: 2,
    evidence: [
      "各役割が最終判断にどう貢献したかを振り返る",
      "各自の考えが成果に影響することである",
    ],
    explanation:
      "A emphasizes rotating meaningful roles and tracing their effect on the outcome; B allows varied modes of expression while requiring influence on decisions. Their shared criterion is consequential contribution, not uniform speaking or fixed specialization.",
  },
] as const satisfies readonly UpperReadingSeed[];

const n1MidSeeds = [
  {
    semanticId: "N1-mid-museum-replica-authenticity",
    level: "N1",
    family: "reading-mid",
    semanticFocus:
      "replicas can reveal an object's use while originals preserve material history",
    sources: [
      {
        body: "博物館で複製品を見ると、「本物でないなら価値が低い」と感じる人がいる。確かに、素材に残る傷や修理の跡は、その物がたどった時間を示すもので、原品でなければ伝えられない。しかし、貴重な原品は保存上の理由から触れられず、かつて人がどう持ち、どう動かしたかは展示ケース越しには分かりにくい。精密な複製を実際に手に取れば、重さや形が使用者の動作をどう制約したかを試すことができる。ここで複製は原品の代用品というより、原品からは得にくい種類の理解を開く装置となる。もちろん、複製を原品と取り違えさせてよいわけではない。重要なのは両者の違いを明示したうえで、それぞれに異なる問いを向けることである。原品には「この物に何が起きたか」を、複製には「この物によって何ができたか」を問える。真正性を一つの尺度に閉じ込めず、資料との関わり方を設計することが、展示の可能性を広げるのだ。さらに、複製の制作過程で判明した構造を併せて示せば、見た目の再現にとどまらない研究成果も共有できる。",
      },
    ],
    question: "複製品の展示について、筆者の考えに最も近いものはどれか。",
    options: [
      "原品の劣化を防げるなら、すべて複製品に置き換えるべきだ",
      "原品との違いを示し、原品とは別の理解を得るために活用できる",
      "複製技術が十分に精密なら、原品かどうかを示す必要はない",
      "物の使い方より素材の履歴を伝える展示を優先すべきだ",
    ],
    correctIndex: 1,
    evidence: [
      "複製は原品の代用品というより、原品からは得にくい種類の理解を開く装置となる",
      "両者の違いを明示したうえで、それぞれに異なる問いを向ける",
    ],
    explanation:
      "The author assigns complementary roles to originals and replicas. A replica can make use and bodily interaction intelligible, provided its status is explicit; it neither replaces every original nor becomes equivalent merely through technical precision.",
  },
  {
    semanticId: "N1-mid-dashboard-local-knowledge",
    level: "N1",
    family: "reading-mid",
    semanticFocus:
      "standardized dashboards need local interpretation without becoming optional",
    sources: [
      {
        body: "組織の状況を一覧できるダッシュボードは、異なる部署を同じ基準で比較するのに役立つ。問題は、表示された数字が、その背景まで説明しているかのように扱われるときに生じる。たとえば相談件数の減少は、問題が減った結果かもしれないが、窓口の場所が変わって相談しにくくなった結果かもしれない。この違いは、現場で利用者の声を聞く人でなければ気づきにくい。だからといって、各部署が「事情が特殊だ」と主張して共通指標を退ければ、都合の悪い変化を検証できなくなる。必要なのは数字か現場感覚かの二者択一ではない。共通指標を、答えを自動的に与える判定装置ではなく、どこを詳しく調べるべきかを知らせる入口として用いることだ。そのうえで、現場の知識を数字への言い訳ではなく、数字の意味を確かめるための仮説として扱う。この往復があって初めて、比較可能性と文脈への配慮を両立できる。また、現場の説明と合わない数字を消すのではなく、不一致そのものを次の調査課題として残す姿勢も求められる。",
      },
    ],
    question: "筆者が提案するダッシュボードの使い方はどれか。",
    options: [
      "共通指標で部署の成否を直接判定し、現場の説明は考慮しない",
      "特殊な事情がある部署には共通指標を適用しない",
      "数字を調査の出発点とし、現場の知識でその意味を検証する",
      "相談件数が減った部署では、窓口の場所を元に戻す",
    ],
    correctIndex: 2,
    evidence: [
      "どこを詳しく調べるべきかを知らせる入口として用いる",
      "現場の知識を数字への言い訳ではなく、数字の意味を確かめるための仮説として扱う",
    ],
    explanation:
      "The dashboard should flag where inquiry is needed, while local knowledge supplies testable explanations for the figures. The author rejects both automatic judgment by metrics and blanket exemption based on local specialness.",
  },
  {
    semanticId: "N1-mid-recommendation-attention",
    level: "N1",
    family: "reading-mid",
    semanticFocus:
      "recommendation systems redistribute attention and thereby shape future preferences",
    sources: [
      {
        body: "推薦システムは、利用者が過去に選んだ作品に似たものを提示する。そのため、すでにある好みを効率よく満たす道具だと説明されることが多い。だが、私たちの好みは、選択に先立って完成しているわけではない。偶然目にした作品に何度か触れるうち、当初は関心のなかった表現を面白いと思うこともある。何が目に入り、何が視野から外れるかという配分が、次の好みを育てているのである。すると推薦は、単に需要を読み取るだけでなく、将来読み取ることになる需要の一部を作ってもいる。ただし、意外な作品を無作為に混ぜればよいわけではない。関連性がまったくなければ、利用者はそれを雑音として無視するだろう。既知の関心から少し外側へ進める道筋を示し、なぜ提示されたかを利用者が調整できる設計が望ましい。推薦の質は、当面のクリック数だけでなく、関心の幅を狭めずに探索を助けたかによっても評価されるべきだ。その評価には、提示直後の反応だけでなく、時間をおいて選択の幅がどう変わったかを見る必要がある。",
      },
    ],
    question: "推薦システムについて、筆者が最も重視していることは何か。",
    options: [
      "過去の選択と一致する作品だけを正確に提示すること",
      "予想外の作品を理由なく無作為に増やすこと",
      "クリック数を使わず利用者の好みを測ること",
      "現在の関心に応じつつ、新たな関心への探索も支えること",
    ],
    correctIndex: 3,
    evidence: [
      "推薦は、単に需要を読み取るだけでなく、将来読み取ることになる需要の一部を作ってもいる",
      "既知の関心から少し外側へ進める道筋を示し",
    ],
    explanation:
      "Recommendations influence future taste by allocating attention. The preferred design remains relevant to present interests while offering an intelligible path beyond them; neither exact repetition nor random novelty satisfies that aim.",
  },
  {
    semanticId: "N1-mid-institutional-apology-repair",
    level: "N1",
    family: "reading-mid",
    semanticFocus:
      "an institutional apology must connect acknowledgment to future corrective capacity",
    sources: [
      {
        body: "組織が不祥事について謝罪するとき、責任者が深く頭を下げる場面ばかりが注目される。しかし、謝罪の価値を態度の強さだけで測ると、受け手は感情表現の真偽を推測するほかなくなる。組織の謝罪に必要なのは、まず何が起き、誰にどのような不利益を与えたかを具体的に認めることだ。さらに、同じ条件が残っていないかを調べ、再発を防ぐ変更と、その変更が機能したかを確かめる方法を示さなければならない。これは、謝罪を将来の保証と同じものにするという意味ではない。制度を変えても予想外の失敗は起こり得る。それでも、被害を偶然の出来事として切り離さず、組織が学習可能な形で引き受けることはできる。謝罪とは、過去への言葉であると同時に、今後の行動を検証に開く約束なのである。だから、表現が控えめでも、事実・是正・検証の関係が明確なら、華々しい反省の演出より信頼回復に資する。また、検証結果が期待どおりでなかった場合に、追加の変更を公表することも約束に含まれる。",
      },
    ],
    question: "組織の謝罪について、筆者が重要だと考えていることは何か。",
    options: [
      "責任者の反省が本物だと感じられるまで感情を表現すること",
      "予想外の失敗も含め、将来の問題が起きないと保証すること",
      "事実と不利益を認め、是正策を後から検証できるようにすること",
      "被害を個人の過失から組織の責任へ移すこと",
    ],
    correctIndex: 2,
    evidence: [
      "何が起き、誰にどのような不利益を与えたかを具体的に認める",
      "今後の行動を検証に開く約束",
    ],
    explanation:
      "The passage defines an effective institutional apology through concrete acknowledgment, corrective change, and a way to verify that change. Emotional display alone is insufficient, and the author explicitly denies that apology can guarantee no future failures.",
  },
  {
    semanticId: "N1-mid-saved-time-fragmentation",
    level: "N1",
    family: "reading-mid",
    semanticFocus:
      "small efficiency gains may fail to produce usable time when scattered and pre-claimed",
    sources: [
      {
        body: "家事や事務を自動化する道具は、私たちに時間を返してくれると言われる。実際、一つ一つの作業にかかる時間は短くなった。にもかかわらず、余裕が増えたと感じない人が多いのはなぜだろう。節約された時間が五分、十分と細切れになり、まとまった活動には使いにくいことが一因である。さらに、連絡が速くなると返事も速く求められ、空いた時間が次の依頼によって先に予約されてしまう。つまり、時間の総量を減らす技術と、自由に使える時間を生み出す仕組みは同じではない。効率化の効果を考える際には、何分減ったかだけでなく、その時間を誰が、どの程度まとまって、別の目的に使えるのかを見なければならない。通知を一定時間止める、節約分を会議で埋めないといった運用が伴わなければ、効率化は活動の数を増やすだけになり得る。技術が作る余白は、それを余白として守る制度によって初めて経験されるのである。個人の時間管理の巧拙だけに帰せば、空白を埋める組織側の圧力は見えないままになる。",
      },
    ],
    question: "筆者によると、効率化で余裕を生むには何が必要か。",
    options: [
      "短縮できる作業を増やし、節約時間の合計を最大にすること",
      "連絡への返事をこれまで以上に速くすること",
      "細切れの時間にも多くの仕事を割り当てること",
      "節約された時間をまとまりある自由な時間として守ること",
    ],
    correctIndex: 3,
    evidence: [
      "時間の総量を減らす技術と、自由に使える時間を生み出す仕組みは同じではない",
      "それを余白として守る制度によって初めて経験される",
    ],
    explanation:
      "Efficiency gains do not automatically become usable leisure when fragmented or immediately filled by new demands. The author argues that operational protections must preserve saved time as coherent discretionary time.",
  },
  {
    semanticId: "N1-mid-citizen-science-reliability",
    level: "N1",
    family: "reading-mid",
    semanticFocus:
      "citizen science gains reliability through transparent protocols and distributed correction",
    sources: [
      {
        body: "市民が生物の分布を記録する調査には、専門家だけでは集められない広い地域のデータが集まる。一方で、参加者ごとに観察経験が異なるため、記録の信頼性に疑問が向けられる。これに対し、専門家がすべてを後から確認すればよいと考えると、膨大な件数を処理できず、市民参加の利点が失われる。重要なのは、誤りを完全に排除できる参加者だけを集めることではない。撮影する角度や位置情報の残し方を共通化し、判断が難しい記録には印を付け、複数の参加者が再確認できるようにする。さらに、どの地域・季節では報告が少ないかを公開すれば、データの空白を結果の不在と取り違えずに済む。このように、記録の作り方と不確かさを見える形にすることで、個々の熟練度の差を、全体で点検可能な情報へ変えられる。信頼性は、全員が専門家であることからではなく、誤りが発見・修正される経路を設けることから生まれる。訂正の履歴も残せば、参加者は自分の判断を改善でき、調査全体の学習にもつながる。",
      },
    ],
    question:
      "市民参加型調査の信頼性を高める方法として、筆者が述べているものはどれか。",
    options: [
      "経験の豊富な市民だけに記録を任せる",
      "全記録を専門家が一件ずつ確認してから公開する",
      "観察方法と不確かさを共有し、記録を再確認できるようにする",
      "報告がない地域には対象の生物がいないと判断する",
    ],
    correctIndex: 2,
    evidence: [
      "記録の作り方と不確かさを見える形にする",
      "誤りが発見・修正される経路を設けることから生まれる",
    ],
    explanation:
      "Reliability comes from shared protocols, visible uncertainty, and routes for distributed checking and correction. Restricting participation or requiring expert review of every record would undercut the scale advantage, while absence of reports is not evidence of biological absence.",
  },
  {
    semanticId: "N1-mid-bilingual-sign-audience",
    level: "N1",
    family: "reading-mid",
    semanticFocus:
      "multilingual public signs require task-oriented rewriting rather than line-by-line translation",
    sources: [
      {
        body: "公共施設の案内を多言語化するとき、日本語の文章を一文ずつ正確に訳せば十分だと思われやすい。だが、原文はその施設に慣れた人を暗黙の読者として書かれている場合がある。「所定の場所で手続きしてください」と訳しても、初めて来た人には、その場所がどこで、先に何を用意するのか分からない。問題は翻訳者の語学力だけではなく、原文が前提としていた知識が可視化されていないことにある。したがって多言語化では、まず利用者がどの場面で何を達成しようとしているかを確かめ、必要なら情報の順序や見出しも組み直すべきだ。日本語版にも同じ改善を戻せば、子どもやその施設に不慣れな日本語話者にも役立つ。多言語化を、完成した日本語を別の言語に複製する終盤の作業とみなしてはならない。それは、誰を読者として想定していたのかを問い直し、案内そのものを設計し直す機会なのである。訳文の自然さだけでなく、実際に目的地へ着けたかなど、行動の達成によって案内を試す必要もある。",
      },
    ],
    question: "公共案内の多言語化について、筆者の主張は何か。",
    options: [
      "日本語原文の文と順序を保つことが正確さにつながる",
      "外国語版にだけ詳しい説明を加えればよい",
      "翻訳前に日本語を簡単な語彙だけで書き換えるべきだ",
      "利用場面と前提知識を見直し、案内の構成自体を再設計すべきだ",
    ],
    correctIndex: 3,
    evidence: [
      "利用者がどの場面で何を達成しようとしているかを確かめ、必要なら情報の順序や見出しも組み直す",
      "案内そのものを設計し直す機会",
    ],
    explanation:
      "The author treats multilingualization as audience and task redesign, not sentence-by-sentence duplication. Hidden assumptions and information order must be reconsidered, with improvements potentially benefiting every language version.",
  },
  {
    semanticId: "N1-mid-remote-presence-design",
    level: "N1",
    family: "reading-mid",
    semanticFocus:
      "remote participation depends more on channels of influence than continuous visual presence",
    sources: [
      {
        body: "オンライン会議で参加意識を保つため、常にカメラをオンにする規則を設ける組織がある。顔が見えれば反応を読み取りやすい場面は確かにある。しかし、画面に顔が並んでいることと、議論に参加できていることは同じではない。通信環境への不安から発言を控える人もいれば、対面の会議室で交わされた小声の相談が遠隔参加者には届かないこともある。存在感を映像の継続だけで測れば、見えているが影響を与えられない状態を見逃す。大切なのは、資料に同じタイミングでアクセスできるか、発言を求める合図が拾われるか、会議後にも異論を加えられるかといった、意思決定へ関与する経路である。カメラはその経路を支える手段の一つにはなるが、参加の証明ではない。遠隔参加を改善するなら、映像を義務化する前に、誰の発言がどの段階で決定に反映されたかを点検すべきだ。議事録に提案者と採否の理由を残すことは、その偏りを後から確かめる一つの方法になる。映像の有無だけでは、その検証はできない。",
      },
    ],
    question: "オンライン会議への参加について、筆者が重視していることは何か。",
    options: [
      "参加者の顔が会議中ずっと表示されていること",
      "通信環境の悪い人は会議後にだけ意見を述べること",
      "遠隔参加者が意思決定に影響できる経路があること",
      "対面参加者の小声の相談を禁止すること",
    ],
    correctIndex: 2,
    evidence: [
      "意思決定へ関与する経路である",
      "カメラはその経路を支える手段の一つにはなるが、参加の証明ではない",
    ],
    explanation:
      "Visible faces are not equivalent to meaningful participation. The author prioritizes accessible channels through which remote participants can contribute to and affect decisions, with video treated as only one possible supporting tool.",
  },
] as const satisfies readonly UpperReadingSeed[];

const N2_READING_REVISIONS: Readonly<Record<string, UpperReadingSeed>> = {
  "N2-mid-remote-camera-purpose": {
    semanticId: "N2-mid-meeting-record-purpose",
    level: "N2",
    family: "reading-mid",
    semanticFocus:
      "meeting records use different formats for decisions and demonstrations",
    sources: [
      {
        body: "私たちの部署では、オンライン会議をすべて録画していた。欠席者が後から内容を確認でき、記録も正確に残ると考えたからだ。しかし、一時間の会議で自分に関係する話がどこにあるか分からず、結局だれかに内容を聞く人が多かった。録画があっても、必要な情報へすぐ行けなければ、引き継ぎには使いにくい。\nそこで、決定したこと、担当者、期限は短い記録にまとめる一方、画面の操作や商品の動きを説明した部分だけを映像で残すことにした。記録には映像の時刻も書き、詳しく見たい人がその場面へ進めるようにした。意見が分かれて結論が出なかった点は、決定と混ぜず次回の議題として記す。\n映像を減らすと情報が失われるという心配もあった。だが、保存する量を減らすことが目的ではない。数字や手順の細かい説明は映像で確かめ、何を実行するかは文章で早く読めるようにする。内容に合う形を選んだことで、欠席者から同じ質問を受けることが減った。\n会議の記録は、長ければ詳しいとは限らない。後で何を確認するのかを考え、文章と映像の役割を分けることが大切なのである。",
      },
    ],
    question: "この部署で、会議の内容を確認しやすくなったのはなぜか。",
    options: [
      "すべての発言を文章だけで詳しく残したから",
      "実行事項は文章、動きの説明は映像というように記録方法を分けたから",
      "結論が出なかった意見を記録しないことにしたから",
      "欠席者に会議の全録画を見るよう求めたから",
    ],
    correctIndex: 1,
    evidence: [
      "決定したこと、担当者、期限は短い記録",
      "画面の操作や商品の動きを説明した部分だけを映像",
      "文章と映像の役割を分ける",
    ],
    explanation:
      "The team made each medium serve a retrieval purpose: concise text for decisions and responsibility, linked video for demonstrations. It did not discard unresolved issues or require everyone to watch the full recording.",
  },
};

const N2_READING_LENGTH_EXPANSIONS: Readonly<Record<string, string>> = {
  "N2-mid-limited-menu-food-waste":
    "客の中には、以前好きだった料理がなくなって残念だという人もいた。店はその声を無視せず、注文の記録を見ながら、季節の一品として復活させる料理を選ぶという。品数を減らすことは、客の希望を聞かないことではない。限られた材料で何を残すかを、以前より丁寧に考えることでもある。",
  "N2-mid-community-bus-hidden-demand":
    "もちろん、住民全体への調査でも回答しない人はいる。そこで、学校や病院の利用者に短く話を聞いたり、時間帯ごとの人の動きを観察したりする方法を組み合わせたい。一つの調査で完全な答えを得るのではなく、異なる方法で同じ問題を確かめることが、隠れた需要を見つける助けになる。",
  "N2-mid-museum-handwritten-captions":
    "カードの内容は担当者の感想だけで決めず、来館者がどこで長く立ち止まったかも参考にして替えているそうだ。正解を先に示すカードより、小さな発見へ目を向けさせるカードのほうが会話を生んだという。説明を増やすことより、作品へ視線を戻す言葉を選ぶ姿勢が大切なのである。",
  "N2-mid-standing-meeting-preparation":
    "また、十五分で結論が出ない問題は、担当者を決めて別の時間に話す。その場で無理に決めないため、短い会議でも大事な問題を軽く扱わずに済む。会議を短くする目的は、考える時間をなくすことではなく、報告と相談を分け、それぞれに合う時間を使うことだと分かった。",
  "N2-mid-volunteer-choice-continuity":
    "ただし、一年間ずっと同じ仕事を続けるのではない。三か月ごとに本人と受け入れ先が目標を確認し、合わなければ別の役割へ移れるようにした。継続を強制するのではなく、選んだ仕事を深く知る機会と、選び直せる仕組みの両方を用意した点が重要だった。",
  "N2-mid-bookshop-shelf-conversation":
    "売り上げだけを見れば、よく知られた新刊を並べるほうが確実だろう。それでも店は、カードを書いた人の名前と選んだ理由を残し、月末に客の感想を共有する。紹介した本が売れなかった場合も理由を話し合う材料になる。棚は商品の順位表ではなく、読者同士の会話を始める場所なのである。",
  "N2-mid-remote-camera-purpose":
    "録画を残す範囲が決まったため、参加者は後で確認できる部分と、記録だけを読む部分を区別できるようになった。担当者も、長い映像を最初から見直すのではなく、時刻の印から必要な説明へ進める。記録の量を増やすことより、必要な情報へ戻れる道を作るほうが、引き継ぎには役立ったのである。",
  "N2-mid-street-tree-maintenance":
    "そこで町内会は、植えた本数だけでなく、三年後に健康に育っている割合も公表することにした。最初の本数は減ったが、水やりや剪定の担当が明確になり、枯れた原因も記録されるようになった。目立つ植樹の日より、その後の世話を計画の中心に置いたのである。",

  "N2-integrated-coworking-call-evening":
    "【利用手続き】通話用小部屋を続けて使うことはできません。三十分が終わったら一度退出し、待っている人がいなければ再度利用できます。利用資格を確認するため、初回は住所または勤務先が分かる物をお持ちください。閉館十五分前から新しい利用は受け付けません。静音室への飲み物の持ち込みもできません。",
  "N2-integrated-digital-ticket-access":
    "別の確認方法を用意しても、電子券より高い手数料や長い待ち時間を求めれば、実際には利用しにくい。例外への対応は特別な親切ではなく、チケットを買った人が同じ条件で入場するための仕組みである。電子化で減った費用の一部を、窓口の訓練や予備の機器に使うことも考えるべきだろう。便利さは、通常どおり動く日だけで評価してはならない。",
  "N2-integrated-language-course-speaking":
    "【学習内容】動画には短い会話例と発音練習があり、視聴後に確認問題へ答えます。録音課題は週一回、一分以内です。講師のコメントを読んだ後は同じ課題を一度だけ出し直せます。質問会では講師へ文法を尋ねられますが、個別の会話練習や受講者同士のグループ活動は行いません。修了には動画の八割以上の視聴が必要です。",
  "N2-integrated-apartment-renovation-priority":
    "中庭の工事後は、住民が午前八時から午後八時まで利用できる。ベンチの場所は、近くの部屋へ音が届きにくい位置を選ぶ。入口の応急修理費は本案の見積もりに含まれていないため、実施する場合は別に予算を決める必要がある。来年の入口改修までに費用が上がった場合、残した予算だけでは足りない可能性もある。中庭工事の開始前に住民説明会を一回開き、日よけの色と利用規則への意見を聞く。計画を中止した場合の設計費は返金されない。",
  "N2-integrated-volunteer-regular-contact":
    "【初めて参加する方へ】活動日の一週間前にオンライン説明を受け、当日は開始三十分前に集合してください。受付と会場準備は二人一組で行います。子どもと直接話す担当を希望する場合も、経験を確認した上で主催者が決定します。参加証明書は活動終了後に希望者へ発行しますが、交通費や食事の支給はありません。雨で屋外行事が中止になった場合、会場内の準備作業だけを行うことがあります。申込後の担当変更は、活動日の三日前までに相談してください。",
  "N2-integrated-book-review-practical-change":
    "文章はやや専門的だが、研究の紹介だけで終わらず、会社の評価制度や家庭の時間の使い方が行動にどう影響するかを考えさせる。自分の習慣をすぐ一つ変えたい読者より、行動を個人の性格だけで説明することに疑問を持つ読者に勧めたい。巻末には参考文献があるが、行動を記録する表や練習課題はない。",
  "N2-integrated-flex-work-team-overlap":
    "共有する内容が多すぎると、毎日の記録が負担になる。そのため、終了した作業、止まっている理由、次に判断が必要な点の三つにしぼる。翌日が休みの人は、代わりに対応できる人も記入する。共通の時間を置く場合でも、全員が集まることだけを目的にせず、その場で決める議題を前日までに知らせるべきだ。共有した予定を変更した人は、関係する担当者へ印を付けて知らせる。記録は監視のためではなく、勤務時間が重ならない相手へ仕事を渡すために使いたい。",
  "N2-integrated-museum-guide-child-choice":
    "【申込】各回十二人。前月一日からウェブで受け付け、空きがあれば当日も参加できます。はさみを使うため、小学一・二年生は保護者が同じ机で手伝ってください。選んだ材料は途中で交換できますが、展示品と同じ物を作ることは目的にしていません。作業後、希望する子どもは作品で工夫した点を短く紹介します。材料費は参加費に含まれます。汚れてもよい服で来てください。欠席する場合は当日の午前十時までに連絡し、保護者だけの参加はできません。作った作品を館内に展示する場合は、本人と保護者へ確認します。",

  "N2-thematic-questioning-skill":
    "良い質問には、相手を困らせるためのものではなく、話し合いの前提をそろえる働きがある。質問された側も、すぐ答えられないことを認め、必要な情報を一緒に確かめられる。教室や職場で質問を評価するとき、難しい言葉の数ではなく、何が分かり、何がまだ分からないかを明らかにしたかを見るべきだろう。そうすれば質問は、知識の不足を示す行為ではなく、理解を前へ進める共同作業になる。",
  "N2-thematic-festival-change-continuity":
    "もちろん、変化を望む人だけで決めれば、長く支えてきた人が大切にしてきたものを失うかもしれない。反対に、昔からの形だけを理由なく守れば、新しい担い手は自分の祭りだと感じられない。変更する部分と残す部分を話し合い、その理由を記録することが必要だ。次の世代がその記録を読み、さらに選び直せることこそ、継続の強さになる。",
  "N2-thematic-walking-productive-detour":
    "最短の道を選ぶ地図は、急いでいるときには役立つ。しかし、町の小さな変化や、知らなかった店に気づく機会は、目的地だけを見ていると減ってしまう。すべての移動を遠回りにする必要はない。時間に余裕がある日に少し違う道を選ぶことで、移動は空白ではなく観察の時間になる。効率と発見のどちらを求めるかを、自分で選べることが大切なのである。",
  "N2-thematic-near-miss-records":
    "報告された数が増えた直後は、職場が危険になったように見えることもある。しかし、それまで隠れていた出来事が見えるようになった可能性があるため、件数だけで判断してはならない。報告後に設備や手順がどう変わり、同じ状況が減ったかまで確認する必要がある。小さな失敗を共有した人が損をしない仕組みがあって初めて、記録は安全のための情報として働く。",
  "N2-thematic-public-benches-staying":
    "ベンチを置いた後も、誰がいつ利用し、通行にどんな影響があるかを観察すれば、場所や向きを調整できる。最初の配置を守り続けることが目的ではない。利用者の声と実際の動きを見ながら、休む人と通る人の両方に使いやすい形を探すべきだ。立ち止まることを問題として追い出すのではなく、異なる速さの人が同じ場所を共有できる設計が求められる。",
  "N2-thematic-translation-useful-ambiguity":
    "一方で、訳者が判断を避けるために曖昧な表現を増やせばよいわけではない。原文で明確な関係までぼかすと、別の作品になってしまう。どこが意図的に開かれており、どこは単に文法上省略されているのかを、作品全体から考える必要がある。読者の選択を残す判断には、何も決めない態度ではなく、原文の働きを細かく読む責任が伴うのである。",
  "N2-thematic-repair-knowledge":
    "修理の記録を共有するときは、成功した方法だけでなく、試しても直らなかった方法も残したい。同じ失敗を繰り返さずに済み、どの条件で別の判断が必要か分かるからだ。製造会社と地域の修理者が情報を交換すれば、壊れにくい次の製品にもつながる。修理を個人の特別な技術に閉じず、学べる形にすることで、その価値は一台の製品を長く使うこと以上に広がる。",
  "N2-thematic-classroom-silence":
    "待つ時間を作った後、先生が必ず一人ずつ答えさせると、今度は考える時間が発表への不安に変わることもある。メモを出すだけ、二人で話してから共有するなど、考えを示す方法にも選択が必要だ。目的は全員に同じ速さで話させることではない。異なる時間の使い方を認めながら、それぞれの考えが授業の中で扱われるようにすることである。",

  "N2-info-training-center-certificates":
    "【修了証】氏名は申込時の表記で発行します。再発行は一回500円。会社指定の様式への変更はできません。Aの最終課題は最終回から3日以内、Dの課題は受講期間終了日までに提出してください。【設備】持参したパソコンはDの質問会だけで使用可。センターでの録音・録画は認めません。災害で休講した場合は予備日に振り替えます。",
  "N2-info-community-room-cooking":
    "【設備】調理室にはオーブン2台と冷蔵庫があります。食器は20人分ですが、材料とふきんは各団体で用意してください。においの強い調理や揚げ物を行う場合は申込時に知らせること。未成年だけの利用はできません。予約時間を過ぎた場合は30分単位で追加料金がかかります。館が認めた地域交流事業は営利料金の対象外となる場合があります。",
  "N2-info-library-research-consultation":
    "【利用上の注意】相談で紹介した資料の貸出条件は資料ごとに異なります。オンライン相談には、予約時に届くURLから5分前に入室してください。通信が切れた場合、終了時刻は延長しませんが、残った質問を一回だけメールで送れます。②③の予約は一人につき週一回まで。学校の団体利用は別の申込が必要です。",
  "N2-info-bicycle-share-visitor-day":
    "【料金計算】ポートへ正しく返却するまで利用時間が続きます。一日券や三時間券も、一回60分を超えた部分には追加料金がかかります。電池残量は貸出前にアプリまたは車体表示で確認してください。事故が起きた場合は警察と運営窓口の両方へ連絡。雨天による返金はありません。利用履歴は返却後にアプリで確認できます。",
  "N2-info-cultural-workshop-ceramics":
    "【当日】開始15分前から受付。遅刻しても終了時刻は延長しません。A・Cは汚れてもよい服装で参加し、Cでは爪を短くしてください。作品の保管期限は12月1日で、それまでに受け取らない場合は文化館が処分します。抽選後に空きが出た講座は9月28日から先着で受け付けますが、すでに当選した人は申し込めません。",
  "N2-info-employee-health-check-afternoon":
    "【費用】指定された健診は会社負担。希望で追加する検査は給与から引きます。【当日】本人確認証と尿検査容器を持参し、胸部撮影のある人は金属のない服を着用してください。妊娠中または可能性がある人は、撮影前に必ず申し出ること。勤務の都合で期間内に受けられない場合は、人事部へ連絡して外部会場の案内を受けます。",
  "N2-info-bulky-waste-moving-day":
    "【料金例】いす300円、机800円、二人用ソファ1,200円。分解しても元の品目で数えます。再使用受付で不採用になった後、戸別収集へ変更する場合は改めて希望日を予約してください。持ち込み時は自家用車から本人が荷物を下ろします。事業所で使った家具は家庭ごみとして受け付けません。申込内容にない品は当日追加できません。",
  "N2-info-small-business-seminar-plan":
    "【受講方法】①③④は会場のみ。②は二回とも会場参加ですが、終了後7日間、復習用動画を視聴できます。動画を見ても欠席の代わりにはなりません。受講料は申込から3日以内に支払い、抽選で落選した場合は返金します。個別相談では講座で作成した収支表を使用するため、相談日の2日前までに提出してください。",
};

const N1_READING_LENGTH_EXPANSIONS: Readonly<Record<string, string>> = {
  "N1-thematic-resilience-redundancy":
    "余裕を維持する費用は、何も起きなかった年には説明しにくい。そのため、非常時に何を守るための余裕なのか、どの訓練で切替能力を確認したかを平常時から示す必要がある。使われなかったことだけを理由に削れば、危機が来たときには能力を作り直す時間がない。備えの評価には、存在だけでなく更新と実行可能性を含めるべきだ。",
  "N1-thematic-deliberation-speed":
    "また、速く決めた人が、修正の費用を負う人と同じとは限らない。権限を現場へ移すなら、誤りを報告して止められる権限も同時に渡す必要がある。実行だけを急がせ、見直しには上位の承認を求める制度では、可逆的だった選択も事実上戻せなくなる。決定速度は、修正の入口まで含めて設計されなければならない。",
  "N1-thematic-expertise-trust":
    "さらに、専門家の間の不一致を隠さないことも重要である。不一致が証拠の解釈によるのか、重視する価値の違いによるのかを示せば、一般の人も争点を理解できる。全員一致を演出するより、少数意見がどの証拠で支持され、何が起きれば主流の判断が変わるかを説明するほうが、知識が閉じた権威ではないことを伝えられる。",
  "N1-thematic-institutional-forgetting":
    "誰が整理を担うかも明確にしなければならない。忙しい担当者の善意に任せると、記録は業務の最後に回され、異動直前に大量の資料だけが残る。決定時に要点をまとめ、一定期間後に利用されたかを確かめる時間を業務として確保するべきだ。記憶の維持には保存装置だけでなく、編集に責任を持つ役割が必要なのである。",

  "N1-info-archive-restricted-records":
    "【複写・引用】館による紙の複写は一日100枚までで、要審査資料は審査済みの範囲に限ります。デジタルデータのメール送付は行いません。論文等で文章を引用するだけの場合も資料番号を記載してください。【利用証】初回は本人確認書類を提示し、一年間有効の利用証を作成します。団体で来館する場合も申請と資料請求は各自で行います。",
  "N1-info-conference-revised-paper":
    "【発表形式】口頭発表は発表15分・質疑10分。ポスターは指定時間60分の在席が必要です。オンライン発表への変更は、病気等の事情を11月10日までに申し出て承認を受けた場合に限ります。採択後に辞退しても提出済み要旨は公開しませんが、参加費の返金は11月15日までの連絡に限ります。共同発表者の追加は最終原稿時まで可能です。",
  "N1-info-residency-community-research":
    "【選考・報告】選考では企画の実現性、地域との関係、滞在後に共有できる知見を審査します。Bの公開会には協働先も招き、終了後30日以内に活動費の領収書と報告書を提出。未使用分は返金します。調査で録音・撮影を行う場合は、公開範囲を説明した同意書を用意してください。採択後に協働先を別団体へ変更するには再承認が必要です。",
  "N1-info-laboratory-booking-after-hours":
    "【精算・安全】学内利用者は月末に所属部局へ請求し、学外者は利用前に見積書を確認します。予定より早く終了しても予約時間分を請求します。時間外利用者は入退室記録を残し、最後の二人が室温と装置状態を確認。試料を室内に保管する場合は、責任者名と廃棄日を表示してください。承認のない試料は装置へ持ち込めません。",
  "N1-info-public-consultation-accessibility":
    "【資料閲覧】計画案は市ウェブサイト、支所、図書館で閲覧できます。点字版と読み上げ用データは申込により提供。外国語で提出された意見は市が内容を確認できる範囲で受理しますが、提出者に日本語要約を求める場合があります。締切後に届いた意見や連絡先を確認できない提出は、参考資料としても扱いません。提出された原本は返却しません。",
  "N1-info-manuscript-digitization-color":
    "【納品・保管】データは暗号化したダウンロードページで提供し、公開から14日後に閉じます。保存媒体での納品は媒体代1,500円を追加。ファイル名の指定は申込時に一覧を提出してください。撮影後にページ順の変更を依頼する場合は作業料がかかります。色の再調整は色見本とのずれが確認された場合に限り、納品後7日以内なら無料です。",
  "N1-info-executive-program-coaching":
    "【選考・取消】応募多数の場合、提出課題と職務経験をもとに選考し、申込順では決めません。開講14日前までの取消は全額、13日前以降は半額を返金。勤務先の代理参加は不可。オンライン講義では各回の小課題も提出してください。伴走コースのコーチは課題に応じて院が決定し、受講者による指名や途中変更は原則できません。面談内容は勤務先へ報告しません。",
  "N1-info-ethics-review-calendar":
    "【申請後】事務局による形式確認で不足があれば、受付日は修正版の提出日に変わります。審査中の質問には原則5営業日以内に回答してください。承認の有効期間は最長3年ですが、年度ごとの進捗報告が必要。重大な予期しない事象が起きた場合は、研究を一時停止し24時間以内に報告します。研究終了後は、終了報告とデータ保管方法の確認を提出してください。",
};

/** Extra source-voice material required by the conservative release length gate. */
const RELEASE_GATE_EXPANSIONS: Readonly<Record<string, string>> = {
  "N2-short-flex-hours-overlap":
    "共通時間以外の勤務予定は、前日までに予定表へ登録する。",
  "N2-short-library-donation-selection":
    "受付後の利用方法は図書館が判断し、結果の個別連絡は行わない。",
  "N2-short-delivery-locker-deadline":
    "管理室で期限後の荷物を受け取ることはできない。",
  "N2-short-minutes-decision-boundary":
    "記録は会議後二日以内に参加者へ共有する。",
  "N2-short-rain-event-partial-change":
    "会館の受付は午前十時四十分から始める。",
  "N2-short-museum-photo-exception":
    "撮影できるか迷う場合は、作品横の表示を確認すること。",
  "N2-short-course-cancellation-transfer":
    "変更後の日程を取り消す場合も、通常の規則が適用される。",
  "N2-short-shared-kitchen-last-user":
    "確認後は入口の利用記録に終了時刻を書く。",

  "N2-integrated-coworking-call-evening":
    "小部屋には机一台と電源がありますが、防音ではありません。内容を周囲に聞かれたくない通話には利用しないでください。受付での荷物預かりは行いません。混雑状況は入口の画面で確認できますが、空室の取り置きはできません。利用終了時は机を拭き、忘れ物がないか確認してください。",
  "N2-integrated-digital-ticket-access":
    "導入前には、通信を切った端末や画面の割れた端末でも本人確認ができるかを試したい。窓口の担当者が同じ説明を受け、どの入口でも対応が変わらないことも重要である。",
  "N2-integrated-language-course-speaking":
    "動画の例文は買い物、道案内、休日の予定など身近な場面が中心です。録音へのコメントでは、講師が自然な言い方を示しますが、受講者がその場で返事をする機会はありません。質問会の内容は後日公開しないため、参加できない人は質問をフォームから送ってください。",
  "N2-integrated-apartment-renovation-priority":
    "工事中も正面入口は利用できますが、中庭側の通路は通れません。ベンチと日よけの保証期間は二年間です。完成後半年間は利用状況を調べ、夜間の音が問題になった場合は利用時間を短くします。来年の入口工事を実施する時期は、今回の案では決めません。",
  "N2-integrated-volunteer-regular-contact":
    "主催者は活動ごとに担当を変えるため、同じ子どもと続けて関わることは約束できません。説明役を経験した人でも、当日の人数によって受付を担当する場合があります。活動後の報告会はありませんが、気づいた点は専用フォームで送れます。",
  "N2-integrated-book-review-practical-change":
    "各章は、家庭、学校、職場という異なる場面を取り上げ、同じ行動でも周囲の条件によって続きやすさが変わることを示す。読み進めるには時間がかかるが、習慣について抱いていた考えを問い直したい人には役立つだろう。著者の主張を整理した章末要約はあるものの、読者がすぐ試すための手順は示されていない。",
  "N2-integrated-flex-work-team-overlap":
    "毎日の共有は、勤務終了の三十分前までに行う。まだ決まっていない点を無理に結論として書かず、相談が必要な相手と期限を示す。全員が同じ場所へ出社する必要はなく、共通時間の打ち合わせにもオンラインで参加できるようにしたい。",
  "N2-integrated-museum-guide-child-choice":
    "道具は館が用意し、自分の材料は持ち込めません。作業中はスタッフが安全を確認しますが、作品の形や色は決めません。途中で展示室へ戻ることはできないため、活動前に参考にしたい展示をよく見てください。",

  "N2-info-community-room-cooking":
    "利用責任者は当日、受付で鍵と点検表を受け取り、終了後に返却してください。",
  "N2-info-library-research-consultation":
    "予約時刻を十分過ぎても連絡がない場合は取消扱いです。相談記録の写しが必要な人は終了時に申し出てください。",
  "N2-info-bicycle-share-visitor-day":
    "利用中に自転車を一時的に離れる場合も、必ず付属の鍵をかけてください。盗難時は利用者負担となる場合があります。",
  "N2-info-small-business-seminar-plan":
    "講座資料の転載は禁止は禁止です。領収書が必要な人は支払時に事業者名を登録してください。",

  "N1-short-metric-behavior-shift":
    "評価する側は、数字がどんな行動を生んだかも点検しなければならない。",
  "N1-short-meeting-silence-signal":
    "必要なら会議前に匿名で論点を集め、発言以外の入口も用意したい。",
  "N1-short-archive-selection-meaning":
    "選択の基準自体も記録し、後から検討できるようにする必要がある。",
  "N1-short-forecast-action-threshold":
    "条件が変われば、その基準を見直す時期も決めておきたい。",
  "N1-short-standard-exception-learning":
    "似た例外が続くなら、個別対応を増やすより手順の前提を改めるべきだろう。",
  "N1-short-public-feedback-selection-bias":
    "必要に応じて無作為調査など別の方法と組み合わせるべきだ。",
  "N1-short-expertise-participation-role":
    "その問いによって、技術的な検討の範囲も変わり得るのである。",

  "N1-info-archive-restricted-records":
    "閲覧した資料をSNSや共有サイトへ載せる行為も、個人的な撮影の範囲には含まれません。公開予定が生じた時点で掲載申請を行ってください。館内で得た個人情報は研究目的外に利用できず、要審査資料のメモを共同研究者へ渡す場合も申請時に利用者として記載する必要があります。",
  "N1-info-conference-revised-paper":
    "発表言語は日本語または英語です。英語発表には日本語題目も添えてください。要旨の共同著者全員が内容を確認したことを、筆頭発表者が申込画面で申告します。会場で使用するパソコンは各自で持参し、映像を使用する人は前日までに接続確認の時間を予約できます。配布資料の印刷は事務局では行いません。",
  "N1-info-residency-community-research":
    "公開会を録画して後日配信する場合は、参加する住民の同意を別に確認してください。Bの採択者は滞在開始の一か月前までに協働先との役割分担表を提出します。活動費で購入した単価3万円以上の機材は、終了後に拠点へ残すことを原則とし、持ち帰りを希望する場合は申請が必要です。",
  "N1-info-laboratory-booking-after-hours":
    "装置の予約名義を他人へ貸すことはできません。共同研究者が操作する場合も、その人自身が利用者講習を修了している必要があります。時間外に警報が鳴った場合は作業を中止し、試料を安全な場所へ置いて全員で退室してください。非常連絡後、許可があるまで再入室できません。事故や試料の漏れは、翌営業日までに報告書を提出します。",
  "N1-info-public-consultation-accessibility":
    "口頭記録には手話通訳または要約筆記を用意できます。予約時に希望する支援を伝えてください。代理人が提出する場合は、本人の連絡先に加えて代理人の氏名と関係を記載します。添付資料だけを提出し、意見本文がないものは受理しません。公表前に内容を本人へ確認する手続きはありません。",
  "N1-info-manuscript-digitization-color":
    "資料の受渡しは来館または追跡可能な宅配便で行い、送料と保険料は依頼者が負担します。館が指定する梱包条件を満たさない資料は受付できません。撮影中に新たな破損の危険が見つかった場合は作業を止め、撮影範囲または台の変更について依頼者の承認を得てから再開します。",
  "N1-info-executive-program-coaching":
    "実践・伴走コースの対面演習では、自部署の事例を用いた討議を行います。守秘義務上共有できない情報は、申込前に内容を置き換えてください。課題の再提出は一回だけ認め、期限は通知から7日以内です。修了証は全条件を満たした月の翌月に電子発行し、紙での発行には別料金がかかります。",
  "N1-info-ethics-review-calendar":
    "複数機関で同じ計画を実施する場合は、各機関の責任者と審査方法を申請書に記載します。代表機関の承認だけで開始できるかは、事前に事務局へ確認してください。匿名化済み資料でも、対応表を研究班が保有する場合は「匿名化済み既存資料のみ」には当たりません。判断に迷う区分は締切前に相談できます。",
};

function expandN2ReadingSeed(seed: UpperReadingSeed): UpperReadingSeed {
  const expansion = [
    N2_READING_LENGTH_EXPANSIONS[seed.semanticId],
    RELEASE_GATE_EXPANSIONS[seed.semanticId],
  ]
    .filter((value): value is string => Boolean(value))
    .join("\n");
  const revisedSeed = N2_READING_REVISIONS[seed.semanticId] ?? seed;
  if (!expansion) return revisedSeed;
  const finalIndex = revisedSeed.sources.length - 1;
  return {
    ...revisedSeed,
    sources: revisedSeed.sources.map((source, index) =>
      index === finalIndex
        ? { ...source, body: `${source.body}\n${expansion}` }
        : source,
    ),
  };
}

function expandN1ReadingSeed(seed: UpperReadingSeed): UpperReadingSeed {
  const revisedSeed: UpperReadingSeed =
    seed.semanticId === "N1-thematic-authenticity-performance"
      ? {
          ...seed,
          semanticFocus:
            "heritage performances remain accountable by distinguishing contexts and decision authority",
          question:
            "観光向けの上演と地域の儀礼の関係について、筆者が特に必要だと述べていることは何か。",
          options: [
            "観光客に見せるために変えた形は、伝統から完全に除くこと",
            "観光客の評価を、地域の担い手の判断より優先すること",
            "上演用の変更を唯一の正しい形として地域へ戻すこと",
            "二つの場面の違いと、変更を決める権限を記録・共有すること",
          ],
          correctIndex: 3,
          evidence: [
            "上演用と儀礼用の違いを記録し、誰がどの場面を決めるかを共有",
            "変更の理由と権限をどう明らかにするか",
          ],
          explanation:
            "The keyed inference is about accountable authority across performance contexts, not simply whether tradition may change. The author asks communities to distinguish tourist staging from ritual use and make visible who may decide and revisit each alteration.",
        }
      : seed;
  const expansion = [
    N1_READING_LENGTH_EXPANSIONS[seed.semanticId],
    RELEASE_GATE_EXPANSIONS[seed.semanticId],
  ]
    .filter((value): value is string => Boolean(value))
    .join("\n");
  if (!expansion) return revisedSeed;
  const finalIndex = revisedSeed.sources.length - 1;
  return {
    ...revisedSeed,
    sources: revisedSeed.sources.map((source, index) =>
      index === finalIndex
        ? { ...source, body: `${source.body}\n${expansion}` }
        : source,
    ),
  };
}

function positionReadingAnswers(
  seeds: readonly UpperReadingSeed[],
): readonly UpperReadingSeed[] {
  const familyCounts = new Map<UpperReadingFamily, number>();
  return seeds.map((seed) => {
    const familyIndex = familyCounts.get(seed.family) ?? 0;
    familyCounts.set(seed.family, familyIndex + 1);
    const targetIndex = (familyIndex % 4) as 0 | 1 | 2 | 3;
    if (targetIndex === seed.correctIndex) return seed;

    const options: [string, string, string, string] = [...seed.options];
    [options[seed.correctIndex], options[targetIndex]] = [
      options[targetIndex],
      options[seed.correctIndex],
    ];
    return { ...seed, options, correctIndex: targetIndex };
  });
}

export const N2_UPPER_READING_SEEDS: readonly UpperReadingSeed[] =
  positionReadingAnswers(
    [
      ...n2ShortSeeds,
      ...n2MidSeeds,
      ...n2IntegratedSeeds,
      ...n2ThematicSeeds,
      ...n2InformationSeeds,
    ].map(expandN2ReadingSeed),
  );

export const N1_UPPER_READING_SEEDS: readonly UpperReadingSeed[] =
  positionReadingAnswers(
    [
      ...n1ShortSeeds,
      ...n1MidSeeds,
      ...n1LongSeeds,
      ...n1IntegratedSeeds,
      ...n1ThematicSeeds,
      ...n1InformationSeeds,
    ].map(expandN1ReadingSeed),
  );

export const UPPER_READING_SEEDS = [
  ...N2_UPPER_READING_SEEDS,
  ...N1_UPPER_READING_SEEDS,
] as const satisfies readonly UpperReadingSeed[];
