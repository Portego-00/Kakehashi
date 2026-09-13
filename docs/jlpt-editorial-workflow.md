# JLPT question-bank editorial workflow

Last updated: 2026-08-29

This workflow defines what Kakehashi means by a question, a variant, and a
validated item. It exists to prevent rendered substitutions from being counted
as independent editorial coverage.

## Review unit

The review unit is the **semantic item** identified by
`question.provenance.semanticKey`: one knowledge point, passage argument,
listening scenario, answer key, and distractor rationale. Changing a person,
date, time, venue, option order, or surface wrapper creates a rendering variant;
it does not create a new semantic item.

Every controlled rendering records:

- a stable semantic key;
- its zero-based variant index;
- whether it is hand-authored or a controlled variant;
- a content version; and
- one of `machine-validated`, `sampled-ai-review`, or `human-approved`.

Kakehashi's selection history operates on both record IDs and semantic keys.
It exhausts different semantic items before offering another rendering of an
already practiced item.

## Required human review

`human-approved` may be assigned only after a proficient Japanese editor who
is familiar with the relevant JLPT level has reviewed the fully rendered item.
The editor checks:

1. The Japanese is natural in the stated situation and register.
2. The target vocabulary, grammar, discourse load, reading length, and spoken
   density are plausible for that level independently of adjacent levels.
3. Exactly one option is defensible from the information supplied.
4. Every distractor represents a plausible same-level misconception and is not
   eliminated merely by malformed Japanese.
5. The presentation matches the official family: passage context, four-part
   `★` composition, printed versus spoken choices, illustration, prompt order,
   and three versus four options.
6. The explanation identifies the decisive evidence without inventing a rule
   that is absent from the item.
7. The item is culturally neutral unless all necessary cultural information is
   supplied in the question.
8. The wording is original and not recognizable as a released JLPT or
   third-party quiz item.

Ambiguous, unnatural, mis-levelled, or weak-distractor items are rejected and
return to draft. Editing answer-bearing text increments `contentVersion` and
invalidates prior approval.

## Review record

The production editorial ledger should store, outside the public question
payload:

```text
semanticKey
contentVersion
level
officialType
reviewerId
reviewedAt
decision: approved | revise | reject
naturalnessNotes
levelNotes
answerUniquenessNotes
distractorRationales[3]
formatNotes
originalityNotes
```

For long reading and integrated listening, a second editor should adjudicate
the answer and distractors because inference questions admit more subtle
alternative readings. A second review is also required whenever the first
editor flags uncertainty.

## Release gate

The bank is release-ready only when every semantic item used by production
selection has current `human-approved` coverage. Structural validators,
originality scans, AI/subagent samples, and browser tests remain required, but
none of them can promote an item to `human-approved`.

The release checker is deliberately strict: every selectable rendering of a
semantic item must carry the same nonzero `contentVersion` and the
`human-approved` status. A mixture of approved and machine-reviewed renderings,
or renderings from two content versions, fails the gate instead of allowing one
approved record to mask stale content.

Until that gate is met, the interface and documentation must call the expanded
corpus generated variants or beta content, never a human-validated bank.

## Current state

The generated bank remains below the release gate. Its machine checks and the
independent AI/subagent audits are documented in
[`jlpt-bank-audit.md`](./jlpt-bank-audit.md),
[`jlpt-content-audit-round2.md`](./jlpt-content-audit-round2.md), and
[`jlpt-content-audit-round3.md`](./jlpt-content-audit-round3.md). The focused
lower-level reviews are recorded in
[`jlpt-lower-reading-audit.md`](./jlpt-lower-reading-audit.md) and
[`jlpt-lower-listening-audit.md`](./jlpt-lower-listening-audit.md). Upper
listening is reviewed independently per level in
[`jlpt-n3-upper-listening-expansion-audit.md`](./jlpt-n3-upper-listening-expansion-audit.md),
[`jlpt-n2-upper-listening-expansion-audit.md`](./jlpt-n2-upper-listening-expansion-audit.md),
and
[`jlpt-n1-upper-listening-expansion-audit.md`](./jlpt-n1-upper-listening-expansion-audit.md).
The remediation adds coherent grouped text grammar, meaning-bearing illustrated
verbal expressions, independent upper- and lower-level reading/listening
seeds, and semantic unseen-first selection. Those changes improve the bank but
do not satisfy this workflow's human-approval gate. Official format and level
sources are documented in [`jlpt-research.md`](./jlpt-research.md), with focused
N5–N3 reading evidence in
[`jlpt-lower-reading-research.md`](./jlpt-lower-reading-research.md).
