# N1 upper-listening expansion cross-audit

_Audit date: 2026-08-30. Scope: all 40 records in
`web/src/features/jlpt/questions/generated/n1-upper-listening-expansion.ts`._

## Status and evidence boundary

This is an independent **AI cross-review**, not approval by a proficient human
Japanese editor. The tranche must remain `machine-validated` until a human
reviewer has listened to the rendered audio at the intended speed and reviewed
the complete Japanese, answer keys, distractors, and explanations.

The audit applies the official-purpose and public-format findings recorded in:

- `docs/jlpt-research.md`, especially the N1 listening target, item-family
  purposes, presentation timelines, and copyright/originality limits;
- `docs/jlpt-authentic-item-rubric.md`, for the repository's distinction
  between official facts, public-sample observations, and local editorial
  gates.

For N1, the official level target is coherent conversation, news, and lectures
at natural speed across broad settings, with relationships, logical structure,
and essential points followed comprehensively. The current official families
used here are task-based comprehension, key-point comprehension, general
outline, quick response, and integrated comprehension. Public official samples
were treated as format references only. No public-sample wording or audio was
used as content.

Automated originality checks reject JLPT attribution/placeholders, exact
semantic collisions, and long phrase reuse against the existing N1 bank. The
40 scenarios and their formulations did not raise an obvious public-sample
copying red flag in this review. This is a red-flag screen, not proof of
originality against unpublished live tests or every copyrighted work.

## Severity summary and repairs

### P1 — integrated items leaked the synthesis answer

All eight integrated records originally ended with an authority figure giving
a full decision that closely restated the keyed option. A listener could answer
from the final turn rather than integrate the preceding sources. The repair:

- preserves every semantic ID;
- removes the answer-announcing fifth speaker;
- retains four independent sources and a neutral closing narration;
- asks which proposal best satisfies the speakers' combined conditions;
- sets `sourceCount` to the actual four sources;
- replaces caricatured alternatives with plans assembled from partial evidence
  or a missed constraint;
- keeps four audio-only choices after the stimulus.

Affected IDs:

- `N1-integrated-night-bus-shift-connections`
- `N1-integrated-open-access-rights-and-reciprocity`
- `N1-integrated-river-floodplain-staged-restoration`
- `N1-integrated-school-smartphone-bounded-use`
- `N1-integrated-museum-free-access-capacity`
- `N1-integrated-hybrid-office-predictable-flexibility`
- `N1-integrated-community-air-sensor-calibration`
- `N1-integrated-municipal-translation-risk-tiering`

The river item also received one relevant engineering condition so it remains
a substantial natural-speed N1 source after removal of the answer-giving turn.
The air-sensor item changed the unnatural `公定法による採取` to
`公定法による測定`. The translation item now uses the more natural keyed
wording `権利や健康に関わる場面では専門家と利用者が確認する`.

### P2 — distractors advertised themselves

Six outline items had one or more alternatives that were grammatically valid
but too absolute or implausible for N1. Their keys and scripts were retained;
the alternatives now represent a partial inference, a false binary, an
overgeneralization, or a missed qualification:

- `N1-outline-redundancy-institutional-memory`
- `N1-outline-library-quiet-and-encounter`
- `N1-outline-replica-transforms-access`
- `N1-outline-review-productive-friction`
- `N1-outline-standard-language-and-variation`
- `N1-outline-climate-story-scale-and-agency`

Four quick-response sets likewise received more natural, defensible wrong
replies while retaining exactly one pragmatically best response:

- `N1-quick-causal-claim-restraint`
- `N1-quick-budget-prioritize-scope`
- `N1-quick-low-use-access-barrier`
- `N1-quick-premise-needed-for-conclusion`

No confident P1/P2 defect remained in the other records after the complete
item-by-item pass.

## Per-family verdicts

| Family          | Mechanics                                                                                                                 | Level and construct verdict                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Task            | Four printed choices; question available before the stimulus; all four alternatives explicitly grounded in the recording. | Pass. Professional and civic situations require dependency tracking and a constrained next action rather than keyword recognition.          |
| Key points      | Four printed choices; target known before the stimulus.                                                                   | Pass. Each item requires selective attention to a reason, interpretation, or condition amid competing relevant detail.                      |
| General outline | Four audio-only choices; question after the stimulus.                                                                     | Pass after six distractor repairs. Keys state the global rhetorical intent and are not sentences copied from the stimulus.                  |
| Quick response  | One short prompt and three audio-only replies.                                                                            | Pass after four distractor repairs. Each prompt has one pragmatically best uptake; the alternatives remain natural utterances.              |
| Integrated      | Four audio-only choices after four-source material.                                                                       | Pass after all eight P1 repairs. Each key now combines evidence from at least three sources and is not announced by a concluding authority. |

## Item-by-item record

### Task-based comprehension

| Semantic ID                                     | Verdict | Key and distractor audit                                                                                                                      |
| ----------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `N1-task-procurement-pilot-reversible-sandbox`  | Pass    | The sandbox comparison is the immediate action; price, deployment, and cancellation are all mentioned but deferred.                           |
| `N1-task-laboratory-calibration-quarantine`     | Pass    | Quarantining results and stopping use precede scope notification, sample disposal, and equipment disposal.                                    |
| `N1-task-rail-elevator-alternative-route`       | Pass    | Verifying an accessible route and journey time precedes publishing, staff guidance, and any refund decision; postponement is rejected.        |
| `N1-task-contract-language-controlling-version` | Pass    | The signed controlling-language clause must be established before editing, proposing a revision, or instructing staff to disregard a version. |
| `N1-task-citizen-panel-recruitment-gap`         | Pass    | Multidimensional applicant analysis precedes targeted recruitment, deadline extension, and selection.                                         |
| `N1-task-construction-archaeological-find`      | Pass    | Protecting and recording the affected area is distinct from continuing, closing the whole site, or cleaning the find.                         |
| `N1-task-festival-weather-capacity-check`       | Pass    | Safe capacity with equipment installed is the dependency for relocation, refunds, and scheduling; the outdoor decision remains pending.       |
| `N1-task-water-sensor-manual-verification`      | Pass    | Independent sampling and two-method confirmation precede public-health escalation, replacement, or supply interruption.                       |

### Comprehension of key points

| Semantic ID                                   | Verdict | Selective target                                                                                                               |
| --------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `N1-key-congestion-pilot-transition-confound` | Pass    | The main obstacle is an uncontrolled observation period with disrupted alternatives and incomplete destination-mode data.      |
| `N1-key-archive-silence-recording-practice`   | Pass    | Absence is interpreted as evidence about institutional recording categories, not evidence that conflict did not occur.         |
| `N1-key-replication-measurement-boundary`     | Pass    | The decisive issue is inconsistent operational definition and timing of “recovery,” with sample handling explicitly secondary. |
| `N1-key-mixed-use-temporal-access`            | Pass    | Practical access requires both proximity and availability at the time residents need a service.                                |
| `N1-key-headline-obscured-agency`             | Pass    | Nominal/passive wording removes established agency and obscures causal responsibility.                                         |
| `N1-key-ai-feedback-homogenized-revision`     | Pass    | Surface correctness masks homogenized rhetorical choices and unexamined revision behavior.                                     |
| `N1-key-apology-unacknowledged-impact`        | Pass    | The conditional apology defends intent without acknowledging the concrete exclusionary effect.                                 |
| `N1-key-visitor-limit-recovery-window`        | Pass    | The targeted closure protects a time-and-place recovery window rather than pursuing permanent exclusion or zero visitation.    |

### Comprehension of general outline

| Semantic ID                                   | Verdict        | Global-intent evidence                                                                                                               |
| --------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `N1-outline-redundancy-institutional-memory`  | Repaired, pass | Distinguishes wasteful duplication from overlap that transmits judgment; distractors now encode standardization or overpreservation. |
| `N1-outline-maps-negotiated-choices`          | Pass           | Rejects both naive objectivity and wholesale distrust; purpose and omitted conditions govern responsible use.                        |
| `N1-outline-library-quiet-and-encounter`      | Repaired, pass | Rejects a quiet/interaction binary in favor of designed coexistence; alternatives now offer plausible one-sided policies.            |
| `N1-outline-failed-prediction-model-boundary` | Pass           | Patterned failure tests declared model boundaries without licensing after-the-fact exclusion.                                        |
| `N1-outline-replica-transforms-access`        | Repaired, pass | Replicas create distinct access while retaining limits; distractors now encode substitution and disclosure errors.                   |
| `N1-outline-review-productive-friction`       | Repaired, pass | Purposeful, time-bounded review prevents rework; the repaired distractor overgeneralizes repeated checking.                          |
| `N1-outline-standard-language-and-variation`  | Repaired, pass | Coordination and situated variation can coexist; alternatives now represent separation, rejection, or assimilation.                  |
| `N1-outline-climate-story-scale-and-agency`   | Repaired, pass | The thesis connects personal, local, institutional, and national scales; distractors isolate one otherwise relevant scale.           |

### Quick response

| Semantic ID                              | Verdict        | Pragmatic contrast                                                                                                                               |
| ---------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `N1-quick-causal-claim-restraint`        | Repaired, pass | The best reply preserves association without claiming unisolated causation; alternatives still overclaim but now sound professionally plausible. |
| `N1-quick-minutes-preserve-dissent`      | Pass           | Summarizing decision-relevant dissent is better than erasure or indiscriminate verbatim transcription.                                           |
| `N1-quick-citation-before-release`       | Pass           | Verification of wording and context must precede publication.                                                                                    |
| `N1-quick-budget-prioritize-scope`       | Repaired, pass | Prioritizing decision-critical evidence beats uniform thinning or shortening the whole observation window.                                       |
| `N1-quick-low-use-access-barrier`        | Repaired, pass | Low uptake prompts investigation of access conditions, not an immediate demand or publicity conclusion.                                          |
| `N1-quick-failure-case-learning`         | Pass           | An explained failure should delimit applicability rather than be hidden for presentation value.                                                  |
| `N1-quick-alternate-approval-route`      | Pass           | Authorized delegation is the appropriate response to absence; informal or retrospective approval is not.                                         |
| `N1-quick-premise-needed-for-conclusion` | Repaired, pass | Editing should retain interpretation-critical premises; the alternatives now offer plausible but inadequate omission strategies.                 |

### Integrated comprehension

| Semantic ID                                           | Verdict after repair | Sources that must be integrated                                                                                       |
| ----------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `N1-integrated-night-bus-shift-connections`           | Pass                 | Shift timing, separate-crew rest rules, a fixed minimum network, and phone/web accessible booking.                    |
| `N1-integrated-open-access-rights-and-reciprocity`    | Pass                 | Rights retention, lawful delayed release, consent-based data limits, and accessible summaries.                        |
| `N1-integrated-river-floodplain-staged-restoration`   | Pass                 | Basin safety, staged ecological evidence, cultivator compensation, and downstream stop conditions.                    |
| `N1-integrated-school-smartphone-bounded-use`         | Pass                 | Bounded instructional use, equitable device access, attention management, and explicit emergency routes.              |
| `N1-integrated-museum-free-access-capacity`           | Pass                 | Free permanent access, mixed admission channels, non-coercive independent funding, and distributional evaluation.     |
| `N1-integrated-hybrid-office-predictable-flexibility` | Pass                 | Reversible space trial, predictable collaboration, accessible work settings, and outcome-based evaluation.            |
| `N1-integrated-community-air-sensor-calibration`      | Pass                 | Community coverage, reference-station calibration, uncertainty, and official-method enforcement triggers.             |
| `N1-integrated-municipal-translation-risk-tiering`    | Pass                 | Consequence-based tiers, expert support in high-risk encounters, user testing, and prevalidated urgent communication. |

## Remaining limitations and release gate

- The official JLPT publishes qualitative natural-speed and competence targets,
  not a numeric N1 TTS rate. The rendered voices, pauses, speaker separation,
  and total listening burden still require an audio audition.
- Automated tests and this AI review cannot certify native naturalness or a
  uniquely best answer with the authority of a proficient human editor.
- The official integrated family permits variants, including printed-choice
  multi-question forms. This tranche intentionally uses the supported
  one-question, four-audio-only-choice variant; it does not represent every
  possible official variant.
- Public samples can identify format and obvious copying risks but cannot prove
  originality against unpublished live questions. Stable IDs and scenario
  collision checks are repository safeguards, not an official JLPT approval.
- English explanations are review aids. A final product-language review should
  confirm whether learner-facing explanations need localization.

Release should remain blocked on a proficient Japanese editor's signed review
and a complete TTS audition. No human approval is claimed here.
