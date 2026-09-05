# N3 upper-listening expansion audit

_Audit date: 2026-08-30. Scope:
`web/src/features/jlpt/questions/generated/n3-upper-listening-expansion.ts`._

## Status and limits

This is an independent AI editorial and implementation review of the 32-item
isolated N3 tranche. It checks mechanics, internal answer evidence, distractor
quality, explanation accuracy, conservative level fit, and limited originality
red flags. It is **not** native-Japanese review, a TTS listening audition, or
human JLPT-editor approval. The exported status therefore remains
`machine-validated`; this audit does not authorize `human-approved`.

The public evidence used here is the same first-party material recorded in
`docs/jlpt-research.md`: the [current item-composition
matrix](https://www.jlpt.jp/e/guideline/testsections.html), the [N3 item-purpose
sheet](https://www.jlpt.jp/e/guideline/pdf/n3_e.pdf), the [official level
summary](https://www.jlpt.jp/e/about/levelsummary.html), the [official detailed
guidebook](https://www.jlpt.jp/e/reference/pdf/guidebook1e.pdf), and the [2018
N3 listening booklet and script](https://www.jlpt.jp/samples/sampleindex.html).
These sources define form and target competence; they do not provide a current
vocabulary list or an automatic way to certify level.

## Official-form result

| Family | Required public form | Expansion result |
| --- | --- | --- |
| Task-based | Four printed choices; situation/question before one coherent stimulus; question repeated after it; resolve a practical issue or action | **Pass, 8/8.** Every record is `before-stimulus`, has four visible choices, and asks for an action or practical resolution. |
| Key points | Target known before the stimulus; four printed choices; selective extraction of an essential point | **Pass, 8/8.** Every target is available in advance and requires selecting a reason, problem, correction, schedule cause, preference, or constrained choice. |
| General outline | Coherent stimulus first; question and four choices after it; choices are audio-only; identify intention or overall point | **Pass, 8/8.** Every record is `after-stimulus`, has four audio-only choices, and its key requires evidence distributed across the discourse. |
| Quick response | One short prompt followed by three audio-only replies | **Pass after repair, 8/8.** Every record is `prompt-only`, has three spoken candidates, and retained one pragmatic reply after challenging the nearest rival. |

N3 officially targets coherent everyday conversation at near-natural speed and
the ability to follow content and participant relationships. The local length
bands below are conservative Kakehashi heuristics, not official limits:

| Family | Items | Normalized stimulus range | Level evidence |
| --- | ---: | ---: | --- |
| Task-based | 8 | 147–198 characters | Multi-role assignment, failed-action recovery, fallback conditions, schedule constraints, or ordered approval. |
| Key points | 8 | 113–158 characters | Contrast and reason selection rather than isolated word recognition; the revised recycling item now asks for the cause of a schedule change. |
| General outline | 8 | 176–205 characters | Five or more sentences with contrast, intervention, evidence, and a conclusion or purpose that must be summarized. |
| Quick response | 8 | 19–29 characters | Short natural prompts using invitations, requests, reminders, offers, warnings, workplace notice, and telephone repair. |

## Item-by-item evidence

### Task-based comprehension

Each row below reconstructs all four printed alternatives. The four-way cue
mapping is also pinned in the colocated regression test.

| Stable ID | Four-choice grounding and unique-key judgment | Verdict |
| --- | --- | --- |
| `N3-task-market-flyer-final-check` | Shop call belongs to the woman; the rain-date is still wrong; print submission waits for her screen check; the map is already fixed. The man's immediate action is the rain-date correction. | Pass after wording repair |
| `N3-task-apartment-repair-morning-window` | Thursday conflicts with work; Saturday 9–11 fits presence and access; noon conflicts with entrance work; staff bring the part. | Pass |
| `N3-task-meeting-chart-source-note` | Numbers, color, source note, and delivery are all heard and assigned to different completion states or people. Only the missing source note belongs to the man now. | Pass |
| `N3-task-station-lost-phone-web-form` | Calling has failed, the box is useful after recovery, the web report is the current step, and notification follows a match. | Pass after naturalness repair |
| `N3-task-cooking-event-soup-role` | Curry, salad, vegetable purchase, and soup are all discussed. Existing roles and delivery remove the first three; the man accepts a dairy-free soup constrained by a participant's diet. | Pass after level/distractor repair |
| `N3-task-library-projector-reservation` | Room and handouts are complete, projector application is required, and moving rooms is conditional on no projector being available. | Pass |
| `N3-task-club-rain-indoor-training` | Outdoor running is canceled, the gym belongs to another club, stretching fits the available room, and strength work stays on Friday. | Pass |
| `N3-task-parcel-return-convenience-store` | Daytime pickup conflicts with work, the physical shop rejects the online return, convenience-store shipping is available, and the return form must go inside rather than remain home. | Pass |

### Key-point comprehension

| Stable ID | Selective-listening judgment | Verdict |
| --- | --- | --- |
| `N3-key-gym-morning-quiet` | The speaker prefers evening physically but chooses mornings to avoid equipment waits; price and employer rules are not supported. | Pass |
| `N3-key-recycling-collection-friday` | The target is now the reason for the Friday change. The holiday alone causes the shift; other collection days, next week's return, and rain are audible but noncausal. | Pass after level repair |
| `N3-key-apartment-morning-train-noise` | Convenience, neighbor noise, and road traffic are contrasted with the early train noise that wakes him. | Pass |
| `N3-key-online-course-feedback-delay` | Video and exercises are praised; only the week-long answer delay blocks progress to the next task. | Pass |
| `N3-key-bicycle-arrival-predictability` | Exercise is secondary and rain is a limitation; consistent cycling time compared with delayed buses is the main reason. | Pass after option naturalization |
| `N3-key-report-photo-caption` | Counts, map, and photograph are accepted. Only the caption identifies the wrong event. | Pass |
| `N3-key-small-plant-gift` | Travel frequency rules out daily care and limited room rules out a large plant. Four same-domain size/care combinations now leave one key. | Pass after distractor repair |
| `N3-key-festival-information-desk-role` | Transit blocks early setup, physical demand weakens cleanup, cooking experience blocks the food stall, and language plus time fit the information desk. | Pass after distractor repair |

### General-outline comprehension

| Stable ID | Whole-discourse dependency | Verdict |
| --- | --- | --- |
| `N3-outline-lunch-container-return-trial` | The problem, deposit, two return points, and trial evaluation jointly establish a waste-reduction return system. | Pass |
| `N3-outline-neighborhood-news-two-formats` | The limits of monthly paper, speed of mobile updates, and continued need for paper jointly support a two-format policy. | Pass |
| `N3-outline-shop-closing-time-trial` | Low early-week demand, crowded Friday demand, redistributed hours, and later evaluation establish a weekday-sensitive trial. | Pass |
| `N3-outline-museum-touch-models` | Fragile originals, limits of written description, and tactile model affordances support access without exposing the originals. | Pass |
| `N3-outline-study-error-notebook` | Repeated mistakes, recording their causes, discovering a pattern, and changing future attention support diagnostic review rather than answer memorization. | Pass |
| `N3-outline-park-shade-observation` | The rejected entrance plan, observed shade use, week-long recording, and final placements make evidence-led siting the overall point. | Pass |
| `N3-outline-bakery-reservation-balance` | Waste and sellouts motivate reservations, while weather, weekday demand, and walk-ins prevent reservation-only production. | Pass |
| `N3-outline-reading-group-viewpoints` | Silence caused by answer-seeking, assigned viewpoints, textual evidence, and final comparison support viewpoint-based discussion. | Pass |

None of the eight can be solved reliably from a single isolated detail while
ignoring the rest of the monologue. Item-specific cues from the opening,
middle, and conclusion are regression-pinned.

### Quick response: second-reply challenge

| Stable ID | Key | Closest rival challenged and why it is not defensible | Verdict |
| --- | --- | --- | --- |
| `N3-quick-dinner-date-alternative` | Decline Friday and offer Saturday | Merely observing that everyone is going does not accept, decline, or negotiate the invitation. | Pass |
| `N3-quick-document-review-tomorrow` | State today's conflict and offer tomorrow morning | Saying the document was placed on a desk or copied supplies no availability answer. | Pass after malformed rival repair |
| `N3-quick-homemade-soup-compliment` | Thank the speaker and explain the cooking | Offering to buy vegetables does not receive the compliment; claiming not to have tasted the soup contradicts it. | Pass |
| `N3-quick-forgot-form-submission` | Apologize and commit to next-morning delivery | Stating where forms are kept or when this copy was received does not answer the reminder. The former deadline-clarification reply could defensibly reopen the premise and was removed. | Pass after second-answer repair |
| `N3-quick-wrong-extension-call` | Apologize and request transfer to HR | A question about accounting work or a statement that HR called does not repair the wrong extension. | Pass |
| `N3-quick-offer-group-photo` | Thank and accept the offer | Prior photo sending and camera ownership do not accept or reject the offered shutter help. | Pass |
| `N3-quick-crowded-train-warning` | Acknowledge the warning and choose the following train | A future event fact does not respond to this crowd warning, while saying the train was empty reverses it. | Pass after malformed rival repair |
| `N3-quick-colleague-leaving-early` | Accept the departure and offer message support | Hospital location and saying the colleague did not come to work do not respond to the stated early departure. | Pass after malformed rival repair |

The quick-response answer positions now span all three spoken positions, so the
isolated semantic stream does not encode an answer-position shortcut.

## Repairs made in this audit

1. Naturalized `N3-task-market-flyer-final-check` from the vague `雨の日の日付`
   to `雨の場合の開催日`.
2. Rebuilt the station exchange in
   `N3-task-station-lost-phone-web-form`: the owner now reports the failed call,
   and the unnatural `ウェブの紙` became `ウェブフォーム` with `入力する`.
3. Raised `N3-task-cooking-event-soup-role` above a simple N4-style leftover
   assignment by adding a dietary constraint and four fully grounded actions.
4. Changed `N3-key-recycling-collection-friday` from bare date recall to the
   reason for the temporary schedule change, with four audible causal rivals.
5. Naturalized the bicycle key as `駅までかかる時間が予想しやすい`.
6. Replaced the plant item's unrelated furniture/bag distractors with four
   same-domain size-and-care combinations.
7. Removed the duplicate cleanup/heavy-lifting alternatives in the festival
   item and introduced a separately constrained food-stall role.
8. Removed a defensible deadline-clarification reply from the forgotten-form
   quick item.
9. Replaced malformed or temporally incoherent quick-response distractors:
   `今日中の資料を見てもらいました`, `昨日、その紙をもらう予定です`,
   `イベントは駅で開きました`, and `病院は三時に帰りました`.
10. Distributed quick-response keys across positions 1–3 and added regression
    assertions for every retained key and every removed red flag.

All semantic IDs remain unchanged.

## Originality screen

- All 32 semantic IDs, English focus statements, and normalized Japanese
  scripts are unique within the tranche and do not exactly collide with the
  current baseline upper-listening inventory.
- Regression checks exclude wording previously identified from official/public
  examples or prior audit red flags, including `一人で運ぶにはちょっと重い`,
  `昨日の発表、どうだった`, and `どなたか座っていますか`.
- No item identifies itself as official, attributes its wording to JLPT, or
  contains a sample/template marker.

This is a limited red-flag screen, not proof of originality against every past
administration or third-party site. Public PDF text contains interleaved ruby
text that prevents a clean corpus-wide exact-string assertion from serving as
strong proof. Human editors must still compare suspicious scenarios and hear
the final synthesized audio.

## Release limitations

1. No proficient native Japanese editor has approved naturalness, pragmatic
   uniqueness, or exact N3 fit.
2. No listening audition has checked the final TTS prosody, speaker boundaries,
   pauses, or near-natural N3 delivery.
3. The isolated expansion is not integrated into selection or mock assembly,
   by design.
4. Eight items per family are substantive new semantic scenarios, not the
   requested final inventory of 200 independently authored items per cell.
