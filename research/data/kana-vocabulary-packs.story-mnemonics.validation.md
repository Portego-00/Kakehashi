# Starter kana story-mnemonic independent validation

Validation date: 2026-09-01 (Europe/Madrid)

Source: [`kana-vocabulary-packs.json`](./kana-vocabulary-packs.json)  
Editorial standard: [`custom-vocabulary-story-mnemonic-standard.md`](../custom-vocabulary-story-mnemonic-standard.md)  
Audited source SHA-256: `1edd4cf02fe15beac46392af07c6d4cb86e0d2aeba95065c2d5a2fe028be4d2c`

The reviewer did not author these 48 entries and did not edit the source catalog.

## Outcome

| Verdict | Count |
| --- | ---: |
| Pass | 48 |
| Fail | 0 |
| **Total** | **48** |

The catalog passes the story-mnemonic gate. The two entries that failed the initial review, `conversation-douzo` and `food-gochisousama`, were replaced in the source and independently re-reviewed. Both now pass; there are no remaining blocking findings.

## Method and deterministic checks

The three packs were flattened and all 48 words were checked programmatically and then reviewed one by one.

- **48 / 48** `readingMap` values concatenate exactly to the NFKC-normalized canonical `reading`, in order.
- **48 / 48** visible kana forms equal their canonical reading.
- **48 / 48** entries preserve every small kana, `っ` / `ッ`, moraic `ん` / `ン`, and `ー` present in the canonical reading.
- **48 / 48** entries contain exactly one balanced `<reading>…</reading>` span.
- **48 / 48** entries have balanced `<vocabulary>…</vocabulary>` markup.
- No unsupported mnemonic markup was found.

For the human sound review, ordinary English-to-Japanese approximation is allowed and is called **close** below. A close cue still has to provide a recoverable path through the entire Japanese reading in order. It may not leave a target mora supported only by the reader already knowing the answer, and a highlighted proper name may not silently discard a whole extra syllable. Transparent loanwords pass when the source word retrieves the complete established Japanese loan and the scene adds a concrete image or a useful Japanese-specific distinction.

## Complete entry-by-entry verdicts

Every row has an exact hidden map and balanced markup; the notes below record the independent learner-facing review.

| Word ID | Sound hook and story/usage review | Verdict |
| --- | --- | --- |
| `conversation-douzo` | `DOUGH` → `ど・う` and coined name `ZO` → `ぞ` form a complete cue with no discarded syllable. Zo's bakery-door gesture joins offering, permission, and invitation in one concrete scene. The revised request clarification accurately explains that どうぞ adds polite encouragement while ください can carry the request. | PASS |
| `conversation-yappari` | `YAP` → `や・っ` and `PARRY` → `ぱ・り` are close, ordered, and complete; the adjacent **p** sounds support `っ`. The repeatedly successful puppy-parry scene makes “as expected / after all” the consequence. Usage is accurate. | PASS |
| `conversation-yukkuri` | `YUCK` → `ゆ・っ` and `CURRY` → `く・り` are defensible close cues; the **k/k** boundary supports `っ`. The turtle's exaggeratedly slow rejection makes both meanings visual. Usage is accurate. | PASS |
| `conversation-jaa` | `JAW` is a close whole-word cue for `じゃあ`, including the held final vowel. The blocking jaw forces the “well then / in that case” decision. Casual-register clarification is accurate. | PASS |
| `conversation-doumo` | `DOUGH—MOE` gives the complete `どう・も` shape as a close cue. Moe's surprised thanks and unexplained living dough distinguish the two meanings. Usage is accurate. | PASS |
| `conversation-masaka` | `MASSACRE` is a close three-part cue for `ま・さ・か`; no target unit is absent. The apparent cake massacre causes genuine “no way / surely not” disbelief. Usage is accurate. | PASS |
| `conversation-sorosoro` | Repeated `SOLO` gives the complete repeated `そろ・そろ` pattern, with only the ordinary English **l** / Japanese flap approximation. The stalled duet makes “about time / soon” inevitable. Usage is accurate. | PASS |
| `conversation-chanto` | `CHANT—OH` supplies `ちゃ・ん・と` in order and retains the nasal. The choir's corrected performance binds “properly / without fail” to the sound. Usage is accurate. | PASS |
| `conversation-narubeku` | `NARROW` → `な・る` and `BEAK` → `べ・く` are loose but complete close chunks; final **k** provides the consonant for `く`, with the normal supporting vowel. The tiny-beak task embodies best effort rather than a guarantee. Usage is accurate. | PASS |
| `conversation-nande` | `NAN—DAY` is a close full cue for `なん・で`; the English diphthong is an approximation, not a missing Japanese unit. The renamed calendar directly provokes “why / what for.” Casual-register clarification is accurate. | PASS |
| `conversation-doushite` | `DOUGH—SHE—TE(sts)` supplies `どう・し・て` in order; the final consonant cluster is residue within the last cue, not a missing target syllable. Flying test dough makes the reason question concrete. Usage is accurate. | PASS |
| `conversation-douyatte` | `DOUGH` supports `どう`; the clipped **t** at the end of `YACHT` plus the release into `EH` supports `や・っ・て`. The impossible bread yacht provokes a method question. Usage accurately distinguishes method from reason. | PASS |
| `conversation-nantonaku` | `NAN—TONE A—COO` supplies `なん・と・な・く` continuously across the word boundaries. The causeless opera-pigeon transformation embodies a vague, unexplained impulse. Usage is accurate. | PASS |
| `conversation-chinamini` | `CHINA MINI` is an orthographically exact whole-word cue and a close spoken cue for `ち・な・み・に`; the first English vowel is approximate but no Japanese unit is absent. The miniature side exhibit anchors relevant incidental information. Usage is accurate. | PASS |
| `conversation-tsumari` | `TO—MURRAY` is a close three-part whole cue for `つ・ま・り`; the initial affrication and vowels are approximate, but the complete ordered shape remains recoverable. Crushing a long letter into one line makes the summary meaning unavoidable. Usage is accurate. | PASS |
| `conversation-moshi` | `MOE—SHE` covers `も・し` in order as a close cue. The sheep mentally simulates the bridge condition, giving the hook an actual hypothetical consequence. Usage is accurate. | PASS |
| `food-okazu` | `OH—CUZ` gives `お・か・ず` through a close vowel and normal final-consonant adaptation. The small dishes visibly accompany the rice. The clarification that おかず is food eaten with rice is accurate. | PASS |
| `food-okawari` | `OKA—WALLY` covers `お・か・わ・り`, with the ordinary **l** / Japanese flap approximation. Repeated replacement bowls and a refilled glass distinguish the two meanings. Usage is accurate. | PASS |
| `food-gochisousama` | The close `GOAT CHEESE—OH` path covers `ご・ち・そ・う`, and explicit `SAH—MAH` now covers both `さ・ま`; no final mora is inferred from a bare consonant. The feast and bow make post-meal thanks the consequence, and the いただきます contrast is accurate. | PASS |
| `food-karee` | English `CURRY` transparently retrieves the established loan カレー, including its complete written reading. The absurd curry flood reinforces the meaning and the Japanese-style curry clarification adds useful scope. | PASS |
| `food-sarada` | `SALAD` transparently retrieves サラダ. The vegetable tornado is concrete, and the clarification correctly includes non-leafy salads. | PASS |
| `food-suupu` | `SOUP` transparently retrieves スープ, with the source vowel supporting `ー`. The overflowing bowl is memorable, and the スープ / 汁 distinction is accurate. | PASS |
| `food-juusu` | `JUICE` transparently retrieves ジュース, including the long vowel. The orange-and-cola machine makes the broader Japanese “sweet soft drink” scope memorable and accurate. | PASS |
| `food-keeki` | `CAKE` transparently retrieves ケーキ. The runaway wedding cake is concrete, and the compound clarification is accurate. | PASS |
| `food-aisu` | `ICE` transparently retrieves アイス. The freezing badge connects ice cream, ice, and attributive “iced,” while the 氷 distinction accurately prevents overgeneralization. | PASS |
| `food-resutoran` | `RESTAURANT` transparently retrieves all of レストラン, including final `ン`. The building unfolding from a menu is a concrete semantic scene; the venue nuance is reasonable. | PASS |
| `food-menyuu` | `MENUUU` retrieves メニュー and visibly/audibly supports `ー`. The endlessly unrolling menu binds the long sound to the meaning. The set-meal clarification is accurate. | PASS |
| `food-dezaato` | `DESSERT` transparently retrieves デザート, with the stressed source vowel supporting the long mark. The caramel-breathing dragon guards the after-meal course; the お菓子 distinction is accurate. | PASS |
| `food-pasuta` | `PASTA` transparently retrieves パスタ. The pasta lasso is concrete, and the category-versus-spaghetti clarification is accurate. | PASS |
| `food-piza` | `PIZZA` transparently retrieves ピザ. The flying pizza scene is memorable, and the ピッツァ note is accurate and nonessential to recall. | PASS |
| `food-sandoicchi` | `SANDWICH` transparently retrieves サンドイッチ; the English closed final affricate supports the Japanese `ッチ` adaptation, and `ン` remains present. The snapping sandwich is visual; the サンド abbreviation note is accurate. | PASS |
| `food-biiru` | Stretched `BEEEER` transparently retrieves ビール and supports `ー`. The endless tap stream connects the long sound to beer; the 生ビール / ビア clarification is accurate. | PASS |
| `daily-sumaho` | The exact clipping cue `スマ＋ホ` covers all of スマホ. The paper-cutter scene makes the shortening visual, and the full-form clarification is accurate. | PASS |
| `daily-pasokon` | The displayed clipping `パソ＋コン` gives the complete target, while the door-shearing scene makes the abbreviation memorable. The device-scope clarification is accurate. | PASS |
| `daily-apuri` | The exact truncation `アプリケーション → アプリ` supplies the full reading. The attacking app icon is concrete, and the software-application clarification is accurate. | PASS |
| `daily-netto` | English `NET` retrieves ネット; the closed **t** supports the geminate `ッ`. The glowing city net ties the sound to the Internet meaning, and the broader net/network note is accurate. | PASS |
| `daily-meeru` | `MAIL` transparently retrieves メール as a close source-word cue. The propeller envelope ties it to electronic mail, and the 郵便 contrast accurately prevents the paper-mail false friend. | PASS |
| `daily-kamera` | `CAMERA` transparently retrieves カメラ. The giant photographic eye is concrete, and the still/video scope note is accurate. | PASS |
| `daily-iyahon` | `EARPHONE` transparently retrieves イヤホン as the source loan, including final `ン`. The self-splitting earphone visualizes earbuds, and the ヘッドホン distinction is accurate. | PASS |
| `daily-eakon` | `AIR—CON` transparently retrieves エアコン and preserves final `ン`. The superhero cooling a heat wave is memorable; the heating-and-cooling unit clarification is accurate. | PASS |
| `daily-rimokon` | `REMO—CON` supplies the complete clipping リモコン, with the usual English **r** / Japanese flap approximation. The shrink-ray scene teaches the shortening, and appliance scope is accurate. | PASS |
| `daily-geemu` | `GAME` transparently retrieves ゲーム and its long vowel. The board swallowing players is concrete; the ゲーム / 試合 distinction is accurate. | PASS |
| `daily-chiketto` | `TICKET` transparently retrieves チケット; the English closed **k** supports the `ッ` in the established adaptation. The biting ticket connects admission to the object, and the 切符 clarification is accurate. | PASS |
| `daily-suupaa` | `SUPER` transparently retrieves スーパー, including both established long vowels. The caped supermarket is memorable; standalone and attributive uses are accurately distinguished. | PASS |
| `daily-reji` | The opening of `REGISTER` supplies レジ and the torn-receipt scene explicitly motivates the clipping from レジスター. Checkout/register/cashier scope is accurate. | PASS |
| `daily-toire` | `TOILET` is the source cue and the doorway visibly removes its end to leave トイレ. The restroom-versus-bathing-room clarification is accurate. | PASS |
| `daily-basu` | `BUS` transparently retrieves バス through ordinary loan adaptation. The accordion bus is concrete, and the バス停 clarification is accurate. | PASS |
| `daily-arubaito` | `AL—BUY—TOE` covers `ア・ル・バ・イ・ト` in order, with ordinary **l** / Japanese flap and diphthong approximations. The three absurd workers anchor the part-time meaning; the German-origin disclaimer prevents false etymology. | PASS |

## Targeted correction re-review

### `conversation-douzo` — どうぞ

**PASS.** The source now uses `DOUGH—ZO`: `DOUGH` covers `ど・う`, and the coined one-syllable name `ZO` covers `ぞ`. The exact hidden map remains `ど・う・ぞ`. The new bakery scene has an actor, action, and consequence tied to all three meanings. Its usage sentence correctly allows どうぞ in invitations and request constructions while distinguishing its encouraging function from the request carried by ください. The entry has one balanced `<reading>` span and three balanced `<vocabulary>` spans.

### `food-gochisousama` — ごちそうさま

**PASS.** The source now ends the cue with explicit `SAH—MAH`, so the previously unsupported final `ま` is voiced and recoverable. The complete close cue covers `ご・ち・そ・う・さ・ま` in order, matching the unchanged hidden map. The mountain-of-food scene remains concrete and meaning-linked; bowing after the meal makes the gratitude payoff inevitable. The usage sentence correctly contrasts post-meal ごちそうさま with pre-meal いただきます. The entry has one balanced `<reading>` span and two balanced `<vocabulary>` spans.

## Release recommendation

All 48 entries pass. Each has a complete sound path, a concrete meaning-linked event, an accurate usage clarification, exact hidden kana coverage, and balanced markup. No further starter-pack mnemonic revision is required by this audit.
