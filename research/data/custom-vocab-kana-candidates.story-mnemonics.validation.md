# Expanded kana story-mnemonic validation

Validation date: 2026-09-01 (Europe/Madrid)

## Outcome

This is an independent editorial review of all 120 entries in [`custom-vocab-kana-candidates.json`](./custom-vocab-kana-candidates.json) against [`custom-vocabulary-story-mnemonic-standard.md`](../custom-vocabulary-story-mnemonic-standard.md). The reviewer did not author this source file.

| Result | Count |
| --- | ---: |
| PASS | 120 |
| FAIL | 0 |
| Total | 120 |

Reviewed source SHA-256: `1ce59d35ee727ec4a831e76cbd47360dac1cb1f7372c58ce2aaaf85d1b59f96b`

All **120 / 120** hidden `readingMap` values concatenate exactly to the canonical `reading`, preserving combined small kana as single coverage units. All 120 learner-facing mnemonics have balanced `<reading>` and `<vocabulary>` markup, a concrete actor/action/consequence scene, a meaning payoff, and a usage or semantic clarification. Every visible sound hook now provides an honest retrieval path through the whole reading and supports any ッ, ン, or ー. Transparent loanwords were accepted when their real source word gives a recognizable Japanese adaptation; a real etymology was not treated as permission to omit a marked sound that the cue cannot recover.

The nine entries rejected in the first pass were replaced and independently re-reviewed against the source hash above. All nine blockers are resolved. “Accurate but not a mnemonic” remains a release-blocking criterion; no current entry falls into that category.

## Per-entry verdicts

| ID | Verdict | Review note |
| --- | --- | --- |
| `cafe-koppu` | PASS | — |
| `cafe-fooku` | PASS | — |
| `cafe-supuun` | PASS | — |
| `cafe-naifu` | PASS | — |
| `cafe-koora` | PASS | — |
| `cafe-miruku` | PASS | — |
| `cafe-chiizu` | PASS | — |
| `cafe-bataa` | PASS | — |
| `cafe-yooguruto` | PASS | — |
| `cafe-toosuto` | PASS | — |
| `cafe-jamu` | PASS | — |
| `cafe-kafe` | PASS | — |
| `meals-hanbaagaa` | PASS | — |
| `meals-hanbaagu` | PASS | — |
| `meals-omuraisu` | PASS | — |
| `meals-furaidopoteto` | PASS | — |
| `meals-chokoreeto` | PASS | Resolved: CHOCO—LATE supplies チョコレート and supports ー. |
| `meals-kukkii` | PASS | — |
| `meals-doonatsu` | PASS | — |
| `meals-shiriaru` | PASS | — |
| `meals-mayoneezu` | PASS | — |
| `meals-kechappu` | PASS | — |
| `meals-ranchi` | PASS | — |
| `meals-baabekyuu` | PASS | — |
| `meals-udon` | PASS | — |
| `meals-takoyaki` | PASS | — |
| `signals-a` | PASS | — |
| `signals-e` | PASS | — |
| `signals-ee` | PASS | — |
| `signals-maa` | PASS | — |
| `signals-uwa` | PASS | — |
| `signals-waa` | PASS | — |
| `signals-hee` | PASS | — |
| `signals-iyoiyo` | PASS | — |
| `signals-toutou` | PASS | — |
| `signals-zutto` | PASS | Resolved: ZOOT—TOE is imageable and its t/t boundary supports っ. |
| `signals-nantoka` | PASS | — |
| `manner-sappari` | PASS | — |
| `manner-shikkari` | PASS | Resolved: SHEIKH—CARRY gives a recognizable k/k boundary for っ. |
| `manner-kichinto` | PASS | — |
| `manner-pittari` | PASS | — |
| `manner-bacchiri` | PASS | — |
| `manner-nandaka` | PASS | — |
| `manner-ikinari` | PASS | — |
| `manner-wazawaza` | PASS | Resolved: repeated WAS A chunks retrieve わざわざ. |
| `manner-gussuri` | PASS | — |
| `manner-kossori` | PASS | Resolved: COS(tume)—SORRY gives meaningful chunks and s/s for っ. |
| `manner-hakkiri` | PASS | — |
| `manner-sukkari` | PASS | Resolved: SOCK—CARRY is grammatical, imageable, and supports っ. |
| `manner-tappuri` | PASS | — |
| `home-teeburu` | PASS | — |
| `home-sofa` | PASS | — |
| `home-beddo` | PASS | — |
| `home-shawaa` | PASS | — |
| `home-kicchin` | PASS | — |
| `home-beranda` | PASS | — |
| `home-kaaten` | PASS | — |
| `home-kusshon` | PASS | — |
| `home-taoru` | PASS | — |
| `home-tisshu` | PASS | — |
| `home-pajama` | PASS | — |
| `home-surippa` | PASS | — |
| `home-gomi` | PASS | — |
| `clothes-shatsu` | PASS | — |
| `clothes-seetaa` | PASS | Resolved: SAY—TAR supports both long vowels. |
| `clothes-kooto` | PASS | — |
| `clothes-jaketto` | PASS | — |
| `clothes-zubon` | PASS | Resolved: ZOO—BONE is a declared close cue with a final nasal. |
| `clothes-sukaato` | PASS | — |
| `clothes-suutsu` | PASS | — |
| `clothes-nekutai` | PASS | — |
| `clothes-beruto` | PASS | — |
| `clothes-poketto` | PASS | — |
| `clothes-botan` | PASS | — |
| `clothes-suniikaa` | PASS | — |
| `travel-torakku` | PASS | — |
| `travel-erebeetaa` | PASS | — |
| `travel-esukareetaa` | PASS | — |
| `travel-robii` | PASS | — |
| `travel-furonto` | PASS | — |
| `travel-pasupooto` | PASS | — |
| `travel-suutukeesu` | PASS | — |
| `travel-ryukku` | PASS | — |
| `travel-rentakaa` | PASS | — |
| `travel-doraibu` | PASS | — |
| `travel-gasorin` | PASS | — |
| `digital-taburetto` | PASS | — |
| `digital-nootopasokon` | PASS | — |
| `digital-kiiboodo` | PASS | — |
| `digital-mausu` | PASS | — |
| `digital-monitaa` | PASS | — |
| `digital-purintaa` | PASS | — |
| `digital-fairu` | PASS | — |
| `digital-foruda` | PASS | — |
| `digital-pasuwaado` | PASS | — |
| `digital-akaunto` | PASS | — |
| `digital-daunroodo` | PASS | — |
| `digital-messeeji` | PASS | Resolved: MESS—SAGE supports ッ, セー, and ジ. |
| `media-anime` | PASS | — |
| `media-dorama` | PASS | — |
| `media-nyuusu` | PASS | — |
| `media-rajio` | PASS | — |
| `media-konsaato` | PASS | — |
| `media-karaoke` | PASS | — |
| `media-dansu` | PASS | — |
| `media-gitaa` | PASS | — |
| `media-piano` | PASS | — |
| `media-sakkaa` | PASS | — |
| `shopping-shoppingu` | PASS | — |
| `shopping-seeru` | PASS | — |
| `shopping-baagen` | PASS | — |
| `shopping-kuupon` | PASS | — |
| `shopping-pointo` | PASS | — |
| `shopping-kurejittokaado` | PASS | — |
| `shopping-kyasshuresu` | PASS | — |
| `shopping-sutaffu` | PASS | — |
| `shopping-saizu` | PASS | — |
| `shopping-burando` | PASS | — |
| `shopping-purezento` | PASS | — |
| `shopping-reshiito` | PASS | — |

## Resolved re-review

For each formerly blocked entry, the applied source text was compared sentence-by-sentence with the mnemonic quoted below, its hidden map was re-concatenated to the canonical reading, markup was rechecked, and every special unit was traced to the visible cue. Markdown backticks in the report's explanatory prose are formatting and are not required in the JSON. Each replacement also retains a concrete scene, meaning payoff, and accurate usage clarification.

### `meals-chokoreeto` — チョコレート — PASS (resolved)

**First-pass blocker:** The hidden map `チョ・コ・レ・ー・ト` was exact, but ordinary English **chocolate** did not supply the レー sequence or its long vowel.

Applied mnemonic:

> Choco, a chocolate bar, is late to its own birthday party and melts while running through the door. Everyone points and cries, <reading>CHOCO—LATE!</reading>, then scoops the melted <vocabulary>chocolate</vocabulary> onto the cake. チョコレート is the full word; チョコ is its common casual shortening.

`CHOCO` supplies チョコ, and English `LATE` supplies レート with a clearly extended /eɪ/ for ー.

### `signals-zutto` — ずっと — PASS (resolved)

**First-pass blocker:** The hidden map `ず・っ・と` was exact and the t/t boundary in `ZUT–TOE` could support っ, but `ZUT` was an arbitrary label rather than a retrievable cue.

Applied mnemonic:

> At dawn, a dancer in a zoot suit plants one toe on a piano key and refuses to lift it. The audience chants <reading>ZOOT—TOE!</reading> as the same note sounds <vocabulary>the whole time</vocabulary> and remains <vocabulary>by far</vocabulary> the longest note in the show. ずっと can mark continuous duration or emphasize a much greater degree.

`ZOOT` is a familiar word from “zoot suit,” and its final t meets the initial t of `TOE` to support っ. The vowel is a close cue rather than an exact equivalence.

### `manner-shikkari` — しっかり — PASS (resolved)

**First-pass blocker:** The hidden map `し・っ・か・り` was exact and the cue's k/k boundary supported っ, but `SHICK` was an unexplained invented label.

Applied mnemonic:

> An earthquake lifts a palace, but a sheikh catches it and carries it across the desert without dropping one tile. The crowd chants <reading>SHEIKH—CARRY!</reading> as he holds it <vocabulary>firmly</vocabulary> and works <vocabulary>dependably</vocabulary>. しっかり describes firm action, proper preparation, or a reliable person.

`SHEIKH` is a recognizable sound keyword ending in k; its boundary with `CARRY` supports っ before かり. The English vowels are close cues.

### `manner-wazawaza` — わざわざ — PASS (resolved)

**First-pass blocker:** The hidden map `わ・ざ・わ・ざ` was exact, but `WAZA–WAZA` merely printed the answer in Latin letters and assigned it to twins.

Applied mnemonic:

> Zoe crosses a desert just to return one borrowed vase. At the door she holds up the shattered pieces and gasps, <reading>WAS A—WAS A</reading> whole vase before that needless trip; she really went <vocabulary>out of her way</vocabulary> especially for you. わざわざ highlights intentional extra effort, with gratitude or irritation depending on context.

The two ordinary English chunks `WAS A` closely cue the repeated わざ without inventing a named character whose name is merely the answer.

### `manner-kossori` — こっそり — PASS (resolved)

**First-pass blocker:** The hidden map `こ・っ・そ・り` was exact and `COSS–SORRY` placed adjacent s sounds at っ, but `COSS` was romanization disguised as an unexplained name.

Applied mnemonic:

> A spy in a costume with only COS left on its torn label bumps a guard and whispers SORRY while sliding behind him. <reading>COS(tume)—SORRY</reading> puts him inside the vault <vocabulary>secretly</vocabulary> and <vocabulary>stealthily</vocabulary> before the guard notices. こっそり describes doing something quietly so other people will not notice.

The first, closed syllable of `COS(tume)` ends in s and meets the s of `SORRY`, giving a defensible こ・っ・そ・り path.

### `manner-sukkari` — すっかり — PASS (resolved)

**First-pass blocker:** The hidden map `す・っ・か・り` was exact and the intended k/k boundary supported っ, but `SOOK` was arbitrary and the sentence made the cue itself an incoherent grammatical actor.

Applied mnemonic:

> A giant sock grows arms and carries every object out of a castle, right down to the last spoon. The king yells <reading>SOCK—CARRY!</reading> as the k sounds collide and the rooms become <vocabulary>completely</vocabulary>, <vocabulary>entirely</vocabulary> empty. すっかり marks a change or action that has reached its full extent.

`SOCK` and `CARRY` are familiar, imageable words; their k/k boundary supports っ. `SOCK` is a close vowel cue for す, not an exact match.

### `clothes-seetaa` — セーター — PASS (resolved)

**First-pass blocker:** The hidden map `セ・ー・タ・ー` was exact and the scene was memorable, but ordinary English **sweater** neither retrieved セー nor explained the first ー.

Applied mnemonic:

> A wool sweater climbs onto a stage and orders the crowd to <reading>SAY—TAR!</reading>. Every shout makes it knit another wall until the enormous <vocabulary>sweater</vocabulary> covers the house. セーター is a knitted sweater or jumper; both ー marks are long vowels.

`SAY` supplies セー through its extended /eɪ/ sound, and non-rhotic `TAR` supplies ター.

### `clothes-zubon` — ズボン — PASS (resolved)

**First-pass blocker:** The hidden map `ズ・ボ・ン` was exact, but `ZU–BON` merely assigned the romanized answer to two unknown tailors.

Applied mnemonic:

> A zoo elephant hides a huge bone in each trouser leg, then tries to walk away stiff-legged. The keeper shouts <reading>ZOO—BONE!</reading> as the animal's <vocabulary>pants</vocabulary> clatter across the floor. ズボン is the ordinary Japanese word for trousers or pants; `ZOO—BONE` is a close sound cue, with `BONE` supplying the final nasal.

`ZOO` and `BONE` are familiar imageable anchors. Their vowels are deliberately described as close rather than exact.

### `digital-messeeji` — メッセージ — PASS (resolved)

**First-pass blocker:** The hidden map `メ・ッ・セ・ー・ジ` was exact and the delivery scene recalled the meaning, but ordinary English **message** did not supply セー or its ー.

Applied mnemonic:

> A wise sage wades into a mess of papers and stamps one sentence onto every page. The crowd calls him <reading>MESS—SAGE!</reading> when the flying papers assemble into one clear <vocabulary>message</vocabulary>. メッセージ can be a text, spoken note, or broader communication; メッセージを送る means to send one.

`MESS` ends in s and `SAGE` begins in s, supporting ッ, while the /eɪ/ in `SAGE` supports セー and its final sound cues ジ.

## Release decision

The reviewed source at SHA-256 `1ce59d35ee727ec4a831e76cbd47360dac1cb1f7372c58ce2aaaf85d1b59f96b` passes the story-and-sound gate: **120 / 120 PASS, 0 FAIL**. All nine first-pass blockers are resolved, and every hidden `readingMap` remains unchanged and exact.
