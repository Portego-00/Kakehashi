import type { UpperListeningSeed } from "./upper-listening-seeds";

/**
 * Isolated N1 upper-listening expansion.
 *
 * This tranche deliberately remains separate from the production assembler so it
 * can receive an independent editorial review before integration. The ordering
 * contract is expressed by `questionTiming` and `audioOnlyOptions`; the player is
 * responsible for placing the question and choices around the recorded stimulus.
 */

const n1TaskExpansion = [
  {
    semanticId: "N1-task-procurement-pilot-reversible-sandbox",
    level: "N1",
    family: "listening-task",
    semanticFocus:
      "procurement lead runs a reversible sandbox before evaluating a citywide document system",
    script:
      "女：文書管理システムの候補が三つに絞れました。年度末も近いので、最も安い製品を全庁に入れてしまいましょうか。男：価格だけでは既存データの移行や権限設定の不具合が見えません。まず三製品を、実際の情報を含まない試験環境に入れ、同じ業務を一週間ずつ担当部署に試してもらってください。利用料の交渉は評価表がそろってからです。女：今のシステムの解約手続きは先に始めますか。男：移行できると確認するまでは解約しません。",
    question: "女の人は、まず何をすることになりましたか。",
    options: [
      "最も安い製品を全庁に導入する",
      "三製品を試験環境で同じ条件のもと試す",
      "候補会社と利用料を交渉する",
      "現在のシステムを解約する",
    ],
    correctIndex: 1,
    explanation:
      "The first action is a comparable, reversible sandbox trial. Price negotiation follows the evaluation, while citywide deployment and cancellation of the current system are explicitly premature.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N1-task-laboratory-calibration-quarantine",
    level: "N1",
    family: "listening-task",
    semanticFocus:
      "laboratory manager quarantines affected results after discovering calibration drift",
    script:
      "男：共同利用の分析装置で、標準試料の値が先月から少しずつずれていたことが分かりました。利用者全員に、結果が無効だと連絡しますか。女：影響範囲がまだ分からないので、そう断定はできません。まず、基準を外れた日以降の測定結果を未確定としてシステム上で保留し、装置の使用も止めてください。その後、保存してある標準試料は廃棄せず測り直して、ずれ始めた時点を特定します。装置を廃棄するかどうかは、保守会社の診断を待ちます。",
    question: "男の人が、最初にしなければならないことは何ですか。",
    options: [
      "利用者にすべての結果が無効だと知らせる",
      "標準試料を直ちにすべて廃棄する",
      "疑いのある結果を保留し装置の使用を止める",
      "保守会社の診断前に装置を処分する",
    ],
    correctIndex: 2,
    explanation:
      "Because the affected interval is unknown, the lab first prevents further use and quarantines potentially affected results. Notification scope and disposal decisions require later evidence.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N1-task-rail-elevator-alternative-route",
    level: "N1",
    family: "listening-task",
    semanticFocus:
      "rail operations officer verifies an accessible alternative before announcing an elevator outage",
    script:
      "女：中央駅のエレベーターが明朝から三日間使えないと保守会社から連絡がありました。ウェブに故障だけ載せておきますか。男：それでは車いすの利用者が駅まで来てから困ります。隣駅の設備が動いているかを確認し、低床バスへの乗り継ぎを含む代替経路を実際にたどって、所要時間も出してください。駅員向けの案内は経路が確定してから作ります。工事の延期は安全上できません。女：では、運賃の払い戻し方針はその後、営業部に確認します。",
    question: "女の人は、このあとまず何をしますか。",
    options: [
      "利用できる代替経路を確認して所要時間を調べる",
      "故障の事実だけをウェブに掲載する",
      "駅員向けの案内を先に作成する",
      "保守工事を延期する",
    ],
    correctIndex: 0,
    explanation:
      "A usable accessible route must be verified before public and staff guidance is issued. Merely announcing the outage is inadequate, and the safety work cannot be postponed.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N1-task-contract-language-controlling-version",
    level: "N1",
    family: "listening-task",
    semanticFocus:
      "legal coordinator identifies the controlling signed contract before reconciling divergent translations",
    script:
      "男：共同事業の契約書で、日本語版と英語版の解約条件が食い違っています。英語版の表現を日本語に合わせて直しますか。女：編集用のファイルだけを見て判断してはいけません。まず双方が署名した版を取り寄せ、どちらの言語を優先すると定めた条項があるか確認してください。相手方への修正案は法務部の解釈が出てからです。男：現場には英語版を無視するよう伝えますか。女：それもまだです。確認が済むまで、新しい解約通知を出さないよう担当者に伝えてください。",
    question: "男の人は、まず何をする必要がありますか。",
    options: [
      "英語版を日本語版に合わせて書き換える",
      "相手方へ修正案を送る",
      "現場に英語版を無視するよう指示する",
      "署名済みの契約で優先言語の条項を確認する",
    ],
    correctIndex: 3,
    explanation:
      "The controlling signed text and its governing-language clause must be established first. Editing, proposing amendments, or telling staff to disregard one version would prejudge that inquiry.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N1-task-citizen-panel-recruitment-gap",
    level: "N1",
    family: "listening-task",
    semanticFocus:
      "citizen-panel organizer diagnoses a recruitment gap before sending targeted invitations",
    script:
      "女：交通計画の市民会議ですが、若い世代の応募が少ないので、大学へ追加募集を出そうと思います。男：その前に、応募者を年齢だけでなく、居住地区、移動手段、参加できる時間帯で集計してください。若者が少なく見えても、問題が募集先なのか、夜の会議時間なのかで対策が変わります。女：締め切りを一律に延ばすのはどうですか。男：不足している層が分かってから判断します。抽選も、構成目標を確定する前には行いません。",
    question: "女の人は、まず何をしますか。",
    options: [
      "大学だけに追加募集を出す",
      "応募状況を地区や移動手段、時間帯でも集計する",
      "応募の締め切りを全員分延長する",
      "現在の応募者から直ちに抽選する",
    ],
    correctIndex: 1,
    explanation:
      "The organizer must diagnose which participation dimensions are missing before choosing recruitment, scheduling, extension, or selection measures.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N1-task-construction-archaeological-find",
    level: "N1",
    family: "listening-task",
    semanticFocus:
      "site supervisor protects and records an archaeological find without unnecessarily closing the whole project",
    script:
      "男：配管工事中に、古い陶器のような破片がまとまって出てきました。工程が遅れるので、写真だけ撮って掘削を続けてもいいでしょうか。女：現場判断で動かしてはいけません。まず発見地点を囲って、その区画だけ作業を止め、位置と露出した状態を記録してください。文化財担当への連絡は私が記録を添えて行います。工事全体を中止する必要があるかは担当者が判断しますし、破片の洗浄も専門家が来るまでしません。",
    question: "男の人は、最初に何をしなければなりませんか。",
    options: [
      "発見区画を保護して位置と状態を記録する",
      "写真を撮ったあと掘削を続ける",
      "工事現場全体を直ちに閉鎖する",
      "出てきた破片を洗浄する",
    ],
    correctIndex: 0,
    explanation:
      "He must stop and protect only the affected area and document the find in situ. Continuing, washing artifacts, or independently stopping the entire project exceeds or violates the stated procedure.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N1-task-festival-weather-capacity-check",
    level: "N1",
    family: "listening-task",
    semanticFocus:
      "festival organizer verifies safe indoor capacity before reallocating weather-threatened performances",
    script:
      "女：週末は強風の予報です。屋外舞台の公演を、空いている市民会館に全部移すと発表してもいいですか。男：会館は空いていても、客席数と避難経路が屋外券の人数に対応できるとは限りません。まず施設側に、舞台設備を置いた状態での安全な収容人数を文書で確認してください。入らない場合の回別振り替えは、その数字を基に決めます。払い戻しの案内も、公演方式が確定してからです。屋外開催の可否は明日の気象情報で最終判断します。",
    question: "女の人が、まず確認することは何ですか。",
    options: [
      "全公演を市民会館へ移すと発表する",
      "来場者への払い戻し方法",
      "会館の設備配置を踏まえた安全な収容人数",
      "屋外公演を予定どおり行うこと",
    ],
    correctIndex: 2,
    explanation:
      "Safe indoor capacity is the dependency for deciding transfers, performance divisions, and refunds. The outdoor decision remains pending the next forecast.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N1-task-water-sensor-manual-verification",
    level: "N1",
    family: "listening-task",
    semanticFocus:
      "water utility verifies an anomalous sensor reading before defining a public-health response",
    script:
      "男：北部の水質センサーが一度だけ基準を超えました。住民に煮沸を呼びかけますか。女：健康に関わるので軽視はできませんが、直前に校正作業もありました。まず同じ地点と上流で採水し、携帯測定器と検査室の二系統で至急確認してください。センサーを交換するかは、その結果と自己診断記録を見て決めます。給水区域を停止する場合は代替給水を準備してからです。基準超過が再現されれば、保健当局と同時に住民へ知らせます。",
    question: "男の人は、このあと最初に何をしますか。",
    options: [
      "直ちに全住民へ煮沸を呼びかける",
      "結果を待たずにセンサーを交換する",
      "代替給水なしで給水区域を停止する",
      "複数地点で採水し二つの方法で値を確認する",
    ],
    correctIndex: 3,
    explanation:
      "The anomalous reading is urgent but potentially affected by calibration, so independent sampling and two-method confirmation come first; escalation follows evidence and operational preparation.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
] as const satisfies readonly UpperListeningSeed[];

const n1KeyPointExpansion = [
  {
    semanticId: "N1-key-congestion-pilot-transition-confound",
    level: "N1",
    family: "listening-key-points",
    semanticFocus:
      "economist withholds a transit-effect conclusion because a congestion pilot coincided with service disruption",
    script:
      "女：都心への課金実験で自動車は減ったのに、鉄道利用は増えませんでした。課金では公共交通への転換は起きないということでしょうか。男：そう結論づけるのは早いでしょう。実験期間中、主要路線が工事で減便され、在宅勤務も例年より多かった。自動車から何に移ったのかを示す移動記録も十分ではありません。課金の効果がなかったというより、代替手段が通常どおり使える条件で測れていないのです。女：時期を変え、徒歩や自転車も含めて追う必要がありますね。",
    question:
      "男の人が、この実験から結論を出せないと考える主な理由は何ですか。",
    options: [
      "自動車の減少が鉄道の増加より大きかったから",
      "鉄道の減便などが重なり、通常条件で転換先を測れていないから",
      "在宅勤務が増え、自動車と鉄道の両方が同じだけ減ったから",
      "徒歩と自転車を転換先として事前に除外したから",
    ],
    correctIndex: 1,
    explanation:
      "The observed period combined reduced rail service, unusual remote work, and incomplete mode data, so it cannot isolate whether pricing induces normal-condition mode switching.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N1-key-archive-silence-recording-practice",
    level: "N1",
    family: "listening-key-points",
    semanticFocus:
      "historian treats archival silence as evidence about recording practices rather than absence of events",
    script:
      "男：この時期の港の争議について、公文書にはほとんど記録がありません。つまり大きな対立はなかったのでしょうか。女：むしろ、何が記録対象になったかを問うべきです。当時の報告書は荷物の量と税収を中心に作られ、臨時労働者の訴えは正式な手続きに入らない限り残りませんでした。記録がないことは、出来事がなかった証明ではなく、行政がそれを出来事として数えなかった可能性を示します。男：別の団体の日記や新聞とも照合する必要がありますね。",
    question: "女の人は、公文書に記録が少ないことをどう捉えていますか。",
    options: [
      "行政が何を記録対象としたかを示す手がかりだ",
      "記録が少ない以上、争議の規模は限定的だった手がかりだ",
      "報告書が税収中心だったため、港の資料全体に価値がない",
      "正式手続きに入らない訴えも、公文書に十分残っている",
    ],
    correctIndex: 0,
    explanation:
      "She interprets absence through the institution's recording rules: silence may reveal what was excluded from official categories, not the absence of conflict itself.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N1-key-replication-measurement-boundary",
    level: "N1",
    family: "listening-key-points",
    semanticFocus:
      "scientist locates a replication discrepancy in different measurement boundaries",
    script:
      "女：別の研究室が同じ実験をしたら、効果が半分しか出なかったそうです。元の結果が誤りだったのでしょうか。男：数値だけなら矛盾して見えますが、両者は『回復』を同じように測っていません。私たちは治療直後の機能を、相手は三か月後に再発がない状態を基準にしました。試料の扱いにも差はありますが、まず比較すべきなのは測定の境界です。定義をそろえずに、再現できなかったとも再現したとも言えません。",
    question: "男の人が最も重視している点は何ですか。",
    options: [
      "試料の扱いに差があるため、元研究の数値だけを採用すべきだということ",
      "効果が半分だったため、どちらか一方の研究だけが正しいということ",
      "効果を測る時点と定義が研究間で異なること",
      "三か月後の再発は回復の定義から外すべきだということ",
    ],
    correctIndex: 2,
    explanation:
      "His primary point is construct comparability: the studies operationalize recovery at different times and with different criteria, so their effect sizes are not yet directly comparable.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N1-key-mixed-use-temporal-access",
    level: "N1",
    family: "listening-key-points",
    semanticFocus:
      "planner argues that density works only when daily destinations are accessible at relevant times",
    script:
      "男：駅前の人口密度を上げれば、自動車に頼らない町になりますよね。女：住宅の数だけ増やしても不十分です。保育所は夕方早く閉まり、診療所は平日の昼だけ、食料品店は家賃が上がって撤退した、という地域もあります。地図上で施設が近くても、住民が必要な時間に利用できなければ、結局遠くへ移動します。密度は条件を整える一つの手段であって、目的そのものではありません。",
    question: "女の人は、車に頼らない町にするため何が重要だと考えていますか。",
    options: [
      "人口密度を先に上げれば、生活施設は後から自然に増えると考えること",
      "施設までの物理的な距離だけを短くすること",
      "すべての生活施設の営業時間を同じにすること",
      "生活に必要な場所を必要な時間に利用できること",
    ],
    correctIndex: 3,
    explanation:
      "She reframes proximity as temporal and practical access. Density can support that goal but does not guarantee usable services or reduced car dependence.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N1-key-headline-obscured-agency",
    level: "N1",
    family: "listening-key-points",
    semanticFocus:
      "editor rejects a nominally neutral headline because passive wording hides responsible agency",
    script:
      "女：事故の記事の見出しを『安全基準に不備、住民に影響』としました。感情的でなく中立的ですよね。男：言葉が穏やかでも、中立とは限りません。その表現では、基準を誰が緩め、警告を誰が見送ったのかが消えています。本文で責任の所在を確認できているなら、行為者を見出しから外すことは慎重さではなく、重要な因果関係をぼかすことになります。女：断定の根拠を示しつつ、主体も明記するということですね。",
    question: "男の人は、見出しの何が問題だと考えていますか。",
    options: [
      "住民への影響を見出しの中心に置いていること",
      "行為の主体を隠して責任関係を分かりにくくしていること",
      "責任主体を本文だけでなく見出しにも記そうとしていること",
      "安全基準という語に具体的な数値を添えていないこと",
    ],
    correctIndex: 1,
    explanation:
      "The editor's concern is not emotional tone but erased agency: passive abstraction can conceal who made the consequential decisions already established by reporting.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N1-key-ai-feedback-homogenized-revision",
    level: "N1",
    family: "listening-key-points",
    semanticFocus:
      "educator worries that automated feedback narrows students' revision choices into one rhetorical pattern",
    script:
      "男：文章指導に自動添削を入れたら、誤字も減り、構成も整いました。成功と言ってよさそうですね。女：読みやすさは上がりましたが、提出された文章がどれも同じ順序で反論を処理するようになりました。学生が助言を検討したのか、表示された修正を最短で受け入れたのかも分かりません。誤りの減少だけを見れば、異なる主張の組み立て方を試す機会が失われたことを見落とします。男：修正理由を説明させる必要がありますね。",
    question: "女の人が、自動添削について最も懸念していることは何ですか。",
    options: [
      "学生の文章と修正過程が画一化していること",
      "誤字の減少が統計的に十分大きいか確認できないこと",
      "学生が表示された修正を受け入れる速さを測っていないこと",
      "反論を同じ順序で書くほうが常に読みやすいこと",
    ],
    correctIndex: 0,
    explanation:
      "Her concern is homogenization of both rhetorical form and decision-making, which surface improvements in correctness can conceal.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N1-key-apology-unacknowledged-impact",
    level: "N1",
    family: "listening-key-points",
    semanticFocus:
      "mediator explains that an apology failed because it defended intent without acknowledging impact",
    script:
      "女：部長は『傷つける意図はなかったが、不快にさせたなら謝る』と言ったのに、話し合いが余計にこじれました。男：相手が求めていたのは、意図が悪かったという告白ではありません。発言によって提案が会議から外され、その後も発言しにくくなったという影響を認めることです。条件付きの謝罪で自分の意図を説明すると、その経験を相手の受け取り方の問題に戻してしまいます。女：まず起きた影響に応答すべきだったんですね。",
    question: "男の人によると、謝罪が受け入れられなかった主な理由は何ですか。",
    options: [
      "悪意がなかったことを最初に説明しなかったから",
      "謝罪の文を事前に相手へ見せなかったから",
      "発言が生んだ具体的な影響を認めなかったから",
      "会議から外れた提案を直ちに採用しなかったから",
    ],
    correctIndex: 2,
    explanation:
      "The failed apology centers the speaker's intent and makes harm conditional, instead of acknowledging the documented exclusion and chilling effect on participation.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
  {
    semanticId: "N1-key-visitor-limit-recovery-window",
    level: "N1",
    family: "listening-key-points",
    semanticFocus:
      "conservationist frames visitor limits as timed ecological recovery rather than permanent exclusion",
    script:
      "男：湿地の一部を立入禁止にするのは、自然を人から切り離す考え方ではありませんか。女：一年中閉じる提案ではありません。渡り鳥が休む六週間だけ、人の通行が集中する二本の道を閉じ、外周の観察路は開けます。重要なのは来訪者数をゼロにすることではなく、採食で失ったエネルギーを鳥が補える時間帯と場所を確保することです。効果がなければ範囲も見直します。",
    question: "女の人が立入りを制限する主な目的は何ですか。",
    options: [
      "外周の観察路へ来訪者を集中させること",
      "湿地全体の年間来訪者数を一定以下にすること",
      "閉鎖する二本の道の管理負担を減らすこと",
      "渡り鳥が必要な時期に休息と採食をできるようにすること",
    ],
    correctIndex: 3,
    explanation:
      "The measure is targeted in time and space to protect recovery conditions, while maintaining an observation route and committing to revise the boundary based on outcomes.",
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
  },
] as const satisfies readonly UpperListeningSeed[];

const n1OutlineExpansion = [
  {
    semanticId: "N1-outline-redundancy-institutional-memory",
    level: "N1",
    family: "listening-outline",
    semanticFocus:
      "lecturer reframes limited organizational redundancy as a carrier of judgment and memory",
    script:
      "講師：組織改革では、同じ仕事が二か所で行われていると、すぐ『重複』として削減の対象になります。確かに、責任が曖昧な二重作業は減らすべきです。しかし、担当者が互いの判断過程を知り、一方が欠けたときに理由ごと引き継げる重なりまでなくすと、表面上は効率化しても、例外に対応する力が失われます。手順書に残るのは決定の型であって、なぜ今回は型を外したかという記憶ではありません。冗長性を無条件に守るのでも排除するのでもなく、どの重なりが組織の学習を支えているかを見分ける必要があります。",
    question: "講師が最も伝えたいことは何ですか。",
    options: [
      "重複を減らす前に、判断理由をすべて手順書へ移しておくべきだ",
      "例外への対応を標準化できれば、担当者間の重なりもなくせる",
      "判断の継承を支える重なりまで一律に削るべきではない",
      "責任分担が曖昧でも、引き継ぎに役立つ二重作業は残すべきだ",
    ],
    correctIndex: 2,
    explanation:
      "The lecturer distinguishes wasteful duplication from overlap that transmits contextual judgment and preserves resilience; the point is selective evaluation, not blanket preservation.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N1-outline-maps-negotiated-choices",
    level: "N1",
    family: "listening-outline",
    semanticFocus:
      "speaker presents maps as purpose-bound arguments whose omissions require scrutiny",
    script:
      "講師：地図を見ると、土地の状態が客観的に写し取られているように感じます。けれども、境界線をどこに引くか、何を大きく表示し、何を名前すら載せないかは、地図の目的によって変わります。防災地図で避難所を強調すること自体は不正確ではありませんが、夜間に閉じる門や、車いすでは通れない坂が省かれれば、利用者にとっての現実は異なります。だから地図を疑って捨てるのではなく、だれが何のために作り、どの選択が見えなくなっているかを読み取ることが、正確に使う条件なのです。",
    question: "講師の主張として最も適切なものはどれですか。",
    options: [
      "地図の目的と省略された条件を確認して利用すべきだ",
      "目的の違う地図も、表示項目を共通化すれば同じように利用できる",
      "防災地図では利用条件より避難所の位置を優先すべきだ",
      "目的上の省略は誤りではないので、読み手が検討する必要はない",
    ],
    correctIndex: 0,
    explanation:
      "The talk rejects both naive objectivity and wholesale distrust: maps are useful representations whose purposes, emphases, and omissions must be read critically.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N1-outline-library-quiet-and-encounter",
    level: "N1",
    family: "listening-outline",
    semanticFocus:
      "library director reconciles quiet concentration with civic encounter through spatial and temporal design",
    script:
      "館長：図書館に催しや会話の場を増やすと、静かに本を読みたい人から『本来の役割を失った』と言われます。一方、全館を沈黙の空間にすれば、相談したり、異なる背景の人と学んだりする公共性が弱まります。ここで、静けさか交流かの二択にする必要はありません。音が伝わりにくい配置、時間帯ごとの使い分け、声を出せる場所まで迷わず行ける表示を組み合わせれば、双方を単に妥協させるのではなく、それぞれの活動に集中できる条件を作れます。図書館の役割は一つに固定するより、両立の設計に現れるのです。",
    question: "館長が最も言いたいことは何ですか。",
    options: [
      "会話を伴う催しの時間を増やせば、図書館の公共性は高まる",
      "空間と時間の設計によって静けさと交流を両立できる",
      "静かな閲覧を全館の基本とし、交流は催しの時間だけ認めるべきだ",
      "利用者同士で音量を調整できれば、空間を分ける必要はない",
    ],
    correctIndex: 1,
    explanation:
      "The director resists a binary institutional identity and argues that zoning, timing, acoustics, and wayfinding can actively support both purposes.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N1-outline-failed-prediction-model-boundary",
    level: "N1",
    family: "listening-outline",
    semanticFocus:
      "scientist treats failed predictions as evidence for revising a model's domain rather than abandoning models",
    script:
      "研究者：予測が外れると、そのモデルは役に立たないと言われがちです。しかし、外れ方には情報があります。ある条件まではよく当たり、境界を越えた途端に一定方向へずれるなら、理論の中心より、適用範囲の想定に問題があるかもしれません。もちろん、都合の悪い結果をすべて『範囲外』として退ければ反証不能になります。事前に適用条件を示し、外れた事例を含めて境界を更新する。その手続きがあって初めて、予測の失敗はモデルを捨てる理由ではなく、どこまで信頼できるかを明確にする材料になります。",
    question: "研究者の考えとして最も適切なものはどれですか。",
    options: [
      "予測の失敗数を減らすため、適用範囲を狭く公表すべきだ",
      "よく当たる条件だけを残せば、モデルの有効性を示せる",
      "事前の適用条件より、結果を見た後の説明を優先すべきだ",
      "失敗の仕方を用いて適用条件を検証し直すべきだ",
    ],
    correctIndex: 3,
    explanation:
      "The speaker advocates predeclared boundaries and learning from patterned failures, while explicitly rejecting ad hoc exclusion of inconvenient evidence.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N1-outline-replica-transforms-access",
    level: "N1",
    family: "listening-outline",
    semanticFocus:
      "curator argues that replicas create distinct forms of access rather than merely substituting for originals",
    script:
      "学芸員：精巧な複製を展示すると、『本物でなければ意味がない』という批判と、『同じ形なら本物は不要だ』という意見の両方が出ます。けれども、複製は単なる代用品ではありません。原資料では許されない角度から見たり、触れて構造を確かめたり、失われた色を仮説として重ねたりできます。その一方、素材が経た時間や所有の歴史は再現できません。原物と競わせるのではなく、複製によって何が新しく経験でき、何がなお届かないのかを明示すれば、アクセスという言葉自体を豊かに捉え直せます。",
    question: "学芸員が最も主張したいことは何ですか。",
    options: [
      "原物の保存が難しい場合に限り、複製を代用品として展示すべきだ",
      "触れられる複製なら、素材が経た歴史も原物と同じように経験できる",
      "複製の可能性と限界を示し異なるアクセスとして活用すべきだ",
      "複製で新しい経験ができるなら、原物との違いは強調しないほうがよい",
    ],
    correctIndex: 2,
    explanation:
      "The curator positions replicas neither as worthless copies nor complete replacements, but as affordances that expand access while leaving material history unreproduced.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N1-outline-review-productive-friction",
    level: "N1",
    family: "listening-outline",
    semanticFocus:
      "manager distinguishes purposeful review friction from indiscriminate procedural delay",
    script:
      "管理職：申請を速くするため、確認段階を減らそうという提案があります。利用者を待たせないことは重要です。ただ、異なる部署が同じ資料を見るのは、いつも無駄な重複とは限りません。現場は実行可能性を、法務は権利への影響を、会計は将来の負担を見ています。問題は確認者が多いことより、何を判断する段階なのか示さず、同じ問いを繰り返すことです。各段階の役割と期限を明確にし、重大な異論だけを早く共有するなら、摩擦は速度の敵ではなく、後戻りを防ぐ仕組みになります。",
    question: "管理職が最も言いたいことは何ですか。",
    options: [
      "役割と期限が明確な確認は後の手戻りを減らせる",
      "異なる観点を確保するためなら、各段階で同じ問いを確認してもよい",
      "重大な異論も各部署の内部で処理し、共有しないほうが速い",
      "法務と会計の確認を実行後にまとめれば、速度と安全を両立できる",
    ],
    correctIndex: 0,
    explanation:
      "The speaker opposes both indiscriminate removal and accumulation of review: differentiated, time-bounded scrutiny can be productive friction rather than repetition.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N1-outline-standard-language-and-variation",
    level: "N1",
    family: "listening-outline",
    semanticFocus:
      "linguist frames standard language as useful coordination that should not erase contextual variation",
    script:
      "言語学者：共通の書き方を定めると、地域や組織を越えて情報を伝えやすくなります。その効用を否定する必要はありません。問題は、標準から外れる表現を、不正確あるいは未熟だとみなし始めるときです。方言や職業集団の言い回しには、その場の関係や経験を細かく区別する働きがあります。公的な場で共通形式を使うことと、別の形式を劣ったものとして消すことは同じではありません。標準を入口として共有しながら、どの差異がどんな知識を担っているかも保存する姿勢が必要です。",
    question: "言語学者の主張として最も適切なものはどれですか。",
    options: [
      "共通形式は公的な場だけに限定し、地域表現とは切り離して扱うべきだ",
      "共通形式を活用しつつ地域的な表現が担う知識も尊重すべきだ",
      "地域表現を守るには、公的な場でも標準を使わないほうがよい",
      "相互理解のため、地域表現が担う知識も共通形式に統一すべきだ",
    ],
    correctIndex: 1,
    explanation:
      "The linguist recognizes the coordinating value of standards while warning against turning standardization into a hierarchy that erases situated knowledge.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N1-outline-climate-story-scale-and-agency",
    level: "N1",
    family: "listening-outline",
    semanticFocus:
      "communicator links global climate scale to credible local agency without reducing the structural problem",
    script:
      "講演者：気候変動を説明するとき、地球規模の数字だけを示せば、自分の生活とは遠い問題に見えます。逆に、家庭でできる小さな行動だけを並べれば、制度や産業の選択が見えなくなり、結果が出ない責任を個人に負わせかねません。必要なのは規模を一つに決めることではなく、つなぐことです。地域の断熱改修が健康と電力需要をどう変え、それが都市の投資や国の制度とどう結びつくかを示す。身近さは問題を小さくするためではなく、構造に参加できる入口として語るべきです。",
    question: "講演者が最も伝えたいことは何ですか。",
    options: [
      "個人の行動を中心に示せば、制度の問題も身近に理解できる",
      "制度や産業の構造を正確に示し、身近な例は補足にとどめるべきだ",
      "地域施策の効果を示せば、国の制度との関係まで説明する必要はない",
      "身近な行動と制度的な変化のつながりを示すべきだ",
    ],
    correctIndex: 3,
    explanation:
      "The argument joins scales: local examples should provide an entry into collective and structural action, not shrink the problem or individualize responsibility.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
  },
] as const satisfies readonly UpperListeningSeed[];

const n1QuickResponseExpansion = [
  {
    semanticId: "N1-quick-causal-claim-restraint",
    level: "N1",
    family: "listening-quick-response",
    semanticFocus:
      "responding to a premature causal claim with proportionate evidential restraint",
    script: "この改善、うちの施策の効果だと発表して構いませんよね。",
    question: "最も適切な応答を選んでください。",
    options: [
      "ええ、導入と改善の時期が重なる点を強調すれば十分です。",
      "他の要因をまだ分けられないので、関連が見られたとしましょう。",
      "改善幅が大きいので、施策の寄与が中心だったと説明しましょう。",
    ],
    correctIndex: 1,
    explanation:
      "The appropriate reply preserves the observation while limiting the claim to association because competing causes have not been separated.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N1-quick-minutes-preserve-dissent",
    level: "N1",
    family: "listening-quick-response",
    semanticFocus:
      "preserving decision-relevant dissent in concise meeting minutes",
    script: "議事録には決定だけ残して、異論は省いておきますか。",
    question: "最も適切な応答を選んでください。",
    options: [
      "判断の条件が分かるよう、主な異論も要約して残してください。",
      "決定事項が伝われば、異論は口頭で共有するだけで十分でしょう。",
      "要約すると偏るので、結論前の発言をすべて逐語で残しましょう。",
    ],
    correctIndex: 0,
    explanation:
      "A concise record should preserve both the decision and the material reservations that define its conditions; neither erasing dissent nor erasing the decision is appropriate.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N1-quick-citation-before-release",
    level: "N1",
    family: "listening-quick-response",
    semanticFocus:
      "requiring source verification before releasing a quoted claim",
    script: "この引用の出典、公開したあとで確認しても間に合いますよね。",
    question: "最も適切な応答を選んでください。",
    options: [
      "引用符を外して要約にすれば、確認は省けるでしょう。",
      "先に公開して、問い合わせがあった場合だけ確かめましょう。",
      "いいえ、文脈も含めて確認してから公開しましょう。",
    ],
    correctIndex: 2,
    explanation:
      "Verification must precede publication because both wording and context affect whether the quotation fairly supports the claim.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N1-quick-budget-prioritize-scope",
    level: "N1",
    family: "listening-quick-response",
    semanticFocus:
      "responding to a budget shortfall by prioritizing scope rather than weakening every measure",
    script: "予算内に収めるには、調査項目を全部少しずつ削るしかないですね。",
    question: "最も適切な応答を選んでください。",
    options: [
      "全部を薄くする前に、判断に不可欠な項目を選びましょう。",
      "どれも同じだけ必要ですから、一律の割合で縮めましょう。",
      "調査期間を短くして、項目数だけは今のまま維持しましょう。",
    ],
    correctIndex: 0,
    explanation:
      "The reply challenges the false uniform-cut choice and proposes preserving decision-critical evidence by prioritizing scope.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N1-quick-low-use-access-barrier",
    level: "N1",
    family: "listening-quick-response",
    semanticFocus:
      "distinguishing weak demand from practical access barriers when use is low",
    script: "利用者が少ないのは、このサービスに需要がないからでしょうか。",
    question: "最も適切な応答を選んでください。",
    options: [
      "人数だけでは分からないので、時間や申込み方法も確かめましょう。",
      "広報不足でしょうから、申込み方法は変えず広告だけ増やしましょう。",
      "登録者数が少ない以上、利用条件を変えても需要は増えないでしょう。",
    ],
    correctIndex: 0,
    explanation:
      "Low observed uptake may reflect schedule or application barriers, so the response appropriately requests access evidence before inferring lack of demand.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N1-quick-failure-case-learning",
    level: "N1",
    family: "listening-quick-response",
    semanticFocus:
      "retaining an informative failure case instead of optimizing a presentation's impression",
    script: "この失敗例、発表では外したほうが全体の印象がよくなりませんか。",
    question: "最も適切な応答を選んでください。",
    options: [
      "ええ、限界については質問が出た場合だけ説明すれば十分です。",
      "原因を示せるなら、方法が通用しない条件として残しましょう。",
      "失敗例は付録へ移して、原因の説明は省きましょう。",
    ],
    correctIndex: 1,
    explanation:
      "An explained failure can delimit the method's valid conditions. Removing it merely for appearance would distort the evidence.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N1-quick-alternate-approval-route",
    level: "N1",
    family: "listening-quick-response",
    semanticFocus:
      "using an authorized alternate approver rather than bypassing a control",
    script: "担当者が休みなので、今回は承認の手順を飛ばしてもいいですよね。",
    question: "最も適切な応答を選んでください。",
    options: [
      "定型の案件なら、今回は事後承認にしてよいでしょう。",
      "別部署の人に口頭で見てもらえば、正式な承認扱いにできます。",
      "手順は飛ばさず、規程にある代行者へ回してください。",
    ],
    correctIndex: 2,
    explanation:
      "Absence does not justify bypassing approval; the authorized delegation route preserves both timeliness and the control.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
  {
    semanticId: "N1-quick-premise-needed-for-conclusion",
    level: "N1",
    family: "listening-quick-response",
    semanticFocus:
      "preserving the premise required to interpret a concise conclusion",
    script: "説明が長いので、前提は省いて結論だけにしてしまいませんか。",
    question: "最も適切な応答を選んでください。",
    options: [
      "読者が結論から推測できるので、前提はすべて省きましょう。",
      "誤解に関わる前提は残し、ほかを整理しましょう。",
      "結論を先に示せば、前提は質疑で補えばよいでしょう。",
    ],
    correctIndex: 1,
    explanation:
      "The response accepts the need to edit but protects the premise necessary for correct interpretation, trimming less consequential material instead.",
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
  },
] as const satisfies readonly UpperListeningSeed[];

const n1IntegratedExpansion = [
  {
    semanticId: "N1-integrated-night-bus-shift-connections",
    level: "N1",
    family: "listening-integrated",
    semanticFocus:
      "city redesigns night buses around shift connections with a bounded pilot and protected driver rest",
    script:
      "ナレーション：市が、深夜バスの利用が伸びない理由と今後の運行について検討会を開いています。交通分析官が説明します。交通分析官：現在の路線は中心駅を午前零時に出ますが、病院や物流施設の交代時間は零時十五分前後です。平均乗車人数は少ないものの、金曜だけは多いという見方も、実は終電後に臨時便を出した二日間の数字に引っ張られています。曜日別だけでなく、勤務終了時刻と接続の待ち時間を合わせて見る必要があります。ナレーション：病院の看護師が話します。看護師：夜勤が終わるのは零時十分ですが、引き継ぎが延びると二十分を過ぎます。今の便には間に合わず、次は一時間後なので、同僚とタクシーを分けています。病院前に必ず寄るより、終電から二十分後に駅を出て、勤務先の近くで予約がある停留所だけ回るなら利用できます。ただ、毎日予約方法が変わると困ります。ナレーション：バス会社の運行責任者が話します。運行責任者：出発を遅らせるだけなら可能ですが、終点到着が遅くなると翌朝便との間に必要な休息時間を確保できません。既存の乗務員を延長勤務させる案には応じられません。一方、金曜と土曜に限り、別の夜間班を組むことはできます。予約停留所方式なら距離も抑えられますが、予約がない人の最低限の移動も残す必要があります。ナレーション：障害者団体の代表が意見を述べます。団体代表：予約制自体には反対しませんが、スマートフォンだけにすると利用できない人がいます。また、車いす対応車両が予約後に変更されると、乗れるはずの便に乗れません。電話とウェブの両方で同じ締め切りまで受け付け、対応車両を固定してください。主要三停留所は予約がなくても通るべきです。ナレーション：以上の意見を踏まえ、市は三か月間の試行案を一つ選ぶことにしました。",
    question: "四人の意見と条件に最も合う深夜バスの試行はどれですか。",
    options: [
      "毎日、終電直後に中心駅を出て、主要三停留所には必ず停車する",
      "週末に出発を交代時間へ合わせ、主要停留所と複数手段の予約停留所を組み合わせる",
      "週末に出発を交代時間へ合わせ、ウェブ予約のあった停留所だけを回る",
      "週末に既存の乗務員の勤務を延ばし、現在と同じ全停留所を回る",
    ],
    correctIndex: 1,
    explanation:
      "The pilot aligns departure with actual shift endings, protects a basic fixed network and accessible booking, and uses a separate crew to respect rest rules. It also measures access failures and waiting time, not ridership alone.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
    sourceCount: 4,
  },
  {
    semanticId: "N1-integrated-open-access-rights-and-reciprocity",
    level: "N1",
    family: "listening-integrated",
    semanticFocus:
      "university adopts staged open access with retained rights, community consent, and accessible research summaries",
    script:
      "ナレーション：大学が、公的資金による研究成果を公開する新しい方針について協議しています。研究担当理事が説明します。担当理事：納税者が支えた研究を広く読めるようにすることは大学の責任です。来年度から、論文の採択後原稿を機関リポジトリで公開したい。ただ、分野によっては出版社との契約や共同研究者の同意が整うまで時間が必要です。公開件数だけを目標にすると、権利確認が形式的になるおそれがあります。ナレーション：若手研究者が話します。若手研究者：公開には賛成ですが、掲載料を払える研究室だけが選択肢を持つ仕組みは困ります。また、出版社へ著作権をすべて移した後では、大学に原稿を置けない場合があります。投稿時に一定の利用権を大学と著者に残し、掲載料を払わない経路も評価してほしいです。審査中の資料や個人情報を含む補足データまで自動公開するのは避けるべきです。ナレーション：地域共同研究の代表が意見を述べます。地域代表：地域の聞き取りを使った論文が無料で読めることと、話者が望まない記録まで公開されることは別です。私たちは研究への協力には同意しましたが、将来の用途をすべて許可したわけではありません。論文には、結果を専門用語だけでなく地域の言葉で説明した要約を付け、原資料の公開範囲は協力者と改めて決めてください。ナレーション：図書館員が提案します。図書館員：採択後原稿は、投稿時に大学が非独占的な保存権を受け、出版社の条件に応じて公開日を設定できます。猶予期間が必要な場合も、書誌情報と公開予定日は先に示せます。公開できないデータは存在を記録し、制限理由と申請窓口を載せれば、ないものとして扱われません。掲載料の支援は一部に限らず、権利を保持する雑誌やリポジトリ利用を優先しましょう。ナレーション：大学は、以上の論点を満たす公開方針を一つ採用することにしました。",
    question:
      "四人の意見を踏まえた大学の公開方針として、最も適切なものはどれですか。",
    options: [
      "原稿の利用権を保持し、採択後原稿と補足データを猶予なく一律に公開する",
      "契約上の猶予と資料の制限を認め、書誌情報だけを登録して一般向け要約は付けない",
      "原稿の利用権を保持して段階的に公開し、機微な資料は同意に基づき制限しつつ要約も届ける",
      "掲載料を大学が支援して最終版を公開し、聞き取り資料は論文と同じ条件で公開する",
    ],
    correctIndex: 2,
    explanation:
      "The policy combines rights retention and repository access with lawful embargoes, consent-based data governance, visible metadata for restricted materials, and nontechnical summaries that make access substantive.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
    sourceCount: 4,
  },
  {
    semanticId: "N1-integrated-river-floodplain-staged-restoration",
    level: "N1",
    family: "listening-integrated",
    semanticFocus:
      "region stages floodplain restoration with safety thresholds, farm compensation, and adaptive ecological monitoring",
    script:
      "ナレーション：豪雨による浸水が増えた川で、堤防内の河川敷をどう改修するか、流域会議が開かれています。治水技術者が説明します。技術者：川幅の狭い区間では、水位を抑えるために一部の堤防を後方へ移し、増水時に水が広がる場所を作る必要があります。ただし、上流だけを広げると下流へ流れる時間が変わるので、流域全体の計算なしに工事区間を決められません。避難時間を短くする案は採れず、警報基準も同時に見直す必要があります。また、工事後に計算との差が出た場合、次の区間へ進まない基準も事前に必要です。ナレーション：生態学者が話します。生態学者：直線化された岸を一度に自然の形へ戻すと、見た目は良くても、外来植物が裸地を占めることがあります。小さな区間から流れと土砂の変化を見て、在来植物が定着する条件を確かめるべきです。魚の種類だけでなく、水温、浅瀬の連続性、産卵期の濁りも測ってください。ナレーション：農家の代表が意見を述べます。農家代表：後方へ移す予定の堤防の内側には、借地で耕作している農家もいます。土地所有者への補償だけでは、設備を移す耕作者の損失が残ります。洪水時だけ水を受け入れる契約を選べる区画もあるはずです。どの高さで冠水するか、作付け前に分かる仕組みがなければ協力できません。ナレーション：下流地区の住民が話します。住民代表：自然再生の名目で上流の景観だけが良くなり、下流の危険が増えるのでは困ります。試行中も水位と到達時間を公開し、想定より早く水が来るなら工事を広げず見直す条件を決めてください。避難訓練も、新しい警報基準で行う必要があります。ナレーション：流域会議は、治水、生態、農業、下流地区の条件を満たす計画を一つ選びます。",
    question:
      "四者の意見を踏まえた改修計画として、最も適切なものはどれですか。",
    options: [
      "安全条件を確認した小区間から試し、耕作者を補償して治水と生態の指標で拡大を判断する",
      "流域計算後に全区間を改修し、土地所有者を補償して水位だけを監視する",
      "小区間から試して耕作者も補償するが、景観が改善すれば次区間へ進む",
      "冠水を受け入れる農地だけを対象にし、下流の警報基準を変えずに工事する",
    ],
    correctIndex: 0,
    explanation:
      "The plan is staged and conditional: basin-wide safety precedes construction, affected cultivators as well as owners are covered, and both hydraulic and ecological outcomes govern expansion.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
    sourceCount: 4,
  },
  {
    semanticId: "N1-integrated-school-smartphone-bounded-use",
    level: "N1",
    family: "listening-integrated",
    semanticFocus:
      "school replaces an absolute smartphone ban with bounded instructional use, device-neutral access, and explicit emergency routes",
    script:
      "ナレーション：中高一貫校が、授業中のスマートフォン利用規則を見直しています。教員が現状を説明します。教員：現在は校内への持込みを認めていますが、授業中に通知を見る生徒が増えました。各教員が注意するだけでは基準がばらばらです。一律に預かれば集中しやすいものの、観察記録や外国語の録音など、端末を使う授業もあります。授業目的で使う時間と、私的な通知を止める時間を明確にしたいです。ナレーション：生徒会代表が話します。生徒代表：端末を使う課題があるのに、自分のスマートフォンを持っていない生徒が目立たない形で借りられないと不公平です。また、休み時間まで完全に禁止すると、家族の介護などで連絡が必要な生徒が事情を皆の前で説明することになります。例外を個人的なお願いにせず、共通の申請方法にしてください。ナレーション：スクールカウンセラーが意見を述べます。カウンセラー：問題は端末の有無だけでなく、通知によって注意が戻りにくいことです。授業の冒頭で箱に集めても、緊急連絡が端末にしか届かない仕組みなら不安が強まります。家族には学校の緊急窓口を示し、生徒にも必要なとき職員を通じて連絡を確認できる手順が必要です。違反回数だけで効果を測ると、不安や授業参加への影響を見落とします。ナレーション：保護者代表が話します。保護者代表：災害時を考えると持込み禁止には反対です。ただ、授業中に自由に使わせることを求めているわけではありません。学校からの一斉連絡と家族からの個別連絡を区別し、緊急時は教員の指示で端末を使えるようにしてほしいです。ナレーション：学校は、以上の意見を満たす新しい試行規則を一つ選ぶことにしました。",
    question: "四人の意見に最も合うスマートフォン利用規則はどれですか。",
    options: [
      "端末の持込みは認めるが一日中保管し、緊急連絡は学校の窓口だけで受ける",
      "教員が指定した授業では使えるが、端末は各生徒が自分で用意する",
      "授業中は通知を切る共通基準を設け、利用の判断と例外対応は各教員に任せる",
      "授業目的の限定利用と端末貸出を設け、通常時の保管と緊急連絡の手順を明確にする",
    ],
    correctIndex: 3,
    explanation:
      "The policy bounds attention-disrupting use without prohibiting possession, provides equivalent school devices, and separates routine classroom practice from documented personal and emergency communication routes.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
    sourceCount: 4,
  },
  {
    semanticId: "N1-integrated-museum-free-access-capacity",
    level: "N1",
    family: "listening-integrated",
    semanticFocus:
      "museum broadens free access while managing capacity and replacing lost ticket income without coercive donation",
    script:
      "ナレーション：市立美術館が、常設展の入館料を無料にする提案を検討しています。館長が説明します。館長：有料の企画展は来館者が多い一方、地域のコレクションを扱う常設展は空いています。無料化すれば、初めて来る人や短時間だけ見たい人には入りやすくなります。ただし、単に料金をゼロにして広報費や展示替えを削れば、入口は開いても内容が衰えます。失う収入は年間予算の一割弱なので、代替財源と混雑時の運用を同時に決める必要があります。ナレーション：教育担当者が話します。教育担当：学校との連携では、入館料より交通費と予約手続きが障壁です。無料化だけで利用が均等になるとは限りません。団体枠を学校が多い時間に独占すると、個人が入れなくなります。平日の午前に学校枠を設けつつ、一部は個人の当日入場に残し、地域の交通助成とも組み合わせてください。解説も一つの年齢向けだけにしないことが大切です。ナレーション：近隣住民が意見を述べます。住民代表：無料の日に何時間も並んだ経験があり、予約できる人だけが有利になるのも心配です。日時予約を基本にしても、窓口で当日入れる枠と、十五分だけ見る人のための短時間枠があれば利用しやすい。寄付を求める表示が入口ごとにあると、無料なのに払わない人が歓迎されていないように感じます。ナレーション：財務担当者が説明します。財務担当：全額を市の一般財源で補うのは難しいですが、企画展の料金は維持できます。企業協賛は可能でも、展示内容への介入を防ぐ契約が必要です。会員制度は先行予約や講座を特典にできますが、常設展の基本的な鑑賞を会員だけに戻してはいけません。任意寄付は出口で一度案内する程度なら、入館条件と誤解されにくいでしょう。ナレーション：美術館は、以上の条件を満たす一年間の無料化案を選ぶことにしました。",
    question: "四人の意見に最も合う常設展の無料化案はどれですか。",
    options: [
      "常設展を無料にし、日時予約と学校枠だけに限定して会員収入で補う",
      "常設展を無料にし、多様な入場枠と独立性を守る財源を設けて利用の偏りも検証する",
      "常設展を無料にして当日枠も残すが、展示替えの費用を削って不足分を補う",
      "常設展を無料にし、交通助成を優先する一方、入場は事前予約だけにする",
    ],
    correctIndex: 1,
    explanation:
      "The plan treats price as only one access barrier: it protects walk-up and short visits, caps group displacement, diversifies revenue without surrendering editorial control, and evaluates who benefits.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
    sourceCount: 4,
  },
  {
    semanticId: "N1-integrated-hybrid-office-predictable-flexibility",
    level: "N1",
    family: "listening-integrated",
    semanticFocus:
      "organization reduces office space while preserving predictable collaboration, accessible work settings, and outcome-based evaluation",
    script:
      "ナレーション：ある財団が、賃貸契約の更新を前に、事務所の規模と在宅勤務制度を検討しています。施設担当者が説明します。施設担当：座席の平均利用率は四割ですが、火曜の午前だけ九割を超え、ほかの日は空いています。全員分の固定席を維持する費用は大きいものの、単純に床面積を半分にすると、利用が集中する日に会議室も個人作業席も不足します。部署ごとの出勤予定が直前まで分からないことが、偏りを強めています。ナレーション：事業チームの責任者が話します。チーム責任者：共同企画は対面のほうが進みますが、全員が同じ曜日に来ればよいわけではありません。編集段階では静かな在宅作業が向いています。月に二回、目的を示した共同作業日を早めに決め、それ以外は各チームが成果に必要な集まり方を選べると助かります。出勤日数そのものを評価に使うと、見えることが成果と混同されます。ナレーション：障害のある職員の代表が意見を述べます。職員代表：在宅勤務を例外扱いせず選べることは重要ですが、事務所を使う人の条件も忘れないでください。共有席の高さや照明が毎回変わると働けない人がいます。調整済みの席を予約できるようにし、静かな区画を残してください。また、共同作業日にオンライン参加すると発言が拾われない問題も、機器と進行方法で解決する必要があります。ナレーション：財務責任者が話します。財務責任者：現在の面積を維持するより、三割縮小して予約と設備に投資するほうが五年間では安くなります。ただし、解約後に席不足が判明してもすぐ戻せません。まず空いている一フロアを転貸し、半年間、想定する配置を仮設して検証すれば、利用の集中と会議需要を測れます。ナレーション：財団は、以上の条件を満たす半年間の見直し案を選ぶことにしました。",
    question: "四人の意見に最も合う働き方と事務所の見直し案はどれですか。",
    options: [
      "床面積をすぐ三割縮小し、共同作業日は各チームが直前に決める",
      "一部を転貸して縮小案を試すが、共有席だけにして在宅勤務は例外とする",
      "一部を転貸して縮小案を試し、予告した共同日と利用しやすい設備を成果評価と組み合わせる",
      "共同作業日を早めに決めて遠隔参加も認めるが、出勤日数を評価に使う",
    ],
    correctIndex: 2,
    explanation:
      "The reversible trial tests a smaller footprint before commitment, while predictable purpose-led collaboration, accessible spaces, equal remote participation, and outcome-based evaluation address the speakers' concerns.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
    sourceCount: 4,
  },
  {
    semanticId: "N1-integrated-community-air-sensor-calibration",
    level: "N1",
    family: "listening-integrated",
    semanticFocus:
      "city combines calibrated community air sensors with reference monitors and uncertainty-aware enforcement triggers",
    script:
      "ナレーション：工業地区周辺の大気汚染を測るため、市と住民が小型センサーの利用について協議しています。大気研究者が説明します。研究者：小型センサーは安価なので、少数の高精度測定局では見えない道路ごとの差を捉えられます。ただし、湿度や機種によって値がずれ、絶対値をそのまま法的基準と比べることはできません。数台を基準局の隣に定期的に置いて補正式を更新し、異常が出た地点では公定法による測定を追加する必要があります。ナレーション：住民団体の代表が話します。住民代表：従来の測定局は住宅から離れており、夜ににおいが強くなる時間を捉えていません。住民が場所を選び、体調や風向きも記録できれば、平均値に埋もれる短時間の変化を示せます。一方、家庭の無線環境に頼ると参加できない地域が出るので、通信費と設置作業を市が支援してください。生データだけでなく、補正した値と不確かさも同時に見たいです。ナレーション：環境規制担当者が話します。規制担当：住民センサーの警告を無視するつもりはありませんが、一台の上昇だけで工場へ処分を出すと、測定の誤差を争われます。複数地点で一定時間続く上昇を現地調査の開始条件とし、公定法の結果で法的措置を判断するなら使えます。調査を始めなかった場合も理由を公開すべきです。ナレーション：機器技術者が意見を述べます。技術者：設置場所が排気口のすぐ横だったり、雨が入ったりすると値が偏ります。住民が簡単に点検できる表示と、半年ごとの交換部品が必要です。すべてを専門業者が管理すると地域の測定点を増やせないので、研修を受けた地域管理者と市の技術班で役割を分けるのが現実的です。ナレーション：市は、以上の条件を満たす測定と対応の仕組みを一つ選ぶことにしました。",
    question: "四人の意見に最も合う大気測定の仕組みはどれですか。",
    options: [
      "小型センサーを基準局で補正し、広い観測網の警告を公定法の調査につなげる",
      "同じ機種を住民の選ぶ場所に置き、一台でも上昇すれば工場の処分を決める",
      "小型センサーは地域管理者に任せ、基準局との比較をせず参考値として公開する",
      "基準局で補正した値を公開するが、測定地点と通信費は各家庭に任せる",
    ],
    correctIndex: 0,
    explanation:
      "The hybrid network uses community coverage for detection and reference methods for calibration and enforcement, while publishing uncertainty and making investigation decisions accountable.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
    sourceCount: 4,
  },
  {
    semanticId: "N1-integrated-municipal-translation-risk-tiering",
    level: "N1",
    family: "listening-integrated",
    semanticFocus:
      "municipality tiers translation by consequence, pairing reviewed automation with qualified human interpreting and community testing",
    script:
      "ナレーション：外国語で行政情報を提供する方法について、市役所が見直し会議を開いています。広報課長が説明します。広報課長：現在は各課が必要になってから翻訳会社へ依頼するため、災害情報でも公開が一日遅れることがあります。自動翻訳を使えば速くなりますが、すべてを同じ方法で処理してよいとは考えていません。更新頻度と、誤訳した場合の影響に応じて手順を分けたいです。ナレーション：医療通訳者が話します。通訳者：予防接種の日時案内なら定型文を確認して再利用できますが、同意書や相談では、単語が合っていても選択の結果が伝わらないことがあります。また、読み書きができることと、緊張した場面で理解できることは別です。権利や健康に直接関わる場面は、訓練を受けた人が双方向に確認できる仕組みを残してください。家族や子どもに通訳を任せるべきではありません。ナレーション：外国出身住民の団体代表が意見を述べます。団体代表：翻訳されたページがあっても、どのボタンから申請するか分からず、途中で日本語に戻ることがあります。公開前に実際の利用者が最初から最後まで試し、理解できない箇所を報告できる窓口が必要です。少数言語を利用者数だけで後回しにすると、支援が必要な人ほど情報から外れます。音声や、やさしい日本語も選べると助かります。ナレーション：デジタル担当者が提案します。デジタル担当：住所変更の手順など影響が比較的小さい大量のページは、自動翻訳の下書きを用語集と機械的な検査に通し、職員が確認すれば当日公開できます。期限、金額、否定表現を自動で警告する仕組みも作れます。一方、災害時は承認を待ちすぎる危険があるので、事前に人が確認した多言語の定型文を用意し、変わる数字と場所だけを二人で照合するのが速いでしょう。ナレーション：市は、以上の条件を満たす多言語対応を一つ選ぶことにしました。",
    question: "四人の意見に最も合う市の多言語対応はどれですか。",
    options: [
      "一般案内と申請文書は職員が自動翻訳を確認し、医療相談には家族の通訳も認める",
      "災害情報は事前確認した定型文で発信するが、ほかの文書は翻訳会社だけに任せる",
      "利用者による確認を全ページで行い、少数言語は利用数が増えてから対応する",
      "誤訳の影響に応じて方法を分け、権利や健康に関わる場面では専門家と利用者が確認する",
    ],
    correctIndex: 3,
    explanation:
      "The tiered system uses reviewed automation where consequences are lower, prevalidated templates for urgent updates, and qualified human, user-tested support for rights, health, and adverse decisions.",
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
    sourceCount: 4,
  },
] as const satisfies readonly UpperListeningSeed[];

export const N1_UPPER_LISTENING_EXPANSION: readonly UpperListeningSeed[] = [
  ...n1TaskExpansion,
  ...n1KeyPointExpansion,
  ...n1OutlineExpansion,
  ...n1QuickResponseExpansion,
  ...n1IntegratedExpansion,
];

/** Machine checks passed; independent language/editorial approval is still required. */
export const N1_UPPER_LISTENING_EXPANSION_EDITORIAL_STATUS =
  "machine-validated" as const;
