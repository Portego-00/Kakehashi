# Kanji custom-vocabulary reading-sound cross-check

_Independent full-set audit and correction re-review, 2026-09-01. This review did not edit the source catalog._

## Final verdict

**PASS: 121 PASS, 0 FAIL, 121 total.**

Reviewed source SHA-256: `3292de2265fe4d94fd72fe82c94b83222ec13d21642ccc26004cda56c1cf52c4`

| Level range | PASS | FAIL | Total |
|---|---:|---:|---:|
| 1–10 | 27 | 0 | 27 |
| 11–20 | 23 | 0 | 23 |
| 21–30 | 21 | 0 | 21 |
| 31–40 | 19 | 0 | 19 |
| 41–50 | 17 | 0 | 17 |
| 51–60 | 14 | 0 | 14 |
| **All** | **121** | **0** | **121** |

## Scope and decision rule

All 121 learner-facing `readingMnemonic` values were checked against their canonical `reading` and hidden `readingMap`, in order, including small kana, `っ`, `ん`, and long-vowel units. A pass requires a recoverable sound path, a concrete scene, a meaning consequence, and no false claim about a Japanese reading.

Ordinary English sound-key approximation was accepted when the intended Japanese sequence remained recoverable in order; English vowel duration was not mechanically treated as an extra Japanese mora. Exact Japanese component and homophone claims were checked more strictly. The hidden maps concatenate exactly to the canonical reading for 121/121 records.

## Correction re-review

The seven entries changed after the prior full audit all pass at the source hash above.

| ID | Canonical recovery | Re-review evidence |
|---|---|---|
| `kanji-01-10-taichou` | `たい—ちょう` → `た・い・ちょ・う` | 体 has the attested on-reading `たい`; 調 has `ちょう`. The clinic scanner turns physical condition into the consequence. |
| `kanji-11-20-seichou` | `せい—ちょう` → `せ・い・ちょ・う` | 成 has `せい`; 長 has `ちょう`. The seedling's visible growth supplies the payoff. |
| `kanji-21-30-chousa` | `ちょう—さ` → `ちょ・う・さ` | 調 has `ちょう`; 査 has `さ`. Searching the case and exposing evidence makes the investigation concrete. |
| `kanji-21-30-shuchou` | `しゅ—ちょう` → `しゅ・ちょ・う` | 主 has `しゅ`; 張 has `ちょう`. The stretched debate banner displays the claim. |
| `kanji-41-50-tsuuchou` | `つう—ちょう` → `つ・う・ちょ・う` | 通 has `つう`; 帳 has `ちょう`. Transactions moving through the notebook anchor bankbook. |
| `kanji-51-60-choujou` | `ちょう—じょう` → `ちょ・う・じょ・う` | 頂 has `ちょう`; 上 has `じょう`. Both are correctly described as on'yomi, and the stacked mountaintop scene anchors summit. |
| `kanji-51-60-kankonsousai` | `CAN—CON—SEW—SIGH` → `か・ん・こ・ん・そ・う・さ・い` | CAN and CON preserve both nasals; SEW and SIGH preserve the two long-vowel sequences. The crown, wedding, funeral veil, and mistimed festival form one causal ceremonial parade. |

The six former `CHOW` cues are gone. Their replacements preserve the required small `ょ` and long `う` through exact component readings rather than the English /tʃaʊ/ sound.

## 枯れ葉 verification

`kanji-51-60-kareha` remains correct. Its cue uses `枯れ` → `かれ` and `葉` → `は`, then turns a brittle branch and falling leaf into the meaning consequence. It contains no `彼は`, no topic particle, and no false homophone claim.

## Complete pass inventory

- Levels 1–10 (27): `kanji-01-10-totte`, `kanji-01-10-hitokuchi`, `kanji-01-10-daiku`, `kanji-01-10-nyuushu`, `kanji-01-10-yuuhi`, `kanji-01-10-honjitsu`, `kanji-01-10-hibi`, `kanji-01-10-honnin`, `kanji-01-10-tehon`, `kanji-01-10-issai`, `kanji-01-10-chuushin`, `kanji-01-10-furuhon`, `kanji-01-10-shitami`, `kanji-01-10-hitokoto`, `kanji-01-10-sedai`, `kanji-01-10-nanika`, `kanji-01-10-shushoku`, `kanji-01-10-kongo`, `kanji-01-10-demae`, `kanji-01-10-naika`, `kanji-01-10-jouei`, `kanji-01-10-irai`, `kanji-01-10-inai`, `kanji-01-10-seken`, `kanji-01-10-nakami`, `kanji-01-10-shuyaku`, `kanji-01-10-taichou`.
- Levels 11–20 (23): `kanji-11-20-dengon`, `kanji-11-20-tayori`, `kanji-11-20-kyoutsuu`, `kanji-11-20-riyou`, `kanji-11-20-jimi`, `kanji-11-20-seibun`, `kanji-11-20-seichou`, `kanji-11-20-uwagi`, `kanji-11-20-nakaniwa`, `kanji-11-20-kouryuu`, `kanji-11-20-taion`, `kanji-11-20-kyoukan`, `kanji-11-20-yuujou`, `kanji-11-20-gasshuku`, `kanji-11-20-sankou`, `kanji-11-20-hanataba`, `kanji-11-20-kaikei`, `kanji-11-20-kubetsu`, `kanji-11-20-tani`, `kanji-11-20-jushin`, `kanji-11-20-nyuuyoku`, `kanji-11-20-mikaku`, `kanji-11-20-kosei`.
- Levels 21–30 (21): `kanji-21-30-jimu`, `kanji-21-30-kisei`, `kanji-21-30-dansui`, `kanji-21-30-tenken`, `kanji-21-30-chousa`, `kanji-21-30-shinshitsu`, `kanji-21-30-outai`, `kanji-21-30-shuchou`, `kanji-21-30-kokyuu`, `kanji-21-30-kitaku`, `kanji-21-30-jougi`, `kanji-21-30-tenji`, `kanji-21-30-nenpi`, `kanji-21-30-jikyuu`, `kanji-21-30-eiyou`, `kanji-21-30-kyuushoku`, `kanji-21-30-inshou`, `kanji-21-30-shudan`, `kanji-21-30-reitou`, `kanji-21-30-yorimichi`, `kanji-21-30-tekisetsu`.
- Levels 31–40 (19): `kanji-31-40-bunmyaku`, `kanji-31-40-seisou`, `kanji-31-40-amimono`, `kanji-31-40-konzatsu`, `kanji-31-40-moushikomi`, `kanji-31-40-oomori`, `kanji-31-40-sunahama`, `kanji-31-40-musu`, `kanji-31-40-shukkin`, `kanji-31-40-jikoku`, `kanji-31-40-kyuukou`, `kanji-31-40-taizai`, `kanji-31-40-unchin`, `kanji-31-40-norikae`, `kanji-31-40-koukan`, `kanji-31-40-fumikiri`, `kanji-31-40-atesaki`, `kanji-31-40-katazukeru`, `kanji-31-40-chuusha`.
- Levels 41–50 (17): `kanji-41-50-houtai`, `kanji-41-50-shikyuu`, `kanji-41-50-gyougi`, `kanji-41-50-kanjin`, `kanji-41-50-nameraka`, `kanji-41-50-sokuseki`, `kanji-41-50-suitou`, `kanji-41-50-tenmetsu`, `kanji-41-50-shiraga`, `kanji-41-50-hikage`, `kanji-41-50-shitsudo`, `kanji-41-50-hamigaki`, `kanji-41-50-hokori`, `kanji-41-50-tsuuchou`, `kanji-41-50-kankisen`, `kanji-41-50-nikomu`, `kanji-41-50-mudazukai`.
- Levels 51–60 (14): `kanji-51-60-kareha`, `kanji-51-60-choujou`, `kanji-51-60-kankonsousai`, `kanji-51-60-hensachi`, `kanji-51-60-furoshiki`, `kanji-51-60-jojoni`, `kanji-51-60-genkouyoushi`, `kanji-51-60-sueoki`, `kanji-51-60-kenbikyou`, `kanji-51-60-somatsu`, `kanji-51-60-tounyoubyou`, `kanji-51-60-shikousakugo`, `kanji-51-60-mogishiken`, `kanji-51-60-wazurawashii`.

## Disposition

The current source hash passes the independent reading-sound gate: **121/121**. No sound-recovery or false-reading blocker remains in this set.
