# Existing kanji vocabulary: independent composition review

_Read-only editorial review, 2026-09-01 (Europe/Madrid). No catalog source was edited during this review._

Source: [`custom-vocab-kanji-candidates.json`](./data/custom-vocab-kanji-candidates.json)  
Source SHA-256: `5407d9ba89c6ac91ab4f4ae5ee8298201bd0abcaaf2c4bafa1a2671a1ff8690c`  
Source modification time: `2026-09-01 14:08:27 +0200`

## Outcome

| Verdict | Count |
| --- | ---: |
| PASS | 103 |
| FAIL | 18 |
| **Total** | **121** |

Every `FAIL` is release-blocking. The JSON and composition validator are clean, but that does not excuse ungrammatical prose, a component bridge that is too abstract or circular to retrieve the target, misleading physiology or pseudo-etymology, or an unnatural example sentence.

## Method and evidence

All 121 `meaningMnemonic` values were inspected individually. Reading mnemonics were deliberately out of scope. For each word, the review checked:

- one `<kanji>` cue per distinct written kanji, in exact written order;
- the cue against every accepted meaning in the refreshed pinned WaniKani kanji subject;
- grammar and spelling after removing all mnemonic tags;
- whether the composition creates a concrete or transparent path to an accepted target meaning;
- whether an invented scene is clearly a memory bridge rather than false etymology;
- an accepted first-paragraph `<vocabulary>` payoff and balanced supported markup;
- a substantive second paragraph with accurate usage, register, collocation, or contrast; and
- both Japanese/English contexts for target inclusion, naturalness, and meaning accuracy.

The pinned [`wanikani-kanji-levels.snapshot.json`](./data/wanikani-kanji-levels.snapshot.json) was fetched at `2026-09-01T12:25:39.981Z`, covers all 2,102 kanji subjects including the one hidden subject, and has SHA-256 `fe8b4b24333ba91afb58771dfa4a827acc11e9b6cd265540eb3013f507bd6bc6`. Its visible accepted meanings and levels match the official WaniKani API revision `20170710` represented by the snapshot.

The deterministic rerun found zero errors:

| Mechanical gate | Result |
| --- | ---: |
| Exact five-level packs | 12 / 12 — PASS |
| Unique word IDs | 121 / 121 — PASS |
| Ordered component cues with accepted pinned meanings | 121 / 121 — PASS |
| Accepted first-paragraph target payoff | 121 / 121 — PASS |
| Blank-line practical paragraph | 121 / 121 — PASS |
| Balanced supported mnemonic markup | 121 / 121 — PASS |
| Non-empty contexts containing the exact written target | 242 / 242 — PASS |

The editorial pass then stripped the tags before judging the sentences. That exposed, among other findings, `a one bite`, `cut offs`, and `carrys`: all three are machine-valid markup but invalid English.

## Entry-by-entry verdicts

### Levels 1–5

| Word ID | Verdict | Composition, usage, and context review |
| --- | --- | --- |
| `kanji-01-10-hitokuchi` | FAIL | After tag removal, the payoff reads “a one bite or mouthful,” which is ungrammatical. Remove the article before “one bite,” or coordinate it as “one bite, or a mouthful.” The composition and both contexts otherwise pass. |
| `kanji-01-10-daiku` | PASS | BIG＋CONSTRUCTION becomes a wood-shaping craftsperson in a concrete scene, without claiming an etymology. The carpenter-versus-general-worker clarification and contexts are accurate. |
| `kanji-01-10-nyuushu` | PASS | ENTER＋HAND transparently reaches obtain/acquire. The item-or-information nuance and both examples are natural. |
| `kanji-01-10-yuuhi` | PASS | EVENING＋SUN is an appropriately short transparent bridge to evening/setting sun. The 夕焼け contrast and contexts are accurate. |
| `kanji-01-10-honjitsu` | PASS | MAIN＋DAY gives the day currently under discussion, then lands on today. The formal 今日 contrast and announcement/business examples are accurate. |
| `kanji-01-10-hibi` | PASS | DAY plus the iteration mark visibly creates day after day. The noun/adverb/の usage note and contexts are accurate. |
| `kanji-01-10-honnin` | PASS | REAL＋PERSON distinguishes the actual person from a representative or rumor. The practical confirmation nuance and contexts are strong. |
| `kanji-01-10-tehon` | PASS | HAND following a BOOK pattern creates a model to copy. The concrete-versus-exemplary scope and 手本にする usage are accurate. |
| `kanji-01-10-issai` | PASS | The explicitly imagined ONE sweeping CUT takes everything, giving a memorable bridge without false etymology. The negative “not at all” use is accurately separated. |
| `kanji-01-10-chuushin` | PASS | MIDDLE＋HEART directly creates a center/core. The physical and abstract uses and Xを中心に note are accurate. |
| `kanji-01-10-furuhon` | PASS | OLD＋BOOK transparently yields a secondhand book. The previous-ownership and 古本屋 clarification and contexts are accurate. |
| `kanji-01-10-shitami` | PASS | BELOW the surface＋SEE creates a useful advance-inspection scene. The room/venue/route scope and both contexts are accurate. |
| `kanji-01-10-hitokoto` | PASS | ONE compact thing one SAYS reaches a word or brief comment. The “short remark, not one dictionary word” clarification makes the terse bridge useful. |
| `kanji-01-10-sedai` | PASS | GENERATION giving way to the next ERA provides a concise time-group bridge. The age/historical grouping note and contexts are accurate. |
| `kanji-01-10-nanika` | PASS | WHAT plus uncertain か directly creates something/anything. The indefinite-pronoun explanation correctly handles the English question translation. |

### Levels 6–10

| Word ID | Verdict | Composition, usage, and context review |
| --- | --- | --- |
| `kanji-01-10-totte` | PASS | TAKE＋HAND produces the part one grips. The door/drawer/pot scope and handle/grip/knob distinction are accurate. |
| `kanji-01-10-shushoku` | PASS | MAIN＋EAT transparently identifies the food a diet centers on. The carbohydrate-versus-favorite-dish clarification and contexts are accurate. |
| `kanji-01-10-kongo` | FAIL | “Start at now” is not idiomatic English, so the bridge reads like machine-generated gloss insertion. Rewrite NOW＋LATER as a natural temporal scene—e.g. stand at NOW and point toward everything LATER—then retain the useful plans/forecasts nuance. |
| `kanji-01-10-demae` | PASS | A meal EXITing the restaurant and reaching the FRONT door memorably creates food delivery. The traditional prepared-food scope and 出前を取る note are accurate. |
| `kanji-01-10-naika` | PASS | INSIDE the body＋medical DEPARTMENT transparently reaches internal medicine. The field/department/clinic scope and 外科 contrast are accurate. |
| `kanji-01-10-jouei` | FAIL | “A film is thrown above you as reflected images reflect” is physically odd and stylistically broken by the reflection repetition. Rewrite ABOVE＋REFLECT as one concrete cinema action in which the image rises before the audience and fills the screen. Usage and contexts otherwise pass. |
| `kanji-01-10-irai` | FAIL | “Choose a point from which everything afterward has come” is unnatural and does not make the time relation easy to picture. Use the accepted SINCE or FROM cue with COME in a clear timeline running from the event to the present. The practical paragraph and contexts pass. |
| `kanji-01-10-inai` | PASS | FROM a boundary toward the INSIDE creates an inclusive limit. The endpoint rule and both time/distance contexts are accurate. |
| `kanji-01-10-seken` | PASS | WORLD packed into the INTERVAL between private lives is an original public-observer scene. The social-expectations nuance and contexts are accurate. |
| `kanji-01-10-nakami` | PASS | MIDDLE concealing the thing's real BODY reaches contents/substance. The container and figurative-inner-quality uses are accurately contrasted. |
| `kanji-01-10-shuyaku` | PASS | MAIN＋DUTY creates the role carrying the story's central responsibility. The performer/central-figure scope and contexts are accurate. |
| `kanji-01-10-taichou` | PASS | BODY as the thing one INVESTIGATES gives a compact condition check. The overall-feeling nuance and 体調が悪い／体調を整える collocations are accurate. |

### Levels 11–15

| Word ID | Verdict | Composition, usage, and context review |
| --- | --- | --- |
| `kanji-11-20-dengon` | PASS | TRANSMIT＋SAY directly yields a verbal message passed through someone. The entrusted-message nuance and contexts are accurate. |
| `kanji-11-20-tayori` | FAIL | “A small convenience arrives” asks the learner to picture an abstract property as a messenger and never makes CONVENIENCE retrieve news or a letter. Replace it with a concrete convenient messenger/object carrying the news. Also soften the usage claim: 便り does not inherently require emotional distance. |
| `kanji-11-20-kyoutsuu` | FAIL | After stripping tags, “it is what they have in common or shared” has broken coordination. Rewrite the payoff as “what they have in common or share,” while retaining the useful thread that passes through several things. Usage and contexts otherwise pass. |
| `kanji-11-20-riyou` | PASS | BENEFIT gained by putting something to USE transparently reaches utilize. The service/facility/system scope and examples are accurate. |
| `kanji-11-20-jimi` | PASS | EARTH FLAVOR gives the outfit a muted soil-and-clay palette, a concrete bridge to plain/subdued. The neutral-to-critical range and contexts are accurate. |
| `kanji-11-20-seibun` | PASS | BECOME a whole from every PART directly reaches component/ingredient. The substance domains and contexts are accurate. |
| `kanji-11-20-seichou` | PASS | BECOME LONGER visibly creates growth/development. The physical and figurative development scope and contexts are accurate. |
| `kanji-11-20-uwagi` | PASS | WORN ABOVE other clothes transparently creates outerwear. The removable outer-layer scope and contexts are accurate. |
| `kanji-11-20-nakaniwa` | PASS | MIDDLE＋GARDEN transparently creates a courtyard. The enclosure nuance and contexts are accurate. |
| `kanji-11-20-kouryuu` | PASS | People MIX while ideas STREAM between them, giving a memorable two-way exchange. The reciprocal-contact nuance and contexts are accurate. |
| `kanji-11-20-taion` | PASS | BODY＋WARMTH directly reaches body temperature. Measurement scope and 体温を測る usage are accurate. |
| `kanji-11-20-kyoukan` | PASS | TOGETHER inside the same FEELING directly reaches empathy/sympathy. The shared-response note and both contexts are acceptable. |
| `kanji-11-20-yuujou` | FAIL | “A friend joined to deep feeling” is stiff, non-idiomatic prose rather than a memorable bridge. Make the FRIEND's FEELING visibly join another friend's—then friendship is the consequence. The usage paragraph and contexts pass. |
| `kanji-11-20-gasshuku` | FAIL | “Teammates suit one another” is an unnatural use of SUIT and does not visually establish the concentrated group practice. Use the accepted FIT or JOIN cue, have the teammates lodge together, and make the shared training the consequence. |
| `kanji-11-20-sankou` | PASS | Letting another source PARTICIPATE while one THINKS clearly creates a reference consulted for a decision. The non-command nuance and contexts are accurate. |
| `kanji-11-20-hanataba` | PASS | FLOWER＋BUNDLE directly creates a bouquet. The carried/presented-arrangement nuance and contexts are accurate. |
| `kanji-11-20-kaikei` | PASS | People MEET for a meal and MEASURE what is owed, linking bill and accounting in one scene. The restaurant/organizational distinction and contexts are accurate. |
| `kanji-11-20-kubetsu` | PASS | Drawing boundaries around a DISTRICT to keep it SEPARATE creates distinction/differentiation. The category scope and contexts are accurate. |
| `kanji-11-20-tani` | PASS | SIMPLE scale steps assigned a RANK create countable units and credits. The measurement/course distinction and contexts are accurate. |
| `kanji-11-20-jushin` | FAIL | “Accept a signal you can believe arrived intact” is abstract, awkward, and makes BELIEVE an unexplained condition rather than a retrieval image. Use ACCEPT plus the accepted TRUST cue in a concrete receiver/confirmation scene. The transmission contrast and contexts pass. |

### Levels 16–20

| Word ID | Verdict | Composition, usage, and context review |
| --- | --- | --- |
| `kanji-11-20-nyuuyoku` | PASS | ENTER＋BATHE transparently gives bathing/taking a bath. The formal-instruction register and contexts are accurate. |
| `kanji-11-20-mikaku` | FAIL | “Flavor memory can memorize every taste because of your sense of taste” is circular and incorrectly makes memory the sensory mechanism. 覚 accepts AWARE/AWARENESS in the pinned subject; use FLAVOR＋AWARENESS for a direct, accurate bridge. The usage paragraph and contexts otherwise pass. |
| `kanji-11-20-kosei` | PASS | The explicitly pictured INDIVIDUAL whose GENDER is one tile in a larger mosaic creates a careful, non-reductive bridge to individuality. The positive distinctiveness nuance and contexts are accurate. |

### Levels 21–25

| Word ID | Verdict | Composition, usage, and context review |
| --- | --- | --- |
| `kanji-21-30-jimu` | PASS | Every OCCURRENCE creating another organizing TASK gives a recognizable paperwork loop. The clerical/administrative scope and contexts are accurate. |
| `kanji-21-30-kisei` | PASS | RETURN HOME to CONSERVE family ties creates a practical holiday-homecoming bridge without asserting word history. The temporary family-visit nuance and contexts are accurate. |
| `kanji-21-30-dansui` | FAIL | Appending `s` outside `<kanji>cut off</kanji>` produces “cut offs,” not “cuts off,” after tags are removed. Rewrite passively—“When the water is CUT OFF”—so the accepted cue remains intact. Usage and contexts pass. |
| `kanji-21-30-tenken` | PASS | Checking every POINT and EXAMINING it produces a systematic inspection. The safety/maintenance scope and contexts are accurate. |
| `kanji-21-30-chousa` | PASS | INVESTIGATE＋INSPECT directly creates investigation/survey. The fact-finding methods and contexts are accurate. |
| `kanji-21-30-shinshitsu` | PASS | LIE DOWN＋ROOM transparently creates a bedroom. The descriptive/formal nuance and contexts are accurate. |
| `kanji-21-30-outai` | FAIL | “The person standing versus you” is not idiomatic English for 対. Use the accepted OPPOSITE cue—someone standing opposite the worker—then make responding and attending to them the consequence. Usage and contexts otherwise pass. |
| `kanji-21-30-shuchou` | PASS | The MAIN point is visibly STRETCHED before the audience, making assert/claim memorable. The truth-neutral claim nuance and contexts are accurate. |
| `kanji-21-30-kokyuu` | PASS | CALL air, then SUCK it in and release it, creates a concrete breathing cycle. Biological/rhythm scope and contexts are accurate. |
| `kanji-21-30-kitaku` | PASS | RETURN HOME＋HOUSE transparently yields going/returning home. The residence-focused scheduling nuance and contexts are accurate. |
| `kanji-21-30-jougi` | PASS | DETERMINE a straight STANDARD with the measuring tool, clearly reaching ruler/straightedge. The physical-tool nuance and contexts are accurate. |
| `kanji-21-30-tenji` | PASS | EXPAND a collection and INDICATE what visitors should notice, creating an exhibition across a hall. Public-display scope and contexts are accurate. |
| `kanji-21-30-nenpi` | PASS | What an engine BURNS versus its EXPENSE directly creates fuel economy. The “good means efficient” clarification and contexts are accurate. |
| `kanji-21-30-jikyuu` | PASS | TIME＋SALARY transparently creates hourly pay. The per-hour amount nuance and contexts are accurate. |
| `kanji-21-30-eiyou` | PASS | The body must PROSPER by being FOSTERED with nourishment, reaching nutrition. The collective-nutrient scope and contexts are accurate. |
| `kanji-21-30-kyuushoku` | PASS | A school paying a daily SALARY in things to EAT is absurd but concrete and directly lands on school lunch. The broader institutional meal-service nuance and contexts are accurate. |

### Levels 26–30

| Word ID | Verdict | Composition, usage, and context review |
| --- | --- | --- |
| `kanji-21-30-inshou` | PASS | A SEAL-shaped ELEPHANT stamps the mind, a memorable scene for impression. Mental-effect usage and contexts are accurate. |
| `kanji-21-30-shudan` | PASS | A HAND following STEPS toward a goal creates a means/method. The end-directed instrument nuance and contexts are accurate. |
| `kanji-21-30-reitou` | PASS | COOL until FROZEN transparently gives freezing/frozen. Preservation compounds and both contexts are acceptable. |
| `kanji-21-30-yorimichi` | PASS | DRAW NEAR an interesting shop off the usual ROAD, clearly creating a detour/stop on the way. The small-diversion nuance and contexts are accurate. |
| `kanji-21-30-tekisetsu` | PASS | A SUITABLE CUT that fits the situation creates appropriate/suitable. The neutral-formal evaluation and contexts are accurate. |

### Levels 31–35

| Word ID | Verdict | Composition, usage, and context review |
| --- | --- | --- |
| `kanji-31-40-bunmyaku` | PASS | A VEIN running through WRITING is a vivid line-of-thought bridge to context. Linguistic/situational scope and contexts are accurate. |
| `kanji-31-40-seisou` | PASS | Make the space PURE by SWEEPING it, directly creating systematic cleaning. The 掃除 register contrast and contexts are accurate. |
| `kanji-31-40-amimono` | PASS | KNIT＋THING transparently reaches the craft or knitted item. The activity/object distinction and contexts are accurate. |
| `kanji-31-40-konzatsu` | PASS | MIX people into a RANDOM tangle, making crowding/congestion visual. The place/transport usage and contexts are accurate. |
| `kanji-31-40-moushikomi` | PASS | SAY HUMBLY what one wants and send it INTO an office, creating an application/registration/request. Noun/verb usage and contexts are accurate. |
| `kanji-31-40-oomori` | PASS | A BIG extra PILE of rice directly creates a large serving. Restaurant scope and 大盛りにする usage are accurate. |
| `kanji-31-40-sunahama` | PASS | SAND along a BEACH transparently creates a sandy shore. The rocky/concrete contrast and contexts are accurate. |
| `kanji-31-40-musu` | PASS | STEAM plus す is correctly presented as the transitive cooking action. The usage note and both contexts are accurate. |
| `kanji-31-40-shukkin` | PASS | EXIT home to perform WORK duty directly creates reporting to work. The 退勤／欠勤 contrast and contexts are accurate. |
| `kanji-31-40-jikoku` | PASS | A TIME CARVED into a timetable creates a precise clock time. The schedule-versus-abstract-time nuance and contexts are accurate. |
| `kanji-31-40-kyuukou` | PASS | Give a LECTURE a REST and the class is cancelled. Institutional causation, usage, and contexts are accurate. |
| `kanji-31-40-taizai` | PASS | Movement STAGNATES while one EXISTS in a place, creating a memorable temporary stay. Place/duration usage and contexts are accurate. |
| `kanji-31-40-unchin` | FAIL | Appending `s` outside `<kanji>carry</kanji>` produces the misspelling “carrys.” Rewrite so CARRY stays uninflected—e.g. a vehicle agrees to CARRY you—then retain the RENT-for-the-ride image. Usage and contexts pass. |

### Levels 36–40

| Word ID | Verdict | Composition, usage, and context review |
| --- | --- | --- |
| `kanji-31-40-norikae` | PASS | End one RIDE and EXCHANGE vehicles, directly creating a transfer/change. Noun/verb scope and contexts are accurate. |
| `kanji-31-40-koukan` | PASS | Two sides MIX and EXCHANGE what they brought, visibly creating a swap. Object/information/opinion scope and contexts are accurate. |
| `kanji-31-40-fumikiri` | PASS | STEP across the CUT where tracks slice through a road, making a railway crossing vivid. Level-crossing nuance and contexts are accurate. |
| `kanji-31-40-atesaki` | PASS | An ADDRESS sends a message AHEAD to its destination. Envelope/parcel/email scope and contexts are accurate. |
| `kanji-31-40-katazukeru` | PASS | Gather each FRAGMENT and ATTACH it to its proper place, creating a concrete tidying scene. Space/object/task scope and contexts are accurate. |
| `kanji-31-40-chuusha` | PASS | Making the CAR a temporary RESIDENT is a strong parking image. Vehicle-specific usage and contexts are accurate. |

### Levels 41–45

| Word ID | Verdict | Composition, usage, and context review |
| --- | --- | --- |
| `kanji-41-50-houtai` | PASS | WRAP a soft BELT around an injury, directly creating a bandage/dressing. 包帯を巻く and both contexts are accurate. |
| `kanji-41-50-shikyuu` | PASS | ATTAIN the point where everyone must HURRY, clearly creating urgent/immediately. The forceful business register and contexts are accurate. |
| `kanji-41-50-gyougi` | PASS | How one GOES through a formal CEREMONY reveals manners, a concrete conduct bridge. The child/animal/social-evaluation nuance and contexts are accurate. |
| `kanji-41-50-kanjin` | PASS | LIVER＋HEART as vital organs directly reaches essential/crucial. The “most important point” construction and contexts are accurate. |
| `kanji-41-50-nameraka` | FAIL | The mnemonic, usage paragraph, and first context pass, but `練習すると会話が滑らかになった` is an awkward condition/result pairing for the intended retrospective meaning. Use `練習して、会話が滑らかになった` or make both clauses non-past. |
| `kanji-41-50-sokuseki` | PASS | Build something in an INSTANT beside one's SEAT, producing an immediate improvised object. Food/on-the-spot scope and contexts are accurate. |
| `kanji-41-50-suitou` | PASS | WATER inside a portable CYLINDER transparently creates a flask/water bottle. Reusable-container nuance and contexts are accurate. |
| `kanji-41-50-tenmetsu` | PASS | A bright POINT repeatedly DESTROYED and reborn is a memorable blinking/flashing image. Signal/light scope and contexts are accurate. |
| `kanji-41-50-shiraga` | PASS | WHITE＋HAIR is appropriately handled as a transparent composition, with the useful English gray/white distinction. Collective/individual-strand usage and contexts are accurate. |
| `kanji-41-50-hikage` | PASS | SUN contrasted with SHADE directly reaches an area out of sunlight. The general 影 contrast and contexts are accurate. |
| `kanji-41-50-shitsudo` | PASS | DAMP measured by DEGREE transparently gives humidity. Percentage/high/low usage and contexts are accurate. |
| `kanji-41-50-hamigaki` | PASS | TOOTH＋POLISH directly creates toothbrushing. 歯磨きをする／歯磨き粉 and both contexts are accurate. |

### Levels 46–50

| Word ID | Verdict | Composition, usage, and context review |
| --- | --- | --- |
| `kanji-41-50-hokori` | PASS | PRIDE plus り turns the kanji concept into something carried personally. Positive-dignity usage and contexts are accurate. |
| `kanji-41-50-tsuuchou` | PASS | Transactions PASS THROUGH an account into a NOTEBOOK, clearly creating a bankbook/passbook. Bank-record usage and contexts are accurate. |
| `kanji-41-50-kankisen` | PASS | EXCHANGE stale ENERGY for fresh air with an absurd spinning FOLDING FAN is concrete enough to bridge the opaque accepted glosses without pretending to be etymology. Appliance scope and contexts are accurate. |
| `kanji-41-50-nikomu` | PASS | BOIL flavor INTO ingredients over time directly creates simmer/stew. Long, thorough liquid-cooking nuance and contexts are accurate. |
| `kanji-41-50-mudazukai` | FAIL | “Pour resources into nothing but a burdensome urge, then dispatch them” is abstract and hard to picture; the target is appended rather than caused by a concrete scene. Put NOTHING, a BURDENSOME object, and a DISPATCH action into one visible wallet/time/material-waste consequence. Usage and contexts pass. |

### Levels 51–55

| Word ID | Verdict | Composition, usage, and context review |
| --- | --- | --- |
| `kanji-51-60-kareha` | PASS | WITHER＋LEAF transparently gives dead/dry leaves. Alternate spelling and autumn-leaf usage are accurate. |
| `kanji-51-60-choujou` | PASS | SUMMIT sitting ABOVE everything is an appropriately direct bridge to summit/peak/top. Mountain and extended-top usage and contexts are accurate. |
| `kanji-51-60-kankonsousai` | PASS | CROWN ceremony, MARRIAGE, BURIAL, and FESTIVAL form a memorable ordered procession of life ceremonies. The etiquette/obligation umbrella nuance and contexts are accurate. |
| `kanji-51-60-hensachi` | FAIL | “A result biased away from the average has its distinction expressed as a value” is grammatical but abstract and cumbersome, with no memorable score image. Show a test result visibly BIASED from the average, print the DIFFERENCE, and turn it into a VALUE. The technical usage paragraph and contexts pass. |
| `kanji-51-60-furoshiki` | PASS | The WIND–BATH–SPREAD cloth scene is concrete, complete, and explicitly disclaimed as a memory aid rather than etymology. Practical wrapping-cloth usage and contexts are accurate. |
| `kanji-51-60-jojoni` | PASS | GENTLY repeated with 々 and に directly creates gradual progressive change. Verb collocations and contexts are accurate. |
| `kanji-51-60-genkouyoushi` | FAIL | “Put an original draft to its writing task on gridded paper” is not idiomatic English and does not make TASK clarify the paper's purpose. 用 accepts USE; use ORIGINAL＋DRAFT＋USE＋PAPER in a natural gridded-writing scene. The practical paragraph and contexts pass. |
| `kanji-51-60-sueoki` | PASS | INSTALL, PUT, and refuse to move the item creates a strong unchanged/deferred image. Price/rate/policy usage and contexts are accurate. |
| `kanji-51-60-kenbikyou` | PASS | Make details APPEAR, reveal the DELICATE, and reflect through a MIRROR, visibly creating a microscope. Scientific scope and contexts are accurate. |
| `kanji-51-60-somatsu` | PASS | A COARSE job stopping before its proper END makes crude/shabby/meager a visible consequence. Quality/provision/treatment scope and contexts are accurate. |
| `kanji-51-60-tounyoubyou` | PASS | SUGAR in URINE warning that someone is SICK directly reaches diabetes, while the second paragraph correctly rejects composition-only diagnosis. Medical usage and contexts are accurate. |

### Levels 56–60

| Word ID | Verdict | Composition, usage, and context review |
| --- | --- | --- |
| `kanji-51-60-shikousakugo` | PASS | TRY, GO, become CONFUSED, find the MISTAKE, and cycle again gives a complete ordered trial-and-error scene. Experimentation nuance and contexts are accurate. |
| `kanji-51-60-mogishiken` | FAIL | “Build an imitation to imitate the challenge” is awkwardly repetitive and leaves the four-component bridge feeling generated rather than memorable. Give IMITATION and IMITATE distinct visible roles, then TRY the TEST under mock conditions. Usage and contexts pass. |
| `kanji-51-60-wazurawashii` | PASS | ANNOY plus わしい is correctly turned into a persistent troublesome adjective. Procedure/task/relationship scope and contexts are accurate. |

## Release recommendation

Do not release this source revision. All mechanical composition requirements pass, and 103 entries are editorially ready, but the 18 failures above must be rewritten or corrected. After an atomic correction pass, rerun the pinned component audit, strip tags again for grammar review, and re-review each changed usage paragraph and context before changing the verdict.

## Final correction rerun

The 18 initially failing entries were independently re-read after the coordinated correction pass. An intermediate frozen revision (`429f18325fd2ac22fc519780eda6929c1382744a2b2567fe7c423fb11a6014e1`) corrected 16 entries cleanly but still left unidiomatic prose in `便り` ("especially naturally when") and `偏差値` ("tilts under a bias away from"). The final two-row follow-up removed both blockers.

Final source: [`custom-vocab-kanji-candidates.json`](./data/custom-vocab-kanji-candidates.json)  
Final source SHA-256: `2600f38e61546ec0ccbade6d911dab1ccdd79c501d3fabad04f05d474e71e458`  
Final source modification time: `2026-09-01 14:55:31 +0200`  
Final source size: `193,937` bytes

Two separate post-fix observations returned the same SHA-256, modification time, and byte count. No catalog source was edited by this reviewer.

| Corrected word ID | Final verdict | Independent correction review |
| --- | --- | --- |
| `kanji-01-10-hitokuchi` | PASS | ONE and MOUTH now form the grammatical, transparent payoff “one bite, or a mouthful”; usage and both contexts remain accurate. |
| `kanji-01-10-kongo` | PASS | The calendar scene makes NOW point naturally toward LATER dates and retrieves “from now on”; the planning/forecast nuance and contexts pass. |
| `kanji-01-10-jouei` | PASS | The screen ABOVE the audience REFLECTS the film across its width, giving one concrete screening scene without the former repetition; usage and contexts pass. |
| `kanji-01-10-irai` | PASS | A timeline FROM an event through the days that COME after it clearly retrieves “since / ever since”; the continuing-to-present nuance and contexts pass. |
| `kanji-11-20-tayori` | PASS | A carrier pigeon makes CONVENIENCE carry news, tidings, or a letter across distance; “often when the sender is elsewhere” is now idiomatic and accurate. |
| `kanji-11-20-kyoutsuu` | PASS | A thread pulls objects TOGETHER and PASSES THROUGH them all, concretely creating a common/shared feature; grammar, usage, and contexts pass. |
| `kanji-11-20-yuujou` | PASS | A FRIEND ties a ribbon bearing deep FEELING to another friend, making the friendship payoff memorable; usage and contexts pass. |
| `kanji-11-20-gasshuku` | PASS | Club members JOIN one plan and LODGE under one roof, directly creating a training camp; the overnight shared-purpose nuance and contexts pass. |
| `kanji-11-20-jushin` | PASS | A receiver ACCEPTS a signal and lights a TRUST seal when it arrives, producing reception/receive-a-message without the former broken phrasing; usage and contexts pass. |
| `kanji-11-20-mikaku` | PASS | FLAVOR AWARENESS transparently retrieves the sensory faculty “sense of taste / palate” without a false physiological claim; usage and contexts pass. |
| `kanji-21-30-dansui` | PASS | Workers CUT OFF WATER, leaving empty pipes and a water outage/shutoff; the grammar, planned-or-accidental nuance, and contexts pass. |
| `kanji-21-30-outai` | PASS | At a service counter one RESPONDS to the person OPPOSITE, clearly retrieving attending to customers; evaluative usage and contexts pass. |
| `kanji-31-40-unchin` | PASS | A vehicle CARRIES the learner, who pays RENT for the ride, retrieving passenger fare with correct tag-stripped grammar; usage and contexts pass. |
| `kanji-41-50-nameraka` | PASS | The mnemonic and usage were already sound, and the repaired `練習して、会話が滑らかになった。` now gives a natural retrospective result. |
| `kanji-41-50-mudazukai` | PASS | The shopper buys NOTHING useful, drags a BURDENSOME junk cart, and DISPATCHES every coin, making the waste consequence concrete; usage and contexts pass. |
| `kanji-51-60-hensachi` | PASS | A BIAS now acts naturally to tilt a test score from the average; the printer measures the DIFFERENCE and stamps a VALUE, memorably yielding a standardized/deviation score. |
| `kanji-51-60-genkouyoushi` | PASS | ORIGINAL DRAFT, USE, and PAPER now form a natural square-by-square manuscript-paper action; the format explanation and contexts pass. |
| `kanji-51-60-mogishiken` | PASS | An IMITATION exam room IMITATES real conditions before the learner TRIES the TEST, giving each component a distinct role and retrieving mock exam; usage and contexts pass. |

The complete pinned-data rerun on the final source produced zero errors:

| Final gate | Result |
| --- | ---: |
| Exact five-level bands | 12 / 12 — PASS |
| Unique source word IDs | 121 / 121 — PASS |
| Ordered component cues accepted by the pinned WaniKani subjects | 121 / 121 — PASS |
| Stored component levels and required levels | 121 / 121 — PASS |
| Accepted first-paragraph vocabulary payoff | 121 / 121 — PASS |
| Blank-line substantive usage paragraph | 121 / 121 — PASS |
| Balanced, supported mnemonic markup | 121 / 121 — PASS |
| Japanese/English contexts containing the written target | 242 / 242 — PASS |
| Exact written-reading pairs with an applicable JMdict sense | 121 / 121 — PASS |

The JMdict rerun used the official English XML daily distribution dated `2026-09-01` at `/tmp/kakehashi-jmdict.f6x5f1/JMdict_e.gz` (SHA-256 `a2cce17805c392712a9569c515076ae84a0091281b54542753de1060add8c55e`). The read-only resolver rebuilt all 565 catalog mappings with 565 resolved, zero unresolved, zero ambiguous, and all 121 entries from this source present and valid.

### Final outcome

| Verdict | Count |
| --- | ---: |
| PASS | 121 |
| FAIL | 0 |
| **Total** | **121** |

**Release recommendation:** pass. The final frozen revision clears every mechanical and editorial composition gate, and no release-blocking issue remains in these 121 meaning mnemonics, usage paragraphs, or contexts.
