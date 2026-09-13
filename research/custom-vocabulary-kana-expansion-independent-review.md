# Kana expansion: independent mnemonic and language review

_Independent review run on 2026-09-01 (Europe/Madrid). The reviewer did not author or edit the catalog._

Source under review: [`custom-vocab-kana-expansion.json`](./data/custom-vocab-kana-expansion.json)  
Initial reviewed SHA-256: `aef63bdb3f8795305e9b43b7b5d74b6fc41adf7005b6f8149a1a3c983590157c`  
Initial source modification time: `2026-09-01 14:11:58 +0200`  
Final reviewed SHA-256: `8589b1c91cc0280a86f766a761f66968a35f3d4fef658f04268d3bc27f899cb5`  
Final source modification time: `2026-09-01 14:34:08 +0200`

## Initial outcome

| Verdict | Count |
| --- | ---: |
| PASS | 104 |
| FAIL | 16 |
| **Total** | **120** |

A `FAIL` is release-blocking. In particular, a scene that prints a romanized version of the answer without supplying an independent, retrievable sound anchor is classified as **accurate but not a mnemonic** and fails.

## Final outcome after correction

| Verdict | Count |
| --- | ---: |
| PASS | 120 |
| FAIL | 0 |
| **Total** | **120** |

The author corrected 12 stories, one payoff, and replaced three entries whose readings did not admit a sufficiently honest story in their original form. The final source was frozen before the complete deterministic and editorial rerun.

## Initial blocker audit trail

This table preserves every initial release-blocking finding and records how the final source resolved it.

| Initial word ID | Initial FAIL reason | Final resolution |
| --- | --- | --- |
| `kana-expansion-iraira` | EEL—RYE did not cover い・ら・い・ら in order. | E—RAH repeated now gives four ordered chunks, and the looping arena sign causes irritation. |
| `kana-expansion-unzari` | ZARI was bare target transliteration. | Replaced by `kana-expansion-kusukusu`; exact 楠（くす） repeated anchors quiet giggling. |
| `kana-expansion-zotto` | ZOT was an invented sound recoverable only after knowing the answer. | The intermediate ZOOT—TOE revision also failed because **zoot** is /zuːt/, not /zo/. The word was finally replaced by `kana-expansion-odoodo`; OH—DOUGH repeated honestly covers お・ど・お・ど. |
| `kana-expansion-harahara` | HARA—HARA was bare target romanization. | Exact 腹（はら） repeated now anchors the anxious tightrope scene. |
| `kana-expansion-nonbiri` | BIRI was bare target transliteration. | 飲ん（のん）＋ビリ now supplies the full reading and drives the last-place runner's leisurely pause. |
| `kana-expansion-surasura` | SURA—SURA was bare target romanization. | Replaced by `kana-expansion-kotsukotsu`; exact 骨（こつ） repeated anchors steady, diligent effort. |
| `kana-expansion-gungun` | GOON was emitted as arbitrary tugboat noise rather than retrieved from the scene. | Two actual goons now haul the plant upward rapidly. |
| `kana-expansion-sotto` | SOFT inserted an absent /f/ before the t/t boundary. | SOT—TOE gives an uninterrupted そ・っ・と path with a real t/t boundary. |
| `kana-expansion-furafura` | The payoff highlighted the antonym `steadily`. | The same sound-linked flag scene now pays off `<vocabulary>unsteadily</vocabulary>` directly. |
| `kana-expansion-sarasara` | SAHARA inserted an entire extra /ha/ syllable. | Exact 皿（さら） repeated now anchors freely flowing silky hair. |
| `kana-expansion-hinyari` | HIN—YA—RI was bare target romanization. | Exact 品（ひん）＋槍（やり） now anchors the cold spear scene. |
| `kana-expansion-donyori` | DON YOUR RAINCOAT discarded extra syllables and did not cleanly supply final り. | Exact 丼（どん）＋寄り（より） now causes the room to become overcast. |
| `kana-expansion-zaazaa` | ZAA—ZAA merely printed the Japanese mimetic in Latin letters. | Two drawn-out CZAAAR cues supply both long vowels and cause the downpour. |
| `kana-expansion-bishobisho` | BISHO—BISHO was bare target romanization. | BEE—SHOW repeated now supplies び・しょ・び・しょ and soaks the coat. |
| `kana-expansion-memai` | ME had the wrong vowel and EYE added a whole unused syllable. | MEH—MY now covers め・ま・い without residue and the spinning mirror causes dizziness. |
| `kana-expansion-seroteepu` | CELLO begins /tʃ/ and cues チェロ, not セロ. | SELL—OH—TAPE now gives a complete close path, including a genuinely extended テー. |

## Evidence and method

All 120 entries were flattened and checked individually against the project's [story-mnemonic standard](./custom-vocabulary-story-mnemonic-standard.md). The audit separately tested:

- exact NFKC equality of `characters`, `reading`, and the concatenated `readingMap`;
- preservation of every small kana, `っ` / `ッ`, `ん` / `ン`, and `ー`;
- kana-only visible forms and intentional absence of `readingMnemonic`;
- balanced `<reading>` and `<vocabulary>` markup;
- complete, ordered sound retrieval rather than answer recitation;
- a concrete actor/action/consequence scene and a meaning payoff;
- accurate usage nuance and natural Japanese/English context; and
- custom-catalog and complete WaniKani written/reading overlap.

The dictionary check parsed the official EDRDG [JMdict English XML daily distribution](https://www.edrdg.org/pub/Nihongo/JMdict_e.gz) at `/tmp/kakehashi-jmdict.f6x5f1/JMdict_e.gz`. Its XML header identifies the edition as `2026-09-01`; the compressed file is 10,564,910 bytes with SHA-256 `a2cce17805c392712a9569c515076ae84a0091281b54542753de1060add8c55e`. All **120 / 120** exact kana readings resolved to an applicable JMdict sense. The verification used the repository's read-only resolver:

```text
python3 research/build-jmdict-reading-snapshot.py \
  --jmdict /tmp/kakehashi-jmdict.f6x5f1/JMdict_e.gz \
  --output /tmp/kakehashi-kana-review-jmdict.json \
  --source-url https://www.edrdg.org/pub/Nihongo/JMdict_e.gz \
  --server-last-modified 2026-09-01 \
  --fetched-at 2026-09-01T14:05:44+02:00
```

The WaniKani check used all 6,825 ordinary and kana-vocabulary subjects, including 28 hidden subjects, in [`wanikani-vocabulary-exclusions.snapshot.json`](./data/wanikani-vocabulary-exclusions.snapshot.json). It found zero exact written collisions and zero folded-reading collisions. All other custom source files were also checked. The only folded custom reading hit is `ジム（ジム）` against `事務（じむ）`; these are unrelated homophones with different written forms and meanings, so this is not a duplicate lexeme. There are zero custom written-form or ID collisions.

All 120 Japanese examples contain the exact target form. The independent language pass found no blocking meaning, register, Japanese-naturalness, or English-translation defects; the failures below are mnemonic retrieval defects, plus one incorrectly highlighted antonym.

## Final entry-by-entry verdicts

Every row below describes the frozen final source and independently passed kana shape, exact hidden-map coverage, JMdict form/sense evidence, and context presence. Notes therefore concentrate on learner-facing sound retrieval, story causality, meaning, and usage.

### Nuance in Conversation

| Word ID | Verdict | Independent finding |
| --- | --- | --- |
| `kana-expansion-ainiku` | PASS | EYE—KNEE—COOK supplies all of あいにく in order; the ruined dessert makes “unfortunately” consequential, and the polite-bad-news note and example are accurate. |
| `kana-expansion-tonikaku` | PASS | TOE—KNEE—CAR—COOK is a complete close cue; the kitchen escape makes setting details aside inevitable, and the discourse-use note is accurate. |
| `kana-expansion-tashika` | PASS | Exact Japanese 田（た）＋鹿（しか） covers the reading; the certified witness scene retrieves certainty while the memory-hedge clarification correctly captures たしか. |
| `kana-expansion-semete` | PASS | Exact 攻めて（せめて） anchors the sound; the defeated knight's last request embodies a minimum hoped-for outcome, and the usage is natural. |
| `kana-expansion-hitomazu` | PASS | ひと＋まず is complete and scene-bound; the halfway flag makes the pause provisional, matching both the nuance and example. |
| `kana-expansion-douse` | PASS | DOUGH—SAY is a complete close cue for どうせ; the fixed oven outcome causes resignation, and the どうせなら distinction is useful and correct. |
| `kana-expansion-nanishiro` | PASS | 何（なに）＋白（しろ） covers the full sound; the overriding castle requirement leads to “at any rate / after all,” with accurate explanatory use. |
| `kana-expansion-moshikashite` | PASS | もし＋貸して（かして） is exact and ordered; the umbrella guess makes “perhaps / by any chance” the natural payoff. |
| `kana-expansion-douyara` | PASS | DOUGH—YEAH—RAH is a complete close cue; the evidence trail supports an inferred “apparently / it seems,” and the uncertainty nuance is accurate. |
| `kana-expansion-hobo` | PASS | HO—BOW is a complete close cue; the acrobat stopping one millimeter short makes “almost” visible, and the quantity/approximation note is correct. |

### Feelings You Can Hear

| Word ID | Verdict | Independent finding |
| --- | --- | --- |
| `kana-expansion-wakuwaku` | PASS | Repeated WOK supplies わくわく; bouncing cookware and the impending contest create eager anticipation, with natural わくわくする usage. |
| `kana-expansion-nikoniko` | PASS | KNEE—CO repeated covers にこにこ; the painted smiling knees bind sound and meaning, and the friendly-smile nuance is accurate. |
| `kana-expansion-iraira` | PASS | E—RAH repeated supplies い・ら・い・ら in order; the endlessly looping arena sign and cheer squad make irritation the direct consequence. |
| `kana-expansion-ukiuki` | PASS | OOH—KEY repeated covers うきうき; the monkey's bouncing discovery makes buoyant high spirits memorable and the usage is accurate. |
| `kana-expansion-gakkari` | PASS | GACK—CARRY supplies がっかり with the k/k closure supporting っ; the empty gift collapses expectation and naturally yields disappointment. |
| `kana-expansion-bikkuri` | PASS | BIC—COURIER supplies びっくり with the k/k boundary supporting っ; the impossible delivery causes the surprise, and usage is accurate. |
| `kana-expansion-kusukusu` | PASS | Exact 楠（くす） repeated covers くすくす; birds quietly laughing inside the two camphor trees make the suppressed giggle memorable, and the loud-versus-quiet distinction is accurate. |
| `kana-expansion-hotto` | PASS | HOT—TOE supplies ほっと with the t/t boundary supporting っ; the protected foot causes relief, and ほっとする is explained correctly. |
| `kana-expansion-odoodo` | PASS | OH—DOUGH repeated honestly supplies お・ど・お・ど in order; the timid baker repeatedly drops dough under scrutiny, making nervous hesitation the consequence. Both おどおどする and おどおどした are accurate, and the example is natural. |
| `kana-expansion-harahara` | PASS | Exact 腹（はら） repeated covers はらはら; wobbling stomachs on a fraying tightrope make anxiety and suspense unavoidable, with accurate usage. |

### How Things Move

| Word ID | Verdict | Independent finding |
| --- | --- | --- |
| `kana-expansion-nonbiri` | PASS | 飲ん（のん）＋ビリ covers のんびり exactly; the last-place runner stops to drink and lounge, making leisurely relaxation the consequence and preserving the nasal. |
| `kana-expansion-burabura` | PASS | BRA repeated is a complete close cue for ぶらぶら; the walking clothesline makes both dangling and aimless wandering visible, with accurate scope. |
| `kana-expansion-kotsukotsu` | PASS | Exact 骨（こつ） repeated covers こつこつ; adding one bone at a time makes steady, diligent work the visible consequence, with natural adverbial usage. |
| `kana-expansion-gungun` | PASS | GOON repeated supplies ぐんぐん, including both nasals; two actual goons rapidly haul the plant upward, so the sound actors and growth consequence now connect. |
| `kana-expansion-sotto` | PASS | SOT—TOE supplies そっと with a genuine t/t boundary for っ; the normally noisy sot acts gently to avoid waking the mouse, and the unobtrusive-action nuance is accurate. |
| `kana-expansion-jitto` | PASS | JIT from the jittery toy plus TOE supplies じっと with a t/t boundary for っ; freezing the moving toy makes stillness the direct consequence. |
| `kana-expansion-furafura` | PASS | FLA repeated is a complete close cue; the staggering flags now pay off `<vocabulary>unsteadily</vocabulary>` directly, and the dizziness/indecision scope is accurate. |
| `kana-expansion-guruguru` | PASS | GURU repeated covers ぐるぐる; spinning gurus and wrapping robes make circular repetition inevitable, with accurate usage. |
| `kana-expansion-pekopeko` | PASS | PECK—OH repeated covers ぺこぺこ; the empty bowl makes starvation causal and the お腹がぺこぺこ clarification is natural. |
| `kana-expansion-girigiri` | PASS | GEAR-Y repeated is a complete close cue; the final gear tooth embodies a narrow limit, and time/space/rule usage is accurate. |

### Food Texture in Every Bite

| Word ID | Verdict | Independent finding |
| --- | --- | --- |
| `kana-expansion-mochimochi` | PASS | Familiar MOCHI repeated retrieves もちもち; the stretching rice cakes make elasticity and chewiness unavoidable, with accurate food scope. |
| `kana-expansion-sakusaku` | PASS | SACK repeated is a complete close cue, with final /k/ supporting く; bursting cracker sacks cause the crisp texture and the broader efficiency note is accurate. |
| `kana-expansion-paripari` | PASS | PARRY repeated covers ぱりぱり; brittle chip shields crack in the action, and the food/paper sound range is accurate. |
| `kana-expansion-karikari` | PASS | CARRY repeated covers かりかり; hard crackers create crunch and the missing one causes irritability, accurately joining both senses. |
| `kana-expansion-tsurutsuru` | PASS | TOOL repeated is a loose but complete consonant/vowel cue for つるつる; the ungrippable polished tools make smooth slipperiness the consequence, with accurate noodle use. |
| `kana-expansion-sarasara` | PASS | Exact 皿（さら） repeated covers さらさら; silky hair flowing from the plates makes smooth, free movement causal, with accurate hair/powder/stream scope. |
| `kana-expansion-betabeta` | PASS | BETA repeated supplies the complete べたべた pattern as a close cue; labels physically sticking to the learner make the meaning unavoidable, with accurate clingy-person scope. |
| `kana-expansion-zarazara` | PASS | CZAR—A repeated covers ざらざら; the czar's sandpaper creates the rough texture, and the voice extension is accurate. |
| `kana-expansion-shakishaki` | PASS | SHAKY repeated is a close full cue for しゃきしゃき; visibly shaking celery snaps crisply, and the brisk-behavior extension is accurate. |
| `kana-expansion-torotoro` | PASS | THROW repeated is a loose but recoverable cue for とろとろ; cheese that cannot be thrown because it oozes makes the syrupy softness memorable, with accurate simmering/dozing scope. |

### Weather You Can Feel

| Word ID | Verdict | Independent finding |
| --- | --- | --- |
| `kana-expansion-pokapoka` | PASS | POKE—A repeated supplies ぽかぽか as a close cue; the heater releases pleasant warmth, and the non-scorching nuance is correct. |
| `kana-expansion-jimejime` | PASS | GYM—EH repeated covers じめじめ; condensation in crowded gyms causes clammy humidity, with an accurate figurative extension. |
| `kana-expansion-mushimushi` | PASS | MUSHY repeated is a complete close cue for むしむし; bread literally becoming mush binds the sound to oppressive heat and humidity. |
| `kana-expansion-hinyari` | PASS | Exact 品（ひん）＋槍（やり） covers ひんやり, including ん; the freezer-cold spear makes pleasant chilliness tactile, with accurate usage. |
| `kana-expansion-donyori` | PASS | Exact 丼（どん）＋寄り（より） covers どんより; the bowl leaning over the window blocks sunlight and causes the gloomy, overcast result. |
| `kana-expansion-zaazaa` | PASS | Two deliberately extended CZAAAR cues cover ざあ・ざあ with both long vowels; the czars dump storm barrels and directly cause pouring rain. |
| `kana-expansion-shitoshito` | PASS | SHEET—OH repeated supplies しとしと as a close, ordered cue; drops landing on the sheet cause the soft drizzle sound, and the contrast with a downpour is accurate. |
| `kana-expansion-bishobisho` | PASS | BEE—SHOW repeated supplies び・しょ・び・しょ, including both small ょ; water flung from the bees' wings causes the coat to become completely soaked. |
| `kana-expansion-soyosoyo` | PASS | SO—YO repeated fully covers そよそよ; yo-yos moving only in a breeze make gentle wind causal, and the usage is accurate. |
| `kana-expansion-karatto` | PASS | CAR—RAT—TOE supplies からっと, with the t/t boundary supporting っ; sun-dried laundry makes the clear, dry result visible and the usage extension is accurate. |

### Body Signals

| Word ID | Verdict | Independent finding |
| --- | --- | --- |
| `kana-expansion-kushami` | PASS | COO—SHAMMY is a complete close cue for くしゃみ; inhaled dust directly causes the sneeze, and the noun/verb construction note is accurate. |
| `kana-expansion-shakkuri` | PASS | SHACK—REE covers しゃっくり through the established SHACK → シャック pattern, including っ and く; the repeated jerks cause the hiccups. |
| `kana-expansion-memai` | PASS | MEH—MY supplies め・まい without an unused syllable; the funhouse mirror's spinning reflection causes dizziness, and めまいがする is accurately explained. |
| `kana-expansion-mukumi` | PASS | MOO—COO—ME supplies むくみ as a complete close cue; ballooning feet make swelling unavoidable, and the edema-like usage nuance is accurate. |
| `kana-expansion-shibire` | PASS | SHE—BEE—RAY covers しびれ in order; the ray causes numbness and pins and needles, with correct しびれる usage. |
| `kana-expansion-hokuro` | PASS | HAWK—ROW supplies ほくろ as a close cue; the dark mark is visually central and the skin-mole distinction is accurate. |
| `kana-expansion-nikibi` | PASS | KNEE—KEY—BEE covers にきび exactly as close chunks; the bee leaves the pimple, and individual/acne scope is accurate. |
| `kana-expansion-hiji` | PASS | HE—GEE covers ひじ; striking the joint makes elbow the consequence, and the ひざ contrast is useful. |
| `kana-expansion-odeko` | PASS | OH—DECK—OH supplies おでこ, with DECK's final /k/ joining OH as こ; the head impact creates the forehead bump and the register note is accurate. |
| `kana-expansion-mabuta` | PASS | MA＋豚（ぶた） covers まぶた exactly; the pig closes the eye curtain, and the anatomical clarification is accurate. |

### Work & Study Desk

| Word ID | Verdict | Independent finding |
| --- | --- | --- |
| `kana-expansion-ofisu` | PASS | OFFICE transparently retrieves オフィス; the folding workplace is concrete and the 事務所 contrast is accurate. |
| `kana-expansion-miitingu` | PASS | MEETING transparently retrieves ミーティング, including ー and ン; the chair circle is visual and the 会議 distinction is useful. |
| `kana-expansion-sukejuuru` | PASS | SCHEDULE retrieves スケジュール with both long marks; the trapping calendar makes missed appointments consequential and the collocations are accurate. |
| `kana-expansion-purojekuto` | PASS | PROJECT transparently retrieves プロジェクト, including small ジェ; the coordinated board makes the meaning concrete and the usage is accurate. |
| `kana-expansion-chiimu` | PASS | TEAM supplies チーム and its held vowel; stitched jerseys embody cooperation and the domain range is accurate. |
| `kana-expansion-pen` | PASS | PEN supplies ペン including the final nasal; the runaway writer is concrete and the pencil contrast is accurate. |
| `kana-expansion-tesuto` | PASS | TEST retrieves テスト; the paper examining the student is memorable and the school/trial versus 試験 nuance is accurate. |
| `kana-expansion-repooto` | PASS | REPORT retrieves レポート including ー; the deadline scene leads to the report/paper meaning and the collocations are natural. |
| `kana-expansion-kopii` | PASS | COPY retrieves コピー including its final held vowel; absurd duplicated objects make the meaning immediate and both コピーする and コピーを取る are accurate. |
| `kana-expansion-memo` | PASS | MEMO transparently retrieves メモ; the memory elephant creates the note before it is forgotten, and both common verb constructions are accurate. |

### Laundry & Home Care

| Word ID | Verdict | Independent finding |
| --- | --- | --- |
| `kana-expansion-airon` | PASS | IRON transparently retrieves アイロン including ン; the treaded clothes iron is concrete and アイロンをかける is the correct standard collocation. |
| `kana-expansion-hangaa` | PASS | HANGER retrieves ハンガー with its nasal and long final vowel; the animated hanger is memorable and the hangar false-friend warning is useful. |
| `kana-expansion-shanpuu` | PASS | SHAMPOO retrieves シャンプー including small ャ, ン, and ー; the foam eruption is concrete and the hair-use nuance is accurate. |
| `kana-expansion-doraiyaa` | PASS | DRYER retrieves ドライヤー with both long-vowel behavior and small ヤ; the hurricane hair dryer and default appliance sense are accurate. |
| `kana-expansion-burashi` | PASS | BRUSH transparently retrieves ブラシ; the marching attachments make the broad tool category visible and context selects a natural sense. |
| `kana-expansion-baketsu` | PASS | BUCKETS is a close whole-word cue for バケツ; the bucket brigade is concrete and the handled-pail usage is accurate. |
| `kana-expansion-suponji` | PASS | SPONGE retrieves スポンジ including ン and ジ; the sink-swallowing sponge is memorable and the cake ambiguity is accurately noted. |
| `kana-expansion-rappu` | PASS | WRAP retrieves ラップ, with the closed /p/ supporting ッ＋プ; the refrigerator scene and kitchen-versus-music distinction are accurate. |
| `kana-expansion-seroteepu` | PASS | SELL—OH—TAPE supplies セ・ロ・テー・プ as a complete close cue, with l/r approximation and a genuinely extended テー; the stuck roll makes adhesive tape unavoidable without asserting an etymology. |
| `kana-expansion-moppu` | PASS | MOP retrieves モップ, with the closed /p/ supporting ッ＋プ; the racing cleaner is concrete and モップをかける is accurate. |

### Around the City

| Word ID | Verdict | Independent finding |
| --- | --- | --- |
| `kana-expansion-hoomu` | PASS | HOME supplies ホーム and its held vowel; moving the house beside tracks makes “platform” memorable and the プラットホーム clipping note is accurate. |
| `kana-expansion-rasshu` | PASS | RUSH retrieves ラッシュ, including ッ＋シュ; the crowd surge makes rush hour causal and the broader sense is accurate. |
| `kana-expansion-gaido` | PASS | GUIDE transparently retrieves ガイド; the walking arrow is concrete and the person/book/action range is accurate. |
| `kana-expansion-tsuaa` | PASS | TOUR retrieves ツアー including its held final vowel; the walking bus is memorable and packaged/concert-tour scope is accurate. |
| `kana-expansion-kyanpu` | PASS | CAMP retrieves キャンプ including small ャ and ン; the self-opening tent is concrete and the sports-camp extension is accurate. |
| `kana-expansion-rentaru` | PASS | RENTAL retrieves レンタル including ン; the return clock makes temporary paid use causal and the verb construction is accurate. |
| `kana-expansion-sentaa` | PASS | CENTER retrieves センター including ン and ー; the central public facility is concrete and compound-facility usage is accurate. |
| `kana-expansion-eria` | PASS | AREA transparently retrieves エリア; the lifted zone is visual and the service/venue scope is accurate. |
| `kana-expansion-koinrokkaa` | PASS | COIN LOCKER retrieves コインロッカー, including both nasals, ッ, and ー; the swallowing locker makes the station use memorable. |
| `kana-expansion-baiku` | PASS | BIKE retrieves バイク; the added engine makes the Japanese motorcycle sense unavoidable and the 自転車 contrast is accurate. |

### People on Screen & Stage

| Word ID | Verdict | Independent finding |
| --- | --- | --- |
| `kana-expansion-kappuru` | PASS | COUPLE retrieves カップル, including ッ; paired cups create the romantic couple meaning and the non-generic-pair note is accurate. |
| `kana-expansion-fan` | PASS | FAN retrieves ファン, including small ファ and ン; the paper fan at a concert binds the admirer sense and the appliance ambiguity is accurately signposted. |
| `kana-expansion-menbaa` | PASS | MEMBER retrieves メンバー, including ン and ー; the shared stage makes membership causal and the group-domain range is accurate. |
| `kana-expansion-riidaa` | PASS | LEADER retrieves リーダー with both long vowels; the maze rescue is concrete and the 指導者 register contrast is accurate. |
| `kana-expansion-gesuto` | PASS | GUEST retrieves ゲスト; the red carpet makes the invited-guest sense immediate and the program/hotel range is accurate. |
| `kana-expansion-aidoru` | PASS | IDOL retrieves アイドル; the singing statue binds the Japanese pop-idol sense and the semantic specialization is correctly explained. |
| `kana-expansion-tarento` | PASS | TALENT retrieves タレント, including ン; the suitcase of performers makes the TV-personality meaning memorable and prevents the English false friend. |
| `kana-expansion-kyarakutaa` | PASS | CHARACTER retrieves キャラクター, preserving small キャ and ー; the figure leaving the book is concrete and the personality/mascot extensions are accurate. |
| `kana-expansion-hiiroo` | PASS | HERO retrieves ヒーロー with both long vowels; the rescue makes hero unavoidable and the 英雄 tone contrast is accurate. |
| `kana-expansion-ibento` | PASS | EVENT retrieves イベント including ン; the calendar releases a planned occasion and the incident-versus-organized-event nuance is accurate. |

### Fitness & Everyday Wellness

| Word ID | Verdict | Independent finding |
| --- | --- | --- |
| `kana-expansion-masuku` | PASS | MASK retrieves マスク; the carriage-wide face covering is concrete and the health-context sense is accurate. |
| `kana-expansion-kontakuto` | PASS | CONTACT retrieves コンタクト, preserving both nasals; the lens touching the eye makes the abbreviation's sense explicit and accurate. |
| `kana-expansion-bitamin` | PASS | VITAMIN transparently retrieves the established ビタミン form, including ン; the capsule releases vitamin-rich foods and the compounds are accurate. |
| `kana-expansion-jogingu` | PASS | JOGGING retrieves ジョギング, including small ジョ and both nasals; the self-running shoes and pace distinction are accurate. |
| `kana-expansion-haikingu` | PASS | HIKING retrieves ハイキング, including both nasals; the walking trail sign is concrete and the 登山 contrast is accurate. |
| `kana-expansion-yoga` | PASS | YOGA retrieves ヨガ; the self-posing mat is memorable and ヨガをする is natural. |
| `kana-expansion-jimu` | PASS | GYM retrieves ジム; the folding fitness facility and 体育館 contrast are accurate. Its folded reading matches unrelated custom `事務（じむ）`, but the writing and lexeme are distinct. |
| `kana-expansion-puuru` | PASS | POOL retrieves プール with a genuinely held vowel; the moving pool is concrete and the swimming-pool default sense is accurate. |
| `kana-expansion-sutorecchi` | PASS | STRETCH retrieves ストレッチ, including ッ＋チ; the rubber-band action makes the exercise meaning visual and the usage is accurate. |
| `kana-expansion-toreeningu` | PASS | TRAINING retrieves トレーニング with both long/nasal units; the weighted train gives a memorable workout and the skill-practice extension is accurate. |

### Kitchen Tools & Flavors

| Word ID | Verdict | Independent finding |
| --- | --- | --- |
| `kana-expansion-soosu` | PASS | SAUCE retrieves ソース with a genuinely held vowel; the plate river is concrete and the Japanese Worcestershire-style default is accurately noted. |
| `kana-expansion-supaisu` | PASS | SPICE retrieves スパイス; the sneezing jar changes the stew and the figurative extension is accurate. |
| `kana-expansion-reshipi` | PASS | RECIPE retrieves レシピ; the card's measuring hands make ordered instructions concrete and the figurative how-to extension is accurate. |
| `kana-expansion-furaipan` | PASS | FRY PAN retrieves フライパン including ン; flying breakfast makes the cookware memorable and the definition is accurate. |
| `kana-expansion-oobun` | PASS | OVEN retrieves オーブン with the long initial vowel and final nasal; the loaf launch is concrete and the microwave contrast is accurate. |
| `kana-expansion-renji` | PASS | RANGE retrieves レンジ; the appliance shrinking into a microwave makes the Japanese default meaning memorable and the stove/range ambiguity is accurate. |
| `kana-expansion-guriru` | PASS | GRILL retrieves グリル; the jaw-like grill causes the char marks and the built-in fish-grill nuance is accurate. |
| `kana-expansion-mikisaa` | PASS | MIXER retrieves ミキサー with its held final vowel; the smoothie scene and Japanese blender specialization are accurate. |
| `kana-expansion-wain` | PASS | WINE retrieves ワイン including the final nasal; the grapevine bottle is concrete and the red/white compounds are accurate. |
| `kana-expansion-taimaa` | PASS | TIMER retrieves タイマー with its held final vowel; the chasing countdown device is memorable and タイマーをセットする is natural. |

## Final stable-source rerun

The initial revision was not releasable because of the 16 blockers preserved above. After the coordinated corrections and final `ぞっと` → `おどおど` replacement, the source modification time and hash were observed twice without change:

| Observation | Source mtime | SHA-256 |
| --- | --- | --- |
| `2026-09-01 14:36:23 +0200` | `2026-09-01 14:34:08 +0200` | `8589b1c91cc0280a86f766a761f66968a35f3d4fef658f04268d3bc27f899cb5` |
| `2026-09-01 14:37:46 +0200` | `2026-09-01 14:34:08 +0200` | `8589b1c91cc0280a86f766a761f66968a35f3d4fef658f04268d3bc27f899cb5` |

All checks were rerun against that exact final hash:

| Final gate | Result |
| --- | ---: |
| JSON, metadata, pack, and word counts | 12 packs / 120 words — PASS |
| Unique IDs, written forms, and target readings | 120 / 120 — PASS |
| `characters === reading` and exact concatenated `readingMap` | 120 / 120 — PASS |
| Kana-only shape and no `readingMnemonic` | 120 / 120 — PASS |
| Balanced learner markup and exact target in context | 120 / 120 — PASS |
| Fresh JMdict exact reading with applicable sense | 120 / 120 — PASS |
| WaniKani exact written and folded-reading exclusion | 120 / 120 — PASS |
| Existing-custom hard collision exclusion | 120 / 120 — PASS |
| Independent sound hook, scene, payoff, usage, and context review | 120 / 120 — PASS |

The sole custom folded-reading review signal, `ジム` versus unrelated `事務（じむ）`, remains an approved homophone rather than a duplicate lexeme.

## Final release recommendation

The frozen 120-word kana expansion passes the independent content gate. All final entries have a recoverable full-reading path, a concrete meaning-linked scene, an accurate payoff and usage clarification, natural context, fresh dictionary evidence, and no WaniKani or custom duplicate lexeme. No kana-content blocker remains.
