# Kanji expansion: independent reading, composition, and language review

_Independent read-only review run on 2026-09-01 (Europe/Madrid). The reviewer did not edit the kanji source._

Source under review: [custom-vocab-kanji-expansion.json](./data/custom-vocab-kanji-expansion.json)  
Frozen SHA-256: 573dac286e8cba45d06a8c46b5695976057aeab7fd3a1e153117ee36f668893e  
Source modification time: 2026-09-01 14:23:17 +0200

## Outcome

| Verdict | Count |
| --- | ---: |
| PASS | 116 |
| FAIL | 40 |
| **Total** | **156** |

A FAIL is release-blocking. A row fails if any learner-facing reading or meaning mnemonic is misleading or unacceptably awkward, if a context is not natural, if displayed part-of-speech metadata contradicts the applicable JMdict senses, or if the item is the same lexeme as a WaniKani subject.

## Evidence and method

Every one of the 156 entries was inspected, not sampled. The review checked the ordered sound path against the hidden readingMap, the truthfulness of claimed contractions and sound changes, the presence of a concrete scene and meaning consequence, the naturalness of the composition bridge after tags are stripped, usage notes, both sides of every context pair, and parts of speech.

Deterministic evidence for this frozen revision:

- all 156 readingMap sequences concatenate exactly to their NFKC-normalized canonical readings;
- all 156 reading mnemonics have balanced single reading hooks and vocabulary payoffs, and the production catalog validator accepts the source shape;
- a fresh parse of /tmp/kakehashi-jmdict.f6x5f1/JMdict_e.gz resolves all 156 exact written-reading pairs to applicable senses, with zero unresolved or ambiguous entries;
- the complete disposable-copy production sync resolves all 565 catalog words and accepts 49 packs;
- the author's live WaniKani component/gloss/order auditor reported 156 / 156 composition fixtures passing and no level-range defects; this independent review therefore concentrates on prose and sound-change truth rather than repeating that mechanical check; and
- exact repeated stock text was removed. The remaining PASS stories use a recurring component-scene shape, but each still has a distinct physical action and causal meaning payoff; they are not classified as bare reading drills.

The automated exact-form overlap gate did not catch the honorific spelling pair 御無沙汰 / ご無沙汰. The independent lexeme check did: JMdict entry 1270650 contains both spellings, and WaniKani subject 8547 is ご無沙汰. That is one semantic duplicate and requires replacement.

## Release-blocking findings and correction criteria

| Word ID | Word | Defect | Required correction |
| --- | --- | --- | --- |
| kanji-expansion-01-05-t8tqa0p | 下車 | partsOfSpeech falsely includes transitive verb; the applicable JMdict sense is noun + suru + intransitive. | Remove transitive verb. |
| kanji-expansion-01-05-48t0a8i | 見出し | The reading mnemonic says 出し “voices to だし,” implying an unexplained sound change even though だし is the attested chunk used here. | Cue 見 as み and 出し as だし directly, or document a defensible derivation; keep the concrete headline scene. |
| kanji-expansion-01-05-07txa0c9c9j | 外出 | partsOfSpeech falsely includes transitive verb; JMdict marks this suru verb intransitive. | Remove transitive verb. |
| kanji-expansion-06-10-u8t6b0b3l | 発言 | Tag-stripped meaning prose begins “Words Departure your mouth when you Say,” which is not grammatical learner-facing English. | Preserve 発→Departure and 言→Say in order, but put them in a readable causal sentence that reaches statement or remark. |
| kanji-expansion-06-10-k8ttdvb8g | 取引 | “One merchant Take while the other Pull goods” is visibly broken after rendering. | Rewrite the Take→Pull exchange as a grammatical transaction scene without changing the component order. |
| kanji-expansion-06-10-17t4cn2x | 全体 | Context “まず計画の全体を説明します” is awkward for the intended “the plan as a whole.” | Use natural Japanese containing the target, such as まず計画全体を説明します. |
| kanji-expansion-11-15-17te9c | 合意 | partsOfSpeech falsely includes transitive verb; the resolved JMdict suru sense is intransitive. | Remove transitive verb. |
| kanji-expansion-11-15-38t1crhc | 信念 | “A Believe grips one Thought” is machine-valid keyword insertion, not polished English. | Turn Believe→Thought into a grammatical, concrete image of an unshakable conviction. |
| kanji-expansion-11-15-47t6b6b2o | 通信 | “A signal Pass Through a wire” leaves the component keyword unconjugated and the Believe payoff weakly attached. | Use a grammatical Pass Through→Believe signal scene that causally yields communication or transmission. |
| kanji-expansion-11-15-e73a4azd2b7y | 大使館 | “A Big diplomatic Use works from an official Public Building” is incoherent and largely reveals the answer with “diplomatic.” | Build a concrete Big→Use→Public Building scene that reaches embassy without presenting the tags as broken syntax. |
| kanji-expansion-16-20-57tta7k | 機能 | partsOfSpeech falsely includes transitive verb; JMdict has noun + suru + intransitive. | Remove transitive verb. |
| kanji-expansion-16-20-07t6bva7z | 生産 | “gives new Life … and Give Birth” is ungrammatical after tag stripping. | Make Life→Give Birth a grammatical factory scene whose produced goods supply the production payoff. |
| kanji-expansion-16-20-l73apc3e2c9k | 不動産 | “things that do Not Move are enduring Give Birth” is not a coherent bridge to real estate. | Use all three components in order in a causal image—for example, property that will Not Move but can Give Birth to rent. |
| kanji-expansion-16-20-07twa5d | 成果 | “When hard work Become ripe Fruit” is broken learner-facing prose. | Conjugate the bridge cleanly while preserving Become→Fruit and the result or achievement payoff. |
| kanji-expansion-16-20-r8trc3i4a | 結論 | partsOfSpeech falsely includes transitive verb; the JMdict suru sense is intransitive. | Remove transitive verb. |
| kanji-expansion-21-25-48tb8b | 実施 | “Turn a Truth plan into action by Carry Out” is ungrammatical. | Put Truth→Carry Out into a grammatical implementation scene, such as taking a verified plan and carrying it out. |
| kanji-expansion-26-30-47tb1ec6zd | 上昇 | partsOfSpeech falsely includes transitive verb; JMdict marks 上昇する intransitive. | Remove transitive verb. |
| kanji-expansion-26-30-07t8a5a0b1s | 退職 | partsOfSpeech falsely includes transitive verb; JMdict marks 退職する intransitive. | Remove transitive verb. |
| kanji-expansion-31-35-j8t8gwc | 勤務 | partsOfSpeech falsely includes transitive verb; JMdict marks 勤務する intransitive. | Remove transitive verb. |
| kanji-expansion-31-35-18t5ao1v | 雑談 | partsOfSpeech falsely includes transitive verb; JMdict marks 雑談する intransitive. | Remove transitive verb. |
| kanji-expansion-36-40-07t1cyc4e | 稲妻 | The reading mnemonic says 稲 “shortens to いな.” The attested compound stem changes いね to いな; it is not a shortening. | Teach the attested いな chunk directly and separately explain 妻 つま→ずま, or teach いなずま as a verified whole-word form. |
| kanji-expansion-41-45-y8t2d0e | 日頃 | “The Sun returns at approximately the same Approximate” is circular and incoherent. | Make Sun→Approximate a concrete habitual-time image, such as the sun returning at approximately the same time every day. |
| kanji-expansion-41-45-47t4bwc6h7a | 消滅 | partsOfSpeech falsely includes transitive verb; both applicable JMdict suru senses are intransitive. | Remove transitive verb. |
| kanji-expansion-41-45-57t5aza2d5l | 結晶 | partsOfSpeech falsely includes transitive verb; applicable JMdict senses mark 結晶する intransitive. | Remove transitive verb. |
| kanji-expansion-41-45-k73a3a5gskdz | 長距離 | “pulls travelers far Detach” is neither grammatical nor a clear use of the third component. | Make Long→Distance→Detach a readable scene, such as a long distance pulling a traveler far enough to detach from home. |
| kanji-expansion-46-50-07tsb0a4t | 傾斜 | partsOfSpeech falsely includes transitive verb; JMdict marks 傾斜する intransitive. | Remove transitive verb. |
| kanji-expansion-46-50-173ac2woe | 漫画家 | The meaning bridge makes a “creative House” equal the manga artist and does not make the 家 component memorable or coherent. | Keep Comic→Image→House order, but make the house a concrete studio or home whose resident is the manga artist. |
| kanji-expansion-51-55-g73axa2cu2k2k | 名残惜しい | The reading mnemonic claims 残 “voices のこり into ごり,” silently dropping の and こ; that is not an honest rendaku explanation. | Teach 名残 なごり as a verified fixed chunk plus 惜しい おしい, or provide authoritative evidence for a complete derivation. |
| kanji-expansion-51-55-47tb1i6a7n | 登頂 | partsOfSpeech falsely includes transitive verb; JMdict marks 登頂する intransitive. | Remove transitive verb. |
| kanji-expansion-51-55-r63bcn9bwkna07a | 一喜一憂 | partsOfSpeech falsely includes transitive verb; JMdict marks 一喜一憂する intransitive. | Remove transitive verb. |
| kanji-expansion-51-55-y83bobye4cumce | 単身赴任 | partsOfSpeech falsely includes transitive verb; JMdict marks 単身赴任する intransitive. The tag-stripped bridge “A Simple Body Proceed” is also awkward. | Remove transitive verb and rewrite Simple→Body→Proceed→Duty as grammatical prose while preserving the family-stays-home consequence. |
| kanji-expansion-51-55-r63bna3hwb5c | 意思疎通 | “An Idea becomes a Think, crosses a once Neglect gap, and Pass Through” is ungrammatical and does not give a clean communication path. | Rewrite Idea→Think→Neglect→Pass Through as a concrete two-way message scene ending in mutual understanding. |
| kanji-expansion-51-55-47tb1iwfvc | 傍聴 | The reading mnemonic ends “while its owner sit in,” an obvious agreement error in learner-facing copy. | Change the clause to “while its owner sits in” or recast it, preserving the ぼう—ちょう hook and observer scene. |
| kanji-expansion-56-60-l83bh5dvi | 御無沙汰 | This is the same JMdict lexeme as WaniKani ご無沙汰 #8547 despite the kanji honorific spelling. It also falsely includes transitive verb, has incoherent meaning prose (“message was Select out”), and treats 無→ぶ as unexplained voicing. | Replace the entry with a genuinely distinct lexeme; do not try to repair this spelling variant. |
| kanji-expansion-56-60-r8j4f2a | 萌える | partsOfSpeech falsely includes transitive verb; all applicable JMdict senses are intransitive. The reading text also says an on-reading “transforms” into the kun verb, which is not a sound change. | Remove transitive verb and teach the attested kun stem も plus okurigana える directly in the sprouting scene. |
| kanji-expansion-56-60-38trewe | 新譜 | The reading mnemonic calls ふ→ぷ “voicing.” The p-series is semi-voiced/euphonic, not the voiced b-series. | Describe the exact p shift honestly or teach fixed しんぷ directly; retain the release scene. |
| kanji-expansion-56-60-47tsbwo | 甲羅 | “spreads its armored plates Spread Out a turtle” is broken English and gives no clean causal bridge. | Rewrite Turtle Shell→Spread Out as a grammatical armored-carapace scene. |
| kanji-expansion-56-60-l73axc9czd0g | 手拍子 | The mnemonic claims 拍 changes from はく to びょう. The useful decomposition is 手 て + 拍子 ひょうし, with 拍子 becoming びょうし in the compound; はく→びょう is not voicing. | Teach て + ひょうし→びょうし honestly, or cue the whole fixed word, while keeping the clapping scene. |
| kanji-expansion-56-60-063bqd8gnb8c0c2hfc | 順風満帆 | It calls ふう→ぷう and はん→ぱん “voicing.” Both are h-series to p-series shifts, not voiced b-series, so the sound-change explanation is false. | Teach the fixed chunks じゅんぷう and まんぱん or explicitly describe the h→p changes after ん without calling them voicing. |
| kanji-expansion-56-60-n8jub0a2byab | 甚だしい | Context “その説明には誤りが甚だしい” is not natural for the supplied translation. | Use a natural target-bearing sentence such as その説明には甚だしい誤りがある。 |

## Entry-by-entry verdicts

The table below records the verdict for every entry in the frozen source. PASS means the exact reading path, scene, meaning/usage, context, and applicable metadata survived this review; FAIL details appear above.

### Kanji Expansion 1–5: Foundations In Use

| Word ID | Word | Verdict |
| --- | --- | --- |
| kanji-expansion-01-05-48tza8r | 男子【だんし】 | PASS |
| kanji-expansion-01-05-17t9b0d | 市内【しない】 | PASS |
| kanji-expansion-01-05-w7t1a5c | 赤字【あかじ】 | PASS |
| kanji-expansion-01-05-t8tqa0p | 下車【げしゃ】 | **FAIL** |
| kanji-expansion-01-05-47ttam0gqk | 中学【ちゅうがく】 | PASS |
| kanji-expansion-01-05-47txbj4v | 正午【しょうご】 | PASS |
| kanji-expansion-01-05-48t4b0a4p | 半年【はんとし】 | PASS |
| kanji-expansion-01-05-57trhra4b4d | 本名【ほんみょう】 | PASS |
| kanji-expansion-01-05-ebuub0f | 本音【ほんね】 | PASS |
| kanji-expansion-01-05-f73a1a2dk01are | 社会人【しゃかいじん】 | PASS |
| kanji-expansion-01-05-48t0a8i | 見出し【みだし】 | **FAIL** |
| kanji-expansion-01-05-07txa0c9c9j | 外出【がいしゅつ】 | **FAIL** |
| kanji-expansion-01-05-m8tn5p | 小麦【こむぎ】 | PASS |

### Kanji Expansion 6–10: Everyday Organizations

| Word ID | Word | Verdict |
| --- | --- | --- |
| kanji-expansion-06-10-08t5gub | 予算【よさん】 | PASS |
| kanji-expansion-06-10-58t3bxf | 地元【じもと】 | PASS |
| kanji-expansion-06-10-07thr1e4o | 会場【かいじょう】 | PASS |
| kanji-expansion-06-10-j8t5a6m | 記者【きしゃ】 | PASS |
| kanji-expansion-06-10-57tudwd1d | 部長【ぶちょう】 | PASS |
| kanji-expansion-06-10-07tb9dvc | 最大【さいだい】 | PASS |
| kanji-expansion-06-10-e8ttbydxf | 見通し【みとおし】 | PASS |
| kanji-expansion-06-10-u8t6b0b3l | 発言【はつげん】 | **FAIL** |
| kanji-expansion-06-10-k8ttdvb8g | 取引【とりひき】 | **FAIL** |
| kanji-expansion-06-10-07t1dtc | 市場【いちば】 | PASS |
| kanji-expansion-06-10-wbun0h | 本部【ほんぶ】 | PASS |
| kanji-expansion-06-10-17t4cn2x | 全体【ぜんたい】 | **FAIL** |
| kanji-expansion-06-10-38tvf6c | 市民【しみん】 | PASS |

### Kanji Expansion 11–15: Plans And Communication

| Word ID | Word | Verdict |
| --- | --- | --- |
| kanji-expansion-11-15-vbuxb2c | 分野【ぶんや】 | PASS |
| kanji-expansion-11-15-17te9c | 合意【ごうい】 | **FAIL** |
| kanji-expansion-11-15-47t4bwhocte | 周辺【しゅうへん】 | PASS |
| kanji-expansion-11-15-47t6b5c6h | 当初【とうしょ】 | PASS |
| kanji-expansion-11-15-38t1crhc | 信念【しんねん】 | **FAIL** |
| kanji-expansion-11-15-17tta9f | 課題【かだい】 | PASS |
| kanji-expansion-11-15-17te9f1a2u | 調整【ちょうせい】 | PASS |
| kanji-expansion-11-15-47t6b6b2o | 通信【つうしん】 | **FAIL** |
| kanji-expansion-11-15-j8tyi8a | 金利【きんり】 | PASS |
| kanji-expansion-11-15-d9t7fvb | 予選【よせん】 | PASS |
| kanji-expansion-11-15-j8treug | 記念【きねん】 | PASS |
| kanji-expansion-11-15-38t6b3f | 首都【しゅと】 | PASS |
| kanji-expansion-11-15-e73a4azd2b7y | 大使館【たいしかん】 | **FAIL** |

### Kanji Expansion 16–20: Work And Systems

| Word ID | Word | Verdict |
| --- | --- | --- |
| kanji-expansion-16-20-57ttaf9z | 企業【きぎょう】 | PASS |
| kanji-expansion-16-20-57tta7k | 機能【きのう】 | **FAIL** |
| kanji-expansion-16-20-07t6bva7z | 生産【せいさん】 | **FAIL** |
| kanji-expansion-16-20-l73apc3e2c9k | 不動産【ふどうさん】 | **FAIL** |
| kanji-expansion-16-20-07twa5d | 成果【せいか】 | **FAIL** |
| kanji-expansion-16-20-o8twa3e1h | 所得【しょとく】 | PASS |
| kanji-expansion-16-20-48t5d0ctc | 文書【ぶんしょ】 | PASS |
| kanji-expansion-16-20-07twaq0w | 明確【めいかく】 | PASS |
| kanji-expansion-16-20-r8trc3i4a | 結論【けつろん】 | **FAIL** |
| kanji-expansion-16-20-n8txa4i7d5c | 食品【しょくひん】 | PASS |
| kanji-expansion-16-20-07twa1h | 追加【ついか】 | PASS |
| kanji-expansion-16-20-38t0bzhoc | 書店【しょてん】 | PASS |
| kanji-expansion-16-20-57t6bub9loa5f | 順調【じゅんちょう】 | PASS |

### Kanji Expansion 21–25: Public Life And Decisions

| Word ID | Word | Verdict |
| --- | --- | --- |
| kanji-expansion-21-25-k8tn4xc | 現金【げんきん】 | PASS |
| kanji-expansion-21-25-47tsbwk | 候補【こうほ】 | PASS |
| kanji-expansion-21-25-o8th9b4r | 原則【げんそく】 | PASS |
| kanji-expansion-21-25-48tb8b | 実施【じっし】 | **FAIL** |
| kanji-expansion-21-25-07tvcb7t2c | 水準【すいじゅん】 | PASS |
| kanji-expansion-21-25-07t2an | 景気【けいき】 | PASS |
| kanji-expansion-21-25-t8t0b7l | 現地【げんち】 | PASS |
| kanji-expansion-21-25-07tbp6b | 経営【けいえい】 | PASS |
| kanji-expansion-21-25-tbu2a3f | 不満【ふまん】 | PASS |
| kanji-expansion-21-25-17t4cwb1o | 前提【ぜんてい】 | PASS |
| kanji-expansion-21-25-47tb1lma0n | 導入【どうにゅう】 | PASS |
| kanji-expansion-21-25-07t2cwe | 整備【せいび】 | PASS |
| kanji-expansion-21-25-k73avcd4nve0a | 消費者【しょうひしゃ】 | PASS |

### Kanji Expansion 26–30: Action And Change

| Word ID | Word | Verdict |
| --- | --- | --- |
| kanji-expansion-26-30-47t6bwhxe | 方針【ほうしん】 | PASS |
| kanji-expansion-26-30-673abi3euc2a80a | 積極的【せっきょくてき】 | PASS |
| kanji-expansion-26-30-47tb1ec6zd | 上昇【じょうしょう】 | **FAIL** |
| kanji-expansion-26-30-17te1ewa3w | 修正【しゅうせい】 | PASS |
| kanji-expansion-26-30-k73ab0bjz | 航空機【こうくうき】 | PASS |
| kanji-expansion-26-30-n8t2a6d | 独自【どくじ】 | PASS |
| kanji-expansion-26-30-07tbz6c | 開催【かいさい】 | PASS |
| kanji-expansion-26-30-g73afb1czduuva7j | 従業員【じゅうぎょういん】 | PASS |
| kanji-expansion-26-30-07tb9d6a | 再生【さいせい】 | PASS |
| kanji-expansion-26-30-07txeth | 移転【いてん】 | PASS |
| kanji-expansion-26-30-07t8a5a0b1s | 退職【たいしょく】 | **FAIL** |
| kanji-expansion-26-30-s8tyf0d | 保健【ほけん】 | PASS |
| kanji-expansion-26-30-f8t3b6m | 河川【かせん】 | PASS |

### Kanji Expansion 31–35: Workplace And Daily Records

| Word ID | Word | Verdict |
| --- | --- | --- |
| kanji-expansion-31-35-57tta3u9b | 金融【きんゆう】 | PASS |
| kanji-expansion-31-35-k8t5an2b | 実績【じっせき】 | PASS |
| kanji-expansion-31-35-48ttd0d | 秘書【ひしょ】 | PASS |
| kanji-expansion-31-35-j8t8gwc | 勤務【きんむ】 | **FAIL** |
| kanji-expansion-31-35-48tqa4a8s | 損失【そんしつ】 | PASS |
| kanji-expansion-31-35-u8tn6v | 資源【しげん】 | PASS |
| kanji-expansion-31-35-47tb1evmdq | 了承【りょうしょう】 | PASS |
| kanji-expansion-31-35-m8t9b4kc | 賃金【ちんぎん】 | PASS |
| kanji-expansion-31-35-17t1cra | 世帯【せたい】 | PASS |
| kanji-expansion-31-35-073azdsa1e3fxf | 百貨店【ひゃっかてん】 | PASS |
| kanji-expansion-31-35-47tsbs4t | 校舎【こうしゃ】 | PASS |
| kanji-expansion-31-35-07t1cva | 大豆【だいず】 | PASS |
| kanji-expansion-31-35-18t5ao1v | 雑談【ざつだん】 | **FAIL** |

### Kanji Expansion 36–40: Care, Continuity, And Exchange

| Word ID | Word | Verdict |
| --- | --- | --- |
| kanji-expansion-36-40-r8tzd0g | 懸念【けねん】 | PASS |
| kanji-expansion-36-40-f8tzjoa | 緩和【かんわ】 | PASS |
| kanji-expansion-36-40-07t8af1e | 継続【けいぞく】 | PASS |
| kanji-expansion-36-40-k8tgn6v | 顧客【こきゃく】 | PASS |
| kanji-expansion-36-40-57t3b7koa6c | 診療【しんりょう】 | PASS |
| kanji-expansion-36-40-17te9b9d0k | 中継【ちゅうけい】 | PASS |
| kanji-expansion-36-40-07t1cyc4e | 稲妻【いなずま】 | **FAIL** |
| kanji-expansion-36-40-n8j2b | 姓【せい】 | PASS |
| kanji-expansion-36-40-17t4b4g | 負債【ふさい】 | PASS |
| kanji-expansion-36-40-17t1fel6n | 幅広い【はばひろい】 | PASS |
| kanji-expansion-36-40-763aob5a1fybt | 後片付け【あとかたづけ】 | PASS |
| kanji-expansion-36-40-l73asb6llb1l | 文房具【ぶんぼうぐ】 | PASS |
| kanji-expansion-36-40-k8tg5n5b3e | 返却【へんきゃく】 | PASS |

### Kanji Expansion 41–45: Ideas, Books, And Daily Life

| Word ID | Word | Verdict |
| --- | --- | --- |
| kanji-expansion-41-45-38tb6p | 趣旨【しゅし】 | PASS |
| kanji-expansion-41-45-17t9b6e | 芝居【しばい】 | PASS |
| kanji-expansion-41-45-y8t2d0e | 日頃【ひごろ】 | **FAIL** |
| kanji-expansion-41-45-k8t2ar2t | 書籍【しょせき】 | PASS |
| kanji-expansion-41-45-47t4bwc6h7a | 消滅【しょうめつ】 | **FAIL** |
| kanji-expansion-41-45-47tb5gvg | 包装【ほうそう】 | PASS |
| kanji-expansion-41-45-r8twa2cwo | 堅実【けんじつ】 | PASS |
| kanji-expansion-41-45-47t2a0hxh | 朗読【ろうどく】 | PASS |
| kanji-expansion-41-45-57t5aza2d5l | 結晶【けっしょう】 | **FAIL** |
| kanji-expansion-41-45-69to8e8a | 花嫁【はなよめ】 | PASS |
| kanji-expansion-41-45-48ttbxdyh | 紛失【ふんしつ】 | PASS |
| kanji-expansion-41-45-j8t4c0h | 亀裂【きれつ】 | PASS |
| kanji-expansion-41-45-k73a3a5gskdz | 長距離【ちょうきょり】 | **FAIL** |

### Kanji Expansion 46–50: Abstract Ideas And Practical Life

| Word ID | Word | Verdict |
| --- | --- | --- |
| kanji-expansion-46-50-57tnr | 架空【かくう】 | PASS |
| kanji-expansion-46-50-17te1eym6a | 奨励【しょうれい】 | PASS |
| kanji-expansion-46-50-47t2an6c | 拘束【こうそく】 | PASS |
| kanji-expansion-46-50-07tsb0a4t | 傾斜【けいしゃ】 | **FAIL** |
| kanji-expansion-46-50-k8te3c1a | 蓄積【ちくせき】 | PASS |
| kanji-expansion-46-50-k73ab0b7c9c2b0txa | 抽象的【ちゅうしょうてき】 | PASS |
| kanji-expansion-46-50-173ac2woe | 漫画家【まんがか】 | **FAIL** |
| kanji-expansion-46-50-f73a0a5a3v | 家計簿【かけいぼ】 | PASS |
| kanji-expansion-46-50-f8tqa0bm3z | 風邪薬【かぜぐすり】 | PASS |
| kanji-expansion-46-50-47t0b4cva | 洞察【どうさつ】 | PASS |
| kanji-expansion-46-50-u8tn3eh6r | 成し遂げる【なしとげる】 | PASS |
| kanji-expansion-46-50-87tkq15a | 遠隔【えんかく】 | PASS |
| kanji-expansion-46-50-w7tya3azt | 仰向け【あおむけ】 | PASS |

### Kanji Expansion 51–55: Home, Work, And Major Effort

| Word ID | Word | Verdict |
| --- | --- | --- |
| kanji-expansion-51-55-g73axa2cu2k2k | 名残惜しい【なごりおしい】 | **FAIL** |
| kanji-expansion-51-55-47tudwa6nzc | 頂点【ちょうてん】 | PASS |
| kanji-expansion-51-55-d83axbva6gtg9e | 洗濯物【せんたくもの】 | PASS |
| kanji-expansion-51-55-l73asan7gqs | 乾燥機【かんそうき】 | PASS |
| kanji-expansion-51-55-ob4b5c8ff8b | 露天風呂【ろてんぶろ】 | PASS |
| kanji-expansion-51-55-47tb1i6a7n | 登頂【とうちょう】 | **FAIL** |
| kanji-expansion-51-55-47txag3b3tka | 凝縮【ぎょうしゅく】 | PASS |
| kanji-expansion-51-55-07th5a6x | 偉業【いぎょう】 | PASS |
| kanji-expansion-51-55-r63bcn9bwkna07a | 一喜一憂【いっきいちゆう】 | **FAIL** |
| kanji-expansion-51-55-y83bobye4cumce | 単身赴任【たんしんふにん】 | **FAIL** |
| kanji-expansion-51-55-r63bna3hwb5c | 意思疎通【いしそつう】 | **FAIL** |
| kanji-expansion-51-55-97t4bwinc | 見据える【みすえる】 | PASS |
| kanji-expansion-51-55-47tb1iwfvc | 傍聴【ぼうちょう】 | **FAIL** |

### Kanji Expansion 56–60: Culture, Media, And Specialized Daily Words

| Word ID | Word | Verdict |
| --- | --- | --- |
| kanji-expansion-56-60-07tuag91a | 貝殻【かいがら】 | PASS |
| kanji-expansion-56-60-k73ab0d3h2grf | 盲導犬【もうどうけん】 | PASS |
| kanji-expansion-56-60-l83bh5dvi | 御無沙汰【ごぶさた】 | **FAIL** |
| kanji-expansion-56-60-r8j4f2a | 萌える【もえる】 | **FAIL** |
| kanji-expansion-56-60-e73apcxc0fzk | 太鼓判【たいこばん】 | PASS |
| kanji-expansion-56-60-38trewe | 新譜【しんぷ】 | **FAIL** |
| kanji-expansion-56-60-47tsbwo | 甲羅【こうら】 | **FAIL** |
| kanji-expansion-56-60-l73axc9czd0g | 手拍子【てびょうし】 | **FAIL** |
| kanji-expansion-56-60-e73a1aw3g2f1l | 海賊版【かいぞくばん】 | PASS |
| kanji-expansion-56-60-n8tza7gte | 拍車【はくしゃ】 | PASS |
| kanji-expansion-56-60-063bqd8gnb8c0c2hfc | 順風満帆【じゅんぷうまんぱん】 | **FAIL** |
| kanji-expansion-56-60-o8t2d1c5e | 粘膜【ねんまく】 | PASS |
| kanji-expansion-56-60-n8jub0a2byab | 甚だしい【はなはだしい】 | **FAIL** |

## Final correction rerun

The author froze one atomic correction pass at SHA-256 a626603c87a59baafbced4f8ed228099aa1c49b02355258d5e455c5c0b7cb99b, modification time 2026-09-01 14:53:31 +0200. The initial tables above remain the audit trail for the original 573dac revision. Every one of the 40 failed rows was re-read against its exact correction criterion on the new frozen source.

### Final outcome

| Verdict | Count |
| --- | ---: |
| PASS | 156 |
| FAIL | 0 |
| **Total** | **156** |

No residual release blocker remains.

### Forty-row correction audit trail

| Current word ID | Word | Final verdict | Independent rerun finding |
| --- | --- | --- | --- |
| kanji-expansion-01-05-t8tqa0p | 下車 | PASS | Removed the false transitive label; noun + suru + intransitive now matches JMdict. |
| kanji-expansion-01-05-48t0a8i | 見出し | PASS | 出し now contributes the attested だし chunk directly; the headline scene and み—だし path remain concrete and complete. |
| kanji-expansion-01-05-07txa0c9c9j | 外出 | PASS | Removed the false transitive label; noun + suru + intransitive now matches JMdict. |
| kanji-expansion-06-10-u8t6b0b3l | 発言 | PASS | The Departure→Say bridge is now grammatical, concrete, and causally reaches statement or remark. |
| kanji-expansion-06-10-k8ttdvb8g | 取引 | PASS | The labeled Take crate and Pull rope now form a readable exchange scene ending in transaction. |
| kanji-expansion-06-10-17t4cn2x | 全体 | PASS | Context is now the natural まず計画全体を説明します, with an accurate translation. |
| kanji-expansion-11-15-17te9c | 合意 | PASS | Removed the false transitive label; noun + suru + intransitive now matches JMdict. |
| kanji-expansion-11-15-38t1crhc | 信念 | PASS | Believe stamps a Thought into stone; the polished scene makes an unshakable conviction inevitable. |
| kanji-expansion-11-15-47t6b6b2o | 通信 | PASS | A signal now passes through a gate and confirms arrival at a Believe receiver, cleanly yielding communication. |
| kanji-expansion-11-15-e73a4azd2b7y | 大使館 | PASS | Big→Use→Public Building now appears in a guarded foreign-flag building scene that reaches embassy without broken syntax. |
| kanji-expansion-16-20-57tta7k | 機能 | PASS | Removed the false transitive label; noun + suru + intransitive now matches JMdict. |
| kanji-expansion-16-20-07t6bva7z | 生産 | PASS | The factory pumps Life into materials and the Give Birth machine delivers goods, producing a grammatical production bridge. |
| kanji-expansion-16-20-l73apc3e2c9k | 不動産 | PASS | The property does Not Move but Gives Birth to rent; all components now drive the real-estate payoff. |
| kanji-expansion-16-20-07twa5d | 成果 | PASS | The Become machine turns work into Fruit, giving a clean result or achievement payoff. |
| kanji-expansion-16-20-r8trc3i4a | 結論 | PASS | Removed the false transitive label; noun + suru + intransitive now matches JMdict. |
| kanji-expansion-21-25-48tb8b | 実施 | PASS | The Truth lamp verifies a plan before the Carry Out button puts it into action; implementation now follows grammatically. |
| kanji-expansion-26-30-47tb1ec6zd | 上昇 | PASS | Removed the false transitive label; noun + suru + intransitive now matches JMdict. |
| kanji-expansion-26-30-07t8a5a0b1s | 退職 | PASS | Removed the false transitive label; noun + suru + intransitive now matches JMdict. |
| kanji-expansion-31-35-j8t8gwc | 勤務 | PASS | Removed the false transitive label; noun + suru + intransitive now matches JMdict. |
| kanji-expansion-31-35-18t5ao1v | 雑談 | PASS | Removed the false transitive label; noun + suru + intransitive now matches JMdict. |
| kanji-expansion-36-40-07t1cyc4e | 稲妻 | PASS | 稲 now supplies its attested compound chunk いな directly; 妻 つま→ずま is identified honestly as rendaku. |
| kanji-expansion-41-45-y8t2d0e | 日頃 | PASS | Sun and the Approximate marker now create a visible same-time daily routine, cleanly yielding usually or daily. |
| kanji-expansion-41-45-47t4bwc6h7a | 消滅 | PASS | Removed the false transitive label; noun + suru + intransitive now matches both applicable JMdict senses. |
| kanji-expansion-41-45-57t5aza2d5l | 結晶 | PASS | Removed the false transitive label; noun + suru + intransitive now matches the applicable JMdict senses. |
| kanji-expansion-41-45-k73a3a5gskdz | 長距離 | PASS | Long→Distance→Detach is now a grammatical road scene that pulls a traveler away from home. |
| kanji-expansion-46-50-07tsb0a4t | 傾斜 | PASS | Removed the false transitive label; noun + suru + intransitive now matches JMdict. |
| kanji-expansion-46-50-173ac2woe | 漫画家 | PASS | Comic→Image→House now builds a manga-covered house studio whose resident is the manga artist. |
| kanji-expansion-51-55-17tra2br4i1j | 名残惜しい | PASS | The mnemonic now teaches fixed 名残 なごり plus 惜しい おしい and makes no unsupported contraction claim. |
| kanji-expansion-51-55-47tb1i6a7n | 登頂 | PASS | Removed the false transitive label; noun + suru + intransitive now matches JMdict. |
| kanji-expansion-51-55-r63bcn9bwkna07a | 一喜一憂 | PASS | Removed the false transitive label; noun + suru + intransitive now matches JMdict. |
| kanji-expansion-51-55-y83bobye4cumce | 単身赴任 | PASS | Removed the false transitive label and replaced broken keyword stacking with a clear lone-suitcase, distant-duty scene. |
| kanji-expansion-51-55-r63bna3hwb5c | 意思疎通 | PASS | Idea→Think→Neglect→Pass Through now forms a grammatical two-way message bridge ending in mutual understanding. |
| kanji-expansion-51-55-47tb1iwfvc | 傍聴 | PASS | The reading scene now says the observer takes a side seat to sit in; the subject-verb agreement defect is gone. |
| kanji-expansion-56-60-l8t5a | 擬似 | PASS | Replaces 御無沙汰. Exact 擬似【ぎじ】 resolves to JMdict 1592050 and the pseudo/quasi/false senses; no WK or custom form/reading collision exists. 擬 59 and 似 31 place it correctly at required level 59. Imitate→Resemble is in live WaniKani component order, ぎ—じ covers the reading, and the simulated-environment context is natural. JMdict gives priority to the shared ぎじ reading and to the common 疑似 spelling; 擬似 remains an attested technical spelling and the usage note names 疑似 explicitly. |
| kanji-expansion-56-60-97t6hlb | 萌える | PASS | Removed the false transitive label and now teaches attested kun stem も plus okurigana える without inventing an on-to-kun transformation. |
| kanji-expansion-56-60-38trewe | 新譜 | PASS | The text now identifies the attested p-series ぷ shift without calling it voicing; しん—ぷ remains complete and scene-bound. |
| kanji-expansion-56-60-47tsbwo | 甲羅 | PASS | Turtle Shell→Spread Out is now grammatical and visibly produces the protective carapace. |
| kanji-expansion-56-60-57t5bzc6c4f | 手拍子 | PASS | The mnemonic now teaches 手 て plus fixed 拍子 ひょうし→びょうし in the compound; it no longer claims はく→びょう. |
| kanji-expansion-56-60-47t7b8e1a8b5b2geb | 順風満帆 | PASS | It now teaches verified fixed chunks じゅんぷう and まんぱん, avoiding the false claim that the p-series changes are voicing. |
| kanji-expansion-56-60-n8jub0a2byab | 甚だしい | PASS | Context is now the natural その説明には甚だしい誤りがある, with an accurate translation. |

### Final stable-file checks

- The source still contains 12 packs and 156 words.
- All 156 IDs and all 156 written forms are unique. The replacement removed 御無沙汰 and added 擬似; no stale old ID or written form remains.
- All 156 hidden reading maps still concatenate exactly to the canonical reading, and all mnemonic markup/context-presence checks pass.
- A fresh resolver run against the 2026-09-01 JMdict distribution resolves all 565 production-catalog words, including 156 / 156 expansion words, with zero unresolved or ambiguous entries. 擬似 resolves by exact written-reading pair to entry 1592050 and both applicable senses.
- A disposable-copy run of the real production sync succeeds with 49 packs, 565 words, 6,825 WaniKani vocabulary subjects, 2,101 visible WaniKani kanji, and 565 JMdict pairs.
- Local WaniKani snapshots independently confirm 擬 at level 59 with meaning Imitate and 似 at level 31 with meaning Resemble. Neither 擬似 nor 疑似 nor reading ぎじ appears in the WaniKani vocabulary exclusion snapshot or any other custom source.
- The author's live component/gloss/order rerun reports 156 / 156, and the live collision and level audit reports zero defects.
- The source SHA-256 and modification time remained a626603c87a59baafbced4f8ed228099aa1c49b02355258d5e455c5c0b7cb99b and 2026-09-01 14:53:31 +0200 throughout the rerun.

**Final release verdict: PASS.**
