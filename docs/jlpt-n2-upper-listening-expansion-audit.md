# JLPT N2 upper-listening expansion audit

**Audit date:** 2026-08-30  
**Scope:** all 40 semantic seeds in `n2-upper-listening-expansion.ts` (8 each for task-based comprehension, comprehension of key points, comprehension of general outline, quick response, and integrated comprehension).  
**Reviewer status:** independent AI editorial review. This is not native-Japanese approval and is not a claim that the items have been validated by the JLPT.

## Official contract used

- The official N2 item-purpose sheet defines task-based comprehension as selecting the action needed to resolve a concrete issue, key-point comprehension as selective listening based on advance information, general-outline comprehension as understanding the speaker's overall intentions or ideas, quick response as choosing an appropriate reply to a short utterance, and integrated comprehension as comparing and integrating multiple sources from a relatively long text ([official N2 item purposes](https://www.jlpt.jp/e/guideline/pdf/n2_e.pdf)).
- The official level summary describes N2 listening as coherent conversations and news reports, delivered at nearly natural speed, in everyday situations and a variety of settings; the listener should be able to follow ideas, relationships, and essential points ([official level summary](https://www.jlpt.jp/e/about/levelsummary.html)).
- The public N2 sample establishes four printed choices available before the stimulus for task and key-point items, four audio-only choices after the stimulus for outline items, three audio-only choices for quick response, and integrated items in which choices follow a longer multi-source stimulus ([2018 N2 listening booklet](https://www.jlpt.jp/samples/sample2018/pdf/N2L.pdf), [2018 N2 script](https://www.jlpt.jp/samples/sample2018/pdf/N2script.pdf)). The public samples establish item mechanics and exemplars, not a complete disclosure of live-test content or fixed passage-length rules ([official sample index](https://www.jlpt.jp/e/samples/sampleindex.html)).

## Release verdict

**No P1 or P2 content defect remains in this isolated tranche after remediation.** The 40 items satisfy the documented presentation contract, every task option is audibly grounded, every outline key is global rather than a recalled detail, every reviewed quick-response item has one pragmatically best reply, and every integrated item requires reconciling multiple speakers or constraints. Human native-Japanese editorial review and natural-speed audio audition remain release-quality gates.

| Family                           | Reviewed | Verdict | Audit result                                                                                                                                                                                                         |
| -------------------------------- | -------: | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Task-based comprehension         |        8 | Pass    | Four printed choices; all 32 alternatives are audibly introduced as the selected action, a rejected action, a conditional fallback, or a later step. Keys require ordering or condition tracking.                    |
| Comprehension of key points      |        8 | Pass    | Four printed choices; each question identifies the advance listening target. Keys depend on a stated reason, constraint, or contrast rather than general topic recognition.                                          |
| Comprehension of general outline |        8 | Pass    | Four audio-only choices after the stimulus. Every key captures the discourse-level position or purpose; distractors retain real details while reversing or narrowing the conclusion.                                 |
| Quick response                   |        8 | Pass    | Three audio-only choices after a short prompt. All alternatives are grammatical and conversationally plausible in isolation, but only the key directly performs the required pragmatic response.                     |
| Integrated comprehension         |        8 | Pass    | Four audio-only choices after the stimulus; every item has four distinct speakers and requires combining at least two positions, constraints, or pieces of evidence. No final narration repeats the answer verbatim. |

## Itemized remediation

### P1: misleading source-count wording

Three questions said “the three people” although the script contained four substantive speakers. The wording now asks about the discussion as a whole, and tests lock the four-source contract:

- `N2-integrated-coworking-room-allocation`
- `N2-integrated-clinic-video-access`
- `N2-integrated-museum-family-guide`

### P2: incomplete keyed synthesis

- `N2-integrated-study-room-booking`: the original key omitted the administrator's accessibility-equipment reservation constraint. The repaired key now combines the two-hour cap, booking limit, preservation of reservations for equipped rooms, same-day inventory, and release of late reservations.

### P2: answer leakage and distractor quality

- Task, key-point, and outline keys had been concentrated in only two positions even though the runtime preserves authored choice order. The reviewed tranche now uses every one of the four positions in each family; quick response and integrated comprehension also use every available position.
- All eight quick-response sets were rewritten or tightened so wrong replies remain natural Japanese while missing the request, stance, apology, proposed division of work, or social reciprocity in the prompt. ID-specific tests lock all eight reviewed keys.
- Key-point, outline, and integrated distractors were tightened into plausible partial, reversed, missed-condition, or single-speaker interpretations rather than unrelated alternatives.

### P2: language and evidence clarity

The following IDs received targeted wording repairs for naturalness, referent clarity, or exact script-to-option evidence:

- `N2-task-storm-event-backup-room`
- `N2-task-lost-wallet-transit-card`
- `N2-task-museum-guide-reassignment`
- `N2-outline-exercise-startup-barrier`
- `N2-integrated-festival-transport-loop`
- `N2-integrated-clinic-video-access`
- `N2-integrated-commute-support-flexibility`

## Full coverage record

Every semantic item below was reviewed against the five checks specific to its family, in addition to naturalness, level fit, a unique key, grounded distractors, explanation accuracy, and public-sample originality red flags.

- **Task:** `N2-task-storm-event-backup-room`, `N2-task-moving-elevator-booking`, `N2-task-online-order-split-shipment`, `N2-task-training-accessibility-confirmation`, `N2-task-catering-allergy-count-update`, `N2-task-lost-wallet-transit-card`, `N2-task-museum-guide-reassignment`, `N2-task-rental-damage-photo-record`.
- **Key point:** `N2-key-remote-work-information-gap`, `N2-key-return-policy-packaging-condition`, `N2-key-podcast-commute-change`, `N2-key-recycling-bin-feedback`, `N2-key-workshop-attendance-time`, `N2-key-station-sign-sightline`, `N2-key-training-course-prerequisite`, `N2-key-reusable-cup-return-rate`.
- **Outline:** `N2-outline-community-garden-ownership`, `N2-outline-email-recipient-discipline`, `N2-outline-tourism-daily-life-balance`, `N2-outline-library-sound-zones`, `N2-outline-exercise-startup-barrier`, `N2-outline-repairable-product-design`, `N2-outline-meeting-notes-decisions`, `N2-outline-public-art-maintenance`.
- **Quick response:** `N2-quick-proposal-cost-concern`, `N2-quick-draft-checkpoint`, `N2-quick-overlapping-meetings`, `N2-quick-customer-wait-complaint`, `N2-quick-review-reservation`, `N2-quick-favor-reciprocity`, `N2-quick-chart-density-feedback`, `N2-quick-schedule-change-apology`.
- **Integrated:** `N2-integrated-coworking-room-allocation`, `N2-integrated-school-lunch-waste`, `N2-integrated-festival-transport-loop`, `N2-integrated-clinic-video-access`, `N2-integrated-commute-support-flexibility`, `N2-integrated-museum-family-guide`, `N2-integrated-apartment-heat-retrofit`, `N2-integrated-study-room-booking`.

## N2 level differentiation

- Relative to the official N3 description, these N2 items broaden settings beyond uncomplicated everyday exchanges and increase conditional sequencing, contrast, implied evaluation, and relationship tracking. That is consistent with the official distinction between N3's general ability to follow everyday content and N2's ability to follow coherent discourse in a variety of settings ([official level summary](https://www.jlpt.jp/e/about/levelsummary.html)).
- Relative to the official N1 description, these items keep argument structures and implications less abstract and less comprehensive: the listener integrates clear operational or social constraints rather than tracking highly abstract logical structures across broad domains. That preserves the official N2/N1 distinction ([official level summary](https://www.jlpt.jp/e/about/levelsummary.html)).
- Automated script-length bands in the tests are local editorial guardrails, not official JLPT character counts or timing specifications. They are used only to catch obvious one-step N3-like prompts or overly long N1-like discourse.

## Originality check

The 40 scenarios and distinctive answer phrases were compared for obvious overlap with the public N2 examples in the [2009 sample scripts](https://www.jlpt.jp/e/samples/pdf/N2-script.pdf) and the [2018 N2 sample materials](https://www.jlpt.jp/samples/sample2018/). No copied question wording or close scenario-and-wording collision was found. Regression tests also flag a small set of distinctive public-sample phrases. This is an originality red-flag screen, not a plagiarism guarantee or a comparison against undisclosed live JLPT forms.

## Remaining limitations

- This review was performed by an AI, not a native Japanese JLPT item writer. A native editorial pass may still improve register, prosody, or the fine balance among distractors.
- Written scripts were audited, but the rendered TTS audio was not auditioned end to end at natural speed. Pausing, speaker changes, accent, and synthesized prosody can change practical difficulty or inadvertently cue an answer.
- Public samples demonstrate formats, not every permitted live-test variant. Real JLPT item calibration, scaled scoring, and unpublished item statistics are unavailable.
- The expansion remains an isolated tranche at the time of this audit. This report does not assert that shared-bank integration, randomization, or rendered-record counts have been validated here.

## Automated evidence

The focused tests assert exact family counts, stable IDs, collision resistance against the current upper-listening inventory, presentation timing, option counts, full answer-position coverage, all 32 task-option cues, all eight quick-response keys, integrated speaker counts and non-verbatim keys, repaired wording, local N2 complexity bands, explanation coverage, and public-sample phrase red flags. Repository-level bank, diversity, engine, type, and lint checks should be rerun again when the tranche is integrated.
