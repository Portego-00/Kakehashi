# Kanji custom-vocabulary story-mnemonic validation

_Independent editorial review and correction re-review, 2026-09-01._

## Verdict

**PASS: 121 PASS, 0 FAIL, 121 total.** The 12 previously blocked reading mnemonics were replaced in the source and independently re-reviewed. A `PASS` means the reading path retrieves the canonical reading in order, any approximation is phonologically defensible, the scene binds that sound to the tested meaning, and the usage note is accurate.

Reviewed source SHA-256: `6fb82e3b8c658240e2e871f07431f6a3e7da9d3c762b3b2abc71515e8822b82e`

| Level range | PASS | FAIL | Total |
|---|---:|---:|---:|
| 1–10 | 27 | 0 | 27 |
| 11–20 | 23 | 0 | 23 |
| 21–30 | 21 | 0 | 21 |
| 31–40 | 19 | 0 | 19 |
| 41–50 | 17 | 0 | 17 |
| 51–60 | 14 | 0 | 14 |
| **All** | **121** | **0** | **121** |

## Programmatic checks

The source JSON parsed successfully. A read-only validator checked all 121 records:

- `readingMap` groups concatenate exactly to the canonical `reading`: **121/121**.
- A nonempty `<reading>` cue is present: **121/121**.
- A nonempty `<vocabulary>` meaning payoff is present: **121/121**.
- Mnemonic markup uses only the supported tags and is balanced: **121/121**.
- No learner-facing `Reading map:`, beat-count, or “say/read/pronounce the word” drill language was found: **121/121**.

Those structural checks do not establish mnemonic quality. Human review found 12 sound-path blockers in the first pass; all 12 applied corrections now pass a second independent review. Two additional independent full-set cross-checks are still in progress and may supersede this disposition if they identify further blockers.

## Item-by-item review

| ID | Verdict | Editorial evidence |
|---|---|---|
| `kanji-01-10-totte` | PASS | 取→と and 手→て are plausible components; the caught t/t boundary explicitly supports っ, and the handle acts on the learner. |
| `kanji-01-10-hitokuchi` | PASS | HITO–KUCHI covers ひとくち in order and the one-mouth scene forces “one bite/mouthful.” |
| `kanji-01-10-daiku` | PASS | DIE–COO closely covers だいく; the collapsing clock gives the carpenter an action and consequence. |
| `kanji-01-10-nyuushu` | PASS | NEW supports にゅう and SHOE closely supports しゅ; obtaining the rare shoe makes the meaning retrievable. |
| `kanji-01-10-yuuhi` | PASS | YOU–HE covers ゆうひ and the race against sunset binds the cue to the evening sun. |
| `kanji-01-10-honjitsu` | PASS | HON–JITSU covers ほんじつ, including ん, and the one-day-only performance makes “today” decisive. |
| `kanji-01-10-hibi` | PASS | ひび “cracks” is an exact Japanese homophone; cracks spreading across calendar pages strongly bind it to day-by-day life. |
| `kanji-01-10-honnin` | PASS | HON–NIN covers both nasals and the unmasked ninja makes “the person themself” inevitable. |
| `kanji-01-10-tehon` | PASS | TEA–HON is a defensible close cue for てほん; students copying the goose pose supplies a concrete model. |
| `kanji-01-10-issai` | PASS | HISS losing H leaves ISS; the ISS–SIGH s/s boundary now supports っ without the former extra /t/, and the disappearing props anchor the full/negative meanings. |
| `kanji-01-10-chuushin` | PASS | CHEW supports ちゅう and SHIN supports しん; drilling to the center makes the meaning the consequence. |
| `kanji-01-10-furuhon` | PASS | FULL–HORN is a reasonable close path through ふるほん, and the battered book opening into a horn is memorable. |
| `kanji-01-10-shitami` | PASS | SHE–TUMMY closely covers したみ; inspecting the model before surgery accurately anchors an advance inspection. |
| `kanji-01-10-hitokoto` | PASS | HITO–KOTO covers the complete reading and limiting both music and speech to one unit anchors a brief comment. |
| `kanji-01-10-sedai` | PASS | SEH–DIE covers せだい with no discarded consonant, and the die rolling down a family tree makes each generation visible. |
| `kanji-01-10-nanika` | PASS | NANNY–KA closely covers なにか and the mystery box makes the unknown “something” concrete. |
| `kanji-01-10-shushoku` | PASS | SHOE–SHOCK covers しゅしょく closely and the boot replacing rice makes the staple-food payoff unavoidable. |
| `kanji-01-10-kongo` | PASS | CONGO supplies こんご, including nasal assimilation, and the forward-only sign clearly anchors “from now on.” |
| `kanji-01-10-demae` | PASS | DE–MAE covers でまえ and the meal reaching Mae's front door directly realizes food delivery. |
| `kanji-01-10-naika` | PASS | NAI–KA covers ないか and the clinic inside a stomach memorably anchors internal medicine. |
| `kanji-01-10-jouei` | PASS | JOE–A covers じょうえい, with both English diphthongs supporting the long sequences; the projector scene anchors screening. |
| `kanji-01-10-irai` | PASS | E–LIE covers いらい with a standard r/l approximation, and the frozen clock makes the starting point for “ever since” vivid. |
| `kanji-01-10-inai` | PASS | いない “not there” is an exact Japanese homophone; the boundary scene distinguishes “within” and correctly notes inclusion of the maximum. |
| `kanji-01-10-seken` | PASS | SE–KEN covers せけん and the whole town discussing Ken gives society/the public a visible consequence. |
| `kanji-01-10-nakami` | PASS | NAKA–ME covers なかみ closely; the miniature self physically becomes the contents inside the box. |
| `kanji-01-10-shuyaku` | PASS | SHOE–YAK covers しゅやく closely, and the dressed yak stealing the spotlight anchors the leading role. |
| `kanji-01-10-taichou` | PASS | TIE–CHO covers たいちょう, with Cho's /o/ glide supporting ちょう; the thermometer reading directly reveals physical condition. |
| `kanji-11-20-dengon` | PASS | DEN–GONE covers でんごん, including both nasals, and the absent spy makes the relayed message necessary. |
| `kanji-11-20-tayori` | PASS | 頼り and 便り are exact たより homophones; the reliable carrier pigeon binds reliance to news/correspondence. |
| `kanji-11-20-kyoutsuu` | PASS | KYO–TWO covers きょうつう with the corrected /o/ sequence, and the one ticket shared by two actors forces the common/shared payoff. |
| `kanji-11-20-riyou` | PASS | LEE–YO covers りよう, with YO's diphthong supporting よう, and the improvised crane anchors practical use. |
| `kanji-11-20-jimi` | PASS | JIMMY closely covers じみ and the gray outfit disappearing at a glitter party strongly anchors plain/subdued. |
| `kanji-11-20-seibun` | PASS | SAY–BUN covers せいぶん, including ん; ingredients jumping out of the bun force the component meaning. |
| `kanji-11-20-seichou` | PASS | SAY–CHO covers both long sequences in せいちょう and the seedling's explosive growth supplies the payoff. |
| `kanji-11-20-uwagi` | PASS | OOH–WAGGY covers うわぎ without inventing a unit; the wagging puppy physically spins its outerwear. |
| `kanji-11-20-nakaniwa` | PASS | NAKA–KNEE–WAH covers なかにわ and the trapped echo distinguishes an enclosed courtyard from an ordinary yard. |
| `kanji-11-20-kouryuu` | PASS | CO.–RYU supports こうりゅう with both extended vowel sequences; the town-to-town exchange is concrete and reciprocal. |
| `kanji-11-20-taion` | PASS | TIE–ON covers たいおん, including the final nasal, and tying on a thermometer directly reveals body temperature. |
| `kanji-11-20-kyoukan` | PASS | KYO–CAN covers きょうかん closely, and the friend's feeling appearing in Kyo's chest makes empathy literal. |
| `kanji-11-20-yuujou` | PASS | YOU–JOE supports ゆうじょう and the friendship bridge turns the bond into a visible consequence. |
| `kanji-11-20-gasshuku` | PASS | GAS–SHOOK follows the approved close pattern: the s/sh boundary supports っ and SHOOK covers しゅく; the shared lodge anchors camp. |
| `kanji-11-20-sankou` | PASS | SUN–CO. covers さんこう and the glowing reference library gives consultation a concrete purpose. |
| `kanji-11-20-hanataba` | PASS | HANA–TABA covers はなたば and the flowers tying themselves into a bunch provides the bouquet payoff. |
| `kanji-11-20-kaikei` | PASS | KAI–KAY covers かいけい and checking the bill twice accurately links checkout and accounting. |
| `kanji-11-20-kubetsu` | PASS | KOO–BETS is a defensible close path through くべつ; sorting red and blue bets creates the distinction. |
| `kanji-11-20-tani` | PASS | TAN–E covers たんい and explicitly preserves the ん/い boundary; the single measuring credit anchors “unit.” |
| `kanji-11-20-jushin` | PASS | JU–SHIN covers じゅしん and the shin-mounted receiver makes signal reception visible. |
| `kanji-11-20-nyuuyoku` | PASS | NEW–YOKU covers にゅうよく and the new bathtub makes taking a bath the scene's consequence. |
| `kanji-11-20-mikaku` | PASS | MIKA–KAKU covers みかく and the tongue lighting up turns the faculty of taste into an action. |
| `kanji-11-20-kosei` | PASS | CO.–SAY is a close complete cue for こせい; unique shouted slogans make individuality impossible to miss. |
| `kanji-21-30-jimu` | PASS | GYM is an established close sound for じむ and paperwork swallowing the gym memorably changes it into administration. |
| `kanji-21-30-kisei` | PASS | KEY–SAY covers きせい and the childhood house demanding a holiday return correctly narrows the homecoming meaning. |
| `kanji-21-30-dansui` | PASS | DAN–SUI covers だんすい, including ん, and empty pipes give a direct water-outage consequence. |
| `kanji-21-30-tenken` | PASS | TEN–KEN covers てんけん with both nasals; checking ten machines makes the systematic inspection concrete. |
| `kanji-21-30-chousa` | PASS | CHO–SAW is a defensible close cue for ちょうさ, and cutting open evidence drives the investigation. |
| `kanji-21-30-shinshitsu` | PASS | SHIN–SHEETS now covers しんしつ without the former possessive /z/, and the bed beneath the sheets anchors bedroom. |
| `kanji-21-30-outai` | PASS | OH–TIE supports おうたい and patiently untangling the customer accurately anchors attending to people. |
| `kanji-21-30-shuchou` | PASS | SHOE–CHO is a defensible close path through しゅちょう; the shoe used as debate evidence makes the assertion memorable. |
| `kanji-21-30-kokyuu` | PASS | KO–CUE covers こきゅう without an unlicensed k/k boundary; Ko's expanding chest makes breathing visible. |
| `kanji-21-30-kitaku` | PASS | KEY–TACK closely covers きたく, with TACK supplying たく, and retrieving the house key forces the return-home meaning. |
| `kanji-21-30-jougi` | PASS | JOE–GHEE covers じょうぎ closely and dragging a rigid ruler through ghee gives a memorable straightedge scene. |
| `kanji-21-30-tenji` | PASS | TEN–JI covers てんじ and the glass letters becoming museum exhibits bind sound to display. |
| `kanji-21-30-nenpi` | PASS | NEN–PI covers ねんぴ; the text honestly calls out the established ひ→ぴ sound change, and one pea of fuel anchors economy. |
| `kanji-21-30-jikyuu` | PASS | JI–CUE covers じきゅう and each clock cue producing a coin directly represents hourly pay. |
| `kanji-21-30-eiyou` | PASS | A–YO supports えいよう through two diphthongs and the vitamin cannon anchors nourishment. |
| `kanji-21-30-kyuushoku` | PASS | CUE–SHOCK covers きゅうしょく and the lunch cart's entrance gives school lunch a concrete consequence. |
| `kanji-21-30-inshou` | PASS | IN–SHOW covers いんしょう, including ん and the long vowel, while the fireworks hat leaves a literal impression. |
| `kanji-21-30-shudan` | PASS | SHOE–DAN closely covers しゅだん and the shoe used to cross a river embodies a means to an end. |
| `kanji-21-30-reitou` | PASS | RAY–TOE covers れいとう and the freezing ray makes “frozen” the unavoidable result. |
| `kanji-21-30-yorimichi` | PASS | YORI–ME–CHI covers よりみち without the former CHEESE tail, and leaving the direct road to visit the pair creates the detour. |
| `kanji-21-30-tekisetsu` | PASS | TECHIE–SETS closely covers てきせつ and setting every dial to the fitting position anchors “appropriate.” |
| `kanji-31-40-bunmyaku` | PASS | BUN–MEOW–COO is an explicitly imageable close path through ぶんみゃく, and the surrounding nonsense can only be resolved by context. |
| `kanji-31-40-seisou` | PASS | SAY–SEW supports せいそう and repaired curtains sweeping the floor make cleanup the consequence. |
| `kanji-31-40-amimono` | PASS | AMI–MO–NO now begins with an honest あみ sound, and the robot's runaway yarn anchors knitting. |
| `kanji-31-40-konzatsu` | PASS | KON–ZATSU covers こんざつ and the mascot physically jamming the gates anchors congestion. |
| `kanji-31-40-moushikomi` | PASS | MOE–SHE–KOMI covers もうしこみ without surplus COMB sounds, and the giant stamp visibly completes the application. |
| `kanji-31-40-oomori` | PASS | OH–OH–MORI covers おおもり without silent clipping, and Mori's mountain of rice makes the large serving inevitable. |
| `kanji-31-40-sunahama` | PASS | SUE–NAH–HAMMER is a defensible close path through すなはま, especially with non-rhotic HAMMER; the broken beach supplies the consequence. |
| `kanji-31-40-musu` | PASS | MUSU is an exact sound-key character rather than a drill, because the spirit actively traps steam and changes the dumplings. |
| `kanji-31-40-shukkin` | PASS | SHOOK–KIN uses a k/k boundary to support っ and KIN supplies きん; the alarm physically sends everyone to work. |
| `kanji-31-40-jikoku` | PASS | JI–KOKU covers じこく and carving the clock makes the exact time visible. |
| `kanji-31-40-kyuukou` | PASS | CUE–CO. supports きゅうこう with both long sequences and closing the classroom anchors cancellation. |
| `kanji-31-40-taizai` | PASS | TAI–ZAI covers たいざい and unpacking furniture makes the temporary stay absurdly concrete. |
| `kanji-31-40-unchin` | PASS | UN–CHIN covers うんちん, including both nasals, and the fare box under the chin forces the passenger-fare meaning. |
| `kanji-31-40-norikae` | PASS | NORI–KA–EH covers のりかえ and the wrong-train mistake creates the transfer as a consequence. |
| `kanji-31-40-koukan` | PASS | CO.–CAN covers こうかん without the former k/k collision, and the two cans swapping places directly enact exchange. |
| `kanji-31-40-fumikiri` | PASS | FUMI and KIRI are plausible native chunks; the striped gate literally cuts traffic at the railway crossing. |
| `kanji-31-40-atesaki` | PASS | AH-TEH–SAKI covers あてさき and missing recipient details make the address failure visible. |
| `kanji-31-40-katazukeru` | PASS | KATA–DZUKERU covers かたづける; the つける→づける voicing claim is plausible, and every object clicking home anchors tidying. |
| `kanji-31-40-chuusha` | PASS | CHEW–SHA supports ちゅうしゃ and the chewed keys force every vehicle to remain parked; the injection distinction is accurate. |
| `kanji-41-50-houtai` | PASS | HOE–TIE covers ほうたい and wrapping the injured hoe makes a bandage the direct consequence. |
| `kanji-41-50-shikyuu` | PASS | SHE–CUE closely covers しきゅう and the falling emergency curtain makes immediate action urgent. |
| `kanji-41-50-gyougi` | PASS | GYO is anchored by gyoza's ぎょう sound and GHEE closely supplies ぎ; the bowing food gives manners a memorable action. |
| `kanji-41-50-kanjin` | PASS | CAN–GENE closely covers かんじん and the one crop-saving gene makes the can genuinely crucial. |
| `kanji-41-50-nameraka` | PASS | NAH-MEH–RAKA covers なめらか and skating only after polishing makes smoothness the consequence. |
| `kanji-41-50-sokuseki` | PASS | SOKU–SEKI covers そくせき and the pot on a theater seat embodies an improvised instant meal. |
| `kanji-41-50-suitou` | PASS | SUE–E–TOE is a close complete path through すいとう and the bottle falling on a toe anchors a water flask. |
| `kanji-41-50-tenmetsu` | PASS | TEN–MET–SUE covers てんめつ, with the t/s boundary supplying つ, and the warning lights visibly blink. |
| `kanji-41-50-shiraga` | PASS | SHIRA–GA covers the established irregular whole-word reading; the text explicitly avoids a false regular-reading claim and the ghost causes gray hair. |
| `kanji-41-50-hikage` | PASS | HI–KAGE covers ひかげ and Kage's umbrella creates literal shade. |
| `kanji-41-50-shitsudo` | PASS | SHEETS–DOUGH is a defensible close path through しつど and both objects sticking together make humidity tangible. |
| `kanji-41-50-hamigaki` | PASS | HAMMY–GA–KEY covers はみがき closely and unlocking the toothbrush after meals anchors toothbrushing. |
| `kanji-41-50-hokori` | PASS | 埃 and 誇り are exact ほこり homophones; removing dust to reveal a trophy creates a strong pride payoff. |
| `kanji-41-50-tsuuchou` | PASS | TWO–CHO covers つうちょう with both long sequences and duplicate passbooks make the bankbook meaning concrete. |
| `kanji-41-50-kankisen` | PASS | CAN–KEY–SEN covers かんきせん, including both nasals, and the fan ejecting smoke and objects clearly ventilates the room. |
| `kanji-41-50-nikomu` | PASS | NIKOMU is an exact sound-key character in an active scene: the spirit enters the soup and its long stay causes the simmering. |
| `kanji-41-50-mudazukai` | PASS | MOO–DAD'S–KAI covers むだづかい closely, with /dz/ honestly supporting modern づ; buying diamond hay makes the waste consequential. |
| `kanji-51-60-kareha` | PASS | 彼は and 枯れ葉 share exact かれは; the leaf entering the speaker's mouth binds the phrase to a dead leaf, and the unvoiced は note is accurate. |
| `kanji-51-60-choujou` | PASS | CHO–JOE supports both long sequences in ちょうじょう and collision on the final rock makes the summit unavoidable. |
| `kanji-51-60-kankonsousai` | PASS | CAN–CON–SEW–SIGH covers every unit and both nasals/long vowels; the crown-wedding-funeral-festival procession anchors the umbrella meaning. |
| `kanji-51-60-hensachi` | PASS | HEN–SACHI covers へんさち and comparing the hen's result with every other chicken accurately anchors a deviation score. |
| `kanji-51-60-furoshiki` | PASS | FRO–SHE–KEY covers ふろしき as an explicitly disclosed close cue; wrapping the key turns the cloth into a carrier, and the bath-towel warning is accurate. |
| `kanji-51-60-jojoni` | PASS | JOE–JOE–KNEE covers じょじょに closely and the synchronized tiny descent makes gradual change visible. |
| `kanji-51-60-genkouyoushi` | PASS | GENKO–YOSHI covers げんこうようし through familiar name sounds and the dragon stamping every grid square anchors manuscript paper. |
| `kanji-51-60-sueoki` | PASS | SUE–EH–OH–KEY now supplies す・え・お・き in order, and leaving the price tag untouched anchors “left unchanged.” |
| `kanji-51-60-kenbikyou` | PASS | KEN–BEE–KYO covers けんびきょう, including both nasals and the long ending, and the magnified bee anchors a microscope. |
| `kanji-51-60-somatsu` | PASS | SO–MAT–SUE covers そまつ, with the t/s boundary supporting つ; the collapsing splintered bedding makes “shabby” consequential. |
| `kanji-51-60-tounyoubyou` | PASS | The verified 糖とう・尿にょう・病びょう component readings cover the word exactly; the sugar/urine/illness model forms a scene rather than a bare recitation. |
| `kanji-51-60-shikousakugo` | PASS | The verified 試し・行こう・錯さく・誤ご readings cover the whole word, and each flashing sign is tied to one stage of the failed invention cycle. |
| `kanji-51-60-mogishiken` | PASS | MOGI–SHE–KEN covers もぎしけん and the official-looking practice room clearly distinguishes a mock exam. |
| `kanji-51-60-wazurawashii` | PASS | WAS–RAH–WASHY–E is a defensible complete close cue for わずらわしい and the tangled laundry makes the burden concrete. |

## Resolved first-pass findings

Each wording below was applied to the source and passed this independent correction re-review. The original problem statement is retained as an audit trail.

### `kanji-01-10-issai` — 一切 — いっさい

Problem: `IT'S` contributes an unlicensed /t/ before the geminated s.

Applied wording (re-reviewed PASS):

> A magician slices the H off HISS, leaving <reading>ISS—SIGH</reading>, then sighs as every prop disappears. The two s sounds meet in the cut, and <vocabulary>everything</vocabulary> vanishes; with a negative command, not one prop returns. 一切 often means “not at all” when paired with a negative verb.

### `kanji-01-10-sedai` — 世代 — せだい

Problem: `SET` contributes a final /t/ that the target does not contain.

Applied wording (re-reviewed PASS):

> A referee named Seh rolls a glowing die down a family tree: <reading>SEH—DIE</reading>. Every time it lands, grandparents hand their place to children, revealing the next <vocabulary>generation</vocabulary>. 世代 groups people by the era or stage of life they share.

### `kanji-01-10-taichou` — 体調 — たいちょう

Problem: `CHOW` has the wrong vowel for ちょう.

Applied wording (re-reviewed PASS):

> Doctor Cho makes a patient <reading>TIE—CHO</reading> to an enormous thermometer. Cho reads its glowing number to judge the patient's <vocabulary>physical condition</vocabulary> and <vocabulary>state of health</vocabulary>. 体調 usually describes how someone is feeling physically.

### `kanji-11-20-kyoutsuu` — 共通 — きょうつう

Problem: `CUE` supplies きゅう rather than きょう.

Applied wording (re-reviewed PASS):

> Kyo hands the same ticket to two actors: <reading>KYO—TWO</reading>. Because both enter with one ticket, that pass is <vocabulary>common</vocabulary> to them and visibly <vocabulary>shared</vocabulary>. 共通 describes a feature, interest, or element held in common.

### `kanji-21-30-shinshitsu` — 寝室 — しんしつ

Problem: the possessive in `SHIN'S` inserts /z/.

Applied wording (re-reviewed PASS):

> Shin opens a door and a mountain of sheets buries him: <reading>SHIN—SHEETS</reading>. The giant bed beneath them leaves no doubt that this is the <vocabulary>bedroom</vocabulary>. 寝室 is specifically a room used for sleeping.

### `kanji-21-30-kokyuu` — 呼吸 — こきゅう

Problem: the `COCK—CUE` boundary doubles k and falsely suggests っ.

Applied wording (re-reviewed PASS):

> A rooster named Ko waits for the conductor's cue: <reading>KO—CUE</reading>. Ko inhales, then crows so powerfully that everyone can see its chest performing <vocabulary>breathing</vocabulary>. 呼吸 covers both a breath and the ongoing act of respiration.

### `kanji-21-30-yorimichi` — 寄り道 — よりみち

Problem: `CHEESE` contributes a final /z/ that is silently discarded.

Applied wording (re-reviewed PASS):

> Yori spots me and Chi waving from a side street: <reading>YORI—ME—CHI</reading>. She abandons the direct route to visit us, turning the stop into a delicious <vocabulary>detour</vocabulary>. 寄り道 is a side trip or stop made on the way somewhere.

### `kanji-31-40-amimono` — 編み物 — あみもの

Problem: English `AMY` starts with /eɪ/, not あ.

Applied wording (re-reviewed PASS):

> Ami's knitting robot Mo grabs the finished scarf, and Ami yells no: <reading>AMI—MO—NO!</reading> The machine keeps pulling yarn until the <vocabulary>knitting</vocabulary> buries the room. 編み物 can mean the activity or the thing being knitted.

### `kanji-31-40-moushikomi` — 申し込み — もうしこみ

Problem: `COMB—ME` contains surplus vowel and consonant material instead of clean こみ.

Applied wording (re-reviewed PASS):

> Moe points to herself, then to Komi, while the clerk calls <reading>MOE—SHE—KOMI</reading>. A giant stamp lands on their <vocabulary>application</vocabulary> and registers them both. 申し込み is an application, registration, or formal request to participate or receive something.

### `kanji-31-40-oomori` — 大盛り — おおもり

Problem: `MORE RICE` requires two silent clippings and leaves extra sound after り.

Applied wording (re-reviewed PASS):

> Two hungry bowls shout at chef Mori, <reading>OH—OH—MORI!</reading> Mori stacks rice into a mountain and serves an enormous <vocabulary>large portion</vocabulary>. 大盛り is a larger-than-standard serving, especially at a restaurant.

### `kanji-31-40-koukan` — 交換 — こうかん

Problem: `COKE—CAN` creates an unlicensed k/k boundary.

Applied wording (re-reviewed PASS):

> A company called Co. trades its empty can for a full one: <reading>CO.—CAN</reading>. The cans swap places and complete the <vocabulary>exchange</vocabulary>. 交換する means to exchange things, information, or parts for one another.

### `kanji-51-60-sueoki` — 据え置き — すえおき

Problem: `SUE—OH—KEY` omits え.

Applied wording (re-reviewed PASS):

> Clerk Sue hesitates, “Eh?”, then sets an old key beside the price tag: <reading>SUE—EH—OH—KEY</reading>. She leaves the number exactly where it was, so the price is <vocabulary>left unchanged</vocabulary>. 据え置き can mean keeping a price or rate unchanged, leaving equipment installed, or deferring action.

## Current disposition

This review now records **121 PASS / 0 FAIL** for source SHA-256 `6fb82e3b8c658240e2e871f07431f6a3e7da9d3c762b3b2abc71515e8822b82e`. The two separate full-set cross-checks remain authoritative if they return any new blocker.
