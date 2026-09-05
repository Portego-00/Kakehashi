# Custom vocabulary: story-mnemonic standard

_Content-design proposal, 2026-09-01. This note changes no catalog source._

## Product decision

The current `Reading map: ...` prose is validation scaffolding, not a learner-facing mnemonic. Remove it from the rendered lesson. A mnemonic must give the learner a retrievable image that binds the sound of the Japanese word to its meaning.

For kana-only vocabulary, show only **Meaning** and **Context**, matching WaniKani's model. The Meaning panel should contain one combined sound-to-meaning mnemonic plus a short usage clarification. Do not render a Reading tab: the displayed kana already is the reading. WaniKani's staff description says kana vocabulary has only an English meaning side and uses the word's sound to trigger an image or story; transparent katakana loans may instead need only semantic context ([WaniKani staff announcement](https://community.wanikani.com/t/kana-only-vocabulary-additions/61796)). The API shape likewise has no `readings` or `reading_mnemonic` field for `kana_vocabulary` ([WaniKani API](https://docs.api.wanikani.com/20170710/#kana-vocabulary-attributes)).

For kanji vocabulary, retain separate Meaning and Reading content. The meaning mnemonic starts from the written kanji: name every distinct component in order with a separate `<kanji>` gloss, connect their composition to a target meaning inside `<vocabulary>`, then add a new paragraph explaining real usage, register, nuance, or a useful contrast. Treat the bridge as a memory device, not as an unsupported claim about historical etymology. A reading mnemonic may use familiar component readings, a defensible sound change, an exact Japanese homophone, or a sound-keyword story. It must still be a scene, not a recitation of kana.

The repository's WaniKani snapshots intentionally contain only the validation fields needed here—IDs, forms, readings, levels, and accepted answer glosses—not WaniKani's mnemonic prose. Therefore this standard takes the cadence from WaniKani's documented keyword method and the user's `おはよう` example, but all examples below are original.

## Learner-facing shape

Every kana meaning mnemonic and kanji reading mnemonic needs four things:

1. **Sound hook.** A pronounceable cue for the whole word, or honest component chunks. Emphasize the cue once.
2. **Concrete scene.** A specific actor, action, and consequence the learner can picture. Absurdity is welcome when it makes the scene stick.
3. **Meaning payoff.** The scene must make the tested meaning inevitable, not merely mention it afterward.
4. **Usage clarification.** One short follow-up sentence that narrows register, collocation, or a misleading English cognate.

Target two to four story sentences plus one usage sentence. Ban openings such as “say it in N beats,” “give each kana one beat,” and “reading map.” Pronunciation coaching belongs in audio/help UI, not in the mnemonic.

Every kanji meaning mnemonic instead needs three things:

1. **Complete composition bridge.** Cover each written kanji in order with one `<kanji>` component gloss; explain meaningful okurigana or kana in plain text.
2. **Meaning payoff.** Make the composition lead to an accepted target meaning inside `<vocabulary>` in the first paragraph.
3. **Practical clarification.** Use a blank line, then explain where the word is used, what register it carries, or how it differs from a tempting near-synonym.

Prefer a short literal bridge when the composition is transparent. When it is only suggestive, use one concrete cause-and-effect scene containing all components. When the spelling is opaque, ateji, or a proper name, explicitly reject the misleading literal interpretation instead of inventing an etymology.

## Audit shape (not rendered)

Keep correctness evidence in a sidecar record instead of printing it to the learner:

```json
{
  "id": "conversation-yappari",
  "canonicalReading": "やっぱり",
  "coverage": ["や", "っ", "ぱ", "り"],
  "cues": [
    { "text": "YAP", "covers": ["や", "っ"], "grade": "close" },
    { "text": "PARRY", "covers": ["ぱ", "り"], "grade": "close" }
  ],
  "specialUnitEvidence": "The final /p/ of YAP meets the initial /p/ of PARRY.",
  "meaningAnchor": "The puppy repeats the predicted behavior.",
  "independentReviewer": "..."
}
```

Deterministic validation still compares the hidden `coverage` with the JMdict-verified canonical reading. Editorial validation additionally requires:

- the declared cues cover the whole reading in order;
- an approximation is labeled `close`, never claimed to be exact;
- `っ` is supported by a clipped consonant or consonant boundary, `ん` by an audible nasal cue, and `ー` by a genuinely extended vowel;
- no cue silently drops or invents a syllable merely to make the story work;
- component readings and etymologies are verified independently; and
- a reviewer can identify both the sound retrieval path and the meaning retrieval path without consulting the author's intent.

Reject a story if the right answer is merely printed after an unrelated joke. Transparent loans may use the source word itself as the sound hook, but should still add a memorable image or useful Japanese-specific meaning distinction.

## Representative replacements

These are learner-facing drafts; cue coverage follows each draft for audit.

### Kana vocabulary

#### `conversation-yappari` — やっぱり — as expected; after all

Picture a puppy that can parry anything you throw. You try one more newspaper: **YAP—PARRY!** Of course it blocks it again—**as expected**, after all. The clipped end of YAP runs straight into PARRY, cueing やっぱり.

Use やっぱり when reality confirms your suspicion, or when you return to the conclusion you had before.

Audit: `YAP` → `や・っ`; `PARRY` → `ぱ・り`. The two adjacent p sounds support `っ`. Full reading: `や・っ・ぱ・り`.

#### `cafe-koppu` — コップ — drinking glass; cup

At a café, a **COP** steals Winnie-the-**POOH**'s cup. Pooh chases the cop around the table yelling, “Give back my cup!” COP—POOH cues コップ, with the two p sounds colliding in the middle.

コップ is usually a handleless drinking glass or cup; マグカップ is more specific for a mug.

Audit: `COP` → `コ・ッ`; the initial sound of `POOH` → `プ`. The p/p boundary supports `ッ`. Full reading: `コ・ッ・プ`.

#### `food-menyuu` — メニュー — menu

A waiter unrolls a menu so long that it crosses the entire restaurant. He calls **MENUUU!** and the final U keeps stretching as the paper rolls past every table. That familiar sound cues メニュー.

メニュー is a list of dishes or options; it does not by itself mean a fixed set meal.

Audit: English `menu` /men-yoo/ → `メ・ニュ・ー`; its extended final vowel supports `ー`.

#### `cafe-supuun` — スプーン — spoon

A giant **SPOON** scoops up the moon and drops it into your soup. The spoon stretches impossibly long along with the long vowel in スプーン.

スプーン is an ordinary spoon; スプーンで marks it as the utensil used for an action.

Audit: English `spoon` adapts to `ス・プ・ー・ン`; the long /u/ supports `ー` and the final nasal supports `ン`.

#### `home-kicchin` — キッチン — kitchen

In a chaotic kitchen, the chef balances an entire cooking **KIT** on his **CHIN**. KIT—CHIN snaps together as キッチン, with the two parts meeting sharply in the middle.

キッチン is the kitchen or cooking area; 台所 is the native Japanese alternative.

Audit: `KIT` → `キ・ッ`; `CHIN` → `チ・ン`. The t/ch boundary supports `ッ`; CHIN supplies the final nasal. Full reading: `キ・ッ・チ・ン`.

#### `home-tisshu` — ティッシュ — tissue

Tish shows up wearing a **SHOE** made entirely of tissues. Everyone points and shouts, **TISH—SHOE!**, just before it dissolves in the rain. That doubled sh boundary cues ティッシュ.

ティッシュ usually means facial tissue or tissue paper, not biological tissue.

Audit: `TISH` → `ティ・ッ`; `SHOE` → `シュ` (close; the English vowel is longer). The sh/sh boundary supports `ッ`. Full reading: `ティ・ッ・シュ`.

#### `daily-sumaho` — スマホ — smartphone

A tiny smartphone takes scissors to its full Japanese name, スマートフォン. It keeps スマ from the front and ホ from the middle, then throws every other kana away: スマホ.

スマホ is the ordinary casual abbreviation for smartphone; the full form is スマートフォン.

Audit: verified clipping `スマートフォン` → `スマ` + `ホ`; no English-equivalence claim. Full reading: `ス・マ・ホ`.

#### `daily-arubaito` — アルバイト — part-time job

At your part-time job, the manager points to three strange workers: **AL**, **BUY**, and **TOE**. Al stocks shelves, Buy runs the register, and Toe somehow mops the floor. Their names in a row—AL-BUY-TOE—cue アルバイト.

アルバイト usually means a part-time job or part-time worker; アルバイトする means to work part-time.

Audit: `AL` → `ア・ル` (Japanese adaptation), `BUY` → `バ・イ`, `TOE` → `ト` (close; English has a longer vowel). Full reading: `ア・ル・バ・イ・ト`.

### Kanji vocabulary

#### `kanji-01-10-totte` — 取っ手 — handle

The TAKE kanji 取 reaches for the HAND kanji 手, but their t sounds get caught in the handle between them: とっ…て. Picture the handle physically catching your hand for one beat before letting go.

取っ手 is the part you grip on a door, drawer, pot, or container; it can also refer to a knob.

Audit: attested chunks `取` → `と`, `手` → `て`; the caught t supplies `っ`. Full reading: `と・っ・て`.

#### `kanji-11-20-gasshuku` — 合宿 — training camp

At training camp, a leaking stove fills the shared inn with gas. “**GAS SHOOK** the whole 宿!” everyone yells as they evacuate. GAS-SHOOK cues がっしゅく.

合宿 is a group stay for concentrated training or practice, especially for a club or team.

Audit: `GAS` → `が・っ`; `SHOOK` → `しゅ・く` (close vowels). The s/sh boundary supports `っ`. Full reading: `が・っ・しゅ・く`.

#### `kanji-31-40-shukkin` — 出勤 — go to work

The work alarm **SHOOK KIN** out of bed and straight into the office. Every relative tumbles through the door to report for work. SHOOK-KIN cues しゅっきん.

出勤する means to go in or report to work; it is not the generic verb for doing work.

Audit: `SHOOK` → `しゅ・っ`; `KIN` → `き・ん`. The k/k boundary supports `っ`, and KIN supplies `ん`. Full reading: `しゅ・っ・き・ん`.

#### `kanji-21-30-kisei` — 帰省 — return to one's hometown

Your old house **KEY** starts to **SAY**, “Come home!” louder every holiday until you finally return to your hometown. KEY-SAY cues きせい.

帰省 is specifically returning to one's family home or hometown, often for a holiday—not merely going back to one's current house.

Audit: `KEY` → `き`; `SAY` → `せ・い`. Full reading: `き・せ・い`.

#### `kanji-11-20-taion` — 体温 — body temperature

A nurse tells you to **TIE ON** an enormous thermometer like a necktie. TIE-ON cues たいおん while you check your body temperature.

体温 is body temperature; 体温を測る means to measure it.

Audit: `TIE` → `た・い`; `ON` → `お・ん`. Full reading: `た・い・お・ん`.

#### `kanji-41-50-hokori` — 誇り — pride

You proudly display a trophy, but it is buried under dust. Brush off the ほこり and reveal your 誇り: **dust and pride share the exact reading ほこり**.

誇り is pride in a person, place, or work, commonly used in 誇りを持つ.

Audit: exact Japanese homophone `埃（ほこり）` covers `ほ・こ・り`; the dusty trophy binds it to pride.

#### `kanji-51-60-jojoni` — 徐々に — gradually

Two men named **JOE** lower themselves onto one **KNEE** in tiny synchronized steps: JOE, JOE, KNEE. Their exaggerated slow motion cues じょじょに—gradually.

徐々に describes a change happening little by little over time.

Audit: `JOE` → `じょ`, repeated `JOE` → `じょ`, `KNEE` → `に`. Full reading: `じょ・じょ・に`.

#### `kanji-51-60-kankonsousai` — 冠婚葬祭 — family ceremonies

Imagine one impossible family day: someone receives a crown, runs into a wedding, carries it through a funeral, then ends at a festival. Each scene opens a gate—冠 かん, 婚 こん, 葬 そう, 祭 さい—so the whole procession becomes かんこんそうさい.

冠婚葬祭 is an umbrella term for major family and life ceremonies and their etiquette, not one particular event.

Audit: verified components `かん` + `こん` + `そう` + `さい`; full reading `か・ん・こ・ん・そ・う・さ・い`.

#### `kanji-51-60-shikousakugo` — 試行錯誤 — trial and error

A mad inventor runs a trial, hits an error, resets, and runs it again while four neon signs flash: 試 し, 行 こう, 錯 さく, 誤 ご. Every cycle chants しこうさくご as the machine learns through trial and error.

試行錯誤 emphasizes finding a solution through repeated attempts and mistakes; 試行錯誤する means to work something out that way.

Audit: verified components `し` + `こう` + `さく` + `ご`; full reading `し・こ・う・さ・く・ご`.

## Release gate

A set is not complete because its kana maps pass. It is complete only when every learner-facing item has an identifiable sound hook, concrete image, meaning payoff, and usage clarification; all hidden cue coverage passes; and an independent editor marks the story memorable and the cue phonologically honest. Reviewers should be allowed to return “accurate but not a mnemonic” as a release-blocking result.
