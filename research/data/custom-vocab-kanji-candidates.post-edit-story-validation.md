# Kanji vocabulary post-edit story-mnemonic validation

Validation date: 2026-09-01 (Europe/Madrid)

Source: [`custom-vocab-kanji-candidates.json`](./custom-vocab-kanji-candidates.json)  
Editorial standard: [`custom-vocabulary-story-mnemonic-standard.md`](../custom-vocabulary-story-mnemonic-standard.md)  
Audited source SHA-256: `3292de2265fe4d94fd72fe82c94b83222ec13d21642ccc26004cda56c1cf52c4`

The reviewer did not author or edit the 121 audited `readingMnemonic` values.

## Outcome

| Verdict | Count |
| --- | ---: |
| Pass | 121 |
| Fail | 0 |
| **Total** | **121** |

The set passes the story-mnemonic standard. The six former `CHOW` cues were replaced with verified component-reading scenes, and the prior `kanji-51-60-kankonsousai` blocker was replaced with a scene that enacts all four sound images. All seven corrections passed an independent targeted re-review; no blocking findings remain.

## Deterministic gate

The six packs were flattened and checked independently.

- **121 / 121** `readingMap` token sequences concatenate exactly to the NFKC-normalized canonical `reading`.
- **121 / 121** `readingMnemonic` values contain exactly one balanced `<reading>…</reading>` span.
- **121 / 121** have balanced `<vocabulary>…</vocabulary>` markup.
- All 4 readings containing `っ`, all 34 containing moraic `ん`, all 33 containing small-kana clusters, and all written long vowels remain intact in the hidden maps.
- The deterministic result is deliberately not treated as proof of mnemonic quality.

## Editorial decision rule

A component-based mnemonic passes when it uses a verified, familiar reading chunk and makes the components act in a concrete meaning-linked scene. It does not need an English pun. An English sound hook may be approximate, but it must cover the complete reading in order and occur as a person, object, utterance, or action in the scene. Merely printing the answer on a sign, label, or named procession is not enough unless the scene also supplies a legitimate component-reading retrieval path.

Every passing entry below also has an accurate meaning payoff and a useful, non-misleading usage clarification.

## Complete 121-entry verdict table

| # | Word ID | Reading | Independent editorial finding | Verdict |
| ---: | --- | --- | --- | --- |
| 1 | `kanji-01-10-totte` | `とって` | 取→と and 手→て are joined by the handle physically catching the two **t** sounds; the scene explains `っ` and the grip meaning. | PASS |
| 2 | `kanji-01-10-hitokuchi` | `ひとくち` | Familiar `ひと` + `くち` act as one and mouth; the single strawberry and snapping jaws force “one bite.” | PASS |
| 3 | `kanji-01-10-daiku` | `だいく` | `DIE—COO` covers the full reading; the collapsing cuckoo clock gives the carpenter a concrete problem and consequence. | PASS |
| 4 | `kanji-01-10-nyuushu` | `にゅうしゅ` | `NEW SHOE` is a complete close cue, and opening the rare-shoe crate makes obtaining the item the payoff. | PASS |
| 5 | `kanji-01-10-yuuhi` | `ゆうひ` | `YOU—HE` covers both chunks; racing the sunset creates an urgent, visible evening-sun scene. | PASS |
| 6 | `kanji-01-10-honjitsu` | `ほんじつ` | Verified 本→ほん and 日→じつ land on a calendar that seals at midnight, making formal “today” retrievable. | PASS |
| 7 | `kanji-01-10-hibi` | `ひび` | Exact homophone ひび “cracks” spread across daily calendar pages, binding sound and day-by-day meaning. | PASS |
| 8 | `kanji-01-10-honnin` | `ほんにん` | 本→ほん and 人→にん produce the actual person and eject a stand-in, clearly distinguishing 本人. | PASS |
| 9 | `kanji-01-10-tehon` | `てほん` | 手→て reaches into 本→ほん and extracts a demonstration everyone copies, a concrete model/example payoff. | PASS |
| 10 | `kanji-01-10-issai` | `いっさい` | Cutting H from HISS and meeting **s/s** in `ISS—SIGH` accounts for `っ`; every vanished prop anchors totality and negative “not at all.” | PASS |
| 11 | `kanji-01-10-chuushin` | `ちゅうしん` | `CHEW—SHIN` is complete and the dog drills into the center of a shin bone, making center/core unavoidable. | PASS |
| 12 | `kanji-01-10-furuhon` | `ふるほん` | `FULL HORN` is a defensible close cue; the dusty instrument hidden in an old book marks a secondhand book. | PASS |
| 13 | `kanji-01-10-shitami` | `したみ` | `SHE—TUMMY` covers the reading, and examining a model stomach before surgery concretely expresses advance inspection. | PASS |
| 14 | `kanji-01-10-hitokoto` | `ひとこと` | Verified `ひと` + `こと` become one permitted remark before the curtain falls, accurately teaching a brief comment. | PASS |
| 15 | `kanji-01-10-sedai` | `せだい` | 世→せ and 代→だい travel on a relay baton whose handoff replaces one age group with the next. | PASS |
| 16 | `kanji-01-10-nanika` | `なにか` | 何→なに and question marker か spring from a mystery box whose unknown object makes “something” inevitable. | PASS |
| 17 | `kanji-01-10-shushoku` | `しゅしょく` | `SHOE—SHOCK` covers all units and the boot replacing rice creates a memorable staple-food violation. | PASS |
| 18 | `kanji-01-10-kongo` | `こんご` | `CONGO` retrieves the full reading; a forward-only sign planted there fixes the reference point “from now on.” | PASS |
| 19 | `kanji-01-10-demae` | `でまえ` | 出→で and 前→まえ move restaurant food out and in front of the customer, directly producing food delivery. | PASS |
| 20 | `kanji-01-10-naika` | `ないか` | 内→ない and 科→か enter a giant stomach clinic, tying the verified chunks to internal medicine. | PASS |
| 21 | `kanji-01-10-jouei` | `じょうえい` | `JOE—A` honestly carries both long-vowel sequences, and Joe's projector pedaling causes the film screening. | PASS |
| 22 | `kanji-01-10-irai` | `いらい` | `E—LIE` covers the reading; the lie freezes a clock that measures everything ever since that moment. | PASS |
| 23 | `kanji-01-10-inai` | `いない` | Exact homophone いない “not there” operates at a painted boundary, making inclusive “within” easy to recover. | PASS |
| 24 | `kanji-01-10-seken` | `せけん` | 世→せ and 間→けん crowd the public into one judging space, concretely expressing society/public opinion. | PASS |
| 25 | `kanji-01-10-nakami` | `なかみ` | 中→なか opens and 身→み jumps out as the box's surprising contents, with the abstract “substance” nuance preserved. | PASS |
| 26 | `kanji-01-10-shuyaku` | `しゅやく` | `SHOE—YAK` is complete; the sparkling yak steals the stage and therefore becomes the leading role. | PASS |
| 27 | `kanji-01-10-taichou` | `たいちょう` | 体→たい and 調→ちょう enter a clinic whose scanner reveals the patient's physical condition; both familiar chunks and the meaning consequence are explicit. | PASS |
| 28 | `kanji-11-20-dengon` | `でんごん` | `DEN—GONE` retains both nasals, and the spy's note remains as a relayed message after the sender disappears. | PASS |
| 29 | `kanji-11-20-tayori` | `たより` | Exact homophone 頼り supplies the sound; the relied-upon pigeon physically delivers news and correspondence. | PASS |
| 30 | `kanji-11-20-kyoutsuu` | `きょうつう` | 今日→きょう plus `TWO`→つう covers the reading, while one ticket shared by two actors makes commonality visible. | PASS |
| 31 | `kanji-11-20-riyou` | `りよう` | `LEE—YO` spans the complete reading; converting a yo-yo into a crane demonstrates practical use. | PASS |
| 32 | `kanji-11-20-jimi` | `じみ` | `JIMMY` is a close whole-word cue, and his gray outfit disappearing at a glitter party embodies subdued/plain style. | PASS |
| 33 | `kanji-11-20-seibun` | `せいぶん` | `SAY—BUN` covers the reading; ingredients leap from the speaking bun, making each component concrete. | PASS |
| 34 | `kanji-11-20-seichou` | `せいちょう` | 成→せい and 長→ちょう lock together as a seedling stretches through the roof, concretely producing growth. | PASS |
| 35 | `kanji-11-20-uwagi` | `うわぎ` | `OOH—WAGGY` is complete; the jacket and wagging tail act together to mark outerwear. | PASS |
| 36 | `kanji-11-20-nakaniwa` | `なかにわ` | 中→なか and 庭→にわ are trapped inside four walls, an exact component scene for an inner courtyard. | PASS |
| 37 | `kanji-11-20-kouryuu` | `こうりゅう` | 交→こう and 流→りゅう carry ideas in opposite river currents, concretely producing reciprocal exchange. | PASS |
| 38 | `kanji-11-20-taion` | `たいおん` | `TIE—ON` retrieves all four units, and the worn thermometer reveals body temperature. | PASS |
| 39 | `kanji-11-20-kyoukan` | `きょうかん` | 共→きょう and 感→かん tie two hearts so one feeling pulses in both, a strong empathy payoff. | PASS |
| 40 | `kanji-11-20-yuujou` | `ゆうじょう` | `YOU—JOE` supplies both long chunks; a trust bridge maintained by friendship gives the sound real consequence. | PASS |
| 41 | `kanji-11-20-gasshuku` | `がっしゅく` | `GAS—SHOOK` covers the reading and supports `っ` at the **s/sh** boundary; the shared lodge anchors training camp. | PASS |
| 42 | `kanji-11-20-sankou` | `さんこう` | `SUN—CO.` covers nasal and long vowel, and the sunlit company library is actively consulted as a reference. | PASS |
| 43 | `kanji-11-20-hanataba` | `はなたば` | 花→はな and 束→たば tie themselves into one enormous bouquet, giving exact component and meaning retrieval. | PASS |
| 44 | `kanji-11-20-kaikei` | `かいけい` | `KAI—KAY` covers both diphthong-like sequences; the pair split and verify the bill at checkout. | PASS |
| 45 | `kanji-11-20-kubetsu` | `くべつ` | `COO—BETS` is complete under ordinary adaptation; sorting red and blue bets enacts a strict distinction. | PASS |
| 46 | `kanji-11-20-tani` | `たんい` | `TAN—E` retains the nasal and final い; one glowing E functions as both measurement unit and credit. | PASS |
| 47 | `kanji-11-20-jushin` | `じゅしん` | 受→じゅ and 信→しん enter a radio and antenna whose flash confirms signal reception. | PASS |
| 48 | `kanji-11-20-nyuuyoku` | `にゅうよく` | 入→にゅう and 浴→よく dive into a bath; the fully clothed splash makes bathing unmistakable. | PASS |
| 49 | `kanji-11-20-mikaku` | `みかく` | 味→み and 覚→かく trigger a tongue alarm that identifies flavors, concretely expressing the faculty of taste. | PASS |
| 50 | `kanji-11-20-kosei` | `こせい` | 個→こ and 性→せい stamp unique badges so no two workers match, an effective individuality scene. | PASS |
| 51 | `kanji-21-30-jimu` | `じむ` | `GYM` supplies the whole close reading; paperwork swallowing the weights converts the gym into administration. | PASS |
| 52 | `kanji-21-30-kisei` | `きせい` | `KEY—SAY` covers the reading and the talking childhood key repeatedly compels a hometown return. | PASS |
| 53 | `kanji-21-30-dansui` | `だんすい` | 断→だん and 水→すい act through an axe that cuts the main and empties every pipe. | PASS |
| 54 | `kanji-21-30-tenken` | `てんけん` | `TEN—KEN` retains both nasals; Ken's ten-machine magnifying-glass check makes systematic inspection concrete. | PASS |
| 55 | `kanji-21-30-chousa` | `ちょうさ` | 調→ちょう and 査→さ open a case file and search every drawer until evidence launches an investigation. | PASS |
| 56 | `kanji-21-30-shinshitsu` | `しんしつ` | 寝→しん and 室→しつ fill the room with a bed and exploding sheets, an exact bedroom consequence. | PASS |
| 57 | `kanji-21-30-outai` | `おうたい` | `OH—TIE` covers both long-vowel sequences; the clerk patiently untangles and attends to the customer. | PASS |
| 58 | `kanji-21-30-shuchou` | `しゅちょう` | 主→しゅ and 張→ちょう stretch a banner across the debate hall, where its enormous message becomes the asserted claim. | PASS |
| 59 | `kanji-21-30-kokyuu` | `こきゅう` | 呼→こ and 吸→きゅう animate a rooster inhaling and crowing, visibly demonstrating respiration. | PASS |
| 60 | `kanji-21-30-kitaku` | `きたく` | `KEY—TACK` supplies all units under normal final-consonant support; retrieving the house key causes the return home. | PASS |
| 61 | `kanji-21-30-jougi` | `じょうぎ` | `JOE—GHEE` covers the reading; dragging a rigid ruler through ghee leaves straight stripes. | PASS |
| 62 | `kanji-21-30-tenji` | `てんじ` | 展→てん and 示→じ open ten cases and spotlight each object, making a public exhibition. | PASS |
| 63 | `kanji-21-30-nenpi` | `ねんぴ` | 燃→ねん plus `PEA`→ぴ covers the voiced reading; one pea powering a car gives unforgettable fuel economy. | PASS |
| 64 | `kanji-21-30-jikyuu` | `じきゅう` | `G—CUE` covers じ + きゅう, and each clock cue drops an hourly coin into the wage bucket. | PASS |
| 65 | `kanji-21-30-eiyou` | `えいよう` | `A—YO` supplies both written long-vowel sequences; vitamins fired into a meal create nutrition. | PASS |
| 66 | `kanji-21-30-kyuushoku` | `きゅうしょく` | `CUE—SHOCK` covers all clusters and the lunch cart's spectacular entrance delivers institutional school lunch. | PASS |
| 67 | `kanji-21-30-inshou` | `いんしょう` | `IN—SHOW` retains nasal and long vowel; the fireworks hat burns a lasting impression into the audience. | PASS |
| 68 | `kanji-21-30-shudan` | `しゅだん` | `SHOE—DAN` covers the reading; a shoe used to cross a river is literally Dan's means to an end. | PASS |
| 69 | `kanji-21-30-reitou` | `れいとう` | `RAY—TOE` honestly covers both long-vowel sequences; the ray freezes the toe to the ground. | PASS |
| 70 | `kanji-21-30-yorimichi` | `よりみち` | 寄り→より and 道→みち leave the route for a side street and turn a stop into a detour. | PASS |
| 71 | `kanji-21-30-tekisetsu` | `てきせつ` | `TECHIE SETS` covers the complete reading, and the techie's controls click into suitable positions. | PASS |
| 72 | `kanji-31-40-bunmyaku` | `ぶんみゃく` | `BUN—MEOW—COO` spans every cluster; surrounding sentences are required to explain the absurd scene, embodying context. | PASS |
| 73 | `kanji-31-40-seisou` | `せいそう` | `SAY—SEW` covers both long sequences, and repaired curtains sweep the floor to complete organized cleaning. | PASS |
| 74 | `kanji-31-40-amimono` | `あみもの` | 編み→あみ and 物→もの produce a scarf that keeps growing until knitting buries the room. | PASS |
| 75 | `kanji-31-40-konzatsu` | `こんざつ` | 混→こん and 雑→ざつ tangle commuters and luggage through every gate, a concrete congestion scene. | PASS |
| 76 | `kanji-31-40-moushikomi` | `もうしこみ` | 申し→もうし and 込み→こみ enter a form slot and receive a giant registration stamp. | PASS |
| 77 | `kanji-31-40-oomori` | `おおもり` | 大→おお and 盛り→もり rise into a mountain of rice, clearly anchoring a large serving. | PASS |
| 78 | `kanji-31-40-sunahama` | `すなはま` | `SUE—NAH—HAMMER` covers the full reading; burying the destructive hammer fixes the sandy-beach meaning. | PASS |
| 79 | `kanji-31-40-musu` | `むす` | `MOOSE` is a close whole cue; its weight traps vapor under a lid and steams the dumplings. | PASS |
| 80 | `kanji-31-40-shukkin` | `しゅっきん` | `SHOOK—KIN` supplies `しゅ・っ・き・ん`, with the **k/k** boundary supporting `っ`; relatives tumble into work. | PASS |
| 81 | `kanji-31-40-jikoku` | `じこく` | 時→じ and 刻→こく carve a glowing exact time into a clock face. | PASS |
| 82 | `kanji-31-40-kyuukou` | `きゅうこう` | `CUE—CO.` covers both long chunks; headquarters' cue causes the professor to cancel the scheduled class. | PASS |
| 83 | `kanji-31-40-taizai` | `たいざい` | 滞→たい and 在→ざい unpack furniture in a hotel suitcase, marking a temporary stay. | PASS |
| 84 | `kanji-31-40-unchin` | `うんちん` | 運→うん and 賃→ちん enter a bus and fare box; both nasals remain explicit and payment opens the doors. | PASS |
| 85 | `kanji-31-40-norikae` | `のりかえ` | 乗り→のり and 換え→かえ move across platforms as the first train vanishes, forcing a transfer. | PASS |
| 86 | `kanji-31-40-koukan` | `こうかん` | `CO.—CAN` covers long vowel and nasal; two cans physically swap places to complete an exchange. | PASS |
| 87 | `kanji-31-40-fumikiri` | `ふみきり` | 踏み→ふみ and 切り→きり animate a striped gate that cuts traffic at a railway crossing. | PASS |
| 88 | `kanji-31-40-atesaki` | `あてさき` | 宛→あて and 先→さき steer an envelope; missing destination details make the address spin uselessly. | PASS |
| 89 | `kanji-31-40-katazukeru` | `かたづける` | 片→かた and 付ける→つける collide to explain established `づ`; every object clicks home as the room is tidied. | PASS |
| 90 | `kanji-31-40-chuusha` | `ちゅうしゃ` | Exact homophone 注射 pins cars in place with injections, directly joining full sound and parking meaning. | PASS |
| 91 | `kanji-41-50-houtai` | `ほうたい` | `HOE—TIE` covers both long-vowel sequences; the tie wrapped around a bleeding hoe becomes a bandage. | PASS |
| 92 | `kanji-41-50-shikyuu` | `しきゅう` | `SHE—CUE` covers the reading, and a falling emergency curtain makes immediate action necessary. | PASS |
| 93 | `kanji-41-50-gyougi` | `ぎょうぎ` | 行→ぎょう and 儀→ぎ bow at dinner; the impeccably behaved gyoza gives table manners a vivid payoff. | PASS |
| 94 | `kanji-41-50-kanjin` | `かんじん` | `CAN—GENE` retains both nasals; the sole crop-saving gene makes the can absolutely crucial. | PASS |
| 95 | `kanji-41-50-nameraka` | `なめらか` | Every sound in `NAH—MEH—RAH—CAW` is enacted by a polisher; their work turns jagged stone smooth. | PASS |
| 96 | `kanji-41-50-sokuseki` | `そくせき` | 即→そく and 席→せき become a theater-seat stove that produces an instant improvised meal. | PASS |
| 97 | `kanji-41-50-suitou` | `すいとう` | Sue, an E-shaped bottle, and a toe enact `SUE—E—TOE`; spilling water secures the flask meaning. | PASS |
| 98 | `kanji-41-50-tenmetsu` | `てんめつ` | Ten lights meet Sue to form the complete cue and then blink in sequence, exactly matching 点滅. | PASS |
| 99 | `kanji-41-50-shiraga` | `しらが` | `SHEAR-A—GAH` arises naturally from the barber/ghost scene; every sheared strand turns gray. | PASS |
| 100 | `kanji-41-50-hikage` | `ひかげ` | 日→ひ and 陰→かげ move under an umbrella that creates cool shade wherever it goes. | PASS |
| 101 | `kanji-41-50-shitsudo` | `しつど` | `SHEETS—DOUGH` covers every unit; damp sheets sticking to dough make humidity tactile. | PASS |
| 102 | `kanji-41-50-hamigaki` | `はみがき` | 歯→は and 磨き→みがき unlock a giant brush for tooth polishing, with the toothpaste nuance retained. | PASS |
| 103 | `kanji-41-50-hokori` | `ほこり` | Exact homophone ほこり “dust” hides a trophy until brushing reveals the champion's pride. | PASS |
| 104 | `kanji-41-50-tsuuchou` | `つうちょう` | 通→つう drills through 帳→ちょう as deposits and withdrawals race through the bankbook's pages. | PASS |
| 105 | `kanji-41-50-kankisen` | `かんきせん` | 換→かん, 気→き, and 扇→せん move stale air through a wall in a concrete extractor-fan scene. | PASS |
| 106 | `kanji-41-50-nikomu` | `にこむ` | 煮→に and 込む→こむ trap ingredients under a lid until they simmer deeply into the sauce. | PASS |
| 107 | `kanji-41-50-mudazukai` | `むだづかい` | 無駄→むだ and 遣い→つかい collide to explain `づ`; the luxury purchase empties money/resources wastefully. | PASS |
| 108 | `kanji-51-60-kareha` | `かれは` | 枯れ→かれ and 葉→は animate a brittle branch coughing up a dead leaf, with 落ち葉 accurately distinguished. | PASS |
| 109 | `kanji-51-60-choujou` | `ちょうじょう` | 頂→ちょう climbs onto 上→じょう and balances on the mountain's final rock, explicitly joining verified on'yomi to summit. | PASS |
| 110 | `kanji-51-60-kankonsousai` | `かんこんそうさい` | CAN, CON, SEW, and SIGH now occur as object, actor, action, and reaction in the crown/wedding/funeral/festival sequence; the full sound and ceremonial meaning paths are both retrievable. | PASS |
| 111 | `kanji-51-60-hensachi` | `へんさち` | Verified 偏差→へんさ and 値→ち act on an exam result whose position shifts against everyone else's score. | PASS |
| 112 | `kanji-51-60-furoshiki` | `ふろしき` | A fro, she, and key all act in the wrapping-cloth scene, giving `FRO—SHE—KEY` a complete concrete path. | PASS |
| 113 | `kanji-51-60-jojoni` | `じょじょに` | Joe, Joe, and knee are all enacted; the two men lower themselves in tiny steps, visibly meaning gradually. | PASS |
| 114 | `kanji-51-60-genkouyoushi` | `げんこうようし` | 原稿→げんこう and 用紙→ようし enter a gridded sheet whose squares are stamped into manuscript paper. | PASS |
| 115 | `kanji-51-60-sueoki` | `すえおき` | Sue, “eh,” “oh,” and key occur in order; leaving the price untouched produces the “left unchanged” payoff. | PASS |
| 116 | `kanji-51-60-kenbikyou` | `けんびきょう` | 顕→けん, 微→び, and 鏡→きょう place tiny bee hairs under a huge lens, concretely yielding microscope. | PASS |
| 117 | `kanji-51-60-somatsu` | `そまつ` | `SO—MAT—SUE` is enacted by Sue and a collapsing splintered mat, clearly marking shabby/crude quality. | PASS |
| 118 | `kanji-51-60-tounyoubyou` | `とうにょうびょう` | The three verified on-reading chunks align with sugar 糖, urine 尿, and illness 病 in one clinical model; the semantic chain identifies diabetes rather than merely labeling an unrelated joke. | PASS |
| 119 | `kanji-51-60-shikousakugo` | `しこうさくご` | The established readings of 試・行・錯・誤 light in component order while each failed trial teaches the inventor; the scene and answer are causally linked. | PASS |
| 120 | `kanji-51-60-mogishiken` | `もぎしけん` | 模擬→もぎ and 試験→しけん construct a convincing fake exam hall that remains only a practice test. | PASS |
| 121 | `kanji-51-60-wazurawashii` | `わずらわしい` | WAS, RAH, WASH, and E all interrupt the witness in order; their accumulated disruption makes the task genuinely troublesome. | PASS |

## Targeted correction re-review

The seven revised entries all pass their targeted gate:

| Word ID | Re-review result |
| --- | --- |
| `kanji-01-10-taichou` | 体 has the applicable on-reading たい and 調 has ちょう. The clinic and scanner turn the component join into a physical-condition consequence. |
| `kanji-11-20-seichou` | 成→せい and 長→ちょう are valid components. Planting and roof-breaking growth supply a concrete action and payoff. |
| `kanji-21-30-chousa` | 調→ちょう and 査→さ are valid components. Unlocking the file and searching drawers causally produce an investigation. |
| `kanji-21-30-shuchou` | 主→しゅ and 張→ちょう are valid components. Stretching a claim banner across a debate hall visibly expresses assertion. |
| `kanji-41-50-tsuuchou` | 通→つう and 帳→ちょう are valid components. Transactions moving through the notebook make it specifically a bankbook. |
| `kanji-51-60-choujou` | 頂→ちょう and 上→じょう are valid on'yomi. Stacking them on the last mountain rock creates the summit. |
| `kanji-51-60-kankonsousai` | CAN→かん, CON→こん, SEW→そう, and SIGH→さい are all enacted in order. Crown, wedding, funeral, and festival preserve the complete ceremonial meaning path. |

For each of the seven, the hidden map still concatenates exactly to the canonical reading, the learner-facing text has one balanced `<reading>` span, and all `<vocabulary>` markup remains balanced. Their usage clarifications and context meanings remain accurate.

## Release recommendation

All 121 entries pass the post-edit story, sound/component, meaning, usage, map, and markup gates. No further kanji-catalog mnemonic revision is required by this audit.
